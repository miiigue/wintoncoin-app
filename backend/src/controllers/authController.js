const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateUniqueReferralCode } = require('../config/databaseInit');
const { emailService, generateOtp6, hashOtpForEmail, sendOtpEmail, normalizeEmail, safeEqualHex } = require('../services/emailService');

const jwtSecret = process.env.JWT_SECRET;
const saltRounds = 10;

exports.registerRequest = async (req, res) => {
    const { username, email, password, phone, date_of_birth } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // --- Validación Estricta de Usuario (Estándar de Industria) ---
    // 1. Longitud mínima
    if (!username || username.length < 3) {
        return res.status(400).json({ message: "El nombre de usuario debe tener al menos 3 caracteres." });
    }
    // 2. Longitud máxima
    if (username.length > 30) {
        return res.status(400).json({ message: "El nombre de usuario no puede tener más de 30 caracteres." });
    }
    // 3. Solo caracteres permitidos (previene XSS e inyección)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ message: "El nombre de usuario solo puede contener letras, números y guiones bajos." });
    }

    // --- Validación Estricta de Email ---
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
        return res.status(400).json({ message: "El correo electrónico no es válido." });
    }

    // --- Validación Estricta de Contraseña ---
    if (!password || password.length < 8) {
        return res.status(400).json({ message: "La contraseña debe tener al menos 8 caracteres." });
    }

    // --- Validación de Edad (COPPA/GDPR Compliance) ---
    if (!date_of_birth) {
        return res.status(400).json({ message: "La fecha de nacimiento es requerida." });
    }

    const birthDate = new Date(date_of_birth);
    if (isNaN(birthDate.getTime())) {
        return res.status(400).json({ message: "La fecha de nacimiento no es válida." });
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    // Validar edad mínima
    if (age < 13) {
        return res.status(400).json({ message: "Debes tener al menos 13 años para registrarte. Los menores de 13 años no pueden utilizar la plataforma." });
    }

    const isMinor = age >= 13 && age < 18;
    // Puedes añadir una validación más robusta para el número de teléfono aquí si lo deseas

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // --- 2. Verificar que el usuario, email o teléfono no estén ya en uso (en users o pending) ---
        const existingUserQuery = `
            SELECT 1 FROM users WHERE username = $1 OR email = $2 OR phone_number = $3
            UNION
            SELECT 1 FROM pending_verifications WHERE username = $1 OR email = $2 OR phone_number = $3
        `;
        const existingUser = await client.query(existingUserQuery, [username, normalizedEmail, phone]);

        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'El nombre de usuario, email o teléfono ya está en uso o pendiente de verificación.' });
        }

        // --- 3. Generar OTP (Email) y Fecha de Expiración ---
        const verificationCode = generateOtp6(); // Código de 6 dígitos (crypto-secure)
        const verificationCodeHash = hashOtpForEmail(normalizedEmail, verificationCode);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos de validez
        const lastSentAt = new Date();

        // --- 4. Encriptar Contraseña y Guardar en Pendientes ---
        const passwordHash = await bcrypt.hash(password, saltRounds);
        await client.query(
            `INSERT INTO pending_verifications (
                username, email, password_hash, phone_number, referral_code,
                verification_code, verification_code_hash,
                verification_attempts, resend_count, last_sent_at,
                expires_at, date_of_birth, is_minor
            )
                VALUES ($1, $2, $3, $4, $5, NULL, $6, 0, 0, $7, $8, $9, $10)`,
            [username, normalizedEmail, passwordHash, phone, null, verificationCodeHash, lastSentAt, expiresAt, date_of_birth, isMinor]
        );

        // --- 5. Enviar el OTP por Email usando AWS SES ---
        try {
            const ipRaw = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
            const ip = ipRaw.split(',')[0].trim();
            const requestedAt = new Date().toISOString();
            await sendOtpEmail({ toEmail: normalizedEmail, otp: verificationCode, context: { ip, requestedAt } });
        } catch (emailError) {
            console.error("Error al enviar OTP por email (SES):", emailError);
            await client.query('ROLLBACK');
            // No revelamos detalles internos por seguridad
            return res.status(500).json({ message: 'No se pudo enviar el código de verificación. Por favor, intenta de nuevo más tarde.' });
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Se ha enviado un código de verificación a tu correo electrónico.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en la solicitud de registro:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

exports.registerVerify = async (req, res) => {
    const { email, verificationCode, referral_code } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !verificationCode) {
        return res.status(400).json({ message: "El correo y el código de verificación son requeridos." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // --- 1. Buscar la solicitud de registro pendiente y validarla ---
        const pendingResult = await client.query(
            'SELECT * FROM pending_verifications WHERE email = $1',
            [normalizedEmail]
        );

        if (pendingResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Código de verificación incorrecto.' });
        }

        const pendingUser = pendingResult.rows[0];

        // Anti-bruteforce: límite de intentos por solicitud
        if ((pendingUser.verification_attempts || 0) >= 5) {
            await client.query('DELETE FROM pending_verifications WHERE id = $1', [pendingUser.id]);
            await client.query('COMMIT');
            return res.status(429).json({ message: 'Demasiados intentos. Solicita un nuevo código.' });
        }

        // Verificar si el código ha expirado
        if (new Date() > new Date(pendingUser.expires_at)) {
            // Opcional: Limpiar códigos expirados
            await client.query('DELETE FROM pending_verifications WHERE id = $1', [pendingUser.id]);
            await client.query('COMMIT'); // Guardar la eliminación
            return res.status(400).json({ message: 'El código de verificación ha expirado. Por favor, solicita uno nuevo.' });
        }

        // Validar OTP (preferimos hash; fallback legacy si existe verification_code)
        const expectedHash = hashOtpForEmail(normalizedEmail, String(verificationCode).trim());
        const hasHash = !!pendingUser.verification_code_hash;
        const otpIsValid = hasHash
            ? safeEqualHex(pendingUser.verification_code_hash, expectedHash)
            : (String(pendingUser.verification_code || '').trim() === String(verificationCode).trim());

        if (!otpIsValid) {
            // Incrementar intentos y devolver error genérico
            await client.query(
                'UPDATE pending_verifications SET verification_attempts = verification_attempts + 1 WHERE id = $1',
                [pendingUser.id]
            );
            await client.query('COMMIT');
            return res.status(400).json({ message: 'Código de verificación incorrecto.' });
        }

        // --- 2. Mover el usuario de "pendientes" a la tabla "users" ---
        const newReferralCode = await generateUniqueReferralCode(client, pendingUser.username);

        // Calcular edad y determinar si es menor
        const birthDate = pendingUser.date_of_birth ? new Date(pendingUser.date_of_birth) : null;
        let isMinor = false;
        if (birthDate) {
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            isMinor = age >= 13 && age < 18;
        }

        // La lógica de referidos se aplicará a continuación
        const newUserSql = `INSERT INTO users (username, password_hash, email, phone_number, referral_code, date_of_birth, is_minor, account_status) 
                          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
        const accountStatus = isMinor ? 'pending_tutor' : 'active';
        const newUserResult = await client.query(newUserSql, [
            pendingUser.username,
            pendingUser.password_hash,
            pendingUser.email,
            pendingUser.phone_number,
            newReferralCode,
            pendingUser.date_of_birth || null,
            isMinor,
            accountStatus
        ]);
        const newUser = newUserResult.rows[0];

        // Marcamos la cuenta como verificada (email verificado)
        await client.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [newUser.id]);

        // --- 2.1 REGISTRO DE EVIDENCIA FORENSE (LEGAL AUDIT) ---
        // Capturar IP y User Agent para el registro legal
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
        const userAgent = req.headers['user-agent'] || 'Unknown';

        // Obtenemos la última versión activa de los documentos legales
        const docsQuery = `SELECT type, version, content_hash FROM legal_documents WHERE is_active = TRUE`;
        const docsResult = await client.query(docsQuery);

        if (docsResult.rows.length > 0) {
            for (const doc of docsResult.rows) {
                await client.query(
                    `INSERT INTO user_agreements_log 
                    (user_id, document_type, document_version, document_hash, ip_address, user_agent)
                    VALUES ($1, $2, $3, $4, $5, $6)`,
                    [newUser.id, doc.type, doc.version, doc.content_hash, ipAddress, userAgent]
                );
            }
            console.log(`[AUDIT] Evidencia legal registrada para usuario ${newUser.username} (IP: ${ipAddress})`);
        } else {
            console.warn(`[AUDIT WARNING] El usuario ${newUser.username} se registró pero NO se encontraron documentos legales activos para firmar.`);
        }

        // --- 3. [LÓGICA REINTEGRADA] Aplicar bonos de bienvenida y referidos ---
        const settingKeys = [
            'referral_system_enabled', 'referral_reward_amount',
            'welcome_bonus_enabled', 'welcome_bonus_amount',
            'pre_launch_mode_enabled', 'referral_codes_expiry_date'
        ];
        const settingsResult = await client.query(`SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1::text[])`, [settingKeys]);
        const settings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

        const preLaunchMode = settings.pre_launch_mode_enabled === 'true';
        const referralsEnabled = settings.referral_system_enabled === 'true';
        const welcomeBonusEnabled = settings.welcome_bonus_enabled === 'true';

        let referrer = null;
        let referralCodeExpired = false;
        if (referralsEnabled && referral_code) {
            const referrerResult = await client.query('SELECT * FROM users WHERE referral_code = $1', [referral_code.trim().toUpperCase()]);
            if (referrerResult.rowCount > 0) {
                // Validar fecha de vigencia del programa de referidos
                const expiryDateStr = settings.referral_codes_expiry_date;
                if (expiryDateStr) {
                    const expiryDate = new Date(expiryDateStr);
                    // Validar que la fecha sea válida
                    if (!isNaN(expiryDate.getTime())) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0); // Normalizar a medianoche para comparación de fechas
                        expiryDate.setHours(0, 0, 0, 0);

                        if (today > expiryDate) {
                            // Código expirado: no aplicar recompensa pero permitir registro
                            referralCodeExpired = true;
                        } else {
                            // Código válido y vigente
                            referrer = referrerResult.rows[0];
                        }
                    } else {
                        // Fecha inválida: tratar como si no hubiera fecha (código válido)
                        console.warn(`Fecha de vigencia inválida: ${expiryDateStr}. Tratando como código válido.`);
                        referrer = referrerResult.rows[0];
                    }
                } else {
                    // Si no hay fecha de expiración configurada, el código es válido
                    referrer = referrerResult.rows[0];
                }
            }
        }

        // Notificar si el código de referido estaba expirado
        if (referralCodeExpired && referral_code) {
            const expiryDateStr = settings.referral_codes_expiry_date;
            if (expiryDateStr) {
                const expiryDate = new Date(expiryDateStr);
                // Validar que la fecha sea válida antes de formatear
                if (!isNaN(expiryDate.getTime())) {
                    const formattedDate = expiryDate.toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [
                        newUser.username,
                        `El código de referido que usaste expiró el ${formattedDate}. Te has registrado exitosamente y recibirás el bono de bienvenida.`
                    ]);
                } else {
                    // Si la fecha es inválida, enviar mensaje genérico
                    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [
                        newUser.username,
                        `El código de referido que usaste ha expirado. Te has registrado exitosamente y recibirás el bono de bienvenida.`
                    ]);
                }
            }
        }

        // Lógica de Recompensa por Referido (solo en modo pre-lanzamiento)
        if (preLaunchMode && referrer) {
            const rewardAmount = parseFloat(settings.referral_reward_amount) || 0;
            if (rewardAmount > 0) {
                // Recompensa para el referente: Registra en booster_blue_ledger (cumple reglas económicas)
                await client.query("SELECT record_booster_event($1, 'referral_reward', $2, NULL)", [referrer.id, rewardAmount]);
                await client.query('UPDATE users SET is_booster = true WHERE id = $1', [referrer.id]);

                // VINCULACIÓN DE DATOS (FIX): Guardar la relación de referido en la tabla users y logs
                await client.query('UPDATE users SET referred_by_id = $1 WHERE id = $2', [referrer.id, newUser.id]);
                await client.query('INSERT INTO referral_log (referrer_user_id, referred_user_id) VALUES ($1, $2)', [referrer.id, newUser.id]);

                await client.query(`INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, 'referral_bonus_sent', $2, $3)`, [referrer.id, rewardAmount, `Bono por referir a ${newUser.username}`]);
                await client.query(`INSERT INTO transactions (user_id, type, description, blue_change) VALUES ($1, 'referral_bonus', $2, $3)`, [referrer.id, `Recompensa (perfil impulsor) por referir a ${newUser.username}`, rewardAmount]);
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [referrer.username, `¡Felicidades! Has ganado ${rewardAmount.toFixed(4)} BLUE en tu perfil de impulsor porque ${newUser.username} se registró con tu código.`]);

                // Recompensa para el nuevo usuario: Registra en booster_blue_ledger (cumple reglas económicas)
                await client.query('SELECT record_booster_event($1, \'referral_reward\', $2, NULL)', [newUser.id, rewardAmount]);
                await client.query('UPDATE users SET is_booster = true WHERE id = $1', [newUser.id]);
                await client.query(`INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, 'referral_bonus_received', $2, $3)`, [newUser.id, rewardAmount, `Bono por usar el código de ${referrer.username}`]);
                await client.query(`INSERT INTO transactions (user_id, type, description, blue_change) VALUES ($1, 'referral_bonus', $2, $3)`, [newUser.id, `Recompensa (perfil impulsor) por usar el código de ${referrer.username}`, rewardAmount]);
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [newUser.username, `¡Bienvenido! Por usar un código de referido, has ganado ${rewardAmount.toFixed(4)} BLUE en tu perfil de impulsor.`]);
            }
        }
        // Lógica de Bono de Bienvenida (si no hay referente, solo en modo pre-lanzamiento)
        else if (preLaunchMode && welcomeBonusEnabled) {
            const welcomeBonusAmount = parseFloat(settings.welcome_bonus_amount) || 0;
            if (welcomeBonusAmount > 0) {
                // Bono para el nuevo usuario: Registra en booster_blue_ledger (cumple reglas económicas)
                await client.query('SELECT record_booster_event($1, \'welcome_bonus\', $2, NULL)', [newUser.id, welcomeBonusAmount]);
                await client.query('UPDATE users SET is_booster = true WHERE id = $1', [newUser.id]);
                await client.query(`INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, 'welcome_bonus', $2, $3)`, [newUser.id, welcomeBonusAmount, 'Bono de Bienvenida por registro']);
                await client.query(`INSERT INTO transactions (user_id, type, description, blue_change) VALUES ($1, 'welcome_bonus', $2, $3)`, [newUser.id, 'Bono de bienvenida (perfil impulsor)', welcomeBonusAmount]);
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [newUser.username, `¡Bienvenido! Has recibido ${welcomeBonusAmount.toFixed(4)} BLUE en tu perfil de impulsor como bono de bienvenida.`]);
            }
        }

        // --- 4. Limpiar la tabla de pendientes ---
        await client.query('DELETE FROM pending_verifications WHERE id = $1', [pendingUser.id]);

        // --- 5. [LÓGICA CORREGIDA] Generar token de sesión y devolver datos del usuario ---
        const token = jwt.sign(
            { userId: newUser.id, username: newUser.username },
            jwtSecret,
            { expiresIn: '7d' }
        );

        await client.query('COMMIT');

        res.status(200).json({
            message: '¡Verificación completada con éxito!',
            token: token,
            username: newUser.username
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error durante la verificación del registro:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Usuario y contraseña son requeridos." });
    }

    try {
        const sql = `SELECT * FROM users WHERE username = $1`;
        const result = await pool.query(sql, [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado. Por favor, regístrese primero." });
        }

        // VERIFICACIÓN DE ESTADO DEL USUARIO
        if (user.status === 'suspended') {
            return res.status(403).json({ message: "Tu cuenta ha sido suspendida. Por favor, contacta a soporte." });
        }
        if (user.status === 'banned') {
            return res.status(403).json({ message: "Tu cuenta ha sido baneada permanentemente." });
        }

        if (!user.password_hash) {
            console.error(`Intento de login para el usuario '${username}' falló: la cuenta está corrupta (no tiene password_hash).`);
            return res.status(401).json({ message: 'Credenciales inválidas. La cuenta de usuario podría estar corrupta.' });
        }

        const match = await bcrypt.compare(password, user.password_hash);

        if (match) {
            // PASO 1: Generar un token de sesión seguro (JWT) al iniciar sesión.
            const token = jwt.sign(
                { userId: user.id, username: user.username },
                jwtSecret,
                { expiresIn: '7d' }
            );

            res.status(200).json({
                message: "Inicio de sesión exitoso.",
                token: token, // Se devuelve el token al cliente.
                username: user.username
            });
        } else {
            res.status(401).json({ message: "Contraseña incorrecta." });
        }
    } catch (error) {
        console.error("Error en el inicio de sesión:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
};

exports.resendCode = async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
        return res.status(400).json({ message: 'El email es requerido.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Buscar al usuario en la tabla de verificaciones pendientes.
        const pendingUserResult = await client.query(
            'SELECT * FROM pending_verifications WHERE email = $1',
            [normalizedEmail]
        );

        // Si no se encuentra, enviamos una respuesta genérica para no revelar si el email existe.
        // Esto previene que alguien pueda usar esta función para descubrir qué emails están registrados.
        if (pendingUserResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(200).json({ message: 'Si tu email está pendiente de verificación, hemos enviado un nuevo código.' });
        }

        const pendingUser = pendingUserResult.rows[0];

        // 2. Enforce cooldown + límite de reenvíos (anti-abuso)
        const now = new Date();
        const lastSentAt = pendingUser.last_sent_at ? new Date(pendingUser.last_sent_at) : null;
        const secondsSinceLastSend = lastSentAt ? Math.floor((now.getTime() - lastSentAt.getTime()) / 1000) : null;

        // Cooldown mínimo (server-side). El frontend también tiene timer, pero NO confiamos solo en el cliente.
        if (secondsSinceLastSend !== null && secondsSinceLastSend < 60) {
            await client.query('ROLLBACK');
            return res.status(200).json({ message: 'Si tu email está pendiente de verificación, hemos enviado un nuevo código.' });
        }

        // Máximo de reenvíos por solicitud (ej. 5). Si se excede, no revelamos nada.
        if ((pendingUser.resend_count || 0) >= 5) {
            await client.query('ROLLBACK');
            return res.status(200).json({ message: 'Si tu email está pendiente de verificación, hemos enviado un nuevo código.' });
        }

        // 3. Generar un nuevo OTP y una nueva fecha de expiración.
        const newVerificationCode = generateOtp6();
        const newVerificationCodeHash = hashOtpForEmail(normalizedEmail, newVerificationCode);
        const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos de validez

        // 4. Actualizar el registro en la base de datos con los nuevos datos.
        await client.query(
            `UPDATE pending_verifications
     SET verification_code = NULL,
         verification_code_hash = $1,
         expires_at = $2,
         last_sent_at = $3,
         resend_count = resend_count + 1,
         verification_attempts = 0
     WHERE email = $4`,
            [newVerificationCodeHash, newExpiresAt, now, normalizedEmail]
        );

        // 5. Enviar el nuevo código por Email (AWS SES).
        try {
            const requestedAt = new Date().toISOString();
            await sendOtpEmail({ toEmail: normalizedEmail, otp: newVerificationCode, context: { requestedAt } });
        } catch (emailError) {
            console.error("Error al reenviar OTP por email (SES):", emailError);
            await client.query('ROLLBACK');
            return res.status(500).json({ message: 'No se pudo enviar el nuevo código de verificación. Por favor, inténtalo de nuevo más tarde.' });
        }

        // 6. Si todo ha ido bien, confirmamos la transacción.
        await client.query('COMMIT');
        res.status(200).json({ message: 'Si tu email está pendiente de verificación, hemos enviado un nuevo código.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en /api/auth/resend-code:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

exports.getAuthStatus = async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(200).json({ isAuthenticated: false });
    }

    // FIX PROFESIONAL: verificamos con la misma clave con la que firmamos el JWT (JWT_SECRET).
    // Si esto no coincide, el frontend verá "isAuthenticated=false" aunque tenga un token válido.
    jwt.verify(token, jwtSecret, async (err, user) => {
        if (err) {
            return res.status(200).json({ isAuthenticated: false });
        }

        try {
            const client = await pool.connect();
            try {
                const dbUser = await client.query('SELECT is_verified FROM users WHERE id = $1', [user.userId]);
                if (dbUser.rows.length === 0) {
                    return res.status(200).json({ isAuthenticated: false });
                }

                res.status(200).json({
                    isAuthenticated: true,
                    is_verified: dbUser.rows[0].is_verified,
                    username: user.username
                });
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error al consultar el estado del usuario:', error);
            res.status(500).json({ message: 'Error interno del servidor' });
        }
    });
};

exports.checkPendingStatus = async (req, res) => {
    const { phone, email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!phone || !normalizedEmail) {
        return res.status(400).json({ isValid: false, message: 'Datos incompletos.' });
    }

    try {
        // Check if there is a pending verification matching BOTH phone and email
        const result = await pool.query(
            'SELECT * FROM pending_verifications WHERE phone_number = $1 AND email = $2',
            [phone, normalizedEmail]
        );

        if (result.rows.length > 0) {
            const pendingUser = result.rows[0];

            // Check expiration
            if (new Date() > new Date(pendingUser.expires_at)) {
                // Expired - delete it to allow re-registration
                await pool.query('DELETE FROM pending_verifications WHERE id = $1', [pendingUser.id]);
                return res.json({ isValid: false, message: 'La solicitud ha expirado.' });
            }

            return res.json({ isValid: true, message: 'Verificación pendiente encontrada.' });
        } else {
            return res.json({ isValid: false, message: 'No se encontró ninguna verificación pendiente.' });
        }
    } catch (error) {
        console.error('Error checking pending status:', error);
        return res.status(500).json({ error: 'Database error' });
    }
};
