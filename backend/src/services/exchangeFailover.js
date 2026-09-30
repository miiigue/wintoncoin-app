'use strict';
const { createReader, fail } = require('./exchangeChainReader');
const { ExchangeIndexer } = require('./exchangeIndexer');

// Retry an entire verified tick with a configured provider. Never
// mix a page's logs and state across providers or weaken its finality policy.
function createExchangeWorker(pool, config, env = process.env) {
    let extras;
    // Verified public fallback for the Demo network only. An explicit [] opts
    // out, and configured alternatives replace this default. Never mainnet.
    const defaults = String(config.chainId) === '11155420' ? ['https://optimism-sepolia-rpc.publicnode.com'] : [];
    try { extras = env.EXCHANGE_INDEXER_FALLBACK_RPC_URLS === undefined
        ? defaults : JSON.parse(env.EXCHANGE_INDEXER_FALLBACK_RPC_URLS); } catch { fail('INVALID_RPC_CONFIG'); }
    if (!Array.isArray(extras) || extras.length > 3 || extras.some(x => typeof x !== 'string' || !/^https?:\/\//.test(x))) fail('INVALID_RPC_CONFIG');
    const urls = [...new Set([env.EXCHANGE_INDEXER_RPC_URL || env.OPTIMISM_RPC_URL, ...extras])];
    const chains = urls.map(url => createReader(url, config.exchange));
    return new FailoverExchangeIndexer(pool, config, chains);
}
class FailoverExchangeIndexer {
    constructor(pool, config, chains) { this.workers = chains.map(chain => new ExchangeIndexer(pool, chain, config)); this.preferred = 0; }
    async tick() {
        let error;
        for (let offset = 0; offset < this.workers.length; offset++) {
            const index = (this.preferred + offset) % this.workers.length;
            try {
                const result = await this.workers[index].tick();
                // A lagging primary can appear to predate a newly deployed
                // exchange before a cursor exists. Ask the next provider.
                if(result.status==='waiting_deployment' && offset<this.workers.length-1)continue;
                if (result.status !== 'busy') this.preferred = index;
                return result;
            } catch (e) {
                error = e;
                // Deployment or SQL configuration must be repaired explicitly.
                if (['STREAM_CONFIG_CHANGED','NOT_DEPLOYMENT_BLOCK','CONTRACT_NOT_DEPLOYED','EXISTING_REFUNDS_REQUIRE_RECONCILIATION'].includes(e.indexerCode) || /^\d{5}$/.test(e.code || '')) throw e;
            }
        }
        throw error;
    }
    destroy() { for (const worker of this.workers) worker.chain.provider?.destroy?.(); }
}
module.exports = { createExchangeWorker, FailoverExchangeIndexer };
