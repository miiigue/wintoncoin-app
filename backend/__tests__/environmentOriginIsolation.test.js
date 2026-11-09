'use strict';

const {
    DEMO_ORIGINS,
    corsAllowedOrigins,
    isCorsOriginAllowed,
    adminAllowedOrigins,
    isTrustedAdminOrigin
} = require('../src/config/environmentOrigins');

describe('aislamiento de orígenes por ambiente', () => {
    const demo = {
        IS_DEMO_ENV: 'true',
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://wintoncoin.com',
        ADMIN_FRONTEND_URL: 'https://admin.wintoncoin.com'
    };

    test('Demo ignora orígenes configurados de otros ambientes', () => {
        expect(corsAllowedOrigins(demo)).toEqual(DEMO_ORIGINS);
        expect(adminAllowedOrigins(demo)).toEqual(DEMO_ORIGINS);
    });

    test.each([
        'https://wintoncoin.com',
        'https://www.wintoncoin.com',
        'https://admin.wintoncoin.com',
        'https://sc.wintoncoin.com',
        'http://localhost:3000',
        'http://192.168.1.10:5173'
    ])('Demo rechaza el origen cruzado %s', origin => {
        expect(isCorsOriginAllowed(origin, demo)).toBe(false);
        expect(isTrustedAdminOrigin(origin, demo)).toBe(false);
    });

    test.each(DEMO_ORIGINS)('Demo admite su origen explícito %s', origin => {
        expect(isCorsOriginAllowed(origin, demo)).toBe(true);
        expect(isTrustedAdminOrigin(origin, demo)).toBe(true);
    });

    test('un referer Demo se normaliza sin confiar en su ruta', () => {
        expect(isTrustedAdminOrigin('https://demo.wintoncoin.com/admin/web3?x=1', demo)).toBe(true);
    });

    test('fuera de Demo conserva los orígenes operativos previos', () => {
        const existing = { NODE_ENV: 'production', FRONTEND_URL: 'https://frontend.example.test' };
        expect(isCorsOriginAllowed('https://wintoncoin.com', existing)).toBe(true);
        expect(isCorsOriginAllowed('https://demo.wintoncoin.com', existing)).toBe(true);
        expect(isCorsOriginAllowed('https://frontend.example.test', existing)).toBe(true);
        expect(isTrustedAdminOrigin('https://admin.wintoncoin.com', existing)).toBe(true);
    });
});
