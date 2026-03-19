const crypto = require('crypto');
const EventEmitter = require('events');
const notificationService = require('./notificationService');
const { sendGovernanceEmail } = require('./emailService');
const { logAuditEvent } = require('./auditService');
const pool = require('../config/db');

// Helper para construir URL absoluta del panel de gobernanza
function _getGovernancePanelUrl(requestId) {
    // Detectar entorno automáticamente
    let baseUrl = process.env.FRONTEND_URL;
    
    if (!baseUrl) {
        // PRIORIDAD 1: Verificar si es DEMO (antes de producción)
        if (process.env.IS_DEMO_ENV === 'true' || process.env.DATABASE_URL?.includes('wintoncoin_demo')) {
            baseUrl = 'https://demo.wintoncoin.com';
        }
        // PRIORIDAD 2: Verificar si es producción
        else if (process.env.NODE_ENV === 'production') {
            baseUrl = 'https://sc.wintoncoin.com';
        }
        // PRIORIDAD 3: Local por defecto
        else {
            baseUrl = 'http://localhost:3000';
        }
    }
    
    return `${baseUrl}/governance-panel.html?id=${requestId}`;
}

async function _getUserEmail(userId) {
    const res = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    return res.rows[0]?.email || null;
}

async function _getUsersEmails(userIds) {
    if (!userIds || userIds.length === 0) return [];
    const res = await pool.query('SELECT id, email FROM users WHERE id = ANY($1::int[])', [userIds]);
    return res.rows;
}

async function _getRecentConfigChanges(limit = 5) {
    try {
        const res = await pool.query(`
            SELECT
                event_type,
                actor_username,
                metadata,
                created_at
            FROM audit_log
            WHERE event_type IN ('admin.settings.updated', 'GOV_EXECUTION_SUCCESS')
            ORDER BY created_at DESC
            LIMIT $1
        `, [limit]);
        return res.rows.reduce((acc, row) => {
            try {
                const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
                acc.push({
                    key: meta.setting_key || meta.targetKey || 'N/A',
                    value: meta.new_value || 'N/A',
                    actor: row.actor_username || 'sistema',
                    date: new Date(row.created_at).toLocaleString('es-ES', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }),
                    viaGovernance: row.event_type === 'GOV_EXECUTION_SUCCESS',
                });
            } catch (_) { /* skip row with corrupt metadata */ }
            return acc;
        }, []);
    } catch (err) {
        console.error('[EVENT-BUS] Error fetching recent config changes:', err);
        return [];
    }
}

function _maskEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    const atIndex = normalized.indexOf('@');
    if (atIndex <= 1) return normalized || 'sin-email';

    const local = normalized.slice(0, atIndex);
    const domain = normalized.slice(atIndex + 1);
    const maskedLocal = `${local.slice(0, 2)}***`;
    const maskedDomain = domain.length > 3 ? `${domain.slice(0, 3)}***` : '***';
    return `${maskedLocal}@${maskedDomain}`;
}

class NotificationEventBus extends EventEmitter { }
const eventBus = new NotificationEventBus();

// --- DEFINICIÓN DE EVENTOS DEL SISTEMA ---
// Centralizamos aquí toda la lógica de "Qué pasa cuando X ocurre"
// Esto desacopla el código de negocio del código de notificación.

// 1. TAREA/PUBLICACIÓN CREADA (Opcional: Solo si se quiere notificar a seguidores o admin)
// eventBus.on('PUBLICATION_CREATED', async (data) => { ... });

// 2. SOLICITUD DE PARTICIPACIÓN (Al dueño de la publicación)
eventBus.on('PARTICIPATION_REQUESTED', async ({ publicationId, publicationTitle, ownerId, applicantUsername }) => {
    try {
        await notificationService.sendNotificationToUser(ownerId, {
            title: 'Nueva Solicitud',
            body: `${applicantUsername} quiere realizar tu tarea: "${publicationTitle}"`,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: `/publication.html?id=${publicationId}` } // Lleva directo a la publicación
        });
    } catch (err) {
        console.error('[EVENT-BUS] Error en PARTICIPATION_REQUESTED:', err);
    }
});

// 3. SOLICITUD ACEPTADA (Al participante)
eventBus.on('PARTICIPATION_ACCEPTED', async ({ publicationId, publicationTitle, participantId }) => {
    try {
        await notificationService.sendNotificationToUser(participantId, {
            title: '¡Solicitud Aceptada!',
            body: `Puedes comenzar la tarea: "${publicationTitle}"`,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: `/publication.html?id=${publicationId}` }
        });
    } catch (err) {
        console.error('[EVENT-BUS] Error en PARTICIPATION_ACCEPTED:', err);
    }
});

// 4. TAREA COMPLETADA/ENTREGADA (Al dueño, para que revise)
eventBus.on('TASK_DELIVERED', async ({ publicationId, publicationTitle, ownerId, participantUsername }) => {
    try {
        await notificationService.sendNotificationToUser(ownerId, {
            title: 'Tarea Entregada',
            body: `${participantUsername} ha marcado "${publicationTitle}" como completada. ¡Revisa y paga!`,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: `/publication.html?id=${publicationId}` }
        });
    } catch (err) {
        console.error('[EVENT-BUS] Error en TASK_DELIVERED:', err);
    }
});

// 5. TAREA PAGADA (Al participante)
eventBus.on('TASK_PAID', async ({ publicationId, publicationTitle, participantId, amount }) => {
    try {
        await notificationService.sendNotificationToUser(participantId, {
            title: '¡Pago Recibido!',
            body: `Has recibido ${amount} BLUE por la tarea "${publicationTitle}".`,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: '/contract_interaction.html' } // Lleva a la billetera/historial
        });
    } catch (err) {
        console.error('[EVENT-BUS] Error en TASK_PAID:', err);
    }
});

// 6. MENSAJE P2P / CHAT (Al receptor)
eventBus.on('P2P_MESSAGE_RECEIVED', async ({ orderId, receiverId, senderUsername, messagePreview }) => {
    try {
        await notificationService.sendNotificationToUser(receiverId, {
            title: `Mensaje de ${senderUsername}`,
            body: messagePreview || 'Tienes un nuevo mensaje en la orden P2P.',
            icon: '/assets/icons/icon-192x192.png',
            data: { url: `/p2p/orders/${orderId}` } // ¡Importante! URL dinámica a la orden específica (si soportas rutas así en frontend)
            // Si tu frontend usa HashRouter o Query params: data: { url: `/p2p-order.html?id=${orderId}` }
        });
    } catch (err) {
        console.error('[EVENT-BUS] Error en P2P_MESSAGE_RECEIVED:', err);
    }
});

// 7. SEGURIDAD: NUEVO LOGIN (Al usuario)
eventBus.on('SECURITY_LOGIN_ALERT', async ({ userId, ip, device }) => {
    // Implementar lógica para no spammear (ej: solo si es IP nueva)
    // Por ahora, simple alerta
    try {
        await notificationService.sendNotificationToUser(userId, {
            title: 'Nuevo Inicio de Sesión',
            body: `Detectamos un acceso desde ${device} (${ip}). Si no fuiste tú, revisa tu seguridad.`,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: '/profile.html' }
        });
    } catch (err) {
        console.error('[EVENT-BUS] Error en SECURITY_LOGIN_ALERT:', err);
    }
});

// 8. P2P: ORDEN CREADA (A los usuarios relevantes o "Makers" que coincidan - Lógica avanzada para futuro)
// eventBus.on('P2P_ORDER_CREATED', ...);

// 9. P2P: ORDEN TOMADA/MATCH (Al creador de la orden)
eventBus.on('P2P_ORDER_TAKEN', async ({ orderId, ownerId, takerUsername, type }) => {
    const action = type === 'buy' ? 'comprar tus' : 'venderte';
    try {
        await notificationService.sendNotificationToUser(ownerId, {
            title: 'Orden P2P Actualizada',
            body: `${takerUsername} quiere ${action} BLUE. Revisa la orden #${orderId}.`,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: `/p2p-order.html?id=${orderId}` } // Ajustar a tu ruta real
        });
    } catch (err) {
        console.error('[EVENT-BUS] Error en P2P_ORDER_TAKEN:', err);
    }
});


// ════════════════════════════════════════════════════════════════════════════
// GOBERNANZA: Eventos del sistema Winton-Consensus
// Notificación redundante (Push) a todos los guardianes relevantes.
// ════════════════════════════════════════════════════════════════════════════

// 10. GOBERNANZA: Nueva solicitud creada → Push + Email a TODOS los guardianes
eventBus.on('GOV_REQUEST_CREATED', async ({ requestId, description, actionType, requesterId, requesterUsername, guardianUserIds }) => {
    const actionLabel = actionType === 'config_change' ? 'Cambio de Configuración' : 'Cambio de Membresía';
    const panelUrl = _getGovernancePanelUrl(requestId);
    const dispatchRef = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : crypto.randomBytes(16).toString('hex');

    const [emails, recentChanges] = await Promise.all([
        _getUsersEmails(guardianUserIds).catch(() => []),
        _getRecentConfigChanges(5),
    ]);
    const votingGuardianCount = guardianUserIds.filter(id => Number(id) !== Number(requesterId)).length;
    const recipientsPreview = emails
        .map(row => _maskEmail(row.email))
        .filter(Boolean)
        .slice(0, 3)
        .join(', ');

    await logAuditEvent(pool, null, {
        eventType: 'GOV_REQUEST_NOTIFICATION_DISPATCHED',
        actorId: requesterId,
        actorUsername: requesterUsername,
        category: 'GOVERNANCE',
        metadata: {
            requestId,
            dispatchRef,
            requesterIncluded: true,
            intendedRecipients: guardianUserIds,
            recipientCount: guardianUserIds.length,
            recipientEmailCount: emails.length,
            votingGuardianCount,
        },
    });

    for (const userId of guardianUserIds) {
        const isRequester = Number(userId) === Number(requesterId);
        const pushTitle = isRequester
            ? `📝 Solicitud de Gobernanza #${requestId} Creada`
            : `🔐 Solicitud de Gobernanza #${requestId}`;
        const pushBody = isRequester
            ? `Tu solicitud de ${actionLabel} fue creada y distribuida a los guardianes activos para revisión.`
            : `${requesterUsername} propone: ${actionLabel}. "${description}". Tienes 24h para votar.`;

        try {
            await notificationService.sendNotificationToUser(userId, {
                title: pushTitle,
                body: pushBody,
                icon: '/assets/icons/icon-192x192.png',
                data: { url: panelUrl }
            }, 'GOVERNANCE');
        } catch (err) {
            console.error(`[EVENT-BUS] Error push guardián ${userId} GOV_REQUEST:`, err);
        }

        const userEmail = emails.find(e => e.id === userId)?.email;
        if (userEmail) {
            sendGovernanceEmail({
                toEmail: userEmail,
                subject: isRequester
                    ? `Solicitud de Gobernanza #${requestId} — Creada y distribuida`
                    : `Solicitud de Gobernanza #${requestId} — Voto requerido`,
                title: isRequester
                    ? `Solicitud Creada: ${actionLabel}`
                    : `Nueva Solicitud: ${actionLabel}`,
                body: isRequester
                    ? `Tu solicitud fue registrada correctamente y distribuida a los guardianes activos. Recuerda que, por el principio Maker ≠ Checker, tú no participas en la votación de esta solicitud.`
                    : `${requesterUsername} ha creado una solicitud que requiere tu voto. Tienes 24 horas para votar.`,
                actionUrl: panelUrl,
                actionText: isRequester ? 'Ver Estado de la Solicitud' : 'Votar Ahora',
                details: [
                    { label: 'Solicitud', value: `#${requestId}` },
                    { label: 'Tipo', value: actionLabel },
                    { label: 'Descripción', value: description },
                    ...(isRequester ? [
                        { label: 'Guardianes con voto notificados', value: String(votingGuardianCount) },
                        { label: 'Correos emitidos', value: String(emails.length) },
                        { label: 'Vista parcial destinatarios', value: recipientsPreview || 'No disponible' },
                        { label: 'Referencia de distribución', value: dispatchRef },
                    ] : []),
                ],
                severity: isRequester ? 'info' : 'warning',
                recentChanges,
            }).catch(err => console.error(`[EVENT-BUS] Error email guardián ${userId} GOV_REQUEST:`, err));
        }
    }
});

// 11. GOBERNANZA: Voto registrado → Push + Email al proponente y guardianes pendientes
eventBus.on('GOV_VOTE_SUBMITTED', async ({ requestId, voterUsername, vote, requesterId, pendingGuardianIds }) => {
    const voteLabel = vote === 'approve' ? 'APROBÓ' : 'RECHAZÓ';
    const panelUrl = _getGovernancePanelUrl(requestId);

    try {
        await notificationService.sendNotificationToUser(requesterId, {
            title: `Voto en Solicitud #${requestId}`,
            body: `${voterUsername} ${voteLabel} tu solicitud de gobernanza.`,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: panelUrl }
        }, 'GOVERNANCE');
    } catch (err) {
        console.error('[EVENT-BUS] Error push proponente voto:', err);
    }

    const requesterEmail = await _getUserEmail(requesterId).catch(() => null);
    if (requesterEmail) {
        sendGovernanceEmail({
            toEmail: requesterEmail,
            subject: `Voto registrado en Solicitud #${requestId}`,
            title: `${voterUsername} ${voteLabel} tu solicitud`,
            body: `Se ha registrado un voto en tu solicitud de gobernanza #${requestId}.`,
            actionUrl: panelUrl,
            details: [
                { label: 'Solicitud', value: `#${requestId}` },
                { label: 'Votante', value: voterUsername },
                { label: 'Decisión', value: vote === 'approve' ? 'Aprobación' : 'Rechazo' },
            ],
            severity: 'info',
        }).catch(err => console.error('[EVENT-BUS] Error email proponente voto:', err));
    }

    const pendingEmails = await _getUsersEmails(pendingGuardianIds || []).catch(() => []);
    for (const userId of (pendingGuardianIds || [])) {
        try {
            await notificationService.sendNotificationToUser(userId, {
                title: `Actividad en Solicitud #${requestId}`,
                body: `${voterUsername} ya votó. Tu voto aún está pendiente.`,
                icon: '/assets/icons/icon-192x192.png',
                data: { url: panelUrl }
            }, 'GOVERNANCE');
        } catch (err) {
            console.error(`[EVENT-BUS] Error push guardián pendiente ${userId}:`, err);
        }

        const userEmail = pendingEmails.find(e => e.id === userId)?.email;
        if (userEmail) {
            sendGovernanceEmail({
                toEmail: userEmail,
                subject: `Solicitud #${requestId} — Tu voto está pendiente`,
                title: 'Tu voto es necesario',
                body: `${voterUsername} ya emitió su voto. Tu voto aún está pendiente para alcanzar quórum.`,
                actionUrl: panelUrl,
                actionText: 'Votar Ahora',
                details: [{ label: 'Solicitud', value: `#${requestId}` }],
                severity: 'warning',
            }).catch(err => console.error(`[EVENT-BUS] Error email guardián pendiente ${userId}:`, err));
        }
    }
});

// 12. GOBERNANZA: Solicitud aprobada con Time-Lock → Push + Email a TODOS
eventBus.on('GOV_REQUEST_APPROVED', async ({ requestId, executionTime, guardianUserIds }) => {
    const execDate = new Date(executionTime).toLocaleString('es-ES', { timeZone: 'America/Bogota' });
    const panelUrl = _getGovernancePanelUrl(requestId);

    const [emails, recentChanges] = await Promise.all([
        _getUsersEmails(guardianUserIds).catch(() => []),
        _getRecentConfigChanges(5),
    ]);

    for (const userId of guardianUserIds) {
        try {
            await notificationService.sendNotificationToUser(userId, {
                title: `✅ Solicitud #${requestId} Aprobada`,
                body: `Quórum alcanzado. Ejecución programada: ${execDate}. Puedes cancelar durante la ventana de Time-Lock.`,
                icon: '/assets/icons/icon-192x192.png',
                data: { url: panelUrl }
            }, 'GOVERNANCE');
        } catch (err) {
            console.error(`[EVENT-BUS] Error push aprobación ${userId}:`, err);
        }

        const userEmail = emails.find(e => e.id === userId)?.email;
        if (userEmail) {
            sendGovernanceEmail({
                toEmail: userEmail,
                subject: `Solicitud #${requestId} Aprobada — Time-Lock activo`,
                title: 'Solicitud Aprobada',
                body: 'El quórum de aprobación ha sido alcanzado. La acción se ejecutará después del período de Time-Lock. Cualquier guardián puede cancelar durante esta ventana.',
                actionUrl: panelUrl,
                details: [
                    { label: 'Solicitud', value: `#${requestId}` },
                    { label: 'Ejecución programada', value: execDate },
                ],
                severity: 'success',
                recentChanges,
            }).catch(err => console.error(`[EVENT-BUS] Error email aprobación ${userId}:`, err));
        }
    }
});

// 13. GOBERNANZA: Solicitud ejecutada → Push + Email a TODOS
eventBus.on('GOV_REQUEST_EXECUTED', async ({ requestId, actionType, targetKey, guardianUserIds }) => {
    const actionLabel = actionType === 'config_change' ? 'Configuración' : 'Membresía';
    const panelUrl = _getGovernancePanelUrl(requestId);

    const [emails, recentChanges] = await Promise.all([
        _getUsersEmails(guardianUserIds).catch(() => []),
        _getRecentConfigChanges(5),
    ]);

    for (const userId of guardianUserIds) {
        try {
            await notificationService.sendNotificationToUser(userId, {
                title: `⚡ Cambio Ejecutado — Solicitud #${requestId}`,
                body: `${actionLabel} actualizada: ${targetKey || 'ver detalle'}.`,
                icon: '/assets/icons/icon-192x192.png',
                data: { url: panelUrl }
            }, 'GOVERNANCE');
        } catch (err) {
            console.error(`[EVENT-BUS] Error push ejecución ${userId}:`, err);
        }

        const userEmail = emails.find(e => e.id === userId)?.email;
        if (userEmail) {
            sendGovernanceEmail({
                toEmail: userEmail,
                subject: `Cambio Ejecutado — Solicitud #${requestId}`,
                title: 'Cambio de Gobernanza Aplicado',
                body: `La solicitud #${requestId} ha sido ejecutada exitosamente. El cambio ya está activo en el sistema.`,
                actionUrl: panelUrl,
                details: [
                    { label: 'Solicitud', value: `#${requestId}` },
                    { label: 'Tipo', value: actionLabel },
                    { label: 'Clave', value: targetKey || 'N/A' },
                ],
                severity: 'success',
                recentChanges,
            }).catch(err => console.error(`[EVENT-BUS] Error email ejecución ${userId}:`, err));
        }
    }
});

// 14. GOBERNANZA: Recordatorio de voto pendiente (llamado por cron) → Push + Email
eventBus.on('GOV_VOTE_REMINDER', async ({ requestId, description, expiresAt, guardianUserId }) => {
    const hoursLeft = Math.round((new Date(expiresAt) - new Date()) / (1000 * 60 * 60));
    const panelUrl = _getGovernancePanelUrl(requestId);

    try {
        await notificationService.sendNotificationToUser(guardianUserId, {
            title: `⏰ Recordatorio: Voto pendiente #${requestId}`,
            body: `"${description}" expira en ~${hoursLeft}h. Tu voto es necesario para alcanzar quórum.`,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: panelUrl }
        }, 'GOVERNANCE');
    } catch (err) {
        console.error(`[EVENT-BUS] Error push recordatorio ${guardianUserId}:`, err);
    }

    const userEmail = await _getUserEmail(guardianUserId).catch(() => null);
    if (userEmail) {
        sendGovernanceEmail({
            toEmail: userEmail,
            subject: `Recordatorio: Voto pendiente — Solicitud #${requestId}`,
            title: 'Voto Pendiente',
            body: `La solicitud "${description}" expira en aproximadamente ${hoursLeft} horas. Tu voto es necesario para alcanzar quórum.`,
            actionUrl: panelUrl,
            actionText: 'Votar Ahora',
            details: [
                { label: 'Solicitud', value: `#${requestId}` },
                { label: 'Tiempo restante', value: `~${hoursLeft} horas` },
            ],
            severity: 'warning',
        }).catch(err => console.error(`[EVENT-BUS] Error email recordatorio ${guardianUserId}:`, err));
    }
});

// 15. GOBERNANZA: Solicitud rechazada → Push + Email al proponente
eventBus.on('GOV_REQUEST_REJECTED', async ({ requestId, requesterId }) => {
    const panelUrl = _getGovernancePanelUrl(requestId);

    try {
        await notificationService.sendNotificationToUser(requesterId, {
            title: `❌ Solicitud #${requestId} Rechazada`,
            body: 'El quórum de rechazo fue alcanzado. La solicitud no se ejecutará.',
            icon: '/assets/icons/icon-192x192.png',
            data: { url: panelUrl }
        }, 'GOVERNANCE');
    } catch (err) {
        console.error('[EVENT-BUS] Error push rechazo:', err);
    }

    const userEmail = await _getUserEmail(requesterId).catch(() => null);
    if (userEmail) {
        sendGovernanceEmail({
            toEmail: userEmail,
            subject: `Solicitud #${requestId} Rechazada`,
            title: 'Solicitud Rechazada',
            body: `El quórum de rechazo fue alcanzado para la solicitud #${requestId}. La acción propuesta no se ejecutará.`,
            actionUrl: panelUrl,
            details: [{ label: 'Solicitud', value: `#${requestId}` }],
            severity: 'danger',
        }).catch(err => console.error('[EVENT-BUS] Error email rechazo:', err));
    }
});

module.exports = eventBus;
