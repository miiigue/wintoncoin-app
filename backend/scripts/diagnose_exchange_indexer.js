'use strict';
// Run in the same environment as the worker; read-only SQL and RPC only.
require('../config');
const { configFromEnv, createReader } = require('../src/services/exchangeChainReader');
async function main() {
    let pool, chain, client;
    try {
        const config = configFromEnv();
        chain = createReader(process.env.EXCHANGE_INDEXER_RPC_URL || process.env.OPTIMISM_RPC_URL, config.exchange);
        pool = require('../src/config/db');
        client = await pool.connect();
        await client.query('BEGIN READ ONLY');
        await client.query("SET LOCAL statement_timeout='8s'");
        const row = (await client.query(`SELECT chain_id,exchange_address,start_block,finality,cursor_block,cursor_hash,target_block,status,error_code,last_checked_at,last_success_at
          FROM web3_exchange_sync WHERE chain_id=$1 AND exchange_address=$2`, [config.chainId, config.exchange])).rows[0] || null;
        await client.query('ROLLBACK'); client.release(); client = null;
        const chainId = await chain.chainId(), latest = await chain.block('latest'), finalized = await chain.block('finalized');
        const target = config.finality === 'finalized' ? finalized : await chain.block(Math.max(0, latest.number - Number(config.finality.split(':')[1])));
        const stored = row?.cursor_hash ? await chain.block(Number(row.cursor_block)) : null;
        console.log(JSON.stringify({ configuration: config, chainId, latest, finalized, target, stored: row,
            correctChain: chainId === config.chainId,
            cursorHashMatches: stored ? stored.hash === row.cursor_hash : null,
            behindBy: row ? Math.max(0, Number(row.cursor_block) - target.number) : null }, null, 2));
    } catch (error) {
        console.error(JSON.stringify({ diagnostic: 'unavailable', code: error.indexerCode || 'CHECK_CONFIGURATION_DATABASE_AND_RPC' }));
        process.exitCode = 1;
    } finally {
        if (client) { try { await client.query('ROLLBACK'); } finally { client.release(); } }
        chain?.provider.destroy(); await pool?.end();
    }
}
if (require.main === module) void main();
module.exports = { main };
