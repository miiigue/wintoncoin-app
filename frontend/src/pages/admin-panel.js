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
        // -- DANGER ZONE --
        resetDatabaseBtn: document.getElementById('resetDatabaseBtn'),
        // --- REFERIDOS ---
        referralsSettingsContainer: document.getElementById('referrals-settings-container'),
        referralsLogContainer: document.getElementById('referrals-log-container'),
        // --- IMPULSORES ---
        boosterSection: document.getElementById('boosters-section'),
        boostersSettingsContainer: document.getElementById('boosters-settings-container'),
        boostersDashboardStats: document.getElementById('boosters-dashboard-stats'),
        boostersListContainer: document.getElementById('boosters-list-container')
    };

    // --- Inicialización ---
    let platformPublicationsCache = [];
    let platformEditId = null;
    setupEventListeners();
    showSection('dashboard');
    refreshPlatformPendingBadge();
    setInterval(refreshPlatformPendingBadge, 30000);

    // --- Lógica de la Interfaz ---
    function setupEventListeners() {
        elements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = link.dataset.section;
                showSection(sectionId);
            });
        });

        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await fetch(`${API_URL}/api/admin/logout`, { method: 'POST', credentials: 'include' });
                } catch (err) {
                    console.error("Error al cerrar sesión", err);
                }
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

        const repeatCheckbox = document.getElementById('platformAllowRepeatParticipation');
        if (repeatCheckbox && elements.platformRepeatLimitWrapper && elements.platformRepeatCooldownWrapper) {
            const updateRepeatVisibility = () => {
                elements.platformRepeatLimitWrapper.style.display = repeatCheckbox.checked ? 'flex' : 'none';
                elements.platformRepeatCooldownWrapper.style.display = repeatCheckbox.checked ? 'flex' : 'none';
                if (!repeatCheckbox.checked && elements.platformRepeatLimit) {
                    elements.platformRepeatLimit.value = '2';
                }
                if (!repeatCheckbox.checked) {
                    if (elements.platformRepeatCooldownDays) elements.platformRepeatCooldownDays.value = '1';
                    if (elements.platformRepeatCooldownHours) elements.platformRepeatCooldownHours.value = '0';
                    if (elements.platformRepeatCooldownMinutes) elements.platformRepeatCooldownMinutes.value = '0';
                }
            };
            repeatCheckbox.addEventListener('change', updateRepeatVisibility);
            updateRepeatVisibility();
        }

        if (elements.platformCancelEditBtn) {
            elements.platformCancelEditBtn.addEventListener('click', resetPlatformEditForm);
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

                const label = document.createElement('label');
                label.setAttribute('for', `platformStep${nextIndex}`);
                label.textContent = `Paso ${nextIndex}`;

                const input = document.createElement('input');
                input.type = 'text';
                input.id = `platformStep${nextIndex}`;
                input.placeholder = `Describe el paso ${nextIndex}`;

                wrapper.appendChild(label);
                wrapper.appendChild(input);
                elements.platformStepInputs.appendChild(wrapper);

                if (elements.platformStepInputs.querySelectorAll('.admin-step-input').length >= maxSteps) {
                    elements.platformAddStepBtn.disabled = true;
                }
            });
        }

        if (elements.platformManagementList) {
            elements.platformManagementList.addEventListener('click', handlePlatformAction);
        }

        // -- DANGER ZONE --
        if (elements.resetDatabaseBtn) {
            elements.resetDatabaseBtn.addEventListener('click', handleResetDatabase);
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
                    showBoosterTab(tabId);
                });
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
        else if (sectionId === 'audit-log') loadAuditLog();
        else if (sectionId === 'database-management') {
            loadDatabaseStats();
            setTimeout(() => {
                setupDatabaseCleanupListeners();
            }, 200);
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
            case 'boosters-list':
                loadBoosterList();
                break;
            case 'boosters-payments':
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
            
            if (response.status === 401 || response.status === 403) {
                window.location.href = 'admin.html';
                throw new Error('Sesión expirada o no autorizada.');
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
            elements.debtorsTableContainer.innerHTML = `<p class="error-message">Error al cargar los deudores: ${escapeHtml(error.message)}</p>`;
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
            renderPlatformPublicationsForManagement(publications);
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
        if (!elements.referralsSettingsContainer || !elements.referralsLogContainer) return;
        elements.referralsSettingsContainer.innerHTML = '<div class="loading-spinner"></div>';
        elements.referralsLogContainer.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const [settings, log] = await Promise.all([
                apiFetch('/api/admin/settings'),
                apiFetch('/api/admin/referrals/log')
            ]);
            
            renderReferralSettings(settings);
            renderReferralLog(log);

        } catch (error) {
            elements.referralsSettingsContainer.innerHTML = `<p class="error-message">Error al cargar la configuración de referidos: ${escapeHtml(error.message)}</p>`;
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
            renderBoosterList(boosters);
        } catch (error) {
            elements.boostersListContainer.innerHTML = `<p class="error-message">Error al cargar la lista de impulsores: ${escapeHtml(error.message)}</p>`;
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
            'debt_system_enabled': { title: 'Sistema de Deuda (Tokens RED)', description: 'Activa o desactiva la creación y gestión de deuda RED.' },
            'platform_commission_percentage': { title: 'Comisión de Plataforma (%)', description: 'Porcentaje de comisión para la plataforma (ej: 5 para 5%).' },
            'booster_system_enabled': { title: 'Sistema de Impulsores', description: 'Activa el sistema de Impulsores y su lógica de pagos mensuales.' },
            'referral_system_enabled': { title: 'Sistema de Referidos', description: 'Activa o desactiva el bono por registro con código de referido.' },
            'referral_reward_amount': { title: 'Recompensa por Referido (BLUE)', description: 'Cantidad de BLUE que ganan referente y referido.' },
            'referral_codes_expiry_date': { title: 'Vigencia hasta', description: 'Fecha de expiración de los códigos de referido (formato: YYYY-MM-DD).' },
            'welcome_bonus_enabled': { title: 'Bono de Bienvenida', description: 'Activa o desactiva el bono al registrarse sin código.' },
            'welcome_bonus_amount': { title: 'Monto del Bono de Bienvenida (BLUE)', description: 'Cantidad de BLUE que se otorga sin código de referido.' },
            'pre_launch_mode_enabled': { title: 'Modo Pre-Lanzamiento', description: 'Todas las ganancias van al Perfil de Impulsor, no se crea RED.' },
            'allow_request_publications': { title: 'Permitir Publicaciones de "Solicitud"', description: 'Los usuarios pueden publicar tareas para que otros las realicen.' },
            'allow_sell_publications': { title: 'Permitir Publicaciones de "Venta"', description: 'Los usuarios pueden publicar productos o servicios para vender.' },
            'allow_donation_publications': { title: 'Permitir Publicaciones de "Donación"', description: 'Los usuarios pueden solicitar donaciones.' },
            'allow_quick_sale_publications': { title: 'Permitir Publicaciones de "Venta Rápida"', description: 'Habilita el botón de Venta Rápida para transacciones exprés.' }
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
                if (s.setting_key.endsWith('_amount') || s.setting_key.includes('percentage')) return getSettingHTML(s, 'number');
                return ''; 
            }).join('');

            const timeSettingsGrouped = {
                debt_cycle: { label: 'Duración del Ciclo de Deuda RED', description: 'Define el período de tiempo para esta funcionalidad.', settings: [] },
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
        const referralKeys = ['referral_system_enabled', 'referral_reward_amount', 'referral_codes_expiry_date', 'welcome_bonus_enabled', 'welcome_bonus_amount'];
        const referralSettings = allSettings.filter(s => referralKeys.includes(s.setting_key));
        
        const container = document.getElementById('referrals-settings-container');
        if (container) {
            container.innerHTML = referralSettings.map(s => {
                if (s.setting_key.endsWith('_enabled')) return getSettingHTML(s, 'switch');
                if (s.setting_key.endsWith('_amount')) return getSettingHTML(s, 'number');
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

    function renderBoosterSettings(appSettings, boosterLevels) {
        const container = elements.boostersSettingsContainer;
        if (!container) return;
        container.innerHTML = ''; 

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

        container.innerHTML += '<hr class="admin-divider">';

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

        container.querySelectorAll('#booster-levels-table input, #booster-levels-table textarea').forEach(input => {
            input.addEventListener('change', handleBoosterLevelChange);
        });

        const chk = container.querySelector('input[type="checkbox"]');
        if(chk) chk.addEventListener('change', handleSettingChange);
    }

    function renderBoosterDashboard(stats) {
        if (!elements.boostersDashboardStats) return;
        elements.boostersDashboardStats.innerHTML = `
            <div class="stat-card">
                <h4>Impulsores Totales</h4>
                <p class="stat-value">${escapeHtml(stats.total_boosters || 0)}</p>
            </div>
            <div class="stat-card">
                <h4>Deuda Total (BLUE de Impulsores)</h4>
                <p class="stat-value saldo-blue-text">${formatBalance(stats.total_booster_blue_debt)}</p>
            </div>
            <div class="stat-card">
                <h4>Total Pagado (BLUE)</h4>
                <p class="stat-value saldo-blue-text">${formatBalance(stats.total_blue_paid_out)}</p>
            </div>
            <div class="stat-card">
                <h4>Pagos Mensuales Realizados</h4>
                <p class="stat-value">${escapeHtml(stats.total_payments_made || 0)}</p>
            </div>
        `;
    }

    function renderBoosterList(boosters) {
        if (!elements.boostersListContainer) return;
        if (!boosters || boosters.length === 0) {
            elements.boostersListContainer.innerHTML = '<p class="empty-message">Aún no hay usuarios impulsores en la plataforma.</p>';
            return;
        }

        const tableHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Nivel de Impulsor</th>
                        <th>Total BLUE de Impulsor</th>
                    </tr>
                </thead>
                <tbody>
                    ${boosters.map(booster => `
                        <tr>
                            <td class="username-cell">
                                <a href="profile.html?user=${escapeHtml(booster.username)}" target="_blank">${escapeHtml(booster.username)}</a>
                            </td>
                            <td align="center">${escapeHtml(booster.booster_level)}</td>
                            <td class="saldo-blue-text">${formatBalance(booster.total_booster_blue)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        elements.boostersListContainer.innerHTML = tableHTML;
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

            const newStatus = action === 'activate' ? 'active' : action;

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
            showCustomAlert(`Error al guardar la configuración: ${error.message}`);
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
            showCustomAlert(`Error al guardar el nivel: ${error.message}`);
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

        const body = {
            title: document.getElementById('platformPubTitle').value,
            description: mergedDescription,
            cost: document.getElementById('platformPubCost').value,
            availableSlots: document.getElementById('platformPubSlots').value,
            isSellPost: document.querySelector('input[name="platformPubType"]:checked').value === 'sell',
            autoApprove: document.getElementById('platformAutoApprove').checked,
            allowRepeatParticipation: allowRepeat,
            maxRepeatPerUser: allowRepeat ? repeatLimit : 1,
            repeatCooldownDays: allowRepeat ? safeDays : 1,
            repeatCooldownHours: allowRepeat ? safeHours : 0,
            repeatCooldownMinutes: allowRepeat ? safeMinutes : 0,
            isBoosterTask: document.getElementById('platformIsBoosterTask').checked,
            targetUsername: targetUsername || null
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

    // --- DANGER ZONE ---
    function handleResetDatabase() {
        const sqlCommand = `
TRUNCATE TABLE 
    platform_commission_log, 
    ratings, 
    hidden_publications, 
    publication_acceptances, 
    transactions, 
    notifications, 
    blue_token_escrows, 
    red_token_debts, 
    publications 
RESTART IDENTITY CASCADE;

DELETE FROM users WHERE username != 'Plataforma WintonCoin';

UPDATE platform_wallet SET total_blue_commission_balance = 0.0000 WHERE id = 1;

UPDATE users SET 
    liquid_blue_balance = 100.0000, 
    escrow_blue_balance = 0.0000, 
    red_balance = 0.0000,
    average_rating = 0,
    ratings_count = 0
WHERE username = 'Plataforma WintonCoin';
        `.trim();

        showCustomConfirm(
            "¿Estás seguro de que quieres reiniciar la base de datos? Esta acción eliminará permanentemente todos los datos de usuarios, publicaciones y transacciones.",
            () => {
                showCustomConfirm(
                    "CONFIRMACIÓN FINAL: Esta acción no se puede deshacer. ¿Estás absolutamente seguro?",
                    () => {
                        showCustomAlert(`ACCIÓN MANUAL REQUERIDA:\n\n1. Ve al panel de tu base de datos en Render.\n2. Abre la pestaña 'Shell'.\n3. Copia y pega el siguiente comando completo y presiona Enter:\n\n${sqlCommand}`);
                    }
                );
            }
        );
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

    // --- Render Functions ---
    function renderDashboard(stats) {
        if (!elements.dashboardContainer) return;
        elements.dashboardContainer.innerHTML = `
            <div class="stat-card">
                <h4>Usuarios Totales</h4>
                <p class="stat-value">${escapeHtml(stats.totalUsers || 0)}</p>
            </div>
            <div class="stat-card">
                <h4>Publicaciones Activas</h4>
                <p class="stat-value">${escapeHtml(stats.activePublications || 0)}</p>
            </div>
            <div class="stat-card">
                <h4>BLUE en Circulación (Tokens Reales)</h4>
                <p class="stat-value saldo-blue-text">${formatBalance(stats.totalBlue)}</p>
            </div>
            <div class="stat-card">
                <h4>RED en Circulación (Deuda Total)</h4>
                <p class="stat-value saldo-red-text">${formatBalance(stats.totalRed)}</p>
            </div>
            <div class="stat-card">
                <h4>Comisiones Acumuladas</h4>
                <p class="stat-value saldo-blue-text">${formatBalance(stats.platformCommissionBalance)}</p>
            </div>
            <div class="stat-card">
                <h4>Fondos de Impulsores (Deuda Futura)</h4>
                <p class="stat-value saldo-escrow-text">${formatBalance(stats.totalBoosterFunds || 0)}</p>
            </div>
        `;
    }

    function renderDebtorsTable(debtors) {
        if (!elements.debtorsTableContainer) return;
        if (!debtors || debtors.length === 0) {
            elements.debtorsTableContainer.innerHTML = '<p class="empty-message">No hay deudores con pagos vencidos actualmente.</p>';
            return;
        }

        const tableHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Deuda Vencida Total (RED)</th>
                        <th>Nº de Deudas Vencidas</th>
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
        const totals = getPlatformPendingTotals(publications);
        updatePlatformPublicationsBadge(totals.totalPending);
        if (!publications || publications.length === 0) {
            if (elements.platformManagementList) {
                elements.platformManagementList.innerHTML = '<p class="empty-message">No hay publicaciones de la plataforma que requieran acción.</p>';
            }
            return;
        }
        const sortedPublications = [...publications].sort((a, b) => {
            const aCounts = getPlatformPendingCounts(a);
            const bCounts = getPlatformPendingCounts(b);
            if (bCounts.pendingApprovals !== aCounts.pendingApprovals) {
                return bCounts.pendingApprovals - aCounts.pendingApprovals;
            }
            return bCounts.totalPending - aCounts.totalPending;
        });

        if (elements.platformManagementList) {
            elements.platformManagementList.innerHTML = sortedPublications.map(pub => getPlatformManagementItemHTML(pub)).join('');
        }
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

        const participantsHTML = pub.participants && pub.participants.length > 0
            ? `<ul class="participants-list-admin">${pub.participants.map(p => getParticipantItemForManagementHTML(pub.id, p)).join('')}</ul>`
            : '<p class="no-participants" style="padding: 1rem; text-align: center; color: var(--admin-text-secondary);">Sin participantes por ahora.</p>';
    
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
        return Array.from(elements.platformStepInputs.querySelectorAll('input'))
            .map(input => input.value.trim())
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
        const { mainText, steps } = splitDescriptionWithSteps(pub.description);

        document.getElementById('platformPubTitle').value = pub.title || '';
        document.getElementById('platformPubDescription').value = mainText || '';
        document.getElementById('platformPubCost').value = pub.blue_cost || '';
        document.getElementById('platformPubSlots').value = pub.available_slots || 1;
        document.getElementById('platformAutoApprove').checked = !!pub.auto_approve;
        document.getElementById('platformAllowRepeatParticipation').checked = !!pub.allow_repeat_participation;
        document.getElementById('platformIsBoosterTask').checked = !!pub.is_booster_task;
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
            const normalizedMinutes = Number.isFinite(cooldownMinutes) && cooldownMinutes > 0 ? cooldownMinutes : 1440;
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

        populatePlatformSteps(steps);

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
            elements.platformRepeatCooldownDays.value = '1';
        }
        if (elements.platformRepeatCooldownHours) {
            elements.platformRepeatCooldownHours.value = '0';
        }
        if (elements.platformRepeatCooldownMinutes) {
            elements.platformRepeatCooldownMinutes.value = '0';
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

    function populatePlatformSteps(steps) {
        if (!elements.platformStepInputs) return;
        resetPlatformEditStepsOnly();
        steps.forEach((step, index) => {
            const position = index + 1;
            ensurePlatformStepInput(position);
            const input = document.getElementById(`platformStep${position}`);
            if (input) input.value = step;
        });
    }

    function resetPlatformEditStepsOnly() {
        if (!elements.platformStepInputs) return;
        const allStepInputs = elements.platformStepInputs.querySelectorAll('.admin-step-input');
        allStepInputs.forEach((item, index) => {
            if (index > 3) {
                item.remove();
            } else {
                const input = item.querySelector('input');
                if (input) input.value = '';
            }
        });
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

        const label = document.createElement('label');
        label.setAttribute('for', `platformStep${position}`);
        label.textContent = `Paso ${position}`;

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `platformStep${position}`;
        input.placeholder = `Describe el paso ${position}`;

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        elements.platformStepInputs.appendChild(wrapper);

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
            actionButton = `<button class="action-button-admin confirm" data-pub-id="${escapeHtml(pubId)}" data-action="confirm-payment" data-user="${escapeHtml(participant.acceptor_username)}">Confirmar Pago</button>`;
        }
    
        return `
            <li class="participant-item-admin">
                <div class="participant-info-admin">
                    <strong><a href="profile.html?user=${escapeHtml(participant.acceptor_username)}" target="_blank">${escapeHtml(participant.acceptor_username)}</a></strong>
                    <span class="rating-display">${ratingHTML}</span>
                    ${acceptedAtHTML}
                </div>
                <div class="participant-status-admin">
                    <span class="status-badge ${escapeHtml(participant.status)}">${escapeHtml(statusText)}</span>
                    ${actionButton}
                </div>
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
    }

    function getUserRowHTML(user) {
        const registrationDate = new Date(user.created_at).toLocaleDateString('es-ES', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        const ratingHTML = generateStarRating(user.average_rating, user.ratings_count);

        return `
            <tr data-user-id="${escapeHtml(user.id)}" data-username="${escapeHtml(user.username)}" data-status="${escapeHtml(user.status)}">
                <td class="username-cell">
                    <a href="profile.html?user=${escapeHtml(user.username)}" target="_blank">${escapeHtml(user.username)}</a>
                </td>
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
        const participantsHTML = `${pub.completed_count} / ${pub.participants_count}`;
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

    // --- Database Management ---
    function setupDatabaseCleanupListeners() {
        const cleanupTestDataBtn = document.getElementById('cleanup-test-data-btn');
        if (cleanupTestDataBtn) cleanupTestDataBtn.addEventListener('click', handleCleanupTestData);

        const cleanupInactiveUsersBtn = document.getElementById('cleanup-inactive-users-btn');
        if (cleanupInactiveUsersBtn) cleanupInactiveUsersBtn.addEventListener('click', handleCleanupInactiveUsers);

        const cleanupOldPublicationsBtn = document.getElementById('cleanup-old-publications-btn');
        if (cleanupOldPublicationsBtn) cleanupOldPublicationsBtn.addEventListener('click', handleCleanupOldPublications);

        const createBackupBtn = document.getElementById('create-backup-btn');
        if (createBackupBtn) createBackupBtn.addEventListener('click', handleCreateBackup);

        const refreshStatsBtn = document.getElementById('refresh-db-stats');
        if (refreshStatsBtn) refreshStatsBtn.addEventListener('click', handleRefreshStats);
    }

    function showDatabaseStatus(message, isError = false) {
        const statusContainer = document.getElementById('database-status');
        if (statusContainer) {
            statusContainer.innerHTML = `
                <div class="status-message ${isError ? 'status-error' : 'status-success'}">
                    ${escapeHtml(message)}
                </div>
            `;
            setTimeout(() => {
                statusContainer.innerHTML = '';
            }, 10000);
        }
    }

    async function handleCleanupTestData() {
        if (!confirm('¿Estás seguro de que quieres eliminar todos los datos de prueba? Esta acción no se puede deshacer.')) return;

        const btn = document.getElementById('cleanup-test-data-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Procesando...';
        btn.disabled = true;

        try {
            const response = await apiFetch('/api/admin/database/cleanup-test-data', { method: 'POST' });
            showDatabaseStatus(`✅ Limpieza exitosa: ${response.results.testUsersDeleted} usuarios de prueba y ${response.results.testPublicationsDeleted} publicaciones eliminadas.`);
            loadDatabaseStats();
        } catch (error) {
            showDatabaseStatus(`❌ Error: ${error.message}`, true);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    async function handleCleanupInactiveUsers() {
        const daysInput = document.getElementById('inactive-users-days');
        const days = parseInt(daysInput ? daysInput.value : 90);

        if (days < 30) {
            showDatabaseStatus('❌ Por seguridad, no se pueden eliminar usuarios con menos de 30 días de inactividad', true);
            return;
        }

        if (!confirm(`¿Estás seguro de que quieres eliminar usuarios inactivos por más de ${days} días? Esta acción no se puede deshacer.`)) return;

        const btn = document.getElementById('cleanup-inactive-users-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Procesando...';
        btn.disabled = true;

        try {
            const result = await apiFetch('/api/admin/database/cleanup-inactive-users', {
                method: 'POST',
                body: JSON.stringify({ daysInactive: days })
            });
            showDatabaseStatus(`✅ Limpieza exitosa: ${result.results.usersDeleted} usuarios inactivos eliminados.`);
            loadDatabaseStats();
        } catch (error) {
            showDatabaseStatus(`❌ Error: ${error.message}`, true);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    async function handleCleanupOldPublications() {
        const daysInput = document.getElementById('old-publications-days');
        const days = parseInt(daysInput ? daysInput.value : 180);

        if (days < 90) {
            showDatabaseStatus('❌ Por seguridad, no se pueden eliminar publicaciones con menos de 90 días de antigüedad', true);
            return;
        }

        if (!confirm(`¿Estás seguro de que quieres eliminar publicaciones completadas hace más de ${days} días? Esta acción no se puede deshacer.`)) return;

        const btn = document.getElementById('cleanup-old-publications-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Procesando...';
        btn.disabled = true;

        try {
            const result = await apiFetch('/api/admin/database/cleanup-old-publications', {
                method: 'POST',
                body: JSON.stringify({ daysOld: days })
            });
            showDatabaseStatus(`✅ Limpieza exitosa: ${result.results.publicationsDeleted} publicaciones antiguas eliminadas.`);
            loadDatabaseStats();
        } catch (error) {
            showDatabaseStatus(`❌ Error: ${error.message}`, true);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    async function handleCreateBackup() {
        const btn = document.getElementById('create-backup-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Creando...';
        btn.disabled = true;

        try {
            const result = await apiFetch('/api/admin/database/backup', { method: 'POST' });
            showDatabaseStatus(`✅ Backup creado exitosamente: ${result.filename}`);
        } catch (error) {
            showDatabaseStatus(`❌ Error: ${error.message}`, true);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    async function handleRefreshStats() {
        const btn = document.getElementById('refresh-db-stats');
        const originalText = btn.textContent;
        btn.textContent = '🔄 Actualizando...';
        btn.disabled = true;

        try {
            await loadDatabaseStats();
            showDatabaseStatus('✅ Estadísticas actualizadas correctamente');
        } catch (error) {
            showDatabaseStatus('❌ Error al actualizar las estadísticas', true);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    async function loadDatabaseStats() {
        const statsContainer = document.getElementById('database-stats-container');
        
        try {
            if (statsContainer) statsContainer.innerHTML = '<div class="loading-spinner"></div>';

            const stats = await apiFetch('/api/admin/database/stats');
            updateDatabaseStatsDisplay(stats);
        } catch (error) {
            console.error('Error al cargar estadísticas de base de datos:', error);
            if (statsContainer) statsContainer.innerHTML = '<p style="color: #e74c3c;">Error de conexión</p>';
        }
    }

    function updateDatabaseStatsDisplay(stats) {
        const statsContainer = document.getElementById('database-stats-container');
        if (!statsContainer) return;

        const statsHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-number">${escapeHtml(stats.total_users || '0')}</div>
                    <div class="stat-label">Usuarios Totales</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${escapeHtml(stats.test_users || '0')}</div>
                    <div class="stat-label">Usuarios de Prueba</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${escapeHtml(stats.inactive_users || '0')}</div>
                    <div class="stat-label">Usuarios Inactivos</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${escapeHtml(stats.total_publications || '0')}</div>
                    <div class="stat-label">Publicaciones Totales</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${escapeHtml(stats.old_publications || '0')}</div>
                    <div class="stat-label">Publicaciones Antiguas</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${escapeHtml(stats.total_transactions || '0')}</div>
                    <div class="stat-label">Transacciones</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${escapeHtml(stats.total_notifications || '0')}</div>
                    <div class="stat-label">Notificaciones</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${escapeHtml(stats.database_size || 'N/A')}</div>
                    <div class="stat-label">Tamaño de BD</div>
                </div>
            </div>
        `;
        
        statsContainer.innerHTML = statsHTML;
    }
});
