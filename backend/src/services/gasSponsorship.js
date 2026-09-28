'use strict';
const {Wallet}=require('ethers');
const {locked,error}=require('./chainOperationStore');
const {signStep}=require('./chainSigning');
async function sponsor(service,row,requiredWei) {
    if(!process.env.GAS_SPONSOR_PRIVATE_KEY)throw error('El patrocinio de gas no está disponible. No se envió tu operación.',503);
    const signer=new Wallet(process.env.GAS_SPONSOR_PRIVATE_KEY);
    if(['RELAYER_PRIVATE_KEY','ADMIN_CHAIN_PRIVATE_KEY'].some(key=>process.env[key] && new Wallet(process.env[key]).address===signer.address))throw error('El patrocinador debe usar una clave separada de los otros operadores.',503);
    return locked(service.pool,'gas-budget:'+row.chain_id,async client=>{
        const key=`gas:${row.id}:${row.steps.length}`;
        const prior=(await client.query('SELECT * FROM chain_operations WHERE request_key=$1',[key])).rows[0];
        if(prior) {
            if(prior.state==='prepared') {
                const policy=Object.fromEntries((await client.query("SELECT setting_key,setting_value FROM app_settings WHERE setting_key LIKE 'gas_sponsor_%'")).rows.map(x=>[x.setting_key,x.setting_value]));
                if(policy.gas_sponsor_enabled!=='true')throw error('El patrocinio está desactivado.',503);
                if(new Date(prior.created_at).toISOString().slice(0,10)!==new Date().toISOString().slice(0,10))throw error('La reserva de patrocinio sin firmar venció. Prepara una nueva operación.');
                if(BigInt(prior.payload.amount)>BigInt(policy.gas_sponsor_max_topup_wei||'0'))throw error('La reserva supera el nuevo límite de patrocinio.');
            }
            if(prior.state==='prepared')return service.store.authorize(prior.id,row.user_id,async()=>[await signStep(service.rpc,signer,{to:row.sender,value:BigInt(prior.payload.amount),data:'0x',label:'Patrocinio de gas'},row.chain_id,row.payload.maxFeeWei)]);
            const result=await service.store.reconcile(prior.id);
            if(result.success)throw error('El gas patrocinado de este paso ya fue entregado. Revisa el saldo y el coste actual.');
            return result;
        }
        const settings=(await client.query("SELECT setting_key,setting_value FROM app_settings WHERE setting_key LIKE 'gas_sponsor_%'")).rows;
        const s=Object.fromEntries(settings.map(x=>[x.setting_key,x.setting_value]));
        if(s.gas_sponsor_enabled!=='true')throw error('El patrocinio está desactivado; la operación no se enviará sin gas.',503);
        const count=Number(s.gas_sponsor_daily_user_operations || '0');
        const cap=BigInt(s.gas_sponsor_daily_budget_wei || '0'),max=BigInt(s.gas_sponsor_max_topup_wei || '0');
        const amount=BigInt(requiredWei)-(await service.rpc.getBalance(row.sender));
        if(amount<=0n)return {success:true};
        if(amount>max || !Number.isInteger(count) || count<1)throw error('El coste supera el límite de patrocinio.');
        const usage=await require('./gasBudgetUsage').usage(client,row.chain_id,row.user_id);
        const already=(await client.query("SELECT id FROM chain_operations WHERE kind='gas' AND user_id=$1 AND payload->>'parentId'=$2 LIMIT 1",[row.user_id,row.id])).rowCount>0;
        const reserved=amount+BigInt(row.payload.maxFeeWei);
        if((!already&&usage.user_count>=count)||BigInt(usage.total)+reserved>cap)throw error('Se agotó el presupuesto de patrocinio. Tu saldo no fue debitado.');
        const funding=await service.store.prepare({userId:row.user_id,key,chainId:row.chain_id,sender:signer.address,resource:'sponsor:'+signer.address.toLowerCase(),kind:'gas',
            payload:{parentId:row.id,reservedWei:reserved.toString(),destination:row.sender,amount:amount.toString()}});
        return service.store.authorize(funding.id,row.user_id,async()=>[await signStep(service.rpc,signer,{to:row.sender,value:amount,data:'0x',label:'Patrocinio de gas'},row.chain_id,row.payload.maxFeeWei)]);
    });
}
module.exports={sponsor};
