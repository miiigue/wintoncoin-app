'use strict';

const { isV6Epoch } = require('./marketplaceDeployment');

const V5_EPOCH = 'V5_CODEX_163';
const MAX_INDEXER_AGE_SECONDS = 120;
const PRELAUNCH_SETTING = 'pre_launch_mode_enabled';

function isContainmentAction(operation) {
    // Las acciones de contención y control de modo de emergencia V6 (ProtocolModeController.setMode)
    // deben permanecer siempre accesibles para el propietario incluso si Prelanzamiento está activo
    // o el indexador presenta latencia, garantizando respuesta inmediata ante incidentes (SOC 2).
    return [
        'pause', 'pause_protocol', 'pause_vault', 'pause_exchange', 'pause_treasury',
        'owner:pause_protocol', 'owner:pause_vault', 'owner:pause_exchange', 'owner:pause_treasury',
        'v6_mode_emergency_exit', 'v6_mode_freeze_all', 'v6_mode_normal',
        'owner:v6_mode_emergency_exit', 'owner:v6_mode_freeze_all', 'owner:v6_mode_normal',
        'recovery_cancel'
    ].includes(String(operation || ''));
}

function configOf(config, env) {
    return config || require('./marketplaceDeployment').configuration(env);
}

function staticStatus({ env = process.env, config } = {}) {
    const selected = configOf(config, env);
    if (isV6Epoch(selected.epoch)) {
        return { enabled:false, mode:'read_only', epoch:selected.epoch, fingerprint:selected.fingerprint,
            reason:'V6_OPERATIONAL_CHECK_REQUIRED' };
    }
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
    const managedDemoEpoch = ['V4_ACTIVE', V5_EPOCH].includes(state.epoch) || isV6Epoch(state.epoch);
    if (!managedDemoEpoch) return state;
    if (!pool || typeof pool.query !== 'function') {
        return { ...state, enabled: false, mode: 'read_only', preLaunchVerified: false,
            reason: 'PRELAUNCH_STATUS_UNAVAILABLE' };
    }
    let verified;
    try {
        const preLaunchResult = await pool.query(
            'SELECT setting_value FROM app_settings WHERE setting_key=$1', [PRELAUNCH_SETTING]
        );
        const setting = preLaunchResult.rowCount === 1 ? preLaunchResult.rows?.[0]?.setting_value : null;
        if (setting !== 'false') {
            return { ...state, enabled: false, mode: 'prelaunch_read_only', preLaunchVerified: setting === 'true',
                preLaunchActive: setting === 'true', reason: setting === 'true' ? 'PRELAUNCH_ACTIVE' : 'PRELAUNCH_STATUS_INVALID' };
        }
        verified = { ...state, preLaunchVerified: true, preLaunchActive: false };
    } catch {
        return { ...state, enabled: false, mode: 'read_only', preLaunchVerified: false,
            indexerReady: false, reason: 'PRELAUNCH_STATUS_UNAVAILABLE' };
    }
    if (isV6Epoch(state.epoch)) {
        try {
            const current = require('./marketplaceDeployment').configuration(env);
            if (current.epoch !== state.epoch || current.fingerprint !== state.fingerprint)
                return {...verified, reason:'V6_RELEASE_MISMATCH'};
            const status = await require('./v6CandidateStatus').inspect(env);
            if (!status.configured || status.mode !== 'NORMAL')
                return {...verified, reason:'V6_CONTRACTS_BLOCKED'};
            const router = current.contracts.ExchangeRouter.toLowerCase();
            const sync = await pool.query(`SELECT 1 FROM web3_exchange_v6_sync WHERE chain_id=$1 AND router_address=$2
                AND status='ready' AND cursor_hash IS NOT NULL AND updated_at > clock_timestamp()-($3*interval '1 second')`,
                [current.chainId,router,maxAgeSeconds]);
            if (sync.rowCount !== 1) return {...verified, reason:'V6_INDEXER_NOT_READY'};
            return {...verified, enabled:true, mode:'operational', indexerReady:true, reason:null};
        } catch {
            return {...verified, reason:'V6_STATUS_UNAVAILABLE'};
        }
    }
    if (state.epoch !== V5_EPOCH || !state.enabled) return verified;
    try {
        const result = await pool.query(`SELECT status,error_code,
            (last_checked_at > clock_timestamp()-($3*interval '1 second')) AS fresh
            FROM web3_exchange_sync WHERE chain_id=$1 AND exchange_address=$2`,
        [state.epoch === V5_EPOCH ? String((config || configOf(null, env)).chainId) : '',
            String((config || configOf(null, env)).contracts.FifoExchange).toLowerCase(), maxAgeSeconds]);
        const row = result.rows?.[0];
        const ready = result.rowCount === 1 && row?.status === 'ready' && row?.fresh === true && !row?.error_code;
        return ready ? { ...verified, mode: 'operational', indexerReady: true }
            : { ...verified, enabled: false, mode: 'read_only', indexerReady: false,
                reason: row?.error_code || (row?.fresh === false ? 'V5_INDEXER_STALE' : 'V5_INDEXER_NOT_READY') };
    } catch {
        return { ...verified, enabled: false, mode: 'read_only', indexerReady: false,
            reason: 'V5_INDEXER_STATUS_UNAVAILABLE' };
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
    if (isV6Epoch(state.epoch)) {
        // La verificación operativa completa V6 (Prelanzamiento, blockchain e indexador) se ejecuta en assertOperational.
        // Aquí aseguramos que ningún llamador de firma pueda operar sin una huella criptográfica SHA-256 válida.
        if (!/^0x[0-9a-f]{64}$/i.test(String(state.fingerprint || ''))) throw containedError('V6_RELEASE_MISMATCH');
        return state;
    }
    if (!state.enabled) throw containedError(state.reason);
    return state;
}

async function assertOperational({ pool, env = process.env, config, operation } = {}) {
    if (isContainmentAction(operation)) return operationalStatus({ pool, env, config });
    const state = await operationalStatus({ pool, env, config });
    if (!state.enabled) throw containedError(state.reason);
    return state;
}

module.exports = { V5_EPOCH, MAX_INDEXER_AGE_SECONDS, PRELAUNCH_SETTING, isV6Epoch, staticStatus, operationalStatus,
    assertStatic, assertOperational, isContainmentAction, containedError };
