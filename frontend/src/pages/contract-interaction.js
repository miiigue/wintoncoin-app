/**
 * Contract Interaction (Dashboard) Page Module
 * Main dashboard for authenticated users - publications, balances, notifications
 */

import {
    getApiUrl,
    showCustomAlert,
    showCustomConfirm,
    linkify,
    fetchAndStoreAppSettings,
    appSettings,
    handleSessionExpired
} from '../modules/index.js';
import { initMigrationCheck } from '../modules/migrationManager.js';
import { initPWAInstall } from '../modules/pwa-install.js';
import { initOnboarding, restartTour } from '../modules/onboarding.js';
import { initNotificationGate } from '../modules/notificationGate.js';
import { initializeNotificationSettings } from '../modules/notificationSettings.js';
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
    initMigrationCheck();

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
        publicationSortFilter: document.getElementById('publicationSortFilter'),
        saldoBlue: document.getElementById('saldoBlue'),
        saldoRed: document.getElementById('saldoRed'),
        saldoEscrowBlue: document.getElementById('saldoEscrowBlue'),
        burnModal: document.getElementById('burnModal'),
        burnTriggerBtn: document.getElementById('burnTriggerBtn'),
        closeModalBtn: document.querySelector('#burnModal .close-button'),
        burnForm: document.getElementById('burnForm'),
        burnModalBalances: document.getElementById('burnModalBalances'),
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
        createPostPrelaunchAccept: document.getElementById('createPostPrelaunchAccept')
    };

    // Intervals for countdowns
    let debtCountdownInterval = null;
    let escrowCountdownInterval = null;
    let availableCountdownInterval = null;
    let lastBoosterFetch = 0;
    let platformSettingsCache = null;
    let publicationsCache = [];
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
        const ids = ['openPublicationModalBtn', 'openQuickSaleModalBtn', 'burnTriggerBtn'];
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

        const pendingNames = legalStatus.pending_documents
            .map((d) => d.type === 'terms_and_conditions' ? 'Términos y Condiciones' : (d.type === 'privacy_policy' ? 'Política de Privacidad' : d.type))
            .join(', ');

        const banner = existingBanner || document.createElement('div');
        banner.id = 'legal-acceptance-banner';
        banner.style.background = '#fff3cd';
        banner.style.color = '#5f370e';
        banner.style.border = '1px solid #ffe69c';
        banner.style.borderRadius = '10px';
        banner.style.padding = '12px';
        banner.style.margin = '12px auto';
        banner.style.maxWidth = '1200px';
        banner.innerHTML = `
            <strong>Actualizamos nuestros términos.</strong>
            Revisa y acepta para seguir operando.
            <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                <a href="terms.html" target="_blank" rel="noopener noreferrer" class="btn">Leer Términos</a>
                <a href="privacy.html" target="_blank" rel="noopener noreferrer" class="btn">Leer Privacidad</a>
                <button id="accept-legal-docs-btn" class="btn">He leído y acepto</button>
            </div>
        `;

        if (!existingBanner) {
            const rootContainer = document.querySelector('.container') || document.body;
            rootContainer.prepend(banner);
        }

        const acceptBtn = document.getElementById('accept-legal-docs-btn');
        if (acceptBtn) {
            acceptBtn.onclick = async () => {
                const token = localStorage.getItem('token');
                if (!token) return;
                if (!Array.isArray(legalStatus.pending_documents) || legalStatus.pending_documents.length === 0) {
                    showCustomAlert('No se encontraron documentos pendientes para aceptar. Recarga la página o contacta soporte.');
                    return;
                }

                acceptBtn.disabled = true;
                acceptBtn.textContent = 'Registrando aceptación...';
                try {
                    const response = await fetch(`${API_URL}/api/legal/accept`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            acceptedDocuments: legalStatus.pending_documents
                        })
                    });
                    const payload = await response.json();
                    if (!response.ok) {
                        throw new Error(payload.message || 'No se pudo registrar la aceptación legal.');
                    }
                    legalStatus = {
                        requires_terms_acceptance: !!payload.requires_terms_acceptance,
                        pending_documents: payload.pending_documents || []
                    };
                    renderLegalAcceptanceBanner();
                    showCustomAlert('Aceptación legal registrada correctamente. Ya puedes operar con normalidad.');
                } catch (error) {
                    console.error('[Legal] Error al aceptar documentos:', error);
                    showCustomAlert(error.message || 'No se pudo registrar la aceptación legal.');
                } finally {
                    const liveBtn = document.getElementById('accept-legal-docs-btn');
                    if (liveBtn) {
                        liveBtn.disabled = false;
                        liveBtn.textContent = 'He leído y acepto';
                    }
                }
            };
        }

        setCriticalActionButtonsDisabled(true);
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
                pending_documents: payload.pending_documents || []
            };
            renderLegalAcceptanceBanner();
        } catch (error) {
            console.error('[Legal] Error consultando estado legal:', error);
        }
    }

    // Show cached balances immediately
    if (elements.saldoBlue) elements.saldoBlue.innerHTML = formatBalance(localStorage.getItem('blue_balance'));
    if (elements.saldoEscrowBlue) elements.saldoEscrowBlue.innerHTML = formatBalance(localStorage.getItem('escrow_blue_balance'));
    if (elements.saldoRed) elements.saldoRed.innerHTML = formatBalance(localStorage.getItem('red_balance'));

    // Load data
    loadLegalStatus();
    loadAllData();
    setupDropdowns();
    setupEventListeners();
    checkPublicationPermissions();
    loadReferralSettings();
    setupShareReferral();

    initPWAInstall(); // Inicializar botón de instalación PWA

    initializeNotificationSettings();
    setupWalletTabs(); // Configurar listeners

    // SECUENCIA DE INICIO ORQUESTADA
    // 1. Notificaciones -> 2. Estado Billetera/Modal -> 3. Tour
    initNotificationGate()
        .then(() => initializeWalletState())
        .then(() => {
            setTimeout(initOnboarding, 500);
        });

    // Auto-refresh every 5 seconds
    setInterval(loadAllData, 5000);

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

    async function checkPublicationPermissions() {
        const settings = await getPlatformSettings();
        const modal = document.getElementById('publicationTypeModal');
        if (!modal) return;

        const requestOption = modal.querySelector('.modal-option-button.request');
        const sellOption = modal.querySelector('.modal-option-button.sell');
        const donationOption = modal.querySelector('.modal-option-button.donation');

        const toggleOption = (element, isEnabled, type) => {
            if (!element) return;
            element.classList.toggle('disabled', !isEnabled);
            if (!isEnabled) {
                element.style.cursor = 'not-allowed';
            } else {
                element.style.cursor = 'pointer';
                const newElement = element.cloneNode(true);
                element.parentNode.replaceChild(newElement, element);
                newElement.addEventListener('click', () => {
                    setTimeout(() => {
                        window.location.href = `publish.html?type=${type}`;
                    }, 50);
                });
            }
        };

        toggleOption(requestOption, settings.allow_request_publications, 'request');
        toggleOption(sellOption, settings.allow_sell_publications, 'sell');
        toggleOption(donationOption, settings.allow_donation_publications, 'donation');

        // Quick sale button
        const quickSaleBtn = document.getElementById('openQuickSaleModalBtn');
        if (quickSaleBtn) {
            quickSaleBtn.style.display = settings.allow_quick_sale_publications === false ? 'none' : 'inline-flex';
        }
    }

    function loadAllData() {
        fetchAndDisplayPublications();
        fetchNotifications();
        fetchAndDisplayBalances();
        fetchBoosterSummary();
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

        if (elements.publicationsList) {
            elements.publicationsList.addEventListener('click', handlePublicationAction);
        }

        if (elements.publicationSortFilter) {
            elements.publicationSortFilter.addEventListener('change', renderPublicationsWithFilters);
        }

        if (elements.burnTriggerBtn) {
            elements.burnTriggerBtn.addEventListener('click', () => {
                updateBurnModal();
                if (elements.burnModal) elements.burnModal.style.display = 'flex';
            });
        }

        if (elements.closeModalBtn) {
            elements.closeModalBtn.addEventListener('click', () => {
                if (elements.burnModal) elements.burnModal.style.display = 'none';
            });
        }

        if (elements.burnForm) {
            elements.burnForm.addEventListener('submit', handleBurnSubmit);
        }

        // Setup burn confirmation modal
        setupBurnConfirmModal();

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
            if (event.target === elements.burnModal && elements.burnModal) elements.burnModal.style.display = 'none';
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
            const response = await fetch(`${API_URL}/publications/${pubId}/confirm-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
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
            const response = await fetch(`${API_URL}/publications/active?user=${storedUsername}`);
            if (!response.ok) {
                elements.publicationsList.innerHTML = '<p>Error al cargar las publicaciones.</p>';
                return;
            }
            const publications = await response.json();

            if (publications.length === 0) {
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
                updatePublicationsCount([]);
                return;
            }

            publicationsCache = publications;
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

        // Un mapa para cachear las calificaciones de los usuarios
        const userRatingsCache = new Map();

        // Usamos Promise.all para obtener todas las calificaciones en paralelo
        const publicationsHTML = await Promise.all(filteredPublications.map(async (pub) => {
            // Obtener calificación del AUTOR
            if (!userRatingsCache.has(pub.author_username)) {
                const ratingData = await fetchUserRating(pub.author_username);
                userRatingsCache.set(pub.author_username, ratingData);
            }
            const authorRating = userRatingsCache.get(pub.author_username);
            const authorRatingHTML = generateStarRating(authorRating.average, authorRating.count);

            const blueLabel = getBlueUnitLabel(pub, platformSettings);
            return getPublicationCardHTML(pub, blueLabel, authorRatingHTML);
        }));

        elements.publicationsList.innerHTML = publicationsHTML.join('');
    }

    // Genera el HTML de estrellas para una calificación
    function generateStarRating(rating, count) {
        if (count === 0) {
            return '<span class="no-rating">Sin calificaciones</span>';
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

    function applySortAndFilter(publications) {
        // Aplica el criterio seleccionado (orden o filtro por tipo).
        const selected = elements.publicationSortFilter?.value || 'recent';
        let result = [...publications];

        // Si no hay filtro seleccionado, ordenar por prioridad de tareas en proceso
        if (!selected) {
            return sortByPendingPriority(result);
        }

        // Filtrar por tipo de publicación
        if (selected === 'type_request' || selected === 'type_sell' || selected === 'type_donation') {
            const desiredType = selected.replace('type_', '');
            result = result.filter(pub => getPublicationType(pub) === desiredType);
        }

        // Filtro especial: solo tareas en proceso del usuario
        if (selected === 'pending') {
            result = result.filter(pub => isPendingForUser(pub));
            return sortByPendingPriority(result);
        }

        // Ordenar por fecha
        if (selected === 'recent' || selected === 'oldest') {
            result.sort((a, b) => {
                const diff = getPublicationTimestamp(b) - getPublicationTimestamp(a);
                return selected === 'recent' ? diff : -diff;
            });
            // Siempre aplicar prioridad de tareas en proceso dentro del orden por fecha
            return sortByPendingPriority(result);
        }

        // Ordenar por recompensa
        if (selected === 'reward_desc' || selected === 'reward_asc') {
            result.sort((a, b) => {
                const diff = (Number(b.blue_cost) || 0) - (Number(a.blue_cost) || 0);
                return selected === 'reward_desc' ? diff : -diff;
            });
        }

        return result;
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

    // Ordena las publicaciones poniendo primero las que están en proceso
    function sortByPendingPriority(publications) {
        return [...publications].sort((a, b) => {
            const priorityDiff = getPendingPriority(a) - getPendingPriority(b);
            if (priorityDiff !== 0) return priorityDiff;
            // Si tienen la misma prioridad, ordenar por fecha (más recientes primero)
            return getPublicationTimestamp(b) - getPublicationTimestamp(a);
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
                message = 'Completa el pago para recibir el producto.';
            } else {
                message = '¡Aprobado! Ya puedes realizar la tarea.';
            }
            className = 'status-approved';
        } else if (userStatus === 'completed') {
            if (pub.is_sell_post) {
                message = 'Pago realizado. Esperando confirmación del vendedor.';
            } else {
                message = 'Tarea culminada. Esperando confirmación.';
            }
            className = 'status-completed';
        } else if (userStatus === 'pending_approval') {
            message = 'Solicitud enviada. Esperando aprobación.';
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
        const rewardText = `${formatBalance(pub.blue_cost)} ${blueLabel}`;
        const statusMessageHTML = getCardStatusMessageHTML(pub);

        let ribbonClass = '';
        if (pub.is_booster_task) ribbonClass = 'booster-ribbon';
        else if (pub.category === 'donation') ribbonClass = 'donation-ribbon';
        else if (pub.is_sell_post) ribbonClass = 'sell-ribbon';

        const slotsClass = pub.available_slots > 0 ? 'available' : 'full';
        const slotsText = pub.available_slots > 0
            ? `${pub.available_slots} cupo${pub.available_slots > 1 ? 's' : ''} disponible${pub.available_slots > 1 ? 's' : ''}`
            : `Cupos agotados`;

        // Información de expiración
        const expirationInfo = getExpirationStatusHTML(pub);

        // Enlace al perfil del autor (si los perfiles públicos están habilitados)
        const authorNameHTML = window.appSettings?.public_profiles_enabled
            ? `<a href="profile.html?user=${pub.author_username}" class="profile-link" onclick="event.stopPropagation()">${pub.author_username}</a>`
            : pub.author_username;

        // Estructura nueva: Precio a la izquierda, Menú a la derecha (en una fila superior)
        return `
            <a href="publication-detail.html?id=${pub.id}" class="publication-item-link">
                <div class="publication-item ${expirationInfo.isExpired ? 'expired' : ''}" data-id="${pub.id}" data-author="${pub.author_username}">
                    
                    <!-- Fila Superior: Precio y Menú -->
                    <div class="card-top-row">
                        <div class="cost-ribbon-left ${ribbonClass}">${rewardText}</div>
                        
                        <button class="card-close-btn" onclick="event.preventDefault(); event.stopPropagation(); window.handleCardAction('hide', ${pub.id})">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    ${statusMessageHTML}

                    <div class="publication-header">
                        <h3>${pub.title}</h3>
                    </div>
                    <p class="pub-description">${linkify(pub.description?.slice(0, 150) || '')}</p>
                    <div class="publication-footer">
                        <div class="pub-meta">
                            <span>Por: <strong>${authorNameHTML}</strong></span>
                            ${ratingHTML}
                        </div>
                        <div class="pub-meta-right">
                            <div class="slots-info ${slotsClass}">${slotsText}</div>
                            ${expirationInfo.html}
                        </div>
                    </div>
                </div>
            </a>
        `;
    }

    // Acción directa de ocultar
    window.handleCardAction = async function (action, id) {
        if (action === 'hide') {
            await hidePublication(id);
        }
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
                dropdown.innerHTML = '<div class="no-notifications">No tienes notificaciones nuevas.</div>';
            } else {
                notifications.forEach(notification => {
                    const item = document.createElement('div');
                    item.className = 'notification-item';
                    item.dataset.id = notification.id;
                    item.innerHTML = `
                        <p>${notification.message}</p>
                        <span class="notification-dismiss" data-id="${notification.id}" title="Descartar">&times;</span>
                    `;
                    dropdown.appendChild(item);
                });

                const footer = document.createElement('div');
                footer.className = 'notification-footer';
                footer.innerHTML = '<a href="#" class="notification-footer-link">Limpiar todas</a>';
                dropdown.appendChild(footer);
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

    async function clearAllNotifications() {
        try {
            const response = await postToServer('/api/me/notifications/mark-read', {}, { silent: true, reload: false });
            if (response.success) {
                const dropdown = document.getElementById('notificationDropdown');
                if (dropdown) dropdown.innerHTML = '<div class="no-notifications">No tienes notificaciones nuevas.</div>';
                updateNotificationBadge(0);
            }
        } catch (error) {
            console.error("Error al limpiar notificaciones:", error);
        }
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
                if (elements.saldoEscrowBlue) elements.saldoEscrowBlue.innerHTML = formatBalance(data.escrow_blue_balance);
                if (elements.saldoRed) elements.saldoRed.innerHTML = formatBalance(data.red_balance);

                localStorage.setItem('blue_balance', data.blue_balance);
                localStorage.setItem('escrow_blue_balance', data.escrow_blue_balance);
                localStorage.setItem('red_balance', data.red_balance);
                localStorage.setItem('penalized_debt', data.penalized_debt);

                // Countdown timers
                handleCountdownTimers(data);
            }
        } catch (error) {
            console.error('Error al obtener saldos:', error);
        }
    }

    function handleCountdownTimers(data) {
        // Available countdown
        if (data.next_available_at && parseFloat(data.next_available_amount) > 0 && elements.availableCountdownContainer) {
            elements.availableCountdownContainer.style.display = 'block';
            startCountdown(data.next_available_at, data.next_available_amount, elements.availableCountdownText, availableCountdownInterval, 'available');
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
                    <span>Deuda</span>
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

        // Check if user has sufficient RED debt to burn
        if (amount > redBalance) {
            const redBalanceText = redBalance.toFixed(4).replace('.', ',');
            showCustomAlert('No tienes suficiente deuda RED para quemar esta cantidad. Solo puedes quemar hasta ' + redBalanceText + ' RED.');
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
                    const response = await fetch(`${API_URL}/users/burn`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
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
    async function loadReferralSettings() {
        try {
            const response = await fetch(`${API_URL}/api/referral-settings`);
            if (response.ok) {
                const data = await response.json();
                const amountElement = document.getElementById('referralAmount');
                if (amountElement && data.referral_bonus_amount) {
                    const amount = parseInt(parseFloat(data.referral_bonus_amount));
                    if (!isNaN(amount)) {
                        amountElement.textContent = amount;
                    } else {
                        amountElement.textContent = '10';
                    }
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

            const [referralResponse, expiryResponse] = await Promise.all([
                fetch(`${API_URL}/api/users/${username}/referral-info`),
                fetch(`${API_URL}/api/referral-expiry-date`)
            ]);

            if (referralResponse.ok) {
                const data = await referralResponse.json();
                const referralCode = data.referral_code;
                const rewardAmount = document.getElementById('referralAmount')?.textContent || '10';
                const registrationUrl = `${window.location.origin}/register.html?ref=${referralCode}`;

                let expiryText = '';
                if (expiryResponse.ok) {
                    try {
                        const expiryData = await expiryResponse.json();
                        if (expiryData.expiry_date) {
                            const expiryDate = new Date(expiryData.expiry_date);
                            if (!isNaN(expiryDate.getTime())) {
                                const formattedDate = expiryDate.toLocaleDateString('es-ES', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                });
                                expiryText = ` (válido hasta el ${formattedDate})`;
                            }
                        }
                    } catch (error) {
                        console.warn('Error al formatear fecha de vigencia:', error);
                    }
                }

                const textToShare = `Registrate en WintonCoin con mi codigo de referido y ambos ganamos ${rewardAmount} BLUE IOU${expiryText}\n\n` +
                    `${referralCode}\n\n` +
                    `Recuerda que Tú ganas ${rewardAmount} BLUE IOU por cada amigo que invites!\n\n` +
                    `Regístrate aquí: ${registrationUrl}`;

                if (navigator.share) {
                    await navigator.share({
                        title: '¡Únete a WintonCoin!',
                        text: textToShare
                    });
                } else {
                    await navigator.clipboard.writeText(textToShare);
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
                const response = await fetch(`${API_URL}/api/quick-sale`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

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
