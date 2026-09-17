import React from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - LANDING: MomentumSection (Programa de Creadores)
 * ============================================================================
 * Programa de aceleración y monetización de audiencia para creadores de contenido.
 * ============================================================================
 */
function MomentumSection() {
  return (
    <section className="momentum-creators-section" id="momentum">
      <div className="container">
        <div className="momentum-divider"></div>
        <div className="momentum-badge">⚡ PROGRAMA PARA CREADORES</div>
        <h2 className="momentum-title">
          ¿Eres creador de contenido?<br />
          <span className="momentum-gradient-text">Monetiza tu influencia.</span>
        </h2>
        <p className="momentum-subtitle">
          Crea contenido y gana <strong>BLUE IOU</strong>. Estás minando dólares digitales futuros.
        </p>
        <a href="momentum-landing.html" className="momentum-cta">
          Creadores de contenido
        </a>
        <p className="momentum-disclaimer">Cupos limitados por fase.</p>
      </div>
    </section>
  );
}

export default MomentumSection;
