const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const esbuild=require('esbuild');const {chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const {publicationKycWarning}=await import('data:text/javascript;base64,'+fs.readFileSync(path.join(root,'src/modules/publicationKyc.js')).toString('base64'));
 for(const [state,expected] of [[{isKYCVerified:true},false],[{isKYCVerified:false},true],[null,null]])assert.equal(await publicationKycWarning({getAssociatedAccount:async()=>({web3_wallet_address:'fixture'}),fetchUserOnChainState:async()=>state}),expected);
 assert.equal(await publicationKycWarning({getAssociatedAccount:async()=>({})}),true);
 assert.equal(await publicationKycWarning({getAssociatedAccount:async()=>{throw Error('offline');}}),null);
 // Exercise the actual request helper, including abort and timer cleanup.
 const source=fs.readFileSync(path.join(root,'src/modules/pinOperations.js'),'utf8').replace("import {getApiUrl} from './config.js';","const getApiUrl=()=> 'https://fixture.invalid';");
 const {operationRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const originalFetch=global.fetch,originalTimer=global.setTimeout,originalStorage=global.localStorage;
 try {
  global.localStorage={getItem:()=>null};global.setTimeout=(fn,ms,...args)=>originalTimer(fn,ms===45000?5:ms,...args);
  global.fetch=(_url,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'}))));
  await assert.rejects(operationRequest('/marketplace/fixture/authorize',{signature:'synthetic'}),e=>e.uncertain===true);
  await assert.rejects(operationRequest('/marketplace/fixture'),e=>e.uncertain===false);
 }finally{global.fetch=originalFetch;global.setTimeout=originalTimer;global.localStorage=originalStorage;}
 const built=await esbuild.build({stdin:{resolveDir:root,loader:'jsx',contents:"import {authorizeMarketplace} from './src/components/MarketplaceAuthorization.jsx';window.openPayment=()=>authorizeMarketplace('fixture').then(r=>window.result=r);"},bundle:true,write:false,plugins:[{name:'fixtures',setup(b){
 b.onLoad({filter:/pinOperations\.js$/},()=>({contents:`const quote={authorization:{domain:{name:'fixture',version:'1',chainId:1,verifyingContract:'0x'+'1'.repeat(40)},types:{Payment:[{name:'amount',type:'uint256'},{name:'feeBps',type:'uint256'},{name:'payee',type:'address'}]},message:{amount:'200',feeBps:'400',payee:'0x'+'2'.repeat(40)}}};export async function operationRequest(p,body){if(body){window.posts++;if(window.failPost)throw Error('timeout');return {state:'pending'};}if(window.expired)return {state:'expired',canRenew:true,authorization:null};return quote;}`}));
 b.onLoad({filter:/recoverableAccount\.js$/},()=>({contents:"export async function signMarketplace(){window.signs++;if(window.hangSign)return new Promise(r=>window.finishSign=()=>r('synthetic'));return 'synthetic';}"}));
 b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
 }}]});
 const browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://fixture.invalid/**',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));
 async function start(extra={}){await page.goto('https://fixture.invalid');await page.evaluate(extra=>{window.posts=0;window.signs=0;Object.assign(window,extra);const original=window.setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===90000?30:ms,...args);},extra);await page.addScriptTag({content:built.outputFiles[0].text});await page.evaluate(()=>{window.openPayment();});await page.getByRole('dialog').waitFor();}
 await start({failPost:true});await page.getByRole('button',{name:'Confirmar con mi dispositivo',exact:true}).click();await page.getByRole('button',{name:'Consultar estado del pago'}).waitFor();await page.getByRole('button',{name:'Consultar estado del pago'}).click();assert.equal(await page.evaluate(()=>window.posts),1);assert.equal(await page.evaluate(()=>window.signs),1);
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);
 await start({hangSign:true});await page.getByRole('button',{name:'Confirmar con mi dispositivo',exact:true}).click();await page.getByText('No se completó la firma a tiempo.',{exact:false}).waitFor();await page.evaluate(()=>window.finishSign());await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>window.posts),0);
 await start();await page.getByRole('button',{name:'Confirmar con mi dispositivo',exact:true}).evaluate(b=>{b.click();b.click();});await page.waitForFunction(()=>window.result?.state==='pending');assert.equal(await page.evaluate(()=>window.posts),1);assert.deepEqual(errors,[]);
 await start();await page.evaluate(()=>window.expired=true);await page.getByRole('button',{name:'Confirmar con mi dispositivo',exact:true}).click();await page.waitForFunction(()=>window.result?.state==='expired');assert.equal(await page.evaluate(()=>window.posts+window.signs),0);
 console.log('PASS: 5 viewer KYC cases; uncertain payment no resubmit, close, late signature no submit, double-click one submit. Synthetic only.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
