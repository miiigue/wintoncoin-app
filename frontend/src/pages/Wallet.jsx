/**
 * ============================================================================
 * [WINTONCOIN] - BILLETERA FINTECH REACT (Wallet.jsx)
 * ============================================================================
 * Pantalla central de la Billetera WintonCoin con arquitectura 2026:
 * - Conexión On-Chain en Vivo: Lee contratos de Optimism Sepolia (Suite V4).
 * - Autorización integrada con PIN para Depósito de Garantías USDT y Amortización BLUE.
 * - Desglose visual en tiempo real de Saldo Líquido, Garantías y Compromisos RED.
 * - Compensación en 1 Toque con quema simétrica de lotes en CoreProtocol.sol.
 * - Desglose justo de garantías USDT (Pignorado vs Libre para Retiro en Bóveda).
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { web3OnChainService, CONTRACT_ADDRESSES } from '../modules/web3OnChainService.js';
import styles from './Wallet.module.css';
import { displayAmount } from '../modules/financialUnits.js';
import { getApiUrl } from '../modules/config.js';

const fmt = value => value == null ? 'No disponible' : displayAmount(value);

function Wallet() {
  const [username, setUsername] = useState(() => localStorage.getItem('username') || 'Usuario');
  const [onChainState, setOnChainState] = useState(null);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [modalType, setModalType] = useState(null); // 'routeA', 'withdrawUsdt', 'depositUsdt', 'infoLots'
  const [amountInput, setAmountInput] = useState('');
  const [withdrawDestination,setWithdrawDestination]=useState('');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [lastTxHash, setLastTxHash] = useState(null);

  const [hasPin, setHasPin] = useState(true);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState(null);

  // Sincronización continua de estado On-Chain desde Optimism Sepolia
  const syncOnChain = async () => {
    try {
      const account = await web3OnChainService.getAssociatedAccount();
      const addr = account.web3_wallet_address;
      setHasPin(Boolean(account.has_transaction_pin));
      if (addr) {
        setConnectedWallet(addr);
        const state = await web3OnChainService.fetchUserOnChainState(addr);
        setOnChainState(state);
      }
    } catch (_) { setOnChainState(null); setConnectedWallet(null); }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    if (!token && !storedUsername) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login?returnTo=${returnTo}`);
      return;
    }
    if (storedUsername) setUsername(storedUsername);

    syncOnChain();
    const pollTimer = setInterval(syncOnChain, 4000);
    return () => clearInterval(pollTimer);
  }, []);

  // Utilidad para mostrar notificaciones toast
  const showToast = (msg, txHash = null) => {
    setToastMessage(msg);
    setLastTxHash(txHash);
    setTimeout(() => {
      setToastMessage(null);
      setLastTxHash(null);
    }, 6000);
  };

  // Manejo de la acción: Compensar compromiso con BLUE en CoreProtocol.sol
  const handleRepayRouteA = async () => {
    try {
      setLoading(true);

      const res = await web3OnChainService.amortizeWithBlue(amountInput);
      setModalType(null);
      setAmountInput('');
      showToast(`✅ Compensación confirmada en Blockchain. BLUE y RED quemados 1:1.`, res.txHash);
      await syncOnChain();
    } catch (err) {
      alert(err.message || 'Error al procesar la compensación on-chain');
    } finally {
      setLoading(false);
    }
  };

  // Manejo del Retiro de USDT Libre desde CollateralVault.sol
  const handleWithdrawUsdt = async () => {
    try {
      setLoading(true);

      const res = modalType==='transferUsdt' ? await web3OnChainService.transferUsdt(amountInput,withdrawDestination.trim()) : await web3OnChainService.withdrawCollateral(amountInput);
      if(modalType==='withdrawUsdt' && withdrawDestination.trim()) {
        try {const transfer=await web3OnChainService.transferUsdt(amountInput,withdrawDestination.trim());res.txHash=transfer.txHash;}
        catch(error){setModalType(null);showToast('La garantía ya está en tu billetera Winton. El envío externo no se completó: '+error.message,res.txHash);return;}
      }
      setModalType(null);
      setAmountInput('');
      showToast(modalType==='transferUsdt'||withdrawDestination.trim()?'Envío de USDT confirmado al destino indicado.':'Garantía retirada a tu billetera Winton.', res.txHash);
      await syncOnChain();
    } catch (err) {
      alert(err.message || 'Error al retirar colateral');
    } finally {
      setLoading(false);
    }
  };

  // Manejo del Depósito de USDT de Garantía en CollateralVault.sol
  const handleDepositUsdt = async () => {
    try {
      setLoading(true);

      const res = await web3OnChainService.depositCollateral(amountInput);
      setModalType(null);
      setAmountInput('');
      showToast(`🚀 Garantía depositada exitosamente en la Bóveda On-Chain.`, res.txHash);
      await syncOnChain();
    } catch (err) {
      alert(err.message || 'Error al depositar USDT');
    } finally {
      setLoading(false);
    }
  };

  // Manejo de la configuración del PIN de Billetera protegida (6 dígitos)
  const handleSetupPin = async (e) => {
    e.preventDefault();
    setPinError(null);
    if (!newPin || !/^\d{6}$/.test(newPin)) {
      setPinError('El PIN debe tener exactamente 6 dígitos numéricos.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('Las claves no coinciden.');
      return;
    }
    const insecure = ['000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999', '123456', '654321'];
    if (insecure.includes(newPin)) {
      setPinError('Por seguridad, no uses secuencias obvias o dígitos repetidos.');
      return;
    }
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const API_URL = getApiUrl();
      const res = await fetch(`${API_URL}/api/me/set-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pin: newPin })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al configurar el PIN');
      }
      setHasPin(true);
      setModalType(null);
      setNewPin('');
      setConfirmPin('');
      showToast('🛡️ PIN configurado. Tu dirección de billetera se mantiene.');
    } catch (err) {
      setPinError(err.message || 'Error al guardar la Clave de Seguridad.');
    } finally {
      setLoading(false);
    }
  };

  // Balances on-chain reales (o 0 si aún no ha sincronizado)
  const displayTotalBlue = onChainState ? onChainState.blueUnlocked : null;
  const displayLiquidBlue = onChainState ? onChainState.blueUnlocked : null;
  const displayRedDebt = onChainState ? onChainState.redCommitment : null;
  const displayCreditLimit = onChainState ? onChainState.baseCreditLimit : null;
  const displayAvailableCapacity = onChainState ? onChainState.availableCapacity : null;
  const displayTotalCollateral = onChainState ? onChainState.collateralLocked : null;
  const displayFreeCollateral = onChainState ? onChainState.collateralFree : null;
  const displayReservedCollateral = onChainState ? onChainState.collateralReserved : null;
  const displayWalletUsdt = onChainState ? onChainState.usdtWalletBalance : null;
  const displayAddress = connectedWallet || 'No conectada';
  const isKycOk = onChainState ? onChainState.isKYCVerified : false;
  const debtLots = onChainState?.debtLots || [];

  return (
    <div className={styles.walletContainer}>
      <div className={styles.walletWrapper}>
        {/* BARRA DE ESTADO WEB3 EN VIVO */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: onChainState ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)',
          border: onChainState ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '12px',
          padding: '10px 16px',
          marginBottom: '1.2rem',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: onChainState ? '#10B981' : '#F59E0B',
              boxShadow: onChainState ? '0 0 8px #10B981' : 'none',
              display: 'inline-block'
            }}></span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: onChainState ? '#10B981' : '#38BDF8' }}>
              {onChainState ? `🟢 ${String(CONTRACT_ADDRESSES.chainId)==='10'?'Optimism':'Optimism Sepolia'} · Datos confirmados` : '🟡 Consultando tu billetera asociada'}
            </span>
            {connectedWallet && (
              <code style={{ fontSize: '0.78rem', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', color: '#cbd5e1' }}>
                {connectedWallet.slice(0, 6)}...{connectedWallet.slice(-4)}
              </code>
            )}
          </div>

        </div>

        {/* ALERTA DE KYC ON-CHAIN (SI NO ESTÁ VERIFICADO EN COREPROTOCOL) */}
        {connectedWallet && onChainState && !isKycOk && (
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
              <strong>⚠️ Identidad KYC On-Chain no aprobada:</strong> Tu billetera ({connectedWallet.slice(0, 6)}...{connectedWallet.slice(-4)}) no está verificada en CoreProtocol.sol.
            </div>

          </div>
        )}

        {/* ALERTA DE AUTOCUSTODIA (PIN DE 6 DÍGITOS NO CONFIGURADO) */}
        {!hasPin && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(2, 132, 199, 0.15), rgba(37, 99, 235, 0.15))',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.4rem' }}>🛡️</span>
              <div>
                <strong style={{ color: '#38bdf8', fontSize: '0.95rem' }}>Protege tus pagos con un PIN:</strong>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Configura tu Clave de Seguridad de 6 dígitos para autorizar pagos y operaciones.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setPinError(null); setModalType('setupPin'); }}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '0.85rem',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
              }}
            >
              Configurar Clave 🔐
            </button>
          </div>
        )}

        {/* NOTIFICACIÓN TOAST */}
        {toastMessage && (
          <div className={styles.toast}>
            <span>{toastMessage}</span>
            {lastTxHash && (
              <div style={{ marginTop: '4px', fontSize: '0.8rem' }}>
                <a
                  href={`https://sepolia-optimism.etherscan.io/tx/${lastTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#38bdf8', textDecoration: 'underline' }}
                >
                  Ver en Optimism Sepolia Etherscan ↗
                </a>
              </div>
            )}
          </div>
        )}

        {/* ENCABEZADO DE USUARIO */}
        <div className={styles.userHeader}>
          <div className={styles.userInfo}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%', flexWrap: 'wrap' }}>
              <h2 className={styles.userName}>@{username}</h2>
              <div style={{ display: 'flex', gap: '8px' }}>

              </div>
            </div>
            <div className={styles.smartAccountTag}>
              <span>Dirección On-Chain:</span>
              <code>{displayAddress}</code>
            </div>
          </div>
          <div className={styles.clubBadge}>
            <span>{isKycOk ? '🛡️ KYC Aprobado' : '⏳ Sin KYC'}</span>
          </div>
        </div>

        {/* HERO CARD: SALDO TOTAL BLUE */}
        <div className={styles.heroCard}>
          <div className={styles.heroHeader}>
            <span className={styles.heroLabel}>Saldo Líquido Disponible</span>
            <span className={styles.gasQuotaBadge}>
              ⚡ Optimism Sepolia L2
            </span>
          </div>
          <div className={styles.mainBalance}>
            <img
              src="/assets/icons/icon-64x64.png"
              alt="BLUE"
              style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'contain', marginRight: '0.65rem' }}
            />
            <span>
              {fmt(displayTotalBlue)} <span style={{ fontSize: '1.4rem', color: '#94a3b8' }}>BLUE</span>
            </span>
          </div>
          <div className={styles.balanceSubrow}>
            <div>
              <span className={styles.subItemLabel}>Disponible para vender en el Exchange</span>
              <span className={`${styles.subItemValue} ${styles.unlockedColor}`}>
                {fmt(displayLiquidBlue)} BLUE
              </span>
            </div>
            <div>
              <span className={styles.subItemLabel}>USDT en tu Billetera</span>
              <span className={`${styles.subItemValue} ${styles.parkingColor}`}>
                {fmt(displayWalletUsdt)} USDT
                <button className={styles.btnSuccess} disabled={!isKycOk||!hasPin||loading||!(displayWalletUsdt>0)} onClick={()=>{setAmountInput('');setWithdrawDestination('');setModalType('transferUsdt');}}>Enviar USDT</button>
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
        {displayRedDebt > 0 && displayLiquidBlue > 0 && (
          <div className={styles.routeABanner}>
            <div className={styles.routeATitleRow}>
              <span className={styles.routeATitle}>
                ⚡ Compensar Compromiso con tokens BLUE
              </span>
            </div>
            <p className={styles.routeADesc}>
              Tienes un compromiso de <strong>{fmt(displayRedDebt)} RED</strong>. Puedes amortizarlo quemando tus tokens BLUE líquidos 1:1 en CoreProtocol.sol.
            </p>
            <button
              className={styles.btnRouteA}
              onClick={() => {
                setAmountInput(Math.min(displayRedDebt, displayLiquidBlue).toString());
                setModalType('routeA');
              }}
            >
              Compensar Compromiso en 1 Toque On-Chain
            </button>
          </div>
        )}

        {/* SECCIÓN DE COMPROMISO Y LÍMITE RED */}
        <div className={styles.creditCard}>
          <div className={styles.sectionTitle}>
            <span>Compromiso y Capacidad RED (On-Chain)</span>
            <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>
              {onChainState ? `Nivel ${onChainState.userLevel}` : 'Consultando...'}
            </span>
          </div>
          <div className={styles.creditGrid}>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>Compromiso RED</div>
              <div className={`${styles.creditBoxValue} ${styles.debtColor}`}>
                {fmt(displayRedDebt)} RED
              </div>
            </div>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>Límite RED Aprobado</div>
              <div className={`${styles.creditBoxValue} ${styles.limitColor}`}>
                {fmt(displayCreditLimit)} RED
              </div>
            </div>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>Capacidad Disponible</div>
              <div className={`${styles.creditBoxValue} ${styles.unlockedColor}`}>
                {fmt(displayAvailableCapacity)} RED
              </div>
            </div>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>Estatus de Mora</div>
              <div className={styles.creditBoxValue} style={{ color: onChainState?.isDelinquent ? '#ef4444' : '#10b981', fontSize: '0.92rem' }}>
                {!onChainState?'No disponible':onChainState.isDelinquent ? '⚠️ Vencido (Mora)' : 'Al Día (Sin Mora)'}
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN DE GARANTÍAS USDT (BÓVEDA DE COLATERAL) */}
        <div className={styles.collateralCard}>
          <div className={styles.sectionTitle}>
            <span>Bóveda de Garantías CollateralVault (USDT)</span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total: {fmt(displayTotalCollateral)} USDT</span>
          </div>
          <div className={styles.creditGrid}>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>Reservado en Exchange</div>
              <div className={styles.creditBoxValue} style={{ color: '#f87171' }}>
                {fmt(displayReservedCollateral)} USDT
              </div>
            </div>
            <div className={styles.creditBox}>
              <div className={styles.creditBoxTitle}>Disponible para Retiro</div>
              <div className={`${styles.creditBoxValue} ${styles.unlockedColor}`}>
                {fmt(displayFreeCollateral)} USDT
              </div>
            </div>
          </div>
          <div className={styles.collateralActions}>
            <button
              className={styles.btnSecondary}
              disabled={displayFreeCollateral <= 0}
              onClick={() => {
                setAmountInput(displayFreeCollateral.toString());
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
              + Depositar Garantía USDT
            </button>
          </div>
        </div>

        {/* LOTES DE COMPROMISO REGISTRADOS EN COREPROTOCOL */}
        {debtLots.length > 0 && (
          <div className={styles.parkingTrackerCard}>
            <div className={styles.sectionTitle}>
              <span>Lotes de Compromiso Registrados On-Chain ({debtLots.length})</span>
            </div>
            <div className={styles.lotsList}>
              {debtLots.map((lot) => (
                <div key={lot.id} className={styles.lotItem}>
                  <div className={styles.lotHeader}>
                    <span className={styles.lotTitle}>Lote #{lot.id} {lot.repaid ? '(Amortizado)' : ''}</span>
                    <span className={styles.lotAmount} style={{ color: lot.repaid ? '#10b981' : '#ef4444' }}>
                      {fmt(lot.remainingAmount)} RED restante
                    </span>
                  </div>
                  <div className={styles.lotFooter}>
                    <span>Vencimiento: {new Date(lot.dueAt).toLocaleDateString()}</span>
                    <span style={{ color: lot.isOverdue ? '#ef4444' : '#38bdf8', fontWeight: 600 }}>
                      {lot.repaid ? '✓ Amortizado' : lot.isOverdue ? '⚠️ Vencido' : 'En Plazo'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AYUDA PARA TESTERS EN DEMO */}
        <div style={{
          marginTop: '1.5rem',
          padding: '14px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          fontSize: '0.8rem',
          color: '#94a3b8',
          textAlign: 'center'
        }}>
          ¿Quieres probar el flujo completo con tokens de prueba en Demo?{' '}
          {' '}
          Solicita al equipo de pruebas la habilitación correspondiente.
        </div>

      </div>

      {/* MODAL DE COMPENSACIÓN DE COMPROMISO CON BLUE */}
      {modalType === 'routeA' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Compensar Compromiso con tokens BLUE</h3>
            <p className={styles.modalDesc}>
              Vas a amortizar parte o la totalidad de tu compromiso RED quemando tokens BLUE líquidos 1:1 en CoreProtocol.sol.
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
                {loading ? 'Autorizando con PIN...' : 'Confirmar en 1 Toque On-Chain'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RETIRO DE USDT */}
      {(modalType === 'withdrawUsdt' || modalType === 'transferUsdt') && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>{modalType==='transferUsdt'?'Enviar USDT de mi billetera':'Retirar garantía USDT'}</h3><label className={styles.inputLabel}>{modalType==='transferUsdt'?'Dirección de destino (misma red)':'Destino externo opcional (misma red)'}<input className={styles.textInput} value={withdrawDestination} onChange={e=>setWithdrawDestination(e.target.value)} placeholder="0x..." /></label><p>{modalType==='transferUsdt'?'Se envía únicamente el USDT disponible en tu billetera. Comprueba que el destino admita USDT en esta misma red.':'Primero se libera la garantía en tu billetera Winton. El envío externo requiere una segunda autorización y nunca usa garantía reservada.'}</p>
            <p className={styles.modalDesc}>
              {modalType==='transferUsdt'?'Este envío no retira ni utiliza garantías del Vault.':'La garantía libre se transferirá a tu billetera Winton.'}
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
                {loading ? 'Autorizando con PIN...' : 'Retirar USDT On-Chain'}
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
              Aportarás USDT a la Bóveda CollateralVault.sol para respaldar tus compromisos u operar en el protocolo. Se solicitará la aprobación del token si es la primera vez.
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
                {loading ? 'Autorizando / Depositando...' : 'Depositar en Bóveda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIGURACIÓN DE PIN DE AUTOCUSTODIA (REACT) */}
      {modalType === 'setupPin' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '440px' }}>
            <h3 className={styles.modalTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🛡️</span> Configurar Clave de Seguridad
            </h3>
            <p className={styles.modalDesc}>
              Esta clave de 6 dígitos protegerá tu billetera en modo billetera protegida. Solo tú podrás autorizar pagos y movimientos.
            </p>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '3px solid #ef4444', padding: '10px 12px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem', color: '#fca5a5' }}>
              ⚠️ <strong>Es muy importante que la recuerdes:</strong> WintonCoin no almacena tu clave en texto plano.
            </div>
            <form onSubmit={handleSetupPin}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Crea tu PIN (6 dígitos):</label>
                <input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={styles.textInput}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="••••••"
                  style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '8px' }}
                  autoFocus
                  required
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Confirma tu PIN (6 dígitos):</label>
                <input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={styles.textInput}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="••••••"
                  style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '8px' }}
                  required
                />
              </div>
              {pinError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '14px', textAlign: 'center' }}>
                  {pinError}
                </div>
              )}
              <div className={styles.modalButtons}>
                <button type="button" className={styles.btnCancel} onClick={() => setModalType(null)} disabled={loading}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnSuccess} disabled={loading}>
                  {loading ? 'Configurando...' : 'Guardar Clave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Wallet;
