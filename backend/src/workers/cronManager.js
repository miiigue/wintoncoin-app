const debtCollectorJob = require('./debtCollectorJob');
const tokenReleaserJob = require('./tokenReleaserJob');
const { executeBoosterPayments } = require('../services/boosterService');
const { processPendingBroadcasts } = require('../services/emailService');

// Intervalos
const DEBT_COLLECTOR_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos
const TOKEN_RELEASER_INTERVAL_MS = 1 * 60 * 1000; // 1 minuto
const BOOSTER_PAYMENT_INTERVAL_MS = 60 * 1000;    // 1 minuto
const MAIL_WORKER_INTERVAL_MS = 30 * 1000;        // 30 segundos

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

    // 4. Mail Worker (Procesamiento Batch)
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
