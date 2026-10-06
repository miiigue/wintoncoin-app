'use strict';
// Read-only. Never signs, sends transactions or prints RPC credentials.
const {JsonRpcProvider}=require('ethers');
const policy=require('../src/services/safeAccountPolicy');
(async()=>{
 let rpc;
 try{
  const config=policy.configuration();
  rpc=new JsonRpcProvider(process.env.OPTIMISM_RPC_URL||config.publicRpcUrl);
  await policy.validateInfrastructure(rpc,config);
  console.log(JSON.stringify({ready:true,chainId:String(config.chainId),manifestHash:config.hash,recoveryDelaySeconds:config.recoveryDelaySeconds,assistedRecoveryEnabled:false}));
 }catch(e){console.error(JSON.stringify({ready:false,message:e.status?e.message:'Configuración incompleta o infraestructura no verificable.'}));process.exitCode=1;}
 finally{rpc?.destroy();}
})();
