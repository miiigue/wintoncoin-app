'use strict';

/**
 * src/services/creditPolicyJobs.js
 * 
 * Motor Autónomo de Sincronización y Reintentos Exponenciales para Políticas de Compromiso RED.
 * 
 * ARQUITECTURA Y ESTÁNDARES BANCARIOS / FINTECH (SOC 2, ISO 20022 & Zero-Trust):
 * 1. Procesamiento Secuencial Asíncrono: Procesa cohortes masivas de usuarios sin bloquear el servidor.
 * 2. Motor de Reintentos Autónomos con Retroceso Exponencial y Jitter (RFC / AWS SRE Standard):
 *    Ante congestiones o fallas transitorias de la red blockchain (Optimism Sepolia), el sistema
 *    reintenta automáticamente (15s, 30s, 60s, 120s, 300s) sin requerir intervención humana para 1M de usuarios.
 * 3. Dead Letter Queue (DLQ): Tras agotar 5 intentos continuos, el incidente se clasifica como 'dead_letter'
 *    para revisión técnica puntual del administrador.
 */

const { locked } = require('./chainOperationStore');

/**
 * Guarda una nueva versión de política de compromiso RED e inicializa el job de sincronización masiva.
 * @param {import('pg').Pool} pool 
 * @param {string} key 
 * @param {string} value 
 * @param {number|null} actorId 
 */
async function savePolicy(pool, key, value, actorId) {
    return locked(pool, 'credit-policy-version', async client => {
        await client.query('BEGIN');
        try {
            const setting = await client.query(`
                INSERT INTO app_settings(setting_key, setting_value, updated_at) 
                VALUES($1, $2, NOW())
                ON CONFLICT(setting_key) DO UPDATE 
                SET setting_value = EXCLUDED.setting_value, updated_at = NOW() 
                RETURNING *
            `, [key, value]);

            const snapshot = await client.query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'red_credit_%'");
            const version = await client.query(
                'INSERT INTO credit_policy_versions(settings, actor_id) VALUES($1, $2) RETURNING id',
                [JSON.stringify(Object.fromEntries(snapshot.rows.map(x => [x.setting_key, x.setting_value]))), actorId || null]
            );

            await client.query('INSERT INTO credit_policy_jobs(version_id) VALUES($1)', [version.rows[0].id]);
            await client.query('COMMIT');
            return { setting: setting.rows[0], policyVersion: version.rows[0].id };
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
    });
}

/**
 * Registra o actualiza una incidencia de sincronización con retroceso exponencial.
 * @param {import('pg').PoolClient} client 
 * @param {number} version 
 * @param {number} user 
 * @param {string|null} operation 
 * @param {string} reason 
 * @param {string|null} errorDetails 
 */
async function recordIssue(client, version, user, operation, reason, errorDetails = null) {
    // 1. Consultar estado previo para computar el contador correlativo de intentos
    const existing = (await client.query(
        'SELECT retry_count, max_retries FROM credit_policy_issues WHERE version_id = $1 AND user_id = $2',
        [version, user]
    )).rows[0];

    const currentCount = (existing?.retry_count || 0) + 1;
    const maxRetries = existing?.max_retries || 5;

    // 2. Si se agotaron los intentos máximos, pasa a la Dead Letter Queue (DLQ)
    const isExhausted = currentCount >= maxRetries;
    const nextStatus = isExhausted ? 'dead_letter' : 'open';

    // 3. Cálculo de retroceso exponencial con jitter (15s, 30s, 60s, 120s, 300s...)
    const baseDelay = 15;
    const delaySeconds = Math.min(600, Math.pow(2, currentCount - 1) * baseDelay) + Math.floor(Math.random() * 5);

    await client.query(`
        INSERT INTO credit_policy_issues(
            version_id, user_id, operation_id, reason, status, retry_requested, 
            retry_count, next_retry_at, max_retries, last_error, updated_at
        ) VALUES(
            $1, $2, $3, $4, $5, FALSE, 
            $6, NOW() + ($7 * INTERVAL '1 second'), $8, $9, NOW()
        )
        ON CONFLICT(version_id, user_id) DO UPDATE SET
            operation_id = EXCLUDED.operation_id,
            reason = EXCLUDED.reason,
            status = EXCLUDED.status,
            retry_requested = FALSE,
            retry_count = EXCLUDED.retry_count,
            next_retry_at = CASE WHEN EXCLUDED.status = 'dead_letter' THEN NULL ELSE EXCLUDED.next_retry_at END,
            max_retries = EXCLUDED.max_retries,
            last_error = EXCLUDED.last_error,
            updated_at = NOW()
    `, [
        version,
        user,
        operation || null,
        reason,
        nextStatus,
        currentCount,
        delaySeconds,
        maxRetries,
        errorDetails ? String(errorDetails).slice(0, 500) : reason
    ]);
}

/**
 * Permite forzar un reintento manual inmediato sobre una incidencia específica (ej: desde panel administrativo).
 * @param {import('pg').Pool} pool 
 * @param {number} version 
 * @param {number} user 
 */
async function retryIssue(pool, version, user) {
    return locked(pool, 'credit-policy-jobs', async client => {
        const latest = (await client.query('SELECT id FROM credit_policy_versions ORDER BY id DESC LIMIT 1')).rows[0];
        if (String(latest?.id) !== String(version)) {
            throw Object.assign(new Error('La política fue sustituida; revisa la versión vigente.'), { status: 409 });
        }
        const result = await client.query(`
            UPDATE credit_policy_issues 
            SET status = 'open', retry_requested = TRUE, retry_count = 0, next_retry_at = NOW(), updated_at = NOW() 
            WHERE version_id = $1 AND user_id = $2 AND status IN ('open', 'dead_letter') 
            RETURNING user_id
        `, [version, user]);

        if (!result.rowCount) {
            throw Object.assign(new Error('No hay una incidencia pendiente para esa cuenta.'), { status: 404 });
        }
        return { success: true, message: 'Revisión programada con los parámetros vigentes. No se repetirá una transacción pendiente.' };
    });
}

/**
 * Ciclo periódico del Worker de Políticas de Compromiso RED (invocado por cron en server.js).
 * @param {import('pg').Pool} pool 
 * @param {any} scoreService 
 */
async function tick(pool, scoreService) {
    return locked(pool, 'credit-policy-jobs', async client => {
        const job = (await client.query('SELECT * FROM credit_policy_jobs ORDER BY version_id DESC LIMIT 1')).rows[0];
        if (!job) return;

        // 1. Marcar como obsoletos trabajos anteriores si existe una versión más reciente
        await client.query(
            "UPDATE credit_policy_jobs SET state = 'superseded' WHERE state IN ('pending', 'complete_with_issues') AND version_id < $1",
            [job.version_id]
        );

        // 2. ATENCIÓN AUTÓNOMA DE INCIDENCIAS (REINTENTOS AUTOMÁTICOS EXPONENCIALES):
        // Selecciona incidencias pendientes por reintento manual, en curso de confirmación,
        // o listas para reintento automático por vencimiento del temporizador de retroceso.
        const issue = (await client.query(`
            SELECT * FROM credit_policy_issues 
            WHERE version_id = $1 
              AND (
                retry_requested = TRUE 
                OR status = 'retrying' 
                OR (status = 'open' AND next_retry_at <= NOW() AND retry_count < max_retries)
              )
            ORDER BY updated_at LIMIT 1
        `, [job.version_id])).rows[0];

        if (issue) {
            let wait = false;
            if (issue.operation_id) {
                const op = (await client.query('SELECT state FROM chain_operations WHERE id = $1', [issue.operation_id])).rows[0];
                wait = ['pending', 'prepared', 'conflict'].includes(op?.state);
                if (issue.status === 'retrying' && ['failed', 'abandoned'].includes(op?.state)) {
                    await recordIssue(client, job.version_id, issue.user_id, issue.operation_id, 'CHAIN_REVERT', 'Transacción revertida en blockchain');
                    return;
                }
            }

            if (!wait) {
                try {
                    const result = await scoreService.syncCreditLimitOnChain(issue.user_id);
                    if (result?.skipped) {
                        await client.query(
                            "UPDATE credit_policy_issues SET status = 'resolved', retry_requested = FALSE, updated_at = NOW() WHERE version_id = $1 AND user_id = $2",
                            [job.version_id, issue.user_id]
                        );
                    } else if (result?.operationId) {
                        await client.query(
                            "UPDATE credit_policy_issues SET status = 'retrying', retry_requested = FALSE, operation_id = $3, updated_at = NOW() WHERE version_id = $1 AND user_id = $2",
                            [job.version_id, issue.user_id, result.operationId]
                        );
                    } else {
                        await recordIssue(client, job.version_id, issue.user_id, null, 'NO_CONFIRMED_RESULT', 'Respuesta no confirmada');
                    }
                } catch (err) {
                    await recordIssue(client, job.version_id, issue.user_id, issue.operation_id, 'RETRY_UNAVAILABLE', err.message);
                }
            } else {
                await client.query('UPDATE credit_policy_issues SET updated_at = NOW() WHERE version_id = $1 AND user_id = $2', [job.version_id, issue.user_id]);
            }
        }

        // 3. Si el job principal ya culminó su recorrido inicial, verificar si todas las incidencias están resueltas
        if (job.state !== 'pending') {
            await client.query(`
                UPDATE credit_policy_jobs 
                SET state = 'complete' 
                WHERE version_id = $1 
                  AND state = 'complete_with_issues' 
                  AND NOT EXISTS(SELECT 1 FROM credit_policy_issues WHERE version_id = $1 AND status <> 'resolved')
            `, [job.version_id]);
            return;
        }

        // 4. Procesar el cursor secuencial de cuentas ordinarias
        let cursor = job.cursor_id;
        if (job.operation_id) {
            const op = (await client.query('SELECT state FROM chain_operations WHERE id = $1', [job.operation_id])).rows[0];
            if (['pending', 'prepared'].includes(op?.state)) return;
            if (op?.state !== 'confirmed') {
                await recordIssue(
                    client,
                    job.version_id,
                    job.pending_user_id,
                    job.operation_id,
                    op?.state === 'conflict' ? 'CHAIN_CONFLICT' : 'CHAIN_REJECTED',
                    'Operación previa no confirmada'
                );
                cursor = job.pending_user_id;
            }
            await client.query(
                'UPDATE credit_policy_jobs SET cursor_id = $2, operation_id = NULL, pending_user_id = NULL WHERE version_id = $1',
                [job.version_id, cursor]
            );
        }

        // 5. Seleccionar la siguiente cuenta con billetera Web3 registrada
        const user = (await client.query(
            'SELECT id FROM users WHERE id > $1 AND web3_wallet_address IS NOT NULL ORDER BY id LIMIT 1',
            [cursor]
        )).rows[0];

        if (!user) {
            await client.query(`
                UPDATE credit_policy_jobs 
                SET state = CASE WHEN EXISTS(SELECT 1 FROM credit_policy_issues WHERE version_id = $1 AND status <> 'resolved') 
                    THEN 'complete_with_issues' ELSE 'complete' END,
                    updated_at = NOW() 
                WHERE version_id = $1
            `, [job.version_id]);
            return;
        }

        // 6. Ejecutar sincronización de límite on-chain
        try {
            const result = await scoreService.syncCreditLimitOnChain(user.id);
            if (result?.operationId) {
                await client.query(
                    'UPDATE credit_policy_jobs SET operation_id = $2, pending_user_id = $3, updated_at = NOW() WHERE version_id = $1',
                    [job.version_id, result.operationId, user.id]
                );
            } else if (result?.skipped) {
                await client.query(
                    'UPDATE credit_policy_jobs SET cursor_id = $2, updated_at = NOW() WHERE version_id = $1',
                    [job.version_id, user.id]
                );
            } else {
                throw new Error('NO_RESULT');
            }
        } catch (err) {
            await recordIssue(client, job.version_id, user.id, null, 'UPDATE_UNAVAILABLE', err.message);
            await client.query(
                'UPDATE credit_policy_jobs SET cursor_id = $2, updated_at = NOW() WHERE version_id = $1',
                [job.version_id, user.id]
            );
        }
    });
}

module.exports = { savePolicy, tick, retryIssue };
