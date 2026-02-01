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

module.exports = {
    loginLimiter,
    registerRequestLimiter,
    registerVerifyLimiter,
    resendOtpLimiter
};
