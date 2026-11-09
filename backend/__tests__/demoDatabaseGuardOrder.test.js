'use strict';

describe('orden de la compuerta de base Demo', () => {
    const saved = {};
    const keys = ['NODE_ENV', 'IS_DEMO_ENV', 'WINTON_ENVIRONMENT_ID', 'DATABASE_URL', 'WINTON_DEMO_DATABASE_FINGERPRINT'];

    beforeEach(() => {
        jest.resetModules();
        for (const key of keys) saved[key] = process.env[key];
        process.env.NODE_ENV = 'test';
        process.env.IS_DEMO_ENV = 'true';
        process.env.WINTON_ENVIRONMENT_ID = 'demo';
        process.env.DATABASE_URL = 'postgres://user:secret@unexpected.internal/wintoncoin_demo';
        process.env.WINTON_DEMO_DATABASE_FINGERPRINT = '0'.repeat(64);
    });

    afterEach(() => {
        jest.resetModules();
        for (const key of keys) {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        }
    });

    test('una identidad inválida detiene la carga antes de construir Pool', () => {
        const Pool = jest.fn();
        jest.doMock('pg', () => ({ Pool }));

        expect(() => require('../src/config/db')).toThrow('no pertenece al entorno Demo');
        expect(Pool).not.toHaveBeenCalled();
    });
});
