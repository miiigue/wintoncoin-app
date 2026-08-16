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
    'Fullstack Developer',
    'Smart Contract / Solidity Developer',
    'DevOps & Cloud Engineer',
    'QA & Testing Engineer',
    'UI/UX & Product Designer',
    'AI & Data Engineer',
    'Product Manager / Owner',
    'Marketing / Growth & SEO',
    'Community & Social Media Manager',
    'Moderador de Comunidad',
    'Legal / Compliance & FinTech',
    'Copywriter & Content Creator',
    'UI/UX Designer',
    'Marketing / Growth',
    'Legal / Compliance',
    'Voluntario',
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
    // Solo aceptamos JSON. Bloquea multipart/form-data para impedir subida no autorizada de archivos.
    if (!req.is('application/json')) {
        return res.status(415).json({
            success: false,
            message: 'Formato no soportado. Envía los datos en application/json.'
        });
    }

    const { 
        full_name, email, linkedin_url, cv_url, 
        portfolio_url, github_url, role, other_role,
        years_experience, expected_salary, cover_letter 
    } = req.body || {};

    const ip_address = req.ip || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'];
    const userId = req.user ? (req.user.userId || req.user.id || null) : null; // Si está logueado, lo vinculamos

    // Validaciones y normalización de campos con límites de longitud seguros
    const normalizedName = normalizeText(full_name, 120);
    const normalizedEmail = normalizeText(email, 255).toLowerCase();
    const normalizedLinkedin = normalizeText(linkedin_url || '', 500);
    const normalizedCvUrl = normalizeText(cv_url || '', 500);
    const normalizedPortfolioUrl = normalizeText(portfolio_url || '', 500);
    const normalizedGithubUrl = normalizeText(github_url || '', 500);
    let normalizedRole = normalizeText(role, 100);
    const normalizedOtherRole = normalizeText(other_role || '', 100);
    const normalizedYearsExp = normalizeText(years_experience || '', 50);
    const normalizedExpectedSalary = normalizeText(expected_salary, 100);
    const normalizedCoverLetter = normalizeText(cover_letter || '', 2000);

    // 1. Validaciones requeridas de la plataforma (Campos Obligatorios)
    if (!normalizedName || normalizedName.length < 3) {
        return res.status(400).json({ success: false, message: 'El nombre completo es obligatorio (mínimo 3 caracteres).' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ success: false, message: 'Ingresa un correo electrónico válido.' });
    }

    if (!ALLOWED_ROLES.has(normalizedRole)) {
        return res.status(400).json({ success: false, message: 'Selecciona una especialidad válida.' });
    }

    // Manejo de la opción dinámica "Otro"
    if (normalizedRole === 'Otro') {
        if (!normalizedOtherRole || normalizedOtherRole.length < 2) {
            return res.status(400).json({ success: false, message: 'Especifica tu especialidad en el campo "¿Cuál otra especialidad?".' });
        }
        normalizedRole = `Otro: ${normalizedOtherRole}`;
    }

    if (!normalizedYearsExp) {
        return res.status(400).json({ success: false, message: 'Selecciona tus años de experiencia profesional.' });
    }

    if (!normalizedCvUrl) {
        return res.status(400).json({ success: false, message: 'El enlace a tu CV en la nube es obligatorio.' });
    }

    if (!normalizedExpectedSalary) {
        return res.status(400).json({ success: false, message: 'El ingreso mensual pretendido es obligatorio.' });
    }

    if (!normalizedCoverLetter || normalizedCoverLetter.length < 10) {
        return res.status(400).json({ success: false, message: 'La carta de presentación es obligatoria (mínimo 10 caracteres).' });
    }

    // Helper de validación de protocolo de URL seguro (HTTPS obligado)
    const validateHttpsUrl = (urlStr, fieldName) => {
        if (!urlStr) return null;
        try {
            const parsed = new URL(urlStr);
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
                throw new Error('Protocolo no seguro.');
            }
            return parsed.toString();
        } catch {
            throw new Error(`El enlace proporcionado para ${fieldName} no es una URL válida.`);
        }
    };

    // 2. Validación de URLs
    let validatedLinkedin = null;
    let validatedCvUrl = null;
    let validatedPortfolio = null;
    let validatedGithub = null;

    try {
        validatedCvUrl = validateHttpsUrl(normalizedCvUrl, 'tu CV');
        if (!validatedCvUrl) {
            return res.status(400).json({ success: false, message: 'El enlace a tu CV no es válido.' });
        }

        if (normalizedLinkedin) {
            const parsedLinkedin = new URL(normalizedLinkedin);
            const isLinkedInHost = parsedLinkedin.hostname === 'linkedin.com'
                || parsedLinkedin.hostname.endsWith('.linkedin.com');
            if (!isLinkedInHost) {
                return res.status(400).json({ success: false, message: 'El enlace de LinkedIn debe pertenecer estrictamente a linkedin.com.' });
            }
            validatedLinkedin = parsedLinkedin.toString();
        }

        if (normalizedPortfolioUrl) {
            validatedPortfolio = validateHttpsUrl(normalizedPortfolioUrl, 'tu Portfolio');
        }

        if (normalizedGithubUrl) {
            validatedGithub = validateHttpsUrl(normalizedGithubUrl, 'tu GitHub');
        }
    } catch (urlErr) {
        return res.status(400).json({ success: false, message: urlErr.message });
    }

    try {
        const multiplierApplied = await resolveRecruitmentMultiplier();

        console.log('[RECRUITMENT] 💾 Guardando nueva postulación estructurada de talento.');
        
        // Inserción Segura en DB mediante consulta SQL 100% parametrizada ($1...$14)
        const result = await pool.query(`
            INSERT INTO recruitment_proposals (
                user_id, full_name, email, linkedin_url, cv_url,
                portfolio_url, github_url, role, years_experience,
                expected_salary, cover_letter, cv_filename, 
                multiplier_applied, ip_address, user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id
        `, [
            userId,
            normalizedName,
            normalizedEmail,
            validatedLinkedin,
            validatedCvUrl,
            validatedPortfolio,
            validatedGithub,
            normalizedRole,
            normalizedYearsExp || null,
            normalizedExpectedSalary,
            normalizedCoverLetter || null,
            null, // cv_filename deprecado a favor de cv_url en la nube (Zero Server File Vector)
            multiplierApplied,
            ip_address,
            user_agent
        ]);

        const proposalId = result.rows[0].id;
        console.log(`[RECRUITMENT] ✅ Postulación guardada con ID: ${proposalId}`);

        // 3. Registro en Audit Log (Auditabilidad Bancaria)
        await logAuditEvent(pool, req, {
            eventType: 'RECRUITMENT_APPLICATION_SUBMITTED',
            actorId: userId || 0,
            actorUsername: normalizedEmail,
            metadata: { 
                proposalId,
                role: normalizedRole,
                fullName: normalizedName,
                hasCvUrl: !!validatedCvUrl,
                hasLinkedin: !!validatedLinkedin,
                multiplierApplied
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Postulación recibida con éxito. Nuestro equipo revisará tu perfil de talento.',
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
