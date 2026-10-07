const {expect}=require('chai');
const {ethers}=require('hardhat');
const {loadFixture,time}=require('@nomicfoundation/hardhat-network-helpers');
const {fixture,U}=require('./helpers/suite');
const artifact=name=>require('./vendor/safe-1.4.1/'+name+'.json');
async function safeFixture(){
 const f=await fixture(),owner=ethers.Wallet.createRandom();
 async function deploy(name){const a=artifact(name);return (await new ethers.ContractFactory(a.abi,a.bytecode,f.owner).deploy()).waitForDeployment();}
 const singleton=await deploy('Safe'),handler=await deploy('CompatibilityFallbackHandler'),factory=await deploy('SafeProxyFactory');
 const init=singleton.interface.encodeFunctionData('setup',[[owner.address],1,ethers.ZeroAddress,'0x',handler.target,ethers.ZeroAddress,0,ethers.ZeroAddress]);
 const receipt=await (await factory.createProxyWithNonce(singleton.target,init,123)).wait();
 const address=receipt.logs.map(l=>{try{return factory.interface.parseLog(l);}catch{return null;}}).find(e=>e?.name==='ProxyCreation').args.proxy;
 const safe=new ethers.Contract(address,artifact('Safe').abi,f.relayer);
 await f.core.setKYCStatus(address,true);await f.core.setCreditLimit(address,1000n*U);
 const domain={name:'WintonCore',version:'4',chainId:1337,verifyingContract:f.core.target};
 const types={Payment:['payer:address','payee:address','amount:uint256','feeBps:uint256','nonce:uint256','deadline:uint256','agreementHash:bytes32'].map(x=>{const [name,type]=x.split(':');return {name,type};})};
 const auth={payer:address,payee:f.bob.address,amount:100n*U,feeBps:500,nonce:0,deadline:(await ethers.provider.getBlock('latest')).timestamp+900,agreementHash:ethers.id('synthetic-agreement')};
 async function signature(value=auth){const digest=ethers.TypedDataEncoder.hash(domain,types,value);return owner.signTypedData({chainId:1337,verifyingContract:address},{SafeMessage:[{name:'message',type:'bytes'}]},{message:digest});}
 return {...f,safe,account:address,owner,auth,signature,handler,singleton};
}
describe('Integración real: Safe 1.4.1 y contratos Winton',function(){
 this.timeout(120000);
 it('EIP-1271 conserva paridad, parking y compromiso en la dirección Safe',async()=>{
  const f=await loadFixture(safeFixture);
  await f.core.connect(f.relayer).processAuthorizedPayment(f.auth,await f.signature());
  expect(await f.red.balanceOf(f.account)).eq(105n*U);
  expect(await f.blue.lockedBalanceOf(f.bob.address)).eq(100n*U);
  expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  expect(await f.red.balanceOf(f.owner.address)).eq(0);
 });
 it('no acepta cambiar destinatario ni reutilizar una autorización',async()=>{
  const f=await loadFixture(safeFixture),signature=await f.signature();
  await expect(f.core.connect(f.relayer).processAuthorizedPayment({...f.auth,payee:f.carol.address},signature)).revertedWith('Protocol: Invalid payer signature');
  await f.core.connect(f.relayer).processAuthorizedPayment(f.auth,signature);
  await expect(f.core.connect(f.relayer).processAuthorizedPayment(f.auth,signature)).revertedWith('Protocol: Invalid payment nonce');
 });
 it('una firma válida no omite KYC, pausa ni comisión vigente',async()=>{
  const f=await loadFixture(safeFixture),signature=await f.signature();
  await f.core.setKYCStatus(f.account,false);
  await expect(f.core.processAuthorizedPayment(f.auth,signature)).revertedWith('Protocol: Payer KYC not verified');
  await f.core.setKYCStatus(f.account,true);await f.core.setCommissionBps(600);
  await expect(f.core.processAuthorizedPayment(f.auth,signature)).revertedWith('Protocol: Commission changed');
  await f.core.setCommissionBps(500);await f.core.pause();
  await expect(f.core.processAuthorizedPayment(f.auth,signature)).revertedWithCustomError(f.core,'EnforcedPause');
 });
 it('un fallo dentro de la Safe revierte el envío patrocinado sin incrementar su nonce',async()=>{
  const f=await loadFixture(safeFixture);
  const data=f.core.interface.encodeFunctionData('processPayment',[f.account,f.bob.address,999999n*U]);
  const tx={to:f.core.target,value:0,data,operation:0,safeTxGas:0,baseGas:0,gasPrice:0,gasToken:ethers.ZeroAddress,refundReceiver:ethers.ZeroAddress,nonce:0};
  const types={SafeTx:['to:address','value:uint256','data:bytes','operation:uint8','safeTxGas:uint256','baseGas:uint256','gasPrice:uint256','gasToken:address','refundReceiver:address','nonce:uint256'].map(x=>{const [name,type]=x.split(':');return {name,type};})};
  const sig=await f.owner.signTypedData({chainId:1337,verifyingContract:f.account},types,tx);
  await expect(f.safe.execTransaction(tx.to,0,data,0,0,0,0,ethers.ZeroAddress,ethers.ZeroAddress,sig)).revertedWith('GS013');
  expect(await f.safe.nonce()).eq(0);expect(await f.red.balanceOf(f.account)).eq(0);
 });
 async function recoveryFixture(){
  const f=await safeFixture(),a=require('./vendor/safe-recovery-0.1.0/SocialRecoveryModule.json');
  const recovery=await new ethers.ContractFactory(a.abi,a.bytecode,f.relayer).deploy(86400);
  const guardian=ethers.Wallet.createRandom(),replacement=ethers.Wallet.createRandom();
  async function exec(to,data){
   const tx={to,value:0,data,operation:0,safeTxGas:0,baseGas:0,gasPrice:0,gasToken:ethers.ZeroAddress,refundReceiver:ethers.ZeroAddress,nonce:await f.safe.nonce()};
   const types={SafeTx:['to:address','value:uint256','data:bytes','operation:uint8','safeTxGas:uint256','baseGas:uint256','gasPrice:uint256','gasToken:address','refundReceiver:address','nonce:uint256'].map(x=>{const [name,type]=x.split(':');return {name,type};})};
   const sig=await f.owner.signTypedData({chainId:1337,verifyingContract:f.account},types,tx);
   return f.safe.execTransaction(to,0,data,0,0,0,0,ethers.ZeroAddress,ethers.ZeroAddress,sig);
  }
  await exec(f.account,f.safe.interface.encodeFunctionData('enableModule',[recovery.target]));
  await exec(recovery.target,recovery.interface.encodeFunctionData('addGuardianWithThreshold',[guardian.address,1]));
  const digest=await recovery.getRecoveryHash(f.account,[replacement.address],1,await recovery.nonce(f.account));
  const signature=guardian.signingKey.sign(digest).serialized;
  const request=()=>recovery.multiConfirmRecovery(f.account,[replacement.address],1,[{signer:guardian.address,signature}],true);
  return {...f,recovery,guardian,replacement,recoverySignature:signature,request,exec};
 }
 it('recuperar conserva BLUE/RED y dirección; antes de la espera no puede ejecutarse',async()=>{
  const f=await loadFixture(recoveryFixture);
  await f.core.processAuthorizedPayment(f.auth,await f.signature());
  const debt=await f.red.balanceOf(f.account);
  await f.request();await expect(f.recovery.finalizeRecovery(f.account)).to.be.reverted;
  const request=await f.recovery.getRecoveryRequest(f.account);
  await time.increaseTo(request.executeAfter);await f.recovery.finalizeRecovery(f.account);
  expect(await f.safe.getOwners()).deep.eq([f.replacement.address]);
  expect(await f.red.balanceOf(f.account)).eq(debt);
  expect(await f.red.balanceOf(f.replacement.address)).eq(0);
  expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  await expect(f.request()).to.be.reverted;
 });
 it('el dispositivo anterior cancela; el solicitante externo no cancela por él',async()=>{
  const f=await loadFixture(recoveryFixture);await f.request();
  await expect(f.recovery.connect(f.other).cancelRecovery()).to.be.reverted;
  expect((await f.recovery.getRecoveryRequest(f.account)).executeAfter).greaterThan(0);
  await f.exec(f.recovery.target,f.recovery.interface.encodeFunctionData('cancelRecovery',[]));
  await time.increase(86401);await expect(f.recovery.finalizeRecovery(f.account)).to.be.reverted;
  expect(await f.safe.getOwners()).deep.eq([f.owner.address]);
 });
 it('otro ejecutor paga el gas y cancela solo con autorización del titular',async()=>{
  const f=await loadFixture(recoveryFixture);await f.request();
  const policy=require('../../backend/src/services/safeAccountPolicy');
  const data=f.recovery.interface.encodeFunctionData('cancelRecovery',[]);
  const tx=policy.transaction({to:f.recovery.target,data},await f.safe.nonce());
  const types={SafeTx:['to:address','value:uint256','data:bytes','operation:uint8','safeTxGas:uint256','baseGas:uint256','gasPrice:uint256','gasToken:address','refundReceiver:address','nonce:uint256'].map(x=>{const [name,type]=x.split(':');return {name,type};})};
  const signature=await f.owner.signTypedData({chainId:1337,verifyingContract:f.account},types,tx);
  const call=policy.execution(f.account,tx,signature);
  await f.other.sendTransaction(call);
  expect((await f.recovery.getRecoveryRequest(f.account)).executeAfter).eq(0);
  expect(await f.safe.getOwners()).deep.eq([f.owner.address]);
  await expect(f.other.sendTransaction(call)).to.be.reverted;
 });
 it('detecta y permite cancelar una recuperación iniciada fuera de la aplicación',async()=>{
  const f=await loadFixture(recoveryFixture);await f.request();
  const contracts={};
  for(const [name,address] of Object.entries({singleton:f.singleton.target,fallbackHandler:f.handler.target,recoveryModule:f.recovery.target}))contracts[name]={address,codeHash:ethers.keccak256(await ethers.provider.getCode(address))};
  const config={chainId:'1337',hash:'local-test',safeVersion:'1.4.1',contracts,proxyCodeHash:ethers.keccak256(await ethers.provider.getCode(f.account)),recoveryDeploymentEvidence:'local audited artifact in fixture'};
  const account={state:'active',backup_confirmed_at:new Date(),address:f.account.toLowerCase(),identity_id:'synthetic',passkey:{owner:f.owner.address},recovery_address:f.guardian.address.toLowerCase(),manifest_hash:config.hash};
  const pool={query:async sql=>({rows:sql.includes('JOIN account_identities')?[account]:[]})};
  const {PersonalRecovery}=require('../../backend/src/services/personalRecovery');
  const service=new PersonalRecovery({pool,rpc:ethers.provider,config,store:{}});
  expect((await service.status(1)).recovery.state).eq('external');
  const quote=await service.cancelQuote(1,'external');
  expect(quote.transaction.to).eq(f.recovery.target);
  expect(quote.transaction.data).eq(f.recovery.interface.encodeFunctionData('cancelRecovery',[]));
 });
 it('el SDK firma con P-256 local; el servidor recibe solo la autorización',async()=>{
  const f=await loadFixture(recoveryFixture);
  const crypto=require('crypto');
  const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=publicKey.export({format:'jwk'});
  async function deploy(name){const a=require('./vendor/safe-passkey-0.2.0/'+name+'.json');return (await new ethers.ContractFactory(a.abi,a.bytecode,f.relayer).deploy()).waitForDeployment();}
  const verifier=await deploy('DaimoP256Verifier'),factory=await deploy('SafeWebAuthnSignerFactory'),shared=await deploy('SafeWebAuthnSharedSigner');
  const coordinates={x:'0x'+Buffer.from(jwk.x,'base64url').toString('hex'),y:'0x'+Buffer.from(jwk.y,'base64url').toString('hex')};
  const signer=await factory.getSigner(coordinates.x,coordinates.y,verifier.target);
  await factory.createSigner(coordinates.x,coordinates.y,verifier.target);
  await f.exec(f.account,f.safe.interface.encodeFunctionData('swapOwner',['0x0000000000000000000000000000000000000001',f.owner.address,signer]));
  let verificationFlags=5;
  const getFn=async({publicKey:options})=>{
   const clientDataJSON=Buffer.from(JSON.stringify({type:'webauthn.get',challenge:Buffer.from(options.challenge).toString('base64url'),origin:'https://example.test',crossOrigin:false}));
   const authenticatorData=Buffer.concat([crypto.createHash('sha256').update('example.test').digest(),Buffer.from([verificationFlags,0,0,0,1])]);
   const signature=crypto.sign('sha256',Buffer.concat([authenticatorData,crypto.createHash('sha256').update(clientDataJSON).digest()]),privateKey);
   const array=b=>Uint8Array.from(b).buffer;
   return {response:{clientDataJSON:array(clientDataJSON),authenticatorData:array(authenticatorData),signature:array(signature)}};
  };
  const Safe=require('../../frontend/node_modules/@safe-global/protocol-kit').default;
  const {signPasskeyHash}=await import('../../frontend/src/modules/passkeyAuthorization.js');
  const deploySafe=async name=>{const a=artifact(name);return (await new ethers.ContractFactory(a.abi,a.bytecode,f.relayer).deploy()).waitForDeployment();};
  const multi=await deploySafe('MultiSend'),callOnly=await deploySafe('MultiSendCallOnly');
  const sdk=await Safe.init({provider:require('hardhat').network.provider,safeAddress:f.account,
   contractNetworks:{1337:{multiSendAddress:multi.target,multiSendCallOnlyAddress:callOnly.target,safeWebAuthnSignerFactoryAddress:factory.target,safeWebAuthnSharedSignerAddress:shared.target}},
   signer:{rawId:'11'.repeat(32),coordinates,verifierAddress:verifier.target,getFn}});
  const domain={name:'WintonCore',version:'4',chainId:1337,verifyingContract:f.core.target};
  const types={Payment:['payer:address','payee:address','amount:uint256','feeBps:uint256','nonce:uint256','deadline:uint256','agreementHash:bytes32'].map(x=>{const [name,type]=x.split(':');return {name,type};})};
  verificationFlags=1;
  const withoutVerification=sdk.createMessage({domain,types,primaryType:'Payment',message:f.auth});
  withoutVerification.addSignature(await signPasskeyHash(sdk,await sdk.getSafeMessageHash(ethers.TypedDataEncoder.hash(domain,types,f.auth))));
  await expect(f.core.processAuthorizedPayment(f.auth,withoutVerification.encodedSignatures())).to.be.reverted;
  verificationFlags=5;
  const message=sdk.createMessage({domain,types,primaryType:'Payment',message:f.auth});
  message.addSignature(await signPasskeyHash(sdk,await sdk.getSafeMessageHash(ethers.TypedDataEncoder.hash(domain,types,f.auth))));
  await f.core.processAuthorizedPayment(f.auth,message.encodedSignatures());
  expect(await f.red.balanceOf(f.account)).eq(105n*U);
  const transaction=await sdk.createTransaction({transactions:[{to:f.usdt.target,data:f.usdt.interface.encodeFunctionData('approve',[f.vault.target,U]),value:'0',operation:0}],options:{safeTxGas:'0',gasPrice:'0'}});
  transaction.addSignature(await signPasskeyHash(sdk,await sdk.getTransactionHash(transaction)));
  const signed=transaction,t=signed.data;
  await f.safe.execTransaction(t.to,t.value,t.data,t.operation,t.safeTxGas,t.baseGas,t.gasPrice,t.gasToken,t.refundReceiver,signed.encodedSignatures());
  expect(await f.usdt.allowance(f.account,f.vault.target)).eq(U);
 });
});
