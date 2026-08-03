/**
 * backend/src/routes/minorRoutes.js
 * 
 * PROPÓSITO: Definición de rutas protegidas para la gestión de cuentas de menores de edad y tutores legales.
 * Exige autenticación Bearer (verifyUserToken) en todas las rutas para eliminar fallas de Broken Access Control (OWASP Top 10).
 * 
 * ESTÁNDAR DE INGENIERÍA: Restricciones por Rol, Auditoría Cero Confianza y Maker-Checker FinTech.
 */

'use strict';

const express = require('express');
const router = express.Router();
const minorController = require('../controllers/minorController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Alias para verifyUserToken para consistencia en la suite de middleware
const verifyUserToken = authenticateToken;

// ============================================================================
// RUTAS LEGALES Y DE CONTROL PARENTAL PARA MENORES
// ============================================================================

// 1. POST /api/minor/request-tutor -> El menor autenticado solicita tutela a un tutor propuesto
router.post('/request-tutor', verifyUserToken, minorController.requestTutor);

// 2. GET /api/minor/tutor-requests/pending -> El tutor autenticado consulta las solicitudes recibidas
router.get('/tutor-requests/pending', verifyUserToken, minorController.getPendingTutorRequests);

// 3. POST /api/minor/tutor-requests/:requestId/respond -> El tutor responde (aprueba o rechaza) una solicitud de tutela
router.post('/tutor-requests/:requestId/respond', verifyUserToken, minorController.respondTutorRequest);

// 4. GET /api/minor/children -> El tutor consulta la lista de menores a su cargo y sus estados
router.get('/children', verifyUserToken, minorController.getChildControls);

// 5. PUT /api/minor/children/:childId/controls -> El tutor actualiza congelamiento (pausa) o permisos JSONB del menor
router.put('/children/:childId/controls', verifyUserToken, minorController.updateChildControls);

module.exports = router;
