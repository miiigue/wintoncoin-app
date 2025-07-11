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
        platformManagementList: document.getElementById('platform-management-list')
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

    // --- Handlers de Eventos ---
    async function handleSettingChange(event) {
        // (Lógica de los settings sin cambios)
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
            isSellPost: document.querySelector('input[name="platformPubType"]:checked').value === 'sell'
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
        const ratingHTML = user.ratings_count > 0 
            ? `<span class="rating-cell"><span class="stars">${'★'.repeat(Math.round(user.average_rating))}${'☆'.repeat(5 - Math.round(user.average_rating))}</span> (${user.ratings_count})</span>`
            : `<span class="no-rating">Sin calificar</span>`;

        const statusMap = {
            'open': 'Abierta',
            'pending_approval': 'Pendiente',
            'approved': 'Aprobada',
            'completed': 'Culminada',
            'confirmed_paid': 'Pagada'
        };

        function getStatusText(status) {
            return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
        }
    
        function generateStarRating(rating, count) {
            if (count === 0) return '<span class="no-rating">Sin calif.</span>';
            const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
            return `<span class="stars" title="${parseFloat(rating).toFixed(1)} de 5">${stars}</span> <span class="rating-count">(${count})</span>`;
        }

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
                        <th>Transacción Origen</th>
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

        return `
            <tr>
                <td class="saldo-blue-text">${formatBalance(entry.commission_amount_blue)}</td>
                <td><a href="#" title="Ver publicación ${entry.publication_id}">${entry.publication_title}</a></td>
                <td class="username-cell"><a href="profile.html?user=${entry.user_who_paid}" target="_blank">${entry.user_who_paid}</a></td>
                <td>${commissionDate}</td>
            </tr>
        `;
    }

    function renderDashboard(stats) {
        elements.dashboardContainer.innerHTML = `
            <div class="stat-card">
                <h4>Usuarios Totales</h4>
                <p class="stat-value">${stats.totalUsers}</p>
            </div>
            <div class="stat-card">
                <h4>Publicaciones Activas</h4>
                <p class="stat-value">${stats.activePublications}</p>
            </div>
            <div class="stat-card">
                <h4>Total de BLUE en Circulación</h4>
                <p class="stat-value saldo-blue-text">${formatBalance(stats.totalBlue)}</p>
            </div>
            <div class="stat-card">
                <h4>Total de RED en Circulación</h4>
                <p class="stat-value saldo-red-text">${formatBalance(stats.totalRed)}</p>
            </div>
            <div class="stat-card">
                <h4>Comisiones Acumuladas</h4>
                <p class="stat-value saldo-blue-text">${formatBalance(stats.platformCommissionBalance)}</p>
            </div>
        `;
    }

    function renderSettings(settings) {
        const settingsValues = settings.reduce((acc, s) => {
            acc[s.setting_key] = s.setting_value;
            return acc;
        }, {});

        // Layout de la UI de configuración. Esto nos da control total sobre el orden y la agrupación.
        const settingsLayout = [
            { 
                type: 'switch', 
                key: 'public_profiles_enabled',
                title: 'Perfiles Públicos de Usuario',
                description: 'Permite que cualquiera pueda ver la reputación y comentarios de otros usuarios.'
            },
            { 
                type: 'switch', 
                key: 'allow_new_registrations',
                title: 'Permitir Nuevos Registros',
                description: 'Si se desactiva, nadie podrá crear una cuenta nueva en la plataforma.'
            },
            { 
                type: 'switch', 
                key: 'allow_new_publications',
                title: 'Permitir Nuevas Publicaciones',
                description: 'Si se desactiva, los usuarios no podrán crear nuevas tareas o servicios.'
            },
            { 
                type: 'switch', 
                key: 'debt_system_enabled',
                title: 'Activar Sistema de Deuda RED',
                description: 'Activa o desactiva la mecánica de vencimiento y penalización para los tokens RED.'
            },
            {
                type: 'group',
                title: 'Duración del Ciclo de Deuda',
                description: 'Establece cuánto tiempo tiene un usuario para quemar un lote de tokens RED antes de que venza.',
                keys: {
                    days: 'debt_cycle_days',
                    hours: 'debt_cycle_hours',
                    minutes: 'debt_cycle_minutes'
                }
            },
            {
                type: 'group',
                title: 'Duración del Depósito BLUE',
                description: 'Establece cuánto tiempo permanecen los tokens BLUE en el saldo bloqueado (escrow) antes de liberarse.',
                keys: {
                    days: 'blue_escrow_days',
                    hours: 'blue_escrow_hours',
                    minutes: 'blue_escrow_minutes'
                }
            },
            { 
                type: 'numeric',
                key: 'platform_commission_percentage',
                title: 'Comisión de la Plataforma (%)',
                description: 'El porcentaje de comisión que la plataforma gana en cada transacción completada.'
            }
        ];
        
        elements.settingsContainer.innerHTML = settingsLayout.map(item => {
            if (item.type === 'switch') {
                const isChecked = settingsValues[item.key] === 'true';
                return `
                    <div class="setting-item">
                        <div class="setting-item-info">
                            <h4>${item.title}</h4>
                            <p>${item.description}</p>
                        </div>
                        <label class="switch">
                            <input type="checkbox" data-key="${item.key}" ${isChecked ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                `;
            }

            if (item.type === 'group') {
                return `
                    <div class="setting-item">
                        <div class="setting-item-info">
                            <h4>${item.title}</h4>
                            <p>${item.description}</p>
                        </div>
                        <div class="setting-item-control-group">
                            <div class="numeric-group-item">
                                <label>Días</label>
                                <input type="number" class="admin-numeric-input" data-key="${item.keys.days}" value="${settingsValues[item.keys.days] || 0}" min="0">
                            </div>
                            <div class="numeric-group-item">
                                <label>Horas</label>
                                <input type="number" class="admin-numeric-input" data-key="${item.keys.hours}" value="${settingsValues[item.keys.hours] || 0}" min="0" max="23">
                            </div>
                            <div class="numeric-group-item">
                                <label>Min</label>
                                <input type="number" class="admin-numeric-input" data-key="${item.keys.minutes}" value="${settingsValues[item.keys.minutes] || 0}" min="0" max="59">
                            </div>
                        </div>
                    </div>
                `;
            }

            if (item.type === 'numeric') {
                return `
                    <div class="setting-item">
                        <div class="setting-item-info">
                            <h4>${item.title}</h4>
                            <p>${item.description}</p>
                        </div>
                        <div class="setting-item-control-group">
                             <div class="numeric-group-item">
                                <input type="number" class="admin-numeric-input" data-key="${item.key}" value="${settingsValues[item.key] || 0}" min="0" step="0.1">
                            </div>
                        </div>
                    </div>
                `;
            }
            return '';
        }).join('');
    }

    function renderDebtorsTable(debtors) {
        if (debtors.length === 0) {
            elements.debtorsTableContainer.innerHTML = '<p class="empty-message">¡Buenas noticias! No hay usuarios con deudas penalizadas en este momento.</p>';
            return;
        }

        const tableHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Deuda Penalizada Total (RED)</th>
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
                <td>${debtor.penalized_debts_count}</td>
            </tr>
        `;
    }

    // --- Nuevo renderizado para la gestión ---
    function renderPlatformPublicationsForManagement(publications) {
        if (!elements.platformManagementList) return;
        if (publications.length === 0) {
            elements.platformManagementList.innerHTML = '<p class="empty-message">No hay publicaciones de la plataforma que requieran gestión.</p>';
            return;
        }
        elements.platformManagementList.innerHTML = publications.map(pub => `
            <div class="history-item-admin">
                <h3>${pub.title}</h3>
                <ul class="participants-list-admin">
                    ${pub.participants.map(p => getParticipantManagementHTML(pub.id, p)).join('')}
                </ul>
            </div>
        `).join('');
    }

    function getParticipantManagementHTML(pubId, participant) {
        const ratingHTML = generateStarRating(participant.average_rating, participant.ratings_count);
        const statusText = getStatusText(participant.status);
        let actionButtonHTML = '';

        if (participant.status === 'pending_approval') {
            actionButtonHTML = `<button class="action-button-admin approve" data-action="approve" data-pub-id="${pubId}" data-user="${participant.acceptor_username}">Aprobar</button>`;
        } else if (participant.status === 'completed') {
            actionButtonHTML = `<button class="action-button-admin confirm" data-action="confirm-payment" data-pub-id="${pubId}" data-user="${participant.acceptor_username}">Confirmar Pago</button>`;
        }
        
        return `
            <li class="participant-item-admin">
                <div class="participant-info-admin">
                    <strong><a href="profile.html?user=${participant.acceptor_username}" target="_blank">${participant.acceptor_username}</a></strong>
                    <span class="rating-display">${ratingHTML}</span>
                </div>
                <div class="participant-status-admin">
                    <span class="status-badge ${participant.status}">${statusText}</span>
                    ${actionButtonHTML}
                </div>
            </li>
        `;
    }
}); 