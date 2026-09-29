import React,{useEffect,useState} from 'react';
import {getApiUrl} from '../modules/config.js';

export default function Web3Readiness(){
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function load(signal){
  setBusy(true);setMessage('');
  try{
   const response=await fetch(getApiUrl()+'/api/admin/web3/readiness',{credentials:'include',cache:'no-store',signal});
   if(!response.ok)throw new Error(response.status===401?'Inicia sesión como administrador.':'No se pudo comprobar el servicio. Intenta nuevamente.');
   const result=await response.json();
   if(!Array.isArray(result.checks))throw new Error('El servicio aún no tiene disponible esta comprobación.');
   setData(result);
  }catch(error){if(error.name!=='AbortError'){setData(null);setMessage(error.message);}}
  finally{if(!signal?.aborted)setBusy(false);}
 }
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[]);
 return <section aria-label="Preparación del servicio" style={{border:'1px solid #475569',borderRadius:14,padding:20,marginBottom:24}}>
  <h2 style={{fontSize:24,marginBottom:12}}>Preparación del servicio</h2>
  <p>Esta comprobación identifica bloqueos de conexión, permisos y gas. No cambia parámetros ni realiza pagos.</p>
  <button type="button" disabled={busy} onClick={()=>load()}>{busy?'Comprobando…':'Comprobar nuevamente'}</button>
  <div role="status">{message || (busy?'':data?.ready?'Las comprobaciones de preparación están completas.':'Hay requisitos pendientes para operar. Revisa el detalle.')}</div>
  {data&&<><p>Última comprobación: {new Date(data.checkedAt).toLocaleString()}</p><details open={!data.ready}><summary>Ver componentes</summary><ul>{data.checks.map(check=><li key={check.id}>{check.ready?'✓ Listo':'⚠ Pendiente'}: {check.name}</li>)}</ul></details></>}
  <p>El presupuesto de gas se configura en Gobernanza y Parámetros. Un presupuesto de cero impide patrocinar operaciones; no indica un saldo perdido.</p>
 </section>;
}
