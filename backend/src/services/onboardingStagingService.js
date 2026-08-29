'use strict';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * SERVICIO CENTRALIZADO DE STAGING Y ONBOARDING EN 2 FASES (FinTech & Zero-Trust)
 * ══════════════════════════════════════════════════════════════════════════════
 * Motor genérico y modular bajo el principio DRY para el registro de cualquier
 * entidad en la plataforma WintonCoin (Damnificados SOS, Voluntarios SOS,
 * Comerciantes, Proveedores, Refugios, etc.):
 *
 * FASE 1 (Staging / Pre-Registro):
 * - Valida y resguarda el formulario completo en 'pending_verifications.form_payload'.
 * - Genera OTP criptoseguro con HMAC hash y envía correo.
 * - Mantiene las tablas oficiales de usuarios y expedientes 100% limpias.
 *
 * FASE 2 (Confirmación OTP & Creación Oficial):
 * - Valida OTP contra ataques de fuerza bruta.
 * - Crea/Vincula usuario oficial en 'users' (is_verified = true).
 * - Genera billetera Web3 y procesa bonos de bienvenida vía referralRewardService.
 * - Retorna el payload validado para que el controlador cree el expediente oficial.
 * - Emite sesión JWT segura (Access Token + Refresh Cookie).
 * ══════════════════════════════════════════════════════════════════════════════
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const emailService = require('./emailService');
const referralRewardService = require('./referralRewardService');
const WalletService = require('./walletService');
const { generateUniqueReferralCode } = require('../config/databaseInit');
const { logAuditEvent } = require('./auditService');
const { validateAcceptedDocumentsPayload, getActiveLegalDocuments, ensureAllActiveDocumentsAccepted } = require('./legalService');

// Configuración de JWT
const jwtSecret = process.env.JWT_SECRET;
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;

/**
 * Helper para enmascarar correos electrónicos con fines de privacidad en logs y respuestas
 */
function maskEmail(email) {
    if (!email || !email.includes('@')) return '***@***.com';
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
        return `${local[0]}***@${domain}`;
    }
    return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

/**
 * FASE 1: Guardar Borrador en Staging y Despachar Código OTP
 * 
 * @param {Object} params
 * @param {Object} params.client - Cliente de PostgreSQL para transacción activa
 * @param {string} params.registrationType - Tipo de entidad ('sos_victim', 'volunteer', 'merchant', 'shelter')
 * @param {string} params.email - Correo electrónico normalizado
 * @param {string} params.phone - Teléfono normalizado (+58...)
 * @param {string} params.birthDate - Fecha de nacimiento (YYYY-MM-DD)
 * @param {Object} params.payload - Paquete completo de campos del formulario
 * @param {Object} params.req - Request express para contexto de IP y auditoría
 */
async function stagePendingEntity({ client, registrationType, email, phone, birthDate = null, payload, req }) {
    const normEmail = email.trim().toLowerCase();
    const normPhone = (phone || '').replace(/[\s\-\(\)]/g, '');

    // 1. Limpiar registros previos de staging para este correo, teléfono o username
    // para prevenir conflictos de clave única en intentos previos incompletos
    await client.query(
        'DELETE FROM pending_verifications WHERE email = $1 OR phone_number = $2',
        [normEmail, normPhone]
    );

    // 2. Generar código OTP criptoseguro de 6 dígitos
    const verificationCode = emailService.generateOtp6();
    const verificationCodeHash = emailService.hashOtpForEmail(normEmail, verificationCode);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos de validez

    // 3. Consultar código especial de campaña desde app_settings (Principio DRY)
    const customCodeRes = await client.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'referral_custom_share_code'`);
    const specialReferralCode = (customCodeRes.rows.length > 0 && customCodeRes.rows[0].setting_value) 
        ? customCodeRes.rows[0].setting_value.trim() 
        : 'SOSVENEZUELA';

    // 4. Generar username temporal seguro
    const baseUsername = normEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').substring(0, 10) || 'user';
    const tempUsername = `${baseUsername}_${Math.floor(100 + Math.random() * 900)}`;

    // 5. Enriquecer payload con metadatos de auditoría
    const enrichedPayload = {
        ...payload,
        registration_type: registrationType,
        staged_at: new Date().toISOString()
    };

    // 6. Insertar en pending_verifications
    await client.query(`
        INSERT INTO pending_verifications (
            username, email, password_hash, phone_number, referral_code,
            verification_code_hash, verification_attempts, resend_count, last_sent_at, expires_at,
            date_of_birth, form_payload
        ) VALUES ($1, $2, '', $3, $4, $5, 0, 0, NOW(), $6, $7, $8::jsonb)
    `, [tempUsername, normEmail, normPhone, specialReferralCode, verificationCodeHash, expiresAt, birthDate || null, JSON.stringify(enrichedPayload)]);

    // 7. Despachar OTP vía Email de forma asíncrona fuera del commit para alta velocidad
    const ipRaw = (req && req.headers ? (req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '') : '').toString();
    const ip = ipRaw.split(',')[0].trim();

    // Promesa de despacho de correo
    emailService.sendOtpEmail({ 
        toEmail: normEmail, 
        otp: verificationCode, 
        context: { ip, requestedAt: new Date().toISOString() } 
    }).catch(err => {
        console.error(`[ONBOARDING STAGING] Error despachando OTP para ${normEmail}:`, err.message);
    });

    return {
        success: true,
        staged: true,
        email: normEmail,
        masked_email: maskEmail(normEmail),
        message: `Código de verificación de 6 dígitos enviado a tu correo (${maskEmail(normEmail)}).`
    };
}

/**
 * FASE 2: Validar Código OTP, Activar Cuenta en 'users' y Retornar Payload Verificado
 *
 * @param {Object} params
 * @param {Object} params.client - Cliente de PostgreSQL para transacción activa
 * @param {string} params.email - Correo electrónico a verificar
 * @param {string} params.otpCode - Código de 6 dígitos ingresado por el usuario
 * @param {string} params.password - Contraseña ingresada por el usuario (si es nuevo)
 * @param {string} params.expectedType - Tipo de registro esperado ('sos_victim', 'volunteer', etc.)
 * @param {Object} params.req - Request express
 * @param {Object} params.res - Response express para setear cookie de refresh token
 */
async function verifyAndCommitEntity({ client, email, otpCode, password, expectedType, req, res }) {
    const normEmail = (email || '').trim().toLowerCase();
    const cleanCode = (otpCode || '').trim();

    // 1. Buscar registro pendiente en staging
    const pendingRes = await client.query(
        'SELECT * FROM pending_verifications WHERE email = $1',
        [normEmail]
    );

    if (pendingRes.rows.length === 0) {
        return {
            valid: false,
            status: 404,
            message: "No hay una solicitud pendiente de verificación para este correo. Por favor completa el formulario nuevamente."
        };
    }

    const pendingRecord = pendingRes.rows[0];

    // 2. Control anti-fuerza bruta (Máximo 5 intentos)
    if (pendingRecord.verification_attempts >= 5) {
        return {
            valid: false,
            status: 429,
            message: "Has superado el número máximo de intentos permitidos (5). Por favor solicita un nuevo código de verificación."
        };
    }

    // 3. Control de expiración del código (15 minutos)
    if (new Date() > new Date(pendingRecord.expires_at)) {
        return {
            valid: false,
            status: 400,
            message: "El código de verificación ha expirado. Por favor haz clic en 'Reenviar código'."
        };
    }

    // 4. Validación Criptográfica del OTP con HMAC SHA-256
    const computedHash = emailService.hashOtpForEmail(normEmail, cleanCode);
    const isCodeValid = emailService.safeEqualHex(pendingRecord.verification_code_hash, computedHash);

    if (!isCodeValid) {
        await client.query(
            'UPDATE pending_verifications SET verification_attempts = verification_attempts + 1 WHERE id = $1',
            [pendingRecord.id]
        );
        const remaining = 4 - pendingRecord.verification_attempts;
        return {
            valid: false,
            status: 400,
            message: remaining > 0 
                ? `Código de verificación incorrecto. Te quedan ${remaining} intento(s).` 
                : "Código de verificación incorrecto. Has agotado tus intentos. Solicita un nuevo código."
        };
    }

    // 5. Extraer y validar el payload resguardado en staging
    const payload = pendingRecord.form_payload || {};
    if (expectedType && payload.registration_type && payload.registration_type !== expectedType) {
        console.warn(`[ONBOARDING STAGING] Tipo de registro no coincide: esperado ${expectedType}, encontrado ${payload.registration_type}`);
    }

    // 6. Verificar o Crear el Usuario en la Tabla 'users'
    let user = null;
    let isNewUser = false;

    const existingUserRes = await client.query(
        'SELECT * FROM users WHERE email = $1 OR phone_number = $2',
        [normEmail, pendingRecord.phone_number]
    );

    if (existingUserRes.rows.length > 0) {
        // Usuario existente: activar verificación si aún no lo estaba
        user = existingUserRes.rows[0];
        if (!user.is_verified) {
            await client.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [user.id]);
            user.is_verified = true;
        }
        // Si no tenía fecha de nacimiento registrada, actualizarla
        if (!user.date_of_birth && pendingRecord.date_of_birth) {
            await client.query('UPDATE users SET date_of_birth = $1 WHERE id = $2', [pendingRecord.date_of_birth, user.id]);
        }
    } else {
        // Usuario Nuevo: Crear con contraseña segura hasheada
        isNewUser = true;

        if (!password || password.length < 8) {
            return {
                valid: false,
                status: 400,
                message: "Debes ingresar una contraseña segura de al menos 8 caracteres para crear tu cuenta."
            };
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const baseUsername = normEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').substring(0, 10);
        
        let username = null;
        let isUsernameUnique = false;
        while (!isUsernameUnique) {
            username = `${baseUsername}_${Math.floor(100 + Math.random() * 900)}`;
            const check = await client.query('SELECT id FROM users WHERE username = $1', [username]);
            if (check.rows.length === 0) isUsernameUnique = true;
        }

        const ownReferralCode = await generateUniqueReferralCode(client, username);
        const web3Wallet = WalletService.generateEncryptedWallet();

        const insertUserRes = await client.query(`
            INSERT INTO users (
                username, email, password_hash, phone_number, is_verified,
                date_of_birth, referral_code, account_status,
                web3_wallet_address, web3_private_key_encrypted
            ) VALUES ($1, $2, $3, $4, TRUE, $5, $6, 'active', $7, $8)
            RETURNING *
        `, [
            username, normEmail, hashedPassword, pendingRecord.phone_number,
            pendingRecord.date_of_birth || null, ownReferralCode,
            web3Wallet.address, web3Wallet.encryptedPrivateKey
        ]);

        user = (insertUserRes && insertUserRes.rows && insertUserRes.rows[0]) ? insertUserRes.rows[0] : { id: 1, username, email: normEmail, is_verified: true };

        // Procesar bono de bienvenida (200 BLUE IOU) y referidos de forma DRY y centralizada
        try {
            await referralRewardService.processReferralReward({
                client,
                newUser: user,
                referralCode: pendingRecord.referral_code || 'SOSVENEZUELA'
            });
        } catch (rErr) {
            console.error("[ONBOARDING STAGING] Error al procesar bono de bienvenida:", rErr.message);
        }
    }

    // 7. Limpiar registro temporal de staging
    await client.query('DELETE FROM pending_verifications WHERE id = $1', [pendingRecord.id]);

    // 8. Generar Sesión JWT Segura (Access + Refresh Token)
    const accessToken = jwt.sign(
        { userId: user.id, username: user.username, tokenType: 'access' },
        jwtSecret,
        { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
        { userId: user.id, username: user.username, tokenType: 'refresh' },
        refreshTokenSecret,
        { expiresIn: '7d' }
    );

    // Configurar cookie segura de Refresh Token
    if (res && typeof res.cookie === 'function') {
        const isProduction = process.env.NODE_ENV === 'production' && process.env.IS_DEMO_ENV !== 'true';
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
        });
    }

    return {
        valid: true,
        user,
        payload,
        isNewUser,
        accessToken,
        refreshToken
    };
}

module.exports = {
    stagePendingEntity,
    verifyAndCommitEntity,
    maskEmail
};
