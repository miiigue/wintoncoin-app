const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// =================================================================================
// ==  RUTAS DE VALIDACIÓN DE DISPONIBILIDAD (USUARIO / EMAIL / TELÉFONO)         ==
// =================================================================================

// Endpoint to check if username exists (Industry Standard for UX)
router.get('/check-username/:username', async (req, res) => {
    const { username } = req.params;

    // Validation for safety
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    // Validación: mínimo 3 caracteres
    if (username.length < 3) {
        return res.json({ available: false, message: 'El usuario debe tener al menos 3 caracteres.' });
    }

    // Validación: máximo 30 caracteres
    if (username.length > 30) {
        return res.json({ available: false, message: 'El usuario no puede tener más de 30 caracteres.' });
    }

    // Validación: solo alfanuméricos y guiones bajos, sin espacios
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
        return res.json({ available: false, message: 'Solo letras, números y guiones bajos (_). Sin espacios.' });
    }

    try {
        // Check case-insensitive to avoid "User" vs "user" duplicates
        const result = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);

        if (result.rows.length > 0) {
            return res.json({ available: false, message: 'Este nombre de usuario ya está en uso.' });
        } else {
            return res.json({ available: true, message: 'Nombre de usuario disponible.' });
        }
    } catch (err) {
        console.error('Error checking username:', err.message);
        return res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to check if email exists (UX Improvement)
router.get('/check-email/:email', async (req, res) => {
    const { email } = req.params;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

        if (result.rows.length > 0) {
            return res.json({ available: false, message: 'Este correo electrónico ya está registrado.' });
        } else {
            return res.json({ available: true, message: 'Correo disponible.' });
        }
    } catch (err) {
        console.error('Error checking email:', err.message);
        return res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to check if phone exists (UX Improvement)
router.get('/check-phone/:phone', async (req, res) => {
    const { phone } = req.params;

    if (!phone) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    try {
        const result = await pool.query('SELECT id FROM users WHERE phone_number = $1', [phone]);

        if (result.rows.length > 0) {
            return res.json({ available: false, message: 'Este número de teléfono ya está registrado.' });
        } else {
            return res.json({ available: true, message: 'Teléfono disponible.' });
        }
    } catch (err) {
        console.error('Error checking phone:', err.message);
        return res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
