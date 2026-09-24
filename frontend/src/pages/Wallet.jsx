import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import mockFinancialService from '../modules/mockFinancialService';
import styles from './Wallet.module.css';
import { displayAmount, DAY } from '../modules/financialUnits.js';
import { mockExchangeService } from '../modules/mockExchangeService.js';

/**
 * ============================================================================
 * [WINTONCOIN] - BILLETERA FINTECH REACT (Wallet.jsx)
 * ============================================================================
 * Pantalla central de la Billetera WintonCoin con arquitectura 2026:
 * - Demostración local; conexión real de cuentas pendiente.
 * - Desglose visual en tiempo real de Saldo Líquido vs Saldo en Parking (30d).
 * - Compensación en 1 Toque (Ruta A) con consumo de lotes por antigüedad.
 * - Desglose justo de garantías USDT (Pignorado vs Libre para Retiro).
 * - Estatus y recompensas del Club Winton en BLUE IOU.
 * ============================================================================
/**
 * Helper canónico para formatear siempre con 4 decimales en interfaces financieras
 */
const fmt = displayAmount;

function Wallet() {
  const [data, setData] = useState(() => mockFinancialService.getCalculatedState());
  const [modalType, setModalType] = useState(null); // 'routeA', 'withdrawUsdt', 'depositUsdt', 'extension'
  const [amountInput, setAmountInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Estados para el beneficio de Prórroga Nivel 3+
  const [extensionDays, setExtensionDays] = useState(30);
  const [extensionQuote, setExtensionQuote] = useState(null);

  // Suscripción reactiva al motor financiero y validación de sesión
  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    if (!token && !username) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login.html?returnTo=${returnTo}`);
      return;
    }

    const unsubscribe = mockFinancialService.subscribe((updatedState) => {
      setData(updatedState);
    });
    const timer = setInterval(() => setData(mockFinancialService.getCalculatedState()), 1000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, []);

  // Utilidad para mostrar notificaciones toast
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Manejo de la acción (Compensar compromiso con saldo ganado en tareas)
  const handleRepayRouteA = async () => {
    try {
      setLoading(true);
      const res = await mockFinancialService.repayWithRouteA(amountInput);
      setModalType(null);
      setAmountInput('');
      showToast(
        `Compensación simulada: se quemó la misma cantidad de BLUE y RED.`
      );
    } catch (err) {
      alert(err.message || 'Error al procesar la compensación');
    } finally {
      setLoading(false);
    }
  };

  // Manejo del Retiro de USDT Libre
  const handleWithdrawUsdt = async () => {
    try {
      setLoading(true);
      await mockFinancialService.withdrawFreeUsdt(amountInput);
      setModalType(null);
      setAmountInput('');
      showToast('💸 Retiro de USDT completado hacia tu billetera');
    } catch (err) {
      alert(err.message || 'Error al retirar USDT');
    } finally {
      setLoading(false);
    }
  };

  // Manejo del Depósito de USDT (1 Toque ERC-4337)
  const handleDepositUsdt = async () => {
    try {
      setLoading(true);
      await mockFinancialService.depositUsdt(amountInput);
      setModalType(null);
      setAmountInput('');
      showToast('🚀 Depósito completado en 1 solo toque (Gas patrocinado $0.00)');
    } catch (err) {
      alert(err.message || 'Error al depositar USDT');
    } finally {
      setLoading(false);
    }
  };

  // Manejo de la Solicitud de Prórroga de Compromiso (Beneficio Nivel 3+)
  const handleRequestExtension = async () => {
    try {
      setLoading(true);
      const res = await mockFinancialService.requestCommitmentExtension(extensionQuote);
      setModalType(null);
      showToast(`⏳ Prórroga concedida (+${fmt(res.feeAmount)} RED). Nuevo plazo: ${res.newDaysRemaining} días.`);
    } catch (err) {
      alert(err.message || 'Error al solicitar la prórroga');
    } finally {
      setLoading(false);
    }
  };

  // Manejo del Reinicio de la Simulación Demo
  const handleResetDemo = () => {
    mockFinancialService.resetToDefault();
    showToast('🔄 Simulación reiniciada a sus valores originales');
  };

  const { user, blue, credit, collateral, computed, transactions } = data;

  const activeCommitments = credit.lots.filter((lot) => lot.remaining > 0);
  const selectedCommitment = activeCommitments.find((lot) => lot.id === extensionQuote?.lotId);
  const refreshQuote = (id, days) => {
    try { setExtensionDays(days); setExtensionQuote(mockFinancialService.quoteExtension(id, days)); }
    catch (error) { setExtensionQuote(null); showToast(error.message); }
  };
  const openExtension = () => {
    const lot = activeCommitments.find((entry) => entry.extensionCount < 2 && entry.dueAt > mockFinancialService.now());
    if (!lot || !data.policy.extensionOptions.length) { showToast('No hay compromisos elegibles o plazos habilitados.'); return; }
    refreshQuote(lot.id, data.policy.extensionOptions[0].days);
    setModalType('extension');
  };
  const nextExtensionAt = selectedCommitment?.firstExtendedAt == null ? 0
    : selectedCommitment.firstExtendedAt + data.policy.extensionCooldownDays * DAY;
  const waiting = nextExtensionAt > mockFinancialService.now();
  const extensionUnavailable = !selectedCommitment || selectedCommitment.extensionCount >= 2
    || selectedCommitment.dueAt <= mockFinancialService.now() || credit.overdueDebtRed > 0 || waiting;

  return (
    <div className={styles.walletContainer}>
      <div className={styles.walletWrapper}>
        <p role="status">Demostración local: estos saldos y operaciones no son transacciones en blockchain.</p>
        
        {/* ENCABEZADO DE USUARIO & ESTATUS DEL CLUB */}
        <div className={styles.userHeader}>
          <div className={styles.userInfo}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%', flexWrap: 'wrap' }}>
              <h2 className={styles.userName}>{user.name}</h2>
              <button
                onClick={handleResetDemo}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#94a3b8',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                }}
                title="Reiniciar balances y transacciones del simulador"
              >
                🔄 Reiniciar Datos
              </button>
            </div>
            <div className={styles.smartAccountTag}>
              <span>Smart Account:</span>
              <code>{user.smartAccountAddress}</code>
            </div>
          </div>
          <div className={styles.clubBadge}>
            <span>{user.clubMembership}</span>
          </div>
        </div>

        {/* HERO CARD: SALDO TOTAL BLUE & DESGLOSE */}
        <div className={styles.heroCard}>
          <div className={styles.heroHeader}>
            <span className={styles.heroLabel}>Saldo Total</span>
            <span className={styles.gasQuotaBadge}>
              ⚡ {computed.gasTxsRemaining} Tx Gratis hoy
            </span>
          </div>
          <div className={styles.mainBalance}>
            <img
              src="/assets/icons/icon-64x64.png"
              alt="BLUE"
              style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'contain', marginRight: '0.65rem' }}
            />
            <span>
              {fmt(computed.totalBlueBalance)} <span style={{ fontSize: '1.4rem', color: '#94a3b8' }}>BLUE</span>
            </span>
          </div>
          <div className={styles.balanceSubrow}>
            <div>
              <span className={styles.subItemLabel}>Disponible (Líquido)</span>
              <span className={`${styles.subItemValue} ${styles.unlockedColor}`}>
                {fmt(blue.unlocked)} BLUE
              </span>
            </div>
            <div>
              <span className={styles.subItemLabel}>BLUE en Parking</span>
              <span className={`${styles.subItemValue} ${styles.parkingColor}`}>
                {fmt(computed.totalParkingBlue)} BLUE
              </span>
            </div>
          </div>
        </div>

        {/* ACCESOS DIRECTOS AL EXCHANGE FIFO */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <Link
            to="/exchange.html?tab=sell"
            style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              color: '#ffffff',
              padding: '0.85rem 0.5rem',
              borderRadius: '16px',
              textAlign: 'center',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              boxShadow: '0 4px 15px rgba(14, 165, 233, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            <span>💱</span> Vender en Exchange
          </Link>
          <Link
            to="/exchange.html?tab=buy"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#ffffff',
              padding: '0.85rem 0.5rem',
              borderRadius: '16px',
              textAlign: 'center',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              boxShadow: '0 4px 15px rgba(59, 130, 246, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            <span>🛒</span> Comprar BLUE
          </Link>
        </div>

        {/* ACCIÓN RÁPIDA: COMPENSAR COMPROMISO CON SALDO GANADO (EN 1 TOQUE) */}
        {credit.debtRed > 0 && computed.totalParkingBlue > 0 && (
          <div className={styles.routeABanner}>
            <div className={styles.routeATitleRow}>
              <span className={styles.routeATitle}>
                ⚡ Compensar Compromiso con mis Ganancias
              </span>
            </div>
            <p className={styles.routeADesc}>
              Tienes un compromiso de <strong>{fmt(credit.debtRed)} RED</strong>. Puedes amortizarlo usando tu saldo ganado en tareas sin gastar de tu bolsillo.
            </p>
            <button
              className={styles.btnRouteA}
              onClick={() => {
                setAmountInput(Math.min(credit.debtRed, computed.totalParkingBlue).toString());
                setModalType('routeA');
              }}
            >
              Compensar Compromiso en 1 Toque
            </button>
          </div>
        )}

        {/* SECCIÓN DE COMPROMISO Y LÍMITE RED */}
        <div className={styles.creditCard}>
          <div className={styles.sectionTitle}>
            <span>Compromiso y Límite RED</span>
            <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Nivel {user.tierLevel} ({user.tierName})</span>
          </div>
          <div className={styles.creditGrid}>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>Compromiso RED</div>
              <div className={`${styles.creditBoxValue} ${styles.debtColor}`}>
                {fmt(credit.debtRed)} RED
              </div>
            </div>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>Límite RED Aprobado</div>
              <div className={`${styles.creditBoxValue} ${styles.limitColor}`}>
                {fmt(credit.effectiveLimitRed)} RED
              </div>
            </div>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>RED Disponible</div>
              <div className={`${styles.creditBoxValue} ${styles.unlockedColor}`}>
                {fmt(computed.availableCreditCapacity)} RED
              </div>
            </div>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>Vencimiento</div>
              <div className={styles.creditBoxValue} style={{ color: '#fbbf24', fontSize: '0.92rem' }}>
                {credit.debtRed > 0
                  ? `${fmt(credit.dueAmountRed || credit.debtRed)} RED en ${credit.daysUntilDue} días`
                  : 'Al día'}
              </div>
            </div>
          </div>

        </div>

        {user.tierLevel >= 3 && credit.debtRed > 0 && (
          <div className={styles.collateralCard}>
            <h3>Prórroga de un compromiso</h3>
            <p>Disponible desde el nivel 3. Niveles 3 y 4: necesitas capacidad para el recargo.
              Desde el nivel 5 puede habilitarse un margen exclusivo para recargos.</p>
            <button className={styles.btnSecondary} onClick={openExtension} disabled={credit.overdueDebtRed > 0 || loading}>
              Elegir compromiso y ver costo
            </button>
          </div>
        )}

        {/* SECCIÓN DE GARANTÍAS USDT (BÓVEDA DE COLATERAL) */}
        <div className={styles.collateralCard}>
          <div className={styles.sectionTitle}>
            <span>Bóveda de Garantías (USDT)</span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total: {fmt(collateral.totalDepositedUsdt)} USDT</span>
          </div>
          <div className={styles.creditGrid}>
            <div className={styles.creditBox}>
              <button type="button" className={styles.btnSecondary} onClick={() => setModalType('amortizationQueue')}>Reservado</button>
              <div className={styles.creditBoxValue} style={{ color: '#f87171' }}>
                {fmt(computed.pignoratedUsdt)} USDT
              </div>
            </div>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>Disponible para Retiro</div>
              <div className={`${styles.creditBoxValue} ${styles.unlockedColor}`}>
                {fmt(computed.freeUsdtToWithdraw)} USDT
              </div>
            </div>
          </div>
          <div className={styles.collateralActions}>
            <button
              className={styles.btnSecondary}
              disabled={computed.freeUsdtToWithdraw <= 0}
              onClick={() => {
                setAmountInput(computed.freeUsdtToWithdraw.toString());
                setModalType('withdrawUsdt');
              }}
            >
              Retirar USDT Libre
            </button>
            <button
              className={styles.btnSuccess}
              onClick={() => {
                setAmountInput('50');
                setModalType('depositUsdt');
              }}
            >
              + Depositar USDT (1-Toque)
            </button>
          </div>
        </div>

        {/* SECCIÓN BLUE EN PARKING */}
        <div className={styles.parkingTrackerCard}>
          <div className={styles.sectionTitle}>
            <span>BLUE en Parking</span>
          </div>
          <div className={styles.lotsList}>
            {blue.parkingLots.map((lot) => {
              const progressPercent = Math.min(100, Math.max(0, ((30 - lot.daysRemaining) / 30) * 100));
              return (
                <div key={lot.id} className={styles.lotItem}>
                  <div className={styles.lotHeader}>
                    <span className={styles.lotTitle}>{lot.taskTitle}</span>
                    <span className={styles.lotAmount} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <img src="/assets/icons/icon-64x64.png" alt="BLUE" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'contain' }} />
                      +{fmt(lot.amount)} BLUE
                    </span>
                  </div>
                  <div className={styles.progressBarContainer}>
                    <div
                      className={styles.progressBarFill}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className={styles.lotFooter}>
                    <span>{lot.dateIssued}</span>
                    <span style={{ color: lot.daysRemaining <= 5 ? '#34d399' : '#38bdf8', fontWeight: 600 }}>
                      {lot.daysRemaining === 0 ? '¡Listo para el Exchange!' : `Faltan ${lot.daysRemaining} días`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BENEFICIOS DEL CLUB WINTON */}
        <div className={styles.creditCard}>
          <div className={styles.sectionTitle}>
            <span>Club Winton & Recompensas</span>
            <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>+{user.clubBonusPercent}% en BLUE IOU</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Bono Acumulado de Estatus</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>
                {fmt(user.accumulatedBonusIou)} BLUE IOU
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Siguiente Nivel</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e2e8f0' }}>Club Platino (Nivel 5)</div>
            </div>
          </div>
        </div>

        {/* HISTORIAL RECIENTE */}
        <div className={styles.creditCard}>
          <div className={styles.sectionTitle}>
            <span>Movimientos Recientes</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {transactions.map((tx) => (
              <div
                key={tx.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{tx.type}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{tx.timestamp}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#38bdf8' }}>{tx.amount}</div>
                  <div style={{ fontSize: '0.7rem', color: '#10b981' }}>{tx.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* MODAL DE COMPENSACIÓN DE COMPROMISO CON SALDO GANADO */}
      {modalType === 'routeA' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Compensar Compromiso con mis Ganancias</h3>
            <p className={styles.modalDesc}>
              Vas a amortizar parte o la totalidad de tu compromiso RED usando tu saldo ganado en tareas sin gastar de tu bolsillo.
            </p>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Monto a amortizar (RED / BLUE):</label>
              <input
                type="number"
                step="0.0001"
                className={styles.textInput}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.0000"
                autoFocus
              />
            </div>
            <div className={styles.modalButtons}>
              <button className={styles.btnCancel} onClick={() => setModalType(null)} disabled={loading}>
                Cancelar
              </button>
              <button className={styles.btnRouteA} onClick={handleRepayRouteA} disabled={loading}>
                {loading ? 'Confirmando...' : 'Confirmar en 1 Toque'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RETIRO DE USDT */}
      {modalType === 'withdrawUsdt' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Retirar Garantía USDT</h3>
            <p className={styles.modalDesc}>
              Este monto corresponde a tu capital libre que no está respaldando ningún compromiso. El retiro se transferirá a tu billetera personal.
            </p>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Monto a retirar en USDT:</label>
              <input
                type="number"
                step="0.0001"
                className={styles.textInput}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.0000"
                autoFocus
              />
            </div>
            <div className={styles.modalButtons}>
              <button className={styles.btnCancel} onClick={() => setModalType(null)} disabled={loading}>
                Cancelar
              </button>
              <button className={styles.btnSuccess} onClick={handleWithdrawUsdt} disabled={loading}>
                {loading ? 'Procesando...' : 'Retirar USDT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DEPÓSITO DE USDT */}
      {modalType === 'depositUsdt' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Depositar Garantía USDT</h3>
            <p className={styles.modalDesc}>
              Gracias a tu Smart Account ERC-4337, la autorización y el depósito se agrupan en 1 solo toque, con el gas cubierto por WintonCoin ($0.00).
            </p>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Monto a depositar en USDT:</label>
              <input
                type="number"
                step="0.0001"
                className={styles.textInput}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.0000"
                autoFocus
              />
            </div>
            <div className={styles.modalButtons}>
              <button className={styles.btnCancel} onClick={() => setModalType(null)} disabled={loading}>
                Cancelar
              </button>
              <button className={styles.btnSuccess} onClick={handleDepositUsdt} disabled={loading}>
                {loading ? 'Autorizando...' : 'Depositar en 1 Toque'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PRÓRROGA DE COMPROMISO (BENEFICIO NIVEL 4+) */}
      {modalType === 'extension' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} role="dialog" aria-modal="true" aria-labelledby="extension-title">
            <h3 id="extension-title" className={styles.modalTitle}>Prórroga de un compromiso</h3>
            <label className={styles.inputLabel}>Compromiso
              <select className={styles.input} value={extensionQuote?.lotId || ''}
                onChange={(event) => refreshQuote(event.target.value, extensionDays)}>
                {activeCommitments.map((lot) => <option key={lot.id} value={lot.id}>
                  {lot.id}: {fmt(lot.remaining)} RED · vence {new Date(lot.dueAt).toLocaleString()}
                </option>)}
              </select>
            </label>
            <label className={styles.inputLabel}>Plazo
              <select className={styles.input} value={extensionDays}
                onChange={(event) => refreshQuote(extensionQuote?.lotId, Number(event.target.value))}>
                {data.policy.extensionOptions.map((option) => <option key={option.days} value={option.days}>
                  {option.days} días · recargo {option.bps / 100}%
                </option>)}
              </select>
            </label>
            {extensionQuote && <div className={styles.modalDesc}>
              <p>Compromiso elegido: {fmt(extensionQuote.remaining)} RED</p>
              <p>Recargo: {fmt(extensionQuote.fee)} RED <small>({extensionQuote.fee.toFixed(6)} exactos)</small></p>
              <p>Total de ese compromiso: {fmt(extensionQuote.newLotTotal)} RED</p>
              <p>Nuevo vencimiento: {new Date(extensionQuote.newDueAt).toLocaleString()}</p>
              <p>Prórrogas usadas: {selectedCommitment?.extensionCount || 0} de 2.</p>
              {waiting && <p>La siguiente estará disponible el {new Date(nextExtensionAt).toLocaleString()}.</p>}
              {extensionQuote.marginNeeded > 0 && <p>Falta capacidad ordinaria por {fmt(extensionQuote.marginNeeded)} RED.
                {user.tierLevel < 5 ? ' Amortiza o aporta garantía antes de confirmar.'
                  : ' Se comprobará el margen especial configurado; el nivel por sí solo no concede un importe.'}</p>}
              <p>Las fechas de tus otros compromisos y de los BLUE ya entregados se mantienen.</p>
              <p>Demostración local. El fondo que recibirá los recargos sigue pendiente de definición.</p>
            </div>}
            <div className={styles.modalButtons}>
              <button className={styles.btnCancel} onClick={() => setModalType(null)} disabled={loading}>Cerrar</button>
              <button className={styles.btnSuccess} onClick={handleRequestExtension}
                disabled={loading || extensionUnavailable || !extensionQuote}>
                {loading ? 'Comprobando…' : 'Confirmar prórroga'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalType === 'amortizationQueue' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} role="dialog" aria-modal="true" aria-labelledby="reserve-title">
            <h3 id="reserve-title" className={styles.modalTitle}>Tus USDT reservados</h3>
            <p>Reservado en total: {fmt(computed.pignoratedUsdt)} USDT.</p>
            <p>En una compra de amortización: {fmt(data.amortizationQueue.activeOrder?.usdtAmount || 0)} USDT.</p>
            <p>Pendiente de crear la siguiente compra: {fmt(data.amortizationQueue.bufferedReserveUsdt)} USDT.</p>
            {data.amortizationQueue.activeOrder && <p>Turno actual: {data.amortizationQueue.activeOrder.positionInQueue}.</p>}
            <p>Estos importes forman parte de tu garantía; no se suman dos veces.</p>
            <p>La siguiente compra entra al final de la cola cuando termina la anterior y se procesa la reserva.
              Un cruce parcial no abre otra orden. Si amortizas trabajando, se recalcula lo que aún hace falta.
              Los USDT ya gastados no se devuelven.</p>
            <p>Disponible para retirar: {fmt(computed.freeUsdtToWithdraw)} USDT.
              Tú decides cuándo retirarlos. Cancelar una compra devuelve su remanente a la garantía.</p>
            <div className={styles.modalButtons}>
              <button className={styles.btnSecondary} disabled={loading} onClick={async () => {
                setLoading(true);
                try { await mockExchangeService.processPending(); showToast('Reserva comprobada en la simulación.'); }
                catch (error) { showToast(error.message); }
                finally { setLoading(false); }
              }}>Procesar reserva</button>
              <button className={styles.btnCancel} onClick={() => setModalType(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Wallet;
