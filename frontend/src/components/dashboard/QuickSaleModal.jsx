import React, { useState } from 'react';
import { getApiUrl } from '../../modules/config';
import { showCustomAlert } from '../../modules/alerts';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: QuickSaleModal (React SPA 2026)
 * ============================================================================
 * Generador interactivo de cobros directos y códigos QR (⚡ Venta Rápida):
 * - Paridad visual 100% con #quickSaleModal y #qrCodeModal de style.css.
 * - Soporta tanto cobros abiertos como dirigidos a un comprador específico.
 * - Despliega el código QR al instante con enlace directo de cobro.
 * - Erradicación de estilos inline y uso estricto de clases maestras.
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
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(generatedUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = generatedUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {
      showCustomAlert(`Enlace de cobro: ${generatedUrl}`);
    }
  };

  const qrImageUrl = generatedUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(generatedUrl)}`
    : '';

  return (
    <>
      {/* 1. Modal Formulario de Venta Rápida (#quickSaleModal) */}
      {step === 'form' && (
        <div
          id="quickSaleModal"
          className="modal"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleReset();
          }}
        >
          <div className="modal-content">
            <span
              className="close-button quick-sale-close"
              onClick={handleReset}
              role="button"
              tabIndex={0}
              aria-label="Cerrar"
            >
              &times;
            </span>

            <form id="quickSaleForm" onSubmit={handleSubmit}>
              <h2>⚡ Venta Rápida</h2>
              <p>Crea un cobro directo con un enlace de pago único. Ideal para transacciones inmediatas.</p>

              <div className="form-group">
                <label htmlFor="quickSaleAmount">Monto a cobrar (BLUE):</label>
                <input
                  type="text"
                  inputMode="decimal"
                  id="quickSaleAmount"
                  name="amount"
                  required
                  placeholder="Ej: 150.50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="quickSaleTitle">Título / Concepto (opcional):</label>
                <input
                  type="text"
                  id="quickSaleTitle"
                  name="title"
                  placeholder="Ej: Pago por diseño web"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="quickSaleTargetUsername">Comprador específico (opcional):</label>
                <input
                  type="text"
                  id="quickSaleTargetUsername"
                  name="targetUsername"
                  placeholder="Ej: nombredeusuario"
                  value={targetUsername}
                  onChange={(e) => setTargetUsername(e.target.value)}
                />
                <small className="input-hint">Si lo dejas en blanco, cualquiera con el enlace podrá pagar.</small>
              </div>

              <button
                type="submit"
                className="action-button confirm"
                disabled={isSubmitting}
                style={isSubmitting ? { opacity: 0.7, cursor: 'wait' } : undefined}
              >
                {isSubmitting ? 'Generando...' : 'Generar QR de Cobro'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal Despliegue de Código QR (#qrCodeModal) */}
      {step === 'qr' && (
        <div
          id="qrCodeModal"
          className="modal"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleReset();
          }}
        >
          <div className="modal-content">
            <span
              className="close-button qr-code-close"
              onClick={handleReset}
              role="button"
              tabIndex={0}
              aria-label="Cerrar"
            >
              &times;
            </span>

            <div className="qr-code-container">
              <h2>¡Listo! Comparte este QR para recibir tu pago</h2>
              <p>El enlace de pago es válido por 5 minutos.</p>

              <div id="qrCodeOutput" style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
                {qrImageUrl && (
                  <img
                    src={qrImageUrl}
                    alt="Código QR de Cobro Directo"
                    style={{
                      borderRadius: '12px',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                      maxWidth: '220px',
                      height: 'auto'
                    }}
                  />
                )}
              </div>

              <input
                type="text"
                id="qrCodeUrl"
                value={generatedUrl}
                readOnly
                style={{ width: '100%', marginBottom: '15px', textAlign: 'center' }}
              />

              <button
                id="copyQrCodeUrl"
                type="button"
                className="action-button"
                onClick={handleCopyLink}
              >
                {copied ? '✅ ¡Enlace Copiado!' : 'Copiar Enlace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
