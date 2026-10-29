'use strict';

const gate = require('../src/services/economicWriteGate');
const { configFromEnv } = require('../src/services/exchangeChainReader');
const preflight = require('../scripts/check_v5_operational_readiness');
const manifest = require('../../web3-contracts/deployment-manifest-v4.json');

const v5 = {
    chainId: '11155420',
    epoch: 'V5_CODEX_163',
    fingerprint: '0xabc123',
    contracts: manifest.contracts,
    startBlocks: manifest.startBlocks
};

describe('contención operativa V5', () => {
    test('V5 queda en solo lectura por defecto', () => {
        const state = gate.staticStatus({ env: {}, config: v5 });
        expect(state).toMatchObject({ enabled: false, mode: 'read_only', reason: 'V5_WRITES_NOT_ENABLED' });
        expect(() => gate.assertStatic({ env: {}, config: v5, operation: 'payment' }))
            .toThrow(/mantenimiento/i);
    });

    test('una bandera sin fingerprint exacto no habilita escrituras', () => {
        const state = gate.staticStatus({ env: {
            WINTON_V5_ECONOMIC_WRITES_ENABLED: 'true', WINTON_V5_WRITE_FINGERPRINT: '0xwrong'
        }, config: v5 });
        expect(state).toMatchObject({ enabled: false, fingerprintMatches: false, reason: 'V5_WRITE_FINGERPRINT_MISMATCH' });
    });

    test('aun con configuración explícita exige indexador fresco y listo', async () => {
        const env = { WINTON_V5_ECONOMIC_WRITES_ENABLED: 'true', WINTON_V5_WRITE_FINGERPRINT: v5.fingerprint };
        const poolWith = indexerRow => ({ query: jest.fn(async sql => String(sql).includes('app_settings')
            ? { rowCount: 1, rows: [{ setting_value: 'false' }] }
            : { rowCount: 1, rows: [indexerRow] }) });
        const stalePool = poolWith({ status: 'ready', fresh: false, error_code: null });
        await expect(gate.operationalStatus({ pool: stalePool, env, config: v5 }))
            .resolves.toMatchObject({ enabled: false, reason: 'V5_INDEXER_STALE' });

        const readyPool = poolWith({ status: 'ready', fresh: true, error_code: null });
        await expect(gate.assertOperational({ pool: readyPool, env, config: v5, operation: 'payment' }))
            .resolves.toMatchObject({ enabled: true, mode: 'operational', indexerReady: true,
                preLaunchVerified: true, preLaunchActive: false });
        expect(readyPool.query).toHaveBeenNthCalledWith(2, expect.stringContaining('web3_exchange_sync'),
            [v5.chainId, v5.contracts.FifoExchange.toLowerCase(), 120]);
    });

    test('prelanzamiento activo bloquea universalmente incluso con V5 e indexador listos', async () => {
        const env = { WINTON_V5_ECONOMIC_WRITES_ENABLED: 'true', WINTON_V5_WRITE_FINGERPRINT: v5.fingerprint };
        const pool = { query: jest.fn(async () => ({ rowCount: 1, rows: [{ setting_value: 'true' }] })) };
        await expect(gate.assertOperational({ pool, env, config: v5, operation: 'payment' }))
            .rejects.toMatchObject({ status: 503, code: 'PRELAUNCH_ACTIVE' });
        expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('estado de prelanzamiento ausente, inválido o inaccesible falla cerrado', async () => {
        const missing = { query: jest.fn(async () => ({ rowCount: 0, rows: [] })) };
        await expect(gate.assertOperational({ pool: missing, env: {}, config: v5, operation: 'payment' }))
            .rejects.toMatchObject({ code: 'PRELAUNCH_STATUS_INVALID' });
        const failed = { query: jest.fn(async () => { throw new Error('db'); }) };
        await expect(gate.assertOperational({ pool: failed, env: {}, config: v5, operation: 'payment' }))
            .rejects.toMatchObject({ code: 'PRELAUNCH_STATUS_UNAVAILABLE' });
    });

    test('pausar sigue permitido durante contención; reanudar no', async () => {
        const pool = { query: jest.fn(async () => ({ rowCount: 1, rows: [{ setting_value: 'true' }] })) };
        await expect(gate.assertOperational({ pool, env: {}, config: v5, operation: 'pause_protocol' }))
            .resolves.toMatchObject({ enabled: false, mode: 'prelaunch_read_only', reason: 'PRELAUNCH_ACTIVE' });
        await expect(gate.assertOperational({ pool, env: {}, config: v5, operation: 'unpause_protocol' }))
            .rejects.toMatchObject({ status: 503, code: 'PRELAUNCH_ACTIVE' });
    });

    test('V4 y redes no V5 conservan su comportamiento', async () => {
        const config = { ...v5, epoch: 'V4_ACTIVE' };
        const pool = { query: jest.fn(async () => ({ rowCount: 1, rows: [{ setting_value: 'false' }] })) };
        await expect(gate.assertOperational({ pool, env: {}, config, operation: 'payment' }))
            .resolves.toMatchObject({ enabled: true, mode: 'normal', preLaunchVerified: true });
    });

    test('el indexador Demo deriva Exchange y bloque de la época sin overrides heredados', () => {
        const config = configFromEnv({
            NODE_ENV: 'production', WINTON_DEPLOYMENT_EPOCH: 'V5_CODEX_163',
            OPTIMISM_RPC_URL: 'https://sepolia.optimism.io'
        });
        expect(config).toMatchObject({
            chainId: '11155420', epoch: 'V5_CODEX_163', exchange: manifest.contracts.FifoExchange.toLowerCase(),
            startBlock: manifest.startBlocks.FifoExchange, supportsExchangeCollateral: true
        });
    });

    test('el preflight exige declarar el estado esperado', () => {
        expect(preflight.expectedMode(['--expect-contained'])).toBe('contained');
        expect(preflight.expectedMode(['--expect-operational'])).toBe('operational');
        expect(() => preflight.expectedMode([])).toThrow(/expect-contained/);
    });
});
