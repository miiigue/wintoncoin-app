import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {formatUnits} from 'ethers';
import {operationRequest} from '../modules/pinOperations.js';
import {signMarketplace} from '../modules/recoverableAccount.js';
import './OperationAuthorization.css';
function Dialog({id,quote,onClose}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('Revisa el pago antes de confirmarlo en tu dispositivo.');
  const a=quote.authorization?.message;
  async function confirm(){setBusy(true);try{
    const fresh=await operationRequest('/marketplace/'+id);
    if(JSON.stringify(fresh.authorization)!==JSON.stringify(quote.authorization))throw new Error('El pago cambió. Cierra y abre nuevamente el resumen.');
    const signature=await signMarketplace(fresh.authorization);
    const result=await operationRequest('/marketplace/'+id+'/authorize',{signature});
    onClose(result);
  }catch(e){setMessage(e.message);setBusy(false);}}
  return <div className="operation-backdrop"><section className="operation-dialog" role="dialog" aria-modal="true" aria-labelledby="marketplace-sign-title">
    <h2 id="marketplace-sign-title">Confirmar pago</h2>
    {a&&<><p>Importe: {formatUnits(a.amount,6)} BLUE</p><p>Comisión: {formatUnits(BigInt(a.amount)*BigInt(a.feeBps)/10000n,6)} BLUE</p><p>Destino: <span className="operation-address">{a.payee}</span></p></>}
    <p>El protocolo aplica tus saldos y las reglas de compromisos RED. Nunca escribas tu frase de recuperación para pagar.</p>
    <p role="status">{message}</p><button disabled={busy} onClick={()=>onClose(null)}>Cerrar</button><button disabled={busy||!a} onClick={confirm}>{busy?'Confirmando…':'Confirmar con mi dispositivo'}</button>
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
