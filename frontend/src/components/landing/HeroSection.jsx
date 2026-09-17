import React from 'react';
import { Link } from 'react-router-dom';

/**
 * ============================================================================
 * [WINTONCOIN] - LANDING: HeroSection (Propuesta de Valor Principal)
 * ============================================================================
 * Sección de entrada con monedas 3D giratorias (BLUE y RED),
 * estadísticas de estabilidad financiera (1 BLUE = 1 USD, 0% interés)
 * y llamada a la acción hacia el login.
 * ============================================================================
 */
function HeroSection() {
  return (
    <header className="hero-section">
      <div className="container">
        <div className="hero-content">
          <div className="badge-new">
            <span className="pulse"></span> Plataforma P2P Descentralizada
          </div>
          <h1 className="hero-title">
            ¿Necesitas ayuda y <span className="gradient-text">no tienes dinero?</span>
          </h1>
          <p className="hero-subtitle">
            En WintonCoin, tu capacidad de cumplir promesas es tu moneda.
            Solicita servicios y paga con <span className="text-blue">BLUE</span> sin necesidad de dinero,
            respaldando el intercambio con tu <span className="text-red">Compromiso (RED)</span>.
            Sin bancos, sin intereses, solo colaboración real.
          </p>
          <div className="cta-group">
            <Link to="/login" className="btn-primary">
              Iniciar Sesión <span className="arrow">→</span>
            </Link>
          </div>

          <div className="stats-ticker">
            <div className="stat-item">
              <span className="stat-value">1 BLUE = 1 USD</span>
              <span className="stat-label">Valor Estable</span>
            </div>
            <div className="divider"></div>
            <div className="stat-item">
              <span className="stat-value">0%</span>
              <span className="stat-label">Interés Bancario</span>
            </div>
            <div className="divider"></div>
            <div className="stat-item">
              <span className="stat-value">Instantáneo</span>
              <span className="stat-label">Sin historial financiero</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="coin-orbit-container">
            <div className="coin coin-blue coin-flip" style={{ '--orbit-delay': '0s' }}>
              <div className="coin-flipper">
                <div className="coin-front-logo">
                  <img src="assets/icons/logo-high-res.png" alt="BLUE Token" className="coin-logo-img" />
                </div>
                <div className="coin-back-logo">
                  <div className="coin-back-text">
                    Pagos<br />Inmediatos
                  </div>
                </div>
              </div>
            </div>
            <div className="coin coin-red coin-flip" style={{ '--orbit-delay': '-2s' }}>
              <div className="coin-flipper">
                <div className="coin-front-logo">
                  <img src="assets/images/landing/red_token_logo.png" alt="RED Token" className="coin-logo-img" />
                </div>
                <div className="coin-back-logo">
                  <div className="coin-back-text">
                    Tu<br />Compromiso
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default HeroSection;
