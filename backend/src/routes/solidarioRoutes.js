const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { logAuditEvent } = require('../services/auditService');
const { authenticateToken } = require('../middleware/authMiddleware');

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
// ==  ENDPOINT PARA VALIDAR CÓDIGO DE REFERIDO (SOLIDARIO)                       ==
// =================================================================================
router.get('/check-referral/:code', async (req, res) => {
    const { code } = req.params;
    try {
        const result = await pool.query('SELECT username FROM users WHERE UPPER(referral_code) = UPPER($1)', [code.trim()]);
        if (result.rowCount === 0) {
            return res.json({ exists: false });
        }
        return res.json({ exists: true, username: result.rows[0].username });
    } catch (err) {
        console.error('Error checking referral code:', err.message);
        return res.status(500).json({ error: 'Database error' });
    }
});

// =================================================================================
// ==  ENDPOINT DE POSTULACIÓN SOLIDARIA (CASOS HUMANITARIOS)                    ==
// ==  Usa la tabla humanitarian_causes creada por migración 038                 ==
// ==  Seguridad: Validación de URL, límites de longitud, sanitización           ==
// =================================================================================
router.post('/postulacion', authenticateToken, async (req, res) => {
    const { username, titulo, historia, meta, evidencia_link, redes_sociales, beneficiary_referral_code, foundation_name } = req.body;

    // --- VALIDACIÓN DE COHERENCIA DE SEGURIDAD (ANTI-SPOOFING) ---
    // Impide que un usuario autenticado postule causas en nombre de otro usuario
    if (!req.user || !req.user.username || req.user.username.toLowerCase() !== username.trim().toLowerCase()) {
        return res.status(403).json({ message: "Acceso denegado: No puedes postular una causa en nombre de otro usuario." });
    }

    // --- VALIDACIÓN 1: Campos obligatorios ---
    if (!username || !titulo || !historia || !meta || !evidencia_link || !redes_sociales || !beneficiary_referral_code || !foundation_name) {
        return res.status(400).json({ message: "Todos los campos son obligatorios, incluyendo el nombre de la fundación y el código de referido del beneficiario." });
    }

    // --- VALIDACIÓN 2: Límites de longitud (Prevención de payload excesivo) ---
    if (username.length > 50) {
        return res.status(400).json({ message: "El nombre de usuario es demasiado largo." });
    }
    if (beneficiary_referral_code.length > 50) {
        return res.status(400).json({ message: "El código de referido es demasiado largo." });
    }
    if (foundation_name.length > 255) {
        return res.status(400).json({ message: "El nombre de la fundación no puede exceder 255 caracteres." });
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

    // --- VALIDACIÓN 3: Monto numérico positivo, finito y controlado ---
    const goalAmount = parseFloat(meta);
    if (isNaN(goalAmount) || goalAmount <= 0 || !isFinite(goalAmount)) {
        return res.status(400).json({ message: "La meta debe ser un número positivo y finito válido." });
    }
    if (goalAmount > 100000000) {
        return res.status(400).json({ message: "La meta no puede exceder los 100,000,000 de BLUE IOU por seguridad y consistencia." });
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
        // 1. Verificar que el usuario creador existe en la base de datos
        const userResult = await pool.query(
            'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
            [username.trim()]
        );
        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: "El usuario creador no existe en el sistema." });
        }
        const userId = userResult.rows[0].id;

        // 2. Verificar que el beneficiario existe y obtener su código limpio
        const cleanRefCode = beneficiary_referral_code.trim().toUpperCase();
        const beneficiaryRes = await pool.query(
            'SELECT id FROM users WHERE referral_code = $1',
            [cleanRefCode]
        );
        if (beneficiaryRes.rowCount === 0) {
            return res.status(400).json({ message: "El código de referido del beneficiario no es válido o no está registrado." });
        }

        // --- VALIDAR: Que el usuario no tenga otra causa activa ('pending' o 'approved') ---
        const activeCausesCheck = await pool.query(`
            SELECT id FROM humanitarian_causes 
            WHERE user_id = $1 AND status IN ('pending', 'approved')
        `, [userId]);

        if (activeCausesCheck.rowCount > 0) {
            return res.status(400).json({ message: "Actualmente posees una causa en curso o en revisión. Debes culminarla antes de postular una nueva." });
        }

        // 3. Insertar en la tabla humanitarian_causes (Migración 038 + 071 + 072)
        const allUrls = [evidencia_link.trim(), ...redesArray];
        const evidenceUrls = JSON.stringify(allUrls);
        const insertSql = `
            INSERT INTO humanitarian_causes 
            (user_id, title, story, goal_amount, evidence_urls, status, beneficiary_referral_code, foundation_name)
            VALUES ($1, $2, $3, $4, $5::jsonb, 'pending', $6, $7)
            RETURNING id, created_at
        `;
        const result = await pool.query(insertSql, [
            userId,
            titulo.trim(),
            historia.trim(),
            goalAmount,
            evidenceUrls,
            cleanRefCode,
            foundation_name.trim()
        ]);

        // 4. Registrar en Auditoría (Estándar Bancario: Trazabilidad total)
        await logAuditEvent(pool, req, {
            eventType: 'SOLIDARIO_POSTULACION',
            actorUsername: username.trim(),
            category: 'HUMANITARIAN',
            metadata: {
                cause_id: result.rows[0].id,
                title: titulo.trim(),
                goal_amount: goalAmount,
                beneficiary_referral_code: cleanRefCode,
                foundation_name: foundation_name.trim()
            }
        });

        // 5. Notificación in-app
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
