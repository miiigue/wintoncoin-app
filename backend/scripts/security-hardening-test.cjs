'use strict';
// Run with node. Only a deliberately enabled localhost review DB is permitted.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const {createRequire}=require('module'),{Pool}=require('pg'),jwt=require('jsonwebtoken'),{ethers}=require('ethers');
const root=path.resolve(__dirname,'..');
const results=[];const ok=(name)=>results.push(name);
function response(){return {locals:{},code:200,setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};}
function load(file,overrides={},env={}){const filename=path.join(root,file),module={exports:{}};const native=createRequire(filename);
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,exports:module.exports,Buffer,URL,Date,process:{env},__dirname:path.dirname(filename),console:{log(){},warn(){},error(){}},require:name=>Object.hasOwn(overrides,name)?overrides[name]:native(name)},{filename});return module.exports;}
(async()=>{
 const secret=crypto.randomBytes(32).toString('hex'),userSecret=crypto.randomBytes(32).toString('hex');
 let account={id:1,username:'synthetic_admin',role:'admin',account_status:'active',password_hash:'test-password-version'};
 const session=load('src/middleware/adminSession.js',{'../config/db':{query:async()=>({rows:account?[account]:[]})}},{ADMIN_SECRET_KEY:secret,JWT_SECRET:userSecret});
 const token=jwt.sign({userId:1,role:'admin',pwdVersion:account.password_hash.slice(-10)},secret);
 const request={method:'POST',cookies:{admin_token:token},headers:{origin:'https://demo.wintoncoin.com'}};
 async function check(req,code){let passed=false;const res=response();await session.verifySession(req,res,()=>{passed=true;});assert.equal(code===200?passed:res.code,code===200?true:code);}
 await check(request,200);ok('active admin accepted');
 await check({...request,headers:{origin:'https://demo.wintoncoin.com.attacker.invalid'}},403);ok('origin-prefix attack rejected');
 await check({...request,headers:{}},403);ok('missing mutation origin rejected');
 await check({...request,cookies:{admin_token:jwt.sign({userId:1,role:'user'},userSecret)}},401);ok('ordinary user token rejected');
 account={...account,account_status:'suspended'};await check(request,401);ok('suspended admin rejected');account={...account,account_status:'active',password_hash:'changed'};await check(request,401);ok('password revocation enforced');
 account={...account,role:'auditor',password_hash:'test-password-version'};await check({...request,cookies:{admin_token:jwt.sign({userId:1,role:'auditor',pwdVersion:account.password_hash.slice(-10)},secret)}},403);ok('auditor cannot mutate');
 let writes=0;
 const settings=load('src/controllers/admin/adminSystemSettingsController.js',{'../../config/db':{query:async sql=>{if(sql.includes('INSERT INTO app_settings'))writes++;return {rows:[{count:'0'}]};}},'../../services/auditService':{logAuditEvent:async()=>{}},'../../services/boosterService':{},'../../services/web3BridgeService':{setCommissionRate:async()=>({success:false,error:'synthetic refusal'}),setCommitmentDuration:async()=>({success:false,error:'synthetic refusal'})}});
 for(const key of ['platform_commission_percentage','debt_cycle_days']) {const res=response();await settings.updateSetting({body:{key,value:'5'},contractConfiguration:true,user:{}},res);assert.equal(res.code,503);assert.equal(writes,0);ok(`${key}: rejected chain change leaves mirror unchanged`);}
 const legacy=response();await settings.updateSetting({body:{key:'platform_commission_percentage',value:'5'},user:{}},legacy);assert.equal(legacy.code,409);ok('old settings endpoint cannot edit contract parameter');
 const confirmed=load('src/controllers/admin/adminWeb3Controller.js',{'../../config/db':{query:async()=>{throw Error('synthetic mirror failure');}},'../../services/web3BridgeService':{setCreditLimit:async()=>({success:true,pending:true,operationId:'synthetic-pending',txHash:'synthetic-confirmed-hash'})},'../../services/auditService':{logAuditEvent:async()=>{}}});
 const confirmedResponse=response();await confirmed.setCreditLimit({body:{walletAddress:ethers.Wallet.createRandom().address,limit:'25'},user:{},targetUser:{id:1}},confirmedResponse);
 assert.equal(confirmedResponse.code,202);assert.equal(confirmedResponse.body.accepted,true);assert.equal(confirmedResponse.body.txHash,'synthetic-confirmed-hash');ok('pending durable credit change is reported as accepted, not confirmed');
 const identityWallet=ethers.Wallet.createRandom().address;
 const identity=load('src/middleware/contractAdministration.js',{'../config/db':{query:async sql=>({rows:sql.includes('LOWER(username)')?[{id:1,username:'synthetic',web3_wallet_address:identityWallet}]:[{id:1}]})}});
 let resolved=false;await identity.resolveUser({body:{username:'synthetic',walletAddress:ethers.Wallet.createRandom().address}},response(),()=>{resolved=true;});assert.equal(resolved,false);ok('admin cannot substitute a wallet for the selected username');
 // Run the actual payment method against adversarial contract responses, with no RPC.
 const source=fs.readFileSync(path.join(root,'src/services/web3BridgeService.js'),'utf8');
 const begin=source.indexOf('    async syncPaymentToBlockchain('),end=source.indexOf('    async executeMatching(',begin);
 const method=vm.runInNewContext('({'+source.slice(begin,end)+'})',{ethers,TREASURY_ADDRESS:ethers.Wallet.createRandom().address,console:{log(){},error(){}},pool:{query:async()=>{}}}).syncPaymentToBlockchain;
 let grants=0,pays=0;
 const proto={isKYCVerified:async()=>false,getAvailableCreditCapacity:async()=>0n,setKYCStatus:async()=>grants++,setCreditLimit:async()=>grants++,processAuthorizedPayment:async()=>pays++};
 const args={payerWalletAddress:ethers.Wallet.createRandom().address,payeeWalletAddress:ethers.Wallet.createRandom().address,amountBlue:'1',signature:'synthetic'};
 args.authorization={payer:args.payerWalletAddress,payee:args.payeeWalletAddress,amount:1000000n,feeBps:500};
 await assert.rejects(()=>method.call({_isReady:()=>true,_getProtocol:()=>proto},args),/KYC/);assert.equal(grants,0);assert.equal(pays,0);ok('payment cannot grant KYC');
 proto.isKYCVerified=async()=>true;await assert.rejects(()=>method.call({_isReady:()=>true,_getProtocol:()=>proto},args),/insuficiente/);assert.equal(grants,0);assert.equal(pays,0);ok('payment cannot raise credit limit');
 let baseLimit='100',override=null;
 const scoreClient={release(){},query:async sql=>{
   if(sql.includes('red_credit_limit_override'))return {rows:[{red_credit_limit_override:override}]};
   if(sql.includes('FROM app_settings'))return {rows:[{setting_key:'red_credit_base_limit',setting_value:baseLimit},{setting_key:'red_credit_referral',setting_value:'0'},{setting_key:'red_credit_monthly_activity',setting_value:'0'}]};
   assert(!sql.includes('collateral_deposits'),'collateral must not be added to base limit');return {rows:[{count:'0'}]};
 }};
 const score=load('src/services/creditScoringService.js',{'../config/db':{connect:async()=>scoreClient}});
 assert.equal(await score.calculateUserScore(1),100);ok('collateral is not counted in base credit');
 baseLimit='0';assert.equal(await score.calculateUserScore(1),0);ok('zero credit policy is respected');
 override='25';assert.equal(await score.calculateUserScore(1),25);ok('individual exception survives automatic scoring');
 if(process.env.ALLOW_LOCAL_SECURITY_DB!=='true')throw Error('Set ALLOW_LOCAL_SECURITY_DB=true for the isolated PostgreSQL tests');
 const base={host:'127.0.0.1',port:Number(process.env.WINTON_MIGRATION_TEST_PORT||54389),user:'review070',database:'postgres',connectionTimeoutMillis:5000};
 const control=new Pool(base),schema='security075_'+crypto.randomBytes(6).toString('hex');let pool,attemptPool;
 try {
  const dir=(await control.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/');assert(dir.endsWith('/pg-review-070'));
  await control.query(`CREATE SCHEMA ${schema}`);
  pool=new Pool({...base,options:`-c search_path=${schema},public`,max:8});attemptPool=new Pool({...base,options:`-c search_path=${schema},public`,max:4});
  await pool.query('CREATE TABLE users (id integer PRIMARY KEY,username text,kyc_verified boolean default true,web3_wallet_address text,web3_private_key_encrypted text)');
  const migration=await pool.connect();try{await migration.query('BEGIN');await require('../migrations/113_add_transaction_pin_self_custody').up(migration);await require('../migrations/114_wallet_pin_attempts').up(migration);await require('../migrations/115_wallet_identity_credit_override').up(migration);await migration.query('COMMIT');}finally{migration.release();}
  const wallet=load('src/services/walletService.js',{'./pinAttemptsPool':attemptPool},{ENCRYPTION_SECRET:crypto.randomBytes(32).toString('hex')});
  const controller=load('src/controllers/userController.js',{'../config/db':pool,'../services/auditService':{logAuditEvent:async()=>{}},'../services/walletService':wallet});
  await pool.query("INSERT INTO users(id,username) VALUES(1,'synthetic_pin'),(2,'synthetic_parallel'),(3,'synthetic_legacy'),(4,'synthetic_external')");
  for(const id of [1,2])await wallet.setupTransactionPin(pool,id,'729418');
  const codes=[];for(let i=0;i<6;i++){const r=response();await controller.verifyMyPin({user:{userId:1},body:{pin:'582063'}},r);codes.push(r.code);}
  assert.deepEqual(codes,[401,401,401,401,429,429]);assert.equal((await wallet.getPinStatus(pool,1)).isLocked,true);ok('six wrong PINs persist across controller rollbacks and lock');
  const parallel=await Promise.allSettled(Array.from({length:6},()=>wallet.verifyTransactionPin(pool,2,'582063')));assert(parallel.every(x=>x.status==='rejected'));
  assert.equal((await pool.query('SELECT failed_attempts FROM wallet_pin_attempts WHERE user_id=2')).rows[0].failed_attempts,5);ok('parallel PIN failures cannot lose increments');
  const old=wallet.generateEncryptedWallet();await pool.query('UPDATE users SET web3_wallet_address=$1,web3_private_key_encrypted=$2 WHERE id=3',[old.address,old.encryptedPrivateKey]);
  await wallet.setupTransactionPin(pool,3,'729418');
  const migrated=(await pool.query('SELECT * FROM users WHERE id=3')).rows[0];assert.equal(migrated.web3_private_key_encrypted,null);assert.equal(migrated.web3_wallet_address,old.address);assert.equal(migrated.web3_keystore.version,2);ok('verified PIN migration preserves wallet and removes legacy duplicate');
  await wallet.setupTransactionPin(pool,3,'846291','729418');assert.equal(new ethers.Wallet(await wallet.decryptPrivateKeyWithPin(pool,3,'846291')).address,old.address);ok('PIN change preserves signing identity');
  await pool.query('UPDATE users SET web3_wallet_address=$1 WHERE id=4',[ethers.Wallet.createRandom().address]);await assert.rejects(()=>wallet.setupTransactionPin(pool,4,'729418'),/recuperación/);assert.equal((await pool.query('SELECT web3_keystore FROM users WHERE id=4')).rows[0].web3_keystore,null);ok('existing external wallet is never silently replaced');
  await pool.query("UPDATE wallet_pin_attempts SET locked_until=NOW()-INTERVAL '1 second' WHERE user_id=1");assert.equal((await wallet.verifyTransactionPin(pool,1,'729418')).valid,true);ok('lock expires and correct PIN recovers');
  // Reproduce business row locks: PIN counter must still complete independently.
  const business=await pool.connect();try{await business.query('BEGIN');await business.query('SELECT id FROM users WHERE id=3 FOR UPDATE');await assert.rejects(()=>wallet.verifyTransactionPin(business,3,'582063'),/incorrecto/);await business.query('ROLLBACK');assert.equal((await pool.query('SELECT failed_attempts FROM wallet_pin_attempts WHERE user_id=3')).rows[0].failed_attempts,1);ok('business row lock/rollback cannot erase security counter');}finally{business.release();}
  await assert.rejects(()=>pool.query('UPDATE users SET web3_wallet_address=$1 WHERE id=4',[old.address.toLowerCase()]),error=>error.code==='23505');ok('one wallet cannot belong to two users, ignoring case');
  const legacyWallet=ethers.Wallet.createRandom(),legacySalt=crypto.randomBytes(32).toString('hex'),legacyIv=crypto.randomBytes(12);
  const legacyCipher=crypto.createCipheriv('aes-256-gcm',crypto.pbkdf2Sync('729418',Buffer.from(legacySalt,'hex'),100000,32,'sha256'),legacyIv);
  const ciphertext=Buffer.concat([legacyCipher.update(legacyWallet.privateKey,'utf8'),legacyCipher.final()]).toString('hex');
  const legacyBox={version:1,iterations:100000,salt:legacySalt,iv:legacyIv.toString('hex'),authTag:legacyCipher.getAuthTag().toString('hex'),ciphertext};
  await pool.query('INSERT INTO users(id,username,web3_wallet_address,has_transaction_pin,transaction_pin_hash,web3_keystore) VALUES(5,$1,$2,true,$3,$4)',['legacy_v1',legacyWallet.address,await require('bcrypt').hash('729418',10),JSON.stringify(legacyBox)]);
  const upgrade=await pool.connect();try{await upgrade.query('BEGIN');assert.equal(new ethers.Wallet(await wallet.decryptPrivateKeyWithPin(upgrade,5,'729418')).address,legacyWallet.address);await upgrade.query('COMMIT');}finally{upgrade.release();}
  assert.equal((await pool.query('SELECT web3_keystore FROM users WHERE id=5')).rows[0].web3_keystore.version,2);ok('legacy v1 PIN upgrades after authorization without changing address');
  const noSecret=load('src/services/walletService.js',{'./pinAttemptsPool':attemptPool});assert.throws(()=>noSecret.generateEncryptedWallet(),/no está configurada/);ok('no hardcoded encryption-secret fallback');
 } finally {if(pool)await pool.end();if(attemptPool)await attemptPool.end();await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await control.end();}
 console.log(JSON.stringify({passed:results.length,tests:results},null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
