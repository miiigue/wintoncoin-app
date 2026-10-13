import {getApiUrl} from './config.js';
let authorizeUI=null;
export function registerPinUI(handler) {authorizeUI=handler;return ()=>{if(authorizeUI===handler)authorizeUI=null;};}
export async function requestOperation(action,details={}) {
    if(!authorizeUI)throw new Error('La autorización está cargando. Intenta nuevamente.');
    return authorizeUI({action,...details});
}
export async function operationRequest(path,body) {
    const token=localStorage.getItem('token');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),45000);
    try {
    const response=await fetch(`${getApiUrl()}/api/me/operations${path}`,{
        signal:controller.signal,method:body?'POST':'GET',credentials:'include',cache:'no-store',
        headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},
        ...(body?{body:JSON.stringify(body)}:{})
    });
    const data=await response.json();
    if(!response.ok)throw Object.assign(new Error(data.message||'No se pudo comprobar la operación.'),{status:response.status});
    return data;
    } catch(e) {
        if(e.name==='AbortError')throw Object.assign(new Error(path==='/marketplace/terms'&&!body?'No pudimos consultar las condiciones del pago a tiempo. No se ha enviado un pago desde este resumen. Intenta nuevamente.':'El servicio tardó demasiado en responder. Consulta el estado de esta misma operación antes de volver a autorizar.'),{uncertain:Boolean(body)});
        throw e;
    } finally {clearTimeout(timer);}
}
