/**
 * sidebar.js - Componente Premium de WintonCoin
 * Inyecta dinámicamente el Sidebar, el estilo CSS y maneja la carga del Perfil.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Detección de pantalla: Solo activar sidebar en escritorio (≥769px)
    // En teléfono se conserva el menú hamburguesa original de contract_interaction.html
    const isDesktop = window.matchMedia('(min-width: 769px)').matches;
    if (!isDesktop) {
        // En móvil, no inyectamos el sidebar.
        // El menú original (header-menu) maneja la navegación del teléfono.
        return;
    }

    // 2. Ocultar el menú original del teléfono (header-menu) en escritorio
    // para que no se duplique con el sidebar premium
    const originalMobileMenu = document.querySelector('.header-menu');
    if (originalMobileMenu) {
        originalMobileMenu.style.display = 'none';
    }

    // 3. Inyectar CSS si no existe
    if (!document.querySelector('link[href*="premium-dashboard.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/src/css/premium-dashboard.css';
        document.head.appendChild(link);
    }

    // 4. Aplicar la clase al body
    document.body.classList.add('dashboard-layout');

    // 5. Crear Estructura HTML del Sidebar Premium
    const sidebarHTML = `
        <!-- Mobile Overlay -->
        <div class="sidebar-overlay" id="mobile-overlay"></div>

        <!-- Mobile Header -->
        <div class="mobile-header">
            <h3 style="margin:0; font-size:1.2rem; color:var(--prm-primary);">WintonCoin</h3>
            <button class="mobile-menu-btn" id="menu-toggle">☰</button>
        </div>

        <!-- The Sidebar -->
        <aside id="premium-sidebar">
            <div class="sidebar-profile">
                <div class="avatar-ring">
                    <div class="avatar" id="sidebar-avatar">
                        <!-- Iniciales o Imagen -->
                        <span class="loader">⌛</span>
                    </div>
                </div>
                <h3 id="sidebar-name">Cargando...</h3>
                <p id="sidebar-username">@usuario</p>
            </div>

            <nav class="sidebar-nav">
                <ul>
                    <li><a href="/contract_interaction.html" class="nav-link"><span class="icon">🏠</span> Resumen</a></li>
                    <li><a href="/como-funciona.html" class="nav-link"><span class="icon">❓</span> ¿Cómo funciona?</a></li>
                    <li><a href="/p2p.html" class="nav-link"><span class="icon">💱</span> Vende o Compra BLUE</a></li>
                    <li><a href="/history.html" class="nav-link"><span class="icon">📜</span> Historial</a></li>
                    <li><a href="/transactions.html" class="nav-link"><span class="icon">💸</span> Transacciones</a></li>
                    <li><a href="/referrals.html" class="nav-link"><span class="icon">👥</span> Referidos</a></li>
                    <li><a href="/booster-profile.html" class="nav-link"><span class="icon">🚀</span> Perfil de Impulsor</a></li>
                    <li><a href="/estado-cuenta.html" class="nav-link"><span class="icon">📊</span> Billetera Web3</a></li>
                    <li><a href="/causa-solidaria.html" class="nav-link"><span class="icon">❤️</span> Donaciones</a></li>
                    <li><a href="/momentum-landing.html" class="nav-link"><span class="icon">⚡</span> Winton Momentum</a></li>
                    <li><a href="/love.html" class="nav-link"><span class="icon">💖</span> Página L.O.V.</a></li>
                    <li><a href="/documentation.html" class="nav-link"><span class="icon">📄</span> Documentación</a></li>
                    <li><a href="/" target="_blank" class="nav-link"><span class="icon">🌐</span> Ir al Sitio Web</a></li>
                    <li><a href="/profile.html" class="nav-link"><span class="icon">⚙️</span> Configuración</a></li>
                </ul>
            </nav>

            <div class="sidebar-footer">
                <button class="btn-logout" onclick="logoutPremium()">
                    <span class="icon">🚪</span> Cerrar Sesión
                </button>
            </div>
        </aside>
    `;

    // Inyectar al principio del body
    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

    // 4. Marcar ruta activa
    const currentPath = window.location.pathname;
    const links = document.querySelectorAll('.sidebar-nav .nav-link');
    links.forEach(link => {
        // Obtenemos solo la ruta de href sin origen
        const hrefPath = new URL(link.href, window.location.origin).pathname;
        if (currentPath.includes(hrefPath) || (currentPath === '/' && hrefPath.includes('contract_interaction.html'))) {
            link.classList.add('active');
        }
    });

    // 5. Lógica del Menú Móvil
    const sidebar = document.getElementById('premium-sidebar');
    const toggleBtn = document.getElementById('menu-toggle');
    const overlay = document.getElementById('mobile-overlay');

    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    });

    // 6. Cargar Perfil (Desde LocalStorage)
    loadUserProfile();
});

// Función para cargar el perfil del usuario instantáneamente
function loadUserProfile() {
    try {
        const token = localStorage.getItem('token');
        const username = localStorage.getItem('username');

        if (!token || !username) {
            // Si no hay sesión, no hacemos redirect forzado aquí para no romper páginas públicas, 
            // pero indicamos que no hay usuario
            document.getElementById('sidebar-name').textContent = "Invitado";
            document.getElementById('sidebar-username').textContent = "";
            return;
        }

        const nameEl = document.getElementById('sidebar-name');
        const usernameEl = document.getElementById('sidebar-username');
        const avatarEl = document.getElementById('sidebar-avatar');

        // Capitalizar el nombre de usuario para mostrarlo como "Nombre" principal
        const displayName = username.charAt(0).toUpperCase() + username.slice(1);

        nameEl.textContent = displayName;
        usernameEl.textContent = `@${username}`;

        // Configurar Avatar (iniciales basadas en el username)
        const initials = username.substring(0, 2).toUpperCase();
        avatarEl.innerHTML = `<span style="letter-spacing:-1px;">${initials}</span>`;

    } catch (err) {
        console.error('Error cargando perfil del sidebar:', err);
        document.getElementById('sidebar-name').textContent = "Error";
        document.getElementById('sidebar-username').textContent = "";
    }
}

// Lógica para cerrar sesión
window.logoutPremium = function() {
    localStorage.removeItem('token');
    localStorage.removeItem('username'); // Legacy
    window.location.href = '/login.html';
};
