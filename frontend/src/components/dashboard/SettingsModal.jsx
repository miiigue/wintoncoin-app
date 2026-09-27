import React, { useState, useEffect } from 'react';
import { usePWA } from '../../context/PWAContext';
import { getApiUrl } from '../../modules/config';
import { showCustomAlert } from '../../modules/alerts';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: SettingsModal (React SPA 2026)
 * ============================================================================
 * Modal de configuración de usuario, preferencias y descarga PWA:
 * - Paridad visual 100% con #settingsModal de style.css y admin-switch.css.
 * - Tres switches canónicos de notificaciones:
 *   1. Seguridad y Transacciones (Siempre activo, inmutable por seguridad bancaria).
 *   2. Actividad Social.
 *   3. Novedades y Promociones.
 * - Guardado persistente contra PUT /api/notifications/settings.
 * - Sección de Descarga PWA (.settings-pwa-section) integrada con PWAContext.
 * - Cierre de sesión seguro.
 * ============================================================================
 */
export default function SettingsModal({ isOpen, onClose, onLogout }) {
  const { isInstallable, isInstalled, promptInstall } = usePWA();
  const [socialEnabled, setSocialEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pwaStatus, setPwaStatus] = useState('');

  // Cargar preferencias del backend al abrir el modal
  useEffect(() => {
    if (!isOpen) return;

    const loadSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const API_URL = getApiUrl();
        const res = await fetch(`${API_URL}/api/notifications/settings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSocialEnabled(data.social !== false);
          setMarketingEnabled(data.marketing !== false);
        }
      } catch (err) {
        console.warn('[SettingsModal] Error al cargar preferencias:', err);
      }
    };

    loadSettings();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showCustomAlert('Debes iniciar sesión para guardar la configuración.');
        return;
      }
      const API_URL = getApiUrl();
      const res = await fetch(`${API_URL}/api/notifications/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          settings: {
            social: socialEnabled,
            marketing: marketingEnabled,
            security: true,
            transactional: true
          }
        })
      });

      if (res.ok) {
        showCustomAlert('✅ Preferencias guardadas correctamente.');
      } else {
        showCustomAlert('Error al guardar las preferencias.');
      }
    } catch (err) {
      console.error('[SettingsModal] Error al guardar preferencias:', err);
      showCustomAlert('Error de conexión al guardar preferencias.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInstallClick = async () => {
    try {
      const success = await promptInstall();
      if (success) {
        setPwaStatus('¡Gracias por instalar WintonCoin!');
      } else {
        setPwaStatus('Instalación pospuesta o no disponible en este navegador.');
      }
    } catch (_) {
      setPwaStatus('Usa el menú del navegador: "Agregar a pantalla principal".');
    }
  };

  return (
    <div
      id="settingsModal"
      className="modal"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <span
          className="close-button"
          id="closeSettingsModal"
          onClick={onClose}
          role="button"
          tabIndex={0}
          aria-label="Cerrar"
        >
          &times;
        </span>

        <h2 style={{ marginBottom: '20px' }}>⚙️ Configuración</h2>

        {/* Sección de Notificaciones */}
        <div className="settings-section">
          <h3 style={{ marginBottom: '15px', color: '#4a90d9' }}>🔔 Notificaciones</h3>
          <p style={{ fontSize: '0.9em', color: '#888', marginBottom: '20px' }}>
            Controla qué tipo de notificaciones deseas recibir.
          </p>

          {/* Switch 1: Seguridad y Transacciones (Bloqueado) */}
          <div className="notification-setting-item">
            <div className="notification-setting-info">
              <strong>🔒 Seguridad y Transacciones</strong>
              <p style={{ fontSize: '0.85em', color: '#999', margin: '5px 0 0 0' }}>
                Alertas críticas de seguridad, pagos y verificaciones. <strong>Siempre activas.</strong>
              </p>
            </div>
            <label className="admin-switch" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
              <input type="checkbox" id="notifSecuritySwitch" checked disabled readOnly />
              <span className="admin-slider"></span>
            </label>
          </div>

          {/* Switch 2: Actividad Social */}
          <div className="notification-setting-item">
            <div className="notification-setting-info">
              <strong>👥 Actividad Social</strong>
              <p style={{ fontSize: '0.85em', color: '#999', margin: '5px 0 0 0' }}>
                Mensajes, interacciones, tareas completadas y actividad de tus publicaciones.
              </p>
            </div>
            <label className="admin-switch">
              <input
                type="checkbox"
                id="notifSocialSwitch"
                checked={socialEnabled}
                onChange={(e) => setSocialEnabled(e.target.checked)}
              />
              <span className="admin-slider"></span>
            </label>
          </div>

          {/* Switch 3: Novedades y Promociones */}
          <div className="notification-setting-item">
            <div className="notification-setting-info">
              <strong>📢 Novedades y Promociones</strong>
              <p style={{ fontSize: '0.85em', color: '#999', margin: '5px 0 0 0' }}>
                Nuevas campañas, bonos, actualizaciones de la plataforma y ofertas especiales.
              </p>
            </div>
            <label className="admin-switch">
              <input
                type="checkbox"
                id="notifMarketingSwitch"
                checked={marketingEnabled}
                onChange={(e) => setMarketingEnabled(e.target.checked)}
              />
              <span className="admin-slider"></span>
            </label>
          </div>

          <button
            id="saveNotificationSettings"
            type="button"
            className="action-button"
            style={{ marginTop: '25px', width: '100%' }}
            onClick={handleSaveSettings}
            disabled={isSaving}
          >
            {isSaving ? 'Guardando...' : 'Guardar Preferencias'}
          </button>
        </div>

        {/* Sección de Descarga de la Aplicación (PWA Install) */}
        <div className="settings-section settings-pwa-section" id="pwa-settings-section">
          <h3 style={{ marginBottom: '15px', color: '#00d4aa' }}>📲 Descargar App</h3>
          <p style={{ fontSize: '0.9em', color: '#888', marginBottom: '20px' }}>
            Instala WintonCoin en tu dispositivo para acceso rápido desde la pantalla de inicio.
          </p>
          {isInstalled ? (
            <div style={{ color: '#10b981', fontWeight: 600, fontSize: '0.9rem' }}>
              ✅ Aplicación instalada en este dispositivo
            </div>
          ) : (
            <button
              id="pwa-settings-install-btn"
              type="button"
              onClick={handleInstallClick}
            >
              📲 Descargar App
            </button>
          )}
          {pwaStatus && (
            <p id="pwa-settings-status" className="pwa-settings-status">
              {pwaStatus}
            </p>
          )}
        </div>

        {/* Botón de Cierre de Sesión Seguro */}
        {onLogout && (
          <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '15px' }}>
            <button
              type="button"
              className="action-button"
              style={{ width: '100%', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
              onClick={onLogout}
            >
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
