import React,{useEffect,useState} from 'react';
import {startRegistration} from '@simplewebauthn/browser';
import {accountRequest,createBackup,backupPositions,verifyBackupWords,proveBackup,signAccountTransaction} from '../modules/recoverableAccount.js';
import './AccountSecurity.css';
import PersonalRecovery from './PersonalRecovery.jsx';

export default function AccountSecurity({onActivated}) {
  const [context,setContext]=useState(null),[message,setMessage]=useState('Consultando la seguridad de tu cuenta…'),[busy,setBusy]=useState(false);
  const [backup,setBackup]=useState(null),[positions,setPositions]=useState([]),[answers,setAnswers]=useState(['','','']),[stage,setStage]=useState('start');
  const [operation,setOperation]=useState(null);
  const refresh=()=>accountRequest('/status').then(c=>{setContext(c);setMessage(c.account?.state==='active'?'Acceso y respaldo activados.':'Configura tu acceso y guarda un respaldo antes de operar.');if(c.activationId)setOperation({operationId:c.activationId});}).catch(e=>setMessage(e.message));
  useEffect(()=>{refresh();return ()=>{};},[]);
  function begin(){setBackup(createBackup());setPositions(backupPositions());setAnswers(['','','']);setStage('show');}
  async function register(){
    if(!verifyBackupWords(backup.phrase,positions,answers)){setMessage('Las palabras no coinciden. Comprueba tu respaldo.');return;}
    setBusy(true);
    try {
      const challenge=await accountRequest('/registration/options',{});
      const response=await startRegistration(challenge.options);
      const proof=await proveBackup(backup.phrase,challenge.backupMessage);
      const result=await accountRequest('/registration/verify',{id:challenge.id,response,...proof});
      setOperation(result);setBackup(null);setAnswers(['','','']);setStage('activation');
      setContext(await accountRequest('/status'));setMessage('Respaldo comprobado. Continúa para activar tu cuenta.');
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  }
  async function advance(){
    setBusy(true);
    try {
      let result=await accountRequest('/activation/'+operation.operationId);
      if(result.success){setOperation(null);await refresh();onActivated?.();return;}
      if(['failed','conflict','abandoned'].includes(result.state)){setMessage(result.message);return;}
      if(result.requiresSignature){
        const authorization=result.authorization?await signAccountTransaction(result.authorization,context):{};
        result=await accountRequest('/activation/'+operation.operationId,authorization);
      }
      setMessage(result.message+' Puedes consultar otra vez; no se repite una transacción ya enviada.');
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  }
  return <section className="account-security" aria-labelledby="account-security-title">
    <h2 id="account-security-title">Seguridad y recuperación</h2>
    <p role="status" aria-live="polite">{message}</p>
    {context&&!context.account&&stage==='start'&&<button onClick={begin} disabled={busy}>Configurar mi acceso</button>}
    {backup&&stage==='show'&&<>
      <p>Guarda estas 12 palabras en un lugar seguro fuera de este dispositivo. Permiten solicitar la recuperación de esta misma cuenta. Nunca las compartas con soporte.</p>
      <ol className="recovery-words">{backup.phrase.split(' ').map((word,i)=><li key={i}>{word}</li>)}</ol>
      <p>No se enviarán al servidor. Confirmar las palabras no garantiza que conserves el respaldo: es importante guardarlo.</p>
      <button onClick={()=>setStage('check')}>Ya guardé mi respaldo</button>
    </>}
    {backup&&stage==='check'&&<form onSubmit={e=>{e.preventDefault();register();}}>
      <p>Comprueba tu copia. Las respuestas se verifican únicamente en este dispositivo.</p>
      {positions.map((position,i)=><label key={position}>Palabra {position+1}<input type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} value={answers[i]} disabled={busy} onChange={e=>setAnswers(old=>old.map((v,n)=>n===i?e.target.value:v))}/></label>)}
      <button disabled={busy}>{busy?'Verificando…':'Confirmar respaldo y registrar dispositivo'}</button>
      <button type="button" disabled={busy} onClick={()=>setStage('show')}>Revisar palabras</button>
    </form>}
    {operation&&<button disabled={busy} onClick={advance}>{busy?'Comprobando…':'Continuar o consultar activación'}</button>}
    {context?.account?.state==='active'&&<p>Confirma tus operaciones con la seguridad de tu dispositivo. Tu frase se utiliza solo para recuperar el acceso.</p>}
    {context?.account?.state==='active'&&<PersonalRecovery context={context} onRecovered={refresh}/>}
    <p>La recuperación asistida todavía no está habilitada. No se cobra ninguna tarifa por un servicio no disponible.</p>
  </section>;
}
