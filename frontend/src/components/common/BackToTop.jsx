import React, { useState, useEffect } from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - COMPONENTE: BackToTop (Volver Arriba)
 * ============================================================================
 * Proporciona un botón flotante de retorno al inicio de la página.
 * 
 * Principios de Ingeniería & Ciberseguridad:
 * - Rendimiento: Manejo pasivo del evento 'scroll' para no bloquear el hilo de UI.
 * - UX/UI: Desplazamiento fluido nativo (smooth scroll).
 * - Clean Code: Auto-limpieza (cleanup) del event listener al desmontar el componente.
 * ============================================================================
 */
function BackToTop() {
  // Estado que controla la visibilidad del botón en pantalla
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Umbral de scroll en píxeles para mostrar el botón
    const SCROLL_THRESHOLD_PX = 400;
    let rafId = null;

    /**
     * Handler optimizado con RequestAnimationFrame para evitar sobrecargar la GPU/CPU
     */
    const handleScroll = () => {
      if (rafId) return; // Throttling con RAF

      rafId = requestAnimationFrame(() => {
        const currentScroll = window.scrollY || document.documentElement.scrollTop;
        setIsVisible(currentScroll > SCROLL_THRESHOLD_PX);
        rafId = null;
      });
    };

    // Registro de escucha pasiva (no bloquea el renderizado)
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Limpieza obligatoria para prevenir memory leaks
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  /**
   * Ejecuta el scroll suave hacia la cabecera
   */
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <button
      id="btn-back-to-top"
      className={`back-to-top-btn ${isVisible ? 'show' : ''}`}
      onClick={scrollToTop}
      aria-label="Volver arriba"
      title="Volver al inicio"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}

export default BackToTop;
