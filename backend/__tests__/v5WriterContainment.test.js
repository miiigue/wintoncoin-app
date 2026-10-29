'use strict';

const mockStalePool = {
    options: {},
    query: jest.fn(async () => ({ rowCount: 1, rows: [{ status: 'ready', fresh: false, error_code: null }] })),
    connect: jest.fn()
};
jest.mock('../src/config/db', () => mockStalePool);

const deployment = require('../src/services/chainDeployment');
const manifest = require('../../web3-contracts/deployment-manifest-v4.json');
const config = { chainId: '11155420', epoch: 'V5_CODEX_163', fingerprint: '0xfeed',
    contracts: manifest.contracts, startBlocks: manifest.startBlocks };
const saved = {};

beforeAll(() => {
    for (const key of ['WINTON_V5_ECONOMIC_WRITES_ENABLED', 'WINTON_V5_WRITE_FINGERPRINT']) saved[key] = process.env[key];
    process.env.WINTON_V5_ECONOMIC_WRITES_ENABLED = 'true';
    process.env.WINTON_V5_WRITE_FINGERPRINT = config.fingerprint;
    jest.spyOn(deployment, 'configuration').mockReturnValue(config);
    jest.spyOn(deployment, 'validate').mockResolvedValue(config);
});

afterAll(() => {
    jest.restoreAllMocks();
    for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
});

beforeEach(() => mockStalePool.query.mockClear());

function expectContained(promise) {
    return expect(promise).rejects.toMatchObject({ status: 503, code: 'V5_INDEXER_STALE' });
}

describe('todos los escritores V5 respetan la contención por indexador', () => {
    test('relayer institucional', () => expectContained(
        require('../src/services/durableRelayer').execute({ provider: {} }, {}, 'matchOrders', [])
    ));

    test('administración con firmante servidor', () => expectContained(
        require('../src/services/durableAdministration').execute({ provider: {} }, {}, 'setCommissionBps', [100])
    ));

    test('operaciones de billetera', () => {
        const { WalletOperations } = require('../src/services/walletOperations');
        return expectContained(new WalletOperations(mockStalePool, {}, config, {}).prepare(1, { action: 'claim' }));
    });

    test('pagos marketplace', () => {
        const { MarketplacePayments } = require('../src/services/marketplacePayments');
        const service = new MarketplacePayments(mockStalePool, {}, config, { journalPool: mockStalePool });
        return expectContained(service.begin({}, {}, null));
    });

    test('patrocinio Safe y patrocinio de gas', async () => {
        await expectContained(require('../src/services/safeExecution').sponsoredStep(mockStalePool, {}, config.chainId, 1, {}, {}));
        await expectContained(require('../src/services/gasSponsorship').sponsor({ pool: mockStalePool }, {}, 1n));
    });

    test('migración heredada', () => expectContained(
        require('../src/services/legacyMigrationExecution').advance({ pool: mockStalePool }, {}, 1)
    ));

    test('keeper no prepara ni firma mientras el indexador está obsoleto', async () => {
        const result = await require('../src/services/chainMaintenance').executeMaintenance({
            pool: mockStalePool, rpc: {}, config, wallet: '0x0000000000000000000000000000000000000001', kind: 'settleMatured'
        });
        expect(result).toEqual({ status: 'maintenance_paused', reason: 'V5_INDEXER_STALE' });
    });
});
