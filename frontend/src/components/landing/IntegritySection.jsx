import React from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - LANDING: IntegritySection (Gente de Palabra y Timeline)
 * ============================================================================
 * Sección de filtrado ético, cumplimiento KYC/AML y timeline interactivo
 * de los 5 hitos (Acceso, Filtro, Identidad, Sanción, Reputación).
 * ============================================================================
 */
function IntegritySection() {
  return (
    <section className="integrity-section" id="integridad">
      <div className="container">
        <div className="integrity-grid">
          <div className="integrity-content">
            <h2>
              Un ecosistema para <br />
              <span className="gradient-text-red-blue">Gente de Palabra</span>
            </h2>
            <p className="integrity-lead">
              WintonCoin no es para cualquiera. Es un espacio exclusivo diseñado para personas
              honestas, trabajadoras y cumplidoras de sus promesas. Si buscas atajos o pretendes
              estafar, este no es tu lugar.
            </p>
            <div className="integrity-visual-container">
              <img
                src="assets/images/landing/integrity_shield.png"
                alt="Escudo de Integridad WintonCoin"
                className="rounded-glow-img"
              />
            </div>
            <p className="legal-compliance-note">
              <strong>Cumplimiento y Seguridad:</strong> Bajo estándares internacionales de
              seguridad y normativas de prevención de fraude, implementamos verificación de
              identidad (KYC) y monitoreo inteligente para resguardar la integridad de los tokens y
              transacciones de nuestra comunidad.
            </p>
          </div>

          <div className="integrity-timeline-column">
            <div className="integrity-timeline-container">
              <div className="timeline-central-line"></div>

              <div className="timeline-item left-flow">
                <div className="timeline-dot dot-cyan"></div>
                <div className="timeline-content-box">
                  <span className="timeline-badge badge-welcome">01. Acceso</span>
                  <h4>Registro Transparente</h4>
                  <p>Gente honesta y trabajadora con intenciones claras de colaborar en el ecosistema.</p>
                </div>
              </div>

              <div className="timeline-item right-flow">
                <div className="timeline-dot dot-red"></div>
                <div className="timeline-content-box">
                  <span className="timeline-badge badge-restricted">02. Filtro</span>
                  <h4>Monitoreo Inteligente</h4>
                  <p>Sistemas automatizados de detección de patrones fraudulentos o cuentas duplicadas.</p>
                </div>
              </div>

              <div className="timeline-item left-flow">
                <div className="timeline-dot dot-cyan"></div>
                <div className="timeline-content-box">
                  <span className="timeline-badge badge-welcome">03. Identidad</span>
                  <h4>Verificación KYC/AML</h4>
                  <p>Validación de identidad estricta bajo estándares internacionales para proteger a la comunidad.</p>
                </div>
              </div>

              <div className="timeline-item right-flow">
                <div className="timeline-dot dot-red"></div>
                <div className="timeline-content-box">
                  <span className="timeline-badge badge-restricted">04. Sanción</span>
                  <h4>Tolerancia Cero</h4>
                  <p>Expulsión inmediata y permanente de estafadores, bloqueando su acceso en blockchain.</p>
                </div>
              </div>

              <div className="timeline-item left-flow">
                <div className="timeline-dot dot-cyan"></div>
                <div className="timeline-content-box">
                  <span className="timeline-badge badge-welcome">05. Reputación</span>
                  <h4>Crecimiento Sostenible</h4>
                  <p>Cumplir tus promesas eleva tu scoring, permitiendo emitir más valor y escalar.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default IntegritySection;
