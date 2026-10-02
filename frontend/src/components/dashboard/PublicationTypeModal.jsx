import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../../modules/config';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: PublicationTypeModal (React SPA 2026)
 * ============================================================================
 * Modal selector del tipo de publicación a crear con paridad 100% idéntica al
 * HTML legado (#publicationTypeModal y #createPostPrelaunchModal):
 * 1. Solicitar un Ayudante (type=request): Contratar servicios pagando BLUE y asumiendo compromiso RED.
 * 2. Venta / Ofrecer Servicio (type=sell): Ofrecer productos, servicios o monedas a cambio de BLUE.
 * 3. Recibir Donaciones (type=donation): Recaudación comunitaria y causas solidarias.
 * 
 * Reglas de Pre-Lanzamiento y Compliance:
 * - Si el modo pre-lanzamiento está activo y el usuario no es de la plataforma,
 *   muestra primero el diálogo de aviso oficial (.prelaunch-modal-overlay)
 *   "Fase de Desarrollo", y al pulsar "Entendido" despliega las opciones.
 * - Erradicación absoluta de estilos inline; uso canónico de frontend/style.css.
 * - Estricta regla terminológica contable: "Compromiso RED" (nunca "deuda").
 * ============================================================================
 */
export default function PublicationTypeModal({
  isOpen,
  onClose,
  username = '',
}) {
  const [platformSettings, setPlatformSettings] = useState({
    pre_launch_mode_enabled: false,
    allow_request_publications: true,
    allow_sell_publications: true,
    allow_donation_publications: true,
    platform_username: 'wintoncoin'
  });
  const [showPrelaunchNotice, setShowPrelaunchNotice] = useState(false);

  // Consulta de configuración de plataforma al abrir el modal
  useEffect(() => {
    if (!isOpen) {
      setShowPrelaunchNotice(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        const API_URL = getApiUrl();
        const res = await fetch(`${API_URL}/api/platform-settings`);
        if (res.ok) {
          const data = await res.json();
          setPlatformSettings(data);

          // Si el modo pre-lanzamiento está habilitado y el usuario no es plataforma,
          // mostrar primero el modal de aviso de pre-lanzamiento como en el legacy
          const currentNormalized = (username || localStorage.getItem('username') || '').toLowerCase();
          const platformNormalized = (data.platform_username || 'wintoncoin').toLowerCase();
          const isPlatform = currentNormalized === platformNormalized || currentNormalized === 'plataforma' || currentNormalized === 'plataforma wintoncoin';

          if (data.pre_launch_mode_enabled && !isPlatform) {
            setShowPrelaunchNotice(true);
          } else {
            setShowPrelaunchNotice(false);
          }
        }
      } catch (err) {
        console.warn('[PublicationTypeModal] Aviso consultando platform settings:', err);
      }
    };

    fetchSettings();
  }, [isOpen, username]);

  if (!isOpen) return null;

  // Lógica de permisos de publicación según rol y fase
  const currentNormalized = (username || localStorage.getItem('username') || '').toLowerCase();
  const platformNormalized = (platformSettings.platform_username || 'wintoncoin').toLowerCase();
  const isPlatformUser = currentNormalized === platformNormalized || currentNormalized === 'plataforma' || currentNormalized === 'plataforma wintoncoin';
  const isPreLaunch = platformSettings.pre_launch_mode_enabled === true;

  const allowRequest = isPreLaunch ? isPlatformUser : platformSettings.allow_request_publications !== false;
  const allowSell = isPreLaunch ? isPlatformUser : platformSettings.allow_sell_publications !== false;
  const allowDonation = isPreLaunch ? isPlatformUser : platformSettings.allow_donation_publications !== false;

  const handleSelectType = (type) => {
    if (isPreLaunch && !isPlatformUser) {
      return;
    }
    onClose();
    window.location.href = `publish.html?type=${type}`;
  };

  return (
    <>
      {/* 1. Modal Aviso Pre-Lanzamiento (Aparece primero si pre-launch está activo) */}
      {showPrelaunchNotice && (
        <div
          className="prelaunch-modal-overlay"
          id="createPostPrelaunchModal"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="prelaunch-modal">
            <div className="prelaunch-modal-icon">🚀</div>
            <h3 className="prelaunch-modal-title">Fase de Desarrollo</h3>
            <div className="prelaunch-modal-text">
              <p>
                Durante la <strong>fase de pre-lanzamiento</strong>, la creación de publicaciones por parte de los usuarios está
                completamente deshabilitada.
              </p>
              <p>
                Solo la cuenta oficial de la plataforma puede publicar tareas con fines educativos, de promoción y pruebas del protocolo.
              </p>
            </div>
            <button
              type="button"
              className="prelaunch-modal-btn"
              id="createPostPrelaunchAccept"
              onClick={() => {
                setShowPrelaunchNotice(false);
                onClose();
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* 2. Modal Canónico de Selección de Tipo de Publicación (style.css #publicationTypeModal) */}
      {!showPrelaunchNotice && (
        <div
          id="publicationTypeModal"
          className="modal"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="modal-content">
            <span
              className="close-button publication-type-close"
              onClick={onClose}
              role="button"
              tabIndex={0}
              aria-label="Cerrar"
            >
              &times;
            </span>

            <h2>¿Qué te gustaría hacer?</h2>
            <p>Elige una opción para continuar. Cada acción te llevará a un formulario específico.</p>

            <div className="modal-options">
              {/* Opción 1: Solicitar un Ayudante (Request) */}
              <a
                href={allowRequest ? 'publish.html?type=request' : '#'}
                className={`modal-option-button request ${!allowRequest ? 'disabled' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  if (allowRequest) handleSelectType('request');
                }}
                style={!allowRequest ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
              >
                <div className="option-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor"
                    className="bi bi-person-plus" viewBox="0 0 16 16">
                    <path
                      d="M6 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H1s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C9.516 10.68 8.289 10 6 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z" />
                    <path fillRule="evenodd"
                      d="M13.5 5a.5.5 0 0 1 .5V7h1.5a.5.5 0 0 1 0 1H14v1.5a.5.5 0 0 1-1 0V8h-1.5a.5.5 0 0 1 0-1H13V5.5a.5.5 0 0 1 .5-.5z" />
                  </svg>
                </div>
                <h3>Solicitar un Ayudante</h3>
                <p>Pagarás BLUE a cambio de una tarea o servicio, asumirás compromiso RED.</p>
              </a>

              {/* Opción 2: Venta / Ofrecer Servicio (Sell) */}
              <a
                href={allowSell ? 'publish.html?type=sell' : '#'}
                className={`modal-option-button sell ${!allowSell ? 'disabled' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  if (allowSell) handleSelectType('sell');
                }}
                style={!allowSell ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
              >
                <div className="option-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor"
                    className="bi bi-tag" viewBox="0 0 16 16">
                    <path d="M6 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm-1 0a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0z" />
                    <path
                      d="M2 1h4.586a1 1 0 0 1 .707.293l7 7a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0l-7-7A1 1 0 0 1 1 6.586V2a1 1 0 0 1 1-1zm0 5.586 7 7L13.586 9l-7-7H2v4.586z" />
                  </svg>
                </div>
                <h3>Venta / Ofrecer Servicio</h3>
                <p>Recibirás BLUE por un producto, servicio o monedas que vendas a otros usuarios.</p>
              </a>

              {/* Opción 3: Recibir Donaciones (Donation) */}
              <a
                href={allowDonation ? (isPreLaunch ? 'solicitud-solidaria.html' : 'publish.html?type=donation') : '#'}
                className={`modal-option-button donation ${!allowDonation ? 'disabled' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  if (allowDonation) handleSelectType('donation');
                }}
                style={!allowDonation ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
              >
                <div className="option-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor"
                    className="bi bi-heart-fill" viewBox="0 0 16 16">
                    <path fillRule="evenodd"
                      d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z" />
                  </svg>
                </div>
                <h3>Recibir Donaciones</h3>
                <p>Publica una causa para recibir apoyo de la comunidad en BLUE.</p>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
