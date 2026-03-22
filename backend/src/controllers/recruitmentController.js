/**
 * Recruitment Controller - Winton Talent Portal
 * 
 * Gestiona el envío de CVs y postulaciones con alta seguridad.
 * - Limpieza de metadatos de archivos.
 * - Registro de auditoría.
 * - Protección contra fuerza bruta.
 */

const pool = require('../config/db');
const { logAuditEvent } = require('../services/auditService');

const ALLOWED_ROLES = new Set([
    'Frontend Developer',
    'Backend Developer',
    'UI/UX Designer',
    'Marketing / Growth',
    'Moderador de Comunidad',
    'Legal / Compliance',
    'Otro'
]);

/**
 * Sanitiza texto básico para evitar espacios extra y asegurar string.
 */
function normalizeText(value, maxLength) {
    if (typeof value !== 'string') return '';
    const normalized = value.trim().replace(/\s+/g, ' ');
    return normalized.slice(0, maxLength);
}

/**
 * Resuelve multiplicador de reclutamiento desde configuración global de Momentum.
 * Si no existe la tabla/fila, usa fallback seguro 1x.
 */
async function resolveRecruitmentMultiplier() {
    try {
        const configResult = await pool.query(
            'SELECT multiplier FROM momentum_global_config WHERE id = 1'
        );
        if (configResult.rowCount === 0) return 1;
        const multiplier = Number(configResult.rows[0].multiplier);
        if (!Number.isFinite(multiplier) || multiplier <= 0) return 1;
        return multiplier;
    } catch (error) {
        // Tabla inexistente u otro problema de DB: fallback seguro.
        if (error && error.code === '42P01') return 1;
        throw error;
    }
}

/**
 * Registra una nueva postulación de empleo
 */
exports.submitApplication = async (req, res) => {
    // Solo aceptamos JSON. Bloquea multipart/form-data para impedir subida de archivos.
    if (!req.is('application/json')) {
        return res.status(415).json({
            success: false,
            message: 'Formato no soportado. Envía los datos en application/json.'
        });
    }

    const { full_name, email, linkedin_url, role, expected_salary } = req.body || {};
    const ip_address = req.ip || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'];
    const userId = req.user ? (req.user.userId || req.user.id || null) : null; // Si está logueado, lo vinculamos

    // Validaciones y normalización de campos.
    const normalizedName = normalizeText(full_name, 120);
    const normalizedEmail = normalizeText(email, 255).toLowerCase();
    const normalizedLinkedin = normalizeText(linkedin_url || '', 500);
    const normalizedRole = normalizeText(role, 100);
    const normalizedExpectedSalary = normalizeText(expected_salary, 100);

    if (!normalizedName || normalizedName.length < 3) {
        return res.status(400).json({ success: false, message: 'Nombre completo inválido.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ success: false, message: 'Correo electrónico inválido.' });
    }

    if (!ALLOWED_ROLES.has(normalizedRole)) {
        return res.status(400).json({ success: false, message: 'Especialidad no permitida.' });
    }

    if (!normalizedExpectedSalary) {
        return res.status(400).json({ success: false, message: 'El ingreso mensual pretendido es obligatorio.' });
    }

    if (normalizedLinkedin) {
        try {
            const parsedUrl = new URL(normalizedLinkedin);
            const isLinkedInHost = parsedUrl.hostname === 'linkedin.com'
                || parsedUrl.hostname === 'www.linkedin.com';
            if (!isLinkedInHost) {
                return res.status(400).json({ success: false, message: 'El enlace debe ser de LinkedIn.' });
            }
        } catch {
            return res.status(400).json({ success: false, message: 'El enlace de LinkedIn no es válido.' });
        }
    }

    try {
        const multiplierApplied = await resolveRecruitmentMultiplier();

        console.log('[RECRUITMENT] 💾 Guardando nueva postulación.');
        // 2. Inserción Segura en DB (Preventing SQL Injection)
        const result = await pool.query(`
            INSERT INTO recruitment_proposals (
                user_id, full_name, email, linkedin_url, role, 
                expected_salary, cv_filename, multiplier_applied, 
                ip_address, user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `, [
            userId,
            normalizedName,
            normalizedEmail,
            normalizedLinkedin || null,
            normalizedRole,
            normalizedExpectedSalary,
            null, // CV deshabilitado por política actual
            multiplierApplied,
            ip_address,
            user_agent
        ]);

        const proposalId = result.rows[0].id;
        console.log(`[RECRUITMENT] ✅ Postulación guardada con ID: ${proposalId}`);

        // 3. Registro en Audit Log (Auditabilidad Bancaria - Corregido)
        await logAuditEvent(pool, req, {
            eventType: 'RECRUITMENT_APPLICATION_SUBMITTED',
            actorId: userId || 0,
            actorUsername: normalizedEmail,
            metadata: { 
                proposalId,
                role: normalizedRole,
                fullName: normalizedName,
                multiplierApplied
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Postulación recibida con éxito. Nuestro equipo revisará tu perfil.',
            applicationId: proposalId,
            multiplierApplied
        });

    } catch (error) {
        console.error('[RECRUITMENT_ERROR] ❌:', error);

        return res.status(500).json({
            success: false,
            message: 'Error interno al procesar la postulación.'
        });
    }
};

/**
 * Endpoint público para exponer la configuración de reclutamiento.
 */
exports.getPublicRecruitmentConfig = async (_req, res) => {
    try {
        const multiplier = await resolveRecruitmentMultiplier();
        return res.json({
            success: true,
            recruitmentMultiplier: multiplier
        });
    } catch (error) {
        console.error('[RECRUITMENT_CONFIG] ❌ Error al obtener configuración:', error);
        return res.status(500).json({
            success: false,
            message: 'No se pudo cargar la configuración de reclutamiento.'
        });
    }
};
