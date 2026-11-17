import React, { useState } from 'react';
import { BrowserProvider, Contract, Interface, getAddress } from 'ethers';
import { getApiUrl } from '../modules/config.js';

// The backend must explicitly advertise readiness after validating Demo,
// prelaunch policy, the pinned candidate and the owner. Absence fails closed.
export default function V6ModeActivation({ candidate, onVerified }) {
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(() => {
    try { return JSON.parse(window.sessionStorage.getItem('winton_v6_demo_pending') || 'null'); }
    catch { return null; }
  });
  const demo = ['demo.wintoncoin.com', 'www.demo.wintoncoin.com'].includes(window.location.hostname);
  const ready = demo && candidate?.configured === true && candidate?.mode === 'PRELAUNCH_FROZEN'
    && candidate?.activationReady === true && candidate?.chainId === '11155420';
  async function post(path, body) {
    const response = await fetch(`${getApiUrl()}/api/admin/web3/v6-mode/${path}`, {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (result.pending === true) return result;
    if (!response.ok || result.success !== true) throw new Error(result.message || 'No se pudo verificar la operación.');
    return result;
  }
  async function reconcile(reference) {
    const result = await post('confirm', {operationId: reference.operationId, txHash: reference.txHash});
    if (result.pending === true) throw new Error('La operación sigue pendiente de confirmación.');
    if (result.state !== 'confirmed' || result.mode !== 'NORMAL') throw new Error('La operación aún no está confirmada como activa.');
    window.sessionStorage.removeItem('winton_v6_demo_pending'); setPending(null);
    setMessage(`V6 activada y verificada en Demo. Transacción: ${reference.txHash}`);
    setConfirmation(''); onVerified?.();
  }
  async function recover() {
    if (!demo || !pending || busy) return;
    setBusy(true);
    try { await reconcile(pending); }
    catch (error) { setMessage(`No se pudo confirmar ${pending.txHash}. No repitas la firma. ${error.message}`); }
    finally { setBusy(false); }
  }
  async function activate() {
    if (!ready || busy || pending || confirmation !== 'ACTIVAR V6 DEMO') return;
    setBusy(true); setMessage('Verificando las condiciones de Demo…');
    let sentHash;
    try {
      if (!window.ethereum) throw new Error('Conecta la billetera propietaria de Demo.');
      const prepared = await post('prepare', {});
      const controller = getAddress(candidate.contracts.ProtocolModeController);
      if (String(prepared.chainId) !== '11155420' || getAddress(prepared.to) !== controller)
        throw new Error('La red o el contrato no corresponden al candidato verificado.');
      const expected = new Interface(['function setMode(uint8)']).encodeFunctionData('setMode', [0]);
      if (String(prepared.data).toLowerCase() !== expected.toLowerCase()) throw new Error('La operación preparada no corresponde a la activación V6.');
      if (!prepared.operationId) throw new Error('Falta la referencia de la operación.');
      const provider = new BrowserProvider(window.ethereum);
      if (String((await provider.getNetwork()).chainId) !== '11155420') throw new Error('Selecciona Optimism Sepolia en la billetera.');
      const signer = await provider.getSigner();
      const owner = await new Contract(controller, ['function owner() view returns(address)', 'function mode() view returns(uint8)'], provider).owner();
      const currentMode = await new Contract(controller, ['function mode() view returns(uint8)'], provider).mode();
      if (getAddress(owner) !== getAddress(prepared.owner) || getAddress(owner) !== getAddress(await signer.getAddress()))
        throw new Error('La billetera conectada no es la propietaria verificada.');
      if (currentMode !== 1n) throw new Error('El contrato ya no está en Prelanzamiento congelado.');
      setMessage('Confirma la operación en la billetera propietaria.');
      const tx = await signer.sendTransaction({ to: controller, data: expected, value: 0n });
      sentHash = tx.hash;
      const reference = {operationId: prepared.operationId, txHash: sentHash};
      setPending(reference);
      window.sessionStorage.setItem('winton_v6_demo_pending', JSON.stringify(reference));
      setMessage(`Transacción enviada: ${sentHash}. Verificando; no repitas la firma.`);
      await reconcile(reference);
    } catch (error) {
      setMessage(sentHash ? `No se pudo confirmar ${sentHash}. No repitas la firma; consulta su estado. ${error.message}` : error.message);
    } finally { setBusy(false); }
  }
  if (!demo) return null;
  if (candidate?.mode === 'NORMAL') {
    return <section aria-label="Activación V6 Demo" style={{ padding: '1rem', backgroundColor: '#064e3b', borderRadius: '0.5rem', color: '#ecfdf5', marginTop: '0.75rem', border: '1px solid #059669' }}>
      <h3 style={{ margin: '0 0 0.5rem 0', color: '#34d399' }}>✓ Suite V6 Activa en Demo</h3>
      <p style={{ margin: 0 }}>El protocolo V6 está confirmado y operando en modo <strong>NORMAL</strong> en Optimism Sepolia.</p>
      {pending && <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
        Transacción registrada: <code>{pending.txHash}</code>. <button type="button" disabled={busy} onClick={recover} style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>Conciliar estado local</button>
      </p>}
      {message && <p role="status" aria-live="polite" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>{message}</p>}
    </section>;
  }
  return <section aria-label="Activación V6 Demo">
    <h3>Activación V6 Demo</h3>
    <p>Mantén Prelanzamiento encendido durante la firma. Espera la confirmación en blockchain antes de cambiar el switch.</p>
    {!ready && <p>{candidate?.activationMessage || 'La activación está pendiente de verificación.'}</p>}
    <label>Escribe ACTIVAR V6 DEMO para confirmar
      <input value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={!ready || busy || !!pending} />
    </label>
    <button type="button" onClick={activate} disabled={!ready || busy || !!pending || confirmation !== 'ACTIVAR V6 DEMO'}>Preparar activación V6</button>
    {pending && <p>Operación pendiente: {pending.txHash}. <button type="button" disabled={busy} onClick={recover}>Consultar confirmación</button></p>}
    {message && <p role="status" aria-live="polite">{message}</p>}
  </section>;
}
