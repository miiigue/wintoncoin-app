/**
 * src/services/escrowCleanupService.js
 * 
 * PROPÓSITO: Servicio de limpieza periódica de escrows Web3 huérfanos.
 * 
 * CONTEXTO:
 * Cuando un usuario crea una publicación tipo 'request' en modo Web3,
 * se bloquean fondos en web3_escrow_holds con status = 'locked'.
 * Este bloqueo se libera cuando el pago se ejecuta exitosamente.
 * 
 * PROBLEMA QUE RESUELVE:
 * Si una publicación expira, es eliminada o se completa sin consumir
 * todos los slots, el escrow queda en status = 'locked' indefinidamente,
 * reduciendo el poder adquisitivo del usuario de forma permanente.
 * 
 * SOLUCIÓN:
 * Este servicio se ejecuta periódicamente (cron) y libera los escrows
 * que ya no tienen razón de existir porque su publicación asociada ya
 * no puede generar pagos nuevos.
 * 
 * ESTÁNDAR: Patrón de "Reconciliación Periódica" usado en la industria
 * bancaria (SWIFT, ACH) y Fintech (Stripe, Square) para mantener la
 * coherencia entre sistemas distribuidos.
 * 
 * AUDITORÍA: Cada liberación se registra con timestamp y motivo para
 * cumplir con las normas de trazabilidad (SOC 2 / ISO 27001).
 */

'use strict';

// Importar el servicio de auditoría oficial para mantener consistencia.
const logAuditEvent = require('./auditService').logAuditEvent;

/**
 * Libera los escrows (web3_escrow_holds) cuyas publicaciones ya no
 * pueden generar pagos nuevos.
 * 
 * Criterios de liberación:
 * 1. La publicación fue eliminada (deleted_at IS NOT NULL).
 * 2. La publicación expiró (expires_at < NOW()).
 * 3. La publicación fue completada (status = 'completed').
 * 4. La publicación no tiene cupos disponibles (available_slots = 0)
 *    y no permite repetición (allow_repeat_participation = FALSE).
 * 
 * @param {Object} pool Pool de conexiones PostgreSQL.
 * @returns {Promise<{released: number, errors: number}>} Cantidad de escrows liberados y errores.
 */
async function releaseOrphanedEscrows(pool) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ═══════════════════════════════════════════════════════════════
        // CONSULTA: Buscar escrows 'locked' cuya publicación ya no puede
        // generar pagos. Se usa JOIN para verificar el estado real de la
        // publicación en una sola consulta (optimización de rendimiento).
        // ═══════════════════════════════════════════════════════════════
        const orphanedResult = await client.query(`
            UPDATE web3_escrow_holds AS e
            SET 
                status = 'released',
                released_at = NOW()
            FROM publications AS p
            WHERE 
                e.publication_id = p.id
                AND e.status = 'locked'
                AND (
                    -- Caso 1: Publicación eliminada (soft delete).
                    p.deleted_at IS NOT NULL
                    -- Caso 2: Publicación expirada (fecha de expiración pasada).
                    OR (p.expires_at IS NOT NULL AND p.expires_at < NOW())
                    -- Caso 3: Publicación marcada como completada por el sistema.
                    OR p.status = 'completed'
                    -- Caso 4: Sin cupos y sin repetición permitida.
                    OR (p.available_slots = 0 AND COALESCE(p.allow_repeat_participation, FALSE) = FALSE)
                )
            RETURNING e.id, e.publication_id, e.author_id, e.amount_locked
        `);

        const releasedCount = orphanedResult.rowCount;

        // ═══════════════════════════════════════════════════════════════
        // AUDITORÍA: Registrar cada liberación usando el servicio oficial.
        // Se usa logAuditEvent para mantener consistencia con el resto
        // del sistema y cumplir con las normas de trazabilidad (SOC 2).
        // ═══════════════════════════════════════════════════════════════
        if (releasedCount > 0) {
            for (const row of orphanedResult.rows) {
                // Usar el servicio de auditoría oficial del proyecto.
                await logAuditEvent(client, null, {
                    eventType: 'escrow.auto_released',
                    actorUsername: 'SYSTEM_CRON',
                    publicationId: row.publication_id,
                    metadata: {
                        escrow_id: row.id,
                        author_id: row.author_id,
                        amount_released: parseFloat(row.amount_locked),
                        reason: 'publication_expired_or_closed'
                    }
                });
            }

            console.log(`[ESCROW CLEANUP] ✅ Liberados ${releasedCount} escrows huérfanos: ${orphanedResult.rows.map(r => `#${r.id} (pub:${r.publication_id}, ${r.amount_locked} BLUE)`).join(', ')}`);
        }

        await client.query('COMMIT');

        return { released: releasedCount, errors: 0 };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[ESCROW CLEANUP] ❌ Error en liberación de escrows:', error.message);
        return { released: 0, errors: 1 };
    } finally {
        client.release();
    }
}

module.exports = {
    releaseOrphanedEscrows
};
