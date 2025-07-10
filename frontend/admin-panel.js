document.addEventListener('DOMContentLoaded', () => {

    // --- Función de Utilidad para Formatear Saldos ---
    function formatBalance(value) {
        const num = Number(value) || 0;
        // Formato español: separador de miles con punto, decimal con coma.
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

    // --- Seguridad: Redireccionar si no hay token ---
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
        // Nuevos elementos para la gestión de contenido
        publicationsTableContainer: document.getElementById('publications-table-container'),
        publicationSearchInput: document.getElementById('publicationSearchInput'),
        // Nuevos elementos para la billetera de la plataforma
        platformWalletStatsContainer: document.getElementById('platform-wallet-stats'),
        platformCommissionLogContainer: document.getElementById('platform-commission-log-container')
    };

    // --- Inicialización ---
    setupEventListeners();
    showSection('dashboard'); // <-- Cambiado para mostrar el dashboard por defecto

    // --- Lógica de la Interfaz ---
    function setupEventListeners() {
        // Navegación entre secciones
        elements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = link.dataset.section;
                showSection(sectionId);
            });
        });

        // Logout
        elements.logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem('adminToken');
            window.location.href = 'admin.html';
        });

        // Listener para los interruptores (se añade al contenedor padre)
        elements.settingsContainer.addEventListener('change', handleSettingChange);

        // Listener para los inputs numéricos (con debounce)
        elements.settingsContainer.addEventListener('keyup', (event) => {
            if (event.target.type === 'number') {
                handleSettingChange(event);
            }
        });

        // Listener para la búsqueda de usuarios
        // Usamos 'keyup' para una respuesta en tiempo real, con un debounce para no sobrecargar el servidor.
        let searchTimeout;
        elements.userSearchInput.addEventListener('keyup', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadUsers(elements.userSearchInput.value);
            }, 300); // Espera 300ms después de la última tecla pulsada
        });

        // Listener para la búsqueda de publicaciones (con debounce)
        let pubSearchTimeout;
        elements.publicationSearchInput.addEventListener('keyup', () => {
            clearTimeout(pubSearchTimeout);
            pubSearchTimeout = setTimeout(() => {
                loadPublications(elements.publicationSearchInput.value);
            }, 300);
        });

        // Delegación de eventos para acciones en la tabla de publicaciones
        elements.publicationsTableContainer.addEventListener('click', handlePublicationAction);
    }

    function showSection(sectionId) {
        // Ocultar todas las secciones
        elements.sections.forEach(section => {
            section.classList.remove('active-section');
        });

        // Quitar la clase 'active' de todos los enlaces
        elements.navLinks.forEach(link => {
            link.classList.remove('active');
        });

        // Mostrar la sección correcta y marcar el enlace como activo
        document.getElementById(`${sectionId}-section`).classList.add('active-section');
        document.querySelector(`.nav-link[data-section="${sectionId}"]`).classList.add('active');

        // Cargar los datos específicos de la sección que se está mostrando
        if (sectionId === 'dashboard') {
            loadDashboardData();
        } else if (sectionId === 'settings') {
            loadSettings();
        } else if (sectionId === 'users') {
            loadUsers();
        } else if (sectionId === 'debtors') {
            loadDebtors();
        } else if (sectionId === 'publications') {
            loadPublications(); // Cargar publicaciones al mostrar la sección
        } else if (sectionId === 'platform-wallet') {
            loadPlatformWalletData();
        }
    }

    // --- Lógica de Datos ---
    async function apiFetch(endpoint, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            }
        };

        const response = await fetch(`${API_URL}${endpoint}`, { ...defaultOptions, ...options });

        if (response.status === 401 || response.status === 403) {
            // Token inválido o expirado, forzar logout
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
            // Añadimos el término de búsqueda como un query parameter
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
            // Cargar ambas piezas de información en paralelo para mayor eficiencia
            const [wallet, log] = await Promise.all([
                apiFetch('/api/admin/platform-wallet/balance'),
                apiFetch('/api/admin/platform-wallet/log')
            ]);
            renderPlatformWallet(wallet);
            renderCommissionLog(log);
        } catch (error) {
            elements.platformWalletStatsContainer.innerHTML = `<p class="error-message">Error al cargar datos de la billetera: ${error.message}</p>`;
            elements.platformCommissionLogContainer.innerHTML = '';
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

    async function handleSettingChange(event) {
        if (event.target.type === 'checkbox') {
            const key = event.target.dataset.key;
            const value = event.target.checked.toString(); // 'true' o 'false'

            try {
                await apiFetch('/api/admin/settings', {
                    method: 'POST',
                    body: JSON.stringify({ key, value })
                });
                // Podríamos mostrar una pequeña notificación de "Guardado" si quisiéramos.
            } catch (error) {
                showCustomAlert(`Error al guardar el cambio: ${error.message}`);
                // Revertir el checkbox a su estado anterior si falla el guardado
                event.target.checked = !event.target.checked;
            }
        } else if (event.target.type === 'number') {
            // Usamos un debounce para no guardar con cada tecla
            clearTimeout(window.settingSaveTimeout);
            window.settingSaveTimeout = setTimeout(async () => {
                const key = event.target.dataset.key;
                const value = event.target.value;

                // Validación corregida: ahora permite 0 pero no valores negativos o vacíos.
                if (value === '' || isNaN(parseInt(value)) || parseInt(value) < 0) {
                    showCustomAlert('El valor debe ser un número igual o mayor a cero.');
                    return;
                }

                try {
                    await apiFetch('/api/admin/settings', {
                        method: 'POST',
                        body: JSON.stringify({ key, value })
                    });
                } catch (error) {
                    showCustomAlert(`Error al guardar el cambio: ${error.message}`);
                }
            }, 500); // Guardar 500ms después de que el usuario deje de teclear
        }
    }

    async function handlePublicationAction(event) {
        const deleteButton = event.target.closest('.action-button-admin.delete');

        if (deleteButton) {
            const pubId = deleteButton.dataset.pubId;
            const pubTitle = deleteButton.closest('tr').querySelector('.publication-title-cell').textContent;
            
            showCustomConfirm(`¿Seguro que quieres eliminar la publicación "${pubTitle}"? Esta acción es irreversible y eliminará también todas las participaciones asociadas.`, async () => {
                try {
                    const result = await apiFetch(`/api/admin/publications/${pubId}`, {
                        method: 'DELETE'
                    });
                    showCustomAlert(result.message || 'Publicación eliminada.');
                    loadPublications(elements.publicationSearchInput.value); // Recargar la tabla
                } catch (error) {
                    showCustomAlert(`Error al eliminar la publicación: ${error.message}`);
                }
            });
        }
    }

    // --- Lógica de Renderizado ---
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
        
        // Muestra (completados / totales)
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

    function renderPlatformWallet(wallet) {
        elements.platformWalletStatsContainer.innerHTML = `
            <div class="stat-card">
                <h4>Comisiones Totales Ganadas</h4>
                <p class="stat-value saldo-blue-text">${formatBalance(wallet.balance)} BLUE</p>
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
}); 