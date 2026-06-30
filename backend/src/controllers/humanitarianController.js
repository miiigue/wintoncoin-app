// ============================================================================
// CONTROLADOR: Gestión Administrativa de Causas Humanitarias
// ============================================================================
// Módulo: humanitarianController.js
// Responsabilidad: Manejar las solicitudes HTTP para gestión admin de causas
// Seguridad: Solo accesible por administradores (authenticateAdmin middleware)
// Auditoría: Todas las acciones generan registros en audit_log
// ============================================================================

const pool = require('../config/db');
const { logAuditEvent } = require('../services/auditService');

// ============================================================================
// GET /api/admin/humanitarian/causes
// Lista todas las causas humanitarias con filtros y datos del usuario
// ============================================================================
const listCauses = async (req, res) => {
    try {
        // Extraer parámetros de filtro del query string
        const { status, search, limit = 50, offset = 0 } = req.query;

        // Construir query dinámica con filtros opcionales
        let conditions = [];
        let params = [];
        let paramIndex = 1;

        // Filtro por estado (pending, approved, rejected, completed)
        if (status && status !== 'all') {
            conditions.push(`hc.status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        // Filtro por búsqueda (título o nombre de usuario)
        if (search && search.trim().length > 0) {
            conditions.push(`(
                LOWER(hc.title) LIKE $${paramIndex} 
                OR LOWER(u.username) LIKE $${paramIndex}
            )`);
            params.push(`%${search.trim().toLowerCase()}%`);
            paramIndex++;
        }

        // Construir cláusula WHERE
        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        // Query principal con JOIN a users para obtener datos del solicitante
        const sql = `
            SELECT 
                hc.id,
                hc.title,
                hc.story,
                hc.goal_amount,
                hc.current_amount,
                hc.status,
                hc.evidence_urls,
                hc.admin_notes,
                hc.created_at,
                hc.updated_at,
                u.id AS user_id,
                u.username,
                u.email
            FROM humanitarian_causes hc
            JOIN users u ON hc.user_id = u.id
            ${whereClause}
            ORDER BY 
                CASE hc.status 
                    WHEN 'pending' THEN 0 
                    WHEN 'approved' THEN 1 
                    WHEN 'rejected' THEN 2 
                    WHEN 'completed' THEN 3 
                END,
                hc.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(sql, params);

        // Contar total para paginación
        const countSql = `
            SELECT COUNT(*) AS total 
            FROM humanitarian_causes hc
            JOIN users u ON hc.user_id = u.id
            ${whereClause}
        `;
        // Usar solo los params de filtro (sin limit/offset)
        const countResult = await pool.query(countSql, params.slice(0, -2));

        // Contar pendientes para el badge del sidebar
        const pendingResult = await pool.query(
            `SELECT COUNT(*) AS pending FROM humanitarian_causes WHERE status = 'pending'`
        );

        res.json({
            success: true,
            causes: result.rows,
            total: parseInt(countResult.rows[0].total),
            pending_count: parseInt(pendingResult.rows[0].pending)
        });

    } catch (error) {
        console.error('[HUMANITARIAN_ADMIN] Error al listar causas:', error);
        res.status(500).json({ message: 'Error interno al obtener la lista de causas.' });
    }
};

// ============================================================================
// GET /api/admin/humanitarian/causes/:id
// Obtiene el detalle completo de una causa específica
// ============================================================================
const getCauseDetail = async (req, res) => {
    try {
        const { id } = req.params;

        // Validar que el ID sea numérico (prevención de inyección)
        if (isNaN(parseInt(id))) {
            return res.status(400).json({ message: 'ID de causa inválido.' });
        }

        const sql = `
            SELECT 
                hc.*,
                u.username,
                u.email,
                u.created_at AS user_registered_at,
                ref.username AS referrer_username,
                ref.referral_code AS referrer_referral_code
            FROM humanitarian_causes hc
            JOIN users u ON hc.user_id = u.id
            LEFT JOIN users ref ON u.referrer_id = ref.id
            WHERE hc.id = $1
        `;
        const result = await pool.query(sql, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Causa no encontrada.' });
        }

        res.json({
            success: true,
            cause: result.rows[0]
        });

    } catch (error) {
        console.error('[HUMANITARIAN_ADMIN] Error al obtener detalle:', error);
        res.status(500).json({ message: 'Error interno al obtener el detalle de la causa.' });
    }
};

// ============================================================================
// PATCH /api/admin/humanitarian/causes/:id/approve
// Aprueba una causa humanitaria + Notifica al usuario
// SEGURIDAD: Solo causas en estado 'pending' pueden ser aprobadas
// AUDITORÍA: Registra el evento con el admin que aprobó
// ============================================================================
const approveCause = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { admin_notes } = req.body;

        // Validar ID numérico
        if (isNaN(parseInt(id))) {
            return res.status(400).json({ message: 'ID de causa inválido.' });
        }

        await client.query('BEGIN');

        // 1. Obtener causa actual con bloqueo (FOR UPDATE previene race conditions)
        const causeResult = await client.query(
            `SELECT hc.*, u.username 
             FROM humanitarian_causes hc 
             JOIN users u ON hc.user_id = u.id 
             WHERE hc.id = $1 FOR UPDATE`,
            [id]
        );

        if (causeResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Causa no encontrada.' });
        }

        const cause = causeResult.rows[0];

        // SEGURIDAD: Solo se pueden aprobar causas pendientes
        if (cause.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: `Esta causa ya fue procesada (estado actual: ${cause.status}).`
            });
        }

        // 2. Actualizar estado a 'approved'
        await client.query(
            `UPDATE humanitarian_causes 
             SET status = 'approved', 
                 admin_notes = $1, 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2`,
            [admin_notes || null, id]
        );

        // 3. Notificación in-app al usuario (misma tabla notifications del sistema)
        await client.query(
            `INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
            [
                cause.username,
                `🎉 ¡Tu postulación solidaria "${cause.title}" ha sido APROBADA! Tus referidos ahora pueden donarte sus BLUE IOU.`
            ]
        );

        // 4. Auditoría bancaria (trazabilidad total)
        await logAuditEvent(client, req, {
            eventType: 'HUMANITARIAN_CAUSE_APPROVED',
            actorUsername: req.user.username || 'admin',
            targetUsername: cause.username,
            category: 'HUMANITARIAN_ADMIN',
            metadata: {
                cause_id: parseInt(id),
                cause_title: cause.title,
                goal_amount: parseFloat(cause.goal_amount),
                admin_notes: admin_notes || null
            }
        });

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Causa #${id} aprobada exitosamente. El usuario ${cause.username} ha sido notificado.`
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[HUMANITARIAN_ADMIN] Error al aprobar causa:', error);
        res.status(500).json({ message: 'Error interno al aprobar la causa.' });
    } finally {
        client.release();
    }
};

// ============================================================================
// PATCH /api/admin/humanitarian/causes/:id/reject
// Rechaza una causa humanitaria + Notifica al usuario
// SEGURIDAD: Razón de rechazo es OBLIGATORIA (estándar bancario)
// AUDITORÍA: Registra el evento con motivo completo
// ============================================================================
const rejectCause = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { admin_notes } = req.body;

        // Validar ID numérico
        if (isNaN(parseInt(id))) {
            return res.status(400).json({ message: 'ID de causa inválido.' });
        }

        // OBLIGATORIO: El admin DEBE dar una razón (estándar bancario)
        if (!admin_notes || admin_notes.trim().length < 10) {
            return res.status(400).json({
                message: 'Debe proporcionar una razón detallada para el rechazo (mínimo 10 caracteres).'
            });
        }

        // Validar longitud máxima de notas
        if (admin_notes.length > 2000) {
            return res.status(400).json({
                message: 'Las notas del administrador no pueden exceder 2000 caracteres.'
            });
        }

        await client.query('BEGIN');

        // 1. Obtener causa con bloqueo (FOR UPDATE)
        const causeResult = await client.query(
            `SELECT hc.*, u.username 
             FROM humanitarian_causes hc 
             JOIN users u ON hc.user_id = u.id 
             WHERE hc.id = $1 FOR UPDATE`,
            [id]
        );

        if (causeResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Causa no encontrada.' });
        }

        const cause = causeResult.rows[0];

        // SEGURIDAD: Solo se pueden rechazar causas pendientes
        if (cause.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: `Esta causa ya fue procesada (estado actual: ${cause.status}).`
            });
        }

        // 2. Actualizar estado a 'rejected'
        await client.query(
            `UPDATE humanitarian_causes 
             SET status = 'rejected', 
                 admin_notes = $1, 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2`,
            [admin_notes.trim(), id]
        );

        // 3. Notificación in-app al usuario
        await client.query(
            `INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
            [
                cause.username,
                `❌ Tu postulación solidaria "${cause.title}" no ha sido aprobada. Motivo: ${admin_notes.trim().substring(0, 200)}. Puedes contactarnos para más información.`
            ]
        );

        // 4. Auditoría bancaria
        await logAuditEvent(client, req, {
            eventType: 'HUMANITARIAN_CAUSE_REJECTED',
            actorUsername: req.user.username || 'admin',
            targetUsername: cause.username,
            category: 'HUMANITARIAN_ADMIN',
            metadata: {
                cause_id: parseInt(id),
                cause_title: cause.title,
                rejection_reason: admin_notes.trim()
            }
        });

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Causa #${id} rechazada. El usuario ${cause.username} ha sido notificado.`
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[HUMANITARIAN_ADMIN] Error al rechazar causa:', error);
        res.status(500).json({ message: 'Error interno al rechazar la causa.' });
    } finally {
        client.release();
    }
};

// ============================================================================
// GET /api/admin/humanitarian/pending-count
// Retorna la cantidad de causas pendientes (para el badge del sidebar)
// ============================================================================
const getPendingCount = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT COUNT(*) AS count FROM humanitarian_causes WHERE status = 'pending'`
        );
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('[HUMANITARIAN_ADMIN] Error al contar pendientes:', error);
        res.status(500).json({ message: 'Error al obtener conteo de pendientes.' });
    }
};

module.exports = {
    listCauses,
    getCauseDetail,
    approveCause,
    rejectCause,
    getPendingCount
};
