import React,{useEffect,useRef,useState} from 'react';
import {registerPinUI,operationRequest} from '../modules/pinOperations.js';
import './OperationAuthorization.css';
export default function OperationAuthorization({children}) {
    const [quote,setQuote]=useState(null),[pin,setPin]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
    const pending=useRef(null),alive=useRef(true);
    useEffect(()=>{
        alive.current=true;
        const saved=sessionStorage.getItem('winton-operation-id');
        if(saved)operationRequest(`/${saved}`).then(result=>{
            if(!alive.current)return;
            if(result.success || result.state==='failed'){sessionStorage.removeItem('winton-operation-id');return;}
            setQuote(result);setMessage(result.message);
        }).catch(()=>{});
        const remove=registerPinUI(async input=>{
            if(pending.current || sessionStorage.getItem('winton-operation-id'))throw new Error('Hay una operación anterior. Recarga para consultar su estado antes de crear otra.');
            const promise=new Promise((resolve,reject)=>{pending.current={resolve,reject};});
            try {const result=await operationRequest('/prepare',input);sessionStorage.setItem('winton-operation-id',result.operationId);setQuote(result);setMessage('Revisa el importe y autoriza con tu PIN.');setPin('');}
            catch(e){pending.current.reject(e);pending.current=null;}
            return promise;
        });
        return ()=>{alive.current=false;remove();pending.current?.reject(new Error('Consulta el estado de la operación antes de repetirla.'));pending.current=null;};
    },[]);
    async function execute(event) {
        event.preventDefault();setBusy(true);setMessage('Autorizando operación…');
        const authorizationPin=pin;setPin('');
        try {
            let result=await operationRequest(`/${quote.operationId}/authorize`,{pin:authorizationPin});
            const deadline=Date.now()+14*60*1000;
            while(alive.current&&!result.success&&Date.now()<deadline) {
                if(['failed','conflict'].includes(result.state))throw new Error(result.message);
                setMessage(result.message||'Esperando confirmación de blockchain. No repitas la operación.');
                await new Promise(resolve=>setTimeout(resolve,3000));
                if(result.fundingOperationId) {
                    const funding=await operationRequest(`/${result.fundingOperationId}`);
                    if(funding.success)result=await operationRequest(`/${quote.operationId}/authorize`,{pin:authorizationPin});
                    else if(['failed','conflict'].includes(funding.state))throw new Error(funding.message);
                } else {
                    result=await operationRequest(`/${quote.operationId}`);
                    if(result.requiresSignature)result=await operationRequest(`/${quote.operationId}/authorize`,{pin:authorizationPin});
                }
            }
            if(!result.success)throw new Error(`La confirmación sigue pendiente. Referencia: ${quote.operationId}. Consulta su estado antes de repetir.`);
            pending.current?.resolve(result);pending.current=null;sessionStorage.removeItem('winton-operation-id');setQuote(null);
        }catch(e){setMessage(e.message);}finally{setBusy(false);}
    }
    async function close(){
        if(busy)return;
        setBusy(true);
        try {
            const current=await operationRequest(`/${quote.operationId}`);
            if(current.success || current.state==='failed' || (current.requiresSignature&&!current.steps.length))sessionStorage.removeItem('winton-operation-id');
            if(current.success)pending.current?.resolve(current);
            else pending.current?.reject(new Error('Autorización cerrada. Las transacciones ya enviadas conservan su estado.'));
            pending.current=null;setQuote(null);setPin('');
        }catch(e){setMessage('No se pudo comprobar el estado. Conservamos la referencia: '+e.message);}
        finally{setBusy(false);}
    }
    async function checkStatus(){try{const result=await operationRequest(`/${quote.operationId}`);setMessage(result.message);if(result.success){sessionStorage.removeItem('winton-operation-id');pending.current?.resolve(result);pending.current=null;setQuote(null);}else setQuote(result);}catch(e){setMessage(e.message);}}
    return <>{children}{quote&&<div className="operation-backdrop"><section className="operation-dialog" role="dialog" aria-modal="true" aria-labelledby="operation-title">
        <h2 id="operation-title">{quote.title}</h2><p>{quote.amount&&<>Importe: <strong>{quote.amount}</strong><br/></>}Red: {quote.chainId}<br/>Dirección: <span className="operation-address">{quote.destination}</span></p>
        <p>Máximo previsto para la red: {quote.maxNetworkFeeEth} ETH en {quote.stepsCount} paso(s). Si el patrocinio está habilitado, se aplica dentro de su presupuesto. Las comisiones del servicio y del Exchange son independientes.</p>
        <form onSubmit={execute}><label>PIN de seguridad<input aria-label="PIN de seguridad" type="password" inputMode="numeric" pattern="[0-9]{6}" autoComplete="off" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} disabled={busy} required/></label>
        <p role="status">{message}</p><small>Referencia: {quote.operationId}</small><div className="operation-actions"><button type="button" onClick={checkStatus} disabled={busy}>Consultar</button><button type="button" onClick={close} disabled={busy}>Cerrar</button><button disabled={busy||pin.length!==6}>{busy?'Comprobando…':'Autorizar'}</button></div></form>
    </section></div>}</>;
}
