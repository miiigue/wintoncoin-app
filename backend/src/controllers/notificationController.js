const notificationService = require('../services/notificationService');

/**
 * Retorna la clave pública VAPID para que el frontend pueda suscribirse
 */
const getVapidPublicKey = (req, res) => {
    try {
        const publicKey = notificationService.getVapidPublicKey();
        res.json({ publicKey });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Registra una suscripción de un usuario
 */
const subscribe = async (req, res) => {
    const { subscription, userAgent } = req.body;
    const userId = req.user ? req.user.userId : null;

    if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    try {
        await notificationService.saveSubscription(userId, subscription, userAgent || req.headers['user-agent']);
        res.status(201).json({ message: 'Suscripción registrada exitosamente' });
    } catch (error) {
        console.error('Error al guardar suscripción push:', error);
        res.status(500).json({ error: 'Error interno al procesar suscripción' });
    }
};

const pool = require('../config/db');

/**
 * Endpoint para enviar notificación (Solo Admin)
 * Soporta userId o username
 */
const sendPush = async (req, res) => {
    let { userId, username, title, message, url, sendToAll } = req.body;

    try {
        const payload = {
            title,
            body: message,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: url || '/' }
        };

        // CASO 1: Envío Masivo
        if (sendToAll === true) {
            if (!title || !message) {
                return res.status(400).json({ error: 'Faltan datos (title, message)' });
            }
            const result = await notificationService.sendNotificationToAll(payload);
            return res.json({ success: true, ...result });
        }

        // CASO 2: Envío Individual
        // Resolver username a ID
        if (!userId && username) {
            const userRes = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
            if (userRes.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }
            userId = userRes.rows[0].id;
        }

        if (!userId || !title || !message) {
            return res.status(400).json({ error: 'Faltan datos (userId o username, title, message)' });
        }

        const result = await notificationService.sendNotificationToUser(userId, payload);
        res.json({ success: true, ...result });

    } catch (error) {
        console.error('Error enviando push:', error);
        res.status(500).json({ error: 'Error interno' });
    }
};

module.exports = {
    getVapidPublicKey,
    subscribe,
    sendPush
    // Nota: sendNotificationToUser ya no se exporta aquí, se debe importar desde el servicio
};
