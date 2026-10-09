import React,{useEffect,useState} from 'react';
import {startRegistration} from '@simplewebauthn/browser';
import {accountRequest,createBackup,backupPositions,verifyBackupWords,proveBackup,signAccountTransaction} from '../modules/recoverableAccount.js';
import './AccountSecurity.css';
import PersonalRecovery from './PersonalRecovery.jsx';

export default function AccountSecurity({onActivated}) {
  const [context,setContext]=useState(null),[message,setMessage]=useState('Consultando la seguridad de tu cuenta…'),[busy,setBusy]=useState(false);
  const [backup,setBackup]=useState(null),[positions,setPositions]=useState([]),[answers,setAnswers]=useState(['','','']),[stage,setStage]=useState('start');
  const [operation,setOperation]=useState(null);
  const [sessionExpired,setSessionExpired]=useState(false);
  function reportError(e){setSessionExpired(e.status===401);setMessage(e.message||'No pudimos conectar con el servicio. Comprueba tu conexión y vuelve a intentarlo.');}
  const refresh=()=>accountRequest('/status').then(c=>{setContext(c);setMessage(c.account?.state==='active'?'Acceso y respaldo activados.':'Configura tu acceso y guarda un respaldo antes de operar.');if(c.activationId)setOperation({operationId:c.activationId});}).catch(reportError);
  useEffect(()=>{refresh();return ()=>{};},[]);
  function begin(){setBackup(createBackup());setPositions(backupPositions());setAnswers(['','','']);setStage('show');}
  async function configureBackup(){
    setBusy(true);
    try {
      const current=await accountRequest('/status');
      setContext(current);
      if(current.activationId){setOperation({operationId:current.activationId});setMessage('Tu activación está en curso. Pulsa Continuar para comprobarla.');}
      else if(!current.account){const readiness=await accountRequest('/activation-readiness');if(readiness.ready!==true)throw new Error('La activación todavía no está disponible.');begin();setMessage('Primero guarda tu respaldo; después registrarás tu dispositivo.');}
      else {setMessage(current.account.state==='active'?'Tu respaldo ya está activado. Conserva las palabras que guardaste al crear la cuenta.':'Tu cuenta necesita completar su activación. Vuelve a comprobar su estado.');}
    } catch(e) {
      reportError(e);
    } finally {setBusy(false);}
  }
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
    }catch(e){reportError(e);}finally{setBusy(false);}
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
    }catch(e){reportError(e);}finally{setBusy(false);}
  }
  useEffect(() => {
    if (!operation || busy) return;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        advance();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [operation, busy]);

  const [dismissedSuccess, setDismissedSuccess] = useState(() => {
    try { return localStorage.getItem('winton_activation_success_dismissed') === 'true'; } catch { return false; }
  });

  const isActive = context?.account?.state === 'active';

  return <section id="account-security" className="account-security" aria-labelledby="account-security-title">
    {!isActive && <h2 id="account-security-title">Seguridad y recuperación</h2>}
    {!isActive && <p role="status" aria-live="polite">{message}</p>}
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
        <p className="activation-pending-title">⏳ Tu billetera se está desplegando y registrando en la blockchain:</p>
        <p className="activation-pending-desc">
          Este proceso de confirmación puede tardar entre 2 y 10 minutos según la velocidad de la red.
          La aplicación comprueba el estado automáticamente cada 60 segundos, o puedes pulsar el botón a continuación.
        </p>
        <button disabled={busy} onClick={advance}>{busy?'Comprobando en blockchain…':'Continuar o consultar activación'}</button>
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
          setDismissedSuccess(true);
          try{localStorage.setItem('winton_activation_success_dismissed','true');}catch{}
        }}>Entendido</button>
      </div>
    )}
    {isActive&&(
      <details className="recovery-collapsible">
        <summary className="recovery-summary-btn">
          <span>🛡️ Opciones de seguridad y recuperación</span>
        </summary>
        <div className="recovery-collapsible-body">
          <p>Confirma tus operaciones con la seguridad de tu dispositivo. Tu frase se utiliza solo para recuperar el acceso.</p>
          <PersonalRecovery context={context} onRecovered={refresh}/>
          <p className="recovery-note">La recuperación asistida todavía no está habilitada. No se cobra ninguna tarifa por un servicio no disponible.</p>
        </div>
      </details>
    )}
    {!isActive&&<p className="recovery-note">La recuperación asistida todavía no está habilitada. No se cobra ninguna tarifa por un servicio no disponible.</p>}
  </section>;
}
