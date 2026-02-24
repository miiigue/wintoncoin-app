// ============================================================================
// WintonCoin - Momentum Service
// ============================================================================
// Lógica de negocio del sistema Winton Momentum.
// Este módulo contiene las funciones reutilizables que procesan las reglas
// de negocio del programa de influencers. Es independiente de Express.
//
// Principios:
//   - Cada función recibe un client de PostgreSQL (para transacciones)
//   - Nunca importa ni usa req/res (eso es del controller)
//   - Los BLUE IOU se acreditan en booster_blue_ledger (sistema existente)
//   - El multiplicador se aplica siempre: pago_final = base × multiplicador
// ============================================================================

'use strict';

// Jerarquía de tiers para comparaciones de nivel
const TIER_HIERARCHY = {
    PENDIENTE: 0,
    BRONCE: 1,
    PLATA: 2,
    ORO: 3
};

// Mapeo de tier → columna de pago base en momentum_campaigns
const TIER_PAY_COLUMN = {
    BRONCE: 'base_pay_bronce',
    PLATA: 'base_pay_plata',
    ORO: 'base_pay_oro'
};

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================

/**
 * Obtiene la configuración global del sistema Momentum.
 * @param {object} client - Cliente PostgreSQL
 * @returns {object} Configuración global
 */
async function getGlobalConfig(client) {
    const result = await client.query(
        'SELECT * FROM momentum_global_config WHERE id = 1'
    );
    // Si no existe la fila, retornamos valores por defecto
    if (result.rowCount === 0) {
        return {
            multiplier: 15,
            phase_name: 'Etapa 2',
            phase_end_date: null,
            total_slots: 100,
            occupied_slots: 0
        };
    }
    return result.rows[0];
}

/**
 * Actualiza la configuración global del sistema Momentum.
 * Solo el Admin puede invocar esta función.
 * @param {object} client - Cliente PostgreSQL
 * @param {object} updates - Campos a actualizar
 * @returns {object} Configuración actualizada
 */
async function updateGlobalConfig(client, updates) {
    const { multiplier, phase_name, phase_end_date, total_slots, occupied_slots } = updates;

    const result = await client.query(`
        UPDATE momentum_global_config
        SET
            multiplier = COALESCE($1, multiplier),
            phase_name = COALESCE($2, phase_name),
            phase_end_date = COALESCE($3, phase_end_date),
            total_slots = COALESCE($4, total_slots),
            occupied_slots = COALESCE($5, occupied_slots),
            updated_at = NOW()
        WHERE id = 1
        RETURNING *
    `, [multiplier, phase_name, phase_end_date, total_slots, occupied_slots]);

    return result.rows[0];
}

// ============================================================================
// PERFILES DE INFLUENCER
// ============================================================================

/**
 * Crea un nuevo perfil de influencer (postulación).
 * El perfil se crea con tier 'PENDIENTE' hasta que el Admin lo active.
 * @param {object} client - Cliente PostgreSQL
 * @param {number} userId - ID del usuario que se postula
 * @param {object} profileData - Datos del perfil
 * @returns {object} Perfil creado
 */
async function createProfile(client, userId, profileData) {
    const { nickname, social_platform, social_link, social_screenshot_url, followers_count, niche } = profileData;

    // Verificar que el usuario no tenga ya un perfil de Momentum
    const existingProfile = await client.query(
        'SELECT id FROM momentum_profiles WHERE user_id = $1',
        [userId]
    );
    if (existingProfile.rowCount > 0) {
        throw { status: 409, message: 'Ya tienes un perfil de Momentum activo.' };
    }

    // Crear el perfil con tier PENDIENTE
    const result = await client.query(`
        INSERT INTO momentum_profiles (user_id, nickname, social_platform, social_link, social_screenshot_url, followers_count, niche)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, [userId, nickname, social_platform, social_link, social_screenshot_url || null, followers_count || 0, niche || null]);

    // Incrementar cupos ocupados en la config global
    await client.query(`
        UPDATE momentum_global_config
        SET occupied_slots = occupied_slots + 1, updated_at = NOW()
        WHERE id = 1
    `);

    return result.rows[0];
}

/**
 * Obtiene el perfil de Momentum de un usuario.
 * @param {object} client - Cliente PostgreSQL
 * @param {number} userId - ID del usuario
 * @returns {object|null} Perfil o null si no existe
 */
async function getProfileByUserId(client, userId) {
    const result = await client.query(`
        SELECT mp.*, u.username, u.email
        FROM momentum_profiles mp
        JOIN users u ON mp.user_id = u.id
        WHERE mp.user_id = $1
    `, [userId]);
    return result.rows[0] || null;
}

/**
 * Obtiene el perfil de Momentum por su ID.
 * @param {object} client - Cliente PostgreSQL
 * @param {number} profileId - ID del perfil
 * @returns {object|null} Perfil o null si no existe
 */
async function getProfileById(client, profileId) {
    const result = await client.query(`
        SELECT mp.*, u.username, u.email
        FROM momentum_profiles mp
        JOIN users u ON mp.user_id = u.id
        WHERE mp.id = $1
    `, [profileId]);
    return result.rows[0] || null;
}

/**
 * Lista todos los perfiles (Admin).
 * Soporta filtro por tier y paginación.
 * @param {object} client - Cliente PostgreSQL
 * @param {object} filters - Filtros opcionales { tier, status, limit, offset }
 * @returns {object[]} Lista de perfiles
 */
async function listProfiles(client, filters = {}) {
    const { tier, status, limit = 50, offset = 0 } = filters;
    let query = `
        SELECT mp.*, u.username, u.email,
               -- Saldo total de BLUE IOU para este usuario (del sistema booster existente)
               COALESCE((SELECT SUM(amount) FROM booster_blue_ledger WHERE user_id = mp.user_id), 0) as total_iou_balance
        FROM momentum_profiles mp
        JOIN users u ON mp.user_id = u.id
        WHERE 1 = 1
    `;
    const params = [];
    let paramIndex = 1;

    if (tier) {
        query += ` AND mp.tier = $${paramIndex++}`;
        params.push(tier);
    }
    if (status) {
        query += ` AND mp.status = $${paramIndex++}`;
        params.push(status);
    }

    query += ` ORDER BY mp.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await client.query(query, params);
    return result.rows;
}

/**
 * Asigna un tier a un influencer (Admin).
 * Esto "activa" al influencer y le permite ver campañas de su nivel.
 * @param {object} client - Cliente PostgreSQL
 * @param {number} profileId - ID del perfil
 * @param {string} newTier - Nuevo tier (BRONCE, PLATA, ORO)
 * @param {string} adminNotes - Notas opcionales del admin
 * @returns {object} Perfil actualizado
 */
async function assignTier(client, profileId, newTier, adminNotes) {
    // Validar que el tier sea válido y no sea PENDIENTE
    if (!['BRONCE', 'PLATA', 'ORO'].includes(newTier)) {
        throw { status: 400, message: 'Tier inválido. Los valores permitidos son: BRONCE, PLATA, ORO.' };
    }

    const result = await client.query(`
        UPDATE momentum_profiles
        SET tier = $1,
            admin_notes = COALESCE($2, admin_notes),
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
    `, [newTier, adminNotes || null, profileId]);

    if (result.rowCount === 0) {
        throw { status: 404, message: 'Perfil de influencer no encontrado.' };
    }

    // Marcar al usuario como booster si no lo es (para que aparezca en el ecosistema)
    await client.query(
        'UPDATE users SET is_booster = TRUE WHERE id = $1',
        [result.rows[0].user_id]
    );

    return result.rows[0];
}

// ============================================================================
// CAMPAÑAS / TAREAS
// ============================================================================

/**
 * Crea una nueva campaña (Admin).
 * @param {object} client - Cliente PostgreSQL
 * @param {object} campaignData - Datos de la campaña
 * @param {number} adminUserId - ID del admin que crea
 * @returns {object} Campaña creada
 */
async function createCampaign(client, campaignData, adminUserId) {
    const { title, description, base_pay_bronce, base_pay_plata, base_pay_oro, allow_multiple } = campaignData;

    // Validaciones de negocio
    if (!title || !description) {
        throw { status: 400, message: 'Título y descripción son obligatorios.' };
    }
    if (base_pay_bronce <= 0 || base_pay_plata <= 0 || base_pay_oro <= 0) {
        throw { status: 400, message: 'Los pagos base deben ser mayores a 0 para todos los tiers.' };
    }
    // El pago debe crecer con el tier (regla de coherencia)
    if (base_pay_plata < base_pay_bronce || base_pay_oro < base_pay_plata) {
        throw { status: 400, message: 'Los pagos base deben ser crecientes: Bronce ≤ Plata ≤ Oro.' };
    }

    const result = await client.query(`
        INSERT INTO momentum_campaigns (title, description, base_pay_bronce, base_pay_plata, base_pay_oro, allow_multiple, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, [title, description, base_pay_bronce, base_pay_plata, base_pay_oro, !!allow_multiple, adminUserId]);

    return result.rows[0];
}

/**
 * Lista campañas visibles para un tier específico.
 * Un influencer ORO ve todas. Un PLATA ve BRONCE y PLATA. Un BRONCE solo BRONCE.
 * En realidad, todas las campañas son visibles pero el pago mostrado depende del tier.
 * @param {object} client - Cliente PostgreSQL
 * @param {string} tier - Tier del influencer (para mostrar el pago correcto)
 * @param {boolean} activeOnly - Si true, solo campañas activas
 * @returns {object[]} Lista de campañas con pago calculado
 */
async function listCampaignsForTier(client, tier, activeOnly = true) {
    // Obtener el multiplicador vigente
    const config = await getGlobalConfig(client);
    const multiplier = parseFloat(config.multiplier);

    let query = 'SELECT * FROM momentum_campaigns';
    if (activeOnly) {
        query += ' WHERE is_active = TRUE';
    }
    query += ' ORDER BY created_at DESC';

    const result = await client.query(query);

    // Determinar la columna de pago base según el tier
    const payColumn = TIER_PAY_COLUMN[tier];
    if (!payColumn) {
        // Si el tier es PENDIENTE, no debería poder ver campañas
        return [];
    }

    // Mapear cada campaña con el pago calculado para este tier
    return result.rows.map(campaign => ({
        ...campaign,
        // Pago base del tier del influencer
        my_base_pay: parseFloat(campaign[payColumn]),
        // Pago final = base × multiplicador
        my_final_pay: parseFloat(campaign[payColumn]) * multiplier,
        // Multiplicador aplicado (para mostrar en UI)
        applied_multiplier: multiplier
    }));
}

/**
 * Lista todas las campañas (Admin, sin filtro de tier).
 * @param {object} client - Cliente PostgreSQL
 * @returns {object[]} Lista completa de campañas
 */
async function listAllCampaigns(client) {
    const config = await getGlobalConfig(client);
    const multiplier = parseFloat(config.multiplier);

    const result = await client.query(`
        SELECT c.*, u.username as created_by_username
        FROM momentum_campaigns c
        LEFT JOIN users u ON c.created_by = u.id
        ORDER BY c.created_at DESC
    `);

    return result.rows.map(campaign => ({
        ...campaign,
        // Pagos finales calculados para cada tier (vista admin)
        final_pay_bronce: parseFloat(campaign.base_pay_bronce) * multiplier,
        final_pay_plata: parseFloat(campaign.base_pay_plata) * multiplier,
        final_pay_oro: parseFloat(campaign.base_pay_oro) * multiplier,
        applied_multiplier: multiplier
    }));
}

/**
 * Actualiza una campaña existente (Admin).
 * @param {object} client - Cliente PostgreSQL
 * @param {number} campaignId - ID de la campaña
 * @param {object} updates - Campos a actualizar
 * @returns {object} Campaña actualizada
 */
async function updateCampaign(client, campaignId, updates) {
    const { title, description, base_pay_bronce, base_pay_plata, base_pay_oro, is_active, allow_multiple } = updates;

    const result = await client.query(`
        UPDATE momentum_campaigns
        SET
            title = COALESCE($1, title),
            description = COALESCE($2, description),
            base_pay_bronce = COALESCE($3, base_pay_bronce),
            base_pay_plata = COALESCE($4, base_pay_plata),
            base_pay_oro = COALESCE($5, base_pay_oro),
            is_active = COALESCE($6, is_active),
            allow_multiple = COALESCE($7, allow_multiple),
            updated_at = NOW()
        WHERE id = $8
        RETURNING *
    `, [title, description, base_pay_bronce, base_pay_plata, base_pay_oro, is_active, allow_multiple, campaignId]);

    if (result.rowCount === 0) {
        throw { status: 404, message: 'Campaña no encontrada.' };
    }

    return result.rows[0];
}

// ============================================================================
// ENTREGAS DE TAREAS (SUBMISSIONS)
// ============================================================================

/**
 * Crea una nueva entrega de tarea (Influencer).
 * Valida que el influencer tenga tier activo y no haya enviado ya esta campaña.
 * @param {object} client - Cliente PostgreSQL
 * @param {number} profileId - ID del perfil de momentum
 * @param {number} campaignId - ID de la campaña
 * @param {string} proofLink - URL del contenido realizado
 * @returns {object} Entrega creada
 */
async function createSubmission(client, profileId, campaignId, proofLink) {
    // 1. Validar que el perfil existe y tiene un tier activo (no PENDIENTE)
    const profile = await client.query(
        'SELECT id, tier, status FROM momentum_profiles WHERE id = $1',
        [profileId]
    );
    if (profile.rowCount === 0) {
        throw { status: 404, message: 'Perfil de Momentum no encontrado.' };
    }
    if (profile.rows[0].tier === 'PENDIENTE') {
        throw { status: 403, message: 'Tu perfil está pendiente de aprobación. Espera a que un administrador asigne tu nivel.' };
    }
    if (profile.rows[0].status !== 'active') {
        throw { status: 403, message: 'Tu perfil está suspendido. Contacta al equipo de soporte.' };
    }

    // 2. Validar que la campaña existe y está activa
    const campaign = await client.query(
        'SELECT id, is_active, title, allow_multiple FROM momentum_campaigns WHERE id = $1',
        [campaignId]
    );
    if (campaign.rowCount === 0) {
        throw { status: 404, message: 'Campaña no encontrada.' };
    }
    if (!campaign.rows[0].is_active) {
        throw { status: 400, message: 'Esta campaña ya no está activa.' };
    }

    const { allow_multiple } = campaign.rows[0];

    // 3. Verificar entregas anteriores según allow_multiple
    if (!allow_multiple) {
        // Regla estándar: solo una vez (PENDIENTE o APROBADA)
        const existingSubmission = await client.query(
            `SELECT id, status FROM momentum_submissions
             WHERE profile_id = $1 AND campaign_id = $2 AND status IN ('PENDIENTE', 'APROBADO')`,
            [profileId, campaignId]
        );
        if (existingSubmission.rowCount > 0) {
            const existingStatus = existingSubmission.rows[0].status;
            if (existingStatus === 'PENDIENTE') {
                throw { status: 409, message: 'Ya tienes una entrega pendiente de revisión para esta campaña.' };
            }
            if (existingStatus === 'APROBADO') {
                throw { status: 409, message: 'Ya completaste esta campaña exitosamente.' };
            }
        }
    } else {
        // Si permite múltiples, SOLO impedimos si hay una PENDIENTE ahora mismo
        const pendingSubmission = await client.query(
            `SELECT id FROM momentum_submissions
             WHERE profile_id = $1 AND campaign_id = $2 AND status = 'PENDIENTE'`,
            [profileId, campaignId]
        );
        if (pendingSubmission.rowCount > 0) {
            throw { status: 409, message: 'Espera a que revisen tu entrega anterior para enviarla de nuevo.' };
        }
    }

    // 4. Validar formato del link (URL básica)
    try {
        new URL(proofLink);
    } catch {
        throw { status: 400, message: 'El link de prueba no es una URL válida.' };
    }

    // 5. Crear la entrega
    const result = await client.query(`
        INSERT INTO momentum_submissions (profile_id, campaign_id, proof_link)
        VALUES ($1, $2, $3)
        RETURNING *
    `, [profileId, campaignId, proofLink]);

    return { submission: result.rows[0], campaign_title: campaign.rows[0].title };
}

/**
 * Aprueba una entrega de tarea y paga al influencer (Admin).
 * 
 * Flujo de pago:
 *   1. Calcula pago_final = base_tier × multiplicador + bonus
 *   2. Acredita en booster_blue_ledger (mismos BLUE IOU del programa booster)
 *   3. Registra en booster_transactions para historial
 *   4. Actualiza nivel de impulsor del usuario
 *
 * @param {object} client - Cliente PostgreSQL
 * @param {number} submissionId - ID de la entrega
 * @param {number} adminUserId - ID del admin que revisa
 * @param {string} adminNote - Nota opcional
 * @param {number} bonusAmount - Bono extra opcional (default 0)
 * @returns {object} Resultado con monto pagado  
 */
async function approveSubmission(client, submissionId, adminUserId, adminNote, bonusAmount = 0) {
    // 1. Obtener la entrega con lock para evitar concurrencia
    const submissionResult = await client.query(`
        SELECT ms.*, mp.user_id, mp.tier, mp.nickname,
               mc.title as campaign_title,
               mc.base_pay_bronce, mc.base_pay_plata, mc.base_pay_oro,
               u.username, u.email
        FROM momentum_submissions ms
        JOIN momentum_profiles mp ON ms.profile_id = mp.id
        JOIN momentum_campaigns mc ON ms.campaign_id = mc.id
        JOIN users u ON mp.user_id = u.id
        WHERE ms.id = $1
        FOR UPDATE OF ms
    `, [submissionId]);

    if (submissionResult.rowCount === 0) {
        throw { status: 404, message: 'Entrega no encontrada.' };
    }

    const submission = submissionResult.rows[0];

    // 2. Verificar que esté en estado PENDIENTE
    if (submission.status !== 'PENDIENTE') {
        throw { status: 400, message: `Esta entrega ya fue procesada (estado: ${submission.status}).` };
    }

    // 3. Obtener el multiplicador vigente
    const config = await getGlobalConfig(client);
    const multiplier = parseFloat(config.multiplier);

    // 4. Calcular pago final según el tier del influencer
    const payColumn = TIER_PAY_COLUMN[submission.tier];
    if (!payColumn) {
        throw { status: 400, message: 'El influencer tiene un tier inválido para recibir pagos.' };
    }
    const basePay = parseFloat(submission[payColumn]);
    const bonus = parseFloat(bonusAmount) || 0;

    // Validar que el bonus no sea negativo
    if (bonus < 0) {
        throw { status: 400, message: 'El bono extra no puede ser negativo.' };
    }

    // pago_final = (base_tier × multiplicador) + bonus_extra
    const finalPayment = (basePay * multiplier) + bonus;

    // 5. Actualizar la entrega como APROBADO
    await client.query(`
        UPDATE momentum_submissions
        SET status = 'APROBADO',
            admin_note = $1,
            bonus_amount = $2,
            paid_amount = $3,
            reviewed_by = $4,
            reviewed_at = NOW()
        WHERE id = $5
    `, [adminNote || null, bonus, finalPayment, adminUserId, submissionId]);

    // 6. Acreditar BLUE IOU en booster_blue_ledger (sistema existente)
    // Usamos record_booster_event() que inserta directamente en booster_blue_ledger
    await client.query(
        "SELECT record_booster_event($1, 'momentum_task_reward', $2, NULL)",
        [submission.user_id, finalPayment]
    );

    // 7. Registrar en booster_transactions para historial visible
    await client.query(`
        INSERT INTO booster_transactions (user_id, type, amount, description)
        VALUES ($1, 'momentum_task_reward', $2, $3)
    `, [
        submission.user_id,
        finalPayment,
        `Momentum: "${submission.campaign_title}" (${submission.tier})${bonus > 0 ? ` +${bonus.toFixed(4)} bono` : ''}`
    ]);

    // 8. Marcar al usuario como booster si no lo es
    await client.query('UPDATE users SET is_booster = TRUE WHERE id = $1', [submission.user_id]);

    // 9. Recalcular nivel de impulsor
    // NOTA: copiamos la lógica de updateUserBoosterLevel() aquí porque
    // esa función está definida dentro de startServer() en server.js y
    // no es exportable. Es la misma lógica: sumamos booster_blue_ledger
    // y buscamos el nivel máximo alcanzado.
    const totalBlueResult = await client.query(
        'SELECT SUM(amount) as total FROM booster_blue_ledger WHERE user_id = $1',
        [submission.user_id]
    );
    const totalBoosterBlue = parseFloat(totalBlueResult.rows[0].total) || 0;

    const levelResult = await client.query(
        'SELECT MAX(level) as current_level FROM booster_level_settings WHERE min_blue_required <= $1',
        [totalBoosterBlue]
    );
    const newLevel = levelResult.rows[0].current_level || 0;
    await client.query('UPDATE users SET booster_level = $1 WHERE id = $2', [newLevel, submission.user_id]);

    // 10. Crear notificación in-app
    await client.query(
        `INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
        [
            submission.username,
            `🎉 ¡Tu entrega para "${submission.campaign_title}" ha sido aprobada! Se han acreditado ${finalPayment.toFixed(4)} BLUE IOU a tu saldo.${bonus > 0 ? ` (incluye bono de ${bonus.toFixed(4)})` : ''}`
        ]
    );

    return {
        paid_amount: finalPayment,
        base_pay: basePay,
        multiplier,
        bonus,
        username: submission.username,
        email: submission.email,
        campaign_title: submission.campaign_title,
        user_id: submission.user_id,
        nickname: submission.nickname
    };
}

/**
 * Rechaza una entrega de tarea (Admin).
 * @param {object} client - Cliente PostgreSQL
 * @param {number} submissionId - ID de la entrega
 * @param {number} adminUserId - ID del admin que revisa
 * @param {string} adminNote - Nota explicativa (obligatoria)
 * @returns {object} Resultado
 */
async function rejectSubmission(client, submissionId, adminUserId, adminNote) {
    // La nota es obligatoria al rechazar (el influencer necesita saber por qué)
    if (!adminNote || adminNote.trim().length === 0) {
        throw { status: 400, message: 'La nota de auditoría es obligatoria al rechazar una entrega.' };
    }

    // 1. Obtener la entrega con lock
    const submissionResult = await client.query(`
        SELECT ms.*, mp.user_id, mc.title as campaign_title, u.username
        FROM momentum_submissions ms
        JOIN momentum_profiles mp ON ms.profile_id = mp.id
        JOIN momentum_campaigns mc ON ms.campaign_id = mc.id
        JOIN users u ON mp.user_id = u.id
        WHERE ms.id = $1
        FOR UPDATE OF ms
    `, [submissionId]);

    if (submissionResult.rowCount === 0) {
        throw { status: 404, message: 'Entrega no encontrada.' };
    }

    const submission = submissionResult.rows[0];

    if (submission.status !== 'PENDIENTE') {
        throw { status: 400, message: `Esta entrega ya fue procesada (estado: ${submission.status}).` };
    }

    // 2. Actualizar estado a RECHAZADO
    await client.query(`
        UPDATE momentum_submissions
        SET status = 'RECHAZADO',
            admin_note = $1,
            reviewed_by = $2,
            reviewed_at = NOW()
        WHERE id = $3
    `, [adminNote, adminUserId, submissionId]);

    // 3. Notificar al influencer
    await client.query(
        `INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
        [
            submission.username,
            `❌ Tu entrega para "${submission.campaign_title}" no fue aprobada. Motivo: ${adminNote}`
        ]
    );

    return {
        username: submission.username,
        campaign_title: submission.campaign_title
    };
}

/**
 * Lista entregas con filtros (Admin o Influencer).
 * @param {object} client - Cliente PostgreSQL
 * @param {object} filters - { profileId, status, limit, offset }
 * @returns {object[]} Lista de entregas
 */
async function listSubmissions(client, filters = {}) {
    const { profileId, status, limit = 50, offset = 0 } = filters;
    let query = `
        SELECT ms.*,
               mp.nickname, mp.tier, mp.user_id,
               mc.title as campaign_title,
               mc.base_pay_bronce, mc.base_pay_plata, mc.base_pay_oro,
               u.username,
               reviewer.username as reviewed_by_username
        FROM momentum_submissions ms
        JOIN momentum_profiles mp ON ms.profile_id = mp.id
        JOIN momentum_campaigns mc ON ms.campaign_id = mc.id
        JOIN users u ON mp.user_id = u.id
        LEFT JOIN users reviewer ON ms.reviewed_by = reviewer.id
        WHERE 1 = 1
    `;
    const params = [];
    let paramIndex = 1;

    if (profileId) {
        query += ` AND ms.profile_id = $${paramIndex++}`;
        params.push(profileId);
    }
    if (status) {
        query += ` AND ms.status = $${paramIndex++}`;
        params.push(status);
    }

    query += ` ORDER BY ms.submitted_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await client.query(query, params);

    // Enriquecer con multiplicador para mostrar pago calculado
    const config = await getGlobalConfig(client);
    const multiplier = parseFloat(config.multiplier);

    return result.rows.map(sub => {
        const payColumn = TIER_PAY_COLUMN[sub.tier];
        const basePay = payColumn ? parseFloat(sub[payColumn]) : 0;
        return {
            ...sub,
            calculated_base_pay: basePay,
            calculated_final_pay: basePay * multiplier,
            applied_multiplier: multiplier
        };
    });
}

/**
 * Obtiene los datos públicos para la landing (Social Proof).
 * Muestra las últimas misiones pagadas (sin datos sensibles).
 * @param {object} client - Cliente PostgreSQL
 * @param {number} limit - Máximo de resultados
 * @returns {object[]} Lista de pagos recientes
 */
async function getRecentPayments(client, limit = 10) {
    const result = await client.query(`
        SELECT
            mp.nickname,
            mp.tier,
            mc.title as campaign_title,
            ms.paid_amount,
            ms.reviewed_at as paid_at
        FROM momentum_submissions ms
        JOIN momentum_profiles mp ON ms.profile_id = mp.id
        JOIN momentum_campaigns mc ON ms.campaign_id = mc.id
        WHERE ms.status = 'APROBADO' AND ms.paid_amount > 0
        ORDER BY ms.reviewed_at DESC
        LIMIT $1
    `, [limit]);

    return result.rows;
}

/**
 * Obtiene los saldos de BLUE IOU de un influencer.
 * Combina datos del sistema Momentum (pendiente) + booster (confirmado).
 * @param {object} client - Cliente PostgreSQL
 * @param {number} profileId - ID del perfil de momentum
 * @returns {object} Saldos desglosados
 */
async function getInfluencerBalance(client, profileId) {
    // 1. Obtener el user_id del perfil
    const profileResult = await client.query(
        'SELECT user_id FROM momentum_profiles WHERE id = $1',
        [profileId]
    );
    if (profileResult.rowCount === 0) {
        throw { status: 404, message: 'Perfil no encontrado.' };
    }
    const userId = profileResult.rows[0].user_id;

    // 2. Saldo confirmado: total en booster_blue_ledger (BLUE IOU reales)
    const confirmedResult = await client.query(
        'SELECT COALESCE(SUM(amount), 0) as total FROM booster_blue_ledger WHERE user_id = $1',
        [userId]
    );
    const confirmedBalance = parseFloat(confirmedResult.rows[0].total);

    // 3. Saldo pendiente: suma de pagos calculados de entregas PENDIENTES
    const config = await getGlobalConfig(client);
    const multiplier = parseFloat(config.multiplier);

    const pendingResult = await client.query(`
        SELECT ms.campaign_id, mp.tier,
               mc.base_pay_bronce, mc.base_pay_plata, mc.base_pay_oro
        FROM momentum_submissions ms
        JOIN momentum_profiles mp ON ms.profile_id = mp.id
        JOIN momentum_campaigns mc ON ms.campaign_id = mc.id
        WHERE ms.profile_id = $1 AND ms.status = 'PENDIENTE'
    `, [profileId]);

    let pendingBalance = 0;
    for (const sub of pendingResult.rows) {
        const payColumn = TIER_PAY_COLUMN[sub.tier];
        if (payColumn) {
            pendingBalance += parseFloat(sub[payColumn]) * multiplier;
        }
    }

    // 4. Total ganado en Momentum (solo entregas APROBADAS del programa)
    const momentumEarned = await client.query(
        `SELECT COALESCE(SUM(paid_amount), 0) as total
         FROM momentum_submissions WHERE profile_id = $1 AND status = 'APROBADO'`,
        [profileId]
    );

    return {
        confirmed_balance: confirmedBalance,          // Total BLUE IOU acreditados (booster)
        pending_verification: pendingBalance,          // Estimado de entregas pendientes
        total_earned_momentum: parseFloat(momentumEarned.rows[0].total), // Ganado solo en Momentum
        current_multiplier: multiplier
    };
}

/**
 * Exporta el ledger completo de Momentum en formato para CSV (Admin).
 * Incluye todos los pagos realizados a influencers.
 * @param {object} client - Cliente PostgreSQL
 * @returns {object[]} Datos del ledger
 */
async function exportLedger(client) {
    const result = await client.query(`
        SELECT
            ms.id as submission_id,
            mp.nickname,
            u.username,
            u.email,
            mp.tier,
            mc.title as campaign_title,
            ms.paid_amount,
            ms.bonus_amount,
            ms.status,
            ms.proof_link,
            ms.admin_note,
            ms.submitted_at,
            ms.reviewed_at,
            reviewer.username as reviewed_by_username
        FROM momentum_submissions ms
        JOIN momentum_profiles mp ON ms.profile_id = mp.id
        JOIN momentum_campaigns mc ON ms.campaign_id = mc.id
        JOIN users u ON mp.user_id = u.id
        LEFT JOIN users reviewer ON ms.reviewed_by = reviewer.id
        WHERE ms.status = 'APROBADO'
        ORDER BY ms.reviewed_at DESC
    `);

    return result.rows;
}

// ============================================================================
// EXPORTACIONES
// ============================================================================
module.exports = {
    // Constantes
    TIER_HIERARCHY,
    TIER_PAY_COLUMN,

    // Configuración
    getGlobalConfig,
    updateGlobalConfig,

    // Perfiles
    createProfile,
    getProfileByUserId,
    getProfileById,
    listProfiles,
    assignTier,

    // Campañas
    createCampaign,
    listCampaignsForTier,
    listAllCampaigns,
    updateCampaign,

    // Entregas
    createSubmission,
    approveSubmission,
    rejectSubmission,
    listSubmissions,

    // Datos públicos y saldos
    getRecentPayments,
    getInfluencerBalance,
    exportLedger
};
