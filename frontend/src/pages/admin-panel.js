/**
 * Admin Panel Page Module
 * Handles admin dashboard, settings, users, publications management
 * RESTORED: Full functionality from v1.5.0
 */

import { getApiUrl, showCustomAlert, showCustomConfirm } from '../modules/index.js';

// Re-export for backward compatibility
window.getApiUrl = getApiUrl;
window.showCustomAlert = showCustomAlert;
window.showCustomConfirm = showCustomConfirm;

console.log('[AdminPanel] ES Module loaded - Full version');

document.addEventListener('DOMContentLoaded', () => {

    // --- Función de Utilidad para Escapar HTML (Sanitización) ---
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // --- Función de Utilidad para Formatear Saldos ---
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

    // --- Configuración y Estado ---
    const API_URL = getApiUrl();

    const elements = {
        navLinks: document.querySelectorAll('.nav-link'),
        sections: document.querySelectorAll('.admin-section'),
        logoutBtn: document.getElementById('adminLogoutBtn'),
        settingsContainer: document.getElementById('settings-switches'),
        phaseManagementContainer: document.getElementById('phase-management-switches'),
        dashboardContainer: document.getElementById('dashboard-stats'),
        usersTableContainer: document.getElementById('users-table-container'),
        userSearchInput: document.getElementById('userSearchInput'),
        userStatusFilter: document.getElementById('userStatusFilter'),
        debtorsTableContainer: document.getElementById('debtors-table-container'),
        publicationsTableContainer: document.getElementById('publications-table-container'),
        publicationSearchInput: document.getElementById('publicationSearchInput'),
        publicationStatusFilter: document.getElementById('publicationStatusFilter'),
        platformWalletStatsContainer: document.getElementById('platform-wallet-stats'),
        platformCommissionLogContainer: document.getElementById('platform-commission-log-container'),
        platformPublicationForm: document.getElementById('platformPublicationForm'),
        platformStepInputs: document.getElementById('platformStepInputs'),
        platformAddStepBtn: document.getElementById('platformAddStepBtn'),
        platformEditNotice: document.getElementById('platformEditNotice'),
        platformCancelEditBtn: document.getElementById('platformCancelEditBtn'),
        platformPublicationSubmitBtn: document.getElementById('platformPublicationSubmitBtn'),
        platformManagementList: document.getElementById('platform-management-list'),
        platformPublicationsBadge: document.getElementById('platformPublicationsBadge'),
        platformPublicationSearchInput: document.getElementById('platformPublicationSearchInput'),
        platformPublicationStatusFilter: document.getElementById('platformPublicationStatusFilter'),
        platformPublicationSortSelect: document.getElementById('platformPublicationSortSelect'),
        platformRepeatLimit: document.getElementById('platformRepeatLimit'),
        platformRepeatLimitWrapper: document.getElementById('platformRepeatLimitWrapper'),
        platformRepeatCooldownDays: document.getElementById('platformRepeatCooldownDays'),
        platformRepeatCooldownHours: document.getElementById('platformRepeatCooldownHours'),
        platformRepeatCooldownMinutes: document.getElementById('platformRepeatCooldownMinutes'),
        platformRepeatCooldownWrapper: document.getElementById('platformRepeatCooldownWrapper'),
        // --- AUDITORIA ---
        auditLogContainer: document.getElementById('audit-log-container'),
        auditEventTypeInput: document.getElementById('auditEventTypeInput'),
        auditActorInput: document.getElementById('auditActorInput'),
        auditTargetInput: document.getElementById('auditTargetInput'),
        auditCategoryInput: document.getElementById('auditCategoryInput'),
        auditFromInput: document.getElementById('auditFromInput'),
        auditToInput: document.getElementById('auditToInput'),
        auditLimitSelect: document.getElementById('auditLimitSelect'),
        auditApplyFiltersBtn: document.getElementById('auditApplyFiltersBtn'),
        auditExportCsvBtn: document.getElementById('auditExportCsvBtn'),
        // --- REFERIDOS ---
        referralsSettingsContainer: document.getElementById('referrals-settings-container'),
        referralsLogContainer: document.getElementById('referrals-log-container'),
        referralsTiersContainer: document.getElementById('referrals-tiers-container'),
        // --- IMPULSORES ---
        boosterSection: document.getElementById('boosters-section'),
        boostersSettingsContainer: document.getElementById('boosters-settings-container'),
        boostersDashboardStats: document.getElementById('boosters-dashboard-stats'),
        boostersListContainer: document.getElementById('boosters-list-container'),
        boostersPaymentsContainer: document.getElementById('boosters-payments-log-container'),
        boostersStagesContainer: document.getElementById('boosters-stages-container'),
        // --- NOTIFICACIONES ---
        notificationsSection: document.getElementById('notifications-section'),
        pushNotificationForm: document.getElementById('pushNotificationForm'),
        emailBroadcastForm: document.getElementById('emailBroadcastForm'),
        broadcastTargetGroup: document.getElementById('broadcastTargetGroup'),
        broadcastSpecificUserGroup: document.getElementById('broadcastSpecificUserGroup'),
        broadcastHistoryContainer: document.getElementById('email-broadcast-history-container'),

        // --- WINTON ACADEMY ---
        academySection: document.getElementById('academy-section'),
        academyVideoForm: document.getElementById('academyVideoForm'),
        academyTableContainer: document.getElementById('academy-table-container'),
        academyVideoUrl: document.getElementById('academyVideoUrl'),
        academyVideoTitle: document.getElementById('academyVideoTitle'),
        academyVideoOrder: document.getElementById('academyVideoOrder'),
        // --- WINTON SOLIDARIO (Causas Humanitarias) ---
        humanitarianStatsContainer: document.getElementById('humanitarian-stats'),
        humanitarianTableContainer: document.getElementById('humanitarian-table-container'),
        humanitarianSearchInput: document.getElementById('humanitarianSearchInput'),
        humanitarianStatusFilter: document.getElementById('humanitarianStatusFilter'),
        humanitarianBadge: document.getElementById('humanitarianBadge'),
        humanitarianDetailModal: document.getElementById('humanitarianDetailModal'),
        humanitarianModalTitle: document.getElementById('humanitarianModalTitle'),
        humanitarianModalBody: document.getElementById('humanitarianModalBody'),
        humanitarianModalActions: document.getElementById('humanitarianModalActions'),
        // --- RECOMPENSAS DE GOBERNANZA ---
        govRewardsStats: document.getElementById('gov-rewards-stats'),
        govRewardsAction: document.getElementById('gov-rewards-action'),
        govRewardsSummary: document.getElementById('gov-rewards-summary'),
        govRewardsDescription: document.getElementById('gov-rewards-description'),
        govRewardsProcessBtn: document.getElementById('gov-rewards-process-btn'),
        govRewardsResult: document.getElementById('gov-rewards-result'),
        // --- TRANSFERENCIA DEMO → PRODUCCIÓN ---
        govExportStats: document.getElementById('gov-export-stats'),
        govExportBtn: document.getElementById('gov-export-btn'),
        govExportResult: document.getElementById('gov-export-result'),
        govExportHistory: document.getElementById('gov-export-history'),
        govImportFile: document.getElementById('gov-import-file'),
        govImportValidateBtn: document.getElementById('gov-import-validate-btn'),
        govImportPreview: document.getElementById('gov-import-preview'),
        govImportProcessBtn: document.getElementById('gov-import-process-btn'),
        govImportResult: document.getElementById('gov-import-result'),
    };

    // --- Inicialización ---
    let platformPublicationsCache = [];
    let platformEditId = null;
    // --- NUEVO: Variables de Estado del Programa de Impulsores (Booster level filter) ---
    let activeBoosterLevelFilter = null;
    let boosterListCache = [];

    // --- NUEVO: Estado Legal para Admin (Simplificado para gestión) ---
    let legalStatus = { requires_terms_acceptance: false };
    setupEventListeners();
    // checkLegalStatus(); // Ruta obsoleta eliminada para mayor fluidez del panel
    renderConnectedUser(); // Inyectar el nombre de usuario del administrador activo
    checkAdminProfile(); // NUEVO: Verificar rol administrativo y ajustar menú del equipo
    showSection('dashboard');
    refreshPlatformPendingBadge();
    refreshHumanitarianBadge();
    setInterval(refreshPlatformPendingBadge, 30000);
    setInterval(refreshHumanitarianBadge, 30000);

    // --- Módulo: Renderizar Administrador Conectado ---
    function renderConnectedUser() {
        const adminUsername = localStorage.getItem('admin_username');
        const connectedUserEl = document.getElementById('adminConnectedUser');
        if (connectedUserEl) {
            if (adminUsername) {
                // Sanitizar y mostrar el usuario conectado
                connectedUserEl.textContent = `Conectado: ${escapeHtml(adminUsername)}`;
                connectedUserEl.style.display = 'block';
            } else {
                connectedUserEl.textContent = '';
                connectedUserEl.style.display = 'none';
            }
        }
    }

    // --- Lógica de la Interfaz ---
    function setupEventListeners() {
        elements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const sectionId = link.dataset.section;
                if (!sectionId) return; // Allow external links to work normally

                e.preventDefault();
                showSection(sectionId);
            });
        });

        // Permitir que el usuario haga clic en cualquier tarjeta del Dashboard para navegar a su sección
        if (elements.dashboardContainer) {
            elements.dashboardContainer.addEventListener('click', (e) => {
                const card = e.target.closest('.interactive-card');
                if (card) {
                    const targetSection = card.dataset.targetSection;
                    if (targetSection) {
                        showSection(targetSection);
                    }
                }
            });
        }

        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    // Petición POST para limpiar las cookies HttpOnly del servidor
                    await fetch(`${API_URL}/api/admin/logout`, { method: 'POST', credentials: 'include' });
                } catch (err) {
                    console.error("Error al cerrar sesión", err);
                }
                // Limpiar la referencia del usuario de localStorage
                localStorage.removeItem('admin_username');
                window.location.href = 'admin.html';
            });
        }

        if (elements.settingsContainer) {
            elements.settingsContainer.addEventListener('change', handleSettingChange);
            elements.settingsContainer.addEventListener('keyup', (event) => {
                if (event.target.type === 'number') {
                    handleSettingChange(event);
                }
            });
        }

        if (elements.phaseManagementContainer) {
            elements.phaseManagementContainer.addEventListener('change', handleSettingChange);
        }

        let searchTimeout;
        if (elements.userSearchInput) {
            elements.userSearchInput.addEventListener('keyup', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    loadUsers(elements.userSearchInput.value, elements.userStatusFilter.value);
                }, 300);
            });
        }

        if (elements.userStatusFilter) {
            elements.userStatusFilter.addEventListener('change', () => {
                loadUsers(elements.userSearchInput.value, elements.userStatusFilter.value);
            });
        }

        if (elements.usersTableContainer) {
            elements.usersTableContainer.addEventListener('click', handleUserAction);
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.action-menu-container') && !e.target.closest('.menu-toggle')) {
                document.querySelectorAll('.action-menu.visible').forEach(menu => {
                    menu.classList.remove('visible');
                });
            }
        });

        let pubSearchTimeout;
        if (elements.publicationSearchInput) {
            elements.publicationSearchInput.addEventListener('keyup', () => {
                clearTimeout(pubSearchTimeout);
                pubSearchTimeout = setTimeout(() => {
                    loadPublications(elements.publicationSearchInput.value, elements.publicationStatusFilter?.value || 'active');
                }, 300);
            });
        }

        if (elements.publicationStatusFilter) {
            elements.publicationStatusFilter.addEventListener('change', () => {
                loadPublications(elements.publicationSearchInput.value, elements.publicationStatusFilter.value);
            });
        }

        if (elements.publicationsTableContainer) {
            elements.publicationsTableContainer.addEventListener('click', handlePublicationAction);
        }

        if (elements.platformPublicationForm) {
            elements.platformPublicationForm.addEventListener('submit', handlePlatformPublicationSubmit);
        }

        let platformSearchTimeout;
        if (elements.platformPublicationSearchInput) {
            elements.platformPublicationSearchInput.addEventListener('keyup', () => {
                clearTimeout(platformSearchTimeout);
                platformSearchTimeout = setTimeout(() => {
                    applyPlatformManagementFilters();
                }, 250);
            });
        }

        if (elements.platformPublicationStatusFilter) {
            elements.platformPublicationStatusFilter.addEventListener('change', applyPlatformManagementFilters);
        }

        if (elements.platformPublicationSortSelect) {
            elements.platformPublicationSortSelect.addEventListener('change', applyPlatformManagementFilters);
        }

        const repeatCheckbox = document.getElementById('platformAllowRepeatParticipation');
        if (repeatCheckbox && elements.platformRepeatLimitWrapper && elements.platformRepeatCooldownWrapper) {
            const updateRepeatVisibility = () => {
                elements.platformRepeatLimitWrapper.style.display = repeatCheckbox.checked ? 'flex' : 'none';
                elements.platformRepeatCooldownWrapper.style.display = repeatCheckbox.checked ? 'flex' : 'none';
                if (!repeatCheckbox.checked && elements.platformRepeatLimit) {
                    elements.platformRepeatLimit.value = '2';
                }
                if (!repeatCheckbox.checked) {
                    if (elements.platformRepeatCooldownDays) elements.platformRepeatCooldownDays.value = '0';
                    if (elements.platformRepeatCooldownHours) elements.platformRepeatCooldownHours.value = '0';
                    if (elements.platformRepeatCooldownMinutes) elements.platformRepeatCooldownMinutes.value = '12';
                }
            };
            repeatCheckbox.addEventListener('change', updateRepeatVisibility);
            updateRepeatVisibility();
        }

        if (elements.platformCancelEditBtn) {
            elements.platformCancelEditBtn.addEventListener('click', resetPlatformEditForm);
        }

        // Acordeón para el formulario de publicaciones de plataforma
        const platformFormToggle = document.getElementById('platformFormToggle');
        const platformFormContent = document.getElementById('platformFormContent');
        if (platformFormToggle && platformFormContent) {
            platformFormToggle.addEventListener('click', () => {
                const isExpanded = platformFormContent.style.display !== 'none';
                platformFormContent.style.display = isExpanded ? 'none' : 'block';
                platformFormToggle.classList.toggle('expanded', !isExpanded);
            });
        }

        if (elements.platformAddStepBtn && elements.platformStepInputs) {
            elements.platformAddStepBtn.addEventListener('click', () => {
                const maxSteps = 20;
                const currentCount = elements.platformStepInputs.querySelectorAll('.admin-step-input').length;
                if (currentCount >= maxSteps) {
                    elements.platformAddStepBtn.disabled = true;
                    return;
                }

                const nextIndex = currentCount + 1;
                const wrapper = document.createElement('div');
                wrapper.className = 'admin-step-input';
                wrapper.setAttribute('data-step', nextIndex);

                // Solo pasos >= 2 tienen formulario dinámico
                const formToggleHTML = nextIndex >= 2 ? `
                    <div class="step-form-toggle">
                        <label class="toggle-label">
                            <input type="checkbox" class="step-form-checkbox" data-step="${nextIndex}">
                            <span>Activar formulario para este paso</span>
                        </label>
                        <div class="step-form-fields" style="display: none;">
                            <p class="form-hint">Define los campos que el usuario debe completar:</p>
                            <div class="step-form-inputs">
                                <div class="step-form-field-wrapper">
                                    <input type="text" class="step-form-field" placeholder="Campo 1">
                                    <select class="step-form-type-select" title="Tipo de campo">
                                        <option value="text">Texto corto</option>
                                        <option value="textarea">Texto largo</option>
                                    </select>
                                </div>
                                <div class="step-form-field-wrapper">
                                    <input type="text" class="step-form-field" placeholder="Campo 2">
                                    <select class="step-form-type-select" title="Tipo de campo">
                                        <option value="text">Texto corto</option>
                                        <option value="textarea">Texto largo</option>
                                    </select>
                                </div>
                                <div class="step-form-field-wrapper">
                                    <input type="text" class="step-form-field" placeholder="Campo 3 (opcional)">
                                    <select class="step-form-type-select" title="Tipo de campo">
                                        <option value="text">Texto corto</option>
                                        <option value="textarea">Texto largo</option>
                                    </select>
                                </div>
                            </div>
                            <button type="button" class="step-add-field-btn">+ Agregar más campos</button>
                        </div>
                    </div>
                ` : '';

                wrapper.innerHTML = `
                    <label for="platformStep${nextIndex}">Paso ${nextIndex}</label>
                    <input type="text" id="platformStep${nextIndex}" placeholder="Describe el paso ${nextIndex}">
                    ${formToggleHTML}
                `;

                elements.platformStepInputs.appendChild(wrapper);

                if (elements.platformStepInputs.querySelectorAll('.admin-step-input').length >= maxSteps) {
                    elements.platformAddStepBtn.disabled = true;
                }
            });
        }

        // Event delegation para formularios dinámicos en pasos
        if (elements.platformStepInputs) {
            elements.platformStepInputs.addEventListener('change', (e) => {
                if (e.target.classList.contains('step-form-checkbox')) {
                    const stepContainer = e.target.closest('.admin-step-input');
                    const formFields = stepContainer.querySelector('.step-form-fields');
                    if (formFields) {
                        formFields.style.display = e.target.checked ? 'block' : 'none';
                    }
                }
            });

            elements.platformStepInputs.addEventListener('click', (e) => {
                if (e.target.classList.contains('step-add-field-btn')) {
                    const formInputs = e.target.previousElementSibling;
                    const fieldCount = formInputs.querySelectorAll('.step-form-field-wrapper').length;
                    if (fieldCount < 10) {
                        // Crear wrapper con input + selector de tipo
                        const wrapper = document.createElement('div');
                        wrapper.className = 'step-form-field-wrapper';
                        wrapper.innerHTML = `
                            <input type="text" class="step-form-field" placeholder="Campo ${fieldCount + 1}">
                            <select class="step-form-type-select" title="Tipo de campo">
                                <option value="text">Texto corto</option>
                                <option value="textarea">Texto largo</option>
                            </select>
                        `;
                        formInputs.appendChild(wrapper);
                    }
                    if (fieldCount >= 9) {
                        e.target.style.display = 'none';
                    }
                }
            });
        }

        if (elements.platformManagementList) {
            elements.platformManagementList.addEventListener('click', handlePlatformAction);
        }

        // Auditoria
        if (elements.auditApplyFiltersBtn) {
            elements.auditApplyFiltersBtn.addEventListener('click', () => {
                loadAuditLog();
            });
        }
        if (elements.auditExportCsvBtn) {
            elements.auditExportCsvBtn.addEventListener('click', () => {
                exportAuditCsv();
            });
        }

        if (elements.boosterSection) {
            const tabLinks = elements.boosterSection.querySelectorAll('.tab-link');
            tabLinks.forEach(link => {
                link.addEventListener('click', () => {
                    const tabId = link.dataset.tab;
                    // Si el usuario da clic en la pestaña "Lista de Impulsores" directamente,
                    // limpiamos el filtro por defecto para mostrar el listado completo
                    if (tabId === 'boosters-list') {
                        activeBoosterLevelFilter = null;
                    }
                    showBoosterTab(tabId);
                });
            });

            // Delegamos el clic en el contenedor de estadísticas del dashboard de impulsores
            // para interceptar los clics en los enlaces "impulsores" de cada nivel
            // Delegamos el clic en el contenedor de estadísticas del dashboard de impulsores
            // para interceptar los clics en las tarjetas interactivas completas
            if (elements.boostersDashboardStats) {
                elements.boostersDashboardStats.addEventListener('click', (e) => {
                    const card = e.target.closest('.interactive-card');
                    if (card) {
                        e.preventDefault();
                        const targetTab = card.dataset.targetTab;
                        const level = card.dataset.level;

                        // Si la tarjeta corresponde a un nivel específico de impulsor, configuramos
                        // el filtro para listar únicamente los usuarios de dicho nivel.
                        if (level) {
                            activeBoosterLevelFilter = parseInt(level, 10); // Asignamos el filtro de nivel activo
                        } else {
                            activeBoosterLevelFilter = null; // Limpiamos el filtro si es una tarjeta general
                        }

                        // Redirigir a la pestaña interna de la sección de impulsores (ej. Historial de Pagos)
                        // o, en su defecto, a una sección externa del menú de administración (ej. Billetera / platform-wallet)
                        if (targetTab) {
                            showBoosterTab(targetTab);
                        } else {
                            const targetSection = card.dataset.targetSection;
                            if (targetSection) {
                                showSection(targetSection);
                            }
                        }
                    }
                });
            }

            // Configuramos el listener del botón para limpiar el filtro de nivel de booster
            const clearFilterBtn = document.getElementById('clear-booster-filter-btn');
            if (clearFilterBtn) {
                clearFilterBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    activeBoosterLevelFilter = null;
                    renderBoosterList(boosterListCache);
                });
            }
        }

        if (elements.notificationsSection) {
            const tabLinks = elements.notificationsSection.querySelectorAll('.tab-link');
            tabLinks.forEach(link => {
                link.addEventListener('click', () => {
                    const tabId = link.dataset.tab;
                    showNotificationsTab(tabId);
                });
            });
        }

        if (elements.broadcastTargetGroup) {
            elements.broadcastTargetGroup.addEventListener('change', (e) => {
                if (elements.broadcastSpecificUserGroup) {
                    elements.broadcastSpecificUserGroup.style.display = e.target.value === 'specific' ? 'block' : 'none';
                }
            });
        }

        if (elements.emailBroadcastForm) {
            elements.emailBroadcastForm.addEventListener('submit', handleBroadcastFormSubmit);
        }

        const saveDailyMessagesBtn = document.getElementById('saveDailyMessagesBtn');
        if (saveDailyMessagesBtn) {
            saveDailyMessagesBtn.addEventListener('click', saveDailyModalSettings);
        }

        // --- WINTON SOLIDARIO: Event Listeners ---
        let humanitarianSearchTimeout;
        if (elements.humanitarianSearchInput) {
            elements.humanitarianSearchInput.addEventListener('keyup', () => {
                clearTimeout(humanitarianSearchTimeout);
                humanitarianSearchTimeout = setTimeout(() => loadHumanitarianCauses(), 300);
            });
        }
        if (elements.humanitarianStatusFilter) {
            elements.humanitarianStatusFilter.addEventListener('change', () => loadHumanitarianCauses());
        }
        // Cerrar modal humanitario
        if (elements.humanitarianDetailModal) {
            elements.humanitarianDetailModal.querySelectorAll('.humanitarian-modal-close').forEach(btn => {
                btn.addEventListener('click', () => {
                    elements.humanitarianDetailModal.style.display = 'none';
                });
            });
            elements.humanitarianDetailModal.addEventListener('click', (e) => {
                if (e.target === elements.humanitarianDetailModal) {
                    elements.humanitarianDetailModal.style.display = 'none';
                }
            });
        }
    }

    function showSection(sectionId) {
        elements.sections.forEach(section => section.classList.remove('active-section'));
        elements.navLinks.forEach(link => link.classList.remove('active'));

        const sectionEl = document.getElementById(`${sectionId}-section`);
        const navEl = document.querySelector(`.nav-link[data-section="${sectionId}"]`);

        if (sectionEl) sectionEl.classList.add('active-section');
        if (navEl) navEl.classList.add('active');

        if (sectionId === 'dashboard') loadDashboardData();
        else if (sectionId === 'settings') loadSettings();
        else if (sectionId === 'users') loadUsers();
        else if (sectionId === 'debtors') loadDebtors();
        else if (sectionId === 'publications') loadPublications();
        else if (sectionId === 'platform-wallet') loadPlatformWalletData();
        else if (sectionId === 'platform-publications') loadPlatformManagementData();
        else if (sectionId === 'referrals') loadReferralsData();
        else if (sectionId === 'boosters') showBoosterTab('boosters-dashboard');
        else if (sectionId === 'notifications') {
            showNotificationsTab('notifications-push');
        }
        else if (sectionId === 'audit-log') loadAuditLog();
        else if (sectionId === 'academy') loadAcademyVideos();
        else if (sectionId === 'humanitarian') loadHumanitarianCauses();
        else if (sectionId === 'gov-rewards') loadGovRewardsSection();
        else if (sectionId === 'kyc-compliance') initKycSection();
        else if (sectionId === 'team') {
            initTeamSection();
            loadInvitationsList();
            loadActiveAdminsList();
        }
    }

    function showBoosterTab(tabId) {
        if (!elements.boosterSection) return;

        elements.boosterSection.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        elements.boosterSection.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));

        const tabContent = document.getElementById(`${tabId}-tab`);
        const tabLink = document.querySelector(`.tab-link[data-tab="${tabId}"]`);

        if (tabContent) tabContent.classList.add('active');
        if (tabLink) tabLink.classList.add('active');

        switch (tabId) {
            case 'boosters-dashboard':
                loadBoosterDashboard();
                break;
            case 'boosters-settings':
                loadBoosterSettings();
                break;
            case 'boosters-stages':
                loadBoosterStages();
                break;
            case 'boosters-list':
                loadBoosterList();
                break;
            case 'boosters-payments':
                loadBoosterPayments();
                break;
        }
    }

    // --- API Fetch Segura ---
    async function apiFetch(endpoint, options = {}) {
        const defaultOptions = {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        };

        if (options.headers) {
            defaultOptions.headers = { ...defaultOptions.headers, ...options.headers };
            delete options.headers;
        }

        try {
            const response = await fetch(`${API_URL}${endpoint}`, { ...defaultOptions, ...options });

            if (response.status === 401) {
                window.location.href = 'admin.html';
                throw new Error('Sesión expirada o no autorizada.');
            }

            if (response.status === 403) {
                const errorData = await response.json();
                if (errorData.governance_required) {
                    throw new Error(errorData.message);
                }
                window.location.href = 'admin.html';
                throw new Error('No autorizado.');
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Error del servidor: ${response.status}`);
            }

            return response.json();
        } catch (error) {
            if (error.message === 'Sesión expirada o no autorizada.') throw error;
            console.error(`Error en apiFetch a ${endpoint}:`, error);
            throw error;
        }
    }

    // --- Gestión Legal ---
    async function checkLegalStatus() {
        try {
            // Intentamos obtener el estado legal para el usuario 'Plataforma WintonCoin'
            // que es el que usa el admin para firmar transacciones de sistema.
            const status = await apiFetch(`/api/legal-status?username=${encodeURIComponent('Plataforma WintonCoin')}`);
            legalStatus = status;

            if (status && status.requires_terms_acceptance) {
                console.warn("Se requiere aceptación de términos para la plataforma.");
                showLegalModal(status);
            }
        } catch (error) {
            console.error("Error al verificar estado legal:", error);
        }
    }

    function showLegalModal(status) {
        // Reutilizamos la lógica del modal legal si existe en el DOM o mostramos un aviso
        if (typeof window.showLegalAcceptanceModal === 'function') {
            window.showLegalAcceptanceModal(status, async (acceptedDocs) => {
                try {
                    await apiFetch('/api/accept-legal', {
                        method: 'POST',
                        body: JSON.stringify({
                            username: 'Plataforma WintonCoin',
                            acceptedDocuments: acceptedDocs
                        })
                    });
                    legalStatus.requires_terms_acceptance = false;
                    showCustomAlert("Términos aceptados para la plataforma.");
                } catch (err) {
                    showCustomAlert("Error al aceptar términos: " + err.message);
                }
            });
        } else {
            // Fallback si el script legal no está cargado: aviso persistente
            const banner = document.createElement('div');
            banner.style.cssText = "position:fixed;top:0;left:0;right:0;background:var(--admin-warning);color:white;padding:1rem;text-align:center;z-index:9999;font-weight:bold;";
            banner.innerHTML = `Acción requerida: Hay nuevos términos legales pendientes para la Plataforma. 
                               <a href="index.html" style="color:white;text-decoration:underline;margin-left:1rem;">Ir al inicio para aceptar</a>`;
            document.body.prepend(banner);
        }
    }

    // --- Data Loading Functions ---
    async function loadUsers(searchTerm = '', statusFilter = '') {
        if (!elements.usersTableContainer) return;
        elements.usersTableContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const users = await apiFetch(`/api/admin/users?search=${encodeURIComponent(searchTerm)}&status=${encodeURIComponent(statusFilter)}`);
            renderUsersTable(users);
        } catch (error) {
            elements.usersTableContainer.innerHTML = `<p class="error-message">Error al cargar los usuarios: ${escapeHtml(error.message)}</p>`;
        }
    }

    async function loadDebtors() {
        if (!elements.debtorsTableContainer) return;
        elements.debtorsTableContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const debtors = await apiFetch(`/api/admin/debtors`);
            renderDebtorsTable(debtors);
        } catch (error) {
            elements.debtorsTableContainer.innerHTML = `<p class="error-message">Error al cargar los compromisos vencidos: ${escapeHtml(error.message)}</p>`;
        }
    }

    async function loadPublications(searchTerm = '', filter = 'active') {
        if (!elements.publicationsTableContainer) return;
        elements.publicationsTableContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const publications = await apiFetch(`/api/admin/publications?search=${encodeURIComponent(searchTerm)}&filter=${encodeURIComponent(filter)}`);
            renderPublicationsTable(publications);
        } catch (error) {
            elements.publicationsTableContainer.innerHTML = `<p class="error-message">Error al cargar las publicaciones: ${escapeHtml(error.message)}</p>`;
        }
    }

    async function loadPlatformWalletData() {
        if (!elements.platformWalletStatsContainer) return;
        elements.platformWalletStatsContainer.innerHTML = '<div class="loading-spinner"></div>';
        if (elements.platformCommissionLogContainer) {
            elements.platformCommissionLogContainer.innerHTML = '<div class="loading-spinner"></div>';
        }
        try {
            const [walletData, log] = await Promise.all([
                apiFetch('/api/admin/platform-wallet/balance'),
                apiFetch('/api/admin/platform-wallet/log')
            ]);
            renderPlatformWallet(walletData);
            renderCommissionLog(log);
        } catch (error) {
            elements.platformWalletStatsContainer.innerHTML = `<p class="error-message">Error al cargar datos de la billetera: ${escapeHtml(error.message)}</p>`;
            if (elements.platformCommissionLogContainer) {
                elements.platformCommissionLogContainer.innerHTML = '';
            }
        }
    }

    async function loadPlatformManagementData() {
        if (!elements.platformManagementList) return;
        elements.platformManagementList.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const publications = await apiFetch('/api/admin/platform/publications-with-participants');
            platformPublicationsCache = publications || [];
            applyPlatformManagementFilters();
        } catch (error) {
            elements.platformManagementList.innerHTML = `<p class="error-message">Error al cargar las publicaciones de la plataforma: ${escapeHtml(error.message)}</p>`;
        }
    }

    async function refreshPlatformPendingBadge() {
        try {
            const publications = await apiFetch('/api/admin/platform/publications-with-participants');
            const totals = getPlatformPendingTotals(publications);
            updatePlatformPublicationsBadge(totals.totalPending);
        } catch (error) {
            console.warn('No se pudo actualizar el badge de pendientes:', error.message);
        }
    }

    async function loadDashboardData() {
        if (!elements.dashboardContainer) return;
        elements.dashboardContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const stats = await apiFetch('/api/admin/dashboard-stats');
            renderDashboard(stats);
        } catch (error) {
            elements.dashboardContainer.innerHTML = `<p class="error-message">Error al cargar el dashboard: ${escapeHtml(error.message)}</p>`;
        }
    }

    async function loadSettings() {
        if (!elements.settingsContainer) return;
        elements.settingsContainer.innerHTML = '<div class="loading-spinner"></div>';
        if (elements.phaseManagementContainer) {
            elements.phaseManagementContainer.innerHTML = '<div class="loading-spinner"></div>';
        }
        try {
            const settings = await apiFetch('/api/admin/settings');
            renderSettings(settings);
        } catch (error) {
            showCustomAlert(error.message);
        }
    }

    async function loadReferralsData() {
        if (!elements.referralsSettingsContainer || !elements.referralsLogContainer || !elements.referralsTiersContainer) return;
        elements.referralsSettingsContainer.innerHTML = '<div class="loading-spinner"></div>';
        elements.referralsTiersContainer.innerHTML = '<div class="loading-spinner"></div>';
        elements.referralsLogContainer.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const [settings, log, tiersData] = await Promise.all([
                apiFetch('/api/admin/settings'),
                apiFetch('/api/admin/referrals/log'),
                apiFetch('/api/admin/referrals/tiers')
            ]);

            renderReferralSettings(settings);
            renderReferralTiers(tiersData);
            renderReferralLog(log);

        } catch (error) {
            elements.referralsSettingsContainer.innerHTML = `<p class="error-message">Error al cargar la configuración de referidos: ${escapeHtml(error.message)}</p>`;
            elements.referralsTiersContainer.innerHTML = `<p class="error-message">Error al cargar los tramos de referidos: ${escapeHtml(error.message)}</p>`;
            elements.referralsLogContainer.innerHTML = `<p class="error-message">Error al cargar el log de referidos: ${escapeHtml(error.message)}</p>`;
        }
    }

    async function loadBoosterDashboard() {
        if (!elements.boostersDashboardStats) return;
        elements.boostersDashboardStats.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const stats = await apiFetch('/api/admin/boosters/stats');
            renderBoosterDashboard(stats);
        } catch (error) {
            elements.boostersDashboardStats.innerHTML = `<p class="error-message">Error al cargar el dashboard de impulsores: ${escapeHtml(error.message)}</p>`;
        }
    }

    async function loadBoosterList() {
        if (!elements.boostersListContainer) return;
        elements.boostersListContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const boosters = await apiFetch('/api/admin/boosters/list');
            boosterListCache = boosters; // Cacheamos el listado completo cargado del servidor
            renderBoosterList(boosters);
        } catch (error) {
            elements.boostersListContainer.innerHTML = `<p class="error-message">Error al cargar la lista de impulsores: ${escapeHtml(error.message)}</p>`;
        }
    }

    async function loadBoosterPayments() {
        if (!elements.boostersPaymentsContainer) return;
        elements.boostersPaymentsContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const payments = await apiFetch('/api/admin/boosters/payments');
            renderBoosterPayments(payments);
        } catch (error) {
            elements.boostersPaymentsContainer.innerHTML = `<p class="error-message">Error al cargar el historial de pagos: ${escapeHtml(error.message)}</p>`;
        }
    }

    async function loadBoosterSettings() {
        if (!elements.boostersSettingsContainer) return;
        elements.boostersSettingsContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const [appSettings, boosterLevels] = await Promise.all([
                apiFetch('/api/admin/settings'),
                apiFetch('/api/admin/boosters/settings')
            ]);
            renderBoosterSettings(appSettings, boosterLevels);
        } catch (error) {
            elements.boostersSettingsContainer.innerHTML = `<p class="error-message">Error al cargar la configuración de impulsores: ${escapeHtml(error.message)}</p>`;
        }
    }

    async function loadAuditLog() {
        if (!elements.auditLogContainer) return;
        elements.auditLogContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const params = buildAuditQueryParams();
            const result = await apiFetch(`/api/admin/audit-log?${params.toString()}`);
            renderAuditLogTable(result);
        } catch (error) {
            elements.auditLogContainer.innerHTML = `<p class="error-message">Error al cargar auditoria: ${escapeHtml(error.message)}</p>`;
        }
    }

    function buildAuditQueryParams() {
        const params = new URLSearchParams();
        if (elements.auditEventTypeInput?.value) params.set('eventType', elements.auditEventTypeInput.value.trim());
        if (elements.auditActorInput?.value) params.set('actor', elements.auditActorInput.value.trim());
        if (elements.auditTargetInput?.value) params.set('target', elements.auditTargetInput.value.trim());
        if (elements.auditCategoryInput?.value) params.set('category', elements.auditCategoryInput.value.trim());
        if (elements.auditFromInput?.value) params.set('from', elements.auditFromInput.value);
        if (elements.auditToInput?.value) params.set('to', elements.auditToInput.value);
        if (elements.auditLimitSelect?.value) params.set('limit', elements.auditLimitSelect.value);
        return params;
    }

    async function exportAuditCsv() {
        try {
            const params = buildAuditQueryParams();
            if (!params.get('limit')) params.set('limit', '200');
            const result = await apiFetch(`/api/admin/audit-log?${params.toString()}`);
            const rows = result?.rows || [];
            if (rows.length === 0) {
                showCustomAlert('No hay eventos para exportar con esos filtros.');
                return;
            }
            const csv = buildAuditCsv(rows);
            downloadCsv(csv, 'audit_log.csv');
        } catch (error) {
            showCustomAlert(`Error al exportar CSV: ${error.message}`);
        }
    }

    function buildAuditCsv(rows) {
        const headers = ['id', 'created_at', 'event_type', 'actor_username', 'target_username', 'publication_id', 'category', 'ip_address', 'user_agent', 'metadata'];
        const lines = [headers.join(',')];
        rows.forEach(row => {
            const values = headers.map(key => {
                const raw = key === 'metadata' ? JSON.stringify(row[key] || {}) : (row[key] ?? '');
                const text = String(raw).replace(/"/g, '""');
                return `"${text}"`;
            });
            lines.push(values.join(','));
        });
        return lines.join('\n');
    }

    function downloadCsv(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // --- Settings Rendering ---
    function getSettingTitleAndDescription(key) {
        const map = {
            'allow_new_registrations': { title: 'Permitir Nuevos Registros', description: 'Activa o desactiva esta característica para toda la plataforma.' },
            'public_profiles_enabled': { title: 'Perfiles Públicos', description: 'Permite que cualquiera vea los perfiles públicos de los usuarios.' },
            'debt_system_enabled': { title: 'Sistema de Compromisos (Tokens RED)', description: 'Activa o desactiva la creación y gestión de compromisos RED.' },
            'platform_commission_percentage': { title: 'Comisión de Plataforma (%)', description: 'Porcentaje de comisión para la plataforma (ej: 5 para 5%).' },
            'booster_system_enabled': { title: 'Sistema de Impulsores', description: 'Activa el sistema de Impulsores y su lógica de pagos mensuales.' },
            'booster_custom_frequency_enabled': { title: 'Frecuencia de Pago Personalizada', description: 'Si se activa, el sistema realizará los pagos en el intervalo configurado abajo (días, horas, minutos) en lugar del ciclo mensual del primer día de cada mes.' },
            'booster_payment_frequency_days': { title: 'Frecuencia Personalizada — Días', description: 'Número de días en el intervalo de pago personalizado de impulsores.' },
            'booster_payment_frequency_hours': { title: 'Frecuencia Personalizada — Horas', description: 'Número de horas en el intervalo de pago personalizado de impulsores.' },
            'booster_payment_frequency_minutes': { title: 'Frecuencia Personalizada — Minutos', description: 'Número de minutos en el intervalo de pago personalizado de impulsores.' },
            'referral_system_enabled': { title: 'Sistema de Referidos', description: 'Activa o desactiva el bono por registro con código de referido.' },
            'referral_reward_amount': { title: 'Recompensa por Referido (BLUE)', description: 'Cantidad de BLUE que ganan referente y referido.' },
            'referral_reward_after_expiry': { title: 'Recompensa después de la promo (BLUE)', description: 'Cantidad de BLUE que se otorgará una vez expire la promoción.' },
            'referral_codes_expiry_date': { title: 'Vigencia hasta', description: 'Fecha de expiración de los códigos de referido (formato: YYYY-MM-DD).' },
            'welcome_bonus_enabled': { title: 'Bono de Bienvenida', description: 'Activa o desactiva el bono al registrarse sin código.' },
            'welcome_bonus_amount': { title: 'Monto del Bono de Bienvenida (BLUE)', description: 'Cantidad de BLUE que se otorga sin código de referido.' },
            'pre_launch_mode_enabled': { title: 'Modo Pre-Lanzamiento', description: 'Todas las ganancias van al Perfil de Impulsor, no se crea RED.' },
            'allow_request_publications': { title: 'Permitir Publicaciones de "Solicitud"', description: 'Los usuarios pueden publicar tareas para que otros las realicen.' },
            'allow_sell_publications': { title: 'Permitir Publicaciones de "Venta"', description: 'Los usuarios pueden publicar productos o servicios para vender.' },
            'allow_donation_publications': { title: 'Permitir Publicaciones de "Donación"', description: 'Los usuarios pueden solicitar donaciones.' },
            'allow_quick_sale_publications': { title: 'Permitir Publicaciones de "Venta Rápida"', description: 'Habilita el botón de Venta Rápida para transacciones exprés.' },
            // P2P
            'p2p_enabled': { title: 'P2P — Habilitado', description: 'Habilita el módulo P2P para compra/venta de BLUE entre usuarios.' },
            'p2p_price_min': { title: 'P2P — Precio Mínimo (USD)', description: 'Precio mínimo permitido por 1 BLUE en USD.' },
            'p2p_price_max': { title: 'P2P — Precio Máximo (USD)', description: 'Precio máximo permitido por 1 BLUE en USD.' },
            'p2p_fee_percentage': { title: 'P2P — Comisión (%)', description: 'Comisión P2P total en porcentaje.' },
            'p2p_payment_window_minutes': { title: 'P2P — Ventana de Pago (min)', description: 'Minutos máximos para confirmar el pago.' },
            'p2p_extension_minutes': { title: 'P2P — Extensión (min)', description: 'Minutos de extensión al aceptar una prórroga.' },
            'p2p_extension_limit': { title: 'P2P — Límite de Extensiones', description: 'Cantidad máxima de extensiones por orden.' },
            'p2p_cash_min_rating': { title: 'P2P — Reputación Mínima para Efectivo', description: 'Calificación mínima requerida para usar efectivo en persona.' },
            // Gobernanza (Winton-Consensus)
            'gov_quorum_percentage': { title: 'Gobernanza — Quórum Requerido (%)', description: 'Porcentaje de votos necesarios para aprobar o rechazar (mín. 51, máx. 100).' },
            'gov_timelock_hours': { title: 'Gobernanza — Time-Lock (horas)', description: 'Horas de espera tras alcanzar el quórum de aprobación, antes de ejecutar un cambio de membresía (reloj del servidor).' },
            'gov_request_expiry_hours': { title: 'Gobernanza — Expiración de Solicitud (horas)', description: 'Horas que tiene una solicitud para alcanzar quórum.' },
            'gov_reminder_threshold_hours': { title: 'Gobernanza — Umbral de Recordatorio (horas)', description: 'Cuando quedan estas horas para expirar, se envía recordatorio.' },
            'gov_reminder_cooldown_hours': { title: 'Gobernanza — Enfriamiento entre Recordatorios (horas)', description: 'Horas mínimas entre recordatorios al mismo guardián.' },
            'gov_vote_reward_blue': { title: 'Gobernanza — Recompensa por Voto (BLUE IOU)', description: 'BLUE IOU acreditados al guardián al emitir su voto. Valor 0 desactiva la recompensa.' },
            // Credit Scoring (Winton Trust Score)
            'red_credit_base_limit': { title: 'Scoring — Límite Base RED (Nuevos Usuarios)', description: 'El límite de crédito inicial que se asigna a los nuevos usuarios al registrarse.' },
            'red_credit_culture_quiz': { title: 'Scoring — Bono por Cuestionario de Cultura (RED)', description: 'Aumento del límite por aprobar cuestionarios de la Winton Academy.' },
            'red_credit_referral': { title: 'Scoring — Bono por Referido Activo (RED)', description: 'Aumento del límite por cada referido exitoso que utilice la plataforma.' },
            'red_credit_monthly_activity': { title: 'Scoring — Bono por Alta Actividad (RED)', description: 'Aumento del límite al superar 20 tareas en un mes calendario.' },
            'red_credit_early_payment': { title: 'Scoring — Bono por Amortización Anticipada (RED)', description: 'Aumento del límite por amortizar compromisos en los primeros 5 días del ciclo.' },
            // Winton Solidario (Causas Humanitarias y Reembolsos)
            'donation_refund_enabled': { title: 'Reembolso Automático de Donaciones', description: 'Activa o desactiva el demonio que devuelve automáticamente las donaciones en espera (on_hold) si el donante no verifica su KYC Web3.' },
            'donation_escrow_expiration_days': { title: 'Días de Retención de Donaciones', description: 'Cantidad de días que una donación permanece en espera antes de ser devuelta automáticamente al donante si este no completa su KYC.' }
        };
        return map[key] || { title: key, description: 'Sin descripción.' };
    }

    function getSettingTitle(key) {
        const setting = getSettingTitleAndDescription(key);
        return setting.title;
    }

    function renderSettings(settings) {
        const phaseSettings = settings.filter(s => ['pre_launch_mode_enabled', 'allow_request_publications', 'allow_sell_publications', 'allow_donation_publications', 'allow_quick_sale_publications'].includes(s.setting_key));
        const timeSettingsRaw = settings.filter(s => s.setting_key.startsWith('debt_cycle_') || s.setting_key.startsWith('blue_escrow_'));

        const referralKeys = [
            'referral_system_enabled', 'referral_reward_amount',
            'welcome_bonus_enabled', 'welcome_bonus_amount',
            'referral_bonus_enabled', 'referral_bonus_amount'
        ];
        const generalSettings = settings.filter(s =>
            !phaseSettings.includes(s) &&
            !timeSettingsRaw.includes(s) &&
            !referralKeys.includes(s.setting_key)
        );

        if (elements.phaseManagementContainer) {
            elements.phaseManagementContainer.innerHTML = phaseSettings.map(s => getSettingHTML(s, 'switch')).join('');
        }

        if (elements.settingsContainer) {
            elements.settingsContainer.innerHTML = generalSettings.map(s => {
                if (s.setting_key.endsWith('_enabled') || s.setting_key.endsWith('registrations')) return getSettingHTML(s, 'switch');
                if (s.setting_key === 'gov_vote_reward_blue') return getSettingHTML(s, 'number');
                if (s.setting_key === 'donation_escrow_expiration_days') return getSettingHTML(s, 'integer');
                if (s.setting_key.startsWith('gov_')) return getSettingHTML(s, 'integer');
                if (s.setting_key.startsWith('p2p_')) return getSettingHTML(s, 'number');
                if (s.setting_key.startsWith('red_credit_')) return getSettingHTML(s, 'number');
                if (s.setting_key.endsWith('_amount') || s.setting_key.includes('percentage')) return getSettingHTML(s, 'number');
                return '';
            }).join('');

            const timeSettingsGrouped = {
                debt_cycle: { label: 'Duración del Ciclo de Compromiso RED', description: 'Define el período de tiempo para esta funcionalidad.', settings: [] },
                blue_escrow: { label: 'Duración del Depósito BLUE (Escrow)', description: 'Define el período de tiempo para esta funcionalidad.', settings: [] }
            };
            timeSettingsRaw.forEach(setting => {
                if (setting.setting_key.startsWith('debt_cycle_')) {
                    timeSettingsGrouped.debt_cycle.settings.push(setting);
                } else if (setting.setting_key.startsWith('blue_escrow_')) {
                    timeSettingsGrouped.blue_escrow.settings.push(setting);
                }
            });

            for (const groupKey in timeSettingsGrouped) {
                elements.settingsContainer.innerHTML += getTimeGroupHTML(timeSettingsGrouped[groupKey]);
            }

            elements.settingsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.addEventListener('change', handleSettingChange);
            });

            elements.settingsContainer.querySelectorAll('input[type="number"]').forEach(input => {
                input.addEventListener('change', handleSettingChange);
                input.addEventListener('keyup', (event) => {
                    if (event.key === 'Enter') {
                        handleSettingChange(event);
                    }
                });
            });
        }

        if (elements.phaseManagementContainer) {
            elements.phaseManagementContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.addEventListener('change', handleSettingChange);
            });
        }
    }

    function getSettingHTML(setting, type) {
        const { title, description } = getSettingTitleAndDescription(setting.setting_key);
        const safeKey = escapeHtml(setting.setting_key);
        const safeValue = escapeHtml(setting.setting_value);
        const safeTitle = escapeHtml(title);
        const safeDescription = escapeHtml(description);

        let controlHTML = '';

        if (type === 'switch') {
            controlHTML = `
                <label class="switch">
                    <input type="checkbox" data-key="${safeKey}" ${setting.setting_value === 'true' ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            `;
        } else if (type === 'number') {
            controlHTML = `
                <input type="number" class="admin-numeric-input" data-key="${safeKey}" value="${parseFloat(setting.setting_value).toFixed(2)}" step="0.01" min="0">
            `;
        } else if (type === 'integer') {
            controlHTML = `
                <input type="number" class="admin-numeric-input" data-key="${safeKey}" value="${parseInt(setting.setting_value, 10) || 0}" step="1" min="1">
            `;
        } else if (type === 'date') {
            controlHTML = `
                <input type="date" class="admin-date-input" data-key="${safeKey}" value="${safeValue || ''}">
            `;
        }

        return `
            <div class="setting-item">
                <div class="setting-item-info">
                    <h4>${safeTitle}</h4>
                    <p>${safeDescription}</p>
                </div>
                <div class="setting-item-control">
                    ${controlHTML}
                </div>
            </div>
        `;
    }

    function getTimeGroupHTML(group) {
        if (group.settings.length === 0) return '';

        group.settings.sort((a, b) => {
            const order = ['days', 'hours', 'minutes'];
            const aKey = a.setting_key.split('_').pop();
            const bKey = b.setting_key.split('_').pop();
            return order.indexOf(aKey) - order.indexOf(bKey);
        });

        return `
            <div class="setting-item">
                <div class="setting-item-info">
                    <h4>${escapeHtml(group.label)}</h4>
                    <p>${escapeHtml(group.description)}</p>
                </div>
                <div class="setting-item-control-group">
                    ${group.settings.map(setting => {
            const unit = setting.setting_key.split('_').pop();
            const safeKey = escapeHtml(setting.setting_key);
            const safeValue = escapeHtml(setting.setting_value);
            return `
                            <div class="numeric-group-item">
                                <label for="setting-${safeKey}">${unit.charAt(0).toUpperCase() + unit.slice(1)}</label>
                                <input type="number" class="admin-numeric-input" id="setting-${safeKey}" data-key="${safeKey}" value="${safeValue}" min="0">
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    }

    function renderReferralSettings(allSettings) {
        const referralKeys = ['referral_system_enabled', 'referral_reward_after_expiry', 'referral_codes_expiry_date', 'welcome_bonus_enabled', 'welcome_bonus_amount'];
        const referralSettings = allSettings.filter(s => referralKeys.includes(s.setting_key));

        const container = document.getElementById('referrals-settings-container');
        if (container) {
            container.innerHTML = referralSettings.map(s => {
                if (s.setting_key.endsWith('_enabled')) return getSettingHTML(s, 'switch');
                if (s.setting_key.endsWith('_amount') || s.setting_key.endsWith('_after_expiry')) return getSettingHTML(s, 'number');
                if (s.setting_key === 'referral_codes_expiry_date') return getSettingHTML(s, 'date');
                return '';
            }).join('');

            container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.addEventListener('change', handleSettingChange);
            });

            container.querySelectorAll('input[type="number"]').forEach(input => {
                input.addEventListener('change', handleSettingChange);
                input.addEventListener('keyup', (event) => {
                    if (event.key === 'Enter') {
                        handleSettingChange(event);
                    }
                });
            });

            container.querySelectorAll('input[type="date"]').forEach(input => {
                input.addEventListener('change', handleSettingChange);
            });
        }
    }

    function renderReferralTiers(data) {
        const container = elements.referralsTiersContainer;
        if (!container) return;

        const tiers = data.tiers;
        const totalUsers = data.totalUsers;

        let projectedTotal = 0;
        tiers.forEach(t => {
            const reward = parseFloat(t.reward_amount);
            const limit = parseInt(t.max_users_limit, 10);
            
            let prevLimit = 0;
            if (t.tier_number > 1) {
                const prevTier = tiers.find(pt => parseInt(pt.tier_number, 10) === t.tier_number - 1);
                if (prevTier) {
                    prevLimit = parseInt(prevTier.max_users_limit, 10);
                }
            }
            const usersInTier = Math.max(0, limit - prevLimit);
            projectedTotal += (usersInTier * reward * 2);
        });

        let html = `
            <div class="admin-card" style="border-left: 4px solid var(--admin-primary); margin-bottom: 1.5rem; background: #1c1c1e; padding: 20px; border-radius: 12px;">
                <h3 style="margin-top: 0; color: #fff;">Estado del Pool Promocional</h3>
                <div style="margin: 10px 0;">
                    <div style="display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 5px; color: #fff;">
                        <span>BLUE comprometido en tramos:</span>
                        <span>${projectedTotal.toLocaleString('es-ES')} / 200.000.000 BLUE</span>
                    </div>
                    <div style="background: rgba(255, 255, 255, 0.1); border-radius: 10px; height: 10px; overflow: hidden; width: 100%;">
                        <div style="background: ${projectedTotal > 200000000 ? '#ff453a' : 'var(--admin-primary)'}; width: ${Math.min(100, (projectedTotal / 200000000) * 100)}%; height: 100%; transition: width 0.3s ease;"></div>
                    </div>
                    <small style="color: #8e8e93; display: block; margin-top: 8px; font-size: 0.85rem;">
                        Actualmente hay <strong style="color: #fff;">${totalUsers.toLocaleString('es-ES')}</strong> usuarios registrados en la plataforma.
                    </small>
                </div>
            </div>

            <table class="admin-table" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <thead>
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                        <th style="text-align: left; padding: 12px;">Tramo</th>
                        <th style="text-align: left; padding: 12px;">Límite de Usuarios (Límite Superior)</th>
                        <th style="text-align: left; padding: 12px;">Recompensa Referente y Referido (BLUE IOU)</th>
                        <th style="text-align: left; padding: 12px;">Emisión Máxima del Tramo</th>
                        <th style="text-align: left; padding: 12px;">Estado</th>
                    </tr>
                </thead>
                <tbody>
        `;

        tiers.forEach(t => {
            const reward = parseFloat(t.reward_amount);
            const limit = parseInt(t.max_users_limit, 10);
            
            let prevLimit = 0;
            if (t.tier_number > 1) {
                const prevTier = tiers.find(pt => parseInt(pt.tier_number, 10) === t.tier_number - 1);
                if (prevTier) {
                    prevLimit = parseInt(prevTier.max_users_limit, 10);
                }
            }
            const usersInTier = Math.max(0, limit - prevLimit);
            const maxTierEmission = usersInTier * reward * 2;

            const isActive = totalUsers >= prevLimit && totalUsers < limit;
            const statusBadge = isActive ? 
                '<span class="badge badge-success" style="font-weight:700; background: rgba(52, 199, 89, 0.2); color: #30d158; padding: 4px 8px; border-radius: 4px;">[ACTIVO HOY]</span>' : 
                (totalUsers >= limit ? '<span class="badge badge-secondary" style="opacity:0.6; background: rgba(255,255,255,0.1); color: #fff; padding: 4px 8px; border-radius: 4px;">Completado</span>' : '<span class="badge badge-secondary" style="opacity:0.6; background: rgba(255,255,255,0.05); color: #8e8e93; padding: 4px 8px; border-radius: 4px;">Próximo</span>');

            const activeRowStyle = isActive ? 'style="background: rgba(10, 132, 255, 0.08); border-left: 3px solid var(--admin-primary);"' : '';

            html += `
                <tr ${activeRowStyle} style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                    <td style="padding: 12px;"><strong>${escapeHtml(t.label)}</strong></td>
                    <td style="padding: 12px;">
                        <input type="number" class="admin-numeric-input tier-limit-input" 
                            data-tier-id="${t.id}" data-tier-number="${t.tier_number}" 
                            value="${limit}" style="width: 100%; max-width: 180px; padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: #1c1c1e; color: #fff;" min="1" required>
                    </td>
                    <td style="padding: 12px;">
                        <input type="number" class="admin-numeric-input tier-reward-input" 
                            data-tier-id="${t.id}" data-tier-number="${t.tier_number}" 
                            value="${reward.toFixed(2)}" style="width: 100%; max-width: 150px; padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: #1c1c1e; color: #fff;" min="0" step="0.01" required>
                    </td>
                    <td style="padding: 12px; font-weight: 500; color: #ff9f0a;">
                        ${maxTierEmission.toLocaleString('es-ES')} BLUE
                    </td>
                    <td style="padding: 12px;">${statusBadge}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
            
            <div style="margin-top: 15px; display: flex; justify-content: flex-end;">
                <button id="save-referrals-tiers-btn" class="action-button-admin publish" style="background: var(--admin-primary); color: #fff; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    Guardar Configuración de Tramos
                </button>
            </div>
        `;

        container.innerHTML = html;

        const saveBtn = document.getElementById('save-referrals-tiers-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', handleSaveReferralTiers);
        }
    }

    async function handleSaveReferralTiers() {
        const limitInputs = document.querySelectorAll('.tier-limit-input');
        const rewardInputs = document.querySelectorAll('.tier-reward-input');
        
        const tiers = [];
        
        for (let i = 0; i < limitInputs.length; i++) {
            const id = parseInt(limitInputs[i].dataset.tierId, 10);
            const tierNumber = parseInt(limitInputs[i].dataset.tierNumber, 10);
            const limit = parseInt(limitInputs[i].value, 10);
            const reward = parseFloat(rewardInputs[i].value);
            
            if (isNaN(limit) || limit <= 0 || isNaN(reward) || reward < 0) {
                showCustomAlert('Todos los límites y recompensas deben ser números positivos.');
                return;
            }
            
            tiers.push({
                id,
                tier_number: tierNumber,
                label: tierNumber === 1 ? 'Tramo 1 (Primeros 10k)' : (tierNumber === 2 ? 'Tramo 2 (Siguientes 300k)' : 'Tramo 3 (Siguientes 700k)'),
                max_users_limit: limit,
                reward_amount: reward
            });
        }
        
        for (let i = 1; i < tiers.length; i++) {
            if (tiers[i].max_users_limit <= tiers[i - 1].max_users_limit) {
                showCustomAlert(`El límite del Tramo ${tiers[i].tier_number} (${tiers[i].max_users_limit}) debe ser mayor que el del Tramo ${tiers[i - 1].tier_number} (${tiers[i - 1].max_users_limit}).`);
                return;
            }
        }
        
        let projectedTotal = 0;
        for (let i = 0; i < tiers.length; i++) {
            const reward = tiers[i].reward_amount;
            const limit = tiers[i].max_users_limit;
            const prevLimit = i > 0 ? tiers[i - 1].max_users_limit : 0;
            projectedTotal += ((limit - prevLimit) * reward * 2);
        }
        
        if (projectedTotal > 200000000) {
            showCustomAlert(`Error de Viabilidad Financiera: La recompensa total proyectada (${projectedTotal.toLocaleString('es-ES')} BLUE) excede el pool promocional de 200.000.000 BLUE.`);
            return;
        }
        
        try {
            const saveBtn = document.getElementById('save-referrals-tiers-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerText = 'Guardando...';
            }
            
            const response = await apiFetch('/api/admin/referrals/tiers', {
                method: 'POST',
                body: JSON.stringify({ tiers })
            });
            
            showCustomAlert(response.message || 'Configuración de tramos guardada exitosamente.');
            loadReferralsData();
        } catch (error) {
            console.error('Error al guardar tramos:', error);
            showCustomAlert(error.message || 'Error al guardar la configuración de tramos.');
            const saveBtn = document.getElementById('save-referrals-tiers-btn');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerText = 'Guardar Configuración de Tramos';
            }
        }
    }

    function renderBoosterSettings(appSettings, boosterLevels) {
        const container = elements.boostersSettingsContainer;
        if (!container) return;
        container.innerHTML = '';

        // 1. Switch principal para habilitar el sistema de impulsores general
        const systemEnabledSetting = appSettings.find(s => s.setting_key === 'booster_system_enabled');
        if (systemEnabledSetting) {
            const title = getSettingTitle(systemEnabledSetting.setting_key);
            const safeKey = escapeHtml(systemEnabledSetting.setting_key);
            const description = systemEnabledSetting.description || 'Activa o desactiva el programa de impulsores y los pagos mensuales.';

            const itemHTML = `
                <div class="setting-item">
                    <div class="setting-item-info">
                        <h4>${escapeHtml(title)}</h4>
                        <p>${escapeHtml(description)}</p>
                    </div>
                    <div class="setting-item-control">
                        <label class="switch">
                            <input type="checkbox" data-key="${safeKey}" ${systemEnabledSetting.setting_value === 'true' ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
            `;
            container.innerHTML += itemHTML;
        }

        // 2. Nueva configuración de frecuencia de pagos personalizada
        const customFreqEnabledSetting = appSettings.find(s => s.setting_key === 'booster_custom_frequency_enabled');
        const freqDaysSetting = appSettings.find(s => s.setting_key === 'booster_payment_frequency_days') || { setting_value: '0' };
        const freqHoursSetting = appSettings.find(s => s.setting_key === 'booster_payment_frequency_hours') || { setting_value: '0' };
        const freqMinutesSetting = appSettings.find(s => s.setting_key === 'booster_payment_frequency_minutes') || { setting_value: '5' };

        if (customFreqEnabledSetting) {
            const title = getSettingTitle(customFreqEnabledSetting.setting_key);
            const safeKey = escapeHtml(customFreqEnabledSetting.setting_key);
            const description = customFreqEnabledSetting.description || 'Habilita o desactiva la frecuencia de cobro personalizada.';

            const customFreqHTML = `
                <div class="setting-item">
                    <div class="setting-item-info">
                        <h4>${escapeHtml(title)}</h4>
                        <p>${escapeHtml(description)}</p>
                    </div>
                    <div class="setting-item-control">
                        <label class="switch">
                            <input type="checkbox" data-key="${safeKey}" ${customFreqEnabledSetting.setting_value === 'true' ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>

                <!-- Grupo de campos numéricos para la frecuencia personalizada -->
                <div class="setting-item" id="booster-custom-frequency-inputs" style="margin-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 1rem;">
                    <div class="setting-item-info">
                        <h4>Intervalo de Pago Personalizado</h4>
                        <p>Establece el intervalo de tiempo exacto para la distribución automática de comisiones.</p>
                    </div>
                    <div class="setting-item-control-group">
                        <div class="numeric-group-item">
                            <label for="setting-booster-days">Días</label>
                            <input type="number" class="admin-numeric-input" id="setting-booster-days" data-key="booster_payment_frequency_days" value="${escapeHtml(freqDaysSetting.setting_value)}" min="0">
                        </div>
                        <div class="numeric-group-item">
                            <label for="setting-booster-hours">Horas</label>
                            <input type="number" class="admin-numeric-input" id="setting-booster-hours" data-key="booster_payment_frequency_hours" value="${escapeHtml(freqHoursSetting.setting_value)}" min="0" max="23">
                        </div>
                        <div class="numeric-group-item">
                            <label for="setting-booster-minutes">Minutos</label>
                            <input type="number" class="admin-numeric-input" id="setting-booster-minutes" data-key="booster_payment_frequency_minutes" value="${escapeHtml(freqMinutesSetting.setting_value)}" min="0" max="59">
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += customFreqHTML;
        }

        container.innerHTML += '<hr class="admin-divider">';

        // 3. Tabla para definir umbrales de niveles de impulsores
        const tableHTML = `
            <h2>Niveles de Impulsor</h2>
            <p>Define los umbrales de BLUE requeridos para alcanzar cada nivel.</p>
            <div class="table-container-admin">
                <table class="admin-table" id="booster-levels-table">
                    <thead>
                        <tr>
                            <th>Nivel</th>
                            <th>Nombre del Nivel</th>
                            <th>BLUE Mínimo Requerido</th>
                            <th>Descripción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${boosterLevels.map(level => `
                            <tr data-level="${escapeHtml(level.level)}">
                                <td class="level-cell">${escapeHtml(level.level)}</td>
                                <td><input type="text" class="admin-text-input" data-field="name" value="${escapeHtml(level.name)}"></td>
                                <td><input type="number" class="admin-numeric-input" data-field="min_blue_required" value="${escapeHtml(level.min_blue_required)}" step="any"></td>
                                <td><textarea class="admin-textarea-input" data-field="description">${escapeHtml(level.description || '')}</textarea></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML += tableHTML;

        // Listener para los cambios en la tabla de niveles
        container.querySelectorAll('#booster-levels-table input, #booster-levels-table textarea').forEach(input => {
            input.addEventListener('change', handleBoosterLevelChange);
        });

        // Registrar listeners para todos los switches y inputs numéricos del bloque de configuraciones de booster
        container.querySelectorAll('input[type="checkbox"], input[type="number"]').forEach(input => {
            if (!input.closest('#booster-levels-table')) {
                input.addEventListener('change', handleSettingChange);
                if (input.type === 'number') {
                    input.addEventListener('keyup', (event) => {
                        if (event.key === 'Enter') {
                            handleSettingChange(event);
                        }
                    });
                }
            }
        });
    }

    function renderBoosterDashboard(stats) {
        if (!elements.boostersDashboardStats) return;

        // Mapeo de etiquetas y colores premium por nivel
        const levelNames = {
            1: 'Visionario (Nivel 1)',
            2: 'Bronce (Nivel 2)',
            3: 'Plata (Nivel 3)',
            4: 'Oro (Nivel 4)',
            5: 'Platino (Nivel 5)'
        };

        const levelColors = {
            1: '#3B82F6', // Azul Visionario
            2: '#b45309', // Ámbar Bronce
            3: '#94a3b8', // Slate Plata
            4: '#fbbf24', // Amarillo Oro
            5: '#a78bfa'  // Púrpura Platino
        };

        let levelCardsHTML = '';
        for (let lvl = 1; lvl <= 5; lvl++) {
            const debt = (stats.debt_by_level && stats.debt_by_level[lvl]) || { total: 0, eligible: 0 };
            levelCardsHTML += `
                <div class="stat-card interactive-card" style="border-left: 4px solid ${levelColors[lvl]};" data-target-tab="boosters-list" data-level="${lvl}">
                    <h4>${escapeHtml(levelNames[lvl])}</h4>
                    <p class="stat-value saldo-blue-text">${formatBalance(debt.total)}</p>
                    <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 6px;">
                        Apto KYC: <strong style="color: #10B981;">${formatBalance(debt.eligible)} BLUE</strong>
                    </div>
                </div>
            `;
        }

        let coverageHTML = '';
        let hasCoverage = false;
        if (stats.coverage_by_level && Array.isArray(stats.coverage_by_level)) {
            stats.coverage_by_level.forEach(cov => {
                // Según la regla de negocio: solo mostrar los niveles que tengan alcance (> 0%)
                if (cov.percentage > 0) {
                    hasCoverage = true;
                    let color = '#3B82F6'; // Azul para cobertura parcial
                    
                    if (cov.percentage === 100) {
                        color = '#10B981'; // Verde para cobertura total
                    }
                    
                    coverageHTML += `
                        <div style="margin-bottom: 12px;">
                            <p class="stat-value" style="color: ${color};">${cov.percentage}%</p>
                            <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 4px;">
                                Nivel ${cov.level}
                            </div>
                        </div>
                    `;
                }
            });
        }
        
        if (!hasCoverage) {
            coverageHTML = `
                <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 10px; text-align: center; font-style: italic;">
                    Comisiones insuficientes para proyectar canjes en este momento.
                </div>
            `;
        }

        elements.boostersDashboardStats.innerHTML = `
            <div class="stat-card interactive-card" data-target-tab="boosters-list">
                <h4>Impulsores Totales</h4>
                <p class="stat-value">${escapeHtml(stats.total_boosters || 0)}</p>
                <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 4px;">
                    Aptos KYC: <strong style="color: #10B981;">${escapeHtml(stats.eligible_boosters || 0)}</strong>
                </div>
            </div>
            <div class="stat-card interactive-card" data-target-tab="boosters-list">
                <h4>Compromiso Total (BLUE de Impulsores)</h4>
                <p class="stat-value saldo-blue-text">${formatBalance(stats.total_booster_blue_debt)}</p>
                <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 4px;">
                    Apto KYC: <strong style="color: #10B981;">${formatBalance(stats.eligible_booster_blue_debt)} BLUE</strong>
                </div>
            </div>
            <div class="stat-card interactive-card" data-target-section="platform-wallet">
                <h4>Comisiones Acumuladas</h4>
                <p class="stat-value saldo-blue-text">${formatBalance(stats.platform_commission_balance || 0)}</p>
                <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 4px;">
                    Saldo de comisiones disponible en caja
                </div>
            </div>
            <div class="stat-card interactive-card">
                <h4>Proyección de Canje</h4>
                <div style="margin-top: 8px;">
                    ${coverageHTML}
                </div>
            </div>
            <div class="stat-card interactive-card" data-target-tab="boosters-payments">
                <h4>Total Pagado (BLUE)</h4>
                <p class="stat-value saldo-blue-text">${formatBalance(stats.total_blue_paid_out)}</p>
                <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 4px;">
                    Enviado a balance de custodia (Escrow)
                </div>
            </div>
            <div class="stat-card interactive-card" data-target-tab="boosters-payments">
                <h4>Pagos Mensuales Realizados</h4>
                <p class="stat-value">${escapeHtml(stats.total_payments_made || 0)}</p>
                <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 4px;">
                    Ciclos ejecutados por cron automático
                </div>
            </div>
            ${levelCardsHTML}
        `;
    }

    function renderBoosterList(boosters) {
        if (!elements.boostersListContainer) return;

        // Control de visibilidad del badge de filtro activo en la lista de impulsores
        const filterBadgeContainer = document.getElementById('boosters-filter-badge-container');
        const activeLevelNum = document.getElementById('active-filter-level-num');
        
        if (filterBadgeContainer && activeLevelNum) {
            if (activeBoosterLevelFilter !== null) {
                const levelNamesShort = {
                    1: '1 (Visionario)',
                    2: '2 (Bronce)',
                    3: '3 (Plata)',
                    4: '4 (Oro)',
                    5: '5 (Platino)'
                };
                activeLevelNum.textContent = levelNamesShort[activeBoosterLevelFilter] || activeBoosterLevelFilter;
                filterBadgeContainer.style.display = 'block';
            } else {
                filterBadgeContainer.style.display = 'none';
            }
        }

        // Filtrar localmente en el cliente para máxima eficiencia, libre de inyección SQL
        const filteredBoosters = activeBoosterLevelFilter
            ? boosters.filter(b => Number(b.booster_level) === Number(activeBoosterLevelFilter))
            : boosters;

        if (!filteredBoosters || filteredBoosters.length === 0) {
            elements.boostersListContainer.innerHTML = '<p class="empty-message">No se encontraron impulsores para este nivel en la plataforma.</p>';
            return;
        }

        const tableHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Nivel de Impulsor</th>
                        <th style="text-align: center;">Estado KYC</th>
                        <th>Total BLUE de Impulsor</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredBoosters.map(booster => `
                        <tr>
                            <td class="username-cell">
                                <a href="profile.html?user=${escapeHtml(booster.username)}" target="_blank">${escapeHtml(booster.username)}</a>
                            </td>
                            <td align="center">${escapeHtml(booster.booster_level)}</td>
                            <td align="center">
                                ${booster.kyc_verified 
                                    ? '<span class="status-badge active" style="background-color: #10B981; font-size: 0.75rem; padding: 4px 8px; border-radius: 12px; font-weight: bold; color: white;">Verificado</span>' 
                                    : '<span class="status-badge" style="background-color: #EF4444; font-size: 0.75rem; padding: 4px 8px; border-radius: 12px; font-weight: bold; color: white;">No Verificado</span>'}
                            </td>
                            <td class="saldo-blue-text">${formatBalance(booster.total_booster_blue)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        elements.boostersListContainer.innerHTML = tableHTML;
    }

    function renderBoosterPayments(payments) {
        if (!elements.boostersPaymentsContainer) return;

        // Calcular el total de lo que se ha pagado en el historial
        const totalPaid = payments.reduce((acc, p) => acc + (parseFloat(p.amount_paid) || 0), 0);
        const totalCount = payments.length;

        const summaryHTML = `
            <div class="booster-payments-summary-bar" style="display: flex; gap: 1.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                <div class="stat-card" style="flex: 1; min-width: 250px; border-left: 4px solid #10B981; margin-bottom: 0; padding: 16px; background: var(--admin-card-bg); border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h4 style="margin: 0; font-size: 0.9rem; color: var(--admin-text-secondary); font-weight: 500;">Total de Recompensas Liquidadas</h4>
                    <p class="stat-value saldo-blue-text" style="margin: 8px 0 4px; font-size: 1.8rem; font-weight: 700; color: #10B981;">+${formatBalance(totalPaid)}</p>
                    <div style="font-size: 0.8rem; color: var(--admin-text-secondary);">
                        Suma del historial mostrado
                    </div>
                </div>
                <div class="stat-card" style="flex: 1; min-width: 250px; border-left: 4px solid #3B82F6; margin-bottom: 0; padding: 16px; background: var(--admin-card-bg); border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h4 style="margin: 0; font-size: 0.9rem; color: var(--admin-text-secondary); font-weight: 500;">Transacciones de Pago</h4>
                    <p class="stat-value" style="margin: 8px 0 4px; font-size: 1.8rem; font-weight: 700; color: #3B82F6;">${totalCount}</p>
                    <div style="font-size: 0.8rem; color: var(--admin-text-secondary);">
                        Número de liquidaciones individuales
                    </div>
                </div>
            </div>
        `;

        if (!payments || payments.length === 0) {
            elements.boostersPaymentsContainer.innerHTML = summaryHTML + '<p class="empty-message">No se han registrado pagos de impulsores aún.</p>';
            return;
        }

        const tableHTML = `
            ${summaryHTML}
            <table class="admin-table">
                <thead>
                    <tr>
                        <th style="width: 200px;">Fecha de Pago</th>
                        <th>Usuario</th>
                        <th style="text-align: center; width: 150px;">Nivel de Pago</th>
                        <th>Periodo Liquidado</th>
                        <th style="text-align: right; width: 180px;">BLUE Pagado</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.map(payment => `
                        <tr>
                            <td>${new Date(payment.created_at).toLocaleString()}</td>
                            <td class="username-cell">
                                <a href="profile.html?user=${escapeHtml(payment.username)}" target="_blank">${escapeHtml(payment.username)}</a>
                            </td>
                            <td align="center">
                                <span class="status-badge active" style="background-color: #3B82F6; font-size: 0.75rem; padding: 4px 8px; border-radius: 12px; font-weight: bold; color: white;">Nivel ${escapeHtml(payment.booster_level_at_payment)}</span>
                            </td>
                            <td>${new Date(payment.payment_month).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</td>
                            <td class="saldo-blue-text" style="font-weight: bold; color: #10B981; text-align: right;">
                                +${formatBalance(payment.amount_paid)}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        elements.boostersPaymentsContainer.innerHTML = tableHTML;
    }

    // --- Event Handlers ---
    let settingChangeTimeout;

    async function handleSettingChange(event) {
        const control = event.target;
        if (!control.dataset.key) return;

        const key = control.dataset.key;
        let value;

        if (control.type === 'checkbox') {
            value = control.checked.toString();
        } else if (control.type === 'number') {
            value = control.value;
        } else if (control.type === 'date') {
            value = control.value;
            if (value) {
                const dateObj = new Date(value);
                if (isNaN(dateObj.getTime())) {
                    showCustomAlert('Fecha inválida. Por favor, ingresa una fecha válida.');
                    loadSettings();
                    return;
                }
            }
        } else {
            return;
        }

        if (control.type === 'number' || control.type === 'date') {
            clearTimeout(settingChangeTimeout);
            settingChangeTimeout = setTimeout(() => {
                updateSetting(key, value);
            }, 500);
        } else {
            updateSetting(key, value);
        }
    }

    async function handleUserAction(event) {
        const toggleButton = event.target.closest('.menu-toggle');

        if (toggleButton) {
            event.stopPropagation();
            const menu = toggleButton.nextElementSibling;
            const isVisible = menu.classList.contains('visible');

            document.querySelectorAll('.action-menu.visible').forEach(m => {
                m.classList.remove('visible');
            });

            if (!isVisible) {
                menu.classList.add('visible');
            }
            return;
        }

        const actionButton = event.target.closest('.action-button-admin');
        if (actionButton && actionButton.dataset.action) {
            const action = actionButton.dataset.action;
            const userRow = actionButton.closest('tr');
            const userId = userRow.dataset.userId;
            const username = userRow.dataset.username;
            const currentStatus = userRow.dataset.status;

            // --- NUEVO: Editar Código de Referido ---
            if (action === 'edit-referral') { // Acción implementada
                const currentCode = userRow.dataset.referralCode || '';
                const newCode = prompt(`Nuevo código de referido para ${username} (Solo letras, números y guiones):`, currentCode);

                if (newCode !== null && newCode.trim() !== '' && newCode !== currentCode) {
                    try {
                        const result = await apiFetch(`/api/admin/users/${userId}/referral-code`, {
                            method: 'PUT',
                            body: JSON.stringify({ newReferralCode: newCode.trim().toUpperCase() })
                        });
                        showCustomAlert(result.message || 'Código actualizado correctamente.');
                        loadUsers(elements.userSearchInput.value, elements.userStatusFilter.value);
                    } catch (error) {
                        showCustomAlert(`Error al actualizar código: ${error.message}`);
                    }
                }
                return;
            }
            // ----------------------------------------

            const actionTexts = {
                suspend: { verb: "suspender", noun: "suspensión" },
                ban: { verb: "banear", noun: "baneo" },
                activate: { verb: "reactivar", noun: "reactivación" }
            };

            const { verb, noun } = actionTexts[action];

            if ((action === 'suspend' && currentStatus === 'suspended') ||
                (action === 'ban' && currentStatus === 'banned') ||
                (action === 'activate' && currentStatus === 'active')) {
                showCustomAlert(`El usuario ${escapeHtml(username)} ya está en ese estado.`);
                return;
            }

            // Mapeamos las acciones del frontend a los estados válidos del backend/BD
            let newStatus = 'active';
            if (action === 'suspend') {
                newStatus = 'suspended';
            } else if (action === 'ban') {
                newStatus = 'banned';
            }

            showCustomConfirm(`¿Estás seguro de que quieres ${verb} al usuario "${escapeHtml(username)}"?`, async () => {
                try {
                    const result = await apiFetch(`/api/admin/users/${userId}/status`, {
                        method: 'POST',
                        body: JSON.stringify({ status: newStatus })
                    });
                    showCustomAlert(result.message || 'Acción completada con éxito.');
                    loadUsers(elements.userSearchInput.value, elements.userStatusFilter.value);
                } catch (error) {
                    showCustomAlert(`Error durante la ${noun}: ${error.message}`);
                }
            });
        }
    }

    function handleBoosterLevelChange(event) {
        const input = event.target;
        const row = input.closest('tr');
        const level = row.dataset.level;

        const body = {
            level: parseInt(level),
            name: row.querySelector('[data-field="name"]').value,
            min_blue_required: parseFloat(row.querySelector('[data-field="min_blue_required"]').value),
            description: row.querySelector('[data-field="description"]').value
        };

        clearTimeout(settingChangeTimeout);
        settingChangeTimeout = setTimeout(() => {
            updateBoosterLevel(body);
        }, 500);
    }

    async function updateSetting(key, value) {
        try {
            await apiFetch('/api/admin/settings', {
                method: 'POST',
                body: JSON.stringify({ key, value }),
            });
            console.log(`Setting actualizado.`);
        } catch (error) {
            if (error.message.includes('gobernanza')) {
                showCustomAlert(
                    `🔐 ${error.message}\n\nDirige tu solicitud al panel de gobernanza.`
                );
            } else {
                showCustomAlert(`Error al guardar la configuración: ${error.message}`);
            }
            loadSettings();
        }
    }

    async function updateBoosterLevel(body) {
        try {
            await apiFetch('/api/admin/boosters/settings', {
                method: 'POST',
                body: JSON.stringify(body)
            });
            console.log(`Nivel de impulsor actualizado.`);
        } catch (error) {
            if (error.message.includes('gobernanza')) {
                showCustomAlert(
                    `🔐 ${error.message}\n\nDirige tu solicitud al panel de gobernanza.`
                );
            } else {
                showCustomAlert(`Error al guardar el nivel: ${error.message}`);
            }
            loadBoosterSettings();
        }
    }

    async function handlePublicationAction(event) {
        const deleteButton = event.target.closest('.action-button-admin.delete');
        if (deleteButton) {
            const pubId = deleteButton.dataset.pubId;
            const pubTitle = deleteButton.closest('tr').querySelector('.publication-title-cell').textContent;
            showCustomConfirm(`¿Seguro que quieres eliminar la publicación "${escapeHtml(pubTitle)}"? Esta acción es irreversible.`, async () => {
                try {
                    const result = await apiFetch(`/api/admin/publications/${pubId}`, { method: 'DELETE' });
                    showCustomAlert(result.message || 'Publicación eliminada.');
                    loadPublications(elements.publicationSearchInput.value, elements.publicationStatusFilter?.value || 'active');
                } catch (error) {
                    showCustomAlert(`Error al eliminar: ${error.message}`);
                }
            });
        }

        const restoreButton = event.target.closest('.action-button-admin.restore');
        if (restoreButton) {
            const pubId = restoreButton.dataset.pubId;
            const pubTitle = restoreButton.closest('tr').querySelector('.publication-title-cell').textContent;
            showCustomConfirm(`¿Seguro que quieres restaurar la publicación "${escapeHtml(pubTitle)}"?`, async () => {
                try {
                    const result = await apiFetch(`/api/admin/publications/${pubId}/restore`, { method: 'POST' });
                    showCustomAlert(result.message || 'Publicación restaurada.');
                    loadPublications(elements.publicationSearchInput.value, elements.publicationStatusFilter?.value || 'active');
                } catch (error) {
                    showCustomAlert(`Error al restaurar: ${error.message}`);
                }
            });
        }
    }

    // ──────────────────────────────────────────────────────────
    // collectFormFields: Recopila la definición de campos de formulario
    // ──────────────────────────────────────────────────────────
    // Emite el nuevo formato con tipo: {"1": [{label:"Campo", type:"text"}]}
    // Solo acepta tipos de la whitelist: 'text', 'textarea' (defense in depth)
    // ──────────────────────────────────────────────────────────
    function collectFormFields() {
        const formFields = {};
        const ALLOWED_TYPES = ['text', 'textarea']; // Whitelist de tipos
        const stepContainers = document.querySelectorAll('#platformStepInputs .admin-step-input');

        stepContainers.forEach((container) => {
            const stepNum = container.getAttribute('data-step');
            const checkbox = container.querySelector('.step-form-checkbox');

            if (checkbox && checkbox.checked) {
                const fields = [];
                const fieldWrappers = container.querySelectorAll('.step-form-field-wrapper');

                fieldWrappers.forEach((wrapper) => {
                    const input = wrapper.querySelector('.step-form-field');
                    const typeSelect = wrapper.querySelector('.step-form-type-select');
                    const label = input ? input.value.trim() : '';
                    // Solo aceptar tipos de la whitelist (seguridad)
                    const type = (typeSelect && ALLOWED_TYPES.includes(typeSelect.value))
                        ? typeSelect.value
                        : 'text';

                    if (label) {
                        fields.push({ label, type });
                    }
                });

                // Fallback: si no hay wrappers (formato viejo), intentar con inputs directos
                if (fieldWrappers.length === 0) {
                    const fieldInputs = container.querySelectorAll('.step-form-field');
                    fieldInputs.forEach((input) => {
                        const value = input.value.trim();
                        if (value) {
                            fields.push({ label: value, type: 'text' });
                        }
                    });
                }

                if (fields.length > 0) {
                    formFields[stepNum] = fields;
                }
            }
        });

        return Object.keys(formFields).length > 0 ? formFields : null;
    }

    async function handlePlatformPublicationSubmit(event) {
        event.preventDefault();
        const STEP_MARKER_START = '[[INSTRUCTIONS_STEPS]]';
        const STEP_MARKER_END = '[[/INSTRUCTIONS_STEPS]]';
        const steps = getPlatformStepValues();

        const description = document.getElementById('platformPubDescription').value;
        const baseText = stripStepBlock(description);
        const mergedDescription = steps.length
            ? `${baseText}\n\n${STEP_MARKER_START}\n${steps.join('\n')}\n${STEP_MARKER_END}`
            : baseText;

        const form = event.target;
        const allowRepeat = document.getElementById('platformAllowRepeatParticipation').checked;
        const repeatLimit = elements.platformRepeatLimit ? parseInt(elements.platformRepeatLimit.value, 10) : NaN;
        if (allowRepeat && (!Number.isFinite(repeatLimit) || repeatLimit < 2)) {
            showCustomAlert('Indica el máximo de repeticiones por usuario (mínimo 2).');
            return;
        }
        const repeatDays = elements.platformRepeatCooldownDays ? parseInt(elements.platformRepeatCooldownDays.value, 10) : 0;
        const repeatHours = elements.platformRepeatCooldownHours ? parseInt(elements.platformRepeatCooldownHours.value, 10) : 0;
        const repeatMinutes = elements.platformRepeatCooldownMinutes ? parseInt(elements.platformRepeatCooldownMinutes.value, 10) : 0;
        const safeDays = Number.isFinite(repeatDays) ? repeatDays : 0;
        const safeHours = Number.isFinite(repeatHours) ? repeatHours : 0;
        const safeMinutes = Number.isFinite(repeatMinutes) ? repeatMinutes : 0;
        const totalMinutes = (safeDays * 24 * 60) + (safeHours * 60) + safeMinutes;
        if (allowRepeat && totalMinutes < 1) {
            showCustomAlert('Indica el tiempo mínimo para repetir (mínimo 1 minuto).');
            return;
        }
        const targetUsernameInput = document.getElementById('platformTargetUsername');
        const targetUsername = targetUsernameInput ? targetUsernameInput.value.trim() : '';

        // Recopilar campos de formulario dinámico
        const formFields = collectFormFields();

        const body = {
            title: document.getElementById('platformPubTitle').value,
            description: mergedDescription,
            cost: document.getElementById('platformPubCost').value,
            availableSlots: document.getElementById('platformPubSlots').value,
            isSellPost: document.querySelector('input[name="platformPubType"]:checked').value === 'sell',
            autoApprove: document.getElementById('platformAutoApprove').checked,
            allowRepeatParticipation: allowRepeat,
            maxRepeatPerUser: allowRepeat ? repeatLimit : 1,
            repeatCooldownDays: allowRepeat ? safeDays : 0,
            repeatCooldownHours: allowRepeat ? safeHours : 0,
            repeatCooldownMinutes: allowRepeat ? safeMinutes : 12,
            isBoosterTask: document.getElementById('platformIsBoosterTask').checked,
            targetUsername: targetUsername || null,
            formFields: formFields,
            showPreflightModal: document.getElementById('platformShowPreflightModal').checked
        };
        try {
            if (platformEditId) {
                const result = await apiFetch(`/api/admin/platform/publications/${platformEditId}`, { method: 'PUT', body: JSON.stringify(body) });
                showCustomAlert(result.message || "Publicación actualizada con éxito.");
            } else {
                const result = await apiFetch('/api/admin/platform/create-publication', { method: 'POST', body: JSON.stringify(body) });
                showCustomAlert(result.message || "Publicación creada con éxito.");
            }

            form.reset();
            resetPlatformEditForm();
            loadPlatformManagementData();
        } catch (error) {
            showCustomAlert(`Error al crear la publicación: ${error.message}`);
        }
    }

    async function handlePlatformAction(event) {
        const button = event.target.closest('.action-button-admin');
        if (!button) return;

        const pubId = button.dataset.pubId;
        const action = button.dataset.action;
        const userInAction = button.dataset.user;
        const platformUsername = 'Plataforma WintonCoin';

        let endpoint, body = {};

        switch (action) {
            case 'edit':
                await startPlatformEdit(pubId);
                return;
            case 'copy':
                await copyPlatformPublicationToForm(pubId);
                return;
            case 'approve':
                endpoint = `/publications/${pubId}/approve`;
                body = { approverUsername: platformUsername, userToApprove: userInAction };
                break;
            case 'discard':
                endpoint = `/publications/${pubId}/discard`;
                body = { discarderUsername: platformUsername, userToDiscard: userInAction };
                break;
            case 'confirm-payment':
                endpoint = `/publications/${pubId}/confirm-payment`;
                body = { confirmerUsername: platformUsername, workerUsername: userInAction };
                break;
            default: return;
        }

        try {
            const result = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
            showCustomAlert(result.message || 'Acción completada con éxito.');
            loadPlatformManagementData();
        } catch (error) {
            showCustomAlert(`Error al realizar la acción: ${error.message}`);
        }
    }

    // --- Helpers ---
    const statusMap = {
        'open': 'Abierta', 'pending_approval': 'Pendiente', 'approved': 'Aprobada',
        'completed': 'Culminada', 'confirmed_paid': 'Pagada'
    };
    function getStatusText(status) {
        return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
    }
    function generateStarRating(rating, count) {
        if (count === 0) return '<span class="no-rating">Sin calif.</span>';
        const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
        return `<span class="stars" title="${parseFloat(rating).toFixed(1)} de 5">${stars}</span> <span class="rating-count">(${count})</span>`;
    }

    async function loadBoosterStages() {
        if (!elements.boostersStagesContainer) return;
        elements.boostersStagesContainer.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const response = await fetch(`${API_URL}/api/admin/boosters/config-stages`, { credentials: 'include' });
            if (!response.ok) throw new Error('Error al cargar etapas');
            const stages = await response.json();

            let html = `
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Etapa</th>
                            <th>Monto Multiplicador</th>
                            <th>Inicio</th>
                            <th>Fin</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            stages.forEach(stage => {
                const startDateStr = new Date(stage.start_date).toLocaleDateString('es-ES', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
                const endDateStr = new Date(stage.end_date).toLocaleDateString('es-ES', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
                
                // Mostrar un pequeño (UTC) para estándar financiero
                const startDate = `${startDateStr} <span style="font-size: 0.7em; color: #666;">UTC</span>`;
                const endDate = `${endDateStr} <span style="font-size: 0.7em; color: #666;">UTC</span>`;
                const statusBadge = stage.is_active ? 
                    '<span class="badge badge-success">Activo</span>' : 
                    '<span class="badge badge-danger">Inactivo</span>';

                html += `
                    <tr>
                        <td><strong>${escapeHtml(stage.name)}</strong></td>
                        <td class="multiplier-cell" style="font-weight: 800; color: #7f00ff;">${parseFloat(stage.multiplier).toFixed(2)}x</td>
                        <td>${startDate}</td>
                        <td>${endDate}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <button class="admin-btn-small edit-stage-btn" data-id="${stage.id}">Editar</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            elements.boostersStagesContainer.innerHTML = html;

        } catch (error) {
            console.error('Error al cargar etapas:', error);
            elements.boostersStagesContainer.innerHTML = `<div class="error-msg">Error: ${error.message}</div>`;
        }
    }

    // --- Render Functions ---
    function renderDashboard(stats) {
        if (!elements.dashboardContainer) return;
        let coverageHTML = '';
        let hasCoverage = false;
        if (stats.coverage_by_level && Array.isArray(stats.coverage_by_level)) {
            stats.coverage_by_level.forEach(cov => {
                if (cov.percentage > 0) {
                    hasCoverage = true;
                    let color = '#3B82F6'; // Azul para cobertura parcial
                    
                    if (cov.percentage === 100) {
                        color = '#10B981'; // Verde para cobertura total
                    }
                    
                    coverageHTML += `
                        <div style="margin-bottom: 12px;">
                            <p class="stat-value" style="color: ${color};">${cov.percentage}%</p>
                            <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 4px;">
                                Nivel ${cov.level}
                            </div>
                        </div>
                    `;
                }
            });
        }
        
        if (!hasCoverage) {
            coverageHTML = `
                <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 10px; text-align: center; font-style: italic;">
                    Comisiones insuficientes para proyectar canjes en este momento.
                </div>
            `;
        }

        elements.dashboardContainer.innerHTML = `
            <div class="stat-card interactive-card" data-target-section="users">
                <h4>Usuarios Totales</h4>
                <p class="stat-value">${escapeHtml(stats.totalUsers || 0)}</p>
            </div>
            <div class="stat-card interactive-card" data-target-section="publications">
                <h4>Publicaciones Activas</h4>
                <p class="stat-value">${escapeHtml(stats.activePublications || 0)}</p>
            </div>
            <div class="stat-card interactive-card" data-target-section="platform-wallet">
                <h4>BLUE en Circulación (Tokens Reales)</h4>
                <p class="stat-value saldo-blue-text">${formatBalance(stats.totalBlue)}</p>
            </div>
            <div class="stat-card interactive-card" data-target-section="platform-wallet">
                <h4>RED en Circulación (Compromiso Total)</h4>
                <p class="stat-value saldo-red-text">${formatBalance(stats.totalRed)}</p>
            </div>
            <div class="stat-card interactive-card" data-target-section="platform-wallet">
                <h4>Comisiones Acumuladas</h4>
                <p class="stat-value saldo-blue-text">${formatBalance(stats.platformCommissionBalance)}</p>
            </div>
            <div class="stat-card interactive-card">
                <h4>Proyección de Canje</h4>
                <div style="margin-top: 8px;">
                    ${coverageHTML}
                </div>
            </div>
            
            <div class="stat-card interactive-card" style="border-left: 4px solid #8B5CF6;" data-target-section="platform-publications">
                <h4>BLUE IOU Comprometidos (Tareas Plataforma)</h4>
                <p class="stat-value" style="color: #8B5CF6;">${formatBalance(stats.totalPlatformEscrow || 0)}</p>
            </div>
            <div class="stat-card interactive-card" style="border-left: 4px solid #8B5CF6;" data-target-section="platform-publications">
                <h4>BLUE IOU en Ejecución (Fondos Asignados)</h4>
                <p class="stat-value" style="color: #8B5CF6;">${formatBalance(stats.totalPlatformInExecution || 0)}</p>
            </div>
            <div class="stat-card interactive-card" style="border-left: 4px solid #8B5CF6;" data-target-section="platform-publications">
                <h4>BLUE IOU Pendientes de Pago (En Auditoría)</h4>
                <p class="stat-value" style="color: #8B5CF6;">${formatBalance(stats.totalPlatformPendingPayment || 0)}</p>
            </div>
            <div class="stat-card interactive-card" style="border-left: 4px solid #8B5CF6;" data-target-section="boosters">
                <h4>BLUE IOU Entregados (Compromiso Futuro)</h4>
                <p class="stat-value" style="color: #8B5CF6;">${formatBalance(stats.totalBoosterFunds || 0)}</p>
                <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 4px;">
                    Apto KYC: <strong style="color: #10B981;">${formatBalance(stats.eligibleBoosterFunds || 0)} BLUE</strong>
                </div>
            </div>
        `;
    }

    function renderDebtorsTable(debtors) {
        if (!elements.debtorsTableContainer) return;
        if (!debtors || debtors.length === 0) {
            elements.debtorsTableContainer.innerHTML = '<p class="empty-message">No hay usuarios con compromisos vencidos actualmente.</p>';
            return;
        }

        const tableHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Compromiso Vencido Total (RED)</th>
                        <th>Nº de Compromisos Vencidos</th>
                    </tr>
                </thead>
                <tbody>
                    ${debtors.map(debtor => getDebtorRowHTML(debtor)).join('')}
                </tbody>
            </table>
        `;
        elements.debtorsTableContainer.innerHTML = tableHTML;
    }

    function renderAuditLogTable(result) {
        if (!elements.auditLogContainer) return;
        const rows = result?.rows || [];
        if (rows.length === 0) {
            elements.auditLogContainer.innerHTML = '<p class="empty-message">No hay eventos que coincidan con los filtros.</p>';
            return;
        }

        const tableHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Evento</th>
                        <th>Actor</th>
                        <th>Target</th>
                        <th>Pub ID</th>
                        <th>Categoría</th>
                        <th>IP</th>
                        <th>Metadata</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => getAuditRowHTML(row)).join('')}
                </tbody>
            </table>
        `;
        elements.auditLogContainer.innerHTML = tableHTML;
    }

    function getAuditRowHTML(row) {
        const createdAt = row.created_at ? new Date(row.created_at) : null;
        const dateText = createdAt
            ? createdAt.toLocaleString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'Sin fecha';
        const metadataText = formatAuditMetadata(row.metadata);

        return `
            <tr>
                <td>${escapeHtml(dateText)}</td>
                <td>${escapeHtml(row.event_type)}</td>
                <td>${escapeHtml(row.actor_username || '')}</td>
                <td>${escapeHtml(row.target_username || '')}</td>
                <td>${escapeHtml(row.publication_id ?? '')}</td>
                <td>${escapeHtml(row.category || '')}</td>
                <td>${escapeHtml(row.ip_address || '')}</td>
                <td class="audit-metadata">${escapeHtml(metadataText)}</td>
            </tr>
        `;
    }

    function formatAuditMetadata(metadata) {
        try {
            const text = typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {});
            return text.length > 160 ? `${text.slice(0, 160)}...` : text;
        } catch (error) {
            return '';
        }
    }

    function getDebtorRowHTML(debtor) {
        return `
            <tr>
                <td class="username-cell">
                    <a href="profile.html?user=${escapeHtml(debtor.username)}" target="_blank">${escapeHtml(debtor.username)}</a>
                </td>
                <td class="saldo-red-text">${formatBalance(debtor.total_penalized_debt)}</td>
                <td align="center">${escapeHtml(debtor.penalized_debts_count)}</td>
            </tr>
        `;
    }

    function renderPlatformPublicationsForManagement(publications) {
        const totals = getPlatformPendingTotals(platformPublicationsCache);
        updatePlatformPublicationsBadge(totals.totalPending);
        if (!publications || publications.length === 0) {
            if (elements.platformManagementList) {
                elements.platformManagementList.innerHTML = '<p class="empty-message">No hay publicaciones de la plataforma que requieran acción.</p>';
            }
            return;
        }

        if (elements.platformManagementList) {
            elements.platformManagementList.innerHTML = publications.map(pub => getPlatformManagementItemHTML(pub)).join('');
        }
    }

    function applyPlatformManagementFilters() {
        if (!elements.platformManagementList) return;
        const searchTerm = (elements.platformPublicationSearchInput?.value || '').trim().toLowerCase();
        const statusFilter = elements.platformPublicationStatusFilter?.value || 'all';
        const sortValue = elements.platformPublicationSortSelect?.value || 'pending';
        let filtered = [...platformPublicationsCache];

        if (searchTerm) {
            filtered = filtered.filter(pub => {
                const title = (pub.title || '').toLowerCase();
                const description = (pub.description || '').toLowerCase();
                const author = (pub.author_username || '').toLowerCase();
                const idText = String(pub.id || '');
                return title.includes(searchTerm)
                    || description.includes(searchTerm)
                    || author.includes(searchTerm)
                    || idText.includes(searchTerm);
            });
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(pub => {
                switch (statusFilter) {
                    case 'active':
                        return !pub.is_deleted && !pub.is_expired && !pub.is_completed_publication && !pub.is_paused;
                    case 'paused':
                        return !!pub.is_paused && !pub.is_deleted;
                    case 'completed':
                        return !!pub.is_completed_publication && !pub.is_deleted;
                    case 'expired':
                        return !!pub.is_expired && !pub.is_deleted;
                    case 'deleted':
                        return !!pub.is_deleted;
                    default:
                        return true;
                }
            });
        }

        const toNumber = (value) => Number(value) || 0;
        filtered.sort((a, b) => {
            const aCounts = getPlatformPendingCounts(a);
            const bCounts = getPlatformPendingCounts(b);
            switch (sortValue) {
                case 'recent':
                    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                case 'oldest':
                    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
                case 'reward_desc':
                    return toNumber(b.blue_cost) - toNumber(a.blue_cost);
                case 'reward_asc':
                    return toNumber(a.blue_cost) - toNumber(b.blue_cost);
                case 'participants_desc':
                    return (b.participants?.length || 0) - (a.participants?.length || 0);
                case 'approvals_desc':
                    return bCounts.pendingApprovals - aCounts.pendingApprovals;
                case 'payments_desc':
                    return bCounts.pendingPayments - aCounts.pendingPayments;
                case 'pending':
                default:
                    if (bCounts.pendingApprovals !== aCounts.pendingApprovals) {
                        return bCounts.pendingApprovals - aCounts.pendingApprovals;
                    }
                    return bCounts.totalPending - aCounts.totalPending;
            }
        });

        if (filtered.length === 0) {
            elements.platformManagementList.innerHTML = '<p class="empty-message">No hay publicaciones que coincidan con la búsqueda.</p>';
            return;
        }

        renderPlatformPublicationsForManagement(filtered);
    }

    function getPlatformPendingTotals(publications) {
        if (!publications || publications.length === 0) {
            return { pendingApprovals: 0, pendingPayments: 0, totalPending: 0 };
        }
        return publications.reduce((acc, pub) => {
            const counts = getPlatformPendingCounts(pub);
            acc.pendingApprovals += counts.pendingApprovals;
            acc.pendingPayments += counts.pendingPayments;
            acc.totalPending += counts.totalPending;
            return acc;
        }, { pendingApprovals: 0, pendingPayments: 0, totalPending: 0 });
    }

    function getPlatformPendingCounts(pub) {
        const participants = Array.isArray(pub.participants) ? pub.participants : [];
        const pendingApprovals = participants.filter(p => p.status === 'pending_approval').length;
        const pendingPayments = participants.filter(p => p.status === 'completed').length;
        const totalPending = pendingApprovals + pendingPayments;
        return { pendingApprovals, pendingPayments, totalPending };
    }

    function updatePlatformPublicationsBadge(totalPending) {
        if (!elements.platformPublicationsBadge) return;
        if (totalPending > 0) {
            elements.platformPublicationsBadge.textContent = totalPending;
            elements.platformPublicationsBadge.classList.add('is-visible');
        } else {
            elements.platformPublicationsBadge.textContent = '';
            elements.platformPublicationsBadge.classList.remove('is-visible');
        }
    }

    function getPlatformManagementItemHTML(pub) {
        const createdAt = pub.created_at ? new Date(pub.created_at) : null;
        const createdText = createdAt ? createdAt.toLocaleString('es-ES', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : 'Sin fecha';
        const typeText = pub.is_sell_post ? 'Venta' : 'Solicitud';
        const typeBadgeClass = pub.is_sell_post ? 'sell' : 'request';
        const costText = formatBalance(pub.blue_cost);
        const statusText = getPublicationStatusText(pub);
        const statusClass = getPublicationStatusClass(pub);
        const slotsText = Number.isFinite(Number(pub.available_slots)) ? `${pub.available_slots}` : 'N/A';
        const participantsCount = Array.isArray(pub.participants) ? pub.participants.length : 0;
        const pendingCounts = getPlatformPendingCounts(pub);
        const pendingApprovalsBadge = pendingCounts.pendingApprovals > 0
            ? `<span class="pending-badge warning">Aprobar: ${pendingCounts.pendingApprovals}</span>`
            : '';
        const pendingPaymentsBadge = pendingCounts.pendingPayments > 0
            ? `<span class="pending-badge">Pagos: ${pendingCounts.pendingPayments}</span>`
            : '';
        const maxRepeatText = Number.isFinite(Number(pub.max_repeat_per_user)) ? ` (máx ${pub.max_repeat_per_user})` : '';
        const repeatText = pub.allow_repeat_participation ? `Sí${maxRepeatText}` : 'No';

        let participantsHTML = '<p class="no-participants" style="padding: 1rem; text-align: center; color: var(--admin-text-secondary);">Sin participantes por ahora.</p>';

        if (pub.participants && pub.participants.length > 0) {
            const totalParticipants = pub.participants.length;
            const limit = 3;

            if (totalParticipants <= limit) {
                participantsHTML = `<ul class="participants-list-admin">${pub.participants.map(p => getParticipantItemForManagementHTML(pub.id, p)).join('')}</ul>`;
            } else {
                const firstBatch = pub.participants.slice(0, limit);
                const secondBatch = pub.participants.slice(limit);
                const uniqueId = `more-participants-${pub.id}`;

                const firstHTML = `<ul class="participants-list-admin" style="margin-bottom: 0;">${firstBatch.map(p => getParticipantItemForManagementHTML(pub.id, p)).join('')}</ul>`;
                const secondHTML = `<ul class="participants-list-admin" id="${uniqueId}" style="display: none; margin-top: 0; border-top: none;">${secondBatch.map(p => getParticipantItemForManagementHTML(pub.id, p)).join('')}</ul>`;

                const buttonHTML = `
                    <div style="text-align: center; padding: 0.5rem; background: rgba(255, 255, 255, 0.05); border-radius: 0 0 8px 8px;">
                        <button class="action-button-admin secondary small" 
                                onclick="document.getElementById('${uniqueId}').style.display='block'; this.parentNode.style.display='none';"
                                style="width: auto; padding: 4px 12px; font-size: 0.85rem;">
                            Ver todos (${totalParticipants})
                        </button>
                    </div>
                `;

                participantsHTML = firstHTML + secondHTML + buttonHTML;
            }
        }

        const { mainText, steps } = splitDescriptionWithSteps(pub.description);
        const stepsHTML = renderAdminStepFlow(steps);

        return `
            <div class="history-item-admin">
                <div class="history-item-header">
                    <h3>${escapeHtml(pub.title)}</h3>
                    <div class="pending-badges">
                        ${pendingApprovalsBadge}
                        ${pendingPaymentsBadge}
                    </div>
                </div>
                <p>${escapeHtml(mainText || 'Sin descripción.')}</p>
                ${stepsHTML}
                <div class="history-item-actions">
                    <button class="action-button-admin edit" data-action="edit" data-pub-id="${escapeHtml(pub.id)}">Editar</button>
                    <button class="action-button-admin copy" data-action="copy" data-pub-id="${escapeHtml(pub.id)}" title="Copiar datos al formulario">Copiar</button>
                </div>
                <div class="history-item-meta">
                    <span><strong>ID:</strong> ${escapeHtml(pub.id)}</span>
                    <span><strong>Tipo:</strong> <span class="status-badge ${typeBadgeClass}">${typeText}</span></span>
                    <span><strong>Precio:</strong> ${costText} BLUE</span>
                    <span><strong>Cupos:</strong> ${escapeHtml(slotsText)}</span>
                    <span><strong>Participantes:</strong> ${escapeHtml(participantsCount)}</span>
                    <span><strong>Repetible:</strong> ${escapeHtml(repeatText)}</span>
                    <span><strong>Estado:</strong> <span class="status-badge ${escapeHtml(statusClass)}">${escapeHtml(statusText)}</span></span>
                    <span><strong>Fecha:</strong> ${escapeHtml(createdText)}</span>
                </div>
                <h4>Participantes</h4>
                ${participantsHTML}
            </div>
        `;
    }

    function getPlatformStepValues() {
        if (!elements.platformStepInputs) return [];
        return Array.from(elements.platformStepInputs.querySelectorAll('.admin-step-input'))
            .map(container => {
                const stepInput = container.querySelector(':scope > input[type="text"]');
                return stepInput ? stepInput.value.trim() : '';
            })
            .filter(value => value.length > 0);
    }

    function stripStepBlock(text) {
        if (!text) return '';
        const STEP_MARKER_START = '[[INSTRUCTIONS_STEPS]]';
        const STEP_MARKER_END = '[[/INSTRUCTIONS_STEPS]]';
        const pattern = new RegExp(`${STEP_MARKER_START}[\\s\\S]*?${STEP_MARKER_END}`, 'g');
        return text.replace(pattern, '').trim();
    }

    function splitDescriptionWithSteps(description) {
        const STEP_MARKER_START = '[[INSTRUCTIONS_STEPS]]';
        const STEP_MARKER_END = '[[/INSTRUCTIONS_STEPS]]';
        if (!description || !description.includes(STEP_MARKER_START)) {
            return { mainText: description || '', steps: [] };
        }

        const startIndex = description.indexOf(STEP_MARKER_START);
        const endIndex = description.indexOf(STEP_MARKER_END);
        if (endIndex === -1) {
            return { mainText: description || '', steps: [] };
        }

        const mainText = description.slice(0, startIndex).trim();
        const stepsRaw = description
            .slice(startIndex + STEP_MARKER_START.length, endIndex)
            .split('\n')
            .map(step => step.trim())
            .filter(step => step.length > 0);

        return { mainText, steps: stepsRaw };
    }

    function renderAdminStepFlow(steps) {
        if (!steps || steps.length === 0) return '';
        const itemsHTML = steps.map((step, index) => `
            <li class="admin-step-item">
                <div class="admin-step-node">
                    <span class="admin-step-index">${index + 1}</span>
                </div>
                <div class="admin-step-content">
                    <div class="admin-step-badge">Paso ${index + 1}</div>
                    <div class="admin-step-text">${escapeHtml(step)}</div>
                </div>
            </li>
        `).join('');

        return `
            <div class="admin-step-flow">
                <h4 class="admin-step-title">Sigue las instrucciones paso a paso sin saltar ninguno</h4>
                <ol class="admin-steps-list">
                    ${itemsHTML}
                </ol>
            </div>
        `;
    }

    async function startPlatformEdit(publicationId) {
        let pub = platformPublicationsCache.find(item => String(item.id) === String(publicationId));
        if (!pub) {
            try {
                const publications = await apiFetch('/api/admin/platform/publications-with-participants');
                platformPublicationsCache = publications || [];
                pub = platformPublicationsCache.find(item => String(item.id) === String(publicationId));
            } catch (error) {
                showCustomAlert(`No se pudo cargar la publicación para editar: ${error.message}`);
                return;
            }
        }

        if (!pub) {
            showCustomAlert('No se encontró la publicación para editar.');
            return;
        }

        platformEditId = pub.id;
        fillPlatformForm(pub);

        const form = document.getElementById('platformPublicationForm') || document.querySelector('.admin-form');
        if (form) form.scrollIntoView({ behavior: 'smooth' });
    }

    async function copyPlatformPublicationToForm(publicationId) {
        let pub = platformPublicationsCache.find(item => String(item.id) === String(publicationId));
        if (!pub) {
            try {
                const publications = await apiFetch('/api/admin/platform/publications-with-participants');
                platformPublicationsCache = publications || [];
                pub = platformPublicationsCache.find(item => String(item.id) === String(publicationId));
            } catch (error) {
                showCustomAlert(`No se pudo cargar la publicación para copiar: ${error.message}`);
                return;
            }
        }

        if (!pub) {
            showCustomAlert('No se encontró la publicación para copiar.');
            return;
        }

        // Resetear ID de edición para asegurar que se cree una nueva
        platformEditId = null;

        // Rellenar formulario reutilizando la lógica
        fillPlatformForm(pub);

        // Ajustes específicos para COPIA
        const submitBtn = document.getElementById('platformSubmitButton') || elements.platformPublicationSubmitBtn;
        if (submitBtn) submitBtn.textContent = 'Crear Publicación';

        const cancelBtn = document.getElementById('cancelEditBtn') || elements.platformCancelEditBtn;
        if (cancelBtn) cancelBtn.style.display = 'none'; // No es modo edición

        if (elements.platformEditNotice) {
            elements.platformEditNotice.style.display = 'none'; // Ocultar aviso de edición
        }



        showCustomAlert('Datos copiados al formulario. Revisa y pulsa "Crear Publicación".');
        const form = document.getElementById('platformPublicationForm') || document.querySelector('.admin-form');
        if (form) form.scrollIntoView({ behavior: 'smooth' });
    }

    function fillPlatformForm(pub) {
        const { mainText, steps } = splitDescriptionWithSteps(pub.description);

        document.getElementById('platformPubTitle').value = pub.title || '';
        document.getElementById('platformPubDescription').value = mainText || '';
        document.getElementById('platformPubCost').value = pub.blue_cost || '';
        document.getElementById('platformPubSlots').value = pub.available_slots || 1;
        document.getElementById('platformAutoApprove').checked = !!pub.auto_approve;
        document.getElementById('platformAllowRepeatParticipation').checked = !!pub.allow_repeat_participation;
        document.getElementById('platformIsBoosterTask').checked = !!pub.is_booster_task;

        const preflightToggle = document.getElementById('platformShowPreflightModal');
        if (preflightToggle) {
            preflightToggle.checked = !!pub.show_preflight_modal;
        }

        if (elements.platformRepeatLimit) {
            const repeatValue = Number(pub.max_repeat_per_user);
            elements.platformRepeatLimit.value = Number.isFinite(repeatValue) && repeatValue >= 2 ? repeatValue : 2;
        }
        if (elements.platformRepeatLimitWrapper) {
            elements.platformRepeatLimitWrapper.style.display = pub.allow_repeat_participation ? 'flex' : 'none';
        }
        if (elements.platformRepeatCooldownWrapper) {
            elements.platformRepeatCooldownWrapper.style.display = pub.allow_repeat_participation ? 'flex' : 'none';
        }
        if (elements.platformRepeatCooldownDays || elements.platformRepeatCooldownHours || elements.platformRepeatCooldownMinutes) {
            const cooldownMinutes = Number(pub.repeat_cooldown_minutes);
            const cooldownHours = Number(pub.repeat_cooldown_hours);
            const normalizedMinutes = Number.isFinite(cooldownMinutes) && cooldownMinutes > 0
                ? cooldownMinutes
                : (Number.isFinite(cooldownHours) && cooldownHours > 0 ? Math.round(cooldownHours * 60) : 12);
            const days = Math.floor(normalizedMinutes / 1440);
            const hours = Math.floor((normalizedMinutes % 1440) / 60);
            const minutes = normalizedMinutes % 60;
            if (elements.platformRepeatCooldownDays) elements.platformRepeatCooldownDays.value = String(days);
            if (elements.platformRepeatCooldownHours) elements.platformRepeatCooldownHours.value = String(hours);
            if (elements.platformRepeatCooldownMinutes) elements.platformRepeatCooldownMinutes.value = String(minutes);
        }

        if (pub.is_sell_post) {
            document.getElementById('platformPubTypeSell').checked = true;
        } else {
            document.getElementById('platformPubTypeRequest').checked = true;
        }

        populatePlatformSteps(steps, pub.form_fields || pub.form_options);

        if (elements.platformPublicationSubmitBtn) {
            elements.platformPublicationSubmitBtn.textContent = 'Guardar cambios';
        }
        if (elements.platformCancelEditBtn) {
            elements.platformCancelEditBtn.style.display = 'inline-flex';
        }
        if (elements.platformEditNotice) {
            elements.platformEditNotice.textContent = `Editando publicación #${pub.id}`;
            elements.platformEditNotice.style.display = 'block';
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function resetPlatformEditForm() {
        platformEditId = null;
        if (elements.platformPublicationSubmitBtn) {
            elements.platformPublicationSubmitBtn.textContent = 'Crear Publicación';
        }
        if (elements.platformCancelEditBtn) {
            elements.platformCancelEditBtn.style.display = 'none';
        }
        if (elements.platformEditNotice) {
            elements.platformEditNotice.style.display = 'none';
        }

        if (elements.platformStepInputs) {
            const allStepInputs = elements.platformStepInputs.querySelectorAll('.admin-step-input');
            allStepInputs.forEach((item, index) => {
                if (index > 3) {
                    item.remove();
                } else {
                    const input = item.querySelector('input');
                    if (input) input.value = '';
                }
            });
        }
        if (elements.platformAddStepBtn) {
            elements.platformAddStepBtn.disabled = false;
        }
        if (elements.platformRepeatLimit) {
            elements.platformRepeatLimit.value = '2';
        }
        if (elements.platformRepeatLimitWrapper) {
            elements.platformRepeatLimitWrapper.style.display = 'none';
        }
        if (elements.platformRepeatCooldownDays) {
            elements.platformRepeatCooldownDays.value = '0';
        }
        if (elements.platformRepeatCooldownHours) {
            elements.platformRepeatCooldownHours.value = '0';
        }
        if (elements.platformRepeatCooldownMinutes) {
            elements.platformRepeatCooldownMinutes.value = '12';
        }
        if (elements.platformRepeatCooldownWrapper) {
            elements.platformRepeatCooldownWrapper.style.display = 'none';
        }
        // Limpiar campo de usuario específico
        const targetUsernameInput = document.getElementById('platformTargetUsername');
        if (targetUsernameInput) {
            targetUsernameInput.value = '';
        }
    }

    function populatePlatformSteps(steps, formFields) {
        if (!elements.platformStepInputs) return;

        // LIMPIEZA ATÓMICA: Eliminamos TODOS los pasos previos para evitar duplicidades
        elements.platformStepInputs.innerHTML = '';

        steps.forEach((step, index) => {
            const position = index + 1;
            ensurePlatformStepInput(position);
            const input = document.getElementById(`platformStep${position}`);
            if (input) input.value = step;

            // Cargar sub-formularios si existen para este paso
            if (formFields && formFields[position]) {
                const container = elements.platformStepInputs.querySelector(`.admin-step-input[data-step="${position}"]`);
                if (container) {
                    const checkbox = container.querySelector('.step-form-checkbox');
                    const fieldsContainer = container.querySelector('.step-form-fields');
                    const inputsContainer = container.querySelector('.step-form-inputs');

                    if (checkbox && fieldsContainer && inputsContainer) {
                        checkbox.checked = true;
                        fieldsContainer.style.display = 'block';

                        // Limpiar campos por defecto
                        inputsContainer.innerHTML = '';

                        // Renderizar campos guardados (soporta formato legacy y nuevo)
                        formFields[position].forEach((fieldData, i) => {
                            // Retrocompatibilidad: string simple → {label, type:'text'}
                            const label = typeof fieldData === 'string' ? fieldData : (fieldData?.label || '');
                            const type = (typeof fieldData === 'object' && fieldData?.type === 'textarea') ? 'textarea' : 'text';

                            const wrapper = document.createElement('div');
                            wrapper.className = 'step-form-field-wrapper';

                            const input = document.createElement('input');
                            input.type = 'text';
                            input.className = 'step-form-field';
                            input.value = label;
                            input.placeholder = `Campo ${i + 1}`;

                            const select = document.createElement('select');
                            select.className = 'step-form-type-select';
                            select.title = 'Tipo de campo';
                            select.innerHTML = `
                                <option value="text"${type === 'text' ? ' selected' : ''}>Texto corto</option>
                                <option value="textarea"${type === 'textarea' ? ' selected' : ''}>Texto largo</option>
                            `;

                            wrapper.appendChild(input);
                            wrapper.appendChild(select);
                            inputsContainer.appendChild(wrapper);
                        });

                        // Asegurar mínimo de 3 campos visuales para facilitar edición
                        const currentFields = formFields[position].length;
                        if (currentFields < 3) {
                            for (let i = currentFields; i < 3; i++) {
                                const wrapper = document.createElement('div');
                                wrapper.className = 'step-form-field-wrapper';
                                wrapper.innerHTML = `
                                    <input type="text" class="step-form-field" placeholder="Campo ${i + 1}">
                                    <select class="step-form-type-select" title="Tipo de campo">
                                        <option value="text">Texto corto</option>
                                        <option value="textarea">Texto largo</option>
                                    </select>
                                `;
                                inputsContainer.appendChild(wrapper);
                            }
                        }
                    }
                }
            }
        });
    }

    function resetPlatformEditStepsOnly() {
        if (!elements.platformStepInputs) return;

        // Limpiamos todo el contenedor
        elements.platformStepInputs.innerHTML = '';

        // Restauramos los 4 pasos básicos por defecto que tiene el formulario original
        for (let i = 1; i <= 4; i++) {
            ensurePlatformStepInput(i);
        }

        if (elements.platformAddStepBtn) {
            elements.platformAddStepBtn.disabled = false;
        }
    }

    function ensurePlatformStepInput(position) {
        const maxSteps = 20;
        if (position > maxSteps) return;
        const existing = document.getElementById(`platformStep${position}`);
        if (existing) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'admin-step-input';
        wrapper.setAttribute('data-step', position);

        const label = document.createElement('label');
        label.setAttribute('for', `platformStep${position}`);
        label.textContent = `Paso ${position}`;

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `platformStep${position}`;
        input.placeholder = `Describe el paso ${position}`;

        const toggleWrapper = document.createElement('div');
        toggleWrapper.className = 'step-form-toggle';
        toggleWrapper.innerHTML = `
            <label class="toggle-label">
                <input type="checkbox" class="step-form-checkbox" data-step="${position}">
                <span>Activar formulario para este paso</span>
            </label>
            <div class="step-form-fields" style="display: none;">
                <p class="form-hint">Define los campos que el usuario debe completar:</p>
                <div class="step-form-inputs">
                    <div class="step-form-field-wrapper">
                        <input type="text" class="step-form-field" placeholder="Campo 1">
                        <select class="step-form-type-select" title="Tipo de campo">
                            <option value="text">Texto corto</option>
                            <option value="textarea">Texto largo</option>
                        </select>
                    </div>
                    <div class="step-form-field-wrapper">
                        <input type="text" class="step-form-field" placeholder="Campo 2">
                        <select class="step-form-type-select" title="Tipo de campo">
                            <option value="text">Texto corto</option>
                            <option value="textarea">Texto largo</option>
                        </select>
                    </div>
                    <div class="step-form-field-wrapper">
                        <input type="text" class="step-form-field" placeholder="Campo 3 (opcional)">
                        <select class="step-form-type-select" title="Tipo de campo">
                            <option value="text">Texto corto</option>
                            <option value="textarea">Texto largo</option>
                        </select>
                    </div>
                </div>
                <button type="button" class="step-add-field-btn">+ Agregar más campos</button>
            </div>
        `;

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        wrapper.appendChild(toggleWrapper);
        elements.platformStepInputs.appendChild(wrapper);

        // Lógica de interacción dinámica
        const toggleCheck = toggleWrapper.querySelector('.step-form-checkbox');
        const formFieldsContainer = toggleWrapper.querySelector('.step-form-fields');
        if (toggleCheck) {
            toggleCheck.addEventListener('change', (e) => {
                formFieldsContainer.style.display = e.target.checked ? 'block' : 'none';
            });
        }

        const addBtn = toggleWrapper.querySelector('.step-add-field-btn');
        const inputsContainer = toggleWrapper.querySelector('.step-form-inputs');
        if (addBtn && inputsContainer) {
            addBtn.addEventListener('click', () => {
                // AUDITORÍA DE PASO: Contabilizar campos existentes para asignar un índice coherente y secuencial al placeholder (Campo X).
                const currentCount = inputsContainer.querySelectorAll('.step-form-field').length;
                
                // CONTENEDOR DE CONTROL: Crear el contenedor wrapper flex '.step-form-field-wrapper' para forzar la correcta alineación y distribución responsiva.
                const wrapper = document.createElement('div');
                wrapper.className = 'step-form-field-wrapper';
                
                // CONTROL DE ENTRADA: Instanciar un campo de texto input para la etiqueta descriptiva que los usuarios verán en el paso.
                const newField = document.createElement('input');
                newField.type = 'text';
                newField.className = 'step-form-field';
                newField.placeholder = `Campo ${currentCount + 1}`;
                
                // CONTROL DE CONFIGURACIÓN: Instanciar un menú desplegable (select) para configurar el tipo de dato requerido ('text' o 'textarea').
                const typeSelect = document.createElement('select');
                typeSelect.className = 'step-form-type-select';
                typeSelect.title = 'Tipo de campo';
                typeSelect.innerHTML = `
                    <option value="text">Texto corto</option>
                    <option value="textarea">Texto largo</option>
                `;
                
                // ENSAMBLAJE DE COMPONENTES: Unir el input y el select dentro del wrapper flex asegurando consistencia visual y semántica con el resto de la interfaz.
                wrapper.appendChild(newField);
                wrapper.appendChild(typeSelect);
                
                // PERSISTENCIA DE ESTRUCTURA: Insertar el wrapper en el contenedor de campos dinámicos para que collectFormFields() lo pueda detectar y guardar correctamente.
                inputsContainer.appendChild(wrapper);
            });
        }

        if (elements.platformStepInputs.querySelectorAll('.admin-step-input').length >= maxSteps) {
            elements.platformAddStepBtn.disabled = true;
        }
    }

    function getParticipantItemForManagementHTML(pubId, participant) {
        const ratingHTML = generateStarRating(participant.average_rating, participant.ratings_count);
        const statusText = getStatusText(participant.status);
        let actionButton = '';

        // Formatear fecha y hora de solicitud
        const acceptedAtHTML = participant.accepted_at
            ? `<span class="participant-accepted-at">Solicitó: ${formatDateTime(participant.accepted_at)}</span>`
            : '';

        if (participant.status === 'pending_approval') {
            actionButton = `
                <button class="action-button-admin approve" data-pub-id="${escapeHtml(pubId)}" data-action="approve" data-user="${escapeHtml(participant.acceptor_username)}">Aprobar</button>
                <button class="action-button-admin reject" data-pub-id="${escapeHtml(pubId)}" data-action="discard" data-user="${escapeHtml(participant.acceptor_username)}">Rechazar</button>
            `;
        } else if (participant.status === 'completed') {
            actionButton = `
                <button class="action-button-admin confirm" data-pub-id="${escapeHtml(pubId)}" data-action="confirm-payment" data-user="${escapeHtml(participant.acceptor_username)}">Confirmar Pago</button>
                <button class="action-button-admin reject" data-pub-id="${escapeHtml(pubId)}" data-action="discard" data-user="${escapeHtml(participant.acceptor_username)}">Rechazar</button>
            `;
        }

        // Mostrar respuestas del formulario si existen
        let formResponsesHTML = '';
        if (participant.form_responses && Object.keys(participant.form_responses).length > 0) {
            const responsesContent = Object.entries(participant.form_responses)
                .flatMap(([, fields]) => Object.entries(fields))
                .map(([fieldName, value]) => `
                    <div class="form-response-field-admin">
                        <span class="form-response-label-admin">${escapeHtml(fieldName)}:</span>
                        <span class="form-response-value-admin">${escapeHtml(value)}</span>
                    </div>
                `).join('');

            formResponsesHTML = `
                <div class="participant-form-responses-admin">
                    <div class="form-responses-content-admin">
                        ${responsesContent}
                    </div>
                </div>
            `;
        }

        return `
            <li class="participant-item-admin ${participant.form_responses ? 'has-responses' : ''}">
                <div class="participant-row-admin">
                    <div class="participant-info-admin">
                        <strong><a href="profile.html?user=${escapeHtml(participant.acceptor_username)}" target="_blank">${escapeHtml(participant.acceptor_username)}</a></strong>
                        <span class="rating-display">${ratingHTML}</span>
                        ${acceptedAtHTML}
                    </div>
                    <div class="participant-status-admin">
                        <span class="status-badge ${escapeHtml(participant.status)}">${escapeHtml(statusText)}</span>
                        ${actionButton}
                    </div>
                </div>
                ${formResponsesHTML}
            </li>
        `;
    }

    function formatDateTime(dateString) {
        const date = new Date(dateString);
        const options = {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('es-ES', options);
    }

    function renderUsersTable(users) {
        if (!elements.usersTableContainer) return;
        if (users.length === 0) {
            elements.usersTableContainer.innerHTML = '<p class="empty-message">No se encontraron usuarios.</p>';
            return;
        }

        const tableHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Billetera Web3</th>
                        <th>Saldo BLUE (Disponible)</th>
                        <th>Saldo BLUE (Pendientes)</th>
                        <th>BLUE de Impulsor (IOU)</th>
                        <th>Saldo RED</th>
                        <th>Calificación</th>
                        <th>Estado</th>
                        <th>Fecha de Registro</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => getUserRowHTML(user)).join('')}
                </tbody>
            </table>
        `;
        elements.usersTableContainer.innerHTML = tableHTML;

        // Funcionalidad de copiar al portapapeles para la billetera Web3
        elements.usersTableContainer.querySelectorAll('.copy-wallet-btn-admin').forEach(btn => {
            btn.addEventListener('click', function() {
                const fullAddress = this.dataset.address;
                copyTextToClipboard(fullAddress).then(() => {
                    const originalHTML = this.innerHTML;
                    this.innerHTML = '<span style="font-size:10px; font-weight:bold; color:#059669;">✓</span>';
                    setTimeout(() => {
                        this.innerHTML = originalHTML;
                    }, 2000);
                }).catch(err => {
                    console.error('Error al copiar: ', err);
                });
            });
        });
    }

    function getUserRowHTML(user) {
        const registrationDate = new Date(user.created_at).toLocaleDateString('es-ES', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        const ratingHTML = generateStarRating(user.average_rating, user.ratings_count);

        let walletHTML = '<span style="color: #888;">Sin billetera</span>';
        if (user.web3_wallet_address) {
            const addr = user.web3_wallet_address;
            const truncated = addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
            walletHTML = `
                <div style="display: flex; align-items: center; gap: 5px;">
                    <span style="font-family: monospace; font-size: 12px; color: #fff;">${truncated}</span>
                    <button class="copy-wallet-btn-admin" data-address="${addr}" style="background: none; border: none; cursor: pointer; color: #4da6ff; padding: 0; display: flex; align-items: center;" title="Copiar dirección">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
            `;
        }

        return `
            <tr data-user-id="${escapeHtml(user.id)}" data-username="${escapeHtml(user.username)}" data-status="${escapeHtml(user.status)}" data-referral-code="${escapeHtml(user.referral_code || '')}">
                <td class="username-cell">
                    <a href="profile.html?user=${escapeHtml(user.username)}" target="_blank">${escapeHtml(user.username)}</a>
                </td>
                <td>${walletHTML}</td>
                <td class="saldo-blue-text">${formatBalance(user.liquid_blue_balance)}</td>
                <td class="saldo-escrow-text">${formatBalance(user.escrow_blue_balance)}</td>
                <td class="saldo-booster-text">${formatBalance(user.booster_blue_balance)}</td>
                <td class="saldo-red-text">${formatBalance(user.red_balance)}</td>
                <td>${ratingHTML}</td>
                <td><span class="status-badge ${escapeHtml(user.status)}">${escapeHtml(user.status)}</span></td>
                <td>${registrationDate}</td>
                <td class="actions-cell">
                    <div class="action-menu-container">
                        <button class="action-button-admin menu-toggle">Acciones</button>
                        <div class="action-menu">
                            <button class="action-button-admin" data-action="edit-referral">✏️ Editar Código</button>
                            <button class="action-button-admin approve" data-action="activate">Reactivar</button>
                            <button class="action-button-admin suspend" data-action="suspend">Suspender</button>
                            <button class="action-button-admin danger" data-action="ban">Banear</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    function renderPublicationsTable(publications) {
        if (!elements.publicationsTableContainer) return;
        if (publications.length === 0) {
            elements.publicationsTableContainer.innerHTML = '<p class="empty-message">No se encontraron publicaciones con ese criterio.</p>';
            return;
        }

        const tableHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Título</th>
                        <th>Autor</th>
                        <th>Tipo</th>
                        <th>Valor (BLUE)</th>
                        <th>Participantes</th>
                        <th>Estado</th>
                        <th>Fecha Creación</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${publications.map(pub => getPublicationRowHTML(pub)).join('')}
                </tbody>
            </table>
        `;
        elements.publicationsTableContainer.innerHTML = tableHTML;
    }

    function getPublicationRowHTML(pub) {
        const creationDate = new Date(pub.created_at).toLocaleDateString('es-ES', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const typeHTML = pub.is_sell_post
            ? `<span class="status-badge sell">Venta</span>`
            : `<span class="status-badge request">Solicitud</span>`;

        const valueHTML = formatBalance(pub.blue_cost);
        const totalSlots = (Number(pub.available_slots) || 0) + (Number(pub.participants_count) || 0);
        const participantsHTML = `${pub.participants_count} / ${totalSlots}`;
        const statusText = getPublicationStatusText(pub);
        const statusClass = getPublicationStatusClass(pub);

        const actionsHTML = pub.is_deleted
            ? `<button class="action-button-admin restore" data-pub-id="${escapeHtml(pub.id)}" title="Restaurar publicación">Restaurar</button>`
            : `<button class="action-button-admin delete" data-pub-id="${escapeHtml(pub.id)}" title="Eliminar publicación">Eliminar</button>`;

        return `
            <tr>
                <td class="publication-title-cell" title="${escapeHtml(pub.title)}">${escapeHtml(pub.title)}</td>
                <td class="username-cell">
                    <a href="profile.html?user=${escapeHtml(pub.author_username)}" target="_blank">${escapeHtml(pub.author_username)}</a>
                </td>
                <td>${typeHTML}</td>
                <td class="saldo-blue-text">${valueHTML}</td>
                <td align="center">${participantsHTML}</td>
                <td><span class="status-badge ${escapeHtml(statusClass)}">${escapeHtml(statusText)}</span></td>
                <td>${creationDate}</td>
                <td>${actionsHTML}</td>
            </tr>
        `;
    }

    function getPublicationStatusText(pub) {
        if (pub.is_deleted) return 'Eliminada';
        if (pub.is_expired) return 'Expirada';
        if (pub.is_completed_publication) return 'Completada';
        if (pub.is_paused) return 'Pausada';
        return getStatusText(pub.status || 'open');
    }

    function getPublicationStatusClass(pub) {
        if (pub.is_deleted) return 'deleted';
        if (pub.is_expired) return 'expired';
        if (pub.is_completed_publication) return 'completed';
        if (pub.is_paused) return 'pausada';
        return String(pub.status || 'open').toLowerCase();
    }

    function renderPlatformWallet(walletData) {
        if (!elements.platformWalletStatsContainer) return;
        elements.platformWalletStatsContainer.innerHTML = `
            <div class="stat-card">
                <h4>Comisiones (Ganancias Netas)</h4>
                <p class="stat-value saldo-blue-text">${formatBalance(walletData.commissionBalance)} BLUE</p>
            </div>
            <div class="stat-card">
                <h4>Saldo RED de la Plataforma</h4>
                <p class="stat-value saldo-red-text">${formatBalance(walletData.redBalance)} RED</p>
            </div>
            <div class="stat-card">
                <h4>Saldo BLUE de la Plataforma (Disponible)</h4>
                <p class="stat-value saldo-blue-text">${formatBalance(walletData.liquidBlue)} BLUE</p>
            </div>
            <div class="stat-card">
                <h4>Saldo BLUE de la Plataforma (Pendiente)</h4>
                <p class="stat-value saldo-escrow-text">${formatBalance(walletData.escrowBlue)} BLUE</p>
            </div>
        `;
    }

    function renderCommissionLog(log) {
        if (!elements.platformCommissionLogContainer) return;
        if (log.length === 0) {
            elements.platformCommissionLogContainer.innerHTML = '<p class="empty-message">Aún no se ha registrado ninguna comisión.</p>';
            return;
        }

        const tableHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Monto Comisión (BLUE)</th>
                        <th>Publicación de Origen</th>
                        <th>Usuario Implicado</th>
                        <th>Fecha</th>
                    </tr>
                </thead>
                <tbody>
                    ${log.map(entry => getCommissionLogRowHTML(entry)).join('')}
                </tbody>
            </table>
        `;
        elements.platformCommissionLogContainer.innerHTML = tableHTML;
    }

    function getCommissionLogRowHTML(entry) {
        const commissionDate = new Date(entry.created_at).toLocaleString('es-ES', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const titleHTML = entry.publication_id
            ? `<span title="ID de Publicación: ${escapeHtml(entry.publication_id)}" style="cursor: help;">${escapeHtml(entry.publication_title)}</span>`
            : escapeHtml(entry.publication_title);

        const userHTML = entry.user_who_paid !== '(Usuario desconocido)'
            ? `<a href="profile.html?user=${escapeHtml(entry.user_who_paid)}" target="_blank">${escapeHtml(entry.user_who_paid)}</a>`
            : escapeHtml(entry.user_who_paid);

        return `
            <tr>
                <td class="saldo-blue-text">${formatBalance(entry.commission_amount_blue)} BLUE</td>
                <td>${titleHTML}</td>
                <td class="username-cell">${userHTML}</td>
                <td>${commissionDate}</td>
            </tr>
        `;
    }

    function renderReferralLog(log) {
        if (!elements.referralsLogContainer) return;
        if (!log || log.length === 0) {
            elements.referralsLogContainer.innerHTML = '<p class="empty-message">Todavía no se ha registrado ningún referido.</p>';
            return;
        }

        const tableHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Referido (Nuevo Usuario)</th>
                        <th>Referente (Usuario Antiguo)</th>
                        <th>Fecha de Registro</th>
                    </tr>
                </thead>
                <tbody>
                    ${log.map(entry => getReferralLogRowHTML(entry)).join('')}
                </tbody>
            </table>
        `;
        elements.referralsLogContainer.innerHTML = tableHTML;
    }

    function getReferralLogRowHTML(entry) {
        const registrationDate = new Date(entry.created_at).toLocaleString('es-ES', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        return `
            <tr>
                <td class="username-cell">
                    <a href="profile.html?user=${escapeHtml(entry.referred_username)}" target="_blank">${escapeHtml(entry.referred_username)}</a>
                </td>
                <td class="username-cell">
                    <a href="profile.html?user=${escapeHtml(entry.referrer_username)}" target="_blank">${escapeHtml(entry.referrer_username)}</a>
                </td>
                <td>${registrationDate}</td>
            </tr>
        `;
    }

    // --- Notifications Management ---

    // Configurar listener para el toggle de BroadCast
    const pushSendToAllSwitch = document.getElementById('pushSendToAll');
    if (pushSendToAllSwitch) {
        pushSendToAllSwitch.addEventListener('change', (e) => {
            const usernameInput = document.getElementById('pushTargetUsername');
            if (e.target.checked) {
                usernameInput.disabled = true;
                usernameInput.value = '';
                usernameInput.placeholder = 'ENVIANDO A TODOS LOS USUARIOS';
                usernameInput.classList.add('input-disabled-broadcast');
            } else {
                usernameInput.disabled = false;
                usernameInput.placeholder = 'Ej: miiigue';
                usernameInput.classList.remove('input-disabled-broadcast');
            }
        });
    }

    async function handlePushNotificationSubmit(e) {
        e.preventDefault();

        const sendToAll = document.getElementById('pushSendToAll').checked;
        const username = document.getElementById('pushTargetUsername').value;
        const title = document.getElementById('pushTitle').value;
        const message = document.getElementById('pushMessage').value;
        const url = document.getElementById('pushUrl').value;

        // Validaciones básicas
        if (!title || !message) {
            showCustomAlert('Por favor completa el título y el mensaje.');
            return;
        }

        if (!sendToAll && !username) {
            showCustomAlert('Debes especificar un usuario destino o seleccionar "Enviar a Todos".');
            return;
        }

        // CONFIRMACIÓN DE SEGURIDAD PARA BROADCAST
        if (sendToAll) {
            const confirmed = await new Promise(resolve => {
                showCustomConfirm(
                    `⚠️ ¡ATENCIÓN! Estás a punto de enviar esta notificación a TODOS los usuarios registrados.\n\nTitulo: ${title}\n\n¿Estás seguro de proceder?`,
                    () => resolve(true),
                    () => resolve(false)
                );
            });
            if (!confirmed) return;
        }

        const btn = document.getElementById('sendPushBtn');
        const originalText = btn ? btn.textContent : 'Enviar';

        if (btn) {
            btn.textContent = sendToAll ? 'Enviando Masivo...' : 'Enviando...';
            btn.disabled = true;
        }

        try {
            const result = await apiFetch('/api/notifications/send', {
                method: 'POST',
                body: JSON.stringify({
                    username: sendToAll ? null : username,
                    title,
                    message,
                    url,
                    sendToAll: sendToAll
                })
            });

            if (result.success) {
                let successMsg = `✅ Notificación enviada.`;
                if (result.total_active) {
                    successMsg += `\nDifusión completada: ${result.sent} enviados, ${result.failed} fallidos/limpiados.`;
                } else if (result.sent > 0) {
                    successMsg += `\n${result.sent} dispositivo(s) notificados.`;
                } else {
                    successMsg += `\nSin embargo, no se encontraron dispositivos activos para el destinatario.`;
                }
                showCustomAlert(successMsg);
                e.target.reset(); // Limpiar formulario

                // Resetear estado UI del switch
                if (pushSendToAllSwitch) {
                    pushSendToAllSwitch.checked = false;
                    pushSendToAllSwitch.dispatchEvent(new Event('change'));
                }
            } else {
                showCustomAlert(`⚠️ ${result.error || 'Error desconocido al enviar.'}`);
            }

        } catch (error) {
            console.error('Error enviando push:', error);
            showCustomAlert(`❌ Error al enviar notificación: ${error.message}`);
        } finally {
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
    }
    async function loadDailyModalSettings() {
        const section = document.getElementById('notifications-section');
        if (!section) return;

        try {
            const settings = await apiFetch('/api/admin/settings');

            // Cargar campos de texto de mensajes diarios (daily_modal_*)
            const dailySettings = settings.filter(s => s.setting_key.startsWith('daily_modal_'));
            dailySettings.forEach(s => {
                const input = document.querySelector(`[data-setting-key="${s.setting_key}"]`);
                if (input) {
                    input.value = s.setting_value;
                }
            });

            // Cargar estado del switch de visualización global (checkbox)
            const globalSetting = settings.find(s => s.setting_key === 'global_app_interstitial_enabled');
            const globalCheckbox = document.getElementById('setting_global_app_interstitial_enabled');
            if (globalSetting && globalCheckbox) {
                globalCheckbox.checked = globalSetting.setting_value === 'true';
            }
        } catch (error) {
            console.error("Error al cargar configuración de modal diario:", error);
        }
    }

    async function saveDailyModalSettings() {
        const section = document.getElementById('notifications-section');
        const inputs = section.querySelectorAll('[data-setting-key^="daily_modal_"]');
        const saveBtn = document.getElementById('saveDailyMessagesBtn');

        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';

        try {
            // Guardar campos de texto de mensajes diarios
            for (const input of inputs) {
                const key = input.dataset.settingKey;
                const value = input.value;
                await apiFetch('/api/admin/settings', {
                    method: 'POST',
                    body: JSON.stringify({ key, value })
                });
            }

            // Guardar estado del switch de visualización global
            const globalCheckbox = document.getElementById('setting_global_app_interstitial_enabled');
            if (globalCheckbox) {
                await apiFetch('/api/admin/settings', {
                    method: 'POST',
                    body: JSON.stringify({
                        key: 'global_app_interstitial_enabled',
                        value: globalCheckbox.checked.toString()
                    })
                });
            }

            showCustomAlert('Mensajes diarios guardados correctamente.');
        } catch (error) {
            showCustomAlert(`Error al guardar: ${error.message}`);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }

    function showNotificationsTab(tabId) {
        if (!elements.notificationsSection) return;

        elements.notificationsSection.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        elements.notificationsSection.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));

        const tabContent = document.getElementById(`${tabId}-tab`);
        const tabLink = document.querySelector(`.tab-link[data-tab="${tabId}"]`);

        if (tabContent) tabContent.classList.add('active');
        if (tabLink) tabLink.classList.add('active');

        switch (tabId) {
            case 'notifications-push':
                // Listener ya configurado en initialization
                break;
            case 'notifications-email':
                loadBroadcastHistory();
                break;
            case 'notifications-daily':
                loadDailyModalSettings();
                break;
        }
    }

    // --- Difusión de Email ---

    async function handleBroadcastFormSubmit(e) {
        e.preventDefault();
        const targetGroup = document.getElementById('broadcastTargetGroup').value;
        const targetUsername = document.getElementById('broadcastTargetUsername').value;
        const subject = document.getElementById('broadcastSubject').value;
        const title = document.getElementById('broadcastTitle').value;
        const bodyHtml = document.getElementById('broadcastBody').value;
        const buttonText = document.getElementById('broadcastButtonText').value;
        const buttonUrl = document.getElementById('broadcastButtonUrl').value;

        if (!subject || !title || !bodyHtml) {
            showCustomAlert('Por favor completa todos los campos del correo.');
            return;
        }

        const confirmed = await new Promise(resolve => {
            showCustomConfirm(
                `Estás por programar una difusión masiva de correo.\nCanal: ${targetGroup}\nAsunto: ${subject}\n\n¿Confirmas el envío?`,
                () => resolve(true),
                () => resolve(false)
            );
        });
        if (!confirmed) return;

        const btn = document.getElementById('sendBroadcastBtn');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Programando...';

        try {
            const result = await apiFetch('/api/admin/broadcast-email', {
                method: 'POST',
                body: JSON.stringify({
                    targetGroup,
                    targetUsername: targetGroup === 'specific' ? targetUsername : null,
                    subject,
                    title,
                    bodyHtml,
                    buttonText,
                    buttonUrl
                })
            });

            if (result.success) {
                showCustomAlert(`✅ Difusión programada exitosamente (#${result.broadcast_id}).\n${result.message}`);
                e.target.reset();
                if (elements.broadcastSpecificUserGroup) elements.broadcastSpecificUserGroup.style.display = 'none';
                loadBroadcastHistory();
            }
        } catch (error) {
            showCustomAlert(`❌ Error al programar difusión: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    async function loadBroadcastHistory() {
        if (!elements.broadcastHistoryContainer) return;
        elements.broadcastHistoryContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const history = await apiFetch('/api/admin/broadcast-email');
            renderBroadcastHistory(history);
        } catch (error) {
            elements.broadcastHistoryContainer.innerHTML = `<p class="error-message">Error al cargar historial: ${error.message}</p>`;
        }
    }

    function renderBroadcastHistory(history) {
        if (!elements.broadcastHistoryContainer) return;
        if (!history || history.length === 0) {
            elements.broadcastHistoryContainer.innerHTML = '<p class="empty-message">No hay difusiones previas registradas.</p>';
            return;
        }

        const tableHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Fecha</th>
                        <th>Asunto</th>
                        <th>Grupo</th>
                        <th>Estado</th>
                        <th>Enviados</th>
                        <th>Fallidos</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${history.map(b => {
            const date = new Date(b.created_at).toLocaleString();
            const statusClass = b.status === 'completed' ? 'active' : (b.status === 'failed' ? 'suspended' : 'pending');
            return `
                        <tr>
                            <td>#${b.id}</td>
                            <td>${date}</td>
                            <td title="${escapeHtml(b.subject)}">${escapeHtml(b.subject.substring(0, 30))}${b.subject.length > 30 ? '...' : ''}</td>
                            <td><span class="status-badge">${b.target_group}</span></td>
                            <td><span class="status-badge ${statusClass}">${b.status}</span></td>
                            <td align="center"><strong>${b.sent_count}</strong></td>
                            <td align="center"><span class="saldo-red-text">${b.failed_count}</span></td>
                            <td align="center">${b.total_recipients}</td>
                        </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        `;
        elements.broadcastHistoryContainer.innerHTML = tableHTML;
    }

    // --- WINTON ACADEMY MANAGEMENT ---

    async function loadAcademyVideos() {
        if (!elements.academyTableContainer) return;
        elements.academyTableContainer.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const videos = await apiFetch('/api/academy/all');
            renderAcademyVideosTable(videos);
        } catch (error) {
            elements.academyTableContainer.innerHTML = `<p class="error-message">Error al cargar videos: ${error.message}</p>`;
        }
    }

    function renderAcademyVideosTable(videos) {
        if (!elements.academyTableContainer) return;

        if (!videos || videos.length === 0) {
            elements.academyTableContainer.innerHTML = '<p class="empty-message">No hay videos interactivos registrados actualmente.</p>';
            return;
        }

        const tableHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th style="width: 50px;">Orden</th>
                        <th>Video</th>
                        <th>Título Interactivo</th>
                        <th style="width: 100px;">ID YouTube</th>
                        <th style="width: 100px;">Estado</th>
                        <th style="width: 150px;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${videos.map(video => getAcademyVideoRowHTML(video)).join('')}
                </tbody>
            </table>
        `;

        elements.academyTableContainer.innerHTML = tableHTML;

        // Attach Event Listeners to the dynamically generated buttons
        elements.academyTableContainer.querySelectorAll('.action-button-admin').forEach(btn => {
            btn.addEventListener('click', handleAcademyVideoAction);
        });
    }

    function getAcademyVideoRowHTML(video) {
        const isActive = video.is_active;
        const statusClass = isActive ? 'active' : 'suspended';
        const statusText = isActive ? '✅ Público' : '❌ Oculto';

        // Use the official thumbnail for the video
        const thumbUrl = `https://img.youtube.com/vi/${escapeHtml(video.youtube_id)}/hqdefault.jpg`;

        return `
            <tr>
                <td align="center"><strong>${escapeHtml(video.order_num)}</strong></td>
                <td>
                    <div style="width: 120px; height: 68px; border-radius: 4px; overflow: hidden; background: #000;">
                        <img src="${thumbUrl}" alt="Thumbnail" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                </td>
                <td style="font-weight: bold;">${escapeHtml(video.title)}</td>
                <td><code>${escapeHtml(video.youtube_id)}</code></td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="action-button-admin ${isActive ? 'danger' : 'approve'}" 
                            data-action="toggle-video-status" 
                            data-video-id="${escapeHtml(video.id)}"
                            data-current-status="${isActive}">
                        ${isActive ? 'Ocultar' : 'Publicar'}
                    </button>
                    <button class="action-button-admin delete" 
                            data-action="delete-video" 
                            data-video-id="${escapeHtml(video.id)}">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    }

    if (elements.academyVideoForm) {
        elements.academyVideoForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = elements.academyVideoForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;

            const youtubeUrl = elements.academyVideoUrl.value.trim();
            const title = elements.academyVideoTitle.value.trim();
            const orderNum = parseInt(elements.academyVideoOrder.value, 10) || 0;

            if (!youtubeUrl || !title) {
                showCustomAlert("Por favor, ingresa el enlace y el título del video.");
                return;
            }

            submitBtn.textContent = 'Guardando...';
            submitBtn.disabled = true;

            try {
                const result = await apiFetch('/api/academy/add', {
                    method: 'POST',
                    body: JSON.stringify({ youtube_url: youtubeUrl, title, order_num: orderNum })
                });

                if (result.success) {
                    showCustomAlert(`✅ Tutorial agregado exitosamente: ${result.video.title}`);
                    elements.academyVideoForm.reset();
                    loadAcademyVideos(); // Refresh table
                }
            } catch (error) {
                showCustomAlert(`❌ Error al agregar video: ${error.message}`);
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    async function handleAcademyVideoAction(e) {
        const btn = e.target.closest('button');
        if (!btn) return;

        const action = btn.dataset.action;
        const videoId = btn.dataset.videoId;

        if (action === 'toggle-video-status') {
            const isCurrentlyActive = btn.dataset.currentStatus === 'true';
            const newStatus = !isCurrentlyActive;

            btn.disabled = true;
            try {
                const result = await apiFetch(`/api/academy/${videoId}/status`, {
                    method: 'PUT',
                    body: JSON.stringify({ is_active: newStatus })
                });

                if (result.success) {
                    loadAcademyVideos(); // Refresh visual
                }
            } catch (error) {
                showCustomAlert(`Error al actualizar estado: ${error.message}`);
                btn.disabled = false;
            }

        } else if (action === 'delete-video') {
            const confirmed = await new Promise(resolve => {
                showCustomConfirm(
                    `🗑️ ¿Estás completamente seguro de ELIMINAR este tutorial interactivo?\n\nEsta acción no se puede deshacer y desaparecerá de la página 'Cómo Funciona'.`,
                    () => resolve(true),
                    () => resolve(false)
                );
            });

            if (!confirmed) return;

            btn.disabled = true;
            try {
                const result = await apiFetch(`/api/academy/${videoId}`, {
                    method: 'DELETE'
                });

                if (result.success) {
                    showCustomAlert("✅ Video eliminado permanentemente.");
                    loadAcademyVideos();
                }
            } catch (error) {
                showCustomAlert(`Error al eliminar: ${error.message}`);
                btn.disabled = false;
            }
        }
    }

    // Re-vincular el form de Push que podría haberse perdido si no se ejecuta bien
    if (elements.pushNotificationForm) {
        elements.pushNotificationForm.addEventListener('submit', handlePushNotificationSubmit);
    }

    // ============================================================================
    // WINTON SOLIDARIO - Gestión de Causas Humanitarias
    // ============================================================================
    // Funciones para cargar, renderizar y gestionar causas humanitarias
    // desde el panel de administración.
    // ============================================================================

    /**
     * Carga las causas humanitarias desde el backend con filtros aplicados.
     * Usa el endpoint /api/admin/humanitarian/causes con query params.
     */
    async function loadHumanitarianCauses() {
        if (!elements.humanitarianTableContainer) return;
        elements.humanitarianTableContainer.innerHTML = '<div class="loading-spinner"></div>';
        if (elements.humanitarianStatsContainer) {
            elements.humanitarianStatsContainer.innerHTML = '<div class="loading-spinner"></div>';
        }

        try {
            const status = elements.humanitarianStatusFilter?.value || 'pending';
            const search = elements.humanitarianSearchInput?.value || '';
            const data = await apiFetch(`/api/admin/humanitarian/causes?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`);

            renderHumanitarianStats(data);
            renderHumanitarianTable(data.causes || []);
        } catch (error) {
            elements.humanitarianTableContainer.innerHTML = `<p class="error-message">Error al cargar causas: ${escapeHtml(error.message)}</p>`;
            if (elements.humanitarianStatsContainer) {
                elements.humanitarianStatsContainer.innerHTML = '';
            }
        }
    }

    /**
     * Renderiza las estadísticas rápidas de causas humanitarias.
     * Muestra total de causas y pendientes en tarjetas de resumen.
     */
    function renderHumanitarianStats(data) {
        if (!elements.humanitarianStatsContainer) return;
        elements.humanitarianStatsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${data.pending_count || 0}</div>
                <div class="stat-label">Pendientes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.total || 0}</div>
                <div class="stat-label">Total (filtro actual)</div>
            </div>
        `;
    }

    /**
     * Renderiza la tabla de causas humanitarias.
     * Cada fila tiene botón para ver detalle en modal.
     */
    function renderHumanitarianTable(causes) {
        if (!elements.humanitarianTableContainer) return;

        if (!causes || causes.length === 0) {
            elements.humanitarianTableContainer.innerHTML = '<p class="no-data-message">No se encontraron causas con los filtros seleccionados.</p>';
            return;
        }

        // Helper para generar badge de estado con colores profesionales
        const statusBadge = (status) => {
            const map = {
                'pending': { label: '⏳ Pendiente', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
                'approved': { label: '✅ Aprobada', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
                'rejected': { label: '❌ Rechazada', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
                'completed': { label: '🏆 Completada', color: '#6366F1', bg: 'rgba(99,102,241,0.15)' }
            };
            const s = map[status] || { label: status, color: '#888', bg: 'rgba(136,136,136,0.15)' };
            return `<span style="padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; color: ${s.color}; background: ${s.bg};">${s.label}</span>`;
        };

        let html = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Usuario</th>
                        <th>Título</th>
                        <th>Meta (BLUE)</th>
                        <th>Recaudado</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
        `;

        causes.forEach(cause => {
            const date = new Date(cause.created_at).toLocaleDateString('es-ES', {
                year: 'numeric', month: 'short', day: 'numeric'
            });
            const goalFormatted = Number(cause.goal_amount).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const currentFormatted = Number(cause.current_amount).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            html += `
                <tr>
                    <td>#${cause.id}</td>
                    <td><strong>${escapeHtml(cause.username)}</strong></td>
                    <td>${escapeHtml(cause.title)}</td>
                    <td>${goalFormatted}</td>
                    <td>${currentFormatted}</td>
                    <td>${statusBadge(cause.status)}</td>
                    <td>${date}</td>
                    <td>
                        <button class="action-button" onclick="window._viewHumanitarianCause(${cause.id})" style="font-size: 0.8rem; padding: 6px 12px;">
                            👁️ Ver
                        </button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        elements.humanitarianTableContainer.innerHTML = html;
    }

    /**
     * Abre el modal de detalle de una causa humanitaria.
     * Muestra toda la información y botones de acción (aprobar/rechazar).
     */
    window._viewHumanitarianCause = async function (causeId) {
        if (!elements.humanitarianDetailModal) return;

        elements.humanitarianModalTitle.textContent = 'Cargando...';
        elements.humanitarianModalBody.innerHTML = '<div class="loading-spinner"></div>';
        elements.humanitarianModalActions.innerHTML = '';
        elements.humanitarianDetailModal.style.display = 'flex';

        try {
            const data = await apiFetch(`/api/admin/humanitarian/causes/${causeId}`);
            const cause = data.cause;
            const date = new Date(cause.created_at).toLocaleString('es-ES');

            // Renderizar evidencia (array de URLs)
            let evidenceHtml = '<em>Sin evidencia</em>';
            if (cause.evidence_urls && Array.isArray(cause.evidence_urls) && cause.evidence_urls.length > 0) {
                evidenceHtml = cause.evidence_urls.map((url, i) =>
                    `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color: #3B82F6; text-decoration: underline; display: block; margin-bottom: 4px;">📎 Evidencia ${i + 1}</a>`
                ).join('');
            }

            elements.humanitarianModalTitle.textContent = `Causa #${cause.id}: ${cause.title}`;
            elements.humanitarianModalBody.innerHTML = `
                <div style="display: grid; gap: 12px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <strong style="color: #94A3B8;">Usuario:</strong>
                            <p style="margin: 4px 0;">${escapeHtml(cause.username)}</p>
                        </div>
                        <div>
                            <strong style="color: #94A3B8;">Email:</strong>
                            <p style="margin: 4px 0;">${escapeHtml(cause.email || 'N/A')}</p>
                        </div>
                        <div>
                            <strong style="color: #94A3B8;">Meta BLUE IOU:</strong>
                            <p style="margin: 4px 0; font-weight: 700; color: #3B82F6;">${Number(cause.goal_amount).toLocaleString('es-ES')} BLUE</p>
                        </div>
                        <div>
                            <strong style="color: #94A3B8;">Recaudado:</strong>
                            <p style="margin: 4px 0; font-weight: 700; color: #10B981;">${Number(cause.current_amount).toLocaleString('es-ES')} BLUE</p>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05); padding: 10px 0;">
                        <div>
                            <strong style="color: #94A3B8;">Registro (Sponsor):</strong>
                            <p style="margin: 4px 0;">
                                ${cause.referrer_referral_code 
                                    ? `<span style="color: #10B981; font-weight: bold;">${escapeHtml(cause.referrer_referral_code)}</span> (de @${escapeHtml(cause.referrer_username)})`
                                    : '<span style="color: #64748B; font-style: italic;">Registro Directo (Sin Referido)</span>'}
                            </p>
                        </div>
                        <div>
                            <strong style="color: #94A3B8;">Destinatario de Fondos:</strong>
                            <p style="margin: 4px 0;">
                                <strong style="color: #F472B6;">${escapeHtml(cause.foundation_name)}</strong> 
                                (Código: <span style="color: #3B82F6; font-weight: bold;">${escapeHtml(cause.beneficiary_referral_code)}</span>)
                            </p>
                        </div>
                    </div>

                    ${cause.beneficiary_socials ? `
                        <div>
                            <strong style="color: #94A3B8;">Redes del Beneficiario:</strong>
                            <div style="margin-top: 4px;">
                                ${cause.beneficiary_socials.trim().split(/\s+/).map(url => `
                                    <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color: #F472B6; text-decoration: underline; margin-right: 15px; font-size: 0.85rem;">🔗 ${escapeHtml(url)}</a>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <div>
                        <strong style="color: #94A3B8;">Historia:</strong>
                        <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; margin-top: 6px; max-height: 200px; overflow-y: auto; line-height: 1.6;">
                            ${escapeHtml(cause.story)}
                        </div>
                    </div>

                    <div>
                        <strong style="color: #94A3B8;">Evidencia:</strong>
                        <div style="margin-top: 6px;">${evidenceHtml}</div>
                    </div>

                    <div style="display: flex; gap: 20px; font-size: 0.85rem; color: #64748B;">
                        <span>📅 Registrada: ${date}</span>
                        <span>🔖 Estado: <strong>${cause.status}</strong></span>
                    </div>

                    ${cause.admin_notes ? `
                        <div style="background: rgba(239,68,68,0.1); padding: 12px; border-radius: 8px; border-left: 3px solid #EF4444;">
                            <strong style="color: #EF4444;">Notas del Admin:</strong>
                            <p style="margin: 4px 0;">${escapeHtml(cause.admin_notes)}</p>
                        </div>
                    ` : ''}
                </div>
            `;

            // Botones de acción solo para causas pendientes
            if (cause.status === 'pending') {
                elements.humanitarianModalActions.innerHTML = `
                    <div style="display: flex; gap: 12px; width: 100%;">
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 6px; font-size: 0.85rem; color: #94A3B8;">Notas del Admin (obligatorio para rechazar):</label>
                            <textarea id="humanitarianAdminNotes" rows="2" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 0.9rem;" placeholder="Escribe notas o razón de rechazo..."></textarea>
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px; margin-top: 12px;">
                        <button id="btnApproveCause" class="action-button" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #10B981, #059669); border: none; border-radius: 8px; color: white; font-weight: 700; cursor: pointer;">
                            ✅ Aprobar Causa
                        </button>
                        <button id="btnRejectCause" class="action-button" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #EF4444, #DC2626); border: none; border-radius: 8px; color: white; font-weight: 700; cursor: pointer;">
                            ❌ Rechazar Causa
                        </button>
                    </div>
                `;

                // Event listeners para los botones de acción
                document.getElementById('btnApproveCause').addEventListener('click', () => {
                    const notes = document.getElementById('humanitarianAdminNotes')?.value || '';
                    handleHumanitarianAction(causeId, 'approve', notes);
                });
                document.getElementById('btnRejectCause').addEventListener('click', () => {
                    const notes = document.getElementById('humanitarianAdminNotes')?.value || '';
                    handleHumanitarianAction(causeId, 'reject', notes);
                });
            } else {
                elements.humanitarianModalActions.innerHTML = `
                    <p style="text-align: center; color: #64748B; font-style: italic;">Esta causa ya fue procesada (${cause.status}).</p>
                `;
            }

        } catch (error) {
            elements.humanitarianModalBody.innerHTML = `<p class="error-message">Error al cargar detalle: ${escapeHtml(error.message)}</p>`;
        }
    };

    /**
     * Maneja la acción de aprobar o rechazar una causa.
     * Pide confirmación, envía al backend y recarga la tabla.
     */
    async function handleHumanitarianAction(causeId, action, notes) {
        const actionLabel = action === 'approve' ? 'APROBAR' : 'RECHAZAR';
        const confirmMsg = action === 'approve'
            ? `¿Estás seguro de APROBAR esta causa #${causeId}? El usuario será notificado y sus referidos podrán donarle.`
            : `¿Estás seguro de RECHAZAR esta causa #${causeId}? Se requiere una razón detallada.`;

        showCustomConfirm(confirmMsg, async () => {
            try {
                const result = await apiFetch(`/api/admin/humanitarian/causes/${causeId}/${action}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ admin_notes: notes })
                });

                showCustomAlert(`✅ ${result.message}`);
                elements.humanitarianDetailModal.style.display = 'none';
                loadHumanitarianCauses();
                refreshHumanitarianBadge();
            } catch (error) {
                showCustomAlert(`❌ Error al ${actionLabel.toLowerCase()}: ${error.message}`);
            }
        });
    }

    /**
     * Actualiza el badge de pendientes en el sidebar (conteo de causas pendientes).
     * Se ejecuta al cargar y cada 30 segundos automáticamente.
     */
    async function refreshHumanitarianBadge() {
        try {
            const data = await apiFetch('/api/admin/humanitarian/pending-count');
            if (elements.humanitarianBadge) {
                elements.humanitarianBadge.textContent = data.count > 0 ? data.count : '';
                elements.humanitarianBadge.style.display = data.count > 0 ? 'inline-flex' : 'none';
            }
        } catch (error) {
            console.warn('[SOLIDARIO] No se pudo actualizar badge de pendientes:', error.message);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RECOMPENSAS DE GOBERNANZA
    // ═══════════════════════════════════════════════════════════════════════

    async function loadGovRewardsSection() {
        if (!elements.govRewardsStats) return;
        elements.govRewardsStats.innerHTML = '<div class="loading-spinner"></div>';
        if (elements.govRewardsAction) elements.govRewardsAction.style.display = 'none';
        if (elements.govRewardsResult) elements.govRewardsResult.style.display = 'none';

        try {
            const stats = await apiFetch('/api/admin/governance/reward-stats');
            renderGovRewardsStats(stats);
        } catch (error) {
            elements.govRewardsStats.innerHTML = `<p class="error-message">Error al cargar estadísticas: ${escapeHtml(error.message)}</p>`;
        }

        loadDemoExportStats();
    }

    function renderGovRewardsStats(stats) {
        if (!elements.govRewardsStats) return;

        elements.govRewardsStats.innerHTML = `
            <div class="stat-card">
                <h4>Votos sin Recompensar</h4>
                <p class="stat-value">${Number(stats.pendingCount)}</p>
            </div>
            <div class="stat-card">
                <h4>Guardianes Afectados</h4>
                <p class="stat-value">${Number(stats.guardiansAffected)}</p>
            </div>
            <div class="stat-card">
                <h4>Tasa Actual</h4>
                <p class="stat-value">${Number(stats.currentRate).toFixed(2)} BLUE</p>
            </div>
            <div class="stat-card">
                <h4>Total Estimado</h4>
                <p class="stat-value">${Number(stats.estimatedTotal).toFixed(2)} BLUE</p>
            </div>
        `;

        if (stats.pendingCount > 0 && stats.currentRate > 0) {
            elements.govRewardsSummary.textContent =
                `${stats.pendingCount} voto(s) pendientes — ${stats.guardiansAffected} guardián(es)`;
            elements.govRewardsDescription.textContent =
                `Se acreditarán ${Number(stats.estimatedTotal).toFixed(2)} BLUE IOU en total (${Number(stats.currentRate).toFixed(2)} por voto).`;
            elements.govRewardsAction.style.display = 'block';
            elements.govRewardsProcessBtn.disabled = false;
            elements.govRewardsProcessBtn.textContent = 'Procesar Pagos Pendientes';
            elements.govRewardsProcessBtn.style.background = '#059669';
            elements.govRewardsProcessBtn.style.cursor = 'pointer';
        } else if (stats.pendingCount > 0 && stats.currentRate === 0) {
            elements.govRewardsSummary.textContent =
                `${stats.pendingCount} voto(s) pendientes — Tasa en 0 (desactivada)`;
            elements.govRewardsDescription.textContent =
                'Configure "Gobernanza — Recompensa por Voto (BLUE IOU)" en Configuración antes de procesar.';
            elements.govRewardsAction.style.display = 'block';
            elements.govRewardsProcessBtn.disabled = true;
            elements.govRewardsProcessBtn.textContent = 'Tasa en 0 — Configure primero';
            elements.govRewardsProcessBtn.style.background = '#9CA3AF';
            elements.govRewardsProcessBtn.style.cursor = 'not-allowed';
        } else {
            elements.govRewardsAction.style.display = 'none';
        }
    }

    if (elements.govRewardsProcessBtn) {
        elements.govRewardsProcessBtn.addEventListener('click', async () => {
            if (elements.govRewardsProcessBtn.disabled) return;

            const confirmed = confirm(
                '¿Estás seguro de procesar los pagos pendientes?\n\n' +
                'Esta acción acreditará BLUE IOU a cada guardián según la tasa configurada. ' +
                'Se enviará un correo consolidado a cada guardián afectado.'
            );
            if (!confirmed) return;

            elements.govRewardsProcessBtn.disabled = true;
            elements.govRewardsProcessBtn.textContent = 'Procesando...';
            elements.govRewardsResult.style.display = 'none';

            try {
                const result = await apiFetch('/api/admin/governance/process-rewards', {
                    method: 'POST',
                });
                elements.govRewardsResult.style.display = 'block';
                elements.govRewardsResult.innerHTML = `
                    <div class="admin-card" style="border-left: 4px solid #059669; background: #F0FDF4;">
                        <h4 style="color: #059669; margin: 0 0 0.5rem;">Procesamiento completado</h4>
                        <p><strong>Votos procesados:</strong> ${Number(result.totalProcessed)}</p>
                        <p><strong>Omitidos:</strong> ${Number(result.totalSkipped)}</p>
                        <p><strong>Tasa aplicada:</strong> ${Number(result.rateUsed).toFixed(2)} BLUE IOU</p>
                        <p><strong>Guardianes notificados:</strong> ${Number(result.guardiansAffected)}</p>
                    </div>
                `;
                loadGovRewardsSection();
            } catch (error) {
                elements.govRewardsResult.style.display = 'block';
                elements.govRewardsResult.innerHTML = `
                    <div class="admin-card" style="border-left: 4px solid #DC2626; background: #FEF2F2;">
                        <h4 style="color: #DC2626; margin: 0 0 0.5rem;">Error en el procesamiento</h4>
                        <p>${escapeHtml(error.message)}</p>
                    </div>
                `;
                elements.govRewardsProcessBtn.disabled = false;
                elements.govRewardsProcessBtn.textContent = 'Procesar Pagos Pendientes';
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TRANSFERENCIA DEMO → PRODUCCIÓN
    // ═══════════════════════════════════════════════════════════════════════

    let pendingImportFileData = null;
    // Valor del multiplicador visto por el admin en la preview. Se envía al
    // endpoint de procesamiento como "candado optimista" para que, si entre
    // la preview y el clic de "Procesar" la etapa booster cambia, el backend
    // devuelva 409 y obligue a validar el archivo nuevamente.
    let pendingExpectedMultiplier = null;

    async function loadDemoExportStats() {
        if (!elements.govExportStats) return;
        try {
            const stats = await apiFetch('/api/admin/governance/demo-export-stats');
            if (stats.unexportedVotes > 0) {
                elements.govExportStats.innerHTML =
                    `<p><strong>${Number(stats.unexportedVotes)}</strong> voto(s) de <strong>${Number(stats.guardiansCount)}</strong> guardián(es) sin exportar.</p>`;
                if (elements.govExportBtn) elements.govExportBtn.disabled = false;
            } else {
                elements.govExportStats.innerHTML =
                    '<p style="color: #059669;">Todos los votos han sido exportados.</p>';
                if (elements.govExportBtn) {
                    elements.govExportBtn.disabled = true;
                    elements.govExportBtn.textContent = 'Sin votos pendientes';
                    elements.govExportBtn.style.background = '#9CA3AF';
                    elements.govExportBtn.style.cursor = 'not-allowed';
                }
            }
        } catch (error) {
            elements.govExportStats.innerHTML =
                `<p style="color: #DC2626;">${escapeHtml(error.message)}</p>`;
        }

        loadExportHistory();
    }

    async function loadExportHistory() {
        if (!elements.govExportHistory) return;
        try {
            const history = await apiFetch('/api/admin/governance/demo-export-history');
            if (!Array.isArray(history) || history.length === 0) {
                elements.govExportHistory.innerHTML =
                    '<p style="color: #9CA3AF; font-size: 0.875rem;">No hay exportaciones registradas.</p>';
                return;
            }

            let rowsHTML = '';
            for (const exp of history) {
                const date = new Date(exp.exported_at).toLocaleDateString('es-ES', {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                rowsHTML += `
                    <tr>
                        <td style="padding: 8px;">${Number(exp.id)}</td>
                        <td style="padding: 8px;">${escapeHtml(date)}</td>
                        <td style="padding: 8px;">${Number(exp.total_guardians)}</td>
                        <td style="padding: 8px;">${Number(exp.total_votes)}</td>
                        <td style="padding: 8px;">${Number(exp.downloaded_count)}</td>
                        <td style="padding: 8px;">
                            <button class="gov-export-download-btn" data-export-id="${Number(exp.id)}"
                                style="background: #6B7280; color: #fff; border: none; padding: 4px 12px;
                                       border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 500;">
                                Re-descargar
                            </button>
                        </td>
                    </tr>`;
            }

            elements.govExportHistory.innerHTML = `
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
                        <thead>
                            <tr style="border-bottom: 2px solid #E5E7EB; text-align: left;">
                                <th style="padding: 8px;">#</th>
                                <th style="padding: 8px;">Fecha</th>
                                <th style="padding: 8px;">Guardianes</th>
                                <th style="padding: 8px;">Votos</th>
                                <th style="padding: 8px;">Descargas</th>
                                <th style="padding: 8px;">Acción</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHTML}</tbody>
                    </table>
                </div>`;

            elements.govExportHistory.querySelectorAll('.gov-export-download-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const exportId = btn.dataset.exportId;
                    btn.disabled = true;
                    btn.textContent = 'Descargando...';
                    try {
                        const record = await apiFetch(`/api/admin/governance/demo-export/${exportId}/download`);
                        const blob = new Blob([JSON.stringify(record.export_data, null, 2)], { type: 'application/json' });
                        const url  = URL.createObjectURL(blob);
                        const a    = document.createElement('a');
                        const date = new Date(record.exported_at).toISOString().split('T')[0];
                        a.href     = url;
                        a.download = `gov-rewards-export-${date}-redownload.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        loadExportHistory();
                    } catch (error) {
                        showCustomAlert('Error al descargar: ' + error.message);
                    } finally {
                        btn.disabled = false;
                        btn.textContent = 'Re-descargar';
                    }
                });
            });
        } catch (error) {
            elements.govExportHistory.innerHTML =
                `<p style="color: #DC2626; font-size: 0.875rem;">${escapeHtml(error.message)}</p>`;
        }
    }

    if (elements.govExportBtn) {
        elements.govExportBtn.addEventListener('click', async () => {
            if (elements.govExportBtn.disabled) return;

            const confirmed = confirm(
                '¿Exportar los votos de gobernanza no exportados?\n\n' +
                'Se generará un archivo JSON firmado y los votos se marcarán como exportados.'
            );
            if (!confirmed) return;

            elements.govExportBtn.disabled = true;
            elements.govExportBtn.textContent = 'Exportando...';
            if (elements.govExportResult) elements.govExportResult.style.display = 'none';

            try {
                const response = await apiFetch('/api/admin/governance/demo-export', { method: 'POST' });

                if (!response.data) {
                    elements.govExportResult.style.display = 'block';
                    elements.govExportResult.innerHTML =
                        '<p style="color: #667085;">No hay votos pendientes de exportar.</p>';
                    return;
                }

                const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                const date = new Date().toISOString().split('T')[0];
                a.href     = url;
                a.download = `gov-rewards-export-${date}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                elements.govExportResult.style.display = 'block';
                elements.govExportResult.innerHTML = `
                    <div class="admin-card" style="border-left: 4px solid #059669; background: #F0FDF4;">
                        <h4 style="color: #059669; margin: 0 0 0.5rem;">Exportación completada</h4>
                        <p><strong>Votos exportados:</strong> ${Number(response.data.summary.total_votes)}</p>
                        <p><strong>Guardianes:</strong> ${Number(response.data.summary.total_guardians)}</p>
                        <p style="color: #667085; font-size: 0.875rem; margin-top: 0.5rem;">
                            El archivo se descargó automáticamente. Súbelo en el panel de admin de producción.
                        </p>
                    </div>`;
                loadDemoExportStats();
            } catch (error) {
                elements.govExportResult.style.display = 'block';
                elements.govExportResult.innerHTML = `
                    <div class="admin-card" style="border-left: 4px solid #DC2626; background: #FEF2F2;">
                        <h4 style="color: #DC2626; margin: 0 0 0.5rem;">Error en la exportación</h4>
                        <p>${escapeHtml(error.message)}</p>
                    </div>`;
                elements.govExportBtn.disabled = false;
                elements.govExportBtn.textContent = 'Exportar Reporte';
                elements.govExportBtn.style.background = '#3B82F6';
                elements.govExportBtn.style.cursor = 'pointer';
            }
        });
    }

    if (elements.govImportValidateBtn) {
        elements.govImportValidateBtn.addEventListener('click', async () => {
            if (!elements.govImportFile || !elements.govImportFile.files[0]) {
                showCustomAlert('Selecciona un archivo JSON primero.');
                return;
            }

            const file = elements.govImportFile.files[0];
            if (!file.name.endsWith('.json')) {
                showCustomAlert('El archivo debe ser de tipo .json');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                showCustomAlert('El archivo es demasiado grande (máx. 5 MB).');
                return;
            }

            elements.govImportValidateBtn.disabled = true;
            elements.govImportValidateBtn.textContent = 'Validando...';
            if (elements.govImportPreview) elements.govImportPreview.style.display = 'none';
            if (elements.govImportProcessBtn) elements.govImportProcessBtn.style.display = 'none';
            if (elements.govImportResult) elements.govImportResult.style.display = 'none';

            try {
                const text = await file.text();
                let fileData;
                try {
                    fileData = JSON.parse(text);
                } catch (e) {
                    throw new Error('El archivo no contiene JSON válido.');
                }

                const preview = await apiFetch('/api/admin/governance/demo-import-preview', {
                    method: 'POST',
                    body: JSON.stringify({ fileData }),
                });

                if (preview.status === 'duplicate') {
                    elements.govImportPreview.style.display = 'block';
                    elements.govImportPreview.innerHTML = `
                        <div class="admin-card" style="border-left: 4px solid #F59E0B; background: #FFFBEB;">
                            <h4 style="color: #D97706; margin: 0 0 0.5rem;">Archivo ya importado</h4>
                            <p>${escapeHtml(preview.message)}</p>
                        </div>`;
                    return;
                }

                pendingImportFileData = fileData;

                // Índice username → votos del archivo firmado (usado para mostrar detalle auditable por fila).
                const votesByUsername = {};
                if (fileData && Array.isArray(fileData.guardians)) {
                    for (const gf of fileData.guardians) {
                        if (gf && typeof gf.username === 'string') {
                            votesByUsername[gf.username] = Array.isArray(gf.votes) ? gf.votes : [];
                        }
                    }
                }

                const formatVoteLabel = (v) => {
                    if (v === 'approve') return 'Aprobar';
                    if (v === 'reject')  return 'Rechazar';
                    return escapeHtml(String(v || '—'));
                };
                const formatVoteDate = (iso) => {
                    if (!iso) return '—';
                    const d = new Date(iso);
                    if (isNaN(d.getTime())) return escapeHtml(String(iso));
                    return d.toLocaleString('es-ES', { timeZone: 'America/Bogota' });
                };

                let guardiansHTML = '';
                preview.guardians.forEach((g, idx) => {
                    const statusIcon = g.found_in_production ? '✅' : '⚠️';
                    const statusText = g.found_in_production ? '' : ' (NO encontrado en producción)';
                    const detailsId = `gov-imp-det-${idx}`;
                    const votesForUser = votesByUsername[g.username] || [];
                    let detailRows = '';
                    for (const v of votesForUser) {
                        detailRows += `
                            <tr>
                                <td style="padding: 4px 8px; color: #374151;">#${Number(v.request_id)}</td>
                                <td style="padding: 4px 8px; color: #374151;">${formatVoteLabel(v.vote)}</td>
                                <td style="padding: 4px 8px; color: #374151;">${formatVoteDate(v.voted_at)}</td>
                                <td style="padding: 4px 8px; color: #6B7280;">#${Number(v.demo_vote_id)}</td>
                            </tr>`;
                    }
                    const detailBlock = votesForUser.length === 0
                        ? '<p style="color: #6B7280; margin: 0;">Sin detalle de votos en el archivo.</p>'
                        : `
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; background: #FFFFFF; border: 1px solid #E5E7EB;">
                                <thead>
                                    <tr style="background: #F3F4F6; color: #111827; text-align: left;">
                                        <th style="padding: 6px 8px;">Solicitud</th>
                                        <th style="padding: 6px 8px;">Voto</th>
                                        <th style="padding: 6px 8px;">Fecha</th>
                                        <th style="padding: 6px 8px;">Demo vote ID</th>
                                    </tr>
                                </thead>
                                <tbody>${detailRows}</tbody>
                            </table>`;

                    // Celdas económicas por guardián (solo aplican si fue encontrado en producción):
                    //  - Base/voto: tasa configurada en app_settings (gov_vote_reward_blue).
                    //  - Multiplicador: etapa booster vigente hoy (boosterService).
                    //  - Subtotal base: votos × base (sin multiplicar).
                    //  - Total: votos × base × multiplicador (lo que realmente se va a acreditar).
                    const basePerVote = Number(g.base_per_vote ?? preview.currentRate ?? 0);
                    const gMult       = Number(g.multiplier ?? preview.multiplier ?? 1);
                    const gStage      = g.stage_name || preview.stageName || 'Sin etapa activa';
                    const subtotalBase = Number(g.total_base ?? (g.new_votes * basePerVote));
                    const totalFinal   = Number(g.total_reward ?? 0);

                    guardiansHTML += `
                        <tr style="border-bottom: 1px solid #E5E7EB; color: #111827;">
                            <td style="padding: 8px; color: #111827;">
                                <button type="button" class="gov-imp-toggle" data-target="${detailsId}"
                                    style="background: transparent; border: 1px solid #8B5CF6; color: #6D28D9;
                                           border-radius: 4px; padding: 2px 8px; margin-right: 6px; cursor: pointer;">
                                    Ver votos
                                </button>
                                ${statusIcon} <strong>${escapeHtml(g.username)}</strong>${statusText}
                            </td>
                            <td style="padding: 8px; color: #111827;">${Number(g.new_votes)}</td>
                            <td style="padding: 8px; color: #111827;">${Number(g.already_imported)}</td>
                            <td style="padding: 8px; color: #111827;">
                                ${g.found_in_production ? basePerVote.toFixed(2) : '—'}
                            </td>
                            <td style="padding: 8px; color: #111827;" title="${escapeHtml(gStage)}">
                                ${g.found_in_production ? `x${gMult}` : '—'}
                            </td>
                            <td style="padding: 8px; color: #111827;">
                                ${g.found_in_production ? subtotalBase.toFixed(2) : '—'}
                            </td>
                            <td style="padding: 8px; color: #047857; font-weight: 700;">
                                ${g.found_in_production ? totalFinal.toFixed(2) : '—'}
                            </td>
                        </tr>
                        <tr id="${detailsId}" style="display: none; background: #FAFAFA;">
                            <td colspan="7" style="padding: 8px 12px;">
                                <div style="color: #111827;">${detailBlock}</div>
                            </td>
                        </tr>`;
                });

                // Encabezado económico global: base, multiplicador y etapa + fórmula efectiva por voto.
                // Todo viene de la preview; si no existe (archivo antiguo), usa fallbacks seguros.
                const headerMultiplier = Number(preview.multiplier ?? 1);
                const headerStageName  = preview.stageName || 'Sin etapa activa';
                const headerBase       = Number(preview.currentRate ?? 0);
                const headerFinalRate  = Number(preview.ratePerVoteFinal ?? (headerBase * headerMultiplier));
                const headerTotalBase  = Number(preview.summary.total_base ?? 0);

                elements.govImportPreview.style.display = 'block';
                elements.govImportPreview.innerHTML = `
                    <div class="admin-card" style="border-left: 4px solid #8B5CF6; background: #FFFFFF; color: #111827;">
                        <h4 style="color: #7C3AED; margin: 0 0 1rem;">Vista Previa de Importación</h4>
                        <p style="color: #111827;"><strong>Archivo exportado:</strong> ${escapeHtml(preview.exported_at.split('T')[0])}</p>
                        <p style="color: #111827;"><strong>Entorno origen:</strong> ${escapeHtml(preview.source_env)}</p>
                        <p style="color: #111827;"><strong>Tasa base (producción):</strong> ${headerBase.toFixed(2)} BLUE IOU</p>
                        <p style="color: #111827;">
                            <strong>Multiplicador vigente:</strong> x${headerMultiplier}
                            <span style="color: #6B7280;">(${escapeHtml(headerStageName)})</span>
                        </p>
                        <p style="color: #111827;">
                            <strong>Tasa final por voto:</strong>
                            ${headerBase.toFixed(2)} × ${headerMultiplier} = <strong>${headerFinalRate.toFixed(2)} BLUE IOU</strong>
                        </p>
                        <div style="overflow-x: auto; margin-top: 1rem;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem; color: #111827;">
                                <thead>
                                    <tr style="border-bottom: 2px solid #E5E7EB; text-align: left; color: #111827; background: #F9FAFB;">
                                        <th style="padding: 8px;">Guardián</th>
                                        <th style="padding: 8px;">Votos nuevos</th>
                                        <th style="padding: 8px;">Ya importados</th>
                                        <th style="padding: 8px;">Base/voto</th>
                                        <th style="padding: 8px;">Multiplicador</th>
                                        <th style="padding: 8px;">Subtotal base</th>
                                        <th style="padding: 8px;">Total (final)</th>
                                    </tr>
                                </thead>
                                <tbody>${guardiansHTML}</tbody>
                            </table>
                        </div>
                        <hr style="margin: 1rem 0; border-color: #E5E7EB;">
                        <p style="color: #111827;"><strong>Encontrados:</strong> ${Number(preview.summary.matched)} · <strong>No encontrados:</strong> ${Number(preview.summary.unmatched)}</p>
                        <p style="color: #111827;"><strong>Votos a procesar:</strong> ${Number(preview.summary.total_new_votes)} · <strong>Omitidos (ya importados):</strong> ${Number(preview.summary.total_skipped)}</p>
                        <p style="color: #111827;">
                            <strong>Subtotal base (sin multiplicar):</strong> ${headerTotalBase.toFixed(2)} BLUE IOU
                        </p>
                        <p style="font-size: 1.1rem; font-weight: 700; color: #047857; margin-top: 0.5rem;">
                            Total a acreditar (con multiplicador x${headerMultiplier}):
                            ${Number(preview.summary.total_amount).toFixed(2)} BLUE IOU
                        </p>
                        <p style="color: #6B7280; font-size: 0.8rem; margin-top: 0.5rem;">
                            El multiplicador se aplica al momento de procesar el pago. Si la etapa booster cambia
                            entre ahora y el procesamiento, el sistema abortará la operación y te pedirá revisar
                            la preview nuevamente (control maker-checker).
                        </p>
                    </div>`;

                // Persistir el multiplicador visto para el candado optimista preview↔process.
                pendingExpectedMultiplier = headerMultiplier;

                // Bind de los toggles "Ver votos" tras inyectar el HTML (sin inline onclick → evita XSS).
                elements.govImportPreview.querySelectorAll('.gov-imp-toggle').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        const id = btn.getAttribute('data-target');
                        const row = id ? document.getElementById(id) : null;
                        if (!row) return;
                        const isHidden = row.style.display === 'none' || row.style.display === '';
                        row.style.display = isHidden ? 'table-row' : 'none';
                        btn.textContent = isHidden ? 'Ocultar votos' : 'Ver votos';
                    });
                });

                if (preview.summary.total_new_votes > 0 && preview.summary.matched > 0 && preview.currentRate > 0) {
                    elements.govImportProcessBtn.style.display = 'inline-block';
                }

            } catch (error) {
                elements.govImportPreview.style.display = 'block';
                elements.govImportPreview.innerHTML = `
                    <div class="admin-card" style="border-left: 4px solid #DC2626; background: #FEF2F2;">
                        <h4 style="color: #DC2626; margin: 0 0 0.5rem;">Error de validación</h4>
                        <p>${escapeHtml(error.message)}</p>
                    </div>`;
            } finally {
                elements.govImportValidateBtn.disabled = false;
                elements.govImportValidateBtn.textContent = 'Validar Archivo';
            }
        });
    }

    if (elements.govImportProcessBtn) {
        elements.govImportProcessBtn.addEventListener('click', async () => {
            if (!pendingImportFileData) {
                showCustomAlert('No hay archivo validado. Valida primero.');
                return;
            }

            const confirmed = confirm(
                '¿Estás seguro de procesar esta importación?\n\n' +
                'Se acreditarán BLUE IOU REALES en las cuentas de producción de los guardianes. ' +
                'Se enviará un correo de confirmación a cada guardián afectado.\n\n' +
                'Esta acción no se puede deshacer.'
            );
            if (!confirmed) return;

            elements.govImportProcessBtn.disabled = true;
            elements.govImportProcessBtn.textContent = 'Procesando...';
            if (elements.govImportResult) elements.govImportResult.style.display = 'none';

            try {
                // Se envía el multiplicador visto en la preview: si cambió la etapa
                // booster antes del procesamiento, el backend responde 409 y la UI
                // fuerza a re-validar el archivo (evita pagar con una tasa distinta
                // de la que el admin autorizó visualmente).
                const result = await apiFetch('/api/admin/governance/demo-import-process', {
                    method: 'POST',
                    body: JSON.stringify({
                        fileData:           pendingImportFileData,
                        expectedMultiplier: pendingExpectedMultiplier,
                    }),
                });

                pendingImportFileData        = null;
                pendingExpectedMultiplier    = null;
                // Restaurar estado del botón ANTES de ocultarlo: si en el
                // futuro se vuelve a mostrar (por re-validación de otro archivo),
                // debe aparecer habilitado y con su texto original.
                elements.govImportProcessBtn.disabled    = false;
                elements.govImportProcessBtn.textContent = 'Confirmar y Procesar Pagos';
                elements.govImportProcessBtn.style.display = 'none';

                // Resumen visible: incluye multiplicador/etapa y tasa final por voto.
                const appliedMultiplier = Number(result.multiplier ?? 1);
                const appliedStage      = result.stageName || 'Sin etapa activa';
                const appliedFinalRate  = Number(result.finalRatePerVote ?? (Number(result.rateUsed || 0) * appliedMultiplier));

                elements.govImportResult.style.display = 'block';
                elements.govImportResult.innerHTML = `
                    <div class="admin-card" style="border-left: 4px solid #059669; background: #F0FDF4;">
                        <h4 style="color: #059669; margin: 0 0 0.5rem;">Importación completada</h4>
                        <p><strong>Votos procesados:</strong> ${Number(result.totalProcessed)}</p>
                        <p><strong>Omitidos:</strong> ${Number(result.totalSkipped)}</p>
                        <p><strong>Tasa base aplicada:</strong> ${Number(result.rateUsed).toFixed(2)} BLUE IOU</p>
                        <p><strong>Multiplicador aplicado:</strong> x${appliedMultiplier}
                            <span style="color: #6B7280;">(${escapeHtml(appliedStage)})</span>
                        </p>
                        <p><strong>Tasa final por voto:</strong> ${appliedFinalRate.toFixed(2)} BLUE IOU</p>
                        <p><strong>Guardianes notificados:</strong> ${Number(result.guardiansAffected)}</p>
                    </div>`;

                loadGovRewardsSection();
            } catch (error) {
                // Detecta el candado de multiplicador (código negociado con el backend)
                // para dar un mensaje útil y forzar re-validación del archivo.
                const isMultChanged =
                    error && (error.code === 'MULTIPLIER_CHANGED' ||
                              (typeof error.message === 'string' && error.message.includes('etapa booster cambió')));

                elements.govImportResult.style.display = 'block';
                elements.govImportResult.innerHTML = `
                    <div class="admin-card" style="border-left: 4px solid ${isMultChanged ? '#D97706' : '#DC2626'};
                         background: ${isMultChanged ? '#FFFBEB' : '#FEF2F2'};">
                        <h4 style="color: ${isMultChanged ? '#B45309' : '#DC2626'}; margin: 0 0 0.5rem;">
                            ${isMultChanged ? 'Etapa booster cambió — revalidar' : 'Error en la importación'}
                        </h4>
                        <p>${escapeHtml(error.message || 'Error desconocido')}</p>
                        ${isMultChanged
                            ? '<p style="color: #78350F;">Vuelve a pulsar <strong>Validar Archivo</strong> para ver la nueva tasa y autorizar el pago con el multiplicador vigente.</p>'
                            : ''}
                    </div>`;

                if (isMultChanged) {
                    // Se invalida el estado: obligamos al admin a re-validar.
                    pendingImportFileData      = null;
                    pendingExpectedMultiplier  = null;
                    elements.govImportProcessBtn.style.display = 'none';
                }

                elements.govImportProcessBtn.disabled = false;
                elements.govImportProcessBtn.textContent = 'Confirmar y Procesar Pagos';
            }
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // KYC COMPLIANCE — Verificación de Identidad On-Chain
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Inicializa la sección KYC: registra los event listeners una sola vez.
     * Se llama cada vez que el admin navega a la sección KYC.
     */
    function initKycSection() {
        const checkBtn = document.getElementById('kycCheckBtn');
        const approveBtn = document.getElementById('kycApproveBtn');
        const revokeBtn = document.getElementById('kycRevokeBtn');
        const usernameInput = document.getElementById('kycUsernameInput');

        // Evitar registrar listeners duplicados usando un flag en el DOM.
        if (checkBtn && !checkBtn._kycListenerAttached) {
            checkBtn._kycListenerAttached = true;

            // Consultar estado KYC al hacer clic en "Consultar".
            checkBtn.addEventListener('click', () => {
                const username = usernameInput?.value?.trim();
                if (!username) {
                    showCustomAlert('Ingresa un nombre de usuario para consultar.');
                    return;
                }
                kycCheckUser(username);
            });

            // Permitir buscar presionando Enter en el campo de texto.
            usernameInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    checkBtn.click();
                }
            });
        }

        // Botón "Aprobar KYC": Envía kycStatus=true al backend.
        if (approveBtn && !approveBtn._kycListenerAttached) {
            approveBtn._kycListenerAttached = true;
            approveBtn.addEventListener('click', () => {
                const username = document.getElementById('kycResultUsername')?.textContent;
                if (!username) return;
                showCustomConfirm(
                    `¿Estás seguro de APROBAR el KYC para "${username}"? Esta acción se registrará en el Smart Contract y en el log de auditoría.`,
                    () => kycSetStatus(username, true)
                );
            });
        }

        // Botón "Revocar KYC": Envía kycStatus=false al backend.
        if (revokeBtn && !revokeBtn._kycListenerAttached) {
            revokeBtn._kycListenerAttached = true;
            revokeBtn.addEventListener('click', () => {
                const username = document.getElementById('kycResultUsername')?.textContent;
                if (!username) return;
                showCustomConfirm(
                    `⚠️ ¿Estás seguro de REVOCAR el KYC para "${username}"? El usuario NO podrá crear publicaciones que impliquen pagos.`,
                    () => kycSetStatus(username, false)
                );
            });
        }
    }

    /**
     * Consulta el estado KYC de un usuario: busca su wallet en la DB
     * y luego consulta el Smart Contract para ver si tiene KYC.
     * @param {string} username - El nombre de usuario a consultar.
     */
    async function kycCheckUser(username) {
        const resultPanel = document.getElementById('kycStatusResult');
        const operationResult = document.getElementById('kycOperationResult');

        // Ocultar resultados anteriores para evitar confusión visual.
        if (resultPanel) resultPanel.style.display = 'none';
        if (operationResult) operationResult.style.display = 'none';

        try {
            // ── PASO 1: Buscar al usuario por username para obtener su userId ──
            // El admin escribe el username (dato humano), pero internamente
            // usamos el userId (INTEGER PK) para las operaciones de API.
            // Esto sigue la buena práctica de usar IDs inmutables e indexados.
            const users = await apiFetch(`/api/admin/users?search=${encodeURIComponent(username)}`);
            const user = Array.isArray(users) ? users.find(u => u.username === username) : null;

            // Validar que el usuario exista en la base de datos.
            if (!user) {
                showCustomAlert(`Usuario "${escapeHtml(username)}" no encontrado.`);
                return;
            }

            // Mostrar nombre de usuario inmediatamente mientras consultamos la blockchain.
            document.getElementById('kycResultUsername').textContent = user.username;
            document.getElementById('kycResultWallet').textContent = user.web3_wallet_address
                ? `Wallet: ${user.web3_wallet_address}`
                : 'Sin billetera Web3 registrada';
            // Indicador visual de "cargando" mientras se consulta la blockchain.
            document.getElementById('kycResultStatus').textContent = '⏳ Consultando blockchain...';
            document.getElementById('kycResultStatus').style.color = '#F59E0B';
            document.getElementById('kycActions').style.display = 'none';
            resultPanel.style.display = 'block';

            // ── PASO 2: Consultar estado KYC real via el endpoint dedicado ──
            // Usamos el userId (INTEGER PK) en la URL, no el username.
            // El endpoint consulta directamente la blockchain Y la DB, y
            // devuelve ambos estados + flag de sincronización.
            const kycData = await apiFetch(`/api/admin/users/${user.id}/kyc-status`);

            // ── PASO 3: Renderizar el resultado según la respuesta ──────────
            const statusEl = document.getElementById('kycResultStatus');
            const actionsEl = document.getElementById('kycActions');

            // Actualizar la wallet mostrada (por si el endpoint devolvió más info).
            document.getElementById('kycResultWallet').textContent = kycData.walletAddress
                ? `Wallet: ${kycData.walletAddress}`
                : 'Sin billetera Web3 registrada';

            // CASO 1: El usuario no tiene billetera → no se puede verificar KYC.
            if (!kycData.walletAddress) {
                statusEl.textContent = 'N/A — Sin billetera Web3';
                statusEl.style.color = '#667085';
                actionsEl.style.display = 'none';
                return;
            }

            // CASO 2: La blockchain no respondió → mostramos el estado de la DB
            // con advertencia visual para que el admin sepa que es un dato cached.
            if (!kycData.blockchainQuerySuccess) {
                const dbStatus = kycData.kycInDatabase ? '✅ VERIFICADO (caché DB)' : '❌ NO VERIFICADO (caché DB)';
                statusEl.textContent = `⚠️ ${dbStatus}`;
                statusEl.style.color = '#F59E0B';
                // Mostrar botones de acción por si el admin quiere forzar un cambio.
                actionsEl.style.display = 'flex';
                return;
            }

            // CASO 3: La blockchain respondió exitosamente → mostramos el estado real.
            if (kycData.kycOnChain === true) {
                statusEl.textContent = '✅ VERIFICADO ON-CHAIN';
                statusEl.style.color = '#059669';
            } else {
                statusEl.textContent = '❌ NO VERIFICADO ON-CHAIN';
                statusEl.style.color = '#DC2626';
            }

            // Si hubo auto-sincronización, informar al admin.
            if (kycData.message && kycData.message.includes('discrepancia')) {
                const syncNotice = document.createElement('p');
                syncNotice.style.cssText = 'color: #F59E0B; font-size: 12px; margin: 4px 0 0; font-style: italic;';
                syncNotice.textContent = '⚡ ' + kycData.message;
                statusEl.parentNode.insertBefore(syncNotice, statusEl.nextSibling);
            }

            // Mostrar botones de Aprobar/Revocar para que el admin pueda cambiar el estado.
            actionsEl.style.display = 'flex';

        } catch (error) {
            // Error de red o del servidor → mostrar alerta al admin.
            showCustomAlert(`Error al consultar usuario: ${error.message}`);
        }
    }

    /**
     * Envía la solicitud para aprobar o revocar el KYC de un usuario.
     * Llama al endpoint POST /api/governance/kyc.
     * @param {string} username - El nombre de usuario.
     * @param {boolean} kycStatus - true para aprobar, false para revocar.
     */
    async function kycSetStatus(username, kycStatus) {
        const operationResult = document.getElementById('kycOperationResult');
        const approveBtn = document.getElementById('kycApproveBtn');
        const revokeBtn = document.getElementById('kycRevokeBtn');

        // Deshabilitar botones durante la operación para evitar doble clic.
        if (approveBtn) approveBtn.disabled = true;
        if (revokeBtn) revokeBtn.disabled = true;

        try {
            const result = await apiFetch('/api/governance/kyc', {
                method: 'POST',
                body: JSON.stringify({ username, kycStatus })
            });

            // Mostrar resultado exitoso.
            operationResult.style.display = 'block';
            operationResult.style.background = 'rgba(5, 150, 105, 0.1)';
            operationResult.style.border = '1px solid #059669';
            operationResult.innerHTML = `
                <p style="color: #059669; font-weight: 700; margin: 0 0 0.5rem;">✅ ${escapeHtml(result.message)}</p>
                <p style="color: #667085; font-size: 13px; margin: 0;">TX Hash: ${escapeHtml(result.txHash || 'Sin cambios necesarios')}</p>
            `;

            // Actualizar el estado visual.
            const statusEl = document.getElementById('kycResultStatus');
            if (statusEl) {
                statusEl.textContent = kycStatus ? '✅ VERIFICADO' : '❌ NO VERIFICADO';
                statusEl.style.color = kycStatus ? '#059669' : '#DC2626';
            }

        } catch (error) {
            // Mostrar error.
            operationResult.style.display = 'block';
            operationResult.style.background = 'rgba(220, 38, 38, 0.1)';
            operationResult.style.border = '1px solid #DC2626';
            operationResult.innerHTML = `
                <p style="color: #DC2626; font-weight: 700; margin: 0;">❌ Error: ${escapeHtml(error.message)}</p>
            `;
        } finally {
            // Re-habilitar botones.
            if (approveBtn) approveBtn.disabled = false;
            if (revokeBtn) revokeBtn.disabled = false;
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // GESTIÓN DE EQUIPO — Invitaciones para Administradores (Superadmin)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Consulta el perfil de administrador para ajustar la visualización de privilegios.
     * Solo si el rol es 'superadmin', se mostrará la sección de Equipo en la barra lateral.
     */
    async function checkAdminProfile() {
        try {
            // Realizar fetch al perfil administrativo actual
            const profile = await apiFetch('/api/admin/profile');
            const sidebarTeamLi = document.getElementById('sidebarTeamLi');
            
            // Validar rol de superadmin para inyectar/mostrar pestaña de equipo
            if (sidebarTeamLi) {
                if (profile.role === 'superadmin') {
                    sidebarTeamLi.style.display = 'block';
                } else {
                    sidebarTeamLi.style.display = 'none';
                }
            }
            
            // Sincronizar el nombre de usuario de localStorage con el del token oficial
            if (profile.username) {
                localStorage.setItem('admin_username', profile.username);
                renderConnectedUser();
            }
        } catch (err) {
            console.error("Error al obtener perfil administrativo de control:", err);
            // El backend retorna 401 si no está autenticado, lo que maneja apiFetch
        }
    }

    /**
     * Inicializa los listeners de formulario para la sección del equipo.
     * Se asegura de registrar la delegación del botón de submit una única vez.
     */
    function initTeamSection() {
        const form = document.getElementById('inviteAdminForm');
        if (form && !form._teamListenerAttached) {
            form._teamListenerAttached = true;
            
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const emailInput = document.getElementById('inviteEmailInput');
                const roleSelect = document.getElementById('inviteRoleSelect');
                const submitBtn = document.getElementById('sendInviteBtn');
                
                const email = emailInput?.value?.trim();
                const role = roleSelect?.value;
                
                if (!email || !role) {
                    showCustomAlert("Por favor, introduce un email y selecciona un rol.");
                    return;
                }

                // Evitar doble submit deshabilitando el botón de acción
                if (submitBtn) submitBtn.disabled = true;

                try {
                    const result = await apiFetch('/api/admin/invitations', {
                        method: 'POST',
                        body: JSON.stringify({ email, role })
                    });
                    
                    showCustomAlert(result.message || "Invitación de administrador enviada correctamente.");
                    if (emailInput) emailInput.value = '';
                    
                    // Recargar el listado de invitaciones para reflejar el estado pendiente
                    loadInvitationsList();
                } catch (err) {
                    showCustomAlert(err.message || "Error al generar la invitación.");
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }
    }

    /**
     * Carga las invitaciones administrativas del backend y las plasma en la tabla.
     */
    async function loadInvitationsList() {
        const container = document.getElementById('invitations-table-container');
        if (!container) return;
        
        container.innerHTML = '<div class="loading-spinner"></div>';
        
        try {
            const list = await apiFetch('/api/admin/invitations');
            
            if (!list || list.length === 0) {
                container.innerHTML = '<p style="text-align:center; color:#94A3B8; padding:20px;">No hay invitaciones registradas en la base de datos.</p>';
                return;
            }
            
            let html = `
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Rol</th>
                            <th>Creado Por</th>
                            <th>Fecha Envío</th>
                            <th>Expiración</th>
                            <th>Estado</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            list.forEach(row => {
                let statusText = 'Pendiente';
                let statusStyle = 'background: rgba(245, 158, 11, 0.15); color: #F59E0B; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;';
                let actionBtnHtml = '';
                
                if (row.used_at) {
                    statusText = 'Reclamada';
                    statusStyle = 'background: rgba(16, 185, 129, 0.15); color: #10B981; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;';
                    actionBtnHtml = '<span style="color:#64748B;">—</span>';
                } else {
                    if (row.is_expired) {
                        statusText = 'Expirada';
                        statusStyle = 'background: rgba(239, 68, 68, 0.15); color: #EF4444; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;';
                    }
                    actionBtnHtml = `
                        <button type="button" class="btn-revoke-invite" data-email="${escapeHtml(row.email)}" style="background:none; border:none; color:#EF4444; cursor:pointer; font-weight:bold; font-size:12px; text-decoration:underline; padding:0;">
                            Revocar
                        </button>
                    `;
                }
                
                const createdStr = new Date(row.created_at).toLocaleString('es-ES');
                const expiresStr = new Date(row.expires_at).toLocaleString('es-ES');
                
                html += `
                    <tr>
                        <td class="username-cell">${escapeHtml(row.email)}</td>
                        <td style="text-transform: capitalize;">${escapeHtml(row.role)}</td>
                        <td>${escapeHtml(row.created_by)}</td>
                        <td>${createdStr}</td>
                        <td>${expiresStr}</td>
                        <td><span style="${statusStyle}">${statusText}</span></td>
                        <td>${actionBtnHtml}</td>
                    </tr>
                `;
            });
            
            html += `
                    </tbody>
                </table>
            `;
            
            container.innerHTML = html;
            
            // Registrar event listener para el botón de revocación (Event Delegation)
            // Se asegura de asociar el listener una sola vez por contenedor usando dataset.
            if (!container.dataset.listenerRegistered) {
                container.dataset.listenerRegistered = 'true';
                container.addEventListener('click', async (e) => {
                    const btn = e.target.closest('.btn-revoke-invite');
                    if (btn) {
                        const email = btn.dataset.email;
                        if (!email) return;
                        
                        const confirmRevoke = confirm(`¿Estás seguro de que deseas revocar y anular permanentemente la invitación para ${email}? Esta acción es irreversible.`);
                        if (!confirmRevoke) return;
                        
                        try {
                            btn.disabled = true;
                            const originalText = btn.innerText;
                            btn.innerText = "Revocando...";
                            
                            const result = await apiFetch('/api/admin/invitations', {
                                method: 'DELETE',
                                body: JSON.stringify({ email })
                            });
                            
                            showCustomAlert(result.message || `Invitación de ${email} revocada con éxito.`);
                            loadInvitationsList();
                        } catch (err) {
                            showCustomAlert(err.message || "Error al revocar la invitación.");
                            btn.disabled = false;
                            btn.innerText = "Revocar";
                        }
                    }
                });
            }
            
        } catch (err) {
            container.innerHTML = `<p class="error-message">Error al cargar la tabla de invitaciones: ${escapeHtml(err.message)}</p>`;
        }
    }

    /**
     * Carga los administradores activos en el sistema y los plasma en la tabla.
     * Permite suspender o reactivar accesos del equipo administrativo.
     */
    async function loadActiveAdminsList() {
        const container = document.getElementById('active-admins-table-container');
        if (!container) return;
        
        container.innerHTML = '<div class="loading-spinner"></div>';
        
        try {
            const list = await apiFetch('/api/admin/team');
            
            if (!list || list.length === 0) {
                container.innerHTML = '<p style="text-align:center; color:#94A3B8; padding:20px;">No hay administradores registrados.</p>';
                return;
            }
            
            let html = `
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Nombre Usuario</th>
                            <th>Rol</th>
                            <th>Creado El</th>
                            <th>Última Conexión</th>
                            <th>Estado</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            const currentUser = localStorage.getItem('admin_username') || '';
            const systemAdmin = 'admin'; // Cuenta protegida del sistema
            
            list.forEach(row => {
                let statusText = 'Activo';
                let statusStyle = 'background: rgba(16, 185, 129, 0.15); color: #10B981; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;';
                let actionBtnHtml = '';
                
                const isSelf = row.username.toLowerCase() === currentUser.toLowerCase();
                const isSystemAdmin = row.username.toLowerCase() === systemAdmin;
                
                if (row.account_status === 'suspended') {
                    statusText = 'Suspendido';
                    statusStyle = 'background: rgba(239, 68, 68, 0.15); color: #EF4444; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;';
                }
                
                if (isSelf || isSystemAdmin) {
                    actionBtnHtml = '<span style="color:#64748B;">Protegido</span>';
                } else {
                    if (row.account_status === 'suspended') {
                        actionBtnHtml = `
                            <button type="button" class="btn-toggle-admin-status" data-id="${row.id}" data-username="${escapeHtml(row.username)}" data-target-status="active" style="background:none; border:none; color:#10B981; cursor:pointer; font-weight:bold; font-size:12px; text-decoration:underline; padding:0;">
                                Activar
                            </button>
                        `;
                    } else {
                        actionBtnHtml = `
                            <button type="button" class="btn-toggle-admin-status" data-id="${row.id}" data-username="${escapeHtml(row.username)}" data-target-status="suspended" style="background:none; border:none; color:#EF4444; cursor:pointer; font-weight:bold; font-size:12px; text-decoration:underline; padding:0;">
                                Suspender
                            </button>
                        `;
                    }
                }
                
                const createdStr = row.created_at ? new Date(row.created_at).toLocaleString('es-ES') : 'N/A';
                const lastLoginStr = row.last_login ? new Date(row.last_login).toLocaleString('es-ES') : 'Nunca';
                
                html += `
                    <tr>
                        <td class="username-cell">${escapeHtml(row.username)}</td>
                        <td style="text-transform: capitalize;">${escapeHtml(row.role)}</td>
                        <td>${createdStr}</td>
                        <td>${lastLoginStr}</td>
                        <td><span style="${statusStyle}">${statusText}</span></td>
                        <td>${actionBtnHtml}</td>
                    </tr>
                `;
            });
            
            html += `
                    </tbody>
                </table>
            `;
            
            container.innerHTML = html;
            
            // Event listener único para suspender/activar usando event delegation
            if (!container.dataset.listenerRegistered) {
                container.dataset.listenerRegistered = 'true';
                container.addEventListener('click', async (e) => {
                    const btn = e.target.closest('.btn-toggle-admin-status');
                    if (btn) {
                        const adminId = btn.dataset.id;
                        const username = btn.dataset.username;
                        const targetStatus = btn.dataset.targetStatus;
                        
                        if (!adminId || !targetStatus) return;
                        
                        const actionWord = targetStatus === 'suspended' ? 'SUSPENDER' : 'ACTIVAR';
                        const confirmAction = confirm(`¿Estás seguro de que deseas ${actionWord} al administrador "${username}"?`);
                        if (!confirmAction) return;
                        
                        try {
                            btn.disabled = true;
                            btn.innerText = targetStatus === 'suspended' ? "Suspendiendo..." : "Activando...";
                            
                            const result = await apiFetch(`/api/admin/team/${adminId}/status`, {
                                method: 'POST',
                                body: JSON.stringify({ status: targetStatus })
                            });
                            
                            showCustomAlert(result.message || `Estado de ${username} actualizado con éxito.`);
                            loadActiveAdminsList();
                        } catch (err) {
                            showCustomAlert(err.message || "Error al actualizar el estado del administrador.");
                            btn.disabled = false;
                            btn.innerText = targetStatus === 'suspended' ? "Suspender" : "Activar";
                        }
                    }
                });
            }
            
        } catch (err) {
            container.innerHTML = `<p class="error-message">Error al cargar el equipo administrativo: ${escapeHtml(err.message)}</p>`;
        }
    }

});
