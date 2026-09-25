/**
 * ============================================================================
 * [WINTONCOIN] - PANTALLA OFICIAL DEL EXCHANGE FIFO (React SPA 2026)
 * ============================================================================
 * Interfaz oficial conectada 100% on-chain a la Suite V4 en Optimism Sepolia:
 * - Paridad Estricta: 1 BLUE = 1 USDT (Sin intermediarios fiat ni P2P externo).
 * - Cola FIFO On-Chain: Smart Contract FifoExchange.sol ejecuta en estricto orden de llegada.
 * - Compra Instantánea / Asistida: Compradores adquieren BLUE o liquidan compromisos RED.
 * - Transacciones Reales: Firmadas y transmitidas mediante MetaMask en Optimism Sepolia.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { web3OnChainService, CONTRACT_ADDRESSES } from '../modules/web3OnChainService.js';
import styles from './Exchange.module.css';
import { displayAmount } from '../modules/financialUnits.js';

// Helper canónico para mostrar siempre 4 decimales en interfaces financieras
const fmt = displayAmount;

export default function Exchange() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'sell' ? 'sell' : 'buy';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [onChainState, setOnChainState] = useState(null);
  const [exchangeSnapshot, setExchangeSnapshot] = useState(null);
  const [publicQueue, setPublicQueue] = useState({
    totalBlueForSale: 0,
    totalUsdtWaiting: 0,
    sellOrders: [],
    buyOrders: []
  });

  const [amountInput, setAmountInput] = useState('');
  const [autoBurnRed, setAutoBurnRed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTxHash, setLastTxHash] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Sincronización continua de datos On-Chain y de la Cola FIFO
  const syncData = async () => {
    try {
      const addr = await web3OnChainService.getConnectedAddress();
      if (addr) {
        setConnectedWallet(addr);
        const [userState, snapshot] = await Promise.all([
          web3OnChainService.fetchUserOnChainState(addr),
          web3OnChainService.fetchExchangeSnapshot(addr)
        ]);
        if (userState) setOnChainState(userState);
        if (snapshot) setExchangeSnapshot(snapshot);
      }

      // Consultar cola pública
      const queue = await web3OnChainService.fetchPublicExchangeQueue();
      if (queue && queue.success) {
        setPublicQueue(queue);
      }
    } catch (_) {}
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    if (!token && !username) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login.html?returnTo=${returnTo}`);
      return;
    }

    syncData();
    const timer = setInterval(syncData, 5000);
    return () => clearInterval(timer);
  }, []);

  // Conectar MetaMask con la red Optimism Sepolia
  const handleConnectWallet = async () => {
    try {
      setIsConnecting(true);
      setErrorMsg(null);
      const addr = await web3OnChainService.connectWallet();
      setConnectedWallet(addr);
      setFeedbackMsg(`🦊 MetaMask conectado en Optimism Sepolia: ${addr.slice(0, 6)}...${addr.slice(-4)}`);
      await syncData();
    } catch (err) {
      setErrorMsg(err.message || 'Error al conectar MetaMask');
    } finally {
      setIsConnecting(false);
    }
  };

  // Limpiar mensajes al cambiar de pestaña
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setAmountInput('');
    setFeedbackMsg(null);
    setErrorMsg(null);
    setLastTxHash(null);
  };

  // Manejador de Venta de BLUE por USDT en Blockchain
  const handleSell = async () => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    setLastTxHash(null);
    setIsSubmitting(true);

    try {
      if (!connectedWallet) {
        await handleConnectWallet();
      }

      const res = await web3OnChainService.createSellOrder(amountInput);
      setLastTxHash(res.txHash);
      setFeedbackMsg(`¡Orden de venta enviada a la blockchain! Monto: ${fmt(amountInput)} BLUE.`);
      setAmountInput('');
      await syncData();
    } catch (err) {
      setErrorMsg(err.message || 'Error al procesar la venta en Optimism Sepolia');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejador de Compra de BLUE con USDT en Blockchain
  const handleBuy = async () => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    setLastTxHash(null);
    setIsSubmitting(true);

    try {
      if (!connectedWallet) {
        await handleConnectWallet();
      }

      const res = await web3OnChainService.createBuyOrder(amountInput);
      setLastTxHash(res.txHash);

      if (autoBurnRed && onChainState && onChainState.redCommitment > 0) {
        setFeedbackMsg(`¡Compra registrada on-chain! Procediendo a amortizar compromiso RED...`);
        try {
          const burnRes = await web3OnChainService.amortizeWithBlue(amountInput);
          setFeedbackMsg(`¡Éxito total! Compraste BLUE y amortizaste tu compromiso RED (Tx Amortización: ${burnRes.txHash.slice(0, 10)}...).`);
        } catch (burnErr) {
          setFeedbackMsg(`¡Orden de compra completada! Sin embargo, la amortización automática requiere un paso adicional: ${burnErr.message}`);
        }
      } else {
        setFeedbackMsg(`¡Orden de compra de ${fmt(amountInput)} USDT confirmada en Optimism Sepolia!`);
      }

      setAmountInput('');
      await syncData();
    } catch (err) {
      setErrorMsg(err.message || 'Error al procesar la compra en Optimism Sepolia');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancelar orden activa en el Smart Contract
  const handleCancelOrder = async (orderId) => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    setLastTxHash(null);
    try {
      const res = await web3OnChainService.cancelOrder(orderId);
      setLastTxHash(res.txHash);
      setFeedbackMsg(`Orden #${orderId} cancelada exitosamente en la blockchain.`);
      await syncData();
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo cancelar la orden on-chain');
    }
  };

  // Reclamar devoluciones pendientes en el Smart Contract
  const handleClaimRefunds = async () => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const res = await web3OnChainService.claimRefunds();
      setLastTxHash(res.txHash);
      setFeedbackMsg(`¡Devoluciones reclamadas con éxito! Fondos transferidos a tu billetera.`);
      await syncData();
    } catch (err) {
      setErrorMsg(err.message || 'Error al reclamar devoluciones');
    }
  };

  const parsedAmount = parseFloat(amountInput) || 0;
  const userBlueAvailable = onChainState ? onChainState.blueUnlocked : 0;
  const userUsdtWallet = onChainState ? onChainState.usdtWalletBalance : 0;
  const userCollateralFree = onChainState ? onChainState.collateralFree : 0;
  const userRedCommitment = onChainState ? onChainState.redCommitment : 0;

  // Órdenes del usuario desde el snapshot sincronizado
  const myUserOrders = exchangeSnapshot?.data?.orders || [];
  const pendingRefunds = exchangeSnapshot?.data?.pendingRefunds || { BLUE: '0', USDT: '0' };
  const hasRefunds = (parseFloat(pendingRefunds.BLUE) > 0) || (parseFloat(pendingRefunds.USDT) > 0);

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

        {/* BARRA DE ESTADO WEB3 ON-CHAIN */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: connectedWallet ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)',
          border: connectedWallet ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '12px',
          padding: '10px 16px',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: connectedWallet ? '#10B981' : '#F59E0B',
              boxShadow: connectedWallet ? '0 0 8px #10B981' : 'none',
              display: 'inline-block'
            }}></span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: connectedWallet ? '#10B981' : '#38BDF8' }}>
              {connectedWallet ? '🟢 Optimism Sepolia (FifoExchange V4)' : '🟡 Conecta tu Billetera Web3'}
            </span>
            {connectedWallet && (
              <code style={{ fontSize: '0.78rem', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', color: '#cbd5e1' }}>
                {connectedWallet.slice(0, 6)}...{connectedWallet.slice(-4)}
              </code>
            )}
          </div>
          <button
            onClick={handleConnectWallet}
            disabled={isConnecting}
            style={{
              background: 'linear-gradient(135deg, #FF5E00 0%, #E2761B 100%)',
              color: '#fff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🦊 {connectedWallet ? 'Cambiar Billetera' : (isConnecting ? 'Conectando...' : 'Conectar MetaMask')}
          </button>
        </div>

        {/* ALERTA DE KYC ON-CHAIN (SI NO ESTÁ VERIFICADO EN COREPROTOCOL) */}
        {connectedWallet && onChainState && !onChainState.isKYCVerified && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '1.25rem',
            color: '#fbbf24',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div>
              <strong>⚠️ KYC On-Chain Pendiente:</strong> Tu dirección no está verificada en el contrato CoreProtocol.sol. Para colocar órdenes en el Exchange, aprueba tu KYC desde el Panel de Control Web3.
            </div>
            <Link
              to="/admin/web3"
              style={{
                background: '#f59e0b',
                color: '#1a1a2e',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 700,
                textDecoration: 'none',
                fontSize: '0.78rem'
              }}
            >
              Aprobar KYC en Admin ↗
            </Link>
          </div>
        )}

        {/* TÍTULO HERO */}
        <div className={styles.heroTitleSection}>
          <h1 className={styles.mainTitle}>Exchange FIFO On-Chain</h1>
          <p role="status">
            Intercambio institucional 1:1 en Optimism Sepolia con estricta prelación FIFO (First-In, First-Out).
          </p>
        </div>

        {/* FEEDBACK & ERRORES */}
        {feedbackMsg && (
          <div className={styles.successToast}>
            <span>✓</span> {feedbackMsg}
            {lastTxHash && (
              <div style={{ marginTop: '4px', fontSize: '0.8rem' }}>
                <a
                  href={`https://sepolia-optimism.etherscan.io/tx/${lastTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#38bdf8', textDecoration: 'underline' }}
                >
                  Ver transacción en Optimism Sepolia Etherscan ↗
                </a>
              </div>
            )}
          </div>
        )}
        {errorMsg && (
          <div className={styles.successToast} style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}>
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        {/* BANNER DE RECLAMO DE DEVOLUCIONES PENDIENTES */}
        {hasRefunds && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ color: '#10b981', fontSize: '0.88rem' }}>
              <strong>🎉 Tienes reembolsos pendientes:</strong>{' '}
              {parseFloat(pendingRefunds.BLUE) > 0 && `${fmt(pendingRefunds.BLUE)} BLUE `}
              {parseFloat(pendingRefunds.USDT) > 0 && `${fmt(pendingRefunds.USDT)} USDT`}
            </div>
            <button
              onClick={handleClaimRefunds}
              style={{
                background: '#10b981',
                color: '#fff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Reclamar Fondos On-Chain
            </button>
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
            📋 Cola FIFO ({publicQueue.sellOrders.length + publicQueue.buyOrders.length})
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
                <span>Saldo USDT en Billetera: <strong>{fmt(userUsdtWallet)} USDT</strong></span>
              </div>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  placeholder="0.0000"
                  step="0.0001"
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
                  placeholder="0.0000"
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

            {/* Opción inteligente: Auto-Amortizar compromiso RED */}
            {userRedCommitment > 0 && (
              <label className={styles.burnCheckboxRow}>
                <input
                  type="checkbox"
                  checked={autoBurnRed}
                  onChange={(e) => setAutoBurnRed(e.target.checked)}
                />
                <div>
                  <strong>⚡ Amortizar mi Compromiso RED al Instante</strong>
                  <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '2px' }}>
                    Usa los BLUE comprados para amortizar tu compromiso de {fmt(userRedCommitment)} RED en CoreProtocol.sol.
                  </div>
                </div>
              </label>
            )}

            {/* Resumen de costos */}
            <div className={styles.rateDetails}>
              <div className={styles.rateRow}>
                <span>Tipo de Cambio</span>
                <strong>1.0000 USDT = 1.0000 BLUE</strong>
              </div>
              <div className={styles.rateRow}>
                <span>Red Blockchain</span>
                <strong style={{ color: '#10b981' }}>Optimism Sepolia L2 (Suite V4)</strong>
              </div>
              <div className={styles.rateRow}>
                <span>Disponibilidad en Cola FIFO</span>
                <strong>{fmt(publicQueue.totalBlueForSale)} BLUE en venta ahora</strong>
              </div>
            </div>

            {/* Botón de compra on-chain */}
            <button
              className={styles.actionBtn}
              disabled={isSubmitting || parsedAmount <= 0}
              onClick={handleBuy}
            >
              {isSubmitting
                ? 'Firmando en MetaMask / Sepolia...'
                : !connectedWallet
                ? '🦊 Conectar MetaMask para Comprar'
                : autoBurnRed
                ? 'Comprar y Amortizar Compromiso RED'
                : 'Comprar BLUE en FIFO Exchange'}
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
                <span className={styles.balanceLink} onClick={() => setAmountInput(userBlueAvailable.toString())}>
                  Disponible: <strong>{fmt(userBlueAvailable)} BLUE</strong> (Usar MAX)
                </span>
              </div>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  placeholder="0.0000"
                  step="0.0001"
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
                <span>Directo a tu Billetera</span>
              </div>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  readOnly
                  placeholder="0.0000"
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

            {/* Aviso de seguridad sobre el parking y Cola FIFO */}
            <div className={styles.rateDetails}>
              <div className={styles.rateRow}>
                <span>Mecanismo de Venta</span>
                <strong>Cola FIFO On-Chain por orden de llegada</strong>
              </div>
              <div className={styles.rateRow}>
                <span>Regla de Saldo Válido</span>
                <strong>Solo BLUE liberado en tu billetera</strong>
              </div>
              <div className={styles.rateRow}>
                <span>Compradores en Cola FIFO</span>
                <strong>{fmt(publicQueue.totalUsdtWaiting)} USDT en espera</strong>
              </div>
            </div>

            {/* Botón de venta on-chain */}
            <button
              className={`${styles.actionBtn} ${styles.btnSellColor}`}
              disabled={isSubmitting || parsedAmount <= 0 || (connectedWallet && parsedAmount > userBlueAvailable)}
              onClick={handleSell}
            >
              {isSubmitting
                ? 'Firmando en MetaMask / Sepolia...'
                : !connectedWallet
                ? '🦊 Conectar MetaMask para Vender'
                : parsedAmount > userBlueAvailable
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
            {/* Mis Órdenes Activas On-Chain */}
            {connectedWallet && myUserOrders.length > 0 && (
              <div className={styles.queueCard} style={{ borderColor: 'rgba(56, 189, 248, 0.4)' }}>
                <div className={styles.queueCardHeader}>
                  <span className={styles.queueCardTitle} style={{ color: '#38bdf8' }}>
                    <span>⭐ Mis Órdenes On-Chain</span>
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                    {myUserOrders.filter(o => o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED').length} activas
                  </span>
                </div>
                <div className={styles.queueList}>
                  {myUserOrders.map((ord) => (
                    <div key={ord.order_id} className={`${styles.queueItem} ${styles.queueItemMine}`}>
                      <div className={styles.queueItemLeft}>
                        <div className={`${styles.queuePos} ${styles.queuePosMine}`}>
                          #{ord.order_id}
                        </div>
                        <div className={styles.queueItemInfo}>
                          <span className={styles.queueItemName}>
                            {ord.side === 'SELL_BLUE' ? '💱 Venta BLUE' : '🛒 Compra USDT'} ({ord.status})
                          </span>
                          <span className={styles.queueItemTime}>Secuencia: #{ord.sequence_id}</span>
                        </div>
                      </div>
                      <div className={styles.queueItemRight}>
                        <div className={styles.queueItemAmount}>
                          {fmt(ord.remaining_amount)} {ord.side === 'SELL_BLUE' ? 'BLUE' : 'USDT'}
                        </div>
                        {(ord.status === 'OPEN' || ord.status === 'PARTIALLY_FILLED') && (
                          <button
                            className={styles.cancelBtn}
                            onClick={() => handleCancelOrder(ord.order_id)}
                          >
                            Cancelar Orden
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Órdenes de Venta en Espera */}
            <div className={styles.queueCard}>
              <div className={styles.queueCardHeader}>
                <span className={styles.queueCardTitle}>
                  <span>📥 Vendedores en la Fila (Ofrecen BLUE)</span>
                </span>
                <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>
                  Total: {fmt(publicQueue.totalBlueForSale)} BLUE
                </span>
              </div>

              {publicQueue.sellOrders.length === 0 ? (
                <div className={styles.emptyQueue}>No hay órdenes de venta esperando en la cola.</div>
              ) : (
                <div className={styles.queueList}>
                  {publicQueue.sellOrders.map((ord, idx) => {
                    const isMine = connectedWallet && ord.wallet_address.toLowerCase() === connectedWallet.toLowerCase();
                    return (
                      <div
                        key={ord.order_id}
                        className={`${styles.queueItem} ${isMine ? styles.queueItemMine : ''}`}
                      >
                        <div className={styles.queueItemLeft}>
                          <div className={`${styles.queuePos} ${isMine ? styles.queuePosMine : ''}`}>
                            #{idx + 1}
                          </div>
                          <div className={styles.queueItemInfo}>
                            <span className={styles.queueItemName}>
                              {isMine ? 'Tú (Tu Orden)' : `${ord.wallet_address.slice(0, 6)}...${ord.wallet_address.slice(-4)}`}
                            </span>
                            <span className={styles.queueItemTime}>Orden #{ord.order_id} · Seq #{ord.sequence_id}</span>
                          </div>
                        </div>
                        <div className={styles.queueItemRight}>
                          <div className={styles.queueItemAmount}>
                            {fmt(ord.remaining_amount)} BLUE
                          </div>
                          {isMine && (
                            <button
                              className={styles.cancelBtn}
                              onClick={() => handleCancelOrder(ord.order_id)}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Órdenes de Compra en Espera */}
            <div className={styles.queueCard}>
              <div className={styles.queueCardHeader}>
                <span className={styles.queueCardTitle}>
                  <span>📤 Compradores en la Fila (Ofrecen USDT)</span>
                </span>
                <span style={{ fontSize: '0.8rem', color: '#10b981' }}>
                  Total: {fmt(publicQueue.totalUsdtWaiting)} USDT
                </span>
              </div>

              {publicQueue.buyOrders.length === 0 ? (
                <div className={styles.emptyQueue}>No hay órdenes de compra esperando en este momento.</div>
              ) : (
                <div className={styles.queueList}>
                  {publicQueue.buyOrders.map((ord, idx) => {
                    const isMine = connectedWallet && ord.wallet_address.toLowerCase() === connectedWallet.toLowerCase();
                    return (
                      <div
                        key={ord.order_id}
                        className={`${styles.queueItem} ${isMine ? styles.queueItemMine : ''}`}
                      >
                        <div className={styles.queueItemLeft}>
                          <div className={`${styles.queuePos} ${isMine ? styles.queuePosMine : ''}`}>
                            #{idx + 1}
                          </div>
                          <div className={styles.queueItemInfo}>
                            <span className={styles.queueItemName}>
                              {isMine ? 'Tú (Tu Orden)' : `${ord.wallet_address.slice(0, 6)}...${ord.wallet_address.slice(-4)}`}
                            </span>
                            <span className={styles.queueItemTime}>Orden #{ord.order_id} · Seq #{ord.sequence_id}</span>
                          </div>
                        </div>
                        <div className={styles.queueItemRight}>
                          <div className={styles.queueItemAmount} style={{ color: '#10b981' }}>
                            {fmt(ord.remaining_amount)} USDT
                          </div>
                          {isMine && (
                            <button
                              className={styles.cancelBtn}
                              onClick={() => handleCancelOrder(ord.order_id)}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ENLACE AL EXPLORADOR DE BLOQUES */}
            <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.82rem', color: '#94a3b8' }}>
              <span>Contrato FifoExchange: </span>
              <a
                href={`${CONTRACT_ADDRESSES.blockExplorerUrl}/address/${CONTRACT_ADDRESSES.FifoExchange}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#38bdf8', textDecoration: 'underline' }}
              >
                {CONTRACT_ADDRESSES.FifoExchange.slice(0, 8)}...{CONTRACT_ADDRESSES.FifoExchange.slice(-6)} ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
