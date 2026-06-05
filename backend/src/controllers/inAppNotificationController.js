'use strict';

const pool = require('../config/db');

// Ruta legacy endurecida: notificaciones por username solo para el usuario dueño.
async function getLegacyNotifications(req, res) {
    const { username } = req.params;
    if (!req.user?.username || req.user.username !== username) {
        return res.status(403).json({ message: 'No autorizado para consultar notificaciones de otro usuario.' });
    }
    const sql = `SELECT * FROM notifications WHERE recipient_username = $1 AND is_read = FALSE ORDER BY created_at DESC`;
    try {
        const result = await pool.query(sql, [username]);
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ message: "Error interno del servidor." });
    }
}

// --- ENDPOINT PROFESIONAL: Notificaciones del usuario autenticado ---
async function getMyNotifications(req, res) {
    const username = req.user?.username;
    if (!username) {
        return res.status(401).json({ message: "No autenticado." });
    }
    const sql = `SELECT * FROM notifications WHERE recipient_username = $1 AND is_read = FALSE ORDER BY created_at DESC`;
    try {
        const result = await pool.query(sql, [username]);
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ message: "Error interno del servidor." });
    }
}

// --- ENDPOINT PROFESIONAL: Historial completo (Leídas y No Leídas) ---
async function getMyNotificationsHistory(req, res) {
    const username = req.user?.username;
    if (!username) {
        return res.status(401).json({ message: "No autenticado." });
    }
    const sql = `SELECT * FROM notifications WHERE recipient_username = $1 ORDER BY created_at DESC LIMIT 50`;
    try {
        const result = await pool.query(sql, [username]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error al obtener historial de notificaciones:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}

// Ruta para marcar notificaciones como leídas
async function markReadLegacy(req, res) {
    const { username } = req.body;
    if (!req.user?.username || req.user.username !== username) {
        return res.status(403).json({ message: 'No autorizado para modificar notificaciones de otro usuario.' });
    }
    const sql = `UPDATE notifications SET is_read = TRUE WHERE recipient_username = $1 AND is_read = FALSE`;
    try {
        const result = await pool.query(sql, [username]);
        res.status(200).json({ success: true, count: result.rowCount });
    } catch (error) {
        res.status(500).json({ message: "Error al marcar notificaciones como leídas." });
    }
}

// --- ENDPOINT PROFESIONAL: marcar notificaciones como leídas (usuario autenticado) ---
async function markReadMyNotifications(req, res) {
    const username = req.user?.username;
    if (!username) {
        return res.status(401).json({ message: "No autenticado." });
    }
    const sql = `UPDATE notifications SET is_read = TRUE WHERE recipient_username = $1 AND is_read = FALSE`;
    try {
        const result = await pool.query(sql, [username]);
        res.status(200).json({ success: true, count: result.rowCount });
    } catch (error) {
        res.status(500).json({ message: "Error al marcar notificaciones como leídas." });
    }
}

// Ruta para descartar una notificación INDIVIDUAL
async function dismissNotificationLegacy(req, res) {
    const { id } = req.params;
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ message: "Se requiere nombre de usuario." });
    }
    if (!req.user?.username || req.user.username !== username) {
        return res.status(403).json({ message: 'No autorizado para descartar notificaciones de otro usuario.' });
    }

    try {
        const sql = `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND recipient_username = $2 AND is_read = FALSE RETURNING id`;
        const result = await pool.query(sql, [id, username]);

        if (result.rowCount > 0) {
            res.status(200).json({ message: "Notificación descartada." });
        } else {
            res.status(200).json({ message: "La notificación no necesitaba ser descartada." });
        }
    } catch (error) {
        console.error('Error al descartar notificación:', error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}

// --- ENDPOINT PROFESIONAL: descartar notificación individual (usuario autenticado) ---
async function dismissMyNotification(req, res) {
    const { id } = req.params;
    const username = req.user?.username;
    if (!username) {
        return res.status(401).json({ message: "No autenticado." });
    }
    try {
        const sql = `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND recipient_username = $2 AND is_read = FALSE RETURNING id`;
        const result = await pool.query(sql, [id, username]);
        if (result.rowCount > 0) {
            res.status(200).json({ message: "Notificación descartada." });
        } else {
            res.status(200).json({ message: "La notificación no necesitaba ser descartada." });
        }
    } catch (error) {
        console.error('Error al descartar notificación (me):', error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}

module.exports = {
    getLegacyNotifications,
    getMyNotifications,
    getMyNotificationsHistory,
    markReadLegacy,
    markReadMyNotifications,
    dismissNotificationLegacy,
    dismissMyNotification
};
