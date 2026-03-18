/**
 * Governance Routes — Endpoints del Sistema Winton-Consensus
 *
 * Estructura de seguridad:
 *   /api/governance/bootstrap          → Solo admin (verifyAdminToken)
 *   /api/governance/break-glass        → Sin auth normal (usa códigos de recuperación)
 *   /api/governance/*                  → Guardianes autenticados (verifyUserToken)
 *
 * Patrón: Factory function que recibe dependencias (DI), igual que momentumRoutes.
 */

const express = require('express');
const controller = require('../controllers/governanceController');
const { breakGlassLimiter } = require('../middleware/rateLimiters');

/**
 * @param {Pool} pool - Conexión a PostgreSQL
 * @param {Function} verifyUserToken - Middleware de autenticación de usuario
 * @param {Function} verifyAdminToken - Middleware de autenticación de admin
 * @param {Function} requireActiveGuardian - Middleware de autorización RBAC (guardián activo)
 * @param {Function} logAuditEvent - Función de auditoría
 */
function createGovernanceRouter(pool, verifyUserToken, verifyAdminToken, requireActiveGuardian, logAuditEvent) {
    const router = express.Router();

    router.use((req, res, next) => {
        req._pool = pool;
        req._logAuditEvent = logAuditEvent;
        next();
    });

    const wrap = (fn) => (req, res) => fn(pool, req, res);

    // ─── ADMIN-ONLY ENDPOINTS ───────────────────────────────────────────
    router.post('/bootstrap', verifyAdminToken, wrap(controller.bootstrap));
    router.get('/health', verifyAdminToken, wrap(controller.systemHealth));

    // ─── BREAK GLASS (sin auth normal — usa códigos de recuperación) ────
    router.post('/break-glass', breakGlassLimiter, wrap(controller.breakGlass));

    // ─── SELF-CHECK (solo autenticación, sin autorización de guardián) ──
    // Permite a cualquier usuario autenticado verificar si es guardián.
    router.get('/me', verifyUserToken, wrap(controller.getMyGuardianStatus));

    // ══════════════════════════════════════════════════════════════════════
    // RBAC: Todo lo siguiente requiere ser GUARDIÁN ACTIVO.
    // Doble capa: verifyUserToken (autenticación) + requireActiveGuardian (autorización)
    // ══════════════════════════════════════════════════════════════════════

    // ─── WEBAUTHN ───────────────────────────────────────────────────────
    router.post('/webauthn/register/options', verifyUserToken, requireActiveGuardian, wrap(controller.webauthnRegisterOptions));
    router.post('/webauthn/register/verify', verifyUserToken, requireActiveGuardian, wrap(controller.webauthnRegisterVerify));
    router.post('/webauthn/auth/:requestId/options', verifyUserToken, requireActiveGuardian, wrap(controller.webauthnAuthOptions));

    // ─── GUARDIANES ─────────────────────────────────────────────────────
    router.get('/guardians', verifyUserToken, requireActiveGuardian, wrap(controller.listGuardians));

    // ─── CATÁLOGO DE CONFIGURACIONES ───────────────────────────────────
    router.get('/settings-catalog', verifyUserToken, requireActiveGuardian, wrap(controller.settingsCatalog));

    // ─── SOLICITUDES ────────────────────────────────────────────────────
    router.post('/requests', verifyUserToken, requireActiveGuardian, wrap(controller.createRequest));
    router.get('/requests', verifyUserToken, requireActiveGuardian, wrap(controller.listRequests));
    router.get('/requests/:requestId', verifyUserToken, requireActiveGuardian, wrap(controller.getRequest));

    // ─── VOTACIÓN ───────────────────────────────────────────────────────
    router.post('/requests/:requestId/vote', verifyUserToken, requireActiveGuardian, wrap(controller.submitVote));

    // ─── CANCELACIÓN ────────────────────────────────────────────────────
    router.post('/requests/:requestId/cancel', verifyUserToken, requireActiveGuardian, wrap(controller.cancelRequest));

    return router;
}

module.exports = createGovernanceRouter;
