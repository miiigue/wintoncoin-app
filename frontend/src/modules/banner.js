// ============================================================================
// WintonCoin - Módulo del Banner de Valor
// ============================================================================
// Funcionalidad del banner que muestra el valor de BLUE
// ============================================================================

/**
 * Inicializa el tooltip del banner de valor
 */
export function initializeValueTooltip() {
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
        }, 100);
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
        // Desktop: usar hover
        bannerText.addEventListener('mouseenter', showTooltip);
        bannerText.addEventListener('mouseleave', () => {
            tooltipTimeout = setTimeout(() => {
                if (!tooltip.matches(':hover')) {
                    hideTooltip();
                }
            }, 200);
        });
        bannerText.addEventListener('focus', showTooltip);
        bannerText.addEventListener('blur', () => {
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

    // Cerrar tooltip al hacer click fuera
    document.addEventListener('click', (e) => {
        if (isTooltipVisible && !tooltip.contains(e.target) && !bannerText.contains(e.target)) {
            hideTooltip();
        }
    });

    // Manejar teclado
    bannerText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleTooltip();
        } else if (e.key === 'Escape' && isTooltipVisible) {
            hideTooltip();
            bannerText.blur();
        }
    });

    // Cerrar tooltip al presionar Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isTooltipVisible) {
            hideTooltip();
            bannerText.blur();
        }
    });
}

/**
 * Inicializa el banner de valor estable
 */
export async function initializeValueBanner() {
    const banner = document.getElementById('value-banner');
    const bannerTextContainer = document.getElementById('banner-text-container');

    if (!banner || !bannerTextContainer) {
        return;
    }

    try {
        // Detectar la moneda local del usuario
        const userLocale = navigator.language || 'en-US';
        const currencyOptions = new Intl.NumberFormat(userLocale, { 
            style: 'currency', 
            currency: 'USD' 
        }).resolvedOptions();
        const localCurrency = currencyOptions.currency || 'USD';
        
        let bannerText = `1 BLUE iou = 1 BLUE = 1 USD`;
        
        // El texto final se envuelve en el span con la clase para el efecto
        bannerTextContainer.innerHTML = `<span class="shimmer-text">${bannerText}</span>`;
        banner.style.display = 'flex';

        // Inicializar funcionalidad del tooltip
        initializeValueTooltip();

    } catch (error) {
        console.error('Error al inicializar el banner de valor:', error);
        // Fallback unificado
        bannerTextContainer.innerHTML = `<span class="shimmer-text">1 BLUE iou = 1 BLUE = 1 USD</span>`;
        banner.style.display = 'flex';
        
        // Inicializar funcionalidad del tooltip incluso en caso de error
        initializeValueTooltip();
    }
}
