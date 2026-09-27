const {expect}=require('chai');
const {ethers}=require('hardhat');
const {randomBytes,randomUUID}=require('crypto');
const {Pool}=require('../../backend/node_modules/pg');
const {fixture,U}=require('./helpers/suite');
const {WalletOperations}=require('../../backend/src/services/walletOperations');
const {ChainOperationStore,locked}=require('../../backend/src/services/chainOperationStore');
const deployment=require('../../backend/src/services/chainDeployment');

(process.env.WINTON_MIGRATION_TEST_PORT?describe:describe.skip)('PIN + contratos reales + recuperación PostgreSQL',function(){
 this.timeout(120000);
 let pool,control,schema,f,user,service,cfg;
 beforeEach(async()=>{
  control=new Pool({host:'127.0.0.1',port:Number(process.env.WINTON_MIGRATION_TEST_PORT),user:'review070',database:'postgres',connectionTimeoutMillis:5000});
  expect((await control.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/')).to.match(/\/pg-review-070$/);
  schema='pin077_'+randomBytes(6).toString('hex');await control.query(`CREATE SCHEMA ${schema}`);
  pool=new Pool({...control.options,options:`-c search_path=${schema},public`,max:8});
  await pool.query('CREATE TABLE users(id INTEGER PRIMARY KEY,web3_wallet_address TEXT,has_transaction_pin BOOLEAN,kyc_verified BOOLEAN,red_credit_limit_override NUMERIC); CREATE TABLE app_settings(setting_key TEXT PRIMARY KEY,setting_value TEXT,updated_at TIMESTAMPTZ)');
  await require('../../backend/migrations/116_durable_chain_operations').up(pool);
  f=await fixture();user=ethers.Wallet.createRandom().connect(ethers.provider);
  await f.owner.sendTransaction({to:user.address,value:ethers.parseEther('5')});
  await f.core.setKYCStatus(user.address,true);await f.core.setCreditLimit(user.address,1000n*U);await f.usdt.mint(user.address,1000n*U);
  await pool.query('INSERT INTO users VALUES(1,$1,true,true,NULL),(2,$2,true,true,NULL)',[user.address,f.alice.address]);
  cfg={chainId:'1337',contracts:{CoreProtocol:f.core.target,CollateralVault:f.vault.target,FifoExchange:f.exchange.target,BlueToken:f.blue.target,RedToken:f.red.target,USDT:f.usdt.target,ProtocolTreasury:f.treasury.target},fingerprint:'synthetic-local-suite'};
  process.env.WALLET_MAX_STEP_FEE_WEI=ethers.parseEther('.1').toString();
  service=new WalletOperations(pool,ethers.provider,cfg,{decryptPrivateKeyWithPin:async(_c,id,pin)=>{if(id!==1||pin!=='729418')throw Object.assign(new Error('PIN incorrecto'),{status:401});return user.privateKey;}},{finality:null,confirmations:1});
 });
 afterEach(async()=>{delete process.env.GAS_SPONSOR_PRIVATE_KEY;if(pool)await pool.end();if(control){await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await control.end();}});
 async function finish(quote){let r=await service.authorize(1,quote.operationId,'729418');for(let n=0;n<15&&!r.success;n++){r=await service.status(1,quote.operationId);if(r.requiresSignature)r=await service.authorize(1,quote.operationId,'729418');}expect(r.success,JSON.stringify(r)).eq(true);return r;}
 it('valida red, enlaces y seis decimales del despliegue',async()=>{expect(await deployment.validate(ethers.provider,cfg)).eq(cfg);await expect(deployment.validate(ethers.provider,{...cfg,chainId:'10'})).rejectedWith('red');});
 it('depósito con aprobación limitada, retiro libre y envío USDT con la misma identidad',async()=>{
  const q=await service.prepare(1,{action:'deposit',amount:'10'});expect(q.stepsCount).eq(2);await finish(q);
  expect(await f.vault.userCollateral(user.address)).eq(10n*U);expect(await f.usdt.allowance(user.address,f.vault.target)).eq(0n);
  await finish(await service.prepare(1,{action:'withdraw',amount:'4'}));expect(await f.vault.userCollateral(user.address)).eq(6n*U);
  const old=await f.usdt.balanceOf(f.bob.address);await finish(await service.prepare(1,{action:'transfer',amount:'2',destination:f.bob.address}));expect(await f.usdt.balanceOf(f.bob.address)).eq(old+2n*U);
 });
 it('no firma con PIN erróneo ni permite autorizar una operación de otra cuenta',async()=>{
  const q=await service.prepare(1,{action:'buy',amount:'5'});
  await expect(service.authorize(1,q.operationId,'wrong')).rejectedWith('PIN');
  await expect(service.authorize(2,q.operationId,'729418')).rejectedWith('no encontrada');
  expect((await service.store.get(q.operationId,1)).steps).length(0);
 });
 it('KYC suspendido después de preparar impide firmar',async()=>{
  const q=await service.prepare(1,{action:'buy',amount:'5'});await f.core.setKYCStatus(user.address,false);
  await expect(service.authorize(1,q.operationId,'729418')).rejectedWith('KYC');expect((await service.store.get(q.operationId,1)).steps).length(0);
 });
 it('compra y cancelación usan el dueño real; no se puede cancelar orden ajena',async()=>{
  await finish(await service.prepare(1,{action:'buy',amount:'5'}));expect((await f.exchange.orders(1)).user).eq(user.address);
  await finish(await service.prepare(1,{action:'cancel',orderId:'1'}));expect(await f.exchange.totalReservedUsdt()).eq(0n);
  await f.exchange.connect(f.alice).createUsdtOrder(U);
  const q=await service.prepare(1,{action:'cancel',orderId:'2'});await expect(finish(q)).rejected;expect((await f.exchange.orders(2)).remainingAmount).eq(U);
 });
 it('BLUE en parking no se puede vender por usar PIN',async()=>{
  await f.pay(f.alice,user,5n*U);const q=await service.prepare(1,{action:'sell',amount:'5'});
  await expect(finish(q)).rejected;expect(await f.blue.balanceOf(user.address)).eq(5n*U);expect(await f.exchange.totalReservedBlue()).eq(0n);
 });
 it('amortización BLUE conserva paridad y reserva Vault protege retiros',async()=>{
  await f.core.connect(user).processPayment(user.address,f.bob.address,5n*U);await f.pay(f.alice,user,5n*U);
  await finish(await service.prepare(1,{action:'amortize',amount:'5'}));expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  await finish(await service.prepare(1,{action:'deposit',amount:'20'}));await f.core.setCreditLimit(user.address,0);
  await f.core.connect(user).processPayment(user.address,f.bob.address,10n*U);
  await expect(service.prepare(1,{action:'withdraw',amount:'20'})).rejectedWith('respalda');
 });
 it('error de transporte después de enviar recupera exactamente la misma transacción',async()=>{
  const q=await service.prepare(1,{action:'transfer',amount:'3',destination:f.bob.address});const before=await f.usdt.balanceOf(f.bob.address);
  const original=service.store.provider;let sends=0;
  service.store.provider=new Proxy(original,{get(target,key){if(key==='broadcastTransaction')return async raw=>{sends++;await target.broadcastTransaction(raw);throw Error('lost reply');};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
  await service.authorize(1,q.operationId,'729418');
  const restarted=new ChainOperationStore(pool,ethers.provider,{finality:null,confirmations:1});expect((await restarted.reconcile(q.operationId)).success).eq(true);
  await restarted.reconcile(q.operationId);expect(sends).eq(1);expect(await f.usdt.balanceOf(f.bob.address)).eq(before+3n*U);
 });
 it('DB falla después de confirmación: espejo pendiente se recupera sin reenvío',async()=>{
  const q=await service.prepare(1,{action:'transfer',amount:'1',destination:f.bob.address});
  await pool.query('UPDATE chain_operations SET projection=$2 WHERE id=$1',[q.operationId,JSON.stringify({type:'setting',key:'debt_cycle_days',value:'30'})]);
  await service.authorize(1,q.operationId,'729418');
  const wrapped={query:pool.query.bind(pool),connect:async()=>{const client=await pool.connect();return {release:x=>client.release(x),query:(sql,args)=>sql.startsWith('INSERT INTO app_settings')?Promise.reject(Error('DB unavailable')):client.query(sql,args)};}};
  const broken=new ChainOperationStore(wrapped,ethers.provider,{finality:null,confirmations:1});await expect(broken.reconcile(q.operationId)).rejectedWith('DB unavailable');
  expect((await service.store.get(q.operationId,1)).state).eq('pending');expect((await service.store.reconcile(q.operationId)).success).eq(true);
  expect((await pool.query("SELECT setting_value FROM app_settings WHERE setting_key='debt_cycle_days'")).rows[0].setting_value).eq('30');
 });
 it('operación repetida no firma de nuevo; concurrencia usa un único bloqueo',async()=>{
  const q=await service.prepare(1,{action:'transfer',amount:'1',destination:f.bob.address});
  const outcomes=await Promise.allSettled([service.authorize(1,q.operationId,'729418'),service.authorize(1,q.operationId,'729418')]);
  expect(outcomes.filter(x=>x.status==='fulfilled')).length(1);const old=(await service.store.get(q.operationId,1)).steps[0].hash;
  await service.authorize(1,q.operationId,'729418');expect((await service.store.get(q.operationId,1)).steps[0].hash).eq(old);
 });
 it('proyección de excepción se completa antes de liberar el bloqueo de nuevas escrituras',async()=>{
  const q=await service.prepare(1,{action:'transfer',amount:'1',destination:f.bob.address});
  await pool.query('UPDATE chain_operations SET projection=$2 WHERE id=$1',[q.operationId,JSON.stringify({type:'credit_manual',wallet:user.address,value:'25'})]);
  await finish(q);expect(String((await pool.query('SELECT red_credit_limit_override FROM users WHERE id=1')).rows[0].red_credit_limit_override)).eq('25');
 });
 it('un bloqueo ocupado no se interpreta como éxito',async()=>{
  await locked(pool,'synthetic-credit',async()=>{await expect(locked(pool,'synthetic-credit',async()=>true)).rejectedWith('en curso');});
 });
 it('patrocinio entrega gas una sola vez y respeta presupuesto por identidad',async()=>{
  const sponsor=ethers.Wallet.createRandom();process.env.GAS_SPONSOR_PRIVATE_KEY=sponsor.privateKey;
  await f.owner.sendTransaction({to:sponsor.address,value:ethers.parseEther('3')});
  await ethers.provider.send('hardhat_setBalance',[user.address,'0x0']);
  for(const [key,value] of Object.entries({gas_sponsor_enabled:'true',gas_sponsor_daily_user_operations:'1',gas_sponsor_daily_budget_wei:ethers.parseEther('1').toString(),gas_sponsor_max_topup_wei:ethers.parseEther('.1').toString()}))await pool.query('UPDATE app_settings SET setting_value=$2 WHERE setting_key=$1',[key,value]);
  const q=await service.prepare(1,{action:'transfer',amount:'1',destination:f.bob.address});
  let waiting;try{await service.authorize(1,q.operationId,'729418');}catch(e){waiting=e;}
  expect(waiting.status).eq(202);expect(waiting.fundingOperationId).a('string');
  expect((await service.status(1,waiting.fundingOperationId)).success).eq(true);
  await finish(q);expect((await pool.query("SELECT COUNT(*)::int AS n FROM chain_operations WHERE kind='gas'")).rows[0].n).eq(1);
  await ethers.provider.send('hardhat_setBalance',[user.address,'0x0']);
  const second=await service.prepare(1,{action:'transfer',amount:'1',destination:f.bob.address});
  await expect(service.authorize(1,second.operationId,'729418')).rejectedWith('presupuesto');
 });
 it('una confirmación de política anterior no salta la evaluación de la nueva',async()=>{
  const {savePolicy,tick}=require('../../backend/src/services/creditPolicyJobs');
  const old=await service.store.prepare({userId:1,key:'old-policy',chainId:'1337',sender:user.address,resource:'credit:'+user.address.toLowerCase(),kind:'credit',payload:{}});
  const version=await savePolicy(pool,'red_credit_base_limit','80',9);
  let calls=0;
  const scoring={syncCreditLimitOnChain:async id=>{expect(id).eq(1);calls++;return calls===1?{pending:true,operationId:old.id}:{skipped:true,reason:'already_current'};}};
  await tick(pool,scoring);await pool.query("UPDATE chain_operations SET state='confirmed' WHERE id=$1",[old.id]);
  await tick(pool,scoring);expect(calls).eq(2);
  expect((await pool.query('SELECT cursor_id FROM credit_policy_jobs WHERE version_id=$1',[version.policyVersion])).rows[0].cursor_id).eq(1);
 });
 it('política global versionada se reanuda y conserva cuentas con excepción',async()=>{
  const {savePolicy,tick}=require('../../backend/src/services/creditPolicyJobs');
  const saved=await savePolicy(pool,'red_credit_base_limit','75',9);expect(saved.policyVersion).not.eq(undefined);
  const seen=[];const scoring={syncCreditLimitOnChain:async id=>{seen.push(id);return {skipped:true,reason:'individual_exception'};}};
  await tick(pool,scoring);await tick(pool,scoring);await tick(pool,scoring);
  expect(seen).deep.eq([1,2]);expect((await pool.query('SELECT state FROM credit_policy_jobs')).rows[0].state).eq('complete');
  await savePolicy(pool,'red_credit_base_limit','0',9);expect((await pool.query("SELECT setting_value FROM app_settings WHERE setting_key='red_credit_base_limit'")).rows[0].setting_value).eq('0');
 });
});
