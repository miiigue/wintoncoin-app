import React, {useEffect,useState} from 'react';
import {getApiUrl} from '../modules/config.js';
export default function AdminGate({children}) {
  const [state,setState]=useState('loading');
  useEffect(()=>{
    const controller=new AbortController();
    fetch(`${getApiUrl()}/api/admin/profile`,{credentials:'include',cache:'no-store',signal:controller.signal})
      .then(async response=>{
        if(!response.ok) throw new Error('session');
        const admin=await response.json();
        setState(['admin','superadmin','auditor'].includes(admin.role)?'ready':'denied');
      }).catch(error=>{if(error.name!=='AbortError')setState('denied');});
    return ()=>controller.abort();
  },[]);
  if(state==='loading')return <main role="status">Verificando sesión administrativa…</main>;
  if(state!=='ready')return <main><h1>Acceso administrativo</h1><p>Inicia sesión con una cuenta administrativa autorizada.</p><a href="/admin.html">Iniciar sesión administrativa</a></main>;
  return children;
}
