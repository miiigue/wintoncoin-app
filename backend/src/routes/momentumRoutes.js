// ============================================================================
// WintonCoin - Momentum Routes
// ============================================================================
// Definición de rutas Express para el sistema Winton Momentum.
//
// Estructura de rutas:
//   /api/momentum/                        → Endpoints públicos (landing)
//   /api/momentum/                        → Endpoints de influencer (auth usuario)
//   /api/momentum/admin/                  → Endpoints de administración (auth admin)
//
// Middleware utilizado:
//   - verifyUserToken:  Autenticación de usuario (JWT)
//   - verifyAdminToken: Autenticación de administrador
//   - logAuditEvent:    Función de auditoría inyectada desde server.js
//
// NOTA: Este Router se monta en server.js con:
//   app.use('/api/momentum', momentumRoutes(pool, verifyUserToken, verifyAdminToken, logAuditEvent))
// ============================================================================

'use strict';

const express = require('express');
const momentumController = require('../controllers/momentumController');

/**
 * Factory de rutas de Momentum.
 * Recibe las dependencias desde server.js para mantener el desacoplamiento.
 *
 * @param {object} pool - Pool de conexiones PostgreSQL
 * @param {function} verifyUserToken - Middleware de auth de usuario
 * @param {function} verifyAdminToken - Middleware de auth de admin
 * @param {function} logAuditEvent - Función de auditoría
 * @returns {express.Router} Router configurado
 */
function createMomentumRouter(pool, verifyUserToken, verifyAdminToken, logAuditEvent) {
    const router = express.Router();

    // ========================================================================
    // MIDDLEWARE LOCAL: Inyectar dependencias en cada request
    // ========================================================================
    // Esto permite que los controllers accedan al pool y a logAuditEvent
    // sin importarlos directamente (desacoplamiento).
    router.use((req, res, next) => {
        req.app.set('pool', pool);
        req.logAuditEvent = logAuditEvent;
        next();
    });

    // ========================================================================
    // RUTAS PÚBLICAS (Sin autenticación)
    // ========================================================================
    // Estas rutas alimentan la landing page de captación de influencers.

    // Datos para el simulador, barra de FOMO y contador
    router.get('/landing-data', momentumController.getLandingData);

    // Últimas misiones pagadas (Social Proof)
    router.get('/recent-payments', momentumController.getRecentPayments);

    // ========================================================================
    // RUTAS DE INFLUENCER (Requieren autenticación de usuario)
    // ========================================================================
    // El influencer accede con su cuenta normal de WintonCoin.

    // Postularse como influencer
    router.post('/apply', verifyUserToken, momentumController.applyAsInfluencer);

    // Obtener mi perfil de Momentum
    router.get('/profile', verifyUserToken, momentumController.getMyProfile);

    // Campañas disponibles para mi nivel
    router.get('/campaigns', verifyUserToken, momentumController.getMyCampaigns);

    // Enviar entrega de tarea
    router.post('/submissions', verifyUserToken, momentumController.submitTask);

    // Mis entregas
    router.get('/submissions', verifyUserToken, momentumController.getMySubmissions);

    // Mis saldos (confirmado vs pendiente)
    router.get('/balance', verifyUserToken, momentumController.getMyBalance);

    // ========================================================================
    // RUTAS DE ADMINISTRACIÓN (Requieren autenticación de admin)
    // ========================================================================
    // El admin gestiona todo el ecosistema de Momentum desde aquí.

    // --- Configuración Global ---
    router.get('/admin/config', verifyAdminToken, momentumController.getAdminConfig);
    router.put('/admin/config', verifyAdminToken, momentumController.updateAdminConfig);

    // --- Gestión de Influencers ---
    router.get('/admin/applicants', verifyAdminToken, momentumController.getApplicants);
    router.get('/admin/profiles', verifyAdminToken, momentumController.getAdminProfiles);
    router.get('/admin/profiles/:id', verifyAdminToken, momentumController.getAdminProfileDetail);
    router.put('/admin/profiles/:id/tier', verifyAdminToken, momentumController.assignTier);

    // --- Campañas ---
    router.post('/admin/campaigns', verifyAdminToken, momentumController.createCampaign);
    router.get('/admin/campaigns', verifyAdminToken, momentumController.getAdminCampaigns);
    router.put('/admin/campaigns/:id', verifyAdminToken, momentumController.updateCampaign);
    router.delete('/admin/campaigns/:id', verifyAdminToken, momentumController.deactivateCampaign);

    // --- Verificación de Entregas ---
    router.get('/admin/submissions', verifyAdminToken, momentumController.getAdminSubmissions);
    router.post('/admin/submissions/:id/approve', verifyAdminToken, momentumController.approveSubmission);
    router.post('/admin/submissions/:id/reject', verifyAdminToken, momentumController.rejectSubmission);

    // --- Exportación ---
    router.get('/admin/export-ledger', verifyAdminToken, momentumController.exportLedger);

    return router;
}

module.exports = createMomentumRouter;
