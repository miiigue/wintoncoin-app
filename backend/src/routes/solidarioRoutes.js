const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { logAuditEvent } = require('../services/auditService');

// =================================================================================
// ==  ENDPOINT PARA VALIDAR CAUSAS ACTIVAS DE UN USUARIO (SOLIDARIO)           ==
// =================================================================================
router.get('/check-active/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const userResult = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
        if (userResult.rowCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const userId = userResult.rows[0].id;

        const activeCauses = await pool.query(`
            SELECT id FROM humanitarian_causes 
            WHERE user_id = $1 AND status IN ('pending', 'approved')
        `, [userId]);

        if (activeCauses.rowCount > 0) {
            return res.json({ hasActive: true, message: 'El usuario ya tiene una causa activa o pendiente.' });
        }

        return res.json({ hasActive: false, message: 'El usuario puede postular una causa.' });
    } catch (err) {
        console.error('Error checking active causes:', err.message);
        return res.status(500).json({ error: 'Database error' });
    }
});

// =================================================================================
// ==  ENDPOINT DE POSTULACIÓN SOLIDARIA (CASOS HUMANITARIOS)                    ==
// ==  Usa la tabla humanitarian_causes creada por migración 038                 ==
// ==  Seguridad: Validación de URL, límites de longitud, sanitización           ==
// =================================================================================
router.post('/postulacion', async (req, res) => {
    const { username, titulo, historia, meta, evidencia_link, redes_sociales } = req.body;

    // --- VALIDACIÓN 1: Campos obligatorios ---
    if (!username || !titulo || !historia || !meta || !evidencia_link || !redes_sociales) {
        return res.status(400).json({ message: "Todos los campos son obligatorios, incluyendo tus redes sociales." });
    }

    // --- VALIDACIÓN 2: Límites de longitud (Prevención de payload excesivo) ---
    if (username.length > 50) {
        return res.status(400).json({ message: "El nombre de usuario es demasiado largo." });
    }
    if (titulo.length > 255) {
        return res.status(400).json({ message: "El título no puede exceder 255 caracteres." });
    }
    if (historia.length > 5000) {
        return res.status(400).json({ message: "La historia no puede exceder 5000 caracteres." });
    }
    if (evidencia_link.length > 2048) {
        return res.status(400).json({ message: "El enlace de evidencia es demasiado largo." });
    }

    // --- VALIDACIÓN 3: Monto numérico positivo ---
    const goalAmount = parseFloat(meta);
    if (isNaN(goalAmount) || goalAmount <= 0) {
        return res.status(400).json({ message: "La meta debe ser un número positivo." });
    }

    // --- VALIDACIÓN 4: URL segura (solo HTTPS para proteger la integridad) ---
    let redesArray = [];
    try {
        const url = new URL(evidencia_link.trim());
        if (url.protocol !== 'https:') {
            return res.status(400).json({ message: "El enlace de evidencia debe usar HTTPS por seguridad." });
        }

        // Procesar redes sociales (separadas por espacio)
        const redesCrudas = redes_sociales.trim().split(/\s+/);
        for (const link of redesCrudas) {
            if (!link) continue;
            const urlRedes = new URL(link);
            if (urlRedes.protocol !== 'https:') {
                return res.status(400).json({ message: "Todos los enlaces de redes sociales deben usar HTTPS." });
            }
            redesArray.push(link);
        }
    } catch (e) {
        return res.status(400).json({ message: "Uno de los enlaces proporcionados no es válido. Asegúrate de incluir https://" });
    }

    try {
        // 1. Verificar que el usuario existe en la base de datos (Seguridad: doble verificación)
        const userResult = await pool.query(
            'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
            [username.trim()]
        );
        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: "El usuario no existe en el sistema." });
        }
        const userId = userResult.rows[0].id;

        // --- NUEVO: Validar que el usuario no tenga otra causa activa ('pending' o 'approved') ---
        const activeCausesCheck = await pool.query(`
            SELECT id FROM humanitarian_causes 
            WHERE user_id = $1 AND status IN ('pending', 'approved')
        `, [userId]);

        if (activeCausesCheck.rowCount > 0) {
            return res.status(400).json({ message: "Actualmente posees una causa en curso o en revisión. Debes culminarla antes de postular una nueva." });
        }

        // 2. Insertar en la tabla humanitarian_causes (Migración 038)
        const allUrls = [evidencia_link.trim(), ...redesArray];
        const evidenceUrls = JSON.stringify(allUrls);
        const insertSql = `
            INSERT INTO humanitarian_causes 
            (user_id, title, story, goal_amount, evidence_urls, status)
            VALUES ($1, $2, $3, $4, $5::jsonb, 'pending')
            RETURNING id, created_at
        `;
        const result = await pool.query(insertSql, [
            userId,
            titulo.trim(),
            historia.trim(),
            goalAmount,
            evidenceUrls
        ]);

        // 3. Registrar en Auditoría (Estándar Bancario: Trazabilidad total)
        await logAuditEvent(pool, req, {
            eventType: 'SOLIDARIO_POSTULACION',
            actorUsername: username.trim(),
            category: 'HUMANITARIAN',
            metadata: {
                cause_id: result.rows[0].id,
                title: titulo.trim(),
                goal_amount: goalAmount
            }
        });

        // 4. Notificación in-app
        await pool.query(
            `INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
            [
                username.trim(),
                `📋 Tu postulación solidaria "${titulo.trim()}" ha sido recibida (ID: #${result.rows[0].id}). Nuestro equipo la revisará y recibirás una notificación con la decisión.`
            ]
        );

        res.status(201).json({
            success: true,
            message: "Tu postulación ha sido registrada exitosamente. Recibirás una notificación cuando nuestro equipo revise tu caso.",
            id: result.rows[0].id
        });

    } catch (error) {
        console.error('Error al procesar la postulación solidaria:', error);
        res.status(500).json({ message: "Error interno del servidor al procesar la postulación." });
    }
});

module.exports = router;
