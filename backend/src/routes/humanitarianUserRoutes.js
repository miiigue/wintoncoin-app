// ============================================================================
// RUTAS: Donaciones de Usuario (Winton Solidario - Público)
// ============================================================================
// Responsabilidad: Endpoints para que los usuarios normales interactúen
//                  con el sistema de causas humanitarias.
//
// Seguridad: Todas las rutas protegidas con authenticateToken (usuario)
// Prefijo: /api/humanitarian (registrado en server.js)
//
// Endpoints:
//   POST   /api/humanitarian/causes              — Postular una causa
//   GET    /api/humanitarian/causes/my            — Ver mis causas
//   GET    /api/humanitarian/causes/approved      — Ver causas aprobadas (marketplace)
//   GET    /api/humanitarian/causes/:id           — Ver detalle de una causa
//   POST   /api/humanitarian/causes/:id/donate    — Donar BLUE IOU a una causa
//   GET    /api/humanitarian/causes/:id/donations — Ver donaciones de una causa
// ============================================================================

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { submitCause, donateToCause, getCauseDonations } = require('../services/humanitarianService');
const pool = require('../config/db');

// ============================================================================
// MIDDLEWARE PARA AUTENTICACIÓN OPCIONAL (INVITADOS)
// ============================================================================
// Permite que usuarios invitados (sin token JWT) puedan ver causas y
// publicaciones públicas, pero los identifica si están logueados para
// verificar si son dueños de la causa.
// ============================================================================
const optionalAuthenticateToken = (req, res, next) => {
    let token = req.cookies ? req.cookies.auth_token : null;

    if (!token) {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }

    if (!token) {
        // No hay token, continuar de forma segura como invitado
        return next();
    }

    const jwt = require('jsonwebtoken');
    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
        if (err) {
            // Token inválido o expirado, pero como es opcional, continuamos como invitado
            return next();
        }

        try {
            // Verificar si la sesión no fue invalidada por cambio de contraseña
            const result = await pool.query(
                'SELECT password_invalidate_before FROM users WHERE id = $1',
                [user.userId]
            );
            if (result.rows.length > 0 && result.rows[0].password_invalidate_before) {
                const invalidateBefore = new Date(result.rows[0].password_invalidate_before);
                const tokenIssuedAt = new Date((user.iat || 0) * 1000);

                if (tokenIssuedAt < invalidateBefore) {
                    return next();
                }
            }
        } catch (dbError) {
            console.error('[AUTH OPTIONAL] Error al verificar invalidación de sesión:', dbError);
        }

        req.user = user;
        next();
    });
};

// ============================================================================
// RUTAS DE CAUSAS ACCESIBLES POR INVITADOS (AUTENTICACIÓN OPCIONAL)
// ============================================================================

// ============================================================================
// GET /api/humanitarian/causes/approved — Causas aprobadas (para el marketplace)
// ============================================================================
router.get('/causes/approved', optionalAuthenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                hc.id, hc.title, hc.story, hc.goal_amount, hc.current_amount,
                hc.evidence_urls, hc.created_at,
                u.username AS beneficiary_username,
                u.referral_code AS beneficiary_referral_code
            FROM humanitarian_causes hc
            JOIN users u ON hc.user_id = u.id
            WHERE hc.status = 'approved'
            ORDER BY hc.created_at DESC
        `);

        // Agregar información de donaciones en hold para cada causa
        const causesWithDetails = [];
        for (const cause of result.rows) {
            const holdRes = await pool.query(`
                SELECT COALESCE(SUM(amount), 0) AS total_on_hold
                FROM humanitarian_donations
                WHERE cause_id = $1 AND status = 'on_hold'
            `, [cause.id]);

            causesWithDetails.push({
                ...cause,
                amount_on_hold: parseFloat(holdRes.rows[0].total_on_hold)
            });
        }

        res.json({ success: true, causes: causesWithDetails });
    } catch (err) {
        console.error('[SOLIDARIO] Error al obtener causas aprobadas:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// ============================================================================
// GET /api/humanitarian/causes/:id — Detalle de una causa específica
// ============================================================================
router.get('/causes/:id', optionalAuthenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Validar ID numérico (prevención de inyección)
        if (isNaN(parseInt(id))) {
            return res.status(400).json({ message: 'ID de causa inválido.' });
        }

        const result = await pool.query(`
            SELECT 
                hc.*, 
                u.username AS beneficiary_username,
                u.referral_code AS beneficiary_referral_code
            FROM humanitarian_causes hc
            JOIN users u ON hc.user_id = u.id
            WHERE hc.id = $1
        `, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Causa no encontrada.' });
        }

        const cause = result.rows[0];

        // Solo permitir ver causas aprobadas o propias
        const isApproved = cause.status === 'approved';
        const isOwner = req.user && cause.user_id === req.user.userId;
        if (!isApproved && !isOwner) {
            return res.status(403).json({ message: 'No tienes permiso para ver esta causa.' });
        }

        // Obtener resumen de donaciones
        const donationSummary = await getCauseDonations(parseInt(id));

        res.json({
            success: true,
            cause,
            donations: donationSummary
        });

    } catch (err) {
        console.error('[SOLIDARIO] Error al obtener detalle de causa:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// ============================================================================
// TODAS LAS DEMÁS RUTAS REQUIEREN AUTENTICACIÓN DE USUARIO OBLIGATORIA
// ============================================================================
router.use(authenticateToken);

// ============================================================================
// POST /api/humanitarian/causes — Postular una causa humanitaria
// ============================================================================
router.post('/causes', async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await submitCause(userId, req.body, req);
        res.status(201).json({
            success: true,
            message: 'Tu postulación ha sido enviada para revisión por el equipo de WintonCoin.',
            cause_id: result.id
        });
    } catch (err) {
        console.error('[SOLIDARIO] Error al postular causa:', err);
        const status = err.status || 500;
        res.status(status).json({ message: err.message || 'Error interno del servidor.' });
    }
});

// ============================================================================
// GET /api/humanitarian/causes/my — Ver mis causas (del usuario autenticado)
// ============================================================================
router.get('/causes/my', async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await pool.query(`
            SELECT id, title, story, goal_amount, current_amount, status, 
                   admin_notes, evidence_urls, created_at, updated_at
            FROM humanitarian_causes
            WHERE user_id = $1
            ORDER BY created_at DESC
        `, [userId]);

        // Calcular el monto "en hold" de cada causa
        const causes = result.rows;
        for (let cause of causes) {
            const holdResult = await pool.query(
                "SELECT COALESCE(SUM(amount), 0) AS on_hold FROM humanitarian_donations WHERE cause_id = $1 AND status = 'on_hold'",
                [cause.id]
            );
            cause.amount_on_hold = parseFloat(holdResult.rows[0].on_hold) || 0;
        }

        res.json({
            success: true,
            causes: causes
        });
    } catch (err) {
        console.error('[SOLIDARIO] Error al consultar mis causas:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// ============================================================================
// POST /api/humanitarian/causes/:id/cancel — Cancelar una causa humanitaria activa/pendiente
// ============================================================================
router.post('/causes/:id/cancel', async (req, res) => {
    try {
        const causeId = req.params.id;
        const userId = req.user.userId;

        // Solo puede cancelar si le pertenece y está 'pending' o 'approved'
        const check = await pool.query("SELECT status FROM humanitarian_causes WHERE id = $1 AND user_id = $2", [causeId, userId]);
        if (check.rowCount === 0) {
            return res.status(404).json({ message: "Causa no encontrada o no te pertenece." });
        }
        if (check.rows[0].status !== 'pending' && check.rows[0].status !== 'approved') {
            return res.status(400).json({ message: "Solo se pueden cancelar causas activas o pendientes." });
        }

        // Cancelamos pasándolo a completed 
        await pool.query("UPDATE humanitarian_causes SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [causeId]);

        res.json({ success: true, message: "La causa ha sido culminada/cancelada exitosamente." });
    } catch (err) {
        console.error('[SOLIDARIO] Error al cancelar causa:', err);
        res.status(500).json({ message: 'Error interno o de base de datos.' });
    }
});

// ============================================================================
// POST /api/humanitarian/causes/:id/donate — Donar BLUE IOU a una causa
// ============================================================================
router.post('/causes/:id/donate', async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, publication_id } = req.body;
        const donorId = req.user.userId;

        // Validar ID numérico
        if (isNaN(parseInt(id))) {
            return res.status(400).json({ message: 'ID de causa inválido.' });
        }

        // Validar monto
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ message: 'El monto de donación debe ser un número positivo.' });
        }

        const result = await donateToCause(
            donorId,
            parseInt(id),
            parsedAmount,
            publication_id ? parseInt(publication_id) : null,
            req
        );

        res.json(result);

    } catch (err) {
        console.error('[SOLIDARIO] Error al procesar donación:', err);
        const status = err.status || 500;
        res.status(status).json({ message: err.message || 'Error interno del servidor.' });
    }
});

// ============================================================================
// GET /api/humanitarian/causes/:id/donations — Ver donaciones de una causa
// ============================================================================
router.get('/causes/:id/donations', async (req, res) => {
    try {
        const { id } = req.params;

        if (isNaN(parseInt(id))) {
            return res.status(400).json({ message: 'ID de causa inválido.' });
        }

        const result = await getCauseDonations(parseInt(id));
        res.json({ success: true, ...result });

    } catch (err) {
        console.error('[SOLIDARIO] Error al obtener donaciones:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

module.exports = router;
