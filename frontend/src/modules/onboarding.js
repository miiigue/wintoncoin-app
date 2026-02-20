/**
 * WintonCoin Onboarding System
 * Utiliza driver.js para guiar al usuario en su primera visita.
 */

// function to handle URL parameter for restarting tour
function checkAndRestartOnboarding() {
    const urlParams = new URLSearchParams(window.location.search);
    const startTourParam = urlParams.get('start_tour');
    const startWalletTourParam = urlParams.get('start_wallet_tour');

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
    } else if (startWalletTourParam === 'true') {
        // Flag de seguridad para evitar que contract-interaction.js fuerce otra pestaña durante la carga
        sessionStorage.setItem('pendingWalletTour', 'true');

        // URL cleanup handled here too
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: newUrl }, '', newUrl);

        // Wait for tab switch animation/render
        setTimeout(() => {
            startWalletTour();
        }, 1500);
    } else if (new URLSearchParams(window.location.search).get('start_burn_tour') === 'true') {
        // Nuevo Tour: Quemar Deuda
        sessionStorage.setItem('pendingWalletTour', 'true'); // También necesitamos ir a Billetera

        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: newUrl }, '', newUrl);

        setTimeout(() => {
            startBurnTour();
        }, 1500);
    } else if (new URLSearchParams(window.location.search).get('start_publish_tour') === 'true') {
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: newUrl }, '', newUrl);

        setTimeout(() => {
            startPublishTour();
        }, 500);
    } else if (new URLSearchParams(window.location.search).get('start_task_tour') === 'true') {
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: newUrl }, '', newUrl);

        setTimeout(() => {
            startTaskTour();
        }, 1500);
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

/**
 * Inicia el tour específico de la Billetera
 */
function startWalletTour() {
    if (!window.driver || !window.driver.js) {
        console.error("Driver.js no está cargado");
        return;
    }

    // 1. Forzar visualización de Billetera y ocultar modal via CSS
    document.body.classList.add('wallet-tour-active');

    // HACK: Pequeño delay para asegurar que el CSS aplique antes del click
    setTimeout(() => {
        const tabBilleteraBtn = document.getElementById('tabBilletera');
        if (tabBilleteraBtn) {
            tabBilleteraBtn.click();
        }
        // Ya estamos seguros, limpiar flag
        sessionStorage.removeItem('pendingWalletTour');
    }, 50);

    const driver = window.driver.js.driver;
    const driverObj = driver({
        showProgress: true,
        animate: true,
        allowClose: false,
        overlayClickNext: false,
        doneBtnText: '¡Entendido!',
        nextBtnText: 'Siguiente →',
        prevBtnText: '← Anterior',
        progressText: 'Paso {{current}} de {{total}}',
        onHighlightStarted: (element) => {
            if (element) {
                element.style.setProperty('pointer-events', 'none', 'important');
                element.addEventListener('click', blockInteraction, { capture: true });
                element.addEventListener('mousedown', blockInteraction, { capture: true });
                element.addEventListener('touchstart', blockInteraction, { capture: true });
                const children = element.querySelectorAll('*');
                children.forEach(child => child.style.setProperty('pointer-events', 'none', 'important'));
            }
        },
        onDeselected: (element) => {
            if (element) {
                element.style.pointerEvents = '';
                element.removeEventListener('click', blockInteraction, { capture: true });
                element.removeEventListener('mousedown', blockInteraction, { capture: true });
                element.removeEventListener('touchstart', blockInteraction, { capture: true });
                const children = element.querySelectorAll('*');
                children.forEach(child => child.style.pointerEvents = '');
            }
        },
        onDestroyStarted: () => {
            document.body.classList.remove('wallet-tour-active');
            sessionStorage.removeItem('suppressWalletModal'); // Limpieza legacy por si acaso

            // Asegurar desbloqueo de interacciones
            const activeElement = document.querySelector('.driver-active-element');
            if (activeElement) {
                activeElement.style.pointerEvents = '';
                activeElement.removeEventListener('click', blockInteraction, { capture: true });
            }

            // CORRECCIÓN: Asegurar que el modal se mantenga cerrado visualmente al quitar la clase CSS
            const prelaunchModal = document.getElementById('prelaunchWalletModal');
            if (prelaunchModal) {
                prelaunchModal.style.display = 'none';
            }

            // Cerrar también el modal de quema si quedó abierto
            const burnModal = document.getElementById('burnModal');
            if (burnModal) {
                burnModal.style.display = 'none';
            }

            // Forzar destrucción para evitar cuelgues
            driverObj.destroy();
        },
        steps: [
            {
                element: '#tabBilletera',
                popover: {
                    title: '👛 Tu Billetera',
                    description: 'Aquí gestionas tus fondos reales (BLUE y RED).',
                    side: "bottom",
                    align: 'center'
                }
            },
            {
                element: '.blue-section',
                popover: {
                    title: '🔵 Saldo BLUE',
                    description: 'Este es tu dinero disponible. Úsalo para pagar, comprar, ahorrar o eliminar tu deuda RED.',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '.red-section',
                popover: {
                    title: '🔴 Saldo RED (Deuda)',
                    description: 'Es tu deuda pendiente. Recuerda quemarla con BLUE antes de su vencimiento.',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '#burnTriggerBtn',
                popover: {
                    title: '🔥 Quemar Tokens',
                    description: 'Si tienes deuda, toca este botón para abrir la ventana de pagos.',
                    side: "top",
                    align: 'center'
                }
            }
        ]
    });


    driverObj.drive();
}

/**
 * Inicia el tour para Quemar Deuda (incluye abrir modal)
 */
function startBurnTour() {
    if (!window.driver || !window.driver.js) return;

    // 1. Preparar entorno (igual que wallet tour)
    document.body.classList.add('wallet-tour-active');

    setTimeout(() => {
        // Asegurar que estamos en Billetera
        const tabBilleteraBtn = document.getElementById('tabBilletera');
        if (tabBilleteraBtn) tabBilleteraBtn.click();
        sessionStorage.removeItem('pendingWalletTour');

        // Y ABRIR EL MODAL DE QUEMA
        setTimeout(() => {
            const burnTriggerBtn = document.getElementById('burnTriggerBtn');
            if (burnTriggerBtn) burnTriggerBtn.click();
        }, 100);

    }, 50);

    const driver = window.driver.js.driver;
    const driverObj = driver({
        showProgress: true,
        animate: true,
        allowClose: false,
        overlayClickNext: false,
        doneBtnText: '¡Entendido!',
        nextBtnText: 'Siguiente →',
        prevBtnText: '← Anterior',
        progressText: 'Paso {{current}} de {{total}}',
        onHighlightStarted: (element) => {
            // Bloqueo estándar (copiado de arriba)
            if (element) {
                element.style.setProperty('pointer-events', 'none', 'important');
                element.addEventListener('click', blockInteraction, { capture: true });
                element.addEventListener('mousedown', blockInteraction, { capture: true });
                element.addEventListener('touchstart', blockInteraction, { capture: true });
                const children = element.querySelectorAll('*');
                children.forEach(child => child.style.setProperty('pointer-events', 'none', 'important'));
            }
        },
        onDeselected: (element) => {
            if (element) {
                element.style.pointerEvents = '';
                element.removeEventListener('click', blockInteraction, { capture: true });
                element.removeEventListener('mousedown', blockInteraction, { capture: true });
                element.removeEventListener('touchstart', blockInteraction, { capture: true });
                const children = element.querySelectorAll('*');
                children.forEach(child => child.style.pointerEvents = '');
            }
        },
        onDestroyStarted: () => {
            document.body.classList.remove('wallet-tour-active');
            sessionStorage.removeItem('suppressWalletModal');

            const activeElement = document.querySelector('.driver-active-element');
            if (activeElement) {
                activeElement.style.pointerEvents = '';
                activeElement.removeEventListener('click', blockInteraction, { capture: true });
            }

            // En este tour, cerramos el modal de quema al terminar
            const burnModal = document.getElementById('burnModal');
            if (burnModal) burnModal.style.display = 'none';

            const prelaunchModal = document.getElementById('prelaunchWalletModal');
            if (prelaunchModal) prelaunchModal.style.display = 'none';

            driverObj.destroy();
        },
        steps: [
            {
                element: '#burnModalBalances',
                popover: {
                    title: '📊 Resumen de Saldos',
                    description: 'Aquí verás tus balances disponibles actualizados.',
                    side: "bottom",
                    align: 'center'
                }
            },
            {
                element: '#burnAmount',
                popover: {
                    title: '📝 Cantidad a Pagar',
                    description: 'Escribe aquí cuántos tokens RED quieres eliminar.',
                    side: "top",
                    align: 'center'
                }
            },
            {
                element: '#burnForm .burn-button',
                popover: {
                    title: '✅ Confirmar',
                    description: 'Presiona el botón para ejecutar la quema. ¡Es irreversible!',
                    side: "top",
                    align: 'center'
                }
            }
        ]
    });

    // Iniciar con delay mayor para que de tiempo a abrir el modal
    setTimeout(() => {
        driverObj.drive();
    }, 500);
}

/**
 * Función auxiliar para bloquear eventos de interacción
 */
function blockInteraction(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
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
                // 1. Bloqueo CSS (Visual y funcional básico)
                element.style.setProperty('pointer-events', 'none', 'important');

                // 2. Bloqueo JS Agresivo (Event Trapping)
                // Captura cualquier intento de click en la fase de captura (antes de que llegue al botón) y lo mata.
                element.addEventListener('click', blockInteraction, { capture: true });
                element.addEventListener('mousedown', blockInteraction, { capture: true });
                element.addEventListener('touchstart', blockInteraction, { capture: true });

                // Aplicar a hijos también por precaución
                const children = element.querySelectorAll('*');
                children.forEach(child => child.style.setProperty('pointer-events', 'none', 'important'));
            }
        },
        onDeselected: (element) => {
            if (element) {
                // Restaurar CSS
                element.style.pointerEvents = '';

                // Remover bloqueo JS
                element.removeEventListener('click', blockInteraction, { capture: true });
                element.removeEventListener('mousedown', blockInteraction, { capture: true });
                element.removeEventListener('touchstart', blockInteraction, { capture: true });

                const children = element.querySelectorAll('*');
                children.forEach(child => child.style.pointerEvents = '');
            }
        },
        steps: [
            {
                element: '.main-title-container',
                popover: {
                    title: '¡Bienvenido a WintonCoin!',
                    description: 'WintonCoin es el <b>Primer Marketplace Universal</b>. Una economía de intercambio real donde usas <b>BLUE</b> para pagar y <b>RED</b> para financiarte.',
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

/**
 * Inicia el tour para Crear Publicación
 */
function startPublishTour() {
    if (!window.driver || !window.driver.js) return;

    // 1. Abrir el modal de tipos (si existe)
    // Nota: Dependemos de que contract-interaction.html tenga este modal
    const pubModal = document.getElementById('publicationTypeModal');
    if (pubModal) {
        pubModal.style.display = 'flex'; // Usualmente flex para centrar
        // Asegurar que se vea por encima de todo si hay conflictos de z-index
        pubModal.style.zIndex = '10000';
    }

    const driver = window.driver.js.driver;
    const driverObj = driver({
        showProgress: true,
        animate: true,
        allowClose: false,
        overlayClickNext: false,
        doneBtnText: '¡Entendido!',
        nextBtnText: 'Siguiente →',
        prevBtnText: '← Anterior',
        progressText: 'Paso {{current}} de {{total}}',
        onHighlightStarted: (element) => {
            if (element) {
                // Bloqueo visual suave
                element.style.setProperty('pointer-events', 'none', 'important');
            }
        },
        onDeselected: (element) => {
            if (element) {
                element.style.pointerEvents = '';
            }
        },
        onDestroyStarted: () => {
            // Al cerrar el tour, cerramos el modal si el usuario no hizo click en una opción
            // Pero como el click en opción navega, si cancela el tour, cerramos modal.
            if (pubModal) pubModal.style.display = 'none';
            driverObj.destroy();
        },
        steps: [
            {
                element: '#publicationTypeModal .modal-content h2',
                popover: {
                    title: '📢 Crear Nueva Publicación',
                    description: 'Aquí puedes elegir qué tipo de interacción quieres iniciar en el mercado.',
                    side: "bottom",
                    align: 'center'
                }
            },
            {
                element: '#publicationTypeModal .modal-option-button.request',
                popover: {
                    title: '🙋‍♂️ Solicitar Ayudante',
                    description: 'Elige esta opción si necesitas contratar a alguien. <b>Pagarás con BLUE</b> (o generarás deuda RED si no tienes dinero).',
                    side: "top",
                    align: 'center'
                }
            },
            {
                element: '#publicationTypeModal .modal-option-button.sell',
                popover: {
                    title: '💼 Vender u Ofrecer',
                    description: 'Elige esta opción para ofrecer tus habilidades, productos o monedas. <b>Ganarás BLUE</b>.',
                    side: "top",
                    align: 'center'
                }
            },
            {
                element: '#publicationTypeModal .modal-option-button.donation',
                popover: {
                    title: '🙏 Recibir Donaciones',
                    description: 'Exclusivo para causas benéficas o emergencias reales. La comunidad podrá apoyarte con BLUE.',
                    side: "top",
                    align: 'center'
                }
            }
        ]
    });

    setTimeout(() => {
        driverObj.drive();
    }, 500);
}

/**
 * Inicia el tour para explicar los detalles de una Tarea/Publicación
 */
function startTaskTour() {
    if (!window.driver || !window.driver.js) return;

    // Función de espera personalizada
    const waitForElement = (selector, timeout = 8000) => {
        return new Promise((resolve) => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver((mutations) => {
                if (document.querySelector(selector)) {
                    resolve(document.querySelector(selector));
                    observer.disconnect();
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Timeout de seguridad
            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    };

    waitForElement('.publication-item').then((firstPub) => {
        if (!firstPub) {
            console.warn("No se encontraron publicaciones para el tour.");
            // Podríamos mostrar un mensaje al usuario aquí si fuera necesario
            return;
        }

        // Asegurar que sea visible y esté en el viewport
        firstPub.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Dar un momento para el scroll y renderizado final
        setTimeout(() => {
            runTaskDriver(firstPub);
        }, 800);
    });
}

function runTaskDriver(pubElement) {
    const driver = window.driver.js.driver;

    // Identificar selectores relativos a la tarjeta encontrada
    // Como driver.js usa selectores globales, vamos a añadir una clase temporal única a esta tarjeta
    // para poder seleccionarla específicamente y evitar conflictos
    const uniqueClass = 'driver-tour-highlight-' + Date.now();
    pubElement.classList.add(uniqueClass);

    const driverObj = driver({
        showProgress: true,
        animate: true,
        allowClose: false,
        overlayClickNext: false,
        doneBtnText: '¡Entendido!',
        nextBtnText: 'Siguiente →',
        prevBtnText: '← Anterior',
        progressText: 'Paso {{current}} de {{total}}',
        onHighlightStarted: (element) => {
            if (element) {
                // Bloquear interacciones para que el usuario solo observe
                element.style.setProperty('pointer-events', 'none', 'important');
            }
        },
        onDeselected: (element) => {
            if (element) {
                element.style.pointerEvents = '';
            }
        },
        onDestroyStarted: () => {
            // Limpiar la clase temporal
            pubElement.classList.remove(uniqueClass);
            driverObj.destroy();
        },
        steps: [
            {
                element: `.${uniqueClass}`,
                popover: {
                    title: '📝 Tarjeta de Tarea',
                    description: 'Cada recuadro representa una oportunidad de intercambio (tarea, venta o donación).',
                    side: "bottom",
                    align: 'center'
                }
            },
            {
                element: `.${uniqueClass} .publication-header h3`,
                popover: {
                    title: '📌 Título',
                    description: 'Indica qué se necesita hacer o qué se está ofreciendo.',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: `.${uniqueClass} .cost-ribbon-left`,
                popover: {
                    title: '💰 Recompensa / Costo',
                    description: 'La cantidad de <b>BLUE</b> involucrada en la transacción.',
                    side: "right",
                    align: 'center'
                }
            },
            {
                element: `.${uniqueClass} .pub-meta`,
                popover: {
                    title: '👤 Autor y Reputación',
                    description: 'Muestra quién publicó. Las <b>estrellas</b> indican su confiabilidad basada en tratos anteriores.',
                    side: "top",
                    align: 'start'
                }
            },
            {
                element: `.${uniqueClass} .slots-info`,
                popover: {
                    title: '🔢 Cupos',
                    description: 'Indica cuántas vacantes quedan disponibles para participar.',
                    side: "top",
                    align: 'end'
                }
            }
        ]
    });

    driverObj.drive();
}
