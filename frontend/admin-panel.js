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
    const adminToken = sessionStorage.getItem('adminToken');

    if (!adminToken) {
        window.location.href = 'admin.html';
        return;
    }

    const elements = {
        navLinks: document.querySelectorAll('.nav-link'),
        sections: document.querySelectorAll('.admin-section'),
        logoutBtn: document.getElementById('adminLogoutBtn'),
        settingsContainer: document.getElementById('settings-switches'),
        dashboardContainer: document.getElementById('dashboard-stats'),
        usersTableContainer: document.getElementById('users-table-container'),
        userSearchInput: document.getElementById('userSearchInput'),
        debtorsTableContainer: document.getElementById('debtors-table-container'),
        publicationsTableContainer: document.getElementById('publications-table-container'),
        publicationSearchInput: document.getElementById('publicationSearchInput'),
        platformWalletStatsContainer: document.getElementById('platform-wallet-stats'),
        platformCommissionLogContainer: document.getElementById('platform-commission-log-container'),
        platformPublicationForm: document.getElementById('platformPublicationForm'),
        platformManagementList: document.getElementById('platform-management-list'),
        // -- DANGER ZONE (ELEMENTOS A ELIMINAR DESPUÉS DE USAR) --
        resetDatabaseBtn: document.getElementById('resetDatabaseBtn')
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
            sessionStorage.removeItem('adminToken');
            window.location.href = 'admin.html';
        });

        elements.settingsContainer.addEventListener('change', handleSettingChange);
        elements.settingsContainer.addEventListener('keyup', (event) => {
            if (event.target.type === 'number') {
                handleSettingChange(event);
            }
        });

        let searchTimeout;
        elements.userSearchInput.addEventListener('keyup', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadUsers(elements.userSearchInput.value);
            }, 300);
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
    }

    function showSection(sectionId) {
        elements.sections.forEach(section => section.classList.remove('active-section'));
        elements.navLinks.forEach(link => link.classList.remove('active'));

        document.getElementById(`${sectionId}-section`).classList.add('active-section');
        document.querySelector(`.nav-link[data-section="${sectionId}"]`).classList.add('active');

        if (sectionId === 'dashboard') loadDashboardData();
        else if (sectionId === 'settings') loadSettings();
        else if (sectionId === 'users') loadUsers();
        else if (sectionId === 'debtors') loadDebtors();
        else if (sectionId === 'publications') loadPublications();
        else if (sectionId === 'platform-wallet') loadPlatformWalletData();
        else if (sectionId === 'platform-publications') {
            // Cargar ambas partes de la sección de plataforma
            loadPlatformManagementData();
        }
        // No se necesita cargar datos para la zona de peligro, solo mostrarla.
    }

    // --- Lógica de Datos (API Fetch, etc.) ---
    async function apiFetch(endpoint, options = {}) {
        const defaultOptions = {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
        };
        const response = await fetch(`${API_URL}${endpoint}`, { ...defaultOptions, ...options });
        if (response.status === 401 || response.status === 403) {
            sessionStorage.removeItem('adminToken');
            window.location.href = 'admin.html';
            throw new Error('Autenticación fallida.');
        }
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error del servidor: ${response.status}`);
        }
        return response.json();
    }

    async function loadUsers(searchTerm = '') {
        elements.usersTableContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const users = await apiFetch(`/api/admin/users?search=${encodeURIComponent(searchTerm)}`);
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
        try {
            const settings = await apiFetch('/api/admin/settings');
            renderSettings(settings);
        } catch (error) {
            showCustomAlert(error.message);
        }
    }

    // --- Lógica de Renderizado de Configuración (NUEVO) ---

    const settingTitles = {
        'public_profiles_enabled': 'Perfiles Públicos',
        'allow_new_registrations': 'Permitir Nuevos Registros',
        'allow_new_publications': 'Permitir Nuevas Publicaciones',
        'debt_system_enabled': 'Sistema de Deuda',
        'platform_commission_percentage': 'Comisión de la Plataforma (%)'
    };

    function getSettingTitle(key) {
        return settingTitles[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    function renderSettings(settings) {
        elements.settingsContainer.innerHTML = ''; // Limpiar contenido anterior

        // Agrupar configuraciones de tiempo
        const timeSettings = {
            debt_cycle: { label: 'Duración del Ciclo de Deuda RED', settings: [] },
            blue_escrow: { label: 'Duración del Depósito BLUE (Escrow)', settings: [] }
        };
        const otherSettings = [];

        settings.forEach(setting => {
            if (setting.setting_key.startsWith('debt_cycle_')) {
                timeSettings.debt_cycle.settings.push(setting);
            } else if (setting.setting_key.startsWith('blue_escrow_')) {
                timeSettings.blue_escrow.settings.push(setting);
            } else {
                otherSettings.push(setting);
            }
        });

        // Renderizar configuraciones de tiempo agrupadas
        for (const groupKey in timeSettings) {
            const group = timeSettings[groupKey];
            if (group.settings.length > 0) {
                // Ordenar por días, horas, minutos
                group.settings.sort((a, b) => {
                    const order = ['days', 'hours', 'minutes'];
                    const aKey = a.setting_key.split('_').pop();
                    const bKey = b.setting_key.split('_').pop();
                    return order.indexOf(aKey) - order.indexOf(bKey);
                });
                const groupHTML = `
                    <div class="setting-item">
                        <div class="setting-item-info">
                            <h4>${group.label}</h4>
                            <p>Define el período de tiempo para esta funcionalidad.</p>
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
                elements.settingsContainer.innerHTML += groupHTML;
            }
        }

        // Renderizar otras configuraciones
        otherSettings.forEach(setting => {
            let controlHTML;
            if (setting.setting_value === 'true' || setting.setting_value === 'false') {
                controlHTML = `
                    <label class="switch">
                        <input type="checkbox" data-key="${setting.setting_key}" ${setting.setting_value === 'true' ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                `;
            } else {
                controlHTML = `
                    <input type="number" class="admin-numeric-input" data-key="${setting.setting_key}" value="${setting.setting_value}" step="any" min="0">
                `;
            }
            
            const itemHTML = `
                <div class="setting-item">
                    <div class="setting-item-info">
                        <h4>${getSettingTitle(setting.setting_key)}</h4>
                        <p>${setting.description || 'Activa o desactiva esta característica para toda la plataforma.'}</p>
                    </div>
                    <div class="setting-item-control">
                        ${controlHTML}
                    </div>
                </div>
            `;
            elements.settingsContainer.innerHTML += itemHTML;
        });
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
        } else {
            return; // No-op for other types
        }
        
        // Usar un debounce para los inputs de número, para no enviar una petición en cada tecla
        if (control.type === 'number') {
            clearTimeout(settingChangeTimeout);
            settingChangeTimeout = setTimeout(() => {
                updateSetting(key, value);
            }, 500); // Esperar 500ms después de la última tecla
        } else {
            // Los checkboxes se actualizan al instante
            updateSetting(key, value);
        }
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
            autoApprove: document.getElementById('platformAutoApprove').checked
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
                <h4>BLUE en Circulación (Total)</h4>
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
                        <th>Saldo RED</th>
                        <th>Calificación</th>
                        <th>Fecha de Registro</th>
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
            <tr>
                <td class="username-cell">
                    <a href="profile.html?user=${user.username}" target="_blank">${user.username}</a>
                </td>
                <td class="saldo-blue-text">${formatBalance(user.liquid_blue_balance)}</td>
                <td class="saldo-escrow-text">${formatBalance(user.escrow_blue_balance)}</td>
                <td class="saldo-red-text">${formatBalance(user.red_balance)}</td>
                <td>${ratingHTML}</td>
                <td>${registrationDate}</td>
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
});