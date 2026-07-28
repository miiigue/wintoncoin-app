/**
 * src/services/creditScoringService.js
 * Motor de Scoring Conductual (Winton Trust Score).
 * Calcula el límite de crédito RED basándose en el comportamiento del usuario
 * y lo sincroniza con el Smart Contract de la Blockchain.
 */

const pool = require('../config/db');
const { ethers } = require('ethers');

// Configuración de red local/Hardhat
const RPC_URL = process.env.OPTIMISM_RPC_URL || 'http://127.0.0.1:8545';
const RELAYER_PK = process.env.RELAYER_PRIVATE_KEY;
const PROTOCOL_ADDRESS = process.env.WINTON_PROTOCOL_ADDRESS;

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
     * @returns {Promise<number>} Límite total de compromiso calculado en RED
     */
    async calculateUserScore(userId) {
        const client = await pool.connect();
        try {
            // 1. Obtener los multiplicadores y bases desde app_settings (configurables por admin)
            const settingsRes = await client.query(
                "SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'red_credit_%'"
            );
            const settings = {};
            settingsRes.rows.forEach(r => settings[r.setting_key] = parseFloat(r.setting_value));

            // Valores por defecto si no existen en la tabla
            const baseLimit = settings['red_credit_base_limit'] || 100;
            const refBonus = settings['red_credit_referral'] || 5;
            const quizBonus = settings['red_credit_culture_quiz'] || 1;
            const activityBonus = settings['red_credit_monthly_activity'] || 1;
            const earlyPayBonus = settings['red_credit_early_payment'] || 2;

            // 2. Obtener métricas reales del usuario en la base de datos
            
            // A. Cantidad TOTAL de referidos registrados
            const totalRefCountRes = await client.query(
                "SELECT COUNT(*) FROM users WHERE referrer_id = $1", 
                [userId]
            );
            const totalRefCount = parseInt(totalRefCountRes.rows[0].count);

            // B. CIBERSEGURIDAD: Cantidad de referidos VERIFICADOS CON KYC
            // NOTA: Solo existe la columna kyc_verified (BOOLEAN) en la tabla users (Migración 055).
            const verifiedRefCountRes = await client.query(
                "SELECT COUNT(*) FROM users WHERE referrer_id = $1 AND kyc_verified = TRUE", 
                [userId]
            );
            const verifiedRefCount = parseInt(verifiedRefCountRes.rows[0].count);

            // C. Actividad mensual (más de 20 tareas completadas y pagadas en los últimos 30 días)
            // OPTIMIZACIÓN SQL: Usamos JOIN por el ID numérico indexado de la tabla de publicaciones
            const activityRes = await client.query(
                `SELECT COUNT(*) FROM publication_acceptances pa 
                 JOIN publications p ON pa.publication_id = p.id 
                 JOIN users u ON u.username = pa.acceptor_username
                 WHERE u.id = $1 AND pa.status = 'paid' AND pa.created_at > NOW() - INTERVAL '30 days'`,
                [userId]
            );
            const taskCount = parseInt(activityRes.rows[0].count);
            const hasActivityBonus = taskCount >= 20;

            // D. Quizzes aprobados (Winton Academy) - Próximamente integrado
            const quizCount = 0; 

            // E. Pagos tempranos - Próximamente integrado
            const earlyPayCount = 0;

            // 3. Cálculo final (Únicamente los referidos con KYC verificado otorgan bonificación)
            let score = baseLimit;
            score += (verifiedRefCount * refBonus);
            score += (quizCount * quizBonus);
            if (hasActivityBonus) score += activityBonus;
            score += (earlyPayCount * earlyPayBonus);

            console.log(`[SCORING] Límite de compromiso RED calculado para Usuario #${userId}: ${score} RED (Total Refs: ${totalRefCount}, Refs KYC Verificados: ${verifiedRefCount}, Actividad: ${taskCount})`);
            return score;

        } catch (error) {
            console.error('[SCORING] Error al calcular límite de compromiso:', error.message);
            return 100; // Fallback al límite base en caso de error
        } finally {
            client.release();
        }
    }

    /**
     * Sincroniza el límite de compromiso calculado con el contrato inteligente en la Blockchain
     * y registra un log de auditoría inmutable en la base de datos (SOC 2).
     * @param {number} userId 
     */
    async syncCreditLimitOnChain(userId) {
        const client = await pool.connect();
        try {
            // Obtener datos del usuario
            const userRes = await client.query(
                "SELECT id, username, web3_wallet_address FROM users WHERE id = $1", 
                [userId]
            );
            const user = userRes.rows[0];

            if (!user) {
                throw new Error(`Usuario #${userId} no encontrado.`);
            }

            const walletAddress = user.web3_wallet_address;
            const newScore = await this.calculateUserScore(userId);

            // Obtener último score registrado para trazabilidad de auditoría
            const lastLogRes = await client.query(
                "SELECT new_limit FROM user_trust_score_logs WHERE user_id = $1 ORDER BY id DESC LIMIT 1",
                [userId]
            );
            const previousLimit = lastLogRes.rows[0]?.new_limit || 0;

            // Registrar log de auditoría inmutable en PostgreSQL (SOC 2)
            await client.query(`
                INSERT INTO user_trust_score_logs 
                (user_id, wallet_address, previous_limit, new_limit, total_referrals_count, verified_referrals_count, calculation_details)
                VALUES ($1, $2, $3, $4, 0, 0, $5)
            `, [
                userId,
                walletAddress || null,
                previousLimit,
                newScore,
                JSON.stringify({ calculatedAt: new Date().toISOString(), trigger: 'syncCreditLimitOnChain' })
            ]);

            if (!this.wallet || !PROTOCOL_ADDRESS) {
                console.warn('[SCORING] Relayer no configurado o sin dirección de protocolo. Sincronización on-chain omitida.');
                return;
            }

            if (!walletAddress) {
                console.warn(`[SCORING] Usuario #${userId} (@${user.username}) no tiene billetera Web3 vinculada. Sincronización on-chain omitida.`);
                return;
            }

            const protocol = new ethers.Contract(PROTOCOL_ADDRESS, this.abi, this.wallet);
            
            // Formatear a 18 decimales para la blockchain
            const limitWei = ethers.parseEther(newScore.toString());

            console.log(`[SCORING] Sincronizando on-chain para ${walletAddress}: ${newScore} RED...`);
            const tx = await protocol.updateUserTrustScore(walletAddress, limitWei);
            await tx.wait(1);
            
            console.log(`[SCORING] Sincronización on-chain EXITOSA. Tx: ${tx.hash}`);

        } catch (error) {
            console.error(`[SCORING] Fallo de sincronización de compromiso:`, error.message);
        } finally {
            client.release();
        }
    }
}

module.exports = new CreditScoringService();
