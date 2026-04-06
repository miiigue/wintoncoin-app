/**
 * Governance Service — Motor de Consenso Winton-Consensus
 *
 * Implementa gobernanza multifirma con estándares de seguridad bancaria:
 *
 *   ┌───────────────────────────────────────────────────────────┐
 *   │  PROTECCIONES IMPLEMENTADAS                               │
 *   ├───────────────────────────────────────────────────────────┤
 *   │  1. Maker ≠ Checker    — Proponente no puede votar       │
 *   │  2. Quórum Simétrico   — Rechazo requiere misma mayoría  │
 *   │  3. Optimistic Lock    — Verifica old_value al ejecutar  │
 *   │  4. Time-Lock (config)  — Ventana de cancelación          │
 *   │  5. Break Glass        — Recuperación con M-de-N códigos │
 *   │  6. Biometría (WebAuthn) — Firma en cada voto            │
 *   │  7. Auditoría Total    — Todo queda en audit_log         │
 *   └───────────────────────────────────────────────────────────┘
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { logAuditEvent } = require('./auditService');

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN 1: Constantes y Configuración
// ════════════════════════════════════════════════════════════════════════════

const ACTION_TYPES = {
    CONFIG_CHANGE: 'config_change',
    MEMBERSHIP_CHANGE: 'membership_change',
};

const REQUEST_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    EXPIRED: 'expired',
    EXECUTED: 'executed',
    CANCELLED: 'cancelled',
};

// Defaults — se usan como fallback si app_settings no tiene el valor.
const GOV_DEFAULTS = Object.freeze({
    QUORUM_PERCENTAGE:        67,
    TIMELOCK_HOURS:           48,
    REQUEST_EXPIRY_HOURS:     24,
    REMINDER_THRESHOLD_H:     12,
    REMINDER_COOLDOWN_H:      6,
});

const RECOVERY_CODE_COUNT   = 5;
const RECOVERY_THRESHOLD    = 3;
const BCRYPT_ROUNDS         = 12;

/**
 * Lee los parámetros de gobernanza desde app_settings con fallback a GOV_DEFAULTS.
 * Usa una consulta única para minimizar round-trips a la DB.
 * Valida rangos para evitar configuraciones peligrosas.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} db - Pool o client de PostgreSQL
 * @returns {Promise<{quorumFraction: number, timelockHours: number, requestExpiryHours: number, reminderThresholdH: number, reminderCooldownH: number}>}
 */
async function _getGovConfig(db) {
    const keys = [
        'gov_quorum_percentage',
        'gov_timelock_hours',
        'gov_request_expiry_hours',
        'gov_reminder_threshold_hours',
        'gov_reminder_cooldown_hours',
    ];

    const res = await db.query(
        `SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1)`,
        [keys]
    );

    const map = {};
    for (const row of res.rows) {
        map[row.setting_key] = row.setting_value;
    }

    const pct = _clampInt(map['gov_quorum_percentage'], 51, 100, GOV_DEFAULTS.QUORUM_PERCENTAGE);
    const quorumFraction = pct / 100;

    return {
        quorumFraction,
        timelockHours:      _clampInt(map['gov_timelock_hours'],           1,  720, GOV_DEFAULTS.TIMELOCK_HOURS),
        requestExpiryHours: _clampInt(map['gov_request_expiry_hours'],     1,  168, GOV_DEFAULTS.REQUEST_EXPIRY_HOURS),
        reminderThresholdH: _clampInt(map['gov_reminder_threshold_hours'], 1,  72,  GOV_DEFAULTS.REMINDER_THRESHOLD_H),
        reminderCooldownH:  _clampInt(map['gov_reminder_cooldown_hours'],  1,  48,  GOV_DEFAULTS.REMINDER_COOLDOWN_H),
    };
}

/**
 * Parsea un string a entero y lo restringe a un rango seguro.
 * Si el valor es inválido o fuera de rango, retorna el default.
 * @private
 */
function _clampInt(raw, min, max, fallback) {
    const n = parseInt(raw, 10);
    if (isNaN(n)) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
}

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN 2: Bootstrap — Arranque inicial del sistema
// ════════════════════════════════════════════════════════════════════════════

/**
 * Configura los primeros guardianes del sistema (solo funciona una vez).
 * Requiere autenticación de admin y genera códigos de recuperación Break Glass.
 *
 * @param {Array<{userId: number, role: string}>} guardians - Lista de guardianes iniciales
 * @returns {{ guardians, recoveryCodes }} Los códigos de recuperación (MOSTRAR UNA SOLA VEZ)
 */
async function bootstrapGuardians(pool, req, adminUserId, guardians) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verificar que no existan guardianes (solo se puede hacer una vez)
        const existingRes = await client.query(
            'SELECT COUNT(*) as count FROM governance_guardians'
        );
        if (parseInt(existingRes.rows[0].count, 10) > 0) {
            throw new Error(
                'BOOTSTRAP_ALREADY_DONE: El sistema de gobernanza ya fue inicializado. ' +
                'Para agregar guardianes, usa el flujo de solicitud/votación.'
            );
        }

        if (!guardians || guardians.length < 2) {
            throw new Error('Se requieren al menos 2 guardianes para inicializar el sistema.');
        }

        const supervisors = guardians.filter(g => g.role === 'supervisor');
        if (supervisors.length < 2) {
            throw new Error('Se requieren al menos 2 supervisores para que el quórum funcione.');
        }

        const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';

        const insertedGuardians = [];
        for (const g of guardians) {
            const userCheck = await client.query('SELECT id, username FROM users WHERE id = $1', [g.userId]);
            if (userCheck.rowCount === 0) {
                throw new Error(`El usuario con ID ${g.userId} no existe.`);
            }

            if (userCheck.rows[0].username === platformUsername) {
                throw new Error(
                    `La cuenta de sistema "${platformUsername}" no puede ser guardián. ` +
                    'Los guardianes deben ser personas físicas reales que puedan autenticarse biométricamente y tomar decisiones conscientes.'
                );
            }

            const res = await client.query(
                `INSERT INTO governance_guardians (user_id, role, status, appointed_by)
                 VALUES ($1, $2, 'active', $3)
                 RETURNING id, user_id, role`,
                [g.userId, g.role, adminUserId]
            );
            insertedGuardians.push({
                ...res.rows[0],
                username: userCheck.rows[0].username,
            });
        }

        // Generar códigos de recuperación Break Glass
        const recoveryCodes = await _generateRecoveryCodes(client, adminUserId);

        const adminUserRes = await client.query('SELECT username FROM users WHERE id = $1', [adminUserId]);
        const adminUsername = adminUserRes.rows[0]?.username || 'admin';

        await logAuditEvent(client, req, {
            eventType: 'GOV_BOOTSTRAP_GENESIS',
            actorId: adminUserId,
            actorUsername: adminUsername,
            category: 'GOVERNANCE',
            metadata: {
                guardiansCreated: insertedGuardians.length,
                roles: guardians.map(g => g.role),
                recoveryCodesGenerated: RECOVERY_CODE_COUNT,
                recoveryThreshold: RECOVERY_THRESHOLD,
            },
        });

        await client.query('COMMIT');

        return {
            guardians: insertedGuardians,
            recoveryCodes: recoveryCodes.plainCodes,
            recoveryInfo: {
                totalCodes: RECOVERY_CODE_COUNT,
                threshold: RECOVERY_THRESHOLD,
                warning: 'ESTOS CÓDIGOS SOLO SE MUESTRAN UNA VEZ. Imprímelos y guárdalos en lugares separados y seguros.',
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Genera códigos de recuperación y almacena solo sus hashes.
 * @private
 */
async function _generateRecoveryCodes(client, adminUserId) {
    const plainCodes = [];

    for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
        const code = crypto.randomBytes(16).toString('hex').toUpperCase();
        const hash = await bcrypt.hash(code, BCRYPT_ROUNDS);

        await client.query(
            `INSERT INTO governance_recovery_codes
             (code_index, code_hash, total_codes, threshold, holder_description)
             VALUES ($1, $2, $3, $4, $5)`,
            [i + 1, hash, RECOVERY_CODE_COUNT, RECOVERY_THRESHOLD, `Código #${i + 1} — asignar titular`]
        );

        plainCodes.push(code);
    }

    return { plainCodes };
}

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN 3: Consultas de Guardianes
// ════════════════════════════════════════════════════════════════════════════

async function getGuardians(pool, filters = {}) {
    let sql = `
        SELECT g.id, g.user_id, g.role, g.status,
               g.webauthn_credential_id IS NOT NULL AS has_webauthn,
               g.created_at, g.updated_at,
               u.username, u.email,
               (SELECT COUNT(*) FROM governance_votes v WHERE v.guardian_id = g.id) AS vote_count,
               (SELECT COUNT(*) FROM governance_requests r WHERE r.requester_id = g.user_id) AS proposal_count
        FROM governance_guardians g
        JOIN users u ON g.user_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (filters.status) {
        params.push(filters.status);
        conditions.push(`g.status = $${params.length}`);
    }
    if (filters.role) {
        params.push(filters.role);
        conditions.push(`g.role = $${params.length}`);
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY g.role ASC, g.created_at ASC';

    const res = await pool.query(sql, params);
    return res.rows;
}

async function getGuardianByUserId(pool, userId) {
    const res = await pool.query(
        `SELECT g.*, u.username FROM governance_guardians g
         JOIN users u ON g.user_id = u.id
         WHERE g.user_id = $1`,
        [userId]
    );
    return res.rows[0] || null;
}

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN 4: Ciclo de Vida de Solicitudes
// ════════════════════════════════════════════════════════════════════════════

/**
 * Crea una nueva solicitud de gobernanza.
 * Solo guardianes activos pueden crear solicitudes.
 */
async function createRequest(pool, req, data) {
    const { requesterId, actionType, targetKey, oldValue, newValue, description } = data;

    // Validar que el solicitante sea un guardián activo
    const guardian = await getGuardianByUserId(pool, requesterId);
    if (!guardian || guardian.status !== 'active') {
        throw new Error('Solo los guardianes activos pueden crear solicitudes.');
    }

    // Validar tipo de acción
    if (!Object.values(ACTION_TYPES).includes(actionType)) {
        throw new Error(`Tipo de acción inválido: ${actionType}`);
    }

    // Validaciones específicas para cambios de membresía
    if (actionType === ACTION_TYPES.MEMBERSHIP_CHANGE) {
        const parsed = typeof newValue === 'string' ? JSON.parse(newValue) : newValue;
        if (!parsed || !parsed.userId || !parsed.action) {
            throw new Error('Cambio de membresía requiere userId y action en newValue.');
        }

        const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
        const targetUser = await pool.query('SELECT id, username FROM users WHERE id = $1', [parsed.userId]);
        if (targetUser.rowCount === 0) {
            throw new Error(`El usuario con ID ${parsed.userId} no existe en la base de datos.`);
        }
        if (targetUser.rows[0].username === platformUsername) {
            throw new Error(`La cuenta de sistema "${platformUsername}" no puede ser guardián.`);
        }

        if (parsed.action === 'remove') {
            const existingGuardian = await pool.query(
                `SELECT id, status FROM governance_guardians WHERE user_id = $1`,
                [parsed.userId]
            );
            if (existingGuardian.rowCount === 0) {
                throw new Error(`El usuario con ID ${parsed.userId} no es guardián del sistema. No se puede remover.`);
            }
            if (existingGuardian.rows[0].status !== 'active') {
                throw new Error(`El guardián con ID ${parsed.userId} ya está inactivo.`);
            }
        }

        if (['add', 'update'].includes(parsed.action)) {
            if (!parsed.role || !['supervisor', 'auxiliary'].includes(parsed.role)) {
                throw new Error('Para agregar o actualizar un guardián se requiere un rol válido ("supervisor" o "auxiliary").');
            }
        }
    }

    const govConfig = await _getGovConfig(pool);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + govConfig.requestExpiryHours);

    // Time-Lock para cambios de membresía
    let executionTime = null;
    if (actionType === ACTION_TYPES.MEMBERSHIP_CHANGE) {
        executionTime = new Date();
        executionTime.setHours(executionTime.getHours() + govConfig.timelockHours);
    }

    const sql = `
        INSERT INTO governance_requests
        (requester_id, action_type, target_key, old_value, new_value, description, expires_at, execution_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    `;
    const result = await pool.query(sql, [
        requesterId, actionType, targetKey,
        JSON.stringify(oldValue), JSON.stringify(newValue),
        description, expiresAt, executionTime,
    ]);

    const newRequest = result.rows[0];

    await logAuditEvent(pool, req, {
        eventType: 'GOV_REQUEST_CREATED',
        actorId: requesterId,
        actorUsername: guardian.username,
        category: 'GOVERNANCE',
        metadata: {
            requestId: newRequest.id,
            actionType,
            targetKey,
            expiresAt: expiresAt.toISOString(),
            hasTimeLock: !!executionTime,
        },
    });

    return newRequest;
}

async function getRequests(pool, filters = {}) {
    let sql = `
        SELECT r.*,
               u.username AS requester_username,
               (SELECT COUNT(*) FROM governance_votes v WHERE v.request_id = r.id AND v.vote = 'approve') AS approve_count,
               (SELECT COUNT(*) FROM governance_votes v WHERE v.request_id = r.id AND v.vote = 'reject') AS reject_count
        FROM governance_requests r
        JOIN users u ON r.requester_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (filters.status) {
        params.push(filters.status);
        conditions.push(`r.status = $${params.length}`);
    }
    if (filters.actionType) {
        params.push(filters.actionType);
        conditions.push(`r.action_type = $${params.length}`);
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY r.created_at DESC';

    if (filters.limit) {
        params.push(filters.limit);
        sql += ` LIMIT $${params.length}`;
    }

    const res = await pool.query(sql, params);
    return res.rows;
}

async function getRequestById(pool, requestId) {
    const reqRes = await pool.query(
        `SELECT r.*, u.username AS requester_username
         FROM governance_requests r
         JOIN users u ON r.requester_id = u.id
         WHERE r.id = $1`,
        [requestId]
    );

    if (reqRes.rowCount === 0) return null;

    const request = reqRes.rows[0];

    const votesRes = await pool.query(
        `SELECT v.*, g.role AS guardian_role, g.user_id AS guardian_user_id, u.username AS guardian_username
         FROM governance_votes v
         JOIN governance_guardians g ON v.guardian_id = g.id
         JOIN users u ON g.user_id = u.id
         WHERE v.request_id = $1
         ORDER BY v.created_at ASC`,
        [requestId]
    );

    const guardiansRes = await pool.query(
        `SELECT g.id, g.user_id, g.role, u.username
         FROM governance_guardians g
         JOIN users u ON g.user_id = u.id
         WHERE g.status = 'active'`
    );

    // Calcular estado del quórum con porcentaje dinámico
    const govConfig = await _getGovConfig(pool);
    const quorumStatus = _calculateQuorumStatus(
        guardiansRes.rows,
        votesRes.rows,
        request.action_type,
        request.requester_id,
        govConfig.quorumFraction
    );

    return {
        ...request,
        votes: votesRes.rows,
        quorum: quorumStatus,
    };
}

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN 5: Votación con Quórum Simétrico
// ════════════════════════════════════════════════════════════════════════════

/**
 * Registra un voto para una solicitud activa.
 *
 * Protecciones:
 *   - Maker ≠ Checker: el proponente NO puede votar su propia solicitud
 *   - Quórum simétrico: tanto aprobación como rechazo requieren 2/3
 *   - Biometría: la firma WebAuthn se almacena como prueba criptográfica
 *   - Concurrencia: FOR UPDATE previene race conditions
 */
async function submitVote(pool, req, data) {
    const { requestId, guardianUserId, vote, webauthnProof } = data;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Verificar que el usuario es un guardián activo
        const guardianRes = await client.query(
            `SELECT g.id, g.role, g.user_id, u.username
             FROM governance_guardians g
             JOIN users u ON g.user_id = u.id
             WHERE g.user_id = $1 AND g.status = 'active'`,
            [guardianUserId]
        );
        if (guardianRes.rowCount === 0) {
            throw new Error('No eres un guardián autorizado o tu cuenta está inactiva.');
        }
        const guardian = guardianRes.rows[0];

        // 2. Obtener la solicitud con lock exclusivo
        const reqRes = await client.query(
            `SELECT * FROM governance_requests
             WHERE id = $1 AND status = 'pending'
             FOR UPDATE`,
            [requestId]
        );
        if (reqRes.rowCount === 0) {
            throw new Error('Solicitud no encontrada o ya procesada.');
        }
        const govRequest = reqRes.rows[0];

        // 3. Verificar expiración
        if (new Date() > new Date(govRequest.expires_at)) {
            await client.query(
                `UPDATE governance_requests SET status = 'expired' WHERE id = $1`,
                [requestId]
            );
            await client.query('COMMIT');
            throw new Error('La solicitud ha expirado.');
        }

        // 4. MAKER ≠ CHECKER: El proponente no puede votar su propia solicitud
        if (parseInt(govRequest.requester_id, 10) === parseInt(guardianUserId, 10)) {
            throw new Error(
                'MAKER_CHECKER_VIOLATION: No puedes votar en una solicitud que tú mismo creaste. ' +
                'Este es un principio fundamental de control interno.'
            );
        }

        // 5. Validar tipo de voto
        if (!['approve', 'reject'].includes(vote)) {
            throw new Error('Voto inválido. Debe ser "approve" o "reject".');
        }

        // 5b. Un voto por guardián (inmutable) — evita doble firma y “cambiar de opinión” vía API
        const existingVoteRes = await client.query(
            `SELECT id FROM governance_votes WHERE request_id = $1 AND guardian_id = $2`,
            [requestId, guardian.id]
        );
        if (existingVoteRes.rowCount > 0) {
            throw new Error(
                'Ya registraste tu voto en esta solicitud. Por auditoría, los votos no se pueden modificar ni repetir.'
            );
        }

        // 6. Registrar el voto (con prueba WebAuthn)
        await client.query(
            `INSERT INTO governance_votes
             (request_id, guardian_id, vote, signature, authenticator_data, client_data_json, challenge)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                requestId, guardian.id, vote,
                webauthnProof?.signature || null,
                webauthnProof?.authenticatorData || null,
                webauthnProof?.clientDataJSON || null,
                webauthnProof?.challenge || null,
            ]
        );

        // 7. Snapshot del monto de recompensa ANTES de evaluar quórum.
        //    Point-in-time pricing: si este voto activa la ejecución de un
        //    config_change sobre gov_vote_reward_blue, el valor capturado aquí
        //    es el vigente al momento del acto, no el nuevo.
        const rewardSnapshotRes = await client.query(
            `SELECT setting_value FROM app_settings WHERE setting_key = $1`,
            ['gov_vote_reward_blue']
        );
        const rewardSnapshot = rewardSnapshotRes.rows[0]?.setting_value ?? null;

        // 8. Evaluar quórum (aprobación Y rechazo)
        const result = await _evaluateAndAct(client, req, govRequest);

        await client.query('COMMIT');

        result.rewardSnapshot = rewardSnapshot;

        await logAuditEvent(pool, req, {
            eventType: 'GOV_VOTE_SUBMITTED',
            actorId: parseInt(guardianUserId, 10),
            actorUsername: guardian.username,
            category: 'GOVERNANCE',
            metadata: {
                requestId,
                vote,
                guardianRole: guardian.role,
                hasWebAuthn: !!webauthnProof,
                result: result.status,
            },
        });

        return result;

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Evalúa el quórum y ejecuta/rechaza si se alcanzó.
 * QUÓRUM SIMÉTRICO: Tanto aprobación como rechazo requieren misma mayoría.
 * @private
 */
async function _evaluateAndAct(client, req, govRequest) {
    const govConfig = await _getGovConfig(client);

    const guardiansRes = await client.query(
        `SELECT id, user_id, role FROM governance_guardians WHERE status = 'active'`
    );
    const allGuardians = guardiansRes.rows;

    // Excluir al proponente del pool elegible (Maker ≠ Checker)
    const requesterId = parseInt(govRequest.requester_id, 10);
    const eligible = allGuardians.filter(g => parseInt(g.user_id, 10) !== requesterId);

    const votesRes = await client.query(
        `SELECT v.vote, g.role
         FROM governance_votes v
         JOIN governance_guardians g ON v.guardian_id = g.id
         WHERE v.request_id = $1`,
        [govRequest.id]
    );

    // Contar por rol
    const totals = { supervisor: 0, auxiliary: 0 };
    eligible.forEach(g => { totals[g.role] = (totals[g.role] || 0) + 1; });

    const approved = { supervisor: 0, auxiliary: 0 };
    const rejected = { supervisor: 0, auxiliary: 0 };
    votesRes.rows.forEach(v => {
        if (v.vote === 'approve') approved[v.role] = (approved[v.role] || 0) + 1;
        if (v.vote === 'reject')  rejected[v.role] = (rejected[v.role] || 0) + 1;
    });

    // Calcular umbrales con quórum dinámico
    const supThreshold = Math.ceil(totals.supervisor * govConfig.quorumFraction);
    const auxThreshold = Math.ceil(totals.auxiliary * govConfig.quorumFraction);

    let isApproved = false;
    let isRejected = false;

    if (govRequest.action_type === ACTION_TYPES.CONFIG_CHANGE) {
        // Config: solo supervisores
        isApproved = approved.supervisor >= supThreshold && supThreshold > 0;
        isRejected = rejected.supervisor >= supThreshold && supThreshold > 0;
    } else if (govRequest.action_type === ACTION_TYPES.MEMBERSHIP_CHANGE) {
        // Membership: supervisores + auxiliares
        const supApproved = approved.supervisor >= supThreshold && supThreshold > 0;
        const auxApproved = totals.auxiliary === 0 || approved.auxiliary >= auxThreshold;
        isApproved = supApproved && auxApproved;

        const supRejected = rejected.supervisor >= supThreshold && supThreshold > 0;
        const auxRejected = totals.auxiliary === 0 || rejected.auxiliary >= auxThreshold;
        isRejected = supRejected && auxRejected;
    }

    // Quórum de RECHAZO alcanzado
    if (isRejected) {
        await client.query(
            `UPDATE governance_requests SET status = 'rejected' WHERE id = $1`,
            [govRequest.id]
        );
        await logAuditEvent(client, req, {
            eventType: 'GOV_REQUEST_REJECTED',
            actorUsername: 'system',
            category: 'GOVERNANCE',
            metadata: { requestId: govRequest.id, approved, rejected, totals },
        });
        return {
            status: REQUEST_STATUS.REJECTED,
            message: 'Quórum de rechazo alcanzado. La solicitud ha sido denegada.',
            quorum: { approved, rejected, totals, supThreshold, auxThreshold },
        };
    }

    // Quórum de APROBACIÓN alcanzado
    if (isApproved) {
        await client.query(
            `UPDATE governance_requests SET status = 'approved' WHERE id = $1`,
            [govRequest.id]
        );

        // Sin Time-Lock → ejecución inmediata
        if (!govRequest.execution_time) {
            const execResult = await _executeAction(client, req, govRequest);
            return {
                status: execResult.status,
                message: execResult.message,
                quorum: { approved, rejected, totals, supThreshold, auxThreshold },
            };
        }

        // Con Time-Lock → esperar
        await logAuditEvent(client, req, {
            eventType: 'GOV_REQUEST_APPROVED_TIMELOCK',
            actorUsername: 'system',
            category: 'GOVERNANCE',
            metadata: {
                requestId: govRequest.id,
                executionTime: govRequest.execution_time,
                approved, totals,
            },
        });

        return {
            status: REQUEST_STATUS.APPROVED,
            message: `Quórum alcanzado. Ejecución programada para ${new Date(govRequest.execution_time).toISOString()}. ` +
                     `Cualquier guardián puede cancelar durante las próximas ${govConfig.timelockHours} horas.`,
            quorum: { approved, rejected, totals, supThreshold, auxThreshold },
        };
    }

    // Aún no hay quórum
    return {
        status: REQUEST_STATUS.PENDING,
        message: 'Voto registrado. Esperando más votos para alcanzar quórum.',
        quorum: { approved, rejected, totals, supThreshold, auxThreshold },
    };
}

/**
 * Calcula el estado del quórum para una solicitud (lectura, sin side-effects).
 * Acepta quorumFraction para mantener consistencia con _evaluateAndAct.
 * @private
 */
function _calculateQuorumStatus(allGuardians, votes, actionType, requesterId, quorumFraction) {
    const fraction = quorumFraction || (GOV_DEFAULTS.QUORUM_PERCENTAGE / 100);
    const reqId = parseInt(requesterId, 10);
    const eligible = allGuardians.filter(g => parseInt(g.user_id, 10) !== reqId);

    const totals = { supervisor: 0, auxiliary: 0 };
    eligible.forEach(g => { totals[g.role] = (totals[g.role] || 0) + 1; });

    const approved = { supervisor: 0, auxiliary: 0 };
    const rejected = { supervisor: 0, auxiliary: 0 };
    votes.forEach(v => {
        if (v.vote === 'approve') approved[v.guardian_role] = (approved[v.guardian_role] || 0) + 1;
        if (v.vote === 'reject')  rejected[v.guardian_role] = (rejected[v.guardian_role] || 0) + 1;
    });

    const supThreshold = Math.ceil(totals.supervisor * fraction);
    const auxThreshold = Math.ceil(totals.auxiliary * fraction);

    const pendingVoters = eligible.filter(g =>
        !votes.some(v => v.guardian_user_id === g.user_id)
    );

    return {
        totals,
        approved,
        rejected,
        thresholds: { supervisor: supThreshold, auxiliary: auxThreshold },
        pendingVoters: pendingVoters.map(g => ({ userId: g.user_id, username: g.username, role: g.role })),
        isComplete: false,
    };
}

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN 6: Motor de Ejecución
// ════════════════════════════════════════════════════════════════════════════

/**
 * Ejecuta el cambio aprobado, verificando primero que old_value no haya cambiado.
 * Implementa Optimistic Concurrency Control.
 * @private
 */
async function _executeAction(client, req, govRequest) {
    // Verificar old_value (Optimistic Concurrency Control)
    const staleCheck = await _verifyOldValue(client, govRequest);
    if (!staleCheck.valid) {
        await client.query(
            `UPDATE governance_requests SET status = 'cancelled',
             metadata = jsonb_set(COALESCE(metadata, '{}'), '{cancellation_reason}', $2)
             WHERE id = $1`,
            [govRequest.id, JSON.stringify(staleCheck.reason)]
        );
        await logAuditEvent(client, req, {
            eventType: 'GOV_EXECUTION_CONFLICT',
            actorUsername: 'system',
            category: 'GOVERNANCE',
            metadata: {
                requestId: govRequest.id,
                reason: staleCheck.reason,
                expectedOldValue: govRequest.old_value,
                actualValue: staleCheck.actualValue,
            },
        });
        return {
            status: REQUEST_STATUS.CANCELLED,
            message: `CONFLICTO: El valor actual ya no coincide con el esperado. ${staleCheck.reason}`,
        };
    }

    try {
        if (govRequest.action_type === ACTION_TYPES.CONFIG_CHANGE) {
            await client.query(
                `UPDATE app_settings SET setting_value = $1 WHERE setting_key = $2`,
                [govRequest.new_value, govRequest.target_key]
            );
        } else if (govRequest.action_type === ACTION_TYPES.MEMBERSHIP_CHANGE) {
            const newVal = typeof govRequest.new_value === 'string'
                ? JSON.parse(govRequest.new_value)
                : govRequest.new_value;

            if (newVal.action === 'remove') {
                const removeResult = await client.query(
                    `UPDATE governance_guardians SET status = 'inactive', updated_at = NOW()
                     WHERE user_id = $1 AND status = 'active'`,
                    [newVal.userId]
                );
                if (removeResult.rowCount === 0) {
                    throw new Error(`No se encontró guardián activo con userId ${newVal.userId} para desactivar.`);
                }
            } else if (newVal.action === 'add' || newVal.action === 'update') {
                await client.query(
                    `INSERT INTO governance_guardians (user_id, role, status, appointed_by)
                     VALUES ($1, $2, 'active', $3)
                     ON CONFLICT (user_id)
                     DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = NOW()`,
                    [newVal.userId, newVal.role, govRequest.requester_id]
                );
            }
        }

        await client.query(
            `UPDATE governance_requests SET status = 'executed', executed_at = NOW()
             WHERE id = $1`,
            [govRequest.id]
        );

        const requesterRes = await client.query(
            'SELECT username FROM users WHERE id = $1', [govRequest.requester_id]
        );
        const requesterUsername = requesterRes.rows[0]?.username || 'desconocido';

        await logAuditEvent(client, req, {
            eventType: 'GOV_EXECUTION_SUCCESS',
            actorUsername: 'system',
            category: 'GOVERNANCE',
            metadata: {
                requestId: govRequest.id,
                actionType: govRequest.action_type,
                targetKey: govRequest.target_key,
                requesterUsername,
                new_value: typeof govRequest.new_value === 'string'
                    ? govRequest.new_value.substring(0, 200)
                    : JSON.stringify(govRequest.new_value).substring(0, 200),
            },
        });

        return {
            status: REQUEST_STATUS.EXECUTED,
            message: 'Cambio aplicado exitosamente.',
            actionType: govRequest.action_type,
            targetKey: govRequest.target_key,
        };

    } catch (error) {
        console.error('[GOVERNANCE] Error en ejecución:', error);
        throw error;
    }
}

/**
 * Verifica que el valor actual en DB coincida con old_value de la solicitud.
 * Si no coincide, alguien cambió el valor por otra vía → CONFLICTO.
 * @private
 */
async function _verifyOldValue(client, govRequest) {
    if (govRequest.action_type === ACTION_TYPES.CONFIG_CHANGE) {
        const res = await client.query(
            'SELECT setting_value FROM app_settings WHERE setting_key = $1',
            [govRequest.target_key]
        );
        if (res.rowCount === 0) {
            return { valid: true };
        }
        const currentValue = res.rows[0].setting_value;
        const expectedOld = typeof govRequest.old_value === 'string'
            ? govRequest.old_value
            : JSON.stringify(govRequest.old_value);

        const currentNorm = typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue);

        if (currentNorm !== expectedOld && expectedOld !== 'null') {
            return {
                valid: false,
                reason: `El valor de "${govRequest.target_key}" cambió desde que se creó la solicitud.`,
                actualValue: currentValue,
            };
        }
    }

    if (govRequest.action_type === ACTION_TYPES.MEMBERSHIP_CHANGE) {
        const newVal = typeof govRequest.new_value === 'string'
            ? JSON.parse(govRequest.new_value)
            : govRequest.new_value;

        if (newVal.action === 'remove') {
            const res = await client.query(
                `SELECT status FROM governance_guardians WHERE user_id = $1`,
                [newVal.userId]
            );
            if (res.rowCount > 0 && res.rows[0].status === 'inactive') {
                return {
                    valid: false,
                    reason: 'El guardián ya fue desactivado por otro proceso.',
                    actualValue: 'inactive',
                };
            }
        }
    }

    return { valid: true };
}

/**
 * Cron Job: Ejecuta solicitudes aprobadas cuyo Time-Lock ha vencido.
 * Debe llamarse periódicamente (ej: cada 1 minuto).
 */
async function processTimeLocked(pool) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const res = await client.query(
            `SELECT * FROM governance_requests
             WHERE status = 'approved'
               AND execution_time IS NOT NULL
               AND execution_time <= NOW()
             FOR UPDATE SKIP LOCKED`
        );

        const results = [];
        for (const govRequest of res.rows) {
            const savepointName = `sp_timelock_${govRequest.id}`;
            try {
                await client.query(`SAVEPOINT ${savepointName}`);
                const execResult = await _executeAction(client, null, govRequest);
                await client.query(`RELEASE SAVEPOINT ${savepointName}`);
                results.push({ requestId: govRequest.id, ...execResult });
            } catch (error) {
                await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                console.error(`[GOV-CRON] Error ejecutando request ${govRequest.id}:`, error);
                results.push({ requestId: govRequest.id, status: 'error', message: error.message });
            }
        }

        await client.query('COMMIT');

        if (results.length > 0) {
            console.log(`[GOV-CRON] Procesados ${results.length} time-locks.`);
        }
        return results;

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[GOV-CRON] Error en procesamiento de time-locks:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Cron Job: Expira solicitudes pendientes cuyo plazo venció.
 */
async function expireStaleRequests(pool) {
    const res = await pool.query(
        `UPDATE governance_requests
         SET status = 'expired'
         WHERE status = 'pending' AND expires_at < NOW()
         RETURNING id`
    );

    if (res.rowCount > 0) {
        console.log(`[GOV-CRON] Expiradas ${res.rowCount} solicitudes: ${res.rows.map(r => r.id).join(', ')}`);
    }
    return res.rowCount;
}

/**
 * Identifica solicitudes que necesitan recordatorio (menos del 50% del tiempo restante).
 * Retorna lista de guardianes que aún no han votado.
 */
async function getPendingReminders(pool) {
    const govConfig = await _getGovConfig(pool);

    const reminderThreshold = new Date();
    reminderThreshold.setHours(reminderThreshold.getHours() + govConfig.reminderThresholdH);

    const res = await pool.query(
        `SELECT r.id, r.description, r.action_type, r.expires_at, r.requester_id,
                r.metadata,
                u.username AS requester_username
         FROM governance_requests r
         JOIN users u ON r.requester_id = u.id
         WHERE r.status = 'pending' AND r.expires_at <= $1 AND r.expires_at > NOW()`,
        [reminderThreshold]
    );

    const reminders = [];
    for (const request of res.rows) {
        const meta = request.metadata || {};
        const lastReminder = meta.last_reminder_sent_at ? new Date(meta.last_reminder_sent_at) : null;
        if (lastReminder) {
            const hoursSince = (Date.now() - lastReminder.getTime()) / (1000 * 60 * 60);
            if (hoursSince < govConfig.reminderCooldownH) continue;
        }

        const votedRes = await pool.query(
            `SELECT g.user_id FROM governance_votes v
             JOIN governance_guardians g ON v.guardian_id = g.id
             WHERE v.request_id = $1`,
            [request.id]
        );
        const votedUserIds = new Set(votedRes.rows.map(v => v.user_id));

        const pendingRes = await pool.query(
            `SELECT g.user_id, u.username
             FROM governance_guardians g
             JOIN users u ON g.user_id = u.id
             WHERE g.status = 'active'
               AND g.user_id != $1
               AND g.user_id NOT IN (SELECT unnest($2::int[]))`,
            [request.requester_id, [...votedUserIds]]
        );

        if (pendingRes.rowCount > 0) {
            await pool.query(
                `UPDATE governance_requests
                 SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{last_reminder_sent_at}', $2::jsonb)
                 WHERE id = $1`,
                [request.id, JSON.stringify(new Date().toISOString())]
            );

            reminders.push({
                request,
                pendingGuardians: pendingRes.rows,
            });
        }
    }

    return reminders;
}

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN 7: Cancelación durante ventana Time-Lock
// ════════════════════════════════════════════════════════════════════════════

/**
 * Cancela una solicitud de gobernanza. Soporta dos flujos:
 *
 *   1. Withdraw by Maker — El proponente retira su propia solicitud
 *      mientras está en estado 'pending' (antes de alcanzar quórum).
 *
 *   2. Time-Lock Cancel — Cualquier guardián activo cancela una
 *      solicitud 'approved' durante la ventana de Time-Lock (antes
 *      de que se ejecute automáticamente).
 */
async function cancelRequest(pool, req, requestId, guardianUserId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const guardian = await getGuardianByUserId(client, guardianUserId);
        if (!guardian || guardian.status !== 'active') {
            throw new Error('Solo guardianes activos pueden cancelar solicitudes.');
        }

        const reqRes = await client.query(
            `SELECT * FROM governance_requests
             WHERE id = $1 AND status IN ('pending', 'approved')
             FOR UPDATE`,
            [requestId]
        );

        if (reqRes.rowCount === 0) {
            throw new Error(
                'Solicitud no encontrada, ya ejecutada, expirada, o previamente cancelada.'
            );
        }

        const govRequest = reqRes.rows[0];
        let cancelReason = '';

        if (govRequest.status === 'pending') {
            if (govRequest.requester_id !== parseInt(guardianUserId, 10)) {
                throw new Error(
                    'Solo el proponente puede retirar una solicitud pendiente. ' +
                    'Si deseas bloquearla, emite tu voto de rechazo.'
                );
            }
            cancelReason = 'WITHDRAW_BY_MAKER';
        } else if (govRequest.status === 'approved') {
            if (!govRequest.execution_time || new Date(govRequest.execution_time) <= new Date()) {
                throw new Error(
                    'La ventana de cancelación (Time-Lock) ha expirado. La solicitud será ejecutada por el sistema.'
                );
            }
            cancelReason = 'TIMELOCK_CANCEL';
        }

        await client.query(
            `UPDATE governance_requests
             SET status = 'cancelled', cancelled_by = $1, cancelled_at = NOW(),
                 metadata = jsonb_set(COALESCE(metadata, '{}'), '{cancel_reason}', $2)
             WHERE id = $3`,
            [guardianUserId, JSON.stringify(cancelReason), requestId]
        );

        await logAuditEvent(client, req, {
            eventType: 'GOV_REQUEST_CANCELLED',
            actorId: parseInt(guardianUserId, 10),
            actorUsername: guardian.username,
            category: 'GOVERNANCE',
            metadata: {
                requestId,
                guardianRole: guardian.role,
                previousStatus: govRequest.status,
                cancelReason,
            },
        });

        await client.query('COMMIT');

        const msg = cancelReason === 'WITHDRAW_BY_MAKER'
            ? 'Solicitud retirada exitosamente. Puedes crear una nueva con los datos correctos.'
            : 'Solicitud cancelada exitosamente durante la ventana de Time-Lock.';

        return { status: 'cancelled', message: msg };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN 8: Break Glass — Recuperación de Emergencia
// ════════════════════════════════════════════════════════════════════════════

/**
 * Ejecuta el protocolo Break Glass.
 * Requiere M de N códigos de recuperación válidos.
 *
 * @param {string[]} codes - Los códigos de recuperación presentados
 * @param {{ action, guardians }} recoveryAction - Qué hacer: restablecer guardianes
 */
async function executeBreakGlass(pool, req, codes, recoveryAction) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Obtener todos los códigos válidos (no usados, no invalidados)
        const codesRes = await client.query(
            `SELECT id, code_index, code_hash, threshold
             FROM governance_recovery_codes
             WHERE is_used = FALSE AND invalidated_at IS NULL
             ORDER BY code_index`
        );

        if (codesRes.rowCount === 0) {
            throw new Error('No hay códigos de recuperación activos. El sistema requiere re-bootstrap manual.');
        }

        const threshold = codesRes.rows[0].threshold;

        if (!codes || codes.length < threshold) {
            throw new Error(
                `Se requieren al menos ${threshold} códigos válidos. Se presentaron ${(codes || []).length}.`
            );
        }

        // 2. Verificar cada código presentado
        const verifiedIndices = [];
        for (const code of codes) {
            const normalized = String(code).trim().toUpperCase();
            let matched = false;

            for (const stored of codesRes.rows) {
                if (verifiedIndices.includes(stored.code_index)) continue;

                const isValid = await bcrypt.compare(normalized, stored.code_hash);
                if (isValid) {
                    verifiedIndices.push(stored.code_index);
                    await client.query(
                        `UPDATE governance_recovery_codes
                         SET is_used = TRUE, used_at = NOW()
                         WHERE id = $1`,
                        [stored.id]
                    );
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                // Log del intento fallido y abortar la transacción
                await client.query('ROLLBACK');

                // Registrar el intento fallido fuera de la transacción (debe persistir)
                await pool.query(
                    `INSERT INTO governance_break_glass_log
                     (initiated_by, reason, action_taken, result, ip_address, user_agent, evidence)
                     VALUES ($1, $2, $3, 'failure', $4, $5, $6)`,
                    [
                        'unknown',
                        recoveryAction?.reason || 'Break Glass attempt',
                        'code_verification_failed',
                        req?.ip || 'unknown',
                        req?.headers?.['user-agent'] || 'unknown',
                        JSON.stringify({ invalidCodePresented: true, verifiedSoFar: verifiedIndices.length }),
                    ]
                );
                throw new Error('Uno o más códigos de recuperación son inválidos.');
            }
        }

        if (verifiedIndices.length < threshold) {
            throw new Error(
                `Solo ${verifiedIndices.length} códigos válidos. Se necesitan ${threshold}.`
            );
        }

        // 3. Ejecutar la acción de recuperación
        if (recoveryAction?.action === 'reset_guardians') {
            if (!recoveryAction.guardians || !Array.isArray(recoveryAction.guardians) || recoveryAction.guardians.length < 2) {
                throw new Error(
                    'Se requieren al menos 2 nuevos guardianes (con mínimo 2 supervisores) para restablecer el sistema.'
                );
            }

            const newSupervisors = recoveryAction.guardians.filter(g => g.role === 'supervisor');
            if (newSupervisors.length < 2) {
                throw new Error('Se requieren al menos 2 supervisores entre los nuevos guardianes.');
            }

            for (const g of recoveryAction.guardians) {
                if (!g.userId || !g.role || !['supervisor', 'auxiliary'].includes(g.role)) {
                    throw new Error('Cada guardián requiere userId (number) y role ("supervisor" o "auxiliary").');
                }
            }

            const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
            const userIdSet = new Set();

            for (const g of recoveryAction.guardians) {
                if (userIdSet.has(g.userId)) {
                    throw new Error(`Guardián duplicado: userId ${g.userId} aparece más de una vez.`);
                }
                userIdSet.add(g.userId);

                const userCheck = await client.query('SELECT id, username FROM users WHERE id = $1', [g.userId]);
                if (userCheck.rowCount === 0) {
                    throw new Error(`El usuario con ID ${g.userId} no existe en la base de datos.`);
                }
                if (userCheck.rows[0].username === platformUsername) {
                    throw new Error(
                        `La cuenta de sistema "${platformUsername}" no puede ser guardián. Solo personas reales.`
                    );
                }
            }

            await client.query(
                `UPDATE governance_guardians SET status = 'inactive', updated_at = NOW()`
            );

            for (const g of recoveryAction.guardians) {
                await client.query(
                    `INSERT INTO governance_guardians (user_id, role, status, appointed_by)
                     VALUES ($1, $2, 'active', NULL)
                     ON CONFLICT (user_id)
                     DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = NOW()`,
                    [g.userId, g.role]
                );
            }

            // Invalidar todos los códigos restantes (se deben regenerar)
            await client.query(
                `UPDATE governance_recovery_codes SET invalidated_at = NOW()
                 WHERE is_used = FALSE AND invalidated_at IS NULL`
            );

            // Generar nuevos códigos de recuperación
            const newCodes = await _generateRecoveryCodes(client, null);

            // Log de éxito
            await client.query(
                `INSERT INTO governance_break_glass_log
                 (initiated_by, reason, codes_used, action_taken, result, ip_address, user_agent, evidence)
                 VALUES ($1, $2, $3, $4, 'success', $5, $6, $7)`,
                [
                    'break_glass_protocol',
                    recoveryAction.reason || 'Emergency guardian reset',
                    verifiedIndices,
                    'reset_guardians',
                    req?.ip || 'unknown',
                    req?.headers?.['user-agent'] || 'unknown',
                    JSON.stringify({
                        previousGuardiansDeactivated: true,
                        newGuardiansCount: recoveryAction.guardians.length,
                        newRecoveryCodesGenerated: true,
                    }),
                ]
            );

            await client.query('COMMIT');

            return {
                status: 'success',
                message: 'Break Glass ejecutado. Guardianes restablecidos y nuevos códigos generados.',
                newRecoveryCodes: newCodes.plainCodes,
                warning: 'GUARDA ESTOS NUEVOS CÓDIGOS DE FORMA SEGURA. No se mostrarán de nuevo.',
            };
        }

        throw new Error('Acción de recuperación no reconocida.');

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Verifica el estado de salud del sistema de gobernanza.
 */
async function getSystemHealth(pool) {
    const guardians = await pool.query(
        `SELECT
            COUNT(*) FILTER (WHERE status = 'active') AS active,
            COUNT(*) FILTER (WHERE status = 'active' AND role = 'supervisor') AS active_supervisors,
            COUNT(*) FILTER (WHERE status = 'active' AND role = 'auxiliary') AS active_auxiliaries,
            COUNT(*) FILTER (WHERE status = 'active' AND webauthn_credential_id IS NOT NULL) AS with_webauthn
         FROM governance_guardians`
    );

    const pending = await pool.query(
        `SELECT COUNT(*) AS count FROM governance_requests WHERE status = 'pending'`
    );

    const timeLocked = await pool.query(
        `SELECT COUNT(*) AS count FROM governance_requests
         WHERE status = 'approved' AND execution_time IS NOT NULL AND execution_time > NOW()`
    );

    const recoveryCodes = await pool.query(
        `SELECT COUNT(*) FILTER (WHERE is_used = FALSE AND invalidated_at IS NULL) AS available
         FROM governance_recovery_codes`
    );

    const govConfig = await _getGovConfig(pool);
    const g = guardians.rows[0];
    const supThreshold = Math.ceil(parseInt(g.active_supervisors, 10) * govConfig.quorumFraction);

    return {
        isBootstrapped: parseInt(g.active, 10) > 0,
        guardians: {
            active: parseInt(g.active, 10),
            supervisors: parseInt(g.active_supervisors, 10),
            auxiliaries: parseInt(g.active_auxiliaries, 10),
            withWebAuthn: parseInt(g.with_webauthn, 10),
        },
        quorum: {
            supervisorThreshold: supThreshold,
            canReachQuorum: parseInt(g.active_supervisors, 10) >= supThreshold && supThreshold > 0,
            quorumPercentage: Math.round(govConfig.quorumFraction * 100),
        },
        pendingRequests: parseInt(pending.rows[0].count, 10),
        timeLockedRequests: parseInt(timeLocked.rows[0].count, 10),
        recoveryCodesAvailable: parseInt(recoveryCodes.rows[0].available, 10),
    };
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORTACIONES
// ════════════════════════════════════════════════════════════════════════════

module.exports = {
    // Bootstrap
    bootstrapGuardians,

    // Consultas
    getGuardians,
    getGuardianByUserId,
    getSystemHealth,

    // Solicitudes
    createRequest,
    getRequests,
    getRequestById,

    // Votación
    submitVote,

    // Ejecución (cron)
    processTimeLocked,
    expireStaleRequests,
    getPendingReminders,

    // Cancelación
    cancelRequest,

    // Break Glass
    executeBreakGlass,

    // Configuración dinámica
    _getGovConfig,
    GOV_DEFAULTS,

    // Constantes estáticas
    ACTION_TYPES,
    REQUEST_STATUS,
    RECOVERY_CODE_COUNT,
    RECOVERY_THRESHOLD,
};
