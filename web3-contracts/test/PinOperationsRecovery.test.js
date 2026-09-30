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
 let pool,control,schema,f,user,service,cfg,paymentServices=[];
 beforeEach(async()=>{
  control=new Pool({host:'127.0.0.1',port:Number(process.env.WINTON_MIGRATION_TEST_PORT),user:'review070',database:'postgres',connectionTimeoutMillis:5000});
  expect((await control.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/')).to.match(/\/pg-review-070$/);
  schema='pin077_'+randomBytes(6).toString('hex');await control.query(`CREATE SCHEMA ${schema}`);
  pool=new Pool({...control.options,options:`-c search_path=${schema}`,max:8});
  await pool.query("CREATE TABLE users(id INTEGER PRIMARY KEY,web3_wallet_address TEXT,has_transaction_pin BOOLEAN,kyc_verified BOOLEAN,red_credit_limit_override NUMERIC,account_status TEXT DEFAULT 'active'); CREATE TABLE app_settings(setting_key TEXT PRIMARY KEY,setting_value TEXT,updated_at TIMESTAMPTZ)");
  await require('../../backend/migrations/116_durable_chain_operations').up(pool);
  await require('../../backend/migrations/117_payment_recovery_controls').up(pool);
  f=await fixture();user=ethers.Wallet.createRandom().connect(ethers.provider);
  await f.owner.sendTransaction({to:user.address,value:ethers.parseEther('5')});
  await f.core.setKYCStatus(user.address,true);await f.core.setCreditLimit(user.address,1000n*U);await f.usdt.mint(user.address,1000n*U);
  await pool.query('INSERT INTO users(id,web3_wallet_address,has_transaction_pin,kyc_verified,red_credit_limit_override) VALUES(1,$1,true,true,NULL),(2,$2,true,true,NULL)',[user.address,f.alice.address]);
  cfg={chainId:'1337',contracts:{CoreProtocol:f.core.target,CollateralVault:f.vault.target,FifoExchange:f.exchange.target,BlueToken:f.blue.target,RedToken:f.red.target,USDT:f.usdt.target,ProtocolTreasury:f.treasury.target},fingerprint:'synthetic-local-suite'};
  process.env.WALLET_MAX_STEP_FEE_WEI=ethers.parseEther('.1').toString();
  service=new WalletOperations(pool,ethers.provider,cfg,{decryptPrivateKeyWithPin:async(_c,id,pin)=>{if(id!==1||pin!=='729418')throw Object.assign(new Error('PIN incorrecto'),{status:401});return user.privateKey;}},{finality:null,confirmations:1});
 });
 afterEach(async()=>{for(const x of paymentServices)await x.close();paymentServices=[];delete process.env.GAS_SPONSOR_PRIVATE_KEY;if(pool)await pool.end();if(control){await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await control.end();}});
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
  // Depending on DB scheduling the second request either meets the lock or
  // observes the first request's persisted result. Both must have one effect.
  expect(outcomes.some(x=>x.status==='fulfilled')).eq(true);
  for(const result of outcomes.filter(x=>x.status==='rejected'))expect(result.reason.message).match(/en curso/);
  const stored=await service.store.get(q.operationId,1);expect(stored.steps).length(1);
  const old=stored.steps[0].hash;
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

 it('cuenta suspendida no puede firmar aunque conserve una operación preparada',async()=>{
  const q=await service.prepare(1,{action:'transfer',amount:'1',destination:f.bob.address});
  await pool.query("UPDATE users SET account_status='suspended' WHERE id=1");
  await expect(service.authorize(1,q.operationId,'729418')).rejectedWith('habilitada');
  expect((await service.store.get(q.operationId)).steps).length(0);
 });
 it('abandona solo pasos sin firmar; conserva aprobación confirmada y desbloquea otra operación',async()=>{
  const q=await service.prepare(1,{action:'deposit',amount:'10'});
  await service.authorize(1,q.operationId,'729418');
  await expect(service.abandon(1,q.operationId)).rejectedWith('firmada');
  expect((await service.status(1,q.operationId)).state).eq('prepared');
  expect((await service.abandon(1,q.operationId)).state).eq('abandoned');
  expect((await service.authorize(1,q.operationId,'729418')).state).eq('abandoned');
  expect(await f.usdt.allowance(user.address,f.vault.target)).eq(10n*U);
  expect(await f.vault.userCollateral(user.address)).eq(0n);
  await finish(await service.prepare(1,{action:'transfer',amount:'1',destination:f.bob.address}));
 });
 async function marketplace(){
  await pool.query("ALTER TABLE users ADD COLUMN username TEXT,ADD COLUMN is_minor BOOLEAN DEFAULT FALSE; UPDATE users SET username=CASE id WHEN 1 THEN 'payer' ELSE 'payee' END");
  await pool.query("CREATE TABLE publications(id INTEGER PRIMARY KEY,title TEXT,status TEXT,available_slots INTEGER,current_amount NUMERIC); INSERT INTO publications VALUES(1,'Trabajo de prueba','open',1,0); CREATE TABLE publication_acceptances(id SERIAL PRIMARY KEY,publication_id INTEGER,acceptor_username TEXT,status TEXT,blue_cost NUMERIC,form_responses JSONB,evidence_urls TEXT[],form_responses_submitted_at TIMESTAMPTZ); INSERT INTO publication_acceptances(publication_id,acceptor_username,status,blue_cost) VALUES(1,'payee','completed',10); CREATE TABLE transactions(id SERIAL PRIMARY KEY,user_id INTEGER,type TEXT,description TEXT,blue_change NUMERIC,red_change NUMERIC,related_publication_id INTEGER,platform_fee_blue NUMERIC,tx_hash TEXT); CREATE TABLE platform_commission_log(related_publication_id INTEGER,related_user_transaction_id INTEGER,commission_amount_blue NUMERIC); CREATE TABLE web3_escrow_holds(publication_id INTEGER,status TEXT,released_at TIMESTAMPTZ); CREATE TABLE notifications(recipient_username TEXT,message TEXT)");
  const relayer=ethers.Wallet.createRandom();await f.owner.sendTransaction({to:relayer.address,value:ethers.parseEther('2')});await f.core.setRelayer(relayer.address);
  await pool.query('ALTER TABLE publications ADD COLUMN blue_cost NUMERIC(20,2)');
  await require('../../backend/migrations/117_payment_recovery_controls').up(pool);
  const {MarketplacePayments}=require('../../backend/src/services/marketplacePayments');
  for(const [key,value] of Object.entries({gas_sponsor_enabled:'true',gas_sponsor_daily_user_operations:'3',gas_sponsor_daily_budget_wei:ethers.parseEther('1').toString(),gas_sponsor_max_topup_wei:ethers.parseEther('.1').toString()}))await pool.query('UPDATE app_settings SET setting_value=$2 WHERE setting_key=$1',[key,value]);
  const payments=new MarketplacePayments(pool,ethers.provider,cfg,{relayerKey:relayer.privateKey,walletService:service.walletService,finality:null,confirmations:1});
  paymentServices.push(payments);return {payments,payload:{publicationId:'1',acceptanceId:'1',category:'request',payer:'payer',payee:'payee',amount:'10',expectedFeeBps:String(await f.core.commissionBps())}};
 }
 async function sendAndRollback(payments,payload,pin='729418'){
  const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT * FROM users FOR UPDATE');await payments.begin(client,payload,pin);throw Error('Unexpected success');}
  catch(e){await client.query('ROLLBACK');if(e.code!=='PAYMENT_PENDING')throw e;return e.operationId;}finally{client.release();}
 }
 it('pago sobrevive rollback y reinicio: mismo hash, una emisión y un único registro',async()=>{
  const {payments,payload}=await marketplace();const before=await f.blue.balanceOf(f.alice.address);
  const id=await sendAndRollback(payments,payload);
  expect((await pool.query('SELECT * FROM transactions')).rowCount).eq(0);
  const first=(await payments.store.get(id)).steps[0].hash;
  expect(await sendAndRollback(payments,payload)).eq(id);
  expect((await payments.store.get(id)).steps[0].hash).eq(first);
  await payments.store.reconcile(id);expect(await payments.settle(id)).eq(true);expect(await payments.settle(id)).eq(true);
  expect(await f.blue.balanceOf(f.alice.address)).eq(before+10n*U);
  expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  expect((await pool.query('SELECT * FROM transactions')).rowCount).eq(2);
  expect((await pool.query('SELECT * FROM marketplace_payment_settlements')).rowCount).eq(1);
  expect((await payments.status(1,id)).settled).eq(true);
  await expect(payments.status(2,id)).rejectedWith('no encontrado');
 });
 it('fallo SQL al registrar un pago confirmado se recupera sin duplicar importe ni comisión',async()=>{
  const {payments,payload}=await marketplace();const id=await sendAndRollback(payments,payload);await payments.store.reconcile(id);
  await pool.query('ALTER TABLE notifications RENAME TO notifications_unavailable');
  await expect(payments.settle(id)).rejected;
  expect((await pool.query('SELECT * FROM transactions')).rowCount).eq(0);
  expect((await pool.query('SELECT status FROM publication_acceptances')).rows[0].status).eq('completed');
  await pool.query('ALTER TABLE notifications_unavailable RENAME TO notifications');await payments.settle(id);
  expect((await pool.query('SELECT * FROM transactions')).rowCount).eq(2);
  expect((await pool.query('SELECT * FROM platform_commission_log')).rowCount).eq(1);
 });
 it('referencia de donación no puede reutilizarse con otro importe y publica una sola participación',async()=>{
  const {payments,payload}=await marketplace();Object.assign(payload,{category:'donation',acceptanceId:null,requestId:randomUUID()});
  const id=await sendAndRollback(payments,payload);
  await expect(sendAndRollback(payments,{...payload,amount:'11'})).rejectedWith('otro pago');
  await payments.store.reconcile(id);await payments.settle(id);await payments.settle(id);
  expect(String((await pool.query('SELECT current_amount FROM publications')).rows[0].current_amount)).eq('10.000000');
 });
 it('no se puede cancelar una publicación mientras su pago está firmado y pendiente',async()=>{
  const {payments,payload}=await marketplace();await sendAndRollback(payments,payload);
  const client=await pool.connect();try{await client.query('BEGIN');await expect(require('../../backend/src/services/marketplacePayments').assertPublicationMutable(client,'1')).rejectedWith('en curso');await client.query('ROLLBACK');}finally{client.release();}
 });
 it('un usuario rechazado no paraliza la política global; reintento explícito conserva su incidencia',async()=>{
  const jobs=require('../../backend/src/services/creditPolicyJobs');
  const version=(await jobs.savePolicy(pool,'red_credit_base_limit','100',1)).policyVersion;
  const op=await service.store.prepare({key:'failed-credit',chainId:'1337',sender:user.address,resource:'test-credit',kind:'setCreditLimit',payload:{}});
  await pool.query("UPDATE chain_operations SET state='failed' WHERE id=$1",[op.id]);
  await pool.query('UPDATE credit_policy_jobs SET operation_id=$2,pending_user_id=1 WHERE version_id=$1',[version,op.id]);
  const visited=[];const scorer={syncCreditLimitOnChain:async id=>{visited.push(id);return {skipped:true};}};
  await jobs.tick(pool,scorer);expect(visited).deep.eq([2]);await jobs.tick(pool,scorer);
  expect((await pool.query('SELECT state FROM credit_policy_jobs')).rows[0].state).eq('complete_with_issues');
  await jobs.retryIssue(pool,version,1);await jobs.tick(pool,scorer);
  expect(visited).deep.eq([2,1]);expect((await pool.query('SELECT state FROM credit_policy_jobs')).rows[0].state).eq('complete');
 });
 it('un micropago conserva seis decimales en la blockchain y en el historial',async()=>{
  const {payments,payload}=await marketplace();payload.amount='0.000001';const id=await sendAndRollback(payments,payload);await payments.store.reconcile(id);await payments.settle(id);
  expect((await pool.query("SELECT blue_change FROM transactions WHERE type='payment_received'")).rows[0].blue_change).eq('0.000001');
 });
 it('un rechazo confirmado permite nuevo consentimiento sin repetir el intento anterior',async()=>{
  const {payments,payload}=await marketplace();let inject=true;
  payments.store.provider=new Proxy(ethers.provider,{get(target,key){if(key==='broadcastTransaction')return async raw=>{if(inject){inject=false;await f.core.setCommissionBps(600);}return target.broadcastTransaction(raw);};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
  const rejected=await sendAndRollback(payments,payload);expect((await payments.store.reconcile(rejected)).state).eq('failed');
  const next=await sendAndRollback(payments,{...payload,expectedFeeBps:'600'});expect(next).not.eq(rejected);await payments.store.reconcile(next);await payments.settle(next);
  expect((await pool.query('SELECT * FROM marketplace_payment_settlements')).rowCount).eq(1);
  expect(await f.red.balanceOf(user.address)).eq(10600000n);
 });
 it('autoamortización al cobrar se registra desde el evento y no infla el saldo',async()=>{
  const {payments,payload}=await marketplace();await f.pay(f.alice,f.bob,5n*U);
  await ethers.provider.send('evm_increaseTime',[Number(await f.core.COMMITMENT_DURATION())+1]);await ethers.provider.send('evm_mine',[]);
  const id=await sendAndRollback(payments,payload);await payments.store.reconcile(id);await payments.settle(id);
  const received=(await pool.query('SELECT SUM(blue_change)::text AS blue,SUM(red_change)::text AS red FROM transactions WHERE user_id=2')).rows[0];
  expect(received.blue).eq('4.750000');expect(received.red).eq('-5.250000');expect(await f.blue.balanceOf(f.alice.address)).eq(4750000n);
 });
 it('cuota de patrocinio incluye pagos marketplace y financiación de gas de billetera',async()=>{
  const {payments,payload}=await marketplace();Object.assign(payload,{category:'donation',acceptanceId:null,requestId:randomUUID()});
  await pool.query("UPDATE app_settings SET setting_value='1' WHERE setting_key='gas_sponsor_daily_user_operations'");
  const id=await sendAndRollback(payments,payload);await payments.store.reconcile(id);await payments.settle(id);
  await expect(sendAndRollback(payments,{...payload,requestId:randomUUID()})).rejectedWith('cuota');
  const used=await require('../../backend/src/services/gasBudgetUsage').usage(pool,'1337',1);expect(used.user_count).eq(1);expect(BigInt(used.total)).eq(ethers.parseEther('.1'));
  const sponsor=ethers.Wallet.createRandom();process.env.GAS_SPONSOR_PRIVATE_KEY=sponsor.privateKey;await f.owner.sendTransaction({to:sponsor.address,value:ethers.parseEther('1')});
  await ethers.provider.send('hardhat_setBalance',[user.address,'0x0']);
  const quote=await service.prepare(1,{action:'transfer',amount:'1',destination:f.bob.address});
  await expect(service.authorize(1,quote.operationId,'729418')).rejectedWith('presupuesto');
 });
 it('reservas firmadas de ayer siguen contando; preparaciones vencidas sin firma no',async()=>{
  const store=new ChainOperationStore(pool,ethers.provider,{finality:null,confirmations:1});
  const row=await store.prepare({userId:1,key:'old-gas',chainId:'1337',sender:user.address,resource:'test-budget',kind:'gas',payload:{reservedWei:'15',parentId:'old-parent'}});
  await pool.query("UPDATE chain_operations SET created_at=NOW()-interval '2 days',state='pending' WHERE id=$1",[row.id]);
  const usage=require('../../backend/src/services/gasBudgetUsage').usage;
  expect((await usage(pool,'1337',1)).total).eq('15');
  await pool.query("UPDATE chain_operations SET state='prepared' WHERE id=$1",[row.id]);expect((await usage(pool,'1337',1)).total).eq('0');
 });
 it('comisión cero conserva paridad y se registra como cero',async()=>{
  const {payments,payload}=await marketplace();await f.core.setCommissionBps(0);payload.expectedFeeBps='0';const id=await sendAndRollback(payments,payload);await payments.store.reconcile(id);await payments.settle(id);
  expect((await pool.query('SELECT commission_amount_blue FROM platform_commission_log')).rows[0].commission_amount_blue).eq('0.000000');expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
 });
 it('mantenimiento amortiza en contratos reales una sola vez y refleja un bloque confirmado',async()=>{
  await require('../../backend/migrations/118_chain_wallet_snapshots').up(pool);
  const runner=ethers.Wallet.createRandom();await f.owner.sendTransaction({to:runner.address,value:ethers.parseEther('1')});
  for(const [key,value] of Object.entries({gas_sponsor_enabled:'true',gas_sponsor_daily_budget_wei:ethers.parseEther('1').toString(),gas_sponsor_maintenance_daily_budget_wei:ethers.parseEther('.5').toString(),gas_sponsor_maintenance_max_step_wei:ethers.parseEther('.1').toString()}))await pool.query('INSERT INTO app_settings(setting_key,setting_value) VALUES($1,$2) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value',[key,value]);
  await f.core.connect(user).processPayment(user.address,f.bob.address,5n*U);await f.pay(f.alice,user,10n*U);
  await ethers.provider.send('evm_increaseTime',[Number(await f.core.COMMITMENT_DURATION())+1]);await ethers.provider.send('evm_mine',[]);
  const {settle,createMaintenanceWorker}=require('../../backend/src/services/chainMaintenance');
  const params={pool,rpc:ethers.provider,config:cfg,wallet:user.address,env:{RELAYER_PRIVATE_KEY:runner.privateKey},store:service.store};
  const sent=await settle(params);expect(sent.pending).eq(true);
  expect((await settle(params)).success).eq(true);expect((await settle(params)).status).eq('not_needed');
  expect(await f.red.balanceOf(user.address)).eq(0);expect(await f.blue.balanceOf(user.address)).eq(4750000n);expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  expect((await pool.query("SELECT * FROM chain_operations WHERE kind='settleMatured'")).rowCount).eq(1);
  const bridge={getUserAuditDetailed:async wallet=>{const block=await ethers.provider.getBlock('latest');return {success:true,blockNumber:block.number,blockHash:block.hash,blueBalance:ethers.formatUnits(await f.blue.balanceOf(wallet),6),credit:{isKYCVerified:await f.core.isKYCVerified(wallet),isDelinquent:await f.core.isDelinquent(wallet)}};}};
  const result=await createMaintenanceWorker(pool,{bridge,rpc:ethers.provider,config:cfg,execute:()=>{throw Error('should not spend');}}).tick();
  expect(result.failed).eq(0);expect(result.checked).eq(2);
  const row=(await pool.query('SELECT snapshot FROM web3_wallet_snapshots WHERE wallet_address=$1',[user.address.toLowerCase()])).rows[0];expect(row.snapshot.blueBalance).eq('4.75');expect(row.snapshot.credit.isDelinquent).eq(false);
 });
 it('una preparación antigua de mantenimiento no elude un límite de gas reducido',async()=>{
  const runner=ethers.Wallet.createRandom();await f.owner.sendTransaction({to:runner.address,value:ethers.parseEther('1')});
  for(const [key,value] of Object.entries({gas_sponsor_enabled:'true',gas_sponsor_daily_budget_wei:ethers.parseEther('1').toString(),gas_sponsor_maintenance_daily_budget_wei:ethers.parseEther('.5').toString(),gas_sponsor_maintenance_max_step_wei:ethers.parseEther('.05').toString()}))await pool.query('INSERT INTO app_settings(setting_key,setting_value) VALUES($1,$2) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value',[key,value]);
  await f.core.connect(user).processPayment(user.address,f.bob.address,5n*U);await f.pay(f.alice,user,10n*U);
  await ethers.provider.send('evm_increaseTime',[Number(await f.core.COMMITMENT_DURATION())+1]);await ethers.provider.send('evm_mine',[]);
  const resource=`maintenance:1337:${f.core.target.toLowerCase()}:${user.address.toLowerCase()}`;
  const old=await service.store.prepare({key:'old-maintenance',chainId:'1337',sender:runner.address,resource,kind:'settleMatured',payload:{to:f.core.target,data:f.core.interface.encodeFunctionData('settleMatured',[user.address]),value:'0',maxFeeWei:ethers.parseEther('.1').toString(),reservedWei:ethers.parseEther('.1').toString(),fingerprint:cfg.fingerprint}});
  await expect(require('../../backend/src/services/chainMaintenance').settle({pool,rpc:ethers.provider,config:cfg,wallet:user.address,env:{RELAYER_PRIVATE_KEY:runner.privateKey},store:service.store})).rejectedWith('MAINTENANCE_POLICY_REDUCED');
  expect((await service.store.get(old.id)).steps).length(0);expect(await f.red.balanceOf(user.address)).eq(5250000n);
 });
 it('la consulta de billetera distingue BLUE total, en parking y disponible tras liberarse',async()=>{
  const fs=require('fs'),vm=require('vm'),path=require('path');
  const source=fs.readFileSync(path.resolve(__dirname,'../../backend/src/services/web3BridgeService.js'),'utf8');
  const start=source.indexOf('    async getUserAuditDetailed('),end=source.indexOf('    async setExtensionParams(',start);
  let simulatedNow=Date.now();class TestDate extends Date {static now(){return simulatedNow;}}
  const method=vm.runInNewContext('({'+source.slice(start,end)+'})',{ethers,BLUE_ADDRESS:f.blue.target,RED_ADDRESS:f.red.target,USDT_ADDRESS:f.usdt.target,Date:TestDate,require:()=>({configuration:()=>cfg})}).getUserAuditDetailed;
  const receiver={provider:ethers.provider,_getProtocol:()=>f.core,_getVault:()=>f.vault,_getERC20:address=>new ethers.Contract(address,['function balanceOf(address) view returns(uint256)'],ethers.provider)};
  await f.pay(f.alice,user,100n*U);
  simulatedNow=(await ethers.provider.getBlock('latest')).timestamp*1000;
  let state=await method.call(receiver,user.address);expect(state.success,state.error).eq(true);expect(state.blueBalance).eq('100.0');expect(state.blueAvailable).eq('0.0');expect(state.blueLocked).eq('100.0');
  await ethers.provider.send('evm_increaseTime',[Number(await f.core.COMMITMENT_DURATION())+1]);await ethers.provider.send('evm_mine',[]);
  simulatedNow=(await ethers.provider.getBlock('latest')).timestamp*1000;
  state=await method.call(receiver,user.address);expect(state.blueAvailable).eq('100.0');expect(state.blueLocked).eq('0.0');
 });
});
