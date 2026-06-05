const jwt = require('jsonwebtoken');

// Middleware de verificación de token de administrador (MODIFICADO PARA COOKIES)
function verifyAdminToken(req, res, next) {
    // Buscamos el token en la cookie firmada 'admin_token'
    const token = req.cookies?.admin_token;

    if (!token) return res.status(401).json({ message: "No autorizado. Token no encontrado." });

    jwt.verify(token, process.env.ADMIN_SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: "Token inválido o expirado." });

        // Normalización de identidad admin para consistencia transversal:
        // algunos controladores validan req.user.role === 'admin'.
        req.user = {
            ...user,
            role: 'admin'
        };

        // Compatibilidad adicional para módulos legacy que usen res.locals.admin.
        res.locals.admin = req.user;
        next();
    });
}

module.exports = {
    verifyAdminToken
};
