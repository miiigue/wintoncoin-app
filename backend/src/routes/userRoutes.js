const express = require('express');
const router = express.Router();

// Importamos el controlador de usuarios
const UserController = require('../controllers/userController');

// Importamos el middleware de seguridad OFICIAL
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAcceptedLegalByUsernameField } = require('../middleware/legalAcceptanceMiddleware');

// ==========================================
// RUTAS DE USUARIO (SEGURAS Y MODULARIZADAS)
// ==========================================

// 1. Obtener balance consolidado del usuario autenticado
router.get('/api/me/balance', authenticateToken, UserController.getMyBalance);

// 1b. Registrar depósito/retiro de garantía en la Bóveda (Collateral Vault)
router.post('/api/me/collateral/sync', authenticateToken, UserController.syncCollateral);

// 2. Obtener saldos por username (Legacy para perfiles y operaciones admin-user)
router.get('/users/:username/balance', authenticateToken, UserController.getUserBalanceLegacy);

// 3. Obtener el perfil público de un usuario (ratings, stats)
router.get('/users/:username/profile', UserController.getUserProfile);

// 4. Obtener información básica de un usuario
router.get('/user/:username', UserController.getUserBasicInfo);

// 5. Obtener código de referido
router.get('/api/user/:username/referral-code', UserController.getReferralCode);

// 6. Obtener historial del usuario (Legacy)
router.get('/users/:username/history', authenticateToken, UserController.getUserHistoryLegacy);

// 7. Obtener historial del usuario (Profesional Auth)
router.get('/api/me/history', authenticateToken, UserController.getMyHistory);

// 8. Obtener perfil de impulsor (Booster Profile)
router.get('/api/me/booster-profile', authenticateToken, UserController.getMyBoosterProfile);

// 9. Quema de Tokens (Financial Transaction)
router.post('/users/burn', requireAcceptedLegalByUsernameField(['username']), UserController.burnTokens);

// 10. Crear una calificación (Mapeado de /rate)
router.post('/rate', requireAcceptedLegalByUsernameField(['rater_username']), UserController.createRating);

// 11. Obtener información de referidos
router.get('/api/users/:username/referral-info', UserController.getReferralInfo);

// 12. Obtener perfil de impulsor de un usuario por username
router.get('/api/users/:username/booster-profile', UserController.getUserBoosterProfile);

module.exports = router;
