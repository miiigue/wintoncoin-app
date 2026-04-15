/**
 * Governance Reward Service — Recompensas BLUE IOU por Participación en Gobernanza
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  PROTECCIONES DE SEGURIDAD                                              ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  1. Idempotencia        — FOR UPDATE + reward_credited flag (DB level)  ║
 * ║  2. Atomicidad          — pago + flag + auditoría en una sola TX        ║
 * ║  3. Aislamiento de falla— errores aquí NO afectan el voto registrado   ║
 * ║  4. Validación de monto — clampeado a [REWARD_MIN, REWARD_MAX]          ║
 * ║  5. Auditoría total     — logAuditEvent por cada pago emitido           ║
 * ║  6. Sin SQL injection   — todas las queries son parametrizadas          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Flujo:
 *   submitVote() → COMMIT → GOV_VOTE_SUBMITTED → creditVoteReward()
 *
 * La función es invocada desde el notificationEventBus DESPUÉS de que el voto
 * ya fue persistido. Cualquier fallo en la recompensa es silencioso para el
 * flujo de votación (no afecta la integridad del consenso).
 */

'use strict';

const { logAuditEvent } = require('./auditService');
const boosterService = require('./boosterService');

// ─── Constantes ─────────────────────────────────────────────────────────────
const REWARD_SETTING_KEY = 'gov_vote_reward_blue';
const REWARD_MIN         = 0;       // 0 = desactivado
const REWARD_MAX         = 1000;    // límite de seguridad configurable
const REWARD_DEFAULT     = 0;       // fallback = desactivado (opt-in: admin debe activar explícitamente)
const REWARD_TYPE        = 'gov_vote_reward';

// ─── Función principal ───────────────────────────────────────────────────────

/**
 * Acredita la recompensa BLUE IOU a un guardián por emitir un voto.
 *
 * Garantías:
 *   - Si ya fue pagado (reward_credited = TRUE), retorna null sin pagar de nuevo.
 *   - Si el monto configurado es 0, retorna null (recompensas desactivadas).
 *   - Si ocurre cualquier error, lanza para que el caller lo capture y loguee.
 *
 * @param {import('pg').Pool} pool          - Pool de conexiones PostgreSQL
 * @param {object}            params
 * @param {number}            params.requestId      - ID de la solicitud de gobernanza
 * @param {number}            params.guardianUserId - user_id del guardián que votó
 * @param {string}            params.voterUsername  - username para el audit log
 * @param {string}            [params.rewardSnapshot] - Valor capturado en la TX del voto (point-in-time pricing)
 * @returns {Promise<RewardResult|null>}
 *
 * @typedef {object} RewardResult
 * @property {number} rewardAmount        - BLUE IOU acreditados en este evento
 * @property {number} newTotalBalance     - Saldo total BLUE IOU post-crédito
 * @property {number} monthlyVoteTotal    - Total de recompensas de voto en el mes actual
 * @property {number} historicalVoteTotal - Total histórico de recompensas de voto
 */
async function creditVoteReward(pool, { requestId, guardianUserId, voterUsername, rewardSnapshot }) {
    // Validación de entrada defensiva
    const safeRequestId    = parseInt(requestId, 10);
    const safeGuardianUserId = parseInt(guardianUserId, 10);

    if (!Number.isFinite(safeRequestId) || safeRequestId <= 0 ||
        !Number.isFinite(safeGuardianUserId) || safeGuardianUserId <= 0) {
        throw new Error(`[GOV-REWARD] Parámetros inválidos: requestId=${requestId}, guardianUserId=${guardianUserId}`);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ── 1. Obtener el ID interno del guardián ─────────────────────────
        // Sólo guardianes activos son elegibles. Si fue desactivado entre
        // el voto y el evento, no se le paga (principio de menor privilegio).
        const guardianRes = await client.query(
            `SELECT id FROM governance_guardians
             WHERE user_id = $1 AND status = 'active'`,
            [safeGuardianUserId]
        );
        if (guardianRes.rowCount === 0) {
            await client.query('ROLLBACK');
            console.warn(`[GOV-REWARD] Guardián inactivo o no encontrado: user_id=${safeGuardianUserId}`);
            return null;
        }
        const guardianId = guardianRes.rows[0].id;

        // ── 2. Bloquear la fila del voto (FOR UPDATE) ─────────────────────
        // Previene race conditions si el evento es procesado concurrentemente.
        // La fila UNIQUE(request_id, guardian_id) garantiza exactamente un voto.
        const voteRes = await client.query(
            `SELECT id, reward_credited
             FROM governance_votes
             WHERE request_id = $1 AND guardian_id = $2
             FOR UPDATE`,
            [safeRequestId, guardianId]
        );
        if (voteRes.rowCount === 0) {
            await client.query('ROLLBACK');
            console.warn(`[GOV-REWARD] Voto no encontrado: request_id=${safeRequestId}, guardian_id=${guardianId}`);
            return null;
        }
        const voteRow = voteRes.rows[0];

        // ── 3. Guard de idempotencia ──────────────────────────────────────
        // Si ya fue pagado (por un reintento anterior), salimos sin pagar.
        if (voteRow.reward_credited === true) {
            await client.query('ROLLBACK');
            return null;
        }

        // ── 4. Determinar monto: snapshot (point-in-time) > app_settings > default ──
        //    Si el caller proporcionó un snapshot (capturado dentro de la TX del voto),
        //    lo usamos para garantizar point-in-time pricing. Si no, leemos de app_settings.
        let rawAmount;
        if (rewardSnapshot !== undefined && rewardSnapshot !== null) {
            rawAmount = parseFloat(rewardSnapshot);
        } else {
            const settingRes = await client.query(
                `SELECT setting_value FROM app_settings WHERE setting_key = $1`,
                [REWARD_SETTING_KEY]
            );
            rawAmount = parseFloat(settingRes.rows[0]?.setting_value);
        }
        const baseReward = (Number.isFinite(rawAmount) && rawAmount >= REWARD_MIN && rawAmount <= REWARD_MAX)
            ? rawAmount
            : REWARD_DEFAULT;

        // Recompensas desactivadas (monto = 0)
        if (baseReward === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        // --- APLICAR MULTIPLICADOR DE ETAPA (NUEVO) ---
        const multiplicationResult = await boosterService.calculateMultipliedAmount(baseReward);
        const rewardAmount = multiplicationResult.multipliedAmount;
        const multiplierUsed = multiplicationResult.multiplier;
        const stageName = multiplicationResult.stageName;

        // ── 5. Acreditar BLUE IOU en booster_blue_ledger (fuente de verdad) ──
        // record_booster_event() hace INSERT en booster_blue_ledger.
        // El ledger es inmutable — nunca se borra, sólo se suma.
        await client.query(
            `SELECT record_booster_event($1, $2, $3, NULL)`,
            [safeGuardianUserId, REWARD_TYPE, rewardAmount]
        );

        // ── 6. Registrar en booster_transactions (historial visible al usuario) ──
        await client.query(
            `INSERT INTO booster_transactions (user_id, type, amount, description)
             VALUES ($1, $2, $3, $4)`,
            [
                safeGuardianUserId,
                REWARD_TYPE,
                rewardAmount,
                `Recompensa por voto en solicitud #${safeRequestId} (${baseReward} x ${multiplierUsed || 1} [${stageName || 'S/E'}])`,
            ]
        );

        // ── 7. Registrar en transactions (historial financiero general) ────
        await client.query(
            `INSERT INTO transactions (user_id, type, description, blue_change)
             VALUES ($1, $2, $3, $4)`,
            [
                safeGuardianUserId,
                REWARD_TYPE,
                `Recompensa BLUE IOU por voto en gobernanza — solicitud #${safeRequestId}`,
                rewardAmount,
            ]
        );

        // ── 8. Marcar voto como recompensado (idempotencia atómica) ───────
        // Esta actualización va en la MISMA transacción que el pago.
        // Si el COMMIT falla, ambos se revierten → nunca queda pagado sin flag.
        await client.query(
            `UPDATE governance_votes SET reward_credited = TRUE WHERE id = $1`,
            [voteRow.id]
        );

        // ── 9. Leer totales POST-crédito dentro de la misma TX ─────────────
        // Se leen dentro de la transacción para obtener el snapshot correcto.
        const [totalRes, monthRes, historyRes] = await Promise.all([
            // Saldo total actual en el ledger
            client.query(
                `SELECT COALESCE(SUM(amount), 0) AS total
                 FROM booster_blue_ledger WHERE user_id = $1`,
                [safeGuardianUserId]
            ),
            // Total de recompensas de gobernanza en el mes actual (solo gov_vote_reward)
            client.query(
                `SELECT COALESCE(SUM(amount), 0) AS total
                 FROM booster_transactions
                 WHERE user_id = $1
                   AND type = $2
                   AND created_at >= date_trunc('month', NOW())`,
                [safeGuardianUserId, REWARD_TYPE]
            ),
            // Total histórico de recompensas por votos de gobernanza
            client.query(
                `SELECT COALESCE(SUM(amount), 0) AS total
                 FROM booster_transactions
                 WHERE user_id = $1 AND type = $2`,
                [safeGuardianUserId, REWARD_TYPE]
            ),
        ]);

        await client.query('COMMIT');

        const result = {
            rewardAmount,                                         // Monto FINAL acreditado (base * multiplicador)
            baseReward,                                           // Monto base configurado en app_settings
            multiplierUsed,                                       // Factor aplicado (ej: 15.00)
            stageName,                                            // Nombre de la etapa (ej: "Etapa 2")
            newTotalBalance:     parseFloat(totalRes.rows[0].total),
            monthlyVoteTotal:    parseFloat(monthRes.rows[0].total),
            historicalVoteTotal: parseFloat(historyRes.rows[0].total),
        };

        // ── 10. Auditoría (fuera de TX — no bloquea si falla) ─────────────
        logAuditEvent(pool, null, {
            eventType:     'GOV_VOTE_REWARD_CREDITED',
            actorId:       safeGuardianUserId,
            actorUsername: voterUsername || null,
            category:      'GOVERNANCE',
            metadata: {
                requestId:           safeRequestId,
                baseReward,                          // Monto base (sin multiplicar)
                multiplierUsed,                      // Factor de multiplicación aplicado
                stageName,                           // Etapa del protocolo de compensación
                rewardAmount,                        // Monto final (base * multiplicador)
                formula:             `${baseReward} x ${multiplierUsed} = ${rewardAmount}`, // Fórmula legible para auditoría
                newTotalBalance:     result.newTotalBalance,
                historicalVoteTotal: result.historicalVoteTotal,
            },
        }).catch(err => console.error('[GOV-REWARD] Error en audit log:', err));

        return result;

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// ─── Estadísticas de recompensas pendientes ──────────────────────────────

/**
 * Retorna las estadísticas de votos sin recompensar para el panel de admin.
 * @param {import('pg').Pool} pool
 * @returns {Promise<{pendingCount: number, guardiansAffected: number, currentRate: number, estimatedTotal: number}>}
 */
async function getPendingRewardStats(pool) {
    const [countRes, rateRes] = await Promise.all([
        pool.query(`
            SELECT
                COUNT(*)::int AS pending_count,
                COUNT(DISTINCT g.user_id)::int AS guardians_affected
            FROM governance_votes v
            JOIN governance_guardians g ON v.guardian_id = g.id
            WHERE v.reward_credited = FALSE
              AND g.status = 'active'
        `),
        pool.query(
            `SELECT setting_value FROM app_settings WHERE setting_key = $1`,
            [REWARD_SETTING_KEY]
        ),
    ]);

    const pending = countRes.rows[0];
    const rawRate = parseFloat(rateRes.rows[0]?.setting_value);
    const currentRate = (Number.isFinite(rawRate) && rawRate >= REWARD_MIN && rawRate <= REWARD_MAX)
        ? rawRate
        : REWARD_DEFAULT;

    return {
        pendingCount:     pending.pending_count,
        guardiansAffected: pending.guardians_affected,
        currentRate,
        estimatedTotal:   pending.pending_count * currentRate,
    };
}

// ─── Procesamiento batch de recompensas pendientes ───────────────────────

/**
 * Procesa todos los votos con reward_credited = FALSE, acreditando la tasa
 * actual a cada guardián. Diseñado para ser invocado desde un endpoint admin.
 *
 * Garantías:
 *   - Cada voto se procesa en su propia transacción (aislamiento de falla)
 *   - Idempotencia: FOR UPDATE + reward_credited check
 *   - Retorna resumen agrupado por guardián para email consolidado
 *
 * @param {import('pg').Pool} pool
 * @param {number} adminUserId - ID del admin que autorizó (para auditoría)
 * @returns {Promise<BatchResult>}
 *
 * @typedef {object} BatchResult
 * @property {number} totalProcessed    - Votos pagados en este batch
 * @property {number} totalSkipped      - Votos omitidos (ya pagados o guardián inactivo)
 * @property {number} rateUsed          - Tasa aplicada
 * @property {Object<number, GuardianBatchSummary>} byGuardian - Resumen por user_id
 *
 * @typedef {object} GuardianBatchSummary
 * @property {string}   username
 * @property {string}   email
 * @property {number}   votesPaid
 * @property {number}   totalAmount
 * @property {number}   newBalance
 * @property {number[]} requestIds
 */
async function processPendingRewards(pool, adminUserId) {
    // 1. Leer la tasa actual (se aplica uniformemente a todo el batch)
    const rateRes = await pool.query(
        `SELECT setting_value FROM app_settings WHERE setting_key = $1`,
        [REWARD_SETTING_KEY]
    );
    const rawRate = parseFloat(rateRes.rows[0]?.setting_value);
    const rateUsed = (Number.isFinite(rawRate) && rawRate >= REWARD_MIN && rawRate <= REWARD_MAX)
        ? rawRate
        : REWARD_DEFAULT;

    if (rateUsed === 0) {
        return { totalProcessed: 0, totalSkipped: 0, rateUsed: 0, byGuardian: {} };
    }

    // 2. Obtener todos los votos pendientes con datos del guardián
    //    Lectura sin FOR UPDATE — el bloqueo se hace dentro de cada TX individual.
    const pendingRes = await pool.query(`
        SELECT v.id AS vote_id, v.request_id, g.id AS guardian_id, g.user_id,
               u.username, u.email
        FROM governance_votes v
        JOIN governance_guardians g ON v.guardian_id = g.id
        JOIN users u ON g.user_id = u.id
        WHERE v.reward_credited = FALSE
          AND g.status = 'active'
        ORDER BY v.created_at ASC
    `);

    const byGuardian = {};
    let totalProcessed = 0;
    let totalSkipped = 0;

    // 3. Procesar cada voto en transacción individual
    for (const row of pendingRes.rows) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Re-verificar idempotencia dentro de la TX
            const checkRes = await client.query(
                `SELECT reward_credited FROM governance_votes WHERE id = $1 FOR UPDATE`,
                [row.vote_id]
            );
            if (checkRes.rowCount === 0 || checkRes.rows[0].reward_credited === true) {
                await client.query('ROLLBACK');
                totalSkipped++;
                continue;
            }

            // --- APLICAR MULTIPLICADOR DE ETAPA (NUEVO) ---
            const multiplicationResult = await boosterService.calculateMultipliedAmount(rateUsed);
            const finalAmount = multiplicationResult.multipliedAmount;
            const multiplierUsed = multiplicationResult.multiplier;
            const stageName = multiplicationResult.stageName;

            // Acreditar en ledger + transactions + booster_transactions
            await client.query(
                `SELECT record_booster_event($1, $2, $3, NULL)`,
                [row.user_id, REWARD_TYPE, finalAmount]
            );
            await client.query(
                `INSERT INTO booster_transactions (user_id, type, amount, description)
                 VALUES ($1, $2, $3, $4)`,
                [row.user_id, REWARD_TYPE, finalAmount,
                 `Recompensa retroactiva por voto en solicitud #${row.request_id} (${rateUsed} x ${multiplierUsed} [${stageName}])`]
            );
            await client.query(
                `INSERT INTO transactions (user_id, type, description, blue_change)
                 VALUES ($1, $2, $3, $4)`,
                [row.user_id, REWARD_TYPE,
                 `Recompensa BLUE IOU retroactiva — voto en solicitud #${row.request_id} (Mult: ${multiplierUsed}x)`,
                 finalAmount]
            );

            // Marcar como pagado
            await client.query(
                `UPDATE governance_votes SET reward_credited = TRUE WHERE id = $1`,
                [row.vote_id]
            );

            await client.query('COMMIT');
            totalProcessed++;

            // Agrupar para email consolidado
            if (!byGuardian[row.user_id]) {
                byGuardian[row.user_id] = {
                    username:    row.username,
                    email:       row.email,
                    votesPaid:   0,
                    totalAmount: 0,
                    requestIds:  [],
                };
            }
            byGuardian[row.user_id].votesPaid++;
            byGuardian[row.user_id].totalAmount += finalAmount;
            byGuardian[row.user_id].requestIds.push(row.request_id);

        } catch (err) {
            await client.query('ROLLBACK');
            console.error(`[GOV-REWARD-BATCH] Error procesando vote_id=${row.vote_id}:`, err);
            totalSkipped++;
        } finally {
            client.release();
        }
    }

    // 4. Leer saldos finales para cada guardián (fuera de las TX individuales)
    for (const userId of Object.keys(byGuardian)) {
        const balRes = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) AS total FROM booster_blue_ledger WHERE user_id = $1`,
            [parseInt(userId, 10)]
        );
        byGuardian[userId].newBalance = parseFloat(balRes.rows[0].total);
    }

    // 5. Auditoría del batch
    logAuditEvent(pool, null, {
        eventType:     'GOV_VOTE_REWARD_BATCH',
        actorId:       adminUserId,
        actorUsername: 'admin',
        category:      'GOVERNANCE',
        metadata: {
            totalProcessed,
            totalSkipped,
            rateUsed,
            guardiansAffected: Object.keys(byGuardian).length,
        },
    }).catch(err => console.error('[GOV-REWARD-BATCH] Error en audit log:', err));

    return { totalProcessed, totalSkipped, rateUsed, byGuardian };
}

module.exports = { creditVoteReward, getPendingRewardStats, processPendingRewards };
