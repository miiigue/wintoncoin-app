import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import WalletTabs from '../components/dashboard/WalletTabs';
import ReferralPromoCard from '../components/dashboard/ReferralPromoCard';
import QuickActions from '../components/dashboard/QuickActions';
import PublicationsFeed from '../components/dashboard/PublicationsFeed';
// BottomNav eliminado: no existía en contract_interaction.html original
import SettingsModal from '../components/dashboard/SettingsModal';
import PublicationTypeModal from '../components/dashboard/PublicationTypeModal';
import QuickSaleModal from '../components/dashboard/QuickSaleModal';
import SolidarioHistoryModal from '../components/dashboard/SolidarioHistoryModal';
import { getApiUrl } from '../modules/config';
import { displayAmount } from '../modules/financialUnits';
import { silentRefreshIfNeeded } from '../modules/auth';
import { showLegalAcceptanceModal } from '../modules/alerts';

/**
 * ============================================================================
 * [WINTONCOIN] - PÁGINA CENTRAL: Dashboard (React SPA 2026)
 * ============================================================================
 * Orquestador principal del panel de usuario, sucesor de contract_interaction.html:
 * - Paridad Visual Estricta: Conserva la identidad visual, colores y accesos que el usuario conoce.
 * - Arquitectura 100% React SPA: Cero parpadeos, cero saltos al monolito HTML legado.
 * - Desempeño Móvil de Alto Nivel: Navegación inferior fija, adaptada para la app Android y PWA.
 * - Cumplimiento FinTech: Regla terminológica absoluta ("Compromiso RED").
 * - Optimización de Recursos: Page Visibility API (suspensión inteligente de sondeos).
 * - Compliance SOC 2 / Legal: Verificación de términos y condiciones en arranque.
 * ============================================================================
 */
export default function Dashboard() {
  const navigate = useNavigate();

  // Estados de Usuario y Autenticación
  const [username, setUsername] = useState(() => localStorage.getItem('username') || 'Usuario');
  const [token] = useState(() => localStorage.getItem('token'));

  // Estados Financieros
  const [activeTab, setActiveTab] = useState('impulsor');
  const [boosterBalance, setBoosterBalance] = useState('0');
  const [liquidBlue, setLiquidBlue] = useState('0.0000');
  const [parkingBlue, setParkingBlue] = useState('0.0000');
  const [redCommitment, setRedCommitment] = useState('0.0000');
  const [availableRedCapacity, setAvailableRedCapacity] = useState('0.0000');
  const [walletAddress, setWalletAddress] = useState('');

  // Timers de Cuentas Regresivas FinTech
  const [nextUnlockAt, setNextUnlockAt] = useState(null);
  const [nextUnlockAmount, setNextUnlockAmount] = useState(null);
  const [nextDueAt, setNextDueAt] = useState(null);
  const [nextDueAmount, setNextDueAmount] = useState(null);

  // Expediente SOS Venezuela (si el usuario tiene uno registrado)
  const [sosCase, setSosCase] = useState(null);

  // Feed de Publicaciones
  const [publications, setPublications] = useState([]);
  const [isLoadingPublications, setIsLoadingPublications] = useState(true);

  // Notificaciones
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Estados de Modales
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [publicationTypeModalOpen, setPublicationTypeModalOpen] = useState(false);
  const [quickSaleModalOpen, setQuickSaleModalOpen] = useState(false);
  const [solidarioHistoryOpen, setSolidarioHistoryOpen] = useState(false);

  // Estados de Configuración, Tooltips y Enlaces Dinámicos
  const [isPreLaunch, setIsPreLaunch] = useState(false);
  const [showPrelaunchTooltip, setShowPrelaunchTooltip] = useState(false);
  const [hasMomentum, setHasMomentum] = useState(false);
  const [hasDonations, setHasDonations] = useState(false);

  // Referencia para control de intervalo de sondeo
  const pollingIntervalRef = useRef(null);

  // 1. Guard de Autenticación
  useEffect(() => {
    if (!token) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/login?returnTo=${returnTo}`, { replace: true });
    }
  }, [token, navigate]);

  // 2. Consulta de Saldos del Usuario (Sincronización dual: Balance + Perfil Impulsor)
  const fetchUserBalances = useCallback(async () => {
    if (!token) return;
    try {
      const API_URL = getApiUrl();
      const [balRes, boostRes] = await Promise.all([
        fetch(`${API_URL}/api/me/balance`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/me/booster-profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (balRes.ok) {
        const data = await balRes.json();
        if (data.username) setUsername(data.username);
        if (data.web3_wallet_address) setWalletAddress(data.web3_wallet_address);

        // Mapeo preciso de saldos FinTech
        const blueLiq = data.blue_balance ?? data.balance_blue ?? 0;
        const blueEscrow = data.escrow_blue_balance ?? data.escrow_balance_blue ?? 0;
        const redBal = data.red_balance ?? data.balance_red ?? 0;
        const limit = parseFloat(data.credit_limit || 0);
        const redDebt = parseFloat(redBal || 0);
        const availRed = data.available_capacity ?? Math.max(0, limit - redDebt);

        setLiquidBlue(displayAmount(blueLiq));
        setParkingBlue(displayAmount(blueEscrow));
        setRedCommitment(displayAmount(redBal));
        setAvailableRedCapacity(displayAmount(availRed));

        // Timers de cuenta regresiva
        setNextUnlockAt(data.next_unlock_at || null);
        setNextUnlockAmount(data.next_unlock_amount || null);
        setNextDueAt(data.next_due_at || null);
        setNextDueAmount(data.next_due_amount || null);
      }

      if (boostRes.ok) {
        const bData = await boostRes.json();
        setBoosterBalance(displayAmount(bData.total_booster_blue ?? bData.booster_balance ?? 0));
      }
    } catch (err) {
      console.warn('[Dashboard] Aviso al consultar balance:', err);
    }
  }, [token]);

  // 3. Verificación de Cumplimiento Legal (Gate Regulatorio SOC 2)
  const checkLegalCompliance = useCallback(async () => {
    if (!token) return;
    try {
      const API_URL = getApiUrl();
      const res = await fetch(`${API_URL}/api/legal/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload.requires_terms_acceptance && payload.pending_documents?.length > 0) {
          if (typeof showLegalAcceptanceModal === 'function') {
            showLegalAcceptanceModal(
              payload.pending_documents,
              () => {
                console.log('[LEGAL] Términos y condiciones aceptados.');
              },
              () => {
                console.log('[LEGAL] Aceptación pospuesta.');
              }
            );
          }
        }
      }
    } catch (err) {
      console.warn('[Dashboard] Aviso al verificar estado legal:', err);
    }
  }, [token]);

  // 4. Consulta de Expediente SOS Venezuela
  const fetchSosCase = useCallback(async (user) => {
    if (!user) return;
    try {
      const API_URL = getApiUrl();
      const res = await fetch(`${API_URL}/api/public/sos-venezuela/my-case?username=${encodeURIComponent(user)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.has_case && data.case) {
          setSosCase(data.case);
        }
      }
    } catch (_) {}
  }, []);

  // 5. Consulta de Publicaciones Activas y Causas Solidarias
  const fetchPublications = useCallback(async (filterMode = 'all') => {
    setIsLoadingPublications(true);
    try {
      const API_URL = getApiUrl();
      const user = username || localStorage.getItem('username') || '';
      const filterParam = filterMode === 'hidden' ? '&filter=hidden' : '';

      const [pubRes, causesRes] = await Promise.all([
        fetch(`${API_URL}/publications/active?user=${encodeURIComponent(user)}${filterParam}`),
        token ? fetch(`${API_URL}/api/humanitarian/causes/approved`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }) : Promise.resolve(null)
      ]);

      let pubs = [];
      if (pubRes.ok) {
        const data = await pubRes.json();
        pubs = Array.isArray(data) ? data : data.publications || [];
      }

      let causes = [];
      if (causesRes && causesRes.ok) {
        const cData = await causesRes.json();
        if (cData.success && Array.isArray(cData.causes)) {
          causes = cData.causes;
        }
      }

      // Filtrado local de causas humanitarias ocultadas
      const hiddenCausesKey = `hidden_causes_${user}`;
      const hiddenCauseIds = JSON.parse(localStorage.getItem(hiddenCausesKey) || '[]');

      const filteredCauses = causes.filter(c => {
        const isHidden = hiddenCauseIds.includes(c.id);
        return filterMode === 'hidden' ? isHidden : !isHidden;
      });

      // Mapear causas al esquema del feed de publicaciones
      const mappedCauses = filteredCauses.map(cause => ({
        id: `cause-${cause.id}`,
        cause_id: cause.id,
        title: cause.title,
        description: cause.story,
        goal_amount: cause.goal_amount,
        current_amount: cause.current_amount,
        amount_on_hold: cause.amount_on_hold,
        created_at: cause.created_at,
        author_username: cause.creator_username,
        beneficiary_username: cause.beneficiary_username,
        foundation_name: cause.foundation_name,
        category: 'donation',
        is_humanitarian_cause: true,
        image_urls: (cause.evidence_urls || []).filter(url => {
          if (!url || typeof url !== 'string') return false;
          const lower = url.toLowerCase();
          return lower.includes('/uploads/') || /\.(webp|png|jpg|jpeg|gif)(\?.*)?$/i.test(lower);
        }),
        available_slots: 1,
        blue_cost: 0
      }));

      setPublications([...mappedCauses, ...pubs]);
    } catch (err) {
      console.error('[Dashboard] Error al consultar publicaciones:', err);
    } finally {
      setIsLoadingPublications(false);
    }
  }, [token, username]);

  // Manejador para ocultar publicación o causa
  const handleHidePublication = async (pub) => {
    const API_URL = getApiUrl();
    const user = username || localStorage.getItem('username');
    if (pub.is_humanitarian_cause) {
      const key = `hidden_causes_${user}`;
      const hidden = JSON.parse(localStorage.getItem(key) || '[]');
      if (!hidden.includes(pub.cause_id)) {
        hidden.push(pub.cause_id);
        localStorage.setItem(key, JSON.stringify(hidden));
      }
      setPublications(prev => prev.filter(p => p.id !== pub.id));
    } else {
      try {
        await fetch(`${API_URL}/api/publications/hide`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ publicationId: pub.id, username: user })
        });
        setPublications(prev => prev.filter(p => p.id !== pub.id));
      } catch (err) {
        console.warn('[Dashboard] Error al ocultar publicación:', err);
      }
    }
  };

  // Manejador para restaurar publicación o causa oculta
  const handleUnhidePublication = async (pub) => {
    const API_URL = getApiUrl();
    const user = username || localStorage.getItem('username');
    if (pub.is_humanitarian_cause) {
      const key = `hidden_causes_${user}`;
      const hidden = JSON.parse(localStorage.getItem(key) || '[]');
      const updated = hidden.filter(id => id !== pub.cause_id);
      localStorage.setItem(key, JSON.stringify(updated));
      setPublications(prev => prev.filter(p => p.id !== pub.id));
    } else {
      try {
        await fetch(`${API_URL}/api/publications/unhide`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ publicationId: pub.id, username: user })
        });
        setPublications(prev => prev.filter(p => p.id !== pub.id));
      } catch (err) {
        console.warn('[Dashboard] Error al restaurar publicación:', err);
      }
    }
  };

  // 6. Consulta de Notificaciones del Usuario (/api/me/notifications)
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const API_URL = getApiUrl();
      const res = await fetch(`${API_URL}/api/me/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const notifs = Array.isArray(data) ? data : data.notifications || [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.is_read).length);
      }
    } catch (_) {}
  }, [token]);

  // Acciones de Notificaciones
  const handleClearNotifications = async () => {
    if (!token) return;
    try {
      const API_URL = getApiUrl();
      await fetch(`${API_URL}/api/me/notifications/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      setNotifications([]);
      setUnreadCount(0);
    } catch (_) {}
  };

  const handleDismissNotification = async (notifId) => {
    if (!token) return;
    try {
      const API_URL = getApiUrl();
      await fetch(`${API_URL}/api/me/notifications/${notifId}/dismiss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      setNotifications(prev => prev.filter(n => n.id !== notifId));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (_) {}
  };

  // 7. Verificación de Plataforma (Pre-Lanzamiento), Momentum y Causas Propias
  const fetchAppConfigAndStatus = useCallback(async () => {
    try {
      const API_URL = getApiUrl();
      // Verificación de Pre-Lanzamiento
      const setRes = await fetch(`${API_URL}/api/platform-settings`);
      if (setRes.ok) {
        const sData = await setRes.json();
        setIsPreLaunch(sData.pre_launch_mode_enabled === true);
      }

      // Verificación de Momentum
      if (token) {
        const momRes = await fetch(`${API_URL}/api/momentum/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (momRes.ok) {
          const mData = await momRes.json();
          if (mData && mData.tier && mData.tier !== 'PENDIENTE' && mData.tier !== 'RECHAZADO') {
            setHasMomentum(true);
          }
        }

        // Verificación de Donaciones Propias
        const causeRes = await fetch(`${API_URL}/api/humanitarian/causes/my`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (causeRes.ok) {
          const cData = await causeRes.json();
          if (cData && cData.causes && cData.causes.length > 0) {
            setHasDonations(true);
          }
        }
      }
    } catch (err) {
      console.warn('[Dashboard] Aviso consultando estado de plataforma y enlaces dinámicos:', err);
    }
  }, [token]);

  // Carga inicial y orquestación del ciclo de vida
  useEffect(() => {
    // 1. Silent token refresh para mantener viva la sesión sin interrupciones
    silentRefreshIfNeeded().catch(err => console.warn('[Dashboard] Silent refresh en arranque:', err));

    // 2. Cargas iniciales
    fetchUserBalances();
    fetchSosCase(username);
    fetchPublications();
    fetchNotifications();
    checkLegalCompliance();
    fetchAppConfigAndStatus();

    // 3. Page Visibility API: sondeo inteligente de batería y datos móviles
    const startPolling = () => {
      if (!pollingIntervalRef.current) {
        pollingIntervalRef.current = setInterval(() => {
          fetchUserBalances();
        }, 15000);
      }
    };

    const stopPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUserBalances();
        fetchNotifications();
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPolling();

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchUserBalances, fetchSosCase, fetchPublications, fetchNotifications, checkLegalCompliance, fetchAppConfigAndStatus, username]);

  // Manejo de Cierre de Sesión Seguro
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/login', { replace: true });
  };

  return (
    <div className="dashboard-main-content">
      {/* 1. Barra de Navegación Superior (header-menu legacy) */}
      <DashboardHeader
        username={username}
        unreadCount={unreadCount}
        notifications={notifications}
        hasMomentum={hasMomentum}
        hasDonations={hasDonations}
        onClearNotifications={handleClearNotifications}
        onDismissNotification={handleDismissNotification}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSolidarioHistory={() => setSolidarioHistoryOpen(true)}
        onLogout={handleLogout}
      />

      {/* Contenedor principal: las clases .container .interaction-container ya tienen
          max-width, padding, border-radius, box-shadow y centrado definidos en style.css */}
      <div className="container interaction-container">
        {/* Banda diagonal de Pre-lanzamiento (pre-launch-ribbon legacy) */}
        {isPreLaunch && (
          <div className="pre-launch-ribbon">
            <span className="pre-launch-text">
              <span className="ribbon-shine-overlay"></span>
              <span
                className="ribbon-text-content info-text-clickable"
                role="button"
                tabIndex={0}
                aria-label="Información sobre el estado de pre-lanzamiento"
                data-tooltip-id="tooltip-prelaunch"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPrelaunchTooltip(prev => !prev);
                }}
              >
                Pre-lanzamiento<br />
                <span className="ribbon-subtext">VERSION BETA</span>
              </span>
            </span>
            <div
              id="tooltip-prelaunch"
              className={`info-tooltip prelaunch-tooltip ${showPrelaunchTooltip ? 'show' : ''}`}
              role="tooltip"
              aria-hidden={!showPrelaunchTooltip}
              onClick={(e) => e.stopPropagation()}
            >
              <p>
                Estás en fase de pre-lanzamiento. Las recompensas en BLUE IOU se registran en el Perfil de Impulsor y los
                saldos en la billetera principal se mantienen en cero hasta el lanzamiento oficial.
              </p>
            </div>
          </div>
        )}

        {/* Logotipo y Título de Marca usando clases legacy */}
        <div className="main-title-container">
          <div className="main-title-row">
            <h1 className="main-title">
              <span className="logo-winton">Winton</span>
              <span className="logo-coin">Coin</span>
            </h1>
          </div>
        </div>

        {/* 2. Tarjeta de Saldos y Compromisos (Impulsor vs Billetera) con Cuentas Regresivas */}
        <WalletTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          boosterBalance={boosterBalance}
          liquidBlue={liquidBlue}
          parkingBlue={parkingBlue}
          redCommitment={redCommitment}
          availableRedCapacity={availableRedCapacity}
          walletAddress={walletAddress}
          sosCase={sosCase}
          nextUnlockAt={nextUnlockAt}
          nextUnlockAmount={nextUnlockAmount}
          nextDueAt={nextDueAt}
          nextDueAmount={nextDueAmount}
        />

        {/* 3. Tarjeta Promocional de Referidos con Web Share API y Campañas Dinámicas */}
        <ReferralPromoCard username={username} />

        {/* 4. Botones de Acción Rápida */}
        <QuickActions
          onOpenCreatePublication={() => setPublicationTypeModalOpen(true)}
          onOpenQuickSale={() => setQuickSaleModalOpen(true)}
        />

        {/* 5. Feed de Publicaciones del Marketplace (publications-section legacy) */}
        <div id="publications-feed-section" className="publications-section">
          <PublicationsFeed
            publications={publications}
            isLoading={isLoadingPublications}
            currentUsername={username}
            isPreLaunch={isPreLaunch}
            onFilterChange={(filter) => fetchPublications(filter)}
            onHidePublication={handleHidePublication}
            onUnhidePublication={handleUnhidePublication}
            onSelectPublication={(pub) => {
              if (pub.is_humanitarian_cause) {
                window.location.href = `causa-solidaria.html?id=${pub.cause_id}`;
              } else {
                window.location.href = `publication-detail.html?id=${pub.id}`;
              }
            }}
          />
        </div>
      </div>

      {/* 6. Modal de Configuración y Descarga PWA */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onLogout={handleLogout}
      />

      {/* 7. Modal Selector de Tipo de Publicación */}
      <PublicationTypeModal
        isOpen={publicationTypeModalOpen}
        onClose={() => setPublicationTypeModalOpen(false)}
        username={username}
      />

      {/* 11. Modal de Venta Rápida con Código QR Dinámico */}
      <QuickSaleModal
        isOpen={quickSaleModalOpen}
        onClose={() => setQuickSaleModalOpen(false)}
        username={username}
      />

      {/* 12. Modal Historial de Causas Solidarias Propias */}
      <SolidarioHistoryModal
        isOpen={solidarioHistoryOpen}
        onClose={() => setSolidarioHistoryOpen(false)}
      />
    </div>
  );
}
