import {cancelWithExternalWallet} from '../modules/emergencyCancellation.js';
import React,{useEffect,useState,useRef} from 'react';
import {startRegistration} from '@simplewebauthn/browser';
import {accountRequest,authorizeRecovery,signAccountTransaction} from '../modules/recoverableAccount.js';

export default function PersonalRecovery({context,onRecovered}){
 const [phrase,setPhrase]=useState(''),[prepared,setPrepared]=useState(null),[recovery,setRecovery]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const inFlight=useRef(false),mounted=useRef(true),onRecoveredRef=useRef(onRecovered);
 onRecoveredRef.current=onRecovered;
 const refresh=async()=>{const data=await accountRequest('/recovery/status');if(!mounted.current)return;setRecovery(data.recovery);if(data.recovery?.state==='confirmed')onRecoveredRef.current?.();};
 async function run(fn){if(inFlight.current)return;inFlight.current=true;setBusy(true);try{await fn();}catch(e){if(mounted.current)setMessage(e.message);}finally{inFlight.current=false;if(mounted.current)setBusy(false);}}
 useEffect(()=>{mounted.current=true;run(refresh);const timer=setInterval(()=>{if(document.visibilityState==='visible')run(refresh);},60000);return ()=>{mounted.current=false;clearInterval(timer);};},[context.account.address]);
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
 const cancelExternal=()=>run(async()=>{
  const result=await cancelWithExternalWallet(context);
  setMessage('Cancelación enviada con otra billetera. Referencia: '+result.hash+'. Todavía debes confirmar su inclusión en blockchain; pulsa Actualizar estado.');
 });
 const needsAttention=['waiting','external','prepared','pending','failed','conflict'].includes(recovery?.state);
 return <>
  {needsAttention&&<div role="alert" className="activation-pending-banner">
    <strong>Hay una solicitud de recuperación que debes revisar.</strong>
    <p>{recovery?.message||'Revisa quién inició esta solicitud. Si no la reconoces, utiliza tu dispositivo autorizado para cancelarla.'}</p>
    {['waiting','external'].includes(recovery?.state)&&<button disabled={busy} onClick={cancel}>Cancelar recuperación con mi dispositivo</button>}
  </div>}
  <p role="status" aria-live="polite">{message}</p>
  <details className="personal-recovery"><summary>Opciones de seguridad y recuperación</summary>
  <p>La recuperación cambia el dispositivo autorizado; conserva tu dirección, tus BLUE y tus compromisos RED. Necesitas tu respaldo de 12 palabras. Perder también ese respaldo puede impedir la recuperación.</p>
  <p>{recovery?.message}</p>
  {(!recovery||['confirmed','cancelled','rejected'].includes(recovery.state))&&!prepared&&<button disabled={busy} onClick={register}>Registrar dispositivo de reemplazo</button>}
  {prepared&&<form onSubmit={e=>{e.preventDefault();submit();}}><p>Cuenta que se conservará: {prepared.address}</p>
   <label>Respaldo de recuperación (solo se procesa aquí)<input type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} value={phrase} onChange={e=>setPhrase(e.target.value)} disabled={busy}/></label>
   <button disabled={busy||!phrase}>Solicitar recuperación</button><button type="button" disabled={busy} onClick={()=>{setPhrase('');setPrepared(null);}}>Cancelar preparación</button>
  </form>}
  {recovery?.executeAfter&&<p>La espera termina: {new Date(Number(recovery.executeAfter)*1000).toLocaleString()}. El contrato decide cuándo puede finalizarse.</p>}
  {recovery&&!['confirmed','cancelled','rejected','failed','conflict'].includes(recovery.state)&&<button disabled={busy} onClick={advance}>{recovery.ready?'Finalizar recuperación':'Continuar o consultar recuperación'}</button>}
  {['waiting','external'].includes(recovery?.state)&&<button disabled={busy} onClick={cancel}>Cancelar con mi dispositivo anterior</button>}
  {context?.account?.state==='active'&&<details><summary>Cancelación de emergencia con otra billetera</summary>
   <p>Si el envío de WintonCoin falla, firma la cancelación con tu dispositivo autorizado y envíala con una billetera Web3 conectada a la misma red. Esa billetera paga el gas en ETH; no recibe tus BLUE ni puede cambiar el acceso. No necesitas compartir tus 12 palabras. Requiere que esta página haya cargado tu cuenta y que el RPC público esté disponible.</p>
   <button disabled={busy} onClick={cancelExternal}>Firmar cancelación y conectar otra billetera</button>
  </details>}
  <button disabled={busy} onClick={()=>run(refresh)}>Actualizar estado</button>
 </details></>;
}
