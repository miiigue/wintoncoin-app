'use strict';

const { createHash } = require('crypto');

const DEMO_CHAIN_ID = '11155420';
const DEMO_EPOCH = 'V5_CODEX_163';

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

function normalizeDatabaseIdentity(rawUrl) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error('La identidad de base de datos Demo no es válida.');
    }
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !parsed.pathname || parsed.pathname === '/') {
        throw new Error('La identidad de base de datos Demo no es válida.');
    }
    const port = parsed.port || '5432';
    return `${parsed.hostname.toLowerCase()}:${port}${parsed.pathname}`;
}

function databaseFingerprint(rawUrl) {
    return sha256(normalizeDatabaseIdentity(rawUrl));
}

function normalizeRpcIdentity(rawUrl) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error('La identidad RPC Demo no es válida.');
    }
    if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname) {
        throw new Error('La identidad RPC Demo no es válida.');
    }
    const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    // La consulta puede seleccionar la red en algunos proveedores. Se incluye
    // dentro de la huella (nunca se registra en texto) para evitar que un mismo
    // host autorizado cambie silenciosamente a otro endpoint o red.
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}:${port}${parsed.pathname}${parsed.search}`;
}

function rpcFingerprint(rawUrl) {
    return sha256(normalizeRpcIdentity(rawUrl));
}

function parseFingerprintList(raw) {
    let parsed;
    try {
        parsed = JSON.parse(raw || '');
    } catch {
        throw new Error('La lista de identidades RPC Demo no es válida.');
    }
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some(item => !/^[a-f0-9]{64}$/i.test(String(item)))) {
        throw new Error('La lista de identidades RPC Demo no es válida.');
    }
    return new Set(parsed.map(item => String(item).toLowerCase()));
}

function hasDemoEnvironmentMarker(env = process.env) {
    return env.IS_DEMO_ENV === 'true' || env.WINTON_ENVIRONMENT_ID === 'demo';
}

function assertDemoMarker(env = process.env) {
    if (env.IS_DEMO_ENV !== 'true' || env.WINTON_ENVIRONMENT_ID !== 'demo') {
        throw new Error('El servicio Demo no tiene una identidad de entorno explícita.');
    }
}

function assertDemoDatabase(env = process.env) {
    assertDemoMarker(env);
    const expected = String(env.WINTON_DEMO_DATABASE_FINGERPRINT || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expected)) {
        throw new Error('La identidad esperada de la base Demo no está configurada.');
    }
    if (databaseFingerprint(env.DATABASE_URL || '') !== expected) {
        throw new Error('La base configurada no pertenece al entorno Demo autorizado.');
    }
    return true;
}

function assertDemoDeployment(env, config) {
    assertDemoMarker(env);
    if (String(config?.chainId) !== DEMO_CHAIN_ID || config?.epoch !== DEMO_EPOCH) {
        throw new Error('El despliegue configurado no pertenece a Demo V5.');
    }
    const expected = String(env.WINTON_DEMO_DEPLOYMENT_FINGERPRINT || '').toLowerCase();
    if (!/^0x[a-f0-9]{64}$/.test(expected) || String(config.fingerprint || '').toLowerCase() !== expected) {
        throw new Error('El manifiesto configurado no coincide con la identidad Demo autorizada.');
    }
    return true;
}

function assertDemoRpcEndpoints(env, urls) {
    assertDemoMarker(env);
    const allowed = parseFingerprintList(env.WINTON_DEMO_RPC_FINGERPRINTS);
    if (!Array.isArray(urls) || urls.length === 0 || urls.some(url => !allowed.has(rpcFingerprint(url)))) {
        throw new Error('Una conexión RPC no pertenece al entorno Demo autorizado.');
    }
    return true;
}

module.exports = {
    DEMO_CHAIN_ID,
    DEMO_EPOCH,
    databaseFingerprint,
    rpcFingerprint,
    hasDemoEnvironmentMarker,
    assertDemoDatabase,
    assertDemoDeployment,
    assertDemoRpcEndpoints
};
