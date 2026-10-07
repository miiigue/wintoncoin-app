'use strict';
const {randomUUID}=require('crypto');
const {Contract,Interface,recoverAddress}=require('ethers');
const {generateRegistrationOptions,verifyRegistrationResponse}=require('@simplewebauthn/server');
const {decodeCredentialPublicKey}=require('@simplewebauthn/server/helpers');
const {error}=require('./chainOperationStore');
const signing=require('./safeExecution');
const policy=require('./safeAccountPolicy');
const emergency=require('./recoveryEmergency');
const passkeyAbi=['function getSigner(uint256,uint256,uint176) view returns(address)','function createSigner(uint256,uint256,uint176) returns(address)'];

// Recovery changes only the Safe owner. Identity, account address and economic
// contracts are never rewritten. The module enforces the delay on-chain.
class PersonalRecovery {
 constructor(accounts){Object.assign(this,{pool:accounts.pool,rpc:accounts.rpc,config:accounts.config,store:accounts.store});}
 async options(userId,rp){
  const a=await signing.account(this.pool,userId,this.config.chainId);
  await policy.validateAccount(this.rpc,this.config,a);
  const id=randomUUID();
  const options=await generateRegistrationOptions({rpName:'WintonCoin',rpID:rp.rpId,userID:String(userId)+':recovery:'+id,userName:'WintonCoin '+userId+' (recuperación)',
   supportedAlgorithmIDs:[-7],attestationType:'none',authenticatorSelection:{residentKey:'required',userVerification:'required'}});
  await this.pool.query("INSERT INTO account_security_challenges(id,user_id,purpose,payload,expires_at) VALUES($1,$2,'recover',$3,NOW()+INTERVAL '15 minutes')",
   [id,userId,JSON.stringify({options,rp,account:a.address,manifestHash:this.config.hash})]);
  return {id,options,address:a.address};
 }
 async prepare(userId,{id,response}){
  const a=await signing.account(this.pool,userId,this.config.chainId);
  await policy.validateAccount(this.rpc,this.config,a);
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   const c=(await client.query("SELECT * FROM account_security_challenges WHERE id=$1 AND user_id=$2 AND purpose='recover' AND consumed_at IS NULL AND expires_at>NOW() FOR UPDATE",[id,userId])).rows[0];
   if(!c||c.payload.manifestHash!==this.config.hash||c.payload.account!==a.address)throw error('La solicitud venció o cambió la cuenta.');
   if(c.payload.recovery)throw error('El nuevo dispositivo ya está preparado.');
   const v=await verifyRegistrationResponse({response,expectedChallenge:c.payload.options.challenge,expectedOrigin:c.payload.rp.origin,expectedRPID:c.payload.rp.rpId,requireUserVerification:true});
   if(!v.verified)throw error('Dispositivo no verificado.');
   const key=decodeCredentialPublicKey(v.registrationInfo.credentialPublicKey);
   if(key.get(1)!==2||key.get(3)!==-7||key.get(-1)!==1)throw error('Firma no compatible.');
   const coordinates={x:'0x'+Buffer.from(key.get(-2)).toString('hex'),y:'0x'+Buffer.from(key.get(-3)).toString('hex')};
   const verifier=this.config.contracts.passkeyVerifier.address;
   const factory=new Contract(this.config.contracts.passkeyFactory.address,passkeyAbi,this.rpc);
   const owner=await factory.getSigner(coordinates.x,coordinates.y,verifier);
   if(owner.toLowerCase()===a.passkey.owner.toLowerCase())throw error('Selecciona un acceso nuevo.');
   const module=new Contract(this.config.contracts.recoveryModule.address,policy.recoveryAbi,this.rpc);
   const nonce=String(await module.nonce(a.address));
   const digest=await module.getRecoveryHash(a.address,[owner],1,nonce);
   const passkey={rawId:Buffer.from(v.registrationInfo.credentialID).toString('hex'),coordinates,verifierAddress:verifier,rpId:c.payload.rp.rpId,owner};
   const recovery={passkey,nonce,digest};
   await client.query('UPDATE account_security_challenges SET payload=payload||$2::jsonb WHERE id=$1',[id,JSON.stringify({recovery})]);
   await client.query('COMMIT');
   return {id,digest,address:a.address,recoveryAddress:a.recovery_address,newOwner:owner,nonce,chainId:String(this.config.chainId),module:this.config.contracts.recoveryModule.address};
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 async submit(userId,{id,signature}){
  const a=await signing.account(this.pool,userId,this.config.chainId);
  await policy.validateAccount(this.rpc,this.config,a);
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   const c=(await client.query("SELECT * FROM account_security_challenges WHERE id=$1 AND user_id=$2 AND purpose='recover' AND consumed_at IS NULL AND expires_at>NOW() FOR UPDATE",[id,userId])).rows[0];
   const r=c?.payload.recovery;
   if(!r||c.payload.manifestHash!==this.config.hash||c.payload.account!==a.address)throw error('Solicitud inválida o vencida.');
   if(recoverAddress(r.digest,signature).toLowerCase()!==a.recovery_address)throw error('El respaldo no corresponde a esta cuenta.');
   const module=new Contract(this.config.contracts.recoveryModule.address,policy.recoveryAbi,this.rpc);
   if(String(await module.nonce(a.address))!==r.nonce)throw error('Ya existe otra solicitud de recuperación.');
   const plan=[{to:this.config.contracts.passkeyFactory.address,value:'0',data:new Interface(passkeyAbi).encodeFunctionData('createSigner',[r.passkey.coordinates.x,r.passkey.coordinates.y,r.passkey.verifierAddress]),label:'Preparar nuevo dispositivo'},
    {to:this.config.contracts.recoveryModule.address,value:'0',data:new Interface(policy.recoveryAbi).encodeFunctionData('multiConfirmRecovery',[a.address,[r.passkey.owner],1,[{signer:a.recovery_address,signature}],true]),label:'Solicitar recuperación con espera'}];
   await client.query("INSERT INTO account_recovery_cases(id,identity_id,chain_id,terms_version,payload) VALUES($1,$2,$3,'personal-v1',$4)",[id,a.identity_id,String(this.config.chainId),JSON.stringify({passkey:r.passkey,nonce:r.nonce,account:a.address})]);
   await client.query(`INSERT INTO chain_operations(id,user_id,request_key,chain_id,sender,resource_key,kind,payload,projection,state)
    VALUES($1,$2,$3,$4,$5,$6,'accountRecovery',$7,'{}','prepared')`,[id,userId,'recovery:'+id,String(this.config.chainId),signing.relayer().address.toLowerCase(),'account:'+a.address,JSON.stringify({plan,planLength:2,manifestHash:this.config.hash})]);
   await client.query('UPDATE account_security_challenges SET consumed_at=NOW() WHERE id=$1',[id]);
   await client.query('INSERT INTO account_security_events(identity_id,event_type,actor_id,details) VALUES($1,$2,$3,$4)',[a.identity_id,'recovery_requested',String(userId),JSON.stringify({caseId:id})]);
   await client.query('COMMIT');return {id,message:'Solicitud preparada. Tu dirección y compromisos se conservan.'};
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 async advance(userId,id){
  const row=await this.store.get(id,userId);
  if(!['accountRecovery','accountRecoveryFinalize'].includes(row.kind)||row.payload.manifestHash!==this.config.hash)throw error('Recuperación inválida.');
  await policy.validateInfrastructure(this.rpc,this.config);
  await this.store.reconcile(id);
  return this.store.authorize(id,userId,async fresh=>{
   const call=fresh.payload.plan[fresh.steps.length];
   if(!call)throw error('No hay un paso pendiente.');
   await this.rpc.call({...call,from:signing.relayer().address});
   return [await signing.sponsoredStep(this.pool,this.rpc,this.config.chainId,userId,fresh,call)];
  });
 }
 async status(userId){
  const a=await signing.account(this.pool,userId,this.config.chainId);
  const c=(await this.pool.query("SELECT * FROM account_recovery_cases WHERE identity_id=$1 AND chain_id=$2 ORDER BY created_at DESC LIMIT 1",[a.identity_id,String(this.config.chainId)])).rows[0];
  await policy.validateInfrastructure(this.rpc,this.config);
  const confirmedTag=['31337','1337'].includes(String(this.config.chainId))?'latest':'safe';
  const module=new Contract(this.config.contracts.recoveryModule.address,policy.recoveryAbi,this.rpc);
  const pending=await module.getRecoveryRequest(a.address,{blockTag:confirmedTag});
  const external=pending.executeAfter>0n&&(!c||['confirmed','cancelled','rejected'].includes(c.state)||pending.newOwners.length!==1||pending.newOwners[0].toLowerCase()!==c.payload.passkey.owner.toLowerCase()||pending.newThreshold!==1n);
  if(external)return {recovery:{id:'external',state:'external',executeAfter:String(pending.executeAfter),ready:false,message:'Hay una recuperación registrada fuera de esta aplicación. Si no la reconoces, cancélala con tu dispositivo actual.'}};
  if(!c)return {recovery:null};
  const request=await this.store.reconcile(c.id);
  if(!request.success){
   const state=request.state==='failed'?'rejected':request.state==='abandoned'?'cancelled':request.state;
   if(['rejected','cancelled'].includes(state))await this.pool.query('UPDATE account_recovery_cases SET state=$2 WHERE id=$1',[c.id,state]);
   return {recovery:{id:c.id,operationId:c.id,state,message:request.message}};
  }
  if(c.payload.finalizeId)await this.store.reconcile(c.payload.finalizeId);
  if(c.payload.cancelId)await this.store.reconcile(c.payload.cancelId);
  const safe=new Contract(a.address,policy.abi,this.rpc),owners=await safe.getOwners({blockTag:confirmedTag});
  if(owners.length===1&&owners[0].toLowerCase()===c.payload.passkey.owner.toLowerCase()){
   // Require the finalized Safe itself to satisfy the unchanged security policy.
   await policy.validateAccount(this.rpc,this.config,{...a,passkey:c.payload.passkey});
   const client=await this.pool.connect();
   try{
    await client.query('BEGIN');
    await client.query('SELECT id FROM account_recovery_cases WHERE id=$1 FOR UPDATE',[c.id]);
    await client.query('UPDATE smart_accounts SET passkey=$1 WHERE identity_id=$2 AND chain_id=$3',[JSON.stringify(c.payload.passkey),a.identity_id,String(this.config.chainId)]);
    await client.query("UPDATE account_recovery_cases SET state='confirmed' WHERE id=$1",[c.id]);
    await client.query('COMMIT');
   }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
   return {recovery:{id:c.id,state:'confirmed',message:'Acceso recuperado. Se conservan la dirección, los saldos y los compromisos.'}};
  }
  if(c.state==='confirmed')throw error('El acceso cambió después de recuperar la cuenta. Requiere revisión.');
  if(pending.executeAfter===0n){
   await this.pool.query("UPDATE account_recovery_cases SET state='cancelled' WHERE id=$1",[c.id]);
   return {recovery:{id:c.id,state:'cancelled',message:'Solicitud cancelada en blockchain.'}};
  }
  if(pending.newOwners.length!==1||pending.newOwners[0].toLowerCase()!==c.payload.passkey.owner.toLowerCase()||pending.newThreshold!==1n)throw error('Existe una solicitud distinta en blockchain.');
  const block=await this.rpc.getBlock('latest');
  return {recovery:{id:c.id,state:'waiting',executeAfter:String(pending.executeAfter),ready:BigInt(block.timestamp)>=pending.executeAfter,operationId:c.payload.finalizeId||null,message:'La espera de seguridad está registrada en blockchain.'}};
 }
 async finalize(userId,id){
  const state=(await this.status(userId)).recovery;
  if(state?.id!==id||!state.ready)throw error('La recuperación no está lista.');
  const previous=(await this.pool.query("SELECT id FROM chain_operations WHERE request_key=$1 AND user_id=$2",['recovery-finalize:'+id,userId])).rows[0];
  const operationId=previous?.id||randomUUID();
  const call={to:this.config.contracts.recoveryModule.address,value:'0',data:new Interface(policy.recoveryAbi).encodeFunctionData('finalizeRecovery',[(await signing.account(this.pool,userId,this.config.chainId)).address]),label:'Finalizar recuperación'};
  await this.store.prepare({id:operationId,userId,key:'recovery-finalize:'+id,chainId:String(this.config.chainId),sender:signing.relayer().address,resource:'recovery:'+id,kind:'accountRecoveryFinalize',payload:{manifestHash:this.config.hash,plan:[call],planLength:1}});
  await this.pool.query('UPDATE account_recovery_cases SET payload=payload||$2::jsonb WHERE id=$1',[id,JSON.stringify({finalizeId:operationId})]);
  return this.advance(userId,operationId);
 }
 async cancelQuote(userId,id){
  const state=(await this.status(userId)).recovery;
  if(state?.id!==id||!['waiting','external'].includes(state.state))throw error('No hay una recuperación cancelable.');
  const call={to:this.config.contracts.recoveryModule.address,value:'0',data:new Interface(policy.recoveryAbi).encodeFunctionData('cancelRecovery',[]),label:'Cancelar recuperación'};
  return signing.quote(this.pool,this.rpc,this.config,userId,call);
 }
 async cancel(userId,id,{hash,signature}){
  const quote=await this.cancelQuote(userId,id);
  if(quote.hash!==hash)throw error('La autorización cambió.');
  const account=await signing.account(this.pool,userId,this.config.chainId);
  const module=new Contract(this.config.contracts.recoveryModule.address,policy.recoveryAbi,this.rpc);
  const key='recovery-cancel:'+account.address+':'+String(await module.nonce(account.address));
  const previous=(await this.pool.query('SELECT * FROM chain_operations WHERE request_key=$1 AND user_id=$2',[key,userId])).rows[0];
  const operationId=previous?.id||randomUUID();
  if(previous&&previous.payload.authorization.hash!==quote.hash)throw error('La cuenta cambió. Revisa la cancelación pendiente o utiliza otra billetera.');
  const row=previous||await this.store.prepare({id:operationId,userId,key,chainId:String(this.config.chainId),sender:emergency.signer().address,resource:'recovery:'+id,kind:'accountRecoveryCancel',payload:{manifestHash:this.config.hash,authorization:quote}});
  if(id!=='external')await this.pool.query('UPDATE account_recovery_cases SET payload=payload||$2::jsonb WHERE id=$1',[id,JSON.stringify({cancelId:row.id})]);
  return this.store.authorize(row.id,userId,async fresh=>{
   const call=await signing.build(this.rpc,this.config,fresh.payload.authorization,signature,emergency.signer());
   return [await emergency.sponsor(this.pool,this.rpc,this.config,fresh,call)];
  });
 }
}
module.exports={PersonalRecovery};
