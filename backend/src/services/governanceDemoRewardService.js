/**
 * Governance Demo Reward Service
 *
 * Gestiona la transferencia segura de recompensas entre entornos (Demo → Producción).
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  PROTECCIONES DE SEGURIDAD                                              ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  1. Aislamiento total — los entornos NUNCA se conectan directamente     ║
 * ║  2. HMAC-SHA256       — firma criptográfica previene manipulación       ║
 * ║  3. Dedup archivo     — file_hash UNIQUE impide importar 2 veces       ║
 * ║  4. Dedup voto        — vote_ids_json detecta votos ya pagados          ║
 * ║  5. Dedup exportación — demo_exported_at previene re-exportación        ║
 * ║  6. Match por username— inmune a divergencia de IDs entre entornos      ║
 * ║  7. Audit trail       — cada operación queda registrada                 ║
 * ║  8. Timing-safe       — comparación HMAC resistente a timing attacks    ║
 * ║  9. Message Archive  — cada exportación se guarda en BD para re-descarga║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Flujo:
 *   Demo: getExportStats() → generateExport()  → archivo JSON firmado (+ copia en BD)
 *         getExportHistory() / getExportById()  → re-descarga si se pierde el archivo
 *   Prod: validateImport() → previewImport()    → processImport()
 */

'use strict';

const crypto = require('crypto');
const { logAuditEvent } = require('./auditService');
// Servicio compartido con el flujo real de voto: aplica el multiplicador vigente
// (etapa booster activa) al monto base. Mantiene consistencia entre pagos
// "en tiempo real" y pagos provenientes del entorno demo.
const boosterService = require('./boosterService');

const REWARD_SETTING_KEY = 'gov_vote_reward_blue';
const REWARD_TYPE        = 'demo_governance_reward';
const EXPORT_VERSION     = 1;
const HMAC_ENV_KEY       = 'DEMO_REWARD_HMAC_SECRET';
const HMAC_MIN_LENGTH    = 32;
const REWARD_MAX         = 1000;

// ─── Helpers HMAC ────────────────────────────────────────────────────────────

function _getHmacSecret() {
    const secret = process.env[HMAC_ENV_KEY];
    if (!secret || secret.length < HMAC_MIN_LENGTH) {
        throw new Error(
            `Variable de entorno ${HMAC_ENV_KEY} no configurada o demasiado corta ` +
            `(mín. ${HMAC_MIN_LENGTH} caracteres). Esta variable debe ser idéntica en demo y producción.`
        );
    }
    return secret;
}

function _getHmacPayload(data) {
    return {
        version:     data.version,
        environment: data.environment,
        exported_at: data.exported_at,
        guardians:   data.guardians,
        summary:     data.summary,
    };
}

function _computeHmac(data) {
    const secret  = _getHmacSecret();
    const payload = JSON.stringify(_getHmacPayload(data));
    return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

function _computeFileHash(data) {
    const content = JSON.stringify({
        exported_at: data.exported_at,
        guardians:   data.guardians,
        summary:     data.summary,
    });
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

// ─── EXPORTAR (usado en Demo) ────────────────────────────────────────────────

/**
 * Retorna estadísticas de votos no exportados para el preview de exportación.
 */
async function getExportStats(pool) {
    const res = await pool.query(`
        SELECT COUNT(*)::int                    AS unexported_votes,
               COUNT(DISTINCT u.username)::int  AS guardians_count
        FROM governance_votes v
        JOIN governance_guardians g ON v.guardian_id = g.id
        JOIN users u ON g.user_id = u.id
        WHERE v.demo_exported_at IS NULL
    `);
    return {
        unexportedVotes: res.rows[0].unexported_votes,
        guardiansCount:  res.rows[0].guardians_count,
    };
}

/**
 * Genera el reporte de exportación firmado, marca los votos como exportados
 * y almacena una copia en la tabla demo_reward_exports (Message Archive).
 *
 * @param {import('pg').Pool} pool
 * @param {number|null}       adminUserId - ID del admin que ejecuta la exportación
 * @returns {object|null} Reporte JSON firmado, o null si no hay votos.
 */
async function generateExport(pool, adminUserId = null) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const votesRes = await client.query(`
            SELECT v.id AS vote_id, v.request_id, v.vote, v.created_at,
                   u.username, u.email
            FROM governance_votes v
            JOIN governance_guardians g ON v.guardian_id = g.id
            JOIN users u ON g.user_id = u.id
            WHERE v.demo_exported_at IS NULL
            ORDER BY u.username, v.created_at ASC
            FOR UPDATE OF v
        `);

        if (votesRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        const guardianMap = {};
        const voteIds = [];

        for (const row of votesRes.rows) {
            if (!guardianMap[row.username]) {
                guardianMap[row.username] = {
                    username: row.username,
                    email:    row.email,
                    votes:    [],
                };
            }
            guardianMap[row.username].votes.push({
                demo_vote_id: row.vote_id,
                request_id:   row.request_id,
                vote:         row.vote,
                voted_at:     row.created_at.toISOString(),
            });
            voteIds.push(row.vote_id);
        }

        const guardians = Object.values(guardianMap);

        const exportData = {
            version:     EXPORT_VERSION,
            environment: process.env.NODE_ENV || 'demo',
            exported_at: new Date().toISOString(),
            guardians,
            summary: {
                total_guardians: guardians.length,
                total_votes:     voteIds.length,
            },
        };

        exportData.hmac = _computeHmac(exportData);

        await client.query(
            `UPDATE governance_votes SET demo_exported_at = NOW() WHERE id = ANY($1)`,
            [voteIds]
        );

        // Message Archive: guardar copia firmada para re-descarga
        const exportFileHash = _computeFileHash(exportData);
        await client.query(
            `INSERT INTO demo_reward_exports
                 (file_hash, exported_at, exported_by, total_guardians, total_votes, export_data)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (file_hash) DO NOTHING`,
            [
                exportFileHash,
                exportData.exported_at,
                adminUserId,
                guardians.length,
                voteIds.length,
                JSON.stringify(exportData),
            ]
        );

        await client.query('COMMIT');

        logAuditEvent(pool, null, {
            eventType:     'GOV_DEMO_ACTIVITY_EXPORTED',
            actorUsername: 'admin',
            category:      'GOVERNANCE',
            metadata: {
                totalGuardians: guardians.length,
                totalVotes:     voteIds.length,
            },
        }).catch(err => console.error('[DEMO-EXPORT] Audit error:', err));

        return exportData;

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Lista el historial de exportaciones (solo metadatos, sin el JSON completo).
 * Ordenadas de más reciente a más antigua.
 */
async function getExportHistory(pool) {
    const res = await pool.query(`
        SELECT id, file_hash, exported_at, exported_by,
               total_guardians, total_votes, downloaded_count, created_at
        FROM demo_reward_exports
        ORDER BY exported_at DESC
        LIMIT 50
    `);
    return res.rows;
}

/**
 * Obtiene una exportación específica para re-descarga e incrementa el contador.
 * @param {number} exportId - ID de la exportación
 * @param {number|null} adminUserId - ID del admin que re-descarga (para auditoría)
 */
async function getExportById(pool, exportId, adminUserId = null) {
    const safeId = parseInt(exportId, 10);
    if (!Number.isFinite(safeId) || safeId <= 0) {
        throw new Error('ID de exportación inválido.');
    }

    const res = await pool.query(
        `UPDATE demo_reward_exports
         SET downloaded_count = downloaded_count + 1
         WHERE id = $1
         RETURNING export_data, exported_at, total_votes, total_guardians`,
        [safeId]
    );

    if (res.rowCount === 0) {
        throw new Error('Exportación no encontrada.');
    }

    logAuditEvent(pool, null, {
        eventType:     'GOV_DEMO_EXPORT_REDOWNLOADED',
        actorId:       adminUserId,
        actorUsername: 'admin',
        category:      'GOVERNANCE',
        metadata:      { exportId: safeId },
    }).catch(err => console.error('[DEMO-EXPORT] Re-download audit error:', err));

    return res.rows[0];
}

// ─── IMPORTAR (usado en Producción) ──────────────────────────────────────────

/**
 * Valida la estructura y firma HMAC de un archivo de importación.
 * @param {object} rawData - Contenido JSON parseado del archivo
 * @returns {object} Datos validados
 * @throws {Error} Si la validación falla
 */
function validateImport(rawData) {
    if (!rawData || typeof rawData !== 'object') {
        throw new Error('Formato de archivo inválido.');
    }
    if (rawData.version !== EXPORT_VERSION) {
        throw new Error(
            `Versión no soportada: ${rawData.version}. Se requiere versión ${EXPORT_VERSION}.`
        );
    }
    if (!rawData.exported_at || !Array.isArray(rawData.guardians) || rawData.guardians.length === 0) {
        throw new Error('Estructura de archivo incompleta.');
    }
    if (!rawData.hmac || typeof rawData.hmac !== 'string') {
        throw new Error('El archivo no contiene firma HMAC. Posible manipulación.');
    }
    if (!rawData.summary || typeof rawData.summary !== 'object') {
        throw new Error('El archivo no contiene resumen.');
    }

    // HMAC verification (timing-safe)
    const expectedHmac = _computeHmac(rawData);
    const providedBuf  = Buffer.from(rawData.hmac, 'hex');
    const expectedBuf  = Buffer.from(expectedHmac, 'hex');

    if (providedBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
        throw new Error(
            'Firma HMAC inválida. El archivo fue modificado o el secreto no coincide entre entornos.'
        );
    }

    for (const g of rawData.guardians) {
        if (!g.username || typeof g.username !== 'string') {
            throw new Error('Guardian sin username válido.');
        }
        if (!Array.isArray(g.votes) || g.votes.length === 0) {
            throw new Error(`Guardian "${g.username}" sin votos.`);
        }
        for (const v of g.votes) {
            if (!Number.isFinite(v.demo_vote_id) || v.demo_vote_id <= 0) {
                throw new Error(`Voto con ID inválido en guardian "${g.username}".`);
            }
            if (!v.voted_at) {
                throw new Error(`Voto sin fecha en guardian "${g.username}".`);
            }
        }
    }

    return rawData;
}

/**
 * Genera una vista previa de lo que se acreditaría al procesar el archivo.
 * No modifica la base de datos.
 */
async function previewImport(pool, parsedData) {
    const fileHash = _computeFileHash(parsedData);

    // 1. Verificar importación duplicada a nivel de archivo
    const dupCheck = await pool.query(
        `SELECT id, imported_at FROM demo_reward_imports WHERE file_hash = $1`,
        [fileHash]
    );
    if (dupCheck.rowCount > 0) {
        const importDate = dupCheck.rows[0].imported_at;
        return {
            status:  'duplicate',
            message: `Este archivo ya fue importado el ${importDate.toISOString().split('T')[0]}.`,
        };
    }

    // 2. Obtener vote IDs ya importados previamente (dedup individual)
    const prevImportsRes = await pool.query(
        `SELECT vote_ids_json FROM demo_reward_imports`
    );
    const alreadyImportedIds = new Set();
    for (const row of prevImportsRes.rows) {
        if (Array.isArray(row.vote_ids_json)) {
            row.vote_ids_json.forEach(id => alreadyImportedIds.add(id));
        }
    }

    // 3. Tasa base actual (app_settings) y multiplicador de etapa vigente.
    //    Multiplicador: si no hay etapa activa, boosterService devuelve 1.0 (fallback seguro).
    const rateRes = await pool.query(
        `SELECT setting_value FROM app_settings WHERE setting_key = $1`,
        [REWARD_SETTING_KEY]
    );
    const rawRate     = parseFloat(rateRes.rows[0]?.setting_value);
    const currentRate = (Number.isFinite(rawRate) && rawRate > 0 && rawRate <= REWARD_MAX)
        ? rawRate
        : 0;

    // Se consulta el multiplicador solo si la tasa base es válida;
    // si la tasa es 0 no tiene sentido mostrar multiplicación.
    let multiplier = 1;
    let stageName  = 'Sin etapa activa';
    if (currentRate > 0) {
        const multInfo = await boosterService.calculateMultipliedAmount(currentRate);
        multiplier = Number.isFinite(multInfo.multiplier) && multInfo.multiplier > 0
            ? multInfo.multiplier
            : 1;
        stageName = multInfo.stageName || 'Sin etapa activa';
    }
    const ratePerVoteFinal = currentRate * multiplier;

    // 4. Emparejar cada guardián con su cuenta en producción
    const guardians = [];
    let totalNewVotes = 0;
    let totalSkippedVotes = 0;

    for (const g of parsedData.guardians) {
        const userRes = await pool.query(
            `SELECT id, username, email FROM users WHERE username = $1`,
            [g.username]
        );
        const found    = userRes.rowCount > 0;
        const prodUser = found ? userRes.rows[0] : null;

        const newVotes     = g.votes.filter(v => !alreadyImportedIds.has(v.demo_vote_id));
        const skippedVotes = g.votes.length - newVotes.length;

        totalNewVotes     += newVotes.length;
        totalSkippedVotes += skippedVotes;

        const totalBase       = newVotes.length * currentRate;
        const totalMultiplied = newVotes.length * ratePerVoteFinal;

        guardians.push({
            username:            g.username,
            demo_email:          g.email,
            total_votes_in_file: g.votes.length,
            new_votes:           newVotes.length,
            already_imported:    skippedVotes,
            base_per_vote:       currentRate,
            multiplier:          multiplier,
            stage_name:          stageName,
            reward_per_vote:     ratePerVoteFinal,
            total_base:          totalBase,
            total_reward:        totalMultiplied,
            found_in_production: found,
            production_user_id:  prodUser?.id || null,
            production_email:    prodUser?.email || null,
        });
    }

    return {
        status:      'ready',
        fileHash,
        exported_at: parsedData.exported_at,
        source_env:  parsedData.environment,
        currentRate,
        multiplier,
        stageName,
        ratePerVoteFinal,
        guardians,
        summary: {
            total_guardians:    guardians.length,
            matched:            guardians.filter(g => g.found_in_production).length,
            unmatched:          guardians.filter(g => !g.found_in_production).length,
            total_new_votes:    totalNewVotes,
            total_skipped:      totalSkippedVotes,
            total_base:         guardians.reduce(
                (sum, g) => sum + (g.found_in_production ? g.total_base : 0), 0
            ),
            total_amount:       guardians.reduce(
                (sum, g) => sum + (g.found_in_production ? g.total_reward : 0), 0
            ),
        },
    };
}

/**
 * Devuelve la tasa base y el multiplicador vigente (point-in-time), sin
 * procesar guardianes ni hacer queries por archivo. Se usa para el "candado
 * optimista" preview↔process: es una operación barata (2 queries) que
 * compara contra el multiplicador que el admin vio en la previsualización.
 *
 * @param {import('pg').Pool} pool
 * @returns {Promise<{rateUsed:number, multiplier:number, stageName:string, finalRatePerVote:number}>}
 */
async function getCurrentRateAndMultiplier(pool) {
    const rateRes = await pool.query(
        `SELECT setting_value FROM app_settings WHERE setting_key = $1`,
        [REWARD_SETTING_KEY]
    );
    const rawRate  = parseFloat(rateRes.rows[0]?.setting_value);
    const rateUsed = (Number.isFinite(rawRate) && rawRate > 0 && rawRate <= REWARD_MAX)
        ? rawRate
        : 0;

    // Si la tasa base es 0 no tiene sentido consultar multiplicador
    // (no se puede procesar y el endpoint abortará antes).
    if (rateUsed === 0) {
        return {
            rateUsed:         0,
            multiplier:       1,
            stageName:        'Sin etapa activa',
            finalRatePerVote: 0,
        };
    }

    const multInfo = await boosterService.calculateMultipliedAmount(rateUsed);
    const multiplier = Number.isFinite(multInfo.multiplier) && multInfo.multiplier > 0
        ? multInfo.multiplier
        : 1;
    const stageName        = multInfo.stageName || 'Sin etapa activa';
    const finalRatePerVote = rateUsed * multiplier;

    return { rateUsed, multiplier, stageName, finalRatePerVote };
}

/**
 * Procesa el archivo validado: acredita BLUE IOU en las cuentas de producción.
 *
 * Garantías:
 *   - file_hash UNIQUE previene doble importación del mismo archivo
 *   - vote_ids_json previene pago duplicado de votos individuales
 *   - Cada guardián se procesa en su propia transacción (aislamiento de falla)
 *   - Audit log registra cada operación
 *
 * @param {import('pg').Pool} pool
 * @param {object}            parsedData  - Datos ya validados por validateImport()
 * @param {number}            adminUserId - ID del admin que autoriza
 * @returns {Promise<ImportResult>}
 */
async function processImport(pool, parsedData, adminUserId) {
    const fileHash = _computeFileHash(parsedData);

    // 1. Verificación final de duplicado
    const dupCheck = await pool.query(
        `SELECT id FROM demo_reward_imports WHERE file_hash = $1`,
        [fileHash]
    );
    if (dupCheck.rowCount > 0) {
        throw new Error('Este archivo ya fue procesado anteriormente.');
    }

    // 2. Obtener tasa base y multiplicador vigente (point-in-time: se lee al procesar).
    //    Consistencia con el flujo real de voto: ambos aplican el multiplicador
    //    de la etapa booster activa al momento del pago.
    const rateRes = await pool.query(
        `SELECT setting_value FROM app_settings WHERE setting_key = $1`,
        [REWARD_SETTING_KEY]
    );
    const rawRate  = parseFloat(rateRes.rows[0]?.setting_value);
    const rateUsed = (Number.isFinite(rawRate) && rawRate > 0 && rawRate <= REWARD_MAX)
        ? rawRate
        : 0;

    if (rateUsed === 0) {
        throw new Error(
            'La tasa de recompensa está en 0. Configure gov_vote_reward_blue antes de procesar.'
        );
    }

    // Multiplicador vigente: fallback a 1.0 si no hay etapa activa (pago = solo base).
    const multInfo = await boosterService.calculateMultipliedAmount(rateUsed);
    const multiplier = Number.isFinite(multInfo.multiplier) && multInfo.multiplier > 0
        ? multInfo.multiplier
        : 1;
    const stageName      = multInfo.stageName || 'Sin etapa activa';
    const finalRatePerVote = rateUsed * multiplier;

    // 3. Cargar vote IDs ya importados
    const prevRes = await pool.query(`SELECT vote_ids_json FROM demo_reward_imports`);
    const alreadyImportedIds = new Set();
    for (const row of prevRes.rows) {
        if (Array.isArray(row.vote_ids_json)) {
            row.vote_ids_json.forEach(id => alreadyImportedIds.add(id));
        }
    }

    // 4. Reservar el registro de importación ANTES de procesar pagos.
    //    Esto garantiza que si el servidor cae a mitad de procesamiento,
    //    el file_hash ya existe y el archivo no puede ser re-importado.
    const insertRes = await pool.query(
        `INSERT INTO demo_reward_imports
             (file_hash, source_env, exported_at, imported_by,
              total_guardians, total_votes, total_amount, rate_used,
              vote_ids_json, metadata)
         VALUES ($1,$2,$3,$4, 0, 0, 0, $5, '[]'::jsonb, $6)
         RETURNING id`,
        [
            fileHash,
            parsedData.environment || 'demo',
            parsedData.exported_at,
            adminUserId,
            rateUsed,
            JSON.stringify({ status: 'processing' }),
        ]
    );
    const importId = insertRes.rows[0].id;

    const byGuardian   = {};
    let totalProcessed = 0;
    let totalSkipped   = 0;
    const allNewVoteIds = [];

    // 5. Procesar cada guardián
    for (const g of parsedData.guardians) {
        const userRes = await pool.query(
            `SELECT id, username, email FROM users WHERE username = $1`,
            [g.username]
        );
        if (userRes.rowCount === 0) {
            totalSkipped += g.votes.length;
            continue;
        }

        const prodUser = userRes.rows[0];
        const newVotes = g.votes.filter(v => !alreadyImportedIds.has(v.demo_vote_id));

        if (newVotes.length === 0) {
            totalSkipped += g.votes.length;
            continue;
        }

        // Desglose por guardián. totalBase = votos × tasa base;
        // totalAmount = votos × tasa base × multiplicador vigente (pago final).
        const totalBase   = newVotes.length * rateUsed;
        const totalAmount = newVotes.length * finalRatePerVote;
        const voteIds     = newVotes.map(v => v.demo_vote_id);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Acreditación en el ledger (fuente de verdad) con el monto ya multiplicado.
            await client.query(
                `SELECT record_booster_event($1, $2, $3, NULL)`,
                [prodUser.id, REWARD_TYPE, totalAmount]
            );

            // Descripción auditable: incluye base, multiplicador y etapa (formato idéntico al flujo real de voto).
            await client.query(
                `INSERT INTO booster_transactions (user_id, type, amount, description)
                 VALUES ($1, $2, $3, $4)`,
                [
                    prodUser.id, REWARD_TYPE, totalAmount,
                    `Recompensa por ${newVotes.length} voto(s) de gobernanza en entorno demo ` +
                    `(${rateUsed} x ${multiplier} [${stageName}])`,
                ]
            );

            await client.query(
                `INSERT INTO transactions (user_id, type, description, blue_change)
                 VALUES ($1, $2, $3, $4)`,
                [
                    prodUser.id, REWARD_TYPE,
                    `Recompensa BLUE IOU — ${newVotes.length} voto(s) de gobernanza (demo) · ` +
                    `${rateUsed} x ${multiplier} [${stageName}]`,
                    totalAmount,
                ]
            );

            await client.query('COMMIT');

            totalProcessed += newVotes.length;
            allNewVoteIds.push(...voteIds);

            // Actualizar vote_ids_json progresivamente después de cada pago.
            // Si el servidor cae aquí, los IDs ya pagados están registrados
            // y no se volverán a pagar en una re-importación.
            // total_amount refleja el monto YA multiplicado (pago real realizado).
            await pool.query(
                `UPDATE demo_reward_imports
                 SET vote_ids_json = $1, total_votes = $2, total_amount = $3
                 WHERE id = $4`,
                [JSON.stringify(allNewVoteIds), totalProcessed, totalProcessed * finalRatePerVote, importId]
            );

            const balRes = await pool.query(
                `SELECT COALESCE(SUM(amount), 0) AS total
                 FROM booster_blue_ledger WHERE user_id = $1`,
                [prodUser.id]
            );

            byGuardian[prodUser.id] = {
                username:        prodUser.username,
                email:           prodUser.email,
                votesPaid:       newVotes.length,
                basePerVote:     rateUsed,
                multiplier,
                stageName,
                ratePerVote:     finalRatePerVote,
                totalBase,
                totalAmount,
                newBalance:      parseFloat(balRes.rows[0].total),
                demoVoteIds:     voteIds,
            };

        } catch (err) {
            await client.query('ROLLBACK');
            console.error(`[DEMO-IMPORT] Error processing ${g.username}:`, err);
            totalSkipped += newVotes.length;
        } finally {
            client.release();
        }
    }

    // 6. Marcar la importación como completada con los totales finales.
    //    Se persiste el multiplicador/etapa aplicados para trazabilidad
    //    futura (auditoría contable del pago realizado).
    await pool.query(
        `UPDATE demo_reward_imports
         SET total_guardians = $1, metadata = $2
         WHERE id = $3`,
        [
            Object.keys(byGuardian).length,
            JSON.stringify({
                totalSkipped,
                status:          'completed',
                base_rate:       rateUsed,
                multiplier,
                stage_name:      stageName,
                rate_per_vote:   finalRatePerVote,
                formula:         `${rateUsed} × ${multiplier} = ${finalRatePerVote} BLUE por voto (${stageName})`,
            }),
            importId,
        ]
    );

    // 7. Auditoría: incluye multiplicador y etapa vigente al momento del pago
    //    para cumplir el estándar "todo pago debe ser reproducible y auditable".
    logAuditEvent(pool, null, {
        eventType:     'GOV_DEMO_REWARD_IMPORTED',
        actorId:       adminUserId,
        actorUsername: 'admin',
        category:      'GOVERNANCE',
        metadata: {
            fileHash,
            totalProcessed,
            totalSkipped,
            rateUsed,
            multiplier,
            stageName,
            finalRatePerVote,
            guardiansAffected: Object.keys(byGuardian).length,
        },
    }).catch(err => console.error('[DEMO-IMPORT] Audit error:', err));

    return {
        totalProcessed,
        totalSkipped,
        rateUsed,
        multiplier,
        stageName,
        finalRatePerVote,
        byGuardian,
    };
}

module.exports = {
    getExportStats,
    generateExport,
    getExportHistory,
    getExportById,
    validateImport,
    previewImport,
    processImport,
    getCurrentRateAndMultiplier,
};
