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
    <div className="wallet-tabs-container" style={{ margin: '0 auto 20px auto', maxWidth: '800px' }}>
      {/* Selector de Pestañas (Impulsor vs Billetera) */}
      <div className="wallet-tabs-nav" style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <button
          type="button"
          className={`wallet-tab-btn ${activeTab === 'impulsor' ? 'active' : ''}`}
          onClick={() => onTabChange && onTabChange('impulsor')}
          style={{
            flex: 1,
            padding: '12px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.95rem',
            background: activeTab === 'impulsor' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'rgba(255, 255, 255, 0.05)',
            color: '#fff',
            boxShadow: activeTab === 'impulsor' ? '0 4px 15px rgba(2, 132, 199, 0.4)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          🚀 Impulsor
        </button>
        <button
          type="button"
          className={`wallet-tab-btn ${activeTab === 'billetera' ? 'active' : ''}`}
          onClick={() => onTabChange && onTabChange('billetera')}
          style={{
            flex: 1,
            padding: '12px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.95rem',
            background: activeTab === 'billetera' ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255, 255, 255, 0.05)',
            color: '#fff',
            boxShadow: activeTab === 'billetera' ? '0 4px 15px rgba(16, 185, 129, 0.4)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          💳 Billetera
        </button>
      </div>

      {/* PANEL 1: IMPULSOR */}
      {activeTab === 'impulsor' && (
        <div className="wallet-tab-panel active" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <a
            href="booster-profile.html"
            className="booster-banner"
            style={{
              display: 'block',
              textDecoration: 'none',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '20px',
              padding: '24px',
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
              SALDO DE IMPULSOR
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', textShadow: '0 2px 10px rgba(56, 189, 248, 0.5)' }}>
              {boosterBalance} <span style={{ fontSize: '1.2rem', color: '#38bdf8' }}>BLUE iou</span>
            </div>
            <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#94a3b8' }}>
              Toca para ver tus misiones y recompensas acumuladas →
            </div>
          </a>

          {/* Expediente SOS Venezuela (si el usuario tiene uno registrado) */}
          {sosCase && (
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
          )}
        </div>
      )}

      {/* PANEL 2: BILLETERA */}
      {activeTab === 'billetera' && (
        <div className="wallet-tab-panel active">
          {/* Dirección de Billetera Web3 */}
          {walletAddress && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '50px', padding: '6px 16px', width: 'fit-content', margin: '0 auto 16px auto' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Dirección Web3:</span>
              <code style={{ fontSize: '0.82rem', color: '#38bdf8', fontFamily: 'monospace' }}>{truncatedAddress}</code>
              <button
                type="button"
                onClick={handleCopyAddress}
                style={{ background: 'none', border: 'none', color: copied ? '#10b981' : '#38bdf8', cursor: 'pointer', fontSize: '0.85rem' }}
                title="Copiar dirección"
              >
                {copied ? '✅' : '📋'}
              </button>
            </div>
          )}

          {/* Tarjetas de Saldo Líquido y Compromiso RED */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {/* Sección BLUE (Activo) */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15), rgba(30, 41, 59, 0.8))',
                border: '1px solid rgba(2, 132, 199, 0.35)',
                borderRadius: '20px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '1px' }}>LIQUIDEZ (ACTIVO)</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>1 BLUE = 1 USD</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff' }}>
                  {liquidBlue} <span style={{ fontSize: '1.1rem', color: '#38bdf8' }}>BLUE</span>
                </div>
                {parseFloat(parkingBlue) > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#f59e0b' }}>
                    ⏳ En parking: <strong>{parkingBlue} BLUE</strong>
                    {unlockCountdownStr && (
                      <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '3px' }}>
                        Próxima liberación en: <strong>{unlockCountdownStr}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Link
                  to="/exchange?tab=sell"
                  style={{ flex: 1, minWidth: '120px', textAlign: 'center', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#fff', padding: '8px', borderRadius: '10px', textDecoration: 'none', fontWeight: 700, fontSize: '0.82rem' }}
                >
                  💱 Vender en Exchange
                </Link>
                <a
                  href="estado-cuenta.html"
                  style={{ flex: 1, minWidth: '120px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.08)', color: '#38bdf8', padding: '8px', borderRadius: '10px', textDecoration: 'none', fontWeight: 600, fontSize: '0.82rem' }}
                  title="Ver Estado de Cuenta"
                >
                  📄 Estado de Cuenta
                </a>
              </div>
            </div>

            {/* Sección RED (Compromiso) */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(30, 41, 59, 0.8))',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '20px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ef4444', letterSpacing: '1px' }}>TU COMPROMISO</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Vigencia: 30 días</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff' }}>
                  {redCommitment} <span style={{ fontSize: '1.1rem', color: '#ef4444' }}>RED</span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#10b981' }}>
                  Capacidad disponible: <strong>{availableRedCapacity} RED</strong>
                </div>
                {nextDueAt && parseFloat(redCommitment) > 0 && dueCountdownStr && (
                  <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#f87171' }}>
                    ⏰ Próximo vencimiento de compromiso en: <strong>{dueCountdownStr}</strong>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={onOpenBurnModal}
                  style={{ flex: 1, background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', border: 'none', padding: '8px', borderRadius: '10px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  🔥 Amortizar con BLUE
                </button>
                <Link
                  to="/exchange?tab=buy"
                  style={{ flex: 1, textAlign: 'center', background: 'rgba(255, 255, 255, 0.08)', color: '#cbd5e1', padding: '8px', borderRadius: '10px', textDecoration: 'none', fontWeight: 600, fontSize: '0.82rem' }}
                >
                  Comprar BLUE
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
