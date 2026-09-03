import React from 'react';
import { Link } from 'react-router-dom';

/**
 * ============================================================================
 * [WINTONCOIN] - LANDING: MarketplaceSection (Galaxia de Servicios)
 * ============================================================================
 * Nube interactiva de tags con animación CSS flotante mostrando la diversidad
 * de oficios y servicios disponibles en el ecosistema P2P.
 * ============================================================================
 */
function MarketplaceSection() {
  return (
    <section className="marketplace-galaxy">
      <div className="container">
        <div className="galaxy-content">
          <h2>
            Un Universo de <span className="gradient-text">Servicios</span>
          </h2>
          <p>Desde lo cotidiano hasta lo extraordinario. Si puedes imaginarlo, puedes publicarlo.</p>

          <div className="tags-cloud">
            <span className="tag tag-large" style={{ '--d': '1s', '--x': '-20px', '--y': '-40px' }}>
              Taxi
            </span>
            <span className="tag tag-medium" style={{ '--d': '2s', '--x': '60px', '--y': '30px' }}>
              Jardinería
            </span>
            <span className="tag tag-small" style={{ '--d': '3s', '--x': '-80px', '--y': '60px' }}>
              Abogacía
            </span>
            <span className="tag tag-large" style={{ '--d': '4s', '--x': '90px', '--y': '-70px' }}>
              Marketing
            </span>
            <span className="tag tag-medium" style={{ '--d': '1.5s', '--x': '-100px', '--y': '-20px' }}>
              Limpieza
            </span>
            <span className="tag tag-small" style={{ '--d': '2.5s', '--x': '40px', '--y': '100px' }}>
              Plomería
            </span>
            <span className="tag tag-large" style={{ '--d': '3.5s', '--x': '-50px', '--y': '90px' }}>
              Mudanza
            </span>
            <span className="tag tag-medium" style={{ '--d': '0.5s', '--x': '120px', '--y': '0px' }}>
              Cuidado
            </span>
            <span className="tag tag-small" style={{ '--d': '4.5s', '--x': '-120px', '--y': '-80px' }}>
              Mecánica
            </span>
            <span className="tag tag-medium" style={{ '--d': '1.2s', '--x': '0px', '--y': '-120px' }}>
              Traducción
            </span>
            <span className="tag tag-large" style={{ '--d': '2.2s', '--x': '-140px', '--y': '40px' }}>
              Delivery
            </span>
            <span className="tag tag-medium" style={{ '--d': '3.8s', '--x': '140px', '--y': '-40px' }}>
              Vender
            </span>
            <span className="tag tag-medium" style={{ '--d': '1.8s', '--x': '50px', '--y': '-140px' }}>
              Comprar
            </span>
            <span className="tag tag-large" style={{ '--d': '0.8s', '--x': '-60px', '--y': '130px' }}>
              Restaurant
            </span>
          </div>

          <Link to="/register" className="btn-glow-large">
            Explorar Marketplace
          </Link>
        </div>
      </div>
    </section>
  );
}

export default MarketplaceSection;
