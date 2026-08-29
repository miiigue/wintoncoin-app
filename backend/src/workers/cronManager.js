const debtCollectorJob = require('./debtCollectorJob');
const tokenReleaserJob = require('./tokenReleaserJob');
const donationRefundJob = require('./donationRefundJob');
const stagingCleanupJob = require('./stagingCleanupJob');
const { executeBoosterPayments } = require('../services/boosterService');
const { processPendingBroadcasts } = require('../services/emailService');

// Intervalos
const DEBT_COLLECTOR_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos
const TOKEN_RELEASER_INTERVAL_MS = 1 * 60 * 1000; // 1 minuto
const BOOSTER_PAYMENT_INTERVAL_MS = 60 * 1000;    // 1 minuto
const MAIL_WORKER_INTERVAL_MS = 30 * 1000;        // 30 segundos
const DONATION_REFUND_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos — Reembolso de donaciones vencidas (Winton Solidario)
const STAGING_CLEANUP_INTERVAL_MS = 48 * 60 * 60 * 1000; // 48 horas — Purga de registros temporales expirados

/**
 * Inicia todos los procesos en segundo plano de la plataforma
 * @param {Object} pool - Pool de conexiones de PostgreSQL
 */
function startBackgroundJobs(pool) {
    console.log('[CRON MANAGER] Inicializando procesos en segundo plano...');

    // 1. Debt Collector
    setInterval(() => {
        debtCollectorJob(pool);
    }, DEBT_COLLECTOR_INTERVAL_MS);

    // 2. Token Releaser
    setInterval(() => {
        tokenReleaserJob(pool);
    }, TOKEN_RELEASER_INTERVAL_MS);

    // 3. Booster Payments
    setInterval(async () => {
        await executeBoosterPayments();
    }, BOOSTER_PAYMENT_INTERVAL_MS);

    // 4. Donation Refund (Winton Solidario — Reembolso de donaciones vencidas)
    // Busca donaciones 'on_hold' que hayan superado los días configurados
    // en app_settings.donation_escrow_expiration_days y las reembolsa
    // automáticamente al donante si no completó su KYC Web3.
    setInterval(() => {
        donationRefundJob(pool);
    }, DONATION_REFUND_INTERVAL_MS);

    // 5. Staging Cleanup (Purga periódica cada 48 horas de registros temporales en pending_verifications)
    stagingCleanupJob(pool); // Ejecución inicial al arrancar el servidor
    setInterval(() => {
        stagingCleanupJob(pool);
    }, STAGING_CLEANUP_INTERVAL_MS);

    // 6. Mail Worker (Procesamiento Batch)
    async function runMailWorker() {
        try {
            await processPendingBroadcasts(pool);
        } catch (err) {
            console.error("Error en Mail Worker:", err);
        } finally {
            setTimeout(runMailWorker, MAIL_WORKER_INTERVAL_MS);
        }
    }
    runMailWorker(); // Iniciar inmediatamente
    
    console.log('[CRON MANAGER] ✅ Todos los procesos en segundo plano iniciados.');
}

module.exports = startBackgroundJobs;
