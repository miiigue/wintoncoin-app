'use strict';
const {readFileSync}=require('fs');
const path=require('path');
const {Contract,Interface,getAddress,keccak256,toUtf8Bytes,ZeroAddress}=require('ethers');
const {error}=require('./chainOperationStore');
const abi=[
 'function nonce() view returns(uint256)','function VERSION() view returns(string)',
 'function getOwners() view returns(address[])','function getThreshold() view returns(uint256)',
 'function getModulesPaginated(address,uint256) view returns(address[],address)',
 'function getStorageAt(uint256,uint256) view returns(bytes)',
 'function getTransactionHash(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,uint256) view returns(bytes32)',
 'function execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes) payable returns(bool)',
 'function setup(address[],uint256,address,bytes,address,address,uint256,address)',
 'function enableModule(address)'
];
const recoveryAbi=[
 'function getGuardians(address) view returns(address[])','function threshold(address) view returns(uint256)',
 'function addGuardianWithThreshold(address,uint256)',
 'function getRecoveryRequest(address) view returns(tuple(uint256 guardiansApprovalCount,uint256 newThreshold,uint64 executeAfter,address[] newOwners))',
 'function nonce(address) view returns(uint256)',
 'function getRecoveryHash(address,address[],uint256,uint256) view returns(bytes32)',
 'function multiConfirmRecovery(address,address[],uint256,tuple(address signer,bytes signature)[],bool)',
 'function finalizeRecovery(address)','function cancelRecovery()'
];
const SENTINEL='0x0000000000000000000000000000000000000001';
function configuration(env=process.env) {
    // Only an explicitly selected test network may use the versioned Demo deployment.
    // An explicit custom path always wins and an invalid path never falls back.
    const file=env.SMART_ACCOUNT_MANIFEST || (String(env.WINTON_CHAIN_ID)==='11155420'
        ? path.resolve(__dirname,'../../config/accounts/optimism-sepolia.json') : null);
    if(!file)throw error('La activación de cuentas recuperables está pendiente de configurar y verificar.',503);
    const c=JSON.parse(readFileSync(file,'utf8'));
    if(env.WINTON_CHAIN_ID && String(env.WINTON_CHAIN_ID)!==String(c.chainId))throw error('La red de la cuenta no coincide con la configuración del servicio.',503);
    if(c.version!==1||!['10','11155420','31337','1337'].includes(String(c.chainId))||c.safeVersion!=='1.4.1')throw error('Manifiesto de cuentas no admitido.',503);
    for(const key of ['singleton','factory','fallbackHandler','passkeyFactory','passkeyVerifier','recoveryModule']) {
        const item=c.contracts?.[key];
        if(!item||getAddress(item.address)===ZeroAddress||!/^0x[0-9a-f]{64}$/i.test(item.codeHash))throw error('Falta verificar el contrato '+key,503);
    }
    if(!/^0x[0-9a-f]{64}$/i.test(c.proxyCodeHash||''))throw error('Falta verificar el código de la cuenta.',503);
    if(!Number.isInteger(c.recoveryDelaySeconds)||c.recoveryDelaySeconds<86400)throw error('Plazo de recuperación inseguro.',503);
    if(!c.publicRpcUrl||!/^https:\/\//.test(c.publicRpcUrl)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(c.publicRpcUrl))throw error('RPC público no configurado.',503);
    return {...c,hash:keccak256(toUtf8Bytes(JSON.stringify(c)))};
}
async function validateInfrastructure(rpc,config) {
    if(String((await rpc.getNetwork()).chainId)!==String(config.chainId))throw error('Red de recuperación incorrecta.',503);
    for(const [name,item] of Object.entries(config.contracts)) {
        const code=await rpc.getCode(item.address);
        if(code==='0x'||keccak256(code).toLowerCase()!==item.codeHash.toLowerCase())throw error('No se pudo verificar '+name,503);
    }
    // The official module does not expose its immutable delay. The manifest must
    // come from a reviewed deployment artifact, with a pinned runtime code hash.
    if(!config.recoveryDeploymentEvidence)throw error('Falta la evidencia del plazo del módulo de recuperación.',503);
}
function transaction(call,nonce) {
    // Zero refund fields: sponsored calls can never charge/refund from user funds.
    return {to:getAddress(call.to),value:String(call.value||'0'),data:call.data,operation:0,
        safeTxGas:'0',baseGas:'0',gasPrice:'0',gasToken:ZeroAddress,refundReceiver:ZeroAddress,nonce:String(nonce)};
}
function args(tx){return [tx.to,tx.value,tx.data,tx.operation,tx.safeTxGas,tx.baseGas,tx.gasPrice,tx.gasToken,tx.refundReceiver];}
function execution(account,tx,signature) {
    if(typeof signature!=='string'||!/^0x(?:[0-9a-f]{2}){65,16384}$/i.test(signature))throw error('Autorización inválida.',400);
    return {to:account,value:'0',data:new Interface(abi).encodeFunctionData('execTransaction',[...args(tx),signature]),label:'Operación autorizada en el dispositivo'};
}
async function validateAccount(rpc,config,account,{allowUnconfiguredRecovery=false}={}) {
    await validateInfrastructure(rpc,config);
    const safe=new Contract(account.address,abi,rpc);
    const code=await rpc.getCode(account.address);
    if(code==='0x'||keccak256(code)!==config.proxyCodeHash)throw error('Código de cuenta no verificado.');
    const handler=await rpc.getStorage(account.address,keccak256(toUtf8Bytes('fallback_manager.handler.address')));
    const guard=await rpc.getStorage(account.address,keccak256(toUtf8Bytes('guard_manager.guard.address')));
    if(getAddress('0x'+handler.slice(-40))!==getAddress(config.contracts.fallbackHandler.address)||BigInt(guard)!==0n)throw error('La cuenta tiene extensiones no verificadas.');
    const owners=await safe.getOwners();
    if(owners.length!==1||owners[0].toLowerCase()!==account.passkey.owner.toLowerCase())throw error('El acceso cambió; concilia la recuperación antes de operar.');
    // Safe proxy slot 0 is its singleton. Reject other account implementations.
    const singleton=await rpc.getStorage(account.address,0);
    if(getAddress('0x'+singleton.slice(-40))!==getAddress(config.contracts.singleton.address))throw error('Implementación de cuenta no admitida.');
    if(await safe.VERSION()!==config.safeVersion||await safe.getThreshold()!==1n)throw error('Configuración de cuenta pendiente de revisión.');
    const [modules,next]=await safe.getModulesPaginated(SENTINEL,10);
    if(next.toLowerCase()!==SENTINEL||modules.some(m=>m.toLowerCase()!==config.contracts.recoveryModule.address.toLowerCase()))throw error('La cuenta tiene permisos adicionales no verificados.');
    if(!allowUnconfiguredRecovery) {
        if(modules.length!==1)throw error('Completa el respaldo de recuperación.');
        const recovery=new Contract(config.contracts.recoveryModule.address,recoveryAbi,rpc);
        const guardians=await recovery.getGuardians(account.address);
        if(guardians.length!==1||guardians[0].toLowerCase()!==account.recovery_address.toLowerCase()||await recovery.threshold(account.address)!==1n)throw error('Respaldo de recuperación pendiente de verificar.');
    }
    return safe;
}
module.exports={abi,recoveryAbi,SENTINEL,configuration,validateInfrastructure,validateAccount,transaction,args,execution};
