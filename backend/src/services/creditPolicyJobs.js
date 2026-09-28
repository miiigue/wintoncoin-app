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
async function recordIssue(client,version,user,operation,reason){
 await client.query(`INSERT INTO credit_policy_issues(version_id,user_id,operation_id,reason) VALUES($1,$2,$3,$4)
 ON CONFLICT(version_id,user_id) DO UPDATE SET operation_id=EXCLUDED.operation_id,reason=EXCLUDED.reason,status='open',retry_requested=FALSE,updated_at=NOW()`,[version,user,operation||null,reason]);
}
async function retryIssue(pool,version,user){
 return locked(pool,'credit-policy-jobs',async client=>{
  const latest=(await client.query('SELECT id FROM credit_policy_versions ORDER BY id DESC LIMIT 1')).rows[0];
  if(String(latest?.id)!==String(version))throw Object.assign(new Error('La política fue sustituida; revisa la versión vigente.'),{status:409});
  const result=await client.query("UPDATE credit_policy_issues SET retry_requested=TRUE,updated_at=NOW() WHERE version_id=$1 AND user_id=$2 AND status='open' RETURNING user_id",[version,user]);
  if(!result.rowCount)throw Object.assign(new Error('No hay una incidencia pendiente para esa cuenta.'),{status:404});
  return {success:true,message:'Revisión programada con los parámetros vigentes. No se repetirá una transacción pendiente.'};
 });
}
async function tick(pool,scoreService){
 return locked(pool,'credit-policy-jobs',async client=>{
  const job=(await client.query('SELECT * FROM credit_policy_jobs ORDER BY version_id DESC LIMIT 1')).rows[0];
  if(!job)return;
  await client.query("UPDATE credit_policy_jobs SET state='superseded' WHERE state IN ('pending','complete_with_issues') AND version_id<$1",[job.version_id]);
  const issue=(await client.query("SELECT * FROM credit_policy_issues WHERE version_id=$1 AND (retry_requested OR status='retrying') ORDER BY updated_at LIMIT 1",[job.version_id])).rows[0];
  if(issue){
   let wait=false;
   if(issue.operation_id){
    const op=(await client.query('SELECT state FROM chain_operations WHERE id=$1',[issue.operation_id])).rows[0];
    wait=['pending','prepared','conflict'].includes(op?.state);
    if(issue.status==='retrying'&&['failed','abandoned'].includes(op?.state)){await recordIssue(client,job.version_id,issue.user_id,issue.operation_id,'CHAIN_REVERT');return;}
   }
   if(!wait){
    try{
     const result=await scoreService.syncCreditLimitOnChain(issue.user_id);
     if(result?.skipped)await client.query("UPDATE credit_policy_issues SET status='resolved',retry_requested=FALSE,updated_at=NOW() WHERE version_id=$1 AND user_id=$2",[job.version_id,issue.user_id]);
     else if(result?.operationId)await client.query("UPDATE credit_policy_issues SET status='retrying',retry_requested=FALSE,operation_id=$3,updated_at=NOW() WHERE version_id=$1 AND user_id=$2",[job.version_id,issue.user_id,result.operationId]);
     else await recordIssue(client,job.version_id,issue.user_id,null,'NO_CONFIRMED_RESULT');
    }catch{await recordIssue(client,job.version_id,issue.user_id,issue.operation_id,'RETRY_UNAVAILABLE');}
   }else await client.query('UPDATE credit_policy_issues SET updated_at=NOW() WHERE version_id=$1 AND user_id=$2',[job.version_id,issue.user_id]);
   // A waiting retry must not prevent the remaining accounts from progressing.
  }
  if(job.state!=='pending'){
   await client.query("UPDATE credit_policy_jobs SET state='complete' WHERE version_id=$1 AND state='complete_with_issues' AND NOT EXISTS(SELECT 1 FROM credit_policy_issues WHERE version_id=$1 AND status<>'resolved')",[job.version_id]);return;
  }
  let cursor=job.cursor_id;
  if(job.operation_id){
   const op=(await client.query('SELECT state FROM chain_operations WHERE id=$1',[job.operation_id])).rows[0];
   if(['pending','prepared'].includes(op?.state))return;
   if(op?.state!=='confirmed'){
    await recordIssue(client,job.version_id,job.pending_user_id,job.operation_id,op?.state==='conflict'?'CHAIN_CONFLICT':'CHAIN_REJECTED');cursor=job.pending_user_id;
   }
   await client.query('UPDATE credit_policy_jobs SET cursor_id=$2,operation_id=NULL,pending_user_id=NULL WHERE version_id=$1',[job.version_id,cursor]);
  }
  const user=(await client.query('SELECT id FROM users WHERE id>$1 AND web3_wallet_address IS NOT NULL ORDER BY id LIMIT 1',[cursor])).rows[0];
  if(!user){await client.query("UPDATE credit_policy_jobs SET state=CASE WHEN EXISTS(SELECT 1 FROM credit_policy_issues WHERE version_id=$1 AND status<>'resolved') THEN 'complete_with_issues' ELSE 'complete' END,updated_at=NOW() WHERE version_id=$1",[job.version_id]);return;}
  try{
   const result=await scoreService.syncCreditLimitOnChain(user.id);
   if(result?.operationId)await client.query('UPDATE credit_policy_jobs SET operation_id=$2,pending_user_id=$3,updated_at=NOW() WHERE version_id=$1',[job.version_id,result.operationId,user.id]);
   else if(result?.skipped)await client.query('UPDATE credit_policy_jobs SET cursor_id=$2,updated_at=NOW() WHERE version_id=$1',[job.version_id,user.id]);
   else throw new Error('NO_RESULT');
  }catch{
   await recordIssue(client,job.version_id,user.id,null,'UPDATE_UNAVAILABLE');
   await client.query('UPDATE credit_policy_jobs SET cursor_id=$2,updated_at=NOW() WHERE version_id=$1',[job.version_id,user.id]);
  }
 });
}
module.exports={savePolicy,tick,retryIssue};
