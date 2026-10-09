'use strict';
const {Wallet,Interface,ZeroAddress}=require('ethers');
const {locked,error}=require('./chainOperationStore');
const policy=require('./safeAccountPolicy');
const {signStep}=require('./chainSigning');
/**
 * Obtiene y valida la billetera ejecutora de cancelaciones de emergencia.
 * Cumpliendo con el estándar bancario de Segregación Estricta de Funciones (Segregation of Duties - SoD)
 * y arquitectura Zero-Trust, el ejecutor de contingencia debe ser 100% independiente de:
 * 1. El relayer ordinario de transacciones comerciales (RELAYER_PRIVATE_KEY).
 * 2. El administrador de contratos en la cadena (ADMIN_CHAIN_PRIVATE_KEY).
 * 3. El patrocinador general de gas para operaciones de usuario (GAS_SPONSOR_PRIVATE_KEY).
 *
 * @param {object} env Variables de entorno
 * @returns {Wallet} Instancia ethers.Wallet del ejecutor de emergencia
 */
function signer(env=process.env){
 if(!env.RECOVERY_RELAYER_PRIVATE_KEY)throw error('El envío de emergencia no está configurado. Utiliza la opción de otra billetera.',503);
 const wallet=new Wallet(env.RECOVERY_RELAYER_PRIVATE_KEY);
 
 // Lista de roles con los que bajo ninguna circunstancia debe colisionar el ejecutor de emergencia
 const conflictingRoles=['RELAYER_PRIVATE_KEY','ADMIN_CHAIN_PRIVATE_KEY','GAS_SPONSOR_PRIVATE_KEY'];
 for(const role of conflictingRoles){
  if(env[role]){
   try{
    if(wallet.address.toLowerCase()===new Wallet(env[role]).address.toLowerCase()){
     throw error('El ejecutor de emergencia debe ser independiente del habitual, administrativo y de patrocinio.',503);
    }
   }catch(err){
    if(err.status===503)throw err;
   }
  }
 }
 if(env.RECOVERY_RELAYER_ADDRESS && wallet.address.toLowerCase() !== env.RECOVERY_RELAYER_ADDRESS.toLowerCase()){
  throw error('La dirección pública de emergencia no coincide con la clave privada configurada.',503);
 }
 return wallet;
}
function assertCancellation(config,row,call){
 const auth=row.payload.authorization;
 if(row.kind!=='accountRecoveryCancel'||auth?.chainId!==String(config.chainId)||auth.manifestHash!==config.hash||call.to.toLowerCase()!==auth.account.toLowerCase()||BigInt(call.value||0)!==0n)throw error('Envío de emergencia no permitido.');
 const args=new Interface(policy.abi).decodeFunctionData('execTransaction',call.data);
 const cancel=new Interface(policy.recoveryAbi).encodeFunctionData('cancelRecovery',[]);
 if(args[0].toLowerCase()!==config.contracts.recoveryModule.address.toLowerCase()||args[1]!==0n||args[2]!==cancel||args[3]!==0n||args[4]!==0n||args[5]!==0n||args[6]!==0n||args[7]!==ZeroAddress||args[8]!==ZeroAddress)throw error('Solo se patrocina cancelar la recuperación, sin pagos ni reembolsos.');
}
async function sponsor(pool,rpc,config,row,call,env=process.env){
 assertCancellation(config,row,call);
 const executor=signer(env);
 if(row.sender.toLowerCase()!==executor.address.toLowerCase())throw error('El ejecutor de emergencia cambió.');
 const max=BigInt(env.RECOVERY_GAS_MAX_WEI||'0'),cap=BigInt(env.RECOVERY_GAS_DAILY_WEI||'0');
 if(max<=0n||cap<max)throw error('Falta presupuesto de emergencia. Puedes enviar con otra billetera.',503);
 return locked(pool,'recovery-gas:'+config.chainId,async client=>{
  const used=(await client.query(`SELECT COALESCE(SUM((payload->>'emergencyReservedWei')::numeric),0)::text AS total FROM chain_operations
   WHERE chain_id=$1 AND kind='accountRecoveryCancel' AND
   (payload->>'emergencyBudgetDay'=to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD') OR state IN ('pending','conflict'))`,[String(config.chainId)])).rows[0];
  if(BigInt(used.total)+max>cap)throw error('Presupuesto de emergencia agotado. Puedes enviar con otra billetera.',429);
  // No daily payment quota is consulted. Signature and contract conditions were
  // simulated before reserving gas; journal persistence still precedes broadcast.
  const step=await signStep(rpc,executor,call,String(config.chainId),max.toString());
  const reserved=await client.query(`UPDATE chain_operations SET payload=payload||jsonb_build_object(
   'emergencyReservedWei',(COALESCE((payload->>'emergencyReservedWei')::numeric,0)+$2::numeric)::text,
   'emergencyBudgetDay',to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD')) WHERE id=$1`,[row.id,max.toString()]);
  if(reserved.rowCount!==1)throw error('No se pudo reservar el envío de emergencia.');
  return step;
 });
}
module.exports={signer,assertCancellation,sponsor};
