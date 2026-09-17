import React from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - LANDING: EconomicsSection (Economía Dual: BLUE y RED)
 * ============================================================================
 * Token BLUE (Liquidez, 1 BLUE = 1 USD) vs Token RED (Compromiso, 1 RED = -1 USD).
 * Cumplimiento legal FinTech (MiCA / Howey Test / SOC 2).
 * ============================================================================
 */
function EconomicsSection() {
  return (
    <section className="economics-section" id="economia">
      <div className="bg-blur"></div>
      <div className="container">
        <div className="section-header">
          <h2>Valor Real</h2>
          <p>Un sistema diseñado para la estabilidad perpetua.</p>
        </div>

        <div className="cards-duo">
          <div className="token-card blue-theme">
            <div className="token-header">
              <h3>Token BLUE</h3>
              <span className="badge">Liquidez</span>
            </div>
            <div className="price-tag">
              1 <span className="unit-fx">BLUE</span>
              <span className="eq-fx">=</span>
              1 <span className="dollar-fx">USD</span>
            </div>
            <p>
              Es capital líquido. Al participar ganas BLUE realizando actividades solicitadas por otros
              usuarios.
            </p>
          </div>

          <div className="token-card red-theme">
            <div className="token-header">
              <h3>Token RED</h3>
              <span className="badge">Obligaciones</span>
            </div>
            <div className="price-tag">
              1 <span className="unit-fx">RED</span>
              <span className="eq-fx">=</span>
              -1 <span className="dollar-fx">USD</span>
            </div>
            <p>
              Es tu promesa de valor futuro. Representa el compromiso de trabajo que debes a la comunidad
              WintonCoin.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default EconomicsSection;
