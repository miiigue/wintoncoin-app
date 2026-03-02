const webpush = require('web-push');
const pool = require('../config/db');

// Configuración inicial de Web Push
function initializeWebPush() {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        console.error('ALERTA: Claves VAPID no configuradas en .env');
        return;
    }
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@wintoncoin.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

// Inicializar al cargar el módulo
initializeWebPush();

/**
 * Obtiene la clave pública VAPID
 */
const getVapidPublicKey = () => {
    if (!process.env.VAPID_PUBLIC_KEY) {
        throw new Error('Servidor no configurado para notificaciones push');
    }
    return process.env.VAPID_PUBLIC_KEY;
};

/**
 * Guarda o actualiza la suscripción de un usuario
 */
const saveSubscription = async (userId, subscription, userAgent) => {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
        throw new Error('Objeto de suscripción inválido');
    }

    const { endpoint, keys } = subscription;

    const query = `
        INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth, user_agent)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (endpoint) 
        DO UPDATE SET 
            user_id = EXCLUDED.user_id, 
            keys_p256dh = EXCLUDED.keys_p256dh, 
            keys_auth = EXCLUDED.keys_auth,
            created_at = CURRENT_TIMESTAMP
        RETURNING id
    `;

    try {
        await pool.query(query, [
            userId,
            endpoint,
            keys.p256dh,
            keys.auth,
            userAgent
        ]);
        return { success: true };
    } catch (error) {
        console.error('Error al guardar suscripción en DB:', error);
        throw new Error('Error de base de datos');
    }
};

/**
 * Envía una notificación a un usuario específico
 */
const sendNotificationToUser = async (userId, payload, type = 'SOCIAL') => {
    try {
        const query = `
            SELECT ps.*, u.notification_preferences, u.username 
            FROM push_subscriptions ps
            JOIN users u ON ps.user_id = u.id
            WHERE ps.user_id = $1
        `;
        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            return { sent: 0, failed: 0, message: 'Usuario sin dispositivos suscritos' };
        }

        const userPrefs = result.rows[0].notification_preferences || {};
        const typeKey = type.toLowerCase();

        if (type !== 'SECURITY' && userPrefs[typeKey] === false) {
            console.log(`[PUSH] Notificación ${type} bloqueada por usuario ${userId}`);
            return { sent: 0, message: 'Filtro de preferencias activo' };
        }

        const notifications = result.rows.map(sub => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth }
            };

            return webpush.sendNotification(pushSubscription, JSON.stringify(payload))
                .catch(err => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        return pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
                    }
                    console.error('Error en envío individual push:', err.message);
                });
        });

        await Promise.allSettled(notifications);
        return { sent: notifications.length };

    } catch (error) {
        console.error('Error enviando notificación push:', error);
        return { sent: 0, error: error.message };
    }
};

/**
 * Envía una notificación masiva (Broadcast) con LOGS DE DIAGNÓSTICO PROFESIONALES
 */
const sendNotificationToAll = async (payload, type = 'SOCIAL', batchSize = 50) => {
    try {
        console.log(`[PUSH DIAGNOSTIC] 📡 Iniciando broadcast masivo. Tipo: ${type}`);
        
        let query = 'SELECT ps.* FROM push_subscriptions ps JOIN users u ON ps.user_id = u.id';
        if (type !== 'SECURITY') {
            const typeKey = type.toLowerCase();
            query += ` WHERE COALESCE((u.notification_preferences->>'${typeKey}')::boolean, TRUE) = TRUE`;
        }

        const result = await pool.query(query);
        const total = result.rows.length;

        console.log(`[PUSH DIAGNOSTIC] 👥 Usuarios encontrados para enviar: ${total}`);

        if (total === 0) return { sent: 0 };

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < total; i += batchSize) {
            const chunk = result.rows.slice(i, i + batchSize);
            const promises = chunk.map(async (sub) => {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth }
                };

                try {
                    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
                    successCount++;
                } catch (err) {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
                    }
                    failCount++;
                }
            });

            await Promise.all(promises);
            console.log(`[PUSH DIAGNOSTIC] 📦 Lote procesado. Éxitos acumulados: ${successCount}`);
        }

        console.log(`[PUSH DIAGNOSTIC] ✅ Broadcast finalizado. TOTAL EXITOS: ${successCount}, FALLOS: ${failCount}`);
        return { sent: successCount, failed: failCount };

    } catch (error) {
        console.error('[PUSH DIAGNOSTIC CRITICAL ERROR]', error);
        throw error;
    }
};

const getUserPreferences = async (userId) => {
    const result = await pool.query('SELECT notification_preferences FROM users WHERE id = $1', [userId]);
    return result.rows[0]?.notification_preferences || { security: true, social: true, marketing: true };
};

const updateUserPreferences = async (userId, newPrefs) => {
    const cleanPrefs = { ...newPrefs, security: true }; // Seguridad inmutable
    await pool.query('UPDATE users SET notification_preferences = $1 WHERE id = $2', [cleanPrefs, userId]);
    return cleanPrefs;
};

module.exports = {
    getVapidPublicKey,
    saveSubscription,
    getUserPreferences,
    updateUserPreferences,
    sendNotificationToUser,
    sendNotificationToAll
};
