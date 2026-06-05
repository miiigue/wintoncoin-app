const express = require('express');
const router = express.Router();
const SystemController = require('../controllers/systemController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { web3RpcLimiter } = require('../middleware/rateLimiters');

// Alias para verifyUserToken
const verifyUserToken = authenticateToken;

// ==========================================
// RUTAS DE SISTEMA Y CONFIGURACIÓN PÚBLICA
// ==========================================

// 1. Obtener info de Smart Contracts (Seguro y Cacheado)
router.get('/contracts/info', web3RpcLimiter, verifyUserToken, SystemController.getContractsInfo);

// 2. Obtener configuración de referidos (Público)
router.get('/referral-settings', SystemController.getReferralSettings);

// 3. Obtener fecha de vigencia de códigos de referido (Público)
router.get('/referral-expiry-date', SystemController.getReferralExpiryDate);

// 4. Lista de Obligaciones Vencidas (LOVE) (Público)
router.get('/love-list', SystemController.getLoveList);

// 5. Configuración pública de la app (Público)
router.get('/app-settings', SystemController.getAppSettings);

// 6. Configuración pública básica (Público, requerido por frontend / publicación)
router.get('/settings', SystemController.getPublicSettings);

// 7. Configuración de plataforma de lanzamiento (Público, requerido por frontend / publicación)
router.get('/platform-settings', SystemController.getPlatformSettings);

// 8. Configuración pública legacy (Público, requerido por suite de pruebas de publicación)
router.get('/public-settings', SystemController.getAppSettings);

module.exports = router;
