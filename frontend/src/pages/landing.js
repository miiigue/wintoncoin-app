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
                // Una vez que el elemento ya apreció, dejamos de observarlo para
                // liberar memoria RAM y ciclos de procesamiento.
                observer.unobserve(entry.target);
            }
        });
    }, { 
        threshold: 0.1, // El elemento debe ser al menos 10% visible para activarse
        rootMargin: "0px 0px -50px 0px" // Pequeño margen para que se vea antes de llegar al límite
    });

    // Seleccionamos todos los nodos del DOM que requieren la animación de entrada
    const animatedElements = document.querySelectorAll(
        '.step-card, .trust-content, .token-card, .community-visual-section'
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
});
