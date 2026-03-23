const crypto = require('crypto');
const EventEmitter = require('events');
const notificationService = require('./notificationService');
const { sendGovernanceEmail } = require('./emailService');
const { logAuditEvent } = require('./auditService');
const governanceService = require('./governanceService');
const { settingLabel } = require('../config/settingsDisplayMap');
const pool = require('../config/db');

/** Texto legible para valores JSONB / primitivos en correos de gobernanza */
function _formatGovEmailValue(raw) {
    if (raw === null || raw === undefined) return '—';
    if (typeof raw === 'boolean' || typeof raw === 'number') return String(raw);
    if (typeof raw === 'object') {
        try {
            return JSON.stringify(raw);
        } catch {
            return String(raw);
        }
    }
    const s = String(raw);
    if (s === '') return '—';
    try {
        const p = JSON.parse(s);
        if (p !== null && typeof p === 'object') return JSON.stringify(p);
        return String(p);
    } catch {
        return s;
    }
}

function _formatGovEmailDate(d) {
    if (!d) return '—';
    try {
        const dt = d instanceof Date ? d : new Date(d);
        if (Number.isNaN(dt.getTime())) return '—';
        return dt.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return '—';
    }
}

// Helper para construir URL absoluta del panel de gobernanza
// focusVote: true → ?id=&focus=vote (UX solo votación; el proponente usa sin focus)
function _getGovernancePanelUrl(requestId, opts = {}) {
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

    const q = [`id=${encodeURIComponent(String(requestId))}`];
    if (opts.focusVote) q.push('focus=vote');
    return `${baseUrl}/governance-panel.html?${q.join('&')}`;
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
                const rawKey = meta.setting_key || meta.targetKey || 'N/A';
                acc.push({
                    key: settingLabel(rawKey),
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
eventBus.on('GOV_REQUEST_CREATED', async ({
    requestId,
    description,
    actionType,
    requesterId,
    requesterUsername,
    guardianUserIds,
    targetKey = null,
    oldValue = null,
    newValue = null,
    expiresAt = null,
    createdAt = null,
    executionTime = null,
}) => {
    const dispatchRef = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : crypto.randomBytes(16).toString('hex');

    // Lectura única desde BD + correos en paralelo (fuente de verdad = lo persistido; patrón fintech)
    const [fullReq, emails, recentChanges] = await Promise.all([
        governanceService.getRequestById(pool, requestId).catch((err) => {
            console.error('[EVENT-BUS] GOV_REQUEST_CREATED getRequestById:', err.message);
            return null;
        }),
        _getUsersEmails(guardianUserIds).catch(() => []),
        _getRecentConfigChanges(5),
    ]);

    const effActionType = fullReq?.action_type || actionType;
    const actionLabel = effActionType === 'config_change' ? 'Cambio de Configuración' : 'Cambio de Membresía';
    const effDescription = (fullReq?.description != null && String(fullReq.description).trim() !== '')
        ? String(fullReq.description)
        : (description || '—');
    const effRequesterUsername = fullReq?.requester_username || requesterUsername || '—';
    const effTargetKey = fullReq?.target_key != null && fullReq.target_key !== ''
        ? fullReq.target_key
        : targetKey;
    const effOldValue = fullReq != null ? fullReq.old_value : oldValue;
    const effNewValue = fullReq != null ? fullReq.new_value : newValue;
    const effCreatedAt = fullReq?.created_at ?? createdAt;
    const effExpiresAt = fullReq?.expires_at ?? expiresAt;
    const effExecutionTime = fullReq?.execution_time ?? executionTime;

    let quorumLine = 'Consulta el panel de gobernanza para el detalle del quórum.';
    const q = fullReq?.quorum;
    if (q) {
        const supA = q.approved?.supervisor ?? 0;
        const supT = q.totals?.supervisor ?? 0;
        const th = q.thresholds?.supervisor ?? '?';
        quorumLine = `${supA} de ${supT} supervisores aprobaron (umbral: ${th})`;
    }

    const sharedEmailDetails = [
        { label: 'Solicitud', value: `#${requestId}` },
        { label: 'Tipo', value: actionLabel },
        { label: 'Proponente', value: effRequesterUsername },
        { label: 'Descripción', value: effDescription },
    ];
    const readableTargetKey = effTargetKey ? settingLabel(effTargetKey) : null;
    if (effActionType === 'config_change' && readableTargetKey) {
        sharedEmailDetails.push({ label: 'Configuración', value: readableTargetKey });
    }
    const oldStr = _formatGovEmailValue(effOldValue);
    const newStr = _formatGovEmailValue(effNewValue);
    if (effActionType === 'membership_change') {
        if (newStr !== '—') {
            sharedEmailDetails.push({ label: 'Cambio propuesto (membresía)', value: newStr });
        }
    } else {
        if (oldStr !== '—') {
            sharedEmailDetails.push({ label: 'Valor anterior', value: oldStr });
        }
        if (newStr !== '—') {
            sharedEmailDetails.push({ label: 'Valor propuesto', value: newStr });
        }
    }
    sharedEmailDetails.push(
        { label: 'Creada', value: _formatGovEmailDate(effCreatedAt) },
        { label: 'Expira', value: _formatGovEmailDate(effExpiresAt) },
        { label: 'Quórum de supervisores', value: quorumLine },
    );
    if (effExecutionTime) {
        sharedEmailDetails.push({
            label: 'Ejecución programada (si se aprueba)',
            value: _formatGovEmailDate(effExecutionTime),
        });
    }
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
        const panelUrl = isRequester
            ? _getGovernancePanelUrl(requestId)
            : _getGovernancePanelUrl(requestId, { focusVote: true });
        const pushTitle = isRequester
            ? `📝 Solicitud de Gobernanza #${requestId} Creada`
            : `🔐 Solicitud de Gobernanza #${requestId}`;
        const pushSnippet = readableTargetKey ? ` · ${readableTargetKey}` : '';
        const pushBody = isRequester
            ? `Tu solicitud de ${actionLabel} fue creada y distribuida a los guardianes activos para revisión.`
            : `${effRequesterUsername} propone: ${actionLabel}${pushSnippet}. Revisa el correo para el detalle y vota en el panel.`;

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
                    : `${effRequesterUsername} ha creado una solicitud que requiere tu voto. Revisa los detalles a continuación y emite tu decisión antes de la fecha de expiración indicada.`,
                actionUrl: panelUrl,
                actionText: isRequester ? 'Ver Estado de la Solicitud' : 'Votar Ahora',
                details: [
                    ...sharedEmailDetails,
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
    const panelUrlRequester = _getGovernancePanelUrl(requestId);
    const panelUrlVoterFocus = _getGovernancePanelUrl(requestId, { focusVote: true });

    try {
        await notificationService.sendNotificationToUser(requesterId, {
            title: `Voto en Solicitud #${requestId}`,
            body: `${voterUsername} ${voteLabel} tu solicitud de gobernanza.`,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: panelUrlRequester }
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
            actionUrl: panelUrlRequester,
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
                data: { url: panelUrlVoterFocus }
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
                actionUrl: panelUrlVoterFocus,
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
    const actionLabelExec = actionType === 'config_change' ? 'Configuración' : 'Membresía';
    const readableKey = targetKey ? settingLabel(targetKey) : 'ver detalle';

    const [emails, recentChanges] = await Promise.all([
        _getUsersEmails(guardianUserIds).catch(() => []),
        _getRecentConfigChanges(5),
    ]);

    for (const userId of guardianUserIds) {
        try {
            await notificationService.sendNotificationToUser(userId, {
                title: `⚡ Cambio Ejecutado — Solicitud #${requestId}`,
                body: `${actionLabelExec} actualizada: ${readableKey}.`,
                icon: '/assets/icons/icon-192x192.png',
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
                details: [
                    { label: 'Solicitud', value: `#${requestId}` },
                    { label: 'Tipo', value: actionLabelExec },
                    { label: 'Configuración', value: readableKey },
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
    const panelUrl = _getGovernancePanelUrl(requestId, { focusVote: true });

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
    try {
        await notificationService.sendNotificationToUser(requesterId, {
            title: `❌ Solicitud #${requestId} Rechazada`,
            body: 'El quórum de rechazo fue alcanzado. La solicitud no se ejecutará.',
            icon: '/assets/icons/icon-192x192.png',
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
            details: [{ label: 'Solicitud', value: `#${requestId}` }],
            severity: 'danger',
        }).catch(err => console.error('[EVENT-BUS] Error email rechazo:', err));
    }
});

// 16. GOBERNANZA: Guardián incorporado → Email + Push de bienvenida al nuevo guardián
eventBus.on('GOV_GUARDIAN_ONBOARDED', async ({ userId, role, appointedByUsername, requestId }) => {
    const roleLabel = role === 'supervisor' ? 'Supervisor' : 'Auxiliar';

    try {
        await notificationService.sendNotificationToUser(userId, {
            title: '🛡️ Bienvenido al Consejo de Guardianes',
            body: `Has sido designado como ${roleLabel} en el sistema Winton-Consensus.`,
            icon: '/assets/icons/icon-192x192.png',
            data: {}
        }, 'GOVERNANCE');
    } catch (err) {
        console.error(`[EVENT-BUS] Error push onboarding guardián ${userId}:`, err);
    }

    const userEmail = await _getUserEmail(userId).catch(() => null);
    if (userEmail) {
        sendGovernanceEmail({
            toEmail: userEmail,
            subject: 'Bienvenido al Consejo de Guardianes — WintonCoin',
            title: `Has sido designado como ${roleLabel}`,
            body:
                `El Consejo de Guardianes de WintonCoin ha aprobado tu incorporación como ${roleLabel} ` +
                `en el sistema de gobernanza Winton-Consensus (solicitud #${requestId}).\n\n` +
                `Esta designación fue propuesta por ${appointedByUsername} y ratificada mediante votación del consejo.`,
            details: [
                { label: 'Rol asignado', value: roleLabel },
                { label: 'Solicitud de referencia', value: `#${requestId}` },
                { label: 'Designado por', value: appointedByUsername },
                { label: '¿Qué es un Guardián?', value: 'Los guardianes son responsables de aprobar o rechazar cambios críticos en la plataforma mediante votación.' },
                { label: 'Tus responsabilidades', value: role === 'supervisor'
                    ? 'Revisar y votar solicitudes de configuración y membresía. Tu voto cuenta para el quórum de aprobación.'
                    : 'Revisar y votar solicitudes de membresía. Complementas el quórum junto a los supervisores.' },
                { label: 'Principio Maker ≠ Checker', value: 'Quien propone un cambio no puede votar sobre su propia solicitud. Esto garantiza control cruzado.' },
                { label: '¿Dudas?', value: 'Comunícate con el equipo de WintonCoin para cualquier consulta sobre tu rol o el proceso de gobernanza.' },
            ],
            severity: 'success',
        }).catch(err => console.error(`[EVENT-BUS] Error email onboarding guardián ${userId}:`, err));
    }

    await logAuditEvent(pool, null, {
        eventType: 'GOV_GUARDIAN_ONBOARDED',
        actorUsername: 'system',
        category: 'GOVERNANCE',
        metadata: { userId, role, appointedByUsername, requestId },
    }).catch(() => {});
});

// 17. GOBERNANZA: Guardián desvinculado → Email + Push de notificación
eventBus.on('GOV_GUARDIAN_REMOVED', async ({ userId, previousRole, removedByUsername, requestId }) => {
    const roleLabel = previousRole === 'supervisor' ? 'Supervisor' : 'Auxiliar';

    try {
        await notificationService.sendNotificationToUser(userId, {
            title: '🔓 Desvinculación del Consejo de Guardianes',
            body: `Tu rol como ${roleLabel} en Winton-Consensus ha finalizado.`,
            icon: '/assets/icons/icon-192x192.png',
            data: {}
        }, 'GOVERNANCE');
    } catch (err) {
        console.error(`[EVENT-BUS] Error push offboarding guardián ${userId}:`, err);
    }

    const userEmail = await _getUserEmail(userId).catch(() => null);
    if (userEmail) {
        sendGovernanceEmail({
            toEmail: userEmail,
            subject: 'Desvinculación del Consejo de Guardianes — WintonCoin',
            title: 'Tu rol de guardián ha finalizado',
            body:
                `Te informamos que tu participación como ${roleLabel} en el sistema de gobernanza ` +
                `Winton-Consensus ha sido finalizada mediante la solicitud #${requestId}.\n\n` +
                `Esta decisión fue aprobada por el Consejo de Guardianes tras votación.`,
            details: [
                { label: 'Rol anterior', value: roleLabel },
                { label: 'Solicitud de referencia', value: `#${requestId}` },
                { label: 'Solicitado por', value: removedByUsername },
                { label: '¿Qué significa?', value: 'Ya no recibirás solicitudes de votación ni tendrás acceso al panel de gobernanza.' },
                { label: 'Tu cuenta', value: 'Tu cuenta de usuario en WintonCoin sigue activa con normalidad. Solo se desvinculó el rol de guardián.' },
                { label: '¿Dudas?', value: 'Comunícate con el equipo de WintonCoin si tienes preguntas sobre esta decisión.' },
            ],
            severity: 'warning',
        }).catch(err => console.error(`[EVENT-BUS] Error email offboarding guardián ${userId}:`, err));
    }

    await logAuditEvent(pool, null, {
        eventType: 'GOV_GUARDIAN_REMOVED',
        actorUsername: 'system',
        category: 'GOVERNANCE',
        metadata: { userId, previousRole, removedByUsername, requestId },
    }).catch(() => {});
});

module.exports = eventBus;
