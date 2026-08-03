/**
 * backend/src/controllers/minorController.js
 * 
 * PROPÓSITO: Controlador profesional para la gestión de cuentas de menores de edad y tutores legales.
 * Implementa el modelo de consentimiento explícito Maker-Checker (SOC 2, COPPA y RGPD) y
 * el marco de controles parentales FinTech (Congelamiento de cuenta, permisos JSONB y límites de crédito RED).
 * 
 * ESTÁNDAR DE INGENIERÍA: Zero-Trust Security, Transacciones Atómicas SQL, Audit Trail e Inmutabilidad.
 */

'use strict';

// 1. Importar la conexión a la base de datos PostgreSQL
const pool = require('../config/db');

// 2. Importar el servicio de auditoría inmutable
const { logAuditEvent } = require('../services/auditService');

/**
 * ----------------------------------------------------------------------------
 * 1. SOLICITAR TUTOR LEGAL (Iniciado por el Menor)
 * Endpoint: POST /api/minor/request-tutor
 * Requiere: verifyUserToken (Autenticado como el menor)
 * ----------------------------------------------------------------------------
 */
async function requestTutor(req, res) {
    // Extraer el usuario autenticado que realiza la solicitud
    const minorUserId = req.user?.userId;
    const { tutorUsernameOrEmail } = req.body;

    // Validación defensiva de entrada
    if (!minorUserId) {
        return res.status(401).json({ message: "No autenticado. Inicia sesión para continuar." });
    }

    if (!tutorUsernameOrEmail || typeof tutorUsernameOrEmail !== 'string') {
        return res.status(400).json({ message: "Se requiere el usuario o correo electrónico del tutor propuesto." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // A. Verificar que la cuenta emisora existe y es realmente de un menor
        const minorResult = await client.query(
            "SELECT id, username, is_minor, tutor_user_id, account_status FROM users WHERE id = $1 FOR UPDATE",
            [minorUserId]
        );

        if (minorResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Cuenta de usuario menor no encontrada." });
        }

        const minor = minorResult.rows[0];

        // Verificar que sea menor de edad
        if (!minor.is_minor) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Esta cuenta no está registrada como menor de edad." });
        }

        // Verificar si el menor ya cuenta con un tutor asignado previamente
        if (minor.tutor_user_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Tu cuenta ya tiene un tutor legal asignado y activo." });
        }

        // B. Buscar la cuenta del tutor propuesto por username o por email
        const targetSearch = tutorUsernameOrEmail.trim().toLowerCase();
        const tutorResult = await client.query(
            "SELECT id, username, email, is_minor, account_status FROM users WHERE LOWER(username) = $1 OR LOWER(email) = $1",
            [targetSearch]
        );

        if (tutorResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "El tutor propuesto no fue encontrado. Asegúrate de que tenga una cuenta registrada en WintonCoin." });
        }

        const tutor = tutorResult.rows[0];

        // Impedir que un usuario sea su propio tutor
        if (tutor.id === minor.id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "No puedes solicitar la tutela a tu propia cuenta." });
        }

        // Impedir que el tutor propuesto sea a su vez otro menor de edad
        if (tutor.is_minor) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "El tutor propuesto no puede ser un menor de edad." });
        }

        // Impedir que el tutor tenga su cuenta bloqueada o suspendida
        if (tutor.account_status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "La cuenta del tutor propuesto no se encuentra en estado activo." });
        }

        // C. Cancelar cualquier otra solicitud pendiente anterior de este menor para mantener estado limpio
        await client.query(
            "UPDATE tutor_requests SET status = 'cancelled', updated_at = NOW() WHERE minor_user_id = $1 AND status = 'pending'",
            [minor.id]
        );

        // D. Insertar la nueva solicitud de tutela en estado 'pending' (Maker-Checker)
        const ipAddress = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
        const userAgent = req.headers['user-agent'] || 'Unknown';

        const insertReq = await client.query(
            `INSERT INTO tutor_requests (minor_user_id, tutor_user_id, status, ip_address, user_agent)
             VALUES ($1, $2, 'pending', $3, $4)
             RETURNING id, created_at`,
            [minor.id, tutor.id, ipAddress, userAgent]
        );

        // Actualizar estado del menor a 'pending_tutor_approval'
        await client.query(
            "UPDATE users SET account_status = 'pending_tutor_approval' WHERE id = $1",
            [minor.id]
        );

        // E. Crear notificaciones In-App
        const notifMsgTutor = `El usuario menor de edad @${minor.username} te ha propuesto como su Tutor Legal Responsable. Ingresa a tu panel para revisar y responder esta solicitud.`;
        await client.query(
            "INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)",
            [tutor.username, notifMsgTutor]
        );

        // F. Registrar evento de auditoría inmutable (SOC 2)
        await logAuditEvent(client, req, {
            eventType: 'minor.tutor_requested',
            actorUsername: minor.username,
            targetUsername: tutor.username,
            category: 'legal',
            metadata: { request_id: insertReq.rows[0].id, tutor_user_id: tutor.id }
        });

        await client.query('COMMIT');

        return res.status(201).json({
            message: `Solicitud de tutela enviada a @${tutor.username}. Tu cuenta se activará cuando el tutor acepte la responsabilidad legal.`,
            request_id: insertReq.rows[0].id,
            tutor_username: tutor.username
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MINOR CONTROLLER] Error en requestTutor:', error);
        return res.status(500).json({ message: "Error interno del servidor al procesar la solicitud de tutela." });
    } finally {
        client.release();
    }
}

/**
 * ----------------------------------------------------------------------------
 * 2. RESPONDER SOLICITUD DE TUTELA (Aprobar o Rechazar por el Tutor - Checker)
 * Endpoint: POST /api/minor/tutor-requests/:requestId/respond
 * Requiere: verifyUserToken (Autenticado como el tutor)
 * Body: { action: 'approve' | 'reject', termsAccepted: true }
 * ----------------------------------------------------------------------------
 */
async function respondTutorRequest(req, res) {
    const tutorUserId = req.user?.userId;
    const { requestId } = req.params;
    const { action, termsAccepted } = req.body;

    if (!tutorUserId) {
        return res.status(401).json({ message: "No autenticado. Inicia sesión como tutor." });
    }

    if (!action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ message: "Acción inválida. Debe ser 'approve' o 'reject'." });
    }

    if (action === 'approve' && !termsAccepted) {
        return res.status(400).json({ message: "Debes aceptar expresamente las condiciones legales para asumir la tutela financiera." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // A. Buscar la solicitud de tutela verificando que pertenezca al tutor autenticado
        const reqResult = await client.query(
            `SELECT tr.*, u_minor.username as minor_username, u_minor.account_status as minor_status, u_tutor.username as tutor_username
             FROM tutor_requests tr
             JOIN users u_minor ON tr.minor_user_id = u_minor.id
             JOIN users u_tutor ON tr.tutor_user_id = u_tutor.id
             WHERE tr.id = $1 AND tr.tutor_user_id = $2 FOR UPDATE`,
            [requestId, tutorUserId]
        );

        if (reqResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Solicitud de tutela no encontrada o no pertenece a tu cuenta." });
        }

        const tutorReq = reqResult.rows[0];

        if (tutorReq.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Esta solicitud ya fue procesada anteriormente (estado: ${tutorReq.status}).` });
        }

        const ipAddress = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();

        if (action === 'approve') {
            // APROBACIÓN DE TUTELA Y ASUNCIÓN LEGAL DE RESPONSABILIDAD
            
            // 1. Marcar solicitud como 'approved' guardando versión de términos e IP
            await client.query(
                `UPDATE tutor_requests 
                 SET status = 'approved', approved_terms_version = 'v1.0-legal-tutor', ip_address = $1, updated_at = NOW() 
                 WHERE id = $2`,
                [ipAddress, requestId]
            );

            // 2. Asignar tutor_user_id, inicializar controles parentales por defecto y activar cuenta del menor
            const defaultPermissions = JSON.stringify({
                allow_contracting: true,
                allow_selling: true,
                allow_donations: true,
                allow_p2p: false,
                max_red_debt: 20.0000
            });

            await client.query(
                `UPDATE users 
                 SET tutor_user_id = $1, 
                     account_status = 'active', 
                     is_suspended_by_tutor = FALSE, 
                     tutor_permissions = $2::jsonb 
                 WHERE id = $3`,
                [tutorUserId, defaultPermissions, tutorReq.minor_user_id]
            );

            // 3. Notificar al menor
            const notifMinor = `¡Buenas noticias! @${tutorReq.tutor_username} ha aceptado tu solicitud de tutela. Tu cuenta ya se encuentra activa para operar bajo supervisión.`;
            await client.query(
                "INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)",
                [tutorReq.minor_username, notifMinor]
            );

            // 4. Registrar auditoría inmutable FinTech
            await logAuditEvent(client, req, {
                eventType: 'minor.tutor_approved',
                actorUsername: tutorReq.tutor_username,
                targetUsername: tutorReq.minor_username,
                category: 'legal',
                metadata: { request_id: requestId, ip: ipAddress, terms_version: 'v1.0-legal-tutor' }
            });

            await client.query('COMMIT');
            return res.status(200).json({
                message: `Has aceptado exitosamente la tutela de @${tutorReq.minor_username}. Su cuenta ha sido activada.`,
                status: 'approved'
            });

        } else {
            // RECHAZO DE TUTELA
            
            // 1. Marcar la solicitud como 'rejected'
            await client.query(
                "UPDATE tutor_requests SET status = 'rejected', updated_at = NOW() WHERE id = $1",
                [requestId]
            );

            // 2. Mantener la cuenta del menor en 'pending_tutor'
            await client.query(
                "UPDATE users SET account_status = 'pending_tutor' WHERE id = $1",
                [tutorReq.minor_user_id]
            );

            // 3. Notificar al menor
            const notifMinorReject = `@${tutorReq.tutor_username} ha declinado la solicitud de tutela. Debes proponer a otro usuario adulto como tutor responsable.`;
            await client.query(
                "INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)",
                [tutorReq.minor_username, notifMinorReject]
            );

            // 4. Registrar auditoría
            await logAuditEvent(client, req, {
                eventType: 'minor.tutor_rejected',
                actorUsername: tutorReq.tutor_username,
                targetUsername: tutorReq.minor_username,
                category: 'legal',
                metadata: { request_id: requestId }
            });

            await client.query('COMMIT');
            return res.status(200).json({
                message: `Has rechazado la solicitud de tutela de @${tutorReq.minor_username}.`,
                status: 'rejected'
            });
        }

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MINOR CONTROLLER] Error en respondTutorRequest:', error);
        return res.status(500).json({ message: "Error interno al responder la solicitud de tutela." });
    } finally {
        client.release();
    }
}

/**
 * ----------------------------------------------------------------------------
 * 3. OBTENER SOLICITUDES DE TUTELA PENDIENTES (Para el Tutor)
 * Endpoint: GET /api/minor/tutor-requests/pending
 * Requiere: verifyUserToken (Tutor)
 * ----------------------------------------------------------------------------
 */
async function getPendingTutorRequests(req, res) {
    const tutorUserId = req.user?.userId;

    if (!tutorUserId) {
        return res.status(401).json({ message: "No autenticado." });
    }

    try {
        const result = await pool.query(
            `SELECT tr.id as request_id, tr.created_at, u_minor.id as minor_id, u_minor.username as minor_username, u_minor.email as minor_email
             FROM tutor_requests tr
             JOIN users u_minor ON tr.minor_user_id = u_minor.id
             WHERE tr.tutor_user_id = $1 AND tr.status = 'pending'
             ORDER BY tr.created_at DESC`,
            [tutorUserId]
        );

        return res.json({ pending_requests: result.rows });
    } catch (error) {
        console.error('[MINOR CONTROLLER] Error en getPendingTutorRequests:', error);
        return res.status(500).json({ message: "Error interno del servidor." });
    }
}

/**
 * ----------------------------------------------------------------------------
 * 4. ACTUALIZAR CONTROLES PARENTALES (Pausar o Permisos JSONB)
 * Endpoint: PUT /api/minor/children/:childId/controls
 * Requiere: verifyUserToken (Tutor autenticado del menor)
 * Body: { is_suspended_by_tutor?: boolean, permissions?: { allow_contracting, allow_selling, allow_donations, allow_p2p, max_red_debt } }
 * ----------------------------------------------------------------------------
 */
async function updateChildControls(req, res) {
    const tutorUserId = req.user?.userId;
    const { childId } = req.params;
    const { is_suspended_by_tutor, permissions } = req.body;

    if (!tutorUserId) {
        return res.status(401).json({ message: "No autenticado." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // A. Verificar que la cuenta del menor exista y pertenezca exactamente a este tutor
        const childRes = await client.query(
            `SELECT id, username, is_minor, tutor_user_id, is_suspended_by_tutor, tutor_permissions 
             FROM users WHERE id = $1 AND tutor_user_id = $2 FOR UPDATE`,
            [childId, tutorUserId]
        );

        if (childRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Menor no encontrado o no está bajo tu tutela legal." });
        }

        const child = childRes.rows[0];

        // B. Actualizar congelamiento/pausa si se provee
        let newSuspendedState = child.is_suspended_by_tutor;
        if (typeof is_suspended_by_tutor === 'boolean') {
            newSuspendedState = is_suspended_by_tutor;
        }

        // C. Actualizar permisos granulares si se proveen
        let currentPermissions = typeof child.tutor_permissions === 'string' 
            ? JSON.parse(child.tutor_permissions) 
            : (child.tutor_permissions || {});

        if (permissions && typeof permissions === 'object') {
            if (typeof permissions.allow_contracting === 'boolean') currentPermissions.allow_contracting = permissions.allow_contracting;
            if (typeof permissions.allow_selling === 'boolean') currentPermissions.allow_selling = permissions.allow_selling;
            if (typeof permissions.allow_donations === 'boolean') currentPermissions.allow_donations = permissions.allow_donations;
            if (typeof permissions.allow_p2p === 'boolean') currentPermissions.allow_p2p = permissions.allow_p2p;
            
            if (permissions.max_red_debt !== undefined) {
                const maxDebt = parseFloat(permissions.max_red_debt);
                if (!isNaN(maxDebt) && maxDebt >= 0) {
                    currentPermissions.max_red_debt = maxDebt;
                }
            }
        }

        // D. Guardar cambios en base de datos
        const updateRes = await client.query(
            `UPDATE users 
             SET is_suspended_by_tutor = $1, tutor_permissions = $2::jsonb 
             WHERE id = $3 
             RETURNING id, username, is_suspended_by_tutor, tutor_permissions`,
            [newSuspendedState, JSON.stringify(currentPermissions), child.id]
        );

        // E. Registrar evento de auditoría
        await logAuditEvent(client, req, {
            eventType: 'minor.parental_controls_updated',
            actorUsername: req.user.username,
            targetUsername: child.username,
            category: 'legal',
            metadata: {
                is_suspended_by_tutor: newSuspendedState,
                tutor_permissions: currentPermissions
            }
        });

        await client.query('COMMIT');

        return res.json({
            message: `Controles parentales de @${child.username} actualizados correctamente.`,
            child: updateRes.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MINOR CONTROLLER] Error en updateChildControls:', error);
        return res.status(500).json({ message: "Error interno al actualizar controles parentales." });
    } finally {
        client.release();
    }
}

/**
 * ----------------------------------------------------------------------------
 * 5. CONSULTAR MENORES A CARGO (Para el Tutor)
 * Endpoint: GET /api/minor/children
 * Requiere: verifyUserToken (Tutor)
 * ----------------------------------------------------------------------------
 */
async function getChildControls(req, res) {
    const tutorUserId = req.user?.userId;

    if (!tutorUserId) {
        return res.status(401).json({ message: "No autenticado." });
    }

    try {
        const result = await pool.query(
            `SELECT id, username, email, account_status, is_suspended_by_tutor, tutor_permissions, red_balance, created_at
             FROM users
             WHERE tutor_user_id = $1
             ORDER BY username ASC`,
            [tutorUserId]
        );

        return res.json({ children: result.rows });
    } catch (error) {
        console.error('[MINOR CONTROLLER] Error en getChildControls:', error);
        return res.status(500).json({ message: "Error interno del servidor." });
    }
}

// ----------------------------------------------------------------------------
// EXPORTACIONES DEL MÓDULO DE MENORES Y TUTORES
// ----------------------------------------------------------------------------
module.exports = {
    requestTutor,
    respondTutorRequest,
    getPendingTutorRequests,
    updateChildControls,
    getChildControls
};
