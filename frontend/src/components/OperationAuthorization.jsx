import React,{useEffect,useRef,useState} from 'react';
import {registerPinUI,operationRequest} from '../modules/pinOperations.js';
import './OperationAuthorization.css';
export default function OperationAuthorization({children}) {
    const [quote,setQuote]=useState(null),[pin,setPin]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
    const pending=useRef(null),alive=useRef(true);
    const [savedId,setSavedId]=useState(()=>sessionStorage.getItem('winton-operation-id'));
    function clearSaved(){sessionStorage.removeItem('winton-operation-id');setSavedId(null);}
    useEffect(()=>{
        alive.current=true;
        const saved=sessionStorage.getItem('winton-operation-id');
        if(saved)operationRequest(`/${saved}`).then(result=>{
            if(!alive.current)return;
            if(result.success || ['failed','abandoned'].includes(result.state)){clearSaved();return;}
            setQuote(result);setMessage(result.message);
        }).catch(e=>{if(e.status===404){clearSaved();}else setMessage('No se pudo recuperar la operación. Usa Continuar operación para consultarla.');});
        const remove=registerPinUI(async input=>{
            if(pending.current || sessionStorage.getItem('winton-operation-id'))throw new Error('Hay una operación anterior. Recarga para consultar su estado antes de crear otra.');
            const promise=new Promise((resolve,reject)=>{pending.current={resolve,reject};});
            try {const result=await operationRequest('/prepare',input);sessionStorage.setItem('winton-operation-id',result.operationId);setSavedId(result.operationId);setQuote(result);setMessage('Revisa el importe y autoriza con tu frase secreta de autocustodia.');setPin('');}
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
                if(['failed','conflict','abandoned'].includes(result.state))throw new Error(result.message);
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
            pending.current?.resolve(result);pending.current=null;clearSaved();setQuote(null);
        }catch(e){setMessage(e.message);}finally{setBusy(false);}
    }
    async function close(){
        if(busy)return;
        setBusy(true);
        try {
            const current=await operationRequest(`/${quote.operationId}`);
            if(current.success || ['failed','abandoned'].includes(current.state) || (current.requiresSignature&&!current.steps.length))clearSaved();
            if(current.success)pending.current?.resolve(current);
            else pending.current?.reject(new Error('Autorización cerrada. Las transacciones ya enviadas conservan su estado.'));
            pending.current=null;setQuote(null);setPin('');
        }catch(e){setMessage('No se pudo comprobar el estado. Conservamos la referencia: '+e.message);}
        finally{setBusy(false);}
    }
    async function checkStatus(){try{const result=await operationRequest(`/${quote.operationId}`);setMessage(result.message);if(result.success){clearSaved();pending.current?.resolve(result);pending.current=null;setQuote(null);}else setQuote(result);}catch(e){setMessage(e.message);}}
    async function resumeSaved(){try{const id=sessionStorage.getItem('winton-operation-id');if(id){const result=await operationRequest('/'+id);setQuote(result);setMessage(result.message);}}catch(e){if(e.status===404)clearSaved();setMessage(e.message);}}
    async function abandon(){setBusy(true);try{const result=await operationRequest('/'+quote.operationId+'/abandon',{});if(result.state!=='abandoned')throw new Error(result.message);clearSaved();pending.current?.reject(new Error(result.message));pending.current=null;setQuote(null);setMessage(result.message);}catch(e){setMessage(e.message);}finally{setBusy(false);}}
    return <>{children}{!quote&&savedId&&<aside aria-label="Recuperación de operación"><button onClick={resumeSaved}>Continuar operación</button>{message&&<p role="status">{message}</p>}</aside>}{quote&&<div className="operation-backdrop"><section className="operation-dialog" role="dialog" aria-modal="true" aria-labelledby="operation-title">
        <h2 id="operation-title">{quote.title}</h2><p>{quote.amount&&<>Importe: <strong>{quote.amount}</strong><br/></>}Red: {quote.chainId}<br/>Dirección: <span className="operation-address">{quote.destination}</span></p>
        <p>Máximo previsto para la red: {quote.maxNetworkFeeEth} ETH en {quote.stepsCount} paso(s). Si el patrocinio está habilitado, se aplica dentro de su presupuesto. Las comisiones del servicio y del Exchange son independientes.</p>
        <p>Abandonar detiene únicamente los pasos que aún no se firmaron. Una autorización de tokens ya confirmada conserva su efecto.</p><form onSubmit={execute}><label>Frase Secreta de Autocustodia (4 a 6 palabras)<input aria-label="Frase de seguridad" type="password" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" placeholder="ej: escucho musica cuando tengo mucha hambre" value={pin} onChange={e=>setPin(e.target.value)} disabled={busy} required/></label>
        <p role="status">{message}</p><small>Referencia: {quote.operationId}</small><div className="operation-actions"><button type="button" onClick={checkStatus} disabled={busy}>Consultar</button><button type="button" onClick={abandon} disabled={busy||quote.state!=='prepared'}>Abandonar pasos sin firmar</button><button type="button" onClick={close} disabled={busy}>Cerrar</button><button disabled={busy||pin.trim().split(/\s+/).filter(Boolean).length<4||pin.trim().split(/\s+/).filter(Boolean).length>6||['failed','conflict','abandoned'].includes(quote.state)}>{busy?'Comprobando…':'Autorizar'}</button></div></form>
    </section></div>}</>;
}
