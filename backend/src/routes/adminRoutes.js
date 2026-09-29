const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateAdmin } = require('../middleware/authMiddleware');
const { loginLimiter, web3RpcLimiter, forgotPasswordLimiter } = require('../middleware/rateLimiters');

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
router.get('/users/:userId/dossier', verifyAdminToken, adminController.getUserDossier360);
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
router.get('/metrics/badges', verifyAdminToken, adminController.getAdminBadges);

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
router.post('/change-password/request', forgotPasswordLimiter, verifyAdminToken, adminController.requestPasswordChange);
router.post('/change-password/confirm', forgotPasswordLimiter, verifyAdminToken, adminController.confirmPasswordChange);
router.post('/invitations', verifyAdminToken, adminController.createInvitation);
router.get('/invitations', verifyAdminToken, adminController.getInvitations);
router.delete('/invitations', verifyAdminToken, adminController.deleteInvitation);
router.get('/invitations/verify/:token', adminController.verifyInvitation);
router.post('/invitations/claim', adminController.claimInvitation);

// Gestión de Accesos de Equipo (Administradores Activos y Suspensión)
router.get('/team', verifyAdminToken, adminController.getAdminUsers);
router.post('/team/:adminId/status', verifyAdminToken, adminController.updateAdminStatus);

// Gestión de Expedientes SOS Venezuela (Damnificados)
const victimController = require('../controllers/victimController');
router.get('/sos-venezuela/victims', verifyAdminToken, victimController.listVictimsAdmin);
router.get('/sos-venezuela/victims/:id', verifyAdminToken, victimController.getVictimDetailAdmin);
router.post('/sos-venezuela/victims/:id/update-status', verifyAdminToken, victimController.updateVictimStatusAdmin);
router.post('/sos-venezuela/victims/:id/disburse', verifyAdminToken, victimController.disburseVictimAidAdmin);
router.get('/sos-venezuela/email-templates', verifyAdminToken, victimController.getEmailTemplatesAdmin);
router.post('/sos-venezuela/email-templates', verifyAdminToken, victimController.updateEmailTemplateAdmin);

// Gestión Global de Plantillas de Correo (Admin Email CMS)
const emailTemplateController = require('../controllers/emailTemplateController');
router.get('/email-templates', verifyAdminToken, emailTemplateController.getEmailTemplates);
router.get('/email-templates/:key', verifyAdminToken, emailTemplateController.getTemplateByKey);
router.put('/email-templates/:key', verifyAdminToken, emailTemplateController.updateTemplate);
router.post('/email-templates/:key/preview', verifyAdminToken, emailTemplateController.previewTemplate);

// ========================================================================
// GOBERNANZA, AUDITORÍA Y LABORATORIO WEB3 SUITE V4
// ========================================================================
const adminWeb3Controller = require('../controllers/admin/adminWeb3Controller');
const contractAdmin = require('../middleware/contractAdministration');
router.use('/web3', verifyAdminToken, contractAdmin.guard);
router.get('/web3/recovery-status', async(req,res)=>{
    try {
        const pool=require('../config/db');
        const jobs=await pool.query('SELECT * FROM credit_policy_jobs ORDER BY version_id DESC LIMIT 5');
        const operations=await pool.query("SELECT o.id,o.kind,o.state,o.error_code,o.created_at FROM chain_operations o LEFT JOIN marketplace_payment_settlements s ON s.operation_id=o.id WHERE o.state IN ('pending','conflict','failed') OR (o.kind='marketplace' AND o.state='confirmed' AND s.operation_id IS NULL) ORDER BY o.created_at DESC LIMIT 25");
        const issues=await pool.query("SELECT i.*,u.username FROM credit_policy_issues i LEFT JOIN users u ON u.id=i.user_id WHERE i.status<>'resolved' ORDER BY i.version_id DESC,i.updated_at LIMIT 50");
        res.json({success:true,jobs:jobs.rows,operations:operations.rows,issues:issues.rows});
    } catch{res.status(503).json({success:false,message:'No se pudo consultar la recuperación.'});}
});
router.post('/web3/credit-policy/retry',contractAdmin.resolveUser,async(req,res)=>{
    if(!/^[1-9]\d*$/.test(String(req.body.versionId)))return res.status(400).json({message:'Versión inválida.'});
    try{res.json(await require('../services/creditPolicyJobs').retryIssue(require('../config/db'),req.body.versionId,req.targetUser.id));}
    catch(e){res.status(e.status||503).json({message:e.status?e.message:'No se pudo programar la revisión.'});}
});
router.get('/web3/operations/:id', async(req,res)=>{
    if(!/^[a-f0-9-]{36}$/i.test(req.params.id))return res.status(400).json({message:'Referencia inválida.'});
    const deployment=require('../services/chainDeployment');
    const rpc=deployment.provider();
    try {
        const {ChainOperationStore}=require('../services/chainOperationStore');
        const result=await new ChainOperationStore(require('../config/db'),rpc).reconcile(req.params.id);
        res.status(result.success?200:202).json(result);
    } catch(e){res.status(e.status||503).json({success:false,message:'No se pudo consultar la operación.'});}
    finally{rpc.destroy();}
});
router.get('/web3/configuration', contractAdmin.getConfiguration);
router.get('/web3/identity', (req,res,next) => {
    req.body = {username:req.query.username};
    return contractAdmin.resolveUser(req,res,()=>res.json({success:true,username:req.targetUser.username,walletAddress:req.targetUser.web3_wallet_address}));
});
router.post('/web3/configuration', contractAdmin.updateConfiguration, adminController.updateSetting);
router.get('/web3/readiness', web3RpcLimiter, async(req,res)=>{
    res.set('Cache-Control','no-store');
    try{res.json(await require('../services/web3Readiness').inspect({pool:require('../config/db')}));}
    catch{res.status(503).json({message:'No se pudo comprobar la preparación del servicio.'});}
});
router.get('/web3/status', adminWeb3Controller.getWeb3Status);
router.post('/web3/credit-limit', contractAdmin.resolveUser, adminWeb3Controller.setCreditLimit);
router.post('/web3/kyc', contractAdmin.resolveUser, adminWeb3Controller.setKYCStatus);
router.post('/web3/max-tx', adminWeb3Controller.setMaxTransactionAmount);
router.post('/web3/extension-params', adminWeb3Controller.setExtensionParams);
router.post('/web3/user-benefits', contractAdmin.resolveUser, adminWeb3Controller.setUserBenefits);
router.post('/web3/commission-rate', (req,res,next) => {
    const bps=String(req.body?.commissionBps);
    if (!/^\d+$/.test(bps) || Number(bps)>1000) return res.status(400).json({success:false,message:'Comisión entre 0 y 1000 BPS.'});
    req.body={key:'platform_commission_percentage',value:String(Number(bps)/100)};
    req.contractConfiguration=true;
    return adminController.updateSetting(req,res,next);
});
router.post('/web3/pause', adminWeb3Controller.setPause);
router.get('/web3/user-audit/:wallet', adminWeb3Controller.getUserAudit);

// Laboratorio de Pruebas y Simulación
router.post('/web3/test/process-payment', contractAdmin.resolvePaymentUsers, adminWeb3Controller.simulatePayment);
router.post('/web3/test/match-orders', adminWeb3Controller.executeMatching);
router.post('/web3/test/mint-test-tokens', contractAdmin.resolveUser, adminWeb3Controller.mintTestTokens);

module.exports = router;


