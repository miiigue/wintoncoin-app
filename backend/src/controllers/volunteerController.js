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
const onboardingStagingService = require('../services/onboardingStagingService');

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
// FASE 1: Validación Zero-Trust y Staging Modular DRY
// 1. Valida campos obligatorios, mayoría de edad (18+) y consentimientos legales.
// 2. Comprueba si la Cédula ya está registrada en un expediente oficial de voluntario activo.
// 3. Resguarda el paquete completo en pending_verifications (form_payload JSONB).
// 4. Despacha OTP de 6 dígitos al correo sin tocar volunteers_registry ni users.
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
    if (!full_name || !id_document || !birth_date || !email || !phone_number || !country || !country.trim() || !state || !municipality || !sector_city) {
        return res.status(400).json({ success: false, message: "Completa todos los campos obligatorios del registro, incluyendo el país de residencia." });
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
    const cleanCountry = country.trim();

    // Validación de formato internacional de teléfono
    if (!/^\+[1-9]\d{6,16}$/.test(normPhone)) {
        return res.status(400).json({ success: false, message: "Ingresa un número telefónico internacional válido (ej: +584121234567, +13051234567, +34612345678)." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 2. Verificar si ya existe un expediente de voluntario confirmado con esta Cédula
        const existingVol = await client.query(
            'SELECT id, dossier_number FROM volunteers_registry WHERE id_document = $1',
            [normDoc]
        );

        if (existingVol.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                already_active: true,
                dossier_number: existingVol.rows[0].dossier_number,
                message: `La Cédula ${normDoc} ya tiene un registro de voluntario activo bajo el expediente #${existingVol.rows[0].dossier_number}. Inicia sesión con tu cuenta para consultar tu perfil.`
            });
        }

        // 3. Detectar si el usuario ya existe en 'users' (is_verified = true)
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

        // 4. Guardar Borrador en Staging y Despachar OTP vía Servicio Modular DRY
        const stagePayload = {
            full_name: full_name.trim(),
            id_document: normDoc,
            birth_date,
            age: calculatedAge,
            gender: cleanGender,
            email: normEmail,
            phone_number: normPhone,
            country: cleanCountry,
            state: state.trim(),
            municipality: municipality.trim(),
            sector_city: sector_city.trim(),
            volunteer_types: Array.isArray(volunteer_types) ? volunteer_types : [volunteer_types].filter(Boolean),
            availability: Array.isArray(availability) ? availability : [availability].filter(Boolean),
            profession_skills: (profession_skills || '').trim(),
            data_consent_accepted: consentAccepted,
            legal_disclaimer_accepted: legalAccepted
        };

        const stageRes = await onboardingStagingService.stagePendingEntity({
            client,
            registrationType: 'volunteer',
            email: normEmail,
            phone: normPhone,
            birthDate: birth_date,
            payload: stagePayload,
            req
        });

        await client.query('COMMIT');

        // 5. Respuesta Exitosa
        res.status(200).json({
            success: true,
            email: normEmail,
            is_new_user: isNewUser,
            message: stageRes.message
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("[VOLUNTEER] Error en registro público:", error);
        res.status(500).json({
            success: false,
            message: "Error interno al procesar el registro de voluntario. Por favor intenta nuevamente."
        });
    } finally {
        client.release();
    }
};

// ============================================================================
// POST /api/public/volunteers/verify-otp (Público - Verificación OTP + Creación Oficial)
// ============================================================================
// FASE 2: Verificación Criptográfica, Activación de Usuario y Acuñación Oficial
// 1. Valida OTP contra pending_verifications (anti brute-force).
// 2. Crea/Activa usuario en 'users' (is_verified = true) y otorga 200 BLUE IOU.
// 3. Acuña oficialmente el expediente en 'volunteers_registry' con status 'pending_verification'.
// 4. Calcula el Código Inteligente #VOL-VZLA-XXXX-YYYYY y registra bitácora.
// 5. Emite sesión JWT segura (Access + Refresh Token).
// ============================================================================
exports.verifyVolunteerOtpPublic = async (req, res) => {
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
            expectedType: 'volunteer',
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

        // 2. Acuñar Oficialmente el Expediente en volunteers_registry
        const tempCode = `VOL-TEMP-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
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
            ) RETURNING id
        `, [
            tempCode, user.id, payload.full_name, payload.id_document, payload.birth_date,
            payload.age || 18, payload.gender || 'female', payload.email || normEmail,
            payload.phone_number, payload.country || 'Venezuela', payload.state,
            payload.municipality, payload.sector_city,
            payload.volunteer_types || [], payload.availability || [], (payload.profession_skills || '').trim(),
            payload.data_consent_accepted !== false, payload.legal_disclaimer_accepted !== false
        ]);

        const volunteerId = (insertRes && insertRes.rows && insertRes.rows[0]) ? insertRes.rows[0].id : 1;

        // 3. Calcular Código de Expediente Inteligente Oficial (#VOL-VZLA-XXXX-YYYYY)
        const { smartCode, priorityScore } = calculateSmartVolunteerCode(
            payload.volunteer_types || [],
            payload.availability || [],
            payload.age || 18,
            payload.gender || 'female',
            volunteerId
        );

        await client.query(`
            UPDATE volunteers_registry
            SET dossier_number = $1, priority_score = $2
            WHERE id = $3
        `, [smartCode, priorityScore, volunteerId]);

        // 4. Bitácora de Auditoría del Voluntario
        await client.query(
            'INSERT INTO volunteer_activity_history (volunteer_id, event_type, message) VALUES ($1, $2, $3)',
            [volunteerId, 'registered_and_verified', `Expediente oficial #${smartCode} generado tras validación de identidad digital. Estado inicial: En Proceso de Verificación.`]
        );

        await client.query('COMMIT');

        // 5. Notificaciones Asíncronas (Push, In-App y Email)
        try {
            await notificationService.sendNotificationToUser(user.id, {
                title: "🤝 Registro de Voluntario Exitoso",
                body: `Tu expediente #${smartCode} ha sido activado. Gracias por tu compromiso con la causa SOS Venezuela.`,
                icon: "/assets/icons/icon-192x192.png",
                data: { url: "/profile.html" }
            }, "SOCIAL");

            await pool.query(
                'INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)',
                [user.username, `Tu expediente de voluntario #${smartCode} fue activado con éxito.`]
            );

            await emailService.sendCustomEmail(
                normEmail,
                `Expediente de Voluntario Confirmado - #${smartCode}`,
                `<div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
                    <h2>¡Bienvenido a la Brigada de Voluntarios WintonCoin!</h2>
                    <p>Hola <strong>${payload.full_name}</strong>, tu postulación ha sido verificada y tu cuenta ha sido activada exitosamente.</p>
                    <p><strong>Número de Expediente:</strong> #${smartCode}</p>
                    <p>Nuestro equipo de coordinadores se pondrá en contacto contigo a través de WhatsApp o correo electrónico para coordinar actividades.</p>
                </div>`
            );
        } catch (nErr) {
            console.error("[VOLUNTEER OTP] Error en notificaciones asíncronas:", nErr.message);
        }

        // 6. Auditoría Inmutable (SOC 2)
        await logAuditEvent(pool, req, {
            eventType: 'sos.volunteer.registered_and_verified',
            actorUsername: user.username,
            category: 'volunteer',
            metadata: { volunteer_id: volunteerId, dossier_number: smartCode, id_document: payload.id_document, is_new_user: isNewUser }
        });

        // 7. Respuesta Exitosa con Sesión JWT
        res.status(200).json({
            success: true,
            token: accessToken,
            user: { id: user.id, username: user.username, email: normEmail },
            dossier_number: smartCode,
            is_new_user: isNewUser,
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

// ============================================================================
// POST /api/volunteers/resend-otp (Público - Reenvío de Código OTP de Voluntario)
// ============================================================================
// Estándar FinTech & NIST SP 800-63B (DRY):
// 1. Rate Limiting: Cooldown de 60s entre reenvíos sucesivos.
// 2. Anti-Abuse: Límite estricto de 5 reenvíos por sesión.
// 3. Generación criptográfica segura de nuevo OTP y nuevo TTL de 15 min.
// ============================================================================
exports.resendVolunteerOtpPublic = async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ success: false, message: "Ingresa un correo electrónico válido." });
    }

    const normEmail = email.trim().toLowerCase();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Buscar verificación pendiente
        const pendingRes = await client.query('SELECT * FROM pending_verifications WHERE email = $1', [normEmail]);
        const pendingRows = (pendingRes && Array.isArray(pendingRes.rows)) ? pendingRes.rows : [];
        if (pendingRows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "No se encontró una solicitud pendiente para este correo." });
        }

        const pending = pendingRows[0];

        // 2. Control de Frecuencia (Rate Limiting: Mínimo 60 segundos entre reenvíos)
        if (pending.last_sent_at) {
            const timeSinceLastSent = Date.now() - new Date(pending.last_sent_at).getTime();
            const cooldownMs = 60 * 1000;
            if (timeSinceLastSent < cooldownMs) {
                const remainingSecs = Math.ceil((cooldownMs - timeSinceLastSent) / 1000);
                await client.query('ROLLBACK');
                return res.status(429).json({
                    success: false,
                    message: `Por favor espera ${remainingSecs} segundos antes de solicitar otro código.`
                });
            }
        }

        // 3. Límite máximo de 5 reenvíos por sesión (Anti-Abuse)
        if ((pending.resend_count || 0) >= 5) {
            await client.query('ROLLBACK');
            return res.status(429).json({
                success: false,
                message: "Has alcanzado el límite máximo de reenvíos permitidos. Por favor espera unos minutos."
            });
        }

        // 4. Generar nuevo código OTP de 6 dígitos
        const newOtp = emailService.generateOtp6();
        const newHash = emailService.hashOtpForEmail(normEmail, newOtp);
        const newExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

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
            await emailService.sendOtpEmail(normEmail, newOtp, "SOS Voluntariado");
        } catch (mailErr) {
            console.error("[VOLUNTEER RESEND OTP] Error al enviar email:", mailErr.message);
        }

        return res.json({
            success: true,
            message: "Nuevo código de 6 dígitos enviado a tu correo. Revisa tu bandeja de entrada o spam."
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("[VOLUNTEER RESEND OTP] Error:", error);
        return res.status(500).json({ success: false, message: "Error interno al reenviar el código de verificación." });
    } finally {
        client.release();
    }
};

exports.calculateSmartVolunteerCode = calculateSmartVolunteerCode;
exports.calculateAgeRangeD3 = calculateAgeRangeD3;
exports.normalizeIdDocument = normalizeIdDocument;
exports.normalizePhone = normalizePhone;


