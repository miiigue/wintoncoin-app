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
                COALESCE(SUM(bbl.amount), 0) as booster_blue_balance,
                (SELECT string_agg(dvr.dossier_number, ', ') FROM disaster_victims_registry dvr WHERE dvr.user_id = u.id) as sos_dossier,
                (SELECT string_agg(vr.dossier_number, ', ') FROM volunteers_registry vr WHERE vr.user_id = u.id) as vol_dossier
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
    const { status, reason } = req.body;
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

        const targetUser = await pool.query('SELECT username, account_status FROM users WHERE id = $1', [safeUserId]);
        if (!targetUser.rows.length) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const targetUsername = targetUser.rows[0].username.toLowerCase();
        if (targetUsername === platformUsername || targetUsername === adminUsername) {
            return res.status(403).json({ message: 'No se puede cambiar el estado de una cuenta protegida del sistema.' });
        }

        const previousStatus = targetUser.rows[0].account_status;

        const result = await pool.query(
            'UPDATE users SET account_status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, account_status as status',
            [status, safeUserId]
        );

        // Registro inmutable de auditoría bancaria (SOC 2 Type II / ISO 27001)
        await logAuditEvent(pool, req, {
            eventType: 'admin.user.status_updated',
            actorUsername: req.user?.username || 'admin',
            targetUsername: targetUser.rows[0].username,
            category: 'compliance',
            metadata: {
                targetUserId: safeUserId,
                previous_status: previousStatus,
                new_status: status,
                justification_reason: reason ? String(reason).trim().slice(0, 500) : 'Sin justificación especificada'
            }
        });

        res.status(200).json({ message: `Estado actualizado a "${status}".`, user: result.rows[0] });
    } catch (error) {
        console.error("[AdminUserController] Error al actualizar estado de usuario:", error);
        res.status(500).json({ message: "Error interno del servidor al actualizar estado." });
    }
}

/**
 * Actualiza el código de referido de un usuario.
 * Requiere unicidad global.
 */
async function updateUserReferralCode(req, res) {
    const { userId } = req.params;
    const { newReferralCode } = req.body;

    if (!newReferralCode || typeof newReferralCode !== 'string') {
        return res.status(400).json({ message: "Se requiere un nuevo código de referido válido." });
    }

    const trimmedCode = newReferralCode.trim();
    if (trimmedCode.length < 3 || trimmedCode.length > 50) {
        return res.status(400).json({ message: "El código de referido debe tener entre 3 y 50 caracteres." });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedCode)) {
        return res.status(400).json({ message: "El código solo puede contener letras, números y guiones. Sin espacios." });
    }

    const safeUserId = parseInt(userId, 10);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
        return res.status(400).json({ message: 'ID de usuario inválido.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const checkResult = await client.query('SELECT id FROM users WHERE referral_code = $1', [trimmedCode]);
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

        await client.query('UPDATE users SET referral_code = $1, updated_at = NOW() WHERE id = $2', [trimmedCode, safeUserId]);

        await logAuditEvent(client, req, {
            eventType: 'admin.user.update_referral_code',
            actorUsername: req.user?.username || 'admin',
            targetUsername: targetUsername,
            category: 'compliance',
            metadata: {
                targetUserId: safeUserId,
                old_code: oldCode,
                new_code: trimmedCode
            }
        });

        await client.query('COMMIT');
        res.json({ success: true, message: `Código de referido actualizado a: ${trimmedCode}` });

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
                const creditScoringService = require('../../services/creditScoringService');
                const notificationService = require('../../services/notificationService');

                // 1. Sincronizar límite de compromiso del usuario recien verificado
                creditScoringService.syncCreditLimitOnChain(userId)
                    .catch(e => console.error(`[ADMIN KYC-STATUS] Error al sincronizar compromiso on-chain para usuario #${userId}:`, e.message));

                // 2. Verificar si el usuario fue invitado por un referente para recalcular y notificar
                pool.query("SELECT referrer_id, username FROM users WHERE id = $1", [userId])
                    .then(res => {
                        const referrerId = res.rows[0]?.referrer_id;
                        const verifiedUsername = res.rows[0]?.username;
                        if (referrerId) {
                            // Recalcular y sincronizar límite de compromiso del referente
                            creditScoringService.calculateUserScore(referrerId).then(newScore => {
                                creditScoringService.syncCreditLimitOnChain(referrerId);
                                
                                // Disparar notificación push al referente usando la API real del servicio
                                // Firma: sendNotificationToUser(userId, { title, body, url? }, type)
                                notificationService.sendNotificationToUser(
                                    referrerId,
                                    {
                                        title: '🎉 ¡Bonificación de Compromiso RED Aumentada!',
                                        body: `Tu referido @${verifiedUsername} ha verificado su KYC. Tu límite de compromiso RED ha aumentado a ${newScore} RED.`
                                    },
                                    'TRANSACTIONAL'
                                ).catch(nErr => console.error('[ADMIN KYC-STATUS] Error enviando notificación a referente:', nErr.message));
                            });
                        }
                    })
                    .catch(rErr => console.error('[ADMIN KYC-STATUS] Error al consultar referente:', rErr.message));

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
    getReferralsLog,
    getUserDossier360
};

/**
 * Obtiene la Ficha de Auditoría y Expediente de Control de Usuario 360° (User 360° Audit Dossier).
 * Cumple con estándares SOC 2 Type II, ISO 27001, Bank Secrecy Act / AML y Zero-Trust.
 * 
 * Registra automáticamente el evento de auditoría 'admin.user.view_dossier' ("Auditar al Auditor").
 * 
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getUserDossier360(req, res) {
    const rawUserId = String(req.params.userId || '').trim();
    if (!rawUserId || rawUserId.length > 100) {
        return res.status(400).json({ message: 'Identificador de usuario inválido.' });
    }

    let safeUserId = parseInt(rawUserId, 10);
    let targetUsername = '';

    try {
        // 1. Resolver el usuario objetivo (sea por ID numérico o por Username para máxima resiliencia)
        let baseUserSql = `
            SELECT 
                u.id, u.username, u.email, u.phone_number, u.account_status,
                u.liquid_blue_balance, u.escrow_blue_balance, u.red_balance,
                u.average_rating, u.ratings_count, u.created_at, u.updated_at,
                u.referral_code, u.referrer_id, u.web3_wallet_address, u.kyc_verified,
                u.is_minor, u.tutor_id,
                COALESCE(u.trust_score, 50) as trust_score,
                COALESCE(u.trust_score_level, 'Standard') as trust_score_level,
                sponsor.username as referrer_username,
                tutor.username as tutor_username,
                (SELECT string_agg(dvr.dossier_number, ', ') FROM disaster_victims_registry dvr WHERE dvr.user_id = u.id) as sos_dossier,
                (SELECT string_agg(vr.dossier_number, ', ') FROM volunteers_registry vr WHERE vr.user_id = u.id) as vol_dossier
            FROM users u
            LEFT JOIN users sponsor ON u.referrer_id = sponsor.id
            LEFT JOIN users tutor ON u.tutor_id = tutor.id
        `;

        let userResult;
        if (Number.isFinite(safeUserId) && safeUserId > 0) {
            userResult = await pool.query(`${baseUserSql} WHERE u.id = $1`, [safeUserId]);
        } else {
            userResult = await pool.query(`${baseUserSql} WHERE u.username = $1`, [rawUserId]);
        }

        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado en la base de datos.' });
        }

        const user = userResult.rows[0];
        safeUserId = user.id;
        targetUsername = user.username;

        // 2. Consultas concurrentes optimizadas para construir el expediente 360° (CQRS / Proyecciones)
        const [
            boosterBalanceRes,
            transactionsRes,
            boosterLedgerRes,
            publicationsCreatedRes,
            tasksAcceptedRes,
            referralsRes,
            debtsRes,
            sosVictimRes,
            sosDisbursementsRes,
            volunteerRes,
            causesRes,
            donationsSentRes,
            auditEventsRes,
            legalAcceptancesRes
        ] = await Promise.all([
            // Saldo total de Impulsor (BLUE IOU)
            pool.query('SELECT COALESCE(SUM(amount), 0) as booster_blue_balance FROM booster_blue_ledger WHERE user_id = $1', [safeUserId]).catch(() => ({ rows: [{ booster_blue_balance: 0 }] })),

            // Historial de Transacciones Web3 de Tokens reales
            pool.query(`
                SELECT id, type, amount, tx_hash, created_at, 
                       COALESCE(description, type) as description
                FROM transactions 
                WHERE user_id = $1 
                ORDER BY created_at DESC 
                LIMIT 100
            `, [safeUserId]).catch(() => ({ rows: [] })),

            // Historial del Ledger de Impulsores (BLUE IOU)
            pool.query(`
                SELECT id, type, amount, created_at, 
                       COALESCE(description, type) as description
                FROM booster_transactions 
                WHERE user_id = $1 
                ORDER BY created_at DESC 
                LIMIT 100
            `, [safeUserId]).catch(async () => {
                const fallback = await pool.query('SELECT id, type, amount, created_at FROM booster_blue_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [safeUserId]).catch(() => ({ rows: [] }));
                return fallback;
            }),

            // Publicaciones Creadas por el usuario
            pool.query(`
                SELECT id, title, description, blue_cost, is_sell_post, status, 
                       is_deleted, is_expired, is_completed_publication, is_paused, 
                       available_slots, participants_count, created_at
                FROM publications 
                WHERE author_id = $1 OR author_username = $2 
                ORDER BY created_at DESC 
                LIMIT 50
            `, [safeUserId, targetUsername]).catch(() => ({ rows: [] })),

            // Tareas y Trabajos Aceptados por el usuario
            pool.query(`
                SELECT a.id, a.publication_id, a.status, a.accepted_at, a.completed_at,
                       a.form_responses, a.evidence_urls,
                       p.title as publication_title, p.blue_cost, p.is_sell_post, p.author_username
                FROM acceptances a
                JOIN publications p ON a.publication_id = p.id
                WHERE a.user_id = $1 OR a.acceptor_username = $2
                ORDER BY a.accepted_at DESC
                LIMIT 50
            `, [safeUserId, targetUsername]).catch(() => ({ rows: [] })),

            // Red de Referidos Directos registrados por este usuario
            pool.query(`
                SELECT rl.id, rl.created_at as referral_date,
                       referred.id as referred_id, referred.username as referred_username,
                       referred.account_status, referred.kyc_verified, referred.created_at as registration_date
                FROM referral_log rl
                JOIN users referred ON rl.referred_user_id = referred.id
                WHERE rl.referrer_user_id = $1
                ORDER BY rl.created_at DESC
                LIMIT 100
            `, [safeUserId]).catch(() => ({ rows: [] })),

            // Compromisos RED y deudas activas / penalizadas
            pool.query(`
                SELECT id, amount, is_settled, is_penalized, due_date, created_at
                FROM red_token_debts
                WHERE user_id = $1 OR username = $2
                ORDER BY created_at DESC
                LIMIT 50
            `, [safeUserId, targetUsername]).catch(() => ({ rows: [] })),

            // Expediente SOS de Damnificado (si existe)
            pool.query(`
                SELECT id, dossier_number, full_name, id_document, phone_number,
                       state, municipality, sector, address_details, affectation_level,
                       status, urgency_score, description, evidence_urls, created_at
                FROM disaster_victims_registry
                WHERE user_id = $1
                LIMIT 1
            `, [safeUserId]).catch(() => ({ rows: [] })),

            // Desembolsos de ayuda SOS recibidos
            pool.query(`
                SELECT dvd.id, dvd.amount_blue, dvd.disbursement_period, dvd.notes, dvd.created_at
                FROM disaster_victim_disbursements dvd
                JOIN disaster_victims_registry dvr ON dvd.victim_id = dvr.id
                WHERE dvr.user_id = $1
                ORDER BY dvd.created_at DESC
            `, [safeUserId]).catch(() => ({ rows: [] })),

            // Registro de Voluntario SOS (si existe)
            pool.query(`
                SELECT id, dossier_number, full_name, id_document, phone_number,
                       state, municipality, status, volunteer_skills, created_at
                FROM volunteers_registry
                WHERE user_id = $1
                LIMIT 1
            `, [safeUserId]).catch(() => ({ rows: [] })),

            // Causas Humanitarias creadas
            pool.query(`
                SELECT id, title, goal_amount, current_amount, status, created_at
                FROM humanitarian_causes
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 20
            `, [safeUserId]).catch(() => ({ rows: [] })),

            // Donaciones enviadas a causas
            pool.query(`
                SELECT hd.id, hd.amount_blue, hd.status, hd.created_at,
                       hc.title as cause_title, hc.id as cause_id
                FROM humanitarian_donations hd
                JOIN humanitarian_causes hc ON hd.cause_id = hc.id
                WHERE hd.donor_user_id = $1
                ORDER BY hd.created_at DESC
                LIMIT 20
            `, [safeUserId]).catch(() => ({ rows: [] })),

            // Eventos de Auditoría y Ciberseguridad (SOC 2 Inmutable)
            pool.query(`
                SELECT id, event_type, actor_username, target_username, category, ip_address, metadata, created_at
                FROM audit_log
                WHERE target_username = $1 
                   OR actor_username = $1 
                   OR (metadata->>'targetUserId')::text = $2::text
                ORDER BY created_at DESC
                LIMIT 50
            `, [targetUsername, safeUserId]).catch(() => ({ rows: [] })),

            // Aceptación de Términos y Contratos Legales
            pool.query(`
                SELECT id, document_type, document_version, ip_address, accepted_at
                FROM legal_document_acceptances
                WHERE user_id = $1
                ORDER BY accepted_at DESC
                LIMIT 20
            `, [safeUserId]).catch(() => ({ rows: [] }))
        ]);

        // 3. Consolidar el objeto de respuesta estructurado con sanitización de metadatos (Zero-Secrets)
        const boosterBalance = parseFloat(boosterBalanceRes.rows[0]?.booster_blue_balance || 0);

        const sensitiveKeywords = ['password', 'hash', 'token', 'jwt', 'secret', 'otp', 'private_key', 'authorization'];
        const sanitizedAuditEvents = (auditEventsRes.rows || []).map(ev => {
            let cleanMeta = null;
            if (ev.metadata && typeof ev.metadata === 'object') {
                cleanMeta = { ...ev.metadata };
                for (const key of Object.keys(cleanMeta)) {
                    if (sensitiveKeywords.some(kw => key.toLowerCase().includes(kw))) {
                        delete cleanMeta[key];
                    }
                }
            }
            return {
                ...ev,
                metadata: cleanMeta
            };
        });

        const dossier = {
            profile: {
                id: user.id,
                username: user.username,
                email: user.email,
                phone_number: user.phone_number,
                account_status: user.account_status,
                created_at: user.created_at,
                updated_at: user.updated_at,
                referral_code: user.referral_code,
                referrer_id: user.referrer_id,
                referrer_username: user.referrer_username || null,
                web3_wallet_address: user.web3_wallet_address,
                kyc_verified: user.kyc_verified === true,
                is_minor: user.is_minor === true,
                tutor_id: user.tutor_id,
                tutor_username: user.tutor_username || null,
                sos_dossier: user.sos_dossier || null,
                vol_dossier: user.vol_dossier || null,
                average_rating: parseFloat(user.average_rating || 0),
                ratings_count: parseInt(user.ratings_count || 0, 10),
                trust_score: user.trust_score,
                trust_score_level: user.trust_score_level
            },
            balances: {
                liquid_blue_balance: parseFloat(user.liquid_blue_balance || 0),
                escrow_blue_balance: parseFloat(user.escrow_blue_balance || 0),
                booster_blue_balance: boosterBalance,
                red_balance: parseFloat(user.red_balance || 0)
            },
            web3_transactions: transactionsRes.rows || [],
            booster_transactions: boosterLedgerRes.rows || [],
            publications_created: publicationsCreatedRes.rows || [],
            tasks_accepted: tasksAcceptedRes.rows || [],
            referrals: referralsRes.rows || [],
            debts: debtsRes.rows || [],
            sos_case: sosVictimRes.rows[0] ? {
                ...sosVictimRes.rows[0],
                disbursements: sosDisbursementsRes.rows || []
            } : null,
            volunteer_case: volunteerRes.rows[0] || null,
            humanitarian: {
                causes_created: causesRes.rows || [],
                donations_sent: donationsSentRes.rows || []
            },
            audit_events: sanitizedAuditEvents,
            legal_acceptances: legalAcceptancesRes.rows || []
        };

        // 4. Principio "Auditar al Auditor" (SOC 2): Registrar la consulta del expediente
        await logAuditEvent(pool, req, {
            eventType: 'admin.user.view_dossier',
            actorUsername: req.user?.username || 'admin',
            targetUsername: targetUsername,
            category: 'compliance',
            metadata: {
                targetUserId: safeUserId,
                action: 'user_360_dossier_inspected'
            }
        });

        res.status(200).json({ success: true, dossier });

    } catch (error) {
        console.error("[AdminUserController] Error al obtener el expediente 360°:", error);
        res.status(500).json({ message: "Error interno del servidor al procesar el expediente del usuario." });
    }
}
