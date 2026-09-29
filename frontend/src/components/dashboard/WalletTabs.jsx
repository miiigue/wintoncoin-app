import React, { useState, useEffect } from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: WalletTabs (React SPA 2026)
 * ============================================================================
 * Tarjeta interactiva de saldos y compromisos con paridad visual 100% legacy:
 * - Pestaña 1 (Impulsor): Saldo BLUE IOU acumulado por misiones y estado de caso SOS.
 * - Pestaña 2 (Billetera):
 *   * Tokens BLUE Líquidos (Activo disponible).
 *   * Tokens BLUE en Parking (Liberación programada con temporizador dinámico).
 *   * Compromiso RED asumido (Vigencia determinista a 30 días, amortización con BLUE).
 *   * Capacidad crediticia disponible.
 *   * Dirección de billetera Web3 con botón de copia rápida.
 * - Tooltips informativos regulatorios y de educación financiera (.info-tooltip)
 *   idénticos carácter por carácter a contract_interaction.html.
 * - Cumplimiento FinTech: Regla terminológica absoluta ("Compromiso RED").
 * ============================================================================
 */
// Helper de formateo numérico con paridad visual bancaria y decimales reducidos en superíndice
function renderBalanceWithDecimals(value) {
  const num = Number(value) || 0;
  const formattedString = num.toLocaleString('es-ES', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
  const parts = formattedString.split(',');
  if (parts.length === 2) {
    return (
      <>
        {parts[0]},<span className="decimal-part">{parts[1]}</span>
      </>
    );
  }
  return formattedString;
}

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
}) {
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [activeTooltip, setActiveTooltip] = useState(null);

  // Actualizador de tiempo en vivo para las cuentas regresivas
  useEffect(() => {
    if (!nextUnlockAt && !nextDueAt) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [nextUnlockAt, nextDueAt]);

  const toggleTooltip = (tooltipId, e) => {
    e.stopPropagation();
    setActiveTooltip(prev => prev === tooltipId ? null : tooltipId);
  };

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

  const handleCopyAddress = async (e) => {
    e.stopPropagation();
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
    } catch (err) {
      console.warn('[WalletTabs] No se pudo copiar dirección al portapapeles:', err);
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
                <span className="booster-total-value" style={{ display: 'block', textAlign: 'center' }}>
                  {renderBalanceWithDecimals(boosterBalance)}
                </span>
                <span
                  className="booster-total-unit"
                  style={{
                    display: 'block',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    fontStyle: 'normal',
                    color: '#10b981',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    textAlign: 'right',
                    marginTop: '0.2rem'
                  }}
                >
                  BLUE IOU
                </span>
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
              style={{ cursor: 'pointer', position: 'relative' }}
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
                      data-tooltip-id="tooltip-disponibles"
                      onClick={(e) => toggleTooltip('tooltip-disponibles', e)}
                    >
                      LIQUIDEZ
                    </span>
                  </span>

                  {/* Tooltip Explicativo BLUE */}
                  <div
                    id="tooltip-disponibles"
                    className={`info-tooltip ${activeTooltip === 'tooltip-disponibles' ? 'show' : ''}`}
                    role="tooltip"
                    aria-hidden={activeTooltip !== 'tooltip-disponibles'}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p>
                      <strong>Los tokens BLUE son tu activo.</strong> Puedes usarlos para pagar servicios, transferirlos o quemarlos para amortizar tu compromiso RED. Al lanzamiento oficial <strong>14-2-2027</strong>, <strong>1 BLUE = 1 USD</strong>.
                    </p>
                  </div>

                  <div className="balance-item">
                    <span id="saldoBlue" className="balance-amount blue-amount">
                      {renderBalanceWithDecimals(liquidBlue)}
                    </span>
                  </div>

                  {parseFloat(parkingBlue) > 0 && (
                    <div id="available-countdown-container" className="countdown-container" style={{ display: 'block', position: 'relative' }}>
                      <p
                        id="available-countdown-text"
                        className="countdown-text info-text-clickable"
                        role="button"
                        tabIndex={0}
                        aria-label="Información sobre próxima liberación"
                        data-tooltip-id="tooltip-proxima-liberacion"
                        onClick={(e) => toggleTooltip('tooltip-proxima-liberacion', e)}
                      >
                        ⏳ En parking: {renderBalanceWithDecimals(parkingBlue)} BLUE {unlockCountdownStr ? `(${unlockCountdownStr})` : ''}
                      </p>

                      {/* Tooltip Explicativo Parking BLUE */}
                      <div
                        id="tooltip-proxima-liberacion"
                        className={`info-tooltip ${activeTooltip === 'tooltip-proxima-liberacion' ? 'show' : ''}`}
                        role="tooltip"
                        aria-hidden={activeTooltip !== 'tooltip-proxima-liberacion'}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p>
                          Tiempo restante para que tus tokens BLUE pendientes se liberen y estén disponibles para usar. Este período de espera protege a ambas partes en las transacciones.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sección RED */}
            <div
              className="balance-section red-section"
              onClick={() => window.location.href = 'estado-cuenta.html'}
              style={{ cursor: 'pointer', position: 'relative' }}
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
                      data-tooltip-id="tooltip-saldo-red-label"
                      onClick={(e) => toggleTooltip('tooltip-saldo-red-label', e)}
                    >
                      Tu compromiso
                    </span>
                  </span>

                  {/* Tooltip Explicativo Compromiso RED */}
                  <div
                    id="tooltip-saldo-red-label"
                    className={`info-tooltip ${activeTooltip === 'tooltip-saldo-red-label' ? 'show' : ''}`}
                    role="tooltip"
                    aria-hidden={activeTooltip !== 'tooltip-saldo-red-label'}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p>
                      <strong>Los tokens RED representan tu compromiso.</strong> Se crean cuando realizas un pago. Gracias a la <strong>Regla Materia-Antimateria</strong>, este compromiso se amortiza automáticamente al recibir tokens BLUE líquidos. Si llegas a la fecha límite sin haberlo amortizado, serás listado en la <strong>página L.O.V.</strong> (Lista de Obligaciones Vencidas).
                    </p>
                  </div>

                  <div className="balance-item">
                    <span id="saldoRed" className="balance-amount red-amount">
                      {renderBalanceWithDecimals(redCommitment)}
                    </span>
                    {/* Solo mostrar DISPONIBLE si el monto es estrictamente mayor a cero */}
                    {parseFloat(availableRedCapacity) > 0 && (
                      <div style={{ marginTop: '5px', fontSize: '0.85rem', color: '#ef4444', fontWeight: 600, letterSpacing: '0.5px' }}>
                        DISPONIBLE: <span id="saldoRedDisponible">{renderBalanceWithDecimals(availableRedCapacity)}</span>
                      </div>
                    )}
                  </div>

                  {nextDueAt && parseFloat(redCommitment) > 0 && dueCountdownStr && (
                    <div id="debt-countdown-container" className="countdown-container" style={{ display: 'block', position: 'relative' }}>
                      <p
                        id="debt-countdown-text"
                        className="countdown-text info-text-clickable"
                        role="button"
                        tabIndex={0}
                        aria-label="Información sobre próximo vencimiento"
                        data-tooltip-id="tooltip-proximo-vencimiento"
                        onClick={(e) => toggleTooltip('tooltip-proximo-vencimiento', e)}
                      >
                        ⏰ Vencimiento de compromiso en: {dueCountdownStr}
                      </p>

                      {/* Tooltip Explicativo Vencimiento Compromiso RED */}
                      <div
                        id="tooltip-proximo-vencimiento"
                        className={`info-tooltip ${activeTooltip === 'tooltip-proximo-vencimiento' ? 'show' : ''}`}
                        role="tooltip"
                        aria-hidden={activeTooltip !== 'tooltip-proximo-vencimiento'}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p>
                          Tiempo restante antes de que tu compromiso RED expire. Recuerda realizar trabajos o tareas remuneradas para recibir tokens BLUE; la aniquilación del compromiso será automática on-chain. Si llegas al límite, serás listado en la <strong>página L.O.V.</strong>.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
