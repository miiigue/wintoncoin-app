const pool = require('../config/db');
const { logAuditEvent } = require('../services/auditService');

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
                `SELECT username, liquid_blue_balance, escrow_blue_balance, red_balance, web3_wallet_address, kyc_verified
                 FROM users
                 WHERE id = $1`,
                [userId]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({ message: "Usuario no encontrado." });
            }

            const username = userResult.rows[0].username;

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
                    } catch (syncErr) {
                        console.error(`[API BALANCE] ⚠️ Error al sincronizar KYC en DB para usuario #${userId}:`, syncErr.message);
                    }
                }
            }

            // Fallback
            if (!blockchainQuerySucceeded && dbKycStatus) {
                isKycVerified = true;
            }

            const responseData = {
                blue_balance: userResult.rows[0].liquid_blue_balance,
                escrow_blue_balance: userResult.rows[0].escrow_blue_balance,
                red_balance: userResult.rows[0].red_balance,
                web3_wallet_address: userResult.rows[0].web3_wallet_address,
                kyc_verified: isKycVerified,
                credit_limit: creditLimit,
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
    // Obtener balance público o legacy de otro usuario (requiere auth)
    // ------------------------------------------------------------------------
    getUserBalanceLegacy: async (req, res) => {
        const { username } = req.params;
        if (!req.user?.username || req.user.username !== username) {
            return res.status(403).json({ message: 'No autorizado para consultar balance de otro usuario.' });
        }

        const client = await pool.connect();
        try {
            const userSql = `SELECT liquid_blue_balance, escrow_blue_balance, red_balance FROM users WHERE username = $1`;
            const debtSql = `SELECT due_at, amount FROM red_token_debts WHERE username = $1 AND is_settled = FALSE ORDER BY due_at ASC LIMIT 1`;
            const escrowSql = `SELECT unlock_at, amount FROM blue_token_escrows WHERE username = $1 AND is_released = FALSE ORDER BY unlock_at ASC LIMIT 1`;
            const penalizedDebtSql = `SELECT SUM(amount) as total_penalized_debt FROM red_token_debts WHERE username = $1 AND is_penalized = TRUE AND is_settled = FALSE`;

            const [userResult, debtResult, escrowResult, penalizedDebtResult] = await Promise.all([
                client.query(userSql, [username]),
                client.query(debtSql, [username]),
                client.query(escrowSql, [username]),
                client.query(penalizedDebtSql, [username])
            ]);

            if (userResult.rows.length === 0) {
                return res.status(404).json({ message: "Usuario no encontrado." });
            }

            const responseData = {
                blue_balance: userResult.rows[0].liquid_blue_balance,
                escrow_blue_balance: userResult.rows[0].escrow_blue_balance,
                red_balance: userResult.rows[0].red_balance,
                next_due_at: debtResult.rows[0]?.due_at || null,
                next_due_amount: debtResult.rows[0]?.amount || null,
                next_unlock_at: escrowResult.rows[0]?.unlock_at || null,
                next_unlock_amount: escrowResult.rows[0]?.amount || null,
                penalized_debt: penalizedDebtResult.rows[0]?.total_penalized_debt || '0'
            };

            res.status(200).json(responseData);
        } catch (err) {
            console.error("Error al obtener balance legacy:", err);
            return res.status(500).json({ message: "Error interno del servidor." });
        } finally {
            client.release();
        }
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
    }
};

module.exports = UserController;
