import React, { useState } from 'react';
import { getApiUrl } from '../../modules/config';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: BurnModal
 * ============================================================================
 * Modal de amortización / compensación voluntaria de compromisos RED con BLUE:
 * - Permite al usuario quemar tokens BLUE líquidos para reducir su compromiso RED.
 * - Respeta estrictamente la regla de terminología: "Compromiso RED".
 * ============================================================================
 */
export default function BurnModal({
  isOpen,
  onClose,
  liquidBlue = '0.0000',
  redCommitment = '0.0000',
  onBurnSuccess,
}) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const val = parseFloat(amount);
    if (!val || val <= 0) {
      setError('Por favor ingresa un monto válido mayor a 0.');
      return;
    }

    if (val > parseFloat(liquidBlue)) {
      setError(`Monto supera tu saldo líquido disponible (${liquidBlue} BLUE).`);
      return;
    }

    if (val > parseFloat(redCommitment)) {
      setError(`Monto supera tu compromiso RED pendiente (${redCommitment} RED).`);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const username = localStorage.getItem('username');
      const API_URL = getApiUrl();
      const res = await fetch(`${API_URL}/users/burn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ username, amount: val })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al amortizar compromiso.');
      }

      alert(`✅ Operación confirmada: Se amortizaron ${val} BLUE y RED satisfactoriamente.`);
      setAmount('');
      if (onBurnSuccess) onBurnSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Error en la operación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal burn-confirm-modal"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        className="modal-content burn-confirm-content"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="close-button burn-confirm-close"
          style={{ position: 'absolute', top: '16px', right: '16px', cursor: 'pointer', fontSize: '1.5rem', color: '#94a3b8', lineHeight: 1 }}
          onClick={onClose}
        >
          &times;
        </span>

        <div className="burn-confirm-icon">🔥</div>
        <h2 className="burn-confirm-title">Amortizar Compromiso RED</h2>

        <div className="burn-confirm-summary">
          <div className="burn-confirm-label">Saldos Contables</div>
          <div className="burn-confirm-amounts">
            <div className="burn-confirm-amount blue">
              <span className="amount-value">{liquidBlue}</span>
              <span className="amount-label">BLUE LÍQUIDO</span>
            </div>
            <div className="burn-confirm-amount red">
              <span className="amount-value">{redCommitment}</span>
              <span className="amount-label">COMPROMISO RED</span>
            </div>
          </div>
        </div>

        <div className="burn-confirm-warning">
          <span className="warning-icon">⚠️</span>
          <p>
            Al amortizar, se queman tokens BLUE líquidos y se cancela la misma cantidad de tu{' '}
            <strong>compromiso RED</strong> en proporción simétrica 1:1.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px', textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
              Cantidad a amortizar (BLUE):
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Ej: 10.5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              required
              style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                padding: '12px 14px',
                color: '#fff',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '10px 12px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '14px', textAlign: 'left' }}>
              ⚠️ {error}
            </div>
          )}

          <div className="burn-confirm-buttons">
            <button
              type="button"
              className="burn-confirm-btn cancel"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="burn-confirm-btn confirm"
              disabled={loading}
            >
              {loading ? 'Procesando...' : 'Confirmar Quema'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
