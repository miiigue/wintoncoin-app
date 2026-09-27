import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: WalletTabs
 * ============================================================================
 * Tarjeta interactiva de saldos y compromisos con paridad visual idéntica:
 * - Pestaña 1 (Impulsor): Saldo BLUE IOU acumulado por misiones y estado de caso SOS.
 * - Pestaña 2 (Billetera):
 *   * Tokens BLUE Líquidos (Activo disponible).
 *   * Tokens BLUE en Parking (Liberación programada).
 *   * Compromiso RED asumido (Vigencia determinista a 30 días, amortización con BLUE).
 *   * Capacidad crediticia disponible.
 *   * Dirección de billetera Web3 con botón de copia rápida.
 * 
 * Regla de Oro:
 * - CERO mención a la palabra prohibida; siempre se utiliza "Compromiso RED".
 * ============================================================================
 */
export default function WalletTabs({
  activeTab = 'impulsor',
  onTabChange,
  boosterBalance = '0',
  liquidBlue = '0.0000',
  parkingBlue = '0.0000',
  redCommitment = '0.0000',
  availableRedCapacity = '0.0000',
  walletAddress = '',
  sosCase = null,
  nextUnlockAt = null,
  nextUnlockAmount = null,
  nextDueAt = null,
  nextDueAmount = null,
  onOpenBurnModal,
}) {
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Actualizador de tiempo en vivo para las cuentas regresivas
  useEffect(() => {
    if (!nextUnlockAt && !nextDueAt) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [nextUnlockAt, nextDueAt]);

  const formatCountdown = (targetDate) => {
    if (!targetDate) return null;
    const targetTime = new Date(targetDate).getTime();
    if (isNaN(targetTime)) return null;
    const diff = targetTime - now;
    if (diff <= 0) return '¡Tiempo cumplido!';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(walletAddress);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = walletAddress;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('[WalletTabs] No se pudo copiar dirección al portapapeles:', e);
    }
  };

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`
    : 'No asignada';

  const unlockCountdownStr = formatCountdown(nextUnlockAt);
  const dueCountdownStr = formatCountdown(nextDueAt);

  return (
    <div className="wallet-tabs-container">
      {/* Selector de Pestañas (Impulsor vs Billetera) - Clases legacy de style.css */}
      <div className="wallet-tabs-nav">
        <button
          type="button"
          className={`wallet-tab-btn ${activeTab === 'impulsor' ? 'active' : ''}`}
          data-tab="impulsor"
          id="tabImpulsor"
          onClick={() => onTabChange && onTabChange('impulsor')}
        >
          Impulsor
        </button>
        <button
          type="button"
          className={`wallet-tab-btn ${activeTab === 'billetera' ? 'active' : ''}`}
          data-tab="billetera"
          id="tabBilletera"
          onClick={() => onTabChange && onTabChange('billetera')}
        >
          Billetera
        </button>
      </div>

      {/* PANEL 1: IMPULSOR */}
      {activeTab === 'impulsor' && (
        <div className="wallet-tab-panel active" id="panelImpulsor" data-panel="impulsor">
          <a id="boosterSummary" className="booster-banner" href="booster-profile.html">
            <div className="booster-banner-header">
              <span className="booster-banner-title">SALDO DE IMPULSOR</span>
            </div>
            <div className="booster-banner-body">
              <div id="boosterTotalBlue" className="booster-amount">
                {boosterBalance} BLUE iou
              </div>
            </div>
          </a>

          {/* Expediente SOS Venezuela si existe */}
          {sosCase && (
            <div id="sos-my-case-dashboard" style={{ marginTop: '12px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '16px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.9rem' }}>🚨 Mi Expediente SOS Venezuela</span>
                  <span style={{ background: sosCase.status === 'approved' ? '#dcfce7' : '#fef3c7', color: sosCase.status === 'approved' ? '#166534' : '#92400e', padding: '3px 8px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 700 }}>
                    {sosCase.status === 'approved' ? 'Aprobado' : 'En Verificación'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  {sosCase.state}, {sosCase.municipality} — {sosCase.beneficiaries || 1} persona(s) a cargo
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PANEL 2: BILLETERA */}
      {activeTab === 'billetera' && (
        <div className="wallet-tab-panel active" id="panelBilletera" data-panel="billetera">
          {/* Contenedor de Dirección de Billetera Web3 */}
          {walletAddress && (
            <div
              id="myWalletAddressContainer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                background: 'rgba(0,0,0,0.25)',
                padding: '6px 14px',
                borderRadius: '50px',
                border: '1px solid rgba(255,255,255,0.05)',
                width: 'fit-content',
                margin: '0 auto 20px auto',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
              <span id="myWalletAddressText" style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '13px', color: '#e2e8f0', marginRight: '10px', fontWeight: 'normal', letterSpacing: '0.5px' }}>
                {truncatedAddress}
              </span>
              <button
                id="copyMyWalletBtn"
                type="button"
                onClick={handleCopyAddress}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#10b981' : '#4da6ff', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}
                title="Copiar dirección"
              >
                {copied ? (
                  <span style={{ fontSize: '12px' }}>✓</span>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                )}
              </button>
            </div>
          )}

          {/* Tarjetas de Saldo Líquido y Compromiso RED con clases legacy .balances-container */}
          <div className="balances-container">
            {/* Sección BLUE */}
            <div
              className="balance-section blue-section"
              onClick={() => window.location.href = 'estado-cuenta.html'}
              style={{ cursor: 'pointer' }}
              title="Ver Estado de Cuenta"
            >
              <div className="balance-items">
                <div className="balance-item-wrapper">
                  <span className="balance-label">
                    <span
                      className="info-text-clickable"
                      role="button"
                      tabIndex={0}
                      aria-label="Información sobre Liquidez"
                    >
                      LIQUIDEZ
                    </span>
                  </span>
                  <div className="balance-item">
                    <span id="saldoBlue" className="balance-amount blue-amount">{liquidBlue}</span>
                  </div>
                  {parseFloat(parkingBlue) > 0 && (
                    <div id="available-countdown-container" className="countdown-container" style={{ display: 'block' }}>
                      <p id="available-countdown-text" className="countdown-text info-text-clickable">
                        ⏳ En parking: {parkingBlue} BLUE {unlockCountdownStr ? `(${unlockCountdownStr})` : ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sección RED */}
            <div
              className="balance-section red-section"
              onClick={() => window.location.href = 'estado-cuenta.html'}
              style={{ cursor: 'pointer' }}
              title="Ver Estado de Cuenta"
            >
              <div className="balance-items red-balance-items">
                <div className="balance-item-wrapper red-balance-wrapper">
                  <span className="balance-label">
                    <span
                      className="info-text-clickable"
                      role="button"
                      tabIndex={0}
                      aria-label="Información sobre Compromiso"
                    >
                      Tu compromiso
                    </span>
                  </span>
                  <div className="balance-item">
                    <span id="saldoRed" className="balance-amount red-amount">{redCommitment}</span>
                    <div style={{ marginTop: '5px', fontSize: '0.85rem', color: '#ef4444', fontWeight: 600, letterSpacing: '0.5px' }}>
                      DISPONIBLE: <span id="saldoRedDisponible">{availableRedCapacity}</span>
                    </div>
                  </div>
                  {nextDueAt && parseFloat(redCommitment) > 0 && dueCountdownStr && (
                    <div id="debt-countdown-container" className="countdown-container" style={{ display: 'block' }}>
                      <p id="debt-countdown-text" className="countdown-text info-text-clickable">
                        ⏰ Vencimiento de compromiso en: {dueCountdownStr}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Botón Quemar / Amortizar Voluntariamente (.burn-item legacy de style.css) */}
          <div className="burn-item" style={{ textAlign: 'center' }}>
            <button
              className="burn-trigger"
              type="button"
              onClick={onOpenBurnModal}
              title="Amortizar compromiso con tokens BLUE"
            >
              <span className="fire-icon">🔥</span> Amortizar con BLUE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
