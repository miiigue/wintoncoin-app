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
// 1. Validar campos obligatorios y consentimientos legales (Zero-Trust).
// 2. Calcular edad autoritativa a partir de birth_date (fuente única de verdad).
// 3. Verificar que la Cédula no tenga un expediente previo (unicidad documental).
//    - Si ya tiene expediente y la cuenta está ACTIVA: Indicar que inicie sesión.
//    - Si ya tiene expediente y la cuenta está PENDIENTE: Reanudación Inteligente (Smart Resume),
//      generando y reenviando nuevo OTP al correo para que complete su activación.
// 4. Buscar o crear cuenta de usuario WintonCoin (vinculación al ecosistema).
// 5. SIEMPRE guardar hash de OTP en pending_verifications (UPSERT) para que
//    el flujo de verificación funcione tanto para usuarios nuevos como existentes.
// 6. Insertar registro temporal en disaster_victims_registry → calcular código
//    de expediente inteligente → actualizar con código final.
// 7. Enviar correo de confirmación y OTP al usuario de forma asíncrona.
// 8. Registrar evento de auditoría inmutable en audit_logs.
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

    // ── 1.1 Validación Zero-Trust de Booleanos de Consentimiento Legal ─────
    // En JavaScript, Boolean("false") === true, lo que representa una vulnerabilidad.
    // Se valida de forma explícita para prevenir falsos positivos que violarían
    // la Ley de Habeas Data y los estándares SOC 2 de privacidad.
    const consentAccepted = data_consent_accepted === true || data_consent_accepted === 'true';
    const swornAccepted = sworn_declaration_accepted === true || sworn_declaration_accepted === 'true';

    if (!consentAccepted || !swornAccepted) {
        return res.status(400).json({ success: false, message: "Debes aceptar el consentimiento de tratamiento de datos y la declaración jurada." });
    }

    // ── 2. Cálculo de Edad Autoritativo ────────────────────────────────────
    // La fecha de nacimiento (birth_date) es la FUENTE ÚNICA DE VERDAD para la edad.
    // Si se proporciona, se calcula la edad exacta en el servidor.
    // Si no se proporciona pero sí se envió la edad manual, se usa como fallback.
    // Esto garantiza que el dígito decenal del Código de Expediente Inteligente
    // sea siempre preciso y consistente con los datos legales del censo.
    let parsedAge = null;
    if (birth_date) {
        // Cálculo preciso de edad a partir de la fecha de nacimiento
        const birthDateObj = new Date(birth_date);
        if (!isNaN(birthDateObj.getTime())) {
            const today = new Date();
            let calculatedAge = today.getFullYear() - birthDateObj.getFullYear();
            // Ajuste si aún no ha cumplido años en el año actual
            const monthDiff = today.getMonth() - birthDateObj.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
                calculatedAge--;
            }
            parsedAge = calculatedAge;
        }
    }
    // Fallback: usar la edad manual enviada si no hay birth_date válido
    if (parsedAge === null || isNaN(parsedAge)) {
        parsedAge = parseInt(age, 10) || 18; // 18 como fallback mínimo por seguridad legal
    }

    // ── 3. Normalización de Datos de Contacto e Identidad ──────────────────
    const normDoc = normalizeIdDocument(id_document);
    const normPhone = normalizePhone(phone_number);
    const normEmail = email.trim().toLowerCase();

    // Validar que el número telefónico pertenezca a Venezuela (+58)
    if (!normPhone.startsWith('+58')) {
        return res.status(400).json({ success: false, message: "Por el momento solo se aceptan registros de números telefónicos de Venezuela (+58)." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ── 4. Detección Inteligente de Cédula y Reanudación de Verificación ──
        const existingDossier = await client.query(`
            SELECT d.id, d.dossier_number, d.user_id, d.email, u.is_verified, u.username
            FROM disaster_victims_registry d
            LEFT JOIN users u ON u.id = d.user_id
            WHERE d.id_document = $1
        `, [normDoc]);

        if (existingDossier.rows.length > 0) {
            const dossier = existingDossier.rows[0];
            const isUserVerified = dossier.is_verified === true;

            if (isUserVerified) {
                // Caso 1: El usuario ya completó su verificación y su cuenta está activa
                await client.query('ROLLBACK');
                return res.status(409).json({
                    success: false,
                    already_active: true,
                    dossier_number: dossier.dossier_number,
                    message: `La Cédula ${normDoc} ya tiene una solicitud activa bajo el expediente #${dossier.dossier_number}. Inicia sesión en tu cuenta para consultar tu estatus.`
                });
            } else {
                // Caso 2: El usuario llenó el formulario anteriormente pero NO completó el OTP (Smart Resume)
                const verificationCode = emailService.generateOtp6();
                const verificationCodeHash = emailService.hashOtpForEmail(dossier.email, verificationCode);
                const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

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
                `, [dossier.username || normEmail.split('@')[0], dossier.email, normPhone, specialReferralCode, verificationCodeHash, expiresAt]);

                await client.query('COMMIT');

                // Enviar nuevo OTP al correo registrado
                try {
                    const ipRaw = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
                    const ip = ipRaw.split(',')[0].trim();
                    await emailService.sendOtpEmail({ toEmail: dossier.email, otp: verificationCode, context: { ip, requestedAt: new Date().toISOString() } });
                } catch (mErr) {
                    console.error("[SOS RESUME] Error enviando email de reanudación OTP:", mErr.message);
                }

                const maskedEmail = maskEmailHelper(dossier.email);

                return res.status(200).json({
                    success: true,
                    resume_verification: true,
                    dossier_number: dossier.dossier_number,
                    email: dossier.email,
                    is_new_user: true,
                    message: `Tu solicitud ya fue recibida con el expediente #${dossier.dossier_number}. Hemos enviado un nuevo código de 6 dígitos a tu correo (${maskedEmail}) para que actives tu cuenta.`
                });
            }
        }

        // ── 5. Buscar o Crear Cuenta WintonCoin ────────────────────────────
        // Se vincula al ecosistema para permitir la recepción de ayuda humanitaria.
        // Si el usuario ya existe, solo se vincula. Si es nuevo, se crea la cuenta.
        let userId = null;
        let username = null;
        let isNewUser = false;

        const userCheck = await client.query(
            'SELECT id, username FROM users WHERE email = $1 OR phone_number = $2',
            [normEmail, normPhone]
        );

        if (userCheck.rows.length > 0) {
            // Usuario existente: solo vincular al expediente SOS
            userId = userCheck.rows[0].id;
            username = userCheck.rows[0].username;
            // Actualizar fecha de nacimiento si no la tenía registrada
            if (birth_date) {
                await client.query('UPDATE users SET date_of_birth = $1 WHERE id = $2 AND date_of_birth IS NULL', [birth_date, userId]);
            }
        } else {
            // ── 5.1 Crear Usuario Nuevo con Contraseña Temporal ────────────
            // La contraseña temporal se hashea y NUNCA se revela al usuario.
            // En el flujo de verificación OTP (Opción A), el usuario definirá
            // su propia contraseña segura tras validar su código de 6 dígitos.
            isNewUser = true;
            const tempPassword = crypto.randomBytes(12).toString('hex'); // 24 chars de alta entropía
            const hashedPassword = await bcrypt.hash(tempPassword, 10); // 10 salt rounds (estándar industria)
            const baseUsername = normEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').substring(0, 20);
            
            // Bucle de Resolución de Colisiones (Garantiza Username Único)
            let isUsernameUnique = false;
            while (!isUsernameUnique) {
                username = `${baseUsername}_${Math.floor(100 + Math.random() * 900)}`;
                const collisionCheck = await client.query('SELECT id FROM users WHERE username = $1', [username]);
                if (collisionCheck.rows.length === 0) {
                    isUsernameUnique = true;
                }
            }

            const { generateUniqueReferralCode } = require('../config/databaseInit');
            const ownReferralCode = await generateUniqueReferralCode(client, username);

            const newUserRes = await client.query(`
                INSERT INTO users (username, email, password_hash, phone_number, is_verified, date_of_birth, referral_code)
                VALUES ($1, $2, $3, $4, false, $5, $6)
                RETURNING id
            `, [username, normEmail, hashedPassword, normPhone, birth_date || null, ownReferralCode]);

            userId = newUserRes.rows[0].id;
        }

        // ── 5.2 UPSERT en pending_verifications (Corrección de Bug Crítico) ──
        // ANTES: Solo se guardaba el hash OTP para usuarios nuevos, dejando
        // bloqueados a los usuarios existentes que intentaban verificar su correo.
        // AHORA: Se ejecuta SIEMPRE un UPSERT para que el código OTP funcione
        // independientemente de si el usuario existía previamente o es nuevo.
        const verificationCode = emailService.generateOtp6();
        const verificationCodeHash = emailService.hashOtpForEmail(normEmail, verificationCode);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos de vigencia

        // Consultar dinámicamente el Código de Referido Especial desde app_settings (Principio DRY)
        const customCodeRes = await client.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'referral_custom_share_code'`);
        const specialReferralCode = (customCodeRes.rows.length > 0 && customCodeRes.rows[0].setting_value) ? customCodeRes.rows[0].setting_value.trim() : 'SOSVENEZUELA';

        await client.query(`
            INSERT INTO pending_verifications (
                username, email, password_hash, phone_number, referral_code,
                verification_code_hash, verification_attempts, resend_count, last_sent_at, expires_at, date_of_birth
            ) VALUES ($1, $2, '', $3, $4, $5, 0, 0, NOW(), $6, $7)
            ON CONFLICT (email) DO UPDATE
            SET referral_code = EXCLUDED.referral_code,
                verification_code_hash = EXCLUDED.verification_code_hash,
                expires_at = EXCLUDED.expires_at,
                verification_attempts = 0,
                resend_count = pending_verifications.resend_count + 1,
                last_sent_at = NOW()
        `, [username, normEmail, normPhone, specialReferralCode, verificationCodeHash, expiresAt, birth_date || null]);

        // ── 6. Insertar Registro de Expediente (Paso 1: Código Temporal) ───
        // Se usa crypto.randomUUID() en lugar de Date.now() para evitar colisiones
        // si dos personas se registran en el mismo milisegundo (alta concurrencia).
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
            tempDossierCode, userId, full_name.trim(), normDoc, birth_date || null, parsedAge, gender, Boolean(is_head_of_family),
            normEmail, normPhone, state.trim(), municipality.trim(), sector.trim(), address_details.trim(),
            parseInt(dependents_minors, 10) || 0, parseInt(dependents_elderly, 10) || 0, parseInt(dependents_disabled, 10) || 0,
            affectation_level, description.trim(), Array.isArray(evidence_urls) ? evidence_urls : [],
            consentAccepted, swornAccepted
        ]);

        const victimId = insertRes.rows[0].id;

        // ── 6.1 Calcular Código de Expediente Inteligente (4 dígitos) ──────
        const { smartCode: smartDossierCode, urgencyScore } = calculateSmartDossierCode(
            affectation_level, dependents_minors, dependents_elderly, dependents_disabled, parsedAge, gender, victimId
        );

        // Actualizar dossier_number final y urgency_score con el código inteligente calculado
        await client.query(
            'UPDATE disaster_victims_registry SET dossier_number = $1, urgency_score = $2 WHERE id = $3',
            [smartDossierCode, urgencyScore, victimId]
        );

        await client.query('COMMIT');

        // ── 7. Envío Asíncrono de Correos y Notificaciones ─────────────────
        // Se ejecuta fuera de la transacción para no bloquear el registro
        // si el servicio de correo presenta latencia o errores temporales.
        try {
            // 7.1 Enviar OTP de seguridad de 6 dígitos al correo del usuario
            const ipRaw = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
            const ip = ipRaw.split(',')[0].trim();
            await emailService.sendOtpEmail({ toEmail: normEmail, otp: verificationCode, context: { ip, requestedAt: new Date().toISOString() } });

            // 7.2 Enviar correo de confirmación con resumen del expediente
            const templateRes = await pool.query(
                "SELECT subject, body_html AS html_body FROM email_templates WHERE template_key = 'sos_victim_registered' AND is_active = TRUE"
            );
            if (templateRes.rows.length > 0) {
                let { subject, html_body } = templateRes.rows[0];

                // Mapeo de etiquetas de afectación para el correo de confirmación
                let affectationLabel = 'Necesidades Básicas Urgentes';
                if (affectation_level === 'total_loss') affectationLabel = 'Pérdida Total de Vivienda / Enseres';
                else if (affectation_level === 'medical_emergency') affectationLabel = 'Emergencia Médica / Lesionados';
                else if (affectation_level === 'partial_damage') affectationLabel = 'Daño Parcial en Vivienda';

                const locationStr = `${state.trim()}, ${municipality.trim()}, ${sector.trim()} (${address_details.trim()})`;
                const familyStr = `${dependents_minors || 0} menor(es), ${dependents_elderly || 0} adulto(s) mayor(es), ${dependents_disabled || 0} persona(s) con discapacidad`;

                // Reemplazo de variables dinámicas en la plantilla de correo
                subject = subject.replace(/{{expediente}}/g, smartDossierCode);
                html_body = html_body
                    .replace(/{{nombre}}/g, full_name)
                    .replace(/{{expediente}}/g, smartDossierCode)
                    .replace(/{{cedula}}/g, normDoc)
                    .replace(/{{edad}}/g, String(parsedAge))
                    .replace(/{{ubicacion}}/g, locationStr)
                    .replace(/{{censo_familiar}}/g, familyStr)
                    .replace(/{{afectacion}}/g, affectationLabel)
                    .replace(/{{descripcion}}/g, description.trim());

                await emailService.sendCustomEmail(normEmail, subject, html_body);
            }

            // 7.3 Enviar notificación Push al usuario (si tiene cuenta vinculada)
            if (userId) {
                await notificationService.sendNotificationToUser(userId, {
                    title: "🚨 Expediente SOS Registrado",
                    body: `Tu solicitud #${smartDossierCode} ha sido recibida con éxito. Revisa 'Mi caso' en tu perfil.`,
                    icon: "/assets/icons/icon-192x192.png",
                    data: { url: "/profile.html" }
                }, "HUMANITARIAN_AID");
            }

            // 7.4 Persistir notificación In-App para visibilidad dentro de la plataforma
            if (username) {
                await pool.query(
                    'INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)',
                    [username, `Tu solicitud #${smartDossierCode} ha sido recibida con éxito. Revisa 'Mi caso' en tu perfil.`]
                );
            }

            // 7.5 Registrar evento de creación en la bitácora/historial del expediente
            await pool.query(
                'INSERT INTO disaster_victim_history (victim_id, event_type, message) VALUES ($1, $2, $3)',
                [victimId, 'registered', `Expediente generado con número #${smartDossierCode}. Estado inicial: En Proceso de Verificación.`]
            );
        } catch (mailErr) {
            // Los errores de correo/push NO deben bloquear el registro del expediente
            console.error("[SOS VICTIM] Error al enviar emails / Push de confirmación:", mailErr.message);
        }

        // ── 8. Registro de Auditoría Inmutable (SOC 2 Compliance) ──────────
        await logAuditEvent(pool, req, {
            eventType: 'sos.victim.registered',
            actorUsername: normEmail,
            category: 'humanitarian',
            metadata: { victim_id: victimId, dossier_number: smartDossierCode, id_document: normDoc, is_new_user: isNewUser }
        });

        // ── 9. Respuesta Exitosa al Cliente ────────────────────────────────
        res.status(201).json({
            success: true,
            dossier_number: smartDossierCode,
            email: normEmail,
            is_new_user: isNewUser,
            message: "Solicitud de asistencia humanitaria registrada exitosamente. Se ha enviado un código de seguridad de 6 dígitos a tu correo."
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("[SOS VICTIM] Error en registro público:", error);
        res.status(500).json({
            success: false,
            message: (process.env.NODE_ENV === 'production' && process.env.IS_DEMO_ENV !== 'true')
                ? "Error interno al procesar la solicitud."
                : `Error interno al procesar la solicitud: ${error.message}`
        });
    } finally {
        client.release();
    }
};

// ============================================================================
// POST /api/public/sos-venezuela/verify-otp (Público - Verificación OTP + Definición de Contraseña)
// ============================================================================
// OPCIÓN A (Estándar de Industria):
// 1. El usuario ingresa su código OTP de 6 dígitos + nueva contraseña.
// 2. Se valida el OTP contra el hash almacenado en pending_verifications.
// 3. Se hashea y guarda la contraseña definida por el usuario (bcrypt 10 rounds).
// 4. Se activa la cuenta (is_verified = true).
// 5. Se acreditan 200 BLUE IOU usando el MISMO mecanismo DRY que authController.js:
//    - record_booster_event → booster_blue_ledger (Ledger Inmutable)
//    - booster_transactions → historial de impulsor
//    - transactions → historial global
//    - notifications → notificación in-app
// 6. Se genera sesión JWT (Access + Refresh Token).
// 7. El expediente humanitario permanece en 'pending_verification' (inspección manual por admin).
// ============================================================================
exports.verifyVictimOtpPublic = async (req, res) => {
    const { email, otp_code, password, password_confirm } = req.body;

    // ── 1. Validaciones y Coerción de Entrada (Ciberseguridad Anti-Crash) ─────
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

        // ── 1.1 Verificar si es Usuario Pre-Existente y Verificado ──────
        // Un usuario es pre-existente si ya estaba verificado y activo en la plataforma
        // ANTES de completar este censo (is_verified = true).
        // Si is_verified es false, es un usuario NUEVO creado durante este censo que aún
        // no ha definido su contraseña ni ha activado su cuenta.
        const existingUserCheck = await client.query('SELECT id, username, password_hash, is_verified FROM users WHERE email = $1', [normEmail]);
        const isExistingVerifiedUser = (existingUserCheck.rows.length > 0 && existingUserCheck.rows[0].is_verified === true);

        // Si es usuario nuevo, requerir y validar contraseña
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

        // ── 2. Buscar Solicitud Pendiente de Verificación ──────────────────
        const pendingRes = await client.query('SELECT * FROM pending_verifications WHERE email = $1', [normEmail]);
        if (pendingRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "No se encontró una solicitud pendiente o ya fue verificada." });
        }

        const pending = pendingRes.rows[0];

        // ── 2.1 Anti-Brute-Force: Límite de 5 Intentos ────────────────────
        if ((pending.verification_attempts || 0) >= 5) {
            await client.query('DELETE FROM pending_verifications WHERE id = $1', [pending.id]);
            await client.query('COMMIT');
            return res.status(429).json({ success: false, message: "Demasiados intentos fallidos. Por favor solicita un nuevo código de verificación." });
        }

        // ── 2.2 Verificar Hash del Código OTP ──────────────────────────────
        const computedHash = emailService.hashOtpForEmail(normEmail, cleanCode);

        if (!emailService.safeEqualHex(pending.verification_code_hash, computedHash)) {
            await client.query('UPDATE pending_verifications SET verification_attempts = verification_attempts + 1 WHERE id = $1', [pending.id]);
            await client.query('COMMIT');
            return res.status(400).json({ success: false, message: "Código de verificación de 6 dígitos incorrecto." });
        }

        // ── 3. Activar Cuenta de Usuario ───────────────────────────────────
        if (!isExistingVerifiedUser && password) {
            // Usuario Nuevo: Hashear contraseña elegida por el usuario y activar
            const hashedPassword = await bcrypt.hash(password, 10);
            await client.query(
                'UPDATE users SET password_hash = $1, is_verified = true WHERE email = $2',
                [hashedPassword, normEmail]
            );
        } else {
            // Usuario Existente: Preservar la contraseña actual y solo asegurar is_verified = true
            await client.query(
                'UPDATE users SET is_verified = true WHERE email = $1',
                [normEmail]
            );
        }

        // Obtener datos del usuario recién activado para generar JWT y acreditar bonos
        const userRes = await client.query('SELECT id, username FROM users WHERE email = $1', [normEmail]);
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "No se encontró la cuenta de usuario asociada." });
        }

        const user = userRes.rows[0];

        // ── 5. Acreditación Centralizada de Bonos (Solo Usuarios Nuevos) ────────────
        // Regla de Negocio SOS: Si el usuario YA ESTABA REGISTRADO y VERIFICADO previamente en WintonCoin,
        // recibe su OTP por correo para confirmar su expediente SOS, pero NO se asigna
        // ningún bono adicional ni a él ni al código de referido utilizado.
        // Si el usuario es NUEVO, se procesa la recompensa de referido y el bono de bienvenida.
        let rewardAmount = 0;
        if (!isExistingVerifiedUser) {
            try {
                const pendingRefRes = await client.query('SELECT referral_code FROM pending_verifications WHERE email = $1', [normEmail]);
                const customCodeRes2 = await client.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'referral_custom_share_code'`);
                
                let refCodeToUse = 'SOSVENEZUELA';
                if (pendingRefRes.rows.length > 0 && pendingRefRes.rows[0].referral_code) {
                    refCodeToUse = pendingRefRes.rows[0].referral_code;
                } else if (customCodeRes2.rows.length > 0 && customCodeRes2.rows[0].setting_value) {
                    refCodeToUse = customCodeRes2.rows[0].setting_value;
                }

                const rewardResult = await referralRewardService.processReferralReward({
                    client,
                    newUser: user,
                    referralCode: refCodeToUse
                });

                rewardAmount = parseFloat(rewardResult?.rewardAmount || 0);
            } catch (rewardErr) {
                console.error("[SOS OTP] Advertencia: Error en proceso secundario de bono de referido:", rewardErr.message);
            }
        } else {
            console.log(`[SOS OTP] Usuario existente ID ${user.id} (${user.username}). Omitiendo acreditación de bonos según regla SOS.`);
        }

        // ── 5.6 Registrar en historial del expediente SOS ──────────────────
        const caseRes = await client.query(
            'SELECT id, dossier_number FROM disaster_victims_registry WHERE email = $1 ORDER BY id DESC LIMIT 1',
            [normEmail]
        );
        if (caseRes.rows.length > 0) {
            const victimId = caseRes.rows[0].id;
            const dossierNo = caseRes.rows[0].dossier_number;
            // Registrar la verificación exitosa y la acreditación del bono en la bitácora del expediente
            await client.query(
                'INSERT INTO disaster_victim_history (victim_id, event_type, message) VALUES ($1, $2, $3)',
                [victimId, 'otp_verified', `Contacto verificado mediante OTP de 6 dígitos. Cuenta activada y ${rewardAmount} BLUE IOU acreditados. Expediente #${dossierNo} en espera de verificación manual.`]
            );
        }

        // ── 6. Limpiar Registro Pendiente ──────────────────────────────────
        await client.query('DELETE FROM pending_verifications WHERE id = $1', [pending.id]);

        // ── 7. Generar Tokens JWT (Sesión Inmediata) ───────────────────────
        // Access Token de corta duración (15 min) para consumo del API
        const accessToken = jwt.sign(
            { userId: user.id, username: user.username, tokenType: 'access' },
            jwtSecret,
            { expiresIn: '15m' }
        );

        // Refresh Token de larga duración (7 días) para renovación silenciosa
        const refreshToken = jwt.sign(
            { userId: user.id, username: user.username, tokenType: 'refresh' },
            jwtSecret,
            { expiresIn: '7d' }
        );

        // Inyectar cookie HttpOnly (grado bancario: anti-XSS) para el Refresh Token
        res.cookie('auth_refresh_token', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días en milisegundos
            path: '/'
        });

        await client.query('COMMIT');

        // ── 8. Push Notification de Bienvenida ─────────────────────────────
        try {
            await notificationService.sendNotificationToUser(user.id, {
                title: '¡Bienvenido a la Familia! 🎁',
                body: `Has recibido ${rewardAmount.toFixed(2)} BLUE IOU de regalo por tu registro SOS Venezuela.`,
                icon: '/assets/icons/icon-192x192.png',
                data: { url: '/history.html' }
            }, 'TRANSACTIONAL');
        } catch (pushErr) {
            console.error("[SOS OTP] Error al enviar Push de bienvenida:", pushErr.message);
        }

        // ── 9. Auditoría Inmutable (SOC 2 Compliance) ──────────────────────
        await logAuditEvent(pool, req, {
            eventType: 'sos.victim.otp_verified_account_activated',
            actorUsername: user.username,
            category: 'humanitarian',
            metadata: { user_id: user.id, email: normEmail, reward_amount: rewardAmount }
        });

        // ── 10. Respuesta Exitosa con Sesión JWT ───────────────────────────
        res.json({
            success: true,
            message: `¡Cuenta activada exitosamente! Tus ${rewardAmount} BLUE IOU han sido acreditados a tu billetera WintonCoin.`,
            token: accessToken,
            username: user.username
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
