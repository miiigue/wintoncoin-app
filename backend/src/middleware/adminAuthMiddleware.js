/**
 * backend/src/middleware/adminAuthMiddleware.js
 * 
 * PROPÓSITO: Middleware de autenticación y seguridad para el Panel de Administración.
 * Verifica la validez del token JWT guardado en cookies firmadas (admin_token)
 * e implementa la validación defensiva del encabezado Origin/Referer contra ataques CSRF (Cross-Site Request Forgery).
 * 
 * ESTÁNDAR DE INGENIERÍA: Defensas OWASP Top 10, Zero-Trust y Sanitización de Encabezados HTTP.
 */

'use strict';

const jwt = require('jsonwebtoken');

// Middleware de verificación de token de administrador con protección anti-CSRF defensiva
function verifyAdminToken(req, res, next) {
    // 1. Extraer el token de la cookie autenticada 'admin_token'
    const token = req.cookies?.admin_token;

    if (!token) {
        return res.status(401).json({ message: "No autorizado. Token de administración no encontrado." });
    }

    // 2. Proteccion defensiva anti-CSRF para métodos de mutación (POST, PUT, DELETE, PATCH)
    const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    if (mutatingMethods.includes(req.method.toUpperCase())) {
        const origin = req.headers['origin'] || req.headers['referer'];
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            process.env.ADMIN_FRONTEND_URL,
            'http://localhost:5173',
            'http://localhost:3000',
            'https://wintoncoin.com',
            'https://admin.wintoncoin.com',
            'https://demo.wintoncoin.com'
        ].filter(Boolean);

        // Si existe un encabezado Origin/Referer enviado por el navegador, debe coincidir con los orígenes autorizados
        if (origin) {
            const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed));
            if (!isAllowed) {
                console.warn(`[SECURITY WARN] Posible ataque CSRF bloqueado. Origen no autorizado: ${origin}`);
                return res.status(403).json({ message: "Acceso denegado: Violación de política de origen seguro (CSRF Protection)." });
            }
        }
    }

    // 3. Verificar la firma del JWT con la clave secreta administrativa
    const secretKey = process.env.ADMIN_SECRET_KEY || process.env.JWT_SECRET;
    jwt.verify(token, secretKey, (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Token de administración inválido o expirado." });
        }

        // Normalización de identidad admin para consistencia transversal:
        req.user = {
            ...user,
            role: 'admin'
        };

        // Compatibilidad para módulos legacy que usen res.locals.admin
        res.locals.admin = req.user;
        next();
    });
}

module.exports = {
    verifyAdminToken
};
