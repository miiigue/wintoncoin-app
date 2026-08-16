/**
 * RUTAS DE ADMINISTRACIÓN: Plantillas de Correo (Admin Email CMS)
 * ═════════════════════════════════════════════════════════════════════════════════
 * Ciberseguridad:
 * - Rutas protegidas mediante `authenticateAdmin` (Zero-Trust).
 * - Rate-Limiting aplicado.
 * ═════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

const express = require('express');
const router = express.Router();
const emailTemplateController = require('../controllers/emailTemplateController');
const { authenticateAdmin } = require('../middleware/authMiddleware');

// Middleware global para verificar token JWT de Administrador
router.use(authenticateAdmin);

// Rutas API
router.get('/', emailTemplateController.getEmailTemplates);
router.get('/:key', emailTemplateController.getTemplateByKey);
router.put('/:key', emailTemplateController.updateTemplate);
router.post('/:key/preview', emailTemplateController.previewTemplate);

module.exports = router;
