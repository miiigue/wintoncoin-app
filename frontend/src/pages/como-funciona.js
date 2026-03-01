// ============================================================================
// WintonCoin - Página Cómo Funciona
// ============================================================================
// Esta página es principalmente informativa, solo necesita las utilidades base

import '../modules/index.js';

// La página de "cómo funciona" es principalmente estática
// Solo inicializamos los componentes base de la aplicación
console.log('Página Cómo Funciona cargada');

// --- Winton Academy: YouTube Modal Logic ---
document.addEventListener('DOMContentLoaded', () => {
    initYouTubeAcademy();
});

// En caso de que el DOMContentLoaded ya haya pasado (ej. navegacion por SPA/Vite dev server hmr)
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initYouTubeAcademy();
}

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://server.wintoncoin.com';

function initYouTubeAcademy() {
    const modal = document.getElementById('youtubeModal');
    if (!modal) return; // Si no existe el modal en esta página, abortar

    const closeBtn = document.getElementById('youtubeCloseBtn');
    const videoContainer = document.getElementById('youtubeVideoContainer');

    // Función para abrir el modal y cargar el video
    function openVideoModal(videoId) {
        // Inyectar el iframe dinámicamente. Esto evita cargar scripts de YouTube hasta que el usuario lo pide (Lazy Loading).
        videoContainer.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&hl=es" title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

        // Mostrar el modal con transición
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Evitar scroll de la página de fondo
    }

    // Función para cerrar el modal y destruir el video
    function closeVideoModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';

        // Destruir el iframe para detener el video y liberar memoria
        setTimeout(() => {
            videoContainer.innerHTML = '';
        }, 300); // Esperar a que termine la transición CSS
    }

    // Bindings de Cierre (Botón, Overlay, Escape)
    if (closeBtn) {
        // Quitar listeners previos clonando
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', closeVideoModal);
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeVideoModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeVideoModal();
        }
    });

    // Función Asíncrona para Cargar Videos Dinámicos desde el CMS de Winton
    async function fetchDynamicVideos() {
        const grid = document.getElementById('dynamic-academy-grid');
        if (!grid) return;

        try {
            const response = await fetch(`${API_URL}/api/academy/public`);
            if (!response.ok) {
                throw new Error('Error al sincronizar con Winton Academy');
            }

            const data = await response.json();

            // Format fallback implementation
            const videos = Array.isArray(data) ? data : (data.videos || []);

            // Si no hay videos, mostrar mensaje amigable
            if (videos.length === 0) {
                grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary);">Actualmente la academia está siendo actualizada. Vuelve pronto.</p>';
                return;
            }

            // Vaciar grid spinner
            grid.innerHTML = '';

            // Generar tarjetas iterativamente
            videos.forEach(video => {
                // Prevenir XSS Básico
                const safeTitle = String(video.title).replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const safeId = String(video.youtube_id).replace(/[^a-zA-Z0-9_\-]/g, "");

                const cardHTML = `
                    <div class="video-academy-card" data-video-id="${safeId}">
                        <div class="video-thumbnail-container">
                            <img src="https://img.youtube.com/vi/${safeId}/maxresdefault.jpg" alt="${safeTitle}" 
                                 onerror="this.src='https://img.youtube.com/vi/${safeId}/hqdefault.jpg'"> 
                            <div class="video-play-button">
                                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                        </div>
                        <div class="video-info">
                            <h3 class="video-title">${safeTitle}</h3>
                        </div>
                    </div>
                `;

                // Usar DOM Parser manual para inyectar string y luego añadir evento click
                const wrapper = document.createElement('div');
                wrapper.innerHTML = cardHTML.trim();
                const cardElement = wrapper.firstChild;

                cardElement.addEventListener('click', () => {
                    openVideoModal(safeId);
                });

                grid.appendChild(cardElement);
            });

        } catch (error) {
            console.error('CoreCMS Error:', error);
            grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--error-color);">No se pudo cargar la Winton Academy por el momento.</p>';
        }
    }

    // Iniciar Sincronización
    fetchDynamicVideos();
}
