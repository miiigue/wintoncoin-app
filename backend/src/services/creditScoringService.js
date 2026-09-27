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
const PROTOCOL_ADDRESS = process.env.CORE_PROTOCOL_ADDRESS || process.env.WINTON_PROTOCOL_ADDRESS;

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
    async calculateUserScore(userId, existingClient = null) {
        const client = existingClient || await pool.connect();
        try {
            const identity = await client.query('SELECT red_credit_limit_override FROM users WHERE id=$1', [userId]);
            if (!identity.rows.length) throw new Error('Usuario no encontrado');
            if (identity.rows[0].red_credit_limit_override != null) return Number(identity.rows[0].red_credit_limit_override);
            // 1. Obtener los multiplicadores y bases desde app_settings (configurables por admin)
            const settingsRes = await client.query(
                "SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'red_credit_%'"
            );
            const settings = {};
            settingsRes.rows.forEach(r => {
                if (!/^\d+(\.\d{1,6})?$/.test(String(r.setting_value)) || Number(r.setting_value)>100000000)
                    throw new Error('Valor de política RED inválido');
                settings[r.setting_key] = Number(r.setting_value);
            });

            // Valores por defecto si no existen en la tabla
            const baseLimit = settings['red_credit_base_limit'] ?? 100;
            const refBonus = settings['red_credit_referral'] ?? 5;
            const quizBonus = settings['red_credit_culture_quiz'] ?? 1;
            const activityBonus = settings['red_credit_monthly_activity'] ?? 1;
            const earlyPayBonus = settings['red_credit_early_payment'] ?? 2;

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

            // Collateral is added exactly once by CoreProtocol from the Vault.
            for (const value of [baseLimit, refBonus, quizBonus, activityBonus, earlyPayBonus]) {
                if (!Number.isFinite(value) || value < 0) throw new Error('Política RED inválida');
            }

            // 3. Cálculo final (Únicamente los referidos con KYC verificado otorgan bonificación)
            const unit=value=>ethers.parseUnits(String(value),6);
            const exact=unit(baseLimit)+BigInt(verifiedRefCount)*unit(refBonus)+BigInt(quizCount)*unit(quizBonus)+(hasActivityBonus?unit(activityBonus):0n)+BigInt(earlyPayCount)*unit(earlyPayBonus);
            if(exact>100000000n*1000000n)throw new Error('El límite calculado supera el máximo de la política.');
            const score=Number(ethers.formatUnits(exact,6));

            console.log(`[SCORING] Límite de compromiso RED calculado para Usuario #${userId}: ${score} RED (Total Refs: ${totalRefCount}, Refs KYC Verificados: ${verifiedRefCount}, Actividad: ${taskCount})`);
            return score;

        } catch (error) {
            console.error('[SCORING] Error al calcular límite de compromiso:', error.message);
            throw new Error('No se pudo calcular el límite RED; no se modifica el límite vigente.');
        } finally {
            if (!existingClient) client.release();
        }
    }

    /**
     * Sincroniza el límite de compromiso calculado con el contrato inteligente en la Blockchain
     * y registra un log de auditoría inmutable en la base de datos (SOC 2).
     * @param {number} userId 
     */
    async syncCreditLimitOnChain(userId) {
        const {locked}=require('./chainOperationStore');
        const identity=(await pool.query('SELECT web3_wallet_address FROM users WHERE id=$1',[userId])).rows[0];
        if(!identity?.web3_wallet_address) return {skipped:true};
        const wallet=identity.web3_wallet_address;
        return locked(pool,'credit:'+wallet.toLowerCase(),async client=>{
            const outstanding=await client.query("SELECT id FROM chain_operations WHERE resource_key=$1 AND state IN ('pending','conflict') LIMIT 1",['credit:'+wallet.toLowerCase()]);
            if(outstanding.rowCount)return {pending:true,operationId:outstanding.rows[0].id};
            const override=(await client.query('SELECT red_credit_limit_override FROM users WHERE id=$1',[userId])).rows[0];
            if(override?.red_credit_limit_override!=null)return {skipped:true,reason:'individual_exception'};
            const score=await this.calculateUserScore(userId,client);
            const bridge=require('./web3BridgeService');
            if(await bridge._getProtocol().creditLimits(wallet)===ethers.parseUnits(String(score),6))return {skipped:true,reason:'already_current'};
            return bridge.setCreditLimit(wallet,score,{manual:false,alreadyLocked:true});
        });
    }

}

module.exports = new CreditScoringService();
