const jwt = require('jsonwebtoken');

/**
 * Middleware para autenticar USUARIOS.
 * Usa JWT_SECRET y cookies 'auth_token'.
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

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token de sesión inválido o expirado.' });
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
    const token = req.cookies ? req.cookies.admin_token : null;

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. Se requiere autenticación de administrador.' });
    }

    try {
        const adminUser = jwt.verify(token, process.env.ADMIN_SECRET_KEY);
        req.user = { ...adminUser, role: 'admin' };
        next();
    } catch (err) {
        console.error('[AUTH ADMIN] Token inválido:', err.message);
        return res.status(403).json({ message: 'Token de administrador inválido o expirado.' });
    }
};

module.exports = {
    authenticateToken,
    authenticateAdmin
};
