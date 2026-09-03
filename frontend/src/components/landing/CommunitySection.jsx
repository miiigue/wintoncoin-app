import React from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - LANDING: CommunitySection (Comunidad y Visión)
 * ============================================================================
 * Manifiesto de impacto social y colaboración P2P sin fronteras.
 * ============================================================================
 */
function CommunitySection() {
  return (
    <section className="community-visual-section">
      <div className="container">
        <div
          style={{
            maxWidth: '850px',
            margin: '0 auto',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <h2
            style={{
              fontSize: '3.5rem',
              fontWeight: 800,
              lineHeight: 1.1,
              marginBottom: '2rem',
              fontFamily: 'var(--font-heading)',
              letterSpacing: '-1px',
            }}
          >
            <span className="text-blue">Comunidad</span>
          </h2>
          <p
            style={{
              fontSize: '1.25rem',
              lineHeight: 1.6,
              color: '#94a3b8',
              maxWidth: '700px',
              marginBottom: '2rem',
            }}
          >
            Imagina un mundo donde pedir ayuda no depende de tu saldo bancario, sino de tu voluntad de ayudar a otros mañana.
          </p>
          <ul
            className="check-list"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '2.5rem',
              listStyle: 'none',
              padding: 0,
              marginTop: '1rem',
            }}
          >
            <li
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              🤝 Conexiones P2P directas
            </li>
            <li
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              🌍 Sin fronteras ni intermediarios
            </li>
            <li
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              🤝 Trabajo colaborativo
            </li>
            <li
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              ⚡ Sin distinciones
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export default CommunitySection;
