/**
 * backend/src/routes/web3Routes.js
 * Rutas de Interacción Web3 para Usuarios y Testers (Suite V4)
 * 
 * Permite a la Billetera React y al Exchange consultar balances on-chain,
 * verificar garantías y realizar pruebas en entornos de prueba / demo.
 */

'use strict';

const express = require('express');
const router = express.Router();
const web3BridgeService = require('../services/web3BridgeService');

/**
 * GET /api/web3/status
 * Estado público de contratos y red
 */
router.get('/status', async (req, res) => {
    try {
        const status = await web3BridgeService.getProtocolStatus();
        res.status(200).json(status);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar estado Web3.' });
    }
});

/**
 * GET /api/web3/user/:wallet
 * Consulta pública de balances y compromisos on-chain para una billetera
 */
router.get('/user/:wallet', async (req, res) => {
    const { wallet } = req.params;
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({ success: false, message: 'Dirección Ethereum inválida.' });
    }

    try {
        const audit = await web3BridgeService.getUserAuditDetailed(wallet);
        res.status(200).json(audit);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar datos on-chain del usuario.' });
    }
});

/**
 * POST /api/web3/faucet/usdt
 * Faucet para pruebas en Demo / Staging / Local
 */
router.post('/faucet/usdt', async (req, res) => {
    const { wallet, amount } = req.body;
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({ success: false, message: 'Dirección Ethereum inválida.' });
    }

    const parsedAmount = parseFloat(amount || 100);
    if (parsedAmount > 5000) {
        return res.status(400).json({ success: false, message: 'Límite máximo de faucet: 5,000 USDT.' });
    }

    try {
        const result = await web3BridgeService.mintMockUsdt(wallet, parsedAmount);
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Error al solicitar tokens de faucet.' });
        }
        res.status(200).json({
            success: true,
            message: `${parsedAmount} USDT de prueba transferidos a tu billetera.`,
            txHash: result.txHash
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error interno en faucet.' });
    }
});

module.exports = router;
