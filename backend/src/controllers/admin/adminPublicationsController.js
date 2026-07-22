/**
 * Submódulo de Administración — Moderación y Publicaciones Institucionales de la Plataforma
 * ════════════════════════════════════════════════════════════════════════════════════════
 * Gestiona el listado y filtrado global de publicaciones (activas, eliminadas, expiradas),
 * soft-delete y restauración de publicaciones por auditoría, así como la creación y edición
 * de publicaciones y tareas oficiales publicadas a nombre de la Plataforma.
 *
 * Estándar de Ciberseguridad:
 *   - Zero Hardcoded Secrets & Zero-Trust Architecture
 *   - SOC 2 Type II / ISO 27001 Bank-Grade Audit Standards
 *   - Sanitización de formFields mediante helper para prevención de XSS y DoS
 *   - Validación de límites de imágenes configurados en app_settings
 * ════════════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

// 1. Importación de dependencias de infraestructura y servicios
const pool = require('../../config/db'); // Conexión a la base de datos PostgreSQL
const { logAuditEvent } = require('../../services/auditService'); // Log inmutable de auditoría
const { resolveRepeatCooldownHours } = require('../../services/publicationService'); // Lógica de cooldown para tareas repetibles
const notificationService = require('../../services/notificationService'); // Notificaciones push masivas

/**
 * Helper interno: Sanitización defensiva de campos de formulario dinámicos (formFields).
 */
function _sanitizeFormFields(formFields) {
    const ALLOWED_FIELD_TYPES = ['text', 'textarea'];
    const MAX_STEPS = 20;
    const MAX_FIELDS_PER_STEP = 10;
    const MAX_LABEL_LENGTH = 200;

    if (!formFields || typeof formFields !== 'object' || Object.keys(formFields).length === 0) {
        return null;
    }

    const sanitized = {};
    const stepKeys = Object.keys(formFields).slice(0, MAX_STEPS);

    for (const stepKey of stepKeys) {
        const stepNum = parseInt(stepKey, 10);
        if (!Number.isFinite(stepNum) || stepNum < 1 || stepNum > MAX_STEPS) continue;

        const fields = formFields[stepKey];
        if (!Array.isArray(fields)) continue;

        const sanitizedFields = [];
        for (const field of fields.slice(0, MAX_FIELDS_PER_STEP)) {
            if (typeof field === 'string') {
                const trimmed = field.trim().substring(0, MAX_LABEL_LENGTH);
                if (trimmed) sanitizedFields.push({ label: trimmed, type: 'text' });
            } else if (field && typeof field === 'object' && typeof field.label === 'string') {
                const label = field.label.trim().substring(0, MAX_LABEL_LENGTH);
                const type = ALLOWED_FIELD_TYPES.includes(field.type) ? field.type : 'text';
                if (label) sanitizedFields.push({ label, type });
            }
        }

        if (sanitizedFields.length > 0) {
            sanitized[String(stepNum)] = sanitizedFields;
        }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Obtiene todas las publicaciones de la plataforma con soporte de filtros por estado ('active', 'deleted', 'expired', 'completed', 'all').
 */
async function getAdminPublications(req, res) {
    const searchTerm = req.query.search || '';
    const filter = String(req.query.filter || 'active').toLowerCase();
    try {
        const allowedFilters = new Set(['active', 'deleted', 'expired', 'completed', 'all']);
        const safeFilter = allowedFilters.has(filter) ? filter : 'active';

        let filterCondition = '';
        if (safeFilter === 'active') {
            filterCondition = `AND p.deleted_at IS NULL AND (p.expires_at IS NULL OR p.expires_at >= NOW()) AND p.available_slots > 0 AND COALESCE(p.is_paused, FALSE) = FALSE`;
        } else if (safeFilter === 'deleted') {
            filterCondition = `AND p.deleted_at IS NOT NULL`;
        } else if (safeFilter === 'expired') {
            filterCondition = `AND p.deleted_at IS NULL AND p.expires_at IS NOT NULL AND p.expires_at < NOW()`;
        } else if (safeFilter === 'completed') {
            filterCondition = `
                AND p.deleted_at IS NULL
                AND (
                    (COALESCE(p.is_quick_sale, FALSE) = TRUE AND p.status <> 'open')
                    OR
                    (p.available_slots <= 0)
                )
            `;
        } else if (safeFilter === 'all') {
            filterCondition = '';
        }

        const query = `
            SELECT
                p.id, p.title, p.description, p.blue_cost, p.status, p.created_at, p.is_paused, p.is_sell_post, p.available_slots, p.category,
                p.expires_at, p.deleted_at, p.deleted_by_username, p.is_quick_sale,
                u.username AS author_username,
                (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id) AS participants_count,
                (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id AND pa.status = 'confirmed_paid') AS completed_count,
                (p.deleted_at IS NOT NULL) AS is_deleted,
                (p.expires_at IS NOT NULL AND p.expires_at < NOW()) AS is_expired,
                (
                    CASE
                        WHEN COALESCE(p.is_quick_sale, FALSE) = TRUE THEN (p.status <> 'open')
                        ELSE (
                            p.available_slots <= 0
                        )
                    END
                ) AS is_completed_publication
            FROM publications p
            JOIN users u ON p.author_id = u.id
            WHERE (p.title ILIKE $1 OR u.username ILIKE $1)
            ${filterCondition}
            ORDER BY p.created_at DESC
        `;
        const result = await pool.query(query, [`%${searchTerm}%`]);
        res.json(result.rows);
    } catch (error) {
        console.error('[AdminPublicationsController] Error fetching all publications for admin:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Restaura una publicación previamente eliminada mediante Soft-Delete.
 */
async function restorePublication(req, res) {
    const { id } = req.params;

    const safeId = parseInt(id, 10);
    if (!Number.isFinite(safeId) || safeId <= 0) {
        return res.status(400).json({ message: 'ID de publicación inválido.' });
    }

    try {
        const pubResult = await pool.query(
            `SELECT id, category, deleted_at FROM publications WHERE id = $1`,
            [safeId]
        );

        if (pubResult.rowCount === 0) {
            return res.status(404).json({ message: 'Publicación no encontrada.' });
        }

        if (!pubResult.rows[0].deleted_at) {
            return res.status(200).json({ success: true, message: 'La publicación no está eliminada.' });
        }

        await pool.query(
            `UPDATE publications
             SET deleted_at = NULL, deleted_by_username = NULL
             WHERE id = $1`,
            [safeId]
        );

        await logAuditEvent(pool, req, {
            eventType: 'admin.publication.restored',
            actorUsername: req.user?.username || 'admin',
            publicationId: safeId,
            category: pubResult.rows[0].category,
            metadata: { soft_delete: false, restored: true }
        });

        return res.json({ success: true, message: 'Publicación restaurada correctamente.' });
    } catch (error) {
        console.error(`[AdminPublicationsController] Error restoring publication ${id} for admin:`, error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Elimina una publicación aplicando Soft-Delete auditado.
 */
async function deletePublicationAdmin(req, res) {
    const { id } = req.params;

    const safeId = parseInt(id, 10);
    if (!Number.isFinite(safeId) || safeId <= 0) {
        return res.status(400).json({ message: 'ID de publicación inválido.' });
    }

    try {
        const pubResult = await pool.query(
            `SELECT id, category, deleted_at FROM publications WHERE id = $1`,
            [safeId]
        );

        if (pubResult.rowCount === 0) {
            return res.status(404).json({ message: 'Publicación no encontrada.' });
        }

        if (pubResult.rows[0].deleted_at) {
            return res.status(200).json({ success: true, message: 'La publicación ya estaba eliminada.' });
        }

        const updateResult = await pool.query(
            `UPDATE publications
             SET deleted_at = NOW(), deleted_by_username = $2
             WHERE id = $1`,
            [safeId, req.user?.username || 'admin']
        );

        if (updateResult.rowCount === 0) {
            return res.status(404).json({ message: 'Publicación no encontrada.' });
        }

        await logAuditEvent(pool, req, {
            eventType: 'admin.publication.deleted',
            actorUsername: req.user?.username || 'admin',
            publicationId: safeId,
            category: pubResult.rows[0].category,
            metadata: { soft_delete: true }
        });

        res.json({ success: true, message: 'Publicación eliminada (soft delete) correctamente.' });
    } catch (error) {
        console.error(`[AdminPublicationsController] Error deleting publication ${id} for admin:`, error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Crea una nueva publicación oficial en nombre de la Plataforma WintonCoin.
 */
async function createPlatformPublication(req, res) {
    const { title, description, cost: costString, availableSlots: slotsString, isSellPost, autoApprove, isBoosterTask, allowRepeatParticipation, maxRepeatPerUser, repeatCooldownHours, repeatCooldownDays, repeatCooldownMinutes, targetUsername, formFields, image_urls, requires_evidence } = req.body;

    if (!title || !description || !costString) {
        return res.status(400).json({ message: "Faltan datos: título, descripción y costo son requeridos." });
    }

    const cost = parseFloat(costString.toString().replace(',', '.'));
    if (isNaN(cost) || cost <= 0) {
        return res.status(400).json({ message: "El costo debe ser un número positivo." });
    }

    const slots = slotsString ? parseInt(slotsString, 10) : 1;
    if (isNaN(slots) || slots < 1) {
        return res.status(400).json({ message: "La cantidad de cupos debe ser mayor a 0." });
    }

    const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
    const allowRepeat = !!allowRepeatParticipation;
    let maxRepeat = null;
    let repeatCooldown = 24;
    
    if (allowRepeat) {
        maxRepeat = parseInt(maxRepeatPerUser, 10);
        if (!Number.isFinite(maxRepeat) || maxRepeat < 2) {
            return res.status(400).json({ message: "Indica el máximo de repeticiones por usuario (mínimo 2)." });
        }
        repeatCooldown = resolveRepeatCooldownHours({
            repeatCooldownDays,
            repeatCooldownHours,
            repeatCooldownMinutes
        });
    } else {
        maxRepeat = 1;
        repeatCooldown = 24;
    }

    let sanitizedTargetUsername = null;
    if (targetUsername && targetUsername.trim() !== '') {
        sanitizedTargetUsername = targetUsername.trim();
        const targetUserResult = await pool.query(`SELECT id FROM users WHERE username = $1`, [sanitizedTargetUsername]);
        if (targetUserResult.rowCount === 0) {
            return res.status(400).json({ message: `El usuario "${sanitizedTargetUsername}" no existe.` });
        }
    }

    try {
        const userResult = await pool.query(`SELECT id FROM users WHERE username = $1`, [platformUsername]);
        if (userResult.rowCount === 0) {
            return res.status(500).json({ message: "Error crítico: El usuario de la plataforma no se encuentra." });
        }
        const authorId = userResult.rows[0].id;

        const sanitizedFormFields = _sanitizeFormFields(formFields);

        const settingsResult = await pool.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'max_images_platform'`);
        const maxAllowedImages = parseInt(settingsResult.rows[0]?.setting_value || '3', 10);
        const urlsToSave = (Array.isArray(image_urls) ? image_urls : []).slice(0, maxAllowedImages);
        const demandsEvidence = !!requires_evidence;

        const sql = `
            INSERT INTO publications (title, description, blue_cost, is_sell_post, author_id, available_slots, auto_approve, is_booster_task, allow_repeat_participation, max_repeat_per_user, repeat_cooldown_hours, target_username, form_fields, show_preflight_modal, image_urls, requires_evidence) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
            RETURNING id
        `;
        const result = await pool.query(sql, [title, description, cost, !!isSellPost, authorId, slots, !!autoApprove, !!isBoosterTask, allowRepeat, maxRepeat, repeatCooldown, sanitizedTargetUsername, sanitizedFormFields, !!req.body.showPreflightModal, urlsToSave, demandsEvidence]);

        const newPubId = result.rows[0].id;

        await logAuditEvent(pool, req, {
            eventType: 'admin.platform_publication.created',
            actorUsername: req.user?.username || 'admin',
            targetUsername: sanitizedTargetUsername,
            publicationId: newPubId,
            category: 'platform',
            metadata: { title, cost, is_targeted: !!sanitizedTargetUsername }
        });

        const message = sanitizedTargetUsername
            ? `Publicación creada exitosamente. Visible solo para: ${sanitizedTargetUsername}`
            : "Publicación de la plataforma creada exitosamente.";

        res.status(201).json({ message, publicationId: newPubId });

        try {
            await notificationService.sendNotificationToAll({
                title: '🚀 Nueva Tarea Oficial',
                body: `¡Nueva oportunidad! 📝 ${title}. Participa ahora para ganar BLUE IOU.`,
                icon: '/assets/icons/icon-192x192.png',
                badge: '/assets/icons/icon-72x72.png',
                data: { url: '/dashboard.html' }
            }, 'SOCIAL');
        } catch (pushErr) {
            console.error("[AdminPublicationsController] Error al disparar broadcast oficial:", pushErr.message);
        }

    } catch (error) {
        console.error("[AdminPublicationsController] Error al crear publicación de la plataforma:", error);
        return res.status(500).json({ message: "Error interno del servidor." });
    }
}

/**
 * Modifica una publicación oficial existente de la Plataforma.
 */
async function updatePlatformPublication(req, res) {
    const { id } = req.params;
    const { title, description, cost: costString, availableSlots: slotsString, isSellPost, autoApprove, isBoosterTask, allowRepeatParticipation, maxRepeatPerUser, repeatCooldownHours, repeatCooldownDays, repeatCooldownMinutes, targetUsername, formFields, image_urls, requires_evidence } = req.body;

    if (!title || !description || !costString) {
        return res.status(400).json({ message: "Faltan datos: título, descripción y costo son requeridos." });
    }

    const cost = parseFloat(costString.toString().replace(',', '.'));
    if (isNaN(cost) || cost <= 0) {
        return res.status(400).json({ message: "El costo debe ser un número positivo." });
    }

    const slots = slotsString ? parseInt(slotsString, 10) : 1;
    if (isNaN(slots) || slots < 1) {
        return res.status(400).json({ message: "La cantidad de cupos debe ser mayor a 0." });
    }

    const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
    const allowRepeat = !!allowRepeatParticipation;
    let maxRepeat = null;
    let repeatCooldown = 24;
    
    if (allowRepeat) {
        maxRepeat = parseInt(maxRepeatPerUser, 10);
        if (!Number.isFinite(maxRepeat) || maxRepeat < 2) {
            return res.status(400).json({ message: "Indica el máximo de repeticiones por usuario (mínimo 2)." });
        }
        repeatCooldown = resolveRepeatCooldownHours({
            repeatCooldownDays,
            repeatCooldownHours,
            repeatCooldownMinutes
        });
    } else {
        maxRepeat = 1;
        repeatCooldown = 24;
    }

    try {
        const ownership = await pool.query(
            `SELECT p.id
             FROM publications p
             JOIN users u ON p.author_id = u.id
             WHERE p.id = $1 AND u.username = $2`,
            [id, platformUsername]
        );

        if (ownership.rowCount === 0) {
            return res.status(404).json({ message: "La publicación no pertenece a la plataforma." });
        }

        let sanitizedTargetUsername = null;
        if (targetUsername && targetUsername.trim() !== '') {
            sanitizedTargetUsername = targetUsername.trim();
            const targetUserResult = await pool.query(`SELECT id FROM users WHERE username = $1`, [sanitizedTargetUsername]);
            if (targetUserResult.rowCount === 0) {
                return res.status(400).json({ message: `El usuario "${sanitizedTargetUsername}" no existe.` });
            }
        }

        const sanitizedFormFields = _sanitizeFormFields(formFields);

        const settingsResult = await pool.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'max_images_platform'`);
        const maxAllowedImages = parseInt(settingsResult.rows[0]?.setting_value || '3', 10);
        const urlsToSave = (Array.isArray(image_urls) ? image_urls : []).slice(0, maxAllowedImages);
        const demandsEvidence = !!requires_evidence;

        const updateSql = `
            UPDATE publications
            SET title = $1,
                description = $2,
                blue_cost = $3,
                is_sell_post = $4,
                available_slots = $5,
                auto_approve = $6,
                is_booster_task = $7,
                allow_repeat_participation = $8,
                max_repeat_per_user = $9,
                repeat_cooldown_hours = $10,
                target_username = $11,
                form_fields = $12,
                show_preflight_modal = $13,
                image_urls = $14,
                requires_evidence = $15,
                updated_at = NOW()
            WHERE id = $16
        `;

        await pool.query(updateSql, [
            title,
            description,
            cost,
            !!isSellPost,
            slots,
            !!autoApprove,
            !!isBoosterTask,
            allowRepeat,
            maxRepeat,
            repeatCooldown,
            sanitizedTargetUsername,
            sanitizedFormFields,
            !!req.body.showPreflightModal,
            urlsToSave,
            demandsEvidence,
            id
        ]);

        await logAuditEvent(pool, req, {
            eventType: 'admin.platform_publication.updated',
            actorUsername: req.user?.username || 'admin',
            publicationId: parseInt(id, 10),
            category: 'platform',
            metadata: { title, cost }
        });

        res.json({ message: "Publicación de la plataforma actualizada exitosamente." });
    } catch (error) {
        console.error("[AdminPublicationsController] Error al editar publicación de la plataforma:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}

/**
 * Obtiene las publicaciones institucionales junto con el listado completo de sus participantes.
 */
async function getPlatformPublicationsWithParticipants(req, res) {
    const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
    try {
        const query = `
            SELECT
                p.id, p.title, p.description, p.created_at, p.status, p.is_paused,
                p.blue_cost, p.available_slots, p.is_sell_post, p.allow_repeat_participation, p.max_repeat_per_user, p.repeat_cooldown_hours,
                p.expires_at, p.deleted_at, p.deleted_by_username, p.is_quick_sale, p.auto_approve, p.is_booster_task, p.target_username, p.form_fields,
                p.image_urls, p.requires_evidence,
                u.username as author_username,
                (
                    SELECT json_agg(json_build_object(
                        'acceptor_username', pa.acceptor_username,
                        'status', pa.status,
                        'accepted_at', pa.created_at,
                        'average_rating', u_participant.average_rating,
                        'ratings_count', u_participant.ratings_count,
                        'form_responses', pa.form_responses,
                        'evidence_urls', pa.evidence_urls
                    ) ORDER BY 
                        CASE WHEN pa.status = 'pending' THEN 1 ELSE 2 END ASC,
                        CASE WHEN pa.status = 'pending' THEN pa.created_at END ASC,
                        pa.created_at DESC
                    )
                    FROM publication_acceptances pa
                    JOIN users u_participant ON pa.acceptor_username = u_participant.username
                    WHERE pa.publication_id = p.id
                ) as participants,
                (p.deleted_at IS NOT NULL) AS is_deleted,
                (p.expires_at IS NOT NULL AND p.expires_at < NOW()) AS is_expired,
                (
                    CASE
                        WHEN COALESCE(p.is_quick_sale, FALSE) = TRUE THEN (p.status <> 'open')
                        ELSE (
                            p.available_slots <= 0
                        )
                    END
                ) AS is_completed_publication
            FROM
                publications p
            JOIN
                users u ON p.author_id = u.id
            WHERE
                u.username = $1
            ORDER BY
                p.created_at DESC;
        `;
        const result = await pool.query(query, [platformUsername]);

        const publications = result.rows.map(p => ({
            ...p,
            participants: p.participants || [],
        }));

        res.json(publications);
    } catch (error) {
        console.error('[AdminPublicationsController] Error al obtener publicaciones con participantes:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTACIONES DEL SUBMÓDULO DE MODERACIÓN Y PUBLICACIONES INSTITUCIONALES
// ═══════════════════════════════════════════════════════════════════════════
module.exports = {
    getAdminPublications,
    restorePublication,
    deletePublicationAdmin,
    createPlatformPublication,
    updatePlatformPublication,
    getPlatformPublicationsWithParticipants
};
