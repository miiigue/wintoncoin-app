import React, { useState } from 'react';
import { getApiUrl } from '../../modules/config';
import { showCustomAlert } from '../../modules/alerts';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: QuickSaleModal (React SPA 2026)
 * ============================================================================
 * Generador interactivo de cobros directos y códigos QR (⚡ Venta Rápida):
 * - Permite generar órdenes de pago instantáneas en tokens BLUE.
 * - Soporta tanto cobros abiertos como dirigidos a un comprador específico.
 * - Renderiza el código QR scannable al instante para teléfonos móviles.
 * - Proporciona enlace compartible con botón de copia en un toque.
 * ============================================================================
 */
export default function QuickSaleModal({
  isOpen,
  onClose,
  username = '',
}) {
  const [step, setStep] = useState('form'); // 'form' | 'qr'
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [targetUsername, setTargetUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('form');
    setAmount('');
    setTitle('');
    setTargetUsername('');
    setGeneratedUrl('');
    setCopied(false);
    setIsSubmitting(false);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanAmount = amount.replace(',', '.').trim();
    if (!cleanAmount || isNaN(cleanAmount) || parseFloat(cleanAmount) <= 0) {
      showCustomAlert('Por favor introduce un monto válido en tokens BLUE.');
      return;
    }

    setIsSubmitting(true);
    try {
      const API_URL = getApiUrl();
      const token = localStorage.getItem('token');
      const author = username || localStorage.getItem('username');

      const res = await fetch(`${API_URL}/api/quick-sale`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          amount: cleanAmount,
          title: title.trim() || undefined,
          targetUsername: targetUsername.trim() || undefined,
          authorUsername: author
        })
      });

      const data = await res.json();
      if (res.ok && data.publicationId) {
        const fullUrl = `${window.location.origin}/publication-detail.html?id=${data.publicationId}`;
        setGeneratedUrl(fullUrl);
        setStep('qr');
      } else {
        showCustomAlert(data.message || 'Error al generar la orden de venta rápida.');
      }
    } catch (err) {
      console.error('[QuickSaleModal] Error al crear venta rápida:', err);
      showCustomAlert('Error de conexión al procesar la venta rápida.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {
      // Fallback
      showCustomAlert(`Enlace de cobro: ${generatedUrl}`);
    }
  };

  const qrImageUrl = generatedUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(generatedUrl)}`
    : '';

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
        zIndex: 10000,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleReset();
      }}
    >
      <div
        style={{
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '28px',
          maxWidth: '460px',
          width: '100%',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
          position: 'relative',
          color: '#fff'
        }}
      >
        {/* Botón Cerrar */}
        <button
          type="button"
          onClick={handleReset}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '1.5rem',
            cursor: 'pointer',
            lineHeight: 1
          }}
          aria-label="Cerrar"
        >
          &times;
        </button>

        {step === 'form' ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>⚡</span>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#fff' }}>
                Venta Rápida
              </h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 20px 0', lineHeight: 1.4 }}>
              Crea un cobro directo con un enlace de pago único y código QR. Ideal para transacciones cara a cara o ventas inmediatas.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8', marginBottom: '6px' }}>
                  Monto a cobrar (BLUE) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="Ej: 50.0000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    color: '#fff',
                    fontSize: '1rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Título / Concepto (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Pago por almuerzo o servicio"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Comprador específico (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: juan_perez"
                  value={targetUsername}
                  onChange={(e) => setTargetUsername(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <small style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: '#94a3b8' }}>
                  Si lo dejas en blanco, cualquier persona con el código podrá escanearlo y pagarte.
                </small>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.2s',
                  opacity: isSubmitting ? 0.7 : 1
                }}
              >
                {isSubmitting ? 'Generando orden...' : '⚡ Generar QR de Cobro'}
              </button>
            </form>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 6px 0', color: '#fff' }}>
              ¡Listo para cobrar!
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 16px 0' }}>
              Pide al comprador que escanee este código o comparte el enlace.
            </p>

            {/* Código QR */}
            <div
              style={{
                background: '#fff',
                padding: '12px',
                borderRadius: '16px',
                width: 'fit-content',
                margin: '0 auto 16px auto',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)'
              }}
            >
              <img
                src={qrImageUrl}
                alt="Código QR de Cobro"
                style={{ width: '220px', height: '220px', display: 'block' }}
              />
            </div>

            {/* Enlace en texto y botón de copia */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                readOnly
                value={generatedUrl}
                style={{
                  flex: 1,
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  color: '#cbd5e1',
                  fontSize: '0.8rem',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={handleCopyLink}
                style={{
                  background: copied ? '#10b981' : '#38bdf8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                {copied ? '✅ ¡Copiado!' : '📋 Copiar'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleReset}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                padding: '10px 20px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Finalizar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
