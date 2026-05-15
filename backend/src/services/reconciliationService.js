/**
 * src/services/reconciliationService.js
 * 
 * PROPÓSITO: Servicio de Reconciliación (Safety Net / Outbox Pattern).
 * 
 * CONTEXTO:
 * Si una transacción on-chain (Optimism) se confirma exitosamente pero
 * el proceso de PostgreSQL falla (ej. por un ROLLBACK debido a un error
 * de validación posterior o caída del servidor), los sistemas quedan
 * desincronizados. La blockchain ya movió los fondos, pero la DB no.
 * 
 * SOLUCIÓN:
 * Este servicio (Cron) escanea la tabla web3_pending_transactions buscando
 * registros con estado 'blockchain_confirmed' que lleven más de 2 minutos
 * sin haber sido marcados como 'fully_resolved'. Si los encuentra, genera
 * una alerta crítica y bloquea la operación para revisión manual,
 * cumpliendo con los estándares de mitigación de desastres (ISO 27001).
 */

'use strict';

const logAuditEvent = require('./auditService').logAuditEvent;

/**
 * Escanea transacciones atascadas y ejecuta el protocolo de desincronización.
 * @param {Object} pool Pool de conexiones PostgreSQL
 */
async function runReconciliationCycle(pool) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Buscar transacciones confirmadas en blockchain pero que NUNCA completaron
        // el COMMIT en la base de datos (llevan más de 2 minutos así).
        const stuckTxs = await client.query(`
            SELECT id, user_id, tx_type, tx_hash, payload, created_at
            FROM web3_pending_transactions
            WHERE status = 'blockchain_confirmed'
            AND created_at < NOW() - INTERVAL '2 minutes'
            FOR UPDATE SKIP LOCKED
        `);

        if (stuckTxs.rowCount === 0) {
            await client.query('COMMIT');
            return { resolved: 0, flagged: 0 };
        }

        console.warn(`[RECONCILIATION] ⚠️ Se detectaron ${stuckTxs.rowCount} transacciones desincronizadas. Iniciando protocolo de contención.`);

        let flaggedCount = 0;

        for (const tx of stuckTxs.rows) {
            // 1. Marcar la transacción como 'manual_intervention_required'
            await client.query(
                `UPDATE web3_pending_transactions 
                 SET status = 'manual_intervention_required', resolved_at = NOW() 
                 WHERE id = $1`,
                [tx.id]
            );

            // 2. Registrar evento CRÍTICO de auditoría
            await logAuditEvent(client, null, {
                eventType: 'system.reconciliation_alert',
                actorUsername: 'SYSTEM_RECONCILIATION',
                category: tx.tx_type,
                metadata: {
                    pending_tx_id: tx.id,
                    tx_hash: tx.tx_hash,
                    payload: tx.payload,
                    alert: "CRITICAL: Blockchain ejecutó el pago pero la DB hizo ROLLBACK. Requiere revisión manual urgente."
                }
            });

            // 3. Crear una notificación de sistema al usuario informando del retraso
            const payloadData = typeof tx.payload === 'string' ? JSON.parse(tx.payload) : tx.payload;
            const payer = payloadData.payerUsername || payloadData.author;
            const payee = payloadData.payeeUsername || payloadData.workerUsername;
            
            if (payer) {
                await client.query(
                    `INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
                    [payer, `⚠️ Tu último pago (Hash: ${tx.tx_hash ? tx.tx_hash.substring(0, 8) : 'N/A'}...) está siendo verificado por seguridad. Contacta a soporte si los fondos no se reflejan.`]
                );
            }
            if (payee && payee !== payer) {
                await client.query(
                    `INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
                    [payee, `⚠️ Tienes un pago entrante en verificación de seguridad. Estará disponible en tu saldo pronto.`]
                );
            }

            flaggedCount++;
            console.error(`[RECONCILIATION] 🚨 Transacción #${tx.id} (${tx.tx_hash}) marcada para intervención manual.`);
        }

        await client.query('COMMIT');
        return { resolved: 0, flagged: flaggedCount };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[RECONCILIATION] ❌ Error crítico durante el ciclo de reconciliación:', error.message);
        return { resolved: 0, flagged: 0 };
    } finally {
        client.release();
    }
}

module.exports = {
    runReconciliationCycle
};
