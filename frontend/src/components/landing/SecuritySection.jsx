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
            Seguridad de Grado <span className="text-green">Militar</span>
          </h2>
          <p>Tu confianza está codificada en la Blockchain. Inmutable. Transparente. Eterna.</p>
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
                <h3>Smart Contracts Auditados</h3>
              </div>
              <p>Código inquebrantable. Cada BLUE tiene su contraparte RED exacta. Cero errores humanos.</p>
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
                Acaparar tokens BLUE solo logra financiar los compromisos (RED) de la comunidad. Es imposible robar liquidez o manipular el mercado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SecuritySection;
