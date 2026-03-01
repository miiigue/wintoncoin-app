const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * Middleware para autenticar USUARIOS.
 * Usa JWT_SECRET y cookies 'auth_token'.
 * 
 * [SEGURIDAD] Valida que el token no haya sido emitido antes de un
 * cambio de contraseña (password_invalidate_before). Esto invalida
 * automáticamente todas las sesiones anteriores al momento del reset,
 * sin necesidad de una tabla de blocklist de tokens.
 */
const authenticateToken = (req, res, next) => {
    let token = req.cookies ? req.cookies.auth_token : null;

    if (!token) {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token de autenticación.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token de sesión inválido o expirado.' });
        }

        // [MEJORA 2] Verificar si el token fue emitido antes de un cambio de contraseña
        try {
            const result = await pool.query(
                'SELECT password_invalidate_before FROM users WHERE id = $1',
                [user.userId]
            );
            if (result.rows.length > 0 && result.rows[0].password_invalidate_before) {
                const invalidateBefore = new Date(result.rows[0].password_invalidate_before);
                const tokenIssuedAt = new Date((user.iat || 0) * 1000); // JWT iat is in seconds

                if (tokenIssuedAt < invalidateBefore) {
                    return res.status(403).json({
                        message: 'Tu sesión ha sido invalidada por un cambio de contraseña. Por favor, inicia sesión nuevamente.',
                        code: 'SESSION_INVALIDATED'
                    });
                }
            }
        } catch (dbError) {
            console.error('[AUTH] Error al verificar invalidación de sesión:', dbError);
            // En caso de error de DB, dejamos pasar para no bloquear toda la app
        }

        req.user = user;
        next();
    });
};
/**
 * Middleware para autenticar ADMINISTRADORES.
 * Usa ADMIN_SECRET_KEY y cookies 'admin_token'.
 * ESTÁNDAR PROFESIONAL: Separación estricta de roles.
 */
const authenticateAdmin = (req, res, next) => {
    const token = req.cookies && req.cookies.admin_token ? req.cookies.admin_token : null;

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. Se requiere autenticación de administrador.' });
    }

    jwt.verify(token, process.env.ADMIN_SECRET_KEY, (err, user) => {
        if (err) {
            console.error('[AUTH ADMIN] Token inválido:', err.message);
            return res.status(403).json({ message: 'Token de administrador inválido o expirado.' });
        }

        req.user = { ...user, role: 'admin' };
        next();
    });
};

module.exports = {
    authenticateToken,
    authenticateAdmin
};
