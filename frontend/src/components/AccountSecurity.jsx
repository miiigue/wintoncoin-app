import React,{useEffect,useState,useRef} from 'react';
import {startRegistration} from '@simplewebauthn/browser';
import {accountRequest,createBackup,backupPositions,verifyBackupWords,proveBackup,signAccountTransaction} from '../modules/recoverableAccount.js';
import './AccountSecurity.css';
import PersonalRecovery from './PersonalRecovery.jsx';

export default function AccountSecurity({onActivated}) {
  const [context,setContext]=useState(null),[message,setMessage]=useState('Consultando la seguridad de tu cuenta…'),[busy,setBusy]=useState(false);
  const [backup,setBackup]=useState(null),[positions,setPositions]=useState([]),[answers,setAnswers]=useState(['','','']),[stage,setStage]=useState('start');
  const [operation,setOperation]=useState(null);
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
      return c;
    }catch(e){reportError(e);return null;}
  };
  useEffect(()=>{mounted.current=true;refresh();return ()=>{mounted.current=false;};},[]);
  function begin(){setBackup(createBackup());setPositions(backupPositions());setAnswers(['','','']);setStage('show');}
  async function configureBackup(){
    if(!startAction())return;
    try {
      const current=await accountRequest('/status');
      setContext(current);
      if(current.activationId){setOperation({operationId:current.activationId});setMessage('Tu activación está en curso. Pulsa Continuar para comprobarla.');}
      else if(!current.account){const readiness=await accountRequest('/activation-readiness');if(readiness.ready!==true)throw new Error('La activación todavía no está disponible.');begin();setMessage(readiness.replacingLegacy?'Tu billetera anterior puede actualizarse. Guarda el respaldo y registra tu dispositivo. La nueva dirección sustituirá a la anterior al completar la activación; conservarás tu usuario.':'Primero guarda tu respaldo; después registrarás tu dispositivo.');}
      else {setMessage(current.account.state==='active'?'Tu respaldo ya está activado. Conserva las palabras que guardaste al crear la cuenta.':'Tu cuenta necesita completar su activación. Vuelve a comprobar su estado.');}
    } catch(e) {
      reportError(e);
    } finally {endAction();}
  }
  async function register(){
    if(!verifyBackupWords(backup.phrase,positions,answers)){setMessage('Las palabras no coinciden. Comprueba tu respaldo.');return;}
    if(!startAction())return;
    try {
      const challenge=await accountRequest('/registration/options',{});
      const response=await startRegistration(challenge.options);
      const proof=await proveBackup(backup.phrase,challenge.backupMessage);
      const result=await accountRequest('/registration/verify',{id:challenge.id,response,...proof});
      setOperation(result);setBackup(null);setAnswers(['','','']);setStage('activation');
      setContext(await accountRequest('/status'));setMessage('Respaldo comprobado. Continúa para activar tu cuenta.');
    }catch(e){reportError(e);}finally{endAction();}
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
