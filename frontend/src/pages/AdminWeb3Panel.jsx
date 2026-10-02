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
import ContractConfiguration from '../components/ContractConfiguration.jsx';
import Web3Readiness from '../components/Web3Readiness.jsx';
import { administerContract } from '../modules/ownerWalletAdministration.js';
import styles from './AdminWeb3Panel.module.css';

export default function AdminWeb3Panel() {
  const [activeTab, setActiveTab] = useState('directory'); // 'directory', 'governance', 'auditor', 'sandbox'
  const [statusData, setStatusData] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [recoveryId,setRecoveryId]=useState('');
  const [recoveryHash,setRecoveryHash]=useState('');
  const [lastOwnerOperation,setLastOwnerOperation]=useState(null);

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
  const [simAuthorization, setSimAuthorization] = useState('');
  const [simSignature, setSimSignature] = useState('');

  // Form states - Configuración de Prórroga desde nivel 3
  const [extensionDaysAdmin, setExtensionDaysAdmin] = useState('30');
  const [extensionBpsAdmin, setExtensionBpsAdmin] = useState('500');
  const [extensionEnabled, setExtensionEnabled] = useState(true);
  const [benefitWallet, setBenefitWallet] = useState('');
  const [benefitLevel, setBenefitLevel] = useState('3');
  const [benefitMargin, setBenefitMargin] = useState('0');

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

      
      const res = await fetch(`${API_URL}/api/admin/web3/status`, {
        credentials: 'include',
        headers: {

          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success !== true) throw new Error(data.error || "Estado Web3 no disponible");
        setStatusData(data);
      } else {
        console.warn("Servicio Web3 no disponible o sesión administrativa expirada.");
        setStatusData(null);
      }
    } catch (err) {
      console.error("Error al cargar estado Web3:", err);
      setStatusData(null);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const verifyOwnerTransaction=async(event)=>{
    event.preventDefault();setActionLoading(true);
    try{
      const response=await fetch(`${getApiUrl()}/api/admin/web3/owner/confirm`,{
        method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({operationId:recoveryId.trim(),txHash:recoveryHash.trim()})
      });
      const result=await response.json();
      if(!response.ok&&response.status!==202)throw new Error(result.message||'No se pudo verificar.');
      setLastOwnerOperation(result);
      showToast(result.success?'✅ Cambio confirmado en blockchain.':`⏳ ${result.message||'La operación sigue pendiente.'}`);
      if(result.success)fetchStatus();
    }catch(error){showToast(`❌ ${error.message}`);}
    finally{setActionLoading(false);}
  };

  // Helper genérico para peticiones administrativas
  const executeAdminPost = async (endpoint, body, successMsg) => {
    if (!statusData || loadingStatus) { showToast('Espera una lectura confirmada del contrato.'); return; }
    const API_URL = getApiUrl();


    try {
      setActionLoading(true);
      if (body.username) {
        const identityResponse = await fetch(`${API_URL}/api/admin/web3/identity?username=${encodeURIComponent(body.username)}`, {credentials:'include',cache:'no-store'});
        const identity = await identityResponse.json();
        if (!identityResponse.ok || !identity.success) throw new Error(identity.message || 'No se pudo verificar al usuario.');
        if (!window.confirm(`Confirmar cambio para @${identity.username}\nBilletera asociada: ${identity.walletAddress}`)) return;
        body = {...body, walletAddress:identity.walletAddress};
      }
      const ownerActions={
        '/api/admin/web3/credit-limit':['credit_limit',body],
        '/api/admin/web3/kyc':['kyc',body],
        '/api/admin/web3/max-tx':['max_transaction',{amount:body.maxAmount}],
        '/api/admin/web3/commission-rate':['commission',{value:String(Number(body.commissionBps)/100)}],
        '/api/admin/web3/extension-params':['extension_option',body],
        '/api/admin/web3/user-benefits':['user_benefits',body],
        '/api/admin/web3/pause':[`${body.action}_${body.target}`,body]
      };
      if (ownerActions[endpoint]) {
        const [action,input]=ownerActions[endpoint];
        const result=await administerContract(action,input);
        setLastOwnerOperation(result);
        if(result.success){showToast(`✅ ${successMsg} · ${result.txHash||''}`);fetchStatus();}
        else if(result.pending){showToast(`⏳ ${result.message} Referencia: ${result.operationId||''} · ${result.txHash||''}`);}
        else throw new Error(result.message||'El contrato no confirmó el cambio.');
        return result;
      }
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (res.status===202 && data.accepted) {showToast('Operación registrada. Referencia: '+data.operationId+'. Se confirmará automáticamente.');return data;}
      if (!res.ok || data.success !== true) {
        if (res.status === 401) { window.location.assign('/admin.html'); return; }
        throw new Error(data.message || data.error || 'No se pudo confirmar la operación.');
      }

      showToast(data.pendingReconciliation ? data.message : `✅ ${successMsg}`);
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
      { username: creditLimitWallet, limit: creditLimitAmount },
      `Límite de ${creditLimitAmount} RED asignado a ${creditLimitWallet.slice(0, 8)}...`
    );
  };

  // 2. Modificar KYC
  const handleSetKYC = (e) => {
    e.preventDefault();
    if (!kycWallet) return;
    executeAdminPost(
      '/api/admin/web3/kyc',
      { username: kycWallet, status: kycStatus },
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

  // 6. Configurar Parámetros de Prórroga desde nivel 3
  const handleSetExtensionParams = (e) => {
    e.preventDefault();
    executeAdminPost(
      '/api/admin/web3/extension-params',
      { extensionDays: extensionDaysAdmin, extensionBps: extensionBpsAdmin, enabled: extensionEnabled },
      `Parámetros de prórroga configurados (${extensionDaysAdmin} días, ${extensionBpsAdmin} BPS)`
    );
  };

  // 7. Auditoría 360° On-Chain
  const handleAuditWallet = async (e) => {
    e.preventDefault();
    if (!auditWallet) return;

    try {
      setAuditing(true);
      const API_URL = getApiUrl();


      const identityResponse = await fetch(`${API_URL}/api/admin/web3/identity?username=${encodeURIComponent(auditWallet)}`, {credentials:'include',cache:'no-store'});
      const identity = await identityResponse.json();
      if (!identityResponse.ok || !identity.success) throw new Error(identity.message || 'Usuario no encontrado.');
      const res = await fetch(`${API_URL}/api/admin/web3/user-audit/${identity.walletAddress}`, {
        credentials: 'include',
        headers: {

          'Content-Type': 'application/json'
        }
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Error al auditar billetera');
      }
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
      { username: faucetWallet, amount: faucetAmount },
      `${faucetAmount} USDT transferidos a ${faucetWallet.slice(0, 8)}...`
    );
  };

  // 8. Sandbox: Simular Pago Marketplace
  const handleSimulatePayment = (e) => {
    e.preventDefault();
    if (!simPayer || !simPayee || !simAmount) return;
    let authorization;
    try { authorization = JSON.parse(simAuthorization); }
    catch { showToast('La autorización firmada debe ser un objeto JSON válido.'); return; }
    executeAdminPost(
      '/api/admin/web3/test/process-payment',
      { payerUsername: simPayer, payeeUsername: simPayee, amount: simAmount, authorization, signature: simSignature },
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
            Configuración de contratos, permisos e historial de operaciones
          </p>
        </div>

        <div className={styles.networkBadgeContainer}>
          <a
            href="/admin-panel.html"
            className={styles.copyBtn}
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#38bdf8' }}
            title="Volver al Panel Administrativo General"
          >
            ⬅ Volver al Panel General
          </a>
          <div className={styles.networkBadge}>
            <span className={statusData?.parameters?.paused ? styles.pulseDotPaused : styles.pulseDot}></span>
            <span>{statusData?.network || 'Conectando red...'}</span>
          </div>
          <button onClick={fetchStatus} className={styles.copyBtn} title="Recargar Estado">
            🔄 Refrescar
          </button>
        </div>
      </div>

      <Web3Readiness />
      {lastOwnerOperation?.operationId&&<p role="status">
        Última operación: <strong>{lastOwnerOperation.state|| (lastOwnerOperation.pending?'Pendiente':'Confirmada')}</strong>.
        Referencia: <code>{lastOwnerOperation.operationId}</code>
        {lastOwnerOperation.txHash&&<> · Transacción: <code>{lastOwnerOperation.txHash}</code></>}
      </p>}
      <details>
        <summary>Verificar una firma administrativa ya enviada</summary>
        <p>Si la billetera envió una transacción y se perdió la respuesta, introduce la referencia y el identificador de la transacción. No vuelvas a firmar.</p>
        <form onSubmit={verifyOwnerTransaction}>
          <label>Referencia de operación<input value={recoveryId} onChange={event=>setRecoveryId(event.target.value)} required /></label>
          <label>Identificador de transacción<input value={recoveryHash} onChange={event=>setRecoveryHash(event.target.value)} required /></label>
          <button type="submit" disabled={actionLoading}>Comprobar en blockchain</button>
        </form>
      </details>

      {/* Barra de Estado del Relayer */}
      {statusData?.relayer && (
        <div className={styles.relayerCard}>
          <div className={styles.relayerInfo}>
            <span className={styles.relayerLabel}>Procesador de pagos:</span>
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

      {/* Alerta de Desconexión / Error de Carga */}
      {!statusData && !loadingStatus && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '16px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          color: '#f87171',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span> Servicio Web3 Desconectado o Sesión Administrativa Expirada
          </div>
          <div style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: '1.45' }}>
            No se pudo obtener el estado en vivo de los contratos desde el backend (/api/admin/web3/status). Asegúrate de haber iniciado sesión como administrador y que el nodo RPC o relayer esté activo.
          </div>
          <button
            onClick={fetchStatus}
            style={{
              alignSelf: 'flex-start',
              marginTop: '4px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🔄 Reintentar Conexión
          </button>
        </div>
      )}

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
<ContractConfiguration onUpdated={fetchStatus} />

          {/* Asignar Límite de Crédito */}
          <div className={styles.actionPanel}>
            <h3 className={styles.actionPanelTitle}>💳 Excepción individual del límite RED</h3>
            <p className={styles.actionPanelDesc}>
              Aplica un límite aprobado a una persona concreta. Esta excepción se conserva cuando se recalculan las reglas generales; la garantía se suma por separado.
            </p>
            <form onSubmit={handleSetCreditLimit}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nombre de usuario</label>
                <input
                  type="text"
                  placeholder="Nombre de usuario"
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
              <button type="submit" disabled={actionLoading || loadingStatus || !statusData} className={styles.submitBtn}>
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
                <label className={styles.formLabel}>Nombre de usuario</label>
                <input
                  type="text"
                  placeholder="Nombre de usuario"
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
              <button type="submit" disabled={actionLoading || loadingStatus || !statusData} className={styles.submitBtn}>
                {actionLoading ? 'Procesando...' : 'Actualizar Estado KYC'}
              </button>
            </form>
          </div>

          {/* Circuit Breaker & Parámetros */}
          <div className={styles.actionPanel}>
            <h3 className={styles.actionPanelTitle}>⚡ Límite por pago</h3>
            <p className={styles.actionPanelDesc}>
              Ajusta el importe máximo permitido por operación. La comisión se configura en Reglas generales.
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
              <button type="submit" disabled={actionLoading || loadingStatus || !statusData} className={styles.submitBtn}>
                Actualizar Techo por Tx
              </button>
            </form>


          </div>

          {/* Configuración de Prórroga de Compromiso (Nivel 4+) */}
          <div className={styles.actionPanel}>
            <h3 className={styles.actionPanelTitle}>⏳ Parámetros de Prórroga (desde nivel 3)</h3>
            <p className={styles.actionPanelDesc}>
              Configura los plazos y recargos habilitados. Prórrogas desde nivel 3; margen exclusivo para recargos desde nivel 5. Los valores se confirman en blockchain.
            </p>
            <p>Opciones confirmadas: {statusData?.parameters?.extensionOptions?.map((option) =>
              (option.days + ' días / ' + option.bps / 100 + '% / ' + (option.enabled ? 'habilitada' : 'deshabilitada'))).join(' · ') || 'No disponibles'}</p>
            <label><input type="checkbox" checked={extensionEnabled} onChange={(event) => setExtensionEnabled(event.target.checked)} /> Habilitar esta opción</label>
            <form onSubmit={handleSetExtensionParams} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Plazo de esta opción (días)</label>
                <input
                  type="number"
                  placeholder="Ej: 30"
                  value={extensionDaysAdmin}
                  onChange={(e) => setExtensionDaysAdmin(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tarifa de Prórroga BPS (Ej: 500 = 5.00%)</label>
                <input
                  type="number"
                  placeholder="Ej: 500"
                  value={extensionBpsAdmin}
                  onChange={(e) => setExtensionBpsAdmin(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <button type="submit" disabled={actionLoading || loadingStatus || !statusData} className={styles.submitBtn}>
                Guardar opción de prórroga
              </button>
            </form>
          </div>

          <div className={styles.actionPanel}>
            <h3 className={styles.actionPanelTitle}>Nivel y margen para recargos</h3>
            <p>El margen empieza en cero, solo se utiliza desde el nivel 5 y no permite pagar nuevos servicios.
              Cambiar el nivel no elimina compromisos ni márgenes ya utilizados.</p>
            <form onSubmit={(event) => { event.preventDefault(); executeAdminPost('/api/admin/web3/user-benefits',
              { username: benefitWallet, level: benefitLevel, margin: benefitMargin }, 'Beneficios confirmados en blockchain'); }}>
              <label className={styles.formGroup}>Nombre de usuario<input className={styles.formInput} value={benefitWallet} onChange={(event) => setBenefitWallet(event.target.value)} required /></label>
              <label className={styles.formGroup}>Nivel<input className={styles.formInput} type="number" min="0" max="255" step="1" value={benefitLevel} onChange={(event) => setBenefitLevel(event.target.value)} required /></label>
              <label className={styles.formGroup}>Margen máximo para recargos (RED)<input className={styles.formInput} inputMode="decimal" value={benefitMargin} onChange={(event) => setBenefitMargin(event.target.value)} required /></label>
              <button className={styles.submitBtn} disabled={actionLoading || loadingStatus || !statusData}>Guardar beneficios</button>
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
                disabled={actionLoading || loadingStatus || !statusData}
                className={`${styles.submitBtn} ${statusData?.parameters?.paused ? styles.successBtn : styles.dangerBtn}`}
              >
                {statusData?.parameters?.paused
                  ? '🟢 Reanudar CoreProtocol'
                  : '🔴 Pausar CoreProtocol (Emergencia)'}
              </button>

              <button
                onClick={() => handleTogglePause('vault', statusData?.parameters?.vaultPaused || false)}
                disabled={actionLoading || loadingStatus || !statusData}
                className={`${styles.submitBtn} ${statusData?.parameters?.vaultPaused ? styles.successBtn : styles.dangerBtn}`}
              >
                {statusData?.parameters?.vaultPaused
                  ? '🟢 Reanudar Bóveda CollateralVault'
                  : '🔴 Pausar Bóveda CollateralVault (Emergencia)'}
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
                      <span className={styles.badgeGoodStanding}>Al Día</span>
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
                <label className={styles.formLabel}>Nombre del usuario que recibe USDT de prueba</label>
                <input
                  type="text"
                  placeholder="Nombre de usuario"
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
              <button type="submit" disabled={actionLoading || loadingStatus || !statusData} className={styles.submitBtn}>
                {actionLoading ? 'Enviando...' : 'Transferir USDT de Prueba'}
              </button>
            </form>
          </div>

          {/* Simular Pago Marketplace con Emisión Pareada */}
          <div className={styles.actionPanel}>
            <h3 className={styles.actionPanelTitle}>🤝 Simular Pago de Tarea (Emisión Dual)</h3>
            <p className={styles.actionPanelDesc}>
              Ejecuta una transacción real en la red configurada, con autorización del pagador.
              El prestador recibe el importe completo; el pagador asume además la comisión.
            </p>
            <form onSubmit={handleSimulatePayment}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Usuario pagador (adquiere compromiso RED)</label>
                <input
                  type="text"
                  placeholder="Nombre de usuario"
                  value={simPayer}
                  onChange={(e) => setSimPayer(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Usuario prestador (recibe BLUE)</label>
                <input
                  type="text"
                  placeholder="Nombre de usuario"
                  value={simPayee}
                  onChange={(e) => setSimPayee(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Importe para el prestador (BLUE, comisión adicional)</label>
                <input
                  type="number"
                  placeholder="Ej: 100"
                  value={simAmount}
                  onChange={(e) => setSimAmount(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <button type="submit" disabled={actionLoading || loadingStatus || !statusData} className={styles.submitBtn}>
                {actionLoading ? 'Procesando...' : 'Enviar pago autorizado a blockchain'}
              </button>
              <label className={styles.formLabel}>Autorización del pagador (JSON con importes en unidades base)</label>
              <textarea required value={simAuthorization} onChange={e=>setSimAuthorization(e.target.value)} className={styles.formInput} />
              <label className={styles.formLabel}>Firma del pagador</label>
              <input required value={simSignature} onChange={e=>setSimSignature(e.target.value)} className={styles.formInput} />
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
                disabled={actionLoading || loadingStatus || !statusData}
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
