import React from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - LANDING: GlassActionSection (Tu Capacidad es tu Capital)
 * ============================================================================
 * Tarjeta de estilo Glassmorphism que impulsa el trabajo como divisa líquida.
 * ============================================================================
 */
function GlassActionSection() {
  return (
    <section className="glass-action-section">
      <div className="container">
        <div className="glass-action-card">
          <div className="glass-action-content">
            <h3>Tu Capacidad es tu Capital.</h3>
            <p>
              En el ecosistema WintonCoin, el trabajo es una divisa líquida. Conecta con solicitudes
              reales, colabora y recibe BLUE (1:1 USD) de forma directa.
            </p>
          </div>
          <a href="ofrecer-ayuda.html" className="btn-ghost-silver">
            Comenzar a Generar
          </a>
        </div>
      </div>
    </section>
  );
}

export default GlassActionSection;
