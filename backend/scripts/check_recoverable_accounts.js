'use strict';
// Read-only. Never signs, sends transactions or prints RPC credentials.
const {JsonRpcProvider}=require('ethers');
const policy=require('../src/services/safeAccountPolicy');
(async()=>{
 let rpc;
 try{
  if((process.env.IDENTITY_DOCUMENT_HMAC_KEY||'').length<32)throw Object.assign(new Error('Falta configurar la protección de identidad.'),{status:503});
  const emergency=require('../src/services/recoveryEmergency').signer();
  const max=BigInt(process.env.RECOVERY_GAS_MAX_WEI||'0'),daily=BigInt(process.env.RECOVERY_GAS_DAILY_WEI||'0');
  if(max<=0n||daily<max)throw Object.assign(new Error('Falta presupuesto válido de emergencia.'),{status:503});
  const config=policy.configuration();
  rpc=new JsonRpcProvider(process.env.OPTIMISM_RPC_URL||config.publicRpcUrl);
  await policy.validateInfrastructure(rpc,config);
  if(await rpc.getBalance(emergency.address)<max)throw Object.assign(new Error('El ejecutor de emergencia no tiene fondos suficientes.'),{status:503});
  console.log(JSON.stringify({ready:true,scope:'infrastructure-only',manualDeviceTestsRequired:true,legacyMigrationEnabled:false,chainId:String(config.chainId),manifestHash:config.hash,recoveryDelaySeconds:config.recoveryDelaySeconds,assistedRecoveryEnabled:false}));
 }catch(e){console.error(JSON.stringify({ready:false,message:e.status?e.message:'Configuración incompleta o infraestructura no verificable.'}));process.exitCode=1;}
 finally{rpc?.destroy();}
})();
