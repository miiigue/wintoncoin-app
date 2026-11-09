'use strict';

jest.mock('../src/config/db', () => ({ connect: jest.fn(), query: jest.fn() }));

const { defaultPrelaunchValue } = require('../src/config/databaseInit');
const demoReset = require('../config/demo-reset-163.json');

describe('valor inicial de Prelanzamiento', () => {
    test('una instancia declarada explícitamente Demo nace bloqueada', () => {
        expect(defaultPrelaunchValue({ IS_DEMO_ENV: 'true' })).toBe('true');
    });

    test('no aplica el cambio de Demo a otros ambientes ni por inferencias ambiguas', () => {
        expect(defaultPrelaunchValue({ IS_DEMO_ENV: 'false' })).toBe('false');
        expect(defaultPrelaunchValue({ NODE_ENV: 'production', DATABASE_URL: 'postgres://example/wintoncoin_demo' }))
            .toBe('false');
        expect(defaultPrelaunchValue({})).toBe('false');
    });

    test('el paquete de reinicio CODEX-163 también conserva Demo en Prelanzamiento', () => {
        expect(demoReset.chainId).toBe('11155420');
        expect(demoReset.settings.pre_launch_mode_enabled).toBe('true');
    });
});
