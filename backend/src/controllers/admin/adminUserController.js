/**
 * Submódulo de Administración — Gestión de Usuarios y Cumplimiento KYC / AML
 * ════════════════════════════════════════════════════════════════════════════════════════
 * Gestiona el listado y búsqueda de usuarios, actualización de estado de cuenta,
 * modificación de código de referido, consulta/sincronización de KYC on-chain
 * con la blockchain, reporte de deudores penalizados y log de referidos.
 *
 * Estándar de Ciberseguridad:
 *   - Zero Hardcoded Secrets & Zero-Trust Architecture
 *   - SOC 2 Type II / ISO 27001 Bank-Grade Audit Standards
 *   - Sanitización estricta de parámetros numéricos (ID defensivo)
 *   - Protección contra alteración de cuentas protegidas del sistema
 * ════════════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

// 1. Importación de dependencias de infraestructura y servicios
const pool = require('../../config/db'); // Conexión a la base de datos PostgreSQL
const { logAuditEvent } = require('../../services/auditService'); // Log inmutable de auditoría

/**
 * Obtiene la lista de usuarios con filtro de búsqueda por nombre y estado.
 */
async function getUsers(req, res) {
    const { search = '', status = '' } = req.query;
    try {
        let sql = `
            SELECT
                u.id, u.username, u.liquid_blue_balance, u.escrow_blue_balance,
                u.red_balance, u.account_status as status, u.average_rating,
                u.ratings_count, u.created_at, u.referral_code, u.web3_wallet_address,
                COALESCE(SUM(bbl.amount), 0) as booster_blue_balance
            FROM users u
            LEFT JOIN booster_blue_ledger bbl ON u.id = bbl.user_id
            WHERE u.username ILIKE $1`;

        const params = [`%${search}%`];
        let paramIndex = 2;

        if (status) {
            sql += ` AND u.account_status = $${paramIndex++}`;
            params.push(status);
        }

        sql += ` GROUP BY u.id, u.username, u.liquid_blue_balance, u.escrow_blue_balance,
                 u.red_balance, u.account_status, u.average_rating, u.ratings_count,
                 u.created_at, u.referral_code, u.web3_wallet_address
                 ORDER BY u.created_at DESC`;

        const result = await pool.query(sql, params);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("[AdminUserController] Error al obtener usuarios:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}

/**
 * Actualiza el estado de una cuenta de usuario ('active', 'suspended', 'banned').
 * Protege cuentas críticas del sistema (plataforma, admin).
 */
async function updateUserStatus(req, res) {
    const { userId } = req.params;
    const { status } = req.body;
    const validStatuses = ['active', 'suspended', 'banned'];

    const safeUserId = parseInt(userId, 10);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
        return res.status(400).json({ message: 'ID de usuario inválido.' });
    }

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Estado no válido.' });
    }

    try {
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

        const result = await pool.query(
            'UPDATE users SET account_status = $1 WHERE id = $2 RETURNING id, username, account_status as status',
            [status, safeUserId]
        );

        await logAuditEvent(pool, req, {
            eventType: 'admin.user.status_updated',
            actorUsername: req.user?.username || 'admin',
            targetUsername: targetUser.rows[0].username,
            metadata: { new_status: status }
        });

        res.status(200).json({ message: `Estado actualizado a "${status}".`, user: result.rows[0] });
    } catch (error) {
        console.error("[AdminUserController] Error al actualizar estado de usuario:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}

/**
 * Actualiza el código de referido de un usuario.
 * Requiere unicidad global.
 */
async function updateUserReferralCode(req, res) {
    const { userId } = req.params;
    const { newReferralCode } = req.body;

    if (!newReferralCode) {
        return res.status(400).json({ message: "Se requiere un nuevo código de referido." });
    }

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

        const checkResult = await client.query('SELECT id FROM users WHERE referral_code = $1', [newReferralCode]);
        if (checkResult.rowCount > 0 && checkResult.rows[0].id !== safeUserId) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: "Este código de referido ya está en uso por otro usuario." });
        }

        const oldUserResult = await client.query('SELECT username, referral_code FROM users WHERE id = $1', [safeUserId]);
        if (oldUserResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Usuario no encontrado." });
        }
        const oldCode = oldUserResult.rows[0].referral_code;
        const targetUsername = oldUserResult.rows[0].username;

        await client.query('UPDATE users SET referral_code = $1 WHERE id = $2', [newReferralCode, safeUserId]);

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
        console.error('[AdminUserController] Error al actualizar código de referido:', error);
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
        console.error("[AdminUserController] Error al obtener deudores:", error);
        res.status(500).json({ message: "Error al obtener deudores." });
    }
}

/**
 * Consultar estado KYC real desde la blockchain y auto-sincronizar con la BD.
 */
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

        const Web3BridgeService = require('../../services/web3BridgeService');
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

            if (kycResult.verified === true) {
                const humanitarianService = require('../../services/humanitarianService');
                humanitarianService.processAndSendEmailsForReleasedDonations(userId)
                    .catch(e => console.error(`[ADMIN KYC-STATUS] Error al procesar correos de liberación tras KYC para usuario #${userId}:`, e.message));
            }
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
        console.error("[AdminUserController] Error al obtener el log de referidos:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTACIONES DEL SUBMÓDULO DE GESTIÓN DE USUARIOS Y KYC
// ═══════════════════════════════════════════════════════════════════════════
module.exports = {
    getUsers,
    updateUserStatus,
    updateUserReferralCode,
    getUserKycStatus,
    getDebtors,
    getReferralsLog
};
