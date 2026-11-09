'use strict';

const guard = require('../src/services/demoEnvironmentGuard');

const databaseUrl = 'postgres://user:secret@demo-db.internal:5432/wintoncoin_demo?sslmode=require';
const rpcUrl = 'https://demo-rpc.example/v1/private-key?network=optimism-sepolia';
const deploymentFingerprint = `0x${'a'.repeat(64)}`;

function demoEnv(extra = {}) {
    return {
        IS_DEMO_ENV: 'true',
        WINTON_ENVIRONMENT_ID: 'demo',
        DATABASE_URL: databaseUrl,
        WINTON_DEMO_DATABASE_FINGERPRINT: guard.databaseFingerprint(databaseUrl),
        WINTON_DEMO_DEPLOYMENT_FINGERPRINT: deploymentFingerprint,
        WINTON_DEMO_RPC_FINGERPRINTS: JSON.stringify([guard.rpcFingerprint(rpcUrl)]),
        ...extra
    };
}

describe('compuerta fail-closed del entorno Demo', () => {
    test('acepta únicamente la base exacta autorizada sin incluir credenciales en la huella', () => {
        const env = demoEnv();
        expect(guard.assertDemoDatabase(env)).toBe(true);
        expect(guard.databaseFingerprint(databaseUrl))
            .toBe(guard.databaseFingerprint(databaseUrl.replace('user:secret', 'other:credentials')));
        expect(() => guard.assertDemoDatabase({ ...env, DATABASE_URL: 'postgres://x:y@other.internal/wintoncoin_demo' }))
            .toThrow('no pertenece al entorno Demo');
    });

    test('rechaza Demo si faltan los marcadores explícitos', () => {
        const env = demoEnv({ WINTON_ENVIRONMENT_ID: '' });
        expect(() => guard.assertDemoDatabase(env)).toThrow('identidad de entorno explícita');
    });

    test.each([
        [{ IS_DEMO_ENV: 'true', WINTON_ENVIRONMENT_ID: '' }, true],
        [{ IS_DEMO_ENV: 'false', WINTON_ENVIRONMENT_ID: 'demo' }, true],
        [{ IS_DEMO_ENV: 'false', WINTON_ENVIRONMENT_ID: 'production' }, false]
    ])('activa la compuerta si cualquiera de los marcadores declara Demo', (env, expected) => {
        expect(guard.hasDemoEnvironmentMarker(env)).toBe(expected);
    });

    test('exige red, época y fingerprint exactos antes de crear un proveedor', () => {
        const env = demoEnv();
        const config = { chainId: guard.DEMO_CHAIN_ID, epoch: guard.DEMO_EPOCH, fingerprint: deploymentFingerprint };
        expect(guard.assertDemoDeployment(env, config)).toBe(true);
        expect(() => guard.assertDemoDeployment(env, { ...config, chainId: '10' })).toThrow('Demo V5');
        expect(() => guard.assertDemoDeployment(env, { ...config, fingerprint: `0x${'b'.repeat(64)}` }))
            .toThrow('manifiesto configurado');
    });

    test('rechaza un RPC no autorizado antes de cualquier transporte', () => {
        const env = demoEnv();
        expect(guard.assertDemoRpcEndpoints(env, [rpcUrl])).toBe(true);
        expect(() => guard.assertDemoRpcEndpoints(env, [rpcUrl.replace('optimism-sepolia', 'mainnet')]))
            .toThrow('no pertenece al entorno Demo');
        expect(() => guard.assertDemoRpcEndpoints(env, ['https://other-rpc.example']))
            .toThrow('no pertenece al entorno Demo');
    });
});
