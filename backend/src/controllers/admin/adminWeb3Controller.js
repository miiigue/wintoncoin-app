/**
 * backend/src/controllers/admin/adminWeb3Controller.js
 * Controlador de Administración para la Suite Web3 V4 y Gobernanza de Smart Contracts
 * 
 * Estándares:
 * - SOC 2 Type II / ISO 27001 Bank-Grade Audit Logging
 * - Zero-Trust: Validación exhaustiva de entradas y direcciones Ethereum
 * - Monitoreo en tiempo real del estado de los contratos y relayer
 */

'use strict';

const pool = require('../../config/db');
const web3BridgeService = require('../../services/web3BridgeService');
const { logAuditEvent } = require('../../services/auditService');

/**
 * Registra formalmente la accion de gobernanza en la tabla inmutable web3_governance_actions (SOC 2)
 */
async function logGovernanceAction({ actionType, targetContract, affectedWallet, parameterName, oldValue, newValue, txHash, performedBy, metadata = {} }) {
    try {
        await pool.query(`
            INSERT INTO web3_governance_actions (
                action_type, target_contract_address, affected_wallet_address,
                parameter_name, old_value, new_value, tx_hash, performed_by, audit_metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            actionType,
            targetContract || '0x0000000000000000000000000000000000000000',
            affectedWallet || null,
            parameterName,
            oldValue !== undefined && oldValue !== null ? String(oldValue) : null,
            String(newValue),
            txHash || null,
            performedBy,
            JSON.stringify(metadata)
        ]);
    } catch (err) {
        console.warn('[AdminWeb3Controller] Nota al registrar gobernanza en DB:', err.message);
    }
}

/**
 * Validador de formato de dirección Ethereum (Hexadecimal 40 caracteres con prefijo 0x)
 */
async function auditAction(req, { adminUser, action, details }) {
    return logAuditEvent(pool, req, { eventType: action, actorUsername: adminUser,
        actorId: req.user?.id ?? null, category: 'web3_governance', metadata: { details } });
}

function isValidEthereumAddress(address) {
    return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
}


/**
 * GET /api/admin/web3/status
 * Retorna el estado global del protocolo, contratos enlazados y saldo del Relayer.
 */
async function getWeb3Status(req, res) {
    try {
        const status = await web3BridgeService.getProtocolStatus();
        return res.status(status.success ? 200 : 503).json(status);
    } catch (error) {
        console.error('[AdminWeb3Controller] Error al obtener estado Web3:', error);
        return res.status(500).json({ success: false, message: 'Error al consultar estado Web3.' });
    }
}

/**
 * POST /api/admin/web3/credit-limit
 * Configura el límite de crédito base on-chain para una billetera.
 */
async function setCreditLimit(req, res) {
    const { walletAddress, limit } = req.body;
    const adminUser = req.user?.username || 'admin';

    if (!isValidEthereumAddress(walletAddress)) {
        return res.status(400).json({ success: false, message: 'Dirección Ethereum inválida.' });
    }

    const parsedLimit = parseFloat(limit);
    if (isNaN(parsedLimit) || parsedLimit < 0) {
        return res.status(400).json({ success: false, message: 'Límite debe ser un número mayor o igual a 0.' });
    }

    try {
        const result = await web3BridgeService.setCreditLimit(walletAddress, parsedLimit);
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Error al ejecutar transacción on-chain.' });
        }

        await auditAction(req, {
            adminUser,
            action: 'WEB3_SET_CREDIT_LIMIT',
            details: `Límite de crédito configurado para ${walletAddress}: ${parsedLimit} RED. Tx: ${result.txHash}`
        }).catch(() => {});

        await logGovernanceAction({
            actionType: 'SET_CREDIT_LIMIT',
            targetContract: process.env.CORE_PROTOCOL_ADDRESS,
            affectedWallet: walletAddress,
            parameterName: 'creditLimits',
            newValue: parsedLimit,
            txHash: result.txHash,
            performedBy: adminUser
        }).catch(() => {});

        return res.status(200).json({
            success: true,
            message: `Límite de ${parsedLimit} RED asignado con éxito.`,
            txHash: result.txHash
        });
    } catch (error) {
        console.error('[AdminWeb3Controller] Error en setCreditLimit:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
}

/**
 * POST /api/admin/web3/kyc
 * Asigna o revoca el estatus de KYC on-chain para una billetera.
 */
async function setKYCStatus(req, res) {
    const { walletAddress, status } = req.body;
    const adminUser = req.user?.username || 'admin';

    if (!isValidEthereumAddress(walletAddress)) {
        return res.status(400).json({ success: false, message: 'Dirección Ethereum inválida.' });
    }

    try {
        if (typeof status !== 'boolean') return res.status(400).json({ success: false, message: 'El estado KYC debe ser true o false.' });
        const result = await web3BridgeService.setKYCStatus(walletAddress, status);
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Error al modificar KYC on-chain.' });
        }

        await auditAction(req, {
            adminUser,
            action: 'WEB3_SET_KYC_STATUS',
            details: `KYC ${Boolean(status) ? 'Aprobado' : 'Revocado'} para ${walletAddress}. Tx: ${result.txHash}`
        }).catch(() => {});

        await logGovernanceAction({
            actionType: 'SET_KYC_STATUS',
            targetContract: process.env.CORE_PROTOCOL_ADDRESS,
            affectedWallet: walletAddress,
            parameterName: 'isKYCVerified',
            newValue: Boolean(status) ? 'true' : 'false',
            txHash: result.txHash,
            performedBy: adminUser
        }).catch(() => {});

        return res.status(200).json({
            success: true,
            message: `Estatus KYC actualizado a ${Boolean(status) ? 'Activo' : 'Inactivo'}.`,
            txHash: result.txHash
        });
    } catch (error) {
        console.error('[AdminWeb3Controller] Error en setKYCStatus:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
}

/**
 * POST /api/admin/web3/max-tx
 * Ajusta el Circuit Breaker de monto máximo por transacción.
 */
async function setMaxTransactionAmount(req, res) {
    const { maxAmount } = req.body;
    const adminUser = req.user?.username || 'admin';

    const parsedAmount = parseFloat(maxAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'El monto máximo debe ser un número positivo.' });
    }

    try {
        const result = await web3BridgeService.setMaxTransactionAmount(parsedAmount);
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Error al ajustar monto máximo.' });
        }

        await auditAction(req, {
            adminUser,
            action: 'WEB3_SET_MAX_TX_AMOUNT',
            details: `Monto máximo por tx actualizado a ${parsedAmount} BLUE. Tx: ${result.txHash}`
        }).catch(() => {});

        await logGovernanceAction({
            actionType: 'SET_MAX_TX_AMOUNT',
            targetContract: process.env.CORE_PROTOCOL_ADDRESS,
            parameterName: 'maxTransactionAmount',
            newValue: parsedAmount,
            txHash: result.txHash,
            performedBy: adminUser
        }).catch(() => {});

        return res.status(200).json({
            success: true,
            message: `Monto máximo actualizado a ${parsedAmount} BLUE.`,
            txHash: result.txHash
        });
    } catch (error) {
        console.error('[AdminWeb3Controller] Error en setMaxTransactionAmount:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
}

/**
 * POST /api/admin/web3/commission-rate
 * Ajusta la tasa de comisión de plataforma (BPS).
 */
async function setCommissionRate(req, res) {
    const { commissionBps } = req.body;
    const adminUser = req.user?.username || 'admin';

    const parsedBps = Number(commissionBps);
    if (!/^\d+$/.test(String(commissionBps)) || !Number.isInteger(parsedBps) || parsedBps < 0 || parsedBps > 1000) {
        return res.status(400).json({ success: false, message: 'La tasa debe estar entre 0 y 1000 BPS (0% a 10%).' });
    }

    try {
        const result = await web3BridgeService.setCommissionRate(parsedBps);
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Error al ajustar comisión.' });
        }

        await auditAction(req, {
            adminUser,
            action: 'WEB3_SET_COMMISSION_RATE',
            details: `Comisión de plataforma ajustada a ${parsedBps} BPS (${parsedBps / 100}%). Tx: ${result.txHash}`
        }).catch(() => {});

        await logGovernanceAction({
            actionType: 'SET_COMMISSION_RATE',
            targetContract: process.env.CORE_PROTOCOL_ADDRESS,
            parameterName: 'commissionBps',
            newValue: parsedBps,
            txHash: result.txHash,
            performedBy: adminUser
        }).catch(() => {});

        return res.status(200).json({
            success: true,
            message: `Comisión de plataforma actualizada a ${(parsedBps / 100).toFixed(2)}%.`,
            txHash: result.txHash
        });
    } catch (error) {
        console.error('[AdminWeb3Controller] Error en setCommissionRate:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
}

/**
 * POST /api/admin/web3/pause
 * Activa o desactiva la pausa de emergencia en CoreProtocol o CollateralVault.
 */
async function setPause(req, res) {
    const { target, action } = req.body; // target: 'protocol' | 'vault'; action: 'pause' | 'unpause'
    const adminUser = req.user?.username || 'admin';

    if (!['protocol', 'vault'].includes(target) || !['pause', 'unpause'].includes(action)) {
        return res.status(400).json({ success: false, message: "Parámetros inválidos. Use target: 'protocol'|'vault' y action: 'pause'|'unpause'." });
    }

    try {
        let result;
        if (target === 'protocol') {
            result = action === 'pause' ? await web3BridgeService.pauseProtocol() : await web3BridgeService.unpauseProtocol();
        } else {
            result = action === 'pause' ? await web3BridgeService.pauseVault() : await web3BridgeService.unpauseVault();
        }

        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Fallo en la operación de pausa.' });
        }

        await auditAction(req, {
            adminUser,
            action: `WEB3_${action.toUpperCase()}_${target.toUpperCase()}`,
            details: `Operación de emergencia: ${action} en ${target}. Tx: ${result.txHash}`
        }).catch(() => {});

        await logGovernanceAction({
            actionType: `${action.toUpperCase()}_${target.toUpperCase()}`,
            targetContract: target === 'protocol' ? process.env.CORE_PROTOCOL_ADDRESS : process.env.COLLATERAL_VAULT_ADDRESS,
            parameterName: 'paused',
            newValue: action === 'pause' ? 'true' : 'false',
            txHash: result.txHash,
            performedBy: adminUser
        }).catch(() => {});


        return res.status(200).json({
            success: true,
            message: `${target === 'protocol' ? 'CoreProtocol' : 'CollateralVault'} ha sido ${action === 'pause' ? 'PAUSADO' : 'REANUDADO'}.`,
            txHash: result.txHash
        });
    } catch (error) {
        console.error('[AdminWeb3Controller] Error en setPause:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
}

/**
 * GET /api/admin/web3/user-audit/:wallet
 * Auditoría 360° on-chain para cualquier billetera.
 */
async function getUserAudit(req, res) {
    const { wallet } = req.params;

    if (!isValidEthereumAddress(wallet)) {
        return res.status(400).json({ success: false, message: 'Dirección Ethereum inválida.' });
    }

    try {
        const audit = await web3BridgeService.getUserAuditDetailed(wallet, Number(req.query?.offset ?? 0), Number(req.query?.limit ?? 50));
        return res.status(audit.success ? 200 : 503).json(audit);
    } catch (error) {
        console.error('[AdminWeb3Controller] Error en getUserAudit:', error);
        return res.status(500).json({ success: false, message: 'Error al consultar auditoría on-chain.' });
    }
}

/**
 * POST /api/admin/web3/test/process-payment
 * Laboratorio: Simula un pago en el Marketplace emitiendo BLUE al prestador y RED al pagador.
 */
async function simulatePayment(req, res) {
    const { payerWallet, payeeWallet, amount, authorization, signature } = req.body;
    if (!authorization || !signature) return res.status(400).json({ success: false, message: "El pagador debe firmar esta operación." });
    const adminUser = req.user?.username || 'admin';

    if (!isValidEthereumAddress(payerWallet) || !isValidEthereumAddress(payeeWallet)) {
        return res.status(400).json({ success: false, message: 'Direcciones Ethereum inválidas.' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Monto debe ser mayor a 0.' });
    }

    try {
        const txHash = await web3BridgeService.syncPaymentToBlockchain({
            payerWalletAddress: payerWallet,
            payeeWalletAddress: payeeWallet,
            amountBlue: parsedAmount,
            payerUsername: 'admin_test_payer',
            payeeUsername: 'admin_test_payee', authorization, signature
        });

        if (!txHash) {
            return res.status(500).json({ success: false, message: 'Error al procesar el pago on-chain (verifique límites y KYC).' });
        }

        await auditAction(req, {
            adminUser,
            action: 'WEB3_SIMULATE_PAYMENT',
            details: `Pago simulado: ${payerWallet} -> ${payeeWallet} (${parsedAmount} BLUE). Tx: ${txHash}`
        }).catch(() => {});

        return res.status(200).json({
            success: true,
            message: `Pago de ${parsedAmount} BLUE ejecutado con emisión dual pareada.`,
            txHash
        });
    } catch (error) {
        console.error('[AdminWeb3Controller] Error en simulatePayment:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
}

/**
 * POST /api/admin/web3/test/match-orders
 * Laboratorio: Dispara el cruce bilateral de órdenes en el FifoExchange.
 */
async function executeMatching(req, res) {
    const { maxMatches, maxOrdersScanned } = req.body;
    const adminUser = req.user?.username || 'admin';

    try {
        const result = await web3BridgeService.executeMatching(
            parseInt(maxMatches || 10, 10),
            parseInt(maxOrdersScanned || 20, 10)
        );

        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Error al ejecutar matching.' });
        }

        await auditAction(req, {
            adminUser,
            action: 'WEB3_EXECUTE_MATCHING',
            details: `Matching de órdenes ejecutado en FifoExchange. Tx: ${result.txHash}`
        }).catch(() => {});

        return res.status(200).json({
            success: true,
            message: 'Motor de cruce FIFO ejecutado exitosamente.',
            txHash: result.txHash
        });
    } catch (error) {
        console.error('[AdminWeb3Controller] Error en executeMatching:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
}

/**
 * POST /api/admin/web3/test/mint-test-tokens
 * Laboratorio: Mintea USDT de prueba para una billetera en entornos locales/testnet.
 */
async function mintTestTokens(req, res) {
    const { walletAddress, amount } = req.body;
    const adminUser = req.user?.username || 'admin';

    if (!isValidEthereumAddress(walletAddress)) {
        return res.status(400).json({ success: false, message: 'Dirección Ethereum inválida.' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Monto debe ser mayor a 0.' });
    }

    try {
        const result = await web3BridgeService.mintMockUsdt(walletAddress, parsedAmount);
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Error al mintear tokens de prueba.' });
        }

        await auditAction(req, {
            adminUser,
            action: 'WEB3_MINT_TEST_TOKENS',
            details: `Minteados ${parsedAmount} USDT de prueba para ${walletAddress}. Tx: ${result.txHash}`
        }).catch(() => {});

        return res.status(200).json({
            success: true,
            message: `${parsedAmount} USDT de prueba transferidos a la billetera.`,
            txHash: result.txHash
        });
    } catch (error) {
        console.error('[AdminWeb3Controller] Error en mintTestTokens:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
}

function integer(value, min, max) {
    return /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max;
}
async function setExtensionParams(req, res) {
    const { extensionDays, extensionBps, enabled } = req.body;
    if (!integer(extensionDays,1,365) || !integer(extensionBps,0,10000) || typeof enabled !== 'boolean')
        return res.status(400).json({ success: false, message: 'Plazo entero de 1–365 días, comisión entera de 0–10000 BPS y estado booleano requeridos.' });
    try {
        const result = await web3BridgeService.setExtensionParams(Number(extensionDays), Number(extensionBps), enabled);
        if (!result.success) return res.status(503).json(result);
        await auditAction(req, { adminUser: req.user?.username, action: 'WEB3_EXTENSION_OPTION',
            details: JSON.stringify({ extensionDays, extensionBps, enabled, txHash: result.txHash }) });
        return res.status(200).json(result);
    } catch (error) { return res.status(500).json({ success: false, message: 'No se pudo actualizar la opción de prórroga.' }); }
}
async function setUserBenefits(req, res) {
    const { walletAddress, level, margin } = req.body;
    if (!isValidEthereumAddress(walletAddress) || !integer(level,0,255) || !/^\d+(\.\d{1,6})?$/.test(String(margin)))
        return res.status(400).json({ success: false, message: 'Dirección, nivel entero y margen con hasta seis decimales requeridos.' });
    try {
        const result = await web3BridgeService.setUserBenefits(walletAddress, Number(level), String(margin));
        if (!result.success) return res.status(503).json(result);
        await auditAction(req, { adminUser: req.user?.username, action: 'WEB3_USER_BENEFITS',
            details: JSON.stringify({ walletAddress, level, margin, txHash: result.txHash }) });
        return res.status(200).json(result);
    } catch (error) { return res.status(500).json({ success: false, message: 'No se pudieron actualizar los beneficios.' }); }
}

module.exports = {
    setExtensionParams, setUserBenefits,
    getWeb3Status,
    setCreditLimit,
    setKYCStatus,
    setMaxTransactionAmount,
    setCommissionRate,
    setPause,
    getUserAudit,
    simulatePayment,
    executeMatching,
    mintTestTokens
};
