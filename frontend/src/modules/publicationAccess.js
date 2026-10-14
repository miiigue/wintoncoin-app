import {operationRequest} from './pinOperations.js';
let cached=null,pending=null,identity=null,entryUsers=0,entryCleanup=null;
export async function publicationAccess(){
 const key=localStorage.getItem('token')+'|'+localStorage.getItem('username');
 if(identity!==key){identity=key;cached=null;pending=null;}
 if(cached&&Date.now()-cached.at<15000)return cached.value;
 if(pending)return pending;
 const request=operationRequest('/publication-access').then(value=>{
  if(identity!==key||key!==localStorage.getItem('token')+'|'+localStorage.getItem('username'))throw new Error('La sesión cambió. Vuelve a comprobar tu identidad.');
  cached={at:Date.now(),value};
  return value;
 }).finally(()=>{if(pending===request)pending=null;});
 pending=request;return request;
}
function notice(parent){
 const panel=document.createElement('section');panel.setAttribute('role','status');
 panel.style.cssText='padding:24px;border:1px solid #64748b;border-radius:16px;background:#14213d;color:white;margin:16px 0';
 const text=document.createElement('p');panel.append(text);
 const wallet=document.createElement('a');wallet.href='/wallet.html';wallet.textContent='Verificar mi identidad';wallet.className='button-link';
 const retry=document.createElement('button');retry.type='button';retry.textContent='Volver a comprobar';retry.className='button-link';
 panel.append(wallet,retry);parent.append(panel);return {panel,text,wallet,retry};
}
async function checkView(view){
 view.text.textContent='Comprobando tu verificación de identidad…';view.retry.disabled=true;view.wallet.hidden=true;
 try{const result=await publicationAccess();
  document.querySelectorAll('[data-publication-kyc]').forEach(badge=>{badge.textContent=result.approved===true?'':' 🔒';if(badge.parentElement)badge.parentElement.title=result.approved===true?'':'Verifica tu identidad para publicar';});
  if(result.approved===true)return true;
  view.text.textContent='Para crear cualquier publicación necesitas tener tu verificación de identidad (KYC) aprobada.';
  view.wallet.hidden=false;
 }catch{view.text.textContent='No pudimos comprobar tu verificación de identidad. Puedes reintentar; esto no significa que haya sido rechazada.';}
 finally{view.retry.disabled=false;}
 return false;
}
export function protectPublicationForm(form){
 const previousDisplay=form.style.display;form.hidden=true;form.inert=true;form.style.display='none';
 const host=document.createElement('div');form.before(host);const view=notice(host);
 return new Promise(resolve=>{
  const check=async()=>{if(await checkView(view)){host.remove();form.hidden=false;form.inert=false;form.style.display=previousDisplay;resolve();}};
  view.retry.onclick=()=>{cached=null;check();};check();
 });
}
export function installPublicationEntryGuards(){
 entryUsers++;
 if(entryCleanup)return ()=>{if(--entryUsers===0){entryCleanup();entryCleanup=null;}};
 const selector='#openPublicationModalBtn,#openQuickSaleModalBtn,a[href*="publish.html"]';
 let dialog=null;
 const permitted=new WeakSet();
 const listener=async event=>{
  const button=event.target.closest?.(selector);if(!button)return;
  if(permitted.has(button)){permitted.delete(button);return;}
  event.preventDefault();event.stopImmediatePropagation();
  if(dialog)return;
  dialog=document.createElement('div');dialog.className='modal';dialog.style.cssText='display:flex;position:fixed;inset:0;z-index:10000;background:#000b;align-items:center;justify-content:center;padding:20px';
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Verificación para publicar');
  const view=notice(dialog);view.panel.style.maxWidth='480px';
  const close=document.createElement('button');close.type='button';close.textContent='Cerrar';view.panel.append(close);
  const current=dialog;const dismiss=()=>{current.remove();if(dialog===current)dialog=null;button.focus();};close.onclick=dismiss;
  document.body.append(dialog);close.focus();
  const check=async()=>{if(await checkView(view)&&dialog===current){dismiss();permitted.add(button);button.click();}};
  view.retry.onclick=()=>{cached=null;check();};check();
 };
 document.addEventListener('click',listener,true);
 // One short read shared by all entry buttons; final creation is always rechecked server-side.
 const decorate=state=>document.querySelectorAll(selector).forEach(button=>{
  let badge=button.querySelector('[data-publication-kyc]');
  if(!badge){badge=document.createElement('span');badge.dataset.publicationKyc='true';button.append(badge);}
  badge.textContent=state==='approved'?'':state==='denied'?' 🔒':' …';
  button.title=state==='denied'?'Verifica tu identidad para publicar':state==='approved'?'':'Comprobar identidad antes de publicar';
 });
 decorate('loading');
 publicationAccess().then(result=>decorate(result.approved===true?'approved':'denied')).catch(()=>decorate('unknown'));
 entryCleanup=()=>{document.removeEventListener('click',listener,true);dialog?.remove();};
 return ()=>{if(--entryUsers===0){entryCleanup();entryCleanup=null;}};
}
