'use strict';

const { Contract, Wallet, Interface, getAddress } = require('ethers');
const deployment = require('./chainDeployment');
const { ChainOperationStore, locked } = require('./chainOperationStore');
const { signStep } = require('./chainSigning');
const abi = ['function settleMatured(address)', 'function isKYCVerified(address) view returns(bool)',
    'function isDelinquent(address) view returns(bool)', 'function paused() view returns(bool)'];

// One funded, permissionless contract call; no user signature or minting power.
// All signed bytes use the same durable journal/nonce lock as other relayer work.
async function settle({ pool, rpc, config, wallet, env = process.env, store = new ChainOperationStore(pool, rpc) }) {
    const policy = Object.fromEntries((await pool.query("SELECT setting_key,setting_value FROM app_settings WHERE setting_key LIKE 'gas_sponsor_%'")).rows.map(s=>[s.setting_key,s.setting_value]));
    if(policy.gas_sponsor_enabled!=='true')return {status:'not_configured'};
    const maxFee = policy.gas_sponsor_maintenance_max_step_wei || '0';
    const daily = policy.gas_sponsor_maintenance_daily_budget_wei || '0';
    const globalBudget = policy.gas_sponsor_daily_budget_wei || '0';
    if (![maxFee, daily, globalBudget].every(x => /^\d+$/.test(x) && BigInt(x) > 0n) || !env.RELAYER_PRIVATE_KEY)
        return { status: 'not_configured' };
    if (BigInt(maxFee) > BigInt(daily)) return { status: 'budget_exhausted' };
    const signer = new Wallet(env.RELAYER_PRIVATE_KEY);
    const target = config.contracts.CoreProtocol;
    const core = new Contract(target, abi, rpc);
    const resource = `maintenance:${config.chainId}:${target.toLowerCase()}:${wallet.toLowerCase()}`;
    return locked(pool, `gas-budget:${config.chainId}`, async client => {
        // An unsigned estimate does not reserve budget forever. Signed pending
        // transactions are never abandoned or replaced by this cleanup.
        await client.query(`UPDATE chain_operations SET state='abandoned',updated_at=NOW() WHERE kind='settleMatured'
            AND chain_id=$1 AND state='prepared' AND jsonb_array_length(steps)=0
            AND created_at < date_trunc('day',NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,[config.chainId]);
        const active = await client.query(`SELECT id,state FROM chain_operations WHERE resource_key=$1
            AND state IN ('prepared','pending','conflict') ORDER BY created_at LIMIT 1`, [resource]);
        let row = active.rows[0];
        if (row && row.state !== 'prepared') return store.reconcile(row.id);
        if (await core.paused() || !await core.isKYCVerified(wallet) || !await core.isDelinquent(wallet)) {
            if(row)await client.query("UPDATE chain_operations SET state='abandoned',updated_at=NOW() WHERE id=$1 AND state='prepared' AND jsonb_array_length(steps)=0",[row.id]);
            return {status:'not_needed'};
        }
        if (!row) {
            // Reservations count even if confirmation is delayed, and pending
            // reservations from earlier days keep consuming today's headroom.
            const used = (await client.query(`SELECT COALESCE(SUM((payload->>'maxFeeWei')::numeric),0)::text AS used
                FROM chain_operations WHERE chain_id=$1 AND kind='settleMatured'
                AND (created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
                    OR state IN ('prepared','pending','conflict'))`, [config.chainId])).rows[0].used;
            if (BigInt(used) + BigInt(maxFee) > BigInt(daily)) return { status: 'budget_exhausted' };
            const global = await require('./gasBudgetUsage').usage(client,config.chainId,null);
            if(BigInt(global.total)+BigInt(maxFee)>BigInt(globalBudget))return {status:'budget_exhausted'};
            const data = new Interface(abi).encodeFunctionData('settleMatured', [wallet]);
            row = await store.prepare({ key: resource + ':' + require('crypto').randomUUID(), chainId: config.chainId,
                sender: signer.address, resource, kind: 'settleMatured',
                payload: { to: target, data, value: '0', maxFeeWei: maxFee, reservedWei:maxFee, fingerprint: config.fingerprint } });
        }
        return store.authorize(row.id, null, async prepared => {
            if (prepared.payload.fingerprint !== config.fingerprint) throw Error('MAINTENANCE_DEPLOYMENT_CHANGED');
            // An unsigned preparation is not permission to ignore a later
            // administrative reduction. Signed transactions stay in recovery.
            const current = Object.fromEntries((await client.query("SELECT setting_key,setting_value FROM app_settings WHERE setting_key LIKE 'gas_sponsor_%'")).rows.map(s=>[s.setting_key,s.setting_value]));
            const cap = current.gas_sponsor_maintenance_max_step_wei || '0';
            const dailyCap = current.gas_sponsor_maintenance_daily_budget_wei || '0';
            const totalCap = current.gas_sponsor_daily_budget_wei || '0';
            if(current.gas_sponsor_enabled !== 'true' || ![cap,dailyCap,totalCap].every(x=>/^\d+$/.test(x) && BigInt(x)>0n))throw Error('MAINTENANCE_POLICY_DISABLED');
            const total = await require('./gasBudgetUsage').usage(client,config.chainId,null);
            const used = (await client.query(`SELECT COALESCE(SUM((payload->>'maxFeeWei')::numeric),0)::text AS used
                FROM chain_operations WHERE chain_id=$1 AND kind='settleMatured'
                AND (created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
                    OR state IN ('prepared','pending','conflict'))`,[config.chainId])).rows[0].used;
            if(BigInt(prepared.payload.maxFeeWei)>BigInt(cap) || BigInt(total.total)>BigInt(totalCap) || BigInt(used)>BigInt(dailyCap))throw Error('MAINTENANCE_POLICY_REDUCED');
            const { to, data, value } = prepared.payload;
            return [await signStep(rpc, signer, { to, data, value, label: 'Amortización automática' }, config.chainId, prepared.payload.maxFeeWei)];
        });
    });
}

function createMaintenanceWorker(pool, { bridge, rpc, config, batchSize = 20, execute = settle } = {}) {
    let after = 0, running = false;
    return { async tick() {
        if (running) return { status: 'busy' };
        running = true;
        try {
            bridge ||= require('./web3BridgeService');
            rpc ||= bridge.provider;
            config ||= deployment.configuration();
            await deployment.validate(rpc, config);
            const rows = (await pool.query(`SELECT id,web3_wallet_address FROM users WHERE id>$1
                AND web3_wallet_address ~ '^0x[0-9a-fA-F]{40}$' ORDER BY id LIMIT $2`, [after, batchSize])).rows;
            let checked = 0, failed = 0, awaiting = 0;
            for (const user of rows) {
                try {
                    const wallet = getAddress(user.web3_wallet_address);
                    const snapshot = await bridge.getUserAuditDetailed(wallet, 0, 1, 'safe');
                    if (!snapshot.success) throw Error('CHAIN_READ_FAILED');
                    // Compare the anchor again before recording a projection.
                    if ((await rpc.getBlock(snapshot.blockNumber))?.hash !== snapshot.blockHash) throw Error('CHAIN_CHANGED');
                    await pool.query(`INSERT INTO web3_wallet_snapshots(chain_id,core_address,wallet_address,block_number,block_hash,snapshot)
                        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(chain_id,core_address,wallet_address) DO UPDATE SET
                        block_number=EXCLUDED.block_number,block_hash=EXCLUDED.block_hash,snapshot=EXCLUDED.snapshot,checked_at=NOW()
                        WHERE web3_wallet_snapshots.block_number<=EXCLUDED.block_number`,
                    [config.chainId, config.contracts.CoreProtocol.toLowerCase(), wallet.toLowerCase(), snapshot.blockNumber, snapshot.blockHash, JSON.stringify(snapshot)]);
                    if (snapshot.credit.isKYCVerified && snapshot.credit.isDelinquent && BigInt(require('ethers').parseUnits(snapshot.blueBalance,6)) > 0n) {
                        const result = await execute({ pool, rpc, config, wallet });
                        if (!result.success) awaiting++;
                    }
                    checked++;
                } catch { failed++; } // One account must not starve later accounts.
                after = user.id;
            }
            if (rows.length < batchSize) after = 0;
            return { status: failed ? 'partial' : 'checked', checked, failed, awaiting };
        } finally { running = false; }
    } };
}

module.exports = { createMaintenanceWorker, settle };
