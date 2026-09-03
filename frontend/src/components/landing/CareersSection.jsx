import React from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - LANDING: CareersSection (Talento & Reclutamiento)
 * ============================================================================
 * Llamada a la acción para postularse al equipo de WintonCoin.
 * ============================================================================
 */
function CareersSection() {
  return (
    <section id="careers-landing" className="careers-landing-section">
      <div className="container">
        <div className="section-header-center">
          <h2>Únete al equipo</h2>
          <p>
            Buscamos personas con ganas de crecer y listos para escalar soluciones humanitarias y
            financieras reales con impacto mundial.
          </p>
        </div>
        <div className="careers-action-center">
          <a href="trabaja-con-nosotros.html" className="btn-careers-premium">
            Postularme
          </a>
        </div>
      </div>
    </section>
  );
}

export default CareersSection;
