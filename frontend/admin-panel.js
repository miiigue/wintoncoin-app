document.addEventListener('DOMContentLoaded', () => {

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
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';
    const adminToken = localStorage.getItem('adminToken');

    if (!adminToken) {
        window.location.href = 'admin.html';
        return;
    }

    const elements = {
        navLinks: document.querySelectorAll('.nav-link'),
        sections: document.querySelectorAll('.admin-section'),
        logoutBtn: document.getElementById('adminLogoutBtn'),
        settingsContainer: document.getElementById('settings-switches'),
        phaseManagementContainer: document.getElementById('phase-management-switches'), // NUEVO
        dashboardContainer: document.getElementById('dashboard-stats'),
        usersTableContainer: document.getElementById('users-table-container'),
        userSearchInput: document.getElementById('userSearchInput'),
        userStatusFilter: document.getElementById('userStatusFilter'), // NUEVO
        debtorsTableContainer: document.getElementById('debtors-table-container'),
        publicationsTableContainer: document.getElementById('publications-table-container'),
        publicationSearchInput: document.getElementById('publicationSearchInput'),
        platformWalletStatsContainer: document.getElementById('platform-wallet-stats'),
        platformCommissionLogContainer: document.getElementById('platform-commission-log-container'),
        platformPublicationForm: document.getElementById('platformPublicationForm'),
        platformManagementList: document.getElementById('platform-management-list'),
        // -- DANGER ZONE (ELEMENTOS A ELIMINAR DESPUÉS DE USAR) --
        resetDatabaseBtn: document.getElementById('resetDatabaseBtn'),
        // --- NUEVOS ELEMENTOS PARA REFERIDOS ---
        referralsSettingsContainer: document.getElementById('referrals-settings-container'),
        referralsLogContainer: document.getElementById('referrals-log-container'),
        // --- NUEVOS ELEMENTOS PARA IMPULSORES ---
        boosterSection: document.getElementById('boosters-section'),
        boostersSettingsContainer: document.getElementById('boosters-settings-container'),
        boostersDashboardStats: document.getElementById('boosters-dashboard-stats'),
        boostersListContainer: document.getElementById('boosters-list-container')
    };

    // --- Inicialización ---
    setupEventListeners();
    showSection('dashboard');

    // --- Lógica de la Interfaz ---
    function setupEventListeners() {
        elements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = link.dataset.section;
                showSection(sectionId);
            });
        });

        elements.logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('adminToken');
            window.location.href = 'admin.html';
        });

        elements.settingsContainer.addEventListener('change', handleSettingChange);
        elements.phaseManagementContainer.addEventListener('change', handleSettingChange); // NUEVO
        elements.settingsContainer.addEventListener('keyup', (event) => {
            if (event.target.type === 'number') {
                handleSettingChange(event);
            }
        });

        let searchTimeout;
        elements.userSearchInput.addEventListener('keyup', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadUsers(elements.userSearchInput.value, elements.userStatusFilter.value);
            }, 300);
        });

        // --- NUEVO: Listener para el filtro de estado ---
        elements.userStatusFilter.addEventListener('change', () => {
            loadUsers(elements.userSearchInput.value, elements.userStatusFilter.value);
        });

        // --- REFACTORIZADO: Listener para las acciones de moderación de usuarios ---
        elements.usersTableContainer.addEventListener('click', handleUserAction);
        
        // --- NUEVO: Listener global para cerrar menús ---
        document.addEventListener('click', (e) => {
            // Si el clic no fue DENTRO de un contenedor de menú Y no fue en un botón de toggle, cierra todos los menús.
            if (!e.target.closest('.action-menu-container') && !e.target.closest('.menu-toggle')) {
                document.querySelectorAll('.action-menu.visible').forEach(menu => {
                    menu.classList.remove('visible');
                });
            }
        });

        let pubSearchTimeout;
        elements.publicationSearchInput.addEventListener('keyup', () => {
            clearTimeout(pubSearchTimeout);
            pubSearchTimeout = setTimeout(() => {
                loadPublications(elements.publicationSearchInput.value);
            }, 300);
        });

        elements.publicationsTableContainer.addEventListener('click', handlePublicationAction);
    
        if (elements.platformPublicationForm) {
            elements.platformPublicationForm.addEventListener('submit', handlePlatformPublicationSubmit);
        }

        if (elements.platformManagementList) {
            elements.platformManagementList.addEventListener('click', handlePlatformAction);
        }

        // -- DANGER ZONE (LÓGICA A ELIMINAR DESPUÉS DE USAR) --
        if (elements.resetDatabaseBtn) {
            elements.resetDatabaseBtn.addEventListener('click', handleResetDatabase);
        }

        // --- NUEVO: Listener para las pestañas de la sección de Impulsores ---
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

        document.getElementById(`${sectionId}-section`).classList.add('active-section');
        document.querySelector(`.nav-link[data-section="${sectionId}"]`).classList.add('active');

        if (sectionId === 'dashboard') loadDashboardData();
        else if (sectionId === 'settings') loadSettings();
        else if (sectionId === 'users') {
            loadUsers(); // Carga inicial sin filtros
        }
        else if (sectionId === 'debtors') loadDebtors();
        else if (sectionId === 'publications') loadPublications();
        else if (sectionId === 'platform-wallet') loadPlatformWalletData();
        else if (sectionId === 'platform-publications') {
            // Cargar ambas partes de la sección de plataforma
            loadPlatformManagementData();
        }
        else if (sectionId === 'referrals') {
            loadReferralsData();
        }
        else if (sectionId === 'boosters') {
            // Al entrar en la sección, mostramos la primera pestaña por defecto
            showBoosterTab('boosters-dashboard');
        }
        else if (sectionId === 'database-management') {
            loadDatabaseStats();
            // Reconfigurar los event listeners cuando se entra a la sección
            setTimeout(() => {
                setupDatabaseCleanupListeners();
            }, 200);
        }
        // No se necesita cargar datos para la zona de peligro, solo mostrarla.
    }

    // --- NUEVO: Lógica para manejar las pestañas de Impulsores ---
    function showBoosterTab(tabId) {
        if (!elements.boosterSection) return;

        // Ocultar todos los contenidos y desactivar todos los enlaces
        elements.boosterSection.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        elements.boosterSection.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));

        // Mostrar el contenido y activar el enlace de la pestaña seleccionada
        document.getElementById(`${tabId}-tab`).classList.add('active');
        document.querySelector(`.tab-link[data-tab="${tabId}"]`).classList.add('active');

        // Aquí cargaremos los datos específicos para cada pestaña
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
                // loadBoosterPaymentsLog();
                break;
        }
    }

    // --- Lógica de Datos (API Fetch, etc.) ---
    async function apiFetch(endpoint, options = {}) {
        const defaultOptions = {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
        };
        const response = await fetch(`${API_URL}${endpoint}`, { ...defaultOptions, ...options });
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('adminToken');
            window.location.href = 'admin.html';
            throw new Error('Autenticación fallida.');
        }
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error del servidor: ${response.status}`);
        }
        return response.json();
    }

    async function loadUsers(searchTerm = '', statusFilter = '') {
        elements.usersTableContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const users = await apiFetch(`/api/admin/users?search=${encodeURIComponent(searchTerm)}&status=${encodeURIComponent(statusFilter)}`);
            renderUsersTable(users);
        } catch (error) {
            elements.usersTableContainer.innerHTML = `<p class="error-message">Error al cargar los usuarios: ${error.message}</p>`;
        }
    }

    async function loadDebtors() {
        elements.debtorsTableContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const debtors = await apiFetch(`/api/admin/debtors`);
            renderDebtorsTable(debtors);
        } catch (error) {
            elements.debtorsTableContainer.innerHTML = `<p class="error-message">Error al cargar los deudores: ${error.message}</p>`;
        }
    }

    async function loadPublications(searchTerm = '') {
        elements.publicationsTableContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const publications = await apiFetch(`/api/admin/publications?search=${encodeURIComponent(searchTerm)}`);
            renderPublicationsTable(publications);
        } catch (error) {
            elements.publicationsTableContainer.innerHTML = `<p class="error-message">Error al cargar las publicaciones: ${error.message}</p>`;
        }
    }

    async function loadPlatformWalletData() {
        elements.platformWalletStatsContainer.innerHTML = '<div class="loading-spinner"></div>';
        elements.platformCommissionLogContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const [walletData, log] = await Promise.all([
                apiFetch('/api/admin/platform-wallet/balance'),
                apiFetch('/api/admin/platform-wallet/log')
            ]);
            renderPlatformWallet(walletData);
            renderCommissionLog(log);
        } catch (error) {
            elements.platformWalletStatsContainer.innerHTML = `<p class="error-message">Error al cargar datos de la billetera: ${error.message}</p>`;
            elements.platformCommissionLogContainer.innerHTML = '';
        }
    }
    
    async function loadPlatformManagementData() {
        if (!elements.platformManagementList) return;
        elements.platformManagementList.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const publications = await apiFetch('/api/admin/platform/publications-with-participants');
            renderPlatformPublicationsForManagement(publications);
        } catch (error) {
            elements.platformManagementList.innerHTML = `<p class="error-message">Error al cargar las publicaciones de la plataforma: ${error.message}</p>`;
        }
    }

    async function loadDashboardData() {
        elements.dashboardContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const stats = await apiFetch('/api/admin/dashboard-stats');
            renderDashboard(stats);
        } catch (error) {
            elements.dashboardContainer.innerHTML = `<p class="error-message">Error al cargar el dashboard: ${error.message}</p>`;
        }
    }

    async function loadSettings() {
        elements.settingsContainer.innerHTML = '<div class="loading-spinner"></div>';
        elements.phaseManagementContainer.innerHTML = '<div class="loading-spinner"></div>'; // NUEVO
        try {
            const settings = await apiFetch('/api/admin/settings');
            renderSettings(settings);
        } catch (error) {
            showCustomAlert(error.message);
        }
    }

    async function loadReferralsData() {
        elements.referralsSettingsContainer.innerHTML = '<div class="loading-spinner"></div>';
        elements.referralsLogContainer.innerHTML = '<div class="loading-spinner"></div>';

        try {
            // Reutilizamos la función de cargar todas las settings,
            // y la de renderizado se encargará de mostrar solo las de referidos.
            const [settings, log] = await Promise.all([
                apiFetch('/api/admin/settings'),
                apiFetch('/api/admin/referrals/log')
            ]);
            
            renderReferralSettings(settings);
            renderReferralLog(log);

        } catch (error) {
            elements.referralsSettingsContainer.innerHTML = `<p class="error-message">Error al cargar la configuración de referidos: ${error.message}</p>`;
            elements.referralsLogContainer.innerHTML = `<p class="error-message">Error al cargar el log de referidos: ${error.message}</p>`;
        }
    }

    // --- NUEVO: Carga de datos para el Dashboard de Impulsores ---
    async function loadBoosterDashboard() {
        elements.boostersDashboardStats.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const stats = await apiFetch('/api/admin/boosters/stats');
            renderBoosterDashboard(stats);
        } catch (error) {
            elements.boostersDashboardStats.innerHTML = `<p class="error-message">Error al cargar el dashboard de impulsores: ${error.message}</p>`;
        }
    }

    // --- NUEVO: Carga de la lista de Impulsores ---
    async function loadBoosterList() {
        elements.boostersListContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const boosters = await apiFetch('/api/admin/boosters/list');
            renderBoosterList(boosters);
        } catch (error) {
            elements.boostersListContainer.innerHTML = `<p class="error-message">Error al cargar la lista de impulsores: ${error.message}</p>`;
        }
    }

    // --- NUEVO: Carga de configuración de Impulsores ---
    async function loadBoosterSettings() {
        elements.boostersSettingsContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const [appSettings, boosterLevels] = await Promise.all([
                apiFetch('/api/admin/settings'),
                apiFetch('/api/admin/boosters/settings')
            ]);
            renderBoosterSettings(appSettings, boosterLevels);
        } catch (error) {
            elements.boostersSettingsContainer.innerHTML = `<p class="error-message">Error al cargar la configuración de impulsores: ${error.message}</p>`;
        }
    }

    // --- Lógica de Renderizado de Configuración (NUEVO) ---

    function getSettingTitleAndDescription(key) {
        const map = {
            'allow_new_registrations': { title: 'Permitir Nuevos Registros', description: 'Activa o desactiva esta característica para toda la plataforma.' },
            'public_profiles_enabled': { title: 'Perfiles Públicos', description: 'Permite que cualquiera vea los perfiles públicos de los usuarios.' },
            'debt_system_enabled': { title: 'Sistema de Deuda (Tokens RED)', description: 'Activa o desactiva la creación y gestión de deuda RED.' },
            'platform_commission_percentage': { title: 'Comisión de Plataforma (%)', description: 'Porcentaje de comisión para la plataforma (ej: 5 para 5%).' },
            'booster_system_enabled': { title: 'Sistema de Impulsores', description: 'Activa el sistema de Impulsores y su lógica de pagos mensuales.' },
            'referral_system_enabled': { title: 'Sistema de Referidos', description: 'Activa o desactiva el bono por registro con código de referido.' },
            'referral_reward_amount': { title: 'Recompensa por Referido (BLUE)', description: 'Cantidad de BLUE que ganan referente y referido.' },
            'referral_codes_expiry_date': { title: 'Vigencia hasta', description: 'Fecha de expiración de los códigos de referido (formato: YYYY-MM-DD). Después de esta fecha, los códigos no otorgarán recompensas.' },
            'welcome_bonus_enabled': { title: 'Bono de Bienvenida', description: 'Activa o desactiva el bono al registrarse sin código.' },
            'welcome_bonus_amount': { title: 'Monto del Bono de Bienvenida (BLUE)', description: 'Cantidad de BLUE que se otorga sin código de referido.' },
            // --- FASES ---
            'pre_launch_mode_enabled': { title: 'Modo Pre-Lanzamiento', description: 'Todas las ganancias van al Perfil de Impulsor, no se crea RED.' },
            'allow_request_publications': { title: 'Permitir Publicaciones de "Solicitud"', description: 'Los usuarios pueden publicar tareas para que otros las realicen.' },
            'allow_sell_publications': { title: 'Permitir Publicaciones de "Venta"', description: 'Los usuarios pueden publicar productos o servicios para vender.' },
            'allow_donation_publications': { title: 'Permitir Publicaciones de "Donación"', description: 'Los usuarios pueden solicitar donaciones.' },
            'allow_quick_sale_publications': { title: 'Permitir Publicaciones de "Venta Rápida"', description: 'Habilita el botón de Venta Rápida para transacciones exprés.' }
        };
        return map[key] || { title: key, description: 'Sin descripción.' };
    }

    function getSettingTitle(key) {
        // Esta función ahora es un proxy a la nueva función para mantener compatibilidad
        // con el código antiguo de impulsores y referidos sin tener que reescribirlo todo.
        const setting = getSettingTitleAndDescription(key);
        return setting.title;
    }

    function renderSettings(settings) {
        // --- Separar configuraciones por grupo ---
        const phaseSettings = settings.filter(s => ['pre_launch_mode_enabled', 'allow_request_publications', 'allow_sell_publications', 'allow_donation_publications', 'allow_quick_sale_publications'].includes(s.setting_key));
        const timeSettingsRaw = settings.filter(s => s.setting_key.startsWith('debt_cycle_') || s.setting_key.startsWith('blue_escrow_'));
        
        // Filtramos para obtener solo las configuraciones generales, excluyendo las de fases, tiempo y referidos.
        const referralKeys = [
            'referral_system_enabled', 'referral_reward_amount', 
            'welcome_bonus_enabled', 'welcome_bonus_amount',
            'referral_bonus_enabled', 'referral_bonus_amount' // <-- Añadimos las claves obsoletas
        ];
        const generalSettings = settings.filter(s => 
            !phaseSettings.includes(s) && 
            !timeSettingsRaw.includes(s) &&
            !referralKeys.includes(s.setting_key)
        );

        // --- Renderizar Configuración de Fases ---
        elements.phaseManagementContainer.innerHTML = phaseSettings.map(s => getSettingHTML(s, 'switch')).join('');

        // --- Renderizar Configuración General ---
        elements.settingsContainer.innerHTML = generalSettings.map(s => {
            if (s.setting_key.endsWith('_enabled') || s.setting_key.endsWith('registrations')) return getSettingHTML(s, 'switch');
            if (s.setting_key.endsWith('_amount') || s.setting_key.includes('percentage')) return getSettingHTML(s, 'number');
            return ''; // No renderizar otros por ahora
        }).join('');

        // --- Renderizar Configuración de Tiempo Agrupada ---
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
        
        // --- AGREGAR EVENT LISTENERS A LOS CONTROLES GENERADOS ---
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
        
        // --- AGREGAR EVENT LISTENERS A LOS CONTROLES DE FASE ---
        elements.phaseManagementContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', handleSettingChange);
        });
    }

    function getSettingHTML(setting, type) {
        const { title, description } = getSettingTitleAndDescription(setting.setting_key);
        let controlHTML = '';

        if (type === 'switch') {
            controlHTML = `
                <label class="switch">
                    <input type="checkbox" data-key="${setting.setting_key}" ${setting.setting_value === 'true' ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            `;
        } else if (type === 'number') {
            controlHTML = `
                <input type="number" class="admin-numeric-input" data-key="${setting.setting_key}" value="${parseFloat(setting.setting_value).toFixed(2)}" step="0.01" min="0">
            `;
        } else if (type === 'date') {
            controlHTML = `
                <input type="date" class="admin-date-input" data-key="${setting.setting_key}" value="${setting.setting_value || ''}">
            `;
        }

        return `
            <div class="setting-item">
                <div class="setting-item-info">
                    <h4>${title}</h4>
                    <p>${description}</p>
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
                    <h4>${group.label}</h4>
                    <p>${group.description}</p>
                </div>
                <div class="setting-item-control-group">
                    ${group.settings.map(setting => {
                        const unit = setting.setting_key.split('_').pop();
                        return `
                            <div class="numeric-group-item">
                                <label for="setting-${setting.setting_key}">${unit.charAt(0).toUpperCase() + unit.slice(1)}</label>
                                <input type="number" class="admin-numeric-input" id="setting-${setting.setting_key}" data-key="${setting.setting_key}" value="${setting.setting_value}" min="0">
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
            
            // --- AGREGAR EVENT LISTENERS A LOS CONTROLES GENERADOS ---
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

    // --- NUEVO: Renderizado de la configuración de Impulsores ---
    function renderBoosterSettings(appSettings, boosterLevels) {
        const container = elements.boostersSettingsContainer;
        container.innerHTML = ''; // Limpiar spinner

        // 1. Renderizar el interruptor general del sistema
        const systemEnabledSetting = appSettings.find(s => s.setting_key === 'booster_system_enabled');
        if (systemEnabledSetting) {
            const itemHTML = `
                <div class="setting-item">
                    <div class="setting-item-info">
                        <h4>${getSettingTitle(systemEnabledSetting.setting_key)}</h4>
                        <p>${systemEnabledSetting.description || 'Activa o desactiva el programa de impulsores y los pagos mensuales.'}</p>
                    </div>
                    <div class="setting-item-control">
                        <label class="switch">
                            <input type="checkbox" data-key="${systemEnabledSetting.setting_key}" ${systemEnabledSetting.setting_value === 'true' ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
            `;
            container.innerHTML += itemHTML;
        }

        container.innerHTML += '<hr class="admin-divider">';

        // 2. Renderizar la tabla de niveles
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
                            <tr data-level="${level.level}">
                                <td class="level-cell">${level.level}</td>
                                <td><input type="text" class="admin-text-input" data-field="name" value="${level.name}"></td>
                                <td><input type="number" class="admin-numeric-input" data-field="min_blue_required" value="${level.min_blue_required}" step="any"></td>
                                <td><textarea class="admin-textarea-input" data-field="description">${level.description || ''}</textarea></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML += tableHTML;

        // Añadir listeners para los cambios en la tabla
        container.querySelectorAll('#booster-levels-table input, #booster-levels-table textarea').forEach(input => {
            input.addEventListener('change', handleBoosterLevelChange);
        });

         // Listener para el interruptor
        container.querySelector('input[type="checkbox"]').addEventListener('change', handleSettingChange);
    }

    // --- NUEVO: Renderizado del Dashboard de Impulsores ---
    function renderBoosterDashboard(stats) {
        elements.boostersDashboardStats.innerHTML = `
            <div class="stat-card">
                <h4>Impulsores Totales</h4>
                <p class="stat-value">${stats.total_boosters || 0}</p>
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
                <p class="stat-value">${stats.total_payments_made || 0}</p>
            </div>
        `;
    }

    // --- NUEVO: Renderizado de la lista de Impulsores ---
    function renderBoosterList(boosters) {
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
                                <a href="profile.html?user=${booster.username}" target="_blank">${booster.username}</a>
                            </td>
                            <td align="center">${booster.booster_level}</td>
                            <td class="saldo-blue-text">${formatBalance(booster.total_booster_blue)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        elements.boostersListContainer.innerHTML = tableHTML;
    }

    // --- Handlers de Eventos ---
    let settingChangeTimeout;

    async function handleSettingChange(event) {
        const control = event.target;
        // Nos aseguramos de que el control tiene el dataset 'key' antes de proceder
        if (!control.dataset.key) return;

        const key = control.dataset.key;
        let value;

        if (control.type === 'checkbox') {
            value = control.checked.toString(); // "true" or "false"
        } else if (control.type === 'number') {
            value = control.value;
        } else if (control.type === 'date') {
            value = control.value;
            // Validar que la fecha sea válida
            if (value) {
                const dateObj = new Date(value);
                if (isNaN(dateObj.getTime())) {
                    showCustomAlert('Fecha inválida. Por favor, ingresa una fecha válida.');
                    // Recargar settings para revertir el cambio
                    loadSettings();
                    return;
                }
            }
        } else {
            return; // No-op for other types
        }
        
        // Usar un debounce para los inputs de número y fecha, para no enviar una petición en cada cambio
        if (control.type === 'number' || control.type === 'date') {
            clearTimeout(settingChangeTimeout);
            settingChangeTimeout = setTimeout(() => {
                updateSetting(key, value);
            }, 500); // Esperar 500ms después del último cambio
        } else {
            // Los checkboxes se actualizan al instante
            updateSetting(key, value);
        }
    }

    // --- REFACTORIZADO: Handler para las acciones de moderación de usuarios ---
    async function handleUserAction(event) {
        const toggleButton = event.target.closest('.menu-toggle');
        
        // Lógica para abrir/cerrar el menú
        if (toggleButton) {
            event.stopPropagation(); // Previene que el clic se propague al listener del documento y cierre el menú inmediatamente
            const menu = toggleButton.nextElementSibling;
            const isVisible = menu.classList.contains('visible');
            
            // Primero, cerramos todos los demás menús para que solo uno esté abierto a la vez.
            document.querySelectorAll('.action-menu.visible').forEach(m => {
                m.classList.remove('visible');
            });

            // Si el menú no estaba visible, lo mostramos.
            if (!isVisible) {
                menu.classList.add('visible');
            }
            return;
        }

        // Lógica para ejecutar una acción del menú (suspender, banear, etc.)
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

            // Evitar acciones redundantes
            if ((action === 'suspend' && currentStatus === 'suspended') ||
                (action === 'ban' && currentStatus === 'banned') ||
                (action === 'activate' && currentStatus === 'active')) {
                showCustomAlert(`El usuario ${username} ya está en ese estado.`);
                return;
            }

            const newStatus = action === 'activate' ? 'active' : action;

            showCustomConfirm(`¿Estás seguro de que quieres ${verb} al usuario "${username}"?`, async () => {
                try {
                    const result = await apiFetch(`/api/admin/users/${userId}/status`, {
                        method: 'POST',
                        body: JSON.stringify({ status: newStatus })
                    });
                    showCustomAlert(result.message || 'Acción completada con éxito.');
                    loadUsers(elements.userSearchInput.value, elements.userStatusFilter.value); // Recargar la tabla con filtros
                } catch (error) {
                    showCustomAlert(`Error durante la ${noun}: ${error.message}`);
                }
            });
        }
    }

    // --- NUEVO: Handler para cambios en la tabla de niveles ---
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

        // Usamos un debounce para no enviar peticiones en cada tecla
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
            // Opcional: mostrar una notificación sutil de "guardado". Por ahora, log en consola.
            console.log(`Setting '${key}' actualizado a '${value}'.`);
        } catch (error) {
            showCustomAlert(`Error al guardar la configuración: ${error.message}`);
            // Revertir el cambio en la UI si falla el guardado, recargando los settings.
            loadSettings();
        }
    }

    // --- NUEVO: Actualizar un nivel de impulsor específico ---
    async function updateBoosterLevel(body) {
        try {
            await apiFetch('/api/admin/boosters/settings', {
                method: 'POST',
                body: JSON.stringify(body)
            });
            console.log(`Nivel de impulsor ${body.level} actualizado.`);
        } catch (error) {
            showCustomAlert(`Error al guardar el nivel ${body.level}: ${error.message}`);
            // Recargar para revertir los cambios en la UI
            loadBoosterSettings();
        }
    }

    async function handlePublicationAction(event) {
        const deleteButton = event.target.closest('.action-button-admin.delete');
        if (deleteButton) {
            const pubId = deleteButton.dataset.pubId;
            const pubTitle = deleteButton.closest('tr').querySelector('.publication-title-cell').textContent;
            showCustomConfirm(`¿Seguro que quieres eliminar la publicación "${pubTitle}"? Esta acción es irreversible.`, async () => {
                try {
                    const result = await apiFetch(`/api/admin/publications/${pubId}`, { method: 'DELETE' });
                    showCustomAlert(result.message || 'Publicación eliminada.');
                    loadPublications(elements.publicationSearchInput.value);
                } catch (error) {
                    showCustomAlert(`Error al eliminar: ${error.message}`);
                }
            });
        }
    }

    async function handlePlatformPublicationSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const body = {
            title: document.getElementById('platformPubTitle').value,
            description: document.getElementById('platformPubDescription').value,
            cost: document.getElementById('platformPubCost').value,
            availableSlots: document.getElementById('platformPubSlots').value,
            isSellPost: document.querySelector('input[name="platformPubType"]:checked').value === 'sell',
            autoApprove: document.getElementById('platformAutoApprove').checked,
            isBoosterTask: document.getElementById('platformIsBoosterTask').checked
        };
        try {
            const result = await apiFetch('/api/admin/platform/create-publication', { method: 'POST', body: JSON.stringify(body) });
            showCustomAlert(result.message || "Publicación creada con éxito.");
            form.reset();
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
            case 'approve':
                endpoint = `/publications/${pubId}/approve`;
                body = { approverUsername: platformUsername, userToApprove: userInAction };
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

    // --- DANGER ZONE (FUNCIÓN A ELIMINAR DESPUÉS DE USAR) ---
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

    // --- Helpers de Renderizado ---
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

    // --- Lógica Principal de Renderizado ---
    function renderDashboard(stats) {
        elements.dashboardContainer.innerHTML = `
            <div class="stat-card">
                <h4>Usuarios Totales</h4>
                <p class="stat-value">${stats.totalUsers || 0}</p>
            </div>
            <div class="stat-card">
                <h4>Publicaciones Activas</h4>
                <p class="stat-value">${stats.activePublications || 0}</p>
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

    function getDebtorRowHTML(debtor) {
        return `
            <tr>
                <td class="username-cell">
                    <a href="profile.html?user=${debtor.username}" target="_blank">${debtor.username}</a>
                </td>
                <td class="saldo-red-text">${formatBalance(debtor.total_penalized_debt)}</td>
                <td align="center">${debtor.penalized_debts_count}</td>
            </tr>
        `;
    }
    
    function renderPlatformPublicationsForManagement(publications) {
        if (!publications || publications.length === 0) {
            elements.platformManagementList.innerHTML = '<p class="empty-message">No hay publicaciones de la plataforma que requieran acción.</p>';
            return;
        }
        elements.platformManagementList.innerHTML = publications.map(pub => getPlatformManagementItemHTML(pub)).join('');
    }
    
    function getPlatformManagementItemHTML(pub) {
        const participantsHTML = pub.participants && pub.participants.length > 0
            ? `<ul class="participants-list-admin">${pub.participants.map(p => getParticipantItemForManagementHTML(pub.id, p)).join('')}</ul>`
            : '<p class="no-participants" style="padding: 1rem; text-align: center; color: var(--admin-text-secondary);">Sin participantes por ahora.</p>';
    
        return `
            <div class="history-item-admin">
                <h3>${pub.title}</h3>
                <p>${pub.description || 'Sin descripción.'}</p>
                <h4>Participantes</h4>
                ${participantsHTML}
            </div>
        `;
    }
    
    function getParticipantItemForManagementHTML(pubId, participant) {
        const ratingHTML = generateStarRating(participant.average_rating, participant.ratings_count);
        const statusText = getStatusText(participant.status);
        let actionButton = '';
    
        if (participant.status === 'pending_approval') {
            actionButton = `<button class="action-button-admin approve" data-pub-id="${pubId}" data-action="approve" data-user="${participant.acceptor_username}">Aprobar</button>`;
        } else if (participant.status === 'completed') {
            actionButton = `<button class="action-button-admin confirm" data-pub-id="${pubId}" data-action="confirm-payment" data-user="${participant.acceptor_username}">Confirmar Pago</button>`;
        }
    
        return `
            <li class="participant-item-admin">
                <div class="participant-info-admin">
                    <strong><a href="profile.html?user=${participant.acceptor_username}" target="_blank">${participant.acceptor_username}</a></strong>
                    <span class="rating-display">${ratingHTML}</span>
                </div>
                <div class="participant-status-admin">
                    <span class="status-badge ${participant.status}">${statusText}</span>
                    ${actionButton}
                </div>
            </li>
        `;
    }

    function renderUsersTable(users) {
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
            <tr data-user-id="${user.id}" data-username="${user.username}" data-status="${user.status}">
                <td class="username-cell">
                    <a href="profile.html?user=${user.username}" target="_blank">${user.username}</a>
                </td>
                <td class="saldo-blue-text">${formatBalance(user.liquid_blue_balance)}</td>
                <td class="saldo-escrow-text">${formatBalance(user.escrow_blue_balance)}</td>
                <td class="saldo-booster-text">${formatBalance(user.booster_blue_balance)}</td>
                <td class="saldo-red-text">${formatBalance(user.red_balance)}</td>
                <td>${ratingHTML}</td>
                <td><span class="status-badge ${user.status}">${user.status}</span></td>
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
        
        const statusText = pub.is_paused ? 'Pausada' : pub.status;

        const actionsHTML = `
            <button class="action-button-admin delete" data-pub-id="${pub.id}" title="Eliminar publicación">Eliminar</button>
        `;

        return `
            <tr>
                <td class="publication-title-cell" title="${pub.title}">${pub.title}</td>
                <td class="username-cell">
                    <a href="profile.html?user=${pub.author_username}" target="_blank">${pub.author_username}</a>
                </td>
                <td>${typeHTML}</td>
                <td class="saldo-blue-text">${valueHTML}</td>
                <td align="center">${participantsHTML}</td>
                <td><span class="status-badge ${statusText.toLowerCase()}">${statusText}</span></td>
                <td>${creationDate}</td>
                <td>${actionsHTML}</td>
            </tr>
        `;
    }

    function renderPlatformWallet(walletData) {
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
            ? `<span title="ID de Publicación: ${entry.publication_id}" style="cursor: help;">${entry.publication_title}</span>`
            : entry.publication_title;

        const userHTML = entry.user_who_paid !== '(Usuario desconocido)'
            ? `<a href="profile.html?user=${entry.user_who_paid}" target="_blank">${entry.user_who_paid}</a>`
            : entry.user_who_paid;

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
                    <a href="profile.html?user=${entry.referred_username}" target="_blank">${entry.referred_username}</a>
                </td>
                <td class="username-cell">
                    <a href="profile.html?user=${entry.referrer_username}" target="_blank">${entry.referrer_username}</a>
                </td>
                <td>${registrationDate}</td>
            </tr>
        `;
    }

    // --- LÓGICA DE RENDERIZADO MEJORADA POR SECCIONES ---

    function renderSection(section, data) {
        switch (section) {
            case 'dashboard':
                renderDashboard(data);
                break;
            case 'settings':
                renderSettings(data);
                break;
            case 'users':
                renderUsers(data);
                break;
            case 'debtors':
                renderDebtors(data);
                break;
            case 'wallet':
                renderPlatformWallet(data.balance, data.log);
                break;
            case 'publications':
                renderAllPublications(data);
                break;
            case 'referrals':
                renderReferralSettings(data.settings);
                renderReferralLog(data.log);
                break;
            case 'boosters':
                renderBoosterSettings(data.settings);
                renderBoosterStats(data.stats);
                renderBoostersList(data.list);
                break;
            case 'database':
                renderDatabaseStats(data);
                break;
        }
    }

    async function loadSection(section) {
        if (!elements.mainContent) return;
        elements.mainContent.innerHTML = '<div class="loader"></div>';
        try {
            let data = {};
            switch (section) {
                case 'dashboard':
                    data = await apiFetch('/api/admin/dashboard-stats');
                    break;
                case 'settings':
                    data = await apiFetch('/api/admin/settings');
                    break;
                case 'users':
                    data = await apiFetch('/api/admin/users');
                    break;
                case 'debtors':
                    data = await apiFetch('/api/admin/debtors');
                    break;
                case 'wallet':
                    const [balance, log] = await Promise.all([apiFetch('/api/admin/platform-wallet/balance'), apiFetch('/api/admin/platform-wallet/log')]);
                    data = { balance, log };
                    break;
                case 'publications':
                    data = await apiFetch('/api/admin/publications');
                    break;
                case 'referrals':
                    const [referralSettings, referralLog] = await Promise.all([apiFetch('/api/admin/settings'), apiFetch('/api/admin/referrals/log')]);
                    data = { settings: referralSettings, log: referralLog };
                    break;
                case 'boosters':
                    const [boosterSettings, boosterStats, boosterList] = await Promise.all([apiFetch('/api/admin/boosters/settings'), apiFetch('/api/admin/boosters/stats'), apiFetch('/api/admin/boosters/list')]);
                    data = { settings: boosterSettings, stats: boosterStats, list: boosterList };
                    break;
                case 'database':
                    data = await apiFetch('/api/admin/database/stats');
                    break;
                case 'danger':
                    // No data to load, just render static content
                    break;
                default:
                    elements.mainContent.innerHTML = '<h2>Sección no encontrada</h2>';
                    return;
            }
            // Actualiza la UI
            const template = document.getElementById(`${section}-template`);
            if (template) {
                elements.mainContent.innerHTML = template.innerHTML;
                bindNavEvents(); // Re-bind events for any new nav elements in the template
                renderSection(section, data);
            } else if (section !== 'danger') {
                console.error(`Template no encontrado para la sección: ${section}-template`);
            }

        } catch (error) {
            console.error(`Error al cargar la sección ${section}:`, error);
            elements.mainContent.innerHTML = `<p class="error-message">Error al cargar ${section}: ${error.message}</p>`;
        }
    }

    // --- NUEVA FUNCIONALIDAD: Gestión de Base de Datos ---
    
    // Configurar event listeners para los botones de limpieza
    function setupDatabaseCleanupListeners() {
        console.log('🔧 Configurando event listeners para gestión de base de datos...');
        
        // Botón para limpiar datos de prueba
        const cleanupTestDataBtn = document.getElementById('cleanup-test-data-btn');
        if (cleanupTestDataBtn) {
            cleanupTestDataBtn.addEventListener('click', handleCleanupTestData);
            console.log('✅ Event listener configurado para cleanup-test-data-btn');
        } else {
            console.warn('❌ No se encontró el botón cleanup-test-data-btn');
        }

        // Botón para limpiar usuarios inactivos
        const cleanupInactiveUsersBtn = document.getElementById('cleanup-inactive-users-btn');
        if (cleanupInactiveUsersBtn) {
            cleanupInactiveUsersBtn.addEventListener('click', handleCleanupInactiveUsers);
            console.log('✅ Event listener configurado para cleanup-inactive-users-btn');
        } else {
            console.warn('❌ No se encontró el botón cleanup-inactive-users-btn');
        }

        // Botón para limpiar publicaciones antiguas
        const cleanupOldPublicationsBtn = document.getElementById('cleanup-old-publications-btn');
        if (cleanupOldPublicationsBtn) {
            cleanupOldPublicationsBtn.addEventListener('click', handleCleanupOldPublications);
            console.log('✅ Event listener configurado para cleanup-old-publications-btn');
        } else {
            console.warn('❌ No se encontró el botón cleanup-old-publications-btn');
        }

        // Botón para crear backup manual
        const createBackupBtn = document.getElementById('create-backup-btn');
        if (createBackupBtn) {
            createBackupBtn.addEventListener('click', handleCreateBackup);
            console.log('✅ Event listener configurado para create-backup-btn');
        } else {
            console.warn('❌ No se encontró el botón create-backup-btn');
        }

        // Botón para actualizar estadísticas
        const refreshStatsBtn = document.getElementById('refresh-db-stats');
        if (refreshStatsBtn) {
            refreshStatsBtn.addEventListener('click', handleRefreshStats);
            console.log('✅ Event listener configurado para refresh-db-stats');
        } else {
            console.warn('❌ No se encontró el botón refresh-db-stats');
        }
        
        console.log('🏁 Configuración de event listeners completada');
    }

    // Función para mostrar mensajes de estado en la interfaz
    function showDatabaseStatus(message, isError = false) {
        const statusContainer = document.getElementById('database-status');
        if (statusContainer) {
            statusContainer.innerHTML = `
                <div class="status-message ${isError ? 'status-error' : 'status-success'}">
                    ${message}
                </div>
            `;
            // Auto-ocultar después de 10 segundos
            setTimeout(() => {
                statusContainer.innerHTML = '';
            }, 10000);
        }
    }

    // Manejador para limpiar datos de prueba
    async function handleCleanupTestData() {
        if (!confirm('¿Estás seguro de que quieres eliminar todos los datos de prueba? Esta acción no se puede deshacer.')) {
            return;
        }

        const btn = document.getElementById('cleanup-test-data-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Procesando...';
        btn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/api/admin/database/cleanup-test-data`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (response.ok) {
                showDatabaseStatus(`✅ Limpieza exitosa: ${result.results.testUsersDeleted} usuarios de prueba y ${result.results.testPublicationsDeleted} publicaciones eliminadas.`);
                loadDatabaseStats(); // Actualizar estadísticas
            } else {
                showDatabaseStatus(`❌ Error: ${result.message}`, true);
            }
        } catch (error) {
            console.error('Error en limpieza de datos de prueba:', error);
            showDatabaseStatus('❌ Error de conexión al realizar la limpieza', true);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    // Manejador para limpiar usuarios inactivos
    async function handleCleanupInactiveUsers() {
        console.log('🧹 Iniciando limpieza de usuarios inactivos...');
        const daysInput = document.getElementById('inactive-users-days');
        const days = parseInt(daysInput ? daysInput.value : 90);
        console.log('📅 Días de inactividad configurados:', days);

        if (days < 30) {
            showDatabaseStatus('❌ Por seguridad, no se pueden eliminar usuarios con menos de 30 días de inactividad', true);
            return;
        }

        if (!confirm(`¿Estás seguro de que quieres eliminar usuarios inactivos por más de ${days} días? Esta acción no se puede deshacer.`)) {
            return;
        }

        const btn = document.getElementById('cleanup-inactive-users-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Procesando...';
        btn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/api/admin/database/cleanup-inactive-users`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ daysInactive: days })
            });

            const result = await response.json();

            if (response.ok) {
                showDatabaseStatus(`✅ Limpieza exitosa: ${result.results.usersDeleted} usuarios inactivos eliminados.`);
                loadDatabaseStats(); // Actualizar estadísticas
            } else {
                showDatabaseStatus(`❌ Error: ${result.message}`, true);
            }
        } catch (error) {
            console.error('Error en limpieza de usuarios inactivos:', error);
            showDatabaseStatus('❌ Error de conexión al realizar la limpieza', true);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    // Manejador para limpiar publicaciones antiguas
    async function handleCleanupOldPublications() {
        console.log('📝 Iniciando limpieza de publicaciones antiguas...');
        const daysInput = document.getElementById('old-publications-days');
        const days = parseInt(daysInput ? daysInput.value : 180);
        console.log('📅 Días de antigüedad configurados:', days);

        if (days < 90) {
            showDatabaseStatus('❌ Por seguridad, no se pueden eliminar publicaciones con menos de 90 días de antigüedad', true);
            return;
        }

        if (!confirm(`¿Estás seguro de que quieres eliminar publicaciones completadas hace más de ${days} días? Esta acción no se puede deshacer.`)) {
            return;
        }

        const btn = document.getElementById('cleanup-old-publications-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Procesando...';
        btn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/api/admin/database/cleanup-old-publications`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ daysOld: days })
            });

            const result = await response.json();

            if (response.ok) {
                showDatabaseStatus(`✅ Limpieza exitosa: ${result.results.publicationsDeleted} publicaciones antiguas eliminadas.`);
                loadDatabaseStats(); // Actualizar estadísticas
            } else {
                showDatabaseStatus(`❌ Error: ${result.message}`, true);
            }
        } catch (error) {
            console.error('Error en limpieza de publicaciones antiguas:', error);
            showDatabaseStatus('❌ Error de conexión al realizar la limpieza', true);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    // Manejador para crear backup manual
    async function handleCreateBackup() {
        console.log('💾 Iniciando creación de backup...');
        const btn = document.getElementById('create-backup-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Creando...';
        btn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/api/admin/database/backup`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();
            console.log('📦 Respuesta del backup:', result);

            if (response.ok) {
                showDatabaseStatus(`✅ Backup creado exitosamente: ${result.filename}`);
            } else {
                showDatabaseStatus(`❌ Error: ${result.message}`, true);
            }
        } catch (error) {
            console.error('Error al crear backup:', error);
            showDatabaseStatus('❌ Error de conexión al crear el backup', true);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    // Manejador para actualizar estadísticas
    async function handleRefreshStats() {
        console.log('🔄 Actualizando estadísticas de base de datos...');
        const btn = document.getElementById('refresh-db-stats');
        const originalText = btn.textContent;
        btn.textContent = '🔄 Actualizando...';
        btn.disabled = true;

        try {
            await loadDatabaseStats();
            showDatabaseStatus('✅ Estadísticas actualizadas correctamente');
        } catch (error) {
            console.error('Error al actualizar estadísticas:', error);
            showDatabaseStatus('❌ Error al actualizar las estadísticas', true);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    // Función para cargar estadísticas de la base de datos
    async function loadDatabaseStats() {
        console.log('📊 Cargando estadísticas de base de datos...');
        const statsContainer = document.getElementById('database-stats-container');
        
        try {
            // Mostrar spinner de carga
            if (statsContainer) {
                statsContainer.innerHTML = '<div class="loading-spinner"></div>';
            }

            const response = await fetch(`${API_URL}/api/admin/database/stats`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });

            if (response.ok) {
                const stats = await response.json();
                console.log('📈 Estadísticas recibidas:', stats);
                updateDatabaseStatsDisplay(stats);
            } else {
                console.error('Error en respuesta de estadísticas:', response.status);
                if (statsContainer) {
                    statsContainer.innerHTML = '<p style="color: #e74c3c;">Error al cargar estadísticas</p>';
                }
            }
        } catch (error) {
            console.error('Error al cargar estadísticas de base de datos:', error);
            if (statsContainer) {
                statsContainer.innerHTML = '<p style="color: #e74c3c;">Error de conexión</p>';
            }
        }
    }

    // Función para actualizar la visualización de estadísticas
    function updateDatabaseStatsDisplay(stats) {
        console.log('🎨 Actualizando visualización de estadísticas...');
        const statsContainer = document.getElementById('database-stats-container');
        
        if (!statsContainer) {
            console.warn('❌ No se encontró el contenedor de estadísticas');
            return;
        }

        // Crear el HTML de las estadísticas
        const statsHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-number">${stats.total_users || '0'}</div>
                    <div class="stat-label">Usuarios Totales</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${stats.test_users || '0'}</div>
                    <div class="stat-label">Usuarios de Prueba</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${stats.inactive_users || '0'}</div>
                    <div class="stat-label">Usuarios Inactivos</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${stats.total_publications || '0'}</div>
                    <div class="stat-label">Publicaciones Totales</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${stats.old_publications || '0'}</div>
                    <div class="stat-label">Publicaciones Antiguas</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${stats.total_transactions || '0'}</div>
                    <div class="stat-label">Transacciones</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${stats.total_notifications || '0'}</div>
                    <div class="stat-label">Notificaciones</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${stats.database_size || 'N/A'}</div>
                    <div class="stat-label">Tamaño de BD</div>
                </div>
            </div>
        `;
        
        statsContainer.innerHTML = statsHTML;
        console.log('✅ Estadísticas visualizadas correctamente');
    }

    // Llamar a la configuración cuando se carga la página
    // Usar setTimeout para asegurar que el DOM esté completamente cargado
    setTimeout(() => {
        setupDatabaseCleanupListeners();
        console.log('Database cleanup listeners configured');
    }, 100);
});