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
 * @param {number} userId - ID del usuario
 * @param {object} subscription - Objeto de suscripción del navegador
 * @param {string} userAgent - User agent del dispositivo
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
 * @param {number} userId - ID del usuario destino
 * @param {object} payload - { title, body, icon, url, ... }
 */
/**
 * Envía una notificación a un usuario específico respetando sus preferencias
 * @param {number} userId - ID del usuario destino
 * @param {object} payload - { title, body, icon, url, ... }
 * @param {string} type - Tipo de notificación: 'SECURITY', 'SOCIAL', 'MARKETING', 'TRANSACTIONAL'. Default: 'SOCIAL'
 */
const sendNotificationToUser = async (userId, payload, type = 'SOCIAL') => {
    try {
        // 1. Obtener suscripciones Y preferencias del usuario
        // Hacemos JOIN para no hacer dos queries
        const query = `
            SELECT ps.*, u.notification_preferences 
            FROM push_subscriptions ps
            JOIN users u ON ps.user_id = u.id
            WHERE ps.user_id = $1
        `;
        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            return { sent: 0, failed: 0, message: 'Usuario sin dispositivos suscritos o no encontrado' };
        }

        // 2. Verificar Preferencias
        // SECURITY siempre pasa. Las demás dependen del JSONB.
        const userPrefs = result.rows[0].notification_preferences || {}; // Por defecto vacío si es null

        // Mapeo de tipos a claves del JSON
        // SECURITY -> security (pero siempre es true implícitamente)
        // SOCIAL -> social
        // MARKETING -> marketing
        // TRANSACTIONAL -> transactional (generalmente true por default)

        const typeKey = type.toLowerCase();

        // Si no es seguridad Y el usuario lo tiene desactivado explícitamente -> NO ENVIAR
        if (type !== 'SECURITY' && userPrefs[typeKey] === false) {
            console.log(`[PUSH] Notificación ${type} bloqueada por preferencia de usuario ${userId}`);
            return { sent: 0, message: 'Usuario tiene desactivada esta categoría' };
        }

        // 3. Enviar a cada dispositivo en paralelo
        const notifications = result.rows.map(sub => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.keys_p256dh,
                    auth: sub.keys_auth
                }
            };

            return webpush.sendNotification(pushSubscription, JSON.stringify(payload))
                .catch(err => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        console.log(`[PUSH] Eliminando suscripción inactiva: ${sub.id}`);
                        return pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
                    }
                    console.error('[PUSH] Error enviando:', err);
                    throw err;
                });
        });

        await Promise.allSettled(notifications);
        return { sent: notifications.length, message: 'Notificaciones enviadas' };

    } catch (error) {
        console.error('Error en servicio de notificaciones:', error);
        return { sent: 0, error: error.message };
    }
};

/**
 * Envía una notificación masiva (Broadcast).
 * @param {object} payload 
 * @param {string} type - 'MARKETING' (default) o 'SECURITY' (importante)
 */
const sendNotificationToAll = async (payload, type = 'MARKETING') => {
    try {
        console.log(`[PUSH BROADCAST] Iniciando envío masivo (${type})...`);

        // Optimización: Traemos solo los usuarios que aceptan este tipo de notificaciones
        // Si es SECURITY, traemos todos.
        // Si es MARKETING, filtramos por JSONB.

        let query = 'SELECT ps.* FROM push_subscriptions ps JOIN users u ON ps.user_id = u.id';

        if (type !== 'SECURITY') {
            const typeKey = type.toLowerCase();
            // Postgres JSONB query: u.notification_preferences->>'marketing' != 'false' 
            // (Asumimos true si es null o no existe)
            query += ` WHERE COALESCE((u.notification_preferences->>'${typeKey}')::boolean, TRUE) = TRUE`;
        }

        const result = await pool.query(query);

        if (result.rows.length === 0) {
            return { sent: 0, message: 'No hay usuarios suscritos disponibles para esta categoría' };
        }

        console.log(`[PUSH BROADCAST] Encontrados ${result.rows.length} dispositivos para notificar.`);

        let successCount = 0;
        let failureCount = 0;

        const promises = result.rows.map(async (sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.keys_p256dh,
                    auth: sub.keys_auth
                }
            };

            try {
                await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
                successCount++;
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
                } else {
                    console.error(`[PUSH FAIL] ID Subscripción ${sub.id}:`, err.message);
                }
                failureCount++;
            }
        });

        await Promise.all(promises);

        return {
            sent: successCount,
            failed: failureCount,
            total_active: result.rows.length,
            message: `Difusión completada. Éxito: ${successCount}, Fallos/Limpieza: ${failureCount}`
        };

    } catch (error) {
        console.error('[PUSH BROADCAST ERROR]', error);
        return { sent: 0, error: 'Error crítico enviando difusión masiva' };
    }
};

module.exports = {
    getVapidPublicKey,
    saveSubscription,
    sendNotificationToUser,
    sendNotificationToAll
};
