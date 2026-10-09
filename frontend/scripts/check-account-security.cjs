const path=require('node:path');
const assert=require('node:assert/strict');
const esbuild=require('esbuild');
const {chromium}=require('playwright');
// Actual security components; external authorization/network calls are synthetic.
(async()=>{
 const root=path.resolve(__dirname,'..');
 const build=await esbuild.build({stdin:{resolveDir:root,loader:'jsx',contents:
  "import React from 'react';import {createRoot} from 'react-dom/client';import Security from './src/components/AccountSecurity.jsx';const root=createRoot(document.getElementById('root'));let n=0;window.mount=()=>root.render(<Security key={++n} onActivated={()=>window.stats.activated++}/>);window.unmount=()=>root.render(null);window.mount();"},bundle:true,write:false,plugins:[{name:'isolated-security-fixture',setup(b){
  b.onLoad({filter:/recoverableAccount\.js$/},()=>({contents:
   "export async function accountRequest(path,body){if(path==='/status')return {account:{state:window.mode==='active'?'active':'prepared',address:window.accountAddress},configuration:{chainId:'11155420'},activationId:window.mode==='active'?null:'fixture-operation'};if(path==='/recovery/status')return {recovery:window.recovery};if(body){window.stats.posts++;return {state:'pending',message:'Esperando confirmación'};}window.stats.gets++;if(window.mode==='expired')throw Object.assign(new Error('Sesión vencida'),{status:401});if(window.mode==='failed')return {state:'failed',message:'Revisión necesaria'};if(window.mode==='complete'){window.mode='active';return {success:true,state:'confirmed'};}if(window.hold)await new Promise(r=>window.releaseRequest=r);return window.mode==='pending'?{state:'pending',message:'Esperando'}:{state:'prepared',requiresSignature:true,authorization:{fixture:true}};}export async function signAccountTransaction(){window.stats.signs++;if(window.rejectSignature)throw Error('Confirmación cancelada');return {signature:'synthetic',hash:'synthetic'};}export const authorizeRecovery=()=>{};export const createBackup=()=>{};export const backupPositions=()=>[];export const verifyBackupWords=()=>false;export const proveBackup=()=>{};"}));
  b.onLoad({filter:/emergencyCancellation\.js$/},()=>({contents:"export const cancelWithExternalWallet=async()=>({hash:'synthetic'});"}));
  b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
 }}]});
 const browser=await chromium.launch({headless:true});
 let checks=0;
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',()=>errors.push('Unexpected browser alert'));
  await page.route('https://fixture.invalid/**',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
  async function fixture(mode='prepared',extra={}){
   await page.goto('https://fixture.invalid/wallet.html');
   await page.evaluate(({mode,extra})=>{
    window.stats={signs:0,gets:0,posts:0,activated:0};window.mode=mode;window.accountAddress='0x'+'1'.repeat(40);window.recovery=null;
    Object.assign(window,extra);const timers=new Map();let id=0;
    window.setInterval=(fn)=>{timers.set(++id,fn);return id;};window.clearInterval=id=>timers.delete(id);
    window.tick=()=>{for(const fn of [...timers.values()])fn();};
   },{mode,extra});
   await page.addScriptTag({content:build.outputFiles[0].text});
   await page.getByRole('heading',{name:'Seguridad y recuperación'}).waitFor();
   await page.waitForFunction(()=>document.body.textContent.includes('Configura tu acceso')||document.body.textContent.includes('Acceso y respaldo activados'));
  }
  const tick=()=>page.evaluate(()=>window.tick());
  async function unchanged(fn){const before=await page.evaluate(()=>({...window.stats}));await fn();await page.waitForTimeout(80);assert.deepEqual(await page.evaluate(()=>window.stats),before);}

  await fixture();await tick();await page.getByRole('button',{name:'Confirmar siguiente paso',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.stats.signs+window.stats.posts),0);checks++;
  await page.getByRole('button',{name:'Confirmar siguiente paso',exact:true}).evaluate(b=>{b.click();b.click();});
  await page.waitForFunction(()=>window.stats.posts===1);assert.equal(await page.evaluate(()=>window.stats.signs),1);checks++;

  await fixture('prepared',{rejectSignature:true});await tick();await page.getByRole('button',{name:'Confirmar siguiente paso',exact:true}).click();
  await page.getByText('Confirmación cancelada',{exact:true}).waitFor();await unchanged(tick);assert.equal(await page.evaluate(()=>window.stats.posts),0);checks++;

  await fixture('pending');await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'}));await unchanged(tick);
  await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'}));await tick();await page.waitForFunction(()=>window.stats.gets===1);checks++;

  await fixture('pending',{hold:true});await tick();await page.waitForFunction(()=>Boolean(window.releaseRequest));await unchanged(tick);
  await page.evaluate(()=>window.releaseRequest());await page.getByText('Esperando',{exact:true}).waitFor();checks++;

  for(const mode of ['expired','failed']){await fixture(mode);await tick();await page.getByText(mode==='expired'?'Sesión vencida':'Revisión necesaria',{exact:true}).waitFor();await unchanged(tick);checks++;}

  await fixture('complete');await tick();await page.getByText('¡Felicidades! Tu billetera está activa',{exact:true}).waitFor();
  await page.waitForFunction(()=>window.stats.activated===1);assert.equal(await page.evaluate(()=>window.stats.signs+window.stats.posts),0);checks++;
  await page.getByRole('button',{name:'Entendido',exact:true}).click();await page.evaluate(()=>window.mount());
  await page.waitForTimeout(100);assert.equal(await page.getByRole('button',{name:'Entendido',exact:true}).count(),0);
  await page.evaluate(()=>{window.accountAddress='0x'+'2'.repeat(40);window.mount();});await page.getByRole('button',{name:'Entendido',exact:true}).waitFor();checks++;
  assert.equal(await page.locator('#account-security-title').count(),1);checks++;

  await fixture('active',{recovery:{state:'external',id:'fixture-recovery',message:'Solicitud detectada'}});
  await page.getByRole('alert').waitFor();assert(await page.getByRole('button',{name:'Cancelar recuperación con mi dispositivo',exact:true}).isVisible());
  assert.equal(await page.locator('details[open]').count(),0);assert.equal(await page.evaluate(()=>window.stats.signs+window.stats.posts),0);checks++;
  await page.evaluate(()=>window.unmount());await page.waitForTimeout(40);await unchanged(tick);checks++;
  assert.deepEqual(errors,[]);console.log('PASS: '+checks+' interaction checks; no real signatures, accounts or transactions.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
