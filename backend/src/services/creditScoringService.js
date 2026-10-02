/**
 * src/services/creditScoringService.js
 * Motor de Scoring Conductual (Winton Trust Score) y Gobernanza de Compromisos RED.
 *
 * ARQUITECTURA FINTECH / BANCARIA (SOC 2, ISO 20022 & Zero-Trust):
 * 1. Principio On-Chain First: El contrato inteligente (CoreProtocol.sol) es la fuente de verdad inmutable.
 * 2. Cuatro Capas de Gobernanza Crediticia:
 *    - Capa 1: Límite ganado por mérito/actividad (Base + Referidos KYC + Actividad + Quizzes).
 *    - Capa 2: Trinquete Financiero (High-Water Mark): Protege los derechos adquiridos frente a
 *              recortes de la política administrativa general (ej: si red_credit_base_limit baja de 100 a 80).
 *    - Capa 3: Reducción Estricta por Mora / Halving Protocolar: Cuando un usuario incumple el pago de un
 *              compromiso RED al vencimiento, su límite efectivo se reduce al 50% de inmediato y en halvings
 *              sucesivos mensuales mientras persista el impago. EL TRINQUETE NUNCA BLOQUEA ESTA REDUCCIÓN.
 *    - Capa 4: Piso Mínimo de Seguridad y Excepciones Individuales (red_credit_limit_override).
 */

const pool = require('../config/db');
const { ethers } = require('ethers');

// Configuración de red blockchain (Optimism Sepolia / Local)
const RPC_URL = process.env.OPTIMISM_RPC_URL || 'http://127.0.0.1:8545';
const RELAYER_PK = process.env.RELAYER_PRIVATE_KEY;

class CreditScoringService {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(RPC_URL);
        this.wallet = RELAYER_PK ? new ethers.Wallet(RELAYER_PK, this.provider) : null;
        this.abi = [
            "function updateUserTrustScore(address userWallet, uint256 newScoreLimit) external",
            "function redCreditLimits(address userWallet) external view returns (uint256)"
        ];
    }

    /**
     * Calcula el límite de compromiso dinámico de un usuario basándose en las variables maestras.
     * CIBERSEGURIDAD Y PROTECCIÓN ANTI-BOTS: Solo los referidos con KYC verificado otorgan bonificación.
     * @param {number} userId
     * @param {import('pg').PoolClient|null} [existingClient=null]
     * @returns {Promise<number>} Límite total de compromiso calculado en RED
     */
    async calculateUserScore(userId, existingClient = null) {
        const client = existingClient || await pool.connect();
        try {
            // Verificar si el usuario tiene una excepción individual administrativa fijada
            const identity = await client.query('SELECT red_credit_limit_override FROM users WHERE id=$1', [userId]);
            if (!identity.rows.length) throw new Error('Usuario no encontrado');
            if (identity.rows[0].red_credit_limit_override != null) return Number(identity.rows[0].red_credit_limit_override);

            // 1. Obtener los multiplicadores y bases desde app_settings (configurables por admin)
            const settingsRes = await client.query(
                "SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'red_credit_%'"
            );
            const settings = {};
            settingsRes.rows.forEach(r => {
                if (!/^\d+(\.\d{1,6})?$/.test(String(r.setting_value)) || Number(r.setting_value) > 100000000) {
                    throw new Error('Valor de política RED inválido');
                }
                settings[r.setting_key] = Number(r.setting_value);
            });

            // Parámetros canónicos con valores de contingencia por defecto
            const baseLimit = settings['red_credit_base_limit'] ?? 100;
            const refBonus = settings['red_credit_referral'] ?? 5;
            const quizBonus = settings['red_credit_culture_quiz'] ?? 1;
            const activityBonus = settings['red_credit_monthly_activity'] ?? 1;
            const earlyPayBonus = settings['red_credit_early_payment'] ?? 2;

            // 2. Obtener métricas reales del usuario en la base de datos
            // A. Cantidad total de referidos registrados
            const totalRefCountRes = await client.query(
                "SELECT COUNT(*) FROM users WHERE referrer_id = $1",
                [userId]
            );
            const totalRefCount = parseInt(totalRefCountRes.rows[0].count);

            // B. CIBERSEGURIDAD: Cantidad de referidos VERIFICADOS CON KYC
            const verifiedRefCountRes = await client.query(
                "SELECT COUNT(*) FROM users WHERE referrer_id = $1 AND kyc_verified = TRUE",
                [userId]
            );
            const verifiedRefCount = parseInt(verifiedRefCountRes.rows[0].count);

            // C. Actividad mensual (más de 20 tareas completadas y pagadas en los últimos 30 días)
            const activityRes = await client.query(
                `SELECT COUNT(*) FROM publication_acceptances pa
                 JOIN publications p ON pa.publication_id = p.id
                 JOIN users u ON u.username = pa.acceptor_username
                 WHERE u.id = $1 AND pa.status = 'paid' AND pa.created_at > NOW() - INTERVAL '30 days'`,
                [userId]
            );
            const taskCount = parseInt(activityRes.rows[0].count);
            const hasActivityBonus = taskCount >= 20;

            // D. Quizzes aprobados y pagos tempranos (reservados para módulos de expansión)
            const quizCount = 0;
            const earlyPayCount = 0;

            // Validación matemática estricta contra valores negativos o no numéricos
            for (const value of [baseLimit, refBonus, quizBonus, activityBonus, earlyPayBonus]) {
                if (!Number.isFinite(value) || value < 0) throw new Error('Política RED inválida');
            }

            // 3. Cálculo final con precisión exacta BigInt en 6 decimales
            const unit = value => ethers.parseUnits(String(value), 6);
            const exact = unit(baseLimit) +
                          BigInt(verifiedRefCount) * unit(refBonus) +
                          BigInt(quizCount) * unit(quizBonus) +
                          (hasActivityBonus ? unit(activityBonus) : 0n) +
                          BigInt(earlyPayCount) * unit(earlyPayBonus);

            if (exact > 100000000n * 1000000n) {
                throw new Error('El límite calculado supera el máximo de la política.');
            }
            const score = Number(ethers.formatUnits(exact, 6));

            console.log(`[SCORING] Límite de compromiso RED calculado para Usuario #${userId}: ${score} RED (Refs KYC: ${verifiedRefCount}/${totalRefCount}, Actividad: ${taskCount})`);
            return score;

        } catch (error) {
            console.error('[SCORING] Error al calcular límite de compromiso:', error.message);
            throw new Error('No se pudo calcular el límite RED; no se modifica el límite vigente.');
        } finally {
            if (!existingClient) client.release();
        }
    }

    /**
     * Motor de Cálculo de Límite Efectivo con Trinquete, Halving por Mora y Recuperación Gradual (Punto A)
     * Estándar FinTech & Gobernanza Económica (Auditoría Bancaria SOC 2):
     * 1. Límite dinámico ganado por mérito/actividad (earnedScore)
     * 2. Límite histórico adquirido/protegido por trinquete (High-Water Mark ante recortes de política general)
     * 3. Reducción efectiva por riesgo y mora protocolar (Halving sucesivo del 50% por compromisos RED vencidos)
     * 4. Recuperación gradual post-mora a razón del 10% mensual tras sanear el 100% de la mora
     * 5. Piso mínimo de seguridad protocolar
     *
     * Regla de Negocio: El trinquete NUNCA anula ni bloquea el halving por mora de compromisos RED.
     * Al liquidar la mora, el límite NO salta de golpe a 100; recupera a razón de 10% por cada mes (30 días) al día.
     * @param {Object} params
     * @param {number} params.earnedScore Límite calculado por mérito/actividad actual
     * @param {number} [params.onChainLimit=0] Límite actualmente registrado on-chain
     * @param {boolean} [params.isDelinquent=false] Estado de mora on-chain (compromisos vencidos impagos)
     * @param {number} [params.delinquentCycles=1] Ciclos de 30 días acumulados en mora
     * @param {number} [params.minLimit=0] Piso mínimo legal permitido
     * @param {number} [params.cureMonths=0] Meses de 30 días completos transcurridos en estado de curación (al día)
     * @param {number|null} [params.penaltyLimit=null] Límite castigado de partida tras la mora (ej. 50 RED)
     * @param {number|null} [params.targetLimit=null] Límite objetivo al que tiene derecho a retornar (ej. 100 RED)
     * @param {number} [params.monthlyRecoveryRate=0.10] Tasa mensual de curación (10% = 0.10)
     * @returns {number} Límite efectivo en RED
     */
    computeEffectiveCreditLimit({
        earnedScore,
        onChainLimit = 0,
        isDelinquent = false,
        delinquentCycles = 1,
        minLimit = 0,
        cureMonths = 0,
        penaltyLimit = null,
        targetLimit = null,
        monthlyRecoveryRate = 0.10
    }) {
        const earned = Math.max(0, Number(earnedScore) || 0);
        const historical = Math.max(0, Number(onChainLimit) || 0);

        // 1. Si el usuario se encuentra en mora on-chain, las reglas de riesgo dominan sobre el trinquete:
        // Se aplica un halving del 50% inmediato al vencer, y halvings sucesivos cada 30 días de mora continua.
        if (isDelinquent) {
            const cycles = Math.max(1, Number(delinquentCycles) || 1);
            const factor = Math.pow(2, cycles);
            // Si el usuario recae en mora durante un régimen de curación, la penalización
            // parte estrictamente de su límite alcanzado durante la curación (historical) y no del target original
            const targetBase = (penaltyLimit != null && targetLimit != null && Number(penaltyLimit) < Number(targetLimit))
                ? historical
                : Math.max(earned, historical);
            const penalized = targetBase / factor;
            return Math.max(minLimit, Math.floor(penalized * 1000000) / 1000000);
        }


        // 2. Si no está en mora, verificar si se encuentra en régimen de recuperación gradual post-mora (Punto A):
        // Si existe un estado de penalización previo donde penaltyLimit < targetLimit:
        if (penaltyLimit != null && targetLimit != null && Number(penaltyLimit) < Number(targetLimit)) {
            const pLimit = Math.max(0, Number(penaltyLimit));
            const tLimit = Math.min(earned, Number(targetLimit)); // Capped al mérito vigente
            const months = Math.max(0, Number(cureMonths) || 0);
            const rate = Number(monthlyRecoveryRate) > 0 ? Number(monthlyRecoveryRate) : 0.10;
            // Recupera un 10% del límite objetivo por cada mes calendario completo (30 días)
            const recoveryAmount = months * rate * tLimit;
            const effectiveCured = Math.min(tLimit, pLimit + recoveryAmount);
            return Math.max(minLimit, Math.floor(effectiveCured * 1000000) / 1000000);
        }

        // 3. Si el usuario no está en mora ni bajo régimen de curación gradual, el trinquete financiero protege
        // los derechos adquiridos: una reducción administrativa de política general (ej. 100 -> 80) no reduce
        // el límite ya ganado legítimamente.
        return Math.max(earned, historical);
    }

    /**
     * Sincroniza el límite de compromiso calculado con el contrato inteligente en la Blockchain
     * y registra un log de auditoría inmutable en la base de datos (SOC 2).
     * @param {number} userId ID numérico del usuario
     */
    async syncCreditLimitOnChain(userId) {
        const { locked } = require('./chainOperationStore');
        const userRes = await pool.query(
            `SELECT web3_wallet_address, red_credit_limit_override,
                    last_mora_cured_at, mora_penalty_base_limit, mora_target_limit
             FROM users WHERE id=$1`,
            [userId]
        );
        const userRow = userRes.rows[0];
        if (!userRow?.web3_wallet_address) return { skipped: true };
        const wallet = userRow.web3_wallet_address;

        return locked(pool, 'credit:' + wallet.toLowerCase(), async client => {
            const outstanding = await client.query(
                "SELECT id FROM chain_operations WHERE resource_key=$1 AND state IN ('pending','conflict') LIMIT 1",
                ['credit:' + wallet.toLowerCase()]
            );
            if (outstanding.rowCount) return { pending: true, operationId: outstanding.rows[0].id };

            if (userRow.red_credit_limit_override != null) return { skipped: true, reason: 'individual_exception' };

            // 1. Calcular el score dinámico del usuario según las políticas y actividad
            const score = await this.calculateUserScore(userId, client);
            const bridge = require('./web3BridgeService');

            // 2. CIBERSEGURIDAD BANCARIA (FAIL-CLOSED / ZERO-TRUST):
            // Toda consulta on-chain a CoreProtocol.sol debe ser atómica e infalible.
            // Si el RPC de Optimism Sepolia se encuentra atrasado, congestionado o desconectado,
            // la operación debe abortar de inmediato arrojando CHAIN_READ_FAILED sin mutar límites.
            // NUNCA asumir que el usuario no está en mora ante un fallo de red.
            let onChainUnits, isDelinquent;
            try {
                const protocol = bridge._getProtocol();
                [onChainUnits, isDelinquent] = await Promise.all([
                    protocol.creditLimits(wallet),
                    protocol.isDelinquent(wallet)
                ]);
            } catch (err) {
                console.error(`[SCORING] Falla de lectura on-chain para billetera ${wallet}:`, err.message);
                throw Object.assign(new Error(`CHAIN_READ_FAILED: No se pudo verificar el estado on-chain del protocolo (${err.message})`), { status: 503 });
            }
            const onChainLimit = Number(ethers.formatUnits(onChainUnits, 6));

            // Si está en mora, determinar los ciclos de mora transcurridos (30 días por ciclo de halving)
            let delinquentCycles = 1;
            if (isDelinquent) {
                try {
                    const protocol = bridge._getProtocol();
                    const headIndex = await protocol.userActiveLotHead(wallet);
                    const count = await protocol.getUserDebtLotsCount(wallet);
                    if (headIndex < count) {
                        const lot = await protocol.userDebtLots(wallet, headIndex);
                        const nowSec = Math.floor(Date.now() / 1000);
                        const dueAt = Number(lot.dueAt);
                        if (dueAt > 0 && nowSec > dueAt) {
                            const daysOverdue = Math.floor((nowSec - dueAt) / 86400);
                            delinquentCycles = 1 + Math.floor(daysOverdue / 30);
                        }
                    }
                } catch (lotErr) {
                    console.error(`[SCORING] Falla al consultar lotes vencidos para ${wallet}:`, lotErr.message);
                    throw Object.assign(new Error(`CHAIN_READ_FAILED: Error al consultar lotes vencidos on-chain (${lotErr.message})`), { status: 503 });
                }
            }

            // 3. Evaluar el régimen de curación y computar el límite efectivo desagregado (Punto A)
            let cureMonths = 0;
            let penaltyLimit = userRow.mora_penalty_base_limit != null ? Number(userRow.mora_penalty_base_limit) : null;
            let targetLimit = userRow.mora_target_limit != null ? Number(userRow.mora_target_limit) : null;

            if (isDelinquent) {
                // Si el usuario cayó en mora, se anula cualquier proceso de curación previo
                if (userRow.last_mora_cured_at != null) {
                    await client.query(
                        `UPDATE users SET last_mora_cured_at = NULL, mora_penalty_base_limit = $1, mora_target_limit = $2 WHERE id = $3`,
                        [onChainLimit / 2, Math.max(score, onChainLimit), userId]
                    );
                }
            } else {
                // Usuario al día: verificar si venía de un halving o acaba de sanear la mora
                if (userRow.last_mora_cured_at != null && penaltyLimit != null && targetLimit != null) {
                    const nowMs = Date.now();
                    const curedMs = new Date(userRow.last_mora_cured_at).getTime();
                    cureMonths = Math.floor((nowMs - curedMs) / (30 * 86400 * 1000));
                } else if (onChainLimit < score && penaltyLimit != null && targetLimit != null) {
                    // Acaba de pagar su mora: registrar curación en mes 0
                    cureMonths = 0;
                    await client.query(`
                        INSERT INTO user_credit_cure_logs(user_id, penalty_limit, target_limit, cured_at, monthly_recovery_bps)
                        VALUES($1, $2, $3, NOW(), 1000)
                    `, [userId, penaltyLimit, targetLimit]);
                    await client.query(`
                        UPDATE users SET last_mora_cured_at = NOW() WHERE id = $1
                    `, [userId]);
                }
            }

            const effectiveLimit = this.computeEffectiveCreditLimit({
                earnedScore: score,
                onChainLimit,
                isDelinquent,
                delinquentCycles,
                cureMonths,
                penaltyLimit,
                targetLimit
            });

            // Si la curación culminó alcanzando el límite objetivo, limpiar el estado de curación
            if (!isDelinquent && targetLimit != null && effectiveLimit >= targetLimit && userRow.last_mora_cured_at != null) {
                await client.query(`
                    UPDATE users SET last_mora_cured_at = NULL, mora_penalty_base_limit = NULL, mora_target_limit = NULL WHERE id = $1
                `, [userId]);
            }

            // 4. Si el límite efectivo ya es idéntico al on-chain (dentro de 6 decimales), se omite la llamada Web3
            const effectiveUnits = ethers.parseUnits(String(effectiveLimit), 6);
            if (effectiveUnits === onChainUnits) {
                return { skipped: true, reason: 'already_current' };
            }

            // Si no está en mora y el límite efectivo calculado no supera el actual on-chain,
            // se preserva el límite adquirido (trinquete de derechos adquiridos)
            if (!isDelinquent && effectiveUnits <= onChainUnits) {
                return { skipped: true, reason: 'already_current' };
            }

            // 5. Sincronizar el nuevo límite en el Smart Contract (Optimism Sepolia)
            return bridge.setCreditLimit(wallet, effectiveLimit, { manual: false, alreadyLocked: true });
        });
    }
}

module.exports = new CreditScoringService();
