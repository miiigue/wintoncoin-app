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
            className="community-title"
            style={{
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

          {/* Banner de Cultura: Todos somos garantes del compromiso */}
          <div
            style={{
              width: '100%',
              maxWidth: '760px',
              margin: '0 auto 2.5rem auto',
              padding: '22px 26px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.9) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              textAlign: 'left',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.6rem',
                flexShrink: 0,
              }}
            >
              🤝
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  color: '#38bdf8',
                  marginBottom: '4px',
                }}
              >
                Respaldo Comunitario Descentralizado
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  lineHeight: 1.5,
                  color: '#f1f5f9',
                  fontWeight: 500,
                }}
              >
                Aquí la comunidad es el respaldo. <strong>Todos somos garantes y todos somos parte del compromiso</strong> que sostiene y da vida a nuestro ecosistema.
              </p>
            </div>
          </div>

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
          </ul>
        </div>
      </div>
    </section>
  );
}

export default CommunitySection;
