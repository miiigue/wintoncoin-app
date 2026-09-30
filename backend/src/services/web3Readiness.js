'use strict';
const {Wallet, Contract}=require('ethers');
const deployment=require('./chainDeployment');

// Read-only diagnostics: no secret values, transaction signing or DB writes.
async function inspect({pool, env=process.env, rpc=deployment.provider(), validate=deployment.validate, contract=(address,abi)=>new Contract(address,abi,rpc)}={}) {
    const checks=[];
    const add=(id,name,ready)=>checks.push({id,name,ready:Boolean(ready)});
    const signers={};
    add('admin_secret','Protección de la sesión administrativa',env.ADMIN_SECRET_KEY && env.ADMIN_SECRET_KEY!==env.JWT_SECRET);
    add('wallet_encryption','Protección de las billeteras', (env.ENCRYPTION_SECRET||'').length>=32);
    for(const [key,label] of [['ADMIN_CHAIN_PRIVATE_KEY','Firma administrativa'],['RELAYER_PRIVATE_KEY','Firma del procesador de pagos'],['GAS_SPONSOR_PRIVATE_KEY','Firma del patrocinador de gas']]){
        try{signers[key]=new Wallet(env[key]).address;}catch{}
        add(key,label,signers[key]);
    }
    add('separate_signers','Firmas administrativas, pagos y patrocinio separadas',Object.keys(signers).length===3&&new Set(Object.values(signers)).size===3);
    let config;
    try{
        config=await validate(rpc,deployment.configuration(env));
        add('deployment','Red, contratos y enlaces correctos',true);
        const head=await rpc.getBlock('latest');
        const age=Math.floor(Date.now()/1000)-head?.timestamp;
        add('rpc_fresh','Proveedor de blockchain actualizado',Number.isSafeInteger(head?.timestamp)&&age>=-60&&age<=300);
        for(const key of ['CoreProtocol','CollateralVault']){
            const owner=await contract(config.contracts[key],['function owner() view returns(address)']).owner();
            add('owner_'+key,'Permiso para administrar '+(key==='CoreProtocol'?'el protocolo':'el colateral'),owner.toLowerCase()===signers.ADMIN_CHAIN_PRIVATE_KEY?.toLowerCase());
        }
        const relayer=await contract(config.contracts.CoreProtocol,['function relayer() view returns(address)']).relayer();
        add('relayer_permission','Procesador de pagos autorizado por el contrato',relayer.toLowerCase()===signers.RELAYER_PRIVATE_KEY?.toLowerCase());
        for(const [key,label] of [['CoreProtocol','Protocolo'],['CollateralVault','Colateral'],['FifoExchange','Exchange']]){
            add('active_'+key,label+' sin pausa de emergencia',!await contract(config.contracts[key],['function paused() view returns(bool)']).paused());
        }
        for(const [key,label] of [['ADMIN_CHAIN_PRIVATE_KEY','administración'],['RELAYER_PRIVATE_KEY','procesamiento de pagos'],['GAS_SPONSOR_PRIVATE_KEY','patrocinio']]){
            add('gas_'+key,'Saldo de gas para '+label,signers[key] && await rpc.getBalance(signers[key])>0n);
        }
    }catch{add('chain_unavailable','Lectura completa de contratos y permisos',false);}
    finally{rpc.destroy();}
    try{
        const migrations=await pool.query("SELECT migration_name FROM schema_migrations WHERE migration_name IN ('114_wallet_pin_attempts.js','115_wallet_identity_credit_override.js','116_durable_chain_operations.js','117_payment_recovery_controls.js','118_chain_wallet_snapshots.js')");
        add('migrations','Base de datos actualizada',migrations.rowCount===5);
        const duplicates=await pool.query('SELECT 1 FROM users WHERE web3_wallet_address IS NOT NULL GROUP BY LOWER(web3_wallet_address) HAVING COUNT(*)>1 LIMIT 1');
        add('identity','Una billetera por cuenta, sin duplicaciones',duplicates.rowCount===0);
        const settings=await pool.query("SELECT setting_key,setting_value FROM app_settings WHERE setting_key LIKE 'gas_sponsor_%'");
        const s=Object.fromEntries(settings.rows.map(x=>[x.setting_key,x.setting_value]));
        add('gas_budget','Patrocinio activado con presupuesto y máximo mayores que cero',s.gas_sponsor_enabled==='true'&&BigInt(s.gas_sponsor_daily_budget_wei||'0')>0n&&BigInt(s.gas_sponsor_max_topup_wei||'0')>0n);
        const maximum=s.gas_sponsor_maintenance_max_step_wei||'0',daily=s.gas_sponsor_maintenance_daily_budget_wei||'0';
        add('maintenance_budget','Amortización automática con presupuesto de gas',/^\d+$/.test(maximum)&&/^\d+$/.test(daily)&&BigInt(maximum)>0n&&BigInt(daily)>=BigInt(maximum));
        if(config){
            const result=await pool.query("SELECT status,error_code,(last_checked_at>clock_timestamp()-interval '120 seconds') AS fresh FROM web3_exchange_sync WHERE chain_id=$1 AND exchange_address=$2",[config.chainId,config.contracts.FifoExchange.toLowerCase()]);
            add('indexer','Sincronización del Exchange al día',result.rows[0]?.status==='ready'&&result.rows[0]?.fresh===true);
        }else add('indexer','Sincronización del Exchange verificable',false);
    }catch{add('database_unavailable','Lectura completa de la preparación de datos',false);}
    return {ready:checks.every(x=>x.ready),checkedAt:new Date().toISOString(),checks};
}
module.exports={inspect};
