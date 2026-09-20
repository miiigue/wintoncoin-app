import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import mockFinancialService from '../modules/mockFinancialService';
import styles from './Wallet.module.css';

/**
 * ============================================================================
 * [WINTONCOIN] - BILLETERA FINTECH REACT (Wallet.jsx)
 * ============================================================================
 * Pantalla central de la Billetera WintonCoin con arquitectura 2026:
 * - Smart Account ERC-4337 integrada (cero MetaMask para el usuario común).
 * - Desglose visual en tiempo real de Saldo Líquido vs Saldo en Parking (30d).
 * - Compensación en 1 Toque (Ruta A) con Superpoder LIFO para Nivel 4+.
 * - Desglose justo de garantías USDT (Pignorado vs Libre para Retiro).
 * - Estatus y recompensas del Club Winton en BLUE IOU.
 * ============================================================================
 */
function Wallet() {
  const [data, setData] = useState(() => mockFinancialService.getCalculatedState());
  const [modalType, setModalType] = useState(null); // 'routeA', 'withdrawUsdt', 'depositUsdt'
  const [amountInput, setAmountInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Suscripción reactiva al motor financiero
  useEffect(() => {
    const unsubscribe = mockFinancialService.subscribe((updatedState) => {
      setData(updatedState);
    });
    return () => unsubscribe();
  }, []);

  // Utilidad para mostrar notificaciones toast
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Manejo de la acción Ruta A (Compensar deuda con saldo en parking)
  const handleRepayRouteA = async () => {
    try {
      setLoading(true);
      const res = await mockFinancialService.repayWithRouteA(amountInput);
      setModalType(null);
      setAmountInput('');
      showToast(
        `✅ Deuda compensada con éxito. Ganaste +${res.bonusIou.toFixed(2)} BLUE IOU de Bono del Club Winton!`
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
      showToast('💸 Retiro de USDT completado de forma instantánea hacia tu billetera');
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

  const { user, blue, credit, collateral, computed, transactions } = data;

  return (
    <div className={styles.walletContainer}>
      <div className={styles.walletWrapper}>
        
        {/* ENCABEZADO DE USUARIO & ESTATUS DEL CLUB */}
        <div className={styles.userHeader}>
          <div className={styles.userInfo}>
            <h2 className={styles.userName}>{user.name}</h2>
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
            <span className={styles.heroLabel}>Saldo Total WintonCoin</span>
            <span className={styles.gasQuotaBadge}>
              ⛽ Gas Gratis: {computed.gasTxsRemaining} tx hoy
            </span>
          </div>
          <div className={styles.mainBalance}>
            {computed.totalBlueBalance.toFixed(2)} <span style={{ fontSize: '1.25rem', color: '#94a3b8' }}>BLUE</span>
          </div>
          <div className={styles.balanceSubrow}>
            <div>
              <span className={styles.subItemLabel}>Disponible (Líquido)</span>
              <span className={`${styles.subItemValue} ${styles.unlockedColor}`}>
                {blue.unlocked.toFixed(2)} BLUE
              </span>
            </div>
            <div>
              <span className={styles.subItemLabel}>En Parking de Garantía (30d)</span>
              <span className={`${styles.subItemValue} ${styles.parkingColor}`}>
                {computed.totalParkingBlue.toFixed(2)} BLUE
              </span>
            </div>
          </div>
        </div>

        {/* ACCESOS DIRECTOS AL EXCHANGE OFICIAL FIFO */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <Link
            to="/exchange?tab=sell"
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
            to="/exchange?tab=buy"
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

        {/* ACCIÓN RÁPIDA: PAGAR DEUDA CON SALDO GANADO (COMPENSACIÓN EN 1 TOQUE) */}
        {credit.debtRed > 0 && computed.totalParkingBlue > 0 && (
          <div className={styles.routeABanner}>
            <div className={styles.routeATitleRow}>
              <span className={styles.routeATitle}>
                ⚡ Pagar Deuda con mis Ganancias
              </span>
              {user.tierLevel >= 4 && (
                <span className={styles.lifoBadge}>Optimización Inteligente LIFO</span>
              )}
            </div>
            <p className={styles.routeADesc}>
              Tienes una deuda de <strong>{credit.debtRed.toFixed(2)} RED</strong>. Puedes saldarla de inmediato usando tu saldo ganado en tareas sin gastar de tu bolsillo.
              {user.tierLevel >= 4 && ' Por ser Nivel 4, el sistema descuenta tu ingreso más nuevo para proteger el que vence pronto para el Exchange.'}
            </p>
            <button
              className={styles.btnRouteA}
              onClick={() => {
                setAmountInput(Math.min(credit.debtRed, computed.totalParkingBlue).toString());
                setModalType('routeA');
              }}
            >
              Liquidar Deuda Ahora en 1 Toque
            </button>
          </div>
        )}

        {/* SECCIÓN DE DEUDA RED & LÍNEA DE CRÉDITO */}
        <div className={styles.creditCard}>
          <div className={styles.sectionTitle}>
            <span>Compromisos RED y Línea de Crédito</span>
            <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Nivel {user.tierLevel} ({user.tierName})</span>
          </div>
          <div className={styles.creditGrid}>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>Deuda RED Activa</div>
              <div className={`${styles.creditBoxValue} ${styles.debtColor}`}>
                {credit.debtRed.toFixed(2)} RED
              </div>
            </div>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>Límite de Confianza</div>
              <div className={`${styles.creditBoxValue} ${styles.limitColor}`}>
                {credit.effectiveLimitRed.toFixed(2)} RED
              </div>
            </div>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>Capacidad Disponible</div>
              <div className={`${styles.creditBoxValue} ${styles.unlockedColor}`}>
                {computed.availableCreditCapacity.toFixed(2)} RED
              </div>
            </div>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>Vencimiento</div>
              <div className={styles.creditBoxValue} style={{ color: '#fbbf24', fontSize: '1rem' }}>
                En {credit.daysUntilDue} días
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN DE GARANTÍAS USDT (BÓVEDA DE COLATERAL) */}
        <div className={styles.collateralCard}>
          <div className={styles.sectionTitle}>
            <span>Bóveda de Garantías (USDT)</span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total: {collateral.totalDepositedUsdt.toFixed(2)} USDT</span>
          </div>
          <div className={styles.creditGrid}>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>Pignorado por Deuda Excedente</div>
              <div className={styles.creditBoxValue} style={{ color: '#f87171' }}>
                {computed.pignoratedUsdt.toFixed(2)} USDT
              </div>
            </div>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>Libre para Retiro Inmediato</div>
              <div className={`${styles.creditBoxValue} ${styles.unlockedColor}`}>
                {computed.freeUsdtToWithdraw.toFixed(2)} USDT
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

        {/* SECCIÓN RASTREADOR DE PARKING (LOTES EN GARANTÍA DE 30 DÍAS) */}
        <div className={styles.parkingTrackerCard}>
          <div className={styles.sectionTitle}>
            <span>Rastreador de Parking (Garantía de 30 Días)</span>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{blue.parkingLots.length} Lotes Activos</span>
          </div>
          <div className={styles.lotsList}>
            {blue.parkingLots.map((lot) => {
              const progressPercent = Math.min(100, Math.max(0, ((30 - lot.daysRemaining) / 30) * 100));
              return (
                <div key={lot.id} className={styles.lotItem}>
                  <div className={styles.lotHeader}>
                    <span className={styles.lotTitle}>{lot.taskTitle}</span>
                    <span className={styles.lotAmount}>+{lot.amount.toFixed(2)} BLUE</span>
                  </div>
                  <div className={styles.progressBarContainer}>
                    <div
                      className={styles.progressBarFill}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className={styles.lotFooter}>
                    <span>Emitido: {lot.dateIssued}</span>
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
                {user.accumulatedBonusIou.toFixed(2)} BLUE IOU
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

      {/* MODAL DE PAGO DE DEUDA CON SALDO GANADO */}
      {modalType === 'routeA' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Liquidar Deuda con mis Ganancias</h3>
            <p className={styles.modalDesc}>
              Vas a extinguir parte o la totalidad de tu deuda RED usando tu saldo ganado en tareas.
              {user.tierLevel >= 4 && ' Por beneficio de tu nivel, se descontará tu ingreso más reciente para proteger tu saldo próximo a vencer.'}
            </p>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Monto a liquidar (RED / BLUE):</label>
              <input
                type="number"
                className={styles.textInput}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
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
              Este monto corresponde a tu capital libre que no está respaldando ninguna deuda. El retiro se transferirá de forma inmediata a tu billetera personal.
            </p>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Monto a retirar en USDT:</label>
              <input
                type="number"
                className={styles.textInput}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className={styles.modalButtons}>
              <button className={styles.btnCancel} onClick={() => setModalType(null)} disabled={loading}>
                Cancelar
              </button>
              <button className={styles.btnSuccess} onClick={handleWithdrawUsdt} disabled={loading}>
                {loading ? 'Procesando...' : 'Retirar Inmediatamente'}
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
                className={styles.textInput}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
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

      {/* TOAST DE CONFIRMACIÓN */}
      {toastMessage && (
        <div className={styles.toast}>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default Wallet;
