const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateAdmin } = require('../middleware/authMiddleware');
const { loginLimiter, web3RpcLimiter } = require('../middleware/rateLimiters');

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

// Gestión de Usuarios, Deudores y KYC
router.get('/users', verifyAdminToken, adminController.getUsers);
router.get('/users/:userId/kyc-status', web3RpcLimiter, verifyAdminToken, adminController.getUserKycStatus);
router.post('/users/:userId/status', verifyAdminToken, adminController.updateUserStatus);
router.get('/debtors', verifyAdminToken, adminController.getDebtors);

// Moderación de Publicaciones
router.get('/publications', verifyAdminToken, adminController.getAdminPublications);
router.post('/publications/:id/restore', verifyAdminToken, adminController.restorePublication);
router.delete('/publications/:id', verifyAdminToken, adminController.deletePublicationAdmin);

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

// Gestión Segura de Datos (Backups y Limpieza)
router.get('/database/stats', verifyAdminToken, adminController.getDatabaseStats);
router.post('/database/backup', verifyAdminToken, adminController.createDatabaseBackup);
router.post('/database/cleanup-test-data', verifyAdminToken, adminController.cleanupTestData);
router.post('/database/cleanup-inactive-users', verifyAdminToken, adminController.cleanupInactiveUsers);
router.post('/database/cleanup-old-publications', verifyAdminToken, adminController.cleanupOldPublications);

module.exports = router;
