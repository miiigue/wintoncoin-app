import React,{useEffect,useState,useRef} from 'react';
import {startRegistration} from '@simplewebauthn/browser';
import {accountRequest,createBackup,restoreBackup,backupPositions,verifyBackupWords,proveBackup,signAccountTransaction} from '../modules/recoverableAccount.js';
import './AccountSecurity.css';
import PersonalRecovery from './PersonalRecovery.jsx';

export default function AccountSecurity({onActivated}) {
  const [context,setContext]=useState(null),[message,setMessage]=useState('Consultando la seguridad de tu cuenta…'),[busy,setBusy]=useState(false);
  const [backup,setBackup]=useState(null),[positions,setPositions]=useState([]),[answers,setAnswers]=useState(['','','']),[stage,setStage]=useState('start');
  const [operation,setOperation]=useState(null);
  const [draft,setDraft]=useState(null),[resumeWords,setResumeWords]=useState(''),[challenge,setChallenge]=useState(null);
  function draftKey(c){return c?.userId&&c?.configuration?.chainId?'winton_backup_draft:'+c.configuration.chainId+':'+c.userId:null;}
  function readDraft(c){const key=draftKey(c);if(!key)return null;try{const d=JSON.parse(localStorage.getItem(key));return /^0x[a-fA-F0-9]{40}$/.test(d?.address)?d:null;}catch{return null;}}
  function clearDraft(c){const key=draftKey(c);if(key)try{localStorage.removeItem(key);}catch{}}
  const [sessionExpired,setSessionExpired]=useState(false);
  const [activationState,setActivationState]=useState('unknown');
  const [migrating,setMigrating]=useState(false);
  const inFlight=useRef(false),mounted=useRef(true);
  function startAction(){if(inFlight.current)return false;inFlight.current=true;setBusy(true);return true;}
  function endAction(){inFlight.current=false;if(mounted.current)setBusy(false);}

  function reportError(e){if(!mounted.current)return;if(e.status===401)setSessionExpired(true);setMessage(e.message||'No pudimos conectar con el servicio. Comprueba tu conexión y vuelve a intentarlo.');}
  const refresh=async()=>{
    try {
      const c=await accountRequest('/status');if(!mounted.current)return null;
      setContext(c);setSessionExpired(false);
      setMessage(c.account?.state==='active'?'Acceso y respaldo activados.':'Configura tu acceso y guarda un respaldo antes de operar.');
      setOperation(c.activationId?{operationId:c.activationId}:null);
      if(c.activationId||c.account){clearDraft(c);setBackup(null);setResumeWords('');setStage('activation');}
      else {const d=readDraft(c);if(d){setDraft(d);setStage('resume');setMessage('Tu respaldo quedó pendiente. Retoma las mismas palabras que guardaste; todavía no está activado.');}}
      return c;
    }catch(e){reportError(e);return null;}
  };
  useEffect(()=>{mounted.current=true;refresh();return ()=>{mounted.current=false;};},[]);
  function begin(c){
    if(!draftKey(c))throw new Error('El servicio debe actualizarse antes de iniciar el respaldo. No se generaron palabras.');
    const b=createBackup();const d={address:b.address};
    localStorage.setItem(draftKey(c),JSON.stringify(d));setDraft(d);
    setBackup(b);setPositions(backupPositions());setAnswers(['','','']);setStage('show');
  }
  function resumeBackup(){try{const b=restoreBackup(resumeWords,draft.address);setBackup(b);setResumeWords('');setPositions(backupPositions());setAnswers(['','','']);setStage('check');setMessage('Retomaste el mismo respaldo. Confirma tu copia para continuar.');}catch(e){reportError(e);}}
  async function configureBackup(){
    if(!startAction())return;
    try {
      const current=await accountRequest('/status');
      setContext(current);
      if(current.activationId){setOperation({operationId:current.activationId});setMessage('Tu activación está en curso. Pulsa Continuar para comprobarla.');}
      else if(!current.account){const existing=readDraft(current);if(existing){setDraft(existing);setStage('resume');setMessage('Retoma las palabras que ya guardaste.');return;}const readiness=await accountRequest('/activation-readiness');if(readiness.ready!==true)throw new Error('La activación todavía no está disponible.');begin(current);setMessage(readiness.replacingLegacy?'Tu billetera anterior puede actualizarse. Guarda el respaldo y registra tu dispositivo. La nueva dirección sustituirá a la anterior al completar la activación; conservarás tu usuario.':'Primero guarda tu respaldo; después registrarás tu dispositivo.');}
      else {setMessage(current.account.state==='active'?'Tu respaldo ya está activado. Conserva las palabras que guardaste al crear la cuenta.':'Tu cuenta necesita completar su activación. Vuelve a comprobar su estado.');}
    } catch(e) {
      reportError(e);
    } finally {endAction();}
  }
  async function register(){
    if(!backup||!verifyBackupWords(backup.phrase,positions,answers)){setMessage('Las palabras no coinciden. Comprueba tu respaldo.');return;}
    if(!startAction())return;
    setMessage('Palabras confirmadas. Preparando el registro de tu dispositivo…');
    try {
      const current=await accountRequest('/status');
      if(draftKey(current)!==draftKey(context))throw new Error('La sesión cambió. Recarga la página para continuar con tu cuenta.');
      if(current.activationId||current.account){await refresh();return;}
      const next=await accountRequest('/registration/options',{});
      setChallenge(next);setStage('device');setAnswers(['','','']);
      setMessage('Tu copia está comprobada. Pulsa Registrar mi dispositivo y completa la confirmación que muestre tu teléfono.');
    }catch(e){reportError(e);}finally{endAction();}
  }
  async function registerDevice(){
    if(!challenge||!backup||!startAction())return;
    setMessage('Esperando la confirmación de tu teléfono. Puedes usar la opción de seguridad que te ofrezca.');
    try {
      // Called directly from a click, before any network await.
      const response=await startRegistration({...challenge.options,timeout:60000});
      setMessage('Dispositivo confirmado. Registrando tu respaldo…');
      const proof=await proveBackup(backup.phrase,challenge.backupMessage);
      const result=await accountRequest('/registration/verify',{id:challenge.id,response,...proof});
      setOperation(result);clearDraft(context);setBackup(null);setAnswers(['','','']);setStage('activation');setChallenge(null);
      setContext(await accountRequest('/status'));setMessage('Respaldo comprobado. Continúa para activar tu cuenta.');
    }catch(e){
      // A lost response is not proof of a failed registration. Reconcile first.
      try{const current=await accountRequest('/status');if(current.activationId||current.account){await refresh();return;}}catch{}
      setChallenge(null);setStage('check');setPositions(backupPositions());setAnswers(['','','']);
      if(e.name==='NotAllowedError')setMessage('No se completó la confirmación del dispositivo. Tu respaldo sigue siendo el mismo. Confirma tu copia para reintentarlo.');else reportError(e);
    }finally{endAction();}
  }
  async function checkActivation(userInitiated=false){
    if(!operation||sessionExpired||!startAction())return;
    try {
      let result=await accountRequest('/activation/'+operation.operationId);
      if(!mounted.current)return;
      setMigrating(Boolean(result.migration));
      if(result.success){
        const current=await refresh();
        if(current?.account?.state==='active'){setActivationState('confirmed');onActivated?.();}
        return;
      }
      if(['failed','conflict','abandoned'].includes(result.state)){
        setActivationState('stopped');setMessage(result.message||'La activación necesita revisión. Consulta su estado antes de continuar.');return;
      }
      if(result.requiresSignature){
        setActivationState('authorization');
        if(!userInitiated){setMessage(result.migration?result.message:'Falta tu confirmación para continuar. Pulsa Confirmar siguiente paso.');return;}
        const authorization=result.authorization?await signAccountTransaction(result.authorization,context):{};
        if(!mounted.current)return;
        result=await accountRequest('/activation/'+operation.operationId,authorization);
        if(!mounted.current)return;
      }
      setActivationState(['failed','conflict','abandoned'].includes(result.state)?'stopped':result.requiresSignature?'authorization':'waiting');
      setMessage(result.message||'Operación en proceso. Comprobaremos su confirmación.');
    }catch(e){reportError(e);}finally{endAction();}
  }
  useEffect(() => {
    if (!operation||sessionExpired||['authorization','stopped','confirmed'].includes(activationState))return;
    // Polling only reads. No automatic signature request or submission.
    const timer=setInterval(()=>{if(document.visibilityState==='visible')checkActivation(false);},60000);
    return ()=>clearInterval(timer);
  }, [operation?.operationId,sessionExpired,activationState]);

  const isActive=context?.account?.state==='active';
  const successKey=isActive&&context?.configuration?.chainId&&context.account.address
    ? 'winton_activation_success_dismissed:'+context.configuration.chainId+':'+context.account.address.toLowerCase():null;
  const [dismissedKey,setDismissedKey]=useState(null);
  useEffect(()=>{try{setDismissedKey(successKey&&localStorage.getItem(successKey)==='true'?successKey:null);}catch{setDismissedKey(null);}},[successKey]);
  const dismissedSuccess=successKey&&dismissedKey===successKey;

  return <section id="account-security" className="account-security" aria-labelledby="account-security-title">
    <h2 id="account-security-title">Seguridad y recuperación</h2>
    <p role="status" aria-live="polite">{message}</p>
    {sessionExpired&&<a href="/login?returnTo=%2Fwallet.html">Iniciar sesión para continuar</a>}
    {!sessionExpired&&stage==='start'&&!operation&&!isActive&&<button onClick={configureBackup} disabled={busy}>{busy?'Comprobando disponibilidad…':'Configurar respaldo de mi billetera'}</button>}
    {stage==='resume'&&!operation&&!isActive&&<form onSubmit={e=>{e.preventDefault();resumeBackup();}}>
      <p>Introduce las 12 palabras que guardaste. Se comprueban solo en este dispositivo y no se envían al servidor.</p>
      <label>Palabras del respaldo pendiente<textarea value={resumeWords} onChange={e=>setResumeWords(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false}/></label>
      <button disabled={busy}>Retomar mi respaldo</button>
      <button type="button" disabled={busy} onClick={()=>setStage('discard')}>No guardé esas palabras</button>
    </form>}
    {stage==='discard'&&!operation&&!isActive&&<div>
      <p>Crear otro respaldo reemplazará las palabras pendientes de este dispositivo. Primero comprobaremos si ya existe una activación.</p>
      <button disabled={busy} onClick={async()=>{if(!startAction())return;try{const c=await accountRequest('/status');setContext(c);if(c.account||c.activationId){await refresh();return;}const r=await accountRequest('/activation-readiness');if(!r.ready)throw new Error('No se pudo comprobar la activación.');begin(c);setMessage('Guarda este nuevo respaldo. El anterior pendiente queda descartado.');}catch(e){reportError(e);}finally{endAction();}}}>Confirmar creación de otro respaldo</button>
      <button onClick={()=>setStage('resume')} disabled={busy}>Volver</button>
    </div>}
    {stage==='device'&&backup&&<button disabled={busy} onClick={registerDevice}>{busy?'Esperando confirmación…':'Registrar mi dispositivo'}</button>}
    {backup&&stage==='show'&&<>
      <p>Guarda estas 12 palabras en un lugar seguro fuera de este dispositivo. Permiten solicitar la recuperación de esta misma cuenta. Nunca las compartas con soporte.</p>
      <ol className="recovery-words">{backup.phrase.split(' ').map((word,i)=><li key={i}>{word}</li>)}</ol>
      <p>No se enviarán al servidor. Confirmar las palabras no garantiza que conserves el respaldo: es importante guardarlo.</p>
      <button onClick={()=>setStage('check')}>Ya guardé mi respaldo</button>
    </>}
    {backup&&stage==='check'&&<form onSubmit={e=>{e.preventDefault();register();}}>
      <p>Comprueba tu copia. Las respuestas se verifican únicamente en este dispositivo.</p>
      {positions.map((position,i)=><label key={position}>Palabra {position+1}<input type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} value={answers[i]} disabled={busy} onChange={e=>setAnswers(old=>old.map((v,n)=>n===i?e.target.value:v))}/></label>)}
      <button disabled={busy}>{busy?'Preparando registro…':'Confirmar palabras y continuar'}</button>
      <button type="button" disabled={busy} onClick={()=>setStage('show')}>Revisar palabras</button>
    </form>}
    {operation&&(
      <div className="activation-pending-banner">
        <p className="activation-pending-title">{activationState==='authorization'?'Falta tu confirmación':activationState==='stopped'?'La activación necesita revisión':'Activación de tu billetera'}</p>
        <p className="activation-pending-desc">
          {activationState==='authorization'?'Para continuar, confirma el siguiente paso. La aplicación no solicitará firmas automáticamente.':activationState==='stopped'?'No se enviarán más pasos automáticamente. Puedes consultar el estado.':'La confirmación depende de la red y puede tardar varios minutos. Consultamos el estado cada 60 segundos mientras esta pestaña esté visible; las firmas y envíos requieren que pulses el botón.'}
        </p>
        <button disabled={busy||sessionExpired} onClick={()=>checkActivation(true)}>{busy?'Comprobando…':activationState==='authorization'?(migrating?'Actualizar billetera y conservar saldo':'Confirmar siguiente paso'):'Consultar o continuar activación'}</button>
      </div>
    )}
    {isActive&&!dismissedSuccess&&(
      <div className="activation-success-card">
        <div className="activation-success-content">
          <span className="activation-success-icon" aria-hidden="true">🎉</span>
          <div>
            <strong>¡Felicidades! Tu billetera está activa</strong>
            <p>Tu cuenta cuenta con protección de autocustodia y respaldo configurado.</p>
          </div>
        </div>
        <button type="button" className="activation-dismiss-btn" onClick={()=>{
          if(successKey){setDismissedKey(successKey);try{localStorage.setItem(successKey,'true');}catch{}}
        }}>Entendido</button>
      </div>
    )}
    {isActive&&(
      <div className="recovery-collapsible-body">
        <PersonalRecovery context={context} onRecovered={refresh}/>
        <p className="recovery-note">La recuperación asistida todavía no está habilitada. No se cobra ninguna tarifa por un servicio no disponible.</p>
      </div>
    )}
    {!isActive&&<p className="recovery-note">La recuperación asistida todavía no está habilitada. No se cobra ninguna tarifa por un servicio no disponible.</p>}
  </section>;
}
