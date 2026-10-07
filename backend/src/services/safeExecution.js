'use strict';
const {Contract,Wallet}=require('ethers');
const policy=require('./safeAccountPolicy');
const {locked,error}=require('./chainOperationStore');
const {signStep}=require('./chainSigning');
async function account(pool,userId,chainId,{active=true}={}) {
    const result=await pool.query(`SELECT a.*,i.user_id,i.review_state FROM smart_accounts a JOIN account_identities i ON i.id=a.identity_id
        WHERE i.user_id=$1 AND a.chain_id=$2`,[userId,String(chainId)]);
    const a=result.rows[0];
    if(!a||active&&(a.state!=='active'||!a.backup_confirmed_at))throw error('Completa la activación y el respaldo de tu cuenta en Billetera.',412);
    return a;
}
function relayer(env=process.env) {
    if(!env.RELAYER_PRIVATE_KEY)throw error('No está configurado el envío patrocinado.',503);
    return new Wallet(env.RELAYER_PRIVATE_KEY);
}
async function quote(pool,rpc,config,userId,call,{active=true}={}) {
    const a=await account(pool,userId,config.chainId,{active});
    if(a.manifest_hash!==config.hash)throw error('La configuración de la cuenta requiere revisión.');
    const safe=await policy.validateAccount(rpc,config,a,{allowUnconfiguredRecovery:!active});
    const tx=policy.transaction(call,await safe.nonce());
    return {account:a.address,transaction:tx,hash:await safe.getTransactionHash(...policy.args(tx),tx.nonce),chainId:String(config.chainId),manifestHash:config.hash};
}
async function build(rpc,config,authorization,signature,executor=relayer()) {
    if(authorization.manifestHash!==config.hash||authorization.chainId!==String(config.chainId))throw error('La red o configuración cambió.');
    const safe=new Contract(authorization.account,policy.abi,rpc);
    if(String(await safe.nonce())!==authorization.transaction.nonce)throw error('La autorización cambió. Revisa y confirma de nuevo.');
    const hash=await safe.getTransactionHash(...policy.args(authorization.transaction),authorization.transaction.nonce);
    if(hash!==authorization.hash)throw error('El contenido de la autorización no coincide.');
    const call=policy.execution(authorization.account,authorization.transaction,signature);
    // execTransaction with safeTxGas=gasPrice=0 reverts on inner failure (GS013).
    // A relayer receipt cannot masquerade as a successful user call.
    await rpc.call({...call,from:executor.address});
    return call;
}
async function sponsoredStep(pool,rpc,chainId,userId,row,call) {
    return locked(pool,'gas-budget:'+chainId,async client=>{
        const settings=Object.fromEntries((await client.query("SELECT setting_key,setting_value FROM app_settings WHERE setting_key LIKE 'gas_sponsor_%'")).rows.map(x=>[x.setting_key,x.setting_value]));
        const limit=Number(settings.gas_sponsor_daily_user_operations||0),cap=BigInt(settings.gas_sponsor_daily_budget_wei||'0'),max=BigInt(settings.gas_sponsor_max_topup_wei||'0');
        if(settings.gas_sponsor_enabled!=='true'||!Number.isSafeInteger(limit)||limit<1||cap<=0n||max<=0n)throw error('El patrocinio no tiene presupuesto disponible.',503);
        const usage=await require('./gasBudgetUsage').usage(client,String(chainId),userId,row.id);
        if(usage.user_count>=limit||BigInt(usage.total)+max>cap)throw error('Se agotó la cuota de patrocinio. La operación no se ha enviado.',429);
        const step=await signStep(rpc,relayer(),call,chainId,max.toString());
        // Reservation commits before signed bytes. An interrupted request may
        // overreserve, but must never allow spending beyond the budget.
        await client.query(`UPDATE chain_operations SET payload=payload||jsonb_build_object('reservedWei',(COALESCE((payload->>'reservedWei')::numeric,0)+$2::numeric)::text,'gasBudgetDay',to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD'),'sponsoredAccount',true) WHERE id=$1`,[row.id,max.toString()]);
        return step;
    });
}
module.exports={account,relayer,quote,build,sponsoredStep};
