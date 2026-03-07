// ============================================================================
// RUTAS: Gestión Administrativa de Causas Humanitarias (Winton Solidario)
// ============================================================================
// Patrón: Mismo estilo que academyRoutes.js
// Seguridad: Todas las rutas protegidas con authenticateAdmin
// Prefijo: /api/admin/humanitarian (registrado en server.js)
// ============================================================================

const express = require('express');
const router = express.Router();
const humanitarianController = require('../controllers/humanitarianController');
const { authenticateAdmin } = require('../middleware/authMiddleware');

// ============================================================================
// TODAS LAS RUTAS REQUIEREN AUTENTICACIÓN DE ADMINISTRADOR
// El middleware verifica el admin_token (cookie JWT firmado con ADMIN_SECRET_KEY)
// ============================================================================
router.use(authenticateAdmin);

// --- Listar causas con filtros (status, search, paginación) ---
// GET /api/admin/humanitarian/causes?status=pending&search=maria&limit=50&offset=0
router.get('/causes', humanitarianController.listCauses);

// --- Detalle completo de una causa ---
// GET /api/admin/humanitarian/causes/42
router.get('/causes/:id', humanitarianController.getCauseDetail);

// --- Aprobar una causa (cambia status a 'approved', notifica al usuario) ---
// PATCH /api/admin/humanitarian/causes/42/approve
router.patch('/causes/:id/approve', humanitarianController.approveCause);

// --- Rechazar una causa (requiere razón obligatoria, notifica al usuario) ---
// PATCH /api/admin/humanitarian/causes/42/reject
router.patch('/causes/:id/reject', humanitarianController.rejectCause);

// --- Contar pendientes (para el badge del sidebar) ---
// GET /api/admin/humanitarian/pending-count
router.get('/pending-count', humanitarianController.getPendingCount);

module.exports = router;
