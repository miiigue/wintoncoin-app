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

const getNotificationSettings = async (req, res) => {
    const userId = req.user.userId;
    try {
        const result = await pool.query('SELECT notification_preferences FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

        // Default values if null
        const prefs = result.rows[0].notification_preferences || { security: true, social: true, marketing: true };
        res.json(prefs);
    } catch (error) {
        console.error('Error fetching notification settings:', error);
        res.status(500).json({ message: 'Error interno' });
    }
};

const updateNotificationSettings = async (req, res) => {
    const userId = req.user.userId;
    const { social, marketing } = req.body; // security is NOT editable via API

    try {
        // Fetch current to merge
        const currentRes = await pool.query('SELECT notification_preferences FROM users WHERE id = $1', [userId]);
        const current = currentRes.rows[0].notification_preferences || { security: true, social: true, marketing: true };

        const newPrefs = {
            ...current,
            security: true, // Force true always
            social: social !== undefined ? social : current.social,
            marketing: marketing !== undefined ? marketing : current.marketing
        };

        await pool.query('UPDATE users SET notification_preferences = $1 WHERE id = $2', [newPrefs, userId]);
        res.json({ message: 'Preferencias actualizadas', settings: newPrefs });

    } catch (error) {
        console.error('Error updating notification settings:', error);
        res.status(500).json({ message: 'Error interno' });
    }
};

/**
 * Endpoint para enviar notificación (Solo Admin)
 * Soporta userId o username
 */
const sendPush = async (req, res) => {
    // Aceptamos 'type' ('SOCIAL', 'MARKETING', 'SECURITY')
    let { userId, username, title, message, url, sendToAll, type } = req.body;

    // Default type if not provided
    const notificationType = type ? type.toUpperCase() : 'SOCIAL';

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
            // Pasamos el tipo al broadcast
            const result = await notificationService.sendNotificationToAll(payload, notificationType);
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

        // Pasamos el tipo al envío individual
        const result = await notificationService.sendNotificationToUser(userId, payload, notificationType);
        res.json({ success: true, ...result });

    } catch (error) {
        console.error('Error enviando push:', error);
        res.status(500).json({ error: 'Error interno' });
    }
};

module.exports = {
    getVapidPublicKey,
    subscribe,
    getNotificationSettings,
    updateNotificationSettings,
    sendPush
};
