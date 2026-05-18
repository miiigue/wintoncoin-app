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
     * Calcula el límite de crédito dinámico de un usuario basándose en las variables maestras.
     * @param {number} userId 
     * @returns {Promise<number>} Límite total calculado en RED
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
            
            // A. Cantidad de referidos (usuarios registrados con su código)
            const refCountRes = await client.query(
                "SELECT COUNT(*) FROM users WHERE referrer_id = $1", 
                [userId]
            );
            const refCount = parseInt(refCountRes.rows[0].count);

            // B. Actividad mensual (más de 20 tareas completadas y pagadas en los últimos 30 días)
            const activityRes = await client.query(
                "SELECT COUNT(*) FROM publication_acceptances pa JOIN users u ON pa.acceptor_username = u.username WHERE u.id = $1 AND pa.status = 'paid' AND pa.created_at > NOW() - INTERVAL '30 days'",
                [userId]
            );
            const taskCount = parseInt(activityRes.rows[0].count);
            const hasActivityBonus = taskCount >= 20;

            // C. Quizzes aprobados (Winton Academy) - Próximamente integrado
            const quizCount = 0; 

            // D. Pagos tempranos (pagar RED antes de 5 días) - Próximamente integrado
            const earlyPayCount = 0;

            // 3. Cálculo final
            let score = baseLimit;
            score += (refCount * refBonus);
            score += (quizCount * quizBonus);
            if (hasActivityBonus) score += activityBonus;
            score += (earlyPayCount * earlyPayBonus);

            console.log(`[SCORING] Score calculado para User ${userId}: ${score} RED (Refs: ${refCount}, Actividad: ${taskCount})`);
            return score;

        } catch (error) {
            console.error('[SCORING] Error al calcular score:', error.message);
            return 100; // Fallback al límite base en caso de error
        } finally {
            client.release();
        }
    }

    /**
     * Sincroniza el límite calculado con el contrato inteligente en la Blockchain.
     * @param {number} userId 
     */
    async syncCreditLimitOnChain(userId) {
        if (!this.wallet || !PROTOCOL_ADDRESS) {
            console.warn('[SCORING] Relayer no configurado, sincronización on-chain omitida.');
            return;
        }

        try {
            // Obtener wallet address del usuario
            const userRes = await pool.query("SELECT web3_wallet_address FROM users WHERE id = $1", [userId]);
            const walletAddress = userRes.rows[0]?.web3_wallet_address;

            if (!walletAddress) {
                throw new Error('El usuario no tiene una billetera Web3 vinculada.');
            }

            const score = await this.calculateUserScore(userId);
            const protocol = new ethers.Contract(PROTOCOL_ADDRESS, this.abi, this.wallet);
            
            // Formatear a 18 decimales para la blockchain
            const limitWei = ethers.parseEther(score.toString());

            console.log(`[SCORING] Sincronizando on-chain para ${walletAddress}: ${score} RED...`);
            const tx = await protocol.updateUserTrustScore(walletAddress, limitWei);
            await tx.wait(1);
            
            console.log(`[SCORING] Sincronización EXITOSA. Tx: ${tx.hash}`);

        } catch (error) {
            console.error(`[SCORING] Fallo crítico de sincronización on-chain:`, error.message);
        }
    }
}

module.exports = new CreditScoringService();
