/**
 * WintonCoin Onboarding System
 * Utiliza driver.js para guiar al usuario en su primera visita.
 */

// function to handle URL parameter for restarting tour
function checkAndRestartOnboarding() {
    const urlParams = new URLSearchParams(window.location.search);
    const startTourParam = urlParams.get('start_tour');

    if (startTourParam === 'true') {
        // Clear the completion flag
        localStorage.removeItem('wintoncoin_tour_completed');

        // Clean URL
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: newUrl }, '', newUrl);

        // Start tour with a slight delay
        setTimeout(() => {
            startTour();
        }, 1000);
    } else {
        // Standard check
        const hasSeenTour = localStorage.getItem('wintoncoin_tour_completed');
        if (!hasSeenTour) {
            setTimeout(() => {
                startTour();
            }, 1500);
        }
    }
}

export function initOnboarding() {
    checkAndRestartOnboarding();
}

function startTour() {
    // Aseguramos que driver esté disponible
    if (!window.driver || !window.driver.js) {
        console.error("Driver.js no está cargado");
        return;
    }

    const driver = window.driver.js.driver;

    const driverObj = driver({
        showProgress: true,
        animate: true,
        allowClose: false,      // No permitir cerrar con ESC o click fuera
        overlayClickNext: false, // No avanzar ni cerrar al dar click fuera
        doneBtnText: '¡A empezar!',
        nextBtnText: 'Siguiente →',
        prevBtnText: '← Anterior',
        progressText: 'Paso {{current}} de {{total}}',
        // Hooks para "Modo Museo": Bloquear interacción con el elemento resaltado
        onHighlightStarted: (element) => {
            if (element) {
                // Forzar bloqueo de clicks
                element.style.setProperty('pointer-events', 'none', 'important');
                // También bloquear hijos para asegurar
                const children = element.querySelectorAll('*');
                children.forEach(child => child.style.setProperty('pointer-events', 'none', 'important'));
            }
        },
        onDeselected: (element) => {
            if (element) {
                element.style.pointerEvents = '';
                const children = element.querySelectorAll('*');
                children.forEach(child => child.style.pointerEvents = '');
            }
        },
        steps: [
            {
                element: '.main-title-container',
                popover: {
                    title: '¡Bienvenido a WintonCoin!',
                    description: 'WintonCoin es una economía real de intercambio. Aquí generas <b>BLUE</b> para pagar y <b>RED</b> para financiarte.',
                    side: "bottom",
                    align: 'center'
                }
            },
            {
                element: '.header-menu',
                popover: {
                    title: '⚙️ Tu Panel de Control',
                    description: 'Aquí accedes al <b>P2P</b>, <b>Historial</b>, <b>Perfil de Impulsor</b> y otras funciones.',
                    side: "bottom",
                    align: 'center'
                }
            },
            {
                element: '.blue-section',
                popover: {
                    title: '🔵 Tu Activo (BLUE)',
                    description: 'Aquí verás tus ganancias. <b>1 BLUE ≈ 1 USD</b> (al lanzamiento). Es dinero tuyo para gastar, ahorrar o vender.',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '.red-section',
                popover: {
                    title: '🔴 Tu Crédito (RED)',
                    description: '¿Quieres pagar algo y no tienes dinero? Te financias generando RED. Tienes 30 días para pagarlo (quemarlo) con BLUE antes de que venza.',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '#boosterSummary',
                popover: {
                    title: '⭐ Tu Progreso',
                    description: 'Toca este banner para ver tu <b>desempeño y BLUE iou acumulado</b> en la etapa pre-lanzamiento.',
                    side: "bottom",
                    align: 'center'
                }
            },
            {
                element: '.referral-card',
                popover: {
                    title: '🤝 Comparte y Gana',
                    description: 'Toca aquí para enviar tu código. <b>Ambos ganan recompensa al registrarse.</b>',
                    side: "top",
                    align: 'center'
                }
            },
            {
                element: '.main-actions-container',
                popover: {
                    title: '📢 Publicar',
                    description: '¿Necesitas un servicio? ¿Vendes un producto? Toca aquí para publicar lo que se te ocurra.',
                    side: "bottom",
                    align: 'center'
                }
            },
            {
                element: '#publications-list',
                popover: {
                    title: '💼 Mercado de Tareas',
                    description: 'Aquí aparecen las ofertas de la comunidad. <b>Completa tareas para ganar BLUE</b> o compra lo que necesites.',
                    side: "top",
                    align: 'center'
                }
            }
        ],
        // Asegurar que el tour se cierre correctamente al finalizar
        onDestroyStarted: () => {
            // Asegurar limpieza del último elemento si es necesario
            const activeElement = document.querySelector('.driver-active-element');
            if (activeElement) activeElement.style.pointerEvents = '';

            driverObj.destroy();
            localStorage.setItem('wintoncoin_tour_completed', 'true');
        },
    });

    driverObj.drive();
}

// Función para reiniciar el tour manualmente
export function restartTour() {
    localStorage.removeItem('wintoncoin_tour_completed');
    startTour();
}
