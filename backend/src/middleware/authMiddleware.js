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
    // 1. Intentamos obtener el token desde las cookies primero (HttpOnly)
    let token = req.cookies ? req.cookies.auth_token : null;

    // 2. Si no hay cookie, buscamos en la cabecera Authorization (Bearer Token)
    if (!token) {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }

    // 3. Si no existe ningún token, denegamos el acceso (401 Unauthorized)
    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token de autenticación.' });
    }

    // 4. Verificación criptográfica del token usando JWT_SECRET
    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
        // [MEJORA DE SEGURIDAD] Si el token expiró o su firma es inválida, respondemos con 401 (Unauthorized).
        // Cambiar de 403 a 401 es un estándar técnico que permite al cliente iniciar un refresco silencioso de sesión.
        if (err) {
            return res.status(401).json({ message: 'Token de sesión inválido o expirado.' });
        }

        // [CONTROL DE TIPO DE TOKEN] Validamos que el token sea de tipo 'access'.
        // Esto previene que un atacante intente usar un Refresh Token para consumir endpoints protegidos de negocio.
        if (user.tokenType !== 'access') {
            return res.status(401).json({ message: 'Tipo de token no autorizado para esta operación.' });
        }

        // 5. Verificar si el token fue emitido antes de un cambio de contraseña (password_invalidate_before)
        try {
            const result = await pool.query(
                'SELECT password_invalidate_before, account_status FROM users WHERE id = $1',
                [user.userId]
            );
            if (!result.rows.length) return res.status(401).json({ message: 'Cuenta no encontrada.' });
            // Pending tutor accounts still need access to the tutor request flow.
            // Economic services separately require active status before signing.
            if (!['active','pending_tutor','pending_tutor_approval'].includes(result.rows[0].account_status)) return res.status(403).json({message:'La cuenta no está habilitada para operar.',code:'ACCOUNT_INACTIVE'});
            if (result.rows[0].password_invalidate_before) {
                const invalidateBefore = new Date(result.rows[0].password_invalidate_before);
                const tokenIssuedAt = new Date((user.iat || 0) * 1000); // JWT iat está en segundos

                // Si el token fue emitido antes de invalidarse por cambio de contraseña, lo rechazamos (401)
                if (tokenIssuedAt < invalidateBefore) {
                    return res.status(401).json({
                        message: 'Tu sesión ha sido invalidada por un cambio de contraseña. Por favor, inicia sesión nuevamente.',
                        code: 'SESSION_INVALIDATED'
                    });
                }
            }
        } catch (dbError) {
            console.error('[AUTH] Error al verificar invalidación de sesión:', dbError);
            return res.status(503).json({ message: 'No se pudo verificar la sesión.' });
        }

        // 6. Inyectamos la información del usuario autenticado en el objeto request y continuamos
        req.user = user;
        next();
    });
};
/**
 * Middleware para autenticar ADMINISTRADORES.
 * Usa ADMIN_SECRET_KEY y cookies 'admin_token'.
 * ESTÁNDAR PROFESIONAL: Separación estricta de roles.
 */
const authenticateAdmin = (req, res, next) => require('./adminSession').verifySession(req, res, next);

/**
 * Middleware de AUTORIZACIÓN para guardianes activos.
 * Debe usarse DESPUÉS de authenticateToken (requiere req.user.userId).
 *
 * Patrón RBAC (Role-Based Access Control): Autenticación ≠ Autorización.
 * authenticateToken verifica QUIÉN eres; este middleware verifica QUÉ PUEDES HACER.
 *
 * Resultado: agrega req.guardian con los datos del guardián al request.
 */
const requireActiveGuardian = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Autenticación requerida.' });
        }

        const result = await pool.query(
            `SELECT g.id, g.user_id, g.role, g.status, u.username
             FROM governance_guardians g
             JOIN users u ON g.user_id = u.id
             WHERE g.user_id = $1`,
            [userId]
        );

        if (result.rowCount === 0 || result.rows[0].status !== 'active') {
            return res.status(403).json({
                error: 'Acceso denegado. Solo guardianes activos del sistema Winton-Consensus pueden acceder a este recurso.',
                code: 'GUARDIAN_REQUIRED',
            });
        }

        req.guardian = result.rows[0];
        next();
    } catch (err) {
        if (err.code === '42P01') {
            return res.status(403).json({
                error: 'El sistema de gobernanza no ha sido inicializado.',
                code: 'GOVERNANCE_NOT_INITIALIZED',
            });
        }
        console.error('[AUTH GUARDIAN]', err);
        return res.status(500).json({ error: 'Error al verificar estado de guardián.' });
    }
};

/**
 * Middleware dual que permite autenticar TANTO a usuarios comunes (auth_token/JWT_SECRET)
 * COMO a administradores (admin_token/ADMIN_SECRET_KEY).
 * Utilizado para endpoints compartidos como la subida de imágenes.
 */
const authenticateUserOrAdmin = (req, res, next) => {
    // 1. Intentamos obtener el token de usuario normal
    let userToken = req.cookies ? req.cookies.auth_token : null;
    if (!userToken) {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            userToken = authHeader.split(' ')[1];
        }
    }

    // 2. Intentamos obtener el token de administrador
    let adminToken = req.cookies ? req.cookies.admin_token : null;
    if (!adminToken) {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            adminToken = authHeader.split(' ')[1];
        }
    }

    // Si no hay ningún tipo de token, denegamos el acceso
    if (!userToken && !adminToken) {
        return res.status(401).json({ message: 'Acceso denegado. Se requiere token de autenticación (usuario o administrador).' });
    }

    // Intentamos verificar primero el token de usuario
    if (userToken) {
        jwt.verify(userToken, process.env.JWT_SECRET, (err, user) => {
            if (!err && user && user.tokenType === 'access') {
                return authenticateToken(req, res, next);
            }
            
            // Si falló el de usuario pero hay token de admin, intentamos con admin
            if (adminToken) {
                return verifyAdminToken(adminToken, req, res, next);
            }
            return res.status(401).json({ message: 'Token de sesión inválido o expirado.' });
        });
    } else {
        // Solo hay token de administrador disponible
        return verifyAdminToken(adminToken, req, res, next);
    }
};

// Función auxiliar para verificar el token administrativo
const verifyAdminToken = (token, req, res, next) => require('./adminSession').verifySession(req, res, next, token);

module.exports = {
    authenticateToken,
    authenticateAdmin,
    requireActiveGuardian,
    authenticateUserOrAdmin,
};
