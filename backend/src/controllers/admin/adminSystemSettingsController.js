/**
 * Submódulo de Administración — Parámetros de Sistema, Tramos Económicos y Governance Guard
 * ════════════════════════════════════════════════════════════════════════════════════════
 * Gestiona la configuración global de la aplicación (app_settings), tramos de referidos,
 * niveles de impulsor (booster_level_settings) y etapas de multiplicadores (booster_stages).
 *
 * Estándar de Ciberseguridad:
 *   - Zero Hardcoded Secrets & Zero-Trust Architecture
 *   - SOC 2 Type II / ISO 27001 Bank-Grade Audit Standards
 *   - Protección estricta por Governance Guard (Maker-Checker Winton-Consensus)
 *   - Validación de techo financiero de 200 Millones BLUE en tramos de referidos
 * ════════════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

// 1. Importación de dependencias de infraestructura y servicios
const pool = require('../../config/db'); // Conexión a la base de datos PostgreSQL
const { logAuditEvent } = require('../../services/auditService'); // Log inmutable de auditoría
const boosterService = require('../../services/boosterService'); // Servicio del motor booster

/**
 * Helper interno: Verifica si el sistema de gobernanza está activo.
 */
async function _checkGovernanceActive() {
    try {
        const govCheck = await pool.query(
            `SELECT COUNT(*) as count FROM governance_guardians WHERE status = 'active'`
        );
        return parseInt(govCheck.rows[0].count, 10) > 0;
    } catch (err) {
        if (err.code === '42P01') return false;
        throw err;
    }
}

/**
 * Obtiene todas las configuraciones globales del sistema.
 */
async function getSettings(req, res) {
    try {
        const result = await pool.query(`SELECT * FROM app_settings ORDER BY setting_key`);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("[AdminSystemSettingsController] Error al obtener configuraciones:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}

/**
 * Actualiza una configuración global del sistema. Protegido por Governance Guard.
 */
async function updateSetting(req, res) {
    const { key, value } = req.body;
    
    if (!key || typeof value !== 'string') {
        return res.status(400).json({ message: "Se requiere 'key' y 'value' en formato de texto válido." });
    }

    if (key.startsWith('daily_modal_')) {
        if (value.length > 5000) {
            return res.status(400).json({
                message: `El contenido del mensaje excede el límite máximo de seguridad de 5000 caracteres (longitud actual: ${value.length}).`
            });
        }
    } else if (key === 'global_app_interstitial_enabled') {
        if (value !== 'true' && value !== 'false') {
            return res.status(400).json({
                message: "El valor de configuración para el estado del modal global debe ser exactamente 'true' o 'false'."
            });
        }
    } else {
        if (value.length > 1000) {
            return res.status(400).json({
                message: `El valor configurado excede el límite preventivo general de 1000 caracteres (longitud actual: ${value.length}).`
            });
        }
    }

    try {
        const isNonCriticalSetting = key.startsWith('daily_modal_') || 
                                     key === 'global_app_interstitial_enabled' ||
                                     key === 'referral_custom_share_code' ||
                                     key === 'referral_custom_share_code_enabled' ||
                                     key === 'referral_share_message_template' ||
                                     key === 'referral_card_title' ||
                                     key === 'referral_card_button_text' ||
                                     key === 'referral_campaign_image_url' ||
                                     key === 'referral_card_subtitle' ||
                                     key === 'registration_country_restriction_enabled' ||
                                     key === 'registration_allowed_country_prefixes' ||
                                     key === 'registration_country_restriction_notice_text';

        const isGovActive = await _checkGovernanceActive();

        if (isGovActive && !isNonCriticalSetting) {
            return res.status(403).json({
                message: `El sistema de gobernanza está activo. Los cambios deben ser aprobados por guardianes.`,
                governance_required: true,
                setting_key: key
            });
        }

        if (key === 'pre_launch_mode_enabled' && value === 'false') {
            await pool.query(
                `INSERT INTO app_settings (setting_key, setting_value) VALUES ('pre_launch_deactivated_at', NOW()::text)
                 ON CONFLICT (setting_key) DO UPDATE SET setting_value = NOW()::text`
            );
        }

        // AUDITORÍA FINTECH & CIBERSEGURIDAD: Operación UPSERT (INSERT ... ON CONFLICT DO UPDATE)
        // Garantiza resiliencia total: si la clave existe se actualiza, y si aún no existía se crea automáticamente sin arrojar 404.
        const result = await pool.query(
            `INSERT INTO app_settings (setting_key, setting_value, updated_at)
             VALUES ($2, $1, NOW())
             ON CONFLICT (setting_key) 
             DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
             RETURNING *`,
            [value, key]
        );

        await logAuditEvent(pool, req, {
            eventType: 'admin.settings.updated',
            actorUsername: req.user?.username || 'admin',
            category: 'admin',
            metadata: { setting_key: key, new_value: value }
        });

        res.status(200).json({ message: "Configuración actualizada.", setting: result.rows[0] });
    } catch (error) {
        console.error("[AdminSystemSettingsController] Error al actualizar configuración:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}

/**
 * Obtiene la configuración de los niveles de impulsor (booster_level_settings).
 */
async function getBoosterSettings(req, res) {
    try {
        const result = await pool.query('SELECT * FROM booster_level_settings ORDER BY level ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('[AdminSystemSettingsController] Error al obtener configuraciones booster:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Actualiza la configuración de un nivel booster. Protegido por Governance Guard.
 */
async function updateBoosterSettings(req, res) {
    const { level, name, min_blue_required, description } = req.body;

    if (level === undefined || !name || min_blue_required === undefined) {
        return res.status(400).json({ message: 'Faltan datos requeridos: nivel, nombre y BLUE mínimo.' });
    }
    try {
        const isGovActive = await _checkGovernanceActive();
        if (isGovActive) {
            return res.status(403).json({
                message: 'El sistema de gobernanza está activo. Los cambios en niveles de impulsor deben realizarse a través del panel de gobernanza (Winton-Consensus).',
                governance_required: true,
            });
        }

        const result = await pool.query(
            `UPDATE booster_level_settings 
             SET name = $1, min_blue_required = $2, description = $3 
             WHERE level = $4 RETURNING *`,
            [name, min_blue_required, description, level]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: `El nivel de impulsor ${level} no fue encontrado.` });
        }
        res.json({ message: 'Nivel de impulsor actualizado.', setting: result.rows[0] });
    } catch (error) {
        console.error('[AdminSystemSettingsController] Error al actualizar la configuración del nivel booster:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Obtiene las etapas de configuración de multiplicadores de impulsor.
 */
async function getBoosterStages(req, res) {
    try {
        const stages = await boosterService.getAllStages();
        res.json(stages);
    } catch (error) {
        console.error("[AdminSystemSettingsController] Error al obtener etapas de booster:", error);
        res.status(500).json({ message: "Error al obtener etapas de booster." });
    }
}

/**
 * Guarda (crea o actualiza) una etapa de multiplicador booster. Protegido por Governance Guard.
 */
async function saveBoosterStage(req, res) {
    try {
        const isGovActive = await _checkGovernanceActive();
        if (isGovActive) {
            return res.status(403).json({
                message: 'El sistema de gobernanza está activo. Los cambios en multiplicadores de etapas deben realizarse a través del panel de gobernanza (Winton-Consensus).',
                governance_required: true,
            });
        }

        const stage = await boosterService.saveStage(req.body);

        await logAuditEvent(pool, req, {
            eventType: 'admin.booster_stage.saved',
            actorUsername: req.user?.username || 'admin',
            category: 'admin',
            metadata: {
                stage_id:   stage.id,
                stage_name: stage.name,
                multiplier: parseFloat(stage.multiplier),
                start_date: stage.start_date,
                end_date:   stage.end_date,
                is_active:  stage.is_active
            }
        });

        res.json({ message: "Etapa de booster guardada.", stage });
    } catch (error) {
        console.error("[AdminSystemSettingsController] Error al guardar etapa de booster:", error);
        const validationPatterns = ['Solapamiento', 'Faltan datos', 'multiplicador', 'fecha', 'exceder', 'inválido', 'positivo'];
        const isValidationError = validationPatterns.some(p => error.message.includes(p));
        if (isValidationError) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Error al guardar etapa de booster." });
    }
}

/**
 * Obtiene la lista de tramos de recompensa por referidos.
 */
async function getReferralTiers(req, res) {
    try {
        const query = `
            SELECT id, tier_number, label, max_users_limit, reward_amount
            FROM referral_reward_tiers
            ORDER BY tier_number ASC
        `;
        const result = await pool.query(query);
        
        const countRes = await pool.query('SELECT COUNT(*) as count FROM users');
        const totalUsers = parseInt(countRes.rows[0].count, 10);
        
        res.json({
            tiers: result.rows,
            totalUsers
        });
    } catch (error) {
        console.error('[AdminSystemSettingsController] Error al obtener tramos de referidos:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Actualiza los tramos de recompensa por referidos con validación del techo de 200M BLUE.
 */
async function updateReferralTiers(req, res) {
    const { tiers } = req.body;
    if (!Array.isArray(tiers) || tiers.length === 0) {
        return res.status(400).json({ message: 'Se requiere un listado de tramos válido.' });
    }

    let projectedTotal = 0;
    for (const t of tiers) {
        const reward = parseFloat(t.reward_amount);
        const limit = parseInt(t.max_users_limit, 10);
        const tierNum = parseInt(t.tier_number, 10);

        if (isNaN(reward) || reward < 0 || isNaN(limit) || limit <= 0 || isNaN(tierNum)) {
            return res.status(400).json({ message: 'Valores de tramos inválidos. Todos los montos y límites deben ser numéricos positivos.' });
        }
        
        let prevLimit = 0;
        if (t.tier_number > 1) {
            const prevTier = tiers.find(pt => parseInt(pt.tier_number, 10) === t.tier_number - 1);
            if (prevTier) {
                prevLimit = parseInt(prevTier.max_users_limit, 10);
            }
        }
        const usersInTier = Math.max(0, limit - prevLimit);
        projectedTotal += (usersInTier * reward * 2);
    }

    if (projectedTotal > 200000000) {
        return res.status(400).json({
            message: `Error de Viabilidad Financiera: La recompensa total proyectada (${projectedTotal.toLocaleString('es-ES')} BLUE) excede el pool promocional destinado de 200.000.000 BLUE.`
        });
    }

    const isGovActive = await _checkGovernanceActive();
    if (isGovActive) {
        return res.status(403).json({
            message: 'El sistema de Gobernanza está activo. Las modificaciones en los tramos globales de referidos deben ser propuestas a través del Panel de Gobernanza.',
            governance_required: true
        });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const t of tiers) {
            await client.query(`
                INSERT INTO referral_reward_tiers (tier_number, label, max_users_limit, reward_amount)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (tier_number)
                DO UPDATE SET
                    label = EXCLUDED.label,
                    max_users_limit = EXCLUDED.max_users_limit,
                    reward_amount = EXCLUDED.reward_amount,
                    updated_at = NOW();
            `, [parseInt(t.tier_number, 10), t.label, parseInt(t.max_users_limit, 10), parseFloat(t.reward_amount)]);
        }

        await logAuditEvent(client, req, {
            eventType: 'admin.referral_tiers.updated',
            actorUsername: req.user.username,
            category: 'admin',
            metadata: { tiers_configured: tiers, projected_total_emitted: projectedTotal }
        });

        await client.query('COMMIT');
        res.json({ message: 'Tramos de recompensas de referidos actualizados con éxito.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[AdminSystemSettingsController] Error al actualizar tramos de referidos:', error);
        res.status(500).json({ message: 'Error interno del servidor al actualizar los tramos.' });
    } finally {
        client.release();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTACIONES DEL SUBMÓDULO DE PARÁMETROS Y GOBERNANZA
// ═══════════════════════════════════════════════════════════════════════════
module.exports = {
    getSettings,
    updateSetting,
    getBoosterSettings,
    updateBoosterSettings,
    getReferralTiers,
    updateReferralTiers,
    getBoosterStages,
    saveBoosterStage
};
