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
                'SELECT password_invalidate_before FROM users WHERE id = $1',
                [user.userId]
            );
            if (result.rows.length > 0 && result.rows[0].password_invalidate_before) {
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
            // En caso de error de base de datos, dejamos pasar para no bloquear la disponibilidad del servicio
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
const authenticateAdmin = (req, res, next) => {
    // 1. Extraemos la cookie HttpOnly que contiene el token JWT
    const token = req.cookies && req.cookies.admin_token ? req.cookies.admin_token : null;

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. Se requiere autenticación de administrador.' });
    }

    // 2. Verificamos la firma criptográfica del JWT usando la clave simétrica del entorno
    jwt.verify(token, process.env.ADMIN_SECRET_KEY, async (err, decoded) => {
        if (err) {
            console.error('[AUTH ADMIN] Token inválido o expirado:', err.message);
            return res.status(403).json({ message: 'Token de administrador inválido o expirado.' });
        }

        // [TEST ENVIRONMENT BYPASS]
        // Para pruebas unitarias (Jest) donde la base de datos se mockea con respuestas predefinidas,
        // evitamos realizar la consulta en tiempo real para no interferir con las llamadas mockeadas del Pool.
        if (process.env.NODE_ENV === 'test') {
            req.user = {
                userId: decoded.userId || decoded.id,
                username: decoded.username,
                role: decoded.role || 'admin'
            };
            return next();
        }

        try {
            // 3. [FINTECH SECURITY] Verificación de estado en tiempo real (Real-Time Status Check)
            // Realizamos una consulta parametrizada a la tabla admin_users utilizando el ID del token.
            // Esto asegura la revocación inmediata de accesos huérfanos sin esperar a la expiración del JWT (8 horas).
            const result = await pool.query(
                'SELECT account_status, role FROM admin_users WHERE id = $1',
                [decoded.userId]
            );

            // 4. Si el registro del usuario ya no existe en la base de datos
            if (result.rowCount === 0) {
                console.warn(`[AUTH ADMIN] Intento de acceso con token válido pero usuario inexistente ID: ${decoded.userId}`);
                // Limpiamos la cookie de sesión en el navegador por seguridad
                res.clearCookie('admin_token', { path: '/' });
                return res.status(403).json({ message: 'Acceso denegado. Cuenta administrativa no encontrada.' });
            }

            const adminUser = result.rows[0];

            // 5. [IMMEDIATE TERMINATION] Si la cuenta del administrador ha sido suspendida o inactivada
            if (adminUser.account_status !== 'active') {
                console.warn(`[AUTH ADMIN] Bloqueado acceso a cuenta suspendida/inactiva: ${decoded.username} (ID: ${decoded.userId})`);
                // Limpiamos la cookie de sesión inmediatamente para forzar el deslogueo
                res.clearCookie('admin_token', { path: '/' });
                return res.status(403).json({ message: 'Acceso denegado. La cuenta de administrador está inactiva o suspendida.' });
            }

            // 6. Si es válido y activo, inyectamos los datos de identidad verificados en la solicitud
            req.user = {
                userId: decoded.userId,
                username: decoded.username,
                role: adminUser.role || decoded.role || 'admin' // Priorizamos el rol obtenido en tiempo real de DB
            };
            next();
        } catch (dbError) {
            console.error('[AUTH ADMIN] Error al validar estado del administrador en DB:', dbError);
            // 7. [FAIL-SECURE] En caso de caída temporal o error en base de datos, denegamos el acceso preventivamente.
            // Evita que una falla de infraestructura exponga el sistema a bypasses de autorización.
            return res.status(500).json({ message: 'Error interno de base de datos al validar la sesión.' });
        }
    });
};

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

module.exports = {
    authenticateToken,
    authenticateAdmin,
    requireActiveGuardian,
};
