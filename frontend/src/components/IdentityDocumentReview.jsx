import React,{useState} from 'react';
import {getApiUrl} from '../modules/config.js';
import styles from '../pages/AdminWeb3Panel.module.css';
export default function IdentityDocumentReview(){
 const [values,setValues]=useState({username:'',country:'',type:'national_id',number:'',evidenceReference:''}),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const field=(name,label)=> <label className={styles.formLabel}>{label}<input className={styles.formInput} value={values[name]} autoComplete="off" required maxLength={name==='country'?2:200} disabled={busy} onChange={e=>setValues(v=>({...v,[name]:name==='country'?e.target.value.toUpperCase():e.target.value}))}/></label>;
 async function submit(e){e.preventDefault();setBusy(true);setMessage('Registrando revisión…');try{
  const response=await fetch(`${getApiUrl()}/api/admin/account-identity/reviewed-document`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
  const data=await response.json();if(!response.ok)throw new Error(data.message||'No se pudo guardar la revisión.');setMessage(data.message);setValues(v=>({...v,number:''}));
 }catch(e){setMessage(e.message);}finally{setBusy(false);}}
 return <section className={styles.actionPanel}><h3>Documentos de una identidad</h3><p>Registra únicamente documentos ya revisados. Dos pasaportes de países distintos pueden pertenecer a la misma persona: la revisión debe comprobarlo y utilizar su cuenta existente. Este registro no recupera billeteras ni aprueba KYC automáticamente.</p>
  <form onSubmit={submit}>{field('username','Nombre de usuario')}{field('country','País emisor (AR, ES…)')}
   <label className={styles.formLabel}>Tipo<select className={styles.formInput} value={values.type} disabled={busy} onChange={e=>setValues(v=>({...v,type:e.target.value}))}><option value="national_id">Identificación nacional</option><option value="passport">Pasaporte</option><option value="residence_permit">Permiso de residencia</option></select></label>
   {field('number','Número del documento')}{field('evidenceReference','Referencia interna de la revisión (sin imágenes ni datos biométricos)')}
   <button className={styles.submitBtn} disabled={busy}>Registrar documento revisado</button>
  </form><p role="status" aria-live="polite">{message}</p>
 </section>;
}
