import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../../modules/config';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: PublicationTypeModal (React SPA 2026)
 * ============================================================================
 * Modal selector del tipo de publicación a crear:
 * 1. Solicitar un Ayudante (type=request): Contratar servicios pagando BLUE y asumiendo compromiso RED.
 * 2. Venta / Ofrecer Servicio (type=sell): Ofrecer productos, servicios o monedas a cambio de BLUE.
 * 3. Recibir Donaciones (type=donation): Recaudación comunitaria y causas solidarias.
 * 
 * Cumplimiento de Políticas de Pre-lanzamiento:
 * - Valida en vivo las directivas del backend (/api/platform-settings).
 * - Protege los flujos según el rol del usuario (plataforma vs usuario general).
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
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const fetchSettings = async () => {
      try {
        const API_URL = getApiUrl();
        const res = await fetch(`${API_URL}/api/platform-settings`);
        if (res.ok) {
          const data = await res.json();
          setPlatformSettings(data);
        }
      } catch (err) {
        console.warn('[PublicationTypeModal] Aviso consultando platform settings:', err);
      } finally {
        setLoadingSettings(false);
      }
    };

    fetchSettings();
  }, [isOpen]);

  if (!isOpen) return null;

  // Lógica de permisos de publicación
  const currentNormalized = (username || localStorage.getItem('username') || '').toLowerCase();
  const platformNormalized = (platformSettings.platform_username || 'wintoncoin').toLowerCase();
  const isPlatformUser = currentNormalized === platformNormalized || currentNormalized === 'plataforma';

  const isPreLaunch = platformSettings.pre_launch_mode_enabled === true;
  const allowRequest = isPreLaunch ? isPlatformUser : platformSettings.allow_request_publications !== false;
  const allowSell = isPreLaunch ? isPlatformUser : platformSettings.allow_sell_publications !== false;
  const allowDonation = platformSettings.allow_donation_publications !== false;

  const handleSelectType = (type) => {
    onClose();
    if (type === 'donation' && isPreLaunch) {
      window.location.href = 'solicitud-solidaria.html';
    } else {
      window.location.href = `publish.html?type=${type}`;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '28px',
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
          position: 'relative',
          color: '#fff',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        {/* Botón Cerrar */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '1.5rem',
            cursor: 'pointer',
            lineHeight: 1
          }}
          aria-label="Cerrar"
        >
          &times;
        </button>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 8px 0', color: '#fff' }}>
          ¿Qué te gustaría hacer?
        </h2>
        <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: '0 0 24px 0', lineHeight: 1.5 }}>
          Elige una opción para continuar. Cada acción te llevará a su formulario específico.
        </p>

        {isPreLaunch && !isPlatformUser && (
          <div
            style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '20px',
              fontSize: '0.82rem',
              color: '#38bdf8',
              lineHeight: 1.4
            }}
          >
            🚀 <strong>Modo Pre-lanzamiento activo:</strong> Las publicaciones comerciales están restringidas. Puedes postular causas solidarias o participar en misiones comunitarias.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Opción 1: Solicitar un Ayudante */}
          <button
            type="button"
            disabled={!allowRequest}
            onClick={() => allowRequest && handleSelectType('request')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '16px',
              borderRadius: '16px',
              border: allowRequest ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
              background: allowRequest ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              cursor: allowRequest ? 'pointer' : 'not-allowed',
              opacity: allowRequest ? 1 : 0.45,
              textAlign: 'left',
              transition: 'all 0.2s',
              color: '#fff'
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(56, 189, 248, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                flexShrink: 0
              }}
            >
              🤝
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#38bdf8', marginBottom: '4px' }}>
                Solicitar un Ayudante
              </div>
              <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                Pagarás BLUE a cambio de una tarea o servicio, asumiendo compromiso RED amortizable.
              </div>
            </div>
          </button>

          {/* Opción 2: Venta / Ofrecer Servicio */}
          <button
            type="button"
            disabled={!allowSell}
            onClick={() => allowSell && handleSelectType('sell')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '16px',
              borderRadius: '16px',
              border: allowSell ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
              background: allowSell ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              cursor: allowSell ? 'pointer' : 'not-allowed',
              opacity: allowSell ? 1 : 0.45,
              textAlign: 'left',
              transition: 'all 0.2s',
              color: '#fff'
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                flexShrink: 0
              }}
            >
              🏷️
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#10b981', marginBottom: '4px' }}>
                Venta / Ofrecer Servicio
              </div>
              <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                Recibirás tokens BLUE por un producto, servicio o monedas que vendas a otros usuarios.
              </div>
            </div>
          </button>

          {/* Opción 3: Recibir Donaciones */}
          <button
            type="button"
            disabled={!allowDonation}
            onClick={() => allowDonation && handleSelectType('donation')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '16px',
              borderRadius: '16px',
              border: allowDonation ? '1px solid rgba(232, 62, 140, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
              background: allowDonation ? 'rgba(232, 62, 140, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              cursor: allowDonation ? 'pointer' : 'not-allowed',
              opacity: allowDonation ? 1 : 0.45,
              textAlign: 'left',
              transition: 'all 0.2s',
              color: '#fff'
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(232, 62, 140, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                flexShrink: 0
              }}
            >
              ❤️
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#e83e8c', marginBottom: '4px' }}>
                Recibir Donaciones
              </div>
              <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                Publica una causa benéfica o humanitaria para recibir apoyo voluntario en BLUE.
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
