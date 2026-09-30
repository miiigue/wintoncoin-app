import React,{useEffect,useRef,useState} from 'react';
import {getApiUrl} from '../modules/config.js';
import styles from '../pages/AdminWeb3Panel.module.css';
import feedbackStyles from './ContractConfiguration.module.css';
import {formatEther,parseEther} from 'ethers';
import {configurationFeedback,safeDiagnostic} from '../modules/configurationFeedback.js';
import RecoveryStatus from './RecoveryStatus.jsx';
import {administerContract} from '../modules/ownerWalletAdministration.js';
const labels={platform_commission_percentage:'Comisión de plataforma (%)',debt_cycle_days:'Plazo del compromiso (días)',red_credit_base_limit:'Límite base de la política RED',red_credit_referral:'Incremento por referido verificado',red_credit_culture_quiz:'Incremento por cuestionario',red_credit_monthly_activity:'Incremento por actividad mensual',red_credit_early_payment:'Incremento por pago anticipado',gas_sponsor_enabled:'Patrocinio de gas habilitado',gas_sponsor_daily_user_operations:'Operaciones patrocinadas por usuario y día',gas_sponsor_daily_budget_wei:'Presupuesto diario total de gas (ETH)',gas_sponsor_max_topup_wei:'Máximo patrocinado por paso (ETH)',gas_sponsor_maintenance_daily_budget_wei:'Máximo diario para amortizaciones automáticas (ETH)',gas_sponsor_maintenance_max_step_wei:'Máximo por amortización automática (ETH)'};
export default function ContractConfiguration({onUpdated}) {
  const [settings,setSettings]=useState({}),[loadError,setLoadError]=useState('');
  const [busyKey,setBusyKey]=useState(null),[results,setResults]=useState({}),[dialogResult,setDialogResult]=useState(null);
  const saving=useRef(false),dialog=useRef(null),title=useRef(null);
  useEffect(()=>{
    const controller=new AbortController();
    fetch(`${getApiUrl()}/api/admin/web3/configuration`,{credentials:'include',cache:'no-store',signal:controller.signal})
      .then(async response=>{
        const data=await response.json();
        if(!response.ok||!data.success)throw new Error(data.message||'No se pudo cargar la configuración.');
        setSettings(Object.fromEntries(data.settings.map(x=>[x.setting_key,x.setting_key.endsWith('_wei')?formatEther(x.setting_value):x.setting_value])));
      }).catch(error=>{if(!controller.signal.aborted)setLoadError(safeDiagnostic(error.message));});
    return ()=>controller.abort();
  },[]);
  useEffect(()=>{
    if(dialogResult&&dialog.current&&!dialog.current.open){dialog.current.showModal();title.current?.focus();}
  },[dialogResult]);
  async function save(key){
    if(saving.current)return;
    saving.current=true;setBusyKey(key);
    const draft=String(settings[key]);
    const context={key,label:labels[key],value:key==='gas_sponsor_enabled'?(draft==='true'?'Activado':'Desactivado'):draft};
    let result,value;
    try{
      try{value=key.endsWith('_wei')?parseEther(draft).toString():draft;}
      catch{result=configurationFeedback({...context,invalidInput:true});}
      if(!result){
        if(key==='platform_commission_percentage'||key==='debt_cycle_days'){
          try{
            const response=await administerContract(key==='platform_commission_percentage'?'commission':'commitment_duration',{value});
            result=configurationFeedback({...context,status:response.success?200:response.pending?202:409,data:response});
          }catch(error){result=configurationFeedback({...context,status:400,data:{message:error.message}});}
        }else{
        const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
        try{
          const response=await fetch(`${getApiUrl()}/api/admin/web3/configuration`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value}),signal:controller.signal});
          const data=await response.json().catch(()=>null);
          result=configurationFeedback({...context,status:response.status,data});
        }catch{result=configurationFeedback({...context,networkError:true});}
        finally{clearTimeout(timeout);}
        }
      }
      setResults(previous=>({...previous,[key]:result}));setDialogResult(result);
      if(result.kind==='success'){
        // A refresh failure cannot turn a confirmed save into an apparent failure.
        try{Promise.resolve(onUpdated?.()).catch(()=>{});}catch{}
      }
    }finally{saving.current=false;setBusyKey(null);}
  }
  const icon=kind=>kind==='success'?'✓':kind==='warning'?'⏳':'⚠';
  return <section className={feedbackStyles.section}>
    <h2>Reglas generales</h2>
    <p>Las reglas RED se aplican progresivamente a las cuentas; la garantía se suma únicamente en el contrato. Una excepción individual se gestiona por nombre de usuario. Cuestionarios y pago anticipado aún no tienen métricas integradas.</p>
    <p>Comisión y plazo se leen del contrato y se confirman en blockchain. Las reglas de cálculo RED se guardan como política administrativa.</p>
    {loadError&&<p role="alert" className={feedbackStyles.error}>{loadError}</p>}
    <div className={feedbackStyles.grid}>{Object.entries(labels).map(([key,label])=><div className={styles.formGroup} key={key}>
      <label className={styles.formLabel} htmlFor={`policy-${key}`}>{label}</label>
      {key==='gas_sponsor_enabled'?<select id={`policy-${key}`} className={styles.formInput} value={settings[key]??'false'} onChange={e=>setSettings({...settings,[key]:e.target.value})} disabled={Boolean(busyKey)}><option value="false">Desactivado</option><option value="true">Activado</option></select>:<input type="number" step="any" id={`policy-${key}`} className={styles.formInput} value={settings[key]??''} onChange={e=>setSettings({...settings,[key]:e.target.value})} inputMode="decimal" disabled={Boolean(busyKey)}/>}
      <button type="button" className={styles.submitBtn} aria-label={`Guardar ${label}`} disabled={Boolean(busyKey)||settings[key]===undefined||settings[key]===''} onClick={()=>save(key)}>{busyKey===key?'Guardando…':'Guardar'}</button>
      <div role="status" aria-live="polite">{busyKey===key?<p>Enviando el cambio y esperando respuesta…</p>:results[key]&&<div className={`${feedbackStyles.result} ${feedbackStyles[results[key].kind]}`}>
        <strong>{icon(results[key].kind)} {results[key].title}</strong><p>Valor enviado: {results[key].value}</p>
        <button type="button" className={feedbackStyles.detailButton} onClick={()=>setDialogResult(results[key])}>Ver resultado completo</button>
      </div>}</div>
    </div>)}</div>
    <p>El patrocinio usa una billetera y presupuesto separados. Con presupuesto cero no se financian operaciones; nunca se crea RED para pagar gas.</p>
    <RecoveryStatus/>
    <dialog ref={dialog} className={feedbackStyles.dialog} aria-labelledby="configuration-result-title" aria-describedby="configuration-result-message" onClose={()=>setDialogResult(null)} onCancel={()=>setDialogResult(null)}>
      {dialogResult&&<div className={feedbackStyles.dialogContent}>
        <h3 id="configuration-result-title" ref={title} tabIndex={-1} className={feedbackStyles[dialogResult.kind]}>{icon(dialogResult.kind)} {dialogResult.title}</h3>
        <p><strong>{dialogResult.label}</strong></p><p>Valor enviado: <strong>{dialogResult.value}</strong></p>
        <p id="configuration-result-message">{dialogResult.message}</p><p className={feedbackStyles.action}>{dialogResult.action}</p>
        <dl className={feedbackStyles.diagnostics}>
          <dt>Fecha de la respuesta</dt><dd>{new Date(dialogResult.at).toLocaleString()}</dd>
          {dialogResult.httpStatus&&<><dt>Respuesta del servidor (HTTP)</dt><dd>{dialogResult.httpStatus}</dd></>}
          {dialogResult.code&&<><dt>Código de diagnóstico</dt><dd>{dialogResult.code}</dd></>}
          {dialogResult.operationId&&<><dt>Referencia de la operación</dt><dd>{dialogResult.operationId}</dd></>}
          {dialogResult.txHash&&<><dt>Identificador de la transacción</dt><dd>{dialogResult.txHash}</dd></>}
        </dl>
        <button type="button" className={styles.submitBtn} onClick={()=>dialog.current?.close()}>Entendido</button>
      </div>}
    </dialog>
  </section>;
}
