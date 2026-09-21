/**
 * ============================================================================
 * [WINTONCOIN] - PANEL ADMINISTRATIVO WEB3 Y SMART CONTRACTS (AdminWeb3Panel.jsx)
 * ============================================================================
 * Panel de control para la gobernanza, auditoría bancaria y calibración de la Suite V4:
 * - Monitoreo en tiempo real de los 5 contratos + Bóveda en Optimism Sepolia / Local.
 * - Calibración on-chain: Límites de crédito, estados KYC, tasas y circuit breakers.
 * - Auditor 360° On-Chain: Diagnóstico financiero de cualquier billetera y lotes de deuda.
 * - Laboratorio de Pruebas: Faucet de USDT, simulación de pagos con emisión dual y matching FIFO.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getApiUrl } from '../modules/config.js';
import styles from './AdminWeb3Panel.module.css';

export default function AdminWeb3Panel() {
  const [activeTab, setActiveTab] = useState('directory'); // 'directory', 'governance', 'auditor', 'sandbox'
  const [statusData, setStatusData] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states - Gobernanza
  const [creditLimitWallet, setCreditLimitWallet] = useState('');
  const [creditLimitAmount, setCreditLimitAmount] = useState('');

  const [kycWallet, setKycWallet] = useState('');
  const [kycStatus, setKycStatus] = useState(true);

  const [maxTxAmount, setMaxTxAmount] = useState('');
  const [commissionBps, setCommissionBps] = useState('');

  // Form states - Auditoría 360
  const [auditWallet, setAuditWallet] = useState('');
  const [auditResult, setAuditResult] = useState(null);
  const [auditing, setAuditing] = useState(false);

  // Form states - Sandbox / Laboratorio
  const [faucetWallet, setFaucetWallet] = useState('');
  const [faucetAmount, setFaucetAmount] = useState('500');

  const [simPayer, setSimPayer] = useState('');
  const [simPayee, setSimPayee] = useState('');
  const [simAmount, setSimAmount] = useState('100');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    showToast(`📋 ${label} copiado al portapapeles`);
  };

  // Carga inicial del estado del protocolo
  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);
      const API_URL = getApiUrl();
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      
      const res = await fetch(`${API_URL}/api/admin/web3/status`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
      } else {
        // Fallback para pruebas visuales si el backend está en desarrollo
        setStatusData({
          network: "Optimism Sepolia (Chain ID: 11155420)",
          chainId: "11155420",
          relayer: {
            address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            balanceEth: "1.4520",
            isConfigured: true
          },
          contracts: {
            CoreProtocol: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
            CollateralVault: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
            FifoExchange: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
            ProtocolTreasury: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
            BlueToken: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
            RedToken: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
            USDT: "0x5FbDB2315678afecb367f032d93F642f64180aa3"
          },
          parameters: {
            paused: false,
            maxTransactionAmount: "5000",
            commissionRateBps: "500",
            totalCollateralLocked: "12500.00"
          }
        });
      }
    } catch (err) {
      console.error("Error al cargar estado Web3:", err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Helper genérico para peticiones administrativas
  const executeAdminPost = async (endpoint, body, successMsg) => {
    const API_URL = getApiUrl();
    const token = localStorage.getItem('adminToken') || localStorage.getItem('token');

    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error en la operación');
      }

      showToast(`✅ ${successMsg}`);
      fetchStatus(); // Refrescar parámetros
      return data;
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 1. Asignar Límite de Crédito
  const handleSetCreditLimit = (e) => {
    e.preventDefault();
    if (!creditLimitWallet || !creditLimitAmount) return;
    executeAdminPost(
      '/api/admin/web3/credit-limit',
      { walletAddress: creditLimitWallet, limit: creditLimitAmount },
      `Límite de ${creditLimitAmount} RED asignado a ${creditLimitWallet.slice(0, 8)}...`
    );
  };

  // 2. Modificar KYC
  const handleSetKYC = (e) => {
    e.preventDefault();
    if (!kycWallet) return;
    executeAdminPost(
      '/api/admin/web3/kyc',
      { walletAddress: kycWallet, status: kycStatus },
      `KYC actualizado a ${kycStatus ? 'Activo' : 'Inactivo'} para ${kycWallet.slice(0, 8)}...`
    );
  };

  // 3. Modificar Circuit Breaker
  const handleSetMaxTx = (e) => {
    e.preventDefault();
    if (!maxTxAmount) return;
    executeAdminPost(
      '/api/admin/web3/max-tx',
      { maxAmount: maxTxAmount },
      `Monto máximo por transacción fijado en ${maxTxAmount} BLUE`
    );
  };

  // 4. Modificar Comisión
  const handleSetCommission = (e) => {
    e.preventDefault();
    if (!commissionBps) return;
    executeAdminPost(
      '/api/admin/web3/commission-rate',
      { commissionBps },
      `Comisión de plataforma fijada en ${commissionBps} BPS`
    );
  };

  // 5. Parada / Reanudación de Emergencia
  const handleTogglePause = (target, currentPaused) => {
    const action = currentPaused ? 'unpause' : 'pause';
    const confirmText = currentPaused
      ? `¿Deseas REANUDAR las operaciones en ${target}?`
      : `⚠️ ALERTA: ¿Deseas PAUSAR de emergencia las operaciones en ${target}?`;

    if (window.confirm(confirmText)) {
      executeAdminPost(
        '/api/admin/web3/pause',
        { target, action },
        `${target} ha sido ${action === 'pause' ? 'PAUSADO' : 'REANUDADO'}`
      );
    }
  };

  // 6. Auditoría 360° On-Chain
  const handleAuditWallet = async (e) => {
    e.preventDefault();
    if (!auditWallet) return;

    try {
      setAuditing(true);
      const API_URL = getApiUrl();
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');

      const res = await fetch(`${API_URL}/api/admin/web3/user-audit/${auditWallet}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al auditar billetera');
      setAuditResult(data);
      showToast('🔍 Auditoría on-chain actualizada');
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      setAuditing(false);
    }
  };

  // 7. Sandbox: Faucet USDT
  const handleMintFaucet = (e) => {
    e.preventDefault();
    if (!faucetWallet || !faucetAmount) return;
    executeAdminPost(
      '/api/admin/web3/test/mint-test-tokens',
      { walletAddress: faucetWallet, amount: faucetAmount },
      `${faucetAmount} USDT transferidos a ${faucetWallet.slice(0, 8)}...`
    );
  };

  // 8. Sandbox: Simular Pago Marketplace
  const handleSimulatePayment = (e) => {
    e.preventDefault();
    if (!simPayer || !simPayee || !simAmount) return;
    executeAdminPost(
      '/api/admin/web3/test/process-payment',
      { payerWallet: simPayer, payeeWallet: simPayee, amount: simAmount },
      `Pago de ${simAmount} BLUE procesado con emisión pareada 1:1`
    );
  };

  // 9. Sandbox: Cruce Manual Fifo
  const handleMatchOrders = () => {
    executeAdminPost(
      '/api/admin/web3/test/match-orders',
      { maxMatches: 10, maxOrdersScanned: 20 },
      'Cruce de órdenes ejecutado en FifoExchange'
    );
  };

  return (
    <div className={styles.panelContainer}>
      {/* Header Principal */}
      <div className={styles.headerSection}>
        <div className={styles.headerTitleGroup}>
          <h1>
            <span>⚙️</span> Panel de Control Smart Contracts (Suite V4)
          </h1>
          <p className={styles.headerSubtitle}>
            Gobernanza Bancaria SOC 2, Calibración On-Chain y Laboratorio de Pruebas
          </p>
        </div>

        <div className={styles.networkBadgeContainer}>
          <div className={styles.networkBadge}>
            <span className={statusData?.parameters?.paused ? styles.pulseDotPaused : styles.pulseDot}></span>
            <span>{statusData?.network || 'Conectando red...'}</span>
          </div>
          <button onClick={fetchStatus} className={styles.copyBtn} title="Recargar Estado">
            🔄 Refrescar
          </button>
        </div>
      </div>

      {/* Barra de Estado del Relayer */}
      {statusData?.relayer && (
        <div className={styles.relayerCard}>
          <div className={styles.relayerInfo}>
            <span className={styles.relayerLabel}>Patrocinador de Gas (Relayer):</span>
            <span className={styles.relayerAddress}>{statusData.relayer.address}</span>
            <button
              onClick={() => copyToClipboard(statusData.relayer.address, 'Dirección del Relayer')}
              className={styles.copyBtn}
            >
              Copiar
            </button>
          </div>
          <div className={styles.relayerInfo}>
            <span className={styles.relayerLabel}>Saldo Disponible:</span>
            <span className={styles.relayerBalance}>{statusData.relayer.balanceEth} ETH</span>
          </div>
        </div>
      )}

      {/* Navegación por Pestañas */}
      <div className={styles.tabsNav}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'directory' ? styles.activeTabBtn : ''}`}
          onClick={() => setActiveTab('directory')}
        >
          📂 Directorio de Contratos
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'governance' ? styles.activeTabBtn : ''}`}
          onClick={() => setActiveTab('governance')}
        >
          ⚖️ Gobernanza & Parámetros
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'auditor' ? styles.activeTabBtn : ''}`}
          onClick={() => setActiveTab('auditor')}
        >
          🔍 Auditoría 360° On-Chain
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'sandbox' ? styles.activeTabBtn : ''}`}
          onClick={() => setActiveTab('sandbox')}
        >
          🧪 Laboratorio de Pruebas
        </button>
      </div>

      {/* TAB 1: DIRECTORIO DE CONTRATOS */}
      {activeTab === 'directory' && (
        <div className={styles.contractsGrid}>
          {statusData?.contracts &&
            Object.entries(statusData.contracts).map(([name, address]) => (
              <div key={name} className={styles.contractCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.contractName}>{name}</span>
                  <span className={styles.contractBadge}>V4 Inmutable</span>
                </div>
                <div className={styles.addressBox}>
                  <span className={styles.addressText} title={address}>
                    {address}
                  </span>
                  <button
                    onClick={() => copyToClipboard(address, `Dirección de ${name}`)}
                    className={styles.copyBtn}
                  >
                    Copiar
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* TAB 2: GOBERNANZA Y PARÁMETROS */}
      {activeTab === 'governance' && (
        <div className={styles.actionsGrid}>
          {/* Asignar Límite de Crédito */}
          <div className={styles.actionPanel}>
            <h3 className={styles.actionPanelTitle}>💳 Asignar Límite de Crédito Base</h3>
            <p className={styles.actionPanelDesc}>
              Fija la línea de crédito aprobada en tokens RED. Define la capacidad máxima de gasto de compromisos sin colateral obligatorio.
            </p>
            <form onSubmit={handleSetCreditLimit}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Dirección de Billetera (0x...)</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={creditLimitWallet}
                  onChange={(e) => setCreditLimitWallet(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nuevo Límite Base (RED)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ej: 500"
                  value={creditLimitAmount}
                  onChange={(e) => setCreditLimitAmount(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <button type="submit" disabled={actionLoading} className={styles.submitBtn}>
                {actionLoading ? 'Procesando...' : 'Asignar Límite On-Chain'}
              </button>
            </form>
          </div>

          {/* Gestión de KYC On-Chain */}
          <div className={styles.actionPanel}>
            <h3 className={styles.actionPanelTitle}>🛡️ Estado KYC On-Chain</h3>
            <p className={styles.actionPanelDesc}>
              Autoriza o revoca el pasaporte financiero on-chain para permitir la contratación y emisión de compromisos.
            </p>
            <form onSubmit={handleSetKYC}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Dirección de Billetera (0x...)</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={kycWallet}
                  onChange={(e) => setKycWallet(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Estatus de Verificación</label>
                <select
                  value={kycStatus ? 'true' : 'false'}
                  onChange={(e) => setKycStatus(e.target.value === 'true')}
                  className={styles.formInput}
                >
                  <option value="true">Aprobado / Verificado (Permitido)</option>
                  <option value="false">Revocado / Suspendido (Bloqueado)</option>
                </select>
              </div>
              <button type="submit" disabled={actionLoading} className={styles.submitBtn}>
                {actionLoading ? 'Procesando...' : 'Actualizar Estado KYC'}
              </button>
            </form>
          </div>

          {/* Circuit Breaker & Parámetros */}
          <div className={styles.actionPanel}>
            <h3 className={styles.actionPanelTitle}>⚡ Circuit Breakers & Tasas</h3>
            <p className={styles.actionPanelDesc}>
              Ajusta el techo máximo por pago individual y la comisión de plataforma de marketplace.
            </p>
            <form onSubmit={handleSetMaxTx} style={{ marginBottom: '1.25rem' }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Monto Máximo por Transacción (Actual: {statusData?.parameters?.maxTransactionAmount} BLUE)
                </label>
                <input
                  type="number"
                  placeholder="Ej: 5000"
                  value={maxTxAmount}
                  onChange={(e) => setMaxTxAmount(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <button type="submit" disabled={actionLoading} className={styles.submitBtn}>
                Actualizar Techo por Tx
              </button>
            </form>

            <form onSubmit={handleSetCommission}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Comisión Marketplace BPS (Actual: {statusData?.parameters?.commissionRateBps} BPS)
                </label>
                <input
                  type="number"
                  placeholder="Ej: 500 (5.00%)"
                  value={commissionBps}
                  onChange={(e) => setCommissionBps(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <button type="submit" disabled={actionLoading} className={styles.submitBtn}>
                Actualizar Comisión
              </button>
            </form>
          </div>

          {/* Paradas de Emergencia */}
          <div className={styles.actionPanel}>
            <h3 className={styles.actionPanelTitle}>🚨 Paradas de Emergencia (Pausa)</h3>
            <p className={styles.actionPanelDesc}>
              Permite detener inmediatamente la emisión de pagos o movimientos de custodia ante alertas de seguridad.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button
                onClick={() => handleTogglePause('protocol', statusData?.parameters?.paused)}
                disabled={actionLoading}
                className={`${styles.submitBtn} ${statusData?.parameters?.paused ? styles.successBtn : styles.dangerBtn}`}
              >
                {statusData?.parameters?.paused
                  ? '🟢 Reanudar CoreProtocol'
                  : '🔴 Pausar CoreProtocol (Emergencia)'}
              </button>

              <button
                onClick={() => handleTogglePause('vault', false)}
                disabled={actionLoading}
                className={`${styles.submitBtn} ${styles.dangerBtn}`}
              >
                🔴 Pausar Bóveda CollateralVault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDITORÍA 360° ON-CHAIN */}
      {activeTab === 'auditor' && (
        <div>
          <div className={styles.actionPanel} style={{ marginBottom: '2rem' }}>
            <h3 className={styles.actionPanelTitle}>🔍 Diagnóstico Financiero On-Chain</h3>
            <p className={styles.actionPanelDesc}>
              Consulta directamente en la blockchain el balance de activos líquidos, compromisos RED, garantías pignoradas, lotes de deuda y estado de solvencia.
            </p>
            <form onSubmit={handleAuditWallet} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Ingresa la billetera del usuario (0x...)"
                value={auditWallet}
                onChange={(e) => setAuditWallet(e.target.value)}
                className={styles.formInput}
                style={{ flex: 1, minWidth: '280px' }}
                required
              />
              <button type="submit" disabled={auditing} className={styles.submitBtn} style={{ width: 'auto' }}>
                {auditing ? 'Consultando Blockchain...' : 'Auditar Usuario'}
              </button>
            </form>
          </div>

          {auditResult && (
            <div className={styles.actionPanel}>
              <h3 className={styles.actionPanelTitle}>
                📊 Reporte de Solvencia para: {auditResult.wallet}
              </h3>

              <div className={styles.auditSummaryGrid}>
                <div className={styles.metricTile}>
                  <span className={styles.metricTitle}>Saldo BLUE Líquido</span>
                  <span className={`${styles.metricValue} ${styles.metricPositive}`}>
                    {auditResult.blueBalance} BLUE
                  </span>
                </div>

                <div className={styles.metricTile}>
                  <span className={styles.metricTitle}>Compromiso RED Total</span>
                  <span className={`${styles.metricValue} ${styles.metricDanger}`}>
                    {auditResult.redCommitment} RED
                  </span>
                </div>

                <div className={styles.metricTile}>
                  <span className={styles.metricTitle}>USDT en Bóveda (Total)</span>
                  <span className={styles.metricValue}>
                    {auditResult.collateralVault?.totalLocked} USDT
                  </span>
                </div>

                <div className={styles.metricTile}>
                  <span className={styles.metricTitle}>Colateral Libre de Retiro</span>
                  <span className={`${styles.metricValue} ${styles.metricPositive}`}>
                    {auditResult.collateralVault?.freeForWithdrawal} USDT
                  </span>
                </div>

                <div className={styles.metricTile}>
                  <span className={styles.metricTitle}>Capacidad de Crédito</span>
                  <span className={`${styles.metricValue} ${styles.metricPositive}`}>
                    {auditResult.credit?.availableCapacity} RED
                  </span>
                </div>

                <div className={styles.metricTile}>
                  <span className={styles.metricTitle}>Garantía Exigible</span>
                  <span className={`${styles.metricValue} ${styles.metricWarning}`}>
                    {auditResult.credit?.requiredCollateral} USDT
                  </span>
                </div>

                <div className={styles.metricTile}>
                  <span className={styles.metricTitle}>Estado Crediticio</span>
                  <span className={styles.metricValue}>
                    {auditResult.credit?.isDelinquent ? (
                      <span className={styles.badgeDelinquent}>Mora Formal (&gt;30d)</span>
                    ) : (
                      <span className={styles.badgeGoodStanding}>Al Día (Buena Fe)</span>
                    )}
                  </span>
                </div>

                <div className={styles.metricTile}>
                  <span className={styles.metricTitle}>Estatus KYC</span>
                  <span className={styles.metricValue}>
                    {auditResult.credit?.isKYCVerified ? (
                      <span className={styles.badgeGoodStanding}>Verificado</span>
                    ) : (
                      <span className={styles.badgeDelinquent}>No Verificado</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Lotes de Deuda */}
              <h4 style={{ margin: '1.5rem 0 0.5rem 0', color: '#f8fafc' }}>
                Lotes de Compromiso Registrados ({auditResult.debtLots?.length || 0})
              </h4>
              <div className={styles.tableContainer}>
                <table className={styles.debtTable}>
                  <thead>
                    <tr>
                      <th>Lote ID</th>
                      <th>Monto Original</th>
                      <th>Remanente Vivo</th>
                      <th>Vencimiento</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditResult.debtLots && auditResult.debtLots.length > 0 ? (
                      auditResult.debtLots.map((lot) => (
                        <tr key={lot.id}>
                          <td>#{lot.id}</td>
                          <td>{lot.originalAmount} RED</td>
                          <td>{lot.remainingAmount} RED</td>
                          <td>{new Date(lot.dueAt).toLocaleDateString()}</td>
                          <td>
                            {lot.repaid ? (
                              <span className={styles.badgeGoodStanding}>Amortizado</span>
                            ) : lot.isOverdue ? (
                              <span className={styles.badgeDelinquent}>Vencido</span>
                            ) : (
                              <span className={styles.badgeGoodStanding}>Vigente</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                          No hay lotes de compromiso activos registrados para esta cuenta.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LABORATORIO DE PRUEBAS (SANDBOX) */}
      {activeTab === 'sandbox' && (
        <div className={styles.actionsGrid}>
          {/* Faucet USDT */}
          <div className={styles.actionPanel}>
            <h3 className={styles.actionPanelTitle}>💧 Faucet de USDT de Prueba</h3>
            <p className={styles.actionPanelDesc}>
              Mintea stablecoins USDT simuladas directamente en la billetera de cualquier usuario para que pruebe depósitos en la Bóveda o compras en el Exchange.
            </p>
            <form onSubmit={handleMintFaucet}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Billetera de Destino (0x...)</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={faucetWallet}
                  onChange={(e) => setFaucetWallet(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Cantidad de USDT a Mintear</label>
                <input
                  type="number"
                  placeholder="Ej: 500"
                  value={faucetAmount}
                  onChange={(e) => setFaucetAmount(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <button type="submit" disabled={actionLoading} className={styles.submitBtn}>
                {actionLoading ? 'Enviando...' : 'Transferir USDT de Prueba'}
              </button>
            </form>
          </div>

          {/* Simular Pago Marketplace con Emisión Pareada */}
          <div className={styles.actionPanel}>
            <h3 className={styles.actionPanelTitle}>🤝 Simular Pago de Tarea (Emisión Dual)</h3>
            <p className={styles.actionPanelDesc}>
              Ejecuta una transacción de marketplace entre dos billeteras: genera BLUE neto para el prestador, deduce la comisión a Tesorería y crea el compromiso RED al pagador.
            </p>
            <form onSubmit={handleSimulatePayment}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Billetera Pagador (Adquiere Compromiso RED)</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={simPayer}
                  onChange={(e) => setSimPayer(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Billetera Prestador (Recibe Tokens BLUE)</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={simPayee}
                  onChange={(e) => setSimPayee(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Monto Bruto de la Tarea (BLUE)</label>
                <input
                  type="number"
                  placeholder="Ej: 100"
                  value={simAmount}
                  onChange={(e) => setSimAmount(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <button type="submit" disabled={actionLoading} className={styles.submitBtn}>
                {actionLoading ? 'Procesando...' : 'Ejecutar Pago Dual On-Chain'}
              </button>
            </form>
          </div>

          {/* Cruce Manual FifoExchange */}
          <div className={styles.actionPanel}>
            <h3 className={styles.actionPanelTitle}>💱 Barrido y Cruce FIFO Manual</h3>
            <p className={styles.actionPanelDesc}>
              Dispara una llamada de matching al contrato FifoExchange para cruzar órdenes de BLUE contra órdenes de USDT que estén en cola activa.
            </p>
            <div style={{ marginTop: '1.5rem' }}>
              <button
                onClick={handleMatchOrders}
                disabled={actionLoading}
                className={styles.submitBtn}
              >
                {actionLoading ? 'Cruzando...' : '⚡ Forzar Cruce de Órdenes FIFO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificación Toast Flotante */}
      {toastMessage && (
        <div className={styles.toastNotification}>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
