// ============================================================================
// WintonCoin - Módulo de Tooltips
// ============================================================================
// Sistema global de delegación de eventos para tooltips informativos
// ============================================================================

// Almacenar referencias a todos los tooltips activos
const activeTooltips = new Map();

// Flag para inicialización de listeners globales
let globalListenersInitialized = false;

/**
 * Handler global para click fuera (delegación de eventos)
 * @param {Event} e
 */
function handleGlobalClickOutside(e) {
    activeTooltips.forEach(({ trigger, tooltip, hideTooltip, isTooltipVisible }) => {
        if (isTooltipVisible() && !tooltip.contains(e.target) && !trigger.contains(e.target)) {
            hideTooltip();
        }
    });
}

/**
 * Handler global para Escape (delegación de eventos)
 * @param {KeyboardEvent} e
 */
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

/**
 * Inicializa listeners globales una sola vez
 */
export function initializeGlobalTooltipListeners() {
    if (globalListenersInitialized) return;
    
    document.addEventListener('click', handleGlobalClickOutside);
    document.addEventListener('keydown', handleGlobalEscapeKey);
    globalListenersInitialized = true;
}

/**
 * Inicializa un tooltip informativo para un elemento clickeable.
 * @param {string|HTMLElement} triggerSelector - Selector o elemento que activa el tooltip
 * @param {string|HTMLElement} tooltipSelector - Selector o elemento tooltip
 */
export function initializeInfoTooltip(triggerSelector, tooltipSelector) {
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
        // Desktop: usar hover
        trigger.addEventListener('mouseenter', showTooltip);
        trigger.addEventListener('mouseleave', () => {
            // No cerrar inmediatamente, esperar a ver si el mouse va al tooltip
            tooltipTimeout = setTimeout(() => {
                if (!tooltip.matches(':hover')) {
                    hideTooltip();
                }
            }, 200);
        });
        trigger.addEventListener('focus', showTooltip);
        trigger.addEventListener('blur', () => {
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

/**
 * Inicializa Todos los Tooltips Informativos de la aplicación
 */
export function initializeAllInfoTooltips() {
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
