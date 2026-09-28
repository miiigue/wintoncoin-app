'use strict';
// Read-only deployment gate. Never prints credentials, signs or applies migrations.
require('../config');
const {Wallet,Contract}=require('ethers');
const pool=require('../src/config/db');
const deployment=require('../src/services/chainDeployment');
async function inspect() {
    const checks=[];const add=(name,ready)=>checks.push({name,ready:Boolean(ready)});
    add('Secreto administrativo separado',process.env.ADMIN_SECRET_KEY && process.env.ADMIN_SECRET_KEY!==process.env.JWT_SECRET);
    add('Protección de billeteras configurada',(process.env.ENCRYPTION_SECRET||'').length>=32);
    const signers={};
    for(const key of ['ADMIN_CHAIN_PRIVATE_KEY','RELAYER_PRIVATE_KEY','GAS_SPONSOR_PRIVATE_KEY']) {
        try{signers[key]=new Wallet(process.env[key]).address;add(key+' válido',true);}catch{add(key+' válido',false);}
    }
    add('Firmantes separados',Object.keys(signers).length===3&&new Set(Object.values(signers)).size===3);
    const rpc=deployment.provider();
    try {
        const config=await deployment.validate(rpc);add('Despliegue y red verificados',true);
        for(const contract of ['CoreProtocol','CollateralVault']) {
            const owner=await new Contract(config.contracts[contract],['function owner() view returns(address)'],rpc).owner();
            add('Permiso administrativo '+contract,owner===signers.ADMIN_CHAIN_PRIVATE_KEY);
        }
        for(const [key,address] of Object.entries(signers))add('Gas disponible '+key,await rpc.getBalance(address)>0n);
    }catch{add('Despliegue y permisos verificables',false);}finally{rpc.destroy();}
    try {
        const migrations=await pool.query("SELECT migration_name FROM schema_migrations WHERE migration_name IN ('114_wallet_pin_attempts.js','115_wallet_identity_credit_override.js','116_durable_chain_operations.js','117_payment_recovery_controls.js')");
        add('Migraciones 114–117 aplicadas',migrations.rowCount===4);
        const duplicates=await pool.query('SELECT LOWER(web3_wallet_address) FROM users WHERE web3_wallet_address IS NOT NULL GROUP BY 1 HAVING COUNT(*)>1 LIMIT 1');
        add('Identidades sin billeteras duplicadas',duplicates.rowCount===0);
        const status=await pool.query("SELECT setting_key,setting_value FROM app_settings WHERE setting_key LIKE 'gas_sponsor_%'");
        const s=Object.fromEntries(status.rows.map(x=>[x.setting_key,x.setting_value]));
        add('Patrocinio habilitado y financiado',s.gas_sponsor_enabled==='true'&&BigInt(s.gas_sponsor_daily_budget_wei||'0')>0n&&BigInt(s.gas_sponsor_max_topup_wei||'0')>0n);
    }catch{add('Base de datos preparada',false);}
    return {ready:checks.every(x=>x.ready),checks};
}
if(require.main===module)inspect().then(result=>{console.log(JSON.stringify(result,null,2));process.exitCode=result.ready?0:1;}).catch(()=>{console.error('No se pudo completar la comprobación.');process.exitCode=1;}).finally(()=>pool.end());
module.exports={inspect};
