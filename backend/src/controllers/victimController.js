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

const pool = require('../config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { logAuditEvent } = require('../services/auditService');
const emailService = require('../services/emailService');

/**
 * Calcula el Código de Expediente Inteligente de 3 dígitos centrales:
 * Formato: SOS-VZLA-[D1][D2][D3]-[SECUENCIAL]
 */
function calculateSmartDossierCode(gender, isHeadOfFamily, minors, elderly, disabled, affectationLevel, sequenceId) {
    // DÍGITO 1: Perfil y Rol
    let d1 = 5; // Default: Joven/Otro
    if (disabled > 0) {
        d1 = 4; // Persona con Discapacidad
    } else if (elderly > 0 && minors === 0) {
        d1 = 3; // Adulto Mayor solo/a cargo
    } else if (gender === 'female' || gender === 'f') {
        d1 = 2; // Mujer Cabeza de Familia
    } else if (gender === 'male' || gender === 'm') {
        d1 = 1; // Hombre Cabeza de Familia
    }

    // DÍGITO 2: Total exacto de dependientes a cargo (0 a 9)
    const totalDependents = (parseInt(minors, 10) || 0) + (parseInt(elderly, 10) || 0) + (parseInt(disabled, 10) || 0);
    const d2 = Math.min(totalDependents, 9);

    // DÍGITO 3: Nivel de Urgencia
    let d3 = 1; // Estándar
    if (affectationLevel === 'total_loss' || affectationLevel === 'medical_emergency') {
        d3 = 9; // Urgencia Máxima
    } else if (affectationLevel === 'partial_damage') {
        d3 = 5; // Urgencia Media
    }

    const padSeq = String(sequenceId).padStart(5, '0');
    return `SOS-VZLA-${d1}${d2}${d3}-${padSeq}`;
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

// ============================================================================
// POST /api/public/sos-venezuela/register-victim (Público)
// ============================================================================
exports.registerVictimPublic = async (req, res) => {
    const {
        full_name,
        id_document,
        gender = 'female',
        is_head_of_family = true,
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
        data_consent_accepted = true,
        sworn_declaration_accepted = true
    } = req.body;

    // 1. Validaciones de presencia
    if (!full_name || !id_document || !email || !phone_number || !state || !municipality || !sector || !address_details || !description) {
        return res.status(400).json({ success: false, message: "Por favor completa todos los campos obligatorios del censo." });
    }

    if (!data_consent_accepted || !sworn_declaration_accepted) {
        return res.status(400).json({ success: false, message: "Debes aceptar el consentimiento de tratamiento de datos y la declaración jurada." });
    }

    const normDoc = normalizeIdDocument(id_document);
    const normPhone = normalizePhone(phone_number);
    const normEmail = email.trim().toLowerCase();

    // 2. Validar prefijo +58
    if (!normPhone.startsWith('+58')) {
        return res.status(400).json({ success: false, message: "Por el momento solo se aceptan registros de números telefónicos de Venezuela (+58)." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 3. Verificar si la Cédula ya tiene un expediente
        const existingDossier = await client.query(
            'SELECT id, dossier_number FROM disaster_victims_registry WHERE id_document = $1',
            [normDoc]
        );

        if (existingDossier.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: `La Cédula ${normDoc} ya tiene una solicitud registrada bajo el expediente #${existingDossier.rows[0].dossier_number}.`
            });
        }

        // 4. Buscar o Crear Cuenta WintonCoin con código 'SOSVENEZUELA'
        let userId = null;
        let username = null;
        const userCheck = await client.query(
            'SELECT id, username, is_email_verified FROM users WHERE email = $1 OR phone_number = $2',
            [normEmail, normPhone]
        );

        const verificationCode = emailService.generateOtp6();
        const verificationCodeHash = emailService.hashOtpForEmail(normEmail, verificationCode);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

        if (userCheck.rows.length > 0) {
            userId = userCheck.rows[0].id;
            username = userCheck.rows[0].username;
        } else {
            // Crear usuario nuevo automáticamente (con verificación pendiente)
            const tempPassword = crypto.randomBytes(6).toString('hex');
            const hashedPassword = await bcrypt.hash(tempPassword, 10);
            const baseUsername = normEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').substring(0, 20);
            username = `${baseUsername}_${Math.floor(100 + Math.random() * 900)}`;

            const newUserRes = await client.query(`
                INSERT INTO users (username, email, password_hash, phone_number, referral_code_used, is_email_verified)
                VALUES ($1, $2, $3, $4, 'SOSVENEZUELA', false)
                RETURNING id
            `, [username, normEmail, hashedPassword, normPhone]);

            userId = newUserRes.rows[0].id;

            // Guardar solicitud de verificación en pending_verifications
            await client.query(`
                INSERT INTO pending_verifications (
                    username, email, password_hash, phone_number, referral_code,
                    verification_code_hash, verification_attempts, resend_count, last_sent_at, expires_at
                ) VALUES ($1, $2, $3, $4, 'SOSVENEZUELA', $5, 0, 0, NOW(), $6)
                ON CONFLICT (email) DO UPDATE
                SET verification_code_hash = EXCLUDED.verification_code_hash, expires_at = EXCLUDED.expires_at;
            `, [username, normEmail, hashedPassword, normPhone, verificationCodeHash, expiresAt]);

            // Acreditar Bono SOSVENEZUELA inicial
            await client.query(`
                INSERT INTO blue_token_escrows (username, amount, unlock_at, is_released)
                VALUES ($1, 200, NOW() + INTERVAL '30 days', false)
                ON CONFLICT DO NOTHING;
            `, [username]);
        }

        // 5. Insertar Registro Temporal para obtener ID secuencial
        const tempDossierCode = `TEMP-${Date.now()}`;
        const insertRes = await client.query(`
            INSERT INTO disaster_victims_registry (
                dossier_number, user_id, full_name, id_document, gender, is_head_of_family,
                email, phone_number, state, municipality, sector, address_details,
                dependents_minors, dependents_elderly, dependents_disabled,
                affectation_level, description, evidence_urls, status,
                data_consent_accepted, sworn_declaration_accepted
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11, $12,
                $13, $14, $15,
                $16, $17, $18, 'pending_verification',
                $19, $20
            ) RETURNING id;
        `, [
            tempDossierCode, userId, full_name.trim(), normDoc, gender, Boolean(is_head_of_family),
            normEmail, normPhone, state.trim(), municipality.trim(), sector.trim(), address_details.trim(),
            parseInt(dependents_minors, 10) || 0, parseInt(dependents_elderly, 10) || 0, parseInt(dependents_disabled, 10) || 0,
            affectation_level, description.trim(), Array.isArray(evidence_urls) ? evidence_urls : [],
            Boolean(data_consent_accepted), Boolean(sworn_declaration_accepted)
        ]);

        const victimId = insertRes.rows[0].id;

        // 6. Calcular Código de Expediente Inteligente
        const smartDossierCode = calculateSmartDossierCode(
            gender, is_head_of_family, dependents_minors, dependents_elderly, dependents_disabled, affectation_level, victimId
        );

        // Actualizar dossier_number final
        await client.query(
            'UPDATE disaster_victims_registry SET dossier_number = $1 WHERE id = $2',
            [smartDossierCode, victimId]
        );

        await client.query('COMMIT');

        // 7. Enviar OTP de seguridad de 6 dígitos y correo de confirmación de expediente (asíncrono)
        try {
            const ipRaw = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
            const ip = ipRaw.split(',')[0].trim();
            await emailService.sendOtpEmail({ toEmail: normEmail, otp: verificationCode, context: { ip, requestedAt: new Date().toISOString() } });

            const templateRes = await pool.query(
                "SELECT subject, html_body FROM email_templates_sos WHERE template_key = 'victim_registration_confirm'"
            );
            if (templateRes.rows.length > 0) {
                let { subject, html_body } = templateRes.rows[0];
                subject = subject.replace(/{{expediente}}/g, smartDossierCode);
                html_body = html_body.replace(/{{nombre}}/g, full_name).replace(/{{expediente}}/g, smartDossierCode);

                await emailService.sendCustomEmail(normEmail, subject, html_body);
            }
        } catch (mailErr) {
            console.error("[SOS VICTIM] Error al enviar emails de OTP / confirmación:", mailErr.message);
        }

        // 8. Auditoría
        await logAuditEvent(pool, req, {
            eventType: 'sos.victim.registered',
            actorUsername: normEmail,
            category: 'humanitarian',
            metadata: { victim_id: victimId, dossier_number: smartDossierCode, id_document: normDoc }
        });

        res.status(201).json({
            success: true,
            dossier_number: smartDossierCode,
            email: normEmail,
            message: "Solicitud de asistencia humanitaria registrada exitosamente. Se ha enviado un código de seguridad de 6 dígitos a tu correo."
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("[SOS VICTIM] Error en registro público:", error);
        res.status(500).json({ success: false, message: "Error interno al procesar la solicitud." });
    } finally {
        client.release();
    }
};

// ============================================================================
// POST /api/public/sos-venezuela/verify-otp (Público - Verificación de 6 dígitos)
// ============================================================================
exports.verifyVictimOtpPublic = async (req, res) => {
    const { email, otp_code } = req.body;
    if (!email || !otp_code) {
        return res.status(400).json({ success: false, message: "Ingresa tu correo y el código de 6 dígitos." });
    }

    const normEmail = email.trim().toLowerCase();
    const cleanCode = otp_code.trim();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const pendingRes = await client.query('SELECT * FROM pending_verifications WHERE email = $1', [normEmail]);
        if (pendingRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "No se encontró una solicitud pendiente o ya fue verificada." });
        }

        const pending = pendingRes.rows[0];
        const computedHash = emailService.hashOtpForEmail(normEmail, cleanCode);

        if (!emailService.safeEqualHex(pending.verification_code_hash, computedHash)) {
            await client.query('UPDATE pending_verifications SET verification_attempts = verification_attempts + 1 WHERE id = $1', [pending.id]);
            await client.query('COMMIT');
            return res.status(400).json({ success: false, message: "Código de verificación de 6 dígitos incorrecto." });
        }

        // Marcar usuario como verificado en la tabla users
        await client.query('UPDATE users SET is_email_verified = true WHERE email = $1', [normEmail]);
        await client.query('DELETE FROM pending_verifications WHERE id = $1', [pending.id]);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: "¡Cuenta activada exitosamente! Tus 200 BLUE IOU han sido acreditados a tu billetera WintonCoin."
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("[SOS OTP] Error al verificar OTP:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    } finally {
        client.release();
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

        res.json({
            success: true,
            victim,
            disbursements: disbursementsRes.rows
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
        const victimRes = await pool.query('SELECT * FROM disaster_victims_registry WHERE id = $1', [id]);
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
                const tmpl = await pool.query("SELECT subject, html_body FROM email_templates_sos WHERE template_key = 'victim_info_requested'");
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
                const tmpl = await pool.query("SELECT subject, html_body FROM email_templates_sos WHERE template_key = 'victim_aid_approved'");
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
        } catch (mailErr) {
            console.error("[SOS VICTIM ADMIN] Error al enviar notificación de estado:", mailErr.message);
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
        if (victim.username) {
            await client.query(`
                INSERT INTO blue_token_escrows (username, amount, unlock_at, is_released)
                VALUES ($1, $2, NOW(), true);
            `, [victim.username, amount]);
        }

        // 3. Actualizar estado a 'disbursed'
        await client.query(`
            UPDATE disaster_victims_registry 
            SET status = 'disbursed', updated_at = NOW() 
            WHERE id = $1
        `, [id]);

        await client.query('COMMIT');

        // 4. Notificar por correo
        try {
            const tmpl = await pool.query("SELECT subject, html_body FROM email_templates_sos WHERE template_key = 'victim_aid_approved'");
            if (tmpl.rows.length > 0) {
                let { subject, html_body } = tmpl.rows[0];
                subject = subject.replace(/{{expediente}}/g, victim.dossier_number);
                html_body = html_body
                    .replace(/{{nombre}}/g, victim.full_name)
                    .replace(/{{expediente}}/g, victim.dossier_number)
                    .replace(/{{monto_blue}}/g, amount.toString());

                await emailService.sendCustomEmail(victim.email, subject, html_body);
            }
        } catch (mErr) {
            console.error("[SOS DISBURSE] Error al enviar email:", mErr.message);
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
