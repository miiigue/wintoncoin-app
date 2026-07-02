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

// Gestión de Impulsores (Boosters)
router.get('/boosters/settings', verifyAdminToken, adminController.getBoosterSettings);
router.post('/boosters/settings', verifyAdminToken, adminController.updateBoosterSettings);
router.get('/boosters/stats', verifyAdminToken, adminController.getBoosterStats);
router.get('/boosters/list', verifyAdminToken, adminController.getBoostersList);
router.get('/boosters/payments', verifyAdminToken, adminController.getBoosterPaymentsLog);
router.post('/boosters/rebuild-ledger/:username', verifyAdminToken, adminController.rebuildBoosterLedger);

// Gestión de Etapas de Booster y Multiplicadores
router.get('/boosters/config-stages', verifyAdminToken, adminController.getBoosterStages);
router.post('/boosters/config-stages', verifyAdminToken, adminController.saveBoosterStage);

// Gestión de Usuarios, Deudores y KYC
router.get('/users', verifyAdminToken, adminController.getUsers);
router.get('/users/:userId/kyc-status', web3RpcLimiter, verifyAdminToken, adminController.getUserKycStatus);
router.post('/users/:userId/status', verifyAdminToken, adminController.updateUserStatus);
router.put('/users/:userId/referral-code', verifyAdminToken, adminController.updateUserReferralCode);
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

// Log de Referidos
router.get('/referrals/log', verifyAdminToken, adminController.getReferralsLog);
router.get('/referrals/tiers', verifyAdminToken, adminController.getReferralTiers);
router.post('/referrals/tiers', verifyAdminToken, adminController.updateReferralTiers);

// Publicaciones de Plataforma
router.post('/platform/create-publication', verifyAdminToken, adminController.createPlatformPublication);
router.put('/platform/publications/:id', verifyAdminToken, adminController.updatePlatformPublication);
router.get('/platform/publications-with-participants', verifyAdminToken, adminController.getPlatformPublicationsWithParticipants);

// Recompensas de Gobernanza (Batch)
router.get('/governance/reward-stats', verifyAdminToken, adminController.getGovernanceRewardStats);
router.post('/governance/process-rewards', verifyAdminToken, adminController.processGovernanceRewards);

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

// Gobernanza Demo (Importación y Exportación)
// Gobernanza Demo (Importación y Exportación)
router.get('/governance/demo-export-stats', verifyAdminToken, adminController.getDemoExportStats);
router.post('/governance/demo-export', verifyAdminToken, adminController.generateDemoExport);
router.get('/governance/demo-export-history', verifyAdminToken, adminController.getDemoExportHistory);
router.get('/governance/demo-export/:id/download', verifyAdminToken, adminController.downloadDemoExport);
router.post('/governance/demo-import-preview', verifyAdminToken, adminController.previewDemoImport);
router.post('/governance/demo-import-process', verifyAdminToken, adminController.processDemoImport);

// Gestión de Invitaciones para Administradores
router.get('/profile', verifyAdminToken, adminController.getAdminProfile);
router.post('/invitations', verifyAdminToken, adminController.createInvitation);
router.get('/invitations', verifyAdminToken, adminController.getInvitations);
router.delete('/invitations', verifyAdminToken, adminController.deleteInvitation);
router.get('/invitations/verify/:token', adminController.verifyInvitation);
router.post('/invitations/claim', adminController.claimInvitation);

// Gestión de Accesos de Equipo (Administradores Activos y Suspensión)
router.get('/team', verifyAdminToken, adminController.getAdminUsers);
router.post('/team/:adminId/status', verifyAdminToken, adminController.updateAdminStatus);

module.exports = router;
