'use strict';
async function up(client) {
    await client.query(`CREATE TABLE IF NOT EXISTS web3_wallet_snapshots (
        chain_id NUMERIC NOT NULL CHECK(chain_id>0 AND scale(chain_id)=0),
        core_address TEXT NOT NULL CHECK(core_address ~ '^0x[0-9a-f]{40}$'),
        wallet_address TEXT NOT NULL CHECK(wallet_address ~ '^0x[0-9a-f]{40}$'),
        block_number BIGINT NOT NULL CHECK(block_number>=0),
        block_hash TEXT NOT NULL CHECK(block_hash ~ '^0x[0-9a-f]{64}$'),
        snapshot JSONB NOT NULL, checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(chain_id,core_address,wallet_address))`);
    for(const key of ['gas_sponsor_maintenance_daily_budget_wei','gas_sponsor_maintenance_max_step_wei'])
        await client.query('INSERT INTO app_settings(setting_key,setting_value) VALUES($1,$2) ON CONFLICT DO NOTHING',[key,'0']);
}
module.exports = { up, down: async () => { throw Error('Preserve confirmed blockchain snapshots'); } };
