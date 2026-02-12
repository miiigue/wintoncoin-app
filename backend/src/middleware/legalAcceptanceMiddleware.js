const pool = require('../config/db');
const { getUserLegalStatusByUserId } = require('../services/legalService');

function legalBlockedResponse(res, legalStatus) {
    const isConfigError = legalStatus.legal_config_error === 'NO_ACTIVE_LEGAL_DOCUMENTS';
    return res.status(403).json({
        message: isConfigError
            ? 'La plataforma requiere publicar documentos legales activos antes de habilitar operaciones.'
            : 'Debes aceptar los términos y condiciones vigentes para realizar esta acción.',
        code: 'LEGAL_ACCEPTANCE_REQUIRED',
        requires_terms_acceptance: true,
        pending_documents: legalStatus.pending_documents || [],
        legal_config_error: legalStatus.legal_config_error || null
    });
}

function normalizeUsername(raw) {
    if (typeof raw !== 'string') return null;
    const value = raw.trim();
    return value.length > 0 ? value : null;
}

function requireAcceptedLegalForAuthenticatedUser() {
    return async (req, res, next) => {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: 'No autenticado.' });
        }

        try {
            // [SUPER-BYPASS ADMIN] Si el usuario tiene rol de administrador o nombre admin, 
            // no requiere aceptación de términos de usuario final para gestionar la app.
            if (req.user && (req.user.role === 'admin' || req.user.name === 'admin')) {
                return next();
            }

            // [BEST PRACTICE] Exención para el usuario de sistema autenticado
            const platformUsername = (process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin').toLowerCase();
            const currentUsername = (req.user?.username || '').toLowerCase();

            if (currentUsername === platformUsername) {
                return next();
            }

            const legalStatus = await getUserLegalStatusByUserId(pool, userId);
            if (legalStatus.requires_terms_acceptance) {
                return legalBlockedResponse(res, legalStatus);
            }
            return next();
        } catch (error) {
            console.error('[LEGAL] Error validando aceptación legal (auth user):', error);
            return res.status(500).json({ message: 'Error interno al validar aceptación legal.' });
        }
    };
}

function requireAcceptedLegalByUsernameField(fieldNames = []) {
    return async (req, res, next) => {
        try {
            let username = null;
            for (const field of fieldNames) {
                username = normalizeUsername(req.body?.[field]);
                if (username) break;
            }

            if (!username) {
                return res.status(400).json({
                    message: 'No se pudo identificar el usuario para validar términos legales.'
                });
            }

            // [SECURE] La exención legal por campo de texto solo se permite
            // si el usuario está autenticado y su identidad coincide con la plataforma.
            // O si el que realiza la acción es un Administrador autenticado.
            const platformUsername = (process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin').toLowerCase();
            const targetUsername = username.toLowerCase();

            if (targetUsername === platformUsername) {
                // 1. Si es Administrador, permitimos actuar como plataforma
                if (req.user && (req.user.role === 'admin' || req.user.name === 'admin')) {
                    return next();
                }
                // 2. Si es el usuario sistema autenticado, también
                if (req.user && req.user.username && req.user.username.toLowerCase() === platformUsername) {
                    return next();
                }
            }

            const userResult = await pool.query(
                `SELECT id FROM users WHERE LOWER(username) = $1`,
                [targetUsername]
            );

            if (userResult.rowCount === 0) {
                return res.status(404).json({ message: 'Usuario no encontrado.' });
            }

            const legalStatus = await getUserLegalStatusByUserId(pool, userResult.rows[0].id);
            if (legalStatus.requires_terms_acceptance) {
                return legalBlockedResponse(res, legalStatus);
            }

            return next();
        } catch (error) {
            console.error('[LEGAL] Error validando aceptación legal (username field):', error);
            return res.status(500).json({ message: 'Error interno al validar aceptación legal.' });
        }
    };
}

module.exports = {
    requireAcceptedLegalForAuthenticatedUser,
    requireAcceptedLegalByUsernameField
};
