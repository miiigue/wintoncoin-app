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
    const { username, titulo, historia, meta, evidencia_link, redes_sociales, beneficiary_referral_code, foundation_name, beneficiary_socials, uploaded_images } = req.body;

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
    if (beneficiary_socials && beneficiary_socials.length > 1000) {
        return res.status(400).json({ message: "Los enlaces de redes sociales del beneficiario no pueden exceder 1000 caracteres." });
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

        // Procesar redes sociales del beneficiario si las hay (separadas por espacio)
        if (beneficiary_socials && beneficiary_socials.trim() !== '') {
            const redesCrudasBeneficiary = beneficiary_socials.trim().split(/\s+/);
            for (const link of redesCrudasBeneficiary) {
                if (!link) continue;
                const urlRedes = new URL(link);
                if (urlRedes.protocol !== 'https:') {
                    return res.status(400).json({ message: "Todos los enlaces de redes sociales del beneficiario deben usar HTTPS." });
                }
            }
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

        // 3. Insertar en la tabla humanitarian_causes (Migración 038 + 071 + 072 + 073)
        let allUrls = [evidencia_link.trim(), ...redesArray];
        if (uploaded_images && Array.isArray(uploaded_images)) {
            for (const url of uploaded_images) {
                if (typeof url !== 'string' || !url.startsWith('https://')) {
                    return res.status(400).json({ message: "URL de imagen subida inválida o no segura." });
                }
            }
            allUrls = [...allUrls, ...uploaded_images];
        }
        const evidenceUrls = JSON.stringify(allUrls);
        const insertSql = `
            INSERT INTO humanitarian_causes 
            (user_id, title, story, goal_amount, evidence_urls, status, beneficiary_referral_code, foundation_name, beneficiary_socials)
            VALUES ($1, $2, $3, $4, $5::jsonb, 'pending', $6, $7, $8)
            RETURNING id, created_at
        `;
        const result = await pool.query(insertSql, [
            userId,
            titulo.trim(),
            historia.trim(),
            goalAmount,
            evidenceUrls,
            cleanRefCode,
            foundation_name.trim(),
            beneficiary_socials ? beneficiary_socials.trim() : null
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
                foundation_name: foundation_name.trim(),
                beneficiary_socials: beneficiary_socials ? beneficiary_socials.trim() : null
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

// =================================================================================
// ==  ENDPOINT PÚBLICO PARA OBTENER ESTADÍSTICAS DE LA CAMPAÑA "AYUDEMOS A VENEZUELA" ==
// =================================================================================
router.get('/campaign-stats', async (req, res) => {
    try {
        const username = 'CadenaSOSVenezuela';
        // 1. Obtener ID del receptor
        const userRes = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
        if (userRes.rowCount === 0) {
            return res.json({
                total_raised: 0.0000,
                remaining_slots: 9989, // fallback por defecto de la tarjeta
                reward_amount: 200.0000
            });
        }
        const userId = userRes.rows[0].id;

        // 2. Calcular total de BLUE IOU acumulados en booster_blue_ledger
        const ledgerRes = await pool.query(
            'SELECT COALESCE(SUM(amount), 0) AS total FROM booster_blue_ledger WHERE user_id = $1',
            [userId]
        );
        const totalRaised = parseFloat(ledgerRes.rows[0].total) || 0;

        // 3. Contar usuarios registrados en el sistema para calcular tramo activo y cupos
        const countRes = await pool.query('SELECT COUNT(*) as count FROM users');
        const totalUsers = parseInt(countRes.rows[0].count, 10);

        // 4. Obtener tramo activo de la campaña de referidos
        const tierRes = await pool.query(`
            SELECT max_users_limit, reward_amount 
            FROM referral_reward_tiers 
            WHERE max_users_limit > $1 
            ORDER BY tier_number ASC 
            LIMIT 1
        `, [totalUsers]);

        let rewardAmount = 200.0000;
        let remainingSlots = 0;
        if (tierRes.rowCount > 0) {
            rewardAmount = parseFloat(tierRes.rows[0].reward_amount) || 200.0000;
            remainingSlots = Math.max(0, parseInt(tierRes.rows[0].max_users_limit, 10) - totalUsers);
        } else {
            // Si expira, usar fallback del app_settings o 0
            const settingsRes = await pool.query(
                "SELECT setting_value FROM app_settings WHERE setting_key = 'referral_reward_after_expiry'"
            );
            rewardAmount = settingsRes.rowCount > 0 ? parseFloat(settingsRes.rows[0].setting_value) : 0;
            remainingSlots = 0;
        }

        return res.json({
            total_raised: totalRaised,
            remaining_slots: remainingSlots,
            reward_amount: rewardAmount
        });
    } catch (err) {
        console.error('Error fetching campaign stats:', err.message);
        return res.status(500).json({ error: 'Database error fetching campaign stats' });
    }
});

module.exports = router;

