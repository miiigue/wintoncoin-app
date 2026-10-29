'use strict';

const V5_EPOCH = 'V5_CODEX_163';
const MAX_INDEXER_AGE_SECONDS = 120;

function isContainmentAction(operation) {
    return ['pause', 'pause_protocol', 'pause_vault', 'owner:pause_protocol', 'owner:pause_vault', 'recovery_cancel']
        .includes(String(operation || ''));
}

function configOf(config, env) {
    return config || require('./chainDeployment').configuration(env);
}

function staticStatus({ env = process.env, config } = {}) {
    const selected = configOf(config, env);
    if (selected.epoch !== V5_EPOCH) {
        return { enabled: true, mode: 'normal', epoch: selected.epoch, fingerprint: selected.fingerprint };
    }
    const requested = env.WINTON_V5_ECONOMIC_WRITES_ENABLED === 'true';
    const fingerprintMatches = String(env.WINTON_V5_WRITE_FINGERPRINT || '').toLowerCase()
        === String(selected.fingerprint || '').toLowerCase();
    return {
        enabled: requested && fingerprintMatches,
        mode: requested && fingerprintMatches ? 'v5_write_requested' : 'read_only',
        epoch: selected.epoch,
        fingerprint: selected.fingerprint,
        requested,
        fingerprintMatches,
        reason: !requested ? 'V5_WRITES_NOT_ENABLED'
            : !fingerprintMatches ? 'V5_WRITE_FINGERPRINT_MISMATCH' : null
    };
}

async function operationalStatus({ pool, env = process.env, config, maxAgeSeconds = MAX_INDEXER_AGE_SECONDS } = {}) {
    const state = staticStatus({ env, config });
    if (state.epoch !== V5_EPOCH || !state.enabled) return state;
    if (!pool || typeof pool.query !== 'function') {
        return { ...state, enabled: false, mode: 'read_only', reason: 'V5_INDEXER_STATUS_UNAVAILABLE' };
    }
    try {
        const result = await pool.query(`SELECT status,error_code,
            (last_checked_at > clock_timestamp()-($3*interval '1 second')) AS fresh
            FROM web3_exchange_sync WHERE chain_id=$1 AND exchange_address=$2`,
        [state.epoch === V5_EPOCH ? String((config || configOf(null, env)).chainId) : '',
            String((config || configOf(null, env)).contracts.FifoExchange).toLowerCase(), maxAgeSeconds]);
        const row = result.rows?.[0];
        const ready = result.rowCount === 1 && row?.status === 'ready' && row?.fresh === true && !row?.error_code;
        return ready ? { ...state, mode: 'operational', indexerReady: true }
            : { ...state, enabled: false, mode: 'read_only', indexerReady: false,
                reason: row?.error_code || (row?.fresh === false ? 'V5_INDEXER_STALE' : 'V5_INDEXER_NOT_READY') };
    } catch {
        return { ...state, enabled: false, mode: 'read_only', indexerReady: false, reason: 'V5_INDEXER_STATUS_UNAVAILABLE' };
    }
}

function containedError(reason) {
    return Object.assign(new Error('Las operaciones económicas están temporalmente en mantenimiento. Puedes consultar tu estado, pero no se enviarán movimientos.'), {
        status: 503,
        code: reason || 'V5_ECONOMIC_WRITES_CONTAINED'
    });
}

function assertStatic({ env = process.env, config, operation } = {}) {
    if (isContainmentAction(operation)) return staticStatus({ env, config });
    const state = staticStatus({ env, config });
    if (!state.enabled) throw containedError(state.reason);
    return state;
}

async function assertOperational({ pool, env = process.env, config, operation } = {}) {
    if (isContainmentAction(operation)) return operationalStatus({ pool, env, config });
    const state = await operationalStatus({ pool, env, config });
    if (!state.enabled) throw containedError(state.reason);
    return state;
}

module.exports = { V5_EPOCH, MAX_INDEXER_AGE_SECONDS, staticStatus, operationalStatus,
    assertStatic, assertOperational, isContainmentAction, containedError };
