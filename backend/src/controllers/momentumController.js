// ============================================================================
// WintonCoin - Momentum Controller
// ============================================================================
// Controladores HTTP para el sistema Winton Momentum.
// Cada función maneja una request/response Express.
// La lógica de negocio se delega al momentumService.
//
// Responsabilidades de este archivo:
//   - Extraer y validar datos de req.body / req.params / req.query
//   - Gestionar transacciones de DB (BEGIN/COMMIT/ROLLBACK)
//   - Llamar al service con datos validados
//   - Formatear y enviar respuestas HTTP
//   - Registrar eventos de auditoría
// ============================================================================

'use strict';

const momentumService = require('../services/momentumService');

// ============================================================================
// ENDPOINTS PÚBLICOS (Sin autenticación)
// ============================================================================

/**
 * GET /api/momentum/landing-data
 * Retorna datos públicos para la landing de captación:
 *   - Multiplicador vigente
 *   - Cupos (total vs ocupados)
 *   - Fase actual y fecha de fin (para contador)
 */
async function getLandingData(req, res) {
    try {
        const pool = req.app.get('pool');
        const client = await pool.connect();
        try {
            const config = await momentumService.getGlobalConfig(client);
            res.json({
                multiplier: parseFloat(config.multiplier),
                phase_name: config.phase_name,
                phase_end_date: config.phase_end_date,
                total_slots: config.total_slots,
                occupied_slots: config.occupied_slots,
                // Porcentaje de cupos ocupados (para la barra de FOMO)
                slots_percentage: config.total_slots > 0
                    ? Math.round((config.occupied_slots / config.total_slots) * 100)
                    : 0
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[MOMENTUM] Error al obtener datos de landing:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * GET /api/momentum/recent-payments
 * Retorna últimas misiones pagadas para Social Proof en la landing.
 * No expone datos sensibles (solo nickname, tier, monto y campaña).
 */
async function getRecentPayments(req, res) {
    try {
        const pool = req.app.get('pool');
        const client = await pool.connect();
        try {
            const limit = Math.min(parseInt(req.query.limit) || 10, 20);
            const payments = await momentumService.getRecentPayments(client, limit);
            res.json(payments);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[MOMENTUM] Error al obtener pagos recientes:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

// ============================================================================
// ENDPOINTS DE INFLUENCER (Requieren autenticación de usuario)
// ============================================================================

/**
 * POST /api/momentum/apply
 * Permite a un usuario postularse como influencer.
 * Crea un momentum_profile con tier PENDIENTE.
 */
async function applyAsInfluencer(req, res) {
    const userId = req.user?.userId;
    if (!userId) {
        return res.status(401).json({ message: 'No autenticado.' });
    }

    const { nickname, social_platform, social_link, social_screenshot_url, followers_count, niche } = req.body;

    // Validaciones de entrada
    if (!nickname || nickname.trim().length < 2) {
        return res.status(400).json({ message: 'El nickname debe tener al menos 2 caracteres.' });
    }
    if (!social_platform || social_platform.trim().length === 0) {
        return res.status(400).json({ message: 'La plataforma de red social es obligatoria.' });
    }
    if (!social_link || social_link.trim().length === 0) {
        return res.status(400).json({ message: 'El link de tu perfil de red social es obligatorio.' });
    }

    // Validar que el link sea una URL válida
    try {
        new URL(social_link);
    } catch {
        return res.status(400).json({ message: 'El link de red social debe ser una URL válida.' });
    }

    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const profile = await momentumService.createProfile(client, userId, {
            nickname: nickname.trim(),
            social_platform: social_platform.trim(),
            social_link: social_link.trim(),
            social_screenshot_url: social_screenshot_url || null,
            followers_count: parseInt(followers_count) || 0,
            niche: niche ? niche.trim() : null
        });

        // Auditoría
        if (req.logAuditEvent) {
            await req.logAuditEvent(client, req, {
                eventType: 'momentum.profile_created',
                actorUsername: req.user.username,
                metadata: { profile_id: profile.id, social_platform: profile.social_platform }
            });
        }

        await client.query('COMMIT');
        res.status(201).json({
            message: '¡Postulación enviada exitosamente! Pronto un administrador revisará tu perfil.',
            profile
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MOMENTUM] Error en postulación:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno.' });
    } finally {
        client.release();
    }
}

/**
 * GET /api/momentum/profile
 * Retorna el perfil de Momentum del usuario autenticado.
 */
async function getMyProfile(req, res) {
    const userId = req.user?.userId;
    if (!userId) {
        return res.status(401).json({ message: 'No autenticado.' });
    }

    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        const profile = await momentumService.getProfileByUserId(client, userId);
        if (!profile) {
            return res.status(404).json({ message: 'No tienes un perfil de Momentum. ¿Deseas postularte?' });
        }
        res.json(profile);
    } catch (error) {
        console.error('[MOMENTUM] Error al obtener perfil:', error);
        res.status(500).json({ message: 'Error interno.' });
    } finally {
        client.release();
    }
}

/**
 * GET /api/momentum/campaigns
 * Lista campañas disponibles para el tier del influencer autenticado.
 * Cada campaña muestra el pago final calculado (base × multiplicador).
 */
async function getMyCampaigns(req, res) {
    const userId = req.user?.userId;
    if (!userId) {
        return res.status(401).json({ message: 'No autenticado.' });
    }

    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        // Obtener el perfil para saber el tier
        const profile = await momentumService.getProfileByUserId(client, userId);
        if (!profile) {
            return res.status(404).json({ message: 'No tienes un perfil de Momentum.' });
        }
        if (profile.tier === 'PENDIENTE') {
            return res.status(403).json({
                message: 'Tu perfil está pendiente de aprobación. Aún no puedes ver las misiones.'
            });
        }

        const campaigns = await momentumService.listCampaignsForTier(client, profile.tier, true);
        res.json({
            tier: profile.tier,
            campaigns
        });
    } catch (error) {
        console.error('[MOMENTUM] Error al listar campañas:', error);
        res.status(500).json({ message: 'Error interno.' });
    } finally {
        client.release();
    }
}

/**
 * POST /api/momentum/submissions
 * Envía una entrega de tarea (link de prueba).
 */
async function submitTask(req, res) {
    const userId = req.user?.userId;
    if (!userId) {
        return res.status(401).json({ message: 'No autenticado.' });
    }

    const { campaign_id, proof_link } = req.body;

    if (!campaign_id) {
        return res.status(400).json({ message: 'El ID de la campaña es obligatorio.' });
    }
    if (!proof_link || proof_link.trim().length === 0) {
        return res.status(400).json({ message: 'El link de prueba es obligatorio.' });
    }

    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Obtener el perfil del influencer
        const profile = await momentumService.getProfileByUserId(client, userId);
        if (!profile) {
            throw { status: 404, message: 'No tienes un perfil de Momentum.' };
        }

        const result = await momentumService.createSubmission(
            client,
            profile.id,
            parseInt(campaign_id),
            proof_link.trim()
        );

        // Auditoría
        if (req.logAuditEvent) {
            await req.logAuditEvent(client, req, {
                eventType: 'momentum.submission_created',
                actorUsername: req.user.username,
                metadata: {
                    submission_id: result.submission.id,
                    campaign_id: parseInt(campaign_id),
                    campaign_title: result.campaign_title
                }
            });
        }

        await client.query('COMMIT');
        res.status(201).json({
            message: `¡Entrega enviada para "${result.campaign_title}"! Será revisada por un administrador.`,
            submission: result.submission
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MOMENTUM] Error al enviar entrega:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno.' });
    } finally {
        client.release();
    }
}

/**
 * GET /api/momentum/submissions
 * Lista las entregas del influencer autenticado.
 */
async function getMySubmissions(req, res) {
    const userId = req.user?.userId;
    if (!userId) {
        return res.status(401).json({ message: 'No autenticado.' });
    }

    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        const profile = await momentumService.getProfileByUserId(client, userId);
        if (!profile) {
            return res.status(404).json({ message: 'No tienes un perfil de Momentum.' });
        }

        const status = req.query.status || null;
        const submissions = await momentumService.listSubmissions(client, {
            profileId: profile.id,
            status
        });
        res.json(submissions);
    } catch (error) {
        console.error('[MOMENTUM] Error al listar entregas:', error);
        res.status(500).json({ message: 'Error interno.' });
    } finally {
        client.release();
    }
}

/**
 * GET /api/momentum/balance
 * Retorna los saldos del influencer (confirmado vs pendiente).
 */
async function getMyBalance(req, res) {
    const userId = req.user?.userId;
    if (!userId) {
        return res.status(401).json({ message: 'No autenticado.' });
    }

    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        const profile = await momentumService.getProfileByUserId(client, userId);
        if (!profile) {
            return res.status(404).json({ message: 'No tienes un perfil de Momentum.' });
        }

        const balance = await momentumService.getInfluencerBalance(client, profile.id);
        res.json(balance);
    } catch (error) {
        console.error('[MOMENTUM] Error al obtener balance:', error);
        res.status(500).json({ message: 'Error interno.' });
    } finally {
        client.release();
    }
}

// ============================================================================
// ENDPOINTS DE ADMIN (Requieren autenticación de administrador)
// ============================================================================

/**
 * GET /api/momentum/admin/config
 * Retorna la configuración global completa.
 */
async function getAdminConfig(req, res) {
    try {
        const pool = req.app.get('pool');
        const client = await pool.connect();
        try {
            const config = await momentumService.getGlobalConfig(client);
            res.json(config);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[MOMENTUM ADMIN] Error al obtener config:', error);
        res.status(500).json({ message: 'Error interno.' });
    }
}

/**
 * PUT /api/momentum/admin/config
 * Actualiza la configuración global (multiplicador, cupos, fase).
 */
async function updateAdminConfig(req, res) {
    const { multiplier, phase_name, phase_end_date, total_slots, occupied_slots } = req.body;

    // Validaciones
    if (multiplier !== undefined && (isNaN(multiplier) || multiplier <= 0)) {
        return res.status(400).json({ message: 'El multiplicador debe ser un número positivo.' });
    }
    if (total_slots !== undefined && (isNaN(total_slots) || total_slots < 0)) {
        return res.status(400).json({ message: 'Los cupos totales deben ser un número no negativo.' });
    }

    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const config = await momentumService.updateGlobalConfig(client, {
            multiplier: multiplier !== undefined ? parseFloat(multiplier) : undefined,
            phase_name: phase_name || undefined,
            phase_end_date: phase_end_date || undefined,
            total_slots: total_slots !== undefined ? parseInt(total_slots) : undefined,
            occupied_slots: occupied_slots !== undefined ? parseInt(occupied_slots) : undefined
        });

        // Auditoría
        if (req.logAuditEvent) {
            await req.logAuditEvent(client, req, {
                eventType: 'momentum.config_updated',
                actorUsername: req.user?.username || 'admin',
                metadata: { multiplier: config.multiplier, total_slots: config.total_slots }
            });
        }

        await client.query('COMMIT');
        res.json({
            message: 'Configuración actualizada exitosamente.',
            config
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MOMENTUM ADMIN] Error al actualizar config:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno.' });
    } finally {
        client.release();
    }
}

/**
 * GET /api/momentum/admin/applicants
 * Lista postulantes pendientes de aprobación.
 */
async function getApplicants(req, res) {
    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        const profiles = await momentumService.listProfiles(client, {
            tier: 'PENDIENTE',
            status: 'active'
        });
        res.json(profiles);
    } catch (error) {
        console.error('[MOMENTUM ADMIN] Error al listar postulantes:', error);
        res.status(500).json({ message: 'Error interno.' });
    } finally {
        client.release();
    }
}

/**
 * GET /api/momentum/admin/profiles
 * Lista todos los perfiles de influencer (con filtros opcionales).
 */
async function getAdminProfiles(req, res) {
    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        const { tier, status, limit, offset } = req.query;
        const profiles = await momentumService.listProfiles(client, {
            tier: tier || null,
            status: status || null,
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0
        });
        res.json(profiles);
    } catch (error) {
        console.error('[MOMENTUM ADMIN] Error al listar perfiles:', error);
        res.status(500).json({ message: 'Error interno.' });
    } finally {
        client.release();
    }
}

/**
 * GET /api/momentum/admin/profiles/:id
 * Retorna detalle completo de un influencer (perfil + saldos + historial).
 */
async function getAdminProfileDetail(req, res) {
    const profileId = parseInt(req.params.id);
    if (isNaN(profileId)) {
        return res.status(400).json({ message: 'ID de perfil inválido.' });
    }

    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        const profile = await momentumService.getProfileById(client, profileId);
        if (!profile) {
            return res.status(404).json({ message: 'Perfil no encontrado.' });
        }

        // Obtener saldos y entregas del influencer
        const balance = await momentumService.getInfluencerBalance(client, profileId);
        const submissions = await momentumService.listSubmissions(client, { profileId });

        res.json({
            profile,
            balance,
            submissions
        });
    } catch (error) {
        console.error('[MOMENTUM ADMIN] Error al obtener detalle:', error);
        res.status(500).json({ message: 'Error interno.' });
    } finally {
        client.release();
    }
}

/**
 * PUT /api/momentum/admin/profiles/:id/tier
 * Asigna un tier a un influencer. Esto lo "activa" en el programa.
 */
async function assignTier(req, res) {
    const profileId = parseInt(req.params.id);
    if (isNaN(profileId)) {
        return res.status(400).json({ message: 'ID de perfil inválido.' });
    }

    const { tier, admin_notes } = req.body;
    if (!tier) {
        return res.status(400).json({ message: 'El tier es obligatorio.' });
    }

    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const profile = await momentumService.assignTier(client, profileId, tier.toUpperCase(), admin_notes);

        // Obtener username para la notificación
        const userResult = await client.query('SELECT username FROM users WHERE id = $1', [profile.user_id]);
        const username = userResult.rows[0]?.username;

        // Notificación in-app al influencer
        if (username) {
            const tierLabels = { BRONCE: '🥉 Bronce', PLATA: '🥈 Plata', ORO: '🥇 Oro' };
            await client.query(
                `INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
                [
                    username,
                    `🎉 ¡Felicidades! Has sido aceptado en Winton Momentum con nivel ${tierLabels[profile.tier]}. Ya puedes acceder a las misiones de tu nivel.`
                ]
            );
        }

        // Auditoría
        if (req.logAuditEvent) {
            await req.logAuditEvent(client, req, {
                eventType: 'momentum.tier_assigned',
                actorUsername: req.user?.username || 'admin',
                targetUsername: username,
                metadata: { profile_id: profileId, new_tier: profile.tier }
            });
        }

        await client.query('COMMIT');
        res.json({
            message: `Tier ${profile.tier} asignado exitosamente a ${username || 'influencer'}.`,
            profile
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MOMENTUM ADMIN] Error al asignar tier:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno.' });
    } finally {
        client.release();
    }
}

// --- CAMPAÑAS (Admin) ---

/**
 * POST /api/momentum/admin/campaigns
 * Crea una nueva campaña de misiones.
 */
async function createCampaign(req, res) {
    const { title, description, base_pay_bronce, base_pay_plata, base_pay_oro, base_pay_platino } = req.body;

    const pool = req.app.get('pool');
    const client = await pool.connect();

    // Resolver el ID del admin
    let adminUserId = req.user?.userId;
    if (!adminUserId) {
        // Token admin legacy (sin userId): buscar usuario plataforma
        try {
            const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
            const platformUser = await client.query(
                'SELECT id FROM users WHERE username = $1', [platformUsername]
            );
            adminUserId = platformUser.rows[0]?.id;
        } catch { /* ignorar */ }
    }

    try {
        await client.query('BEGIN');

        const campaign = await momentumService.createCampaign(client, {
            title,
            description,
            base_pay_bronce: parseFloat(base_pay_bronce) || 0,
            base_pay_plata: parseFloat(base_pay_plata) || 0,
            base_pay_oro: parseFloat(base_pay_oro) || 0,
            base_pay_platino: parseFloat(base_pay_platino) || 0,
            allow_multiple: !!req.body.allow_multiple
        }, adminUserId);

        // Auditoría
        if (req.logAuditEvent) {
            await req.logAuditEvent(client, req, {
                eventType: 'momentum.campaign_created',
                actorUsername: req.user?.username || 'admin',
                metadata: { campaign_id: campaign.id, title: campaign.title }
            });
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Campaña creada exitosamente.', campaign });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MOMENTUM ADMIN] Error al crear campaña:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno.' });
    } finally {
        client.release();
    }
}

/**
 * GET /api/momentum/admin/campaigns
 * Lista todas las campañas (con pagos calculados por tier).
 */
async function getAdminCampaigns(req, res) {
    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        const campaigns = await momentumService.listAllCampaigns(client);
        res.json(campaigns);
    } catch (error) {
        console.error('[MOMENTUM ADMIN] Error al listar campañas:', error);
        res.status(500).json({ message: 'Error interno.' });
    } finally {
        client.release();
    }
}

/**
 * PUT /api/momentum/admin/campaigns/:id
 * Actualiza una campaña existente.
 */
async function updateCampaign(req, res) {
    const campaignId = parseInt(req.params.id);
    if (isNaN(campaignId)) {
        return res.status(400).json({ message: 'ID de campaña inválido.' });
    }

    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const campaign = await momentumService.updateCampaign(client, campaignId, {
            ...req.body,
            allow_multiple: req.body.allow_multiple !== undefined ? !!req.body.allow_multiple : undefined
        });

        // Auditoría
        if (req.logAuditEvent) {
            await req.logAuditEvent(client, req, {
                eventType: 'momentum.campaign_updated',
                actorUsername: req.user?.username || 'admin',
                metadata: { campaign_id: campaignId }
            });
        }

        await client.query('COMMIT');
        res.json({ message: 'Campaña actualizada.', campaign });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MOMENTUM ADMIN] Error al actualizar campaña:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno.' });
    } finally {
        client.release();
    }
}

/**
 * DELETE /api/momentum/admin/campaigns/:id
 * Desactiva una campaña (soft delete).
 */
async function deactivateCampaign(req, res) {
    const campaignId = parseInt(req.params.id);
    if (isNaN(campaignId)) {
        return res.status(400).json({ message: 'ID de campaña inválido.' });
    }

    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const campaign = await momentumService.updateCampaign(client, campaignId, { is_active: false });

        await client.query('COMMIT');
        res.json({ message: 'Campaña desactivada.', campaign });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MOMENTUM ADMIN] Error al desactivar campaña:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno.' });
    } finally {
        client.release();
    }
}

// --- ENTREGAS / VERIFICACIÓN (Admin) ---

/**
 * GET /api/momentum/admin/submissions
 * Lista entregas pendientes de revisión.
 */
async function getAdminSubmissions(req, res) {
    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        const { status, limit, offset } = req.query;
        const submissions = await momentumService.listSubmissions(client, {
            status: status || 'PENDIENTE',
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0
        });
        res.json(submissions);
    } catch (error) {
        console.error('[MOMENTUM ADMIN] Error al listar entregas:', error);
        res.status(500).json({ message: 'Error interno.' });
    } finally {
        client.release();
    }
}

/**
 * POST /api/momentum/admin/submissions/:id/approve
 * Aprueba una entrega, paga BLUE IOU y envía notificación por email.
 */
async function approveSubmission(req, res) {
    const submissionId = parseInt(req.params.id);
    if (isNaN(submissionId)) {
        return res.status(400).json({ message: 'ID de entrega inválido.' });
    }

    const { admin_note, bonus_amount } = req.body;

    // Resolver el ID del admin
    let adminUserId = req.user?.userId;
    if (!adminUserId) {
        const pool = req.app.get('pool');
        try {
            const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
            const platformUser = await pool.query(
                'SELECT id FROM users WHERE username = $1', [platformUsername]
            );
            adminUserId = platformUser.rows[0]?.id;
        } catch { /* ignorar */ }
    }

    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await momentumService.approveSubmission(
            client,
            submissionId,
            adminUserId,
            admin_note || null,
            parseFloat(bonus_amount) || 0
        );

        // Auditoría
        if (req.logAuditEvent) {
            await req.logAuditEvent(client, req, {
                eventType: 'momentum.submission_approved',
                actorUsername: req.user?.username || 'admin',
                targetUsername: result.username,
                metadata: {
                    submission_id: submissionId,
                    paid_amount: result.paid_amount,
                    bonus: result.bonus,
                    campaign_title: result.campaign_title
                }
            });
        }

        await client.query('COMMIT');

        // Enviar email de confirmación (no-blocking, fuera de la transacción)
        try {
            const { sendTransactionEmail } = require('../services/emailService');
            if (result.email && sendTransactionEmail) {
                const dateStr = new Date().toLocaleDateString('es-ES');
                await sendTransactionEmail({
                    toEmail: result.email,
                    subject: `✅ Misión aprobada: "${result.campaign_title}"`,
                    title: '¡Misión Completada!',
                    message: `¡Felicidades ${result.nickname}! Tu entrega para "${result.campaign_title}" ha sido verificada y aprobada.`,
                    amount: `${result.paid_amount.toFixed(4)} BLUE IOU`,
                    details: [
                        { label: 'Misión', value: result.campaign_title },
                        { label: 'Pago Base', value: `${result.base_pay.toFixed(4)} × ${result.multiplier}` },
                        ...(result.bonus > 0 ? [{ label: 'Bono Extra', value: `+${result.bonus.toFixed(4)} BLUE IOU` }] : []),
                        { label: 'Total Acreditado', value: `${result.paid_amount.toFixed(4)} BLUE IOU` },
                        { label: 'Fecha', value: dateStr },
                        { label: 'Estado', value: 'Saldo Confirmado' }
                    ]
                });
            }
        } catch (emailError) {
            // Los errores de email no deben bloquear la transacción
            console.error('[MOMENTUM] Error al enviar email de confirmación:', emailError);
        }

        res.json({
            message: `Entrega aprobada. Se acreditaron ${result.paid_amount.toFixed(4)} BLUE IOU a ${result.username}.`,
            paid_amount: result.paid_amount,
            bonus: result.bonus
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MOMENTUM ADMIN] Error al aprobar entrega:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno.' });
    } finally {
        client.release();
    }
}

/**
 * POST /api/momentum/admin/submissions/:id/reject
 * Rechaza una entrega con nota explicativa obligatoria.
 */
async function rejectSubmission(req, res) {
    const submissionId = parseInt(req.params.id);
    if (isNaN(submissionId)) {
        return res.status(400).json({ message: 'ID de entrega inválido.' });
    }

    const { admin_note } = req.body;

    let adminUserId = req.user?.userId;
    if (!adminUserId) {
        const pool = req.app.get('pool');
        try {
            const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
            const platformUser = await pool.query(
                'SELECT id FROM users WHERE username = $1', [platformUsername]
            );
            adminUserId = platformUser.rows[0]?.id;
        } catch { /* ignorar */ }
    }

    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await momentumService.rejectSubmission(
            client,
            submissionId,
            adminUserId,
            admin_note
        );

        // Auditoría
        if (req.logAuditEvent) {
            await req.logAuditEvent(client, req, {
                eventType: 'momentum.submission_rejected',
                actorUsername: req.user?.username || 'admin',
                targetUsername: result.username,
                metadata: { submission_id: submissionId, admin_note }
            });
        }

        await client.query('COMMIT');
        res.json({ message: `Entrega rechazada para ${result.username}.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MOMENTUM ADMIN] Error al rechazar entrega:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno.' });
    } finally {
        client.release();
    }
}

/**
 * GET /api/momentum/admin/export-ledger
 * Exporta el ledger de pagos de Momentum en formato JSON (para CSV).
 */
async function exportLedger(req, res) {
    const pool = req.app.get('pool');
    const client = await pool.connect();

    try {
        const ledger = await momentumService.exportLedger(client);

        // Agregar cabeceras para facilitar descarga como CSV desde el frontend
        res.setHeader('Content-Disposition', 'attachment; filename=momentum_ledger.json');
        res.json(ledger);
    } catch (error) {
        console.error('[MOMENTUM ADMIN] Error al exportar ledger:', error);
        res.status(500).json({ message: 'Error interno.' });
    } finally {
        client.release();
    }
}

// ============================================================================
// EXPORTACIONES
// ============================================================================
module.exports = {
    // Públicos
    getLandingData,
    getRecentPayments,

    // Influencer
    applyAsInfluencer,
    getMyProfile,
    getMyCampaigns,
    submitTask,
    getMySubmissions,
    getMyBalance,

    // Admin
    getAdminConfig,
    updateAdminConfig,
    getApplicants,
    getAdminProfiles,
    getAdminProfileDetail,
    assignTier,
    createCampaign,
    getAdminCampaigns,
    updateCampaign,
    deactivateCampaign,
    getAdminSubmissions,
    approveSubmission,
    rejectSubmission,
    exportLedger
};
