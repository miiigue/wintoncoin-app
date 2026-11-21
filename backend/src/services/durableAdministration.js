'use strict';
const {Wallet,parseUnits,Contract}=require('ethers');
const {randomUUID}=require('crypto');
const pool=require('../config/db');
const deployment=require('./marketplaceDeployment');
const {ChainOperationStore,locked,publicResult}=require('./chainOperationStore');
const {signStep}=require('./chainSigning');
const RISK_REGISTRY_V6_ABI=[
    'function profile(address) view returns (tuple(uint128 creditLimit, uint8 level, bool kycVerified))',
    'function setProfile(address account, bool verified, uint128 newCreditLimit, uint8 level)',
    'function owner() view returns (address)'
];
async function execute(bridge,contract,method,args,projection={},resource) {
    const config=await deployment.validate(bridge.provider);
    await require('./economicWriteGate').assertOperational({pool,config,operation:method});
    if(!process.env.ADMIN_CHAIN_PRIVATE_KEY)throw Object.assign(new Error('Falta configurar el firmante administrativo de blockchain.'),{status:503});
    if(['RELAYER_PRIVATE_KEY','GAS_SPONSOR_PRIVATE_KEY'].some(key=>process.env[key] && new Wallet(process.env[key]).address===new Wallet(process.env.ADMIN_CHAIN_PRIVATE_KEY).address))
        throw Object.assign(new Error('Administración, pagos y patrocinio requieren firmantes separados.'),{status:503});
    const signer=new Wallet(process.env.ADMIN_CHAIN_PRIVATE_KEY);
    const store=new ChainOperationStore(pool,bridge.provider);
    const target=await contract.getAddress();
    const owner=await new Contract(target,['function owner() view returns(address)'],bridge.provider).owner();
    if(owner.toLowerCase()!==signer.address.toLowerCase())throw Object.assign(new Error('El firmante configurado no tiene permiso de administración sobre este contrato.'),{status:503});
    const resourceKey=resource||'admin:'+target.toLowerCase()+':'+method;
    const active=await pool.query("SELECT * FROM chain_operations WHERE chain_id=$1 AND resource_key=$2 AND state IN ('pending','conflict') ORDER BY created_at LIMIT 1",[config.chainId,resourceKey]);
    if(active.rowCount)return {...publicResult(active.rows[0]),success:true,pending:true};
    const data=contract.interface.encodeFunctionData(method,args);
    const row=await store.prepare({key:'admin:'+randomUUID(),chainId:config.chainId,sender:signer.address,resource:resourceKey,kind:method,
        payload:{to:target,data,fingerprint:config.fingerprint},projection});
    const result=await store.authorize(row.id,null,async()=>[await signStep(bridge.provider,signer,{to:target,data,value:'0',label:method},config.chainId,process.env.ADMIN_MAX_STEP_FEE_WEI || '1000000000000000')]);
    return {...result,success:result.success||result.pending,pending:result.pending};
}
async function credit(bridge,wallet,amount,{manual=true,alreadyLocked=false}={}) {
    const act=async()=>{
        const config=await deployment.validate(bridge.provider);
        const projection=manual?{type:'credit_manual',value:String(amount),wallet}:{};
        const resource='credit:'+wallet.toLowerCase();
        if(deployment.isV6Epoch(config.epoch)) {
            const risk=new Contract(config.contracts.RiskRegistry,RISK_REGISTRY_V6_ABI,bridge.provider);
            const current=await risk.profile(wallet);
            return execute(
                bridge,
                risk,
                'setProfile',
                [wallet,Boolean(current.kycVerified),parseUnits(String(amount),6),Number(current.level)],
                projection,
                resource
            );
        }
        return execute(bridge,bridge._getProtocol(),'setCreditLimit',[wallet,parseUnits(String(amount),6)],projection,resource);
    };
    return alreadyLocked?act():locked(pool,'credit:'+wallet.toLowerCase(),act);
}
async function reconcile() {
    const rpc=deployment.provider();
    try {
        const result=await new ChainOperationStore(pool,rpc).sweep();
        const migrations=await require('./legacyMigrationExecution').sweep(pool,rpc);
        return {...result,migrations};
    }finally{rpc.destroy();}
}
module.exports={execute,credit,reconcile};
