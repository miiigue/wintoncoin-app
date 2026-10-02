const pool = require('../config/db');
const { logAuditEvent } = require('../services/auditService');

// ==========================================
// HELPERS PARA PERFIL DE IMPULSOR (BOOSTER)
// ==========================================

async function getBoosterRankData(client, userId) {
    const result = await client.query(
        `
        WITH totals AS (
            SELECT user_id, SUM(amount) AS total
            FROM booster_blue_ledger
            GROUP BY user_id
            HAVING SUM(amount) > 0
        ),
        ranked AS (
            SELECT
                user_id,
                total,
                RANK() OVER (ORDER BY total DESC) AS rank_position,
                COUNT(*) OVER () AS total_users
            FROM totals
        )
        SELECT rank_position, total_users
        FROM ranked
        WHERE user_id = $1
        `,
        [userId]
    );

    if (result.rowCount === 0) return null;

    const rankPosition = parseInt(result.rows[0].rank_position || '0', 10);
    const rankTotal = parseInt(result.rows[0].total_users || '0', 10);
    const rankPercentile = rankTotal > 0 ? Math.ceil((rankPosition / rankTotal) * 100) : null;

    return {
        rank_position: rankPosition,
        rank_total: rankTotal,
        rank_percentile: rankPercentile
    };
}

async function getReferralRankData(client, userId) {
    const result = await client.query(
        `
        WITH friends AS (
            SELECT $1::int AS user_id
            UNION
            SELECT referred_user_id
            FROM referral_log
            WHERE referrer_user_id = $1
        ),
        totals AS (
            SELECT
                f.user_id,
                COALESCE(SUM(bbl.amount), 0) AS total
            FROM friends f
            LEFT JOIN booster_blue_ledger bbl ON bbl.user_id = f.user_id
            GROUP BY f.user_id
        ),
        ranked AS (
            SELECT
                user_id,
                total,
                RANK() OVER (ORDER BY total DESC) AS rank_position,
                COUNT(*) OVER () AS total_users
            FROM totals
        )
        SELECT rank_position, total_users
        FROM ranked
        WHERE user_id = $1
        `,
        [userId]
    );

    if (result.rowCount === 0) return null;

    const rankPosition = parseInt(result.rows[0].rank_position || '0', 10);
    const rankTotal = parseInt(result.rows[0].total_users || '0', 10);
    const rankPercentile = rankTotal > 0 ? Math.ceil((rankPosition / rankTotal) * 100) : null;

    return {
        rank_position: rankPosition,
        rank_total: rankTotal,
        rank_percentile: rankPercentile
    };
}

async function getBoosterDailyData(client, userId) {
    const [todayResult, yesterdayResult] = await Promise.all([
        client.query(
            `
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM booster_blue_ledger
            WHERE user_id = $1
              AND amount > 0
              AND created_at >= date_trunc('day', NOW())
              AND created_at < date_trunc('day', NOW()) + INTERVAL '1 day'
            `,
            [userId]
        ),
        client.query(
            `
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM booster_blue_ledger
            WHERE user_id = $1
              AND amount > 0
              AND created_at >= date_trunc('day', NOW()) - INTERVAL '1 day'
              AND created_at < date_trunc('day', NOW())
            `,
            [userId]
        )
    ]);

    const todayEarned = parseFloat(todayResult.rows[0]?.total) || 0;
    const yesterdayEarned = parseFloat(yesterdayResult.rows[0]?.total) || 0;

    return {
        daily_today: todayEarned,
        daily_yesterday: yesterdayEarned,
        daily_improved: todayEarned > yesterdayEarned
    };
}

// ==========================================
// CONTROLADOR DE USUARIOS (USER CONTROLLER)
// ==========================================

const UserController = {
    // ------------------------------------------------------------------------
    // Obtener balance consolidado del usuario autenticado (Estándar Profesional)
    // ------------------------------------------------------------------------
    getMyBalance: async (req, res) => {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "No autenticado." });
        }

        const client = await pool.connect();
        try {
            // 1) Obtener balances desde users por ID (estándar profesional)
            const userResult = await client.query(
                `SELECT username, liquid_blue_balance, escrow_blue_balance, red_balance, web3_wallet_address, kyc_verified, has_transaction_pin
                 FROM users
                 WHERE id = $1`,
                [userId]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({ message: "Usuario no encontrado." });
            }

            const username = userResult.rows[0].username;

            const mode=await client.query("SELECT setting_value FROM app_settings WHERE setting_key='pre_launch_mode_enabled'");
            if(mode.rows[0]?.setting_value!=='true'){
                if(!userResult.rows[0].web3_wallet_address)return res.status(503).json({message:'La billetera de la cuenta todavía no está asociada. No se muestran saldos antiguos.'});
                const chain=await require('../services/web3BridgeService').getUserAuditDetailed(userResult.rows[0].web3_wallet_address);
                if(!chain.success)return res.status(503).json({message:'No se pudo comprobar el saldo en blockchain. No se muestran saldos antiguos como actuales.'});
                return res.status(200).json({
                    blue_balance:chain.blueAvailable,escrow_blue_balance:chain.blueLocked,red_balance:chain.redCommitment,
                    web3_wallet_address:chain.wallet,has_transaction_pin:userResult.rows[0].has_transaction_pin===true,
                    kyc_verified:chain.credit.isKYCVerified,credit_limit:chain.credit.baseLimit,
                    available_capacity:chain.credit.availableCapacity,collateral_balance:chain.collateralVault.totalLocked,
                    is_delinquent:chain.credit.isDelinquent,balance_source:'blockchain',block_number:chain.blockNumber,
                    debt_lots:chain.debtLots,lot_pagination:chain.pagination,
                    next_due_at:null,next_due_amount:null,next_unlock_at:null,next_unlock_amount:null,
                    debt_30_days:null,debt_end_month:null,penalized_debt:null
                });
            }

            // 2) Tablas legacy por username
            const debtSql = `
                SELECT due_at, amount FROM red_token_debts 
                WHERE username = $1 AND is_settled = FALSE ORDER BY due_at ASC LIMIT 1
            `;
            const escrowSql = `
                SELECT unlock_at, amount FROM blue_token_escrows
                WHERE username = $1 AND is_released = FALSE ORDER BY unlock_at ASC LIMIT 1
            `;
            const penalizedDebtSql = `
                SELECT SUM(amount) as total_penalized_debt FROM red_token_debts
                WHERE username = $1 AND is_penalized = TRUE AND is_settled = FALSE
            `;
            const debt30DaysSql = `
                SELECT COALESCE(SUM(amount), 0) as total FROM red_token_debts 
                WHERE username = $1 AND is_settled = FALSE AND due_at <= NOW() + INTERVAL '30 days'
            `;
            const debtEndMonthSql = `
                SELECT COALESCE(SUM(amount), 0) as total FROM red_token_debts 
                WHERE username = $1 AND is_settled = FALSE AND due_at <= (date_trunc('month', NOW()) + INTERVAL '1 month - 1 day')
            `;

            const [debtResult, escrowResult, penalizedDebtResult, debt30Result, debtEndMonthResult] = await Promise.all([
                client.query(debtSql, [username]),
                client.query(escrowSql, [username]),
                client.query(penalizedDebtSql, [username]),
                client.query(debt30DaysSql, [username]),
                client.query(debtEndMonthSql, [username])
            ]);

            const creditScoringService = require('../services/creditScoringService');
            const creditLimit = await creditScoringService.calculateUserScore(userId);

            const Web3BridgeService = require('../services/web3BridgeService');
            
            let isKycVerified = false;
            let blockchainQuerySucceeded = false;

            if (userResult.rows[0].web3_wallet_address) {
                const kycResult = await Web3BridgeService.checkUserKYCDetailed(userResult.rows[0].web3_wallet_address);
                blockchainQuerySucceeded = kycResult.success;
                isKycVerified = kycResult.verified;
            }

            // Sincronización Automática DB <- Blockchain
            const dbKycStatus = userResult.rows[0].kyc_verified === true;
            if (blockchainQuerySucceeded && userResult.rows[0].web3_wallet_address) {
                if (isKycVerified !== dbKycStatus) {
                    try {
                        await client.query(
                            'UPDATE users SET kyc_verified = $1 WHERE id = $2',
                            [isKycVerified, userId]
                        );
                        console.log(`[API BALANCE] ✅ Sincronización KYC: DB actualizada de ${dbKycStatus} a ${isKycVerified} para usuario #${userId}`);

                        // Si cambia a true, disparar de forma segura el envío de correos de donaciones liberadas
                        if (isKycVerified === true) {
                            const humanitarianService = require('../services/humanitarianService');
                            humanitarianService.processAndSendEmailsForReleasedDonations(userId)
                                .catch(e => console.error(`[API BALANCE] Error al procesar correos de liberación tras KYC para usuario #${userId}:`, e.message));
                        }
                    } catch (syncErr) {
                        console.error(`[API BALANCE] ⚠️ Error al sincronizar KYC en DB para usuario #${userId}:`, syncErr.message);
                    }
                }
            }

            // Fallback
            if (!blockchainQuerySucceeded && dbKycStatus) {
                isKycVerified = true;
            }

            // Consultar el saldo neto de garantía depositada en la Bóveda (Collateral Vault)
            // Este valor se suma al creditLimit orgánico para dar el Límite RED total al usuario.
            const collateralRes = await client.query(
                `SELECT COALESCE(SUM(amount), 0) AS net_collateral
                 FROM collateral_deposits
                 WHERE user_id = $1`,
                [userId]
            );
            const collateralBalance = parseFloat(collateralRes.rows[0].net_collateral) || 0;

            const responseData = {
                blue_balance: userResult.rows[0].liquid_blue_balance,
                escrow_blue_balance: userResult.rows[0].escrow_blue_balance,
                red_balance: userResult.rows[0].red_balance,
                web3_wallet_address: userResult.rows[0].web3_wallet_address,
                kyc_verified: isKycVerified,
                has_transaction_pin: userResult.rows[0].has_transaction_pin === true,
                credit_limit: creditLimit,
                collateral_balance: collateralBalance,
                debt_30_days: debt30Result.rows[0].total,
                debt_end_month: debtEndMonthResult.rows[0].total,
                next_due_at: debtResult.rows[0]?.due_at || null,
                next_due_amount: debtResult.rows[0]?.amount || null,
                next_unlock_at: escrowResult.rows[0]?.unlock_at || null,
                next_unlock_amount: escrowResult.rows[0]?.amount || null,
                penalized_debt: penalizedDebtResult.rows[0]?.total_penalized_debt || '0'
            };

            res.status(200).json(responseData);
        } catch (err) {
            console.error("Error al obtener balance (me):", err);
            return res.status(500).json({ message: "Error interno del servidor." });
        } finally {
            client.release();
        }
    },

    // ------------------------------------------------------------------------
    // Registrar un depósito o retiro de garantía en la Bóveda (Collateral Vault)
    // Endpoint: POST /api/me/collateral/sync
    // Recibe: { operation_type, amount, token_symbol, token_contract_address, tx_hash, balance_after }
    // Seguridad: Solo usuarios autenticados pueden registrar operaciones propias.
    // Auditoría: Cada registro es inmutable (trigger SOC 2 en PostgreSQL).
    // ------------------------------------------------------------------------
    syncCollateral: async (req, res) => {
        return res.status(410).json({message: "El colateral se confirma desde blockchain. Utiliza las operaciones de Billetera con PIN."});
    },


    // ------------------------------------------------------------------------
    // Obtener balance público o legacy de otro usuario (requiere auth)
    // ------------------------------------------------------------------------
    getUserBalanceLegacy: async (req, res) => {
        const { username } = req.params;
        if (!req.user?.username || req.user.username !== username) {
            return res.status(403).json({ message: 'No autorizado para consultar balance de otro usuario.' });
        }

        return UserController.getMyBalance(req,res);
    },

    // ------------------------------------------------------------------------
    // Obtener perfil público (estadísticas y ratings)
    // ------------------------------------------------------------------------
    getUserProfile: async (req, res) => {
        const { username } = req.params;
        const client = await pool.connect();
        try {
            const settingsResult = await client.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'public_profiles_enabled'`);
            const isEnabled = settingsResult.rows[0]?.setting_value === 'true';

            if (!isEnabled) {
                return res.status(404).json({ message: "Perfiles de usuario no encontrados." });
            }

            await client.query('BEGIN');

            const userSql = `SELECT username, average_rating, ratings_count, web3_wallet_address FROM users WHERE username = $1`;
            const userResult = await client.query(userSql, [username]);
            if (userResult.rowCount === 0) {
                throw { status: 404, message: "Usuario no encontrado." };
            }
            const userProfile = userResult.rows[0];

            const ratingsSql = `SELECT rater_username, rating, comment, created_at FROM ratings WHERE ratee_username = $1 ORDER BY created_at DESC`;
            const ratingsResult = await client.query(ratingsSql, [username]);
            const ratings = ratingsResult.rows;

            await client.query('COMMIT');

            res.status(200).json({
                user: userProfile,
                ratings: ratings
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`Error al obtener el perfil de ${username}:`, error);
            res.status(error.status || 500).json({ message: error.message || "Error interno del servidor." });
        } finally {
            client.release();
        }
    },

    // ------------------------------------------------------------------------
    // Obtener código de referido
    // ------------------------------------------------------------------------
    getReferralCode: async (req, res) => {
        const { username } = req.params;
        try {
            const result = await pool.query('SELECT referral_code FROM users WHERE username = $1', [username]);
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Usuario no encontrado.' });
            }
            res.json({ referral_code: result.rows[0].referral_code });
        } catch (error) {
            console.error('Error al obtener el código de referido:', error);
            res.status(500).json({ message: 'Error interno del servidor.' });
        }
    },

    // ------------------------------------------------------------------------
    // Obtener información básica de usuario (calificaciones)
    // ------------------------------------------------------------------------
    getUserBasicInfo: async (req, res) => {
        const { username } = req.params;
        const sql = `SELECT username, average_rating, ratings_count FROM users WHERE username = $1`;
        try {
            const result = await pool.query(sql, [username]);
            if (result.rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado." });
            res.status(200).json(result.rows[0]);
        } catch (err) {
            return res.status(500).json({ message: "Error interno del servidor." });
        }
    },

    // ------------------------------------------------------------------------
    // Obtener el historial de un usuario (Legacy)
    // ------------------------------------------------------------------------
    getUserHistoryLegacy: async (req, res) => {
        const { username } = req.params;
        if (!req.user?.username || req.user.username !== username) {
            return res.status(403).json({ message: 'No autorizado para consultar historial de otro usuario.' });
        }
        try {
            const authoredSql = `
                SELECT
                    p.*,
                    u.username as author_username,
                    (p.deleted_at IS NOT NULL) AS is_deleted,
                    (p.expires_at IS NOT NULL AND p.expires_at < NOW()) AS is_expired,
                    (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id) AS participants_count,
                    (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id AND pa.status = 'confirmed_paid') AS completed_count,
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
                WHERE u.username = $1
                ORDER BY p.created_at DESC
            `;

            const completedSql = `
                SELECT
                    p.*,
                    u.username as author_username,
                    pa.status as user_acceptance_status,
                    pa.form_responses,
                    (p.deleted_at IS NOT NULL) AS is_deleted,
                    (p.expires_at IS NOT NULL AND p.expires_at < NOW()) AS is_expired
                FROM publications p
                JOIN users u ON p.author_id = u.id
                JOIN publication_acceptances pa ON p.id = pa.publication_id
                WHERE pa.acceptor_username = $1 AND pa.status = 'confirmed_paid'
                ORDER BY p.created_at DESC
            `;

            const [authoredResult, completedResult] = await Promise.all([
                pool.query(authoredSql, [username]),
                pool.query(completedSql, [username])
            ]);

            res.status(200).json({ authored: authoredResult.rows, completed: completedResult.rows });
        } catch (err) {
            console.error("Error al obtener el historial legacy:", err.message);
            res.status(500).json({ message: "Error interno del servidor." });
        }
    },

    // ------------------------------------------------------------------------
    // Obtener el historial del usuario autenticado (Profesional)
    // ------------------------------------------------------------------------
    getMyHistory: async (req, res) => {
        const userId = req.user?.userId;
        const username = req.user?.username;
        if (!userId || !username) {
            return res.status(401).json({ message: 'No autenticado.' });
        }

        try {
            const authoredSql = `
                SELECT
                    p.*,
                    u.username as author_username,
                    (p.deleted_at IS NOT NULL) AS is_deleted,
                    (p.expires_at IS NOT NULL AND p.expires_at < NOW()) AS is_expired,
                    (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id) AS participants_count,
                    (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id AND pa.status = 'confirmed_paid') AS completed_count,
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
                WHERE p.author_id = $1
                ORDER BY p.created_at DESC
            `;

            const completedSql = `
                SELECT
                    p.*,
                    u.username as author_username,
                    pa.status as user_acceptance_status,
                    pa.form_responses,
                    (p.deleted_at IS NOT NULL) AS is_deleted,
                    (p.expires_at IS NOT NULL AND p.expires_at < NOW()) AS is_expired
                FROM publications p
                JOIN users u ON p.author_id = u.id
                JOIN publication_acceptances pa ON p.id = pa.publication_id
                WHERE pa.acceptor_username = $1 AND pa.status = 'confirmed_paid'
                ORDER BY p.created_at DESC
            `;

            // [Auditoría] Query para obtener causas solidarias postuladas por el usuario actual.
            // Esto permite que el historial del usuario incluya tanto tareas comerciales como causas humanitarias.
            // Se mapean los campos equivalentes para mantener la compatibilidad con el frontend.
            const causesSql = `
                SELECT
                    hc.id,
                    hc.user_id AS author_id,
                    hc.title,
                    hc.story AS description, -- 'story' mapeado a 'description' para consistencia en UI
                    hc.goal_amount AS blue_cost, -- 'goal_amount' mapeado a 'blue_cost' para el indicador financiero
                    hc.current_amount,
                    hc.status,
                    hc.created_at,
                    u.username AS author_username,
                    TRUE AS is_humanitarian -- Flag explícito para diferenciar del flujo de tareas regulares
                FROM humanitarian_causes hc
                JOIN users u ON hc.user_id = u.id
                WHERE hc.user_id = $1
                ORDER BY hc.created_at DESC
            `;

            // [Auditoría] Query para obtener el historial de donaciones realizadas por este usuario.
            // Permite al usuario rastrear el estado contable de sus contribuciones solidarias (on_hold, released, refunded).
            const donationsSql = `
                SELECT
                    hd.id AS donation_id,
                    hd.amount,
                    hd.status AS donation_status,
                    hd.created_at AS donation_created_at,
                    hc.id AS cause_id,
                    hc.title AS cause_title,
                    hc.status AS cause_status,
                    u.username AS creator_username
                FROM humanitarian_donations hd
                JOIN humanitarian_causes hc ON hd.cause_id = hc.id
                JOIN users u ON hc.user_id = u.id
                WHERE hd.donor_id = $1
                ORDER BY hd.created_at DESC
            `;

            // [Auditoría / Trazabilidad] Ejecución concurrente optimizada mediante Promise.all
            const [authoredResult, completedResult, causesResult, donationsResult] = await Promise.all([
                pool.query(authoredSql, [userId]),
                pool.query(completedSql, [username]),
                pool.query(causesSql, [userId]), // Consultar causas del usuario
                pool.query(donationsSql, [userId]) // [Auditoría] Consultar donaciones realizadas
            ]);

            // [Optimización] Fusión segura en memoria de publicaciones y causas solidarias.
            // Para las publicaciones comerciales se agrega 'is_humanitarian: false' explícitamente.
            const combinedAuthored = [
                ...authoredResult.rows.map(r => ({ ...r, is_humanitarian: false })),
                ...causesResult.rows.map(r => ({ ...r, is_humanitarian: true }))
            ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Ordenación descendente por fecha de creación

            // [Auditoría] Responder con estado HTTP 200 y la información debidamente estructurada
            res.status(200).json({ 
                authored: combinedAuthored, 
                completed: completedResult.rows,
                donations: donationsResult.rows // Incluir donaciones realizadas
            });
        } catch (err) {
            console.error("Error al obtener historial (/api/me/history):", err.message);
            res.status(500).json({ message: "Error interno del servidor." });
        }
    },

    // ------------------------------------------------------------------------
    // Obtener el perfil de Impulsor del usuario autenticado (Estructura Enriquecida)
    // Optimización: Consolidación de sumatorias en base a booster_blue_ledger
    // Seguridad: Autenticación obligatoria mediante JWT extraído de req.user
    // Auditoría: Extracción directa de la base de datos de movimientos (Ledger)
    // ------------------------------------------------------------------------
    getMyBoosterProfile: async (req, res) => {
        // [Auditoría] Extraer el ID de usuario autenticado desde el token decodificado por el middleware
        const userId = req.user?.userId;
        // [Auditoría] Extraer el nombre de usuario autenticado para adjuntarlo en la respuesta
        const username = req.user?.username;
        
        // [Seguridad] Validar que exista el identificador de usuario en el contexto de la sesión
        if (!userId) {
            return res.status(401).json({ message: "No autenticado." });
        }

        // [Rendimiento] Adquirir un cliente específico del pool de conexiones para transacciones concurrentes
        const client = await pool.connect();
        try {
            // [Auditoría / Integridad] Sumatorias de saldos total, elegible y pendiente (Core Financiero)
            const FinancialCoreService = require('../services/financialCoreService');
            const balanceInfo = await FinancialCoreService.getUserEligibleBalance(client, userId);
            const totalBoosterBlue = balanceInfo.totalBalance;
            const eligibleBoosterBlue = balanceInfo.eligibleBalance;
            // LÓGICA COHERENTE: Mostrar únicamente el saldo que proviene de referidos sin KYC,
            // independientemente de si el titular tiene o no KYC.
            const pendingBoosterBlue = balanceInfo.unverifiedReferralBalance;

            // [Auditoría] Sumatoria de ganancias acumuladas históricas (amount > 0) para cálculo de niveles y membresía de booster
            const totalEarnedResult = await client.query(
                'SELECT COALESCE(SUM(amount), 0) AS total_earned FROM booster_blue_ledger WHERE user_id = $1 AND amount > 0',
                [userId]
            );
            const totalBoosterBlueEarned = parseFloat(totalEarnedResult.rows[0].total_earned) || 0;

            // [Lógica de Negocio] Validar si el usuario forma parte activa basándose en sus ganancias históricas
            if (totalBoosterBlueEarned <= 0) {
                return res.json({
                    is_booster: false,
                    message: 'Aún no formas parte del programa de impulsores.'
                });
            }

            // [Rendimiento] Ejecución concurrente mediante Promise.all para reducir la latencia de respuesta (I/O Bound)
            const [ledgerHistoryResult, levelSettingsResult, currentLevelResult, tasksCountResult, rankData, friendsRankData, dailyData] = await Promise.all([
                // A) Consultar historial de ledger cruzando con booster_transactions para obtener descripciones y tipos legibles
                client.query(
                    `
                    SELECT
                        bbl.id,
                        bbl.amount,
                        bbl.created_at,
                        bbl.source_publication_id AS related_publication_id,
                        COALESCE(bt_pick.type,
                            CASE
                                WHEN bbl.source_publication_id IS NOT NULL AND bbl.amount > 0 THEN 'task_reward'
                                WHEN bbl.amount < 0 THEN 'debit'
                                ELSE 'credit'
                            END
                        ) AS type,
                        COALESCE(
                            bt_pick.description,
                            CASE
                                WHEN p.title IS NOT NULL THEN 'Actividad de Impulsor: "' || p.title || '"'
                                ELSE 'Actividad de Impulsor (legacy)'
                            END
                        ) AS description
                    FROM booster_blue_ledger bbl
                    LEFT JOIN publications p ON p.id = bbl.source_publication_id
                    LEFT JOIN LATERAL (
                        SELECT bt.type, bt.description
                        FROM booster_transactions bt
                        WHERE bt.user_id = bbl.user_id
                          AND bt.amount = bbl.amount
                          AND bt.related_publication_id IS NOT DISTINCT FROM bbl.source_publication_id
                          AND bt.created_at BETWEEN (bbl.created_at - INTERVAL '2 minutes') AND (bbl.created_at + INTERVAL '2 minutes')
                        ORDER BY ABS(EXTRACT(EPOCH FROM (bt.created_at - bbl.created_at))) ASC
                        LIMIT 1
                    ) bt_pick ON TRUE
                    WHERE bbl.user_id = $1
                    ORDER BY bbl.created_at DESC
                    `,
                    [userId]
                ),
                // B) Configuración global de todos los niveles del sistema
                client.query('SELECT * FROM booster_level_settings ORDER BY level ASC'),
                // C) Calcular el nivel actual del usuario basado en el total acumulado de BLUE iou histórico (ganancias)
                client.query(
                    'SELECT MAX(level) AS current_level FROM booster_level_settings WHERE min_blue_required <= $1',
                    [totalBoosterBlueEarned]
                ),
                // D) Contar la cantidad de tareas individuales completadas por el impulsor
                client.query(
                    `SELECT COUNT(*) AS tasks_completed
                     FROM booster_blue_ledger bbl
                     WHERE bbl.user_id = $1 AND bbl.amount > 0 AND bbl.source_publication_id IS NOT NULL`,
                    [userId]
                ),
                // E) Obtener ranking global (mundial) del usuario
                getBoosterRankData(client, userId),
                // F) Obtener ranking de amigos (referidos directos)
                getReferralRankData(client, userId),
                // G) Obtener métricas comparativas diarias (hoy vs ayer)
                getBoosterDailyData(client, userId)
            ]);

            // [Modularización] Procesamiento y mapeo de niveles del sistema
            const allLevels = levelSettingsResult.rows;
            const currentLevel = currentLevelResult.rows[0].current_level || 0;
            const currentLevelInfo = allLevels.find(l => l.level === currentLevel) || null;
            const nextLevelInfo = allLevels.find(l => l.level === (currentLevel || 0) + 1) || null;

            // [Modularización] Formatear conteo de tareas a tipo entero nativo
            const tasksCompleted = parseInt(tasksCountResult.rows[0]?.tasks_completed || '0', 10);

            // [Auditoría] Responder con la estructura completa enriquecida requerida por el frontend
            res.json({
                is_booster: true,
                username: username,
                booster_level: currentLevel,
                total_booster_blue: totalBoosterBlue,
                eligible_booster_blue: eligibleBoosterBlue,
                pending_booster_blue: pendingBoosterBlue,
                base_eligible_booster_blue: balanceInfo.baseEligibleBalance,
                current_level_info: currentLevelInfo,
                next_level_info: nextLevelInfo,
                booster_tasks_completed_count: tasksCompleted,
                transactions: ledgerHistoryResult.rows,
                all_levels: allLevels,
                rank_position: rankData?.rank_position || null,
                rank_total: rankData?.rank_total || null,
                rank_percentile: rankData?.rank_percentile || null,
                friends_rank_position: friendsRankData?.rank_position || null,
                friends_rank_total: friendsRankData?.rank_total || null,
                friends_rank_percentile: friendsRankData?.rank_percentile || null,
                daily_today: dailyData?.daily_today || 0,
                daily_yesterday: dailyData?.daily_yesterday || 0,
                daily_improved: dailyData?.daily_improved || false
            });

        } catch (error) {
            // [Auditoría / Diagnóstico] Registro detallado del error en logs del servidor
            console.error("Error obteniendo perfil booster:", error);
            res.status(500).json({ message: "Error interno del servidor." });
        } finally {
            // [Seguridad / Rendimiento] Liberación obligatoria del cliente para prevenir fugas de conexión en el Pool
            client.release();
        }
    },

    // ------------------------------------------------------------------------
    // Quema de Tokens (Transacción Financiera)
    // ------------------------------------------------------------------------
    burnTokens: async (req, res) => {
        return res.status(410).json({message: "La amortización requiere una operación confirmada en blockchain. Utiliza Billetera con tu PIN."});
    },


    // ------------------------------------------------------------------------
    // Crear una calificación para otro usuario (Mapeado de /rate)
    // ------------------------------------------------------------------------
    createRating: async (req, res) => {
        const { publication_id, rater_username, ratee_username, rating, comment } = req.body;
        if (!publication_id || !rater_username || !ratee_username || !rating) {
            return res.status(400).json({ message: 'Faltan datos requeridos para la calificación.' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const insertRatingQuery = `
                INSERT INTO ratings (publication_id, rater_username, ratee_username, rating, comment)
                VALUES ($1, $2, $3, $4, $5)
            `;
            await client.query(insertRatingQuery, [publication_id, rater_username, ratee_username, rating, comment || null]);

            const updateUserRatingQuery = `
                UPDATE users u
                SET 
                    ratings_count = r.total_ratings,
                    average_rating = r.avg_rating
                FROM (
                    SELECT 
                        ratee_username, COUNT(*) AS total_ratings, AVG(rating) AS avg_rating
                    FROM ratings WHERE ratee_username = $1 GROUP BY ratee_username
                ) r
                WHERE u.username = $1;
            `;
            await client.query(updateUserRatingQuery, [ratee_username]);

            await client.query('COMMIT');
            res.status(201).json({ message: `¡Gracias! Tu calificación para ${ratee_username} ha sido guardada.` });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error al guardar la calificación:', error.message);
            res.status(500).json({ message: 'Error interno al guardar la calificación.' });
        } finally {
            client.release();
        }
    },

    // ------------------------------------------------------------------------
    // Obtener información de referidos de un usuario (su código y referidos)
    // ------------------------------------------------------------------------
    getReferralInfo: async (req, res) => {
        const { username } = req.params;

        if (!username) {
            return res.status(400).json({ message: "Se requiere un nombre de usuario." });
        }

        const client = await pool.connect();
        try {
            const [userResult, referredUsersResult] = await Promise.all([
                client.query('SELECT id, referral_code FROM users WHERE username = $1', [username]),
                client.query(`
                    SELECT
                        u.username as referred_username,
                        u.kyc_verified,
                        rl.created_at,
                        (
                            SELECT COALESCE(SUM(amount), 0)
                            FROM booster_blue_ledger
                            WHERE user_id = u.id
                        ) as total_booster_blue
                    FROM referral_log rl
                    JOIN users u ON rl.referred_user_id = u.id
                    WHERE rl.referrer_user_id = (SELECT id FROM users WHERE username = $1)
                    ORDER BY total_booster_blue DESC, rl.created_at DESC;
                `, [username])
            ]);

            if (userResult.rowCount === 0) {
                return res.status(404).json({ message: 'Usuario no encontrado.' });
            }

            let referralCode = userResult.rows[0].referral_code;
            if (!referralCode) {
                const { generateUniqueReferralCode } = require('../config/databaseInit');
                referralCode = await generateUniqueReferralCode(client, username);
                await client.query('UPDATE users SET referral_code = $1 WHERE id = $2', [referralCode, userResult.rows[0].id]);
            }

            const referredUsers = referredUsersResult.rows;

            res.status(200).json({
                referral_code: referralCode,
                referred_users: referredUsers
            });

        } catch (error) {
            console.error(`Error al obtener la información de referidos para ${username}:`, error);
            res.status(500).json({ message: 'Error interno del servidor.' });
        } finally {
            client.release();
        }
    },

    // ------------------------------------------------------------------------
    // Obtener perfil de impulsor de un usuario por username (público/detallado)
    // ------------------------------------------------------------------------
    getUserBoosterProfile: async (req, res) => {
        const { username } = req.params;
        if (!username) {
            return res.status(400).json({ message: 'Se requiere un nombre de usuario.' });
        }

        const client = await pool.connect();
        try {
            const userResult = await client.query(
                `SELECT id, username FROM users WHERE username = $1`,
                [username]
            );

            if (userResult.rowCount === 0) {
                return res.status(404).json({ message: 'Usuario no encontrado.' });
            }

            const user = userResult.rows[0];

            // Sumatorias de saldos total, elegible y pendiente (Core Financiero)
            const FinancialCoreService = require('../services/financialCoreService');
            const balanceInfo = await FinancialCoreService.getUserEligibleBalance(client, user.id);
            const totalBoosterBlue = balanceInfo.totalBalance;
            const eligibleBoosterBlue = balanceInfo.eligibleBalance;
            // LÓGICA COHERENTE: Mostrar únicamente el saldo que proviene de referidos sin KYC,
            // independientemente de si el titular tiene o no KYC.
            const pendingBoosterBlue = balanceInfo.unverifiedReferralBalance;

            // Sumatoria de ganancias acumuladas históricas (amount > 0) para niveles y membresía de booster
            const totalEarnedResult = await client.query(
                'SELECT COALESCE(SUM(amount), 0) AS total_earned FROM booster_blue_ledger WHERE user_id = $1 AND amount > 0',
                [user.id]
            );
            const totalBoosterBlueEarned = parseFloat(totalEarnedResult.rows[0].total_earned) || 0;

            if (totalBoosterBlueEarned <= 0) {
                return res.json({
                    is_booster: false,
                    message: 'Este usuario aún no forma parte del programa de impulsores.'
                });
            }

            const [ledgerHistoryResult, levelSettingsResult, currentLevelResult, tasksCountResult, rankData, friendsRankData, dailyData] = await Promise.all([
                client.query(
                    `
                    SELECT
                        bbl.id,
                        bbl.amount,
                        bbl.created_at,
                        bbl.source_publication_id AS related_publication_id,
                        COALESCE(bt_pick.type,
                            CASE
                                WHEN bbl.source_publication_id IS NOT NULL AND bbl.amount > 0 THEN 'task_reward'
                                WHEN bbl.amount < 0 THEN 'debit'
                                ELSE 'credit'
                            END
                        ) AS type,
                        COALESCE(
                            bt_pick.description,
                            CASE
                                WHEN p.title IS NOT NULL THEN 'Actividad de Impulsor: \"' || p.title || '\"'
                                ELSE 'Actividad de Impulsor (legacy)'
                            END
                        ) AS description
                    FROM booster_blue_ledger bbl
                    LEFT JOIN publications p ON p.id = bbl.source_publication_id
                    LEFT JOIN LATERAL (
                        SELECT bt.type, bt.description
                        FROM booster_transactions bt
                        WHERE bt.user_id = bbl.user_id
                          AND bt.amount = bbl.amount
                          AND bt.related_publication_id IS NOT DISTINCT FROM bbl.source_publication_id
                          AND bt.created_at BETWEEN (bbl.created_at - INTERVAL '2 minutes') AND (bbl.created_at + INTERVAL '2 minutes')
                        ORDER BY ABS(EXTRACT(EPOCH FROM (bt.created_at - bbl.created_at))) ASC
                        LIMIT 1
                    ) bt_pick ON TRUE
                    WHERE bbl.user_id = $1
                    ORDER BY bbl.created_at DESC
                    `,
                    [user.id]
                ),
                client.query('SELECT * FROM booster_level_settings ORDER BY level ASC'),
                client.query(
                    'SELECT MAX(level) AS current_level FROM booster_level_settings WHERE min_blue_required <= $1',
                    [totalBoosterBlueEarned]
                ),
                client.query(
                    `SELECT COUNT(*) AS tasks_completed
                     FROM booster_blue_ledger bbl
                     WHERE bbl.user_id = $1 AND bbl.amount > 0 AND bbl.source_publication_id IS NOT NULL`,
                    [user.id]
                ),
                getBoosterRankData(client, user.id),
                getReferralRankData(client, user.id),
                getBoosterDailyData(client, user.id)
            ]);

            const allLevels = levelSettingsResult.rows;
            const currentLevel = currentLevelResult.rows[0].current_level || 0;
            const currentLevelInfo = allLevels.find(l => l.level === currentLevel) || null;
            const nextLevelInfo = allLevels.find(l => l.level === (currentLevel || 0) + 1) || null;

            const tasksCompleted = parseInt(tasksCountResult.rows[0]?.tasks_completed || '0', 10);

            res.json({
                is_booster: true,
                username: user.username,
                booster_level: currentLevel,
                total_booster_blue: totalBoosterBlue,
                eligible_booster_blue: eligibleBoosterBlue,
                pending_booster_blue: pendingBoosterBlue,
                base_eligible_booster_blue: balanceInfo.baseEligibleBalance,
                current_level_info: currentLevelInfo,
                next_level_info: nextLevelInfo,
                booster_tasks_completed_count: tasksCompleted,
                transactions: ledgerHistoryResult.rows,
                all_levels: allLevels,
                rank_position: rankData?.rank_position || null,
                rank_total: rankData?.rank_total || null,
                rank_percentile: rankData?.rank_percentile || null,
                friends_rank_position: friendsRankData?.rank_position || null,
                friends_rank_total: friendsRankData?.rank_total || null,
                friends_rank_percentile: friendsRankData?.rank_percentile || null,
                daily_today: dailyData?.daily_today || 0,
                daily_yesterday: dailyData?.daily_yesterday || 0,
                daily_improved: dailyData?.daily_improved || false
            });

        } catch (error) {
            console.error(`Error al obtener el perfil de impulsor para ${username}:`, error);
            res.status(500).json({ message: 'Error interno del servidor.' });
        } finally {
            client.release();
        }
    },

    // ========================================================================
    // AUTOCUSTODIA & PIN DE SEGURIDAD (FINTECH / SOC 2 / ZERO-TRUST)
    // ========================================================================

    /**
     * Consulta el estado actual de seguridad del PIN de la billetera del usuario autenticado.
     * Retorna si tiene PIN configurado, si su KYC está aprobado, si está bloqueado temporalmente
     * y los intentos restantes de ingreso de PIN.
     */
    getMyPinStatus: async (req, res) => {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "No autenticado." });
        }

        const client = await pool.connect();
        try {
            const walletService = require('../services/walletService');
            const status = await walletService.getPinStatus(client, userId);
            return res.status(200).json(status);
        } catch (err) {
            console.error("Error al obtener estado de PIN de seguridad:", err);
            return res.status(500).json({ message: "Error interno al verificar estado de seguridad." });
        } finally {
            client.release();
        }
    },

    /**
     * Configura o actualiza la Frase Secreta de Autocustodia (4 a 6 palabras).
     * Deriva la clave AES-256-GCM mediante PBKDF2 y HMAC Server Pepper.
     * Si ya existía una frase previa, exige validación estricta de currentPassphrase para prevenir secuestro de cuenta.
     */
    setMyPin: async (req, res) => {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "No autenticado." });
        }

        const passphrase = (req.body.passphrase || req.body.pin || '').trim();
        const currentPassphrase = (req.body.currentPassphrase || req.body.currentPin || '').trim();

        // Validación estricta de 4 a 6 palabras
        const normalized = passphrase.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
        const words = normalized.split(' ').filter(Boolean);
        if (words.length < 4 || words.length > 6) {
            return res.status(400).json({
                message: "La frase de seguridad debe contener entre 4 y 6 palabras (ej: escucho musica cuando tengo mucha hambre)."
            });
        }
        for (const w of words) {
            if (w.length < 2) {
                return res.status(400).json({ message: "Cada palabra de la frase debe tener al menos 2 letras." });
            }
        }
        if (new Set(words).size < 3) {
            return res.status(400).json({ message: "Por seguridad, no repitas la misma palabra en tu frase." });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const walletService = require('../services/walletService');

            // 1. Verificar si el usuario ya cuenta con una frase configurada
            const status = await walletService.getPinStatus(client, userId);
            const isUpdate = status.hasPin;

            if (isUpdate) {
                if (!currentPassphrase) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "Debes ingresar tu frase de seguridad actual para poder cambiarla." });
                }
                const verification = await walletService.verifyTransactionPin(client, userId, currentPassphrase);
                if (!verification.valid) {
                    await client.query('COMMIT'); // Persistir incremento de intentos fallidos
                    return res.status(401).json({ message: verification.error });
                }
            }

            // 2. Ejecutar configuración de Frase y cifrado AES-256-GCM con salt aleatorio
            await walletService.setupTransactionPin(client, userId, normalized, currentPassphrase || null);

            // 3. Auditoría Bancaria
            await logAuditEvent(client, req, {
                eventType: isUpdate ? 'security.passphrase.updated' : 'security.passphrase.configured',
                actorUsername: req.user?.username || `user_${userId}`,
                targetUsername: req.user?.username || `user_${userId}`,
                metadata: {
                    isUpdate,
                    securityStandard: 'PBKDF2_AES_256_GCM_PASSPHRASE',
                    wordCount: words.length,
                    timestamp: new Date().toISOString()
                }
            });

            await client.query('COMMIT');

            return res.status(200).json({
                success: true,
                message: isUpdate 
                    ? "Tu Frase de Seguridad ha sido actualizada con éxito."
                    : "Frase de Seguridad configurada exitosamente. Tu billetera está en autocustodia protegida."
            });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Error al configurar Frase de Seguridad:", err);
            return res.status(err.status || 500).json({ message: err.status ? err.message : "No se pudo configurar la frase de seguridad." });
        } finally {
            client.release();
        }
    },

    /**
     * Valida de forma segura la Frase Secreta de Autocustodia antes de una operación crítica.
     * Implementa protección contra fuerza bruta con bloqueo exponencial tras 5 intentos.
     */
    verifyMyPin: async (req, res) => {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "No autenticado." });
        }

        const passphrase = (req.body.passphrase || req.body.pin || '').trim();
        const normalized = passphrase.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
        const words = normalized.split(' ').filter(Boolean);
        if (words.length < 4 || words.length > 6) {
            return res.status(400).json({ message: "La frase de seguridad debe contener entre 4 y 6 palabras." });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const walletService = require('../services/walletService');
            const verification = await walletService.verifyTransactionPin(client, userId, normalized);
            await client.query('COMMIT');

            if (!verification.valid) {
                return res.status(401).json({ valid: false, message: verification.error });
            }

            return res.status(200).json({ valid: true, message: "Frase de seguridad validada correctamente." });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Error al validar Frase de Seguridad:", err);
            return res.status(err.status || 500).json({ message: err.status ? err.message : "No se pudo verificar la frase de seguridad." });
        } finally {
            client.release();
        }
    }
};

module.exports = UserController;
