const path=require('node:path');
const assert=require('node:assert/strict');
const esbuild=require('esbuild');
const {chromium}=require('playwright');
// Actual security components; external authorization/network calls are synthetic.
(async()=>{
 require('node:child_process').execFileSync(process.execPath,[path.join(__dirname,'check-backup-validation.cjs')],{stdio:'inherit'});
 const root=path.resolve(__dirname,'..');
 const build=await esbuild.build({stdin:{resolveDir:root,loader:'jsx',contents:
  "import React from 'react';import {createRoot} from 'react-dom/client';import Security from './src/components/AccountSecurity.jsx';const root=createRoot(document.getElementById('root'));let n=0;window.mount=()=>root.render(<Security key={++n} onActivated={()=>window.stats.activated++}/>);window.unmount=()=>root.render(null);window.mount();"},bundle:true,write:false,plugins:[{name:'isolated-security-fixture',setup(b){
  b.onLoad({filter:/recoverableAccount\.js$/},()=>({contents:
   "export async function accountRequest(path,body){if(path==='/registration/options'){window.stats.options=(window.stats.options||0)+1;return {id:'challenge',options:{},backupMessage:'fixture'};}if(path==='/registration/verify'){window.stats.verified=(window.stats.verified||0)+1;window.mode='pending';return {operationId:'fixture-operation'};}if(path==='/activation-readiness')return {ready:true,replacingLegacy:true};if(path==='/status'&&window.mode==='legacy')return {userId:8,account:null,configuration:{chainId:'11155420'}};if(path==='/status')return {account:{state:window.mode==='active'?'active':'prepared',address:window.accountAddress},configuration:{chainId:'11155420'},activationId:window.mode==='active'?null:'fixture-operation'};if(path==='/recovery/status')return {recovery:window.recovery};if(body){window.stats.posts++;if(window.mode==='migration')window.migrationApproved=true;return {state:'pending',message:'Esperando confirmación'};}window.stats.gets++;if(window.mode==='migration')return {migration:true,state:window.migrationApproved?'pending':'prepared',requiresSignature:!window.migrationApproved,message:window.migrationApproved?'Actualización en curso':'Confirma la actualización para conservar tu saldo'};if(window.mode==='expired')throw Object.assign(new Error('Sesión vencida'),{status:401});if(window.mode==='failed')return {state:'failed',message:'Revisión necesaria'};if(window.mode==='complete'){window.mode='active';return {success:true,state:'confirmed'};}if(window.hold)await new Promise(r=>window.releaseRequest=r);return window.mode==='pending'?{state:'pending',message:'Esperando'}:{state:'prepared',requiresSignature:true,authorization:{fixture:true}};}export async function signAccountTransaction(){window.stats.signs++;if(window.rejectSignature)throw Error('Confirmación cancelada');return {signature:'synthetic',hash:'synthetic'};}export const authorizeRecovery=()=>{};export const createBackup=()=>({phrase:Array(12).fill('fixture').join(' '),address:'0x'+'7'.repeat(40)});export const restoreBackup=(phrase,address)=>{if(phrase!==Array(12).fill('fixture').join(' '))throw Error('Respaldo incorrecto');return {phrase,address};};export const backupPositions=()=>[0,1,2];export const verifyBackupWords=(p,positions,answers)=>answers.every(x=>x==='fixture');export const proveBackup=()=>{};"}));
  b.onLoad({filter:/@simplewebauthn[\\/]browser[\\/]/},()=>({contents:"export async function startRegistration(){window.stats.registrations=(window.stats.registrations||0)+1;return {id:'synthetic'};}"}));
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
    localStorage.clear();window.stats={signs:0,gets:0,posts:0,activated:0};window.mode=mode;window.accountAddress='0x'+'1'.repeat(40);window.recovery=null;
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

  await fixture('legacy');await page.getByRole('button',{name:'Configurar respaldo de mi billetera',exact:true}).click();
  await page.getByText('Tu billetera anterior puede actualizarse.',{exact:false}).waitFor();
  assert.equal(await page.evaluate(()=>window.stats.signs+window.stats.posts),0);checks++;

  // Reload/remount must keep only public draft metadata, not seed words.
  await page.evaluate(()=>window.mount());
  await page.getByRole('button',{name:'Retomar mi respaldo',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('fixture')),false);
  await page.getByLabel('Palabras del respaldo pendiente').fill('wrong');await page.getByRole('button',{name:'Retomar mi respaldo',exact:true}).click();
  await page.getByText('Respaldo incorrecto',{exact:true}).waitFor();checks++;
  await page.getByLabel('Palabras del respaldo pendiente').fill(Array(12).fill('fixture').join(' '));await page.getByRole('button',{name:'Retomar mi respaldo',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar palabras y continuar',exact:true}).click();
  assert.equal(await page.locator('input[aria-invalid="true"]').count(),3);checks++;
  await page.getByRole('button',{name:'Mostrar lo escrito',exact:true}).click();
  assert.equal(await page.locator('#account-security input[type="text"]').count(),3);
  await page.getByRole('button',{name:'Ocultar lo escrito',exact:true}).click();checks++;
  for(let i=0;i<3;i++)await page.locator('#account-security input').nth(i).fill('fixture');
  await page.getByRole('button',{name:'Confirmar palabras y continuar',exact:true}).click();
  await page.getByRole('button',{name:'Registrar mi dispositivo',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.stats.registrations||0),0);checks++;
  await page.getByRole('button',{name:'Registrar mi dispositivo',exact:true}).click();
  await page.waitForFunction(()=>window.stats.verified===1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('winton_backup_draft:11155420:8')),null);checks++;

  await fixture('migration');await tick();
  await page.getByRole('button',{name:'Actualizar billetera y conservar saldo',exact:true}).click();
  await page.waitForFunction(()=>window.stats.posts===1);await tick();await page.getByText('Actualización en curso',{exact:true}).waitFor();
  await tick();assert.equal(await page.evaluate(()=>window.stats.posts),1);assert.equal(await page.evaluate(()=>window.stats.signs),0);checks++;

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
