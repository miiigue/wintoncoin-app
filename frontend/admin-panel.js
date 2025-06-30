document.addEventListener('DOMContentLoaded', () => {

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
        userSearchInput: document.getElementById('userSearchInput')
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

        // Listener para la búsqueda de usuarios
        // Usamos 'keyup' para una respuesta en tiempo real, con un debounce para no sobrecargar el servidor.
        let searchTimeout;
        elements.userSearchInput.addEventListener('keyup', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadUsers(elements.userSearchInput.value);
            }, 300); // Espera 300ms después de la última tecla pulsada
        });
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
                        <th>Saldo BLUE</th>
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
                <td class="saldo-blue-text">${user.blue_balance}</td>
                <td class="saldo-red-text">${user.red_balance}</td>
                <td>${ratingHTML}</td>
                <td>${registrationDate}</td>
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
                <p class="stat-value saldo-blue-text">${stats.totalBlue.toLocaleString('es-ES')}</p>
            </div>
            <div class="stat-card">
                <h4>Total de RED en Circulación</h4>
                <p class="stat-value saldo-red-text">${stats.totalRed.toLocaleString('es-ES')}</p>
            </div>
        `;
    }

    function renderSettings(settings) {
        const settingsMap = {
            'public_profiles_enabled': {
                title: 'Perfiles Públicos de Usuario',
                description: 'Permite que cualquiera pueda ver la reputación y comentarios de otros usuarios.'
            },
            'allow_new_registrations': {
                title: 'Permitir Nuevos Registros',
                description: 'Si se desactiva, nadie podrá crear una cuenta nueva en la plataforma.'
            },
            'allow_new_publications': {
                title: 'Permitir Nuevas Publicaciones',
                description: 'Si se desactiva, los usuarios no podrán crear nuevas tareas o servicios.'
            }
        };
        
        elements.settingsContainer.innerHTML = settings.map(setting => {
            const info = settingsMap[setting.setting_key] || { title: setting.setting_key, description: '' };
            const isChecked = setting.setting_value === 'true';

            return `
                <div class="setting-item">
                    <div class="setting-item-info">
                        <h4>${info.title}</h4>
                        <p>${info.description}</p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" data-key="${setting.setting_key}" ${isChecked ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            `;
        }).join('');
    }
}); 