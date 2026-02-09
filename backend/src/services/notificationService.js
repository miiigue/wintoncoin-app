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
const sendNotificationToUser = async (userId, payload) => {
    try {
        // 1. Obtener todas las suscripciones del usuario
        const result = await pool.query(
            'SELECT * FROM push_subscriptions WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return { sent: 0, failed: 0, message: 'Usuario sin dispositivos suscritos' };
        }

        // 2. Enviar a cada dispositivo en paralelo
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
                    // Manejo profesional de errores http 410 (Gone) y 404 (Not Found)
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
        // No lanzamos error para no romper flujos críticos (ej: transacciones)
        // pero retornamos objeto de error para que quien llame sepa.
        return { sent: 0, error: error.message };
    }
};

const sendNotificationToAll = async (payload) => {
    try {
        console.log('[PUSH BROADCAST] Iniciando envío masivo...');
        const result = await pool.query('SELECT * FROM push_subscriptions');

        if (result.rows.length === 0) {
            return { sent: 0, message: 'No hay usuarios suscritos en el sistema' };
        }

        console.log(`[PUSH BROADCAST] Encontrados ${result.rows.length} dispositivos para notificar.`);

        // Enviar en paralelo (luego podremos optimizar en lotes si son > 1000)
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
                // Manejar usuario desconectado/suscripción inválida
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Limpiar suscripción muerta silenciosamente
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
