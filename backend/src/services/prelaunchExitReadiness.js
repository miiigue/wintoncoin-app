'use strict';

const { Contract } = require('ethers');
const chainDeployment = require('./chainDeployment');
const economicWriteGate = require('./economicWriteGate');

const DEMO_CHAIN_ID = '11155420';
const DEMO_EPOCH = economicWriteGate.V5_EPOCH;
const MAX_RPC_AGE_SECONDS = 300;
const ECONOMIC_CONTRACTS = ['CoreProtocol', 'CollateralVault', 'FifoExchange', 'ProtocolTreasury'];
const PAUSE_ABI = ['function paused() view returns (bool)'];

function publicCheck(id, label, ready, detail) {
    return { id, label, ready: ready === true, ...(detail ? { detail } : {}) };
}

/**
 * Preflight de solo lectura para salir de Prelanzamiento en Demo.
 *
 * La salida se hace en dos fases deliberadas: este preflight exige que la
 * configuración de escrituras ya esté armada y que los cuatro contratos aún
 * estén pausados. Después de desactivar Prelanzamiento, la billetera propietaria
 * puede reanudar cada contrato mediante el flujo administrativo independiente.
 * Esta función nunca firma ni envía transacciones.
 */
async function evaluate({
    pool,
    env = process.env,
    deployment = chainDeployment,
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
        const correctSuite = String(config.chainId) === DEMO_CHAIN_ID && config.epoch === DEMO_EPOCH;
        checks.push(publicCheck('demo_deployment', 'Suite Demo V5 seleccionada', correctSuite,
            correctSuite ? undefined : 'La red o época no corresponde a Demo V5.'));
        if (!correctSuite) return { ready: false, checkedAt: new Date().toISOString(), checks };
    } catch {
        checks.push(publicCheck('demo_deployment', 'Suite Demo V5 seleccionada', false,
            'La configuración del despliegue no pudo validarse.'));
        return { ready: false, checkedAt: new Date().toISOString(), checks };
    }

    const staticGate = economicWriteGate.staticStatus({ env, config });
    checks.push(publicCheck('write_configuration', 'Escrituras V5 armadas para este fingerprint',
        staticGate.enabled === true, staticGate.enabled ? undefined : staticGate.reason));

    try {
        provider = providerFactory();
        await deployment.validate(provider, config);
        checks.push(publicCheck('deployment_integrity', 'Bytecode, enlaces y decimales verificados', true));

        const latest = await provider.getBlock('latest');
        const age = nowSeconds() - Number(latest?.timestamp);
        const fresh = Number.isFinite(age) && age >= -60 && age <= maxRpcAgeSeconds;
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
    } catch {
        checks.push(publicCheck('chain_readiness', 'Lectura íntegra de la suite Demo', false,
            'No fue posible verificar la suite y sus pausas.'));
    } finally {
        if (provider && typeof provider.destroy === 'function') provider.destroy();
    }

    try {
        if (!pool || typeof pool.query !== 'function') throw new Error('pool unavailable');
        const result = await pool.query(`SELECT status,error_code,
            (last_checked_at > clock_timestamp()-($3*interval '1 second')) AS fresh
            FROM web3_exchange_sync WHERE chain_id=$1 AND exchange_address=$2`, [
            String(config.chainId), String(config.contracts.FifoExchange).toLowerCase(), maxIndexerAgeSeconds
        ]);
        const row = result.rows?.[0];
        const indexerReady = result.rowCount === 1 && row?.status === 'ready' && row?.fresh === true && !row?.error_code;
        checks.push(publicCheck('indexer_ready', 'Indexador FIFO V5 listo y actualizado', indexerReady,
            indexerReady ? undefined : (row?.error_code || (row?.fresh === false ? 'V5_INDEXER_STALE' : 'V5_INDEXER_NOT_READY'))));
    } catch {
        checks.push(publicCheck('indexer_ready', 'Indexador FIFO V5 listo y actualizado', false,
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
