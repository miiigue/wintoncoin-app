import React from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - LANDING: StepsSection (Cómo Funciona - 3 Pasos)
 * ============================================================================
 * Explicación visual del flujo: Publicar Necesidad -> Elegir Experto -> Mintear Tokens.
 * ============================================================================
 */
function StepsSection() {
  return (
    <section className="steps-section" id="como-funciona">
      <div className="container">
        <div className="section-header">
          <h2>
            El Poder de un Banco <br />
            <span className="text-blue">en tus manos</span>
          </h2>
          <p>Olvídate del dinero FIAT. Aquí emites tu propia moneda al momento de pagar.</p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">01</div>
            <div className="step-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <h3>Publicas tu Necesidad</h3>
            <p>
              Describe qué necesitas (ej. pintar una pared, desarrollo web). Ofrece una cantidad de BLUE.{' '}
              <strong>No necesitas tener saldo previo, en ningún momento.</strong>
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">02</div>
            <div className="step-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3>Eliges al Experto</h3>
            <p>
              Revisa perfiles y acepta a un colaborador calificado. La comunidad está llena de talento
              dispuesto a ayudar.
            </p>
          </div>

          <div className="step-card highlight-step">
            <div className="step-number">03</div>
            <div className="step-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3>Confirmas y "Minteas"</h3>
            <p>
              Al confirmar el trabajo, el Smart Contract crea automáticamente los Tokens BLUE (para el
              trabajador) y RED (tu compromiso de reciprocidad).
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <a
            href="pedir-ayuda.html"
            className="btn-secondary"
            style={{
              display: 'inline-block',
              padding: '1rem 2rem',
              border: '1px solid var(--accent-blue)',
              color: '#ffffff',
              background: 'rgba(59, 130, 246, 0.1)',
            }}
          >
            Ver Guía Detallada
          </a>
        </div>
      </div>
    </section>
  );
}

export default StepsSection;
