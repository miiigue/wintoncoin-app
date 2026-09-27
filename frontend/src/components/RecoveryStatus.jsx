import React,{useEffect,useState} from 'react';
import {getApiUrl} from '../modules/config.js';
export default function RecoveryStatus(){
 const [data,setData]=useState(null);
 useEffect(()=>{let active=true;async function load(){try{const r=await fetch(getApiUrl()+'/api/admin/web3/recovery-status',{credentials:'include',cache:'no-store'});const d=await r.json();if(active&&r.ok&&d.success)setData(d);}catch{}}load();const timer=setInterval(load,15000);return()=>{active=false;clearInterval(timer);};},[]);
 const states={pending:'En proceso',confirmed:'Confirmada',complete:'Aplicación completada',superseded:'Sustituida por una política nueva',conflict:'Requiere revisión'};
 return <div><h3>Seguimiento de cambios</h3>{!data?<p>No se pudo comprobar el seguimiento todavía.</p>:<><p>{data.operations.length} operaciones esperando confirmación o revisión.</p>{data.jobs.map(job=><p key={job.version_id}>Política {job.version_id}: {states[job.state]||job.state}. Cuentas procesadas hasta el identificador {job.cursor_id}.</p>)}{data.operations.map(op=><details key={op.id}><summary>{states[op.state]||op.state}: {op.kind}</summary><p>Referencia {op.id}. {op.error_code||'La recuperación vuelve a comprobar esta transacción; no crea otra.'}</p></details>)}</>}</div>;
}
