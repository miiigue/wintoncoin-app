const notificationService = require('../services/notificationService');
const auditService = require('../services/auditService');

/**
 * Utilidad mínima para sanear strings y evitar inyecciones básicas (XSS prevention)
 */
const sanitize = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').trim();
};

module.exports = function (pool) {
    return {
        /**
         * Retorna la clave pública VAPID
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
         * Registra una suscripción de un usuario
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

                // AUDITORÍA
                await auditService.logAuditEvent(pool, req, {
                    eventType: 'PUSH_SUBSCRIBE',
                    actorUsername: username,
                    category: 'SECURITY',
                    metadata: { userAgent: userAgent || req.headers['user-agent'] }
                });

                res.status(201).json({ message: 'Suscripción registrada exitosamente' });
            } catch (error) {
                console.error('Error al guardar suscripción push:', error);
                res.status(500).json({ error: 'Error interno al procesar suscripción' });
            }
        },

        /**
         * Obtiene preferencias del usuario
         */
        getNotificationSettings: async (req, res) => {
            const userId = req.user.userId;
            try {
                const prefs = await notificationService.getUserPreferences(userId);
                res.json(prefs);
            } catch (error) {
                res.status(500).json({ error: 'Error al obtener preferencias' });
            }
        },

        /**
         * Actualiza preferencias
         */
        updateNotificationSettings: async (req, res) => {
            const userId = req.user.userId;
            const username = req.user.username;
            const { settings } = req.body;

            try {
                const updated = await notificationService.updateUserPreferences(userId, settings);

                // AUDITORÍA
                await auditService.logAuditEvent(pool, req, {
                    eventType: 'PUSH_PREFERENCES_UPDATE',
                    actorUsername: username,
                    category: 'SECURITY',
                    metadata: { new_settings: updated }
                });

                res.json({ message: 'Preferencias actualizadas', settings: updated });
            } catch (error) {
                res.status(500).json({ error: 'Error al actualizar preferencias' });
            }
        },

        /**
         * Envío manual (Admin)
         */
        sendPush: async (req, res) => {
            const { title, body, icon, url, category } = req.body;

            if (!title || !body) {
                return res.status(400).json({ error: 'Título y cuerpo requeridos' });
            }

            try {
                const payload = {
                    title: sanitize(title),
                    body: sanitize(body),
                    icon: icon || '/assets/icons/icon-192x192.png',
                    data: { url: url || '/' }
                };

                const result = await notificationService.sendNotificationToAll(payload, category || 'SOCIAL');

                // AUDITORÍA
                await auditService.logAuditEvent(pool, req, {
                    eventType: 'PUSH_ADMIN_BROADCAST',
                    actorUsername: req.user.username,
                    category: 'MARKETING',
                    metadata: { payload, result }
                });

                res.json({ message: 'Envío masivo iniciado', result });
            } catch (error) {
                res.status(500).json({ error: 'Error en envío masivo' });
            }
        }
    };
};
