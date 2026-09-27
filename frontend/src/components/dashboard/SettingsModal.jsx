import React from 'react';
import { usePWA } from '../../context/PWAContext';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: SettingsModal
 * ============================================================================
 * Modal de configuración de usuario e instalación de la PWA:
 * - Integrado con PWAContext para lanzar el diálogo de instalación nativo.
 * - Ajuste de preferencias de notificaciones.
 * - Cierre de sesión seguro.
 * ============================================================================
 */
export default function SettingsModal({ isOpen, onClose, onLogout }) {
  const { isInstallable, isInstalled, promptInstall } = usePWA();

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const success = await promptInstall();
    if (success) {
      alert('¡Gracias por instalar WintonCoin!');
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
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          maxWidth: '460px',
          width: '100%',
          padding: '24px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          style={{ position: 'absolute', top: '18px', right: '18px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}
        >
          &times;
        </button>

        <h2 style={{ fontSize: '1.3rem', color: '#fff', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚙️</span> Configuración
        </h2>

        {/* Sección: Descarga e Instalación PWA */}
        <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1rem', color: '#38bdf8', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📲</span> Aplicación Móvil (PWA)
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.4, margin: '0 0 14px 0' }}>
            Instala WintonCoin en la pantalla de inicio de tu teléfono para una experiencia fluida a pantalla completa.
          </p>

          {isInstalled ? (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center' }}>
              ✅ Aplicación instalada en este dispositivo
            </div>
          ) : isInstallable ? (
            <button
              type="button"
              onClick={handleInstallClick}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #00d4aa 0%, #009e7e 100%)',
                color: '#fff',
                border: 'none',
                padding: '12px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0, 212, 170, 0.35)'
              }}
            >
              📲 Instalar App en Teléfono
            </button>
          ) : (
            <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
              Para instalar, abre el menú de tu navegador y selecciona "Agregar a la pantalla principal" o "Instalar aplicación".
            </div>
          )}
        </div>

        {/* Sección: Notificaciones */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', color: '#fff', margin: '0 0 12px 0' }}>
            🔔 Preferencias de Notificaciones
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#cbd5e1' }}>
              <span>Seguridad y Transacciones (Crítico)</span>
              <input type="checkbox" defaultChecked disabled />
            </label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#cbd5e1' }}>
              <span>Actividad en Publicaciones</span>
              <input type="checkbox" defaultChecked />
            </label>
          </div>
        </div>

        {/* Botón de Cierre de Sesión */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={onLogout}
            style={{
              width: '100%',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              padding: '12px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            🚪 Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
}
