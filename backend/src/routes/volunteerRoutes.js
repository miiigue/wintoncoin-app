/**
 * RUTAS DE VOLUNTARIADO SOS WINTONCOIN
 * ═════════════════════════════════════════════════════════════════════════════════
 * Ciberseguridad & Auditoría FinTech (SOC 2):
 * - Rate limiting anti-spam en endpoints públicos.
 * - Autenticación requerida para endpoints administrativos.
 * - Cumplimiento Zero-Trust en la gestión de postulaciones y expedientes.
 */

'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const volunteerController = require('../controllers/volunteerController');
const { authenticateAdmin } = require('../middleware/authMiddleware');

// Limitador de tasa anti-spam para registro de voluntario (máx 10 por 15 min por IP)
const volunteerRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Demasiadas solicitudes. Por favor intenta nuevamente en unos minutos."
    }
});

// Limitador de tasa para verificación de código OTP (máx 15 por 15 min por IP)
const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Demasiadas verificaciones intentadas. Espera unos minutos."
    }
});

// ── RUTAS PÚBLICAS ─────────────────────────────────────────────────────────────

/**
 * @route   POST /api/volunteers/register
 * @desc    Registro público de postulación de voluntario con generación de expediente inteligente
 * @access  Público
 */
router.post('/register', volunteerRateLimiter, volunteerController.registerVolunteerPublic);

/**
 * @route   POST /api/volunteers/verify-otp
 * @desc    Verificación OTP de 6 dígitos + definición de contraseña + activación de usuario
 * @access  Público
 */
router.post('/verify-otp', otpVerifyLimiter, volunteerController.verifyVolunteerOtpPublic);

/**
 * @route   POST /api/volunteers/resend-otp
 * @desc    Reenvío de código OTP de 6 dígitos con límite de 60s cooldown y anti-abuso
 * @access  Público
 */
router.post('/resend-otp', otpVerifyLimiter, volunteerController.resendVolunteerOtpPublic);

// ── RUTAS PROTEGIDAS (PANEL ADMINISTRACIÓN) ───────────────────────────────────

/**
 * @route   GET /api/volunteers/admin/list
 * @desc    Consulta y filtrado de expedientes de voluntarios con orden por Score de Prioridad
 * @access  Administrador
 */
router.get('/admin/list', authenticateAdmin, volunteerController.getVolunteersAdmin);

/**
 * @route   PUT /api/volunteers/admin/:id/status
 * @desc    Actualización de estatus del voluntario (aprobación/activación/suspensión)
 * @access  Administrador
 */
router.put('/admin/:id/status', authenticateAdmin, volunteerController.updateVolunteerStatusAdmin);

module.exports = router;
