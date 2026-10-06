'use strict';
const {Contract,Interface,Wallet,parseUnits,formatUnits,id:hash}=require('ethers');
const deployment=require('./chainDeployment');
const {ChainOperationStore,locked,publicResult,error}=require('./chainOperationStore');
const {confirmedReceipt}=require('./chainConfirmation');
const {signStep}=require('./chainSigning');
const {randomUUID}=require('crypto');
const safeExecution=require('./safeExecution');
const safePolicy=require('./safeAccountPolicy');
const abi=[
 'function paymentNonces(address) view returns(uint256)',
 'function commissionBps() view returns(uint256)',
 'function COMMITMENT_DURATION() view returns(uint256)',
 'function processAuthorizedPayment((address payer,address payee,uint256 amount,uint256 feeBps,uint256 nonce,uint256 deadline,bytes32 agreementHash) auth,bytes signature)',
 'event PaymentProcessed(address indexed payer,address indexed payee,uint256 netAmount,uint256 fee,uint256 lotId,uint256 dueAt)',
 'event DebtAmortized(address indexed user,uint256 amountAmortized,uint256 remainingTotalDebt)'
];
const types={Payment:['payer:address','payee:address','amount:uint256','feeBps:uint256','nonce:uint256','deadline:uint256','agreementHash:bytes32'].map(s=>{const [name,type]=s.split(':');return {name,type};})};
const uuid=s=>/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s||'');

class MarketplacePayments {
 constructor(pool,rpc=deployment.provider(),config=deployment.configuration(),options={}) {
  this.pool=pool;this.rpc=rpc;this.config=config;this.options=options;
  // Controllers keep a business transaction open. A separate pool prevents
  // concurrent requests from consuming every connection needed to save a signature.
  this.journalPool=options.journalPool||new (require('pg').Pool)({...pool.options,max:4,connectionTimeoutMillis:5000});
  this.store=new ChainOperationStore(this.journalPool,rpc,options);
  this.walletService=options.walletService||require('./walletService');
 }
 async terms(){await deployment.validate(this.rpc,this.config);const c=new Contract(this.config.contracts.CoreProtocol,abi,this.rpc);return {feeBps:String(await c.commissionBps()),durationSeconds:String(await c.COMMITMENT_DURATION())};}
 async begin(client,p,pin) {
  if(!/^[1-9]\d*$/.test(String(p.publicationId))||!/^\d{1,12}(\.\d{1,6})?$/.test(String(p.amount)))throw error('Publicación o importe inválido.',400);
  if(p.acceptanceId&&!/^[1-9]\d*$/.test(String(p.acceptanceId)))throw error('Participación inválida.',400);
  const publicationSnapshot=(await client.query('SELECT * FROM publications WHERE id=$1 FOR UPDATE',[p.publicationId])).rows[0];
  if(!publicationSnapshot)throw error('Publicación no encontrada.',404);
  const users=(await client.query('SELECT id,username,web3_wallet_address,account_status,is_minor,has_transaction_pin FROM users WHERE username IN ($1,$2)',[p.payer,p.payee])).rows;
  const payer=users.find(u=>u.username===p.payer),payee=users.find(u=>u.username===p.payee);
  if(!payer||!payee||payer.id===payee.id)throw error('Participantes inválidos.',400);
  if(users.some(u=>u.account_status!=='active'||!u.web3_wallet_address))throw error('Ambas cuentas deben estar activas y tener su billetera asociada.',403);
  if(payer.is_minor)throw error('Este pago requiere una autorización propia del tutor. No se puede cargar un compromiso a otra persona usando el PIN del menor.',403);
  await safeExecution.account(this.pool,payer.id,this.config.chainId);
  const amount=parseUnits(String(p.amount),6);
  if(amount<=0n)throw error('Importe inválido.',400);
  let reference;
  if(p.acceptanceId)reference='acceptance:'+p.acceptanceId;
  else if(p.category==='donation') {if(!uuid(p.requestId))throw error('Falta una referencia válida para recuperar esta donación.',400);reference='donation:'+payer.id+':'+p.publicationId+':'+p.requestId;}
  else reference='quick-sale:'+p.publicationId;
  const key=['marketplace',this.config.chainId,this.config.contracts.CoreProtocol.toLowerCase(),reference].join(':');
  const signer=new Wallet(this.options.relayerKey||process.env.RELAYER_PRIVATE_KEY);
  const payload={...p,publicationSnapshot:hash(JSON.stringify(publicationSnapshot)),paymentKey:key,amount:formatUnits(amount,6),payerId:payer.id,payeeId:payee.id,payerWallet:payer.web3_wallet_address.toLowerCase(),payeeWallet:payee.web3_wallet_address.toLowerCase(),fingerprint:this.config.fingerprint,core:this.config.contracts.CoreProtocol};
  // The controller holds the publication lock. Persist outside its transaction;
  // user_id is intentionally NULL to avoid waiting on its users FK row locks.
  {
   const previous=(await this.journalPool.query("SELECT * FROM chain_operations WHERE request_key=$1 OR (kind='marketplace' AND payload->>'paymentKey'=$1) ORDER BY created_at DESC LIMIT 1",[key])).rows[0];
   let row=previous;
   // A failed preflight/PIN never reserves a sale. No signed step exists in
   // this state, so the next validated attempt may replace that preparation.
   if(row?.state==='prepared'&&row.steps.length===0&&(!row.payload.authorization||Number(row.payload.authorization.deadline)<Math.floor(Date.now()/1000))){
    row=(await this.journalPool.query('UPDATE chain_operations SET payload=$2,sender=$3,resource_key=$4,updated_at=NOW() WHERE id=$1 RETURNING *',[row.id,JSON.stringify(payload),signer.address.toLowerCase(),'payment:'+payload.payerWallet])).rows[0];
   }
   if(row) {
    for(const field of ['payerId','payeeId','amount','publicationId','acceptanceId','category'])if(row.payload[field]!==payload[field])throw error('Esta publicación ya tiene otro pago registrado; consulta su estado.',409);
    if(row.state==='failed'){
     const receipt=await confirmedReceipt(this.rpc,row.steps[0]?.hash,this.options);
     if(!receipt||receipt.status!==0)throw error('Primero debe verificarse el rechazo del intento anterior.');
     // New PIN consent starts a distinct attempt only after a proven revert.
     row=null;
    }
   }
   if(!row) {
    // Authorization is signed in the client after preparation.
    row=await this.store.prepare({key:previous?key+':retry:'+randomUUID():key,chainId:this.config.chainId,sender:signer.address,resource:'payment:'+payload.payerWallet,kind:'marketplace',payload});
   }
   if(row.state==='prepared'&&!row.payload.authorization) {
    await deployment.validate(this.rpc,this.config);
    const core=new Contract(payload.core,abi,this.rpc);
    const [nonce,feeBps,block]=await Promise.all([core.paymentNonces(payload.payerWallet),core.commissionBps(),this.rpc.getBlock('latest')]);
    if(String(feeBps)!==String(p.expectedFeeBps))throw error('La comisión cambió. Revisa el pago.',409);
    const authorization={payer:payload.payerWallet,payee:payload.payeeWallet,amount:amount.toString(),feeBps:feeBps.toString(),nonce:nonce.toString(),deadline:block.timestamp+900,agreementHash:hash(key)};
    await this.journalPool.query('UPDATE chain_operations SET payload=payload||$2::jsonb WHERE id=$1',[row.id,JSON.stringify({authorization})]);
   }
   const result=await this.status(payer.id,row.id);
   // Always unwind the caller's transaction. Only the receipt projector below
   // marks a real payment complete, including recovery after a process crash.
   throw Object.assign(error(result.message,409),{code:result.settled?'PAYMENT_SETTLED':'PAYMENT_PENDING',operationId:row.id,state:result.state});
  }
 }
 async authorize(userId,operationId,signature) {
  const row=await this.store.get(operationId);
  if(row.kind!=='marketplace'||row.payload.payerId!==userId)throw error('Pago no encontrado.',404);
  if(typeof signature!=='string'||!/^0x(?:[0-9a-f]{2}){65,16384}$/i.test(signature))throw error('Autorización inválida.',400);
  await this.store.authorize(operationId,null,async fresh=>{
   const p=fresh.payload;
   await deployment.validate(this.rpc,this.config);
   const a=await safeExecution.account(this.pool,userId,this.config.chainId);
   if(a.address!==p.payerWallet||p.fingerprint!==this.config.fingerprint)throw error('La cuenta o el despliegue cambió.');
   await safePolicy.validateAccount(this.rpc,safePolicy.configuration(),a);
   return locked(this.pool,'publication-authorization:'+p.publicationId,async client=>{
    await client.query('BEGIN');
    try {
     const publication=(await client.query('SELECT * FROM publications WHERE id=$1 FOR UPDATE',[p.publicationId])).rows[0];
     if(!publication||hash(JSON.stringify(publication))!==p.publicationSnapshot)throw error('La publicación cambió. Solicita un nuevo resumen.');
     const participants=(await client.query('SELECT account_status FROM users WHERE id IN ($1,$2)',[p.payerId,p.payeeId])).rows;
     if(participants.length!==2||participants.some(u=>u.account_status!=='active'))throw error('Participante no habilitado.',403);
     const call={to:p.core,value:'0',data:new Interface(abi).encodeFunctionData('processAuthorizedPayment',[p.authorization,signature]),label:'Pago autorizado por el usuario'};
     await this.rpc.call({...call,from:safeExecution.relayer().address});
     const step=await safeExecution.sponsoredStep(this.journalPool,this.rpc,this.config.chainId,userId,fresh,call);
     await client.query('COMMIT');return [step];
    }catch(e){await client.query('ROLLBACK');throw e;}
   });
  });
  return this.status(userId,operationId);
 }
 async status(userId,operationId) {
  const row=await this.store.get(operationId);
  if(row.kind!=='marketplace'||row.payload.payerId!==userId)throw error('Pago no encontrado.',404);
  const settled=(await this.journalPool.query('SELECT 1 FROM marketplace_payment_settlements WHERE operation_id=$1',[row.id])).rowCount>0;
  return {...publicResult(row),authorization:row.state==='prepared'?{domain:{name:'WintonCore',version:'4',chainId:this.config.chainId,verifyingContract:row.payload.core},types,primaryType:'Payment',message:row.payload.authorization}:null,success:settled,settled,message:settled?'Pago confirmado y registrado.':row.state==='failed'?'El contrato rechazó este intento. Puedes abrir el resumen y autorizar otro intento en tu dispositivo.':row.state==='conflict'?'El pago necesita revisión. Conserva esta referencia; no se enviará un pago nuevo automáticamente.':'Pago registrado. Espera la confirmación y actualización de la publicación; no repitas el pago.'};
 }
 async close(){if(!this.options.journalPool)await this.journalPool.end();}
 async settle(operationId) {
  return locked(this.pool,'marketplace-settlement:'+operationId,async client=>{
   const row=await this.store.get(operationId);
   if(row.kind!=='marketplace'||row.state!=='confirmed')return false;
   if((await client.query('SELECT 1 FROM marketplace_payment_settlements WHERE operation_id=$1',[row.id])).rowCount)return true;
   if(row.payload.fingerprint!==this.config.fingerprint)throw error('El pago pertenece a otro despliegue.');
   const receipt=await confirmedReceipt(this.rpc,row.steps[0].hash,this.options);
   if(!receipt||receipt.status!==1||receipt.blockHash!==row.steps[0].blockHash)throw error('La confirmación del pago requiere revisión.');
   const p=row.payload,iface=new Interface(abi);
   const events=receipt.logs.filter(l=>l.address.toLowerCase()===p.core.toLowerCase()).map(l=>{try{return iface.parseLog(l);}catch{return null;}});
   const payments=events.filter(e=>e?.name==='PaymentProcessed');
   if(payments.length!==1)throw error('No se encontró un único pago comprobable.');
   const e=payments[0].args;
   if(e.payer.toLowerCase()!==p.payerWallet||e.payee.toLowerCase()!==p.payeeWallet||e.netAmount!==parseUnits(p.amount,6))throw error('El resultado no corresponde al pago registrado.');
   await client.query('BEGIN');
   try {
    const publication=(await client.query('SELECT * FROM publications WHERE id=$1 FOR UPDATE',[p.publicationId])).rows[0];
    if(!publication)throw error('La publicación pagada requiere conciliación.');
    if(p.acceptanceId) {
     const r=await client.query("UPDATE publication_acceptances SET status='confirmed_paid' WHERE id=$1 AND publication_id=$2 AND status <> 'confirmed_paid' RETURNING id",[p.acceptanceId,p.publicationId]);
     if(r.rowCount!==1)throw error('La participación pagada requiere conciliación.');
     if(p.completion)await client.query("UPDATE publication_acceptances SET form_responses=COALESCE($2,form_responses),evidence_urls=COALESCE(NULLIF($3::text[],'{}'),evidence_urls),form_responses_submitted_at=COALESCE(form_responses_submitted_at,NOW()) WHERE id=$1",[p.acceptanceId,p.completion.formResponses,p.completion.evidenceUrls]);
    } else if(p.category==='donation') {
     await client.query("INSERT INTO publication_acceptances(publication_id,acceptor_username,status,blue_cost) VALUES($1,$2,'confirmed_paid',$3)",[p.publicationId,p.payer,p.amount]);
     await client.query('UPDATE publications SET current_amount=COALESCE(current_amount,0)+$1 WHERE id=$2',[p.amount,p.publicationId]);
    } else await client.query("UPDATE publications SET status='completed',available_slots=0 WHERE id=$1",[p.publicationId]);
    // Amounts come from the receipt. Never recreate balances, parking or RED
    // maturities using wall-clock time or mutable database settings.
    const sent=await client.query("INSERT INTO transactions(user_id,type,description,blue_change,red_change,related_publication_id,platform_fee_blue,tx_hash) VALUES($1,'payment_sent',$2,0,$3,$4,$5,$6) RETURNING id",[p.payerId,'Pago confirmado: '+publication.title,formatUnits(e.netAmount+e.fee,6),p.publicationId,formatUnits(e.fee,6),receipt.hash]);
    await client.query("INSERT INTO transactions(user_id,type,description,blue_change,red_change,related_publication_id,tx_hash) VALUES($1,'payment_received',$2,$3,0,$4,$5)",[p.payeeId,'Pago recibido: '+publication.title,p.amount,p.publicationId,receipt.hash]);
    for(const amort of events.filter(event=>event?.name==='DebtAmortized')){
     const address=amort.args.user.toLowerCase(),userId=address===p.payerWallet?p.payerId:address===p.payeeWallet?p.payeeId:null;
     if(userId)await client.query("INSERT INTO transactions(user_id,type,description,blue_change,red_change,related_publication_id,tx_hash) VALUES($1,'amortization',$2,$3,$3,$4,$5)",[userId,'Autoamortización confirmada durante el pago',formatUnits(-amort.args.amountAmortized,6),p.publicationId,receipt.hash]);
    }
    await client.query('INSERT INTO platform_commission_log(related_publication_id,related_user_transaction_id,commission_amount_blue) VALUES($1,$2,$3)',[p.publicationId,sent.rows[0].id,formatUnits(e.fee,6)]);
    await client.query("UPDATE web3_escrow_holds SET status='released',released_at=NOW() WHERE publication_id=$1 AND status='locked'",[p.publicationId]);
    for(const username of [p.payer,p.payee])await client.query('INSERT INTO notifications(recipient_username,message) VALUES($1,$2)',[username,'Pago de «'+publication.title+'» confirmado en blockchain. Referencia: '+receipt.hash]);
    await client.query('INSERT INTO marketplace_payment_settlements(operation_id,payment_key,tx_hash) VALUES($1,$2,$3)',[row.id,p.paymentKey||row.request_key,receipt.hash]);
    await client.query('COMMIT');return true;
   } catch(err){await client.query('ROLLBACK');throw err;}
  });
 }
 async sweep(limit=20){
  const rows=await this.pool.query("SELECT o.id FROM chain_operations o LEFT JOIN marketplace_payment_settlements s ON s.operation_id=o.id WHERE o.kind='marketplace' AND o.state='confirmed' AND s.operation_id IS NULL ORDER BY o.updated_at LIMIT $1",[limit]);
  for(const row of rows.rows)try{await this.settle(row.id);}catch{await this.pool.query('UPDATE chain_operations SET updated_at=NOW(),error_code=$2 WHERE id=$1',[row.id,'SETTLEMENT_REQUIRES_REVIEW']);}
 }
}
let singleton;
const service=()=>singleton ||= new MarketplacePayments(require('../config/db'));
async function assertPublicationMutable(client,publicationId){
 await client.query('SELECT id FROM publications WHERE id=$1 FOR UPDATE',[publicationId]);
 const pending=await client.query("SELECT 1 FROM chain_operations o LEFT JOIN marketplace_payment_settlements s ON s.operation_id=o.id WHERE kind='marketplace' AND payload->>'publicationId'=$1 AND (state IN ('pending','conflict') OR (state='prepared' AND (payload->'authorization'->>'deadline')::numeric>EXTRACT(EPOCH FROM NOW())) OR (state='confirmed' AND s.operation_id IS NULL)) LIMIT 1",[String(publicationId)]);
 if(pending.rowCount)throw error('La publicación tiene un pago en curso. Espera su conciliación antes de cambiarla.');
}
module.exports={MarketplacePayments,service,abi,assertPublicationMutable};
