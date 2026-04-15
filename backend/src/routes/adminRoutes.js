const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateAdmin } = require('../middleware/authMiddleware');
const { loginLimiter } = require('../middleware/rateLimiters');

// Alias para compatibilidad con código existente que espera verifyAdminToken
const verifyAdminToken = authenticateAdmin;

/**
 * Rutas de Administración de WintonCoin
 */

// Autenticación
router.post('/login', loginLimiter, adminController.login);
router.post('/logout', adminController.logout);

// Configuración Global
router.get('/settings', verifyAdminToken, adminController.getSettings);
router.post('/settings', verifyAdminToken, adminController.updateSetting);

// Gestión de Etapas de Booster y Multiplicadores
router.get('/boosters/config-stages', verifyAdminToken, adminController.getBoosterStages);
router.post('/boosters/config-stages', verifyAdminToken, adminController.saveBoosterStage);

// Gestión de Usuarios y Deudores
router.get('/users', verifyAdminToken, adminController.getUsers);
router.post('/users/:userId/status', verifyAdminToken, adminController.updateUserStatus);
router.get('/debtors', verifyAdminToken, adminController.getDebtors);

// Dashboard y Estadísticas
router.get('/dashboard-stats', verifyAdminToken, adminController.getDashboardStats);

// Billetera de Plataforma
router.get('/platform-wallet/balance', verifyAdminToken, adminController.getPlatformWalletBalance);
router.get('/platform-wallet/log', verifyAdminToken, adminController.getPlatformWalletLog);

// Broadcast Email
router.post('/broadcast-email', verifyAdminToken, adminController.createBroadcastEmail);
router.get('/broadcast-email', verifyAdminToken, adminController.getBroadcastEmails);
router.get('/broadcast-email/:id/recipients', verifyAdminToken, adminController.getBroadcastRecipients);

// Auditoría
router.get('/audit-log', verifyAdminToken, adminController.getAuditLog);

module.exports = router;
