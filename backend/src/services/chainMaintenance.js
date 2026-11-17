'use strict';

const { Contract, Wallet, Interface, getAddress, parseUnits } = require('ethers');
const { randomUUID } = require('crypto');
const deployment = require('./chainDeployment');
const { ChainOperationStore, locked } = require('./chainOperationStore');
const { signStep } = require('./chainSigning');

const coreAbi = ['function settleMatured(address)', 'function isKYCVerified(address) view returns(bool)',
    'function isDelinquent(address) view returns(bool)', 'function paused() view returns(bool)'];
const vaultAbi = ['function collateralizeMatured(address,uint64[])',
    'function automaticExchangeCollateral(address) view returns(bool)'];
const maintenanceKinds = ['settleMatured', 'collateralizeMatured'];

const validFee = value => /^\d+$/.test(String(value)) && BigInt(value) > 0n;
async function policy(pool) {
    return Object.fromEntries((await pool.query("SELECT setting_key,setting_value FROM app_settings WHERE setting_key LIKE 'gas_sponsor_%'")).rows
        .map(setting => [setting.setting_key, setting.setting_value]));
}
async function maintenanceUsed(client, chainId) {
    return (await client.query(`SELECT COALESCE(SUM((payload->>'maxFeeWei')::numeric),0)::text AS used
        FROM chain_operations WHERE chain_id=$1 AND kind=ANY($2::text[])
        AND (created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
            OR state IN ('prepared','pending','conflict'))`, [chainId, maintenanceKinds])).rows[0].used;
}

// One funded, permissionless contract call. Exact signed bytes and the selected
// FIFO order IDs are durable before broadcast. Both maintenance actions share
// one per-user resource and one budget.
async function executeMaintenance({ pool, rpc, config, wallet, kind, orderIds = [], env = process.env,
    store = new ChainOperationStore(pool, rpc) }) {
    const gate = await require('./economicWriteGate').operationalStatus({ pool, env, config });
    if (!gate.enabled) return { status: 'maintenance_paused', reason: gate.reason };
    const settings = await policy(pool);
    const maxFee = settings.gas_sponsor_maintenance_max_step_wei || '0';
    const daily = settings.gas_sponsor_maintenance_daily_budget_wei || '0';
    const globalBudget = settings.gas_sponsor_daily_budget_wei || '0';
    if (settings.gas_sponsor_enabled !== 'true' || ![maxFee, daily, globalBudget].every(validFee) || !env.RELAYER_PRIVATE_KEY)
        return { status: 'not_configured' };
    if (BigInt(maxFee) > BigInt(daily)) return { status: 'budget_exhausted' };
    if (!maintenanceKinds.includes(kind)) throw Error('INVALID_MAINTENANCE_KIND');
    if (kind === 'collateralizeMatured' && (orderIds.length < 1 || orderIds.length > 16 ||
        new Set(orderIds.map(String)).size !== orderIds.length || orderIds.some(id => !/^\d+$/.test(String(id)) || BigInt(id) < 1n || BigInt(id) >= 1n << 64n))) {
        throw Error('INVALID_COLLATERAL_ORDER_BATCH');
    }
    const signer = new Wallet(env.RELAYER_PRIVATE_KEY);
    let target, data, needed;
    if (config.epoch === 'V6_DEMO') {
        const modeController = new Contract(config.contracts.ProtocolModeController, ['function mode() view returns(uint8)'], rpc);
        const risk = new Contract(config.contracts.RiskRegistry, ['function isKYCVerified(address) view returns(bool)'], rpc);
        const ledger = new Contract(config.contracts.CommitmentLedger, ['function matured(address) view returns(uint256)'], rpc);
        const vaultV6 = kind === 'collateralizeMatured'
            ? new Contract(config.contracts.CollateralVaultV6, ['function protectOverdue(address,uint64)', 'function automaticExchangeCollateral(address) view returns(bool)'], rpc)
            : null;
        target = kind === 'settleMatured' ? config.contracts.PaymentEngine : config.contracts.CollateralVaultV6;
        data = kind === 'settleMatured'
            ? new Interface(['function settleMatured(address)']).encodeFunctionData('settleMatured', [wallet])
            : new Interface(['function protectOverdue(address,uint64)']).encodeFunctionData('protectOverdue', [wallet, BigInt(orderIds[0])]);
        needed = Number(await modeController.mode()) === 0 && await risk.isKYCVerified(wallet) &&
            BigInt(await ledger.matured(wallet)) > 0n && (!vaultV6 || await vaultV6.automaticExchangeCollateral(wallet));
    } else {
        const core = new Contract(config.contracts.CoreProtocol, coreAbi, rpc);
        const vault = kind === 'collateralizeMatured' ? new Contract(config.contracts.CollateralVault, vaultAbi, rpc) : null;
        target = kind === 'settleMatured' ? config.contracts.CoreProtocol : config.contracts.CollateralVault;
        const args = kind === 'settleMatured' ? [wallet] : [wallet, orderIds];
        data = new Interface(kind === 'settleMatured' ? coreAbi : vaultAbi).encodeFunctionData(kind, args);
        needed = !await core.paused() && await core.isKYCVerified(wallet) && await core.isDelinquent(wallet) &&
            (!vault || await vault.automaticExchangeCollateral(wallet));
    }
    const resource = `maintenance:${config.chainId}:${wallet.toLowerCase()}`;
    if (!needed) return { status: 'not_needed' };

    const prepared = await locked(pool, `gas-budget:${config.chainId}`, async client => {
        await client.query(`UPDATE chain_operations SET state='abandoned',updated_at=NOW() WHERE kind=ANY($1::text[])
            AND chain_id=$2 AND state='prepared' AND jsonb_array_length(steps)=0
            AND created_at < date_trunc('day',NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`, [maintenanceKinds, config.chainId]);
        const active = await client.query(`SELECT * FROM chain_operations WHERE resource_key=$1
            AND state IN ('prepared','pending','conflict') ORDER BY created_at LIMIT 1`, [resource]);
        let row = active.rows[0];
        if (row && row.state !== 'prepared') return { reconcileId: row.id };
        const sameIntent = row?.kind === kind && JSON.stringify(row.payload?.orderIds || []) === JSON.stringify(orderIds.map(String));
        if (row && !sameIntent) {
            await client.query("UPDATE chain_operations SET state='abandoned',updated_at=NOW() WHERE id=$1 AND state='prepared' AND jsonb_array_length(steps)=0", [row.id]);
            row = null;
        }
        if (!row) {
            const used = await maintenanceUsed(client, config.chainId);
            if (BigInt(used) + BigInt(maxFee) > BigInt(daily)) return { status: 'budget_exhausted' };
            const global = await require('./gasBudgetUsage').usage(client, config.chainId, null);
            if (BigInt(global.total) + BigInt(maxFee) > BigInt(globalBudget)) return { status: 'budget_exhausted' };
            row = await store.prepare({ key: resource + ':' + randomUUID(), chainId: config.chainId,
                sender: signer.address, resource, kind,
                payload: { to: target, data, value: '0', maxFeeWei: maxFee, reservedWei: maxFee,
                    fingerprint: config.fingerprint, wallet: wallet.toLowerCase(), orderIds: orderIds.map(String) } });
        }
        return { row };
    });
    if (prepared.reconcileId) return store.reconcile(prepared.reconcileId);
    if (!prepared.row) return prepared;
    return store.authorize(prepared.row.id, null, async operation => {
        return locked(pool, `gas-budget:${config.chainId}`, async client => {
            if (operation.payload.fingerprint !== config.fingerprint) throw Error('MAINTENANCE_DEPLOYMENT_CHANGED');
            const current = await policy(client);
            const cap = current.gas_sponsor_maintenance_max_step_wei || '0';
            const dailyCap = current.gas_sponsor_maintenance_daily_budget_wei || '0';
            const totalCap = current.gas_sponsor_daily_budget_wei || '0';
            if (current.gas_sponsor_enabled !== 'true' || ![cap, dailyCap, totalCap].every(validFee)) throw Error('MAINTENANCE_POLICY_DISABLED');
            const total = await require('./gasBudgetUsage').usage(client, config.chainId, null);
            const used = await maintenanceUsed(client, config.chainId);
            if (BigInt(operation.payload.maxFeeWei) > BigInt(cap) || BigInt(total.total) > BigInt(totalCap) || BigInt(used) > BigInt(dailyCap))
                throw Error('MAINTENANCE_POLICY_REDUCED');
            const { to, data: callData, value } = operation.payload;
            const label = kind === 'settleMatured' ? 'Amortización automática' : 'Garantía automática FIFO de RED vencido';
            return [await signStep(rpc, signer, { to, data: callData, value, label }, config.chainId, operation.payload.maxFeeWei)];
        });
    });
}

async function settle(input) { return executeMaintenance({ ...input, kind: 'settleMatured' }); }
async function collateralizeMatured(input) { return executeMaintenance({ ...input, kind: 'collateralizeMatured' }); }

async function collateralOrderIds(pool, config, wallet, maxAgeSeconds = 120) {
    if (config.epoch === 'V6_DEMO') {
        const routerAddress = config.contracts.ExchangeRouter.toLowerCase();
        const sync = await pool.query(`SELECT 1 FROM web3_exchange_v6_sync WHERE chain_id=$1 AND router_address=$2
            AND status='ready' AND cursor_hash IS NOT NULL AND updated_at>clock_timestamp()-($3*interval '1 second')`,
            [config.chainId, routerAddress, maxAgeSeconds]);
        if (!sync.rowCount) return [];
        return (await pool.query(`SELECT order_id::text FROM web3_exchange_v6_orders
            WHERE chain_id=$1 AND router_address=$2 AND data->>'user'=$3 AND data->>'side'='1'
            AND data->>'status' IN ('1','2','5') AND (data->>'remaining')::numeric > 0
            ORDER BY (data->>'sequence')::numeric, order_id LIMIT 16`,
            [config.chainId, routerAddress, wallet.toLowerCase()])).rows.map(row => row.order_id);
    }
    const key = [config.chainId, config.contracts.FifoExchange.toLowerCase(), wallet.toLowerCase(), maxAgeSeconds];
    const sync = await pool.query(`SELECT 1 FROM web3_exchange_sync WHERE chain_id=$1 AND exchange_address=$2
        AND status='ready' AND last_checked_at>clock_timestamp()-($4*interval '1 second')`, key);
    if (!sync.rowCount) return [];
    return (await pool.query(`SELECT order_id::text FROM web3_exchange_order_snapshots
        WHERE chain_id=$1 AND exchange_address=$2 AND wallet_address=$3 AND side='BUY_BLUE'
        AND status IN ('OPEN','PARTIALLY_FILLED','SUSPENDED') AND remaining_amount>exchange_collateralized
        ORDER BY sequence_id,order_id LIMIT 16`, key.slice(0, 3))).rows.map(row => row.order_id);
}

async function hasCurrentCollateralConsent(pool, userId, wallet) {
    try {
        await require('./exchangeCollateralConsent').assertCurrentConsent(pool, userId, wallet);
        return true;
    } catch {
        // A missing, revoked, superseded or temporarily unreadable consent is
        // never interpreted as permission for an automated collateral action.
        return false;
    }
}

function createMaintenanceWorker(pool, { bridge, rpc, config, batchSize = 20, execute = settle,
    executeCollateral = collateralizeMatured, loadCollateralOrders = collateralOrderIds,
    checkCollateralConsent = hasCurrentCollateralConsent } = {}) {
    let after = 0, running = false;
    return { async tick() {
        if (running) return { status: 'busy' };
        running = true;
        try {
            bridge ||= require('./web3BridgeService');
            rpc ||= bridge.provider;
            config ||= require('./v6ChainBridge').activeV6Config() || deployment.configuration();
            if (config.epoch === 'V6_DEMO') await require('./marketplaceDeployment').validate(rpc, config);
            else await deployment.validate(rpc, config);
            const coreAddress = (config.contracts.CoreProtocol || config.contracts.PaymentEngine).toLowerCase();
            const rows = (await pool.query(`SELECT id,web3_wallet_address FROM users WHERE id>$1
                AND web3_wallet_address ~ '^0x[0-9a-fA-F]{40}$' ORDER BY id LIMIT $2`, [after, batchSize])).rows;
            let checked = 0, failed = 0, awaiting = 0;
            for (const user of rows) {
                try {
                    const wallet = getAddress(user.web3_wallet_address);
                    const snapshot = await bridge.getUserAuditDetailed(wallet, 0, 1, 'safe');
                    if (!snapshot.success) throw Error('CHAIN_READ_FAILED');
                    if ((await rpc.getBlock(snapshot.blockNumber))?.hash !== snapshot.blockHash) throw Error('CHAIN_CHANGED');
                    await pool.query(`INSERT INTO web3_wallet_snapshots(chain_id,core_address,wallet_address,block_number,block_hash,snapshot)
                        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(chain_id,core_address,wallet_address) DO UPDATE SET
                        block_number=EXCLUDED.block_number,block_hash=EXCLUDED.block_hash,snapshot=EXCLUDED.snapshot,checked_at=NOW()
                        WHERE web3_wallet_snapshots.block_number<=EXCLUDED.block_number`,
                    [config.chainId, coreAddress, wallet.toLowerCase(), snapshot.blockNumber, snapshot.blockHash, JSON.stringify(snapshot)]);
                    if (snapshot.credit.isKYCVerified && snapshot.credit.isDelinquent) {
                        let result;
                        const supports = config.epoch === 'V6_DEMO' || config.epoch === 'V5_CODEX_163' || config.supportsExchangeCollateral === true;
                        const automatic = snapshot.collateral?.automaticAtMaturity === true || snapshot.collateralVault?.automaticAtMaturity === true;
                        if (supports && automatic
                            && await checkCollateralConsent(pool, user.id, wallet)) {
                            const orderIds = await loadCollateralOrders(pool, config, wallet);
                            if (orderIds.length) result = await executeCollateral({ pool, rpc, config, wallet, orderIds });
                        }
                        if (!result && parseUnits(snapshot.blueBalance, 6) > 0n) result = await execute({ pool, rpc, config, wallet });
                        if (result && !result.success) awaiting++;
                    }
                    checked++;
                } catch { failed++; }
                after = user.id;
            }
            if (rows.length < batchSize) after = 0;
            return { status: failed ? 'partial' : 'checked', checked, failed, awaiting };
        } finally { running = false; }
    } };
}

module.exports = { createMaintenanceWorker, settle, collateralizeMatured, collateralOrderIds,
    executeMaintenance, hasCurrentCollateralConsent };
