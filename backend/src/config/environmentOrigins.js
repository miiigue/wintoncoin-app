'use strict';

const { hasDemoEnvironmentMarker } = require('../services/demoEnvironmentGuard');

const DEMO_ORIGINS = Object.freeze([
    'https://demo.wintoncoin.com',
    'https://www.demo.wintoncoin.com'
]);

const BASE_ORIGINS = Object.freeze([
    'https://wintoncoin-frontend.onrender.com',
    'https://sc.wintoncoin.com',
    'https://www.sc.wintoncoin.com',
    'https://wintoncoin.com',
    'https://www.wintoncoin.com',
    ...DEMO_ORIGINS
]);

const LOCAL_ORIGINS = Object.freeze([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
]);

const ADMIN_BASE_ORIGINS = Object.freeze([
    'https://wintoncoin.com',
    'https://www.wintoncoin.com',
    'https://admin.wintoncoin.com',
    ...DEMO_ORIGINS,
    'https://sc.wintoncoin.com',
    'https://www.sc.wintoncoin.com'
]);

const ADMIN_LOCAL_ORIGINS = Object.freeze([
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
]);

function normalizeOrigin(value, { production = true } = {}) {
    if (!value || typeof value !== 'string') return null;
    try {
        const url = new URL(value);
        if (url.username || url.password) return null;
        const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if (production && local) return null;
        if (url.protocol !== 'https:' && !(local && !production && url.protocol === 'http:')) return null;
        return url.origin;
    } catch {
        return null;
    }
}

function configuredOrigins(env, keys, { production }) {
    const result = [];
    for (const key of keys) {
        const origin = normalizeOrigin(env[key], { production });
        if (!origin) continue;
        result.push(origin);
        if (origin.startsWith('https://') && !origin.includes('://www.')) {
            result.push(`https://www.${origin.slice('https://'.length)}`);
        }
    }
    return result;
}

function corsAllowedOrigins(env = process.env) {
    if (hasDemoEnvironmentMarker(env)) return [...DEMO_ORIGINS];
    const production = env.NODE_ENV === 'production';
    const origins = [
        ...BASE_ORIGINS,
        ...configuredOrigins(env, ['FRONTEND_URL'], { production })
    ];
    if (!production) origins.push(...LOCAL_ORIGINS);
    return [...new Set(origins)];
}

function isCorsOriginAllowed(origin, env = process.env) {
    if (!origin) return true;
    if (hasDemoEnvironmentMarker(env)) return DEMO_ORIGINS.includes(origin);

    if (env.NODE_ENV !== 'production') {
        const localhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        const lan = /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin);
        // Conserva el comportamiento de desarrollo anterior fuera de Demo.
        if (localhost || lan) return true;
    }

    if (corsAllowedOrigins(env).includes(origin)) return true;
    return env.NODE_ENV !== 'production';
}

function adminAllowedOrigins(env = process.env) {
    if (hasDemoEnvironmentMarker(env)) return [...DEMO_ORIGINS];
    const production = env.NODE_ENV === 'production';
    const origins = [
        ...configuredOrigins(env, ['FRONTEND_URL', 'ADMIN_FRONTEND_URL'], { production }),
        ...ADMIN_BASE_ORIGINS
    ];
    if (!production) origins.push(...ADMIN_LOCAL_ORIGINS);
    return [...new Set(origins)];
}

function isTrustedAdminOrigin(value, env = process.env) {
    const production = env.NODE_ENV === 'production' || hasDemoEnvironmentMarker(env);
    const origin = normalizeOrigin(value, { production });
    if (!origin) return false;
    return adminAllowedOrigins(env).some(allowed =>
        normalizeOrigin(allowed, { production }) === origin
    );
}

module.exports = {
    DEMO_ORIGINS,
    corsAllowedOrigins,
    isCorsOriginAllowed,
    adminAllowedOrigins,
    isTrustedAdminOrigin,
    normalizeOrigin
};
