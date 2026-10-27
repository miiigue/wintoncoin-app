import React,{useEffect,useState} from 'react';
import {getApiUrl} from '../modules/config.js';
const states={pending:'Aplicación en curso',complete:'Aplicación completada',complete_with_issues:'Recorrido completado con excepciones',superseded:'Sustituida',open:'Reintento automático pendiente',retrying:'Comprobando operación',dead_letter:'Requiere revisión',confirmed:'Confirmada',failed:'Rechazada',conflict:'Requiere revisión'};
const reasons={CHAIN_REVERT:'Rechazo de blockchain',CHAIN_REJECTED:'Operación no confirmada',CHAIN_CONFLICT:'Conflicto de operación',NO_CONFIRMED_RESULT:'Resultado sin confirmar',RETRY_UNAVAILABLE:'No se pudo completar el reintento',UPDATE_UNAVAILABLE:'No se pudo actualizar la cuenta'};
export default function RecoveryStatus(){
 const [data,setData]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [version,setVersion]=useState(''),[after,setAfter]=useState('0'),[pages,setPages]=useState([]),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true,inFlight=false;let controller;
  async function load(){
   if(inFlight||document.hidden)return;inFlight=true;controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),30000);
   try{
    const params=new URLSearchParams({after});if(version)params.set('version',version);
    const r=await fetch(getApiUrl()+'/api/admin/web3/recovery-status?'+params,{credentials:'include',cache:'no-store',signal:controller.signal});
    const d=await r.json();if(!r.ok||!d.success)throw Error(d.message||'No se pudo consultar el estado.');
    if(active){setData(d);setMessage('');}
   }catch{if(active)setMessage('No se pudo actualizar el seguimiento. Los datos visibles pueden estar desactualizados. Pulsa Actualizar.');}
   finally{clearTimeout(timer);inFlight=false;}
  }
  setData(null);load();const timer=setInterval(load,30000);
  return()=>{active=false;controller?.abort();clearInterval(timer);};
 },[version,after,refresh]);
 async function retry(issue){
  setBusy(true);const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
  try{const r=await fetch(getApiUrl()+'/api/admin/web3/credit-policy/retry',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({versionId:issue.version_id,username:issue.username}),signal:controller.signal});const d=await r.json();setMessage(d.message);if(r.ok)setData(current=>({...current,issues:current.issues.map(x=>x.user_id===issue.user_id?{...x,retry_requested:true}:x)}));}
  catch{setMessage('No se pudo comprobar si se programó la revisión. Actualiza el estado antes de repetirla.');}finally{clearTimeout(timer);setBusy(false);}
 }
 function select(value){setVersion(value);setAfter('0');setPages([]);}
 const total=(data?.groups||[]).reduce((sum,g)=>sum+Number(g.count),0);
 return <section aria-label="Seguimiento de políticas RED">
  <h3>Seguimiento de políticas RED</h3>
  <p>Las cuentas se revisan automáticamente. No necesitas procesarlas una por una. Solo las excepciones pueden requerir intervención.</p>
  {message&&<p role="status">{message}</p>}
  <button disabled={busy} onClick={()=>setRefresh(n=>n+1)}>Actualizar</button>
  {data&&<>
   <label>Consultar política <select disabled={busy} value={version} onChange={e=>select(e.target.value)}>
    <option value="">Política vigente</option>
    {data.jobs.map(j=><option key={j.version_id} value={String(j.version_id)}>{String(j.version_id)===String(data.currentVersion)?'Vigente':'Historial'}: política {j.version_id}</option>)}
   </select></label>
   <p>{data.selectedVersion?`Política ${data.selectedVersion}`:'Todavía no hay una política registrada.'}{data.historical?' · Historial: estas incidencias no describen el estado actual de las cuentas.':''}</p>
   {data.jobs.filter(j=>String(j.version_id)===String(data.selectedVersion)).map(j=><p key={j.version_id}>{states[j.state]||j.state}. Último identificador recorrido: {j.cursor_id}. Este número no es una cantidad de cuentas.</p>)}
   <p>{total} incidencias {data.historical?'históricas':'de la política vigente'} sin resolver.</p>
   <ul>{data.groups.map(g=><li key={g.status+':'+g.reason}>{states[g.status]||g.status} · {reasons[g.reason]||g.reason}: {g.count}</li>)}</ul>
   <details><summary>Ver cuentas con incidencias ({data.issues.length} en esta página)</summary>
    {data.issues.map(issue=><div key={issue.version_id+':'+issue.user_id} style={{padding:'10px 0',borderBottom:'1px solid #334155'}}>
     <p>@{issue.username||'Cuenta no disponible'} · {states[issue.status]||issue.status} · {reasons[issue.reason]||issue.reason}</p>
     {issue.next_retry_at&&issue.status==='open'&&<p>Reintento previsto a partir de {new Date(issue.next_retry_at).toLocaleString()}. Depende de la disponibilidad del servicio.</p>}
     {!data.historical&&issue.status==='dead_letter'&&<button disabled={busy||issue.retry_requested||!issue.username} onClick={()=>retry(issue)}>{issue.retry_requested?'Revisión solicitada':'Solicitar revisión de esta cuenta'}</button>}
    </div>)}
    <button disabled={busy||!pages.length} onClick={()=>{setAfter(pages[pages.length-1]);setPages(p=>p.slice(0,-1));}}>Anterior</button>
    <button disabled={busy||!data.nextAfter} onClick={()=>{if(!version)setVersion(String(data.selectedVersion));setPages(p=>[...p,after]);setAfter(data.nextAfter);}}>Siguiente</button>
   </details>
   <details><summary>Operaciones recientes pendientes o con incidencias (hasta 25)</summary>{data.operations.map(op=><p key={op.id}>{states[op.state]||op.state}: {op.kind}. Referencia {op.id}. {op.error_code||'La operación conserva su referencia para comprobar el resultado.'}</p>)}</details>
  </>}
  {!data&&!message&&<p role="status">Consultando seguimiento…</p>}
 </section>;
}
