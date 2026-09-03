import React from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - LANDING: TrustSection (Anti-Especulación)
 * ============================================================================
 * Explicación de la solidez económica: Sin pre-minado, no ponzi,
 * respaldo 100% en trabajo real completado.
 * ============================================================================
 */
function TrustSection() {
  return (
    <section className="trust-section" id="valores">
      <div className="container">
        <div className="trust-grid">
          <div className="trust-content">
            <h2>
              Anti-Especulación y <span className="gradient-text">100% Real</span>
            </h2>
            <p className="trust-lead">
              Contrario a otras criptos, en WintonCoin no hay "aire". Todo valor está respaldado por
              trabajo ya realizado.
            </p>
            <div className="trust-points">
              <div className="point">
                <span className="icon-check">🛡️</span>
                <div>
                  <h4>Sin Pre-Minado (No Ponzi)</h4>
                  <p>No emitimos moneda de la nada. Cada BLUE nace de un servicio completado.</p>
                </div>
              </div>
              <div className="point">
                <span className="icon-check">🤝</span>
                <div>
                  <h4>Red de Confianza</h4>
                  <p>
                    Tu reputación es tu mayor activo. Cumple tus compromisos RED trabajando para otros y
                    sube de nivel.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="trust-visual">
            <img
              src="assets/images/landing/community_network.png"
              alt="Red Global Segura"
              className="rounded-glow-img"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default TrustSection;
