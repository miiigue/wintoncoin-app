import React from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - LANDING: SecuritySection (La Bóveda Inmutable 3D)
 * ============================================================================
 * Demostración visual de ciberseguridad con cubo 3D giratorio CSS puro
 * y bloques de datos de auditoría, inmutabilidad y anti-ballenas.
 * ============================================================================
 */
function SecuritySection() {
  return (
    <section className="security-section">
      <div className="container">
        <div className="section-title-center">
          <h2>
            Seguridad y Transparencia <span className="text-green">Verificable</span>
          </h2>
          <p>Reglas registradas y verificables en blockchain, sujetas a auditoría y a los riesgos técnicos informados.</p>
        </div>

        <div className="security-grid">
          <div className="cube-container">
            <div className="cube">
              <div className="face front">AUDITORÍA</div>
              <div className="face back">TRANSPARENCIA</div>
              <div className="face right">SEGURIDAD</div>
              <div className="face left">BLOCKCHAIN</div>
              <div className="face top">WINTONCOIN</div>
              <div className="face bottom">IMMUTABLE</div>
            </div>
            <div className="scanner-laser"></div>
          </div>

          <div className="security-features two-cols">
            <div className="sec-card data-block">
              <div className="data-header">
                <span className="block-id">BLK_001</span>
                <h3>Arquitectura de Smart Contracts</h3>
              </div>
              <p>Reglas de emisión y quema automatizadas on-chain. Cada token BLUE tiene su compromiso RED equivalente 1:1.</p>
            </div>

            <div className="sec-card data-block">
              <div className="data-header">
                <span className="block-id">BLK_002</span>
                <h3>Transparencia Total</h3>
              </div>
              <p>Cada transacción es pública. Sin libros contables ocultos. Verificable por cualquiera, para siempre.</p>
            </div>

            <div className="sec-card data-block">
              <div className="data-header">
                <span className="block-id">BLK_003</span>
                <div className="data-header-stack">
                  <h3>Anti-Rug Pull</h3>
                  <h3>Anti-Ballenas</h3>
                </div>
              </div>
              <p>
                El diseño pareado y los controles del protocolo buscan reducir desequilibrios y dificultar abusos; no eliminan todos los riesgos técnicos, económicos o de mercado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SecuritySection;
