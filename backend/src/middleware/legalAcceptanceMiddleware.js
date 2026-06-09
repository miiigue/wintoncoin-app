const jwt = require('jsonwebtoken');
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

/**
 * Intenta resolver un actor autenticado de forma consistente.
 * Prioridad:
 * 1) req.user (cuando un middleware previo ya autenticó)
 * 2) Authorization: Bearer <JWT usuario>
 */
function resolveAuthenticatedActor(req) {
    if (req.user) return req.user;

    const authHeader = req.headers?.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return null;

    const token = authHeader.slice('Bearer '.length);
    if (!token || !process.env.JWT_SECRET) return null;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        return decoded;
    } catch (_err) {
        return null;
    }
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
            const actor = resolveAuthenticatedActor(req);



            if (!actor) {
                return res.status(401).json({ message: 'No autenticado.' });
            }

            const platformUsername = (process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin').toLowerCase();
            const actorUsername = (actor.username || '').toLowerCase();
            const isAdminActor = actor.role === 'admin' || actor.name === 'admin';
            let targetUsername = null;
            let targetUserId = null;

            if (!isAdminActor) {
                // Estándar industria: la identidad fuente de verdad es el JWT (userId + username),
                // nunca el body/query/path manipulable por cliente.
                const canonicalUsername = normalizeUsername(actor.username);
                const canonicalUserId = Number(actor.userId);

                if (!canonicalUsername || !Number.isInteger(canonicalUserId)) {
                    return res.status(401).json({
                        message: 'Sesión inválida. Vuelve a iniciar sesión.'
                    });
                }

                // Validación anti-tampering:
                // si el cliente envía username y no coincide con JWT, rechazamos.
                let providedUsername = null;
                for (const field of fieldNames) {
                    const value = normalizeUsername(req.body?.[field]);
                    if (value) {
                        providedUsername = value;
                        break;
                    }
                }

                if (providedUsername && providedUsername.toLowerCase() !== canonicalUsername.toLowerCase()) {
                    return res.status(403).json({
                        message: 'No autorizado para actuar en nombre de otro usuario.'
                    });
                }

                // Compatibilidad con controladores legacy que aún leen req.body.<usernameField>:
                // sobreescribimos con valor canónico del JWT para eliminar spoofing de cliente.
                if (fieldNames.length > 0) {
                    req.body = req.body || {};
                    req.body[fieldNames[0]] = canonicalUsername;
                }

                targetUsername = canonicalUsername.toLowerCase();
                targetUserId = canonicalUserId;
            } else {
                // En contexto admin, permitimos actuar sobre un username objetivo explícito.
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

                targetUsername = username.toLowerCase();

                const userResult = await pool.query(
                    `SELECT id FROM users WHERE LOWER(username) = $1`,
                    [targetUsername]
                );

                if (userResult.rowCount === 0) {
                    return res.status(404).json({ message: 'Usuario no encontrado.' });
                }

                targetUserId = userResult.rows[0].id;
            }

            if (targetUsername === platformUsername) {
                // 1. Si es Administrador, permitimos actuar como plataforma
                if (isAdminActor) {
                    return next();
                }
                // 2. Si es el usuario sistema autenticado, también
                if (actorUsername === platformUsername) {
                    return next();
                }
                return res.status(403).json({
                    message: 'No autorizado para actuar como cuenta de plataforma.'
                });
            }

            const legalStatus = await getUserLegalStatusByUserId(pool, targetUserId);
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
