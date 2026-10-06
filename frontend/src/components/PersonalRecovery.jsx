import React,{useEffect,useState} from 'react';
import {startRegistration} from '@simplewebauthn/browser';
import {accountRequest,authorizeRecovery,signAccountTransaction} from '../modules/recoverableAccount.js';

export default function PersonalRecovery({context,onRecovered}){
 const [phrase,setPhrase]=useState(''),[prepared,setPrepared]=useState(null),[recovery,setRecovery]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const refresh=async()=>{const data=await accountRequest('/recovery/status');setRecovery(data.recovery);if(data.recovery?.state==='confirmed')onRecovered?.();};
 useEffect(()=>{refresh().catch(e=>setMessage(e.message));},[]);
 async function run(fn){setBusy(true);try{await fn();}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 const register=()=>run(async()=>{
  const options=await accountRequest('/recovery/options',{});
  const response=await startRegistration(options.options);
  setPrepared(await accountRequest('/recovery/prepare',{id:options.id,response}));
  setMessage('Nuevo dispositivo preparado. Confirma con tu respaldo para recuperar esta misma dirección.');
 });
 const submit=()=>run(async()=>{
  const localPhrase=phrase;setPhrase('');
  const signature=await authorizeRecovery(localPhrase,prepared,context);
  const result=await accountRequest('/recovery/submit',{id:prepared.id,signature});
  setPrepared(null);setMessage(result.message);await refresh();
 });
 const advance=()=>run(async()=>{
  if(recovery.state==='waiting'&&recovery.ready)await accountRequest('/recovery/'+recovery.id+'/finalize',{});
  else if(recovery.state==='prepared'||recovery.state==='pending')await accountRequest('/recovery/'+recovery.operationId+'/advance',{});
  await refresh();
 });
 const cancel=()=>run(async()=>{
  const quote=await accountRequest('/recovery/'+recovery.id+'/cancel');
  const signature=await signAccountTransaction(quote,context);
  await accountRequest('/recovery/'+recovery.id+'/cancel',signature);await refresh();
 });
 return <details className="personal-recovery"><summary>Recuperar el acceso o revisar solicitudes</summary>
  <p>La recuperación cambia el dispositivo autorizado; conserva tu dirección, tus BLUE y tus compromisos RED. Necesitas tu respaldo de 12 palabras. Perder también ese respaldo puede impedir la recuperación.</p>
  <p role="status" aria-live="polite">{message||recovery?.message}</p>
  {(!recovery||['confirmed','cancelled','rejected'].includes(recovery.state))&&!prepared&&<button disabled={busy} onClick={register}>Registrar dispositivo de reemplazo</button>}
  {prepared&&<form onSubmit={e=>{e.preventDefault();submit();}}><p>Cuenta que se conservará: {prepared.address}</p>
   <label>Respaldo de recuperación (solo se procesa aquí)<input type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} value={phrase} onChange={e=>setPhrase(e.target.value)} disabled={busy}/></label>
   <button disabled={busy||!phrase}>Solicitar recuperación</button><button type="button" disabled={busy} onClick={()=>{setPhrase('');setPrepared(null);}}>Cancelar preparación</button>
  </form>}
  {recovery?.executeAfter&&<p>La espera termina: {new Date(Number(recovery.executeAfter)*1000).toLocaleString()}. El contrato decide cuándo puede finalizarse.</p>}
  {recovery&&!['confirmed','cancelled','rejected','failed','conflict'].includes(recovery.state)&&<button disabled={busy} onClick={advance}>{recovery.ready?'Finalizar recuperación':'Continuar o consultar recuperación'}</button>}
  {['waiting','external'].includes(recovery?.state)&&<button disabled={busy} onClick={cancel}>Cancelar con mi dispositivo anterior</button>}
  <button disabled={busy} onClick={()=>run(refresh)}>Actualizar estado</button>
 </details>;
}
