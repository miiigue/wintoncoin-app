'use strict';
const crypto=require('crypto');
const {Wallet,Interface,keccak256}=require('ethers');
const execution=require('../src/services/legacyMigrationExecution');
const inspection=require('../src/services/legacyWalletMigration');
const deployment=require('../src/services/chainDeployment');
const signing=require('../src/services/safeExecution');
const policy=require('../src/services/safeAccountPolicy');
const confirmations=require('../src/services/chainConfirmation');
const chainSigning=require('../src/services/chainSigning');
const envelopeSecret='synthetic-migration-test-only-secret-0000';
const old=Wallet.createRandom(),admin=Wallet.createRandom();
const next='0x'+'2'.repeat(40),core='0x'+'3'.repeat(40),token='0x'+'4'.repeat(40);
const abi=new Interface(['function owner() view returns(address)','function isKYCVerified(address) view returns(bool)',
 ...['creditLimits','userLevels','extensionMarginLimits','extensionMarginUsed','paymentNonces','getUserDebtLotsCount'].map(n=>'function '+n+'(address) view returns(uint256)'),
 'function setKYCStatus(address,bool)','function setCreditLimit(address,uint256)','function setUserBenefits(address,uint8,uint256)',
 'function transfer(address,uint256) returns(bool)','event Transfer(address indexed from,address indexed to,uint256 value)']);
function envelope(wallet,version='v2'){
 const key=crypto.scryptSync(envelopeSecret,version==='v2'?'winton-wallet-envelope-v2':'salt',32),iv=crypto.randomBytes(version==='v2'?12:16);
 const cipher=crypto.createCipheriv(version==='v2'?'aes-256-gcm':'aes-256-cbc',key,iv);
 const ciphertext=Buffer.concat([cipher.update(wallet.privateKey,'utf8'),cipher.final()]).toString('hex');
 return version==='v2'?'v2:'+Buffer.from(JSON.stringify({iv:iv.toString('hex'),authTag:cipher.getAuthTag().toString('hex'),ciphertext})).toString('base64'):iv.toString('hex')+':'+ciphertext;
}
const originalEnv={...process.env};
afterEach(()=>{jest.restoreAllMocks();process.env= {...originalEnv};});
test.each(['v2','cbc'])('rescata únicamente el sobre heredado %s de la dirección vinculada',version=>{
 const u={web3_wallet_address:old.address,web3_private_key_encrypted:envelope(old,version)};
 expect(execution.legacySigner(u,{ENCRYPTION_SECRET:envelopeSecret}).address).toBe(old.address);
 expect(()=>execution.legacySigner({...u,web3_wallet_address:next},{ENCRYPTION_SECRET:envelopeSecret})).toThrow('No pudimos');
});
test.each([{has_transaction_pin:true},{web3_keystore:{}},{web3_private_key_encrypted:'invalid'}])('no reutiliza PIN, keystore ni material inválido: %j',override=>{
 expect(()=>execution.legacySigner({web3_wallet_address:old.address,web3_private_key_encrypted:envelope(old),...override},{ENCRYPTION_SECRET:envelopeSecret})).toThrow('No pudimos');
});
function snapshot(){return {address:old.address.toLowerCase(),chainId:'10',fingerprint:'suite',blockNumber:100,blockHash:'block',usdt:[{token,amount:'500000000'}],authorizations:[core],core,credit:{limit:'20000000',level:'3',margin:'0'},restoreKyc:true};}
test('ordena revocar, trasladar, conservar beneficios y habilitar; el cliente no elige destino',()=>{
 const tasks=execution.tasks(snapshot(),next);expect(tasks.map(t=>t.key)).toEqual(['revoke-0','transfer-0','credit','benefits','kyc']);
 const transfer=abi.parseTransaction({data:tasks[1].data});expect(transfer.args[0].toLowerCase()).toBe(next);expect(transfer.args[1]).toBe(500000000n);
});
test('conserva límite aunque el usuario todavía no tenga KYC aprobado',()=>{
 const plan={...snapshot(),restoreKyc:false,authorizations:[]};expect(execution.tasks(plan,next).map(t=>t.key)).toEqual(['transfer-0','credit','benefits']);
});
function fixture(){
 process.env.ENCRYPTION_SECRET=envelopeSecret;process.env.ADMIN_CHAIN_PRIVATE_KEY=admin.privateKey;delete process.env.RELAYER_PRIVATE_KEY;delete process.env.GAS_SPONSOR_PRIVATE_KEY;
 const snap=snapshot();const parent={id:'parent',user_id:1,chain_id:'10',kind:'accountActivation',state:'confirmed',payload:{account:next,legacyAddress:snap.address,legacyPlan:snap,manifestHash:'manifest',migrationApproved:true}};
 const account={state:'prepared',address:next,backup_confirmed_at:new Date(),manifest_hash:'manifest'};
 const user={web3_wallet_address:snap.address,web3_private_key_encrypted:envelope(old),account_status:'active',kyc_verified:true};
 const records=[],receipts=new Map(),sent=[];const state={oldKyc:true,newKyc:false,oldBalance:500000000n,newBalance:0n,credit:0n,level:0n,margin:0n};
 const query=jest.fn(async(sql,args)=>{
  if(sql.includes('pg_try_advisory_lock'))return {rows:[{acquired:true}]};
  if(sql.includes('FROM users'))return {rows:[user]};
  if(sql.includes("kind='gas'"))return {rows:[]};
  if(sql.includes("migrationParentId"))return {rows:records};
  return {rows:[]};
 });
 const pool={query,connect:async()=>({query,release:()=>{}})};
 const rpc={call:async tx=>{
  const call=abi.parseTransaction({data:tx.data});const fromOld=call.args.length>0&&call.args[0].toLowerCase()===snap.address;
  const values={owner:admin.address,isKYCVerified:fromOld?state.oldKyc:state.newKyc,creditLimits:fromOld?20000000n:state.credit,userLevels:fromOld?3n:state.level,extensionMarginLimits:fromOld?0n:state.margin,extensionMarginUsed:0n,paymentNonces:0n,getUserDebtLotsCount:0n};
  return abi.encodeFunctionResult(call.fragment,[values[call.name]]);
 }};
 const inspect=jest.spyOn(inspection,'inspect').mockImplementation(async args=>{
  if(args.migration?.planning)return {...snap,usdt:state.oldBalance?[{token,amount:String(state.oldBalance)}]:[],authorizations:state.oldKyc?[core]:[]};
  if(state.oldBalance||state.oldKyc)throw Error('Not empty');return {address:snap.address};
 });
 jest.spyOn(deployment,'configuration').mockReturnValue({fingerprint:'suite',chainId:'10',contracts:{CoreProtocol:core}});
 jest.spyOn(signing,'account').mockImplementation(async()=>account);jest.spyOn(policy,'validateAccount').mockResolvedValue({});
 jest.spyOn(confirmations,'confirmedReceipt').mockImplementation(async(_rpc,hash)=>receipts.get(hash)||null);
 jest.spyOn(chainSigning,'signStep').mockImplementation(async(_rpc,signer,call)=>{
  const raw=await signer.signTransaction({to:call.to,data:call.data,value:call.value,chainId:10,nonce:sent.filter(s=>s.sender===signer.address.toLowerCase()).length,gasLimit:100000,gasPrice:1,type:0});
  return {raw,hash:keccak256(raw),label:call.label};
 });
 const store={finality:'safe',confirmations:2,prepare:jest.fn(async args=>{
  const prior=records.find(r=>r.request_key===args.key);if(prior)return prior;
  const row={id:'child-'+records.length,user_id:1,chain_id:'10',sender:args.sender.toLowerCase(),kind:args.kind,request_key:args.key,payload:args.payload,steps:[],state:'prepared'};records.push(row);return row;
 }),authorize:jest.fn(async(id,_user,build)=>{
  const row=records.find(r=>r.id===id);if(row.state!=='prepared')throw Error('Duplicate submit');row.steps=await build(row);row.state='pending';sent.push(row);return {state:'pending',pending:true};
 }),reconcile:jest.fn(async id=>({state:records.find(r=>r.id===id).state,success:records.find(r=>r.id===id).state==='confirmed'}))};
 function mine(row=records.at(-1),{transferLog=true}={}){
  const call=abi.parseTransaction({data:row.payload.call.data});let logs=[];
  if(call.name==='setKYCStatus'){if(call.args[0].toLowerCase()===snap.address)state.oldKyc=call.args[1];else state.newKyc=call.args[1];}
  if(call.name==='setCreditLimit')state.credit=call.args[1];
  if(call.name==='setUserBenefits'){state.level=call.args[1];state.margin=call.args[2];}
  if(call.name==='transfer'&&transferLog){state.oldBalance-=call.args[1];state.newBalance+=call.args[1];const event=abi.encodeEventLog(abi.getEvent('Transfer'),[snap.address,next,call.args[1]]);logs=[{address:token,...event}];}
  row.steps[0].blockHash='block-'+row.id;row.steps[0].confirmed=true;row.state='confirmed';receipts.set(row.steps[0].hash,{status:1,blockHash:row.steps[0].blockHash,logs});
 }
 return {service:{pool,rpc,store,config:{chainId:'10',hash:'manifest'}},parent,user,account,state,records,sent,receipts,mine,inspect};
}
test('traslada 500 USDT una sola vez y habilita solo al final, incluso al reintentar',async()=>{
 const f=fixture();
 for(let i=0;i<5;i++){
  await execution.advance(f.service,f.parent,1);const n=f.sent.length;
  await execution.advance(f.service,f.parent,1);expect(f.sent.length).toBe(n);
  expect(f.state.newKyc).toBe(false);f.mine();
 }
 await expect(execution.status(f.service,f.parent,1)).resolves.toMatchObject({done:true,evidence:{nonceAllowance:'1'}});
 expect(f.state.oldBalance).toBe(0n);expect(f.state.newBalance).toBe(500000000n);expect(f.state.oldKyc).toBe(false);expect(f.state.newKyc).toBe(true);
 await execution.advance(f.service,f.parent,1);expect(f.sent).toHaveLength(5);
});
test('GET de estado no firma ni envía',async()=>{const f=fixture();await execution.status(f.service,f.parent,1);expect(f.sent).toHaveLength(0);expect(f.service.store.prepare).not.toHaveBeenCalled();});
test.each(['account','user','manifest'])('cambio de %s impide firmar',async changed=>{
 const f=fixture();if(changed==='account')f.account.address=core;if(changed==='user')f.user.web3_wallet_address=core;if(changed==='manifest')f.parent.payload.manifestHash='other';
 await expect(execution.advance(f.service,f.parent,1)).rejects.toThrow();expect(f.sent).toHaveLength(0);
});
test('saldo nuevo durante la migración detiene el siguiente envío',async()=>{
 const f=fixture();await execution.advance(f.service,f.parent,1);f.mine();f.state.oldBalance++;
 await expect(execution.advance(f.service,f.parent,1)).rejects.toThrow('saldo anterior cambió');expect(f.sent).toHaveLength(1);
});
test('transferencia que devuelve false no habilita la nueva cuenta',async()=>{
 const f=fixture();await execution.advance(f.service,f.parent,1);f.mine();await execution.advance(f.service,f.parent,1);f.mine(undefined,{transferLog:false});
 await expect(execution.advance(f.service,f.parent,1)).rejects.toThrow('no acredita');expect(f.state.newKyc).toBe(false);expect(f.sent).toHaveLength(2);
});
test('recibo desaparecido impide continuar tras reorganización',async()=>{
 const f=fixture();await execution.advance(f.service,f.parent,1);f.mine();f.receipts.clear();await expect(execution.advance(f.service,f.parent,1)).rejects.toThrow('confirmación definitiva');expect(f.sent).toHaveLength(1);
});
test('sin firmante administrativo no ejecuta ni revoca',async()=>{
 const f=fixture();delete process.env.ADMIN_CHAIN_PRIVATE_KEY;await expect(execution.advance(f.service,f.parent,1)).rejects.toThrow('firma administrativa');expect(f.sent).toHaveLength(0);
});
test('no reactiva identidad suspendida',async()=>{
 const f=fixture();for(let i=0;i<4;i++){await execution.advance(f.service,f.parent,1);f.mine();}f.user.kyc_verified=false;
 await expect(execution.advance(f.service,f.parent,1)).rejects.toThrow('identidad');expect(f.state.newKyc).toBe(false);
});

test('no inicia el traslado sin confirmación explícita del usuario',async()=>{const f=fixture();f.parent.payload.migrationApproved=false;await expect(execution.advance(f.service,f.parent,1)).rejects.toThrow('Confirma');expect(f.sent).toHaveLength(0);});

test('sin presupuesto de gas conserva operación preparada y no firma un traslado',async()=>{
 const f=fixture();await execution.advance(f.service,f.parent,1);f.mine();
 chainSigning.signStep.mockRejectedValue(Object.assign(new Error('sin gas'),{status:402,requiredWei:'1000'}));
 const sponsor=jest.spyOn(require('../src/services/gasSponsorship'),'sponsor').mockRejectedValue(new Error('presupuesto agotado'));
 await expect(execution.advance(f.service,f.parent,1)).rejects.toThrow('presupuesto agotado');
 expect(sponsor).toHaveBeenCalledTimes(1);expect(f.state.oldBalance).toBe(500000000n);expect(f.sent).toHaveLength(1);
});
test('un paso registrado con destino alterado se rechaza antes de firmar',async()=>{
 const f=fixture();await execution.advance(f.service,f.parent,1);f.records[0].payload.call.to=next;
 await expect(execution.advance(f.service,f.parent,1)).rejects.toThrow('registro');expect(f.sent).toHaveLength(1);
});
test('rechaza cambios de red en el padre de migración',async()=>{
 const f=fixture();f.parent.chain_id='11155420';await expect(execution.advance(f.service,f.parent,1)).rejects.toThrow('confirmada');expect(f.sent).toHaveLength(0);
});
