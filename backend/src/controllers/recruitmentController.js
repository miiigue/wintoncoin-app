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
const path = require('path');
const fs = require('fs');

/**
 * Registra una nueva postulación de empleo
 */
exports.submitApplication = async (req, res) => {
    const { full_name, email, linkedin_url, role, expected_salary } = req.body;
    const ip_address = req.ip || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'];
    const userId = req.user ? req.user.id : null; // Si está logueado, lo vinculamos

    // 1. Verificación de archivo (Safety check)
    if (!req.file) {
        return res.status(400).json({ 
            success: false, 
            message: 'El currículum (PDF) es obligatorio.' 
        });
    }

    const cv_filename = req.file.filename;

    try {
        console.log(`[RECRUITMENT] 💾 Guardando postulación para: ${email}`);
        // 2. Inserción Segura en DB (Preventing SQL Injection)
        const result = await pool.query(`
            INSERT INTO recruitment_proposals (
                user_id, full_name, email, linkedin_url, role, 
                expected_salary, cv_filename, multiplier_applied, 
                ip_address, user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `, [userId, full_name, email, linkedin_url, role, expected_salary || null, cv_filename, 15.00, ip_address, user_agent]);

        const proposalId = result.rows[0].id;
        console.log(`[RECRUITMENT] ✅ Postulación guardada con ID: ${proposalId}`);

        // 3. Registro en Audit Log (Auditabilidad Bancaria - Corregido)
        await logAuditEvent(pool, req, {
            eventType: 'RECRUITMENT_APPLICATION_SUBMITTED',
            actorId: userId || 0,
            actorUsername: email,
            metadata: { 
                proposalId,
                role,
                fullName: full_name
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Postulación recibida con éxito. Nuestro equipo revisará tu perfil.',
            applicationId: proposalId
        });

    } catch (error) {
        console.error('[RECRUITMENT_ERROR] ❌:', error);
        
        // Si hay error en DB, intentar borrar el archivo para no dejar basura
        const filePath = path.join(__dirname, '../../uploads/recruitment', cv_filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return res.status(500).json({
            success: false,
            message: 'Error interno al procesar la postulación.'
        });
    }
};
