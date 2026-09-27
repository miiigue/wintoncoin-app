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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0f172a',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '24px',
          maxWidth: '440px',
          width: '100%',
          padding: '24px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          style={{ position: 'absolute', top: '18px', right: '18px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}
        >
          &times;
        </button>

        <h2 style={{ fontSize: '1.3rem', color: '#fff', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🔥</span> Amortizar Compromiso RED
        </h2>

        <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.4, margin: '0 0 16px 0' }}>
          Al amortizar, se queman tokens BLUE líquidos y se cancela la misma cantidad de tu <strong>compromiso RED</strong> en proporción simétrica 1:1.
        </p>

        <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: '12px', padding: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Saldo BLUE Líquido</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>{liquidBlue}</div>
          </div>
          <div style={{ width: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tu Compromiso RED</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ef4444' }}>{redCommitment}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>
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
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '8px 12px', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '14px' }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, background: 'rgba(255, 255, 255, 0.08)', color: '#cbd5e1', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '10px', borderRadius: '10px', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                color: '#fff',
                border: 'none',
                padding: '10px',
                borderRadius: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Procesando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
