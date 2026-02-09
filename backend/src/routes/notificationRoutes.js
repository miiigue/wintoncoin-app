const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken, authenticateAdmin } = require('../middleware/authMiddleware'); // Asumiendo que existe este middleware

// Rutas públicas (aunque requieren token para vincular al usuario, el endpoint en sí es accesible)
router.get('/vapid-public-key', notificationController.getVapidPublicKey);

// Requieren autenticación
router.post('/subscribe', authenticateToken, notificationController.subscribe);

// Preferencias de Notificaciones (Usuario)
router.get('/settings', authenticateToken, notificationController.getNotificationSettings);
router.put('/settings', authenticateToken, notificationController.updateNotificationSettings);

// Ruta protegida para admin (simplificada, deberías añadir middleware de rol admin real)
router.post('/send', authenticateAdmin, notificationController.sendPush);

module.exports = router;
