'use strict';
const {locked}=require('./chainOperationStore');
async function savePolicy(pool,key,value,actorId) {
    return locked(pool,'credit-policy-version',async client=>{
        await client.query('BEGIN');
        try {
            const setting=await client.query(`INSERT INTO app_settings(setting_key,setting_value,updated_at) VALUES($1,$2,NOW())
                ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=NOW() RETURNING *`,[key,value]);
            const snapshot=await client.query("SELECT setting_key,setting_value FROM app_settings WHERE setting_key LIKE 'red_credit_%'");
            const version=await client.query('INSERT INTO credit_policy_versions(settings,actor_id) VALUES($1,$2) RETURNING id',[JSON.stringify(Object.fromEntries(snapshot.rows.map(x=>[x.setting_key,x.setting_value]))),actorId||null]);
            await client.query('INSERT INTO credit_policy_jobs(version_id) VALUES($1)',[version.rows[0].id]);
            await client.query('COMMIT');return {setting:setting.rows[0],policyVersion:version.rows[0].id};
        }catch(e){await client.query('ROLLBACK');throw e;}
    });
}
async function tick(pool,scoreService) {
    return locked(pool,'credit-policy-jobs',async client=>{
        const job=(await client.query("SELECT * FROM credit_policy_jobs WHERE state='pending' ORDER BY version_id DESC LIMIT 1")).rows[0];
        if(!job)return;
        // Superseded policies don't issue new transactions. Already signed operations still reconcile first.
        await client.query("UPDATE credit_policy_jobs SET state='superseded' WHERE state='pending' AND version_id<$1",[job.version_id]);
        let cursor=job.cursor_id;
        if(job.operation_id) {
            const operation=(await client.query('SELECT state FROM chain_operations WHERE id=$1',[job.operation_id])).rows[0];
            if(operation?.state!=='confirmed')return;
            // Re-evaluate this account against the latest policy after confirmation.
            // The pending transaction may belong to a superseded policy or a manual override.
            await client.query('UPDATE credit_policy_jobs SET cursor_id=$2,operation_id=NULL,pending_user_id=NULL WHERE version_id=$1',[job.version_id,cursor]);
        }
        // One confirmed account per cycle bounds gas and keeps progress resumable.
        const user=(await client.query('SELECT id FROM users WHERE id>$1 AND web3_wallet_address IS NOT NULL ORDER BY id LIMIT 1',[cursor])).rows[0];
        if(!user){await client.query("UPDATE credit_policy_jobs SET state='complete',updated_at=NOW() WHERE version_id=$1",[job.version_id]);return;}
        const result=await scoreService.syncCreditLimitOnChain(user.id);
        if(result?.operationId)await client.query('UPDATE credit_policy_jobs SET operation_id=$2,pending_user_id=$3,updated_at=NOW() WHERE version_id=$1',[job.version_id,result.operationId,user.id]);
        else if(result?.skipped)await client.query('UPDATE credit_policy_jobs SET cursor_id=$2,updated_at=NOW() WHERE version_id=$1',[job.version_id,user.id]);
    });
}
module.exports={savePolicy,tick};
