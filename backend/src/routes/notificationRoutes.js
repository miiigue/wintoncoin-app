const express = require('express');

module.exports = function (pool) {
    const router = express.Router();
    const notificationController = require('../controllers/notificationController')(pool);
    const { authenticateToken, authenticateAdmin } = require('../middleware/authMiddleware');

    // Rutas públicas
    router.get('/vapid-public-key', notificationController.getVapidPublicKey);

    // Requieren autenticación
    router.post('/subscribe', authenticateToken, notificationController.subscribe);

    // Preferencias de Notificaciones (Usuario)
    router.get('/settings', authenticateToken, notificationController.getNotificationSettings);
    router.put('/settings', authenticateToken, notificationController.updateNotificationSettings);

    // Ruta protegida para admin
    router.post('/send', authenticateAdmin, notificationController.sendPush);

    return router;
};
