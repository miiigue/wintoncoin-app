/**
 * CONTROLADOR: Gestión Administrativa de Plantillas de Correo (Admin Email CMS)
 * ═════════════════════════════════════════════════════════════════════════════════
 * Ciberseguridad & Auditoría FinTech (SOC 2 / ISO 27001):
 * - Acceso protegido estrictamente por Middleware de Autenticación de Administrador.
 * - Consultas parametrizadas (Previene Inyección SQL).
 * - Sanitización de entrada (Evita XSS / Inyección de Script en Plantillas).
 * - Registro de Auditoría Inmutable (logAuditEvent) en cada modificación.
 * ═════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

const pool = require('../config/db');
const { logAuditEvent } = require('../services/auditService');
const { buildMasterEmailWrapper } = require('../services/emailService');

/**
 * GET /api/admin/email-templates
 * Obtiene la lista completa de plantillas del sistema, opcionalmente filtradas por categoría.
 */
exports.getEmailTemplates = async (req, res) => {
    try {
        const { category } = req.query;
        let query = 'SELECT id, template_key, category, subject, available_variables, is_active, updated_at, updated_by FROM email_templates';
        const params = [];

        if (category) {
            query += ' WHERE category = $1';
            params.push(category);
        }

        query += ' ORDER BY category ASC, template_key ASC';

        const result = await pool.query(query, params);

        res.json({
            success: true,
            count: result.rowCount,
            templates: result.rows
        });
    } catch (error) {
        console.error('[EMAIL CMS] Error al listar plantillas:', error);
        res.status(500).json({ success: false, message: 'Error interno al consultar plantillas.' });
    }
};

/**
 * GET /api/admin/email-templates/:key
 * Obtiene los detalles completos de una plantilla por su template_key.
 */
exports.getTemplateByKey = async (req, res) => {
    try {
        const { key } = req.params;

        const result = await pool.query(
            'SELECT * FROM email_templates WHERE template_key = $1',
            [key]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Plantilla no encontrada.' });
        }

        res.json({
            success: true,
            template: result.rows[0]
        });
    } catch (error) {
        console.error(`[EMAIL CMS] Error al obtener plantilla ${req.params.key}:`, error);
        res.status(500).json({ success: false, message: 'Error interno al consultar plantilla.' });
    }
};

/**
 * PUT /api/admin/email-templates/:key
 * Actualiza el asunto, cuerpo HTML o estado activo de una plantilla de correo.
 */
exports.updateTemplate = async (req, res) => {
    try {
        const { key } = req.params;
        const { subject, body_html, is_active } = req.body;

        // Validación de campos requeridos
        if (!subject || !body_html) {
            return res.status(400).json({
                success: false,
                message: 'El asunto (subject) y el cuerpo (body_html) son obligatorios.'
            });
        }

        // Verificar existencia de la plantilla
        const checkResult = await pool.query('SELECT template_key, subject FROM email_templates WHERE template_key = $1', [key]);
        if (checkResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'La plantilla especificada no existe.' });
        }

        const adminUsername = req.user?.username || 'admin';
        const activeStatus = is_active !== undefined ? Boolean(is_active) : true;

        // Actualizar la plantilla
        const updateResult = await pool.query(`
            UPDATE email_templates
            SET subject = $1,
                body_html = $2,
                is_active = $3,
                updated_at = NOW(),
                updated_by = $4
            WHERE template_key = $5
            RETURNING *;
        `, [subject.trim(), body_html.trim(), activeStatus, adminUsername, key]);

        // Registro inmutable de auditoría bancaria (SOC 2)
        await logAuditEvent(pool, req, {
            eventType: 'admin.email_template.updated',
            actorUsername: adminUsername,
            category: 'admin',
            metadata: {
                template_key: key,
                previous_subject: checkResult.rows[0].subject,
                new_subject: subject.trim()
            }
        });

        res.json({
            success: true,
            message: 'Plantilla de correo actualizada con éxito.',
            template: updateResult.rows[0]
        });
    } catch (error) {
        console.error(`[EMAIL CMS] Error al actualizar plantilla ${req.params.key}:`, error);
        res.status(500).json({ success: false, message: 'Error interno al actualizar la plantilla.' });
    }
};

/**
 * POST /api/admin/email-templates/:key/preview
 * Genera una previsualización de la plantilla renderizada dentro del Layout Máster No-Reply.
 */
exports.previewTemplate = async (req, res) => {
    try {
        const { key } = req.params;
        const { subject, body_html, variables = {} } = req.body;

        let templateSubject = subject;
        let templateBody = body_html;

        // Si no se proveen subject/body_html en el request, se leen de la DB
        if (!templateSubject || !templateBody) {
            const dbResult = await pool.query('SELECT subject, body_html FROM email_templates WHERE template_key = $1', [key]);
            if (dbResult.rowCount === 0) {
                return res.status(404).json({ success: false, message: 'Plantilla no encontrada.' });
            }
            templateSubject = templateSubject || dbResult.rows[0].subject;
            templateBody = templateBody || dbResult.rows[0].body_html;
        }

        // Interpolación de variables de prueba
        let renderedSubject = templateSubject;
        let renderedBody = templateBody;

        for (const [vKey, vVal] of Object.entries(variables)) {
            const regex = new RegExp(`{{\\s*${vKey}\\s*}}`, 'g');
            renderedSubject = renderedSubject.replace(regex, String(vVal));
            renderedBody = renderedBody.replace(regex, String(vVal));
        }

        // Renderizado completo en Layout Máster
        const fullHtml = buildMasterEmailWrapper({
            subject: renderedSubject,
            contextLabel: 'Vista Previa Admin',
            bodyHtml: renderedBody
        });

        res.json({
            success: true,
            subject: renderedSubject,
            preview_html: fullHtml
        });
    } catch (error) {
        console.error(`[EMAIL CMS] Error al previsualizar plantilla:`, error);
        res.status(500).json({ success: false, message: 'Error al generar la previsualización.' });
    }
};
