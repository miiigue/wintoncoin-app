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
        dashboardContainer: document.getElementById('dashboard-stats')
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