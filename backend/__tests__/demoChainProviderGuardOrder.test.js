'use strict';

describe('orden de la compuerta RPC Demo', () => {
    const keys = [
        'NODE_ENV', 'IS_DEMO_ENV', 'WINTON_ENVIRONMENT_ID', 'WINTON_CHAIN_ID',
        'WINTON_DEPLOYMENT_EPOCH', 'WINTON_DEMO_DEPLOYMENT_FINGERPRINT',
        'WINTON_DEMO_RPC_FINGERPRINTS'
    ];
    const saved = {};

    beforeEach(() => {
        jest.resetModules();
        for (const key of keys) saved[key] = process.env[key];
    });

    afterEach(() => {
        jest.resetModules();
        jest.dontMock('../src/services/chainRpcProvider');
        for (const key of keys) {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        }
    });

    test('un endpoint no autorizado se rechaza antes de construir el proveedor', () => {
        const baseline = require('../src/services/chainDeployment').configuration({
            WINTON_CHAIN_ID: '11155420',
            WINTON_DEPLOYMENT_EPOCH: 'V5_CODEX_163'
        });
        const ChainRpcProvider = jest.fn();
        jest.resetModules();
        jest.doMock('../src/services/chainRpcProvider', () => ({
            ChainRpcProvider,
            endpoints: jest.fn(() => ['https://unexpected-rpc.example'])
        }));

        Object.assign(process.env, {
            NODE_ENV: 'production',
            IS_DEMO_ENV: 'true',
            WINTON_ENVIRONMENT_ID: 'demo',
            WINTON_CHAIN_ID: '11155420',
            WINTON_DEPLOYMENT_EPOCH: 'V5_CODEX_163',
            WINTON_DEMO_DEPLOYMENT_FINGERPRINT: baseline.fingerprint,
            WINTON_DEMO_RPC_FINGERPRINTS: JSON.stringify(['0'.repeat(64)])
        });

        const deployment = require('../src/services/chainDeployment');
        expect(() => deployment.provider()).toThrow('no pertenece al entorno Demo');
        expect(ChainRpcProvider).not.toHaveBeenCalled();
    });
});
