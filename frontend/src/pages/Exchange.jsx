/**
 * ============================================================================
 * [WINTONCOIN] - PANTALLA OFICIAL DEL EXCHANGE FIFO (React SPA 2026)
 * ============================================================================
 * Interfaz oficial para el intercambio institucional de tokens:
 * - Paridad Estricta: 1 BLUE = 1 USDT (Sin monedas fiat ni transferencias P2P externas).
 * - Cola FIFO de Venta: Trabajadores colocan sus BLUE liberados para cobrar USDT.
 * - Compra Instantánea / Asistida: Compradores adquieren BLUE o liquidan compromisos RED.
 * - Visor Transparente de la Cola en Tiempo Real.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { mockFinancialService } from '../modules/mockFinancialService.js';
import { mockExchangeService } from '../modules/mockExchangeService.js';
import styles from './Exchange.module.css';

export default function Exchange() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'sell' ? 'sell' : 'buy';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [finState, setFinState] = useState(mockFinancialService.getCalculatedState());
  const [exchangeState, setExchangeState] = useState(mockExchangeService.getState());

  const [amountInput, setAmountInput] = useState('');
  const [autoBurnRed, setAutoBurnRed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Suscripción reactiva a ambos servicios y validación de sesión
  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    if (!token && !username) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login.html?returnTo=${returnTo}`);
      return;
    }

    const unsubFin = mockFinancialService.subscribe((newState) => setFinState(newState));
    const unsubEx = mockExchangeService.subscribe((newState) => setExchangeState(newState));
    return () => {
      unsubFin();
      unsubEx();
    };
  }, []);

  // Limpiar mensajes al cambiar de pestaña
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setAmountInput('');
    setFeedbackMsg(null);
    setErrorMsg(null);
  };

  // Manejador de Venta de BLUE por USDT
  const handleSell = async () => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    setIsSubmitting(true);

    try {
      const res = await mockExchangeService.createSellOrder(amountInput);
      if (res.instantMatch) {
        setFeedbackMsg(`¡Éxito! Tu orden de ${amountInput} BLUE se cruzó al instante. Has recibido ${amountInput} USDT.`);
      } else {
        setFeedbackMsg(`Tu orden de ${amountInput} BLUE ha ingresado con éxito a la Cola FIFO. Recibirás tus USDT en cuanto entren compradores.`);
      }
      setAmountInput('');
    } catch (err) {
      setErrorMsg(err.message || 'Error al procesar la venta');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejador de Compra de BLUE con USDT
  const handleBuy = async () => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    setIsSubmitting(true);

    try {
      const res = await mockExchangeService.createBuyOrder(amountInput, autoBurnRed);
      if (res.inQueueAmount === 0) {
        if (autoBurnRed) {
          setFeedbackMsg(`¡Excelente! Compraste ${amountInput} BLUE y saldaste de inmediato ${amountInput} RED de tu deuda.`);
        } else {
          setFeedbackMsg(`¡Éxito! Has comprado ${amountInput} BLUE. Ya están disponibles en tu saldo líquido.`);
        }
      } else {
        setFeedbackMsg(`Compraste ${res.matchedAmount.toFixed(2)} BLUE al instante. El remanente de ${res.inQueueAmount.toFixed(2)} USDT está en la cola con protección de Buena Fe.`);
      }
      setAmountInput('');
    } catch (err) {
      setErrorMsg(err.message || 'Error al procesar la compra');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancelar orden activa
  const handleCancelOrder = async (orderId) => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const res = await mockExchangeService.cancelOrder(orderId);
      setFeedbackMsg(`Orden cancelada con éxito. Se te reintegraron ${res.refunded}.`);
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo cancelar la orden');
    }
  };

  const parsedAmount = parseFloat(amountInput) || 0;

  return (
    <div className={styles.exchangeContainer}>
      <div className={styles.innerWrapper}>
        {/* CABECERA SUPERIOR */}
        <div className={styles.exchangeHeader}>
          <Link to="/wallet.html" className={styles.backBtn}>
            ← Billetera
          </Link>
          <div className={styles.parityBadge}>
            <span className={styles.pulseDot}></span>
            <img src="/assets/icons/icon-64x64.png" alt="BLUE" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'contain', verticalAlign: 'middle', marginRight: '4px' }} />
            <span>1 BLUE = 1.00 USDT</span>
          </div>
        </div>

        {/* TÍTULO HERO */}
        <div className={styles.heroTitleSection}>
          <h1 className={styles.mainTitle}>Exchange Oficial FIFO</h1>
          <p className={styles.subTitle}>Intercambio institucional sin intermediarios ni monedas locales</p>
        </div>

        {/* FEEDBACK & ERRORES */}
        {feedbackMsg && (
          <div className={styles.successToast}>
            <span>✓</span> {feedbackMsg}
          </div>
        )}
        {errorMsg && (
          <div className={styles.successToast} style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}>
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        {/* NAVEGACIÓN ENTRE MODOS */}
        <div className={styles.tabsNav}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'buy' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange('buy')}
          >
            🛒 Comprar BLUE
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'sell' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange('sell')}
          >
            💱 Vender BLUE
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'queue' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange('queue')}
          >
            📋 Cola FIFO ({exchangeState.sellOrders.length + exchangeState.buyOrders.length})
          </button>
        </div>

        {/* ============================================================== */}
        {/* MODO COMPRA (USDT -> BLUE) */}
        {/* ============================================================== */}
        {activeTab === 'buy' && (
          <div className={styles.swapCard}>
            {/* Input de USDT que entregas */}
            <div className={styles.inputGroup}>
              <div className={styles.inputHeader}>
                <span>Tú pagas con</span>
                <span>Garantía en Bóveda: <strong>{finState.collateral.totalDepositedUsdt.toFixed(2)} USDT</strong></span>
              </div>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  placeholder="0.00"
                  className={styles.tokenInput}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                />
                <div className={styles.tokenBadge}>
                  <span className={styles.tokenIconUsdt}>₮</span>
                  <span>USDT</span>
                </div>
              </div>
            </div>

            {/* Separador de Swap */}
            <div className={styles.swapArrowWrapper}>
              <div className={styles.swapArrowCircle}>↓</div>
            </div>

            {/* Input de BLUE que recibes */}
            <div className={styles.inputGroup} style={{ marginTop: '0.75rem' }}>
              <div className={styles.inputHeader}>
                <span>Tú recibes exactamente</span>
                <span>Paridad Fija 1:1</span>
              </div>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  readOnly
                  placeholder="0.00"
                  className={styles.tokenInput}
                  value={amountInput}
                  style={{ color: '#38bdf8' }}
                />
                <div className={styles.tokenBadge}>
                  <img src="/assets/icons/icon-64x64.png" alt="BLUE" className={styles.tokenLogoImg} />
                  <span>BLUE</span>
                </div>
              </div>
            </div>

            {/* Opción inteligente: Auto-Quema para amortizar compromiso RED */}
            {finState.credit.debtRed > 0 && (
              <label className={styles.burnCheckboxRow}>
                <input
                  type="checkbox"
                  checked={autoBurnRed}
                  onChange={(e) => setAutoBurnRed(e.target.checked)}
                />
                <div>
                  <strong>⚡ Amortizar mi Compromiso RED al Instante</strong>
                  <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '2px' }}>
                    Usa los BLUE comprados para saldar tu compromiso de {finState.credit.debtRed.toFixed(2)} RED en una sola transacción sin pasos adicionales.
                  </div>
                </div>
              </label>
            )}

            {/* Resumen de costos */}
            <div className={styles.rateDetails}>
              <div className={styles.rateRow}>
                <span>Tipo de Cambio</span>
                <strong>1.00 USDT = 1.00 BLUE</strong>
              </div>
              <div className={styles.rateRow}>
                <span>Comisión de Red (Gas)</span>
                <strong style={{ color: '#10b981' }}>$0.00 (Patrocinado por Club)</strong>
              </div>
              <div className={styles.rateRow}>
                <span>Disponibilidad en Cola FIFO</span>
                <strong>{exchangeState.totalBlueForSale.toFixed(2)} BLUE en venta ahora</strong>
              </div>
            </div>

            {/* Botón de compra */}
            <button
              className={styles.actionBtn}
              disabled={isSubmitting || parsedAmount <= 0}
              onClick={handleBuy}
            >
              {isSubmitting ? 'Procesando en Optimism...' : autoBurnRed ? 'Comprar y Amortizar Compromiso RED' : 'Comprar BLUE'}
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODO VENTA (BLUE -> USDT) */}
        {/* ============================================================== */}
        {activeTab === 'sell' && (
          <div className={styles.swapCard}>
            {/* Input de BLUE que vendes */}
            <div className={styles.inputGroup}>
              <div className={styles.inputHeader}>
                <span>Tú vendes</span>
                <span className={styles.balanceLink} onClick={() => setAmountInput(finState.blue.unlocked.toString())}>
                  Disponible: <strong>{finState.blue.unlocked.toFixed(2)} BLUE</strong> (Usar MAX)
                </span>
              </div>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  placeholder="0.00"
                  className={styles.tokenInput}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                />
                <div className={styles.tokenBadge}>
                  <img src="/assets/icons/icon-64x64.png" alt="BLUE" className={styles.tokenLogoImg} />
                  <span>BLUE</span>
                </div>
              </div>
            </div>

            {/* Separador */}
            <div className={styles.swapArrowWrapper}>
              <div className={styles.swapArrowCircle}>↓</div>
            </div>

            {/* Input de USDT que recibes */}
            <div className={styles.inputGroup} style={{ marginTop: '0.75rem' }}>
              <div className={styles.inputHeader}>
                <span>Recibirás en dólares</span>
                <span>Retirable Inmediato</span>
              </div>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  readOnly
                  placeholder="0.00"
                  className={styles.tokenInput}
                  value={amountInput}
                  style={{ color: '#10b981' }}
                />
                <div className={styles.tokenBadge}>
                  <span className={styles.tokenIconUsdt}>₮</span>
                  <span>USDT</span>
                </div>
              </div>
            </div>

            {/* Aviso de seguridad sobre el parking */}
            <div className={styles.rateDetails}>
              <div className={styles.rateRow}>
                <span>Mecanismo de Venta</span>
                <strong>Cola FIFO por orden de llegada</strong>
              </div>
              <div className={styles.rateRow}>
                <span>Regla de Saldo Válido</span>
                <strong>Solo BLUE liberado (post-parking 30d)</strong>
              </div>
              <div className={styles.rateRow}>
                <span>Demanda esperando compra</span>
                <strong>{exchangeState.totalUsdtWaiting.toFixed(2)} USDT en espera</strong>
              </div>
            </div>

            {/* Botón de venta */}
            <button
              className={`${styles.actionBtn} ${styles.btnSellColor}`}
              disabled={isSubmitting || parsedAmount <= 0 || parsedAmount > finState.blue.unlocked}
              onClick={handleSell}
            >
              {isSubmitting
                ? 'Conectando con FIFO Exchange...'
                : parsedAmount > finState.blue.unlocked
                ? 'Saldo Disponible Insuficiente'
                : 'Vender en la Cola FIFO'}
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODO COLA FIFO & MIS ÓRDENES */}
        {/* ============================================================== */}
        {activeTab === 'queue' && (
          <div>
            {/* Órdenes de Venta en Espera */}
            <div className={styles.queueCard}>
              <div className={styles.queueCardHeader}>
                <span className={styles.queueCardTitle}>
                  <span>📥 Vendedores en la Fila (Ofrecen BLUE)</span>
                </span>
                <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>
                  Total: {exchangeState.totalBlueForSale.toFixed(2)} BLUE
                </span>
              </div>

              {exchangeState.sellOrders.length === 0 ? (
                <div className={styles.emptyQueue}>No hay órdenes de venta esperando en la cola.</div>
              ) : (
                <div className={styles.queueList}>
                  {exchangeState.sellOrders.map((ord, idx) => (
                    <div
                      key={ord.id}
                      className={`${styles.queueItem} ${ord.isMyOrder ? styles.queueItemMine : ''}`}
                    >
                      <div className={styles.queueItemLeft}>
                        <div className={`${styles.queuePos} ${ord.isMyOrder ? styles.queuePosMine : ''}`}>
                          #{idx + 1}
                        </div>
                        <div className={styles.queueItemInfo}>
                          <span className={styles.queueItemName}>{ord.sellerName}</span>
                          <span className={styles.queueItemTime}>{ord.timestamp}</span>
                        </div>
                      </div>
                      <div className={styles.queueItemRight}>
                        <div className={styles.queueItemAmount}>
                          {ord.remainingBlue.toFixed(2)} BLUE
                        </div>
                        {ord.isMyOrder && (
                          <button
                            className={styles.cancelBtn}
                            onClick={() => handleCancelOrder(ord.id)}
                          >
                            Cancelar y Recuperar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Órdenes de Compra en Espera */}
            <div className={styles.queueCard}>
              <div className={styles.queueCardHeader}>
                <span className={styles.queueCardTitle}>
                  <span>📤 Compradores en la Fila (Esperan BLUE con USDT)</span>
                </span>
                <span style={{ fontSize: '0.8rem', color: '#10b981' }}>
                  Total: {exchangeState.totalUsdtWaiting.toFixed(2)} USDT
                </span>
              </div>

              {exchangeState.buyOrders.length === 0 ? (
                <div className={styles.emptyQueue}>No hay órdenes de compra esperando. Los intercambios son instantáneos.</div>
              ) : (
                <div className={styles.queueList}>
                  {exchangeState.buyOrders.map((ord, idx) => (
                    <div
                      key={ord.id}
                      className={`${styles.queueItem} ${ord.isMyOrder ? styles.queueItemMine : ''}`}
                    >
                      <div className={styles.queueItemLeft}>
                        <div className={`${styles.queuePos} ${ord.isMyOrder ? styles.queuePosMine : ''}`}>
                          #{idx + 1}
                        </div>
                        <div className={styles.queueItemInfo}>
                          <span className={styles.queueItemName}>{ord.buyerName}</span>
                          <span className={styles.queueItemTime}>{ord.timestamp} (Buena Fe)</span>
                        </div>
                      </div>
                      <div className={styles.queueItemRight}>
                        <div className={styles.queueItemAmount} style={{ color: '#10b981' }}>
                          {ord.remainingUsdt.toFixed(2)} USDT
                        </div>
                        {ord.isMyOrder && (
                          <button
                            className={styles.cancelBtn}
                            onClick={() => handleCancelOrder(ord.id)}
                          >
                            Cancelar Orden
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
