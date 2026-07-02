/**
 * Contract Interaction (Dashboard) Page Module
 * Main dashboard for authenticated users - publications, balances, notifications
 */

import {
    getApiUrl,
    showCustomAlert,
    showCustomConfirm,
    linkify,
    escapeHtml,
    escapeAttr,
    fetchAndStoreAppSettings,
    appSettings,
    handleSessionExpired
} from '../modules/index.js';
import { initMigrationCheck } from '../modules/migrationManager.js';
import { initPWAInstall, initSettingsInstallButton } from '../modules/pwa-install.js';
import { initOnboarding, restartTour } from '../modules/onboarding.js';
import { initNotificationGate } from '../modules/notificationGate.js';
import { initializeNotificationSettings } from '../modules/notificationSettings.js';
import { initializeGlobalInterstitial } from '../modules/interstitials.js';
// ...
// ...


// Expose functions globally for backward compatibility
window.getApiUrl = getApiUrl;
window.showCustomAlert = showCustomAlert;
window.showCustomConfirm = showCustomConfirm;
window.linkify = linkify;
window.fetchAndStoreAppSettings = fetchAndStoreAppSettings;
window.appSettings = appSettings;
window.restartTour = restartTour;

console.log('[ContractInteraction] ES Module loaded');

document.addEventListener('DOMContentLoaded', () => {
    // Verificar migración (sc.wintoncoin.com -> wintoncoin.com)
    // initMigrationCheck();

    // --- Utility Functions ---
    function formatBalance(value) {
        const num = Number(value) || 0;
        const formattedString = num.toLocaleString('es-ES', {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4
        });
        const parts = formattedString.split(',');
        if (parts.length === 2) {
            return `${parts[0]},<span class="decimal-part">${parts[1]}</span>`;
        }
        return formattedString;
    }

    // Función helper para formatear porcentajes con decimales significativos cuando es menor a 0.1% pero mayor a 0
    function formatPercentage(raised, goal) {
        if (!goal || goal <= 0) return '0.0';
        if (raised <= 0) return '0.0';
        
        const pct = (raised / goal) * 100;
        if (pct >= 0.1) {
            return pct.toFixed(1);
        }
        
        const pctStr = pct.toFixed(10);
        const match = pctStr.match(/^0\.0*[1-9]/);
        if (match) {
            return match[0];
        }
        return pct.toFixed(6).replace(/\.?0+$/, '');
    }

    // --- Configuration ---
    const API_URL = getApiUrl();
    const storedUsername = localStorage.getItem('username');

    // --- DOM Elements ---
    const elements = {
        usernameDisplay: document.getElementById('usernameDisplay'),
        profileTrigger: document.querySelector('.profile-trigger'),
        profileDropdown: document.getElementById('profileDropdown'),
        notificationTrigger: document.querySelector('.notification-trigger'),
        notificationDropdown: document.getElementById('notificationDropdown'),
        notificationBadge: document.getElementById('notificationBadge'),
        logoutLink: document.getElementById('logoutLink'),
        publicationsList: document.getElementById('publications-list'),
        publicationFilterChips: document.getElementById('publicationFilterChips'),
        publicationSortSelect: document.getElementById('publicationSortSelect'),
        publicationSearchInput: document.getElementById('publicationSearchInput'),
        publicationSearchClear: document.getElementById('publicationSearchClear'),
        saldoBlue: document.getElementById('saldoBlue'),
        saldoRed: document.getElementById('saldoRed'),
        ratingModal: document.getElementById('ratingModal'),
        ratingForm: document.getElementById('ratingForm'),
        publicationTypeModal: document.getElementById('publicationTypeModal'),
        openPublicationModalBtn: document.getElementById('openPublicationModalBtn'),
        closePublicationTypeModalBtn: document.querySelector('.publication-type-close'),
        debtCountdownContainer: document.getElementById('debt-countdown-container'),
        debtCountdownText: document.getElementById('debt-countdown-text'),
        escrowCountdownContainer: document.getElementById('escrow-countdown-container'),
        escrowCountdownText: document.getElementById('escrow-countdown-text'),
        availableCountdownContainer: document.getElementById('available-countdown-container'),
        availableCountdownText: document.getElementById('available-countdown-text'),
        publicationsCount: document.getElementById('publicationsCount'),
        boosterSummary: document.getElementById('boosterSummary'),
        boosterTotalBlue: document.getElementById('boosterTotalBlue'),
        boosterProgressText: document.getElementById('boosterProgressText'),
        boosterProgressFill: document.getElementById('boosterProgressFill'),
        // Wallet Tabs
        tabImpulsor: document.getElementById('tabImpulsor'),
        tabBilletera: document.getElementById('tabBilletera'),
        panelImpulsor: document.getElementById('panelImpulsor'),
        panelBilletera: document.getElementById('panelBilletera'),
        createPostPrelaunchModal: document.getElementById('createPostPrelaunchModal'),
        createPostPrelaunchAccept: document.getElementById('createPostPrelaunchAccept'),
        myWalletAddressContainer: document.getElementById('myWalletAddressContainer'),
        myWalletAddressText: document.getElementById('myWalletAddressText'),
        copyMyWalletBtn: document.getElementById('copyMyWalletBtn')
    };

    // Intervals for countdowns
    let debtCountdownInterval = null;
    let escrowCountdownInterval = null;
    let availableCountdownInterval = null;
    let lastBoosterFetch = 0;
    let lastSolidarioFetch = 0;
    let platformSettingsCache = null;
    let publicationsCache = [];
    // Caché persistente de ratings por usuario — sobrevive entre renderizados
    // para evitar peticiones HTTP redundantes al cambiar filtro/orden/búsqueda.
    // Se invalida solo cuando se recargan las publicaciones desde el servidor.
    const userRatingsCache = new Map();
    // Filtro activo para publicaciones ('all' | 'pending' | 'request' | 'sell' | 'donation')
    let currentFilter = 'all';
    // Texto de búsqueda activo (normalizado a minúsculas)
    let currentSearchText = '';
    let searchDebounceTimer = null;
    let legalStatus = {
        requires_terms_acceptance: false,
        pending_documents: []
    };

    // --- Initialize ---
    if (!storedUsername) {
        showCustomAlert('Debes iniciar sesión para acceder a esta página.', () => {
            window.location.href = 'index.html';
        });
        return;
    }

    if (elements.usernameDisplay) {
        elements.usernameDisplay.textContent = storedUsername;
    }
    function setCriticalActionButtonsDisabled(disabled) {
        const ids = ['openPublicationModalBtn', 'openQuickSaleModalBtn'];
        ids.forEach((id) => {
            const button = document.getElementById(id);
            if (!button) return;
            button.disabled = !!disabled;
            button.style.opacity = disabled ? '0.55' : '';
            button.style.cursor = disabled ? 'not-allowed' : '';
            if (disabled) {
                button.title = 'Debes aceptar los documentos legales vigentes para habilitar esta acción.';
            } else {
                button.removeAttribute('title');
            }
        });
    }

    function renderLegalAcceptanceBanner() {
        const existingBanner = document.getElementById('legal-acceptance-banner');
        if (!legalStatus.requires_terms_acceptance) {
            if (existingBanner) existingBanner.remove();
            setCriticalActionButtonsDisabled(false);
            return;
        }

        const banner = existingBanner || document.createElement('div');
        banner.id = 'legal-acceptance-banner';

        // Estándar de seguridad: si no hay documentos o hay error de configuración en DB, bloqueamos técnicamente
        if (legalStatus.legal_config_error === 'NO_ACTIVE_LEGAL_DOCUMENTS' || !legalStatus.pending_documents || legalStatus.pending_documents.length === 0) {
            banner.style.background = '#f8d7da';
            banner.style.color = '#721c24';
            banner.style.border = '1px solid #f5c6cb';
            banner.style.borderRadius = '10px';
            banner.style.padding = '12px';
            banner.style.margin = '12px auto';
            banner.style.maxWidth = '1200px';
            banner.innerHTML = `
                <strong>Bloqueo de Seguridad Técnico:</strong>
                El servidor no tiene configurados documentos legales activos. Las operaciones de la plataforma están deshabilitadas temporalmente por seguridad. Por favor, contacte soporte.
            `;
            if (!existingBanner) {
                const rootContainer = document.querySelector('.container') || document.body;
                rootContainer.prepend(banner);
            }
            setCriticalActionButtonsDisabled(true);
            return;
        }

        // Si requiere aceptación y aún no se ha lanzado automáticamente en esta carga de página:
        if (!window.qaModalShownOnLoad) {
            window.qaModalShownOnLoad = true;
            // Lanzamos el modal de una vez, bloqueando la pantalla con el modal glassmorphic premium
            window.showLegalAcceptanceModal(
                legalStatus.pending_documents,
                (payload) => {
                    legalStatus = {
                        requires_terms_acceptance: !!payload.requires_terms_acceptance,
                        pending_documents: payload.pending_documents || [],
                        legal_config_error: payload.legal_config_error || null
                    };
                    renderLegalAcceptanceBanner();
                    showCustomAlert('Aceptación legal registrada correctamente. Ya puedes operar con normalidad.');
                },
                () => {
                    console.log('[LEGAL] Modal automático cancelado. Mostrando recordatorio secundario.');
                    renderWarningBannerReminder();
                }
            );
        } else {
            // Si el usuario canceló el modal automático, dejamos el banner de recordatorio secundario arriba
            renderWarningBannerReminder();
        }

        function renderWarningBannerReminder() {
            banner.style.background = '#fff3cd';
            banner.style.color = '#5f370e';
            banner.style.border = '1px solid #ffe69c';
            banner.style.borderRadius = '10px';
            banner.style.padding = '12px';
            banner.style.margin = '12px auto';
            banner.style.maxWidth = '1200px';
            banner.innerHTML = `
                <strong>Tienes documentos legales pendientes de aceptar.</strong>
                Para habilitar todas las operaciones de WintonCoin, por favor firma los términos vigentes.
                <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                    <button id="accept-legal-docs-btn" class="btn">Revisar y Aceptar Términos</button>
                </div>
            `;

            if (!existingBanner) {
                const rootContainer = document.querySelector('.container') || document.body;
                rootContainer.prepend(banner);
            }

            const acceptBtn = document.getElementById('accept-legal-docs-btn');
            if (acceptBtn) {
                acceptBtn.onclick = () => {
                    window.showLegalAcceptanceModal(
                        legalStatus.pending_documents,
                        (payload) => {
                            legalStatus = {
                                requires_terms_acceptance: !!payload.requires_terms_acceptance,
                                pending_documents: payload.pending_documents || [],
                                legal_config_error: payload.legal_config_error || null
                            };
                            renderLegalAcceptanceBanner();
                            showCustomAlert('Aceptación legal registrada correctamente. Ya puedes operar con normalidad.');
                        },
                        () => {
                            console.log('[LEGAL] Cancelado nuevamente.');
                        }
                    );
                };
            }
            setCriticalActionButtonsDisabled(true);
        }
    }

    async function loadLegalStatus() {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const response = await fetch(`${API_URL}/api/legal/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                throw new Error('No se pudo verificar el estado legal.');
            }
            const payload = await response.json();
            legalStatus = {
                requires_terms_acceptance: !!payload.requires_terms_acceptance,
                pending_documents: payload.pending_documents || [],
                legal_config_error: payload.legal_config_error || null
            };
            renderLegalAcceptanceBanner();
        } catch (error) {
            console.error('[Legal] Error consultando estado legal:', error);
        }
    }

    // Show cached balances immediately
    if (elements.saldoBlue) elements.saldoBlue.innerHTML = formatBalance(localStorage.getItem('blue_balance'));
    if (elements.saldoRed) elements.saldoRed.innerHTML = formatBalance(localStorage.getItem('red_balance'));

    // Load data
    loadLegalStatus();
    loadAllData();
    setupDropdowns();
    setupEventListeners();
    checkPublicationPermissions();
    loadReferralSettings();
    setupShareReferral();
    fetchMomentumProfileStatus(); // Dynamic Momentum Button Check

    initPWAInstall(); // Inicializar botón de instalación PWA

    initializeNotificationSettings();
    initSettingsInstallButton(); // Inicializar botón "Descargar App" en modal de Configuración
    setupWalletTabs(); // Configurar listeners
    setupVenezuelaEmergencyCampaign(); // Campaña humanitaria Venezuela

    // SECUENCIA DE INICIO ORQUESTADA
    // 1. Notificaciones -> 2. Modal Global -> 3. Estado Billetera/Modal -> 4. Tour
    initNotificationGate()
        .then(() => initializeGlobalInterstitial())
        .then(() => initializeWalletState())
        .then(() => {
            setTimeout(initOnboarding, 500);
        });

    // =========================================================================
    // POLLING INTELIGENTE CON CONTROL DE VISIBILIDAD
    // =========================================================================
    // Usa la Page Visibility API (W3C estándar) para:
    // - Pausar el polling cuando el tab está oculto (ahorro batería/datos/servidor)
    // - Reanudar automáticamente al volver al tab con refresh inmediato
    // - Intervalo configurable: 10s activo, 0 cuando oculto
    //
    // Referencia: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
    // =========================================================================
    const POLLING_INTERVAL_MS = 10000; // 10 segundos cuando el tab está visible
    let pollingIntervalId = null;

    /**
     * Inicia el ciclo de polling periódico.
     * Solo se ejecuta si no hay ya un ciclo activo (idempotente).
     */
    function startPolling() {
        if (pollingIntervalId) return; // Ya está corriendo, evitar duplicados
        pollingIntervalId = setInterval(loadAllData, POLLING_INTERVAL_MS);
    }

    /**
     * Detiene el ciclo de polling periódico.
     * Limpia el interval y resetea el ID para permitir reinicio.
     */
    function stopPolling() {
        if (pollingIntervalId) {
            clearInterval(pollingIntervalId);
            pollingIntervalId = null;
        }
    }

    /**
     * Handler del evento visibilitychange.
     * Cuando el usuario vuelve al tab, hace un refresh inmediato
     * y reinicia el polling. Cuando se va, lo detiene.
     */
    function handleVisibilityChange() {
        if (document.hidden) {
            // Tab oculto: pausar polling para ahorrar recursos
            stopPolling();
        } else {
            // Tab visible de nuevo: refresh inmediato + reiniciar ciclo
            loadAllData();
            startPolling();
        }
    }

    // Registrar listener de visibilidad y arrancar polling inicial
    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPolling();

    // --- Functions ---
    async function getPlatformSettings() {
        if (platformSettingsCache) return platformSettingsCache;
        try {
            const response = await fetch(`${API_URL}/api/platform-settings`);
            if (!response.ok) throw new Error('No se pudo cargar la configuración.');
            platformSettingsCache = await response.json();
            return platformSettingsCache;
        } catch (error) {
            console.error(error);
            return {
                pre_launch_mode_enabled: false,
                allow_request_publications: true,
                allow_sell_publications: true,
                allow_donation_publications: true
            };
        }
    }

    async function fetchMomentumProfileStatus() {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const response = await fetch(`${API_URL}/api/momentum/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const profile = await response.json();
                // Check if profile.username matches storedUsername to prevent multi-tab localstorage leaks
                if (profile && profile.username === storedUsername && profile.tier !== 'PENDIENTE' && profile.tier !== 'RECHAZADO') {
                    const momentumLink = document.getElementById('momentumMenuLink');
                    if (momentumLink) {
                        momentumLink.style.display = 'block';
                    }
                }
            }
        } catch (error) {
            console.error('[Momentum] Error checking profile status:', error);
        }
    }

    async function checkPublicationPermissions() {
        const settings = await getPlatformSettings();
        const modal = document.getElementById('publicationTypeModal');
        if (!modal) return;

        const requestOption = modal.querySelector('.modal-option-button.request');
        const sellOption = modal.querySelector('.modal-option-button.sell');
        const donationOption = modal.querySelector('.modal-option-button.donation');

        // Determinar si el usuario actual es la cuenta oficial de la plataforma
        const currentUser = (localStorage.getItem('username') || '').toLowerCase();
        const platformUser = (settings.platform_username || 'wintoncoin').toLowerCase();
        const isPlatform = currentUser === platformUser || currentUser === 'plataforma';

        // En pre-lanzamiento, las publicaciones de tipo request y sell están deshabilitadas para usuarios normales.
        const allowRequest = settings.pre_launch_mode_enabled ? isPlatform : settings.allow_request_publications;
        const allowSell = settings.pre_launch_mode_enabled ? isPlatform : settings.allow_sell_publications;
        const allowDonation = settings.allow_donation_publications;

        const toggleOption = (element, isEnabled, type) => {
            if (!element) return;
            element.classList.toggle('disabled', !isEnabled);
            if (!isEnabled) {
                element.style.cursor = 'not-allowed';
                const newElement = element.cloneNode(true);
                element.parentNode.replaceChild(newElement, element);
                newElement.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            } else {
                element.style.cursor = 'pointer';
                const newElement = element.cloneNode(true);
                element.parentNode.replaceChild(newElement, element);
                newElement.addEventListener('click', (e) => {
                    e.preventDefault();
                    setTimeout(() => {
                        if (type === 'donation' && settings.pre_launch_mode_enabled) {
                            window.location.href = 'solicitud-solidaria.html';
                        } else {
                            window.location.href = `publish.html?type=${type}`;
                        }
                    }, 50);
                });
            }
        };

        toggleOption(requestOption, allowRequest, 'request');
        toggleOption(sellOption, allowSell, 'sell');
        toggleOption(donationOption, allowDonation, 'donation');

        // Quick sale button
        const quickSaleBtn = document.getElementById('openQuickSaleModalBtn');
        if (quickSaleBtn) {
            quickSaleBtn.style.display = (settings.allow_quick_sale_publications === false || (settings.pre_launch_mode_enabled && !isPlatform)) ? 'none' : 'inline-flex';
        }
    }

    function loadAllData() {
        fetchAndDisplayPublications();
        fetchNotifications();
        fetchAndDisplayBalances();
        fetchBoosterSummary();
        fetchSolidarioSummary();
    }
    // Exponer globalmente
    window.loadAllData = loadAllData;

    function setupDropdowns() {
        const setup = (trigger, dropdown) => {
            if (!trigger || !dropdown) return;
            trigger.addEventListener('click', (event) => {
                event.stopPropagation();
                const isOpening = !dropdown.classList.contains('show');
                closeAllDropdowns();
                if (isOpening) dropdown.classList.toggle('show');
            });
        };
        setup(elements.profileTrigger, elements.profileDropdown);
        setup(elements.notificationTrigger, elements.notificationDropdown);
    }

    function closeAllDropdowns() {
        if (elements.profileDropdown) elements.profileDropdown.classList.remove('show');
        if (elements.notificationDropdown) elements.notificationDropdown.classList.remove('show');
    }

    // --- Wallet Tabs (Impulsor / Billetera) ---
    // --- Wallet Tabs & Initialization ---
    function showPrelaunchModal() {
        const modal = document.getElementById('prelaunchWalletModal');
        if (modal) modal.style.display = 'flex';
    }

    function hidePrelaunchModal() {
        const modal = document.getElementById('prelaunchWalletModal');
        if (modal) modal.style.display = 'none';
    }

    function switchToTab(tabName) {
        const { tabImpulsor, tabBilletera, panelImpulsor, panelBilletera } = elements;

        if (tabImpulsor) tabImpulsor.classList.toggle('active', tabName === 'impulsor');
        if (tabBilletera) tabBilletera.classList.toggle('active', tabName === 'billetera');
        if (panelImpulsor) panelImpulsor.classList.toggle('active', tabName === 'impulsor');
        if (panelBilletera) panelBilletera.classList.toggle('active', tabName === 'billetera');

        // Show modal when switching to Billetera, UNLESS suppressed
        if (tabName === 'billetera') {
            const isSuppressed = sessionStorage.getItem('suppressWalletModal') === 'true';
            if (!isSuppressed) {
                showPrelaunchModal();
            }
        }
        localStorage.setItem('walletActiveTab', tabName);
    }

    function setupWalletTabs() {
        const { tabImpulsor, tabBilletera } = elements;
        const prelaunchAcceptBtn = document.getElementById('prelaunchModalAccept');

        if (tabImpulsor) tabImpulsor.addEventListener('click', () => switchToTab('impulsor'));
        if (tabBilletera) tabBilletera.addEventListener('click', () => switchToTab('billetera'));

        if (prelaunchAcceptBtn) {
            prelaunchAcceptBtn.addEventListener('click', hidePrelaunchModal);
        }
    }

    /**
     * Campaña Humanitaria de Emergencia (Terremoto en Venezuela) - Opción 3
     * Muestra un modal detallado con la bandera de Venezuela y el edificio colapsado.
     * Si se descarta, oculta el modal y muestra un banner de recordatorio persistente.
     * Si se hace clic en donar, filtra las publicaciones por "donación" y hace scroll.
     * Respeta la experiencia del usuario limitando la aparición de modals a 24 horas usando localStorage.
     */
    function setupVenezuelaEmergencyCampaign() {
        const modal = document.getElementById('venezuelaEmergencyModal');
        const banner = document.getElementById('venezuelaEmergencyBanner');
        const donateBtn = document.getElementById('venezuelaEmergencyDonateBtn');
        const closeBtn = document.getElementById('venezuelaEmergencyCloseBtn');
        const bannerBtn = document.getElementById('emergencyBannerBtn');
        const closeBannerBtn = document.getElementById('closeEmergencyBanner');

        if (!modal || !banner) return;

        const DAY_IN_MS = 24 * 60 * 60 * 1000;
        const now = Date.now();
        const dismissedTime = localStorage.getItem('venezuelaEmergencyDismissed');
        const bannerDismissedTime = localStorage.getItem('venezuelaEmergencyBannerDismissed');

        const isModalDismissed = dismissedTime && (now - parseInt(dismissedTime) < DAY_IN_MS);
        const isBannerDismissed = bannerDismissedTime && (now - parseInt(bannerDismissedTime) < DAY_IN_MS);

        // Función para aplicar filtro "donación" y hacer scroll al feed
        function goToDonations() {
            // Cerrar modal o banner
            modal.style.display = 'none';
            banner.style.display = 'none';

            // Guardar que fue atendido/descartado por hoy
            localStorage.setItem('venezuelaEmergencyDismissed', now.toString());

            // Seleccionar filtro donación
            const donationChip = document.querySelector('.filter-chip[data-filter="donation"]');
            if (donationChip) {
                // Simular el click para aplicar los filtros correctamente
                donationChip.click();
            }

            // Scroll suave hacia la sección de publicaciones
            const publicationsSection = document.querySelector('.publications-section');
            if (publicationsSection) {
                publicationsSection.scrollIntoView({ behavior: 'smooth' });
            }
        }

        // Lógica de visualización
        if (!isModalDismissed) {
            // Mostrar modal
            modal.style.display = 'flex';
        } else if (!isBannerDismissed) {
            // Mostrar banner
            banner.style.display = 'block';
        }

        // Configurar listeners de eventos
        if (donateBtn) {
            donateBtn.addEventListener('click', goToDonations);
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                localStorage.setItem('venezuelaEmergencyDismissed', now.toString());
                
                // Mostrar el banner sutil como recordatorio secundario
                if (!isBannerDismissed) {
                    banner.style.display = 'block';
                }
            });
        }

        if (bannerBtn) {
            bannerBtn.addEventListener('click', goToDonations);
        }

        if (closeBannerBtn) {
            closeBannerBtn.addEventListener('click', () => {
                banner.style.display = 'none';
                localStorage.setItem('venezuelaEmergencyBannerDismissed', now.toString());
            });
        }
    }

    function initializeWalletState() {
        return new Promise((resolve) => {
            getPlatformSettings().then(settings => {
                const isPreLaunch = settings?.pre_launch_mode_enabled === true || settings?.pre_launch_mode_enabled === 'true';
                const urlParams = new URLSearchParams(window.location.search);
                const isWalletTour = urlParams.get('start_wallet_tour') === 'true';
                const isPendingTour = sessionStorage.getItem('pendingWalletTour') === 'true';

                let targetTab = 'billetera'; // Default fallback

                if (isWalletTour || isPendingTour) {
                    if (isPendingTour) sessionStorage.setItem('suppressWalletModal', 'true');
                    targetTab = 'billetera';
                } else if (isPreLaunch) {
                    targetTab = 'impulsor';
                } else {
                    targetTab = localStorage.getItem('walletActiveTab') || 'billetera';
                }

                // Ejecutar cambio
                switchToTab(targetTab);

                // Si se abrió el modal (es billetera y no suprimido), esperar a que se cierre
                const modal = document.getElementById('prelaunchWalletModal');
                const btn = document.getElementById('prelaunchModalAccept');

                if (targetTab === 'billetera' && modal && modal.style.display !== 'none' && btn) {
                    // Hookear cierre para resolver promesa
                    const resolveHandler = () => {
                        btn.removeEventListener('click', resolveHandler);
                        resolve();
                    };
                    btn.addEventListener('click', resolveHandler);
                } else {
                    resolve();
                }
            }).catch(error => {
                console.warn('[WalletTabs] Error inicializando, default a Impulsor:', error);
                switchToTab('impulsor');
                resolve();
            });
        });
    }

    function setupEventListeners() {
        window.addEventListener('click', closeAllDropdowns);

        if (elements.logoutLink) {
            elements.logoutLink.addEventListener('click', handleLogout);
        }

        if (elements.copyMyWalletBtn) {
            elements.copyMyWalletBtn.addEventListener('click', function() {
                const fullAddress = this.dataset.address;
                if (!fullAddress) return;
                copyTextToClipboard(fullAddress).then(() => {
                    const originalHTML = this.innerHTML;
                    this.innerHTML = '<span style="font-size:12px; font-weight:bold; color:#059669;">✓ Copiado</span>';
                    setTimeout(() => {
                        this.innerHTML = originalHTML;
                    }, 2000);
                }).catch(err => {
                    console.error('Error al copiar la billetera: ', err);
                });
            });
        }

        if (elements.publicationsList) {
            elements.publicationsList.addEventListener('click', handlePublicationAction);
        }

        // Listener para chips de filtro (event delegation en el contenedor)
        if (elements.publicationFilterChips) {
            elements.publicationFilterChips.addEventListener('click', handleFilterChipClick);
            
            // [UX / Desktop] Traducir scroll vertical de la rueda del mouse a desplazamiento horizontal
            // para permitir navegación fluida en computadoras de escritorio sin pantalla táctil.
            // Se deshabilita el comportamiento pasivo (passive: false) para permitir que evt.preventDefault() funcione,
            // y se normaliza el scroll del mouse (deltaMode) para evitar scroll extremadamente lento en Windows/Chrome.
            elements.publicationFilterChips.addEventListener('wheel', (evt) => {
                if (evt.deltaY === 0) return;
                evt.preventDefault(); // Detener el desplazamiento vertical nativo de la página
                
                // Normalización de desplazamiento según el tipo de delta (píxeles, líneas o páginas)
                let scrollAmount = 0;
                if (evt.deltaMode === 1) { // Modo de desplazamiento por líneas (común en ratones estándar en Windows)
                    scrollAmount = evt.deltaY * 33; // Multiplicar por una altura estimada de línea (33px)
                } else if (evt.deltaMode === 2) { // Modo de desplazamiento por páginas completas
                    scrollAmount = evt.deltaY * elements.publicationFilterChips.clientWidth;
                } else { // Modo de desplazamiento por píxeles directos
                    scrollAmount = evt.deltaY;
                }
                
                elements.publicationFilterChips.scrollLeft += scrollAmount;
            }, { passive: false });
        }

        // Listener para el selector de ordenamiento
        if (elements.publicationSortSelect) {
            elements.publicationSortSelect.addEventListener('change', renderPublicationsWithFilters);
        }

        // Listener para búsqueda en vivo (debounced)
        if (elements.publicationSearchInput) {
            elements.publicationSearchInput.addEventListener('input', handleSearchInput);
        }

        // Listener para el botón X de limpiar búsqueda
        if (elements.publicationSearchClear) {
            elements.publicationSearchClear.addEventListener('click', clearSearch);
        }



        if (elements.ratingForm) {
            elements.ratingForm.addEventListener('submit', handleRatingSubmit);
        }

        if (elements.openPublicationModalBtn) {
            elements.openPublicationModalBtn.addEventListener('click', async (event) => {
                event.preventDefault();

                // Verificar configuración de Pre-Lanzamiento
                const settings = await getPlatformSettings();

                if (settings.pre_launch_mode_enabled && elements.createPostPrelaunchModal) {
                    elements.createPostPrelaunchModal.style.display = 'flex';
                } else {
                    // Si NO es pre-lanzamiento, flujo normal directo
                    checkPublicationPermissions();
                    if (elements.publicationTypeModal) elements.publicationTypeModal.style.display = 'flex';
                }
            });
        }

        if (elements.createPostPrelaunchAccept) {
            elements.createPostPrelaunchAccept.addEventListener('click', () => {
                // Cerrar modal de aviso
                if (elements.createPostPrelaunchModal) {
                    elements.createPostPrelaunchModal.style.display = 'none';
                }
                // Continuar siempre con el flujo normal (mostrar opciones, aunque estén deshabilitadas)
                checkPublicationPermissions();
                if (elements.publicationTypeModal) elements.publicationTypeModal.style.display = 'flex';
            });
        }

        if (elements.closePublicationTypeModalBtn) {
            elements.closePublicationTypeModalBtn.addEventListener('click', () => {
                if (elements.publicationTypeModal) elements.publicationTypeModal.style.display = 'none';
            });
        }

        window.addEventListener('click', (event) => {
            if (event.target === elements.ratingModal && elements.ratingModal) elements.ratingModal.style.display = 'none';
            if (event.target === elements.publicationTypeModal && elements.publicationTypeModal) elements.publicationTypeModal.style.display = 'none';
            if (event.target === elements.createPostPrelaunchModal && elements.createPostPrelaunchModal) elements.createPostPrelaunchModal.style.display = 'none';
        });

        // Notification handlers
        if (elements.notificationDropdown) {
            elements.notificationDropdown.addEventListener('click', async (event) => {
                const dismissButton = event.target.closest('.notification-dismiss');
                const clearAllLink = event.target.closest('.notification-footer-link');
                if (dismissButton) {
                    event.preventDefault();
                    await dismissNotification(dismissButton.dataset.id);
                }
                if (clearAllLink) {
                    event.preventDefault();
                    await clearAllNotifications();
                }
            });
        }
    }

    /**
     * Maneja el click en los chips de filtro de publicaciones.
     * Usa event delegation: el listener está en el contenedor, no en cada chip.
     * Actualiza el estado visual (aria-pressed, clase active) y re-renderiza.
     */
    function handleFilterChipClick(event) {
        // Obtenemos el chip clickeado
        const chip = event.target.closest('.filter-chip');
        if (!chip || chip.classList.contains('active')) return;

        // Registramos el filtro previo y el nuevo para evaluar si es necesario hacer fetch
        const previousFilter = currentFilter;
        const newFilter = chip.dataset.filter;

        // Desactivar todos los chips para limpiar la visualización
        elements.publicationFilterChips.querySelectorAll('.filter-chip').forEach(c => {
            c.classList.remove('active');
            c.setAttribute('aria-pressed', 'false');
        });

        // Activar el chip seleccionado y marcar el estado accesible aria-pressed
        chip.classList.add('active');
        chip.setAttribute('aria-pressed', 'true');

        // Actualizar el estado del filtro activo en el módulo
        currentFilter = newFilter;

        // Si transicionamos desde o hacia el filtro "Ocultas" (hidden), debemos realizar una consulta
        // fresca al servidor (Lazy Loading) ya que los datasets son disjuntos (activos vs ocultados).
        // Para filtros ordinarios del feed activo, mantenemos la velocidad renderizando localmente en caché.
        if (previousFilter === 'hidden' || newFilter === 'hidden') {
            fetchAndDisplayPublications();
        } else {
            renderPublicationsWithFilters();
        }
    }

    /**
     * Búsqueda en vivo con debounce de 250ms.
     * Filtra publicaciones por título, descripción o autor mientras el usuario escribe.
     * El debounce evita re-renderizar en cada keystroke (rendimiento óptimo).
     */
    function handleSearchInput() {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            const input = elements.publicationSearchInput;
            currentSearchText = (input?.value || '').trim().toLowerCase();

            // Mostrar/ocultar botón X
            if (elements.publicationSearchClear) {
                elements.publicationSearchClear.style.display = currentSearchText ? 'flex' : 'none';
            }

            renderPublicationsWithFilters();
        }, 250);
    }

    /** Limpia el campo de búsqueda y re-renderiza la lista completa. */
    function clearSearch() {
        if (elements.publicationSearchInput) {
            elements.publicationSearchInput.value = '';
        }
        if (elements.publicationSearchClear) {
            elements.publicationSearchClear.style.display = 'none';
        }
        currentSearchText = '';
        renderPublicationsWithFilters();
    }

    function handleLogout(event) {
        event.preventDefault();
        localStorage.removeItem('username');
        localStorage.removeItem('blue_balance');
        localStorage.removeItem('escrow_blue_balance');
        localStorage.removeItem('red_balance');
        localStorage.removeItem('token');
        showCustomAlert('Has cerrado la sesión.', () => {
            window.location.href = 'index.html';
        });
    }

    async function handlePublicationAction(event) {
        const button = event.target.closest('[data-action]');
        if (!button) return;

        const pubId = button.dataset.id;
        const action = button.dataset.action;
        const userInAction = button.dataset.user;

        let endpoint, body = {};

        switch (action) {
            case 'accept':
                endpoint = `/publications/${pubId}/accept`;
                body = { acceptorUsername: storedUsername };
                await postToServer(endpoint, body);
                break;
            case 'approve':
                endpoint = `/publications/${pubId}/approve`;
                body = { approverUsername: storedUsername, userToApprove: userInAction };
                await postToServer(endpoint, body);
                break;
            case 'complete':
                endpoint = `/publications/${pubId}/complete`;
                body = { completerUsername: storedUsername };
                await postToServer(endpoint, body);
                break;
            case 'confirm-payment':
                const publicationElement = button.closest('.publication-item');
                const authorUsername = publicationElement?.dataset.author;
                await confirmPaymentAndRate(pubId, authorUsername, userInAction);
                break;
            case 'delete':
                showCustomConfirm('¿Deseas eliminar esta tarea?', async () => {
                    await deleteFromServer(`/publications/${pubId}`, { deleterUsername: storedUsername });
                });
                break;
            case 'discard':
                showCustomConfirm(`¿Descartar solicitud de ${userInAction}?`, async () => {
                    await postToServer(`/publications/${pubId}/discard`, { discarderUsername: storedUsername, userToDiscard: userInAction });
                });
                break;
            case 'toggle-pause':
                await postToServer(`/publications/${pubId}/toggle-pause`, { username: storedUsername });
                break;
            case 'hide':
                await postToServer(`/publications/${pubId}/hide`, { username: storedUsername });
                break;
        }
    }

    async function confirmPaymentAndRate(pubId, authorUsername, acceptorUsername) {
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${API_URL}/publications/${pubId}/confirm-payment`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ confirmerUsername: storedUsername, workerUsername: acceptorUsername })
            });
            const result = await response.json();

            if (response.ok) {
                showCustomAlert(result.message);
                loadAllData();
                openRatingModal(pubId, authorUsername, acceptorUsername);
            } else {
                showCustomAlert(result.message || "Error al confirmar el pago.");
            }
        } catch (error) {
            console.error('Error en confirmPaymentAndRate:', error);
            showCustomAlert('Error de red al confirmar el pago.');
        }
    }

    async function handleRatingSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const body = Object.fromEntries(formData.entries());

        try {
            await postToServer('/rate', body);
            if (elements.ratingModal) elements.ratingModal.style.display = 'none';
        } catch (error) {
            console.error("La calificación falló.", error);
        }
    }

    async function postToServer(endpoint, body, options = {}) {
        const { silent = false, reload = true } = options;
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            if (handleSessionExpired(response)) return null;

            const responseText = await response.text();
            let result;

            try {
                result = JSON.parse(responseText);
            } catch (e) {
                console.error("Respuesta no-JSON:", responseText);
                showCustomAlert(responseText || 'Error inesperado.');
                throw new Error("Respuesta no-JSON");
            }

            if (!response.ok) {
                // Interceptar bloqueo legal (403 LEGAL_ACCEPTANCE_REQUIRED)
                if (response.status === 403 && result.code === 'LEGAL_ACCEPTANCE_REQUIRED') {
                    return new Promise((resolve, reject) => {
                        window.showLegalAcceptanceModal(
                            result.pending_documents,
                            async (acceptResult) => {
                                console.log('[LEGAL] Términos aceptados desde modal. Refrescando UI y reintentando...');
                                
                                // Refrescar estado local del dashboard
                                if (typeof loadLegalStatus === 'function') {
                                    await loadLegalStatus();
                                }
                                
                                // Reintentar la llamada original de forma transparente
                                try {
                                    const retryResult = await postToServer(endpoint, body, options);
                                    resolve(retryResult);
                                } catch (retryErr) {
                                    reject(retryErr);
                                }
                            },
                            () => {
                                // Flujo cancelado por el usuario
                                reject(new Error('Acción bloqueada: Debes aceptar los términos y condiciones vigentes.'));
                            }
                        );
                    });
                }

                showCustomAlert(result.message || `Error: ${response.status}`);
                throw new Error(result.message);
            }

            if (!silent && result.message) {
                showCustomAlert(result.message);
            }

            if (response.ok && reload) {
                loadAllData();
            }

            return result;
        } catch (error) {
            console.error(`Error en postToServer (${endpoint}):`, error);
            return Promise.reject(error);
        }
    }

    async function deleteFromServer(endpoint, body) {
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'DELETE',
                headers,
                body: JSON.stringify(body)
            });
            const result = await response.json();
            showCustomAlert(result.message);
            if (response.ok) loadAllData();
        } catch (error) {
            console.error('Error en deleteFromServer:', error);
            showCustomAlert('Error de red al eliminar.');
        }
    }

    // --- Publications ---
    async function fetchAndDisplayPublications() {
        if (!elements.publicationsList) return;

        try {
            // Construimos dinámicamente la query string de forma segura.
            // Si el filtro actual es 'hidden', añadimos el parámetro correspondiente para el lazy loading.
            const filterParam = currentFilter === 'hidden' ? '&filter=hidden' : '';
            const response = await fetch(`${API_URL}/publications/active?user=${storedUsername}${filterParam}`);
            
            if (!response.ok) {
                elements.publicationsList.innerHTML = '<p>Error al cargar las publicaciones.</p>';
                return;
            }
            const publications = await response.json();

            // Descargar causas humanitarias aprobadas (Winton Solidario) para mostrarlas en el marketplace general
            let causes = [];
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const responseCauses = await fetch(`${API_URL}/api/humanitarian/causes/approved`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (responseCauses.ok) {
                        const dataCauses = await responseCauses.json();
                        if (dataCauses.success) {
                            causes = dataCauses.causes || [];
                        }
                    }
                } catch (err) {
                    console.error('[Solidario] Error al obtener causas aprobadas para el marketplace:', err);
                }
            }

            // Aplicar filtrado de ocultas locales mediante localStorage
            const hiddenCausesKey = `hidden_causes_${storedUsername}`;
            const hiddenCauseIds = JSON.parse(localStorage.getItem(hiddenCausesKey) || '[]');
            
            const filteredCauses = causes.filter(c => {
                const isHidden = hiddenCauseIds.includes(c.id);
                return currentFilter === 'hidden' ? isHidden : !isHidden;
            });

            // Mapear causas a objetos virtuales que sean compatibles con el feed de publicaciones
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
                category: 'donation', // Chip de filtrado 'Donaciones'
                is_humanitarian_cause: true,
                available_slots: 1,
                blue_cost: 0
            }));

            // Combinar e inyectar causas mapeadas en el caché de publicaciones
            publicationsCache = [...mappedCauses, ...publications];

            // Lógica UX de estado vacío diferenciado para una experiencia premium
            if (publicationsCache.length === 0) {
                if (currentFilter === 'hidden') {
                    // Estado vacío específico para la pestaña de publicaciones archivadas/ocultas
                    elements.publicationsList.innerHTML = `
                        <div class="empty-state-container">
                            <div class="empty-state-icon">📁</div>
                            <h3>No tienes publicaciones ocultas</h3>
                            <p>Las publicaciones que decidas ocultar con el botón 'X' aparecerán aquí para que puedas recuperarlas.</p>
                        </div>
                    `;
                } else {
                    // Estado vacío por defecto para el mercado principal
                    elements.publicationsList.innerHTML = `
                        <div class="empty-state-container">
                            <div class="empty-state-icon">🚀</div>
                            <h3>¡El mercado está tranquilo!</h3>
                            <p>Es el momento perfecto para definir la economía.</p>
                            <button onclick="document.getElementById('openPublicationModalBtn').click()" class="action-button primary-action pulse-animation">
                                Crear la Primera Publicación
                            </button>
                        </div>
                    `;
                }
                updatePublicationsCount([]);
                return;
            }

            // Invalidar caché de ratings al traer datos frescos del servidor
            userRatingsCache.clear();
            await renderPublicationsWithFilters();
        } catch (error) {
            console.error('Error al obtener publicaciones:', error);
            elements.publicationsList.innerHTML = '<p>No se pudo conectar con el servidor.</p>';
        }
    }

    async function renderPublicationsWithFilters() {
        if (!elements.publicationsList) return;

        const filteredPublications = applySortAndFilter(publicationsCache);
        if (filteredPublications.length === 0) {
            elements.publicationsList.innerHTML = '<p class="empty-message">No hay publicaciones para este filtro.</p>';
            updatePublicationsCount([]);
            return;
        }

        updatePublicationsCount(filteredPublications);
        const platformSettings = await getPlatformSettings();

        // Obtener ratings faltantes en paralelo (usa caché persistente a nivel de módulo)
        const missingAuthors = filteredPublications
            .map(pub => pub.author_username)
            .filter(username => !userRatingsCache.has(username));
        const uniqueMissing = [...new Set(missingAuthors)];

        if (uniqueMissing.length > 0) {
            const fetched = await Promise.all(
                uniqueMissing.map(username => fetchUserRating(username).then(data => ({ username, data })))
            );
            fetched.forEach(({ username, data }) => userRatingsCache.set(username, data));
        }

        // Generar HTML — todos los ratings ya están en caché, sin llamadas HTTP
        const publicationsHTML = filteredPublications.map(pub => {
            const authorRating = userRatingsCache.get(pub.author_username) || { average: 0, count: 0 };
            const authorRatingHTML = generateStarRating(authorRating.average, authorRating.count);

            const blueLabel = getBlueUnitLabel(pub, platformSettings);
            return getPublicationCardHTML(pub, blueLabel, authorRatingHTML);
        });

        elements.publicationsList.innerHTML = publicationsHTML.join('');
    }

    // Genera el HTML de estrellas para una calificación
    function generateStarRating(rating, count) {
        if (count === 0) {
            return '';
        }

        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5 ? 1 : 0;
        const emptyStars = 5 - fullStars - halfStar;
        let starsHTML = '';

        for (let i = 0; i < fullStars; i++) starsHTML += '★';
        if (halfStar) starsHTML += '½';
        for (let i = 0; i < emptyStars; i++) starsHTML += '☆';

        return `<span class="stars">${starsHTML}</span> <span class="rating-count">(${count})</span>`;
    }

    // Obtiene la calificación de un usuario desde el servidor
    async function fetchUserRating(username) {
        try {
            const response = await fetch(`${API_URL}/user/${username}`);
            if (!response.ok) {
                console.warn(`Could not fetch rating for user ${username}. Status: ${response.status}`);
                return { average: 0, count: 0 };
            }
            const data = await response.json();
            return { average: data.average_rating, count: data.ratings_count };
        } catch (error) {
            console.error(`Error fetching rating for ${username}:`, error);
            return { average: 0, count: 0 };
        }
    }

    /**
     * Aplica filtro por tipo y ordenamiento como responsabilidades separadas.
     * Paso 1: Filtra según el chip activo (currentFilter).
     * Paso 2: Ordena según el select de ordenamiento (publicationSortSelect).
     * Paso 3: Siempre prioriza tareas pendientes del usuario al tope.
     *
     * @param {Array} publications - Array completo de publicaciones del caché.
     * @returns {Array} Publicaciones filtradas, ordenadas y priorizadas.
     */
    function applySortAndFilter(publications) {
        const activeFilter = currentFilter;
        const activeSort = elements.publicationSortSelect?.value || 'recent';
        let result = [...publications];

        // --- Paso 0: Aplicar búsqueda por texto (título, descripción, autor) ---
        if (currentSearchText) {
            result = result.filter(pub => {
                const title = (pub.title || '').toLowerCase();
                const description = (pub.description || '').toLowerCase();
                const author = (pub.author_username || '').toLowerCase();
                return title.includes(currentSearchText) ||
                    description.includes(currentSearchText) ||
                    author.includes(currentSearchText);
            });
        }

        // --- Paso 1: Aplicar filtro por tipo/estado ---
        if (activeFilter === 'pending') {
            result = result.filter(pub => isPendingForUser(pub));
        } else if (activeFilter === 'request' || activeFilter === 'sell' || activeFilter === 'donation') {
            result = result.filter(pub => getPublicationType(pub) === activeFilter);
        }
        // 'all' no filtra nada

        // --- Paso 2: Aplicar ordenamiento ---
        if (activeSort === 'recent' || activeSort === 'oldest') {
            result.sort((a, b) => {
                const diff = getPublicationTimestamp(b) - getPublicationTimestamp(a);
                return activeSort === 'recent' ? diff : -diff;
            });
        } else if (activeSort === 'reward_desc' || activeSort === 'reward_asc') {
            result.sort((a, b) => {
                const diff = (Number(b.blue_cost) || 0) - (Number(a.blue_cost) || 0);
                return activeSort === 'reward_desc' ? diff : -diff;
            });
        }

        // --- Paso 3: Tareas en proceso del usuario siempre flotan al tope ---
        return sortByPendingPriority(result);
    }

    // Determina si una publicación requiere atención del usuario
    function isPendingForUser(pub) {
        // Como participante
        const status = pub.user_acceptance_status;
        if (status === 'approved' || status === 'pending_approval' || status === 'completed') {
            return true;
        }
        // Como autor con acciones pendientes
        if (pub.author_username === storedUsername && pub.participants) {
            const hasPendingActions = pub.participants.some(p =>
                p.status === 'pending_approval' || p.status === 'completed'
            );
            if (hasPendingActions) return true;
        }
        return false;
    }

    // Asigna prioridad según estado (menor número = mayor prioridad)
    function getPendingPriority(pub) {
        // Prioridad máxima absoluta para causas humanitarias (flotan al inicio del feed)
        if (pub.is_humanitarian_cause) return -1;

        const isAuthor = pub.author_username === storedUsername;

        // --- PRIORIDAD DEL AUTOR ---
        if (isAuthor && pub.participants && pub.participants.length > 0) {
            const hasPendingApproval = pub.participants.some(p => p.status === 'pending_approval');
            const hasPendingPayment = pub.participants.some(p => p.status === 'completed');

            // Autor con participantes por aprobar = máxima prioridad
            if (hasPendingApproval) return 0;
            // Autor con participantes por pagar = alta prioridad
            if (hasPendingPayment) return 1;
        }

        // --- PRIORIDAD DEL PARTICIPANTE ---
        const status = pub.user_acceptance_status;
        if (status === 'approved') return 2;        // Aprobado - puede realizar la tarea
        if (status === 'pending_approval') return 3; // Esperando aprobación
        if (status === 'completed') return 4;        // Completado - esperando confirmación

        return 5; // Sin estado o no participando
    }

    /**
     * Promueve las publicaciones con acciones pendientes del usuario al tope,
     * preservando el orden que el usuario eligió (fecha, recompensa, etc.)
     * para publicaciones de la misma prioridad.
     * Usa sort estable (ES2019+): items con igual prioridad mantienen su posición relativa.
     */
    function sortByPendingPriority(publications) {
        return [...publications].sort((a, b) => {
            return getPendingPriority(a) - getPendingPriority(b);
        });
    }

    function getPublicationType(pub) {
        if (pub.category === 'donation') return 'donation';
        if (pub.is_sell_post) return 'sell';
        return 'request';
    }

    function getPublicationTimestamp(pub) {
        const dateValue = pub.created_at || pub.createdAt;
        const date = dateValue ? new Date(dateValue) : null;
        if (date && !Number.isNaN(date.getTime())) return date.getTime();
        return Number(pub.id) || 0;
    }

    function updatePublicationsCount(publications) {
        if (elements.publicationsCount) {
            elements.publicationsCount.textContent = String((publications || []).length);
        }
    }

    function isPlatformPublication(pub, platformSettings) {
        const platformUsername = String(platformSettings?.platform_username || 'Plataforma WintonCoin').toLowerCase();
        const author = String(pub.author_username || '').toLowerCase();
        return author === platformUsername || author === 'plataforma';
    }

    function getBlueUnitLabel(pub, platformSettings) {
        if (platformSettings?.pre_launch_mode_enabled && isPlatformPublication(pub, platformSettings)) {
            return 'BLUE iou';
        }
        return 'BLUE';
    }

    /**
     * Genera un banner de estado para la tarjeta.
     * - Para el AUTOR: muestra conteo de participantes pendientes de aprobar/pagar
     * - Para PARTICIPANTES: muestra su estado actual
     * @param {object} pub La publicación.
     * @returns {string} El HTML del banner o un string vacío.
     */
    function getCardStatusMessageHTML(pub) {
        const isAuthor = pub.author_username === storedUsername;

        // --- VISTA DEL AUTOR ---
        if (isAuthor && pub.participants && pub.participants.length > 0) {
            const pendingApproval = pub.participants.filter(p => p.status === 'pending_approval').length;
            const pendingPayment = pub.participants.filter(p => p.status === 'completed').length;

            if (pendingApproval > 0 || pendingPayment > 0) {
                const parts = [];
                if (pendingApproval > 0) {
                    parts.push(`${pendingApproval} por aprobar`);
                }
                if (pendingPayment > 0) {
                    parts.push(`${pendingPayment} por pagar`);
                }
                const message = parts.join(' · ');
                return `<div class="publication-status-banner status-author-action">${message}</div>`;
            }
        }

        // --- VISTA DEL PARTICIPANTE ---
        const userStatus = pub.user_acceptance_status;
        let message = '';
        let className = '';

        if (userStatus === 'approved') {
            if (pub.is_sell_post) {
                message = 'Pendiente pago';
            } else {
                message = 'Puedes comenzar!';
            }
            className = 'status-approved';
        } else if (userStatus === 'completed') {
            if (pub.is_sell_post) {
                message = 'Esperando confirmación';
            } else {
                message = 'Esperando confirmación';
            }
            className = 'status-completed';
        } else if (userStatus === 'pending_approval') {
            message = 'Esperando aprobación';
            className = 'status-pending';
        }

        if (message) {
            return `<div class="publication-status-banner ${className}">${message}</div>`;
        }
        return '';
    }

    /**
     * Calcula y formatea el estado de expiración de una publicación.
     * @param {object} pub La publicación.
     * @returns {{html: string, isExpired: boolean}}
     */
    function getExpirationStatusHTML(pub) {
        if (!pub.expires_at) {
            return { html: '', isExpired: false };
        }

        const now = new Date();
        const expirationDate = new Date(pub.expires_at);
        const diff = expirationDate - now;

        if (diff <= 0) {
            return {
                html: `<div class="expiration-info expired"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Expirada</div>`,
                isExpired: true
            };
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        let timeLeft = '';
        if (days > 1) {
            timeLeft = `Vence en ${days} días`;
        } else if (days === 1) {
            timeLeft = `Vence en ${days} día`;
        } else if (hours > 1) {
            timeLeft = `Vence en ${hours} horas`;
        } else if (hours === 1) {
            timeLeft = `Vence en ${hours} hora`;
        } else if (minutes > 0) {
            timeLeft = `Vence en ${minutes} min`;
        } else {
            timeLeft = `Vence en <1 min`;
        }

        return {
            html: `<div class="expiration-info"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${timeLeft}</div>`,
            isExpired: false
        };
    }

    function getPublicationCardHTML(pub, blueLabel, ratingHTML = '') {
        const isDonation = pub.category === 'donation';
        const rewardText = isDonation ? `Meta: ${formatBalance(pub.goal_amount)} ${blueLabel}` : `${formatBalance(pub.blue_cost)} ${blueLabel}`;
        const statusMessageHTML = getCardStatusMessageHTML(pub);

        let ribbonClass = '';
        if (pub.is_booster_task) ribbonClass = 'booster-ribbon';
        else if (isDonation) ribbonClass = 'donation-ribbon';
        else if (pub.is_sell_post) ribbonClass = 'sell-ribbon';

        const slotsClass = pub.available_slots > 0 ? 'available' : 'full';
        const slotsText = isDonation
            ? 'Campaña Activa'
            : (pub.available_slots > 0 ? `${pub.available_slots} cupos` : 'Cupos agotados');

        const expirationInfo = getExpirationStatusHTML(pub);

        // XSS Prevention: escapar username antes de insertar en HTML y atributos
        const safeAuthor = escapeHtml(pub.author_username);
        const safeAuthorAttr = escapeAttr(pub.author_username);
        let authorNameHTML = '';

        if (pub.is_humanitarian_cause) {
            // En el feed no hacen falta enlaces para causas humanitarias, solo texto plano
            authorNameHTML = safeAuthor;
            
            if (pub.beneficiary_username && pub.beneficiary_username !== pub.author_username) {
                const safeBeneficiary = escapeHtml(pub.beneficiary_username);
                const safeFoundation = pub.foundation_name ? escapeHtml(pub.foundation_name) : '';
                const beneficiaryText = safeFoundation 
                    ? `${safeFoundation} @${safeBeneficiary}` 
                    : `@${safeBeneficiary}`;
                
                authorNameHTML = `${authorNameHTML} <span style="font-weight: normal; opacity: 0.7; font-size: 0.85em;">en beneficio de: ${beneficiaryText}</span>`;
            }
        } else {
            // Comportamiento normal con enlaces para tareas/ventas/etc.
            authorNameHTML = window.appSettings?.public_profiles_enabled
                ? `<a href="profile.html?user=${encodeURIComponent(pub.author_username)}" class="profile-link" onclick="event.stopPropagation()">${safeAuthor}</a>`
                : safeAuthor;
        }

        // Lógica de Barra de Progreso para Donaciones
        let progressHTML = '';
        if (isDonation) {
            const current = parseFloat(pub.current_amount || 0);
            const goal = parseFloat(pub.goal_amount || 0);
            
            if (pub.is_humanitarian_cause) {
                const hold = parseFloat(pub.amount_on_hold || 0);
                const totalRaised = current + hold;
                const percentageReleased = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
                const percentageOnHold = goal > 0 ? Math.min((hold / goal) * 100, 100 - percentageReleased) : 0;

                progressHTML = `
                    <div class="donation-progress-container" style="margin-top: 10px;">
                        <div class="donation-progress-labels" style="margin-bottom: 6px; font-size: 0.78rem; font-weight: normal; opacity: 0.85; display: flex; justify-content: space-between; align-items: center; letter-spacing: 0.3px;">
                            <span><strong style="color: #ffffff; font-weight: 600; font-size: 0.82rem;">${formatBalance(totalRaised)}</strong> de <span style="opacity: 0.7; font-size: 0.8rem;">${formatBalance(goal)}</span> BLUE IOU</span>
                            <span style="font-weight: 600; color: #f472b6;">${formatPercentage(totalRaised, goal)}%</span>
                        </div>
                        <div class="donation-progress-bar" style="display: flex; height: 8px; background: rgba(255,255,255,0.08); border-radius: 5px; overflow: hidden; position: relative;">
                            <div class="donation-progress-fill" style="width: ${percentageReleased.toFixed(1)}%; height: 100%; background: linear-gradient(90deg, #ec4899, #db2777); border-radius: 0;"></div>
                            <div class="donation-progress-fill-hold" style="width: ${percentageOnHold.toFixed(1)}%; height: 100%; background: repeating-linear-gradient(45deg, rgba(232, 62, 140, 0.4), rgba(232, 62, 140, 0.4) 10px, rgba(232, 62, 140, 0.6) 10px, rgba(232, 62, 140, 0.6) 20px);"></div>
                        </div>
                        ${hold > 0 ? `<div style="font-size: 10px; color: #f472b6; margin-top: 5px; font-weight: normal; opacity: 0.9;">${formatBalance(hold)} BLUE IOU en hold por verificación KYC</div>` : ''}
                    </div>
                `;
            } else {
                const percent = goal > 0 ? Math.min(100, Math.floor((current / goal) * 100)) : 0;
                progressHTML = `
                    <div class="donation-progress-container">
                        <div class="donation-progress-labels">
                            <span>${formatBalance(current)} BLUE recaudados</span>
                            <span>${percent}%</span>
                        </div>
                        <div class="donation-progress-bar">
                            <div class="donation-progress-fill" style="width: ${percent}%"></div>
                        </div>
                    </div>
                `;
            }
        }

        // Determinamos si el feed activo está mostrando las publicaciones ocultas.
        const isHiddenView = currentFilter === 'hidden';

        // Estilo dinámico: Si el usuario visualiza las publicaciones ocultas, se renderiza
        // un botón para deshacer/restaurar (icono de retorno) en lugar de la X de cerrar.
        let actionButtonHTML = '';
        if (pub.is_humanitarian_cause) {
            actionButtonHTML = isHiddenView
                ? `
                <button class="card-close-btn restore-btn" title="Restaurar causa" onclick="event.preventDefault(); event.stopPropagation(); window.handleCauseAction('unhide', ${pub.cause_id})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                        <polyline points="3 3 3 8 8 8"></polyline>
                    </svg>
                </button>
                `
                : `
                <button class="card-close-btn" title="Ocultar causa" onclick="event.preventDefault(); event.stopPropagation(); window.handleCauseAction('hide', ${pub.cause_id})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                `;
        } else {
            actionButtonHTML = isHiddenView
                ? `
                <button class="card-close-btn restore-btn" title="Restaurar publicación" onclick="event.preventDefault(); event.stopPropagation(); window.handleCardAction('unhide', ${pub.id})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                        <polyline points="3 3 3 8 8 8"></polyline>
                    </svg>
                </button>
                `
                : `
                <button class="card-close-btn" title="Ocultar publicación" onclick="event.preventDefault(); event.stopPropagation(); window.handleCardAction('hide', ${pub.id})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                `;
        }

        // Título de la tarjeta — XSS Prevention: escapar título del servidor
        const cardTitle = `<h3>${escapeHtml(pub.title)}</h3>`;

        const detailUrl = pub.is_humanitarian_cause
            ? `causa-solidaria.html?id=${pub.cause_id}`
            : `publication-detail.html?id=${pub.id}`;

        return `
            <a href="${detailUrl}" class="publication-item-link">
                <div class="publication-item ${expirationInfo.isExpired ? 'expired' : ''} ${isDonation ? 'donation-card' : ''}" data-id="${pub.id}" data-author="${safeAuthorAttr}">
                    
                    <div class="card-top-row ${statusMessageHTML ? 'has-status' : ''}">
                        ${actionButtonHTML}
                        
                        ${statusMessageHTML}

                        <div class="cost-ribbon-right ${ribbonClass}">${rewardText}</div>
                    </div>

                    <div class="publication-header">
                        ${cardTitle}
                    </div>
                    
                    ${progressHTML}

                    ${pub.is_humanitarian_cause ? '' : `<p class="pub-description">${linkify(pub.description?.slice(0, 150) || '')}</p>`}
                    


                    <div class="publication-footer">
                        <div class="pub-meta">
                            <span>Por: <strong>${authorNameHTML}</strong></span>
                            ${ratingHTML}
                        </div>
                        <div class="pub-meta-right">
                            ${isDonation ? '' : `<div class="slots-info ${slotsClass}">${slotsText}</div>`}
                            ${expirationInfo.html}
                        </div>
                    </div>
                </div>
            </a>
        `;
    }

    // --- ACCIÓN DE DONACIÓN DIRECTA ---
    window.handleDirectDonation = async function (pubId, authorUsername) {
        const input = document.getElementById(`don-input-${pubId}`);
        const amount = parseFloat(input?.value);

        if (!amount || amount <= 0 || isNaN(amount)) {
            showCustomAlert('⚠️ Por favor, ingresa un monto válido para donar.');
            return;
        }

        const confirmMsg = `¿Deseas donar ${amount} BLUE a ${authorUsername}?\n\nEsta acción generará un compromiso de reciprocidad RED equivalente en tu cuenta según el modelo económico de WintonCoin.`;

        showCustomConfirm(confirmMsg, async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/publications/${pubId}/accept`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token && { 'Authorization': `Bearer ${token}` })
                    },
                    body: JSON.stringify({
                        acceptorUsername: storedUsername,
                        donationAmount: amount
                    })
                });
                if (handleSessionExpired(response)) return;

                const result = await response.json();
                if (response.ok) {
                    showCustomAlert(result.message || '¡Donación procesada con éxito!', () => {
                        window.loadAllData();
                    });
                } else {
                    showCustomAlert(result.message || 'Error al procesar la donación.');
                }
            } catch (error) {
                console.error('Error en donación:', error);
                showCustomAlert('Error de red al procesar la donación.');
            }
        });
    };

    // Acción directa de ocultar y restaurar (unhide) publicaciones
    window.handleCardAction = async function (action, id) {
        if (action === 'hide') {
            await hidePublication(id);
        } else if (action === 'unhide') {
            // Estándar UX: Animación optimista inmediata antes de la respuesta del servidor.
            // Esto le da al usuario una experiencia fluida sin esperas de red molestas.
            const item = document.querySelector(`.publication-item[data-id="${id}"]`);
            if (item) {
                const cardLink = item.closest('.publication-item-link');
                if (cardLink) {
                    // Transición suave de salida
                    cardLink.style.transition = 'all 0.3s ease';
                    cardLink.style.opacity = '0';
                    cardLink.style.transform = 'scale(0.9)';
                    
                    // Remoción física del DOM tras finalizar la animación
                    setTimeout(() => {
                        cardLink.remove();
                        // Si se restauró la última tarjeta oculta, renderizar el estado vacío correspondiente.
                        const remainingItems = elements.publicationsList.querySelectorAll('.publication-item-link');
                        if (remainingItems.length === 0) {
                            elements.publicationsList.innerHTML = `
                                <div class="empty-state-container">
                                    <div class="empty-state-icon">📁</div>
                                    <h3>No tienes publicaciones ocultas</h3>
                                    <p>Las publicaciones que decidas ocultar con el botón 'X' aparecerán aquí para que puedas recuperarlas.</p>
                                </div>
                            `;
                        }
                    }, 300);
                }
            }
            // Ejecutamos la petición de red persistente al backend
            await unhidePublication(id);
        }
    };

    // Acción directa de ocultar y restaurar (unhide) causas humanitarias (usando localStorage)
    window.handleCauseAction = function (action, causeId) {
        const hiddenCausesKey = `hidden_causes_${storedUsername}`;
        let hiddenCauseIds = JSON.parse(localStorage.getItem(hiddenCausesKey) || '[]');

        if (action === 'hide') {
            // Animación optimista de salida de la causa
            const item = document.querySelector(`.publication-item[data-id="cause-${causeId}"]`);
            if (item) {
                const cardLink = item.closest('.publication-item-link');
                if (cardLink) {
                    cardLink.style.transition = 'all 0.3s ease';
                    cardLink.style.opacity = '0';
                    cardLink.style.transform = 'scale(0.9)';
                    setTimeout(() => {
                        cardLink.style.display = 'none';
                    }, 300);
                }
            }
            if (!hiddenCauseIds.includes(causeId)) {
                hiddenCauseIds.push(causeId);
                localStorage.setItem(hiddenCausesKey, JSON.stringify(hiddenCauseIds));
            }
            showToast("Causa ocultada", "DESHACER", () => {
                window.handleCauseAction('unhide', causeId);
            });
        } else if (action === 'unhide') {
            // Animación optimista al restaurar causa
            const item = document.querySelector(`.publication-item[data-id="cause-${causeId}"]`);
            if (item) {
                const cardLink = item.closest('.publication-item-link');
                if (cardLink) {
                    cardLink.style.transition = 'all 0.3s ease';
                    cardLink.style.opacity = '0';
                    cardLink.style.transform = 'scale(0.9)';
                    setTimeout(() => {
                        cardLink.remove();
                    }, 300);
                }
            }
            hiddenCauseIds = hiddenCauseIds.filter(id => id !== causeId);
            localStorage.setItem(hiddenCausesKey, JSON.stringify(hiddenCauseIds));
        }

        setTimeout(() => {
            fetchAndDisplayPublications();
        }, 310);
    };

    async function hidePublication(id) {
        try {
            // Optimistic UI: Solo ocultar con display:none
            const item = document.querySelector(`.publication-item[data-id="${id}"]`);
            if (!item) return;

            const cardLink = item.closest('.publication-item-link');

            if (cardLink) {
                // Animación de salida
                cardLink.style.transition = 'all 0.3s ease';
                cardLink.style.opacity = '0';
                cardLink.style.transform = 'scale(0.9)';

                // GUARDAR EL TIMER ID PARA PODER CANCELARLO
                const timeoutId = setTimeout(() => {
                    cardLink.style.display = 'none';
                }, 300);
                cardLink.dataset.hideTimeout = timeoutId;
            }

            const response = await fetch(`${API_URL}/publications/${id}/hide`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ username: localStorage.getItem('username') })
            });

            if (response.ok) {
                showToast("Publicación oculta", "DESHACER", async () => {
                    await unhidePublication(id);
                });
            } else {
                console.error("Error al ocultar en servidor");
                // Revertir UI si falla el servidor
                if (cardLink) {
                    // Cancelar timeout si estaba pendiente
                    if (cardLink.dataset.hideTimeout) {
                        clearTimeout(Number(cardLink.dataset.hideTimeout));
                        delete cardLink.dataset.hideTimeout;
                    }
                    cardLink.style.display = '';
                    setTimeout(() => {
                        cardLink.style.opacity = '1';
                        cardLink.style.transform = 'scale(1)';
                    }, 50);
                }
            }
        } catch (error) {
            console.error("Error de red al ocultar:", error);
            if (typeof window.loadAllData === 'function') window.loadAllData();
            else window.location.reload();
        }
    }

    // NUEVO: Función para DESHACER con lógica PROFESIONAL (Cancelación de Timer)
    async function unhidePublication(id) {
        try {
            // Intentar restauración visual inmediata
            const item = document.querySelector(`.publication-item[data-id="${id}"]`);
            const cardLink = item?.closest('.publication-item-link');

            if (cardLink) {
                // 1. CANCELAR EL TIMEOUT DEL OCULTADO ANTERIOR (CRÍTICO)
                if (cardLink.dataset.hideTimeout) {
                    clearTimeout(Number(cardLink.dataset.hideTimeout));
                    delete cardLink.dataset.hideTimeout;
                }

                // 2. Restaurar visualmente
                cardLink.style.display = ''; // Quitar display:none

                // Forzar reflow
                void cardLink.offsetWidth;

                cardLink.style.opacity = '1';
                cardLink.style.transform = 'scale(1)';
            }

            const response = await fetch(`${API_URL}/publications/${id}/unhide`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ username: localStorage.getItem('username') })
            });

            if (!response.ok) {
                console.error("Error en servidor al deshacer");
                if (typeof window.loadAllData === 'function') window.loadAllData();
                else window.location.reload();
            } else {
                if (!cardLink) {
                    if (typeof window.loadAllData === 'function') window.loadAllData();
                }
            }
        } catch (error) {
            console.error("Error al deshacer:", error);
            if (typeof window.loadAllData === 'function') window.loadAllData();
            else window.location.reload();
        }
    }


    // Simple Toast Notification Logic (Robust)
    function showToast(message, actionText, actionCallback) {
        // Eliminar toast anterior si existe
        const existingToast = document.getElementById('toast-notification');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'toast-notification';

        toast.innerHTML = `
            <span>${message}</span>
            ${actionText ? `<button id="toast-action" type="button">${actionText}</button>` : ''}
        `;

        document.body.appendChild(toast);

        // Forzar reflow para animación
        void toast.offsetWidth;
        toast.classList.add('show');

        if (actionText && actionCallback) {
            const btn = document.getElementById('toast-action');
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                actionCallback();
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300); // Limpiar DOM
            };
        }

        // Auto-cierre extendido a 7 segundos
        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (document.body.contains(toast)) toast.remove();
                }, 300);
            }
        }, 7000);
    }

    // Close menus when clicking outside


    // --- Notifications ---
    async function fetchNotifications() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/me/notifications`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (handleSessionExpired(response)) return;
            if (!response.ok) throw new Error('Error al cargar notificaciones.');

            const notifications = await response.json();
            const dropdown = document.getElementById('notificationDropdown');
            if (!dropdown) return;

            dropdown.innerHTML = '';

            if (notifications.length === 0) {
                dropdown.innerHTML = `
                    <div class="notification-header-actions">
                        <button class="noti-action-link" onclick="window.openNotificationHistory()">Ver historial</button>
                    </div>
                    <div class="no-notifications">No tienes notificaciones nuevas.</div>
                `;
            } else {
                // CABECERA CON ACCIONES (ARRIBA)
                const header = document.createElement('div');
                header.className = 'notification-header-actions-container';
                header.innerHTML = `
                    <div class="notification-footer-actions">
                        <button class="noti-action-link" onclick="window.clearAllNotifications()">Limpiar</button>
                        <span class="noti-divider">|</span>
                        <button class="noti-action-link" onclick="window.openNotificationHistory()">Ver historial</button>
                    </div>
                `;
                dropdown.appendChild(header);

                // LISTA DE NOTIFICACIONES
                notifications.forEach(notification => {
                    const item = document.createElement('div');
                    item.className = 'notification-item';
                    item.dataset.id = notification.id;
                    item.innerHTML = `
                        <p>${escapeHtml(notification.message)}</p>
                        <span class="notification-dismiss" data-id="${notification.id}" title="Descartar">&times;</span>
                    `;
                    dropdown.appendChild(item);
                });
            }

            updateNotificationBadge(notifications.length);
        } catch (error) {
            console.error(error.message);
            updateNotificationBadge(0);
        }
    }

    function updateNotificationBadge(count) {
        if (elements.notificationBadge) {
            if (count > 0) {
                elements.notificationBadge.textContent = count;
                elements.notificationBadge.style.display = 'flex';
            } else {
                elements.notificationBadge.style.display = 'none';
            }
        }
    }

    async function dismissNotification(notificationId) {
        const notificationElement = document.querySelector(`.notification-item[data-id='${notificationId}']`);
        if (notificationElement) {
            notificationElement.style.transition = 'opacity 0.3s ease';
            notificationElement.style.opacity = '0';
            setTimeout(() => {
                notificationElement.remove();
                const remaining = document.querySelectorAll('.notification-item').length;
                updateNotificationBadge(remaining);
                if (remaining === 0) fetchNotifications();
            }, 300);
        }

        try {
            await postToServer(`/api/me/notifications/${notificationId}/dismiss`, {}, { silent: true, reload: false });
        } catch (error) {
            console.error("Error al descartar notificación:", error);
        }
    }

    window.clearAllNotifications = async function () {
        try {
            const response = await postToServer('/api/me/notifications/mark-read', {}, { silent: true, reload: false });
            if (response.success) {
                const dropdown = document.getElementById('notificationDropdown');
                if (dropdown) dropdown.innerHTML = `
                    <div class="notification-header-actions">
                        <button class="noti-action-link" onclick="window.openNotificationHistory()">Ver historial</button>
                    </div>
                    <div class="no-notifications">No tienes notificaciones nuevas.</div>
                `;
                updateNotificationBadge(0);
            }
        } catch (error) {
            console.error("Error al limpiar notificaciones:", error);
        }
    }

    // --- CENTRO DE HISTORIAL PROFESIONAL ---
    window.openNotificationHistory = async function () {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/me/notifications/history`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });

            if (!response.ok) throw new Error('No se pudo cargar el historial.');
            const history = await response.json();

            renderHistoryModal(history);

        } catch (error) {
            console.error("Error al abrir historial:", error);
            showCustomAlert("No se pudo cargar el historial de notificaciones.");
        }
    }

    function renderHistoryModal(history) {
        // Eliminar modal previo si existe
        const oldModal = document.getElementById('notificationHistoryModal');
        if (oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = 'notificationHistoryModal';
        modal.className = 'custom-modal'; // Usamos la clase de modal de la plataforma
        modal.style.display = 'flex';

        let itemsHTML = '';
        if (history.length === 0) {
            itemsHTML = '<p class="empty-history">Aún no tienes notificaciones en tu historial.</p>';
        } else {
            itemsHTML = history.map(noti => {
                const date = new Date(noti.created_at).toLocaleString();
                let icon = '🔔'; // Default
                let statusClass = '';

                // Detección inteligente de iconos por contenido
                const msg = noti.message.toLowerCase();
                if (msg.includes('aprobada') || msg.includes('has sido aprobado') || msg.includes('🎉') || msg.includes('✅')) {
                    icon = '✅';
                    statusClass = 'noti-success';
                } else if (msg.includes('rechazada') || msg.includes('error') || msg.includes('⚠️') || msg.includes('❌')) {
                    icon = '⚠️';
                    statusClass = 'noti-warning';
                } else if (msg.includes('pagada') || msg.includes('acreditado') || msg.includes('ganado') || msg.includes('💰')) {
                    icon = '💰';
                    statusClass = 'noti-money';
                } else if (msg.includes('quiere participar') || msg.includes('solicitud') || msg.includes('📩')) {
                    icon = '📩';
                    statusClass = 'noti-request';
                }

                return `
                    <div class="history-noti-item ${noti.is_read ? 'is-read' : 'is-unread'} ${statusClass}">
                        <div class="history-noti-icon">${icon}</div>
                        <div class="history-noti-content">
                            <p>${escapeHtml(noti.message)}</p>
                            <span class="history-noti-date">${date}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        modal.innerHTML = `
            <div class="custom-modal-content history-modal">
                <div class="custom-modal-header">
                    <h2>Historial de Notificaciones</h2>
                    <span class="custom-modal-close" onclick="document.getElementById('notificationHistoryModal').remove()">&times;</span>
                </div>
                <div class="custom-modal-body history-body">
                    <div class="history-list">
                        ${itemsHTML}
                    </div>
                </div>
                <div class="custom-modal-footer">
                    <button class="action-button-admin secondary" onclick="document.getElementById('notificationHistoryModal').remove()">Cerrar</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // --- Balances ---
    async function fetchAndDisplayBalances() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/me/balance?t=${new Date().getTime()}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (handleSessionExpired(response)) return;
            if (response.ok) {
                const data = await response.json();
                if (elements.saldoBlue) elements.saldoBlue.innerHTML = formatBalance(data.blue_balance);
                if (elements.saldoRed) elements.saldoRed.innerHTML = formatBalance(data.red_balance);

                localStorage.setItem('blue_balance', data.blue_balance);
                localStorage.setItem('escrow_blue_balance', data.escrow_blue_balance);
                localStorage.setItem('red_balance', data.red_balance);
                localStorage.setItem('penalized_debt', data.penalized_debt);

                // Countdown timers
                handleCountdownTimers(data);

                // Web3 Wallet
                if (data.web3_wallet_address && elements.myWalletAddressContainer && elements.myWalletAddressText && elements.copyMyWalletBtn) {
                    const addr = data.web3_wallet_address;
                    const truncated = addr.substring(0, 8) + '...' + addr.substring(addr.length - 6);
                    elements.myWalletAddressText.textContent = truncated;
                    elements.copyMyWalletBtn.dataset.address = addr;
                    elements.myWalletAddressContainer.style.display = 'flex';
                }
            }
        } catch (error) {
            console.error('Error al obtener saldos:', error);
        }
    }

    function handleCountdownTimers(data) {
        // Available countdown: muestra cuándo se liberarán fondos pendientes
        if (data.next_available_at && parseFloat(data.next_available_amount) > 0 && elements.availableCountdownContainer) {
            elements.availableCountdownContainer.style.display = 'block';
            startAvailableCountdown(data.next_available_at, data.next_available_amount);
        } else if (elements.availableCountdownContainer) {
            elements.availableCountdownContainer.style.display = 'none';
        }

        // Debt countdown
        if (data.next_due_at && parseFloat(data.next_due_amount) > 0 && elements.debtCountdownContainer) {
            elements.debtCountdownContainer.style.display = 'block';
            startDebtCountdown(data.next_due_at, data.next_due_amount);
        } else if (elements.debtCountdownContainer) {
            elements.debtCountdownContainer.style.display = 'none';
        }

        // Escrow countdown
        if (data.next_unlock_at && parseFloat(data.next_unlock_amount) > 0 && elements.escrowCountdownContainer) {
            elements.escrowCountdownContainer.style.display = 'block';
            startEscrowCountdown(data.next_unlock_at, data.next_unlock_amount);
        } else if (elements.escrowCountdownContainer) {
            elements.escrowCountdownContainer.style.display = 'none';
        }
    }

    /**
     * startAvailableCountdown
     * Muestra una cuenta regresiva hasta que los fondos pendientes sean liberados.
     * Cuando el timer llega a cero, oculta el contenedor y refresca los saldos
     * para reflejar la nueva disponibilidad.
     *
     * @param {string} availableDateString - ISO 8601 fecha/hora de liberación
     * @param {number|string} availableAmount - Monto que será liberado
     */
    function startAvailableCountdown(availableDateString, availableAmount) {
        // Limpiar interval previo para evitar timers duplicados
        if (availableCountdownInterval) clearInterval(availableCountdownInterval);

        // Formatear el monto una sola vez (no cambia durante el countdown)
        const formattedAmount = formatBalance(availableAmount);

        const updateTimer = () => {
            const now = new Date();
            const availableDate = new Date(availableDateString);
            const diff = availableDate - now;

            // Si ya pasó la fecha de liberación, ocultar y refrescar saldos
            if (diff <= 0) {
                if (elements.availableCountdownContainer) {
                    elements.availableCountdownContainer.style.display = 'none';
                }
                clearInterval(availableCountdownInterval);
                availableCountdownInterval = null;
                // Refrescar saldos para que el usuario vea los fondos ya disponibles
                fetchAndDisplayBalances();
                return;
            }

            // Mostrar tiempo restante formateado
            const timeString = formatTimeRemaining(diff);
            if (elements.availableCountdownText) {
                elements.availableCountdownText.innerHTML =
                    `Próxima liberación <strong class="saldo-blue-text">${formattedAmount}</strong> en <strong>${timeString}</strong>`;
            }
        };

        // Ejecutar inmediatamente y luego cada segundo
        updateTimer();
        availableCountdownInterval = setInterval(updateTimer, 1000);
    }

    function startDebtCountdown(dueDateString, dueAmount) {
        if (debtCountdownInterval) clearInterval(debtCountdownInterval);
        const formattedAmount = formatBalance(dueAmount);

        const updateTimer = () => {
            const now = new Date();
            const dueDate = new Date(dueDateString);
            const diff = dueDate - now;

            if (diff <= 0) {
                if (elements.debtCountdownText) {
                    elements.debtCountdownText.innerHTML = `<strong class="expired">URGENTE! ${formattedAmount} VENCIDOS!</strong>`;
                }
                clearInterval(debtCountdownInterval);
                return;
            }

            const timeString = formatTimeRemaining(diff);
            if (elements.debtCountdownText) {
                elements.debtCountdownText.innerHTML = `próximo vencimiento <strong class="saldo-red-text">${formattedAmount}</strong> en <strong>${timeString}</strong>`;
            }
        };

        updateTimer();
        debtCountdownInterval = setInterval(updateTimer, 1000);
    }

    function startEscrowCountdown(unlockDateString, unlockAmount) {
        if (escrowCountdownInterval) clearInterval(escrowCountdownInterval);
        const formattedAmount = formatBalance(unlockAmount);

        const updateTimer = () => {
            const now = new Date();
            const unlockDate = new Date(unlockDateString);
            const diff = unlockDate - now;

            if (diff <= 0) {
                if (elements.escrowCountdownContainer) elements.escrowCountdownContainer.style.display = 'none';
                clearInterval(escrowCountdownInterval);
                fetchAndDisplayBalances();
                return;
            }

            const timeString = formatTimeRemaining(diff);
            if (elements.escrowCountdownText) {
                elements.escrowCountdownText.innerHTML = `Disponible <strong class="saldo-blue-text">${formattedAmount}</strong> en <strong>${timeString}</strong>`;
            }
        };

        updateTimer();
        escrowCountdownInterval = setInterval(updateTimer, 1000);
    }

    function formatTimeRemaining(diff) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (days > 0) return `${days}d y ${hours}h`;
        if (hours > 0) return `${hours}h y ${minutes}m`;
        if (minutes > 0) return `${minutes}m y ${seconds}s`;
        return `${seconds}s`;
    }

    // --- Burn Modal ---
    function updateBurnModal() {
        const blueBalance = localStorage.getItem('blue_balance') || '0';
        const escrowBlueBalance = localStorage.getItem('escrow_blue_balance') || '0';
        const redBalance = localStorage.getItem('red_balance') || '0';
        const penalizedDebt = localStorage.getItem('penalized_debt') || '0';

        let penalizedDebtHTML = '';
        if (parseFloat(penalizedDebt) > 0.00009) {
            penalizedDebtHTML = `
                <div class="balance-line">
                    <span>Vencidos</span>
                    <span class="saldo-red-text">${formatBalance(penalizedDebt)} RED</span>
                </div>
            `;
        }

        if (elements.burnModalBalances) {
            elements.burnModalBalances.innerHTML = `
                <div class="balance-line">
                    <span>Disp.</span>
                    <span class="saldo-blue-text">${formatBalance(blueBalance)} BLUE</span>
                </div>
                <div class="balance-line">
                    <span>Pend.</span>
                    <span class="saldo-escrow-text">${formatBalance(escrowBlueBalance)} BLUE</span>
                </div>
                <hr class="burn-modal-divider">
                <div class="balance-line">
                    <span>Compromiso</span>
                    <span class="saldo-red-text">${formatBalance(redBalance)} RED</span>
                </div>
                ${penalizedDebtHTML}
            `;
        }
    }

    // Store pending burn amount for confirmation
    let pendingBurnAmount = null;

    async function handleBurnSubmit(event) {
        event.preventDefault();
        const amountInput = document.getElementById('burnAmount');
        const amountStr = amountInput?.value?.replace(',', '.');
        const amount = parseFloat(amountStr);

        if (!amount || amount <= 0 || isNaN(amount)) {
            showCustomAlert('Introduce una cantidad válida.');
            return;
        }

        // Helper to parse formatted balance (handles 1.952.340,0000 format)
        function parseFormattedBalance(text) {
            if (!text) return 0;
            // Remove everything except digits, dots and commas
            let cleaned = text.replace(/[^\d.,]/g, '');
            // Count dots and commas to determine format
            const dots = (cleaned.match(/\./g) || []).length;
            const commas = (cleaned.match(/,/g) || []).length;

            if (dots > 1 || (dots === 1 && commas === 1 && cleaned.indexOf('.') < cleaned.indexOf(','))) {
                // Format: 1.952.340,0000 (dots as thousand sep, comma as decimal)
                cleaned = cleaned.replace(/\./g, '').replace(',', '.');
            } else if (commas > 1 || (commas === 1 && dots === 1 && cleaned.indexOf(',') < cleaned.indexOf('.'))) {
                // Format: 1,952,340.0000 (commas as thousand sep, dot as decimal)
                cleaned = cleaned.replace(/,/g, '');
            } else if (commas === 1 && dots === 0) {
                // Format: 1952340,0000 (comma as decimal)
                cleaned = cleaned.replace(',', '.');
            }
            return parseFloat(cleaned) || 0;
        }

        // Get current balances to validate
        const blueBalance = parseFormattedBalance(document.getElementById('saldoBlue')?.textContent);
        const redBalance = parseFormattedBalance(document.getElementById('saldoRed')?.textContent);

        // Check if user has sufficient BLUE balance
        if (amount > blueBalance) {
            showCustomAlert('No tienes suficiente saldo BLUE disponible para quemar esta cantidad.');
            return;
        }

        // Check if user has sufficient RED commitment to burn
        if (amount > redBalance) {
            const redBalanceText = redBalance.toFixed(4).replace('.', ',');
            showCustomAlert('No tienes suficiente compromiso RED para quemar esta cantidad. Solo puedes quemar hasta ' + redBalanceText + ' RED.');
            return;
        }

        // Store the amount and show confirmation modal
        pendingBurnAmount = amountStr;

        // Update modal with amounts
        const confirmBlueEl = document.getElementById('confirmBurnBlue');
        const confirmRedEl = document.getElementById('confirmBurnRed');
        if (confirmBlueEl) confirmBlueEl.innerHTML = formatBalance(amount);
        if (confirmRedEl) confirmRedEl.innerHTML = formatBalance(amount);

        // Show confirmation modal
        const burnConfirmModal = document.getElementById('burnConfirmModal');
        if (burnConfirmModal) burnConfirmModal.style.display = 'flex';
    }

    // Setup burn confirmation modal handlers
    function setupBurnConfirmModal() {
        const burnConfirmModal = document.getElementById('burnConfirmModal');
        const cancelBtn = document.getElementById('burnConfirmCancel');
        const acceptBtn = document.getElementById('burnConfirmAccept');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (burnConfirmModal) burnConfirmModal.style.display = 'none';
                pendingBurnAmount = null;
            });
        }

        if (acceptBtn) {
            acceptBtn.addEventListener('click', async () => {
                if (!pendingBurnAmount) return;

                // Close confirmation modal
                if (burnConfirmModal) burnConfirmModal.style.display = 'none';

                try {
                    const token = localStorage.getItem('token');
                    const headers = { 'Content-Type': 'application/json' };
                    if (token) headers['Authorization'] = `Bearer ${token}`;

                    const response = await fetch(`${API_URL}/users/burn`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ username: storedUsername, amount: pendingBurnAmount })
                    });
                    const result = await response.json();
                    showCustomAlert(result.message);

                    if (response.ok) {
                        if (elements.burnModal) elements.burnModal.style.display = 'none';
                        if (elements.burnForm) elements.burnForm.reset();
                        loadAllData();
                    }
                } catch (error) {
                    console.error('Error al quemar tokens:', error);
                    showCustomAlert('Error de red al quemar tokens.');
                } finally {
                    pendingBurnAmount = null;
                }
            });
        }

        // Close on click outside
        if (burnConfirmModal) {
            burnConfirmModal.addEventListener('click', (e) => {
                if (e.target === burnConfirmModal) {
                    burnConfirmModal.style.display = 'none';
                    pendingBurnAmount = null;
                }
            });
        }
    }

    // --- Rating Modal ---
    function openRatingModal(publicationId, raterUsername, rateeUsername) {
        if (!elements.ratingForm) return;
        elements.ratingForm.reset();

        const pubIdInput = document.getElementById('ratingPublicationId');
        const raterInput = document.getElementById('ratingRaterUsername');
        const rateeInput = document.getElementById('ratingRateeUsername');
        const titleEl = document.getElementById('ratingModalTitle');

        if (pubIdInput) pubIdInput.value = publicationId;
        if (raterInput) raterInput.value = raterUsername;
        if (rateeInput) rateeInput.value = rateeUsername;
        if (titleEl) titleEl.textContent = `Calificar a ${rateeUsername}`;

        if (elements.ratingModal) elements.ratingModal.style.display = 'flex';
    }

    // --- Referral Settings & Share ---
    let promoInterval;

    async function loadReferralSettings() {
        try {
            const response = await fetch(`${API_URL}/api/referral-settings`);
            if (response.ok) {
                const data = await response.json();
                
                // 1. Actualizar monto en la tarjeta
                const amountElement = document.getElementById('referralAmount');
                if (amountElement && data.referral_reward_amount) {
                    amountElement.textContent = parseInt(data.referral_reward_amount, 10);
                }

                // 2. Actualizar cupos restantes en la tarjeta
                const slotsElement = document.getElementById('referralRemainingSlots');
                const labelElement = document.getElementById('promoSlotsLabel');
                const subtitleElement = document.getElementById('referralCardSubtitle');
                const btnTextElement = document.getElementById('referralCardBtnText');
                const bgOverlayElement = document.getElementById('campaignBgOverlay');
                const noticeElement = document.getElementById('campaignCodeNotice');
                const cardElement = document.getElementById('shareReferralCard');
                
                if (slotsElement && typeof data.referral_remaining_slots !== 'undefined') {
                    const remainingSlots = parseInt(data.referral_remaining_slots, 10);
                    slotsElement.textContent = remainingSlots.toLocaleString('es-ES');
                    
                    if (remainingSlots <= 0) {
                        if (labelElement) labelElement.textContent = 'CUPOS AGOTADOS:';
                        slotsElement.classList.add('hot'); // Resaltar en rojo si no hay cupos
                    }
                }

                // 3. Transformación Visual: Modo Campaña (Fondo Completo con Overlay)
                const isCampaignActive = data.referral_custom_share_code_enabled === true;
                
                if (isCampaignActive) {
                    // Título de la tarjeta
                    if (labelElement && data.referral_card_title) {
                        labelElement.textContent = data.referral_card_title;
                        labelElement.style.color = '#fff';
                        labelElement.style.fontWeight = '700';
                        labelElement.style.fontSize = '1.1rem';
                    }

                    // Subtítulo de la tarjeta
                    if (subtitleElement && data.referral_card_subtitle) {
                        subtitleElement.textContent = data.referral_card_subtitle;
                        subtitleElement.style.color = 'rgba(255, 255, 255, 0.95)';
                        subtitleElement.style.textShadow = '0 1px 4px rgba(0, 0, 0, 0.8)';
                        subtitleElement.style.fontWeight = '700';
                    }

                    // Iluminar "Quedan" y "cupos" con el mismo color del subtítulo
                    const prefixEl = document.getElementById('promoSlotsPrefix');
                    const suffixEl = document.getElementById('referralRemainingLabel');
                    if (prefixEl) {
                        prefixEl.style.color = 'rgba(255, 255, 255, 0.95)';
                        prefixEl.style.textShadow = '0 1px 4px rgba(0, 0, 0, 0.8)';
                    }
                    if (suffixEl) {
                        suffixEl.style.color = 'rgba(255, 255, 255, 0.95)';
                        suffixEl.style.textShadow = '0 1px 4px rgba(0, 0, 0, 0.8)';
                    }
                    
                    // Texto del Botón
                    if (btnTextElement && data.referral_card_button_text) {
                        btnTextElement.textContent = data.referral_card_button_text;
                    }
                    
                    // Imagen de Fondo (Full Background) y Overlay Oscuro
                    if (bgOverlayElement && data.referral_campaign_image_url) {
                        let imageUrl = data.referral_campaign_image_url;
                        
                        // Si la URL es externa (Imgur, etc.), se inyecta directamente.
                        // Si es local, le anteponemos el API_URL del backend.
                        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('//')) {
                            bgOverlayElement.style.backgroundImage = `url('${imageUrl}')`;
                        } else {
                            // Compatibilidad de prefijo local /api
                            if (!imageUrl.startsWith('/api') && imageUrl.startsWith('/uploads')) {
                                imageUrl = '/api' + imageUrl;
                            }
                            bgOverlayElement.style.backgroundImage = `url('${API_URL}${imageUrl}')`;
                        }
                        bgOverlayElement.style.display = 'block';
                        
                        // Quitar el color de fondo por defecto de la tarjeta para dejar ver la imagen
                        if (cardElement) {
                            cardElement.style.backgroundColor = 'transparent';
                            cardElement.style.border = '1px solid rgba(255,255,255,0.1)';
                        }
                    }
                    
                    // Notificación pequeña en el fondo (Código a enviar)
                    if (noticeElement && data.referral_custom_share_code) {
                        noticeElement.textContent = `Código a enviar: ${data.referral_custom_share_code}`;
                        noticeElement.style.display = 'block';
                    }
                } else {
                    // Modo Normal (Revertir cambios si la campaña está apagada)
                    if (labelElement) {
                        labelElement.textContent = 'CUPOS DISPONIBLES:';
                        labelElement.style = ''; // Limpiar estilos en línea
                    }
                    if (subtitleElement) {
                        subtitleElement.textContent = 'Bono por referir hoy';
                        subtitleElement.style = ''; // Restaurar estilos por defecto de CSS
                    }
                    const prefixEl = document.getElementById('promoSlotsPrefix');
                    const suffixEl = document.getElementById('referralRemainingLabel');
                    if (prefixEl) prefixEl.style = '';
                    if (suffixEl) suffixEl.style = '';
                    
                    if (btnTextElement) btnTextElement.textContent = 'Compartir mi código';
                    if (bgOverlayElement) bgOverlayElement.style.display = 'none';
                    if (noticeElement) noticeElement.style.display = 'none';
                    if (cardElement) cardElement.style = ''; // Limpiar backgroundColor transparente
                }
            }
        } catch (error) {
            console.error('Error al cargar configuración de referidos:', error);
        }
    }

    async function shareReferralCode() {
        try {
            const username = localStorage.getItem('username');
            if (!username) {
                showCustomAlert('Error: No se pudo obtener tu información de usuario.');
                return;
            }

            const [referralResponse, settingsResponse] = await Promise.all([
                fetch(`${API_URL}/api/users/${username}/referral-info`),
                fetch(`${API_URL}/api/referral-settings`)
            ]);

            if (referralResponse.ok && settingsResponse.ok) {
                const referralData = await referralResponse.json();
                const settingsData = await settingsResponse.json();

                // 1. Determinar qué código y enlace compartir
                const userCode = referralData.referral_code;
                const customCode = settingsData.referral_custom_share_code || 'WINTON';
                const useCustomCode = settingsData.referral_custom_share_code_enabled === true;

                const codeToShare = useCustomCode ? customCode : userCode;
                const rewardAmount = parseInt(settingsData.referral_reward_amount, 10) || 0;
                const registrationUrl = `${window.location.origin}/register.html?ref=${codeToShare}`;

                // 2. Obtener la plantilla de mensaje personalizada
                let template = settingsData.referral_share_message_template || 
                    `¡Hola! Únete a WintonCoin usando mi código {code} y ambos ganaremos {reward} BLUE IOU de bienvenida.\n\n👉 Regístrate gratis aquí: {link}`;

                // 3. Reemplazar placeholders en la plantilla
                const textToShare = template
                    .replace(/{code}/g, codeToShare)
                    .replace(/{reward}/g, rewardAmount)
                    .replace(/{link}/g, registrationUrl);

                if (navigator.share) {
                    await navigator.share({
                        title: '¡Únete a WintonCoin!',
                        text: textToShare
                    });
                } else {
                    await copyTextToClipboard(textToShare);
                    showCustomAlert('¡Mensaje de invitación copiado! Compártelo con tus amigos.');
                }
            } else {
                showCustomAlert('Error al obtener tu código de referido.');
            }
        } catch (error) {
            console.error('Error al compartir código de referido:', error);
            showCustomAlert('Error al compartir el código de referido.');
        }
    }

    function setupShareReferral() {
        const shareReferralCard = document.getElementById('shareReferralCard');
        if (shareReferralCard) {
            shareReferralCard.addEventListener('click', shareReferralCode);
        }
    }

    // --- Booster Summary ---
    async function fetchBoosterSummary() {
        if (!elements.boosterSummary) return;

        const now = Date.now();
        if (now - lastBoosterFetch < 60000) return;
        lastBoosterFetch = now;

        const token = localStorage.getItem('token');
        if (!token) {
            // No token, nothing to show but tab system controls visibility
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/me/booster-profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (handleSessionExpired(response)) return;
            const result = await response.json();

            if (!response.ok || !result?.is_booster) {
                // Not a booster, show placeholder text
                if (elements.boosterTotalBlue) {
                    elements.boosterTotalBlue.innerHTML = `<span class="booster-total-value">0</span> <span class="booster-total-unit">BLUE iou</span>`;
                }
                return;
            }

            const totalBoosterBlue = Number(result.total_booster_blue || 0);
            const nextLevel = result.next_level_info;
            const nextMin = nextLevel ? Number(nextLevel.min_blue_required || 0) : 0;

            if (elements.boosterTotalBlue) {
                elements.boosterTotalBlue.innerHTML = `<span class="booster-total-value">${formatBalance(totalBoosterBlue)}</span> <span class="booster-total-unit">BLUE iou</span>`;
            }

            let progressPercent = 100;
            let progressText = 'Nivel máximo alcanzado';
            if (nextMin > 0) {
                progressPercent = Math.min(100, (totalBoosterBlue / nextMin) * 100);
                progressText = `${totalBoosterBlue.toFixed(4)} / ${nextMin.toFixed(4)} BLUE iou`;
            }

            if (elements.boosterProgressText) elements.boosterProgressText.textContent = progressText;
            if (elements.boosterProgressFill) elements.boosterProgressFill.style.width = `${progressPercent}%`;

        } catch (error) {
            console.error('Error al cargar el resumen de impulsor:', error);
        }
    }

    // --- WINTON SOLIDARIO: Tarjeta resumen en el dashboard ---
    async function fetchSolidarioSummary() {
        const card = document.getElementById('solidarioDashboardCard');

        // Caché de 60 segundos para no sobrecargar la API
        const now = Date.now();
        if (now - lastSolidarioFetch < 60000) return;
        lastSolidarioFetch = now;

        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const historyMenuLink = document.getElementById('menuSolidarioHistory');

            const response = await fetch(`${API_URL}/api/humanitarian/causes/my`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                if (card) card.style.display = 'none';
                if (historyMenuLink) {
                    historyMenuLink.style.display = 'block';
                    historyMenuLink.href = 'solicitud-solidaria.html';
                }
                return;
            }

            const data = await response.json();

            // Si no tiene causas, ocultar la tarjeta
            if (!data.success || !data.causes || data.causes.length === 0) {
                if (card) card.style.display = 'none';
                if (historyMenuLink) {
                    historyMenuLink.style.display = 'block';
                    historyMenuLink.href = 'solicitud-solidaria.html';
                }
                return;
            }

            // Buscar la primera causa activa (approved o pending)
            const activeCause = data.causes.find(c => c.status === 'approved' || c.status === 'pending');

            if (activeCause) {
                if (card) displaySolidarioCard(card, activeCause);
            } else {
                // Si no hay activas, ocultamos la tarjeta principal del dashboard
                // Y dependerá del menú lateral ver el historial
                if (card) card.style.display = 'none';
            }

            // ======= NUEVO: Lógica del Historial DESDE EL MENÚ =======
            const historyLinkContainer = document.getElementById('solidarioHistoryLinkContainer');
            const historyBtn = document.getElementById('solidarioHistoryBtn'); // El del modal
            const historyModal = document.getElementById('solidarioHistoryModal');
            const historyCloseBtn = document.querySelector('.solidario-history-close');
            const historyList = document.getElementById('solidarioHistoryList');

            if (data.causes.length > 0) {
                // Si hay historial, mostrar el link en la tarjeta
                if (historyLinkContainer && activeCause) historyLinkContainer.style.display = 'block';

                const openHistory = (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Generar la lista dinámica de historial
                    historyList.innerHTML = '';
                    data.causes.forEach((cause, idx) => {
                        const total = (parseFloat(cause.current_amount) || 0) + (parseFloat(cause.amount_on_hold) || 0);
                        const dates = new Date(cause.created_at).toLocaleDateString('es-ES');

                        let statusBadge = '';
                        if (cause.status === 'completed') statusBadge = '<span style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">Culminada</span>';
                        else if (cause.status === 'approved') statusBadge = '<span style="background: rgba(168, 85, 247, 0.2); color: #a855f7; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">Activa</span>';
                        else if (cause.status === 'pending') statusBadge = '<span style="background: rgba(234, 179, 8, 0.2); color: #eab308; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">Pendiente</span>';
                        else statusBadge = `<span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${cause.status}</span>`;

                        const linkHTML = (cause.status === 'approved' || cause.status === 'completed') ? `<a href="causa-solidaria.html?id=${cause.id}" style="color: #e83e8c; font-size: 0.8rem; text-decoration: underline; margin-top: 5px; display: inline-block;">Ver Detalle Público</a>` : '';

                        const cardHTML = `
                            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; position: relative;">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                    <h4 style="margin:0; font-size: 0.95rem; color: #f8fafc; line-height: 1.3; max-width: 70%;">${cause.title}</h4>
                                    ${statusBadge}
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #94a3b8;">
                                    <span>Recaudado: <strong style="color:white;">${total.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} BLUE</strong></span>
                                    <span>${dates}</span>
                                </div>
                                ${linkHTML}
                            </div>
                        `;
                        historyList.innerHTML += cardHTML;
                    });

                    historyModal.style.display = 'flex';
                };

                if (historyBtn && historyModal && historyCloseBtn && historyList) {
                    historyBtn.onclick = openHistory;
                    historyCloseBtn.onclick = () => { historyModal.style.display = 'none'; };
                    window.addEventListener('click', (e) => {
                        if (e.target === historyModal) {
                            historyModal.style.display = 'none';
                        }
                    });
                }

                if (historyMenuLink) {
                    historyMenuLink.style.display = 'block';
                    historyMenuLink.href = '#'; // Restablecemos el ancla para que la modal funcione sin saltos
                    historyMenuLink.onclick = (e) => {
                        const profileDropdown = document.getElementById('profileDropdown');
                        if (profileDropdown) profileDropdown.classList.remove('show');
                        openHistory(e);
                    };
                }

            } else {
                if (historyLinkContainer) historyLinkContainer.style.display = 'none';
                if (historyMenuLink) {
                    historyMenuLink.style.display = 'block';
                    historyMenuLink.href = 'solicitud-solidaria.html';
                    historyMenuLink.onclick = null; // Limpiar listeners anteriores para que sea enlace nativo
                }
            }

        } catch (error) {
            console.error('[Solidario] Error al cargar resumen:', error);
            card.style.display = 'none';
            // Fallback seguro en caso de error de red
            const historyMenuLink = document.getElementById('menuSolidarioHistory');
            if (historyMenuLink) {
                historyMenuLink.style.display = 'block';
                historyMenuLink.href = 'solicitud-solidaria.html';
            }
        }
    }

    function displaySolidarioCard(card, cause) {
        card.style.display = 'block';

        // --- NUEVO: Hacer la tarjeta clicable ---
        card.onclick = () => {
            if (cause.status === 'approved' || cause.status === 'completed') {
                window.location.href = `causa-solidaria.html?id=${cause.id}`;
            }
        };

        // --- NUEVO: Título dinámico con el autor ---
        const headerTitleEl = document.getElementById('solidarioCardHeaderTitle');
        if (headerTitleEl) {
            headerTitleEl.textContent = `Donación a la causa de ${storedUsername}`;
        }

        // Título de la causa
        const titleEl = document.getElementById('solidarioCardCauseTitle');
        if (titleEl) titleEl.textContent = cause.title;

        // Progreso (Opción A: Apilada)
        const currentAmount = parseFloat(cause.current_amount) || 0;
        const totalOnHold = parseFloat(cause.amount_on_hold) || 0;
        const goalAmount = parseFloat(cause.goal_amount) || 0;
        const totalRaised = currentAmount + totalOnHold;

        const percentageReleased = goalAmount > 0 ? Math.min((currentAmount / goalAmount) * 100, 100) : 0;
        const percentageOnHold = goalAmount > 0 ? Math.min((totalOnHold / goalAmount) * 100, 100 - percentageReleased) : 0;

        const amountEl = document.getElementById('solidarioCardAmount');
        const goalEl = document.getElementById('solidarioCardGoal');
        const fillEl = document.getElementById('solidarioCardProgressFill');
        const fillHoldEl = document.getElementById('solidarioCardProgressFillHold');

        if (amountEl) amountEl.textContent = totalRaised.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
        if (goalEl) goalEl.textContent = goalAmount.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

        if (fillEl) {
            fillEl.style.width = `${percentageReleased.toFixed(1)}%`;
            fillEl.style.background = ''; // Allow CSS gradient to apply
            fillEl.style.borderRadius = percentageOnHold > 0 ? '6px 0 0 6px' : '6px';
        }

        if (fillHoldEl) {
            fillHoldEl.style.width = `${percentageOnHold.toFixed(1)}%`;
            fillHoldEl.style.borderRadius = '0 3px 3px 0';
        }

        // Botón compartir
        const shareBtn = document.getElementById('solidarioCardShareBtn');
        if (shareBtn) {
            if (cause.status === 'approved') {
                shareBtn.style.opacity = '1';
                shareBtn.style.pointerEvents = 'auto';
                shareBtn.onclick = (e) => {
                    e.stopPropagation(); // Evitar click en la tarjeta general
                    const url = `${window.location.origin}/causa-solidaria.html?id=${cause.id}`;
                    // OPTIMIZACIÓN WEB SHARE API: Separar el texto base del enlace URL
                    // para evitar que el navegador móvil (iOS/Android) concatene la URL dos veces.
                    const baseText = `💙 Apoya mi causa "${cause.title}" en WintonCoin.\n\nDona tus BLUE IOU y marca la diferencia:`;

                    if (navigator.share) {
                        navigator.share({ title: `Winton Solidario: ${cause.title}`, text: baseText, url }).catch(() => { });
                    } else {
                        // FALLBACK ESCRITORIO: Concatenar manualmente el texto base y el enlace para compartir por WhatsApp
                        const fullText = `${baseText}\n${url}`;
                        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
                        window.open(whatsappUrl, '_blank');
                    }
                };
            } else {
                shareBtn.style.opacity = '0.5';
                shareBtn.style.pointerEvents = 'none';
            }
        }

        // ====== NUEVO: Botón Cancelar Causa ======
        // Removido a pedido del usuarió y reubicado en causa-solidaria
    }

    // --- VENTA RÁPIDA (recuperado del historial de Git) ---
    const quickSaleModal = document.getElementById('quickSaleModal');
    const openQuickSaleModalBtn = document.getElementById('openQuickSaleModalBtn');
    const quickSaleCloseBtn = document.querySelector('.quick-sale-close');
    const quickSaleForm = document.getElementById('quickSaleForm');

    const qrCodeModal = document.getElementById('qrCodeModal');
    const qrCodeCloseBtn = document.querySelector('.qr-code-close');
    const qrCodeOutput = document.getElementById('qrCodeOutput');
    const qrCodeUrlInput = document.getElementById('qrCodeUrl');
    const copyQrCodeUrlBtn = document.getElementById('copyQrCodeUrl');

    let qrCodeInstance = null; // Para mantener la instancia del QR y poder limpiarla

    if (openQuickSaleModalBtn && quickSaleModal) {
        openQuickSaleModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            quickSaleModal.style.display = 'flex';
        });
    }

    if (quickSaleCloseBtn) {
        quickSaleCloseBtn.addEventListener('click', () => {
            quickSaleModal.style.display = 'none';
        });
    }

    if (qrCodeCloseBtn) {
        qrCodeCloseBtn.addEventListener('click', () => {
            qrCodeModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (event) => {
        if (event.target === quickSaleModal) {
            quickSaleModal.style.display = 'none';
        }
        if (event.target === qrCodeModal) {
            qrCodeModal.style.display = 'none';
        }
    });

    if (quickSaleForm) {
        quickSaleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(quickSaleForm);
            const data = {
                title: formData.get('title'),
                amount: formData.get('amount'),
                targetUsername: formData.get('targetUsername'),
                authorUsername: storedUsername
            };

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/api/quick-sale`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token && { 'Authorization': `Bearer ${token}` })
                    },
                    body: JSON.stringify(data)
                });
                if (handleSessionExpired(response)) return;

                const result = await response.json();

                if (response.ok) {
                    // 1. Ocultar modal de formulario y resetearlo
                    quickSaleModal.style.display = 'none';
                    quickSaleForm.reset();

                    // 2. Generar URL y mostrar modal de QR
                    const publicationUrl = `${window.location.origin}/publication-detail.html?id=${result.publicationId}`;

                    // Limpiar QR anterior si existe
                    if (qrCodeOutput) qrCodeOutput.innerHTML = '';

                    // Crear nueva instancia de QRCode (la librería se carga desde CDN en el HTML)
                    if (typeof QRCode !== 'undefined' && qrCodeOutput) {
                        qrCodeInstance = new QRCode(qrCodeOutput, {
                            text: publicationUrl,
                            width: 256,
                            height: 256,
                            colorDark: '#000000',
                            colorLight: '#ffffff',
                            correctLevel: QRCode.CorrectLevel.H
                        });
                    }

                    if (qrCodeUrlInput) qrCodeUrlInput.value = publicationUrl;
                    if (qrCodeModal) qrCodeModal.style.display = 'flex';

                } else {
                    showCustomAlert(result.message || 'Error al crear la venta rápida.');
                }
            } catch (error) {
                console.error('Error en el submit de Venta Rápida:', error);
                showCustomAlert('Error de conexión al crear la venta rápida.');
            }
        });
    }

    if (copyQrCodeUrlBtn) {
        copyQrCodeUrlBtn.addEventListener('click', () => {
            if (qrCodeUrlInput) {
                qrCodeUrlInput.select();
                document.execCommand('copy');
                showCustomAlert('¡Enlace copiado al portapapeles!');
            }
        });
    }
});
