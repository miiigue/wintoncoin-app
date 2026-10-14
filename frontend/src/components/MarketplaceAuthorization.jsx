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
    <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}}>
      <span style={{fontSize:'1.5rem'}}>{checkOnly?'⏳':'🔐'}</span>
      <h2 id="marketplace-sign-title" style={{margin:0,fontSize:'1.3rem'}}>{checkOnly?'Procesando confirmación':'Confirmar pago'}</h2>
    </div>
    {a&&<div style={{background:'rgba(255,255,255,0.05)',padding:'12px 14px',borderRadius:'10px',marginBottom:'14px',border:'1px solid rgba(255,255,255,0.08)'}}>
      <p style={{margin:'4px 0'}}><strong>Importe:</strong> {formatUnits(a.amount,6)} BLUE</p>
      <p style={{margin:'4px 0'}}><strong>Comisión:</strong> {formatUnits(BigInt(a.amount)*BigInt(a.feeBps)/10000n,6)} BLUE</p>
      <p style={{margin:'4px 0',fontSize:'0.85rem',color:'#94a3b8'}}><strong>Destino:</strong> <span className="operation-address" style={{color:'#38bdf8'}}>{a.payee}</span></p>
    </div>}
    <p style={{fontSize:'0.85rem',color:'#94a3b8',marginBottom:'14px',lineHeight:'1.4'}}>
      El protocolo aplica tus saldos y las reglas de compromisos RED. Nunca compartas tu frase de recuperación.
    </p>
    <div style={{
      background: checkOnly ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.05)',
      border: checkOnly ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '10px',
      padding: '12px 14px',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      {busy && <span className="spinner" style={{display:'inline-block',width:'18px',height:'18px',border:'2px solid #38bdf8',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite',flexShrink:0}}></span>}
      <p role="status" style={{margin:0,fontSize:'0.9rem',color:checkOnly?'#38bdf8':'#f1f5f9',lineHeight:'1.4'}}>{message}</p>
    </div>
    <div style={{display:'flex',gap:'10px',justifyContent:'flex-end'}}>
      <button disabled={busy} onClick={()=>onClose(null)} style={{background:'transparent',border:'1px solid #64748b',color:'#cbd5e1'}}>Cerrar</button>
      <button disabled={busy||!a} onClick={confirm}>{busy?'Comprobando…':checkOnly?'Consultar estado del pago':'Confirmar con mi dispositivo'}</button>
    </div>
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
