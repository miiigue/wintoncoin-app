'use strict';

// The source of truth remains FifoExchange.exchangeCollateralized(orderId).
// Existing V4 projections receive zero because that contract epoch has no such
// getter; a V5 epoch uses a distinct exchange address and starts a new stream.
async function up(client) {
    await client.query('SAVEPOINT migration125_exchange_collateral');
    try {
        const deps = await client.query("SELECT to_regclass('web3_exchange_sync') AS sync, to_regclass('web3_exchange_order_snapshots') AS orders");
        if (!deps.rows[0].sync || !deps.rows[0].orders) throw new Error('Migration 125 requires migration 112');
        await client.query(`ALTER TABLE web3_exchange_order_snapshots
            ADD COLUMN IF NOT EXISTS exchange_collateralized NUMERIC NOT NULL DEFAULT 0;
            ALTER TABLE web3_exchange_sync
            ADD COLUMN IF NOT EXISTS collateral_audit_order_id NUMERIC NOT NULL DEFAULT 0;
            DO $$ BEGIN
                ALTER TABLE web3_exchange_order_snapshots ADD CONSTRAINT exchange_collateralized_range
                    CHECK(exchange_collateralized>=0 AND scale(exchange_collateralized)<=6
                        AND exchange_collateralized<=remaining_amount);
            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
            DO $$ BEGIN
                ALTER TABLE web3_exchange_sync ADD CONSTRAINT exchange_collateral_audit_cursor_range
                    CHECK(scale(collateral_audit_order_id)=0
                        AND collateral_audit_order_id BETWEEN 0 AND 18446744073709551615);
            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
            CREATE INDEX IF NOT EXISTS idx_exchange_collateral_keeper
                ON web3_exchange_order_snapshots(chain_id,exchange_address,wallet_address,sequence_id)
                WHERE side='BUY_BLUE' AND status IN ('OPEN','PARTIALLY_FILLED','SUSPENDED');`);
        await client.query('RELEASE SAVEPOINT migration125_exchange_collateral');
    } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT migration125_exchange_collateral');
        await client.query('RELEASE SAVEPOINT migration125_exchange_collateral');
        throw error;
    }
}

async function down() { throw new Error('Migration 125 is forward-only: preserve verified exchange projections'); }
module.exports = { up, down };
