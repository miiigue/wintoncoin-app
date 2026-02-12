const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const legalController = require('../controllers/legalController');
const { authenticateToken } = require('../middleware/authMiddleware');
const {
    loginLimiter,
    registerRequestLimiter,
    registerVerifyLimiter,
    resendOtpLimiter,
    forgotPasswordLimiter
} = require('../middleware/rateLimiters');

// --- Registration Routes (Email OTP / Fintech) ---
router.post('/register-request', registerRequestLimiter, authController.registerRequest);

// NUEVO FLUJO DE REGISTRO CON OTP POR EMAIL (FASE 2: VERIFICACIÓN)
router.post('/register-verify', registerVerifyLimiter, authController.registerVerify);

// Ruta de Inicio de Sesión (acepta username o email)
router.post('/login', loginLimiter, authController.login);

// NUEVO: Endpoint para verificar el estado de autenticación y verificación del usuario
router.get('/auth/status', authController.getAuthStatus);

// NUEVO: Endpoint para reenviar el código de verificación
router.post('/auth/resend-code', resendOtpLimiter, authController.resendCode);

// --- Recuperación de Contraseña ---
router.post('/forgot-password/request', forgotPasswordLimiter, authController.forgotPasswordRequest);
router.post('/forgot-password/verify', forgotPasswordLimiter, authController.forgotPasswordVerify);

// Endpoint to check if a user has a pending verification (Recovery Logic)
router.post('/auth/pending-status', authController.checkPendingStatus);

// --- Legal / Términos y Condiciones ---
router.get('/legal/documents/active', legalController.getActiveDocuments);
router.get('/legal/status', authenticateToken, legalController.getMyLegalStatus);
router.post('/legal/accept', authenticateToken, legalController.acceptActiveDocuments);

module.exports = router;
