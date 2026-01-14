/* --- Funciones del Modal de Alerta Personalizado --- */

// Variable para guardar la acción a realizar después de cerrar el modal
let onAlertCloseCallback = null;

/**
 * Muestra un modal de alerta personalizado con un mensaje.
 * @param {string} message El mensaje a mostrar en el modal.
 * @param {function} [onClose] Una función opcional que se ejecutará cuando el modal se cierre.
 */
function showCustomAlert(message, onClose) {
    const container = document.getElementById('custom-alert-container');
    
    if (container) {
        // Limpiamos cualquier alerta anterior
        container.innerHTML = '';
        
        // Creamos la estructura del modal dinámicamente
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        const messageElement = document.createElement('p');
        messageElement.textContent = message;
        
        const closeButton = document.createElement('button');
        closeButton.className = 'action-button';
        closeButton.textContent = 'Cerrar';
        
        modalContent.appendChild(messageElement);
        modalContent.appendChild(closeButton);
        modal.appendChild(modalContent);
        container.appendChild(modal);
        
        onAlertCloseCallback = typeof onClose === 'function' ? onClose : null;

        const closeModal = () => {
            container.innerHTML = ''; // Limpiamos al cerrar
            if (onAlertCloseCallback) {
                onAlertCloseCallback();
                onAlertCloseCallback = null;
            }
        };

        closeButton.addEventListener('click', closeModal);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });
        
    } else {
        // Fallback al alert nativo si el contenedor no se encuentra
        alert(message);
        if (typeof onClose === 'function') {
            onClose();
        }
    }
}

/**
 * Cierra el modal de alerta personalizado y ejecuta el callback si existe.
 */
function closeCustomAlert() {
    const modal = document.getElementById('customAlertModal');
    if (modal) {
        modal.style.display = 'none';
    }

    // Si hay una función guardada, la ejecutamos y luego la limpiamos
    if (onAlertCloseCallback) {
        onAlertCloseCallback();
        onAlertCloseCallback = null;
    }
}

// --- Funciones del Modal de Confirmación ---
let onConfirmCallback = null;

/**
 * Muestra un modal de confirmación personalizado.
 * @param {string} message El mensaje a mostrar.
 * @param {function} onConfirm La función a ejecutar si el usuario confirma.
 */
function showCustomConfirm(message, onConfirm) {
    const modal = document.getElementById('customConfirmModal');
    const messageElement = document.getElementById('customConfirmMessage');
    
    if (modal && messageElement) {
        messageElement.textContent = message;
        onConfirmCallback = typeof onConfirm === 'function' ? onConfirm : null;
        modal.style.display = 'flex';
    } else {
        // Fallback al confirm nativo si el modal no se encuentra
        if (confirm(message)) {
            if (typeof onConfirm === 'function') {
                onConfirm();
            }
        }
    }
}

/**
 * Cierra el modal de confirmación y limpia el callback.
 */
function closeCustomConfirm() {
    const modal = document.getElementById('customConfirmModal');
    if (modal) {
        modal.style.display = 'none';
    }
    onConfirmCallback = null;
}

/**
 * Función interna que se llama al hacer clic en el botón de confirmar.
 */
function handleConfirm() {
    if (onConfirmCallback) {
        onConfirmCallback();
    }
    closeCustomConfirm();
}

// Es importante inicializar los listeners una vez que el DOM esté cargado.
// Podríamos añadir un inicializador aquí o asegurarnos de que se llama
// desde los otros scripts. Por simplicidad, añadiremos un listener aquí.
document.addEventListener('DOMContentLoaded', () => {
    const alertModal = document.getElementById('customAlertModal');
    const alertCloseButtons = document.querySelectorAll('.alert-close-button');
    const confirmModal = document.getElementById('customConfirmModal');

    // Listener global para cerrar modales al hacer clic fuera
    window.addEventListener('click', (event) => {
        if (event.target === alertModal) {
            closeCustomAlert();
        }
        if (event.target === confirmModal) {
            closeCustomConfirm();
        }
    });
    
    // Listeners para el modal de alerta
    if (alertModal) {
        alertCloseButtons.forEach(button => {
            button.addEventListener('click', closeCustomAlert);
        });
    }

    // Listeners para el modal de confirmación
    if (confirmModal) {
        const closeBtn = confirmModal.querySelector('.confirm-close-button');
        const cancelBtn = confirmModal.querySelector('.cancel-button');
        const confirmBtn = confirmModal.querySelector('.confirm-button');

        if (closeBtn) closeBtn.addEventListener('click', closeCustomConfirm);
        if (cancelBtn) cancelBtn.addEventListener('click', closeCustomConfirm);
        if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
    }
}); 

/**
 * Busca texto que parezca un enlace (http, https, www) y lo convierte en una etiqueta <a> clicable.
 * @param {string} text - El texto a procesar.
 * @returns {string} El texto con los enlaces convertidos a HTML.
 */
function linkify(text) {
    if (!text) return '';
    
    // Primero, escapamos el HTML básico para evitar inyección de XSS simple.
    // Esto convierte < en &lt;, etc.
    const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Regex para encontrar URLs.
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;

    return escapedText.replace(urlRegex, function(url) {
        // Para los enlaces que empiezan con 'www', añadimos 'http://' para que funcionen.
        const fullUrl = url.startsWith('www.') ? 'http://' + url : url;
        return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="embedded-link">${url}</a>`;
    });
}

// --- Configuración Global de la Aplicación ---

// Guardamos la configuración en una variable global para que todos los scripts puedan acceder a ella.
window.appSettings = {};

/**
 * Carga las configuraciones desde el backend y las almacena en window.appSettings.
 * @returns {Promise<void>}
 */
window.fetchAndStoreAppSettings = async function() {
    // Lógica para determinar la URL del API automáticamente
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';

    try {
        // Si ya hemos cargado la configuración, no la volvemos a pedir.
        if (Object.keys(window.appSettings).length > 0) {
            return;
        }

        const response = await fetch(`${API_URL}/api/app-settings`); // APUNTAMOS A LA NUEVA RUTA SEGURA
        if (!response.ok) {
            throw new Error('No se pudo cargar la configuración de la aplicación.');
        }
        const settingsObject = await response.json();
        
        window.appSettings = settingsObject;
        
        // Opcional: Disparar un evento para notificar que la configuración está lista
        document.dispatchEvent(new CustomEvent('app-settings-loaded'));

    } catch (error) {
        console.error('Error de red al cargar la configuración de la aplicación:', error);
        // En caso de error, podríamos querer manejarlo de alguna forma, 
        // por ahora solo lo mostraremos en la consola.
    }
};

// --- Gestión de Autenticación ---

// Variable global para almacenar la sesión del usuario.
window.userSession = {
    isAuthenticated: false,
    is_verified: false,
    username: null
};

/**
 * Verifica el estado de autenticación del usuario contra el backend.
 * Almacena el resultado en window.userSession.
 * @returns {Promise<object>} El estado de la sesión del usuario.
 */
window.checkAuthStatus = async function() {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${API_URL}/api/auth/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Si la respuesta no es OK (ej. 500), asumimos no autenticado.
            throw new Error('Error del servidor al verificar el estado.');
        }

        const status = await response.json();
        
        // Actualizamos la sesión global
        window.userSession = { ...status };

        // Disparamos un evento para que otras partes de la UI puedan reaccionar
        document.dispatchEvent(new CustomEvent('auth-status-checked', { detail: window.userSession }));

        return window.userSession;

    } catch (error) {
        console.error('Error al verificar el estado de autenticación:', error);
        
        // En caso de cualquier error, reseteamos al estado por defecto.
        window.userSession = { isAuthenticated: false, is_verified: false, username: null };
        document.dispatchEvent(new CustomEvent('auth-status-checked', { detail: window.userSession }));

        return window.userSession;
    }
}; 

// --- Banner de Valor Estable ---
// Se inicializa siempre, ya que no hay botón de cierre.
initializeValueBanner();


async function initializeValueBanner() {
    const banner = document.getElementById('value-banner');
    const bannerTextContainer = document.getElementById('banner-text-container');

    if (!banner || !bannerTextContainer) {
        return;
    }

    try {
        // 1. Detectar la moneda local del usuario
        const userLocale = navigator.language || 'en-US';
        const currencyOptions = new Intl.NumberFormat(userLocale, { style: 'currency', currency: 'USD' }).resolvedOptions();
        const localCurrency = currencyOptions.currency || 'USD';
        
        // CORRECCIÓN LÓGICA: Ahora el texto se construye en una variable
        let bannerText = '';

        if (localCurrency === 'USD') {
            bannerText = `$ VALOR ESTABLE: 1 BLUE = 1 USD`;
        } else {
            // 3. Obtener la tasa de cambio
            const response = await fetch('https://open.er-api.com/v6/latest/USD');
            if (!response.ok) throw new Error('No se pudo obtener la tasa de cambio.');
            
            const data = await response.json();
            const exchangeRate = data.rates[localCurrency];

            if (!exchangeRate) {
                bannerText = `$ VALOR ESTABLE: 1 BLUE = 1 USD`;
            } else {
                const localValue = (1 * exchangeRate).toFixed(2);
                // 4. Construir el texto final con la conversión
                bannerText = `$ VALOR ESTABLE: 1 BLUE = 1 USD ≈ ${localValue} ${localCurrency}`;
            }
        }
        
        // El texto final se envuelve en el span con la clase para el efecto
        bannerTextContainer.innerHTML = `<span class="shimmer-text">${bannerText}</span>`;
        banner.style.display = 'flex';

        // Inicializar funcionalidad del tooltip
        initializeValueTooltip();

    } catch (error) {
        console.error('Error al inicializar el banner de valor:', error);
        // Fallback unificado
        bannerTextContainer.innerHTML = `<span class="shimmer-text">$ VALOR ESTABLE: 1 BLUE = 1 USD</span>`;
        banner.style.display = 'flex';
        
        // Inicializar funcionalidad del tooltip incluso en caso de error
        initializeValueTooltip();
    }
}

// --- Funcionalidad del Tooltip del Banner de Valor ---
function initializeValueTooltip() {
    const bannerText = document.getElementById('banner-text-container');
    const tooltip = document.getElementById('value-tooltip');
    
    if (!bannerText || !tooltip) {
        return;
    }

    // Detectar si es dispositivo táctil
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    let tooltipTimeout = null;
    let isTooltipVisible = false;

    // Función para mostrar tooltip
    function showTooltip() {
        if (tooltipTimeout) {
            clearTimeout(tooltipTimeout);
        }
        tooltip.setAttribute('aria-hidden', 'false');
        tooltip.classList.add('show');
        isTooltipVisible = true;
    }

    // Función para ocultar tooltip
    function hideTooltip() {
        tooltipTimeout = setTimeout(() => {
            tooltip.setAttribute('aria-hidden', 'true');
            tooltip.classList.remove('show');
            isTooltipVisible = false;
        }, 100); // Pequeño delay para permitir hover
    }

    // Función para toggle tooltip (para móviles)
    function toggleTooltip() {
        if (isTooltipVisible) {
            hideTooltip();
        } else {
            showTooltip();
        }
    }

    if (isTouchDevice) {
        // Dispositivo táctil: usar click/tap
        bannerText.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTooltip();
        });
    } else {
        // Desktop: usar hover - el tooltip permanece visible sobre el texto y sobre el tooltip mismo
        bannerText.addEventListener('mouseenter', showTooltip);
        bannerText.addEventListener('mouseleave', () => {
            // No cerrar inmediatamente, esperar a ver si el mouse va al tooltip
            tooltipTimeout = setTimeout(() => {
                // Solo cerrar si el mouse no está sobre el tooltip
                if (!tooltip.matches(':hover')) {
                    hideTooltip();
                }
            }, 200);
        });
        bannerText.addEventListener('focus', showTooltip);
        bannerText.addEventListener('blur', () => {
            // Solo cerrar si no hay focus en el tooltip
            if (!tooltip.contains(document.activeElement)) {
                hideTooltip();
            }
        });
        
        // Mantener tooltip visible cuando el mouse está sobre él
        tooltip.addEventListener('mouseenter', () => {
            if (tooltipTimeout) {
                clearTimeout(tooltipTimeout);
            }
            showTooltip();
        });
        
        tooltip.addEventListener('mouseleave', hideTooltip);
    }

    // Cerrar tooltip al hacer click fuera (solo en móvil o cuando se hace click explícitamente fuera)
    document.addEventListener('click', (e) => {
        if (isTooltipVisible && !tooltip.contains(e.target) && !bannerText.contains(e.target)) {
            hideTooltip();
        }
    });

    // Manejar teclado: Enter para toggle, Escape para cerrar
    bannerText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleTooltip();
        } else if (e.key === 'Escape' && isTooltipVisible) {
            hideTooltip();
            bannerText.blur();
        }
    });

    // Cerrar tooltip al presionar Escape en cualquier parte
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isTooltipVisible) {
            hideTooltip();
            bannerText.blur();
        }
    });
}

// --- Sistema Global de Delegación de Eventos para Tooltips ---
// Almacenar referencias a todos los tooltips activos
const activeTooltips = new Map();

// Handler global para click fuera (delegación de eventos)
function handleGlobalClickOutside(e) {
    activeTooltips.forEach(({ trigger, tooltip, hideTooltip, isTooltipVisible }) => {
        if (isTooltipVisible() && !tooltip.contains(e.target) && !trigger.contains(e.target)) {
            hideTooltip();
        }
    });
}

// Handler global para Escape (delegación de eventos)
function handleGlobalEscapeKey(e) {
    if (e.key === 'Escape') {
        activeTooltips.forEach(({ tooltip, hideTooltip, isTooltipVisible, trigger }) => {
            if (isTooltipVisible() && tooltip.classList.contains('show')) {
                hideTooltip();
                trigger.blur();
            }
        });
    }
}

// Inicializar listeners globales una sola vez
let globalListenersInitialized = false;
function initializeGlobalTooltipListeners() {
    if (globalListenersInitialized) return;
    
    document.addEventListener('click', handleGlobalClickOutside);
    document.addEventListener('keydown', handleGlobalEscapeKey);
    globalListenersInitialized = true;
}

// --- Función Genérica para Inicializar Tooltips Informativos ---
/**
 * Inicializa un tooltip informativo para un elemento clickeable.
 * @param {string|HTMLElement} triggerSelector - Selector o elemento que activa el tooltip
 * @param {string|HTMLElement} tooltipSelector - Selector o elemento tooltip
 */
function initializeInfoTooltip(triggerSelector, tooltipSelector) {
    const trigger = typeof triggerSelector === 'string' 
        ? document.querySelector(triggerSelector) 
        : triggerSelector;
    const tooltip = typeof tooltipSelector === 'string'
        ? document.querySelector(tooltipSelector)
        : tooltipSelector;
    
    if (!trigger || !tooltip) {
        return;
    }

    // Detectar si es dispositivo táctil
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    let tooltipTimeout = null;
    let isTooltipVisible = false;

    // Función para mostrar tooltip
    function showTooltip() {
        if (tooltipTimeout) {
            clearTimeout(tooltipTimeout);
            tooltipTimeout = null;
        }
        tooltip.setAttribute('aria-hidden', 'false');
        tooltip.classList.add('show');
        isTooltipVisible = true;
    }

    // Función para ocultar tooltip
    function hideTooltip() {
        if (tooltipTimeout) {
            clearTimeout(tooltipTimeout);
        }
        tooltipTimeout = setTimeout(() => {
            tooltip.setAttribute('aria-hidden', 'true');
            tooltip.classList.remove('show');
            isTooltipVisible = false;
            tooltipTimeout = null;
        }, 100); // Pequeño delay para permitir hover
    }

    // Función para toggle tooltip (para móviles)
    function toggleTooltip() {
        if (isTooltipVisible) {
            hideTooltip();
        } else {
            showTooltip();
        }
    }

    // Función getter para el estado visible (para uso en handlers globales)
    function getIsTooltipVisible() {
        return isTooltipVisible;
    }

    if (isTouchDevice) {
        // Dispositivo táctil: usar click/tap
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTooltip();
        });
    } else {
        // Desktop: usar hover - el tooltip permanece visible sobre el texto y sobre el tooltip mismo
        trigger.addEventListener('mouseenter', showTooltip);
        trigger.addEventListener('mouseleave', () => {
            // No cerrar inmediatamente, esperar a ver si el mouse va al tooltip
            tooltipTimeout = setTimeout(() => {
                // Solo cerrar si el mouse no está sobre el tooltip
                if (!tooltip.matches(':hover')) {
                    hideTooltip();
                }
            }, 200);
        });
        trigger.addEventListener('focus', showTooltip);
        trigger.addEventListener('blur', () => {
            // Solo cerrar si no hay focus en el tooltip
            if (!tooltip.contains(document.activeElement)) {
                hideTooltip();
            }
        });
        
        // Mantener tooltip visible cuando el mouse está sobre él
        tooltip.addEventListener('mouseenter', () => {
            if (tooltipTimeout) {
                clearTimeout(tooltipTimeout);
                tooltipTimeout = null;
            }
            showTooltip();
        });
        
        tooltip.addEventListener('mouseleave', hideTooltip);
    }

    // Registrar este tooltip en el sistema global
    const tooltipId = tooltip.id || `tooltip-${Math.random().toString(36).substr(2, 9)}`;
    activeTooltips.set(tooltipId, {
        trigger,
        tooltip,
        hideTooltip,
        isTooltipVisible: getIsTooltipVisible
    });

    // Manejar teclado: Enter para toggle, Escape para cerrar
    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleTooltip();
        } else if (e.key === 'Escape' && isTooltipVisible) {
            hideTooltip();
            trigger.blur();
        }
    });
}

// --- Inicializar Todos los Tooltips Informativos ---
function initializeAllInfoTooltips() {
    // Inicializar listeners globales primero
    initializeGlobalTooltipListeners();
    
    // Tooltips de balances
    initializeInfoTooltip('[data-tooltip-id="tooltip-saldo-blue"]', '#tooltip-saldo-blue');
    initializeInfoTooltip('[data-tooltip-id="tooltip-disponibles"]', '#tooltip-disponibles');
    initializeInfoTooltip('[data-tooltip-id="tooltip-pendientes"]', '#tooltip-pendientes');
    initializeInfoTooltip('[data-tooltip-id="tooltip-saldo-red"]', '#tooltip-saldo-red');
    initializeInfoTooltip('[data-tooltip-id="tooltip-saldo-red-label"]', '#tooltip-saldo-red-label');
    
    // Tooltips de countdowns
    initializeInfoTooltip('[data-tooltip-id="tooltip-proximo-vencimiento"]', '#tooltip-proximo-vencimiento');
    initializeInfoTooltip('[data-tooltip-id="tooltip-proxima-liberacion"]', '#tooltip-proxima-liberacion');
    initializeInfoTooltip('[data-tooltip-id="tooltip-proxima-liberacion-escrow"]', '#tooltip-proxima-liberacion-escrow');
    initializeInfoTooltip('[data-tooltip-id="tooltip-prelaunch"]', '#tooltip-prelaunch');
}

// Inicializar tooltips cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    initializeAllInfoTooltips();
}); 