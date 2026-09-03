import React from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - LANDING: SolidarioSection (Winton Solidario & Causas Sociales)
 * ============================================================================
 * Muro de causas para salud, protección animal y educación.
 * Nota de cumplimiento: Se removió la fecha fija de canje para alineación legal.
 * ============================================================================
 */
function SolidarioSection() {
  return (
    <section className="humanitarian-section" id="solidario">
      <div className="glow-bg-solidario"></div>
      <div className="container">
        <div className="solidario-header-center">
          <h2 className="solidario-title-main">
            WintonCoin <span className="text-pink-gradient">Solidario</span>
          </h2>
          <div className="solidario-description-box">
            <p className="solidario-subtitle-v2">
              En este espacio, puedes exponer tu caso de salud, protección animal o educación para
              recibir donaciones directas.
            </p>
          </div>
        </div>

        <div className="solidario-main-flex">
          <div className="causes-mini-grid">
            <div className="cause-mini-pill">
              <i>🏥</i>
              <div className="cause-pill-txt">
                <strong>Salud y Esperanza</strong>
                <span>Apoyo médico vital</span>
              </div>
            </div>
            <div className="cause-mini-pill">
              <i>🐾</i>
              <div className="cause-pill-txt">
                <strong>Huellas de Bondad</strong>
                <span>Rescate animal</span>
              </div>
            </div>
            <div className="cause-mini-pill">
              <i>🎓</i>
              <div className="cause-pill-txt">
                <strong>Futuro Brillante</strong>
                <span>Educación</span>
              </div>
            </div>
          </div>
        </div>

        <div className="solidario-footer-actions">
          <div className="action-buttons">
            <a href="solicitud-solidaria.html" className="btn-solidario-premium">
              Postular Causa Solidaria
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SolidarioSection;
