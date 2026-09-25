'use strict';

// Separate read-only worker. Never import the relayer or use signing keys.
require('../config');
const { configFromEnv, createReader } = require('../src/services/exchangeChainReader');
const { ExchangeIndexer } = require('../src/services/exchangeIndexer');

async function main() {
    const config = configFromEnv();
    if (!process.env.DATABASE_URL) throw new Error('INVALID_DATABASE_CONFIG');
    const chain = createReader(process.env.EXCHANGE_INDEXER_RPC_URL, config.exchange);
    const pool = require('../src/config/db');
    const worker = new ExchangeIndexer(pool, chain, config);
    let stopped = false, wake;
    const stop = () => { stopped = true; wake?.(); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
    try {
        do {
            try {
                const result = await worker.tick();
                console.log(JSON.stringify({ component: 'exchange-indexer', ...result }));
                if (process.argv.includes('--once')) break;
                // Bound throughput even while catching up; no overlapping ticks.
                const delay = ['syncing', 'rebuilding'].includes(result.status) ? 100 : config.pollMs;
                if (!stopped) await new Promise(resolve => {
                    const timer = setTimeout(() => { wake = undefined; resolve(); }, delay);
                    wake = () => { clearTimeout(timer); wake = undefined; resolve(); };
                });
            } catch (error) {
                // RPC URLs may contain credentials: never log upstream errors.
                console.error(JSON.stringify({ component: 'exchange-indexer', error: error.indexerCode || 'SYNC_FAILED' }));
                if (process.argv.includes('--once')) { process.exitCode = 1; break; }
                if (!stopped) await new Promise(resolve => {
                    const timer = setTimeout(() => { wake = undefined; resolve(); }, config.pollMs);
                    wake = () => { clearTimeout(timer); wake = undefined; resolve(); };
                });
            }
        } while (!stopped);
    } finally {
        process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
        chain.provider.destroy(); await pool.end();
    }
}
if (require.main === module) main().catch(() => { console.error('exchange-indexer: STARTUP_FAILED (check configuration/schema)'); process.exitCode = 1; });
module.exports = { main };
