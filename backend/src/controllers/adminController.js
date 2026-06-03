/**
 * Controlador de Administración — WintonCoin
 * ══════════════════════════════════════════════════════════════════════════
 * Gestiona operaciones críticas del panel administrativo.
 *
 * Arquitectura:
 *   - Funciones individuales (NO clase) para evitar problemas de `this`
 *     binding al ser pasadas como callbacks en Express routes.
 *   - Cada función sigue el patrón (req, res) => {} de Express.
 *   - Todas las operaciones de escritura incluyen audit log.
 *   - Parámetros económicos protegidos por Governance Guard.
 *
 * Seguridad:
 *   - Queries parametrizadas (sin SQL injection)
 *   - Governance Guard: bloquea cambios directos si hay guardianes activos
 *   - Protección de cuentas de sistema (plataforma, admin)
 *   - Auditoría completa en cada operación
 * ══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const { logAuditEvent } = require('../services/auditService');
const boosterService = require('../services/boosterService');

// ─── Helper: Governance Guard ────────────────────────────────────────────
// Verifica si el sistema de gobernanza está activo.
// Si hay guardianes activos, los cambios en parámetros económicos deben
// pasar por el flujo Maker-Checker (Winton-Consensus).
async function _checkGovernanceActive() {
    try {
        const govCheck = await pool.query(
            `SELECT COUNT(*) as count FROM governance_guardians WHERE status = 'active'`
        );
        return parseInt(govCheck.rows[0].count, 10) > 0;
    } catch (err) {
        // Si la tabla no existe (42P01), gobernanza no está inicializada → no bloquear
        if (err.code === '42P01') return false;
        throw err;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Login de administrador.
 * Valida la contraseña contra env y emite JWT como cookie HttpOnly.
 */
function login(req, res) {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ message: "Se requiere la contraseña." });
    }

    if (password === process.env.ADMIN_PASSWORD) {
        // Generar JWT firmado con la clave secreta del admin
        const accessToken = jwt.sign(
            { name: 'admin' },
            process.env.ADMIN_SECRET_KEY,
            { expiresIn: '8h' }
        );

        // SEGURIDAD: Enviar el token como una cookie HttpOnly
        // (inaccesible desde JavaScript del cliente → previene XSS robo de token)
        res.cookie('admin_token', accessToken, {
            httpOnly: true,                                              // No accesible desde JS del cliente
            secure: process.env.NODE_ENV === 'production',               // Solo HTTPS en producción
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', // Cross-site en producción
            maxAge: 8 * 60 * 60 * 1000,                                  // 8 horas de validez
            path: '/'                                                    // Disponible en todas las rutas
        });

        return res.json({ message: "Login exitoso" });
    } else {
        return res.status(401).json({ message: "Contraseña incorrecta." });
    }
}

/**
 * Logout de administrador.
 * Limpia la cookie del token de admin.
 */
function logout(req, res) {
    res.clearCookie('admin_token', { path: '/' });
    res.json({ message: "Logout exitoso" });
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN (Settings)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene todas las configuraciones del sistema.
 */
async function getSettings(req, res) {
    try {
        const result = await pool.query(`SELECT * FROM app_settings ORDER BY setting_key`);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("[AdminController] Error al obtener configuraciones:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}

/**
 * Actualiza una configuración del sistema.
 * Protegido por Governance Guard: si hay guardianes activos, se rechaza.
 */
async function updateSetting(req, res) {
    const { key, value } = req.body;
    if (!key || typeof value !== 'string') {
        return res.status(400).json({ message: "Se requiere 'key' y 'value'." });
    }

    try {
        // GOVERNANCE GUARD: Bloquear si hay guardianes activos
        const isGovActive = await _checkGovernanceActive();
        if (isGovActive) {
            return res.status(403).json({
                message: `El sistema de gobernanza está activo. Los cambios deben ser aprobados por guardianes.`,
                governance_required: true,
                setting_key: key
            });
        }

        // FINTECH GUARD: Validación de modo pre-launch
        if (key === 'pre_launch_mode_enabled' && value === 'false') {
            // Aquí irían las validaciones de esquema (pre-condiciones de desactivación)
        }

        // Ejecutar la actualización
        const result = await pool.query(
            `UPDATE app_settings SET setting_value = $1 WHERE setting_key = $2 RETURNING *`,
            [value, key]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: `Configuración '${key}' no encontrada.` });
        }

        // Registrar evento de auditoría
        await logAuditEvent(pool, req, {
            eventType: 'admin.settings.updated',
            actorUsername: 'admin',
            category: 'admin',
            metadata: { setting_key: key, new_value: value }
        });

        res.status(200).json({ message: "Configuración actualizada.", setting: result.rows[0] });
    } catch (error) {
        console.error("[AdminController] Error al actualizar configuración:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GESTIÓN DE USUARIOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene la lista de usuarios con filtro de búsqueda y estado.
 */
async function getUsers(req, res) {
    const { search = '', status = '' } = req.query;
    try {
        let sql = `
            SELECT
                u.id, u.username, u.liquid_blue_balance, u.escrow_blue_balance,
                u.red_balance, u.account_status as status, u.average_rating,
                u.ratings_count, u.created_at, u.referral_code,
                COALESCE(SUM(bbl.amount), 0) as booster_blue_balance
            FROM users u
            LEFT JOIN booster_blue_ledger bbl ON u.id = bbl.user_id
            WHERE u.username ILIKE $1`;

        const params = [`%${search}%`];
        let paramIndex = 2;

        // Filtro opcional por estado de cuenta
        if (status) {
            sql += ` AND u.account_status = $${paramIndex++}`;
            params.push(status);
        }

        sql += ` GROUP BY u.id, u.username, u.liquid_blue_balance, u.escrow_blue_balance,
                 u.red_balance, u.account_status, u.average_rating, u.ratings_count,
                 u.created_at, u.referral_code
                 ORDER BY u.created_at DESC`;

        const result = await pool.query(sql, params);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("[AdminController] Error al obtener usuarios:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}

/**
 * Actualiza el estado de una cuenta de usuario.
 * Protege cuentas de sistema (plataforma, admin).
 */
async function updateUserStatus(req, res) {
    const { userId } = req.params;
    const { status } = req.body;
    const validStatuses = ['active', 'suspended', 'banned'];

    // Sanitización defensiva del userId (viene de URL params = siempre string)
    const safeUserId = parseInt(userId, 10);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
        return res.status(400).json({ message: 'ID de usuario inválido.' });
    }

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Estado no válido.' });
    }

    try {
        // Protección de cuentas del sistema
        const platformUsername = (process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin').toLowerCase();
        const adminUsername = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();

        const targetUser = await pool.query('SELECT username FROM users WHERE id = $1', [safeUserId]);
        if (!targetUser.rows.length) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const targetUsername = targetUser.rows[0].username.toLowerCase();
        if (targetUsername === platformUsername || targetUsername === adminUsername) {
            return res.status(403).json({ message: 'No se puede cambiar el estado de una cuenta protegida.' });
        }

        // Ejecutar la actualización
        const result = await pool.query(
            'UPDATE users SET account_status = $1 WHERE id = $2 RETURNING id, username, account_status as status',
            [status, safeUserId]
        );

        // Registrar evento de auditoría
        await logAuditEvent(pool, req, {
            eventType: 'admin.user.status_updated',
            actorUsername: 'admin',
            targetUsername: targetUser.rows[0].username,
            metadata: { new_status: status }
        });

        res.status(200).json({ message: `Estado actualizado a "${status}".`, user: result.rows[0] });
    } catch (error) {
        console.error("[AdminController] Error al actualizar estado de usuario:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}

/**
 * Obtiene la lista de deudores con deudas penalizadas activas.
 */
async function getDebtors(req, res) {
    try {
        const sql = `
            SELECT username, SUM(amount) AS total_penalized_debt, COUNT(*) AS penalized_debts_count
            FROM red_token_debts WHERE is_penalized = TRUE AND is_settled = FALSE
            GROUP BY username ORDER BY total_penalized_debt DESC
        `;
        const result = await pool.query(sql);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("[AdminController] Error al obtener deudores:", error);
        res.status(500).json({ message: "Error al obtener deudores." });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD Y ESTADÍSTICAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene las estadísticas generales del dashboard administrativo.
 * Usa Promise.all para paralelizar las consultas y minimizar latencia.
 */
async function getDashboardStats(req, res) {
    const client = await pool.connect();
    try {
        const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';

        // Ejecutar todas las consultas en paralelo para minimizar latencia
        const [usersData, publicationsData, tokensData, platformWalletData, boosterFundsData, platformEscrow, platformInProcess] = await Promise.all([
            client.query('SELECT COUNT(*) AS total_users FROM users WHERE username != $1', [platformUsername]),
            client.query(`
                SELECT COUNT(DISTINCT p.id) AS active_publications FROM publications p
                LEFT JOIN publication_acceptances pa ON p.id = pa.publication_id
                WHERE pa.status IS NULL OR pa.status != 'confirmed_paid'
            `),
            client.query(`
                SELECT
                    SUM(CASE WHEN username != $1 THEN liquid_blue_balance + escrow_blue_balance ELSE 0 END) AS users_total_blue,
                    SUM(red_balance) AS total_red
                FROM users
            `, [platformUsername]),
            client.query('SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1'),
            client.query('SELECT SUM(amount) AS total_booster_funds FROM booster_blue_ledger'),
            client.query(`
                SELECT COALESCE(SUM(p.available_slots * p.blue_cost), 0) AS total_platform_escrow
                FROM publications p
                JOIN users u ON p.author_id = u.id
                WHERE u.username = $1
                  AND p.deleted_at IS NULL
                  AND (p.expires_at IS NULL OR p.expires_at >= NOW())
                  AND p.available_slots > 0
                  AND COALESCE(p.is_paused, FALSE) = FALSE
            `, [platformUsername]),
            client.query(`
                SELECT COALESCE(SUM(p.blue_cost), 0) AS total_platform_in_process
                FROM publication_acceptances pa
                JOIN publications p ON pa.publication_id = p.id
                JOIN users u ON p.author_id = u.id
                WHERE u.username = $1
                  AND pa.status NOT IN ('confirmed_paid', 'rejected', 'cancelled', 'abandoned')
            `, [platformUsername])
        ]);

        const stats = {
            totalUsers:                parseInt(usersData.rows[0].total_users, 10),
            activePublications:        parseInt(publicationsData.rows[0].active_publications, 10),
            totalBlue:                 (parseFloat(tokensData.rows[0].users_total_blue) || 0) +
                                       (parseFloat(platformWalletData.rows[0]?.total_blue_commission_balance) || 0),
            totalRed:                  parseFloat(tokensData.rows[0].total_red) || 0,
            platformCommissionBalance: parseFloat(platformWalletData.rows[0]?.total_blue_commission_balance) || 0,
            totalBoosterFunds:         parseFloat(boosterFundsData.rows[0]?.total_booster_funds) || 0,
            totalPlatformEscrow:       parseFloat(platformEscrow.rows[0]?.total_platform_escrow) || 0,
            totalPlatformInProcess:    parseFloat(platformInProcess.rows[0]?.total_platform_in_process) || 0
        };

        res.status(200).json(stats);
    } catch (error) {
        console.error("[AdminController] Error al obtener estadísticas:", error);
        res.status(500).json({ message: "Error al obtener estadísticas." });
    } finally {
        client.release();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// BILLETERA DE PLATAFORMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene el balance de la billetera de plataforma.
 */
async function getPlatformWalletBalance(req, res) {
    const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
    const client = await pool.connect();
    try {
        const [commissionResult, userResult] = await Promise.all([
            client.query('SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1'),
            client.query('SELECT liquid_blue_balance, escrow_blue_balance, red_balance FROM users WHERE username = $1', [platformUsername])
        ]);

        if (userResult.rowCount === 0) {
            throw new Error(`El usuario de la plataforma '${platformUsername}' no fue encontrado.`);
        }

        res.json({
            commissionBalance: parseFloat(commissionResult.rows[0]?.total_blue_commission_balance || '0'),
            liquidBlue:        parseFloat(userResult.rows[0].liquid_blue_balance || '0'),
            escrowBlue:        parseFloat(userResult.rows[0].escrow_blue_balance || '0'),
            redBalance:        parseFloat(userResult.rows[0].red_balance || '0')
        });
    } catch (error) {
        console.error("[AdminController] Error al obtener balance de billetera:", error);
        res.status(500).json({ message: error.message });
    } finally {
        client.release();
    }
}

/**
 * Obtiene el log de comisiones de la plataforma.
 */
async function getPlatformWalletLog(req, res) {
    try {
        const query = `
            SELECT
                pcl.id, pcl.commission_amount_blue, pcl.created_at,
                p.id as publication_id, p.title as publication_title,
                u.username as user_who_paid
            FROM platform_commission_log pcl
            LEFT JOIN publications p ON pcl.related_publication_id = p.id
            LEFT JOIN transactions t ON pcl.related_user_transaction_id = t.id
            LEFT JOIN users u ON t.user_id = u.id
            ORDER BY pcl.created_at DESC LIMIT 100
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error("[AdminController] Error al obtener log de comisiones:", error);
        res.status(500).json({ message: "Error al obtener log de comisiones." });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GESTIÓN DE ETAPAS DE BOOSTER (MULTIPLICADORES)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene todas las etapas de configuración de multiplicadores.
 */
async function getBoosterStages(req, res) {
    try {
        const stages = await boosterService.getAllStages();
        res.json(stages);
    } catch (error) {
        console.error("[AdminController] Error al obtener etapas de booster:", error);
        res.status(500).json({ message: "Error al obtener etapas de booster." });
    }
}

/**
 * Guarda (crea o actualiza) una etapa de configuración de multiplicadores.
 *
 * Protegido por Governance Guard: si hay guardianes activos,
 * los cambios en multiplicadores deben pasar por Winton-Consensus.
 */
async function saveBoosterStage(req, res) {
    try {
        // ── GOVERNANCE GUARD ─────────────────────────────────────────
        // Los multiplicadores son parámetros económicos críticos.
        // Si el sistema de gobernanza está activo, CUALQUIER cambio
        // debe ser aprobado por el quórum de guardianes.
        const isGovActive = await _checkGovernanceActive();
        if (isGovActive) {
            return res.status(403).json({
                message: 'El sistema de gobernanza está activo. Los cambios en multiplicadores de etapas deben realizarse a través del panel de gobernanza (Winton-Consensus).',
                governance_required: true,
            });
        }

        // Delegar al servicio (incluye validación de no solapamiento)
        const stage = await boosterService.saveStage(req.body);

        // Registrar evento de auditoría
        await logAuditEvent(pool, req, {
            eventType: 'admin.booster_stage.saved',
            actorUsername: 'admin',
            category: 'admin',
            metadata: {
                stage_id:   stage.id,
                stage_name: stage.name,
                multiplier: parseFloat(stage.multiplier),
                start_date: stage.start_date,
                end_date:   stage.end_date,
                is_active:  stage.is_active
            }
        });

        res.json({ message: "Etapa de booster guardada.", stage });
    } catch (error) {
        console.error("[AdminController] Error al guardar etapa de booster:", error);
        // Si el error es de validación (solapamiento, datos inválidos, límites), devolver 400
        // Esto evita exponer errores internos al cliente y muestra mensajes descriptivos.
        const validationPatterns = ['Solapamiento', 'Faltan datos', 'multiplicador', 'fecha', 'exceder', 'inválido', 'positivo'];
        const isValidationError = validationPatterns.some(p => error.message.includes(p));
        if (isValidationError) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Error al guardar etapa de booster." });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDITORÍA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene el log de auditoría con filtros opcionales.
 */
async function getAuditLog(req, res) {
    try {
        const { eventType, actor, target, category, from, to, limit = '50', offset = '0' } = req.query;
        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
        const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

        // Construcción dinámica de query con filtros parametrizados
        let sql = 'SELECT * FROM audit_log WHERE 1=1';
        const params = [];
        let paramIdx = 1;

        if (eventType) { sql += ` AND event_type = $${paramIdx++}`; params.push(eventType); }
        if (actor)     { sql += ` AND actor_username ILIKE $${paramIdx++}`; params.push(`%${actor}%`); }
        if (target)    { sql += ` AND target_username ILIKE $${paramIdx++}`; params.push(`%${target}%`); }
        if (category)  { sql += ` AND category = $${paramIdx++}`; params.push(category); }
        if (from)      { sql += ` AND created_at >= $${paramIdx++}`; params.push(from); }
        if (to)        { sql += ` AND created_at <= $${paramIdx++}`; params.push(to); }

        sql += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
        params.push(safeLimit, safeOffset);

        const result = await pool.query(sql, params);
        res.json({ rows: result.rows, limit: safeLimit, offset: safeOffset });
    } catch (error) {
        console.error("[AdminController] Error al obtener log de auditoría:", error);
        res.status(500).json({ message: "Error al obtener log de auditoría." });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// BROADCAST EMAIL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea un correo de difusión masiva.
 * Crea una nueva difusión de correo masivo.
 * No envía los correos inmediatamente, sino que los encola para que processPendingBroadcasts los maneje.
 */
async function createBroadcastEmail(req, res) {
    const { subject, title, bodyHtml, targetGroup, targetUsername, buttonText, buttonUrl } = req.body;
    let adminId = req.user?.userId;
    let adminUsername = req.user?.username;

    // Si es un token de admin antiguo/simple ({ name: 'admin' }), buscamos el ID del usuario plataforma
    if (!adminId) {
        try {
            const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
            const platformUser = await pool.query('SELECT id, username FROM users WHERE username = $1', [platformUsername]);
            if (platformUser.rowCount > 0) {
                adminId = platformUser.rows[0].id;
                adminUsername = platformUser.rows[0].username;
            }
        } catch (err) {
            console.error("Error al buscar usuario admin de plataforma:", err);
        }
    }

    if (!adminId) {
        return res.status(401).json({ message: "No se pudo identificar al administrador para esta operación." });
    }

    if (!subject || !title || !bodyHtml || !targetGroup) {
        return res.status(400).json({ message: "Asunto, título, cuerpo y grupo objetivo son requeridos." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Crear el registro maestro del broadcast
        const broadcastResult = await client.query(
            `INSERT INTO email_broadcasts (admin_id, subject, title, body, target_group, target_username, button_text, button_url, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING id`,
            [adminId, subject, title, bodyHtml, targetGroup, targetUsername || null, buttonText || null, buttonUrl || null]
        );
        const broadcastId = broadcastResult.rows[0].id;

        // 2. Identificar destinatarios según el filtro
        let userQuery = 'SELECT id, email FROM users WHERE email IS NOT NULL';
        let queryParams = [];

        if (targetGroup === 'verified') {
            userQuery += ' AND is_verified = true';
        } else if (targetGroup === 'booster') {
            userQuery += ' AND is_booster = true';
        } else if (targetGroup === 'specific') {
            userQuery += ' AND username = $1';
            queryParams.push(targetUsername);
        }

        const usersResult = await client.query(userQuery, queryParams);

        if (usersResult.rowCount === 0) {
            throw { status: 400, message: "No se encontraron usuarios que cumplan con los criterios del filtro." };
        }

        // 3. Poblar la tabla de destinatarios pendientes (Bulk Insert optimizado por lotes)
        const USERS_BATCH_SIZE = 1000;
        for (let i = 0; i < usersResult.rows.length; i += USERS_BATCH_SIZE) {
            const batchRows = usersResult.rows.slice(i, i + USERS_BATCH_SIZE);
            const values = [];
            const placeholders = [];
            batchRows.forEach((user, index) => {
                const offset = index * 2;
                values.push(broadcastId, user.id);
                placeholders.push(`($${offset + 1}, $${offset + 2}, 'pending')`);
            });

            const bulkInsertQuery = `
                INSERT INTO email_broadcast_recipients (broadcast_id, user_id, status)
                VALUES ${placeholders.join(',')}
            `;
            await client.query(bulkInsertQuery, values);
        }

        // 4. Actualizar total de destinatarios en el maestro
        await client.query('UPDATE email_broadcasts SET total_recipients = $1 WHERE id = $2', [usersResult.rowCount, broadcastId]);

        // 5. Registrar en el log de auditoría
        await logAuditEvent(client, req, {
            eventType: 'admin.email_broadcast.created',
            actorUsername: adminUsername,
            metadata: {
                broadcast_id: broadcastId,
                target_group: targetGroup,
                recipients_count: usersResult.rowCount,
                subject: subject
            }
        });

        await client.query('COMMIT');
        res.json({
            success: true,
            message: `Difusión programada correctamente para ${usersResult.rowCount} usuarios.`,
            broadcast_id: broadcastId
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al crear difusión de correo:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno al programar la difusión.' });
    } finally {
        client.release();
    }
}

/**
 * Obtiene la lista de difusiones para auditoría y monitoreo.
 */
async function getBroadcastEmails(req, res) {
    try {
        const result = await pool.query(`
            SELECT b.*, u.username as admin_username 
            FROM email_broadcasts b
            JOIN users u ON b.admin_id = u.id
            ORDER BY b.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error("[AdminController] Error al obtener difusiones:", error);
        res.status(500).json({ message: "Error al obtener difusiones." });
    }
}

/**
 * Obtiene los detalles de destinatarios de una difusión específica.
 */
async function getBroadcastRecipients(req, res) {
    const { id } = req.params;
    
    // Sanitización de seguridad: asegurar que ID es un entero positivo
    const safeId = parseInt(id, 10);
    if (!Number.isFinite(safeId) || safeId <= 0) {
        return res.status(400).json({ message: 'ID de difusión inválido.' });
    }

    try {
        const result = await pool.query(`
            SELECT r.*, u.email, u.username
            FROM email_broadcast_recipients r
            JOIN users u ON r.user_id = u.id
            WHERE r.broadcast_id = $1
            ORDER BY r.sent_at DESC NULLS LAST
        `, [safeId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener destinatarios de difusión:', error);
        res.status(500).json({ message: 'Error interno al consultar destinatarios.' });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTACIÓN DE MÓDULO
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
    login,
    logout,
    getSettings,
    updateSetting,
    getUsers,
    updateUserStatus,
    getDebtors,
    getDashboardStats,
    getPlatformWalletBalance,
    getPlatformWalletLog,
    getBoosterStages,
    saveBoosterStage,
    getAuditLog,
    createBroadcastEmail,
    getBroadcastEmails,
    getBroadcastRecipients,
};
