const { expect } = require('chai');
const { ethers, artifacts } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { fixture, U } = require('./helpers/suite');
const { isolatedDb } = require('../../backend/__tests__/helpers/exchangeDb');
const { ExchangeChainReader, iface } = require('../../backend/src/services/exchangeChainReader');
const { ExchangeIndexer } = require('../../backend/src/services/exchangeIndexer');
const { readExchangeSnapshot } = require('../../backend/src/services/exchangeSnapshotService');

describe('ABI Exchange indexer', function () {
    it('Cada evento y lectura coincide con el contrato compilado', async () => {
        const actual = new ethers.Interface((await artifacts.readArtifact('FifoExchange')).abi);
        for (const f of iface.fragments) {
            const other = f.type === 'event' ? actual.getEvent(f.name) : actual.getFunction(f.name);
            expect(other.format('full')).eq(f.format('full'));
        }
    });
});

(process.env.WINTON_MIGRATION_TEST_PORT ? describe : describe.skip)('Exchange real → PostgreSQL aislado', function () {
    this.timeout(60000);
    let db, f, worker, chain, cfg;
    beforeEach(async () => {
        db = await isolatedDb(process.env.WINTON_MIGRATION_TEST_PORT);
        f = await fixture();
        chain = new ExchangeChainReader(ethers.provider, f.exchange.target);
        cfg = { chainId: (await ethers.provider.getNetwork()).chainId.toString(), exchange: f.exchange.target.toLowerCase(),
            startBlock: (await f.exchange.deploymentTransaction().wait()).blockNumber, finality: 'confirmations:1', batchBlocks: 2000, maxLogs: 2000 };
        worker = new ExchangeIndexer(db.pool, chain, cfg);
    });
    afterEach(async () => { await db?.close(); });
    async function sync(wallet) {
        await ethers.provider.send('evm_mine', []);
        await worker.tick();
        return readExchangeSnapshot(db.pool, cfg, wallet.address);
    }
    it('Orden, cruce parcial, devolución retenida y retiro coinciden con los contratos', async () => {
        await f.core.setCommissionBps(0); await f.pay(f.alice, f.bob, 10n * U);
        await time.increase(30 * 86400);
        await f.exchange.connect(f.bob).createBlueOrder(10n * U);
        await f.exchange.connect(f.other).createUsdtOrder(4n * U);
        await f.exchange.matchOrders(10, 20);
        let result = await sync(f.bob);
        expect(result.usable).eq(true);
        expect(result.data.orders[0]).include({ status: 'PARTIALLY_FILLED', remaining_amount: '6.0' });
        await f.core.setKYCStatus(f.bob.address, false);
        await f.exchange.connect(f.bob).cancelOrder(1);
        result = await sync(f.bob);
        expect(result.data.orders[0]).include({ status: 'CANCELLED', refunded_amount: '6.0' });
        expect(result.data.pendingRefunds.BLUE).eq(ethers.formatUnits(await f.exchange.pendingRefundBlue(f.bob.address), 6));
        expect(result.data.pendingRefunds.BLUE).eq('6.0');
        await f.core.setKYCStatus(f.bob.address, true);
        await f.exchange.connect(f.bob).claimPendingRefunds();
        result = await sync(f.bob);
        expect(result.data.pendingRefunds.BLUE).eq('0.0');
        expect((await db.pool.query('SELECT event_name FROM web3_refund_events ORDER BY block_number')).rows.map(r => r.event_name))
            .deep.eq(['RefundHeld', 'PendingRefundClaimed']);
    });
    it('Reorganización real revierte una orden sin borrar la evidencia histórica', async () => {
        const checkpoint = await ethers.provider.send('evm_snapshot', []);
        await f.exchange.connect(f.other).createUsdtOrder(3n * U);
        expect((await sync(f.other)).data.orders).length(1);
        await ethers.provider.send('evm_revert', [checkpoint]);
        await f.exchange.connect(f.other).createUsdtOrder(5n * U);
        await ethers.provider.send('evm_mine', []);
        expect((await worker.tick()).status).eq('rebuilding');
        expect((await readExchangeSnapshot(db.pool, cfg, f.other.address)).data).eq(null);
        await worker.tick();
        const result = await readExchangeSnapshot(db.pool, cfg, f.other.address);
        expect(result.data.orders[0].original_amount).eq('5.0');
        expect((await db.pool.query('SELECT count(*)::int AS n FROM web3_exchange_logs WHERE is_removed')).rows[0].n).eq(1);
    });
    it('Devolución de compra garantizada vuelve al Vault y no aparece como retiro personal', async () => {
        await f.core.setCommissionBps(0);
        await f.core.setCreditLimit(f.alice.address, 100n * U);
        await f.vault.connect(f.alice).deposit(100n * U);
        await f.pay(f.alice, f.bob, 200n * U);
        await f.vault.connect(f.alice).repayWithCollateral(f.alice.address, 100n * U);
        const id = await f.vault.activeAmortizationOrder(f.alice.address);
        await f.core.setKYCStatus(f.alice.address, false);
        await f.exchange.connect(f.alice).cancelOrder(id);
        const result = await sync(f.alice);
        expect(result.data.orders[0]).include({ is_amortization: true, status: 'CANCELLED', refunded_amount: '100.0' });
        expect(result.data.pendingRefunds.USDT).eq('0.0');
        expect(await f.vault.userCollateral(f.alice.address)).eq(100n * U);
        expect(await f.vault.getFreeCollateral(f.alice.address)).eq(0n);
    });
});
