import '../../landing.css';
import '../../landing-fomo.css';

/**
 * ============================================================================
 * [WINTONCOIN] - LANDING PAGE CORE SCRIPT
 * ============================================================================
 * Maneja las interacciones principales, optimizaciones de rendimiento y
 * animaciones visuales (Parallax y Scroll) de la página de aterrizaje.
 * 
 * Estandarización Profesional:
 * - Renderizado Fluido (60 FPS) usando RequestAnimationFrame.
 * - Mobile-First: Bloqueo de cálculos innecesarios en dispositivos táctiles.
 * - Eficiencia de Memoria: Desconexión (Unobserve) automática en IntersectionObserver.
 * - Código estructurado, auditable y modular.
 * ============================================================================
 */
console.log('[Landing] Módulos inicializados. Motor gráfico listo.');

// Módulo de animaciones y observadores (Ejecutado cuando el DOM está listo)
document.addEventListener('DOMContentLoaded', () => {
    
    // ------------------------------------------------------------------------
    // 1. MÓDULO DE INTERSECCIÓN (ANIMACIONES DE SCROLL)
    // ------------------------------------------------------------------------
    /**
     * Observa los elementos cuando entran en el marco visible de la pantalla (Viewport).
     * @param {IntersectionObserverEntry[]} entries - Elementos observados
     * @param {IntersectionObserver} observer - Referencia al observador para auto-desconexión
     */
    const scrollObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            // Si el elemento cruza el umbral (10% visible)
            if (entry.isIntersecting) {
                // Añadir clase para activar transiciones CSS
                entry.target.classList.add('visible');
                
                // [OPTIMIZACIÓN PROFESIONAL] - Garbage Collection:
                // Una vez que el elemento ya apareció, dejamos de observarlo para
                // liberar memoria RAM y ciclos de procesamiento.
                observer.unobserve(entry.target);
            }
        });
    }, { 
        threshold: 0.1, // El elemento debe ser al menos 10% visible para activarse
        rootMargin: "0px 0px -50px 0px" // Pequeño margen para que se vea antes de llegar al límite
    });

    // Seleccionamos todos los nodos del DOM que requieren la animación de entrada
    // [CUMPLIMIENTO Y UX] - Agregamos la sección de integridad y cada nodo individual del timeline para que
    // se animen de forma secuencial y fluida a medida que entran en la pantalla del usuario (Viewport).
    const animatedElements = document.querySelectorAll(
        '.step-card, .trust-content, .token-card, .community-visual-section, .integrity-section, .timeline-item'
    );

    animatedElements.forEach(el => {
        // Agregamos la clase base inicial para prepararlos para la transición CSS
        el.classList.add('fade-in-section');
        scrollObserver.observe(el);
    });

    // ------------------------------------------------------------------------
    // 2. MÓDULO DE EFECTO PARALLAX INTERACTIVO (MOUSE HOVER)
    // ------------------------------------------------------------------------
    const floatingCards = document.querySelectorAll('.card-float');
    const heroFloatingImage = document.querySelector('.floating-img');
    
    // Variables para el ciclo de renderizado optimizado
    let rafId = null;
    let targetX = 0;
    let targetY = 0;

    // Detectar si el usuario está en un dispositivo táctil (Móvil/Tablet)
    // para NO ejecutar eventos de mouse innecesarios que estropean el Responsive.
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    if (!isTouchDevice && window.innerWidth > 768) {
        // Sólo se agrega el escuchador en Escritorio (Desktop)
        document.addEventListener('mousemove', (event) => {
            // Calculamos el desplazamiento basado en el centro de la pantalla
            targetX = (window.innerWidth - event.pageX * 2) / 100;
            targetY = (window.innerHeight - event.pageY * 2) / 100;
            
            // [OPTIMIZACIÓN PROFESIONAL] - RequestAnimationFrame
            // Si ya hay un cálculo pendiente en la cola del frame, lo cancelamos.
            // Esto previene los bloqueos del hilo principal (Jank) logrando 60 FPS fijos.
            if (rafId) {
                cancelAnimationFrame(rafId);
            }

            rafId = requestAnimationFrame(() => {
                // Aplicar transformaciones CSS utilizando aceleración de Hardware (GPU)
                floatingCards.forEach(card => {
                    card.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
                });

                if (heroFloatingImage) {
                    // El elemento principal visual se mueve en dirección contraria (efecto profundo)
                    heroFloatingImage.style.transform = `translate3d(${-targetX * 0.5}px, ${-targetY * 0.5}px, 0)`;
                }
            });
        });
    } else {
        console.log('[Landing] Parallax desactivado: Dispositivo Móvil Detectado (Optimización Batería).');
    }

    // ------------------------------------------------------------------------
    // 3. MÓDULO "VOLVER ARRIBA" (BACK TO TOP) - UX PROFESIONAL
    // ------------------------------------------------------------------------
    const backToTopBtn = document.getElementById('btn-back-to-top');
    
    // Listener de Scroll para mostrar/ocultar el botón
    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            // Obtenemos la cantidad de scroll vertical actual
            const scrollAmount = window.scrollY || document.documentElement.scrollTop;
            
            // Si el usuario bajó más de 400px, mostramos el botón
            if (scrollAmount > 400) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }
        });

        // Acción de click para volver al inicio suavemente
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth' // Desplazamiento nativo acelerado por el navegador
            });
            // [AUDITORÍA] Registro del uso de UX
            console.log('[Landing/UX] Botón "Volver Arriba" presionado por el usuario.');
        });
    }

    // ------------------------------------------------------------------------
    // 4. MÓDULO DE CONTADOR DE DONACIONES HUMANITARIAS (TICKER INTERPOLADO)
    // ------------------------------------------------------------------------
    /**
     * Módulo de transparencia e interpolación lineal de donaciones en tiempo real.
     * Consulta la API pública cada 3 minutos, calcula la diferencia, y si hay cambio
     * incrementa linealmente el contador en los siguientes 2 minutos (120s) a 60 FPS
     * usando requestAnimationFrame para garantizar suavidad y optimizar batería.
     */
    const tickerElements = {
        raised: document.getElementById('ticker-raised'),
        slots: document.getElementById('ticker-slots'),
        percent: document.getElementById('progress-percent'),
        fill: document.getElementById('progress-fill')
    };

    if (tickerElements.raised && tickerElements.slots) {
        const CAMPAIGN_GOAL = 100000.0000; // Meta fija de 100K BLUE IOU
        const POLL_INTERVAL = 180000; // 3 minutos
        const ANIMATION_DURATION = 120000; // 2 minutos de animación
        
        let currentDisplayValue = 0.0000;
        let targetValue = 0.0000;
        let animationStartValue = 0.0000;
        let animationStartTime = null;
        let animationFrameId = null;

        // Función para formatear el balance a 4 decimales
        function formatBalance(value) {
            return parseFloat(value).toFixed(4);
        }

        // Función para animar el contador frame a frame (Interpolación Lineal)
        function animateCounter(timestamp) {
            if (!animationStartTime) animationStartTime = timestamp;
            const elapsed = timestamp - animationStartTime;
            const progressRatio = Math.min(elapsed / ANIMATION_DURATION, 1);

            // Interpolación lineal: V_cur = V_start + ((V_target - V_start) * progressRatio)
            const currentVal = animationStartValue + (targetValue - animationStartValue) * progressRatio;
            currentDisplayValue = currentVal;

            // Actualizar interfaz
            tickerElements.raised.textContent = formatBalance(currentVal);
            updateProgressBar(currentVal);

            if (progressRatio < 1) {
                animationFrameId = requestAnimationFrame(animateCounter);
            } else {
                // Bloquear el valor final al terminar
                tickerElements.raised.textContent = formatBalance(targetValue);
                currentDisplayValue = targetValue;
                animationFrameId = null;
            }
        }

        // Función para actualizar la barra de progreso
        function updateProgressBar(value) {
            const percent = CAMPAIGN_GOAL > 0 ? Math.min(100, (value / CAMPAIGN_GOAL) * 100) : 0;
            tickerElements.percent.textContent = `${percent.toFixed(2)}%`;
            tickerElements.fill.style.width = `${percent.toFixed(2)}%`;
        }

        // Función para consultar los datos del servidor
        async function fetchCampaignStats() {
            try {
                // La URL se genera de forma relativa para funcionar tanto en localhost como en producción
                const response = await fetch('/api/solidario/campaign-stats');
                if (!response.ok) throw new Error('API error');
                const data = await response.json();

                const newTarget = parseFloat(data.total_raised) || 0.0000;
                const remainingSlots = parseInt(data.remaining_slots, 10);
                
                // Actualizar cupos en pantalla inmediatamente
                tickerElements.slots.textContent = remainingSlots.toLocaleString('es-ES');

                // Si es la primera petición, no animar; establecer el valor inicial de golpe
                if (currentDisplayValue === 0 && targetValue === 0) {
                    targetValue = newTarget;
                    currentDisplayValue = newTarget;
                    tickerElements.raised.textContent = formatBalance(newTarget);
                    updateProgressBar(newTarget);
                    console.log('[Landing/Ticker] Valor inicial fijado en:', newTarget);
                } else if (newTarget !== targetValue) {
                    // Si el valor del servidor cambió, iniciar la animación
                    console.log(`[Landing/Ticker] Actualización de saldo detectada: ${targetValue} -> ${newTarget}`);
                    
                    // Detener cualquier animación previa
                    if (animationFrameId) {
                        cancelAnimationFrame(animationFrameId);
                    }

                    animationStartValue = currentDisplayValue;
                    targetValue = newTarget;
                    animationStartTime = null; // Reiniciar temporizador de animación
                    animationFrameId = requestAnimationFrame(animateCounter);
                }
            } catch (err) {
                console.error('[Landing/Ticker] Error al obtener datos de la campaña:', err.message);
                // Degradación elegante: Si falla, mantener el valor anterior sin alterar la interfaz
            }
        }

        // Carga inicial inmediata
        fetchCampaignStats();

        // Sondeo periódico cada 3 minutos
        setInterval(fetchCampaignStats, POLL_INTERVAL);
        console.log('[Landing/Ticker] Módulo activo. Polling configurado cada 3 minutos.');
    }
});

