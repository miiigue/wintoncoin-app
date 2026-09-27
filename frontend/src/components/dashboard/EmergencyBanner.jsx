import React, { useState } from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: EmergencyBanner (React SPA 2026)
 * ============================================================================
 * Banner y modal de Campaña Humanitaria SOS Venezuela:
 * - Paridad 100% con #venezuelaEmergencyBanner y #venezuelaEmergencyModal
 * - Clases maestras de style.css (.venezuela-emergency-modal-overlay, etc.)
 * - Cero estilos inline en el modal, textos idénticos carácter por carácter.
 * ============================================================================
 */
export default function EmergencyBanner({ onSelectSolidarioFilter }) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  if (isDismissed) return null;

  const handleDonateClick = () => {
    setShowModal(false);
    if (onSelectSolidarioFilter) {
      onSelectSolidarioFilter();
    } else {
      window.location.href = 'sos-venezuela.html';
    }
  };

  return (
    <>
      {/* Banner de Emergencia Terremoto Venezuela */}
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

      {/* Modal de Emergencia Terremoto Venezuela (Paridad 100% con contract_interaction.html) */}
      {showModal && (
        <div
          id="venezuelaEmergencyModal"
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
                <span className="venezuela-emergency-badge">Campaña de Ayuda</span>
              </div>
            </div>
            <div className="venezuela-emergency-body">
              <h3 className="venezuela-emergency-title">SOS Venezuela: Dos Terremotos</h3>
              <p className="venezuela-emergency-text">
                Dos terremotos devastadores han afectado a Venezuela. Familias enteras se encuentran damnificadas y necesitan alimentos, refugio y auxilio de forma urgente.
              </p>
              <p className="venezuela-emergency-subtext">
                Si puedes ayudar desde donde estés donando tus tokens <strong>BLUE IOU</strong> acumulados de forma totalmente gratuita. El 100% de las donaciones llega a causas verificadas.
              </p>
              <div className="venezuela-emergency-actions">
                <button
                  type="button"
                  className="venezuela-emergency-btn confirm"
                  id="venezuelaEmergencyDonateBtn"
                  onClick={handleDonateClick}
                >
                  ❤️ Ir a Donar
                </button>
                <button
                  type="button"
                  className="venezuela-emergency-btn secondary"
                  id="venezuelaEmergencyCloseBtn"
                  onClick={() => setShowModal(false)}
                >
                  Quizás más tarde
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
