'use strict';

const { address, uint } = require('./exchangeChainReader');

async function readExchangeSnapshot(pool, identity, wallet, { after = '0', limit = 50, maxAgeSeconds = 120 } = {}) {
    wallet = address(wallet);
    after = uint(after, (1n << 64n) - 1n).toString();
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('INVALID_PAGE');
    const client = await pool.connect();
    try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const key = [identity.chainId, identity.exchange];
        const row = (await client.query(`SELECT *, (status='ready' AND last_checked_at > clock_timestamp()-($3*interval '1 second')) AS fresh
            FROM web3_exchange_sync WHERE chain_id=$1 AND exchange_address=$2`, [...key, maxAgeSeconds])).rows[0];
        const result = {
            chainId: identity.chainId, exchange: identity.exchange, wallet,
            usable: !!row?.fresh,
            status: !row ? 'not_started' : row.status === 'ready' && !row.fresh ? 'stale' : row.status,
            verifiedThroughBlock: row?.cursor_hash ? row.cursor_block : null,
            verifiedBlockHash: row?.cursor_hash ?? null,
            targetBlock: row?.target_block ?? null,
            lastCheckedAt: row?.last_checked_at ?? null,
            lastSuccessAt: row?.last_success_at ?? null,
            finality: row?.finality ?? null,
            errorCode: row?.error_code ?? null,
            data: null
        };
        // Incomplete/stale projections never masquerade as a zero balance.
        if (result.usable) {
            const orders = (await client.query(`SELECT order_id,sequence_id,side,status,is_amortization,original_amount,remaining_amount,refunded_amount,
                created_at_chain,suspend_reason,block_number,block_hash FROM web3_exchange_order_snapshots
                WHERE chain_id=$1 AND exchange_address=$2 AND wallet_address=$3 AND order_id>$4
                ORDER BY order_id LIMIT $5`, [...key, wallet, after, limit + 1])).rows;
            const refunds = (await client.query(`SELECT token_type,amount FROM web3_pending_refunds
                WHERE chain_id=$1 AND exchange_address=$2 AND wallet_address=$3`, [...key, wallet])).rows;
            const hasMore = orders.length > limit;
            if (hasMore) orders.pop();
            result.data = { orders, pendingRefunds: {
                BLUE: refunds.find(r => r.token_type === 'BLUE')?.amount ?? '0',
                USDT: refunds.find(r => r.token_type === 'USDT')?.amount ?? '0'
            }, nextAfter: hasMore ? orders.at(-1).order_id : null };
        }
        await client.query('COMMIT');
        return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
}
module.exports = { readExchangeSnapshot };
