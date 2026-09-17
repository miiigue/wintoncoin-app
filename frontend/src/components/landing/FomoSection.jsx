import React from 'react';
import { Link } from 'react-router-dom';

/**
 * ============================================================================
 * [WINTONCOIN] - LANDING: FomoSection (Viralidad & Cero Bots)
 * ============================================================================
 * Sección de conversión para influencers, marketing viral y amortización
 * garantizada por Smart Contracts en Blockchain.
 * ============================================================================
 */
function FomoSection() {
  return (
    <section className="fomo-viral-section">
      <div className="container">
        <div className="viral-grid">
          <div className="viral-content">
            <div className="badge-hot">🔥 ¡LA FIEBRE DEL ORO DIGITAL!</div>
            <h2>
              ¿Sueñas con ser <br />
              <span className="gradient-text-explosive">VIRAL?</span>
            </h2>
            <p className="viral-copy">
              Imagina miles de personas <strong>DESESPERADAS</strong> por ver tus videos, dar like a tus
              fotos y seguirte... ¡Solo para amortizar su compromiso en la red WintonCoin!
            </p>
            <ul className="viral-benefits">
              <li>
                <span className="icon">🚀</span>
                <span>
                  <strong>100% Atención Real:</strong> Usuarios reales motivados por su libertad
                  financiera.
                </span>
              </li>
              <li>
                <span className="icon">💎</span>
                <span>
                  <strong>Cero Bots:</strong> Cada view, like y comentario es verificado en Blockchain.
                </span>
              </li>
            </ul>
            <Link to="/register" className="btn-explosive">
              ¡Únete a la Fiebre AHORA!
            </Link>
          </div>
          <div className="viral-visual">
            <img
              src="assets/images/landing/stickman_viral_fomo.png"
              alt="Influencers WintonCoin Stickman"
              className="viral-hero-img"
            />
            <div className="float-icon icon-fb">f</div>
            <div className="float-icon icon-ig">📷</div>
            <div className="float-icon icon-yt">▶</div>
            <div className="float-icon icon-tt">🎵</div>
            <div className="float-icon icon-coin">🪙</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FomoSection;
