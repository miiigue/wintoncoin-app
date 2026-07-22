/**
 * Submódulo de Administración — Auditoría, Métricas, Billetera de Plataforma, Mantenimiento e Importación/Exportación Demo
 * ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Gestiona las métricas principales del Dashboard Administrativo, los balances y logs de comisiones de la plataforma,
 * la consulta de audit_log, el envío de difusiones por correo (broadcasts), respaldos/limpieza de base de datos,
 * reconstrucción de libros contables (booster ledgers) y recompensas/importaciones del entorno de pruebas Demo.
 *
 * Estándar de Ciberseguridad:
 *   - Zero Hardcoded Secrets & Zero-Trust Architecture
 *   - SOC 2 Type II / ISO 27001 Bank-Grade Audit Standards
 *   - Sanitización estricta mediante make_interval() en queries de limpieza (anti SQLi)
 *   - Omisión de mensajes de error internos del servidor para prevenir fugas de rutas/esquemas
 * ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

// 1. Importación de dependencias de infraestructura y servicios
const pool = require('../../config/db'); // Conexión a la base de datos PostgreSQL
const { logAuditEvent } = require('../../services/auditService'); // Registro inmutable de auditoría
const govDemoRewardService = require('../../services/governanceDemoRewardService'); // Servicio de recompensas demo
const notificationService = require('../../services/notificationService'); // Notificaciones al usuario
const { sendGovernanceEmail } = require('../../services/emailService'); // Servicio de correos de gobernanza
const governanceRewardService = require('../../services/governanceRewardService'); // Servicio de recompensas de gobernanza

/**
 * Obtiene las estadísticas generales del dashboard administrativo en paralelo (Promise.all).
 */
async function getDashboardStats(req, res) {
    const client = await pool.connect();
    try {
        const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';

        const [usersData, publicationsData, tokensData, platformWalletData, boosterFundsData, platformEscrow, platformInExecution, platformPendingPayment, eligibleBoosterFundsData, levelDebtResult] = await Promise.all([
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
            `),
            client.query(`
                SELECT 
                    u.booster_level,
                    COALESCE(SUM(CASE WHEN u.kyc_verified = TRUE THEN bbl.amount ELSE 0.0000 END), 0.0000) as eligible_level_debt
                FROM users u
                LEFT JOIN booster_blue_ledger bbl ON u.id = bbl.user_id
                WHERE u.is_booster = TRUE AND u.booster_level BETWEEN 1 AND 5
                GROUP BY u.booster_level
            `)
        ]);

        let remainingCommission = parseFloat(platformWalletData.rows[0]?.total_blue_commission_balance) || 0;
        const debt_by_level = {};
        for (let l = 1; l <= 5; l++) debt_by_level[l] = 0;
        
        levelDebtResult.rows.forEach(row => {
            debt_by_level[row.booster_level] = parseFloat(row.eligible_level_debt) || 0;
        });

        const coverage_by_level = [];
        for (let l = 1; l <= 5; l++) {
            const levelEligibleDebt = debt_by_level[l];
            if (levelEligibleDebt > 0) {
                let coveragePercentage = 0;
                if (remainingCommission >= levelEligibleDebt) {
                    coveragePercentage = 100;
                    remainingCommission -= levelEligibleDebt;
                } else if (remainingCommission > 0) {
                    coveragePercentage = (remainingCommission / levelEligibleDebt) * 100;
                    remainingCommission = 0;
                }
                coverage_by_level.push({
                    level: l,
                    percentage: parseFloat(coveragePercentage.toFixed(2)),
                    debt: levelEligibleDebt
                });
            }
        }

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
            totalPlatformPendingPayment: parseFloat(platformPendingPayment.rows[0]?.total_platform_pending_payment) || 0,
            coverage_by_level:           coverage_by_level
        };

        res.status(200).json(stats);
    } catch (error) {
        console.error("[AdminAuditStatsController] Error al obtener estadísticas:", error);
        res.status(500).json({ message: "Error al obtener estadísticas." });
    } finally {
        client.release();
    }
}

/**
 * Obtiene el balance de la billetera de la plataforma WintonCoin.
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
        console.error("[AdminAuditStatsController] Error al obtener balance de billetera:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    } finally {
        client.release();
    }
}

/**
 * Obtiene el log de comisiones recabadas por la plataforma.
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
        console.error("[AdminAuditStatsController] Error al obtener log de comisiones:", error);
        res.status(500).json({ message: "Error al obtener log de comisiones." });
    }
}

/**
 * Obtiene el log de auditoría (audit_log) con filtros dinámicos parametrizados.
 */
async function getAuditLog(req, res) {
    try {
        const { eventType, actor, target, category, from, to, limit = '50', offset = '0' } = req.query;
        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
        const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

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
        console.error("[AdminAuditStatsController] Error al obtener log de auditoría:", error);
        res.status(500).json({ message: "Error al obtener log de auditoría." });
    }
}

/**
 * Obtiene estadísticas sobre el estado físico de la base de datos PostgreSQL.
 */
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
        console.error('[AdminAuditStatsController] Error fetching database stats:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
}

/**
 * Crea un respaldo de seguridad (backup) de la base de datos.
 */
async function createDatabaseBackup(req, res) {
    try {
        const { createBackup } = require('../../../backup-database.js');
        const backupFile = await createBackup();
        const backupFileName = require('path').basename(backupFile);

        res.json({
            success: true,
            message: 'Backup creado exitosamente',
            filename: backupFileName
        });
    } catch (error) {
        console.error('[AdminAuditStatsController] Error creating backup:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Limpia los datos de prueba creados durante los testings.
 */
async function cleanupTestData(req, res) {
    const client = await pool.connect();
    try {
        console.log(`[ADMIN CLEANUP] Administrador inició limpieza de datos de prueba`);

        const { createBackup } = require('../../../backup-database.js');
        await createBackup();

        await client.query('BEGIN');

        const testUsersResult = await client.query(`
            DELETE FROM users 
            WHERE (username ILIKE '%test%' OR username ILIKE '%demo%' OR username ILIKE '%example%')
            AND username NOT LIKE '%Plataforma%'
            RETURNING username
        `);

        const testPublicationsResult = await client.query(`
            DELETE FROM publications 
            WHERE title ILIKE '%test%' OR title ILIKE '%demo%' OR title ILIKE '%example%'
            RETURNING id, title
        `);

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
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
}

/**
 * Limpia cuentas de usuario inactivas de forma segura.
 */
async function cleanupInactiveUsers(req, res) {
    const daysInactive = parseInt(req.body.daysInactive, 10) || 90;
    const client = await pool.connect();

    try {
        console.log(`[ADMIN CLEANUP] Administrador inició limpieza de usuarios inactivos (${daysInactive} días)`);

        if (daysInactive < 30) {
            return res.status(400).json({
                message: 'Por seguridad, no se pueden eliminar usuarios con menos de 30 días de inactividad'
            });
        }

        const { createBackup } = require('../../../backup-database.js');
        await createBackup();

        await client.query('BEGIN');

        const deleteResult = await client.query(`
            DELETE FROM users 
            WHERE created_at < NOW() - make_interval(days => $1)
            AND username NOT LIKE '%Plataforma%'
            AND liquid_blue_balance = 100.0000
            AND escrow_blue_balance = 0.0000
            AND red_balance = 0.0000
        `, [daysInactive]);

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
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
}

/**
 * Limpia publicaciones antiguas completadas.
 */
async function cleanupOldPublications(req, res) {
    const daysOld = parseInt(req.body.daysOld, 10) || 180;
    const client = await pool.connect();

    try {
        console.log(`[ADMIN CLEANUP] Administrador inició limpieza de publicaciones antiguas (${daysOld} días)`);

        if (daysOld < 90) {
            return res.status(400).json({
                message: 'Por seguridad, no se pueden eliminar publicaciones con menos de 90 días de antigüedad'
            });
        }

        const { createBackup } = require('../../../backup-database.js');
        await createBackup();

        await client.query('BEGIN');

        const deleteResult = await client.query(`
            DELETE FROM publications 
            WHERE created_at < NOW() - make_interval(days => $1)
            AND status IN ('completed', 'confirmed_paid')
        `, [daysOld]);

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
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
}

/**
 * Obtiene estadísticas generales del programa de impulsores.
 */
async function getBoosterStats(req, res) {
    try {
        const statsQuery = `
            SELECT
                (SELECT COUNT(*) FROM users WHERE is_booster = TRUE) as total_boosters,
                (SELECT COUNT(*) FROM users WHERE is_booster = TRUE AND kyc_verified = TRUE) as eligible_boosters,
                (SELECT SUM(bbl.amount) FROM booster_blue_ledger bbl JOIN users u ON bbl.user_id = u.id WHERE u.is_booster = TRUE) as total_booster_blue_debt,
                (SELECT SUM(bbl.amount) FROM booster_blue_ledger bbl JOIN users u ON bbl.user_id = u.id WHERE u.is_booster = TRUE AND u.kyc_verified = TRUE) as eligible_booster_blue_debt,
                (SELECT COUNT(*) FROM booster_payment_log) as total_payments_made,
                (SELECT SUM(amount_paid) FROM booster_payment_log) as total_blue_paid_out,
                (SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1) as platform_commission_balance
        `;
        const result = await pool.query(statsQuery);
        const statsData = result.rows[0];

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

        let remainingCommission = parseFloat(statsData.platform_commission_balance) || 0;
        const coverage_by_level = [];

        for (let l = 1; l <= 5; l++) {
            const levelEligibleDebt = debt_by_level[l].eligible;

            if (levelEligibleDebt > 0) {
                let coveragePercentage = 0;
                
                if (remainingCommission >= levelEligibleDebt) {
                    coveragePercentage = 100;
                    remainingCommission -= levelEligibleDebt;
                } else if (remainingCommission > 0) {
                    coveragePercentage = (remainingCommission / levelEligibleDebt) * 100;
                    remainingCommission = 0;
                }
                
                coverage_by_level.push({
                    level: l,
                    percentage: parseFloat(coveragePercentage.toFixed(2)),
                    debt: levelEligibleDebt
                });
            }
        }

        statsData.debt_by_level = debt_by_level;
        statsData.coverage_by_level = coverage_by_level;
        res.json(statsData);
    } catch (error) {
        console.error('[AdminAuditStatsController] Error al obtener estadísticas booster:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Obtiene la lista de impulsores activos.
 */
async function getBoostersList(req, res) {
    try {
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
        console.error('[AdminAuditStatsController] Error al obtener lista de boosters:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Obtiene el log de pagos realizados a impulsores.
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
        console.error('[AdminAuditStatsController] Error al obtener log de pagos de impulsores:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Reconstruye el libro contable (booster_blue_ledger) de un usuario.
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

        const deleteLegacyTx = await client.query(
            `DELETE FROM booster_transactions
             WHERE user_id = $1 AND type IN ('legacy_backfill', 'legacy_backfill_residual')`,
            [userId]
        );

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
        console.error('[AdminAuditStatsController] Error al reconstruir ledger:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
}

/**
 * Obtiene estadísticas de recompensas de gobernanza.
 */
async function getGovernanceRewardStats(req, res) {
    try {
        const stats = await governanceRewardService.getPendingRewardStats(pool);
        return res.json(stats);
    } catch (error) {
        console.error('[AdminAuditStatsController] Error obteniendo stats de recompensas:', error);
        return res.status(500).json({ message: 'Error al obtener estadísticas de recompensas.' });
    }
}

/**
 * Procesa recompensas de gobernanza en lote para guardianes.
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

        for (const [userId, summary] of Object.entries(result.byGuardian)) {
            const safeUserId = parseInt(userId, 10);

            notificationService.sendNotificationToUser(safeUserId, {
                title: `+${summary.totalAmount.toFixed(2)} BLUE IOU acreditados`,
                body: `Recompensa retroactiva por ${summary.votesPaid} voto(s) de gobernanza.`,
                icon: '/assets/icons/icon-192x192.png',
                data: { url: '/history.html' },
            }, 'TRANSACTIONAL').catch(err =>
                console.error(`[AdminAuditStatsController] Error push batch reward user ${safeUserId}:`, err)
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
                    console.error(`[AdminAuditStatsController] Error email batch reward user ${safeUserId}:`, err)
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
        console.error('[AdminAuditStatsController] Error procesando recompensas batch:', error);
        return res.status(500).json({ message: 'Error al procesar recompensas pendientes.' });
    }
}

/**
 * Obtiene estadísticas de exportación demo.
 */
async function getDemoExportStats(req, res) {
    try {
        const stats = await govDemoRewardService.getExportStats(pool);
        return res.json(stats);
    } catch (error) {
        console.error('[AdminAuditStatsController] Error obteniendo stats de exportación demo:', error);
        return res.status(500).json({ message: 'Error al obtener estadísticas de exportación.' });
    }
}

/**
 * Genera la exportación de recompensas demo.
 */
async function generateDemoExport(req, res) {
    try {
        const result = await govDemoRewardService.generateExport(pool, req.user.userId);
        if (!result) {
            return res.json({ message: 'No hay votos pendientes de exportar.', data: null });
        }
        return res.json({ message: `${result.summary.total_votes} voto(s) exportados.`, data: result });
    } catch (error) {
        console.error('[AdminAuditStatsController] Error generando exportación demo:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Obtiene el historial de exportaciones demo.
 */
async function getDemoExportHistory(req, res) {
    try {
        const history = await govDemoRewardService.getExportHistory(pool);
        return res.json(history);
    } catch (error) {
        console.error('[AdminAuditStatsController] Error obteniendo historial de exportaciones:', error);
        return res.status(500).json({ message: 'Error al obtener historial de exportaciones.' });
    }
}

/**
 * Descarga el archivo JSON de una exportación demo por ID.
 */
async function downloadDemoExport(req, res) {
    try {
        const exportRecord = await govDemoRewardService.getExportById(
            pool, req.params.id, req.user.userId
        );
        return res.json(exportRecord);
    } catch (error) {
        console.error('[AdminAuditStatsController] Error descargando exportación:', error);
        if (error.message && error.message.includes('no encontrada')) {
            return res.status(404).json({ message: 'Exportación no encontrada.' });
        }
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Previsualiza la importación de un archivo JSON demo.
 */
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
        console.error('[AdminAuditStatsController] Error en preview de importación demo:', error);
        return res.status(400).json({ message: error.message });
    }
}

/**
 * Procesa la importación definitiva de recompensas demo.
 */
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
                console.error(`[AdminAuditStatsController] Error push demo reward user ${safeUserId}:`, err)
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
                    console.error(`[AdminAuditStatsController] Error email demo reward user ${safeUserId}:`, err)
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
        console.error('[AdminAuditStatsController] Error procesando importación demo:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
}

/**
 * Crea una nueva difusión por correo electrónico (Broadcast Email).
 */
async function createBroadcastEmail(req, res) {
    const { subject, title, bodyHtml, targetGroup, targetUsername, buttonText, buttonUrl } = req.body;
    let adminId = req.user?.userId;
    let adminUsername = req.user?.username;

    if (!adminId) {
        try {
            const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
            const platformUser = await pool.query('SELECT id, username FROM users WHERE username = $1', [platformUsername]);
            if (platformUser.rowCount > 0) {
                adminId = platformUser.rows[0].id;
                adminUsername = platformUser.rows[0].username;
            }
        } catch (err) {
            console.error("[AdminAuditStatsController] Error al buscar usuario admin de plataforma:", err);
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

        const broadcastResult = await client.query(
            `INSERT INTO email_broadcasts (admin_id, subject, title, body, target_group, target_username, button_text, button_url, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING id`,
            [adminId, subject, title, bodyHtml, targetGroup, targetUsername || null, buttonText || null, buttonUrl || null]
        );
        const broadcastId = broadcastResult.rows[0].id;

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

        await client.query('UPDATE email_broadcasts SET total_recipients = $1 WHERE id = $2', [usersResult.rowCount, broadcastId]);

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
        console.error('[AdminAuditStatsController] Error al crear difusión de correo:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno al programar la difusión.' });
    } finally {
        client.release();
    }
}

/**
 * Obtiene el listado de difusiones para auditoría.
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
        console.error("[AdminAuditStatsController] Error al obtener difusiones:", error);
        res.status(500).json({ message: "Error al obtener difusiones." });
    }
}

/**
 * Obtiene destinatarios de una difusión específica.
 */
async function getBroadcastRecipients(req, res) {
    const { id } = req.params;
    
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
        console.error('[AdminAuditStatsController] Error al obtener destinatarios de difusión:', error);
        res.status(500).json({ message: 'Error interno al consultar destinatarios.' });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTACIONES DEL SUBMÓDULO DE AUDITORÍA, MÉTRICAS Y DEMO
// ═══════════════════════════════════════════════════════════════════════════
module.exports = {
    getDashboardStats,
    getPlatformWalletBalance,
    getPlatformWalletLog,
    getAuditLog,
    getDatabaseStats,
    createDatabaseBackup,
    cleanupTestData,
    cleanupInactiveUsers,
    cleanupOldPublications,
    getBoosterStats,
    getBoostersList,
    getBoosterPaymentsLog,
    rebuildBoosterLedger,
    getGovernanceRewardStats,
    processGovernanceRewards,
    getDemoExportStats,
    generateDemoExport,
    getDemoExportHistory,
    downloadDemoExport,
    previewDemoImport,
    processDemoImport,
    createBroadcastEmail,
    getBroadcastEmails,
    getBroadcastRecipients
};
