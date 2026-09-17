import React from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - LANDING: EmergencyBanner (Campaña Humanitaria Venezuela)
 * ============================================================================
 * Banner de alto impacto para la respuesta humanitaria y brigadas de rescate.
 * Enlaces directos a formularios de damnificados y voluntariado.
 * ============================================================================
 */
function EmergencyBanner() {
  return (
    <section className="emergency-hero-banner">
      <div className="emergency-banner-overlay"></div>
      <div className="container emergency-banner-container">
        <div className="emergency-banner-content">
          <h2>Ayudemos a Venezuela</h2>
          <p>Terremoto en Venezuela: Ayuda a reconstruir hoy.</p>
          <p
            className="highlight-pink"
            style={{
              fontWeight: 800,
              fontSize: '1.4rem',
              marginTop: '0.5rem',
              letterSpacing: '0.5px',
              textShadow: '0 2px 8px rgba(236,72,153,0.3)',
            }}
          >
            ¡Sí puedes ayudar!
          </p>
          <div className="emergency-banner-cta">
            <a href="sos-venezuela.html" className="btn-primary-campaign">
              Más información
            </a>
            <a href="sos-venezuela.html#registro-damnificados" className="btn-primary-campaign">
              Soy afectado
            </a>
            <a href="sos-venezuela.html#voluntariado" className="btn-primary-campaign">
              Quiero ser voluntario
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default EmergencyBanner;
