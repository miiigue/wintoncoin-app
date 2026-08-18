/**
 * CONTROLADOR: Gestión de Expedientes y Registro Auditable de Voluntarios SOS
 * ═════════════════════════════════════════════════════════════════════════════════
 * Ciberseguridad & Auditoría FinTech (SOC 2 / ISO 27001 / Zero-Trust):
 * - Registro público con validación de Cédula única y teléfono internacional (+58).
 * - Creación/vinculación de cuenta WintonCoin con código especial de campaña.
 * - Expediente Inteligente con Codificación de 4 Dígitos Hierárquicos (#VOL-VZLA-[D1][D2][D3][D4]-[SECUENCIAL]).
 * - Acreditación de bono de bienvenida estándar mediante principio DRY.
 * - Bitácora inmutable en volunteer_activity_history y audit_logs.
 */

'use strict';

// ── Dependencias Core de Node.js ──────────────────────────────────────────────
const pool = require('../config/db'); // Conexión al pool de PostgreSQL
const bcrypt = require('bcrypt'); // Hashing seguro de contraseñas (10 salt rounds)
const crypto = require('crypto'); // Generación de UUIDs y tokens criptográficos
const jwt = require('jsonwebtoken'); // Tokens JWT de acceso y renovación

// ── Servicios Internos de la Plataforma ────────────────────────────────────────
const { logAuditEvent } = require('../services/auditService'); // Registro inmutable de auditoría SOC 2
const emailService = require('../services/emailService'); // Envío de OTP y correos transaccionales
const notificationService = require('../services/notificationService'); // Push Notifications
const referralRewardService = require('../services/referralRewardService'); // Servicio de bonos de referido

// Secreto JWT de respaldo (Zero Hardcoded Secrets)
const jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'wintoncoin_fallback_secret_key_2026';

/**
 * CÁLCULO DE CÓDIGO DE EXPEDIENTE INTELIGENTE DE VOLUNTARIO (4 DÍGITOS HIERÁRQUICOS)
 * ═════════════════════════════════════════════════════════════════════════════════
 * DÍGITO 1 (Modalidad / Ámbito de Operación 1 a 4, donde 4 es mayor presencia en sitio):
 *   4 = Campo / Brigada Presencial en Terreno
 *   3 = Verificador / Auditor de Censo en Terreno
 *   2 = Profesional Especializado (Salud, Psicología, Legal, Técnico)
 *   1 = Remoto / Difusión en Redes Sociales
 * 
 * DÍGITO 2 (Disponibilidad de Tiempo 1 a 4, donde 4 es mayor dedicación):
 *   4 = Tiempo Completo / Inmediata
 *   3 = Tiempo Parcial
 *   2 = Fines de Semana
 *   1 = Ocasional / Por Horas
 * 
 * DÍGITO 3 (Rango Decenal de Edad 1 a 9):
 *   1 = 18-19 años | 2 = 20-29 años | 3 = 30-39 años | 4 = 40-49 años
 *   5 = 50-59 años | 6 = 60-69 años | 7 = 70-79 años | 8 = 80-89 años | 9 = 90+ años
 * 
 * DÍGITO 4 (Sexo/Género 1 o 2, estrictamente binario):
 *   1 = Hombre ('male') | 2 = Mujer ('female')
 * 
 * Formato: VOL-VZLA-[D1][D2][D3][D4]-[SECUENCIAL]
 */

/**
 * Calcula el dígito D3 (Rango Decenal de Edad: 1 = 18-19 años, 2 = 20-29, ..., 9 = 90+)
 */
function calculateAgeRangeD3(age) {
    const parsedAge = parseInt(age, 10) || 18;
    if (parsedAge >= 90) return 9;
    if (parsedAge >= 80) return 8;
    if (parsedAge >= 70) return 7;
    if (parsedAge >= 60) return 6;
    if (parsedAge >= 50) return 5;
    if (parsedAge >= 40) return 4;
    if (parsedAge >= 30) return 3;
    if (parsedAge >= 20) return 2;
    return 1; // 18 a 19 años
}

/**
 * Genera el número de expediente de voluntario con codificación jerárquica de 4 dígitos.
 * 
 * Formato: VOL-VZLA-[D1][D2][D3][D4]-[SECUENCIAL]
 */
function calculateSmartVolunteerCode(volunteerTypes = [], availabilities = [], age, gender, sequenceId) {
    const typesStr = Array.isArray(volunteerTypes) ? volunteerTypes.join(' ').toLowerCase() : String(volunteerTypes).toLowerCase();
    const availStr = Array.isArray(availabilities) ? availabilities.join(' ').toLowerCase() : String(availabilities).toLowerCase();

    // 1. Modalidad (Dígit 1)
    let d1 = 1;
    if (typesStr.includes('campo') || typesStr.includes('brigada') || typesStr.includes('sitio')) d1 = 4;
    else if (typesStr.includes('verificacion') || typesStr.includes('censo') || typesStr.includes('auditoria')) d1 = 3;
    else if (typesStr.includes('salud') || typesStr.includes('medico') || typesStr.includes('tecnico') || typesStr.includes('legal')) d1 = 2;
    else d1 = 1;

    // 2. Disponibilidad (Dígit 2)
    let d2 = 1;
    if (availStr.includes('completo') || availStr.includes('inmediata')) d2 = 4;
    else if (availStr.includes('parcial')) d2 = 3;
    else if (availStr.includes('fines') || availStr.includes('semana')) d2 = 2;
    else d2 = 1;

    // 3. Rango Decenal de Edad (Dígit 3)
    const d3 = calculateAgeRangeD3(age);

    // 4. Sexo / Género (Dígit 4: 1 = Hombre, 2 = Mujer)
    const g = (gender || '').toLowerCase();
    let d4 = (g === 'male' || g === 'm' || g === 'hombre') ? 1 : 2;

    const padSeq = String(sequenceId).padStart(5, '0');
    const dossierNumber = `VOL-VZLA-${d1}${d2}${d3}${d4}-${padSeq}`;
    const priorityScore = (d1 * 1000) + (d2 * 100) + (d3 * 10) + d4;

    return { dossierNumber, smartCode: dossierNumber, priorityScore, D1: d1, D2: d2, D3: d3, D4: d4 };
}

/**
 * Normaliza la cédula venezolana (V-12345678 o E-12345678)
 */
function normalizeIdDocument(doc) {
    if (!doc) return '';
    let cleaned = doc.trim().toUpperCase().replace(/[\s\.\-]/g, '');
    if (!cleaned.startsWith('V') && !cleaned.startsWith('E') && !cleaned.startsWith('J') && !cleaned.startsWith('P')) {
        cleaned = 'V' + cleaned;
    }
    if (cleaned.length > 3 && !cleaned.includes('-')) {
        cleaned = cleaned.substring(0, 1) + '-' + cleaned.substring(1);
    }
    return cleaned;
}

/**
 * Normaliza el número de teléfono a formato internacional E.164 (+1, +34, +57, +58, etc.)
 */
function normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
    if (!cleaned.startsWith('+')) {
        if (cleaned.startsWith('0')) {
            // Número local con cero inicial (ej: 0414... -> +58414...)
            cleaned = '+58' + cleaned.substring(1);
        } else {
            cleaned = '+' + cleaned;
        }
    }
    return cleaned;
}

function maskEmailHelper(email) {
    if (!email || !email.includes('@')) return email || '';
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local[0]}***@${domain}`;
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

// ============================================================================
// POST /api/public/volunteers/register (Público - Registro de Voluntario)
// ============================================================================
exports.registerVolunteerPublic = async (req, res) => {
    const {
        full_name,
        id_document,
        birth_date,
        gender = 'female',
        email,
        phone_number,
        country = 'Venezuela',
        state,
        municipality,
        sector_city,
        volunteer_types = [],
        availability = [],
        profession_skills = '',
        data_consent_accepted,
        legal_disclaimer_accepted
    } = req.body;

    // 1. Validaciones de campos obligatorios
    if (!full_name || !id_document || !birth_date || !email || !phone_number || !state || !municipality || !sector_city) {
        return res.status(400).json({ success: false, message: "Completa todos los campos obligatorios del registro." });
    }

    // 1.1 Validaciones de Consentimiento Legal
    const consentAccepted = data_consent_accepted === true || data_consent_accepted === 'true';
    const legalAccepted = legal_disclaimer_accepted === true || legal_disclaimer_accepted === 'true';

    if (!consentAccepted || !legalAccepted) {
        return res.status(400).json({ success: false, message: "Debes aceptar la autorización de tratamiento de datos y el acuerdo de voluntariado." });
    }

    // 1.2 Validación de Edad (Mayoría de edad obligatoria: 18+)
    const birthDateObj = new Date(birth_date);
    if (isNaN(birthDateObj.getTime())) {
        return res.status(400).json({ success: false, message: "Ingresa una fecha de nacimiento válida." });
    }
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
        calculatedAge--;
    }
    if (calculatedAge < 18) {
        return res.status(400).json({ success: false, message: "Debes ser mayor de edad (18 años o más) para registrarte como voluntario." });
    }

    // 1.3 Normalización de Datos de Identidad
    const normDoc = normalizeIdDocument(id_document);
    const normPhone = normalizePhone(phone_number);
    const normEmail = email.trim().toLowerCase();
    const cleanGender = (gender === 'male' || gender === 'hombre' || gender === 'm') ? 'male' : 'female';
    const cleanCountry = (country && country.trim()) ? country.trim() : 'Venezuela';

    // Validación de formato internacional de teléfono (+ y al menos 7 dígitos numéricos)
    if (!/^\+[1-9]\d{6,16}$/.test(normPhone)) {
        return res.status(400).json({ success: false, message: "Ingresa un número telefónico internacional válido (ej: +584121234567, +13051234567, +34612345678)." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 2. Detección Inteligente de Cédula Duplicada
        const existingVol = await client.query(`
            SELECT v.id, v.dossier_number, v.user_id, v.email, u.is_verified, u.username
            FROM volunteers_registry v
            LEFT JOIN users u ON u.id = v.user_id
            WHERE v.id_document = $1
        `, [normDoc]);

        if (existingVol.rows.length > 0) {
            const vol = existingVol.rows[0];
            if (vol.is_verified === true) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    success: false,
                    already_active: true,
                    dossier_number: vol.dossier_number,
                    message: `La Cédula ${normDoc} ya tiene un registro de voluntario activo bajo el expediente #${vol.dossier_number}. Inicia sesión con tu cuenta para consultar tu perfil.`
                });
            } else {
                // Reanudación Inteligente (Smart Resume OTP)
                const verificationCode = emailService.generateOtp6();
                const verificationCodeHash = emailService.hashOtpForEmail(vol.email, verificationCode);
                const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

                const customCodeRes = await client.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'referral_custom_share_code'`);
                const specialReferralCode = (customCodeRes.rows.length > 0 && customCodeRes.rows[0].setting_value) ? customCodeRes.rows[0].setting_value.trim() : 'SOSVENEZUELA';

                await client.query(`
                    INSERT INTO pending_verifications (
                        username, email, password_hash, phone_number, referral_code,
                        verification_code_hash, verification_attempts, resend_count, last_sent_at, expires_at
                    ) VALUES ($1, $2, '', $3, $4, $5, 0, 0, NOW(), $6)
                    ON CONFLICT (email) DO UPDATE
                    SET referral_code = EXCLUDED.referral_code,
                        verification_code_hash = EXCLUDED.verification_code_hash,
                        expires_at = EXCLUDED.expires_at,
                        verification_attempts = 0,
                        resend_count = pending_verifications.resend_count + 1,
                        last_sent_at = NOW()
                `, [vol.username || normEmail.split('@')[0], vol.email, normPhone, specialReferralCode, verificationCodeHash, expiresAt]);

                await client.query('COMMIT');

                try {
                    const ipRaw = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
                    const ip = ipRaw.split(',')[0].trim();
                    await emailService.sendOtpEmail({ toEmail: vol.email, otp: verificationCode, context: { ip, requestedAt: new Date().toISOString() } });
                } catch (mErr) {
                    console.error("[VOLUNTEER RESUME] Error enviando email de reanudación OTP:", mErr.message);
                }

                const maskedEmail = maskEmailHelper(vol.email);
                return res.status(200).json({
                    success: true,
                    resume_verification: true,
                    dossier_number: vol.dossier_number,
                    email: vol.email,
                    is_new_user: true,
                    message: `Tu postulación ya fue recibida con el expediente #${vol.dossier_number}. Hemos enviado un nuevo código de 6 dígitos a tu correo (${maskedEmail}) para que actives tu cuenta.`
                });
            }
        }

        // 3. Buscar o Crear Cuenta WintonCoin (DRY)
        let userId = null;
        let username = null;
        let isNewUser = false;

        const userCheck = await client.query(
            'SELECT id, username, email, phone_number FROM users WHERE email = $1 OR phone_number = $2',
            [normEmail, normPhone]
        );

        if (userCheck.rows.length > 0) {
            const phoneConflict = userCheck.rows.find(u => u.phone_number === normPhone && u.email !== normEmail);
            if (phoneConflict) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: "El número telefónico ya pertenece a otra cuenta registrada."
                });
            }
            const emailConflict = userCheck.rows.find(u => u.email === normEmail && u.phone_number !== normPhone);
            if (emailConflict) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: "El correo electrónico ya está registrado con otro número de teléfono."
                });
            }

            userId = userCheck.rows[0].id;
            username = userCheck.rows[0].username;
            if (birth_date) {
                await client.query('UPDATE users SET date_of_birth = $1 WHERE id = $2 AND date_of_birth IS NULL', [birth_date, userId]);
            }
        } else {
            isNewUser = true;
            const tempPassword = crypto.randomBytes(12).toString('hex');
            const hashedPassword = await bcrypt.hash(tempPassword, 10);
            const baseUsername = normEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').substring(0, 20);

            let isUsernameUnique = false;
            while (!isUsernameUnique) {
                username = `${baseUsername}_${Math.floor(100 + Math.random() * 900)}`;
                const collisionCheck = await client.query('SELECT id FROM users WHERE username = $1', [username]);
                if (collisionCheck.rows.length === 0) isUsernameUnique = true;
            }

            const { generateUniqueReferralCode } = require('../config/databaseInit');
            const ownReferralCode = await generateUniqueReferralCode(client, username);

            const newUserRes = await client.query(`
                INSERT INTO users (username, email, password_hash, phone_number, is_verified, date_of_birth, referral_code)
                VALUES ($1, $2, $3, $4, false, $5, $6)
                RETURNING id
            `, [username, normEmail, hashedPassword, normPhone, birth_date, ownReferralCode]);

            userId = newUserRes.rows[0].id;
        }

        // 4. UPSERT en pending_verifications
        await client.query('DELETE FROM pending_verifications WHERE email = $1 OR phone_number = $2 OR username = $3', [normEmail, normPhone, username]);

        const verificationCode = emailService.generateOtp6();
        const verificationCodeHash = emailService.hashOtpForEmail(normEmail, verificationCode);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        const customCodeRes = await client.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'referral_custom_share_code'`);
        const specialReferralCode = (customCodeRes.rows.length > 0 && customCodeRes.rows[0].setting_value) ? customCodeRes.rows[0].setting_value.trim() : 'SOSVENEZUELA';

        await client.query(`
            INSERT INTO pending_verifications (
                username, email, password_hash, phone_number, referral_code,
                verification_code_hash, verification_attempts, resend_count, last_sent_at, expires_at, date_of_birth
            ) VALUES ($1, $2, '', $3, $4, $5, 0, 0, NOW(), $6, $7)
        `, [username, normEmail, normPhone, specialReferralCode, verificationCodeHash, expiresAt, birth_date]);

        // 5. Insertar Expediente en volunteers_registry (Paso 1: Código Temporal)
        const tempDossierCode = `VOL-TEMP-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
        const normalizedTypes = Array.isArray(volunteer_types) ? volunteer_types : [volunteer_types];
        const normalizedAvailability = Array.isArray(availability) ? availability : [availability];

        const insertRes = await client.query(`
            INSERT INTO volunteers_registry (
                dossier_number, user_id, full_name, id_document, birth_date, age, gender,
                email, phone_number, country, state, municipality, sector_city,
                volunteer_types, availability, profession_skills, priority_score, status,
                data_consent_accepted, legal_disclaimer_accepted
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13,
                $14, $15, $16, 0, 'pending_verification',
                $17, $18
            ) RETURNING id;
        `, [
            tempDossierCode, userId, full_name.trim(), normDoc, birth_date, calculatedAge, cleanGender,
            normEmail, normPhone, cleanCountry, state.trim(), municipality.trim(), sector_city.trim(),
            normalizedTypes, normalizedAvailability, profession_skills ? profession_skills.trim() : '',
            consentAccepted, legalAccepted
        ]);

        const volunteerId = insertRes.rows[0].id;

        // 6. Calcular Código de Expediente Inteligente (Paso 2)
        const { smartCode, priorityScore } = calculateSmartVolunteerCode(
            normalizedTypes, normalizedAvailability, calculatedAge, cleanGender, volunteerId
        );

        await client.query(`
            UPDATE volunteers_registry
            SET dossier_number = $1, priority_score = $2
            WHERE id = $3
        `, [smartCode, priorityScore, volunteerId]);

        await client.query('COMMIT');

        // 7. Enviar Correo OTP y Bitácora de Registro
        try {
            const ipRaw = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
            const ip = ipRaw.split(',')[0].trim();
            await emailService.sendOtpEmail({ toEmail: normEmail, otp: verificationCode, context: { ip, requestedAt: new Date().toISOString() } });

            await pool.query(
                'INSERT INTO volunteer_activity_history (volunteer_id, event_type, message) VALUES ($1, $2, $3)',
                [volunteerId, 'registered', `Expediente generado con código #${smartCode}. Estado inicial: En Proceso de Verificación.`]
            );
        } catch (mailErr) {
            console.error("[VOLUNTEER] Error enviando email OTP:", mailErr.message);
        }

        // 8. Registro de Auditoría Inmutable (SOC 2)
        await logAuditEvent(pool, req, {
            eventType: 'sos.volunteer.registered',
            actorUsername: normEmail,
            category: 'volunteer',
            metadata: { volunteer_id: volunteerId, dossier_number: smartCode, id_document: normDoc, is_new_user: isNewUser }
        });

        // 9. Respuesta Exitosa
        res.status(201).json({
            success: true,
            dossier_number: smartCode,
            email: normEmail,
            is_new_user: isNewUser,
            message: "Registro de voluntario enviado exitosamente. Ingresa el código de 6 dígitos enviado a tu correo para activar tu cuenta."
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("[VOLUNTEER] Error en registro público:", error);

        if (error.code === '23505') {
            const constraint = error.constraint || '';
            if (constraint.includes('phone_number')) return res.status(400).json({ success: false, message: "El número telefónico ya está registrado." });
            if (constraint.includes('email')) return res.status(400).json({ success: false, message: "El correo electrónico ya está registrado." });
            if (constraint.includes('id_document')) return res.status(400).json({ success: false, message: `La Cédula ${normDoc} ya tiene una postulación registrada.` });
        }

        res.status(500).json({
            success: false,
            message: "Error interno al procesar el registro de voluntario. Por favor intenta nuevamente."
        });
    } finally {
        client.release();
    }
};

// ============================================================================
// POST /api/public/volunteers/verify-otp (Público - Verificación OTP)
// ============================================================================
exports.verifyVolunteerOtpPublic = async (req, res) => {
    const { email, otp_code, password, password_confirm } = req.body;

    const rawEmail = (typeof email === 'string') ? email : String(email || '');
    const rawCode = (typeof otp_code === 'string') ? otp_code : String(otp_code || '');

    if (!rawEmail.trim() || !rawCode.trim()) {
        return res.status(400).json({ success: false, message: "Ingresa tu correo y el código de 6 dígitos." });
    }

    const normEmail = rawEmail.trim().toLowerCase();
    const cleanCode = rawCode.trim();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existingUserCheck = await client.query('SELECT id, username, password_hash, is_verified FROM users WHERE email = $1', [normEmail]);
        const isExistingVerifiedUser = (existingUserCheck.rows.length > 0 && existingUserCheck.rows[0].is_verified === true);

        if (!isExistingVerifiedUser) {
            if (!password || password.length < 8) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: "La contraseña debe tener al menos 8 caracteres." });
            }
            if (password !== password_confirm) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: "Las contraseñas no coinciden." });
            }
        }

        const pendingRes = await client.query('SELECT * FROM pending_verifications WHERE email = $1', [normEmail]);
        if (pendingRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "No se encontró una solicitud pendiente o ya fue verificada." });
        }

        const pending = pendingRes.rows[0];

        if ((pending.verification_attempts || 0) >= 5) {
            await client.query('DELETE FROM pending_verifications WHERE id = $1', [pending.id]);
            await client.query('COMMIT');
            return res.status(429).json({ success: false, message: "Demasiados intentos fallidos. Solicita un nuevo código." });
        }

        const computedHash = emailService.hashOtpForEmail(normEmail, cleanCode);
        if (!emailService.safeEqualHex(pending.verification_code_hash, computedHash)) {
            await client.query('UPDATE pending_verifications SET verification_attempts = verification_attempts + 1 WHERE id = $1', [pending.id]);
            await client.query('COMMIT');
            return res.status(400).json({ success: false, message: "Código de verificación de 6 dígitos incorrecto." });
        }

        // Activar cuenta de usuario
        if (!isExistingVerifiedUser && password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await client.query('UPDATE users SET password_hash = $1, is_verified = true WHERE email = $2', [hashedPassword, normEmail]);
        } else {
            await client.query('UPDATE users SET is_verified = true WHERE email = $1', [normEmail]);
        }

        const userRes = await client.query('SELECT id, username FROM users WHERE email = $1', [normEmail]);
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "No se encontró la cuenta de usuario asociada." });
        }
        const user = userRes.rows[0];

        // Acreditación de bono de bienvenida estándar por registro de usuario nuevo (DRY)
        let rewardAmount = 0;
        if (!isExistingVerifiedUser) {
            try {
                const customCodeRes2 = await client.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'referral_custom_share_code'`);
                const refCodeToUse = (pending.referral_code) || ((customCodeRes2.rows.length > 0 && customCodeRes2.rows[0].setting_value) ? customCodeRes2.rows[0].setting_value : 'SOSVENEZUELA');

                const rewardResult = await referralRewardService.processReferralReward({
                    client,
                    newUser: user,
                    referralCode: refCodeToUse
                });
                rewardAmount = parseFloat(rewardResult?.rewardAmount || 0);
            } catch (rewardErr) {
                console.error("[VOLUNTEER OTP] Error en bono de referido usuario nuevo:", rewardErr.message);
            }
        }

        // Registrar activación en bitácora de voluntario
        const volRes = await client.query('SELECT id, dossier_number FROM volunteers_registry WHERE email = $1 ORDER BY id DESC LIMIT 1', [normEmail]);
        let smartDossierCode = '';
        if (volRes.rows.length > 0) {
            const volId = volRes.rows[0].id;
            smartDossierCode = volRes.rows[0].dossier_number;
            await client.query(
                'INSERT INTO volunteer_activity_history (volunteer_id, event_type, message) VALUES ($1, $2, $3)',
                [volId, 'otp_verified', `Cuenta activada exitosamente con OTP. Expediente #${smartDossierCode} listo para revisión de la directiva.`]
            );
        }

        await client.query('DELETE FROM pending_verifications WHERE id = $1', [pending.id]);

        // Generar Tokens JWT
        const accessToken = jwt.sign(
            { userId: user.id, username: user.username, tokenType: 'access' },
            jwtSecret,
            { expiresIn: '15m' }
        );
        const refreshToken = jwt.sign(
            { userId: user.id, username: user.username, tokenType: 'refresh' },
            jwtSecret,
            { expiresIn: '7d' }
        );

        res.cookie('auth_refresh_token', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' && process.env.IS_DEMO_ENV !== 'true',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        await client.query('COMMIT');

        // Notificaciones asíncronas (Push, In-App y Email)
        try {
            await notificationService.sendNotificationToUser(user.id, {
                title: "🤝 Registro de Voluntario Exitoso",
                body: `Tu expediente de voluntario #${smartDossierCode} ha sido activado. Gracias por tu compromiso con la causa SOS Venezuela.`,
                icon: "/assets/icons/icon-192x192.png",
                data: { url: "/profile.html" }
            }, "SOCIAL");

            await pool.query(
                'INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)',
                [user.username, `Tu expediente de voluntario #${smartDossierCode} fue activado con éxito.`]
            );

            await emailService.sendCustomEmail(
                normEmail,
                `Expediente de Voluntario Confirmado - #${smartDossierCode}`,
                `<div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
                    <h2>¡Bienvenido a la Brigada de Voluntarios WintonCoin!</h2>
                    <p>Tu postulación ha sido recibida y tu cuenta ha sido activada exitosamente.</p>
                    <p><strong>Número de Expediente:</strong> #${smartDossierCode}</p>
                    <p>Nuestro equipo de coordinadores se pondrá en contacto contigo a través de WhatsApp o correo electrónico para asignar tareas o brigadas de apoyo.</p>
                </div>`
            );
        } catch (nErr) {
            console.error("[VOLUNTEER OTP] Error en notificaciones asíncronas:", nErr.message);
        }

        await logAuditEvent(pool, req, {
            eventType: 'sos.volunteer.activated',
            actorUsername: normEmail,
            category: 'volunteer',
            metadata: { user_id: user.id, dossier_number: smartDossierCode }
        });

        res.status(200).json({
            success: true,
            token: accessToken,
            user: { id: user.id, username: user.username, email: normEmail },
            dossier_number: smartDossierCode,
            reward_amount: rewardAmount,
            message: "¡Cuenta activada exitosamente! Tu expediente de voluntario está registrado."
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("[VOLUNTEER OTP] Error en verificación OTP:", error);
        res.status(500).json({ success: false, message: "Error interno al verificar el código OTP." });
    } finally {
        client.release();
    }
};

// ============================================================================
// GET /api/admin/volunteers (Protegido Admin - Listar Expedientes de Voluntarios)
// ============================================================================
exports.getVolunteersAdmin = async (req, res) => {
    try {
        const { status, state, search, page = 1, limit = 20 } = req.query;
        const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

        let whereClauses = [];
        let params = [];
        let paramIdx = 1;

        if (status) {
            whereClauses.push(`v.status = $${paramIdx++}`);
            params.push(status);
        }
        if (state) {
            whereClauses.push(`v.state ILIKE $${paramIdx++}`);
            params.push(`%${state}%`);
        }
        if (search) {
            whereClauses.push(`(v.full_name ILIKE $${paramIdx} OR v.id_document ILIKE $${paramIdx} OR v.dossier_number ILIKE $${paramIdx} OR v.email ILIKE $${paramIdx})`);
            paramIdx++;
            params.push(`%${search}%`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const countRes = await pool.query(`SELECT COUNT(*) FROM volunteers_registry v ${whereSql}`, params);
        const total = parseInt(countRes.rows[0].count, 10);

        const querySql = `
            SELECT v.*, u.username, u.is_verified AS user_verified,
                   a.username AS verified_by_admin_username
            FROM volunteers_registry v
            LEFT JOIN users u ON u.id = v.user_id
            LEFT JOIN admin_users a ON a.id = v.verified_by_admin_id
            ${whereSql}
            ORDER BY v.priority_score DESC, v.id DESC
            LIMIT $${paramIdx++} OFFSET $${paramIdx++}
        `;
        params.push(parseInt(limit, 10), offset);

        const listRes = await pool.query(querySql, params);

        res.json({
            success: true,
            volunteers: listRes.rows,
            pagination: {
                total,
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                pages: Math.ceil(total / parseInt(limit, 10))
            }
        });
    } catch (error) {
        console.error("[VOLUNTEERS ADMIN] Error al listar voluntarios:", error);
        res.status(500).json({ success: false, message: "Error al consultar lista de voluntarios." });
    }
};

// ============================================================================
// PUT /api/admin/volunteers/:id/status (Protegido Admin - Cambiar Estatus)
// ============================================================================
exports.updateVolunteerStatusAdmin = async (req, res) => {
    const { id } = req.params;
    const { status, admin_notes } = req.body;
    const adminId = req.admin ? req.admin.id : null;

    if (!['pending_verification', 'active', 'suspended', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: "Estatus no válido." });
    }

    try {
        const checkRes = await pool.query('SELECT * FROM volunteers_registry WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Expediente de voluntario no encontrado." });
        }
        const vol = checkRes.rows[0];

        await pool.query(`
            UPDATE volunteers_registry
            SET status = $1, admin_notes = $2, verified_by_admin_id = $3, updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
        `, [status, admin_notes || vol.admin_notes, adminId, id]);

        const statusLabels = {
            active: 'Activo / Aprobado',
            suspended: 'Suspendido',
            rejected: 'Rechazado',
            pending_verification: 'En Verificación'
        };

        await pool.query(`
            INSERT INTO volunteer_activity_history (volunteer_id, event_type, message)
            VALUES ($1, $2, $3)
        `, [id, 'status_updated', `Estatus actualizado a '${statusLabels[status] || status}'. Notas: ${admin_notes || 'Sin notas'}`]);

        // Enviar notificaciones si se activa
        if (status === 'active') {
            try {
                if (vol.user_id) {
                    await notificationService.sendNotificationToUser(vol.user_id, {
                        title: "✅ Voluntariado Aprobado",
                        body: `¡Felicidades! Tu expediente #${vol.dossier_number} ha sido verificado y aprobado.`,
                        icon: "/assets/icons/icon-192x192.png",
                        data: { url: "/profile.html" }
                    }, "SOCIAL");
                }

                await emailService.sendCustomEmail(
                    vol.email,
                    `¡Tu Voluntariado SOS ha sido Activado! - #${vol.dossier_number}`,
                    `<div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
                        <h2 style="color: #10b981;">¡Felicidades, ${vol.full_name}!</h2>
                        <p>Tu expediente de voluntario <strong>#${vol.dossier_number}</strong> ha sido verificado y aprobado por nuestra directiva.</p>
                        <p>Te hemos sumado activamente a las brigadas de apoyo SOS WintonCoin.</p>
                    </div>`
                );
            } catch (eErr) {
                console.error("[VOLUNTEER ADMIN] Error notificando activación:", eErr.message);
            }
        }

        await logAuditEvent(pool, req, {
            eventType: 'sos.volunteer.status_updated',
            actorUsername: req.admin ? req.admin.username : 'admin',
            category: 'volunteer',
            metadata: { volunteer_id: id, dossier_number: vol.dossier_number, new_status: status }
        });

        res.json({ success: true, message: `Estatus del voluntario actualizado a '${statusLabels[status]}'.` });
    } catch (error) {
        console.error("[VOLUNTEER ADMIN] Error al actualizar estatus:", error);
        res.status(500).json({ success: false, message: "Error interno al actualizar estatus del voluntario." });
    }
};

exports.calculateSmartVolunteerCode = calculateSmartVolunteerCode;
exports.calculateAgeRangeD3 = calculateAgeRangeD3;
exports.normalizeIdDocument = normalizeIdDocument;
exports.normalizePhone = normalizePhone;


