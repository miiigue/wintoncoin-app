'use strict';

// The runner owns the transaction. Historical records are never assigned to a
// guessed network; the canonical projection starts at the deployment block.
async function up(client) {
    await client.query('SAVEPOINT migration112');
    try {
        const deps = await client.query("SELECT to_regclass('web3_pending_refunds') AS balances, to_regclass('web3_refund_events') AS events");
        if (!deps.rows[0].balances || !deps.rows[0].events) throw new Error('Migration 112 requires migration 111');
        await client.query(`
            CREATE TABLE IF NOT EXISTS web3_exchange_sync (
                chain_id NUMERIC NOT NULL CHECK(scale(chain_id)=0 AND chain_id>0),
                exchange_address TEXT NOT NULL CHECK(exchange_address ~ '^0x[0-9a-f]{40}$'),
                start_block BIGINT NOT NULL CHECK(start_block>=1),
                finality TEXT NOT NULL,
                runtime_hash TEXT NOT NULL CHECK(runtime_hash ~ '^0x[0-9a-f]{64}$'),
                cursor_block BIGINT NOT NULL,
                cursor_hash TEXT CHECK(cursor_hash ~ '^0x[0-9a-f]{64}$'),
                target_block BIGINT,
                status TEXT NOT NULL CHECK(status IN ('syncing','ready','rebuilding','error')),
                last_checked_at TIMESTAMPTZ,
                last_success_at TIMESTAMPTZ,
                error_code TEXT,
                PRIMARY KEY(chain_id,exchange_address),
                CHECK(cursor_block>=start_block-1),
                CHECK((cursor_block=start_block-1 AND cursor_hash IS NULL) OR
                      (cursor_block>=start_block AND cursor_hash IS NOT NULL))
            );
            CREATE TABLE IF NOT EXISTS web3_exchange_order_snapshots (
                chain_id NUMERIC NOT NULL,
                exchange_address TEXT NOT NULL,
                order_id NUMERIC NOT NULL CHECK(scale(order_id)=0 AND order_id BETWEEN 1 AND 18446744073709551615),
                sequence_id NUMERIC NOT NULL CHECK(scale(sequence_id)=0 AND sequence_id BETWEEN 1 AND 18446744073709551615),
                wallet_address TEXT NOT NULL CHECK(wallet_address ~ '^0x[0-9a-f]{40}$'),
                side TEXT NOT NULL CHECK(side IN ('SELL_BLUE','BUY_BLUE')),
                is_amortization BOOLEAN NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('OPEN','PARTIALLY_FILLED','FILLED','CANCELLED','SUSPENDED')),
                original_amount NUMERIC NOT NULL,
                remaining_amount NUMERIC NOT NULL,
                refunded_amount NUMERIC NOT NULL,
                created_at_chain BIGINT NOT NULL CHECK(created_at_chain>=0),
                suspend_reason SMALLINT NOT NULL CHECK(suspend_reason IN (0,1,2)),
                block_number BIGINT NOT NULL CHECK(block_number>=1),
                block_hash TEXT NOT NULL CHECK(block_hash ~ '^0x[0-9a-f]{64}$'),
                PRIMARY KEY(chain_id,exchange_address,order_id),
                FOREIGN KEY(chain_id,exchange_address) REFERENCES web3_exchange_sync(chain_id,exchange_address),
                CHECK(original_amount>0 AND original_amount<=340282366920938463463374607431768.211455 AND scale(original_amount)<=6),
                CHECK(remaining_amount>=0 AND scale(remaining_amount)<=6),
                CHECK(refunded_amount>=0 AND scale(refunded_amount)<=6),
                CHECK(remaining_amount+refunded_amount<=original_amount)
            );
            CREATE INDEX IF NOT EXISTS idx_exchange_snapshot_wallet ON web3_exchange_order_snapshots(chain_id,exchange_address,wallet_address,order_id);
            CREATE TABLE IF NOT EXISTS web3_exchange_logs (
                chain_id NUMERIC NOT NULL,
                exchange_address TEXT NOT NULL,
                block_number BIGINT NOT NULL CHECK(block_number>=1),
                block_hash TEXT NOT NULL CHECK(block_hash ~ '^0x[0-9a-f]{64}$'),
                tx_hash TEXT NOT NULL CHECK(tx_hash ~ '^0x[0-9a-f]{64}$'),
                log_index INTEGER NOT NULL CHECK(log_index>=0),
                event_name TEXT NOT NULL,
                order_id NUMERIC,
                suspend_reason SMALLINT,
                raw_log JSONB NOT NULL,
                is_removed BOOLEAN NOT NULL DEFAULT FALSE,
                PRIMARY KEY(chain_id,exchange_address,block_hash,tx_hash,log_index),
                FOREIGN KEY(chain_id,exchange_address) REFERENCES web3_exchange_sync(chain_id,exchange_address)
            );
            CREATE INDEX IF NOT EXISTS idx_exchange_log_reason ON web3_exchange_logs(chain_id,exchange_address,order_id,block_number DESC,log_index DESC) WHERE NOT is_removed AND event_name='OrderSuspended';
        `);
        await client.query('RELEASE SAVEPOINT migration112');
    } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT migration112');
        await client.query('RELEASE SAVEPOINT migration112');
        throw error;
    }
}
async function down() { throw new Error('Migration 112 is forward-only: preserve blockchain history'); }
module.exports = { up, down };
