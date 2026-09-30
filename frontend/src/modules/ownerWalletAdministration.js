import { BrowserProvider, getAddress } from 'ethers';
import { getApiUrl } from './config.js';

async function request(path, body) {
  const response = await fetch(`${getApiUrl()}/api/admin/web3/owner/${path}`, {
    method: 'POST', credentials: 'include', cache: 'no-store',
    headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) throw new Error(data.message || `No se completó la solicitud (${response.status}).`);
  return data;
}

export async function administerContract(action, input) {
  if (!window.ethereum) throw new Error('Para cambiar el contrato, abre el panel en un navegador con la billetera administrativa.');
  const prepared = await request('prepare', {action, ...input});
  if (!prepared.success) throw new Error(prepared.message || 'No se pudo preparar el cambio.');
  if (prepared.pending) return {pending:true,operationId:prepared.operationId,txHash:prepared.txHash,
    message:'Esta regla ya tiene una operación pendiente. Consulta su estado antes de firmar de nuevo.'};
  const wallet = new BrowserProvider(window.ethereum);
  const signer = await wallet.getSigner();
  const address = await signer.getAddress();
  if (getAddress(address) !== getAddress(prepared.owner)) throw new Error(`La billetera conectada no es la propietaria del contrato. Se requiere ${prepared.owner}.`);
  const network = await wallet.getNetwork();
  if (String(network.chainId) !== String(prepared.chainId)) throw new Error('Selecciona Optimism Sepolia en la billetera administrativa.');
  let tx;
  try { tx = await signer.sendTransaction({to:prepared.to,data:prepared.data,value:0n}); }
  catch(error){throw new Error(`No se confirmó el envío de la billetera. Referencia: ${prepared.operationId}. ${error.shortMessage||error.message||''}`);}
  let result;
  for (let attempt=0;attempt<4;attempt++) {
    try {
      result = await request('confirm', {operationId:prepared.operationId,txHash:tx.hash});
      if (result.success || result.state==='failed' || result.state==='conflict') return result;
    } catch (error) {
      if (attempt===3) return {pending:true,operationId:prepared.operationId,txHash:tx.hash,
        message:`La billetera envió la transacción, pero el servidor aún no pudo verificarla: ${error.message}. Conserva este identificador y consulta el estado.`};
    }
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
  return {...result,pending:true,txHash:tx.hash,message:'Transacción enviada. Falta la confirmación de la red; consulta el estado y no repitas la firma.'};
}
