'use strict';
const hre=require('hardhat');const {ethers}=hre;const fs=require('fs'),path=require('path');
async function main(){
 const local=process.env.DEMO_LOCAL_REHEARSAL==='true';
 const chain=String((await ethers.provider.getNetwork()).chainId);
 if(local?!['1337','31337'].includes(chain):chain!=='11155420')throw Error('Red incorrecta');
 if(!local&&process.env.ALLOW_CLEAN_DEMO_DEPLOY!=='true')throw Error('Despliegue demo no habilitado');
 const plan=JSON.parse(fs.readFileSync(process.env.DEMO_DEPLOY_PLAN,'utf8'));
 if(!local&&String(plan.chainId)!==chain)throw Error('Plan de otra red');
 let wallet;if(local){wallet=ethers.Wallet.createRandom().connect(ethers.provider);const [funder]=await ethers.getSigners();await(await funder.sendTransaction({to:wallet.address,value:ethers.parseEther('2')})).wait()}else{wallet=new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY,ethers.provider);if(wallet.address.toLowerCase()!==plan.owner.toLowerCase())throw Error('Firmante distinto del administrador verificado')}
 const artifactNames=['MockERC20','BlueToken','RedToken','CoreProtocol','ProtocolTreasury','CollateralVault','FifoExchange'];const artifacts={};for(const name of artifactNames)artifacts[name]=await hre.artifacts.readArtifact(name);
 const fingerprint=ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({chain,wallet:wallet.address,plan,bytecode:Object.fromEntries(artifactNames.map(n=>[n,ethers.keccak256(artifacts[n].bytecode)]))})));
 const journalPath=path.resolve(process.env.DEMO_DEPLOY_JOURNAL||'clean-demo-journal.json');let state=fs.existsSync(journalPath)?JSON.parse(fs.readFileSync(journalPath,'utf8')):{fingerprint,chainId:chain,deployer:wallet.address,steps:{},contracts:{}};
 if(state.fingerprint!==fingerprint)throw Error('El plan o las fuentes cambiaron; no se reutiliza el registro');
 const persist=()=>{fs.writeFileSync(journalPath+'.tmp',JSON.stringify(state,null,2));fs.renameSync(journalPath+'.tmp',journalPath)};
 const budget=BigInt(process.env.DEMO_DEPLOY_MAX_WEI||'0');if(budget<=0n)throw Error('Falta límite de gasto de testnet');
 async function send(label,request){
  let step=state.steps[label];
  if(!step){
   let estimate,lastError;for(let attempt=0;attempt<4;attempt++){try{estimate=await wallet.estimateGas(request);break;}catch(e){lastError=e;if(attempt<3)await new Promise(resolve=>setTimeout(resolve,2000));}}if(estimate===undefined)throw lastError;const gas=estimate*110n/100n;
   if(gas>6_000_000n)throw Error('Paso supera límite de gas de despliegue');
   const tx=await wallet.populateTransaction({...request,gasLimit:gas,nonce:Math.max(await ethers.provider.getTransactionCount(wallet.address,'pending'),...Object.values(state.steps).map(s=>s.nonce+1),0)});
   const raw=await wallet.signTransaction(tx),max=gas*BigInt(tx.maxFeePerGas||tx.gasPrice);
   const reserved=Object.values(state.steps).reduce((n,s)=>n+BigInt(s.maxCost),0n);
   if(reserved+max>budget||max>await ethers.provider.getBalance(wallet.address))throw Error('Presupuesto de despliegue insuficiente');
   step={raw,hash:ethers.keccak256(raw),maxCost:max.toString(),nonce:tx.nonce};state.steps[label]=step;persist();
  }
  let receipt=await ethers.provider.getTransactionReceipt(step.hash);
  if(!receipt){
   if(await ethers.provider.getTransactionCount(wallet.address,'latest')>step.nonce)throw Error('Nonce consumido por otra operación; no se reenvía');
   if(!await ethers.provider.getTransaction(step.hash))await ethers.provider.broadcastTransaction(step.raw);
   const until=Date.now()+55000;while(!receipt&&Date.now()<until){receipt=await ethers.provider.getTransactionReceipt(step.hash);if(!receipt)await new Promise(resolve=>setTimeout(resolve,1000));}
  }
  if(!receipt||receipt.status!==1)throw Error('Paso pendiente o rechazado: '+label);
  step.blockNumber=receipt.blockNumber;step.gasUsed=receipt.gasUsed.toString();step.confirmed=true;persist();console.log(label+' confirmado '+step.hash);return receipt;
 }
 async function deploy(name,args=[]){const a=artifacts[name],factory=new ethers.ContractFactory(a.abi,a.bytecode,wallet);const receipt=await send('deploy:'+name,await factory.getDeployTransaction(...args));const address=receipt.contractAddress||ethers.getCreateAddress({from:wallet.address,nonce:state.steps['deploy:'+name].nonce});let code;for(let attempt=0;attempt<4;attempt++){try{code=await ethers.provider.getCode(address,receipt.blockNumber);if(code!=='0x')break;}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}if(!code||code==='0x')throw Error('Contrato sin código en su bloque confirmado');state.contracts[name]=address;persist();return new ethers.Contract(address,a.abi,wallet)}
 async function call(label,contract,name,args){return send(label,await contract[name].populateTransaction(...args))}
 const usdt=await deploy('MockERC20',['Demo USDT','USDT',6]),blue=await deploy('BlueToken'),red=await deploy('RedToken'),treasury=await deploy('ProtocolTreasury',[blue.target]),vault=await deploy('CollateralVault',[usdt.target]),core=await deploy('CoreProtocol'),exchange=await deploy('FifoExchange',[blue.target,usdt.target,treasury.target,0]);
 await call('blue-core',blue,'setCoreProtocol',[core.target]);await call('red-core',red,'setCoreProtocol',[core.target]);await call('core-links',core,'setContracts',[blue.target,red.target,treasury.target,vault.target]);await call('treasury-core',treasury,'setCoreProtocol',[core.target]);await call('treasury-kyc',core,'setKYCStatus',[treasury.target,true]);await call('relayer',core,'setRelayer',[local?wallet.address:plan.relayer]);await call('vault-links',vault,'linkCoreContracts',[core.target,exchange.target]);await call('blue-exchange',blue,'setExchange',[exchange.target]);await call('exchange-vault',exchange,'setAmortizationVault',[vault.target]);await call('commission',core,'setCommissionBps',[plan.commissionBps]);await call('duration',core,'setCommitmentDuration',[plan.duration]);
 if(plan.maxTransactionAmount)await call('max-transaction',core,'setMaxTransactionAmount',[plan.maxTransactionAmount]);
 if(plan.extensionRecipient==='treasury')await call('extension-recipient',core,'setExtensionFeeRecipient',[treasury.target]);else if(plan.extensionRecipient!=='disabled')throw Error('Receptor de prórrogas requiere definición');
 for(const option of plan.extensionOptions||[])await call('extension-'+option.days,core,'setExtensionOption',[option.days,option.feeBps,option.enabled]);
 const contracts={BlueToken:blue.target,RedToken:red.target,ProtocolTreasury:treasury.target,CollateralVault:vault.target,CoreProtocol:core.target,FifoExchange:exchange.target,USDT:usdt.target};
 await require('../../backend/src/services/chainDeployment').validate(ethers.provider,{chainId:chain,contracts});
 if(await blue.totalSupply()!==0n||await red.totalSupply()!==0n)throw Error('La nueva suite no comienza en cero');
 const exchangeStep=state.steps['deploy:FifoExchange'];const manifest={chainId:chain,network:local?'hardhat':'optimismSepolia',deployedAt:new Date().toISOString(),deployer:wallet.address,relayer:local?wallet.address:plan.relayer,contracts,startBlocks:{FifoExchange:exchangeStep.blockNumber},deploymentTransactions:Object.fromEntries(Object.keys(contracts).map(n=>[n,state.steps['deploy:'+(n==='USDT'?'MockERC20':n)].hash])),codeHashes:Object.fromEntries(await Promise.all(Object.entries(contracts).map(async([n,a])=>[n,ethers.keccak256(await ethers.provider.getCode(a))]))),sourcePlanHash:fingerprint};
 fs.writeFileSync(path.resolve(process.env.DEMO_CANDIDATE_MANIFEST||'deployment-manifest-candidate-163.json'),JSON.stringify(manifest,null,2));console.log('CANDIDATE_VERIFIED: suite enlazada, supplies cero; manifiesto activo y base remota intactos.');
}
main().then(()=>process.exit(0)).catch(e=>{console.error('DEPLOY_STOPPED: '+(e.shortMessage||e.message||'revisar registro'));process.exit(1)});
