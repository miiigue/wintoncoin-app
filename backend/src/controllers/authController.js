const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateUniqueReferralCode } = require('../config/databaseInit');
const { generateOtp6, hashOtpForEmail, sendOtpEmail, sendTransactionEmail, normalizeEmail, safeEqualHex } = require('../services/emailService');
const { logAuditEvent } = require('../services/auditService');
const notificationService = require('../services/notificationService');
const {
    getActiveLegalDocuments,
    getUserLegalStatusByUserId,
    validateAcceptedDocumentsPayload,
    ensureAllActiveDocumentsAccepted
} = require('../services/legalService');

const jwtSecret = process.env.JWT_SECRET;
const saltRounds = 10;
const MAX_PASSWORD_RESET_ATTEMPTS = 5;

exports.registerRequest = async (req, res) => {
    const { username, email, password, phone, date_of_birth, acceptedLegalDocuments } = req.body;
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

        // --- 3. Validar aceptación legal explícita contra documentos activos ---
        const payloadValidation = validateAcceptedDocumentsPayload(acceptedLegalDocuments);
        if (!payloadValidation.isValid) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: payloadValidation.message });
        }

        const activeDocs = await getActiveLegalDocuments(client);
        if (activeDocs.length === 0) {
            await client.query('ROLLBACK');
            return res.status(503).json({
                message: 'No hay documentos legales activos publicados. Intenta nuevamente más tarde.'
            });
        }

        const legalCoverage = ensureAllActiveDocumentsAccepted(activeDocs, payloadValidation.acceptedDocuments);
        if (!legalCoverage.allAccepted) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: 'Debes aceptar todos los documentos legales activos para registrarte.',
                missingDocuments: legalCoverage.missingDocs
            });
        }

        // --- 4. Generar OTP (Email) y Fecha de Expiración ---
        const verificationCode = generateOtp6(); // Código de 6 dígitos (crypto-secure)
        const verificationCodeHash = hashOtpForEmail(normalizedEmail, verificationCode);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos de validez
        const lastSentAt = new Date();

        // --- 5. Encriptar Contraseña y Guardar en Pendientes ---
        const passwordHash = await bcrypt.hash(password, saltRounds);
        await client.query(
            `INSERT INTO pending_verifications (
                username, email, password_hash, phone_number, referral_code,
                verification_code, verification_code_hash,
                verification_attempts, resend_count, last_sent_at,
                expires_at, date_of_birth, is_minor, legal_acceptances_json
            )
                VALUES ($1, $2, $3, $4, $5, NULL, $6, 0, 0, $7, $8, $9, $10, $11::jsonb)`,
            [
                username,
                normalizedEmail,
                passwordHash,
                phone,
                null,
                verificationCodeHash,
                lastSentAt,
                expiresAt,
                date_of_birth,
                isMinor,
                JSON.stringify(payloadValidation.acceptedDocuments)
            ]
        );

        // --- 6. Enviar el OTP por Email usando AWS SES ---
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

        // --- 2.0 GENERAR BÓVEDA WEB3 INVISIBLE (Arquitectura Cero Fricción) ---
        const WalletService = require('../services/walletService');
        const web3Wallet = WalletService.generateEncryptedWallet();

        // La lógica de referidos se aplicará a continuación
        const newUserSql = `INSERT INTO users (username, password_hash, email, phone_number, referral_code, date_of_birth, is_minor, account_status, web3_wallet_address, web3_private_key_encrypted) 
                          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`;
        const accountStatus = isMinor ? 'pending_tutor' : 'active';
        const newUserResult = await client.query(newUserSql, [
            pendingUser.username,
            pendingUser.password_hash,
            pendingUser.email,
            pendingUser.phone_number,
            newReferralCode,
            pendingUser.date_of_birth || null,
            isMinor,
            accountStatus,
            web3Wallet.address,
            web3Wallet.encryptedPrivateKey
        ]);
        const newUser = newUserResult.rows[0];

        // Marcamos la cuenta como verificada (email verificado)
        await client.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [newUser.id]);

        // --- 2.1 REGISTRO LEGAL EXPLÍCITO ---
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
        const userAgent = req.headers['user-agent'] || 'Unknown';

        const pendingAcceptedPayload = validateAcceptedDocumentsPayload(pendingUser.legal_acceptances_json);
        if (!pendingAcceptedPayload.isValid) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: 'No se encontró una aceptación legal válida. Inicia el registro nuevamente.'
            });
        }

        const activeDocs = await getActiveLegalDocuments(client);
        if (activeDocs.length === 0) {
            await client.query('ROLLBACK');
            return res.status(503).json({
                message: 'No hay documentos legales activos publicados. Intenta nuevamente más tarde.'
            });
        }

        const legalCoverage = ensureAllActiveDocumentsAccepted(activeDocs, pendingAcceptedPayload.acceptedDocuments);
        if (!legalCoverage.allAccepted) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                message: 'Los términos legales fueron actualizados. Debes reiniciar el registro y aceptar la versión vigente.',
                missingDocuments: legalCoverage.missingDocs
            });
        }

        for (const doc of activeDocs) {
            await client.query(
                `INSERT INTO user_agreements_log
                    (user_id, document_type, document_version, document_hash, ip_address, user_agent)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (user_id, document_type, document_version, document_hash) DO NOTHING`,
                [newUser.id, doc.type, doc.version, doc.content_hash, ipAddress, userAgent]
            );
        }
        console.log(`[AUDIT] Evidencia legal registrada para usuario ${newUser.username} (IP: ${ipAddress})`);

        // --- 3. [LÓGICA REINTEGRADA] Aplicar bonos de bienvenida y referidos ---
        const settingKeys = [
            'referral_system_enabled', 'referral_reward_amount',
            'referral_reward_after_expiry',
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

        if (preLaunchMode && referrer) {
            // Contar el total de usuarios actuales registrados para determinar el tramo
            const userCountRes = await client.query('SELECT COUNT(*) as count FROM users');
            const totalUsers = parseInt(userCountRes.rows[0].count, 10);

            // Consultar el tramo de recompensa activo
            // IMMEDIATE PHASE ROLLOVER: Se usa '>' (estricto) — cuando totalUsers
            // alcanza el max_users_limit del tramo, salta al siguiente.
            // Esto garantiza que el monto acreditado coincida exactamente con
            // lo que el usuario ve en la tarjeta del dashboard (audit trail).
            const tierRes = await client.query(`
                SELECT reward_amount 
                FROM referral_reward_tiers 
                WHERE max_users_limit > $1 
                ORDER BY tier_number ASC 
                LIMIT 1
            `, [totalUsers]);

            let rewardAmount = 0;
            if (tierRes.rowCount > 0) {
                rewardAmount = parseFloat(tierRes.rows[0].reward_amount) || 0;
            } else {
                // Fallback a la recompensa después de la promo (0 BLUE IOU)
                rewardAmount = parseFloat(settings.referral_reward_after_expiry) || 0;
            }

            if (rewardAmount > 0) {
                // Consultar causa activa aprobada del referente
                const causeCheck = await client.query(`
                    SELECT id, title FROM humanitarian_causes 
                    WHERE user_id = $1 AND status = 'approved' 
                    LIMIT 1
                `, [referrer.id]);

                // VINCULACIÓN DE DATOS (GENEALOGÍA): Guardar la relación de referido en la tabla users y logs
                await client.query('UPDATE users SET referrer_id = $1 WHERE id = $2', [referrer.id, newUser.id]);
                await client.query('INSERT INTO referral_log (referrer_user_id, referred_user_id) VALUES ($1, $2)', [referrer.id, newUser.id]);

                if (causeCheck.rowCount > 0) {
                    const activeCause = causeCheck.rows[0];

                    // CASO CON CAUSA ACTIVA: Desviar bono a la causa
                    // Registramos la donación en estado 'on_hold' y tipo 'referral'
                    // El donante se registra como newUser (quien genera el abono) y el receptor es el referente (María)
                    await client.query(`
                        INSERT INTO humanitarian_donations 
                            (cause_id, donor_id, recipient_id, amount, status, donation_type)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [activeCause.id, newUser.id, referrer.id, rewardAmount, 'on_hold', 'referral']);

                    // Incrementar el pending_amount de la causa solidaria para control de meta y escrow
                    await client.query(`
                        UPDATE humanitarian_causes 
                        SET pending_amount = pending_amount + $1 
                        WHERE id = $2
                    `, [rewardAmount, activeCause.id]);

                    // Activar perfil impulsor del referente si no lo era
                    await client.query('UPDATE users SET is_booster = true WHERE id = $1', [referrer.id]);

                    // Notificación en la plataforma
                    await client.query(`
                        INSERT INTO notifications (recipient_username, message) 
                        VALUES ($1, $2)
                    `, [
                        referrer.username, 
                        `⚡ ¡Nuevo Referido! Tu bono de ${rewardAmount.toFixed(4)} BLUE por invitar a ${newUser.username} se ha destinado automáticamente como donación en espera para tu causa "${activeCause.title}". Estará disponible cuando el usuario verifique su KYC.`
                    ]);

                    // PUSH NOTIFICATION (Referente — TRANSACTIONAL porque involucra asignación de fondos)
                    await notificationService.sendNotificationToUser(referrer.id, {
                        title: 'Bono destinado a tu Causa 💙',
                        body: `${newUser.username} se unió con tu código. +${rewardAmount.toFixed(2)} BLUE IOU asignados en espera para tu causa.`,
                        icon: '/assets/icons/icon-192x192.png',
                        data: { url: `/causa-solidaria.html?id=${activeCause.id}` }
                    }, 'TRANSACTIONAL');

                    // Disparar envío de correo transaccional de bienvenida y agradecimiento al nuevo usuario (no bloqueante)
                    if (newUser.email) {
                        sendTransactionEmail({
                            toEmail: newUser.email,
                            subject: '🎁 ¡Gracias por unirte! Tu registro apoya una causa — Winton Solidario',
                            title: 'Aporte Solidario por Registro',
                            message: `¡Bienvenido a Wintoncoin! Nos emociona mucho que te unas a nuestra comunidad. Queremos agradecerte de todo corazón porque al registrarte usando el código de referido de @${referrer.username}, has destinado tu bono de bienvenida de ${rewardAmount.toFixed(4)} BLUE IOU para apoyar la causa "${activeCause.title}". Tu granito de arena hace una gran diferencia.\n\nTu aporte está en resguardo seguro temporalmente. Para que este hermoso gesto se haga efectivo y sea liberado para la causa, solo debes completar tu verificación KYC Web3 en tu panel.`,
                            amount: `${rewardAmount.toFixed(4)} BLUE IOU`,
                            details: [
                                { label: 'Causa Solidaria', value: activeCause.title },
                                { label: 'Invitado por', value: `@${referrer.username}` },
                                { label: 'Donante', value: `@${newUser.username}` },
                                { label: 'Estado', value: 'En Resguardo Seguro (Falta KYC)' },
                                { label: 'Fecha', value: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }) }
                            ]
                        }).catch(e => console.error('[SOLIDARIO CORREO] Error al enviar correo de bienvenida y agradecimiento por referido:', e.message));
                    }

                } else {
                    // CASO TRADICIONAL (Sin causa activa)
                    // Recompensa para el referente: Registra en booster_blue_ledger
                    await client.query("SELECT record_booster_event($1, 'referral_reward', $2, NULL, $3)", [referrer.id, rewardAmount, newUser.id]);
                    await client.query('UPDATE users SET is_booster = true WHERE id = $1', [referrer.id]);

                    await client.query(`INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, 'referral_bonus_sent', $2, $3)`, [referrer.id, rewardAmount, `Bono por referir a ${newUser.username}`]);
                    await client.query(`INSERT INTO transactions (user_id, type, description, blue_change) VALUES ($1, 'referral_bonus', $2, $3)`, [referrer.id, `Recompensa (perfil impulsor) por referir a ${newUser.username}`, rewardAmount]);
                    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [referrer.username, `¡Felicidades! Has ganado ${rewardAmount.toFixed(4)} BLUE en tu perfil de impulsor porque ${newUser.username} se registró con tu código.`]);

                    // PUSH NOTIFICATION (Referente — TRANSACTIONAL porque involucra acreditación de fondos)
                    await notificationService.sendNotificationToUser(referrer.id, {
                        title: '¡Nuevo Referido! ⚡',
                        body: `${newUser.username} se unió con tu código. +${rewardAmount.toFixed(2)} BLUE IOU acreditados.`,
                        icon: '/assets/icons/icon-192x192.png',
                        data: { url: '/history.html' }
                    }, 'TRANSACTIONAL');
                }

                // El bono para el nuevo usuario (referred) SIEMPRE se acredita a él de forma íntegra e independiente.
                // Recompensa para el nuevo usuario: Registra en booster_blue_ledger (cumple reglas económicas)
                await client.query("SELECT record_booster_event($1, 'referral_reward', $2, NULL, $3)", [newUser.id, rewardAmount, referrer.id]);
                await client.query('UPDATE users SET is_booster = true WHERE id = $1', [newUser.id]);
                await client.query(`INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, 'referral_bonus_received', $2, $3)`, [newUser.id, rewardAmount, `Bono por usar el código de ${referrer.username}`]);
                await client.query(`INSERT INTO transactions (user_id, type, description, blue_change) VALUES ($1, 'referral_bonus', $2, $3)`, [newUser.id, `Recompensa (perfil impulsor) por usar el código de ${referrer.username}`, rewardAmount]);
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [newUser.username, `¡Bienvenido! Por usar un código de referido, has ganado ${rewardAmount.toFixed(4)} BLUE en tu perfil de impulsor.`]);

                // PUSH NOTIFICATION (Nuevo Usuario — TRANSACTIONAL porque involucra acreditación de fondos)
                await notificationService.sendNotificationToUser(newUser.id, {
                    title: '¡Bienvenido a la Familia! 🎁',
                    body: `Has recibido ${rewardAmount.toFixed(2)} BLUE IOU de regalo por usar referido.`,
                    icon: '/assets/icons/icon-192x192.png',
                    data: { url: '/history.html' }
                }, 'TRANSACTIONAL');
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

                // PUSH NOTIFICATION (Bienvenida General — TRANSACTIONAL porque involucra acreditación de fondos)
                await notificationService.sendNotificationToUser(newUser.id, {
                    title: '¡Bienvenido! 🚀',
                    body: `Recibiste ${welcomeBonusAmount.toFixed(2)} BLUE IOU de regalo por tu registro.`,
                    icon: '/assets/icons/icon-192x192.png',
                    data: { url: '/history.html' }
                }, 'TRANSACTIONAL');
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

        // --- 6. [WINTON TRUST SCORE] Sincronizar límite de crédito inicial en Blockchain ---
        // Lo hacemos después del COMMIT para asegurar que el usuario existe en DB.
        const creditScoringService = require('../services/creditScoringService');
        creditScoringService.syncCreditLimitOnChain(newUser.id).catch(err => {
            console.error('[AUTH] Fallo al sincronizar límite inicial en cadena:', err);
        });


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
    const { identifier, password } = req.body;

    if (!identifier || !password) {
        return res.status(400).json({ message: "Usuario/Email y contraseña son requeridos." });
    }

    try {
        // Determinar si el identificador es un email o un username
        const isEmail = /^\S+@\S+\.\S+$/.test(identifier.trim());
        let sql, params;

        if (isEmail) {
            // Búsqueda por email (case-insensitive)
            sql = `SELECT * FROM users WHERE LOWER(email) = LOWER($1)`;
            params = [identifier.trim()];
        } else {
            // Búsqueda por username (exact match)
            sql = `SELECT * FROM users WHERE username = $1`;
            params = [identifier.trim()];
        }

        const result = await pool.query(sql, params);
        const user = result.rows[0];

        if (!user) {
            // Mensaje genérico para no revelar si el usuario/email existe (seguridad fintech)
            return res.status(401).json({ message: "Credenciales inválidas. Verifica tu usuario/email y contraseña." });
        }

        // VERIFICACIÓN DE ESTADO DEL USUARIO
        // Fuente de verdad: account_status (columna vigente para moderación).
        // Fallback a status por compatibilidad con datos legacy.
        const moderationStatus = user.account_status || user.status || 'active';
        if (moderationStatus === 'suspended') {
            return res.status(403).json({ message: "Tu cuenta ha sido suspendida. Por favor, contacta a soporte." });
        }
        if (moderationStatus === 'banned') {
            return res.status(403).json({ message: "Tu cuenta ha sido baneada permanentemente." });
        }

        if (!user.password_hash) {
            console.error(`Intento de login para el usuario '${user.username}' falló: la cuenta está corrupta (no tiene password_hash).`);
            return res.status(401).json({ message: 'Credenciales inválidas. Verifica tu usuario/email y contraseña.' });
        }

        const match = await bcrypt.compare(password, user.password_hash);

        if (match) {
            // --- ACTUALIZACIÓN WEB3 (Retrocompatibilidad Silenciosa) ---
            // Si el usuario es antiguo y no tiene billetera Web3, se la forjamos en su primer inicio de sesión.
            if (!user.web3_wallet_address) {
                const WalletService = require('../services/walletService');
                const web3Wallet = WalletService.generateEncryptedWallet();
                
                await pool.query(
                    'UPDATE users SET web3_wallet_address = $1, web3_private_key_encrypted = $2 WHERE id = $3',
                    [web3Wallet.address, web3Wallet.encryptedPrivateKey, user.id]
                );
                console.log(`[WEB3 SECRETO] Bóveda generada silenciosamente para usuario legacy: ${user.username} -> ${web3Wallet.address}`);
            }

            const legalStatus = await getUserLegalStatusByUserId(pool, user.id);
            const token = jwt.sign(
                { userId: user.id, username: user.username },
                jwtSecret,
                { expiresIn: '7d' }
            );

            // --- [WINTON TRUST SCORE] Sincronizar límite de crédito en Blockchain ---
            // Así actualizamos su límite si ganó bonos de "Winton Academy" o referidos mientras no estaba.
            const creditScoringService = require('../services/creditScoringService');
            creditScoringService.syncCreditLimitOnChain(user.id).catch(err => {
                console.error('[AUTH] Fallo al sincronizar límite en login:', err);
            });

            res.status(200).json({
                message: "Inicio de sesión exitoso.",
                token: token,
                username: user.username,
                requires_terms_acceptance: legalStatus.requires_terms_acceptance,
                pending_documents: legalStatus.pending_documents
            });
        } else {
            // Mensaje genérico (no revelamos si el usuario existe)
            res.status(401).json({ message: "Credenciales inválidas. Verifica tu usuario/email y contraseña." });
        }
    } catch (error) {
        console.error("Error en el inicio de sesión:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
};

// ============================================================================
// Recuperación de contraseña — Paso 1: Solicitar código OTP por email
// ============================================================================
exports.forgotPasswordRequest = async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
        return res.status(400).json({ message: "El correo electrónico no es válido." });
    }

    try {
        // Buscar usuario por email
        const userResult = await pool.query(
            'SELECT id, username, email, password_reset_expires_at FROM users WHERE LOWER(email) = LOWER($1)',
            [normalizedEmail]
        );

        // Respuesta genérica (anti-enumeración): siempre devolvemos éxito
        // para no revelar si un email está registrado o no.
        if (userResult.rowCount === 0) {
            return res.status(200).json({ message: 'Si el correo está registrado, recibirás un código de recuperación.' });
        }

        const user = userResult.rows[0];

        // Cooldown: evitar spam de solicitudes (server-side)
        if (user.password_reset_expires_at) {
            const expiresAt = new Date(user.password_reset_expires_at);
            const now = new Date();
            const createdAt = new Date(expiresAt.getTime() - 10 * 60 * 1000);
            const secondsSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
            if (secondsSinceCreation < 60) {
                return res.status(200).json({ message: 'Si el correo está registrado, recibirás un código de recuperación.' });
            }
        }

        // Generar OTP y hash
        const otp = generateOtp6();
        const otpHash = hashOtpForEmail(normalizedEmail, otp);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

        // Guardar hash, expiración y resetear contador de intentos
        await pool.query(
            `UPDATE users SET password_reset_hash = $1, password_reset_expires_at = $2, password_reset_attempts = 0 WHERE id = $3`,
            [otpHash, expiresAt, user.id]
        );

        // [AUDIT] Registrar solicitud de recuperación
        await logAuditEvent(pool, req, {
            eventType: 'password_reset.requested',
            actorUsername: user.username,
            category: 'security',
            metadata: { email: normalizedEmail }
        });

        // Enviar OTP por email
        try {
            const ipRaw = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
            const ip = ipRaw.split(',')[0].trim();
            const requestedAt = new Date().toISOString();
            await sendOtpEmail({ toEmail: normalizedEmail, otp, context: { ip, requestedAt } });
        } catch (emailError) {
            console.error('Error al enviar OTP de recuperación (SES):', emailError);
        }

        res.status(200).json({ message: 'Si el correo está registrado, recibirás un código de recuperación.' });

    } catch (error) {
        console.error('Error en forgotPasswordRequest:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ============================================================================
// Recuperación de contraseña — Paso 2: Verificar OTP y establecer nueva contraseña
// ============================================================================
exports.forgotPasswordVerify = async (req, res) => {
    const { email, code, newPassword } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !code || !newPassword) {
        return res.status(400).json({ message: 'Email, código y nueva contraseña son requeridos.' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }

    try {
        // Buscar usuario por email (incluimos columnas de seguridad)
        const userResult = await pool.query(
            `SELECT id, username, email, password_reset_hash, password_reset_expires_at, password_reset_attempts
             FROM users WHERE LOWER(email) = LOWER($1)`,
            [normalizedEmail]
        );

        if (userResult.rowCount === 0) {
            return res.status(400).json({ message: 'Código de recuperación inválido o expirado.' });
        }

        const user = userResult.rows[0];

        // Verificar que existe un reset pendiente
        if (!user.password_reset_hash || !user.password_reset_expires_at) {
            return res.status(400).json({ message: 'Código de recuperación inválido o expirado.' });
        }

        // [MEJORA 1] Anti-bruteforce por usuario: máximo de intentos por OTP
        if ((user.password_reset_attempts || 0) >= MAX_PASSWORD_RESET_ATTEMPTS) {
            // Invalidar el OTP tras exceder intentos
            await pool.query(
                'UPDATE users SET password_reset_hash = NULL, password_reset_expires_at = NULL, password_reset_attempts = 0 WHERE id = $1',
                [user.id]
            );
            await logAuditEvent(pool, req, {
                eventType: 'password_reset.failed',
                actorUsername: user.username,
                category: 'security',
                metadata: { reason: 'max_attempts_exceeded', attempts: user.password_reset_attempts }
            });
            return res.status(400).json({ message: 'Demasiados intentos fallidos. El código ha sido invalidado. Solicita uno nuevo.' });
        }

        // Verificar expiración
        if (new Date() > new Date(user.password_reset_expires_at)) {
            await pool.query(
                'UPDATE users SET password_reset_hash = NULL, password_reset_expires_at = NULL, password_reset_attempts = 0 WHERE id = $1',
                [user.id]
            );
            return res.status(400).json({ message: 'El código de recuperación ha expirado. Solicita uno nuevo.' });
        }

        // Validar OTP con comparación timing-safe
        const expectedHash = hashOtpForEmail(normalizedEmail, String(code).trim());
        const otpIsValid = safeEqualHex(user.password_reset_hash, expectedHash);

        if (!otpIsValid) {
            // [MEJORA 1] Incrementar contador de intentos fallidos
            await pool.query(
                'UPDATE users SET password_reset_attempts = COALESCE(password_reset_attempts, 0) + 1 WHERE id = $1',
                [user.id]
            );
            const remainingAttempts = MAX_PASSWORD_RESET_ATTEMPTS - (user.password_reset_attempts || 0) - 1;
            await logAuditEvent(pool, req, {
                eventType: 'password_reset.failed',
                actorUsername: user.username,
                category: 'security',
                metadata: { reason: 'invalid_otp', attempts_used: (user.password_reset_attempts || 0) + 1 }
            });
            return res.status(400).json({
                message: remainingAttempts > 0
                    ? `Código incorrecto. Te quedan ${remainingAttempts} intento(s).`
                    : 'Código incorrecto. Se ha agotado el último intento. Solicita un nuevo código.'
            });
        }

        // ---- OTP VÁLIDO: Restablecer contraseña ----

        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
        const invalidateBefore = new Date(); // [MEJORA 2] Timestamp para invalidar sesiones anteriores

        await pool.query(
            `UPDATE users SET
                password_hash = $1,
                password_reset_hash = NULL,
                password_reset_expires_at = NULL,
                password_reset_attempts = 0,
                password_invalidate_before = $2
             WHERE id = $3`,
            [newPasswordHash, invalidateBefore, user.id]
        );

        // [MEJORA 3] Audit log de éxito
        await logAuditEvent(pool, req, {
            eventType: 'password_reset.success',
            actorUsername: user.username,
            category: 'security',
            metadata: { email: normalizedEmail }
        });

        // [MEJORA 4] Enviar email de notificación post-cambio de contraseña
        try {
            const ipRaw = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
            const ip = ipRaw.split(',')[0].trim();
            await sendTransactionEmail({
                toEmail: normalizedEmail,
                subject: '⚠️ Tu contraseña ha sido cambiada — WintonCoin',
                title: 'Contraseña actualizada',
                message: 'Tu contraseña de WintonCoin ha sido cambiada exitosamente. Si no fuiste tú quien realizó este cambio, contacta a soporte inmediatamente.',
                amount: null,
                details: [
                    { label: 'Cuenta', value: user.username },
                    { label: 'Fecha', value: new Date().toLocaleString('es-ES', { timeZone: 'America/Argentina/Buenos_Aires' }) },
                    { label: 'IP de origen', value: ip || 'Desconocida' },
                    { label: 'Acción requerida', value: 'Si no reconoces esta acción, contacta soporte@wintoncoin.com' }
                ]
            });
        } catch (emailError) {
            console.error('[AUTH] Error al enviar notificación post-reset:', emailError);
            // No interrumpimos el flujo por un fallo de email
        }

        console.log(`[AUTH] Contraseña restablecida exitosamente para usuario '${user.username}' (ID: ${user.id})`);

        res.status(200).json({ message: '¡Contraseña restablecida exitosamente! Ya puedes iniciar sesión con tu nueva contraseña.' });

    } catch (error) {
        console.error('Error en forgotPasswordVerify:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
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

    jwt.verify(token, jwtSecret, async (err, user) => {
        if (err) {
            return res.status(200).json({ isAuthenticated: false });
        }

        try {
            const client = await pool.connect();
            try {
                // Consultar is_verified (email OTP) y kyc_verified (KYC Web3)
                // kyc_verified es necesario para el mecanismo Hold & Release de
                // Winton Solidario (migraciones 055, 056, 068)
                const dbUser = await client.query(
                    'SELECT is_verified, kyc_verified, password_invalidate_before FROM users WHERE id = $1',
                    [user.userId]
                );
                if (dbUser.rows.length === 0) {
                    return res.status(200).json({ isAuthenticated: false });
                }

                // [SEGURIDAD] Verificar si el token fue emitido antes de un cambio de contraseña
                const row = dbUser.rows[0];
                if (row.password_invalidate_before) {
                    const invalidateBefore = new Date(row.password_invalidate_before);
                    const tokenIssuedAt = new Date((user.iat || 0) * 1000);
                    if (tokenIssuedAt < invalidateBefore) {
                        return res.status(200).json({ isAuthenticated: false, reason: 'SESSION_INVALIDATED' });
                    }
                }

                const legalStatus = await getUserLegalStatusByUserId(client, user.userId);

                res.status(200).json({
                    isAuthenticated: true,
                    is_verified: row.is_verified,
                    kyc_verified: row.kyc_verified, // NUEVO: KYC Web3 para Winton Solidario Hold & Release
                    username: user.username,
                    requires_terms_acceptance: legalStatus.requires_terms_acceptance,
                    pending_documents: legalStatus.pending_documents
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
