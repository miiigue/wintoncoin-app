/**
 * Governance Controller — Capa HTTP del Sistema Winton-Consensus
 *
 * Maneja validación de input, formateo de respuestas y delegación al servicio.
 * Cada handler sigue el patrón: validar → delegar → responder → manejar errores
 */

const governanceService = require('../services/governanceService');
const webauthnService = require('../services/webauthnService');
const eventBus = require('../services/notificationEventBus');
const { SETTINGS_DISPLAY_MAP } = require('../config/settingsDisplayMap');

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

async function _getActiveGuardianUserIds(pool) {
    const res = await pool.query(
        'SELECT user_id FROM governance_guardians WHERE status = $1',
        ['active']
    );
    return res.rows.map(r => r.user_id);
}

/**
 * Emits the appropriate governance events after a vote is processed.
 * Fetches fresh data from DB to ensure accuracy.
 */
async function _emitVoteEvents(pool, { requestId, vote, voterUsername, resultStatus }) {
    const reqRes = await pool.query(
        `SELECT r.requester_id, r.action_type, r.target_key, r.execution_time
         FROM governance_requests r WHERE r.id = $1`,
        [requestId]
    );
    if (reqRes.rowCount === 0) return;
    const govReq = reqRes.rows[0];

    const guardianUserIds = await _getActiveGuardianUserIds(pool);

    const votedRes = await pool.query(
        `SELECT g.user_id FROM governance_votes v
         JOIN governance_guardians g ON v.guardian_id = g.id
         WHERE v.request_id = $1`,
        [requestId]
    );
    const votedUserIds = new Set(votedRes.rows.map(r => r.user_id));
    const pendingGuardianIds = guardianUserIds.filter(
        id => !votedUserIds.has(id) && id !== govReq.requester_id
    );

    eventBus.emit('GOV_VOTE_SUBMITTED', {
        requestId,
        voterUsername,
        vote,
        requesterId: govReq.requester_id,
        pendingGuardianIds,
    });

    if (resultStatus === 'rejected') {
        eventBus.emit('GOV_REQUEST_REJECTED', {
            requestId,
            requesterId: govReq.requester_id,
        });
    }

    if (resultStatus === 'approved') {
        eventBus.emit('GOV_REQUEST_APPROVED', {
            requestId,
            executionTime: govReq.execution_time,
            guardianUserIds,
        });
    }

    if (resultStatus === 'executed') {
        eventBus.emit('GOV_REQUEST_EXECUTED', {
            requestId,
            actionType: govReq.action_type,
            targetKey: govReq.target_key,
            guardianUserIds,
        });

        if (govReq.action_type === 'membership_change') {
            _emitGuardianMembershipEvents(pool, requestId, govReq.requester_id).catch(err =>
                console.error('[GOV-CTRL] Error emitting membership events:', err)
            );
        }
    }
}

async function _emitGuardianMembershipEvents(pool, requestId, requesterId) {
    const reqRes = await pool.query(
        'SELECT new_value FROM governance_requests WHERE id = $1',
        [requestId]
    );
    if (reqRes.rowCount === 0) return;

    const raw = reqRes.rows[0].new_value;
    if (!raw) return;
    const newVal = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!newVal || !newVal.action) return;

    const requesterRes = await pool.query(
        'SELECT username FROM users WHERE id = $1',
        [requesterId]
    );
    const requesterUsername = requesterRes.rows[0]?.username || 'Sistema';

    if (newVal.action === 'add' || newVal.action === 'update') {
        eventBus.emit('GOV_GUARDIAN_ONBOARDED', {
            userId: newVal.userId,
            role: newVal.role,
            appointedByUsername: requesterUsername,
            requestId,
        });
    } else if (newVal.action === 'remove') {
        const guardianRes = await pool.query(
            'SELECT role FROM governance_guardians WHERE user_id = $1',
            [newVal.userId]
        );
        const previousRole = guardianRes.rows[0]?.role || 'supervisor';

        eventBus.emit('GOV_GUARDIAN_REMOVED', {
            userId: newVal.userId,
            previousRole,
            removedByUsername: requesterUsername,
            requestId,
        });
    }
}

function handleError(res, error, defaultStatus = 500) {
    const message = error.message || 'Error interno del sistema de gobernanza.';

    if (message.startsWith('BOOTSTRAP_ALREADY_DONE')) {
        return res.status(409).json({ error: message });
    }
    if (message.startsWith('MAKER_CHECKER_VIOLATION')) {
        return res.status(403).json({ error: message });
    }
    if (message.includes('no encontrad') || message.includes('not found')) {
        return res.status(404).json({ error: message });
    }
    if (message.includes('No eres') || message.includes('Solo') || message.includes('autorizado')) {
        return res.status(403).json({ error: message });
    }
    if (message.includes('inválid') || message.includes('invalid') || message.includes('requieren')) {
        return res.status(400).json({ error: message });
    }
    if (message.includes('Origen no permitido') || message.includes('Credential ID') || message.includes('cabecera Origin')) {
        return res.status(400).json({ error: message });
    }
    if (message.includes('expirad') || message.includes('CONFLICTO')) {
        return res.status(409).json({ error: message });
    }

    console.error('[GOV-CONTROLLER]', error);
    return res.status(defaultStatus).json({ error: message });
}

// ════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP
// ════════════════════════════════════════════════════════════════════════════

async function bootstrap(pool, req, res) {
    try {
        const { guardians } = req.body;

        if (!guardians || !Array.isArray(guardians)) {
            return res.status(400).json({
                error: 'Se requiere un array "guardians" con [{userId, role}].',
            });
        }

        for (const g of guardians) {
            if (!g.userId || !g.role) {
                return res.status(400).json({
                    error: 'Cada guardián debe tener "userId" (number) y "role" ("supervisor" o "auxiliary").',
                });
            }
            if (!['supervisor', 'auxiliary'].includes(g.role)) {
                return res.status(400).json({
                    error: `Rol inválido: "${g.role}". Debe ser "supervisor" o "auxiliary".`,
                });
            }
        }

        const adminUserId = req.user?.userId || req.user?.id;
        const result = await governanceService.bootstrapGuardians(pool, req, adminUserId, guardians);

        return res.status(201).json({
            message: 'Sistema de gobernanza inicializado exitosamente.',
            ...result,
        });
    } catch (error) {
        return handleError(res, error);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// WEBAUTHN: REGISTRO DE DISPOSITIVO BIOMÉTRICO
// ════════════════════════════════════════════════════════════════════════════

async function webauthnRegisterOptions(pool, req, res) {
    try {
        const userId = req.user.userId;

        const guardian = await governanceService.getGuardianByUserId(pool, userId);
        if (!guardian || guardian.status !== 'active') {
            return res.status(403).json({ error: 'Solo guardianes activos pueden registrar biometría.' });
        }

        const existingIds = guardian.webauthn_credential_id
            ? [guardian.webauthn_credential_id]
            : [];

        const options = await webauthnService.generateRegistrationChallenge(
            pool, userId, guardian.username, existingIds, req
        );

        return res.json({ options });
    } catch (error) {
        return handleError(res, error);
    }
}

async function webauthnRegisterVerify(pool, req, res) {
    try {
        const userId = req.user.userId;
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ error: 'Se requiere el objeto "credential" del navegador.' });
        }

        const result = await webauthnService.verifyRegistrationCredential(pool, userId, credential, req);

        const transportsArr = Array.isArray(result.transports) && result.transports.length > 0
            ? result.transports
            : null;

        await pool.query(
            `UPDATE governance_guardians
             SET webauthn_credential_id = $1,
                 webauthn_public_key = $2,
                 webauthn_counter = $3,
                 webauthn_transports = COALESCE($5::text[], webauthn_transports),
                 updated_at = NOW()
             WHERE user_id = $4`,
            [result.credentialId, result.publicKey, result.counter, userId, transportsArr]
        );

        return res.json({
            message: 'Dispositivo biométrico registrado exitosamente.',
            credentialId: result.credentialId,
        });
    } catch (error) {
        return handleError(res, error);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// WEBAUTHN: AUTENTICACIÓN PARA VOTAR
// ════════════════════════════════════════════════════════════════════════════

async function webauthnAuthOptions(pool, req, res) {
    try {
        const userId = req.user.userId;
        const { requestId } = req.params;

        if (!requestId) {
            return res.status(400).json({ error: 'Se requiere requestId.' });
        }

        const options = await webauthnService.generateAuthenticationChallenge(
            pool, userId, parseInt(requestId, 10), req
        );

        return res.json({ options });
    } catch (error) {
        return handleError(res, error);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// GUARDIANES
// ════════════════════════════════════════════════════════════════════════════

async function listGuardians(pool, req, res) {
    try {
        const filters = {};
        if (req.query.status) filters.status = req.query.status;
        if (req.query.role) filters.role = req.query.role;

        const raw = await governanceService.getGuardians(pool, filters);

        const guardians = raw.map(g => ({
            id:         g.id,
            user_id:    g.user_id,
            username:   g.username,
            role:       g.role,
            status:     g.status,
            created_at: g.created_at,
        }));

        return res.json({ guardians });
    } catch (error) {
        return handleError(res, error);
    }
}

async function getMyGuardianStatus(pool, req, res) {
    try {
        const userId = req.user.userId;
        const guardian = await governanceService.getGuardianByUserId(pool, userId);

        if (!guardian) {
            return res.json({ isGuardian: false });
        }

        return res.json({
            isGuardian: true,
            guardian: {
                id: guardian.id,
                userId: guardian.user_id,
                role: guardian.role,
                status: guardian.status,
                hasWebAuthn: !!guardian.webauthn_credential_id,
                username: guardian.username,
            },
        });
    } catch (error) {
        return handleError(res, error);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// SOLICITUDES
// ════════════════════════════════════════════════════════════════════════════

async function createRequest(pool, req, res) {
    try {
        const { actionType, targetKey, oldValue, newValue, description } = req.body;

        if (!actionType || !description) {
            return res.status(400).json({
                error: 'Se requieren "actionType" y "description".',
            });
        }

        const result = await governanceService.createRequest(pool, req, {
            requesterId: req.user.userId,
            actionType,
            targetKey,
            oldValue,
            newValue,
            description,
        });

        _getActiveGuardianUserIds(pool).then((guardianUserIds) => {
            eventBus.emit('GOV_REQUEST_CREATED', {
                requestId: result.id,
                description,
                actionType,
                requesterId: req.user.userId,
                requesterUsername: req.user.username,
                guardianUserIds,
                targetKey: result.target_key || null,
                oldValue: result.old_value,
                newValue: result.new_value,
                expiresAt: result.expires_at,
                createdAt: result.created_at,
                executionTime: result.execution_time,
            });
        }).catch(err => console.error('[GOV-CTRL] Error emitting GOV_REQUEST_CREATED:', err));

        return res.status(201).json({
            message: 'Solicitud de gobernanza creada. Los guardianes serán notificados.',
            request: result,
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function listRequests(pool, req, res) {
    try {
        const filters = {};
        if (req.query.status) filters.status = req.query.status;
        if (req.query.actionType) filters.actionType = req.query.actionType;
        if (req.query.limit) filters.limit = parseInt(req.query.limit, 10);

        const requests = await governanceService.getRequests(pool, filters);
        return res.json({ requests });
    } catch (error) {
        return handleError(res, error);
    }
}

async function getRequest(pool, req, res) {
    try {
        const { requestId } = req.params;
        const request = await governanceService.getRequestById(pool, parseInt(requestId, 10));

        if (!request) {
            return res.status(404).json({ error: 'Solicitud no encontrada.' });
        }

        return res.json({ request });
    } catch (error) {
        return handleError(res, error);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// VOTACIÓN
// ════════════════════════════════════════════════════════════════════════════

async function submitVote(pool, req, res) {
    try {
        const { requestId } = req.params;
        const { vote } = req.body;

        if (!vote || !['approve', 'reject'].includes(vote)) {
            return res.status(400).json({
                error: 'Se requiere "vote" con valor "approve" o "reject".',
            });
        }

        const guardian = await governanceService.getGuardianByUserId(pool, req.user.userId);
        const parsedRequestId = parseInt(requestId, 10);

        const result = await governanceService.submitVote(pool, req, {
            requestId: parsedRequestId,
            guardianUserId: req.user.userId,
            vote,
            webauthnProof: null,
        });

        _emitVoteEvents(pool, {
            requestId: parsedRequestId,
            vote,
            voterUsername: guardian?.username || req.user.username,
            resultStatus: result.status,
        }).catch(err => console.error('[GOV-CTRL] Error emitting vote events:', err));

        return res.json({
            message: result.message,
            ...result,
        });
    } catch (error) {
        return handleError(res, error);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// CANCELACIÓN
// ════════════════════════════════════════════════════════════════════════════

async function cancelRequest(pool, req, res) {
    try {
        const { requestId } = req.params;

        const result = await governanceService.cancelRequest(
            pool, req, parseInt(requestId, 10), req.user.userId
        );

        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// BREAK GLASS
// ════════════════════════════════════════════════════════════════════════════

async function breakGlass(pool, req, res) {
    try {
        const { codes, action } = req.body;

        if (!codes || !Array.isArray(codes) || codes.length < 3) {
            return res.status(400).json({
                error: 'Se requieren al menos 3 códigos de recuperación válidos (esquema 3-de-5).',
            });
        }

        if (codes.some(c => typeof c !== 'string' || c.trim().length === 0)) {
            return res.status(400).json({
                error: 'Todos los códigos deben ser cadenas de texto no vacías.',
            });
        }

        if (!action || typeof action !== 'object' || !action.action) {
            return res.status(400).json({
                error: 'Se requiere "action" con la operación de recuperación.',
            });
        }

        if (action.action === 'reset_guardians') {
            if (!action.guardians || !Array.isArray(action.guardians) || action.guardians.length < 2) {
                return res.status(400).json({
                    error: 'Para restablecer guardianes se necesitan al menos 2 nuevos guardianes con sus userId y role.',
                });
            }
            if (!action.reason || typeof action.reason !== 'string' || action.reason.trim().length < 10) {
                return res.status(400).json({
                    error: 'Se requiere una razón descriptiva de al menos 10 caracteres para el Break Glass.',
                });
            }
        }

        const result = await governanceService.executeBreakGlass(pool, req, codes, action);
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// CATÁLOGO DE CONFIGURACIONES (para formulario de gobernanza)
// ════════════════════════════════════════════════════════════════════════════

// SETTINGS_DISPLAY_MAP importado desde ../config/settingsDisplayMap.js

async function settingsCatalog(pool, req, res) {
    try {
        const guardianCheck = await pool.query(
            `SELECT status FROM governance_guardians WHERE user_id = $1`,
            [req.user.userId]
        );
        if (!guardianCheck.rows[0] || guardianCheck.rows[0].status !== 'active') {
            return res.status(403).json({ error: 'Solo los guardianes activos pueden ver el catálogo de configuraciones.' });
        }

        const result = await pool.query('SELECT setting_key, setting_value FROM app_settings ORDER BY setting_key');

        const catalog = result.rows.map(row => ({
            key: row.setting_key,
            label: SETTINGS_DISPLAY_MAP[row.setting_key] || row.setting_key,
            currentValue: row.setting_value,
        }));

        return res.json({ settings: catalog });
    } catch (error) {
        return handleError(res, error);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// ESTADO DEL SISTEMA
// ════════════════════════════════════════════════════════════════════════════

async function systemHealth(pool, req, res) {
    try {
        const health = await governanceService.getSystemHealth(pool);
        return res.json({ health });
    } catch (error) {
        return handleError(res, error);
    }
}

module.exports = {
    bootstrap,
    webauthnRegisterOptions,
    webauthnRegisterVerify,
    webauthnAuthOptions,
    listGuardians,
    getMyGuardianStatus,
    settingsCatalog,
    createRequest,
    listRequests,
    getRequest,
    submitVote,
    cancelRequest,
    breakGlass,
    systemHealth,
};
