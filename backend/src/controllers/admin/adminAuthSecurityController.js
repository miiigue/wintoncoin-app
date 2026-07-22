/**
 * Submódulo de Administración — Autenticación y Ciberseguridad del Equipo Administrativo
 * ════════════════════════════════════════════════════════════════════════════════════════
 * Gestiona el inicio/cierre de sesión, gestión de invitaciones, roles (superadmin, admin, auditor),
 * cambio escalonado de contraseña con OTP por correo y suspensión de administradores.
 *
 * Estándar de Ciberseguridad:
 *   - Zero Hardcoded Secrets & Zero-Trust Architecture
 *   - SOC 2 Type II / ISO 27001 Bank-Grade Audit Standards
 *   - Protección anti Bcrypt CPU Exhaustion (límite de 72 caracteres)
 *   - Prevención de Enumeración de Usuarios mediante timing-safe dummy compare
 * ════════════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

// 1. Importación de dependencias de infraestructura y servicios
const pool = require('../../config/db'); // Conexión centralizada a la base de datos PostgreSQL
const jwt = require('jsonwebtoken'); // Emisión y firma de JsonWebTokens seguros
const bcrypt = require('bcrypt'); // Algoritmo de hashing seguro para contraseñas
const crypto = require('crypto'); // Módulo criptográfico nativo de Node.js
const { logAuditEvent } = require('../../services/auditService'); // Registro inmutable de eventos de auditoría
const {
    sendTransactionEmail,
    sendAnnouncementEmail,
    generateOtp6,
    hashOtpForEmail,
    safeEqualHex,
    sendOtpEmail
} = require('../../services/emailService'); // Servicio de envíos de correos transaccionales y OTP

/**
 * Login de administrador.
 * Valida el usuario y contraseña contra admin_users (bcrypt).
 * Inyecta una cookie HttpOnly (admin_token) para prevenir secuestro por XSS.
 */
async function login(req, res) {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Se requiere usuario y contraseña." });
    }

    // [DoS PROTECTION] Limitar tamaño de la contraseña para evitar CPU Exhaustion en Bcrypt
    if (password.length > 72) {
        return res.status(400).json({ message: "La contraseña excede el límite máximo permitido de 72 caracteres." });
    }

    try {
        // 1. Buscar el administrador en la base de datos (con query parametrizado)
        const adminResult = await pool.query(
            'SELECT id, username, password_hash, role, account_status FROM admin_users WHERE username = $1',
            [username]
        );

        let user = null;
        let dbHash = '';

        if (adminResult.rowCount > 0) {
            user = adminResult.rows[0];
            if (user.account_status !== 'active') {
                return res.status(403).json({ message: "La cuenta de administrador está inactiva o suspendida." });
            }
            dbHash = user.password_hash;
        } else {
            // Mitigación de Timing Attacks (Enumeración de usuarios):
            // Si el administrador no existe, ejecutamos bcrypt.compare contra un hash ficticio pre-calculado
            // para que el tiempo de respuesta sea el mismo que si el usuario existiera.
            dbHash = '$2b$10$fG6a7C4t0NlzC.xQG9dZteBypZ4q63T0bXj7vG.6X6l2kZ0gZ9m2u';
        }

        // 2. Comparación segura contra fuerza bruta (bcrypt)
        const isMatch = await bcrypt.compare(password, dbHash);

        if (!user || !isMatch) {
            return res.status(401).json({ message: "Usuario o contraseña incorrecta." });
        }

        // 3. Generar token JWT con la identidad y el rol real recuperado de la base de datos
        // [Zero-Trust] Incluimos los últimos 10 caracteres del hash como versión de la contraseña (pwdVersion)
        // para invalidar inmediatamente el token si la clave cambia.
        const accessToken = jwt.sign(
            { 
                userId: user.id, 
                username: user.username, 
                role: user.role,
                pwdVersion: dbHash.slice(-10)
            },
            process.env.ADMIN_SECRET_KEY,
            { expiresIn: '8h' }
        );

        // 4. Inyectar cookie HttpOnly (grado bancario: previene robo por XSS)
        res.cookie('admin_token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            maxAge: 8 * 60 * 60 * 1000,
            path: '/'
        });

        // 5. Registrar evento de auditoría
        await logAuditEvent(pool, req, {
            eventType: 'admin.auth.login',
            actorUsername: user.username,
            category: 'admin',
            metadata: { ip: req.ip, user_agent: req.headers['user-agent'] }
        });

        // 6. Actualizar fecha de último inicio de sesión
        await pool.query(
            'UPDATE admin_users SET last_login = NOW() WHERE id = $1',
            [user.id]
        );

        return res.json({ message: "Login exitoso", username: user.username });
    } catch (error) {
        console.error('[AdminAuthSecurityController] Error en login de administrador:', error);
        return res.status(500).json({ message: "Error interno del servidor." });
    }
}

/**
 * Logout de administrador.
 * Destruye la cookie admin_token en el cliente.
 */
function logout(req, res) {
    res.clearCookie('admin_token', { path: '/' });
    res.json({ message: "Logout exitoso" });
}

/**
 * Obtiene el perfil de la cuenta de administrador autenticada actualmente.
 */
async function getAdminProfile(req, res) {
    if (!req.user || !req.user.username) {
        return res.status(401).json({ message: "Sesión administrativa no válida o no autenticada." });
    }

    try {
        const result = await pool.query(
            'SELECT id, username, role, email FROM admin_users WHERE username = $1',
            [req.user.username]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Perfil administrativo no encontrado en el sistema." });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("[AdminAuthSecurityController] Error al obtener perfil de admin:", err);
        res.status(500).json({ message: "Error interno del servidor al recuperar el perfil." });
    }
}

/**
 * Paso 1: Solicitar cambio de contraseña (Step-Up Auth).
 * Valida la clave actual y envía un OTP de 6 dígitos al correo del administrador.
 */
async function requestPasswordChange(req, res) {
    const { currentPassword } = req.body;
    
    if (!currentPassword) {
        return res.status(400).json({ message: "Se requiere la contraseña actual." });
    }
    if (currentPassword.length > 72) {
        return res.status(400).json({ message: "La contraseña no puede exceder los 72 caracteres por razones de seguridad." });
    }
    if (!req.user || !req.user.username) {
        return res.status(401).json({ message: "Sesión administrativa no válida o no autenticada." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const adminResult = await client.query(
            'SELECT id, email, password_hash, account_status FROM admin_users WHERE username = $1 FOR UPDATE',
            [req.user.username]
        );

        if (adminResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Administrador no encontrado en el sistema." });
        }
        const admin = adminResult.rows[0];

        if (admin.account_status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: "La cuenta de administrador no se encuentra activa." });
        }
        
        if (!admin.email) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Tu cuenta no tiene un email registrado para recibir el código OTP. Contacta a un superadmin." });
        }

        const isMatch = await bcrypt.compare(currentPassword, admin.password_hash);
        if (!isMatch) {
            await client.query('ROLLBACK');
            return res.status(401).json({ message: "La contraseña actual introducida es incorrecta." });
        }

        const otp = generateOtp6();
        const otpHash = hashOtpForEmail(admin.email, otp);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await client.query(
            'UPDATE admin_users SET password_change_hash = $1, password_change_expires_at = $2, password_change_attempts = 0 WHERE id = $3',
            [otpHash, expiresAt, admin.id]
        );

        await client.query('COMMIT');

        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
        
        sendOtpEmail({
            toEmail: admin.email,
            otp,
            context: { ip, requestedAt: new Date().toISOString() }
        }).catch(err => console.error('[ADMIN OTP ERROR]', err));

        try {
            const superadmins = await pool.query("SELECT email FROM admin_users WHERE LOWER(role) = 'superadmin' AND username != $1 AND email IS NOT NULL", [req.user.username]);
            for (let row of superadmins.rows) {
                sendTransactionEmail({
                    toEmail: row.email,
                    subject: '⚠️ Alerta de Seguridad: Solicitud de Cambio de Contraseña',
                    title: 'Alerta de Seguridad',
                    message: `El administrador @${req.user.username} ha iniciado una solicitud de cambio de contraseña desde la IP ${ip}. Si esta acción no fue autorizada, suspenda la cuenta inmediatamente.`,
                    amount: '-',
                    details: [{ label: 'Usuario', value: req.user.username }, { label: 'IP', value: ip }]
                }).catch(e => console.error(e));
            }
        } catch (e) {
            console.error('[ADMIN SUPERADMIN ALERT ERROR]', e);
        }

        return res.json({ message: "Se ha enviado un código de verificación (OTP) a tu correo registrado." });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[AdminAuthSecurityController] Error al solicitar cambio de contraseña:', error);
        return res.status(500).json({ message: "Error interno del servidor al procesar la solicitud." });
    } finally {
        client.release();
    }
}

/**
 * Paso 2: Confirmar cambio de contraseña.
 * Valida el OTP entregado, aplica la nueva contraseña e invalida el JWT.
 */
async function confirmPasswordChange(req, res) {
    const { code, newPassword } = req.body;
    
    if (!code || !newPassword) {
        return res.status(400).json({ message: "El código OTP y la nueva contraseña son requeridos." });
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return res.status(400).json({ message: "La nueva contraseña debe tener al menos 8 caracteres, incluyendo letras y números." });
    }
    if (newPassword.length > 72) {
        return res.status(400).json({ message: "La contraseña no puede exceder los 72 caracteres por razones de seguridad." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const adminResult = await client.query(
            'SELECT id, username, email, password_change_hash, password_change_expires_at, password_change_attempts FROM admin_users WHERE username = $1 FOR UPDATE',
            [req.user.username]
        );
        const admin = adminResult.rows[0];

        if (!admin.password_change_hash || !admin.password_change_expires_at) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Código de verificación inválido o expirado." });
        }

        if (admin.password_change_attempts >= 3) {
            await client.query('UPDATE admin_users SET password_change_hash = NULL WHERE id = $1', [admin.id]);
            await client.query('COMMIT');
            return res.status(400).json({ message: "Demasiados intentos fallidos. El código ha sido invalidado. Solicita uno nuevo." });
        }

        if (new Date() > new Date(admin.password_change_expires_at)) {
            await client.query('UPDATE admin_users SET password_change_hash = NULL WHERE id = $1', [admin.id]);
            await client.query('COMMIT');
            return res.status(400).json({ message: "El código de verificación ha expirado. Solicita uno nuevo." });
        }

        const expectedHash = hashOtpForEmail(admin.email, String(code).trim());
        const isValid = safeEqualHex(admin.password_change_hash, expectedHash);

        if (!isValid) {
            const newAttempts = admin.password_change_attempts + 1;
            if (newAttempts >= 3) {
                await client.query('UPDATE admin_users SET password_change_hash = NULL, password_change_attempts = 0 WHERE id = $1', [admin.id]);
                await client.query('COMMIT');
                return res.status(400).json({ message: "Código incorrecto. Se ha excedido el número máximo de intentos. Solicita un nuevo código." });
            } else {
                await client.query('UPDATE admin_users SET password_change_attempts = $1 WHERE id = $2', [newAttempts, admin.id]);
                await client.query('COMMIT');
                return res.status(400).json({ message: `Código incorrecto. Te quedan ${3 - newAttempts} intentos.` });
            }
        }

        const saltRounds = 10;
        const newHash = await bcrypt.hash(newPassword, saltRounds);

        await client.query(
            'UPDATE admin_users SET password_hash = $1, password_change_hash = NULL, password_change_expires_at = NULL, password_change_attempts = 0 WHERE id = $2',
            [newHash, admin.id]
        );

        await logAuditEvent(client, req, {
            eventType: 'admin.password.changed',
            actorUsername: req.user.username,
            targetUsername: req.user.username,
            category: 'admin',
            metadata: { ip: req.ip, user_agent: req.headers['user-agent'] }
        });

        await client.query('COMMIT');
        res.clearCookie('admin_token', { path: '/' });

        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
        
        sendTransactionEmail({
            toEmail: admin.email,
            subject: '✅ Tu contraseña administrativa ha sido actualizada',
            title: 'Contraseña Actualizada',
            message: 'Tu contraseña de administrador en WintonCoin ha sido cambiada exitosamente.',
            amount: '-',
            details: [{ label: 'IP', value: ip }, { label: 'Usuario', value: req.user.username }]
        }).catch(e => console.error(e));

        try {
            const superadmins = await pool.query("SELECT email FROM admin_users WHERE LOWER(role) = 'superadmin' AND username != $1 AND email IS NOT NULL", [req.user.username]);
            for (let row of superadmins.rows) {
                sendTransactionEmail({
                    toEmail: row.email,
                    subject: '✅ Registro de Auditoría: Cambio de Credencial Completado',
                    title: 'Auditoría de Seguridad',
                    message: `El administrador @${req.user.username} ha completado exitosamente su cambio de contraseña.`,
                    amount: '-',
                    details: [{ label: 'Usuario', value: req.user.username }, { label: 'IP', value: ip }]
                }).catch(e => console.error(e));
            }
        } catch (e) {
            console.error(e);
        }

        return res.json({ message: "Contraseña cambiada exitosamente. Tu sesión ha sido cerrada por seguridad." });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[AdminAuthSecurityController] Error al confirmar cambio de contraseña:', error);
        return res.status(500).json({ message: "Error interno del servidor." });
    } finally {
        client.release();
    }
}

/**
 * Crea una nueva invitación de administrador.
 * Genera un token aleatorio de alta entropía (SHA-256) y envía un correo transaccional.
 */
async function createInvitation(req, res) {
    if (req.user?.role !== 'superadmin') {
        return res.status(403).json({ message: "Requiere privilegios de Super Administrador para crear invitaciones." });
    }

    const { email, role } = req.body;
    if (!email || !role) {
        return res.status(400).json({ message: "Se requiere email y rol." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Formato de correo electrónico inválido." });
    }

    const allowedRoles = ['admin', 'auditor', 'superadmin'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: "Rol inválido especificado." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const adminCheck = await client.query(
            "SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1)",
            [email]
        );

        if (adminCheck.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: "Este correo electrónico ya está registrado como administrador en el sistema." });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await client.query(
            `INSERT INTO admin_invitations (email, token_hash, role, created_by, expires_at, used_at)
             VALUES ($1, $2, $3, $4, $5, NULL)
             ON CONFLICT (email)
             DO UPDATE SET 
                token_hash = EXCLUDED.token_hash,
                role = EXCLUDED.role,
                created_by = EXCLUDED.created_by,
                expires_at = EXCLUDED.expires_at,
                used_at = NULL,
                created_at = NOW()`,
            [email.toLowerCase().trim(), tokenHash, role, req.user.username, expiresAt]
        );

        const isProd = process.env.NODE_ENV === 'production';
        const isDemo = process.env.IS_DEMO_ENV === 'true' || process.env.DATABASE_URL?.includes('wintoncoin_demo');

        let domain = process.env.FRONTEND_URL;
        if (!domain) {
            if (isDemo) {
                domain = 'https://demo.wintoncoin.com';
            } else if (isProd) {
                domain = 'https://sc.wintoncoin.com';
            } else {
                domain = 'http://localhost:5173';
            }
        }
        const claimUrl = `${domain}/admin-register.html?token=${token}`;

        const subject = "Invitación al panel de administración de WintonCoin";
        const title = "Invitación de Administrador";
        const bodyHtml = `
            Hola,<br><br>
            Has sido invitado a unirte al equipo de administración de WintonCoin con el rol de <strong>${role}</strong>.<br><br>
            Para reclamar tu cuenta y configurar tu contraseña de acceso privada, haz clic en el botón de abajo o accede al siguiente enlace:<br><br>
            <a href="${claimUrl}" style="color:#0052FF; text-decoration:underline;">${claimUrl}</a><br><br>
            Por razones de seguridad, esta invitación expirará en 24 horas.
        `;

        await sendAnnouncementEmail({
            toEmail: email,
            subject,
            title,
            bodyHtml,
            buttonText: "Configurar Cuenta",
            buttonUrl: claimUrl
        });

        await logAuditEvent(client, req, {
            eventType: 'admin.invitation.created',
            actorUsername: req.user.username,
            targetUsername: email,
            category: 'admin',
            metadata: { target_email: email, assigned_role: role }
        });

        await client.query('COMMIT');

        if (!isProd) {
            console.log(`\n--- [DESARROLLO] INVITACIÓN GENERADA ---`);
            console.log(`Email: ${email}`);
            console.log(`Rol: ${role}`);
            console.log(`Token Plano: ${token}`);
            console.log(`URL de Registro: ${claimUrl}`);
            console.log(`----------------------------------------\n`);
        }

        res.status(201).json({
            message: "Invitación creada y enviada con éxito.",
            email,
            role,
            token: !isProd ? token : undefined
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error al crear invitación administrativa:", err);
        res.status(500).json({ message: "Error interno al procesar la invitación." });
    } finally {
        client.release();
    }
}

/**
 * Obtiene el listado de invitaciones administrativas.
 */
async function getInvitations(req, res) {
    try {
        const result = await pool.query(
            `SELECT id, email, role, created_by, created_at, expires_at, used_at,
                    (expires_at < NOW() AND used_at IS NULL) as is_expired
             FROM admin_invitations
             ORDER BY created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener invitaciones administrativas:", err);
        res.status(500).json({ message: "Error al cargar la lista de invitaciones." });
    }
}

/**
 * Verifica la validez de un token de invitación.
 */
async function verifyInvitation(req, res) {
    const { token } = req.params;
    if (!token) {
        return res.status(400).json({ message: "Token requerido." });
    }

    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const result = await pool.query(
            `SELECT email, role, expires_at, used_at
             FROM admin_invitations
             WHERE token_hash = $1`,
            [tokenHash]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Invitación no encontrada." });
        }

        const invite = result.rows[0];

        if (invite.used_at) {
            return res.status(400).json({ message: "Esta invitación ya ha sido utilizada." });
        }

        if (new Date(invite.expires_at) < new Date()) {
            return res.status(400).json({ message: "Esta invitación ha expirado." });
        }

        res.json({
            email: invite.email,
            role: invite.role
        });

    } catch (err) {
        console.error("Error al verificar invitación:", err);
        res.status(500).json({ message: "Error interno al verificar la invitación." });
    }
}

/**
 * Reclama una invitación configurando el nombre de usuario y la contraseña del administrador.
 */
async function claimInvitation(req, res) {
    const { token, username, password } = req.body;
    if (!token || !username || !password) {
        return res.status(400).json({ message: "Token, usuario y contraseña son requeridos." });
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username)) {
        return res.status(400).json({ message: "El nombre de usuario debe tener entre 3 y 30 caracteres y solo contener letras, números y guiones bajos." });
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return res.status(400).json({ message: "La contraseña debe tener al menos 8 caracteres, incluyendo letras y números." });
    }

    if (password.length > 72) {
        return res.status(400).json({ message: "La contraseña no puede exceder los 72 caracteres por razones de seguridad." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const inviteResult = await client.query(
            `SELECT id, email, role, expires_at, used_at FROM admin_invitations 
             WHERE token_hash = $1 FOR UPDATE`,
            [tokenHash]
        );

        if (inviteResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Invitación no encontrada." });
        }

        const invite = inviteResult.rows[0];

        if (invite.used_at) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Esta invitación ya ha sido utilizada." });
        }

        if (new Date(invite.expires_at) < new Date()) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Esta invitación ha expirado." });
        }

        const userCheck = await client.query(
            'SELECT id FROM admin_users WHERE LOWER(username) = LOWER($1)',
            [username]
        );

        if (userCheck.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: "El nombre de usuario administrativo ya está en uso." });
        }

        const emailCheck = await client.query(
            'SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1)',
            [invite.email]
        );

        if (emailCheck.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: "El correo electrónico asociado a esta invitación ya está registrado en otra cuenta administrativa activa." });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        await client.query(
            `INSERT INTO admin_users (username, password_hash, role, email, account_status)
             VALUES ($1, $2, $3, $4, 'active')`,
            [username, passwordHash, invite.role, invite.email]
        );

        await client.query(
            `UPDATE admin_invitations SET used_at = NOW() WHERE id = $1`,
            [invite.id]
        );

        await logAuditEvent(client, req, {
            eventType: 'admin.invitation.claimed',
            actorUsername: username,
            targetUsername: username,
            category: 'admin',
            metadata: { email: invite.email, assigned_role: invite.role }
        });

        await client.query('COMMIT');
        res.json({ message: "Cuenta de administrador creada exitosamente. Ya puedes iniciar sesión." });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error al reclamar invitación administrativa:", err);
        res.status(500).json({ message: "Error interno al crear la cuenta." });
    } finally {
        client.release();
    }
}

/**
 * Revoca (elimina) una invitación de administrador pendiente de forma segura.
 */
async function deleteInvitation(req, res) {
    if (req.user?.role !== 'superadmin') {
        return res.status(403).json({ message: "Requiere privilegios de Super Administrador para revocar invitaciones." });
    }

    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: "Se requiere especificar el email de la invitación a revocar." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const checkRes = await client.query(
            "SELECT id, used_at FROM admin_invitations WHERE email = $1",
            [email.toLowerCase().trim()]
        );

        if (checkRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "No se encontró ninguna invitación activa o expirada para este correo." });
        }

        if (checkRes.rows[0].used_at !== null) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "No se puede revocar esta invitación porque la cuenta ya ha sido creada y reclamada." });
        }

        await client.query(
            "DELETE FROM admin_invitations WHERE email = $1",
            [email.toLowerCase().trim()]
        );

        await logAuditEvent(client, req, {
            eventType: 'admin.invitation.revoked',
            actorUsername: req.user.username,
            targetUsername: email,
            category: 'admin',
            metadata: { target_email: email }
        });

        await client.query('COMMIT');
        return res.json({ message: `Invitación para ${email} revocada y anulada con éxito.` });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[DATABASE ERROR] Error al revocar la invitación:', error.message);
        return res.status(500).json({ message: "Error interno del servidor al procesar la revocación." });
    } finally {
        client.release();
    }
}

/**
 * Lista todos los administradores registrados en la plataforma.
 */
async function getAdminUsers(req, res) {
    if (req.user?.role !== 'superadmin') {
        return res.status(403).json({ message: "Requiere privilegios de Super Administrador para ver el equipo." });
    }

    try {
        const result = await pool.query(
            `SELECT id, username, role, account_status, last_login, created_at 
             FROM admin_users 
             ORDER BY created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("[AdminAuthSecurityController] Error al listar equipo de administración:", err);
        res.status(500).json({ message: "Error interno al obtener el equipo de administración." });
    }
}

/**
 * Suspende o reactiva una cuenta de administrador de forma segura.
 */
async function updateAdminStatus(req, res) {
    if (req.user?.role !== 'superadmin') {
        return res.status(403).json({ message: "Requiere privilegios de Super Administrador para gestionar el equipo." });
    }

    const { adminId } = req.params;
    const { status } = req.body;
    const validStatuses = ['active', 'suspended'];

    const safeAdminId = parseInt(adminId, 10);
    if (!Number.isFinite(safeAdminId) || safeAdminId <= 0) {
        return res.status(400).json({ message: "ID de administrador inválido." });
    }

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Estado de cuenta inválido." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const checkRes = await client.query(
            "SELECT id, username, role, account_status FROM admin_users WHERE id = $1",
            [safeAdminId]
        );

        if (checkRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Administrador no encontrado." });
        }

        const targetUser = checkRes.rows[0];

        if (targetUser.username.toLowerCase() === req.user.username.toLowerCase()) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Operación inválida: No puedes suspender o cambiar el estado de tu propia cuenta." });
        }

        const protectedAdmin = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
        if (targetUser.username.toLowerCase() === protectedAdmin) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: "No está permitido modificar el estado de la cuenta administradora de resguardo del sistema." });
        }

        await client.query(
            "UPDATE admin_users SET account_status = $1 WHERE id = $2",
            [status, safeAdminId]
        );

        await logAuditEvent(client, req, {
            eventType: 'admin.user.status_updated',
            actorUsername: req.user.username,
            targetUsername: targetUser.username,
            category: 'admin',
            metadata: { target_admin: targetUser.username, new_status: status }
        });

        await client.query('COMMIT');
        return res.json({ message: `Estado del administrador ${targetUser.username} actualizado a "${status}" con éxito.` });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[DATABASE ERROR] Error al actualizar estado de administrador:', error.message);
        return res.status(500).json({ message: "Error interno del servidor al actualizar el estado." });
    } finally {
        client.release();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTACIONES DEL SUBMÓDULO DE AUTENTICACIÓN Y CIBERSEGURIDAD
// ═══════════════════════════════════════════════════════════════════════════
module.exports = {
    login,
    logout,
    getAdminProfile,
    requestPasswordChange,
    confirmPasswordChange,
    createInvitation,
    getInvitations,
    verifyInvitation,
    claimInvitation,
    deleteInvitation,
    getAdminUsers,
    updateAdminStatus
};
