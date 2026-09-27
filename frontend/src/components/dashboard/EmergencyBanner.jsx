import React, { useState } from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: EmergencyBanner
 * ============================================================================
 * Banner de Campaña Humanitaria SOS Venezuela:
 * - Informa sobre la campaña de emergencia por terremotos.
 * - Permite donar tokens BLUE IOU sin costo para el usuario.
 * - Incluye modal interactivo con detalles y enlace directo a causas solidarias.
 * - Diseñado para no obstruir si el usuario decide cerrarlo.
 * ============================================================================
 */
export default function EmergencyBanner({ onSelectSolidarioFilter }) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  if (isDismissed) return null;

  return (
    <>
      <div id="venezuelaEmergencyBanner" className="emergency-banner">
        <div className="emergency-banner-content">
          <span className="emergency-badge">🚨 EMERGENCIA VENEZUELA</span>
          <span className="emergency-text">
            Dos Terremotos en Venezuela. Dona tus BLUE IOU acumulados gratis para apoyar.
          </span>
          <button
            id="emergencyBannerBtn"
            type="button"
            className="emergency-banner-btn"
            onClick={() => setShowModal(true)}
          >
            Ver Causas
          </button>
          <button
            id="closeEmergencyBanner"
            type="button"
            className="emergency-banner-close"
            onClick={() => setIsDismissed(true)}
            aria-label="Cerrar"
          >
            &times;
          </button>
        </div>
      </div>

      {showModal && (
        <div
          className="venezuela-emergency-modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="venezuela-emergency-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="venezuela-emergency-banner-img"
              style={{ backgroundImage: "url('./assets/images/venezuela_earthquake_banner.png')" }}
            >
              <div className="venezuela-emergency-img-overlay">
                <span className="emergency-badge" style={{ margin: '15px' }}>
                  CAMPAÑA DE AYUDA DIRECTA
                </span>
              </div>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.4rem', color: '#fff', marginBottom: '0.75rem', fontWeight: 700 }}>
                SOS Venezuela: Dos Terremotos
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                Dos terremotos devastadores han afectado a comunidades vulnerables en Venezuela. Familias enteras necesitan refugio, alimentos e insumos de emergencia.
              </p>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Puedes ayudar desde donde estés donando tus tokens <strong>BLUE IOU</strong> acumulados de forma totalmente gratuita. El 100% de lo recaudado se destina a casos verificados.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    if (onSelectSolidarioFilter) onSelectSolidarioFilter();
                  }}
                  style={{ flex: 1, background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: '#fff', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                >
                  ❤️ Ir a Donar
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer' }}
                >
                  Quizás luego
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
