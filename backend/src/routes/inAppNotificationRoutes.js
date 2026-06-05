const express = require('express');
const router = express.Router();
const inAppNotificationController = require('../controllers/inAppNotificationController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Usamos el middleware centralizado para la verificación
const verifyUserToken = authenticateToken;

// ============================================================================
// RUTAS DE NOTIFICACIONES IN-APP MODULARIZADAS
// ============================================================================

// --- RUTAS PROFESIONALES (/api/me/notifications) ---
router.get('/api/me/notifications', verifyUserToken, inAppNotificationController.getMyNotifications);
router.get('/api/me/notifications/history', verifyUserToken, inAppNotificationController.getMyNotificationsHistory);
router.post('/api/me/notifications/mark-read', verifyUserToken, inAppNotificationController.markReadMyNotifications);
router.post('/api/me/notifications/:id/dismiss', verifyUserToken, inAppNotificationController.dismissMyNotification);

// --- RUTAS LEGACY COMPATIBLES (/notifications) ---
router.get('/notifications/:username', verifyUserToken, inAppNotificationController.getLegacyNotifications);
router.post('/notifications/mark-read', verifyUserToken, inAppNotificationController.markReadLegacy);
router.post('/notifications/:id/dismiss', verifyUserToken, inAppNotificationController.dismissNotificationLegacy);

module.exports = router;
