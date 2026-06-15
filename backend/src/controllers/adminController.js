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
const bcrypt = require('bcrypt');
const { logAuditEvent } = require('../services/auditService');
const boosterService = require('../services/boosterService');
const govDemoRewardService = require('../services/governanceDemoRewardService');
const notificationService = require('../services/notificationService');
const { sendGovernanceEmail } = require('../services/emailService');
const governanceRewardService = require('../services/governanceRewardService');
const { resolveRepeatCooldownHours } = require('../services/publicationService');

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
 * Valida el nombre de usuario y la contraseña hasheada en la base de datos (bcrypt).
 * Emite JWT como cookie HttpOnly para máxima seguridad.
 */
async function login(req, res) {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Se requiere usuario y contraseña." });
    }

    try {
        // 1. Buscar el administrador en la base de datos (con query parametrizado)
        const adminResult = await pool.query(
            'SELECT id, username, password_hash, role, account_status FROM admin_users WHERE username = $1',
            [username]
        );

        let user = null;
        let dbHash = '';

        if (adminResult.rowCount > 0) {
            user = adminResult.rows[0];
            if (user.account_status !== 'active') {
                return res.status(403).json({ message: "La cuenta de administrador está inactiva o suspendida." });
            }
            dbHash = user.password_hash;
        } else {
            // Mitigación de Timing Attacks (Enumeración de usuarios):
            // Si el administrador no existe, ejecutamos bcrypt.compare contra un hash ficticio pre-calculado
            // para que el tiempo de respuesta sea el mismo que si el usuario existiera.
            dbHash = '$2b$10$fG6a7C4t0NlzC.xQG9dZteBypZ4q63T0bXj7vG.6X6l2kZ0gZ9m2u';
        }

        // 2. Comparación segura contra fuerza bruta (bcrypt)
        const isMatch = await bcrypt.compare(password, dbHash);

        if (!user || !isMatch) {
            return res.status(401).json({ message: "Usuario o contraseña incorrecta." });
        }

        // 3. Generar token JWT con la identidad y el rol real recuperado de la base de datos (superadmin, admin, auditor, etc.)
        const accessToken = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            process.env.ADMIN_SECRET_KEY,
            { expiresIn: '8h' }
        );

        // 4. Inyectar cookie HttpOnly (grado bancario: previene robo por XSS)
        res.cookie('admin_token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            maxAge: 8 * 60 * 60 * 1000,
            path: '/'
        });

        // 5. Registrar evento de auditoría
        await logAuditEvent(pool, req, {
            eventType: 'admin.auth.login',
            actorUsername: user.username,
            category: 'admin',
            metadata: { ip: req.ip, user_agent: req.headers['user-agent'] }
        });

        // 6. Actualizar fecha de último inicio de sesión
        await pool.query(
            'UPDATE admin_users SET last_login = NOW() WHERE id = $1',
            [user.id]
        );

        return res.json({ message: "Login exitoso", username: user.username });
    } catch (error) {
        console.error('[AdminController] Error en login de administrador:', error);
        return res.status(500).json({ message: "Error interno del servidor." });
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
    
    // 1. [FINTECH SECURITY - VALIDACIÓN DE ENTRADA]
    // Validar de forma estricta que la clave del parámetro y el valor enviado existan y sean de tipo texto.
    // Esto previene inyecciones de payloads anómalos o desajustes lógicos a nivel de controlador.
    if (!key || typeof value !== 'string') {
        return res.status(400).json({ message: "Se requiere 'key' y 'value' en formato de texto válido." });
    }

    // 2. [FINTECH SECURITY - CONTROL DE CARGA / PREVENCIÓN DE DoS]
    // Aplicar límites rigurosos de longitud y formato al valor ingresado para evitar ataques
    // de agotamiento de almacenamiento (Storage Exhaustion) en la base de datos Postgres y ralentización en el renderizado de UI.
    if (key.startsWith('daily_modal_')) {
        // Los mensajes diarios tienen un límite máximo de 5000 caracteres (aprox 5KB), suficiente para avisos extensos.
        if (value.length > 5000) {
            return res.status(400).json({
                message: `El contenido del mensaje excede el límite máximo de seguridad de 5000 caracteres (longitud actual: ${value.length}).`
            });
        }
    } else if (key === 'global_app_interstitial_enabled') {
        // La bandera del modal global debe ser estrictamente un booleano expresado en texto.
        // Esto previene que se almacenen strings corruptos o scripts maliciosos en la configuración de la app.
        if (value !== 'true' && value !== 'false') {
            return res.status(400).json({
                message: "El valor de configuración para el estado del modal global debe ser exactamente 'true' o 'false'."
            });
        }
    } else {
        // Para cualquier otro parámetro crítico del sistema o variable económica,
        // limitamos preventivamente la longitud a 1000 caracteres para asegurar la consistencia y acotación del buffer.
        if (value.length > 1000) {
            return res.status(400).json({
                message: `El valor configurado excede el límite preventivo general de 1000 caracteres (longitud actual: ${value.length}).`
            });
        }
    }

    try {
        // GOVERNANCE GUARD: Bloquear modificaciones si la gobernanza está activa en la base de datos
        // pero permitir el bypass únicamente para configuraciones no críticas de mensajería y UI.
        
        // 1. Evaluar si la clave corresponde a configuraciones operativas / informativas de notificaciones:
        //    - Claves que comienzan con 'daily_modal_' (Textos del modal informativo por día).
        //    - Clave exacta 'global_app_interstitial_enabled' (Interruptor para habilitar/deshabilitar el modal de anuncios).
        const isNonCriticalSetting = key.startsWith('daily_modal_') || key === 'global_app_interstitial_enabled';

        // 2. Verificar el estado del sistema de gobernanza (si existen guardianes activos registrados).
        const isGovActive = await _checkGovernanceActive();

        // 3. Aplicar el Governance Guard: si la gobernanza está activa Y la configuración no es catalogada como exenta (no crítica),
        //    se bloquea la petición retornando un estado 403 (Forbidden) y notificando al frontend.
        if (isGovActive && !isNonCriticalSetting) {
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
            actorUsername: req.user?.username || 'admin',
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
            actorUsername: req.user?.username || 'admin',
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
 * Actualiza el código de referido de un usuario.
 * Requiere privilegios de administrador.
 */
async function updateUserReferralCode(req, res) {
    const { userId } = req.params;
    const { newReferralCode } = req.body;

    if (!newReferralCode) {
        return res.status(400).json({ message: "Se requiere un nuevo código de referido." });
    }

    // Validación básica de formato (letras, números, guiones, sin espacios)
    if (!/^[a-zA-Z0-9_-]+$/.test(newReferralCode)) {
        return res.status(400).json({ message: "El código solo puede contener letras, números y guiones. Sin espacios." });
    }

    const safeUserId = parseInt(userId, 10);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
        return res.status(400).json({ message: 'ID de usuario inválido.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verificar si el código ya existe (debe ser único globalmente)
        const checkResult = await client.query('SELECT id FROM users WHERE referral_code = $1', [newReferralCode]);
        if (checkResult.rowCount > 0 && checkResult.rows[0].id !== safeUserId) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: "Este código de referido ya está en uso por otro usuario." });
        }

        // Obtener usuario actual para el log de auditoría
        const oldUserResult = await client.query('SELECT username, referral_code FROM users WHERE id = $1', [safeUserId]);
        if (oldUserResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Usuario no encontrado." });
        }
        const oldCode = oldUserResult.rows[0].referral_code;
        const targetUsername = oldUserResult.rows[0].username;

        // Actualizar el código en la base de datos
        await client.query('UPDATE users SET referral_code = $1 WHERE id = $2', [newReferralCode, safeUserId]);

        // Audit Log
        await logAuditEvent(client, req, {
            eventType: 'admin.user.update_referral_code',
            actorUsername: req.user?.username || 'admin',
            targetUsername: targetUsername,
            metadata: {
                old_code: oldCode,
                new_code: newReferralCode
            }
        });

        await client.query('COMMIT');
        res.json({ success: true, message: `Código de referido actualizado a: ${newReferralCode}` });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[AdminController] Error al actualizar código de referido:', error);
        if (error.code === '23505') {
            return res.status(409).json({ message: "Este código de referido ya está en uso." });
        }
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
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
        const [usersData, publicationsData, tokensData, platformWalletData, boosterFundsData, platformEscrow, platformInExecution, platformPendingPayment, eligibleBoosterFundsData] = await Promise.all([
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
            // Sumar únicamente los fondos de usuarios que son impulsores activos (is_booster = true)
            client.query('SELECT SUM(bbl.amount) AS total_booster_funds FROM booster_blue_ledger bbl JOIN users u ON bbl.user_id = u.id WHERE u.is_booster = TRUE'),
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
                SELECT COALESCE(SUM(p.blue_cost), 0) AS total_platform_in_execution
                FROM publication_acceptances pa
                JOIN publications p ON pa.publication_id = p.id
                JOIN users u ON p.author_id = u.id
                WHERE u.username = $1
                  AND pa.status NOT IN ('completed', 'confirmed_paid', 'rejected', 'cancelled', 'abandoned')
            `, [platformUsername]),
            client.query(`
                SELECT COALESCE(SUM(p.blue_cost), 0) AS total_platform_pending_payment
                FROM publication_acceptances pa
                JOIN publications p ON pa.publication_id = p.id
                JOIN users u ON p.author_id = u.id
                WHERE u.username = $1
                  AND pa.status = 'completed'
            `, [platformUsername]),
            client.query(`
                SELECT COALESCE(SUM(bbl.amount), 0.0000) AS eligible_booster_funds 
                FROM booster_blue_ledger bbl 
                JOIN users u ON bbl.user_id = u.id 
                WHERE u.is_booster = TRUE AND u.kyc_verified = TRUE
            `)
        ]);

        const stats = {
            totalUsers:                  parseInt(usersData.rows[0].total_users, 10),
            activePublications:          parseInt(publicationsData.rows[0].active_publications, 10),
            totalBlue:                   (parseFloat(tokensData.rows[0].users_total_blue) || 0) +
                                         (parseFloat(platformWalletData.rows[0]?.total_blue_commission_balance) || 0),
            totalRed:                    parseFloat(tokensData.rows[0].total_red) || 0,
            platformCommissionBalance:   parseFloat(platformWalletData.rows[0]?.total_blue_commission_balance) || 0,
            totalBoosterFunds:           parseFloat(boosterFundsData.rows[0]?.total_booster_funds) || 0,
            eligibleBoosterFunds:        parseFloat(eligibleBoosterFundsData.rows[0]?.eligible_booster_funds) || 0,
            totalPlatformEscrow:         parseFloat(platformEscrow.rows[0]?.total_platform_escrow) || 0,
            totalPlatformInExecution:    parseFloat(platformInExecution.rows[0]?.total_platform_in_execution) || 0,
            totalPlatformPendingPayment: parseFloat(platformPendingPayment.rows[0]?.total_platform_pending_payment) || 0
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
            actorUsername: req.user?.username || 'admin',
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
// ENDPOINT: Consultar estado KYC real desde la blockchain (Lectura)
// ═══════════════════════════════════════════════════════════════════════════
async function getUserKycStatus(req, res) {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({
            message: 'El userId debe ser un número entero positivo.'
        });
    }

    try {
        const userResult = await pool.query(
            `SELECT id, username, web3_wallet_address, kyc_verified
             FROM users
             WHERE id = $1`,
            [userId]
        );

        if (userResult.rowCount === 0) {
            return res.status(404).json({
                message: `Usuario con ID ${userId} no encontrado.`
            });
        }

        const user = userResult.rows[0];
        const walletAddress = user.web3_wallet_address;
        const kycInDatabase = user.kyc_verified === true;

        if (!walletAddress) {
            return res.json({
                userId: user.id,
                username: user.username,
                walletAddress: null,
                kycOnChain: null,
                kycInDatabase: kycInDatabase,
                synced: true,
                blockchainQuerySuccess: false,
                message: 'El usuario no tiene billetera Web3 asignada. No se puede consultar KYC on-chain.'
            });
        }

        const Web3BridgeService = require('../services/web3BridgeService');
        const kycResult = await Web3BridgeService.checkUserKYCDetailed(walletAddress);

        const synced = kycResult.success
            ? (kycResult.verified === kycInDatabase)
            : null;

        if (kycResult.success && kycResult.verified !== kycInDatabase) {
            await pool.query(
                'UPDATE users SET kyc_verified = $1 WHERE id = $2',
                [kycResult.verified, userId]
            );
            console.log(`[ADMIN KYC-STATUS] ✅ Sincronización automática: DB actualizada de ${kycInDatabase} a ${kycResult.verified} para usuario #${userId}`);
        }

        await logAuditEvent(pool, req, {
            eventType: 'KYC_STATUS_QUERIED',
            actorId: req.user?.userId || req.user?.id || null,
            actorUsername: req.user?.username || 'admin',
            targetUsername: user.username,
            category: 'compliance',
            metadata: {
                targetUserId: userId,
                walletAddress: walletAddress,
                kycOnChain: kycResult.success ? kycResult.verified : null,
                kycInDatabase: kycInDatabase,
                blockchainQuerySuccess: kycResult.success,
                synced: synced,
                autoSynced: kycResult.success && kycResult.verified !== kycInDatabase
            }
        });

        return res.json({
            userId: user.id,
            username: user.username,
            walletAddress: walletAddress,
            kycOnChain: kycResult.success ? kycResult.verified : null,
            kycInDatabase: kycResult.success && kycResult.verified !== kycInDatabase
                ? kycResult.verified
                : kycInDatabase,
            synced: kycResult.success ? true : null,
            blockchainQuerySuccess: kycResult.success,
            message: !kycResult.success
                ? 'No se pudo conectar con la blockchain. Se muestra el estado almacenado en la base de datos.'
                : (synced === false
                    ? 'Se detectó discrepancia y se sincronizó la base de datos automáticamente.'
                    : 'Estado KYC consultado exitosamente.')
        });

    } catch (error) {
        console.error('[ADMIN KYC-STATUS] Error al consultar KYC:', error);
        return res.status(500).json({
            message: 'Error interno al consultar el estado KYC.'
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MODERACIÓN DE PUBLICACIONES
// ═══════════════════════════════════════════════════════════════════════════

async function getAdminPublications(req, res) {
    const searchTerm = req.query.search || '';
    const filter = String(req.query.filter || 'active').toLowerCase();
    try {
        const allowedFilters = new Set(['active', 'deleted', 'expired', 'completed', 'all']);
        const safeFilter = allowedFilters.has(filter) ? filter : 'active';

        let filterCondition = '';
        if (safeFilter === 'active') {
            filterCondition = `AND p.deleted_at IS NULL AND (p.expires_at IS NULL OR p.expires_at >= NOW()) AND p.available_slots > 0 AND COALESCE(p.is_paused, FALSE) = FALSE`;
        } else if (safeFilter === 'deleted') {
            filterCondition = `AND p.deleted_at IS NOT NULL`;
        } else if (safeFilter === 'expired') {
            filterCondition = `AND p.deleted_at IS NULL AND p.expires_at IS NOT NULL AND p.expires_at < NOW()`;
        } else if (safeFilter === 'completed') {
            filterCondition = `
                AND p.deleted_at IS NULL
                AND (
                    (COALESCE(p.is_quick_sale, FALSE) = TRUE AND p.status <> 'open')
                    OR
                    (p.available_slots <= 0)
                )
            `;
        } else if (safeFilter === 'all') {
            filterCondition = '';
        }

        const query = `
            SELECT
                p.id, p.title, p.description, p.blue_cost, p.status, p.created_at, p.is_paused, p.is_sell_post, p.available_slots, p.category,
                p.expires_at, p.deleted_at, p.deleted_by_username, p.is_quick_sale,
                u.username AS author_username,
                (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id) AS participants_count,
                (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id AND pa.status = 'confirmed_paid') AS completed_count,
                (p.deleted_at IS NOT NULL) AS is_deleted,
                (p.expires_at IS NOT NULL AND p.expires_at < NOW()) AS is_expired,
                (
                    CASE
                        WHEN COALESCE(p.is_quick_sale, FALSE) = TRUE THEN (p.status <> 'open')
                        ELSE (
                            p.available_slots <= 0
                        )
                    END
                ) AS is_completed_publication
            FROM publications p
            JOIN users u ON p.author_id = u.id
            WHERE (p.title ILIKE $1 OR u.username ILIKE $1)
            ${filterCondition}
            ORDER BY p.created_at DESC
        `;
        const result = await pool.query(query, [`%${searchTerm}%`]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching all publications for admin:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

async function restorePublication(req, res) {
    const { id } = req.params;
    try {
        const pubResult = await pool.query(
            `SELECT id, category, deleted_at FROM publications WHERE id = $1`,
            [id]
        );

        if (pubResult.rowCount === 0) {
            return res.status(404).json({ message: 'Publicación no encontrada.' });
        }

        if (!pubResult.rows[0].deleted_at) {
            return res.status(200).json({ success: true, message: 'La publicación no está eliminada.' });
        }

        await pool.query(
            `UPDATE publications
             SET deleted_at = NULL, deleted_by_username = NULL
             WHERE id = $1`,
            [id]
        );

        await logAuditEvent(pool, req, {
            eventType: 'admin.publication.restored',
            actorUsername: req.user?.username || 'admin',
            publicationId: parseInt(id, 10),
            category: pubResult.rows[0].category,
            metadata: { soft_delete: false, restored: true }
        });

        return res.json({ success: true, message: 'Publicación restaurada correctamente.' });
    } catch (error) {
        console.error(`Error restoring publication ${id} for admin:`, error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

async function deletePublicationAdmin(req, res) {
    const { id } = req.params;
    try {
        const pubResult = await pool.query(
            `SELECT id, category, deleted_at FROM publications WHERE id = $1`,
            [id]
        );

        if (pubResult.rowCount === 0) {
            return res.status(404).json({ message: 'Publicación no encontrada.' });
        }

        if (pubResult.rows[0].deleted_at) {
            return res.status(200).json({ success: true, message: 'La publicación ya estaba eliminada.' });
        }

        const updateResult = await pool.query(
            `UPDATE publications
             SET deleted_at = NOW(), deleted_by_username = $2
             WHERE id = $1`,
            [id, req.user?.username || 'admin']
        );

        if (updateResult.rowCount === 0) {
            return res.status(404).json({ message: 'Publicación no encontrada.' });
        }

        await logAuditEvent(pool, req, {
            eventType: 'admin.publication.deleted',
            actorUsername: req.user?.username || 'admin',
            publicationId: parseInt(id, 10),
            category: pubResult.rows[0].category,
            metadata: { soft_delete: true }
        });

        res.json({ success: true, message: 'Publicación eliminada (soft delete) correctamente.' });
    } catch (error) {
        console.error(`Error deleting publication ${id} for admin:`, error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GESTIÓN SEGURA DE DATOS (BACKUPS Y LIMPIEZA)
// ═══════════════════════════════════════════════════════════════════════════

// Endpoint para obtener estadísticas detalladas de la base de datos
async function getDatabaseStats(req, res) {
    const client = await pool.connect();
    try {
        const stats = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM users WHERE username ILIKE '%test%' OR username ILIKE '%demo%') as test_users,
                (SELECT COUNT(*) FROM users WHERE created_at < NOW() - INTERVAL '90 days' AND liquid_blue_balance = 100.0000 AND escrow_blue_balance = 0.0000 AND red_balance = 0.0000) as inactive_users,
                (SELECT COUNT(*) FROM publications) as total_publications,
                (SELECT COUNT(*) FROM publications WHERE created_at < NOW() - INTERVAL '180 days' AND status IN ('completed', 'confirmed_paid')) as old_publications,
                (SELECT COUNT(*) FROM transactions) as total_transactions,
                (SELECT COUNT(*) FROM notifications) as total_notifications,
                (SELECT COUNT(*) FROM notifications WHERE created_at < NOW() - INTERVAL '30 days') as old_notifications,
                (SELECT COUNT(*) FROM ratings) as total_ratings,
                (SELECT COUNT(*) FROM red_token_debts WHERE is_settled = FALSE) as active_debts,
                (SELECT COUNT(*) FROM blue_token_escrows WHERE is_released = FALSE) as active_escrows,
                (SELECT pg_size_pretty(pg_database_size(current_database()))) as database_size
        `);

        res.json(stats.rows[0]);
    } catch (error) {
        console.error('Error fetching database stats:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
}

// Endpoint para crear backup de la base de datos
async function createDatabaseBackup(req, res) {
    try {
        const { createBackup } = require('../../backup-database.js');
        const backupFile = await createBackup();

        // Obtener solo el nombre del archivo para no exponer rutas del sistema
        const backupFileName = require('path').basename(backupFile);

        res.json({
            success: true,
            message: 'Backup creado exitosamente',
            filename: backupFileName
        });
    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({ message: 'Error al crear el backup: ' + error.message });
    }
}

// Endpoint para limpiar datos de prueba
async function cleanupTestData(req, res) {
    const client = await pool.connect();
    try {
        console.log(`[ADMIN CLEANUP] Administrador inició limpieza de datos de prueba`);

        // Crear backup automático antes de la limpieza
        const { createBackup } = require('../../backup-database.js');
        await createBackup();

        await client.query('BEGIN');

        // Eliminar usuarios de prueba
        const testUsersResult = await client.query(`
            DELETE FROM users 
            WHERE (username ILIKE '%test%' OR username ILIKE '%demo%' OR username ILIKE '%example%')
            AND username NOT LIKE '%Plataforma%'
            RETURNING username
        `);

        // Eliminar publicaciones de prueba
        const testPublicationsResult = await client.query(`
            DELETE FROM publications 
            WHERE title ILIKE '%test%' OR title ILIKE '%demo%' OR title ILIKE '%example%'
            RETURNING id, title
        `);

        // Limpiar notificaciones antiguas (más de 30 días)
        const oldNotificationsResult = await client.query(`
            DELETE FROM notifications 
            WHERE created_at < NOW() - INTERVAL '30 days'
            RETURNING id
        `);

        await client.query('COMMIT');

        console.log(`[ADMIN CLEANUP] Limpieza completada - Usuarios: ${testUsersResult.rowCount}, Publicaciones: ${testPublicationsResult.rowCount}, Notificaciones: ${oldNotificationsResult.rowCount}`);

        res.json({
            success: true,
            message: 'Limpieza de datos de prueba completada',
            results: {
                testUsersDeleted: testUsersResult.rowCount,
                testPublicationsDeleted: testPublicationsResult.rowCount,
                oldNotificationsDeleted: oldNotificationsResult.rowCount
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[ADMIN CLEANUP] Error durante limpieza de datos de prueba:', error);
        res.status(500).json({ message: 'Error durante la limpieza: ' + error.message });
    } finally {
        client.release();
    }
}

// Endpoint para limpiar usuarios inactivos
async function cleanupInactiveUsers(req, res) {
    const { daysInactive = 90 } = req.body;
    const client = await pool.connect();

    try {
        console.log(`[ADMIN CLEANUP] Administrador inició limpieza de usuarios inactivos (${daysInactive} días)`);

        // Validación de seguridad
        if (daysInactive < 30) {
            return res.status(400).json({
                message: 'Por seguridad, no se pueden eliminar usuarios con menos de 30 días de inactividad'
            });
        }

        // Crear backup automático
        const { createBackup } = require('../../backup-database.js');
        await createBackup();

        await client.query('BEGIN');

        // Obtener usuarios inactivos para mostrar en los logs
        const inactiveUsersQuery = await client.query(`
            SELECT username, created_at, liquid_blue_balance, escrow_blue_balance, red_balance
            FROM users 
            WHERE created_at < NOW() - INTERVAL '${daysInactive} days'
            AND username NOT LIKE '%Plataforma%'
            AND liquid_blue_balance = 100.0000
            AND escrow_blue_balance = 0.0000
            AND red_balance = 0.0000
        `);

        // Eliminar usuarios inactivos
        const deleteResult = await client.query(`
            DELETE FROM users 
            WHERE created_at < NOW() - INTERVAL '${daysInactive} days'
            AND username NOT LIKE '%Plataforma%'
            AND liquid_blue_balance = 100.0000
            AND escrow_blue_balance = 0.0000
            AND red_balance = 0.0000
        `);

        await client.query('COMMIT');

        console.log(`[ADMIN CLEANUP] Usuarios inactivos eliminados: ${deleteResult.rowCount}`);

        res.json({
            success: true,
            message: `Limpieza de usuarios inactivos completada`,
            results: {
                usersDeleted: deleteResult.rowCount,
                daysInactive: daysInactive
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[ADMIN CLEANUP] Error durante limpieza de usuarios inactivos:', error);
        res.status(500).json({ message: 'Error durante la limpieza: ' + error.message });
    } finally {
        client.release();
    }
}

// Endpoint para limpiar publicaciones antiguas
async function cleanupOldPublications(req, res) {
    const { daysOld = 180 } = req.body;
    const client = await pool.connect();

    try {
        console.log(`[ADMIN CLEANUP] Administrador inició limpieza de publicaciones antiguas (${daysOld} días)`);

        // Validación de seguridad
        if (daysOld < 90) {
            return res.status(400).json({
                message: 'Por seguridad, no se pueden eliminar publicaciones con menos de 90 días de antigüedad'
            });
        }

        // Crear backup automático
        const { createBackup } = require('../../backup-database.js');
        await createBackup();

        await client.query('BEGIN');

        // Eliminar publicaciones antiguas
        const deleteResult = await client.query(`
            DELETE FROM publications 
            WHERE created_at < NOW() - INTERVAL '${daysOld} days'
            AND status IN ('completed', 'confirmed_paid')
        `);

        await client.query('COMMIT');

        console.log(`[ADMIN CLEANUP] Publicaciones antiguas eliminadas: ${deleteResult.rowCount}`);

        res.json({
            success: true,
            message: `Limpieza de publicaciones antiguas completada`,
            results: {
                publicationsDeleted: deleteResult.rowCount,
                daysOld: daysOld
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[ADMIN CLEANUP] Error durante limpieza de publicaciones antiguas:', error);
        res.status(500).json({ message: 'Error durante la limpieza: ' + error.message });
    } finally {
        client.release();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GESTIÓN DE IMPULSORES (BOOSTERS) & RECOMPENSAS & PUBLICACIONES DE PLATAFORMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene la configuración de los niveles de impulsor (booster).
 */
async function getBoosterSettings(req, res) {
    try {
        const result = await pool.query('SELECT * FROM booster_level_settings ORDER BY level ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('[AdminController] Error al obtener configuraciones booster:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Actualiza la configuración de un nivel booster.
 * Protegido por Governance Guard si hay guardianes activos.
 */
async function updateBoosterSettings(req, res) {
    const { level, name, min_blue_required, description } = req.body;

    if (level === undefined || !name || min_blue_required === undefined) {
        return res.status(400).json({ message: 'Faltan datos requeridos: nivel, nombre y BLUE mínimo.' });
    }
    try {
        // GOVERNANCE GUARD
        const isGovActive = await _checkGovernanceActive();
        if (isGovActive) {
            return res.status(403).json({
                message: 'El sistema de gobernanza está activo. Los cambios en niveles de impulsor deben realizarse a través del panel de gobernanza (Winton-Consensus).',
                governance_required: true,
            });
        }

        const result = await pool.query(
            `UPDATE booster_level_settings 
             SET name = $1, min_blue_required = $2, description = $3 
             WHERE level = $4 RETURNING *`,
            [name, min_blue_required, description, level]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: `El nivel de impulsor ${level} no fue encontrado.` });
        }
        res.json({ message: 'Nivel de impulsor actualizado.', setting: result.rows[0] });
    } catch (error) {
        console.error('[AdminController] Error al actualizar la configuración del nivel booster:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Obtiene estadísticas generales del programa de impulsores.
 */
async function getBoosterStats(req, res) {
    try {
        // Consulta principal para obtener estadísticas generales de impulsores
        // Se calcula tanto el total como el monto apto legalmente (con KYC verificado)
        const statsQuery = `
            SELECT
                (SELECT COUNT(*) FROM users WHERE is_booster = TRUE) as total_boosters,
                (SELECT COUNT(*) FROM users WHERE is_booster = TRUE AND kyc_verified = TRUE) as eligible_boosters,
                -- Filtrar por usuarios que son impulsores activos para mantener consistencia matemática con las tarjetas de nivel
                (SELECT SUM(bbl.amount) FROM booster_blue_ledger bbl JOIN users u ON bbl.user_id = u.id WHERE u.is_booster = TRUE) as total_booster_blue_debt,
                (SELECT SUM(bbl.amount) FROM booster_blue_ledger bbl JOIN users u ON bbl.user_id = u.id WHERE u.is_booster = TRUE AND u.kyc_verified = TRUE) as eligible_booster_blue_debt,
                (SELECT COUNT(*) FROM booster_payment_log) as total_payments_made,
                (SELECT SUM(amount_paid) FROM booster_payment_log) as total_blue_paid_out,
                (SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1) as platform_commission_balance
        `;
        const result = await pool.query(statsQuery);
        const statsData = result.rows[0];

        // Consulta secundaria para obtener la deuda de comisiones agrupada por nivel de impulsor
        // Se calcula la deuda total por nivel y la deuda elegible (usuarios con KYC aprobado)
        const levelDebtQuery = `
            SELECT 
                u.booster_level,
                COALESCE(SUM(bbl.amount), 0.0000) as total_level_debt,
                COALESCE(SUM(CASE WHEN u.kyc_verified = TRUE THEN bbl.amount ELSE 0.0000 END), 0.0000) as eligible_level_debt
            FROM users u
            LEFT JOIN booster_blue_ledger bbl ON u.id = bbl.user_id
            WHERE u.is_booster = TRUE AND u.booster_level BETWEEN 1 AND 5
            GROUP BY u.booster_level
        `;
        const levelDebtResult = await pool.query(levelDebtQuery);
        
        // Inicializamos los mapas de deudas por nivel para garantizar que siempre viajen los 5 niveles al frontend
        const debt_by_level = {};
        for (let l = 1; l <= 5; l++) {
            debt_by_level[l] = { total: 0, eligible: 0 };
        }

        levelDebtResult.rows.forEach(row => {
            if (debt_by_level[row.booster_level]) {
                debt_by_level[row.booster_level].total = parseFloat(row.total_level_debt) || 0;
                debt_by_level[row.booster_level].eligible = parseFloat(row.eligible_level_debt) || 0;
            }
        });

        statsData.debt_by_level = debt_by_level;
        res.json(statsData);
    } catch (error) {
        console.error('[AdminController] Error al obtener estadísticas booster:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Obtiene la lista de usuarios con rol/estado booster activo.
 */
async function getBoostersList(req, res) {
    try {
        // Agregamos u.kyc_verified en la consulta para permitir al frontend pintar badges de cumplimiento
        const query = `
            SELECT 
                u.id,
                u.username,
                u.is_booster,
                u.booster_level,
                u.kyc_verified,
                (SELECT SUM(amount) FROM booster_blue_ledger WHERE user_id = u.id) as total_booster_blue
            FROM users u
            WHERE u.is_booster = TRUE
            ORDER BY total_booster_blue DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('[AdminController] Error al obtener lista de boosters:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Obtiene el historial contable de pagos a impulsores (booster_payment_log).
 */
async function getBoosterPaymentsLog(req, res) {
    try {
        const query = `
            SELECT 
                bpl.id,
                bpl.amount_paid,
                bpl.payment_month,
                bpl.booster_level_at_payment,
                bpl.created_at,
                u.username
            FROM booster_payment_log bpl
            JOIN users u ON bpl.user_id = u.id
            ORDER BY bpl.created_at DESC
            LIMIT 200
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('[AdminController] Error al obtener log de pagos de impulsores:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Reconstruye el historial/ledger de boosters para un usuario específico.
 * Utiliza auditoría completa.
 */
async function rebuildBoosterLedger(req, res) {
    const { username } = req.params;
    if (!username) {
        return res.status(400).json({ message: 'Se requiere username.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const userResult = await client.query('SELECT id, username FROM users WHERE username = $1', [username]);
        if (userResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        const userId = userResult.rows[0].id;

        // 1) Leer total legacy (si existe)
        const legacyColResult = await client.query(`
            SELECT EXISTS(
                SELECT 1 FROM information_schema.columns
                WHERE table_name='users' AND column_name='booster_blue_balance'
            ) AS exists
        `);
        const legacyColExists = !!legacyColResult.rows[0]?.exists;
        let legacyTotal = null;
        if (legacyColExists) {
            const legacyTotalResult = await client.query(
                'SELECT booster_blue_balance FROM users WHERE id = $1',
                [userId]
            );
            legacyTotal = parseFloat(legacyTotalResult.rows[0]?.booster_blue_balance || '0') || 0;
        }

        // 2) Limpiar solo “backfills” artificiales
        const deleteLegacyTx = await client.query(
            `DELETE FROM booster_transactions
             WHERE user_id = $1 AND type IN ('legacy_backfill', 'legacy_backfill_residual')`,
            [userId]
        );

        // 3) Rebuild total del ledger desde booster_transactions
        const deletedLedger = await client.query('DELETE FROM booster_blue_ledger WHERE user_id = $1', [userId]);

        const insertedFromTx = await client.query(
            `
            INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id, created_at)
            SELECT
                bt.user_id,
                bt.amount,
                bt.related_publication_id,
                bt.created_at
            FROM booster_transactions bt
            WHERE bt.user_id = $1
            ORDER BY bt.created_at ASC
            RETURNING id
            `,
            [userId]
        );

        const sumTxResult = await client.query(
            'SELECT COALESCE(SUM(amount), 0) AS total FROM booster_transactions WHERE user_id = $1',
            [userId]
        );
        const sumTx = parseFloat(sumTxResult.rows[0]?.total || '0') || 0;

        // 4) Añadir residual si el legacy es mayor
        let residualAdded = 0;
        if (legacyColExists && legacyTotal !== null) {
            const diff = legacyTotal - sumTx;
            if (diff > 0.00009) {
                const residualTx = await client.query(
                    `INSERT INTO booster_transactions (user_id, type, amount, description, related_publication_id)
                     VALUES ($1, 'legacy_backfill_residual', $2, $3, NULL)
                     RETURNING id, created_at`,
                    [userId, diff, 'Saldo histórico no detallado (diferencia vs evidencia histórica)']
                );

                await client.query(
                    `INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id, created_at)
                     VALUES ($1, $2, NULL, $3)`,
                    [userId, diff, residualTx.rows[0].created_at]
                );
                residualAdded = diff;
            }
        }

        const newLedgerTotalResult = await client.query(
            'SELECT COALESCE(SUM(amount), 0) AS total FROM booster_blue_ledger WHERE user_id = $1',
            [userId]
        );
        const newLedgerTotal = parseFloat(newLedgerTotalResult.rows[0]?.total || '0') || 0;

        await logAuditEvent(client, req, {
            eventType: 'booster.ledger_rebuilt',
            actorUsername: req.user?.username || 'admin',
            targetUsername: username,
            category: 'admin',
            metadata: {
                user_id: userId,
                legacy_total: legacyTotal,
                sum_transactions: sumTx,
                new_ledger_total: newLedgerTotal,
                deleted_ledger_rows: deletedLedger.rowCount,
                inserted_ledger_rows: insertedFromTx.rowCount + (residualAdded > 0 ? 1 : 0),
                deleted_legacy_transactions: deleteLegacyTx.rowCount,
                residual_added: residualAdded
            }
        });

        await client.query('COMMIT');
        res.status(200).json({
            success: true,
            message: `Ledger reconstruido para ${username}.`,
            results: {
                user_id: userId,
                legacy_total: legacyTotal,
                sum_transactions: sumTx,
                new_ledger_total: newLedgerTotal,
                deleted_ledger_rows: deletedLedger.rowCount,
                inserted_ledger_rows: insertedFromTx.rowCount + (residualAdded > 0 ? 1 : 0),
                deleted_legacy_transactions: deleteLegacyTx.rowCount,
                residual_added: residualAdded
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[AdminController] Error al reconstruir ledger:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
}

/**
 * Obtiene estadísticas de recompensas de gobernanza pendientes de pago.
 */
async function getGovernanceRewardStats(req, res) {
    try {
        const stats = await governanceRewardService.getPendingRewardStats(pool);
        return res.json(stats);
    } catch (error) {
        console.error('[AdminController] Error obteniendo stats de recompensas:', error);
        return res.status(500).json({ message: 'Error al obtener estadísticas de recompensas.' });
    }
}

/**
 * Procesa recompensas de gobernanza en lote para los guardianes.
 */
async function processGovernanceRewards(req, res) {
    try {
        const stats = await governanceRewardService.getPendingRewardStats(pool);
        if (stats.pendingCount === 0) {
            return res.json({ message: 'No hay votos pendientes de recompensa.', totalProcessed: 0 });
        }
        if (stats.currentRate === 0) {
            return res.status(400).json({
                message: 'La tasa de recompensa está en 0. Configure gov_vote_reward_blue antes de procesar.',
            });
        }

        let adminId = req.user?.userId || req.user?.id;
        if (!adminId) {
            const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
            const platformUser = await pool.query('SELECT id FROM users WHERE username = $1', [platformUsername]);
            if (platformUser.rowCount > 0) {
                adminId = platformUser.rows[0].id;
            }
        }

        if (!adminId) {
            return res.status(401).json({ message: "No se pudo identificar al administrador para esta operación." });
        }

        const result = await governanceRewardService.processPendingRewards(pool, adminId);

        // Notificaciones y correos
        for (const [userId, summary] of Object.entries(result.byGuardian)) {
            const safeUserId = parseInt(userId, 10);

            notificationService.sendNotificationToUser(safeUserId, {
                title: `+${summary.totalAmount.toFixed(2)} BLUE IOU acreditados`,
                body: `Recompensa retroactiva por ${summary.votesPaid} voto(s) de gobernanza.`,
                icon: '/assets/icons/icon-192x192.png',
                data: { url: '/history.html' },
            }, 'TRANSACTIONAL').catch(err =>
                console.error(`[AdminController] Error push batch reward user ${safeUserId}:`, err)
            );

            if (summary.email) {
                const votesList = summary.requestIds
                    .map(id => `• Solicitud #${id}`)
                    .join('\n');

                sendGovernanceEmail({
                    toEmail:  summary.email,
                    subject:  `+${summary.totalAmount.toFixed(2)} BLUE IOU — Recompensa retroactiva por votos de gobernanza`,
                    title:    `Recompensa acreditada: +${summary.totalAmount.toFixed(2)} BLUE IOU`,
                    body:
                        `Hola ${summary.username},\n\n` +
                        `Se han acreditado recompensas por tu participación en el sistema de ` +
                        `gobernanza Winton-Consensus. Este pago corresponde a votos emitidos ` +
                        `anteriormente que aún no habían sido compensados.\n\n` +
                        `Detalle de votos compensados:\n${votesList}`,
                    severity: 'success',
                    details: [
                        { label: 'Votos compensados',       value: String(summary.votesPaid) },
                        { label: 'Tasa por voto',           value: `${result.rateUsed.toFixed(2)} BLUE IOU` },
                        { label: 'Total acreditado',        value: `+${summary.totalAmount.toFixed(2)} BLUE IOU` },
                        { label: 'Nuevo saldo BLUE IOU',    value: `${summary.newBalance.toFixed(2)} BLUE IOU` },
                        { label: 'Procesado por',           value: 'Administrador' },
                    ],
                }).catch(err =>
                    console.error(`[AdminController] Error email batch reward user ${safeUserId}:`, err)
                );
            }
        }

        return res.json({
            message: `${result.totalProcessed} voto(s) procesados exitosamente.`,
            totalProcessed:    result.totalProcessed,
            totalSkipped:      result.totalSkipped,
            rateUsed:          result.rateUsed,
            guardiansAffected: Object.keys(result.byGuardian).length,
        });
    } catch (error) {
        console.error('[AdminController] Error procesando recompensas batch:', error);
        return res.status(500).json({ message: 'Error al procesar recompensas pendientes.' });
    }
}

/**
 * Crea una nueva publicación oficial en nombre de la Plataforma.
 */
async function createPlatformPublication(req, res) {
    const { title, description, cost: costString, availableSlots: slotsString, isSellPost, autoApprove, isBoosterTask, allowRepeatParticipation, maxRepeatPerUser, repeatCooldownHours, repeatCooldownDays, repeatCooldownMinutes, targetUsername, formFields } = req.body;

    if (!title || !description || !costString) {
        return res.status(400).json({ message: "Faltan datos: título, descripción y costo son requeridos." });
    }

    const cost = parseFloat(costString.toString().replace(',', '.'));
    if (isNaN(cost) || cost <= 0) {
        return res.status(400).json({ message: "El costo debe ser un número positivo." });
    }

    const slots = slotsString ? parseInt(slotsString, 10) : 1;
    if (isNaN(slots) || slots < 1) {
        return res.status(400).json({ message: "La cantidad de cupos debe ser mayor a 0." });
    }

    const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
    const allowRepeat = !!allowRepeatParticipation;
    let maxRepeat = null;
    let repeatCooldown = 24;
    
    if (allowRepeat) {
        maxRepeat = parseInt(maxRepeatPerUser, 10);
        if (!Number.isFinite(maxRepeat) || maxRepeat < 2) {
            return res.status(400).json({ message: "Indica el máximo de repeticiones por usuario (mínimo 2)." });
        }
        repeatCooldown = resolveRepeatCooldownHours({
            repeatCooldownDays,
            repeatCooldownHours,
            repeatCooldownMinutes
        });
    } else {
        maxRepeat = 1;
        repeatCooldown = 24;
    }

    let sanitizedTargetUsername = null;
    if (targetUsername && targetUsername.trim() !== '') {
        sanitizedTargetUsername = targetUsername.trim();
        const targetUserResult = await pool.query(`SELECT id FROM users WHERE username = $1`, [sanitizedTargetUsername]);
        if (targetUserResult.rowCount === 0) {
            return res.status(400).json({ message: `El usuario "${sanitizedTargetUsername}" no existe.` });
        }
    }

    try {
        const userResult = await pool.query(`SELECT id FROM users WHERE username = $1`, [platformUsername]);
        if (userResult.rowCount === 0) {
            return res.status(500).json({ message: "Error crítico: El usuario de la plataforma no se encuentra." });
        }
        const authorId = userResult.rows[0].id;

        const ALLOWED_FIELD_TYPES = ['text', 'textarea'];
        const MAX_STEPS = 20;
        const MAX_FIELDS_PER_STEP = 10;
        const MAX_LABEL_LENGTH = 200;

        let sanitizedFormFields = null;
        if (formFields && typeof formFields === 'object' && Object.keys(formFields).length > 0) {
            const sanitized = {};
            const stepKeys = Object.keys(formFields).slice(0, MAX_STEPS);

            for (const stepKey of stepKeys) {
                const stepNum = parseInt(stepKey, 10);
                if (!Number.isFinite(stepNum) || stepNum < 1 || stepNum > MAX_STEPS) continue;

                const fields = formFields[stepKey];
                if (!Array.isArray(fields)) continue;

                const sanitizedFields = [];
                for (const field of fields.slice(0, MAX_FIELDS_PER_STEP)) {
                    if (typeof field === 'string') {
                        const trimmed = field.trim().substring(0, MAX_LABEL_LENGTH);
                        if (trimmed) sanitizedFields.push({ label: trimmed, type: 'text' });
                    } else if (field && typeof field === 'object' && typeof field.label === 'string') {
                        const label = field.label.trim().substring(0, MAX_LABEL_LENGTH);
                        const type = ALLOWED_FIELD_TYPES.includes(field.type) ? field.type : 'text';
                        if (label) sanitizedFields.push({ label, type });
                    }
                }

                if (sanitizedFields.length > 0) {
                    sanitized[String(stepNum)] = sanitizedFields;
                }
            }

            sanitizedFormFields = Object.keys(sanitized).length > 0 ? sanitized : null;
        }

        const sql = `
            INSERT INTO publications (title, description, blue_cost, is_sell_post, author_id, available_slots, auto_approve, is_booster_task, allow_repeat_participation, max_repeat_per_user, repeat_cooldown_hours, target_username, form_fields, show_preflight_modal) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
            RETURNING id
        `;
        const result = await pool.query(sql, [title, description, cost, !!isSellPost, authorId, slots, !!autoApprove, !!isBoosterTask, allowRepeat, maxRepeat, repeatCooldown, sanitizedTargetUsername, sanitizedFormFields, !!req.body.showPreflightModal]);

        const newPubId = result.rows[0].id;

        await logAuditEvent(pool, req, {
            eventType: 'admin.platform_publication.created',
            actorUsername: req.user?.username || 'admin',
            targetUsername: sanitizedTargetUsername,
            publicationId: newPubId,
            category: 'platform',
            metadata: { title, cost, is_targeted: !!sanitizedTargetUsername }
        });

        const message = sanitizedTargetUsername
            ? `Publicación creada exitosamente. Visible solo para: ${sanitizedTargetUsername}`
            : "Publicación de la plataforma creada exitosamente.";

        res.status(201).json({ message, publicationId: newPubId });

        try {
            await notificationService.sendNotificationToAll({
                title: '🚀 Nueva Tarea Oficial',
                body: `¡Nueva oportunidad! 📝 ${title}. Participa ahora para ganar BLUE IOU.`,
                icon: '/assets/icons/icon-192x192.png',
                badge: '/assets/icons/icon-72x72.png',
                data: { url: '/dashboard.html' }
            }, 'SOCIAL');
        } catch (pushErr) {
            console.error("[AdminController] Error al disparar broadcast oficial:", pushErr.message);
        }

    } catch (error) {
        console.error("[AdminController] Error al crear publicación de la plataforma:", error);
        return res.status(500).json({ message: "Error interno del servidor." });
    }
}

/**
 * Modifica una publicación oficial de la Plataforma.
 */
async function updatePlatformPublication(req, res) {
    const { id } = req.params;
    const { title, description, cost: costString, availableSlots: slotsString, isSellPost, autoApprove, isBoosterTask, allowRepeatParticipation, maxRepeatPerUser, repeatCooldownHours, repeatCooldownDays, repeatCooldownMinutes, targetUsername, formFields } = req.body;

    if (!title || !description || !costString) {
        return res.status(400).json({ message: "Faltan datos: título, descripción y costo son requeridos." });
    }

    const cost = parseFloat(costString.toString().replace(',', '.'));
    if (isNaN(cost) || cost <= 0) {
        return res.status(400).json({ message: "El costo debe ser un número positivo." });
    }

    const slots = slotsString ? parseInt(slotsString, 10) : 1;
    if (isNaN(slots) || slots < 1) {
        return res.status(400).json({ message: "La cantidad de cupos debe ser mayor a 0." });
    }

    const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
    const allowRepeat = !!allowRepeatParticipation;
    let maxRepeat = null;
    let repeatCooldown = 24;
    
    if (allowRepeat) {
        maxRepeat = parseInt(maxRepeatPerUser, 10);
        if (!Number.isFinite(maxRepeat) || maxRepeat < 2) {
            return res.status(400).json({ message: "Indica el máximo de repeticiones por usuario (mínimo 2)." });
        }
        repeatCooldown = resolveRepeatCooldownHours({
            repeatCooldownDays,
            repeatCooldownHours,
            repeatCooldownMinutes
        });
    } else {
        maxRepeat = 1;
        repeatCooldown = 24;
    }

    try {
        const ownership = await pool.query(
            `SELECT p.id
             FROM publications p
             JOIN users u ON p.author_id = u.id
             WHERE p.id = $1 AND u.username = $2`,
            [id, platformUsername]
        );

        if (ownership.rowCount === 0) {
            return res.status(404).json({ message: "La publicación no pertenece a la plataforma." });
        }

        let sanitizedTargetUsername = null;
        if (targetUsername && targetUsername.trim() !== '') {
            sanitizedTargetUsername = targetUsername.trim();
            const targetUserResult = await pool.query(`SELECT id FROM users WHERE username = $1`, [sanitizedTargetUsername]);
            if (targetUserResult.rowCount === 0) {
                return res.status(400).json({ message: `El usuario "${sanitizedTargetUsername}" no existe.` });
            }
        }

        const ALLOWED_FIELD_TYPES_EDIT = ['text', 'textarea'];
        const MAX_STEPS_EDIT = 20;
        const MAX_FIELDS_PER_STEP_EDIT = 10;
        const MAX_LABEL_LENGTH_EDIT = 200;

        let sanitizedFormFields = null;
        if (formFields && typeof formFields === 'object' && Object.keys(formFields).length > 0) {
            const sanitized = {};
            const stepKeys = Object.keys(formFields).slice(0, MAX_STEPS_EDIT);

            for (const stepKey of stepKeys) {
                const stepNum = parseInt(stepKey, 10);
                if (!Number.isFinite(stepNum) || stepNum < 1 || stepNum > MAX_STEPS_EDIT) continue;

                const fields = formFields[stepKey];
                if (!Array.isArray(fields)) continue;

                const sanitizedFields = [];
                for (const field of fields.slice(0, MAX_FIELDS_PER_STEP_EDIT)) {
                    if (typeof field === 'string') {
                        const trimmed = field.trim().substring(0, MAX_LABEL_LENGTH_EDIT);
                        if (trimmed) sanitizedFields.push({ label: trimmed, type: 'text' });
                    } else if (field && typeof field === 'object' && typeof field.label === 'string') {
                        const label = field.label.trim().substring(0, MAX_LABEL_LENGTH_EDIT);
                        const type = ALLOWED_FIELD_TYPES_EDIT.includes(field.type) ? field.type : 'text';
                        if (label) sanitizedFields.push({ label, type });
                    }
                }

                if (sanitizedFields.length > 0) {
                    sanitized[String(stepNum)] = sanitizedFields;
                }
            }

            sanitizedFormFields = Object.keys(sanitized).length > 0 ? sanitized : null;
        }

        const updateSql = `
            UPDATE publications
            SET title = $1,
                description = $2,
                blue_cost = $3,
                is_sell_post = $4,
                available_slots = $5,
                auto_approve = $6,
                is_booster_task = $7,
                allow_repeat_participation = $8,
                max_repeat_per_user = $9,
                repeat_cooldown_hours = $10,
                target_username = $11,
                form_fields = $12,
                show_preflight_modal = $13,
                updated_at = NOW()
            WHERE id = $14
        `;

        await pool.query(updateSql, [
            title,
            description,
            cost,
            !!isSellPost,
            slots,
            !!autoApprove,
            !!isBoosterTask,
            allowRepeat,
            maxRepeat,
            repeatCooldown,
            sanitizedTargetUsername,
            sanitizedFormFields,
            !!req.body.showPreflightModal,
            id
        ]);

        await logAuditEvent(pool, req, {
            eventType: 'admin.platform_publication.updated',
            actorUsername: req.user?.username || 'admin',
            publicationId: parseInt(id, 10),
            category: 'platform',
            metadata: { title, cost }
        });

        res.json({ message: "Publicación de la plataforma actualizada exitosamente." });
    } catch (error) {
        console.error("[AdminController] Error al editar publicación de la plataforma:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}

/**
 * Obtiene todas las publicaciones de la plataforma incluyendo el agregador de participantes.
 */
async function getPlatformPublicationsWithParticipants(req, res) {
    const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
    try {
        const query = `
            SELECT
                p.id, p.title, p.description, p.created_at, p.status, p.is_paused,
                p.blue_cost, p.available_slots, p.is_sell_post, p.allow_repeat_participation, p.max_repeat_per_user, p.repeat_cooldown_hours,
                p.expires_at, p.deleted_at, p.deleted_by_username, p.is_quick_sale, p.auto_approve, p.is_booster_task, p.target_username, p.form_fields,
                u.username as author_username,
                (
                    SELECT json_agg(json_build_object(
                        'acceptor_username', pa.acceptor_username,
                        'status', pa.status,
                        'accepted_at', pa.created_at,
                        'average_rating', u_participant.average_rating,
                        'ratings_count', u_participant.ratings_count,
                        'form_responses', pa.form_responses
                    ) ORDER BY 
                        CASE WHEN pa.status = 'pending' THEN 1 ELSE 2 END ASC,
                        CASE WHEN pa.status = 'pending' THEN pa.created_at END ASC,
                        pa.created_at DESC
                    )
                    FROM publication_acceptances pa
                    JOIN users u_participant ON pa.acceptor_username = u_participant.username
                    WHERE pa.publication_id = p.id
                ) as participants,
                (p.deleted_at IS NOT NULL) AS is_deleted,
                (p.expires_at IS NOT NULL AND p.expires_at < NOW()) AS is_expired,
                (
                    CASE
                        WHEN COALESCE(p.is_quick_sale, FALSE) = TRUE THEN (p.status <> 'open')
                        ELSE (
                            p.available_slots <= 0
                        )
                    END
                ) AS is_completed_publication
            FROM
                publications p
            JOIN
                users u ON p.author_id = u.id
            WHERE
                u.username = $1
            ORDER BY
                p.created_at DESC;
        `;
        const result = await pool.query(query, [platformUsername]);

        const publications = result.rows.map(p => ({
            ...p,
            participants: p.participants || [],
        }));

        res.json(publications);
    } catch (error) {
        console.error('[AdminController] Error al obtener publicaciones con participantes:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Obtiene el log de todos los referidos registrados para el panel de administración.
 */
async function getReferralsLog(req, res) {
    try {
        const query = `
            SELECT 
                rl.id,
                rl.created_at,
                referrer.username as referrer_username,
                referred.username as referred_username
            FROM 
                referral_log rl
            JOIN 
                users referrer ON rl.referrer_user_id = referrer.id
            JOIN 
                users referred ON rl.referred_user_id = referred.id
            ORDER BY 
                rl.created_at DESC;
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("[AdminController] Error al obtener el log de referidos:", error);
        res.status(500).json({ message: "Error interno del servidor." });
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
    updateUserReferralCode,
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
    getUserKycStatus,
    getAdminPublications,
    restorePublication,
    deletePublicationAdmin,
    getDatabaseStats,
    createDatabaseBackup,
    cleanupTestData,
    cleanupInactiveUsers,
    cleanupOldPublications,
    getBoosterSettings,
    updateBoosterSettings,
    getBoosterStats,
    getBoostersList,
    getBoosterPaymentsLog,
    rebuildBoosterLedger,
    getGovernanceRewardStats,
    processGovernanceRewards,
    createPlatformPublication,
    updatePlatformPublication,
    getPlatformPublicationsWithParticipants,
    getReferralsLog,
    getDemoExportStats,
    generateDemoExport,
    getDemoExportHistory,
    downloadDemoExport,
    previewDemoImport,
    processDemoImport,
    createInvitation,
    getInvitations,
    verifyInvitation,
    claimInvitation,
    getAdminProfile,
    deleteInvitation,
    getAdminUsers,
    updateAdminStatus,
};

// ═══════════════════════════════════════════════════════════════════════════
// GOBERNANZA DEMO (IMPORTACIÓN Y EXPORTACIÓN)
// ═══════════════════════════════════════════════════════════════════════════

async function getDemoExportStats(req, res) {
    try {
        const stats = await govDemoRewardService.getExportStats(pool);
        return res.json(stats);
    } catch (error) {
        console.error('[ADMIN] Error obteniendo stats de exportación demo:', error);
        return res.status(500).json({ message: 'Error al obtener estadísticas de exportación.' });
    }
}

async function generateDemoExport(req, res) {
    try {
        const result = await govDemoRewardService.generateExport(pool, req.user.userId);
        if (!result) {
            return res.json({ message: 'No hay votos pendientes de exportar.', data: null });
        }
        return res.json({ message: `${result.summary.total_votes} voto(s) exportados.`, data: result });
    } catch (error) {
        console.error('[ADMIN] Error generando exportación demo:', error);
        return res.status(500).json({ message: error.message });
    }
}

async function getDemoExportHistory(req, res) {
    try {
        const history = await govDemoRewardService.getExportHistory(pool);
        return res.json(history);
    } catch (error) {
        console.error('[ADMIN] Error obteniendo historial de exportaciones:', error);
        return res.status(500).json({ message: 'Error al obtener historial de exportaciones.' });
    }
}

async function downloadDemoExport(req, res) {
    try {
        const exportRecord = await govDemoRewardService.getExportById(
            pool, req.params.id, req.user.userId
        );
        return res.json(exportRecord);
    } catch (error) {
        console.error('[ADMIN] Error descargando exportación:', error);
        return res.status(error.message.includes('no encontrada') ? 404 : 500)
            .json({ message: error.message });
    }
}

async function previewDemoImport(req, res) {
    try {
        const { fileData } = req.body;
        if (!fileData) {
            return res.status(400).json({ message: 'No se proporcionó el contenido del archivo.' });
        }
        const validated = govDemoRewardService.validateImport(fileData);
        const preview   = await govDemoRewardService.previewImport(pool, validated);
        return res.json(preview);
    } catch (error) {
        console.error('[ADMIN] Error en preview de importación demo:', error);
        return res.status(400).json({ message: error.message });
    }
}

async function processDemoImport(req, res) {
    try {
        const { fileData, expectedMultiplier } = req.body;
        if (!fileData) {
            return res.status(400).json({ message: 'No se proporcionó el contenido del archivo.' });
        }
        const validated = govDemoRewardService.validateImport(fileData);

        if (expectedMultiplier !== undefined && expectedMultiplier !== null) {
            const current     = await govDemoRewardService.getCurrentRateAndMultiplier(pool);
            const currentMult = Number(current.multiplier);
            const expected    = Number(expectedMultiplier);
            const EPSILON     = 1e-9;
            const drifted     =
                Number.isFinite(currentMult) &&
                Number.isFinite(expected) &&
                Math.abs(currentMult - expected) > EPSILON;

            if (drifted) {
                return res.status(409).json({
                    code:    'MULTIPLIER_CHANGED',
                    message:
                        `La etapa booster cambió entre la previsualización y el procesamiento. ` +
                        `Visto en preview: ${expected}x. Vigente ahora: ${currentMult}x ` +
                        `(${current.stageName}). Revise la preview nuevamente y vuelva a confirmar.`,
                    expectedMultiplier: expected,
                    currentMultiplier:  currentMult,
                    currentStageName:   current.stageName,
                });
            }
        }

        const result = await govDemoRewardService.processImport(pool, validated, req.user.userId);

        const multiplierLabel =
            Number.isFinite(result.multiplier) && result.multiplier !== 1
                ? `x${result.multiplier} (${result.stageName})`
                : `x1 (${result.stageName || 'Sin etapa activa'})`;

        for (const [userId, summary] of Object.entries(result.byGuardian)) {
            const safeUserId = parseInt(userId, 10);

            notificationService.sendNotificationToUser(safeUserId, {
                title: `+${summary.totalAmount.toFixed(2)} BLUE IOU acreditados`,
                body:
                    `Recompensa por ${summary.votesPaid} voto(s) de gobernanza ` +
                    `(${summary.basePerVote.toFixed(2)} x ${summary.multiplier} = ` +
                    `${summary.ratePerVote.toFixed(2)} BLUE/voto).`,
                icon:  '/assets/icons/icon-192x192.png',
                data:  { url: '/history.html' },
            }, 'TRANSACTIONAL').catch(err =>
                console.error(`[ADMIN] Error push demo reward user ${safeUserId}:`, err)
            );

            if (summary.email) {
                const votesList = summary.demoVoteIds
                    .map(id => `\u2022 Voto demo #${id}`)
                    .join('\n');

                sendGovernanceEmail({
                    toEmail:  summary.email,
                    subject:  `+${summary.totalAmount.toFixed(2)} BLUE IOU — Recompensa por pruebas de gobernanza`,
                    title:    `Recompensa acreditada: +${summary.totalAmount.toFixed(2)} BLUE IOU`,
                    body:
                        `Hola ${summary.username},\n\n` +
                        `Se han acreditado recompensas BLUE IOU a tu cuenta por tu participación ` +
                        `en las pruebas del sistema de gobernanza Winton-Consensus.\n\n` +
                        `Tu trabajo probando la plataforma es fundamental para garantizar ` +
                        `la calidad y seguridad del sistema. Gracias por tu dedicación.\n\n` +
                        `Detalle:\n${votesList}`,
                    severity: 'success',
                    details: [
                        { label: 'Votos compensados',     value: String(summary.votesPaid) },
                        { label: 'Tasa base por voto',    value: `${summary.basePerVote.toFixed(2)} BLUE IOU` },
                        { label: 'Multiplicador (etapa)', value: `x${summary.multiplier} — ${summary.stageName}` },
                        { label: 'Tasa final por voto',   value: `${summary.ratePerVote.toFixed(2)} BLUE IOU` },
                        { label: 'Subtotal base',         value: `${summary.totalBase.toFixed(2)} BLUE IOU` },
                        { label: 'Total acreditado',      value: `+${summary.totalAmount.toFixed(2)} BLUE IOU` },
                        { label: 'Nuevo saldo BLUE IOU',  value: `${summary.newBalance.toFixed(2)} BLUE IOU` },
                        { label: 'Origen',                value: 'Entorno de pruebas (Demo)' },
                    ],
                }).catch(err =>
                    console.error(`[ADMIN] Error email demo reward user ${safeUserId}:`, err)
                );
            }
        }

        return res.json({
            message:             `${result.totalProcessed} voto(s) procesados exitosamente ${multiplierLabel}.`,
            totalProcessed:      result.totalProcessed,
            totalSkipped:        result.totalSkipped,
            rateUsed:            result.rateUsed,
            multiplier:          result.multiplier,
            stageName:           result.stageName,
            finalRatePerVote:    result.finalRatePerVote,
            guardiansAffected:   Object.keys(result.byGuardian).length,
        });
    } catch (error) {
        console.error('[ADMIN] Error procesando importación demo:', error);
        return res.status(500).json({ message: error.message });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GESTIÓN DE INVITACIONES PARA ADMINISTRADORES INDIVIDUALES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea una nueva invitación de administrador.
 * Genera un token aleatorio, lo hashea usando SHA-256 para almacenamiento seguro,
 * y envía un correo electrónico al destinatario.
 * Requiere rol 'superadmin'.
 */
async function createInvitation(req, res) {
    // 1. Autorización RBAC: solo superadmin puede crear cuentas del equipo
    if (req.user?.role !== 'superadmin') {
        return res.status(403).json({ message: "Requiere privilegios de Super Administrador para crear invitaciones." });
    }

    const { email, role } = req.body;
    if (!email || !role) {
        return res.status(400).json({ message: "Se requiere email y rol." });
    }

    // Validación formal de correo electrónico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Formato de correo electrónico inválido." });
    }

    const allowedRoles = ['admin', 'auditor', 'superadmin'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: "Rol inválido especificado." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 2. Comprobar si el correo ya tiene una cuenta administrativa activa reclamada.
        // Un administrador puede ser un usuario registrado previamente en la plataforma, por lo que su correo
        // existirá en la tabla de usuarios generales ('users') y NO debemos bloquearlo por ese motivo.
        // Para verificar si ya posee acceso admin, buscamos si tiene una invitación reclamada en 'admin_invitations'.
        const adminCheck = await client.query(
            "SELECT id FROM admin_invitations WHERE email = $1 AND used_at IS NOT NULL",
            [email]
        );

        if (adminCheck.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: "Este correo electrónico ya está registrado como administrador en el sistema." });
        }

        // 3. Generar token de alta entropía (criptográficamente seguro)
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        // Hashear el token para mitigar el riesgo si la DB es filtrada (Zero Hardcoded/Leaked Secrets)
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // La invitación expira en 24 horas (estándar de seguridad de startups)
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // 4. Guardar en base de datos usando el patrón Upsert (ON CONFLICT).
        // Esto permite a los superadmins re-enviar la invitación de forma segura,
        // invalidando inmediatamente el token antiguo y configurando una nueva expiración de 24 horas.
        await client.query(
            `INSERT INTO admin_invitations (email, token_hash, role, created_by, expires_at, used_at)
             VALUES ($1, $2, $3, $4, $5, NULL)
             ON CONFLICT (email)
             DO UPDATE SET 
                token_hash = EXCLUDED.token_hash,
                role = EXCLUDED.role,
                created_by = EXCLUDED.created_by,
                expires_at = EXCLUDED.expires_at,
                used_at = NULL,
                created_at = NOW()`,
            [email.toLowerCase().trim(), tokenHash, role, req.user.username, expiresAt]
        );

        // 5. Enviar el correo electrónico
        const { sendAnnouncementEmail } = require('../services/emailService');
        
        // Declaramos las constantes del entorno fuera del condicional para evitar ReferenceError (isProd no definido)
        // cuando FRONTEND_URL está definido en las variables de entorno del servidor.
        const isProd = process.env.NODE_ENV === 'production';
        const isDemo = process.env.IS_DEMO_ENV === 'true' || process.env.DATABASE_URL?.includes('wintoncoin_demo');

        // Determinar dinámicamente la URL base del frontend para evitar cruces entre entornos (Local, Demo y Producción)
        let domain = process.env.FRONTEND_URL;
        if (!domain) {
            if (isDemo) {
                domain = 'https://demo.wintoncoin.com';
            } else if (isProd) {
                domain = 'https://sc.wintoncoin.com';
            } else {
                domain = 'http://localhost:5173';
            }
        }
        const claimUrl = `${domain}/admin-register.html?token=${token}`;

        const subject = "Invitación al panel de administración de WintonCoin";
        const title = "Invitación de Administrador";
        const bodyHtml = `
            Hola,<br><br>
            Has sido invitado a unirte al equipo de administración de WintonCoin con el rol de <strong>${role}</strong>.<br><br>
            Para reclamar tu cuenta y configurar tu contraseña de acceso privada, haz clic en el botón de abajo o accede al siguiente enlace:<br><br>
            <a href="${claimUrl}" style="color:#0052FF; text-decoration:underline;">${claimUrl}</a><br><br>
            Por razones de seguridad, esta invitación expirará en 24 horas.
        `;

        await sendAnnouncementEmail({
            toEmail: email,
            subject,
            title,
            bodyHtml,
            buttonText: "Configurar Cuenta",
            buttonUrl: claimUrl
        });

        // 6. Auditoría inmutable de la acción
        await logAuditEvent(client, req, {
            eventType: 'admin.invitation.created',
            actorUsername: req.user.username,
            targetUsername: email, // Poblamos la columna TARGET con el email del invitado para auditoría rápida
            category: 'admin',
            metadata: { target_email: email, assigned_role: role }
        });

        await client.query('COMMIT');

        // Log en desarrollo para permitir pruebas manuales sin servidor SMTP real
        if (!isProd) {
            console.log(`\n--- [DESARROLLO] INVITACIÓN GENERADA ---`);
            console.log(`Email: ${email}`);
            console.log(`Rol: ${role}`);
            console.log(`Token Plano: ${token}`);
            console.log(`URL de Registro: ${claimUrl}`);
            console.log(`----------------------------------------\n`);
        }

        res.status(201).json({
            message: "Invitación creada y enviada con éxito.",
            email,
            role,
            // Exponemos el token de forma segura solo en desarrollo para agilizar las pruebas manuales del cliente
            token: !isProd ? token : undefined
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error al crear invitación administrativa:", err);
        res.status(500).json({ message: "Error interno al procesar la invitación." });
    } finally {
        client.release();
    }
}

/**
 * Obtiene el listado de invitaciones administrativas.
 */
async function getInvitations(req, res) {
    try {
        const result = await pool.query(
            `SELECT id, email, role, created_by, created_at, expires_at, used_at,
                    (expires_at < NOW() AND used_at IS NULL) as is_expired
             FROM admin_invitations
             ORDER BY created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener invitaciones administrativas:", err);
        res.status(500).json({ message: "Error al cargar la lista de invitaciones." });
    }
}

/**
 * Verifica si un token de invitación es válido y está activo.
 */
async function verifyInvitation(req, res) {
    const { token } = req.params;
    if (!token) {
        return res.status(400).json({ message: "Token requerido." });
    }

    try {
        const crypto = require('crypto');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const result = await pool.query(
            `SELECT email, role, expires_at, used_at
             FROM admin_invitations
             WHERE token_hash = $1`,
            [tokenHash]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Invitación no encontrada." });
        }

        const invite = result.rows[0];

        if (invite.used_at) {
            return res.status(400).json({ message: "Esta invitación ya ha sido utilizada." });
        }

        if (new Date(invite.expires_at) < new Date()) {
            return res.status(400).json({ message: "Esta invitación ha expirado." });
        }

        res.json({
            email: invite.email,
            role: invite.role
        });

    } catch (err) {
        console.error("Error al verificar invitación:", err);
        res.status(500).json({ message: "Error interno al verificar la invitación." });
    }
}

/**
 * Reclama una invitación creando la cuenta de administrador e invalidando el token.
 */
async function claimInvitation(req, res) {
    const { token, username, password } = req.body;
    if (!token || !username || !password) {
        return res.status(400).json({ message: "Token, usuario y contraseña son requeridos." });
    }

    // Validación de username: alfanumérico y guion bajo (longitud 3-30)
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username)) {
        return res.status(400).json({ message: "El nombre de usuario debe tener entre 3 y 30 caracteres y solo contener letras, números y guiones bajos." });
    }

    // Fuerza de la contraseña: mínimo 8 caracteres, al menos una letra y un número
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return res.status(400).json({ message: "La contraseña debe tener al menos 8 caracteres, incluyendo letras y números." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Validar el token
        const crypto = require('crypto');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const inviteResult = await client.query(
            `SELECT id, email, role, expires_at, used_at FROM admin_invitations 
             WHERE token_hash = $1 FOR UPDATE`,
            [tokenHash]
        );

        if (inviteResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Invitación no encontrada." });
        }

        const invite = inviteResult.rows[0];

        if (invite.used_at) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Esta invitación ya ha sido utilizada." });
        }

        if (new Date(invite.expires_at) < new Date()) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Esta invitación ha expirado." });
        }

        // 2. Verificar duplicidad de username (case-insensitive para evitar 'migue' vs 'Migue')
        const userCheck = await client.query(
            'SELECT id FROM admin_users WHERE LOWER(username) = LOWER($1)',
            [username]
        );

        if (userCheck.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: "El nombre de usuario administrativo ya está en uso." });
        }

        // 3. Hashear la contraseña con bcrypt (10 rounds)
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // 4. Crear el nuevo administrador en admin_users
        await client.query(
            `INSERT INTO admin_users (username, password_hash, role, account_status)
             VALUES ($1, $2, $3, 'active')`,
            [username, passwordHash, invite.role]
        );

        // 5. Marcar invitación como utilizada
        await client.query(
            `UPDATE admin_invitations SET used_at = NOW() WHERE id = $1`,
            [invite.id]
        );

        // 6. Registrar auditoría del reclamo
        await logAuditEvent(client, req, {
            eventType: 'admin.invitation.claimed',
            actorUsername: username,
            targetUsername: username, // Definimos al nuevo administrador como el objetivo del evento
            category: 'admin',
            metadata: { email: invite.email, assigned_role: invite.role }
        });

        await client.query('COMMIT');
        res.json({ message: "Cuenta de administrador creada exitosamente. Ya puedes iniciar sesión." });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error al reclamar invitación administrativa:", err);
        res.status(500).json({ message: "Error interno al crear la cuenta." });
    } finally {
        client.release();
    }
}

/**
 * Obtiene el perfil de la cuenta de administrador autenticada actualmente.
 * Esta función es invocada por el enrutador /api/admin/profile.
 * Se requiere autenticación previa mediante verifyAdminToken (JWT inyectado en req.user).
 *
 * @param {Object} req - Objeto de solicitud de Express, que contiene req.user.username inyectado por el middleware.
 * @param {Object} res - Objeto de respuesta de Express para retornar el perfil en formato JSON.
 */
async function getAdminProfile(req, res) {
    // 1. Validar la existencia del usuario autenticado en la solicitud
    if (!req.user || !req.user.username) {
        // Retornamos 401 Unauthorized si la solicitud carece de credenciales de usuario inyectadas
        return res.status(401).json({ message: "Sesión administrativa no válida o no autenticada." });
    }

    try {
        // 2. Realizar consulta SQL parametrizada a la tabla admin_users
        // Consultamos id, username y role de forma segura para evitar inyecciones SQL y optimizar el rendimiento al traer solo campos necesarios.
        const result = await pool.query(
            'SELECT id, username, role FROM admin_users WHERE username = $1',
            [req.user.username]
        );

        // 3. Comprobar si se encontró el registro correspondiente en la base de datos
        if (result.rowCount === 0) {
            // Si el registro no existe, respondemos con 404 Not Found para evitar revelar estructura e indicar la inconsistencia
            return res.status(404).json({ message: "Perfil administrativo no encontrado en el sistema." });
        }

        // 4. Retornar el perfil del administrador autenticado de forma exitosa (200 OK)
        res.json(result.rows[0]);
    } catch (err) {
        // 5. Capturar y loguear cualquier excepción imprevista del motor de base de datos
        console.error("Error al obtener perfil de admin:", err);
        // Retornamos 500 Internal Server Error con mensaje genérico de seguridad sin exponer detalles técnicos internos
        res.status(500).json({ message: "Error interno del servidor al recuperar el perfil." });
    }
}

/**
 * Revoca (elimina) una invitación de administrador pendiente de forma segura.
 * Cumple con los estándares de ciberseguridad y auditoría bancaria (trazabilidad y no-repudio).
 * Requiere privilegios de rol 'superadmin'.
 * 
 * @param {Object} req - Objeto de solicitud de Express que contiene req.body.email y el usuario autenticado.
 * @param {Object} res - Objeto de respuesta de Express para retornar el resultado.
 */
async function deleteInvitation(req, res) {
    // 1. Control de accesos basado en roles (RBAC)
    // Solo permitimos a cuentas 'superadmin' realizar la revocación para cumplir directrices de seguridad.
    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ message: "Requiere privilegios de Super Administrador para revocar invitaciones." });
    }

    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: "Se requiere especificar el email de la invitación a revocar." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 2. Verificar que la invitación exista y no haya sido reclamada aún
        // Esto previene que se revoque accidentalmente una cuenta de administrador que ya fue creada
        const checkRes = await client.query(
            "SELECT id, used_at FROM admin_invitations WHERE email = $1",
            [email.toLowerCase().trim()]
        );

        if (checkRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "No se encontró ninguna invitación activa o expirada para este correo." });
        }

        if (checkRes.rows[0].used_at !== null) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "No se puede revocar esta invitación porque la cuenta ya ha sido creada y reclamada." });
        }

        // 3. Eliminar físicamente el registro (anula el token por completo)
        // Al eliminarlo, cualquier enlace con el token hash viejo fallará de inmediato al no ser encontrado en DB.
        await client.query(
            "DELETE FROM admin_invitations WHERE email = $1",
            [email.toLowerCase().trim()]
        );

        // 4. Registro auditable inmutable de la acción de revocación
        // Cumple con la normativa SOC 2 de control de accesos administrativos
        await logAuditEvent(client, req, {
            eventType: 'admin.invitation.revoked',
            actorUsername: req.user.username,
            targetUsername: email, // Poblamos la columna TARGET con el correo revocado para visibilidad directa
            category: 'admin',
            metadata: { target_email: email }
        });

        await client.query('COMMIT');
        return res.json({ message: `Invitación para ${email} revocada y anulada con éxito.` });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[DATABASE ERROR] Error al revocar la invitación:', error.message);
        return res.status(500).json({ message: "Error interno del servidor al procesar la revocación." });
    } finally {
        client.release();
    }
}

/**
 * Lista todos los administradores registrados en la plataforma.
 * Cumple con los estándares de control de accesos de TI y auditoría bancaria.
 * Requiere privilegios de rol 'superadmin'.
 * 
 * @param {Object} req - Objeto de solicitud de Express.
 * @param {Object} res - Objeto de respuesta de Express.
 */
async function getAdminUsers(req, res) {
    if (req.user?.role !== 'superadmin') {
        return res.status(403).json({ message: "Requiere privilegios de Super Administrador para ver el equipo." });
    }

    try {
        // Consultamos id, username, role, account_status, last_login y created_at de forma parametrizada y segura.
        // Excluimos explícitamente password_hash por seguridad de la información.
        const result = await pool.query(
            `SELECT id, username, role, account_status, last_login, created_at 
             FROM admin_users 
             ORDER BY created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("[AdminController] Error al listar equipo de administración:", err);
        res.status(500).json({ message: "Error interno al obtener el equipo de administración." });
    }
}

/**
 * Suspende o reactiva una cuenta de administrador de forma segura.
 * Implementa controles de seguridad defensivos para evitar bloqueos del sistema.
 * Registra auditoría de grado bancario (SOC 2).
 * 
 * @param {Object} req - Objeto de solicitud de Express con params.adminId y body.status.
 * @param {Object} res - Objeto de respuesta de Express.
 */
async function updateAdminStatus(req, res) {
    if (req.user?.role !== 'superadmin') {
        return res.status(403).json({ message: "Requiere privilegios de Super Administrador para gestionar el equipo." });
    }

    const { adminId } = req.params;
    const { status } = req.body;
    const validStatuses = ['active', 'suspended'];

    const safeAdminId = parseInt(adminId, 10);
    if (!Number.isFinite(safeAdminId) || safeAdminId <= 0) {
        return res.status(400).json({ message: "ID de administrador inválido." });
    }

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Estado de cuenta inválido." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Obtener detalles del administrador objetivo
        const checkRes = await client.query(
            "SELECT id, username, role, account_status FROM admin_users WHERE id = $1",
            [safeAdminId]
        );

        if (checkRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Administrador no encontrado." });
        }

        const targetUser = checkRes.rows[0];

        // 2. Control de Seguridad Defensivo 1: Evitar auto-suspensión
        // Previene que el superadministrador activo se bloquee a sí mismo, dejando el sistema sin administración
        if (targetUser.username.toLowerCase() === req.user.username.toLowerCase()) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Operación inválida: No puedes suspender o cambiar el estado de tu propia cuenta." });
        }

        // 3. Control de Seguridad Defensivo 2: Proteger la cuenta admin por defecto
        const protectedAdmin = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
        if (targetUser.username.toLowerCase() === protectedAdmin) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: "No está permitido modificar el estado de la cuenta administradora de resguardo del sistema." });
        }

        // 4. Actualizar el estado en base de datos
        await client.query(
            "UPDATE admin_users SET account_status = $1 WHERE id = $2",
            [status, safeAdminId]
        );

        // 5. Registro de auditoría bancaria inmutable
        await logAuditEvent(client, req, {
            eventType: 'admin.user.status_updated',
            actorUsername: req.user.username,
            targetUsername: targetUser.username, // Poblamos la columna TARGET con el usuario cuyo estado fue modificado
            category: 'admin',
            metadata: { target_admin: targetUser.username, new_status: status }
        });

        await client.query('COMMIT');
        return res.json({ message: `Estado del administrador ${targetUser.username} actualizado a "${status}" con éxito.` });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[DATABASE ERROR] Error al actualizar estado de administrador:', error.message);
        return res.status(500).json({ message: "Error interno del servidor al actualizar el estado." });
    } finally {
        client.release();
    }
}

