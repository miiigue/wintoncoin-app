import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {formatUnits,TypedDataEncoder} from 'ethers';
import {operationRequest} from '../modules/pinOperations.js';
import {signMarketplace} from '../modules/recoverableAccount.js';
import './OperationAuthorization.css';
function Dialog({id,quote,onClose}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('Revisa el pago antes de confirmarlo en tu dispositivo.');
  const a=quote.authorization?.message;
  const inFlight=useRef(false);
  const [checkOnly,setCheckOnly]=useState(false);
  async function confirm(){
    if(inFlight.current)return;
    inFlight.current=true;setBusy(true);
    let submitting=false;
    try {
      setMessage('Consultando el estado de este pago…');
      const fresh=await operationRequest('/marketplace/'+id);
      if(!fresh.authorization){onClose(fresh);return;}
      if(checkOnly){setMessage('Todavía no se confirmó el resultado del envío. Conservamos la referencia; consulta de nuevo sin crear otro pago.');return;}
      const digest=x=>TypedDataEncoder.hash(x.domain,x.types,x.message);
      if(digest(fresh.authorization)!==digest(quote.authorization))throw new Error('El pago cambió. Cierra y abre nuevamente el resumen.');
      setMessage('Confirma el pago con la seguridad de tu dispositivo…');
      let timer;
      let signature;
      try {
        signature=await Promise.race([signMarketplace(fresh.authorization),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('No se completó la firma a tiempo. No enviamos este intento de pago. Cierra la ventana de seguridad del dispositivo antes de reintentar.')),90000);})]);
      } finally {clearTimeout(timer);}
      submitting=true;setCheckOnly(true);
      setMessage('Firma recibida. Enviando la autorización y comprobando el resultado…');
      const result=await operationRequest('/marketplace/'+id+'/authorize',{signature});
      onClose(result);
    }catch(e){
      if(submitting){setCheckOnly(true);setMessage((e.status?'El servidor respondió: '+e.message+' ':'No pudimos confirmar el resultado del envío. ')+'Consulta este mismo pago antes de repetirlo. Referencia: '+id);}
      else setMessage(e.message||'No se pudo completar la autorización.');
    }finally{inFlight.current=false;setBusy(false);}
  }
  return <div className="operation-backdrop"><section className="operation-dialog" role="dialog" aria-modal="true" aria-labelledby="marketplace-sign-title">
    <h2 id="marketplace-sign-title">Confirmar pago</h2>
    {a&&<><p>Importe: {formatUnits(a.amount,6)} BLUE</p><p>Comisión: {formatUnits(BigInt(a.amount)*BigInt(a.feeBps)/10000n,6)} BLUE</p><p>Destino: <span className="operation-address">{a.payee}</span></p></>}
    <p>El protocolo aplica tus saldos y las reglas de compromisos RED. Nunca escribas tu frase de recuperación para pagar.</p>
    <p role="status">{message}</p><button disabled={busy} onClick={()=>onClose(null)}>Cerrar</button><button disabled={busy||!a} onClick={confirm}>{busy?'Comprobando…':checkOnly?'Consultar estado del pago':'Confirmar con mi dispositivo'}</button>
  </section></div>;
}
export async function authorizeMarketplace(id){
  const quote=await operationRequest('/marketplace/'+id);
  if(!quote.authorization)return quote;
  return new Promise(resolve=>{
    const container=document.createElement('div');document.body.appendChild(container);const root=createRoot(container);
    root.render(<Dialog id={id} quote={quote} onClose={result=>{root.unmount();container.remove();resolve(result);}}/>);
  });
}
