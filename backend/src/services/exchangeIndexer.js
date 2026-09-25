'use strict';

const { formatUnits } = require('ethers');
const { iface, address, fail, keccak256 } = require('./exchangeChainReader');
const STATUSES = [null, 'OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'SUSPENDED'];
const SIDES = ['SELL_BLUE', 'BUY_BLUE'];
const tokens = value => formatUnits(value, 6);
const scope = 'chain_id=$1 AND exchange_address=$2';

class ExchangeIndexer {
    constructor(pool, chain, config) {
        this.pool = pool; this.chain = chain; this.config = config;
        this.key = [config.chainId, config.exchange];
    }
    async target() {
        if (this.config.finality === 'finalized') return this.chain.block('finalized');
        const latest = await this.chain.block('latest');
        return this.chain.block(Math.max(0, latest.number - Number(this.config.finality.split(':')[1])));
    }
    async transaction(client, action) {
        await client.query('BEGIN');
        try { const result = await action(); await client.query('COMMIT'); return result; }
        catch (error) { await client.query('ROLLBACK'); throw error; }
    }
    async canonical(block) {
        if ((await this.chain.block(block.number)).hash !== block.hash) fail('CHAIN_CHANGED');
    }
    async init(client, target) {
        let row = (await client.query(`SELECT * FROM web3_exchange_sync WHERE ${scope}`, this.key)).rows[0];
        if (row) {
            if (Number(row.start_block) !== this.config.startBlock || row.finality !== this.config.finality) fail('STREAM_CONFIG_CHANGED');
            return row;
        }
        if (target.number < this.config.startBlock) return null;
        // Starting after deployment would silently miss balances and orders.
        if (await this.chain.code(this.config.startBlock - 1) !== '0x') fail('NOT_DEPLOYMENT_BLOCK');
        const code = await this.chain.code(this.config.startBlock);
        if (code === '0x') fail('CONTRACT_NOT_DEPLOYED');
        // Do not merge manually populated or orphaned projections into a new
        // stream and present them as verified by this worker.
        const existing = await client.query(`SELECT EXISTS(SELECT 1 FROM web3_pending_refunds WHERE ${scope})
            OR EXISTS(SELECT 1 FROM web3_refund_events WHERE ${scope}) AS found`, this.key);
        if (existing.rows[0].found) fail('EXISTING_REFUNDS_REQUIRE_RECONCILIATION');
        row = (await client.query(`INSERT INTO web3_exchange_sync
            (chain_id,exchange_address,start_block,finality,runtime_hash,cursor_block,status)
            VALUES($1,$2,$3::bigint,$4,$5,$3::bigint-1,'syncing') RETURNING *`,
        [...this.key, this.config.startBlock, this.config.finality, keccak256(code)])).rows[0];
        return row;
    }
    async rebuild(client, target) {
        // Keep original logs (including orphaned hashes). Only projections are
        // discarded; the API hides incomplete results until replay catches up.
        await this.transaction(client, async () => {
            await client.query(`UPDATE web3_exchange_logs SET is_removed=TRUE WHERE ${scope}`, this.key);
            await client.query(`UPDATE web3_refund_events SET is_removed=TRUE WHERE ${scope}`, this.key);
            await client.query(`DELETE FROM web3_exchange_order_snapshots WHERE ${scope}`, this.key);
            await client.query(`DELETE FROM web3_pending_refunds WHERE ${scope}`, this.key);
            await client.query(`UPDATE web3_exchange_sync SET cursor_block=start_block-1,cursor_hash=NULL,
                target_block=$3,status='rebuilding',last_checked_at=clock_timestamp(),error_code=NULL WHERE ${scope}`,
            [...this.key, target.number]);
        });
        return { status: 'rebuilding' };
    }
    async page(cursor, end) {
        const from = Number(cursor.cursor_block) + 1;
        let logs = await this.chain.logs(from, end.number);
        if (logs.length > this.config.maxLogs) fail('PAGE_TOO_LARGE');
        const unique = new Map(), blocks = new Map([[end.number, end.hash]]);
        const orders = new Set(), wallets = new Set();
        for (const log of logs) {
            if (log.removed || address(log.address) !== this.config.exchange ||
                !Number.isSafeInteger(log.blockNumber) || log.blockNumber < from || log.blockNumber > end.number ||
                !Number.isSafeInteger(log.index) || log.index < 0 ||
                !/^0x[0-9a-f]{64}$/.test(log.transactionHash) || !/^0x[0-9a-f]{64}$/.test(log.blockHash)) fail('INVALID_LOG');
            const id = `${log.blockHash}:${log.transactionHash}:${log.index}`;
            if (unique.has(id)) {
                if (JSON.stringify(unique.get(id)) !== JSON.stringify(log)) fail('CONFLICTING_LOG');
                continue;
            }
            unique.set(id, log);
            if (!blocks.has(log.blockNumber)) blocks.set(log.blockNumber, (await this.chain.block(log.blockNumber)).hash);
            if (blocks.get(log.blockNumber) !== log.blockHash) fail('CHAIN_CHANGED');
        }
        logs = [...unique.values()].sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index)
            .map(log => ({ log, parsed: iface.parseLog(log) }));
        for (const { parsed } of logs) {
            if (!parsed) fail('UNKNOWN_EVENT');
            if (parsed.args.orderId !== undefined) orders.add(parsed.args.orderId.toString());
            if (parsed.name === 'OrderMatched') {
                orders.add(parsed.args.blueOrderId.toString()); orders.add(parsed.args.usdtOrderId.toString());
            }
            if (parsed.args.user !== undefined) wallets.add(address(parsed.args.user));
        }
        const snapshots = [];
        for (const id of orders) {
            const o = await this.chain.order(id, end.hash);
            if (o.id.toString() !== id || !STATUSES[Number(o.status)] || !SIDES[Number(o.side)]) fail('INVALID_ORDER');
            const wallet = address(o.user);
            const isAmortization = await this.chain.isAmortization(id, end.hash);
            wallets.add(wallet); snapshots.push({ id, o, wallet, isAmortization });
        }
        const balances = [];
        for (const wallet of wallets) balances.push({ wallet, ...await this.chain.refunds(wallet, end.hash) });
        await this.canonical(end);
        if (cursor.cursor_hash) await this.canonical({ number: Number(cursor.cursor_block), hash: cursor.cursor_hash });
        if (keccak256(await this.chain.code(end.number)) !== cursor.runtime_hash) fail('CONTRACT_CODE_CHANGED');
        await this.canonical(end);
        return { logs, snapshots, balances };
    }
    async persist(client, data, end, target) {
        await this.transaction(client, async () => {
            for (const { log, parsed: e } of data.logs) {
                await client.query(`INSERT INTO web3_exchange_logs
                    (chain_id,exchange_address,block_number,block_hash,tx_hash,log_index,event_name,order_id,suspend_reason,raw_log)
                    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                    ON CONFLICT(chain_id,exchange_address,block_hash,tx_hash,log_index) DO UPDATE SET is_removed=FALSE`,
                [...this.key, log.blockNumber, log.blockHash, log.transactionHash, log.index, e.name,
                    e.args.orderId?.toString() ?? null, e.name === 'OrderSuspended' ? Number(e.args.reason) : null, JSON.stringify(log)]);
                if (e.name === 'RefundHeld' || e.name === 'PendingRefundClaimed') {
                    await client.query(`INSERT INTO web3_refund_events
                        (chain_id,exchange_address,tx_hash,log_index,block_number,block_hash,wallet_address,event_name,blue_amount,usdt_amount)
                        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                        ON CONFLICT(chain_id,exchange_address,tx_hash,log_index) DO UPDATE SET
                        block_number=EXCLUDED.block_number,block_hash=EXCLUDED.block_hash,wallet_address=EXCLUDED.wallet_address,
                        event_name=EXCLUDED.event_name,blue_amount=EXCLUDED.blue_amount,usdt_amount=EXCLUDED.usdt_amount,is_removed=FALSE`,
                    [...this.key, log.transactionHash, log.index, log.blockNumber, log.blockHash, address(e.args.user),
                        e.name, tokens(e.args.blue), tokens(e.args.usdt)]);
                }
            }
            for (const { id, o, wallet, isAmortization } of data.snapshots) {
                let reason = 0;
                if (Number(o.status) === 5) {
                    const latest = await client.query(`SELECT suspend_reason FROM web3_exchange_logs WHERE ${scope}
                        AND order_id=$3 AND event_name='OrderSuspended' AND NOT is_removed ORDER BY block_number DESC,log_index DESC LIMIT 1`, [...this.key, id]);
                    reason = latest.rows[0]?.suspend_reason;
                    if (![1, 2].includes(reason)) fail('SUSPENSION_EVENT_MISSING');
                }
                await client.query(`INSERT INTO web3_exchange_order_snapshots
                    (chain_id,exchange_address,order_id,sequence_id,wallet_address,side,status,original_amount,remaining_amount,
                    refunded_amount,created_at_chain,suspend_reason,block_number,block_hash,is_amortization)
                    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                    ON CONFLICT(chain_id,exchange_address,order_id) DO UPDATE SET
                    sequence_id=EXCLUDED.sequence_id,wallet_address=EXCLUDED.wallet_address,side=EXCLUDED.side,status=EXCLUDED.status,
                    original_amount=EXCLUDED.original_amount,remaining_amount=EXCLUDED.remaining_amount,refunded_amount=EXCLUDED.refunded_amount,
                    created_at_chain=EXCLUDED.created_at_chain,suspend_reason=EXCLUDED.suspend_reason,block_number=EXCLUDED.block_number,block_hash=EXCLUDED.block_hash,is_amortization=EXCLUDED.is_amortization`,
                [...this.key, id, o.sequenceId.toString(), wallet, SIDES[Number(o.side)], STATUSES[Number(o.status)],
                    tokens(o.originalAmount), tokens(o.remainingAmount), tokens(o.refundedAmount), o.createdAt.toString(), reason, end.number, end.hash, isAmortization]);
            }
            for (const b of data.balances) {
                for (const [token, amount] of [['BLUE', b.blue], ['USDT', b.usdt]]) {
                    await client.query(`INSERT INTO web3_pending_refunds
                        (chain_id,exchange_address,wallet_address,token_type,amount,block_number,block_hash)
                        VALUES($1,$2,$3,$4,$5,$6,$7)
                        ON CONFLICT(chain_id,exchange_address,wallet_address,token_type) DO UPDATE SET
                        amount=EXCLUDED.amount,block_number=EXCLUDED.block_number,block_hash=EXCLUDED.block_hash,synced_at=clock_timestamp()`,
                    [...this.key, b.wallet, token, tokens(amount), end.number, end.hash]);
                }
            }
            // Recheck after SQL writes too: a slow database must not conceal a
            // branch change that occurred while the transaction was open.
            await this.canonical(end);
            await client.query(`UPDATE web3_exchange_sync SET cursor_block=$3,cursor_hash=$4,target_block=$5,
                status=$6,last_checked_at=clock_timestamp(),last_success_at=clock_timestamp(),error_code=NULL WHERE ${scope}`,
            [...this.key, end.number, end.hash, target.number, end.number === target.number ? 'ready' : 'syncing']);
        });
    }
    async tick() {
        const client = await this.pool.connect();
        const lockKey = `winton:exchange:${this.key.join(':')}`;
        let locked = false, destroy = false;
        try {
            locked = (await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked', [lockKey])).rows[0].locked;
            if (!locked) return { status: 'busy' };
            if (await this.chain.chainId() !== this.config.chainId) fail('WRONG_CHAIN');
            const target = await this.target();
            const cursor = await this.init(client, target);
            if (!cursor) return { status: 'waiting_deployment' };
            if (cursor.cursor_hash) {
                // A lower head may be an out-of-date RPC, not a reorg. Fail closed.
                if (target.number < Number(cursor.cursor_block)) fail('RPC_BEHIND_CURSOR');
                const current = await this.chain.block(Number(cursor.cursor_block));
                if (current.hash !== cursor.cursor_hash) return await this.rebuild(client, target);
            }
            if (Number(cursor.cursor_block) === target.number) {
                await client.query(`UPDATE web3_exchange_sync SET status='ready',last_checked_at=clock_timestamp(),
                    target_block=$3,error_code=NULL WHERE ${scope}`, [...this.key, target.number]);
                return { status: 'ready', block: target.number };
            }
            let endNumber = Math.min(target.number, Number(cursor.cursor_block) + this.config.batchBlocks);
            let end, data;
            for (;;) {
                end = await this.chain.block(endNumber);
                try { data = await this.page(cursor, end); break; }
                catch (error) {
                    if (error.indexerCode !== 'PAGE_TOO_LARGE' || endNumber === Number(cursor.cursor_block) + 1) throw error;
                    endNumber = Number(cursor.cursor_block) + Math.max(1, Math.floor((endNumber - Number(cursor.cursor_block)) / 2));
                }
            }
            await this.persist(client, data, end, target);
            return { status: end.number === target.number ? 'ready' : 'syncing', block: end.number };
        } catch (error) {
            if (locked) {
                try {
                    await client.query(`UPDATE web3_exchange_sync SET status='error',error_code=$3,last_checked_at=clock_timestamp() WHERE ${scope}`,
                    [...this.key, error.indexerCode || 'SYNC_FAILED']);
                } catch (_) { destroy = true; }
            }
            throw error;
        } finally {
            if (locked && !destroy) {
                try { await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [lockKey]); }
                catch (_) { destroy = true; }
            }
            client.release(destroy);
        }
    }
}

/**
 * Inicia el indexador de órdenes en segundo plano dentro del proceso de Node.js existente.
 * Utiliza el pool de base de datos compartido y polling no superpuesto.
 */
function startEmbeddedExchangeIndexer(pool, { customConfig, customChain } = {}) {
    const { configFromEnv, createReader } = require('./exchangeChainReader');
    let config;
    try {
        config = customConfig || configFromEnv();
    } catch (e) {
        console.warn('[EXCHANGE_INDEXER] Configuración incompleta o no habilitada, indexador en segundo plano inactivo:', e.message);
        return null;
    }
    const rpcUrl = process.env.EXCHANGE_INDEXER_RPC_URL || process.env.OPTIMISM_RPC_URL;
    if (!rpcUrl) {
        console.warn('[EXCHANGE_INDEXER] Sin RPC URL configurada para el indexador.');
        return null;
    }
    const chain = customChain || createReader(rpcUrl, config.exchange);
    const worker = new ExchangeIndexer(pool, chain, config);
    let stopped = false;
    let running = false;

    const tickLoop = async () => {
        if (stopped || running) return;
        running = true;
        let delay = config.pollMs || 5000;
        try {
            const result = await worker.tick();
            if (['syncing', 'rebuilding'].includes(result.status)) {
                delay = 100;
            }
        } catch (error) {
            console.error('[EXCHANGE_INDEXER] Tick error:', error.indexerCode || 'SYNC_FAILED');
            delay = config.pollMs || 5000;
        } finally {
            running = false;
            if (!stopped) {
                setTimeout(tickLoop, delay);
            }
        }
    };

    console.log(`[EXCHANGE_INDEXER] 🚀 Iniciando indexador en segundo plano para Exchange ${config.exchange} desde bloque ${config.startBlock}...`);
    setTimeout(tickLoop, 1500);

    const stop = () => {
        stopped = true;
        try { chain.provider?.destroy?.(); } catch (_) {}
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    return { stop, worker };
}

module.exports = { ExchangeIndexer, startEmbeddedExchangeIndexer };

