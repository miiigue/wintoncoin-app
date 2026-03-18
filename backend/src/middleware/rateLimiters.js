const rateLimit = require('express-rate-limit');

// Middleware de seguridad para limitar intentos de login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 20, // Bloquear después de 20 intentos
    standardHeaders: true, // Devuelve información del límite en los headers `RateLimit-*`
    legacyHeaders: false, // Deshabilita los headers `X-RateLimit-*`
    message: 'Demasiados intentos de inicio de sesión desde esta IP. Por favor, inténtelo de nuevo en 15 minutos.'
});

// Rate limits específicos para OTP (anti-fraude / anti-bruteforce)
// Nota: estos límites son por IP. Además, controlamos intentos por usuario en DB.
const registerRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // solicitudes de OTP (por IP)
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiadas solicitudes de registro desde esta IP. Por favor, inténtalo más tarde.'
});

const registerVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30, // intentos de verificación (por IP)
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiados intentos de verificación desde esta IP. Por favor, inténtalo más tarde.'
});

const resendOtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // reenvíos (por IP) + cooldown server-side
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiadas solicitudes de reenvío desde esta IP. Por favor, inténtalo más tarde.'
});

// Rate limiter para recuperación de contraseña (más restrictivo)
const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // máximo 5 solicitudes de recuperación por IP cada 15 minutos
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiados intentos de recuperación de contraseña desde esta IP. Por favor, inténtalo más tarde.'
});

// Rate limiter ultra-restrictivo para Break Glass (anti brute-force de códigos de recuperación)
// 3 intentos por hora por IP — un ataque legítimo de emergencia no requiere más
const breakGlassLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiados intentos de Break Glass desde esta IP. Endpoint bloqueado por 1 hora.'
});

module.exports = {
    loginLimiter,
    registerRequestLimiter,
    registerVerifyLimiter,
    resendOtpLimiter,
    forgotPasswordLimiter,
    breakGlassLimiter
};

