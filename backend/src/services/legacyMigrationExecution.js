'use strict';
// Transitional rescue only. No endpoint accepts a destination, amount or user key.
// New Safe credentials are never decrypted or held by this service.
const crypto=require('crypto');
const {Wallet,Contract,Interface,Transaction,keccak256}=require('ethers');
const {error,locked}=require('./chainOperationStore');
const chainSigning=require('./chainSigning');
const deployment=require('./chainDeployment');
const inspection=require('./legacyWalletMigration');
const policy=require('./safeAccountPolicy');
const signing=require('./safeExecution');
const tokenAbi=new Interface(['function transfer(address,uint256) returns(bool)','event Transfer(address indexed from,address indexed to,uint256 value)']);
const coreAbi=new Interface(['function setKYCStatus(address,bool)','function setCreditLimit(address,uint256)','function setUserBenefits(address,uint8,uint256)']);
const views=['function owner() view returns(address)','function isKYCVerified(address) view returns(bool)',
 ...['creditLimits','userLevels','extensionMarginLimits','extensionMarginUsed','paymentNonces','getUserDebtLotsCount'].map(n=>'function '+n+'(address) view returns(uint256)')];
function legacySigner(user,env=process.env){
 try{
  if(user.has_transaction_pin||user.web3_keystore||typeof user.web3_private_key_encrypted!=='string'||!user.web3_private_key_encrypted)throw Error();
  const value=user.web3_private_key_encrypted;let plaintext;
  // The first deployed generator stored a raw key when no master secret existed.
  // Read only existing server material for migration; never create this format
  // or accept a key from the client. The address check below remains mandatory.
  if(/^(0x)?[a-fA-F0-9]{64}$/.test(value)){
   plaintext=value.startsWith('0x')?value:'0x'+value;
  }else{
  if(!env.ENCRYPTION_SECRET||env.ENCRYPTION_SECRET.length<32)throw Error();
  if(value.startsWith('v2:')){
   const box=JSON.parse(Buffer.from(value.slice(3),'base64').toString('utf8'));
   const key=crypto.scryptSync(env.ENCRYPTION_SECRET,'winton-wallet-envelope-v2',32);
   const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(box.iv,'hex'));
   decipher.setAuthTag(Buffer.from(box.authTag,'hex'));
   plaintext=Buffer.concat([decipher.update(Buffer.from(box.ciphertext,'hex')),decipher.final()]).toString('utf8');key.fill(0);
  }else{
   if(!/^[a-fA-F0-9]{32}:[a-fA-F0-9]+$/.test(value))throw Error();
   const [iv,ciphertext]=value.split(':');const key=crypto.scryptSync(env.ENCRYPTION_SECRET,'salt',32);
   const decipher=crypto.createDecipheriv('aes-256-cbc',key,Buffer.from(iv,'hex'));
   plaintext=Buffer.concat([decipher.update(Buffer.from(ciphertext,'hex')),decipher.final()]).toString('utf8');key.fill(0);
  }
  }
  const wallet=new Wallet(plaintext);plaintext=null;
  if(wallet.address.toLowerCase()!==user.web3_wallet_address.toLowerCase())throw Error();
  return wallet;
 }catch{throw error('No pudimos recuperar el acceso a la dirección anterior. Se conserva íntegra; soporte debe revisar su migración.',409);}
}
async function userRow(runner,userId){return (await runner.query('SELECT web3_wallet_address,web3_private_key_encrypted,web3_keystore,has_transaction_pin,account_status,kyc_verified FROM users WHERE id=$1',[userId])).rows[0];}
async function plan(service,runner,userId,address){
 const snapshot=await inspection.inspect({rpc:service.rpc,runner,userId,address,chainId:service.config.chainId,migration:{planning:true}});
 const config=deployment.configuration();
 if(config.chainId!==String(service.config.chainId))throw error('La red de migración no coincide.');
 const core=new Contract(config.contracts.CoreProtocol,views,service.rpc);
 const [limit,level,margin,used,nonce,lots]=await Promise.all(['creditLimits','userLevels','extensionMarginLimits','extensionMarginUsed','paymentNonces','getUserDebtLotsCount'].map(n=>core[n](address,{blockTag:snapshot.blockNumber})));
 // Do not reset repayment/credit histories, even when current balances are zero.
 if(used!==0n||nonce!==0n||lots!==0n)throw error('La cuenta tiene historial de compromisos. Requiere una migración específica que lo conserve.');
 if(snapshot.usdt.length){const u=await userRow(runner,userId);if(!u||u.account_status!=='active'||u.web3_wallet_address.toLowerCase()!==address.toLowerCase())throw error('La cuenta cambió.');legacySigner(u);}
 for(const suite of inspection.suites(service.config.chainId)){
  const past=new Contract(suite.CoreProtocol,views,service.rpc);
  for(const name of ['extensionMarginUsed','paymentNonces','getUserDebtLotsCount'])if(await past[name](address,{blockTag:snapshot.blockNumber})!==0n)throw error('Hay historial de compromisos que requiere conservarse.');
 }
 return {...snapshot,core:config.contracts.CoreProtocol.toLowerCase(),fingerprint:config.fingerprint,
  credit:{limit:String(limit),level:String(level),margin:String(margin)},restoreKyc:snapshot.authorizations.includes(config.contracts.CoreProtocol.toLowerCase())};
}
function terms(snapshot){if(!snapshot)return null;const {blockNumber,blockHash,...stable}=snapshot;return stable;}
function tasks(snapshot,target){
 const output=snapshot.authorizations.map((core,i)=>({key:'revoke-'+i,role:'admin',to:core,data:coreAbi.encodeFunctionData('setKYCStatus',[snapshot.address,false]),value:'0',label:'Deshabilitar dirección anterior'}));
 for(const [i,token] of snapshot.usdt.entries())output.push({key:'transfer-'+i,role:'legacy',to:token.token,data:tokenAbi.encodeFunctionData('transfer',[target,token.amount]),value:'0',amount:token.amount,label:'Trasladar USDT a tu nueva billetera'});
 if(snapshot.restoreKyc||BigInt(snapshot.credit.limit)>0n||BigInt(snapshot.credit.level)>0n||BigInt(snapshot.credit.margin)>0n){
  output.push({key:'credit',role:'admin',to:snapshot.core,data:coreAbi.encodeFunctionData('setCreditLimit',[target,snapshot.credit.limit]),value:'0',label:'Conservar tu límite aprobado'});
  output.push({key:'benefits',role:'admin',to:snapshot.core,data:coreAbi.encodeFunctionData('setUserBenefits',[target,snapshot.credit.level,snapshot.credit.margin]),value:'0',label:'Conservar tu nivel y beneficios'});
  if(snapshot.restoreKyc)output.push({key:'kyc',role:'admin',to:snapshot.core,data:coreAbi.encodeFunctionData('setKYCStatus',[target,true]),value:'0',label:'Habilitar tu nueva billetera'});
 }
 return output;
}
async function bound(service,parent,userId){
 if(parent.kind!=='accountActivation'||parent.user_id!==userId||parent.state!=='confirmed'||parent.chain_id!==String(service.config.chainId)||parent.payload.manifestHash!==service.config.hash)throw error('La activación no está confirmada.');
 const snapshot=parent.payload.legacyPlan;
 if(!snapshot||snapshot.address!==parent.payload.legacyAddress||snapshot.chainId!==String(service.config.chainId)||snapshot.fingerprint!==deployment.configuration().fingerprint)throw error('La configuración de migración cambió. Requiere revisión.');
 const user=await userRow(service.pool,userId);
 if(!user||user.account_status!=='active'||user.web3_wallet_address?.toLowerCase()!==snapshot.address)throw error('La cuenta cambió durante la migración.');
 const account=await signing.account(service.pool,userId,service.config.chainId,{active:false});
 if(account.state!=='prepared'||account.address.toLowerCase()!==parent.payload.account||!account.backup_confirmed_at||account.manifest_hash!==service.config.hash)throw error('El destino de migración no está comprobado.');
 await policy.validateAccount(service.rpc,service.config,account);
 return {snapshot,user,account};
}
async function children(service,parent){return (await service.pool.query("SELECT * FROM chain_operations WHERE payload->>'migrationParentId'=$1 ORDER BY created_at",[parent.id])).rows;}
async function verifyRecorded(service,row,expected){
 const step=row.steps?.[0];if(row.steps?.length!==1)throw error('Falta el comprobante de migración.');
 const tx=Transaction.from(step.raw);
 if(keccak256(step.raw)!==step.hash||tx.from?.toLowerCase()!==row.sender||String(tx.chainId)!==row.chain_id||tx.to?.toLowerCase()!==expected.to.toLowerCase()||tx.data!==expected.data||tx.value!==BigInt(expected.value))throw error('La transacción no coincide con el paso de migración.');
 const receipt=await require('./chainConfirmation').confirmedReceipt(service.rpc,step.hash,{finality:service.store.finality,confirmations:service.store.confirmations});
 if(!receipt||receipt.status!==1||receipt.blockHash!==step.blockHash)throw error('El paso de migración todavía no tiene confirmación definitiva.');
 return receipt;
}
async function verifyTransfer(service,row,task,snapshot,target){
 const {confirmedReceipt}=require('./chainConfirmation');
 const step=row.steps[0];if(!step)throw error('Falta el comprobante del traslado.');
 const receipt=await confirmedReceipt(service.rpc,step.hash,{finality:service.store.finality,confirmations:service.store.confirmations});
 if(!receipt||receipt.status!==1||receipt.blockHash!==step.blockHash)throw error('El traslado todavía no tiene confirmación definitiva.');
 const matches=receipt.logs.filter(log=>{
  if(log.address.toLowerCase()!==task.to.toLowerCase())return false;
  try{const e=tokenAbi.parseLog(log);return e.name==='Transfer'&&e.args.from.toLowerCase()===snapshot.address&&e.args.to.toLowerCase()===target&&e.args.value===BigInt(task.amount);}catch{return false;}
 });
 if(matches.length!==1)throw error('El comprobante no acredita el traslado completo de USDT. La dirección se conserva.');
}
async function status(service,parent,userId){
 const {snapshot}=await bound(service,parent,userId),target=parent.payload.account;
 const recorded=await children(service,parent);const sequence=tasks(snapshot,target);
 let nativeAllowance=0n,nonceAllowance=0n;
 for(const task of sequence){
  const row=recorded.find(r=>r.request_key==='legacy:'+parent.id+':'+task.key);
  const expected={to:task.to,data:task.data,value:task.value};
  if(row&&(row.kind!=='legacyMigration'||row.user_id!==userId||row.chain_id!==snapshot.chainId||row.payload.account!==target||JSON.stringify(row.payload.call)!==JSON.stringify(expected)))throw error('El registro de migración no coincide.');
  if(!row||row.state!=='confirmed')return {done:false,task,row,snapshot};
  await verifyRecorded(service,row,expected);
  // A successful receipt alone is insufficient for ERC20s returning false.
  if(task.role==='legacy'){await verifyTransfer(service,row,task,snapshot,target);nonceAllowance++;}
 }
 const funding=(await service.pool.query("SELECT * FROM chain_operations WHERE kind='gas' AND payload->>'parentId'=ANY($1::text[])",[recorded.map(r=>r.id)])).rows;
 for(const row of funding){if(row.state!=='confirmed')throw error('Hay patrocinio pendiente de confirmar.');if(row.payload.destination!==snapshot.address||row.user_id!==userId||row.chain_id!==snapshot.chainId)throw error('El destino del patrocinio no coincide.');await verifyRecorded(service,row,{to:snapshot.address,value:row.payload.amount,data:'0x'});nativeAllowance+=BigInt(row.payload.amount);}
 await inspection.inspect({rpc:service.rpc,runner:service.pool,userId,address:snapshot.address,chainId:snapshot.chainId,excludeOperationId:parent.id,migration:{nativeAllowance:String(nativeAllowance),nonceAllowance:String(nonceAllowance)}});
 if(sequence.some(t=>t.key==='credit')){const core=new Contract(snapshot.core,views,service.rpc);
  if((snapshot.restoreKyc&&!await core.isKYCVerified(target))||await core.creditLimits(target)!==BigInt(snapshot.credit.limit)||await core.userLevels(target)!==BigInt(snapshot.credit.level)||await core.extensionMarginLimits(target)!==BigInt(snapshot.credit.margin))throw error('Falta confirmar los permisos de la nueva billetera.');}
 return {done:true,evidence:{...snapshot,nativeAllowance:String(nativeAllowance),nonceAllowance:String(nonceAllowance),operations:recorded.map(r=>r.id)}};
}
async function beforeSigning(service,parent,userId,snapshot,task){
 const recorded=await children(service,parent);
 const confirmed=recorded.filter(r=>r.state==='confirmed');
 const funding=(await service.pool.query("SELECT * FROM chain_operations WHERE kind='gas' AND payload->>'parentId'=ANY($1::text[])",[recorded.map(r=>r.id)])).rows;
 let nativeAllowance=0n;
 for(const row of funding){
  if(row.state!=='confirmed')throw error('El patrocinio todavía está pendiente. Espera su confirmación.');
  if(row.user_id!==userId||row.chain_id!==snapshot.chainId||row.payload.destination!==snapshot.address)throw error('Patrocinio no vinculado a esta migración.');
  await verifyRecorded(service,row,{to:snapshot.address,value:row.payload.amount,data:'0x'});
  nativeAllowance+=BigInt(row.payload.amount);
 }
 const doneKeys=new Set(confirmed.map(r=>r.request_key));
 const pendingTokens=snapshot.usdt.filter((_,i)=>!doneKeys.has('legacy:'+parent.id+':transfer-'+i));
 const nonceAllowance=snapshot.usdt.length-pendingTokens.length;
 const current=await inspection.inspect({rpc:service.rpc,runner:service.pool,userId,address:snapshot.address,chainId:snapshot.chainId,excludeOperationId:parent.id,
  migration:{planning:true,nativeAllowance:String(nativeAllowance),nonceAllowance:String(nonceAllowance)}});
 if(JSON.stringify(current.usdt)!==JSON.stringify(pendingTokens))throw error('El saldo anterior cambió durante la migración. Se requiere revisión antes de enviar más operaciones.');
 const pendingAuth=snapshot.authorizations.filter((_,i)=>!doneKeys.has('legacy:'+parent.id+':revoke-'+i));
 if(JSON.stringify(current.authorizations)!==JSON.stringify(pendingAuth))throw error('La autorización anterior cambió durante la migración.');
 const core=new Contract(snapshot.core,views,service.rpc);
 for(const [method,value] of [['creditLimits',snapshot.credit.limit],['userLevels',snapshot.credit.level],['extensionMarginLimits',snapshot.credit.margin],['extensionMarginUsed','0'],['paymentNonces','0'],['getUserDebtLotsCount','0']])
  if(await core[method](snapshot.address,{blockTag:current.blockNumber})!==BigInt(value))throw error('Los compromisos o beneficios cambiaron durante la migración.');
}
async function advance(service,parent,userId){
 if(parent.payload.migrationApproved!==true)throw error('Confirma la actualización de tu billetera antes de trasladar el saldo.');
 return locked(service.pool,'legacy-migration:'+parent.id,async()=>{
  const current=await status(service,parent,userId);
  if(current.done)return {success:false,state:'prepared',requiresSignature:true,message:'Traslado confirmado. Finalizando tu billetera.'};
  const {task,snapshot}=current;
  if(current.row&&current.row.state!=='prepared'){
   const result=await service.store.reconcile(current.row.id);
   if(['failed','conflict','abandoned'].includes(result.state))throw error('El traslado requiere revisión. Los fondos y comprobantes se conservan.');
   return {...result,success:false,requiresSignature:true,message:result.success?'Paso de migración confirmado. Continúa para finalizar.':'Esperando confirmación del traslado.'};
  }
  if(current.row){
   const gas=(await service.pool.query("SELECT * FROM chain_operations WHERE kind='gas' AND payload->>'parentId'=$1 AND state IN ('pending','conflict')",[current.row.id])).rows[0];
   if(gas){const result=await service.store.reconcile(gas.id);return {...result,success:false,requiresSignature:true,message:'Comprobando el patrocinio para trasladar tus USDT.'};}
  }
  // Refresh account and session association immediately before any signing.
  const {user}=await bound(service,parent,userId);
  await beforeSigning(service,parent,userId,snapshot,task);
  let signer;
  if(task.role==='legacy')signer=legacySigner(user);
  else{
   if(!process.env.ADMIN_CHAIN_PRIVATE_KEY)throw error('La migración espera la firma administrativa. Tu saldo y dirección anterior se conservan.',503);
   signer=new Wallet(process.env.ADMIN_CHAIN_PRIVATE_KEY);
   if(['RELAYER_PRIVATE_KEY','GAS_SPONSOR_PRIVATE_KEY'].some(k=>process.env[k]&&new Wallet(process.env[k]).address===signer.address))throw error('La firma administrativa debe estar separada del patrocinio.',503);
   if((await new Contract(task.to,views,service.rpc).owner()).toLowerCase()!==signer.address.toLowerCase())throw error('El firmante no administra el contrato de migración.',503);
   if(task.key==='kyc'&&!user.kyc_verified)throw error('La identidad requiere revisión antes de habilitar la nueva dirección.');
  }
  // All historical authorizations must be revoked before transferring or enabling the destination.
  if(!task.key.startsWith('revoke-'))for(const core of snapshot.authorizations)
   if(await new Contract(core,views,service.rpc).isKYCVerified(snapshot.address))throw error('La dirección anterior todavía está habilitada.');
  const call={to:task.to,data:task.data,value:task.value};
  const maxFeeWei=process.env.ADMIN_MAX_STEP_FEE_WEI||'1000000000000000';
  const row=current.row||await service.store.prepare({userId,key:'legacy:'+parent.id+':'+task.key,chainId:snapshot.chainId,sender:signer.address,
   resource:'legacy:'+snapshot.address,kind:'legacyMigration',payload:{migrationParentId:parent.id,account:parent.payload.account,call,maxFeeWei}});
  try{return {...await service.store.authorize(row.id,userId,async()=>[await chainSigning.signStep(service.rpc,signer,{...call,label:task.label},snapshot.chainId,row.payload.maxFeeWei)]),success:false,message:task.label,requiresSignature:true};}
  catch(e){if(task.role==='legacy'&&e.status===402&&e.requiredWei){const result=await require('./gasSponsorship').sponsor(service,row,e.requiredWei);return {...result,success:false,requiresSignature:true,message:'Preparando el gas para trasladar tus USDT.'};}throw e;}
 });
}
async function sweep(pool,rpc,limit=5){
 const rows=(await pool.query(`SELECT o.* FROM chain_operations o JOIN account_identities i ON i.user_id=o.user_id
  JOIN smart_accounts a ON a.identity_id=i.id AND a.chain_id=o.chain_id AND a.address=o.payload->>'account'
  WHERE o.kind='accountActivation' AND o.state='confirmed' AND a.state='prepared'
  AND o.payload->>'migrationApproved'='true' AND o.payload ? 'legacyPlan' ORDER BY o.updated_at LIMIT $1`,[limit])).rows;
 if(!rows.length)return {checked:0};
 const service=new (require('./recoverableAccounts').RecoverableAccounts)(pool,rpc);
 for(const parent of rows){try{
  // Read progress first. Completion alone may update the account association.
  const result=await service.activationStatus(parent.user_id,parent.id);
  if(!result.success)await advance(service,parent,parent.user_id);
  await pool.query("UPDATE chain_operations SET payload=payload-'migrationLastError',updated_at=NOW() WHERE id=$1",[parent.id]);
 }catch(e){await pool.query("UPDATE chain_operations SET payload=payload||jsonb_build_object('migrationLastError',$2::text),updated_at=NOW() WHERE id=$1",[parent.id,e.status?e.message:'No pudimos comprobar la migración. Los fondos y comprobantes se conservan.']);}}
 return {checked:rows.length};
}
module.exports={plan,status,advance,tasks,terms,legacySigner,verifyTransfer,sweep};
