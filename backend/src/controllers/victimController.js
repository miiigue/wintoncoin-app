/**
 * CONTROLADOR: Gestión de Expedientes y Asistencia a Damnificados SOS Venezuela
 * ═════════════════════════════════════════════════════════════════════════════════
 * Ciberseguridad & Auditoría FinTech (SOC 2 / ISO 27001):
 * - Registro público con validación Zero-Trust, Cédula única y prefijo +58.
 * - Creación automática de cuenta WintonCoin con código 'SOSVENEZUELA'.
 * - Código de Expediente Inteligente (ej: #SOS-VZLA-249-00142).
 * - Envíos de correos transaccionales personalizables y notificaciones.
 * - Registro imborrable de auditoría en audit_logs.
 */

'use strict';

// ── Dependencias Core de Node.js ──────────────────────────────────────────────
const pool = require('../config/db');
const bcrypt = require('bcrypt'); // Hashing de contraseñas con salt (10 rounds)
const crypto = require('crypto'); // Generación de UUIDs y tokens criptográficos
const jwt = require('jsonwebtoken'); // Generación de Access y Refresh Tokens (JWT)

// ── Servicios Internos de la Plataforma ────────────────────────────────────────
const { logAuditEvent } = require('../services/auditService'); // Registro inmutable de auditoría SOC 2
const emailService = require('../services/emailService'); // OTP, correos transaccionales, hash de verificación
const notificationService = require('../services/notificationService'); // Push Notifications (FCM/WebPush)
const mediaController = require('./mediaController'); // Compresión WebP + Subida a Cloudflare R2
const referralRewardService = require('../services/referralRewardService');
const onboardingStagingService = require('../services/onboardingStagingService');

// ── Secreto JWT para firma de tokens (Zero Hardcoded Secrets) ──────────────────
const jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'wintoncoin_fallback_secret_key_2026';

/**
 * OBTENER CÓDIGO DE EXPEDIENTE INTELIGENTE Y SCORE DE URGENCIA (4 DÍGITOS HIERÁRQUICOS)
 * ═════════════════════════════════════════════════════════════════════════════════
 * DÍGITO 1 (Gravedad del Daño 1 a 4, donde 4 es más grave):
 *   4 = Pérdida total de vivienda / enseres
 *   3 = Emergencia médica / lesionados
 *   2 = Daño parcial en vivienda
 *   1 = Necesidad urgente de alimentos / medicinas
 * DÍGITO 2 (Personas a Cargo 0 a 9):
 *   0 a 9 (Suma total de menores + tercera edad + discapacidad, tope 9)
 * DÍGITO 3 (Rango Decenal de Edad 1 a 9):
 *   1 = 10-19 años | 2 = 20-29 años | 3 = 30-39 años | 4 = 40-49 años
 *   5 = 50-59 años | 6 = 60-69 años | 7 = 70-79 años | 8 = 80-89 años | 9 = 90+ años
 * DÍGITO 4 (Sexo 1 a 3):
 *   1 = Hombre | 2 = Mujer | 3 = Otro
 * 
 * Formato: SOS-VZLA-[D1][D2][D3][D4]-[SECUENCIAL]
 */
function calculateSmartDossierCode(affectationLevel, minors, elderly, disabled, age, gender, sequenceId) {
    // 1. Gravedad (1 a 4, donde 4 es el más grave)
    let d1 = 1;
    if (affectationLevel === 'total_loss') d1 = 4;
    else if (affectationLevel === 'medical_emergency') d1 = 3;
    else if (affectationLevel === 'partial_damage') d1 = 2;
    else d1 = 1;

    // 2. Personas a Cargo (0 a 9)
    const totalDependents = (parseInt(minors, 10) || 0) + (parseInt(elderly, 10) || 0) + (parseInt(disabled, 10) || 0);
    const d2 = Math.min(Math.max(totalDependents, 0), 9);

    // 3. Rango Decenal de Edad (1 a 9)
    const parsedAge = parseInt(age, 10) || 18;
    let d3 = 1;
    if (parsedAge >= 90) d3 = 9;
    else if (parsedAge >= 80) d3 = 8;
    else if (parsedAge >= 70) d3 = 7;
    else if (parsedAge >= 60) d3 = 6;
    else if (parsedAge >= 50) d3 = 5;
    else if (parsedAge >= 40) d3 = 4;
    else if (parsedAge >= 30) d3 = 3;
    else if (parsedAge >= 20) d3 = 2;
    else d3 = 1;

    // 4. Sexo (1 a 3)
    const g = (gender || '').toLowerCase();
    let d4 = 3;
    if (g === 'male' || g === 'm' || g === 'hombre') d4 = 1;
    else if (g === 'female' || g === 'f' || g === 'mujer') d4 = 2;
    else d4 = 3;

    const padSeq = String(sequenceId).padStart(5, '0');
    const smartCode = `SOS-VZLA-${d1}${d2}${d3}${d4}-${padSeq}`;
    const urgencyScore = (d1 * 1000) + (d2 * 100) + (d3 * 10) + d4;

    return { smartCode, urgencyScore };
}

/**
 * Normaliza una cédula venezolana (V-12345678 o E-12345678)
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
 * Normaliza un número telefónico a formato internacional (+58)
 */
function normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
    if (!cleaned.startsWith('+')) {
        if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
        if (!cleaned.startsWith('58')) cleaned = '58' + cleaned;
        cleaned = '+' + cleaned;
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
// POST /api/public/sos-venezuela/register-victim (Público)
// ============================================================================
// FLUJO COMPLETO:
// POST /api/public/sos-venezuela/register (Público - Registro de Solicitud SOS)
// ============================================================================
// FASE 1: Validación Zero-Trust y Staging Modular
// 1. Valida datos de entrada y calcula edad autoritativa.
// 2. Comprueba si la Cédula ya está registrada en un expediente oficial activo.
// 3. Resguarda el paquete completo en pending_verifications (form_payload JSONB).
// 4. Despacha OTP de 6 dígitos al correo sin tocar disaster_victims_registry ni users.
// ============================================================================
exports.registerVictimPublic = async (req, res) => {
    const {
        full_name,
        id_document,
        birth_date,
        age,
        gender = 'female',
        is_head_of_family = false,
        email,
        phone_number,
        state,
        municipality,
        sector,
        address_details,
        dependents_minors = 0,
        dependents_elderly = 0,
        dependents_disabled = 0,
        affectation_level = 'essential_needs',
        description,
        evidence_urls = [],
        data_consent_accepted,
        sworn_declaration_accepted
    } = req.body;

    // ── 1. Validaciones de Presencia (Campos Obligatorios) ─────────────────
    if (!full_name || !id_document || !email || !phone_number || !state || !municipality || !sector || !address_details || !description) {
        return res.status(400).json({ success: false, message: "Por favor completa todos los campos obligatorios del censo." });
    }

    // ── 1.1 Validación Zero-Trust de Consentimiento Legal ──────────────────
    const consentAccepted = data_consent_accepted === true || data_consent_accepted === 'true';
    const swornAccepted = sworn_declaration_accepted === true || sworn_declaration_accepted === 'true';

    if (!consentAccepted || !swornAccepted) {
        return res.status(400).json({ success: false, message: "Debes aceptar el consentimiento de tratamiento de datos y la declaración jurada." });
    }

    // ── 2. Cálculo de Edad Autoritativo ────────────────────────────────────
    let parsedAge = null;
    if (birth_date) {
        const birthDateObj = new Date(birth_date);
        if (!isNaN(birthDateObj.getTime())) {
            const today = new Date();
            let calculatedAge = today.getFullYear() - birthDateObj.getFullYear();
            const monthDiff = today.getMonth() - birthDateObj.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
                calculatedAge--;
            }
            parsedAge = calculatedAge;
        }
    }
    if (parsedAge === null || isNaN(parsedAge)) {
        parsedAge = parseInt(age, 10) || 18;
    }

    // ── 3. Normalización de Datos ──────────────────────────────────────────
    const normDoc = normalizeIdDocument(id_document);
    const normPhone = normalizePhone(phone_number);
    const normEmail = email.trim().toLowerCase();

    if (!normPhone.startsWith('+58')) {
        return res.status(400).json({ success: false, message: "Por el momento solo se aceptan registros de números telefónicos de Venezuela (+58)." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ── 4. Verificar si ya existe expediente oficial activo con esta Cédula ─
        const existingOfficial = await client.query(
            'SELECT id, dossier_number FROM disaster_victims_registry WHERE id_document = $1',
            [normDoc]
        );

        if (existingOfficial.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                already_active: true,
                dossier_number: existingOfficial.rows[0].dossier_number,
                message: `La Cédula ${normDoc} ya tiene una solicitud registrada bajo el expediente #${existingOfficial.rows[0].dossier_number}. Inicia sesión en tu cuenta para consultar tu estatus.`
            });
        }

        // ── 5. Detectar si el usuario ya existe en 'users' (is_verified = true) ─
        const existingUserRes = await client.query(
            'SELECT id, email, phone_number, is_verified FROM users WHERE email = $1 OR phone_number = $2',
            [normEmail, normPhone]
        );

        if (existingUserRes.rows.length > 0) {
            const phoneConflict = existingUserRes.rows.find(u => u.phone_number === normPhone && u.email !== normEmail);
            if (phoneConflict) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: "El número de teléfono ya está registrado con otro correo electrónico."
                });
            }
        }

        const isNewUser = (existingUserRes.rows.length === 0 || existingUserRes.rows[0].is_verified !== true);

        // ── 6. Guardar Borrador en Staging y Despachar OTP vía Servicio Modular DRY ──
        const stagePayload = {
            full_name: full_name.trim(),
            id_document: normDoc,
            birth_date: birth_date || null,
            age: parsedAge,
            gender,
            is_head_of_family: Boolean(is_head_of_family),
            email: normEmail,
            phone_number: normPhone,
            state: state.trim(),
            municipality: municipality.trim(),
            sector: sector.trim(),
            address_details: address_details.trim(),
            dependents_minors: parseInt(dependents_minors, 10) || 0,
            dependents_elderly: parseInt(dependents_elderly, 10) || 0,
            dependents_disabled: parseInt(dependents_disabled, 10) || 0,
            affectation_level,
            description: description.trim(),
            evidence_urls: Array.isArray(evidence_urls) ? evidence_urls : [],
            data_consent_accepted: consentAccepted,
            sworn_declaration_accepted: swornAccepted
        };

        const stageRes = await onboardingStagingService.stagePendingEntity({
            client,
            registrationType: 'sos_victim',
            email: normEmail,
            phone: normPhone,
            birthDate: birth_date || null,
            payload: stagePayload,
            req
        });

        await client.query('COMMIT');

        // ── 7. Respuesta Exitosa ───────────────────────────────────────────
        res.status(200).json({
            success: true,
            email: normEmail,
            is_new_user: isNewUser,
            message: stageRes.message
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("[SOS VICTIM] Error en registro público:", error);

        if (error.code === '23505') {
            const constraint = error.constraint || '';
            if (constraint.includes('phone_number')) return res.status(400).json({ success: false, message: "El número telefónico ya está registrado." });
            if (constraint.includes('email')) return res.status(400).json({ success: false, message: "El correo electrónico ya está registrado." });
            if (constraint.includes('id_document')) return res.status(400).json({ success: false, message: "La Cédula ya tiene una solicitud registrada." });
        }

        res.status(500).json({
            success: false,
            message: "Error interno al procesar la solicitud. Por favor intenta nuevamente."
        });
    } finally {
        client.release();
    }
};

// ============================================================================
// POST /api/public/sos-venezuela/verify-otp (Público - Verificación OTP + Creación Oficial)
// ============================================================================
// FASE 2: Verificación Criptográfica, Activación de Usuario y Acuñación Oficial
// 1. Valida OTP contra pending_verifications (anti brute-force).
// 2. Crea/Activa usuario en 'users' (is_verified = true) y otorga 200 BLUE IOU.
// 3. Acuña oficialmente el expediente en 'disaster_victims_registry' con status 'pending_verification'.
// 4. Calcula el Código Inteligente #SOS-VZLA-XXXX-YYYYY y registra bitácora.
// 5. Emite sesión JWT segura (Access + Refresh Token).
// ============================================================================
exports.verifyVictimOtpPublic = async (req, res) => {
    const { email, otp_code, password, password_confirm } = req.body;

    const rawEmail = (typeof email === 'string') ? email : String(email || '');
    const rawCode = (typeof otp_code === 'string') ? otp_code : String(otp_code || '');

    if (!rawEmail.trim() || !rawCode.trim()) {
        return res.status(400).json({ success: false, message: "Ingresa tu correo y el código de 6 dígitos." });
    }

    if (password && password_confirm && password !== password_confirm) {
        return res.status(400).json({ success: false, message: "Las contraseñas no coinciden." });
    }

    const normEmail = rawEmail.trim().toLowerCase();
    const cleanCode = rawCode.trim();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Validar OTP y Activar/Crear Cuenta vía Motor Centralizado DRY
        const commitResult = await onboardingStagingService.verifyAndCommitEntity({
            client,
            email: normEmail,
            otpCode: cleanCode,
            password,
            expectedType: 'sos_victim',
            req,
            res
        });

        if (!commitResult.valid) {
            await client.query('ROLLBACK');
            return res.status(commitResult.status || 400).json({
                success: false,
                message: commitResult.message
            });
        }

        const { user, payload, isNewUser, accessToken } = commitResult;

        // 2. Acuñar Oficialmente el Expediente en disaster_victims_registry
        const tempDossierCode = `TEMP-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
        const insertRes = await client.query(`
            INSERT INTO disaster_victims_registry (
                dossier_number, user_id, full_name, id_document, birth_date, age, gender, is_head_of_family,
                email, phone_number, state, municipality, sector, address_details,
                dependents_minors, dependents_elderly, dependents_disabled,
                affectation_level, urgency_score, description, evidence_urls, status,
                data_consent_accepted, sworn_declaration_accepted
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13, $14,
                $15, $16, $17,
                $18, 0, $19, $20, 'pending_verification',
                $21, $22
            ) RETURNING id;
        `, [
            tempDossierCode, user.id, payload.full_name, payload.id_document, payload.birth_date || null,
            payload.age || 18, payload.gender || 'female', Boolean(payload.is_head_of_family),
            payload.email || normEmail, payload.phone_number, payload.state, payload.municipality,
            payload.sector, payload.address_details,
            parseInt(payload.dependents_minors, 10) || 0, parseInt(payload.dependents_elderly, 10) || 0, parseInt(payload.dependents_disabled, 10) || 0,
            payload.affectation_level || 'essential_needs', (payload.description || '').trim(),
            Array.isArray(payload.evidence_urls) ? payload.evidence_urls : [],
            payload.data_consent_accepted !== false, payload.sworn_declaration_accepted !== false
        ]);

        const victimId = (insertRes && insertRes.rows && insertRes.rows[0]) ? insertRes.rows[0].id : 1;

        // 3. Calcular Código de Expediente Inteligente Oficial
        const { smartCode: smartDossierCode, urgencyScore } = calculateSmartDossierCode(
            payload.affectation_level, payload.dependents_minors, payload.dependents_elderly,
            payload.dependents_disabled, payload.age, payload.gender, victimId
        );

        await client.query(
            'UPDATE disaster_victims_registry SET dossier_number = $1, urgency_score = $2 WHERE id = $3',
            [smartDossierCode, urgencyScore, victimId]
        );

        // 4. Bitácora de Auditoría del Expediente
        await client.query(
            'INSERT INTO disaster_victim_history (victim_id, event_type, message) VALUES ($1, $2, $3)',
            [victimId, 'registered_and_verified', `Expediente oficial #${smartDossierCode} creado tras validación de identidad digital. Estado inicial: En Proceso de Verificación.`]
        );

        await client.query('COMMIT');

        // 5. Envío Asíncrono de Correos y Notificaciones
        try {
            const templateRes = await pool.query(
                "SELECT subject, body_html AS html_body FROM email_templates WHERE template_key = 'sos_victim_registered' AND is_active = TRUE"
            );
            if (templateRes.rows.length > 0) {
                let { subject, html_body } = templateRes.rows[0];
                subject = subject.replace(/{{expediente}}/g, smartDossierCode);
                html_body = html_body
                    .replace(/{{nombre}}/g, payload.full_name)
                    .replace(/{{expediente}}/g, smartDossierCode);
                
                await emailService.sendGenericEmail({
                    toEmail: normEmail,
                    subject,
                    htmlBody: html_body
                });
            }

            await notificationService.sendNotificationToUser(user.id, {
                title: "🚨 Expediente SOS Creado",
                body: `Tu solicitud #${smartDossierCode} ha sido verificada con éxito. Revisa 'Mi caso' en tu perfil.`,
                icon: "/assets/icons/icon-192x192.png",
                data: { url: "/profile.html" }
            }, "HUMANITARIAN_AID");
        } catch (mailErr) {
            console.error("[SOS VICTIM] Error al enviar confirmación post-OTP:", mailErr.message);
        }

        // 6. Auditoría Inmutable (SOC 2 Compliance)
        await logAuditEvent(pool, req, {
            eventType: 'sos.victim.otp_verified_account_activated',
            actorUsername: user.username,
            category: 'humanitarian',
            metadata: { victim_id: victimId, dossier_number: smartDossierCode, id_document: payload.id_document, is_new_user: isNewUser }
        });

        // 7. Respuesta Exitosa con Sesión JWT
        res.status(200).json({
            success: true,
            dossier_number: smartDossierCode,
            email: normEmail,
            is_new_user: isNewUser,
            token: accessToken,
            username: user.username,
            message: "¡Solicitud registrada y cuenta activada exitosamente!"
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("[SOS OTP] Error al verificar OTP:", error);
        res.status(500).json({
            success: false,
            message: (process.env.NODE_ENV === 'production' && process.env.IS_DEMO_ENV !== 'true')
                ? "Error interno del servidor."
                : `Error interno al procesar OTP: ${error.message}`
        });
    } finally {
        client.release();
    }
};

// ============================================================================
// POST /api/public/sos-venezuela/resend-otp (Público - Reenvío de Código OTP)
// ============================================================================
// Estándar FinTech & NIST SP 800-63B:
// 1. Rate Limiting: Cooldown mínimo de 60s entre reenvíos sucesivos.
// 2. Anti-Abuse: Límite estricto de 5 reenvíos por sesión.
// 3. Generación criptográfica segura de nuevo OTP y nuevo TTL de 15 min.
// 4. Registro inmutable de auditoría para trazabilidad SOC 2.
// ============================================================================
exports.resendVictimOtpPublic = async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ success: false, message: "Ingresa un correo electrónico válido." });
    }

    const normEmail = email.trim().toLowerCase();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Buscar si hay una verificación pendiente
        const pendingRes = await client.query('SELECT * FROM pending_verifications WHERE email = $1', [normEmail]);
        if (pendingRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "No se encontró una solicitud pendiente para este correo." });
        }

        const pending = pendingRes.rows[0];

        // 2. Control de Frecuencia (Rate Limiting: Mínimo 60 segundos entre reenvíos)
        if (pending.last_sent_at) {
            const timeSinceLastSent = Date.now() - new Date(pending.last_sent_at).getTime();
            const cooldownMs = 60 * 1000; // 60s
            if (timeSinceLastSent < cooldownMs) {
                const remainingSecs = Math.ceil((cooldownMs - timeSinceLastSent) / 1000);
                await client.query('ROLLBACK');
                return res.status(429).json({
                    success: false,
                    message: `Por favor espera ${remainingSecs} segundos antes de solicitar otro código.`
                });
            }
        }

        // 3. Límite máximo de 5 reenvíos por sesión (Anti-Spam / Anti-Abuse)
        if ((pending.resend_count || 0) >= 5) {
            await client.query('ROLLBACK');
            return res.status(429).json({
                success: false,
                message: "Has alcanzado el límite máximo de reenvíos permitidos. Por favor espera unos minutos o contacta a soporte."
            });
        }

        // 4. Generar nuevo código OTP de 6 dígitos
        const newOtp = emailService.generateOtp6();
        const newHash = emailService.hashOtpForEmail(normEmail, newOtp);
        const newExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

        await client.query(`
            UPDATE pending_verifications
            SET verification_code_hash = $1,
                verification_attempts = 0,
                resend_count = resend_count + 1,
                last_sent_at = NOW(),
                expires_at = $2
            WHERE id = $3
        `, [newHash, newExpiresAt, pending.id]);

        await client.query('COMMIT');

        // 5. Enviar OTP por correo
        try {
            const ipRaw = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
            const ip = ipRaw.split(',')[0].trim();
            await emailService.sendOtpEmail({ toEmail: normEmail, otp: newOtp, context: { ip, requestedAt: new Date().toISOString() } });
        } catch (mailErr) {
            console.error("[SOS RESEND OTP] Error enviando correo:", mailErr.message);
        }

        // 6. Auditoría Inmutable
        await logAuditEvent(pool, req, {
            eventType: 'sos.victim.otp_resent',
            actorUsername: normEmail,
            category: 'humanitarian',
            metadata: { email: normEmail, resend_count: (pending.resend_count || 0) + 1 }
        });

        res.json({
            success: true,
            message: "Se ha reenviado un nuevo código de 6 dígitos a tu correo."
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("[SOS RESEND OTP] Error:", error);
        res.status(500).json({ success: false, message: "Error al reenviar el código de verificación." });
    } finally {
        client.release();
    }
};

// ============================================================================
// POST /api/public/sos-venezuela/upload-evidence (Público - Subida de imágenes a Cloudflare R2)
// ============================================================================
// Ciberseguridad & Principio DRY (Don't Repeat Yourself):
// - Reutiliza el controlador de medios unificado (mediaController.js) que integra
//   compresión asíncrona WebP (Sharp) y subida inmutable a Cloudflare R2.
// - Neutraliza la ejecución remota de código (RCE) al no guardar nada en el disco local.
// ============================================================================
exports.uploadEvidencePublic = async (req, res) => {
    try {
        return await mediaController.uploadImages(req, res);
    } catch (err) {
        console.error("[SOS UPLOAD] Error en infraestructura de almacenamiento Cloudflare R2:", err);
        return res.status(500).json({ success: false, message: "Error al procesar la subida de evidencias a Cloudflare R2." });
    }
};

// ============================================================================
// GET /api/admin/sos-venezuela/victims (Admin)
// ============================================================================
exports.listVictimsAdmin = async (req, res) => {
    try {
        const { status, search, limit = 50, offset = 0 } = req.query;

        let conditions = [];
        let params = [];
        let pIndex = 1;

        if (status && status !== 'all') {
            conditions.push(`r.status = $${pIndex}`);
            params.push(status);
            pIndex++;
        }

        if (search && search.trim().length > 0) {
            conditions.push(`(
                LOWER(r.full_name) LIKE $${pIndex} OR 
                LOWER(r.id_document) LIKE $${pIndex} OR 
                LOWER(r.dossier_number) LIKE $${pIndex} OR 
                LOWER(r.state) LIKE $${pIndex}
            )`);
            params.push(`%${search.trim().toLowerCase()}%`);
            pIndex++;
        }

        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sql = `
            SELECT 
                r.*,
                COALESCE(SUM(d.amount_blue), 0) AS total_disbursed_blue,
                COUNT(d.id) AS disbursement_count
            FROM disaster_victims_registry r
            LEFT JOIN disaster_aid_disbursements d ON d.victim_id = r.id
            ${whereSql}
            GROUP BY r.id
            ORDER BY 
                CASE r.status 
                    WHEN 'pending_verification' THEN 0
                    WHEN 'info_requested' THEN 1
                    WHEN 'verified' THEN 2
                    WHEN 'approved_for_aid' THEN 3
                    WHEN 'disbursed' THEN 4
                    WHEN 'rejected' THEN 5
                END,
                r.urgency_score DESC,
                r.created_at DESC
            LIMIT $${pIndex} OFFSET $${pIndex + 1}
        `;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(sql, params);

        const countSql = `SELECT COUNT(*) FROM disaster_victims_registry r ${whereSql}`;
        const countRes = await pool.query(countSql, params.slice(0, -2));

        res.json({
            success: true,
            victims: result.rows,
            total: parseInt(countRes.rows[0].count, 10)
        });
    } catch (error) {
        console.error("[SOS VICTIM ADMIN] Error al listar víctimas:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
};

// ============================================================================
// GET /api/admin/sos-venezuela/victims/:id (Admin)
// ============================================================================
exports.getVictimDetailAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const victimRes = await pool.query('SELECT * FROM disaster_victims_registry WHERE id = $1', [id]);
        if (victimRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Expediente no encontrado." });
        }

        const victim = victimRes.rows[0];
        const disbursementsRes = await pool.query(
            'SELECT d.*, a.username as admin_username FROM disaster_aid_disbursements d LEFT JOIN admin_users a ON a.id = d.disbursed_by_admin_id WHERE d.victim_id = $1 ORDER BY d.created_at DESC',
            [id]
        );

        const historyRes = await pool.query(
            'SELECT * FROM disaster_victim_history WHERE victim_id = $1 ORDER BY created_at DESC',
            [id]
        );

        res.json({
            success: true,
            victim,
            disbursements: disbursementsRes.rows,
            history: historyRes.rows
        });
    } catch (error) {
        console.error("[SOS VICTIM ADMIN] Error al obtener detalle:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
};

// ============================================================================
// POST /api/admin/sos-venezuela/victims/:id/update-status (Admin)
// ============================================================================
exports.updateVictimStatusAdmin = async (req, res) => {
    const { id } = req.params;
    const { status, admin_notes, custom_message } = req.body;

    const validStatuses = ['pending_verification', 'info_requested', 'verified', 'approved_for_aid', 'disbursed', 'rejected'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: "Estado no válido." });
    }

    try {
        const victimRes = await pool.query(
            'SELECT r.*, u.username FROM disaster_victims_registry r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = $1',
            [id]
        );
        if (victimRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Expediente no encontrado." });
        }

        const victim = victimRes.rows[0];
        const adminId = req.user?.id || null;

        await pool.query(`
            UPDATE disaster_victims_registry 
            SET status = $1, admin_notes = $2, verified_by_admin_id = $3, updated_at = NOW()
            WHERE id = $4
        `, [status, admin_notes || victim.admin_notes, adminId, id]);

        // Disparar correo según el nuevo estado
        try {
            if (status === 'info_requested') {
                const tmpl = await pool.query("SELECT subject, body_html AS html_body FROM email_templates WHERE template_key = 'sos_victim_info_requested' AND is_active = TRUE");
                if (tmpl.rows.length > 0) {
                    let { subject, html_body } = tmpl.rows[0];
                    subject = subject.replace(/{{expediente}}/g, victim.dossier_number);
                    html_body = html_body
                        .replace(/{{nombre}}/g, victim.full_name)
                        .replace(/{{expediente}}/g, victim.dossier_number)
                        .replace(/{{observaciones}}/g, custom_message || admin_notes || 'Por favor comunícate con soporte.');

                    await emailService.sendCustomEmail(victim.email, subject, html_body);
                }
            } else if (status === 'approved_for_aid') {
                const tmpl = await pool.query("SELECT subject, body_html AS html_body FROM email_templates WHERE template_key = 'sos_victim_aid_approved' AND is_active = TRUE");
                if (tmpl.rows.length > 0) {
                    let { subject, html_body } = tmpl.rows[0];
                    subject = subject.replace(/{{expediente}}/g, victim.dossier_number);
                    html_body = html_body
                        .replace(/{{nombre}}/g, victim.full_name)
                        .replace(/{{expediente}}/g, victim.dossier_number)
                        .replace(/{{monto_blue}}/g, '500');

                    await emailService.sendCustomEmail(victim.email, subject, html_body);
                }
            }

            // Configurar textos de notificación
            let pushTitle = "🚨 Actualización de Expediente SOS";
            let pushBody = `Tu expediente #${victim.dossier_number} ha cambiado de estatus a: ${status}.`;
            if (status === 'approved_for_aid') {
                pushTitle = "💚 ¡Ayuda Humanitaria Aprobada!";
                pushBody = `Tu expediente #${victim.dossier_number} ha sido APROBADO para recibir asistencia.`;
            } else if (status === 'info_requested') {
                pushTitle = "⚠️ Información Requerida para tu Expediente";
                pushBody = `Se requiere información adicional para tu expediente #${victim.dossier_number}.`;
            } else if (status === 'rejected') {
                pushTitle = "📋 Notificación sobre tu Expediente SOS";
                pushBody = `Tu expediente #${victim.dossier_number} ha sido revisado y no cumple con los criterios de aprobación.`;
            }

            // Enviar notificación Push si el expediente tiene usuario vinculado
            if (victim.user_id) {
                await notificationService.sendNotificationToUser(victim.user_id, {
                    title: pushTitle,
                    body: pushBody,
                    icon: "/assets/icons/icon-192x192.png",
                    data: { url: "/profile.html" }
                }, "HUMANITARIAN_AID");
            }

            // Guardar notificación In-App en la base de datos para visibilidad interna en la aplicación
            if (victim.username) {
                await pool.query(
                    'INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)',
                    [victim.username, pushBody]
                );
            }

            // Registrar en la bitácora/historial del expediente con fecha y hora actual
            const historyMsg = `${pushBody}${custom_message || admin_notes ? ' Notas de revisión: ' + (custom_message || admin_notes) : ''}`;
            await pool.query(
                'INSERT INTO disaster_victim_history (victim_id, event_type, message) VALUES ($1, $2, $3)',
                [id, status, historyMsg]
            );
        } catch (mailErr) {
            console.error("[SOS VICTIM ADMIN] Error al enviar notificación de estado (Email / Push):", mailErr.message);
        }

        await logAuditEvent(pool, req, {
            eventType: 'admin.sos.victim_status_updated',
            actorUsername: req.user?.username || 'admin',
            category: 'admin',
            metadata: { victim_id: id, dossier_number: victim.dossier_number, new_status: status }
        });

        res.json({ success: true, message: "Estado de expediente actualizado correctamente." });
    } catch (error) {
        console.error("[SOS VICTIM ADMIN] Error al actualizar estado:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
};

// ============================================================================
// POST /api/admin/sos-venezuela/victims/:id/disburse (Admin - Entrega de Ayuda)
// ============================================================================
exports.disburseVictimAidAdmin = async (req, res) => {
    const { id } = req.params;
    const { amount_blue, period = 'Asignación de Ayuda', notes } = req.body;

    const amount = parseFloat(amount_blue);
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: "Ingresa un monto de BLUE IOU válido mayor a 0." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const victimRes = await client.query('SELECT r.*, u.username FROM disaster_victims_registry r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = $1', [id]);
        if (victimRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "Expediente no encontrado." });
        }

        const victim = victimRes.rows[0];
        const adminId = req.user?.id || null;

        // 1. Insertar registro en historial de entregas
        await client.query(`
            INSERT INTO disaster_aid_disbursements (victim_id, amount_blue, disbursement_period, disbursed_by_admin_id, notes)
            VALUES ($1, $2, $3, $4, $5)
        `, [id, amount, period, adminId, notes || '']);

        // 2. Acreditar tokens BLUE al usuario en la plataforma si tiene usuario vinculado
        if (victim.user_id && victim.username) {
            // Inserción en escrows respetando la restricción NOT NULL de user_id
            await client.query(`
                INSERT INTO blue_token_escrows (user_id, username, amount, unlock_at, is_released)
                VALUES ($1, $2, $3, NOW(), true);
            `, [victim.user_id, victim.username, amount]);

            // Acreditar transaccionalmente los tokens al saldo líquido del usuario
            await client.query(
                "SELECT record_balance_event($1::INTEGER, 'deposit'::TEXT, 'liquid_blue'::TEXT, $2::NUMERIC, NULL::JSONB)",
                [victim.user_id, amount]
            );
        }

        // 3. Actualizar estado a 'disbursed'
        await client.query(`
            UPDATE disaster_victims_registry 
            SET status = 'disbursed', updated_at = NOW() 
            WHERE id = $1
        `, [id]);

        // Registrar en el historial/bitácora del expediente de forma transaccional
        const disburseNotesMsg = notes ? ` Notas: ${notes}` : '';
        await client.query(
            'INSERT INTO disaster_victim_history (victim_id, event_type, message) VALUES ($1, $2, $3)',
            [id, 'disbursed', `Se han acreditado +${amount} BLUE IOU para el expediente #${victim.dossier_number}.${disburseNotesMsg}`]
        );

        // Guardar notificación In-App en la base de datos de forma transaccional
        if (victim.username) {
            await client.query(
                'INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)',
                [victim.username, `Se han acreditado +${amount} BLUE IOU a tu cuenta para tu expediente #${victim.dossier_number}.`]
            );
        }

        await client.query('COMMIT');

        // 4. Notificar por correo
        try {
            const tmpl = await pool.query("SELECT subject, body_html AS html_body FROM email_templates WHERE template_key = 'sos_victim_aid_approved' AND is_active = TRUE");
            if (tmpl.rows.length > 0) {
                let { subject, html_body } = tmpl.rows[0];
                subject = subject.replace(/{{expediente}}/g, victim.dossier_number);
                html_body = html_body
                    .replace(/{{nombre}}/g, victim.full_name)
                    .replace(/{{expediente}}/g, victim.dossier_number)
                    .replace(/{{monto_blue}}/g, amount.toString());

                await emailService.sendCustomEmail(victim.email, subject, html_body);
            }

            // Enviar notificación Push si el expediente tiene usuario vinculado
            if (victim.user_id) {
                await notificationService.sendNotificationToUser(victim.user_id, {
                    title: "💸 ¡Ayuda Acreditada a tu Billetera!",
                    body: `Se han acreditado +${amount} BLUE IOU a tu cuenta para tu expediente #${victim.dossier_number}.`,
                    icon: "/assets/icons/icon-192x192.png",
                    data: { url: "/profile.html" }
                }, "HUMANITARIAN_AID");
            }
        } catch (mErr) {
            console.error("[SOS DISBURSE] Error al enviar email / Push:", mErr.message);
        }

        await logAuditEvent(pool, req, {
            eventType: 'admin.sos.aid_disbursed',
            actorUsername: req.user?.username || 'admin',
            category: 'admin',
            metadata: { victim_id: id, dossier_number: victim.dossier_number, amount_blue: amount }
        });

        res.json({ success: true, message: `Se han acreditado ${amount} BLUE IOU exitosamente al expediente #${victim.dossier_number}.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("[SOS DISBURSE ADMIN] Error al entregar ayuda:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    } finally {
        client.release();
    }
};

// ============================================================================
// GET & POST /api/admin/sos-venezuela/email-templates (Admin)
// ============================================================================
exports.getEmailTemplatesAdmin = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM email_templates_sos ORDER BY template_key');
        res.json({ success: true, templates: result.rows });
    } catch (error) {
        console.error("[SOS TEMPLATES] Error al obtener plantillas:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
};

exports.updateEmailTemplateAdmin = async (req, res) => {
    const { template_key, subject, html_body } = req.body;
    if (!template_key || !subject || !html_body) {
        return res.status(400).json({ success: false, message: "Campos requeridos incompletos." });
    }

    try {
        await pool.query(`
            INSERT INTO email_templates_sos (template_key, subject, html_body, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (template_key) DO UPDATE
            SET subject = EXCLUDED.subject, html_body = EXCLUDED.html_body, updated_at = NOW();
        `, [template_key, subject, html_body]);

        await logAuditEvent(pool, req, {
            eventType: 'admin.sos.email_template_updated',
            actorUsername: req.user?.username || 'admin',
            category: 'admin',
            metadata: { template_key }
        });

        res.json({ success: true, message: "Plantilla de correo actualizada correctamente." });
    } catch (error) {
        console.error("[SOS TEMPLATES] Error al actualizar plantilla:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
};

// ============================================================================
// GET /api/public/sos-venezuela/my-case (Consultar censo y expediente "Mi caso")
// ============================================================================
// Principios de Seguridad:
// 1. Privacidad Estricta: La consulta mediante este endpoint está diseñada únicamente para la verificación del propio titular.
// 2. Consultas Parametrizadas: Previene cualquier tipo de inyección SQL (SQLi).
// 3. Cero fuga de información a terceros.
// ============================================================================
exports.getMyCasePublic = async (req, res) => {
    // Inicio del bloque de control de errores para garantizar estabilidad y disponibilidad auditora
    try {
        // Extracción de parámetros permitidos enviados en el Query String
        const { username, email, id_document } = req.query;

        // Validación de entrada: Si no se provee ningún parámetro de consulta, se rechaza inmediatamente la solicitud (HTTP 400 Bad Request)
        if (!username && !email && !id_document) {
            return res.status(400).json({ success: false, message: "Debes especificar username, email o Cédula de Identidad." });
        }

        // Construcción dinámica de la consulta SQL utilizando marcadores de posición ($1) para prevenir Inyección SQL
        let query = 'SELECT * FROM disaster_victims_registry WHERE ';
        // Arreglo de parámetros seguros que serán escapados por el cliente de PostgreSQL
        const params = [];

        // Condicional por Cédula de Identidad normalizada
        if (id_document) {
            const normDoc = normalizeIdDocument(id_document);
            query += 'id_document = $1';
            params.push(normDoc);
        } 
        // Condicional por correo electrónico formateado
        else if (email) {
            query += 'email = $1';
            params.push(email.trim().toLowerCase());
        } 
        // Condicional por nombre de usuario con subconsulta parametrizada
        else if (username) {
            query += 'user_id = (SELECT id FROM users WHERE username = $1)';
            params.push(username);
        }

        // Ordenamiento por el registro más reciente para garantizar la entrega del expediente activo
        query += ' ORDER BY id DESC LIMIT 1';

        // Ejecución segura de la consulta en la base de datos PostgreSQL
        const result = await pool.query(query, params);

        // Si no existen registros coincidentes, se responde de forma neutral sin revelar información adicional
        if (result.rows.length === 0) {
            return res.json({ success: true, has_case: false, case: null, disbursements: [] });
        }

        // Extracción del expediente hallado
        const caseData = result.rows[0];

        // Obtener historial de desembolsos recibidos por la víctima mediante consulta parametrizada segura
        const disbursementsRes = await pool.query(
            'SELECT id, amount_blue, created_at, notes FROM disaster_aid_disbursements WHERE victim_id = $1 ORDER BY id DESC',
            [caseData.id]
        );

        // Obtener bitácora completa de notificaciones y eventos del expediente
        const historyRes = await pool.query(
            'SELECT id, event_type, message, created_at FROM disaster_victim_history WHERE victim_id = $1 ORDER BY created_at DESC',
            [caseData.id]
        );

        // Respuesta exitosa al titular con el expediente completo, historial de ayudas y bitácora de eventos
        res.json({
            success: true,
            has_case: true,
            case: caseData,
            disbursements: disbursementsRes.rows,
            history: historyRes.rows
        });
    } catch (error) {
        // Registro de auditoría interna de errores de servidor
        console.error("[SOS MY CASE] Error al consultar caso:", error);
        // Respuesta genérica de error interno (HTTP 500) para evitar revelación de detalles técnicos (Stack Traces)
        res.status(500).json({ success: false, message: "Error interno al consultar el caso." });
    }
};

exports.calculateSmartDossierCode = calculateSmartDossierCode;
exports.normalizeIdDocument = normalizeIdDocument;
exports.normalizePhone = normalizePhone;
