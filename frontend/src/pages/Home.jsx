import React, { useEffect, useRef } from 'react';
import EmergencyBanner from '../components/landing/EmergencyBanner';
import HeroSection from '../components/landing/HeroSection';
import CommunitySection from '../components/landing/CommunitySection';
import StepsSection from '../components/landing/StepsSection';
import TrustSection from '../components/landing/TrustSection';
import IntegritySection from '../components/landing/IntegritySection';
import SecuritySection from '../components/landing/SecuritySection';
import CareersSection from '../components/landing/CareersSection';
import MarketplaceSection from '../components/landing/MarketplaceSection';
import GlassActionSection from '../components/landing/GlassActionSection';
import EconomicsSection from '../components/landing/EconomicsSection';
import FomoSection from '../components/landing/FomoSection';
import MomentumSection from '../components/landing/MomentumSection';
import SolidarioSection from '../components/landing/SolidarioSection';

/**
 * ============================================================================
 * [WINTONCOIN] - PÁGINA: Home (Landing Page Principal)
 * ============================================================================
 * Orquestador principal de la Landing Page.
 * 
 * Principios de Ingeniería:
 * - Single Responsibility Principle (SRP): Delega cada bloque en componentes puros.
 * - Performance: Un único IntersectionObserver centralizado que anima todos los
 *   nodos hijos (.timeline-item, .step-card, etc.) sin sobrecargar la memoria.
 * - Garbage Collection: Desconexión automática de elementos observados tras revelarse.
 * ============================================================================
 */
function Home() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    console.log('[React Home] Orquestador montado. Inicializando observador de animaciones.');

    // Elementos animados a lo largo de las 14 secciones modulares
    const animatedElements = containerRef.current.querySelectorAll(
      '.step-card, .trust-content, .token-card, .community-visual-section, .integrity-section, .timeline-item, .sec-card'
    );

    const scrollObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Optimización: Dejar de observar para liberar ciclos de CPU
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    animatedElements.forEach(el => {
      el.classList.add('fade-in-section');
      scrollObserver.observe(el);
    });

    return () => scrollObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      {/* 1. Campaña de Emergencia Venezuela */}
      <EmergencyBanner />

      {/* 2. Héroe y Monedas 3D Giratorias */}
      <HeroSection />

      {/* 3. Manifiesto y Valores de Comunidad */}
      <CommunitySection />

      {/* 4. Flujo Paso a Paso (El Poder de un Banco) */}
      <StepsSection />

      {/* 5. Red de Confianza y Anti-Especulación */}
      <TrustSection />

      {/* 6. Gente de Palabra y Timeline de 5 Hitos */}
      <IntegritySection />

      {/* 7. La Bóveda Inmutable de Seguridad 3D */}
      <SecuritySection />

      {/* 8. Reclutamiento y Talento */}
      <CareersSection />

      {/* 9. Galaxia de Servicios Marketplace */}
      <MarketplaceSection />

      {/* 10. Tu Capacidad es tu Capital */}
      <GlassActionSection />

      {/* 11. Economía Dual (Token BLUE y RED) */}
      <EconomicsSection />

      {/* 12. Viralidad y FOMO sin Bots */}
      <FomoSection />

      {/* 13. Programa Momentum para Creadores */}
      <MomentumSection />

      {/* 14. Winton Solidario */}
      <SolidarioSection />
    </div>
  );
}

export default Home;
