import React, {useEffect, useRef} from 'react';
import './WalletNotice.css';

export default function WalletNotice({message, onClose, onBackup}) {
  const dialog=useRef(null);
  useEffect(()=>{const element=dialog.current;element.showModal();return ()=>element.close();},[]);
  return <dialog ref={dialog} className="wallet-notice" aria-labelledby="wallet-notice-title" aria-describedby="wallet-notice-message" onCancel={onClose}>
    <h2 id="wallet-notice-title">No se pudo completar la operación</h2>
    <p id="wallet-notice-message">{message}</p>
    <p>Si necesitas activar tu cuenta o guardar el respaldo, puedes hacerlo desde Seguridad y recuperación.</p>
    <div className="wallet-notice-actions">
      <button type="button" onClick={onBackup}>Configurar respaldo</button>
      <button type="button" onClick={onClose}>Volver a mi billetera</button>
    </div>
  </dialog>;
}
