'use strict';

const readiness = require('../src/services/prelaunchExitReadiness');

const config = {
    chainId: '11155420',
    epoch: 'V5_CODEX_163',
    fingerprint: '0xfeed',
    contracts: {
        CoreProtocol: '0x0000000000000000000000000000000000000001',
        CollateralVault: '0x0000000000000000000000000000000000000002',
        FifoExchange: '0x0000000000000000000000000000000000000003',
        ProtocolTreasury: '0x0000000000000000000000000000000000000004'
    }
};

function fixture(overrides = {}) {
    const pauses = overrides.pauses || Object.fromEntries(
        readiness.ECONOMIC_CONTRACTS.map(key => [config.contracts[key], true])
    );
    const provider = {
        getBlock: jest.fn(async () => ({ timestamp: 1_000 })),
        destroy: jest.fn()
    };
    const deployment = {
        configuration: jest.fn(() => overrides.config || config),
        validate: jest.fn(async (_provider, selected) => selected)
    };
    const pool = {
        query: jest.fn(async () => ({
            rowCount: 1,
            rows: [{ status: 'ready', error_code: null, fresh: overrides.indexerFresh ?? true }]
        }))
    };
    return {
        pool,
        env: {
            IS_DEMO_ENV: 'true',
            WINTON_V5_ECONOMIC_WRITES_ENABLED: 'true',
            WINTON_V5_WRITE_FINGERPRINT: config.fingerprint,
            ...overrides.env
        },
        deployment,
        providerFactory: jest.fn(() => provider),
        contractFactory: jest.fn(address => ({ paused: jest.fn(async () => pauses[address]) })),
        nowSeconds: () => 1_100,
        provider
    };
}

describe('preflight de salida de Prelanzamiento', () => {
    test('aprueba únicamente Demo V5 armada, fresca, indexada y completamente pausada', async () => {
        const f = fixture();
        await expect(readiness.evaluate(f)).resolves.toMatchObject({
            ready: true,
            deployment: { chainId: '11155420', epoch: 'V5_CODEX_163', fingerprint: '0xfeed' }
        });
        expect(f.deployment.validate).toHaveBeenCalledWith(f.provider, config);
        expect(f.contractFactory).toHaveBeenCalledTimes(4);
        expect(f.pool.query).toHaveBeenCalledWith(expect.stringContaining('web3_exchange_sync'),
            ['11155420', config.contracts.FifoExchange.toLowerCase(), 120]);
        expect(f.provider.destroy).toHaveBeenCalledTimes(1);
    });

    test('fuera de Demo falla antes de abrir una conexión blockchain', async () => {
        const f = fixture({ env: { IS_DEMO_ENV: 'false' } });
        const result = await readiness.evaluate(f);
        expect(result).toMatchObject({ ready: false });
        expect(result.checks).toContainEqual(expect.objectContaining({ id: 'demo_environment', ready: false }));
        expect(f.deployment.configuration).not.toHaveBeenCalled();
        expect(f.providerFactory).not.toHaveBeenCalled();
        expect(f.pool.query).not.toHaveBeenCalled();
    });

    test('bloquea si el fingerprint no arma las escrituras de la suite seleccionada', async () => {
        const f = fixture({ env: { WINTON_V5_WRITE_FINGERPRINT: '0xwrong' } });
        const result = await readiness.evaluate(f);
        expect(result.ready).toBe(false);
        expect(result.checks).toContainEqual(expect.objectContaining({
            id: 'write_configuration', ready: false, detail: 'V5_WRITE_FINGERPRINT_MISMATCH'
        }));
    });

    test('bloquea si cualquiera de los cuatro contratos no sigue pausado', async () => {
        const pauses = Object.fromEntries(readiness.ECONOMIC_CONTRACTS.map(key => [config.contracts[key], true]));
        pauses[config.contracts.FifoExchange] = false;
        const result = await readiness.evaluate(fixture({ pauses }));
        expect(result.ready).toBe(false);
        expect(result.checks).toContainEqual(expect.objectContaining({ id: 'contracts_paused', ready: false }));
    });

    test('bloquea un RPC o indexador desactualizado', async () => {
        const f = fixture({ indexerFresh: false });
        f.provider.getBlock.mockResolvedValue({ timestamp: 100 });
        const result = await readiness.evaluate(f);
        expect(result.ready).toBe(false);
        expect(result.checks).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'rpc_fresh', ready: false }),
            expect.objectContaining({ id: 'indexer_ready', ready: false, detail: 'V5_INDEXER_STALE' })
        ]));
    });

    test('una lectura on-chain incompleta falla cerrada y nunca intenta transacciones', async () => {
        const f = fixture();
        f.deployment.validate.mockRejectedValue(new Error('rpc unavailable'));
        const result = await readiness.evaluate(f);
        expect(result.ready).toBe(false);
        expect(result.checks).toContainEqual(expect.objectContaining({ id: 'chain_readiness', ready: false }));
        expect(f.contractFactory).not.toHaveBeenCalled();
        expect(f.provider).not.toHaveProperty('sendTransaction');
    });
});
