// ============================================================================
// WintonCoin — Push Notification Controller
// ============================================================================
// Maneja endpoints HTTP para suscripción, preferencias y envío manual (admin).
// Estándar Fintech: Auditoría completa, sanitización, contrato API estable.
// ============================================================================

const notificationService = require('../services/notificationService');
const auditService = require('../services/auditService');

/**
 * Sanitiza strings para prevenir XSS básico en payloads de notificación.
 * Elimina caracteres HTML peligrosos y recorta espacios.
 * @param {*} str - Valor a sanitizar
 * @returns {string} String limpio
 */
const sanitize = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').trim();
};

module.exports = function (pool) {
    return {
        /**
         * GET /api/notifications/vapid-public-key
         * Retorna la clave pública VAPID para que el frontend configure PushManager.
         * Ruta pública (no requiere autenticación).
         */
        getVapidPublicKey: (req, res) => {
            try {
                const publicKey = notificationService.getVapidPublicKey();
                res.json({ publicKey });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        },

        /**
         * POST /api/notifications/subscribe
         * Registra la suscripción push de un usuario autenticado.
         * Requiere: authenticateToken middleware.
         */
        subscribe: async (req, res) => {
            const { subscription, userAgent } = req.body;
            const userId = req.user ? req.user.userId : null;
            const username = req.user ? req.user.username : 'unknown';

            if (!userId) {
                return res.status(401).json({ error: 'Usuario no autenticado' });
            }

            try {
                await notificationService.saveSubscription(userId, subscription, userAgent || req.headers['user-agent']);

                // Auditoría: registrar cada suscripción de dispositivo
                await auditService.logAuditEvent(pool, req, {
                    eventType: 'PUSH_SUBSCRIBE',
                    actorUsername: username,
                    category: 'SECURITY',
                    metadata: { userAgent: userAgent || req.headers['user-agent'] }
                });

                res.status(201).json({ message: 'Suscripción registrada exitosamente' });
            } catch (error) {
                console.error('[NOTIFICATION CTRL] Error al guardar suscripción push:', error.message);
                res.status(500).json({ error: 'Error interno al procesar suscripción' });
            }
        },

        /**
         * GET /api/notifications/settings
         * Obtiene las preferencias de notificación del usuario autenticado.
         */
        getNotificationSettings: async (req, res) => {
            const userId = req.user.userId;
            try {
                const prefs = await notificationService.getUserPreferences(userId);
                res.json(prefs);
            } catch (error) {
                console.error('[NOTIFICATION CTRL] Error obteniendo preferencias:', error.message);
                res.status(500).json({ error: 'Error al obtener preferencias' });
            }
        },

        /**
         * PUT /api/notifications/settings
         * Actualiza las preferencias de notificación del usuario autenticado.
         *
         * Acepta DOS formatos de body (compatibilidad con frontend):
         *   Formato 1 (envuelto):  { settings: { social, marketing, governance } }
         *   Formato 2 (directo):   { social, marketing, governance }
         *
         * El servicio se encarga de forzar security=true y transactional=true.
         */
        updateNotificationSettings: async (req, res) => {
            const userId = req.user.userId;
            const username = req.user.username;

            // Aceptar ambos formatos para compatibilidad
            const settings = req.body.settings || req.body;

            try {
                const updated = await notificationService.updateUserPreferences(userId, settings);

                // Auditoría: registrar cada cambio de preferencias
                await auditService.logAuditEvent(pool, req, {
                    eventType: 'PUSH_PREFERENCES_UPDATE',
                    actorUsername: username,
                    category: 'SECURITY',
                    metadata: { new_settings: updated }
                });

                res.json({ message: 'Preferencias actualizadas', settings: updated });
            } catch (error) {
                console.error('[NOTIFICATION CTRL] Error actualizando preferencias:', error.message);
                res.status(500).json({ error: 'Error al actualizar preferencias' });
            }
        },

        /**
         * POST /api/notifications/send
         * Envío manual de push desde el panel admin.
         * Requiere: authenticateAdmin middleware.
         *
         * Soporta DOS modos de operación:
         *   1. Broadcast (sendToAll=true): Envía a TODOS los usuarios suscritos
         *   2. Individual (sendToAll=false, username="..."): Envía a un usuario específico
         *
         * Body esperado del frontend admin:
         *   { title, message, url, username?, sendToAll?, category? }
         *
         * NOTA HISTÓRICA: Antes el backend esperaba `body` pero el frontend enviaba
         * `message`. Ahora se acepta ambos para compatibilidad total.
         */
        sendPush: async (req, res) => {
            // Aceptar tanto `body` como `message` del frontend (compatibilidad)
            const { title, body: bodyField, message: messageField, icon, url, category, sendToAll, username } = req.body;

            // El contenido del mensaje puede venir como `body` o `message`
            const messageContent = bodyField || messageField;

            // Validación de campos requeridos
            if (!title || !messageContent) {
                return res.status(400).json({ success: false, error: 'Título y mensaje son requeridos' });
            }

            // Defensa en profundidad: si no es broadcast, username es obligatorio
            // El frontend ya valida esto, pero el backend no debe confiar en validaciones del cliente
            const trimmedUsername = username ? String(username).trim() : '';
            if (!sendToAll && !trimmedUsername) {
                return res.status(400).json({ success: false, error: 'Se requiere un usuario destino o activar envío masivo' });
            }

            try {
                // Construir payload sanitizado con estructura normalizada
                const payload = {
                    title: sanitize(title),
                    body: sanitize(messageContent),
                    icon: icon || '/assets/icons/icon-192x192.png',
                    data: { url: url || '/' }
                };

                let result;

                if (sendToAll || !trimmedUsername) {
                    // MODO BROADCAST: Enviar a todos los usuarios suscritos
                    result = await notificationService.sendNotificationToAll(payload, category || 'MARKETING');

                    // Auditoría de broadcast
                    await auditService.logAuditEvent(pool, req, {
                        eventType: 'PUSH_ADMIN_BROADCAST',
                        actorUsername: req.user.username,
                        category: 'MARKETING',
                        metadata: {
                            payload_title: payload.title,
                            payload_body: payload.body,
                            notification_type: category || 'MARKETING',
                            result
                        }
                    });
                } else {
                    // MODO INDIVIDUAL: Enviar a un usuario específico por username
                    const userResult = await pool.query('SELECT id FROM users WHERE username = $1', [trimmedUsername]);

                    if (userResult.rowCount === 0) {
                        return res.status(404).json({ success: false, error: `Usuario "${trimmedUsername}" no encontrado` });
                    }

                    const targetUserId = userResult.rows[0].id;
                    result = await notificationService.sendNotificationToUser(targetUserId, payload, category || 'MARKETING');

                    // Auditoría de envío individual
                    await auditService.logAuditEvent(pool, req, {
                        eventType: 'PUSH_ADMIN_INDIVIDUAL',
                        actorUsername: req.user.username,
                        targetUsername: trimmedUsername,
                        category: 'MARKETING',
                        metadata: {
                            payload_title: payload.title,
                            payload_body: payload.body,
                            notification_type: category || 'MARKETING',
                            result
                        }
                    });
                }

                // Respuesta con formato consistente que el frontend espera
                res.json({
                    success: true,
                    message: sendToAll ? 'Broadcast enviado' : `Push enviado a ${trimmedUsername || 'todos'}`,
                    sent: result.sent,
                    failed: result.failed || 0,
                    total_active: result.total || null
                });
            } catch (error) {
                console.error('[NOTIFICATION CTRL] Error en envío manual:', error.message);
                res.status(500).json({ success: false, error: 'Error en envío de notificación' });
            }
        }
    };
};
