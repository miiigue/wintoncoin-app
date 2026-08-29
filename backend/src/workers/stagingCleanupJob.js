'use strict';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * WORKER DE MANTENIMIENTO: PURGA DE REGISTROS TEMPORALES DE STAGING (48 HORAS)
 * ══════════════════════════════════════════════════════════════════════════════
 * Este proceso en segundo plano (Cron Job) depura de forma segura y automatizada
 * las solicitudes de registro incompletas en 'pending_verifications' que hayan
 * superado las 48 horas de expiración.
 *
 * Justificación de Ingeniería y FinTech:
 * 1. Los códigos OTP expiran lógicamente en 15 minutos en el backend.
 * 2. Mantener los registros 48 horas en base de datos permite auditoría de soporte,
 *    telemetría de embudos de conversión (funnel drop-off) y diagnóstico de entrega
 *    de correos sin comprometer la seguridad.
 * 3. Ejecutar la purga cada 48 horas optimiza el consumo de CPU y conexiones a PostgreSQL.
 * ══════════════════════════════════════════════════════════════════════════════
 */

let isRunning = false;

async function stagingCleanupJob(pool) {
    // Protección contra ejecuciones concurrentes simultáneas (Concurrency Mutex)
    if (isRunning) {
        console.warn('[STAGING CLEANUP JOB] ⚠️ Una purga de registros ya está en ejecución. Omitiendo ciclo concurrente.');
        return { success: true, skipped: true, purgedCount: 0 };
    }

    isRunning = true;
    let client;
    try {
        // Obtenemos una conexión activa del pool
        client = await pool.connect();

        // Ejecutamos la purga de registros que lleven más de 48 horas expirados
        const purgeResult = await client.query(`
            DELETE FROM pending_verifications
            WHERE expires_at < NOW() - INTERVAL '48 hours'
            RETURNING id;
        `);

        const purgedCount = purgeResult.rowCount || 0;

        if (purgedCount > 0) {
            console.log(`[STAGING CLEANUP JOB] 🧹 Purga completada: ${purgedCount} registro(s) temporal(es) expirado(s) eliminado(s) de pending_verifications.`);
        }

        return {
            success: true,
            purgedCount
        };
    } catch (error) {
        console.error('[STAGING CLEANUP JOB] Error durante la purga de registros temporales:', error.message);
        return {
            success: false,
            error: error.message,
            purgedCount: 0
        };
    } finally {
        // Liberamos la conexión de vuelta al pool y restablecemos el candado
        if (client) {
            client.release();
        }
        isRunning = false;
    }
}

module.exports = stagingCleanupJob;
