'use strict';

const { Contract } = require('ethers');
const marketplaceDeployment = require('./marketplaceDeployment');
const { isV6Epoch } = marketplaceDeployment;
const economicWriteGate = require('./economicWriteGate');

const DEMO_CHAIN_ID = '11155420';
const DEMO_EPOCH = economicWriteGate.V5_EPOCH;
const MAX_RPC_AGE_SECONDS = 300;
const ECONOMIC_CONTRACTS = ['CoreProtocol', 'CollateralVault', 'FifoExchange', 'ProtocolTreasury'];
const PAUSE_ABI = ['function paused() view returns (bool)'];
const MODE_ABI = ['function mode() view returns (uint8)'];

function publicCheck(id, label, ready, detail) {
    return { id, label, ready: ready === true, ...(detail ? { detail } : {}) };
}

function isRpcBlockFresh(latest, nowSeconds, maxRpcAgeSeconds) {
    const age = nowSeconds() - Number(latest?.timestamp);
    return Number.isFinite(age) && age >= -60 && age <= maxRpcAgeSeconds;
}

/**
 * Verificación de solo lectura de la suite V6 en blockchain:
 * exige integridad de manifiesto/enlaces/paridad, bloque reciente y
 * que ProtocolModeController ya haya sido activado a modo NORMAL (0).
 */
async function evaluateV6Chain({ provider, activeDeployment, config, contractFactory, nowSeconds, maxRpcAgeSeconds, checks }) {
    await activeDeployment.validate(provider, config);
    checks.push(publicCheck('deployment_integrity', 'Bytecode, enlaces, roles y paridad BLUE == RED verificados', true));

    const latest = await provider.getBlock('latest');
    const fresh = isRpcBlockFresh(latest, nowSeconds, maxRpcAgeSeconds);
    checks.push(publicCheck('rpc_fresh', 'RPC de Demo actualizado', fresh,
        fresh ? undefined : 'El bloque más reciente no es verificablemente actual.'));

    const mode = await contractFactory(config.contracts.ProtocolModeController, MODE_ABI, provider).mode();
    const modeNormal = Number(mode) === 0;
    checks.push(publicCheck('protocol_mode_normal', 'ProtocolModeController confirmado en modo NORMAL', modeNormal,
        modeNormal ? undefined : 'ProtocolModeController debe estar en modo NORMAL (0) antes de desactivar Prelanzamiento.'));
}

/**
 * Verificación de solo lectura para suites legadas V5:
 * conserva la exigencia de los cuatro contratos pausados en el preflight histórico.
 */
async function evaluateV5Chain({ provider, activeDeployment, config, contractFactory, nowSeconds, maxRpcAgeSeconds, checks }) {
    await activeDeployment.validate(provider, config);
    checks.push(publicCheck('deployment_integrity', 'Bytecode, enlaces y decimales verificados', true));

    const latest = await provider.getBlock('latest');
    const fresh = isRpcBlockFresh(latest, nowSeconds, maxRpcAgeSeconds);
    checks.push(publicCheck('rpc_fresh', 'RPC de Demo actualizado', fresh,
        fresh ? undefined : 'El bloque más reciente no es verificablemente actual.'));

    const pauseEntries = await Promise.all(ECONOMIC_CONTRACTS.map(async (key) => {
        const paused = await contractFactory(config.contracts[key], PAUSE_ABI, provider).paused();
        return [key, paused === true];
    }));
    const contractPauses = Object.fromEntries(pauseEntries);
    const allPaused = ECONOMIC_CONTRACTS.every(key => contractPauses[key] === true);
    checks.push(publicCheck('contracts_paused', 'Los cuatro contratos económicos permanecen pausados', allPaused,
        allPaused ? undefined : 'La salida segura exige Core, Bóveda, Exchange y Tesorería pausados.'));
}

/**
 * Verificación del indexador FIFO en PostgreSQL (V6 o V5 según arquitectura).
 */
async function checkIndexerState({ pool, config, isV6, maxIndexerAgeSeconds }) {
    if (isV6) {
        const result = await pool.query(`SELECT status, cursor_hash,
            (updated_at > clock_timestamp()-($3*interval '1 second')) AS fresh
            FROM web3_exchange_v6_sync WHERE chain_id=$1 AND router_address=$2`, [
            String(config.chainId), String(config.contracts.ExchangeRouter).toLowerCase(), maxIndexerAgeSeconds
        ]);
        const row = result.rows?.[0];
        const indexerReady = result.rowCount === 1 && row?.status === 'ready' && Boolean(row?.cursor_hash) && row?.fresh === true;
        return publicCheck('indexer_ready', 'Indexador FIFO V6 listo y actualizado', indexerReady,
            indexerReady ? undefined : (row?.fresh === false ? 'V6_INDEXER_STALE' : 'V6_INDEXER_NOT_READY'));
    }

    const result = await pool.query(`SELECT status,error_code,
        (last_checked_at > clock_timestamp()-($3*interval '1 second')) AS fresh
        FROM web3_exchange_sync WHERE chain_id=$1 AND exchange_address=$2`, [
        String(config.chainId), String(config.contracts.FifoExchange).toLowerCase(), maxIndexerAgeSeconds
    ]);
    const row = result.rows?.[0];
    const indexerReady = result.rowCount === 1 && row?.status === 'ready' && row?.fresh === true && !row?.error_code;
    return publicCheck('indexer_ready', 'Indexador FIFO V5 listo y actualizado', indexerReady,
        indexerReady ? undefined : (row?.error_code || (row?.fresh === false ? 'V5_INDEXER_STALE' : 'V5_INDEXER_NOT_READY')));
}

/**
 * Preflight de solo lectura para salir de Prelanzamiento en Demo.
 *
 * En arquitectura V6 exige despliegue verificado por huella SHA-256, paridad
 * 1:1 BLUE == RED, ProtocolModeController en modo NORMAL (0) e indexador V6
 * actualizado (`web3_exchange_v6_sync`). Para suites V5 conserva el interlock
 * histórico. Esta función nunca firma ni envía transacciones.
 */
async function evaluate({
    pool,
    env = process.env,
    deployment = marketplaceDeployment,
    providerFactory = () => deployment.provider(),
    contractFactory = (address, abi, provider) => new Contract(address, abi, provider),
    nowSeconds = () => Math.floor(Date.now() / 1000),
    maxRpcAgeSeconds = MAX_RPC_AGE_SECONDS,
    maxIndexerAgeSeconds = economicWriteGate.MAX_INDEXER_AGE_SECONDS
} = {}) {
    const checks = [];
    let config;
    let provider;

    const explicitDemo = env.IS_DEMO_ENV === 'true';
    checks.push(publicCheck('demo_environment', 'Entorno declarado explícitamente como Demo', explicitDemo));
    if (!explicitDemo) {
        return { ready: false, checkedAt: new Date().toISOString(), checks };
    }

    try {
        config = deployment.configuration(env);
    } catch {
        checks.push(publicCheck('demo_deployment', 'Suite Demo seleccionada', false,
            'La configuración del despliegue no pudo validarse.'));
        return { ready: false, checkedAt: new Date().toISOString(), checks };
    }

    const isV6 = isV6Epoch(config?.epoch);
    const correctSuite = String(config.chainId) === DEMO_CHAIN_ID && (isV6 || config.epoch === DEMO_EPOCH);
    checks.push(publicCheck(
        'demo_deployment',
        isV6 ? 'Suite V6 seleccionada y verificada' : 'Suite Demo V5 seleccionada',
        correctSuite,
        correctSuite ? undefined : 'La red o época no corresponde a Demo habilitada.'
    ));
    if (!correctSuite) return { ready: false, checkedAt: new Date().toISOString(), checks };

    if (isV6) {
        const pinned = /^0x[0-9a-f]{64}$/i.test(String(config.fingerprint || ''));
        checks.push(publicCheck('write_configuration', 'Manifiesto V6 fijado por huella criptográfica SHA-256',
            pinned, pinned ? undefined : 'V6_FINGERPRINT_INVALID'));
    } else {
        const staticGate = economicWriteGate.staticStatus({ env, config });
        checks.push(publicCheck('write_configuration', 'Escrituras V5 armadas para este fingerprint',
            staticGate.enabled === true, staticGate.enabled ? undefined : staticGate.reason));
    }

    try {
        provider = providerFactory();
        if (isV6) {
            await evaluateV6Chain({ provider, activeDeployment: deployment, config, contractFactory, nowSeconds, maxRpcAgeSeconds, checks });
        } else {
            await evaluateV5Chain({ provider, activeDeployment: deployment, config, contractFactory, nowSeconds, maxRpcAgeSeconds, checks });
        }
    } catch {
        checks.push(publicCheck('chain_readiness', 'Lectura íntegra de la suite Demo', false,
            isV6 ? 'No fue posible verificar la suite V6 y el controlador de modo.' : 'No fue posible verificar la suite y sus pausas.'));
    } finally {
        if (provider && typeof provider.destroy === 'function') provider.destroy();
    }

    try {
        if (!pool || typeof pool.query !== 'function') throw new Error('pool unavailable');
        checks.push(await checkIndexerState({ pool, config, isV6, maxIndexerAgeSeconds }));
    } catch {
        checks.push(publicCheck('indexer_ready', isV6 ? 'Indexador FIFO V6 listo y actualizado' : 'Indexador FIFO V5 listo y actualizado', false,
            'No fue posible verificar el estado del indexador.'));
    }

    return {
        ready: checks.length > 0 && checks.every(check => check.ready),
        checkedAt: new Date().toISOString(),
        deployment: { chainId: config.chainId, epoch: config.epoch, fingerprint: config.fingerprint },
        checks
    };
}

module.exports = { evaluate, DEMO_CHAIN_ID, DEMO_EPOCH, ECONOMIC_CONTRACTS, MAX_RPC_AGE_SECONDS };
