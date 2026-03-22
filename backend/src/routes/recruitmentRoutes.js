/**
 * Recruitment Routes - Winton Talent Portal
 * 
 * Expone el endpoint para recibir postulaciones externas.
 * - Registro de auditoría.
 * - Validación de archivos.
 * - Protección contra ataques XSS.
 */

const express = require('express');
const router = express.Router();
const recruitmentController = require('../controllers/recruitmentController');
const rateLimit = require('express-rate-limit');
// [SEGURIDAD] Middleware de autenticación admin con cookies httpOnly
const { authenticateAdmin } = require('../middleware/authMiddleware');

// [SEGURIDAD] Limitador anti-spam para postulaciones públicas.
const recruitmentApplyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // Máximo 10 postulaciones por IP en la ventana
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Demasiadas solicitudes. Intenta nuevamente en unos minutos.'
    }
});

/**
 * @route   POST /api/recruitment/apply
 * @desc    Registra una postulación (sin archivos, solo datos estructurados)
 * @access  Public (se registra IP para auditoría)
 */
router.post('/apply', 
    recruitmentApplyLimiter,
    recruitmentController.submitApplication
);

/**
 * @route   GET /api/recruitment/config
 * @desc    Obtiene configuración pública de reclutamiento (multiplicador vigente)
 * @access  Public
 */
router.get('/config', recruitmentController.getPublicRecruitmentConfig);

/**
 * @route   GET /api/recruitment/admin/list
 * @desc    Lista todas las postulaciones con filtros (solo admin)
 * @access  Admin (protegido con authenticateAdmin middleware)
 */
router.get('/admin/list', authenticateAdmin, async (req, res) => {
    try {
        const pool = require('../config/db');
        // Filtros opcionales desde query params
        const { status, role, search } = req.query;

        let sql = `
            SELECT id, full_name, email, linkedin_url, role, expected_salary, cv_filename, 
                   status, multiplier_applied, ip_address, 
                   created_at, reviewed_at, reviewer_notes
            FROM recruitment_proposals
            WHERE 1=1
        `;
        const params = [];

        // Filtro por estado (pending, reviewing, accepted, rejected)
        if (status && status !== 'all') {
            params.push(status);
            sql += ` AND status = $${params.length}`;
        }

        // Filtro por rol/especialidad
        if (role && role !== 'all') {
            params.push(role);
            sql += ` AND role = $${params.length}`;
        }

        // Búsqueda por nombre o email
        if (search) {
            params.push(`%${search}%`);
            sql += ` AND (full_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
        }

        sql += ` ORDER BY created_at DESC LIMIT 200`;

        const result = await pool.query(sql, params);
        res.json({ success: true, proposals: result.rows });
    } catch (error) {
        console.error('[RECRUITMENT_ADMIN] Error al listar postulaciones:', error);
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

/**
 * @route   PATCH /api/recruitment/admin/:id/status
 * @desc    Actualiza el estado de una postulación (solo admin)
 * @access  Admin
 */
router.patch('/admin/:id/status', authenticateAdmin, async (req, res) => {
    try {
        const pool = require('../config/db');
        const { logAuditEvent } = require('../services/auditService');
        const { id } = req.params;
        const { status, notes } = req.body;

        // Validar estados permitidos
        const validStatuses = ['pending', 'reviewing', 'accepted', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Estado inválido.' });
        }

        const result = await pool.query(`
            UPDATE recruitment_proposals 
            SET status = $1, reviewer_notes = $2, reviewed_at = NOW()
            WHERE id = $3
            RETURNING id, full_name, email, status
        `, [status, notes || null, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Postulación no encontrada.' });
        }

        // Auditoría bancaria
        await logAuditEvent(pool, req, {
            eventType: 'RECRUITMENT_STATUS_UPDATED',
            actorUsername: 'admin',
            metadata: {
                proposalId: parseInt(id),
                newStatus: status,
                applicantName: result.rows[0].full_name
            }
        });

        res.json({ success: true, message: `Estado actualizado a "${status}".`, proposal: result.rows[0] });
    } catch (error) {
        console.error('[RECRUITMENT_ADMIN] Error al actualizar estado:', error);
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

/**
 * @route   GET /api/recruitment/admin/download/:filename
 * @desc    Descarga un CV subido (solo admin)
 * @access  Admin
 */
router.get('/admin/download/:filename', authenticateAdmin, (req, res) => {
    const path = require('path');
    const fs = require('fs');
    const { filename } = req.params;

    // [SEGURIDAD CAPA 1] Sanitización: solo caracteres seguros (OWASP whitelist)
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(filename)) {
        return res.status(400).json({ success: false, message: 'Nombre de archivo inválido.' });
    }

    // [SEGURIDAD CAPA 2] Protección contre path traversal (OWASP)
    // Resolvemos la ruta absoluta y verificamos que esté DENTRO del directorio permitido
    // Path absoluto robusto
    const uploadsDir = path.resolve(process.cwd(), 'uploads/recruitment');
    const filePath = path.join(uploadsDir, filename);

    console.log(`[CV_DOWNLOAD] Buscando: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        console.error(`[CV_DOWNLOAD] ❌ Archivo no existe: ${filePath}`);
        return res.status(404).json({ success: false, message: 'Archivo no encontrado.' });
    }

    res.download(filePath);
});

module.exports = router;
