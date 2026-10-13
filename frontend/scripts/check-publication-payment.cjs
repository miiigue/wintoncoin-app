const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../src/pages/publication-detail.js'),'utf8');
const recovery=source.slice(source.indexOf('    let pendingPaymentAction='),source.indexOf('    let modalDismissed'));
const handler=source.slice(source.indexOf('    async function handleActionClick('),source.indexOf('    async function sharePublication('));
const modal=source.slice(source.indexOf('    async function openPaymentAuthorizationModal('),source.indexOf('    /**',source.indexOf('    async function openPaymentAuthorizationModal(')));
function fixture(){
 const storage=new Map(),alerts=[],requests=[];
 const button={dataset:{action:'confirm-payment',user:'worker'},innerHTML:'Confirmar Pago',disabled:false,setAttribute(){},removeAttribute(){}};
 const context={storedUsername:'payer',publicationId:'50',sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},window:{currentPublication:{blue_cost:'0.0002',title:'fixture'},currentUserHasPin:false},elements:{paymentAuthorizationModal:{style:{display:'none'}},authModalConfirmBtn:{}},setTimeout(){},showCustomAlert:m=>alerts.push(m),formatBalance:String,initializePage:async()=>{},authorizeMarketplace:async()=>{},operationRequest:async p=>{requests.push(p);return {success:true,feeBps:400,durationSeconds:2592000};}};
 vm.createContext(context);vm.runInContext(recovery+handler+modal,context);
 return {context,storage,alerts,requests,button,click:()=>context.handleActionClick({target:{closest:()=>button}}),key:'winton-publication-payment:payer:50'};
}
(async()=>{
 let f=fixture();await f.click();assert.equal(f.context.elements.paymentAuthorizationModal.style.display,'flex');assert.deepEqual(f.requests,['/marketplace/terms']);assert.equal(f.button.disabled,false); // Even with legacy hasPin=false.
 f=fixture();let release;f.context.operationRequest=()=>new Promise(r=>release=r);const pending=f.click();assert.equal(f.button.disabled,true);assert.match(f.button.textContent,/Consultando/);await f.click();release({success:true,feeBps:400,durationSeconds:2592000});await pending;assert.equal(f.button.disabled,false);
 f=fixture();f.context.operationRequest=async()=>{throw Error('Servicio no disponible');};await f.click();assert.match(f.alerts[0],/Servicio no disponible/);assert.equal(f.button.disabled,false);
 f=fixture();f.storage.set(f.key,'old');f.context.operationRequest=async p=>{f.requests.push(p);return p.endsWith('/old')?{state:'expired',canRenew:true,message:'Vencido'}:{success:true,feeBps:400,durationSeconds:2592000};};await f.click();assert.equal(f.storage.has(f.key),false);assert.equal(f.context.elements.paymentAuthorizationModal.style.display,'flex');
 f=fixture();f.storage.set(f.key,'old');f.context.operationRequest=async()=>({state:'pending'});await f.click();assert.equal(f.storage.get(f.key),'old');assert.match(f.alerts[0],/pendiente.*Referencia: old/);assert.equal(f.context.elements.paymentAuthorizationModal.style.display,'none');
 f=fixture();f.storage.set(f.key,'old');f.context.operationRequest=()=>new Promise(r=>release=r);const recovering=f.context.recoverPayment();await f.click();assert.match(f.alerts[0],/comprobando/);release({state:'pending'});await recovering;
 f=fixture();f.context.elements.paymentAuthorizationModal=null;await f.click();assert.match(f.alerts[0],/Recarga/);
 console.log('PASS: 7 publication payment controller scenarios; no real signatures or transactions.');
})().catch(e=>{console.error(e);process.exitCode=1;});
