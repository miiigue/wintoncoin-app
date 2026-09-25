'use strict';
const { iface, configFromEnv } = require('../src/services/exchangeChainReader');
const { ExchangeIndexer } = require('../src/services/exchangeIndexer');
const { readExchangeSnapshot } = require('../src/services/exchangeSnapshotService');
const { isolatedDb } = require('./helpers/exchangeDb');
const port = process.env.WINTON_MIGRATION_TEST_PORT;
const suite = port ? describe : describe.skip;
const exchange = '0x' + '1'.repeat(40), wallet = '0x' + '2'.repeat(40);
const hash = n => '0x' + BigInt(n).toString(16).padStart(64, '0');
const config = { chainId: '1337', exchange, startBlock: 1, finality: 'finalized', batchBlocks: 2, maxLogs: 100 };
function chainFixture() {
    const c = {
        head: 2, finalized: 2, generation: 0, events: [], states: new Map(), amounts: new Map(),
        async chainId() { return '1337'; },
        async block(n) { n = n === 'latest' ? this.head : n === 'finalized' ? this.finalized : n; return { number: n, hash: hash(this.generation * 1000 + n) }; },
        async code(n) { return n === 0 ? '0x' : '0x60006000'; },
        async logs(from, to) { return this.events.filter(e => e.blockNumber >= from && e.blockNumber <= to); },
        async order(id, h) { return this.states.get(`${h}:${id}`) || this.states.get(id); },
        async isAmortization() { return false; },
        async refunds(w, h) { return this.amounts.get(`${h}:${w}`) || { blue: 0n, usdt: 0n }; },
        emit(name, args, block = 2, index = this.events.length) {
            const encoded = iface.encodeEventLog(iface.getEvent(name), args);
            const log = { ...encoded, address: exchange, blockNumber: block, blockHash: hash(this.generation * 1000 + block), transactionHash: hash(100 + block), index };
            this.events.push(log); return log;
        },
        orderState(id = '1', extra = {}) {
            const o = { id: BigInt(id), sequenceId: BigInt(id), remainingAmount: 10000000n, user: wallet,
                status: 1n, side: 1n, createdAt: 500n, originalAmount: 10000000n, refundedAmount: 0n, ...extra };
            this.states.set(id, o); return o;
        },
        create(id = '1') { this.orderState(id); this.emit('OrderCreated', [id, wallet, 1, 10000000, id, 500, 2]); }
    };
    return c;
}
suite('Exchange indexer: PostgreSQL real aislado', () => {
    let db, c, worker;
    beforeEach(async () => { db = await isolatedDb(port); c = chainFixture(); worker = new ExchangeIndexer(db.pool, c, config); });
    afterEach(async () => { await db?.close(); });
    const balance = () => db.pool.query('SELECT * FROM web3_pending_refunds ORDER BY token_type');
    const cursor = async () => (await db.pool.query('SELECT * FROM web3_exchange_sync')).rows[0];
    const snapshot = options => readExchangeSnapshot(db.pool, config, wallet, options);

    test('Reinicio y eventos repetidos no duplican órdenes ni devoluciones; conserva precisión', async () => {
        c.create(); c.emit('RefundHeld', [wallet, 1, 1234567]); c.events.push(c.events[1]);
        c.amounts.set(`${hash(2)}:${wallet}`, { blue: 1n, usdt: 1234567n });
        expect(await worker.tick()).toMatchObject({ status: 'ready' });
        worker = new ExchangeIndexer(db.pool, c, config); await worker.tick();
        expect((await db.pool.query('SELECT count(*)::int AS n FROM web3_exchange_logs')).rows[0].n).toBe(2);
        expect((await balance()).rows.map(r => r.amount)).toEqual(['0.000001', '1.234567']);
        expect((await snapshot()).data.orders).toHaveLength(1);
    });
    test('Varias devoluciones en una transacción y retiro parcial: prevalece saldo real, no suma de eventos', async () => {
        c.emit('RefundHeld', [wallet, 5000000, 2000000], 2, 0);
        c.emit('PendingRefundClaimed', [wallet, 0, 2000000], 2, 1);
        c.amounts.set(`${hash(2)}:${wallet}`, { blue: 5000000n, usdt: 0n });
        await worker.tick();
        expect((await snapshot()).data.pendingRefunds).toEqual({ BLUE: '5.0', USDT: '0.0' });
        expect((await db.pool.query('SELECT count(*)::int AS n FROM web3_refund_events')).rows[0].n).toBe(2);
    });
    test('Suspensión y reingreso conservan ID, pero actualizan secuencia y motivo', async () => {
        c.create(); c.emit('OrderSuspended', [1, 1]); c.orderState('1', { status: 5n }); await worker.tick();
        expect((await snapshot()).data.orders[0]).toMatchObject({ status: 'SUSPENDED', suspend_reason: 1 });
        c.head = c.finalized = 3; c.emit('OrderResumed', [1, 1, 7], 3); c.orderState('1', { sequenceId: 7n });
        await worker.tick();
        expect((await snapshot()).data.orders[0]).toMatchObject({ sequence_id: '7', status: 'OPEN', suspend_reason: 0 });
    });
    test('Cruce actualiza ambos participantes aunque el evento no incluye billeteras', async () => {
        c.create('1'); c.create('2'); await worker.tick();
        c.head = c.finalized = 3; c.emit('OrderMatched', [1, 1, 2, 10000000, 0, 0, 10000000, 10000000], 3);
        for (const id of ['1', '2']) c.orderState(id, { status: 3n, remainingAmount: 0n });
        await worker.tick(); expect((await snapshot()).data.orders.map(o => o.status)).toEqual(['FILLED', 'FILLED']);
    });
    test('Fallo RPC no deja filas ni avanza cursor; siguiente intento recupera', async () => {
        c.create(); const saved = c.refunds; c.refunds = async () => { throw Error('secret RPC URL'); };
        await expect(worker.tick()).rejects.toThrow();
        expect((await cursor()).cursor_block).toBe('0'); expect((await balance()).rows).toHaveLength(0);
        expect(await snapshot()).toMatchObject({ usable: false, status: 'error', errorCode: 'SYNC_FAILED', data: null });
        c.refunds = saved; await worker.tick(); expect((await snapshot()).usable).toBe(true);
    });
    test('Fallo SQL intermedio revierte eventos y saldos junto al cursor', async () => {
        c.create(); c.emit('RefundHeld', [wallet, 1, 0]);
        c.amounts.set(`${hash(2)}:${wallet}`, { blue: 1n, usdt: -1n });
        await expect(worker.tick()).rejects.toThrow();
        expect((await db.pool.query('SELECT count(*)::int AS n FROM web3_exchange_logs')).rows[0].n).toBe(0);
        expect((await balance()).rows).toHaveLength(0); expect((await cursor()).cursor_block).toBe('0');
    });
    test('Cambio de cadena durante lectura no confirma una página inconsistente', async () => {
        c.create(); c.refunds = async () => { c.generation = 1; return { blue: 0n, usdt: 0n }; };
        await expect(worker.tick()).rejects.toMatchObject({ indexerCode: 'CHAIN_CHANGED' });
        expect((await cursor()).cursor_block).toBe('0');
    });
    test('Cambio de cadena mientras se guardan filas revierte también la transacción SQL', async () => {
        c.create(); const persist = worker.persist.bind(worker);
        worker.persist = async (client, data, end, target) => {
            const query = client.query.bind(client);
            const wrapped = { query: async (...args) => {
                const result = await query(...args);
                if (args[0].includes('INSERT INTO web3_pending_refunds')) c.generation = 1;
                return result;
            } };
            return persist(wrapped, data, end, target);
        };
        await expect(worker.tick()).rejects.toMatchObject({ indexerCode: 'CHAIN_CHANGED' });
        expect((await cursor()).cursor_block).toBe('0'); expect((await balance()).rows).toHaveLength(0);
        expect((await db.pool.query('SELECT count(*)::int AS n FROM web3_exchange_logs')).rows[0].n).toBe(0);
    });
    test('Reorganización conserva historia huérfana y reconstruye saldo desde creación', async () => {
        c.emit('RefundHeld', [wallet, 5000000, 0]); c.amounts.set(`${hash(2)}:${wallet}`, { blue: 5000000n, usdt: 0n });
        await worker.tick(); c.generation = 1; c.events = [];
        expect(await worker.tick()).toEqual({ status: 'rebuilding' });
        expect(await snapshot()).toMatchObject({ usable: false, data: null });
        c.emit('RefundHeld', [wallet, 2000000, 0]); c.amounts.set(`${hash(1002)}:${wallet}`, { blue: 2000000n, usdt: 0n });
        await worker.tick(); expect((await snapshot()).data.pendingRefunds.BLUE).toBe('2.0');
        expect((await db.pool.query('SELECT is_removed FROM web3_exchange_logs ORDER BY block_hash')).rows.map(r => r.is_removed)).toEqual([true, false]);
    });
    test('Dos procesos no escriben la misma página simultáneamente', async () => {
        c.create(); let release, entered;
        const started = new Promise(resolve => { entered = resolve; });
        const original = c.logs;
        c.logs = async (...args) => { entered(); await new Promise(resolve => { release = resolve; }); return original.apply(c, args); };
        const first = worker.tick(); await started;
        expect(await new ExchangeIndexer(db.pool, c, config).tick()).toEqual({ status: 'busy' });
        release(); await first;
    });
    test('No lee bloques sin confirmación; procesa progreso por páginas sin mostrar parciales', async () => {
        c.create(); c.head = 7; c.finalized = 5;
        await worker.tick(); expect(await snapshot()).toMatchObject({ status: 'syncing', usable: false });
        await worker.tick(); await worker.tick(); expect((await cursor()).cursor_block).toBe('5');
        expect((await snapshot()).usable).toBe(true);
    });
    test('Datos antiguos se identifican como desactualizados sin mostrar cero ficticio', async () => {
        expect(await snapshot()).toMatchObject({ status: 'not_started', data: null });
        await worker.tick(); await db.pool.query("UPDATE web3_exchange_sync SET last_checked_at=now()-interval '10 minutes'");
        expect(await snapshot()).toMatchObject({ status: 'stale', usable: false, data: null });
        await worker.tick(); expect((await snapshot()).usable).toBe(true);
    });
    test('No acepta red equivocada, inicio tardío, política cambiada ni proveedor atrasado', async () => {
        c.chainId = async () => '10'; await expect(worker.tick()).rejects.toMatchObject({ indexerCode: 'WRONG_CHAIN' });
        c.chainId = async () => '1337'; c.code = async () => '0x6000';
        await expect(worker.tick()).rejects.toMatchObject({ indexerCode: 'NOT_DEPLOYMENT_BLOCK' });
        c.code = async n => n === 0 ? '0x' : '0x6000'; await worker.tick();
        const changed = new ExchangeIndexer(db.pool, c, { ...config, finality: 'confirmations:3' });
        await expect(changed.tick()).rejects.toMatchObject({ indexerCode: 'STREAM_CONFIG_CHANGED' });
        c.finalized = 1; await expect(worker.tick()).rejects.toMatchObject({ indexerCode: 'RPC_BEHIND_CURSOR' });
    });
    test('Límite de trabajo no omite eventos y cambio de código falla visiblemente', async () => {
        c.create(); const limited = new ExchangeIndexer(db.pool, c, { ...config, maxLogs: 0 });
        expect(await limited.tick()).toMatchObject({ status: 'syncing', block: 1 });
        await expect(limited.tick()).rejects.toMatchObject({ indexerCode: 'PAGE_TOO_LARGE' });
        expect((await cursor()).cursor_block).toBe('1');
        c.code = async () => '0x6002'; await expect(worker.tick()).rejects.toMatchObject({ indexerCode: 'CONTRACT_CODE_CHANGED' });
    });
    test('Importes máximos y paginación se mantienen como texto exacto', async () => {
        c.create('1'); c.create('2'); c.emit('RefundHeld', [wallet, (1n << 128n) - 1n, 0]);
        c.amounts.set(`${hash(2)}:${wallet}`, { blue: (1n << 128n) - 1n, usdt: 0n }); await worker.tick();
        const first = await snapshot({ limit: 1 }); expect(first.data.nextAfter).toBe('1');
        expect(first.data.pendingRefunds.BLUE).toBe('340282366920938463463374607431768.211455');
        expect((await snapshot({ after: first.data.nextAfter, limit: 1 })).data.orders[0].order_id).toBe('2');
    });
    test('Migración repetida preserva estado y no acepta ejecutarse sin transacción', async () => {
        c.create(); await worker.tick(); const client = await db.pool.connect();
        try {
            await client.query('BEGIN'); await require('../migrations/112_exchange_indexer').up(client); await client.query('COMMIT');
            await expect(require('../migrations/112_exchange_indexer').up(client)).rejects.toMatchObject({ code: '25P01' });
        } finally { client.release(); }
        expect((await snapshot()).data.orders).toHaveLength(1);
    });
    test('No incorpora devoluciones anteriores sin un cursor verificable', async () => {
        await db.pool.query('INSERT INTO web3_pending_refunds(chain_id,exchange_address,wallet_address,token_type,amount,block_number,block_hash) VALUES($1,$2,$3,$4,5,1,$5)',
            [config.chainId, exchange, wallet, 'BLUE', hash(1)]);
        await expect(worker.tick()).rejects.toMatchObject({ indexerCode: 'EXISTING_REFUNDS_REQUIRE_RECONCILIATION' });
        expect((await balance()).rows[0].amount).toBe('5');
        expect((await snapshot()).data).toBeNull();
    });
    test('Misma billetera en redes distintas mantiene saldos y reconstrucciones separados', async () => {
        c.emit('RefundHeld', [wallet, 5000000, 0]); c.amounts.set(`${hash(2)}:${wallet}`, { blue: 5000000n, usdt: 0n });
        await worker.tick();
        const other = chainFixture(); other.chainId = async () => '10'; other.emit('RefundHeld', [wallet, 7000000, 0]);
        other.amounts.set(`${hash(2)}:${wallet}`, { blue: 7000000n, usdt: 0n });
        const otherConfig = { ...config, chainId: '10' };
        await new ExchangeIndexer(db.pool, other, otherConfig).tick();
        c.generation = 1; await worker.tick();
        expect((await snapshot()).data).toBeNull();
        expect((await readExchangeSnapshot(db.pool, otherConfig, wallet)).data.pendingRefunds.BLUE).toBe('7.0');
        expect((await readExchangeSnapshot(db.pool, { ...config, exchange: wallet }, wallet)).status).toBe('not_started');
    });
});

test('Configuración exige procedencia explícita y finality segura por defecto', () => {
    expect(() => configFromEnv({})).toThrow();
    const env = { EXCHANGE_INDEXER_CHAIN_ID: '10', EXCHANGE_INDEXER_ADDRESS: exchange, EXCHANGE_INDEXER_START_BLOCK: '123' };
    expect(configFromEnv(env)).toMatchObject({ finality: 'finalized', startBlock: 123 });
    expect(() => configFromEnv({ ...env, EXCHANGE_INDEXER_FINALITY: 'latest' })).toThrow();
    expect(() => configFromEnv({ ...env, EXCHANGE_INDEXER_BATCH_BLOCKS: '1000000' })).toThrow();
});
