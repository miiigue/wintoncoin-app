'use strict';

// Schema only. The caller (migrationRunner/run_migrations) owns BEGIN/COMMIT.
// No connection or environment is loaded merely by importing this migration.
const UINT256_MAX = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
const TOKEN128_MAX = '340282366920938463463374607431768.211455';

async function up(client) {
    if (!client || typeof client.query !== 'function') throw new Error('Migration 110 requires a connected transactional client');
    // Also rejects callers outside a transaction, before making schema changes.
    await client.query('SAVEPOINT migration110');
    try {
        const required = await client.query(`SELECT to_regclass('web3_fifo_exchange_orders') AS orders,
            to_regclass('web3_contract_deployments') AS deployments,
            to_regclass('web3_governance_actions') AS governance`);
        if (!required.rows[0].orders || !required.rows[0].deployments || !required.rows[0].governance) {
            throw new Error('Migration 110 requires migration 109; missing Web3 tables');
        }
        // A previous revision lacked origin/identity. Never guess a network or
        // erase a historical refund to make its schema pass.
        await client.query(`DO $$ BEGIN
            IF to_regclass('web3_pending_refunds') IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('web3_pending_refunds')
                AND attname='chain_id' AND NOT attisdropped
            ) THEN
                IF EXISTS (SELECT 1 FROM web3_pending_refunds) THEN
                    RAISE EXCEPTION 'Legacy refunds require reconciliation against blockchain before migration 110/111';
                END IF;
                DROP TABLE web3_pending_refunds;
            END IF;
        END $$`);
        await client.query(`ALTER TABLE web3_fifo_exchange_orders
            DROP CONSTRAINT IF EXISTS web3_fifo_exchange_orders_status_check;
            ALTER TABLE web3_fifo_exchange_orders
            ADD CONSTRAINT web3_fifo_exchange_orders_status_check
                CHECK (status IN ('ACTIVE','OPEN','PARTIALLY_FILLED','FILLED','CANCELLED','SUSPENDED')),
            ADD COLUMN IF NOT EXISTS suspend_reason INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS resubmitted_sequence_id NUMERIC(20,0);
            ALTER TABLE web3_fifo_exchange_orders
                ALTER COLUMN onchain_order_id TYPE NUMERIC(20,0),
                ALTER COLUMN sequence_id TYPE NUMERIC(20,0),
                ALTER COLUMN resubmitted_sequence_id TYPE NUMERIC(20,0),
                DROP CONSTRAINT IF EXISTS web3_fifo_suspend_reason_check;
            ALTER TABLE web3_fifo_exchange_orders ADD CONSTRAINT web3_fifo_suspend_reason_check CHECK(suspend_reason IN (0,1,2));`);

        // Aggregate balance mirrors pendingRefundBlue/Usdt at a specified block.
        // A zero balance is retained as an observed fact, not deleted history.
        await client.query(`CREATE TABLE IF NOT EXISTS web3_pending_refunds (
            chain_id NUMERIC NOT NULL CHECK(scale(chain_id)=0 AND chain_id>0 AND chain_id<=${UINT256_MAX}),
            exchange_address TEXT NOT NULL CHECK(exchange_address ~ '^0x[0-9a-f]{40}$'),
            wallet_address TEXT NOT NULL CHECK(wallet_address ~ '^0x[0-9a-f]{40}$'),
            token_type TEXT NOT NULL CHECK(token_type IN ('BLUE','USDT')),
            amount NUMERIC NOT NULL CHECK(amount>=0 AND amount<=${TOKEN128_MAX} AND scale(amount)<=6),
            block_number NUMERIC NOT NULL CHECK(scale(block_number)=0 AND block_number>=0),
            block_hash TEXT NOT NULL CHECK(block_hash ~ '^0x[0-9a-f]{64}$'),
            synced_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(chain_id,exchange_address,wallet_address,token_type)
        );
        CREATE INDEX IF NOT EXISTS idx_pending_refunds_wallet ON web3_pending_refunds(wallet_address);`);
        // Distinguish separate logs in one transaction and reject duplicate logs.
        await client.query(`CREATE TABLE IF NOT EXISTS web3_refund_events (
            chain_id NUMERIC NOT NULL CHECK(scale(chain_id)=0 AND chain_id>0 AND chain_id<=${UINT256_MAX}),
            exchange_address TEXT NOT NULL CHECK(exchange_address ~ '^0x[0-9a-f]{40}$'),
            tx_hash TEXT NOT NULL CHECK(tx_hash ~ '^0x[0-9a-f]{64}$'),
            log_index INTEGER NOT NULL CHECK(log_index>=0),
            block_number NUMERIC NOT NULL CHECK(scale(block_number)=0 AND block_number>=0),
            block_hash TEXT NOT NULL CHECK(block_hash ~ '^0x[0-9a-f]{64}$'),
            wallet_address TEXT NOT NULL CHECK(wallet_address ~ '^0x[0-9a-f]{40}$'),
            event_name TEXT NOT NULL CHECK(event_name IN ('RefundHeld','PendingRefundClaimed')),
            blue_amount NUMERIC NOT NULL CHECK(blue_amount>=0 AND blue_amount<=${TOKEN128_MAX} AND scale(blue_amount)<=6),
            usdt_amount NUMERIC NOT NULL CHECK(usdt_amount>=0 AND usdt_amount<=${TOKEN128_MAX} AND scale(usdt_amount)<=6),
            is_removed BOOLEAN NOT NULL DEFAULT FALSE,
            CHECK(blue_amount>0 OR usdt_amount>0),
            PRIMARY KEY(chain_id,exchange_address,tx_hash,log_index)
        );`);
        await client.query(`ALTER TABLE web3_contract_deployments
            ADD COLUMN IF NOT EXISTS current_reward_epoch NUMERIC(78,0),
            ADD COLUMN IF NOT EXISTS reward_epoch_observed BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS reward_epoch_block_number NUMERIC(20,0),
            ADD COLUMN IF NOT EXISTS reward_epoch_block_hash TEXT;
            ALTER TABLE web3_contract_deployments
                ALTER COLUMN current_reward_epoch TYPE NUMERIC(78,0),
                ALTER COLUMN current_reward_epoch DROP DEFAULT,
                DROP CONSTRAINT IF EXISTS web3_reward_epoch_check;
            ALTER TABLE web3_contract_deployments ADD CONSTRAINT web3_reward_epoch_check CHECK(
                (current_reward_epoch IS NULL OR current_reward_epoch BETWEEN 0 AND ${UINT256_MAX}) AND
                (NOT reward_epoch_observed OR (current_reward_epoch IS NOT NULL AND reward_epoch_block_number>=0
                    AND reward_epoch_block_number IS NOT NULL AND reward_epoch_block_hash IS NOT NULL
                    AND reward_epoch_block_hash ~ '^0x[0-9a-f]{64}$'))
            );
            ALTER TABLE web3_governance_actions ADD COLUMN IF NOT EXISTS reward_epoch NUMERIC(78,0);
            ALTER TABLE web3_governance_actions ALTER COLUMN reward_epoch TYPE NUMERIC(78,0);`);
        await client.query('RELEASE SAVEPOINT migration110');
    } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT migration110');
        await client.query('RELEASE SAVEPOINT migration110');
        throw error;
    }
}
async function down() {
    throw new Error('Migration 110/111 is forward-only: preserve refund history and use an explicit corrective migration');
}
module.exports = { up, down };
