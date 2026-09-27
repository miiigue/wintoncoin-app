import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getApiUrl } from '../../modules/config';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: DashboardHeader (React SPA 2026)
 * ============================================================================
 * Barra superior del panel de usuario con paridad 100% con contract_interaction.html:
 * - Menú de perfil completo (incluye enlaces dinámicos a Momentum ⚡ y Donaciones ❤️).
 * - Menú de notificaciones en tiempo real conectado a /api/me/notifications.
 * - Acciones integradas: Limpiar (mark-read), Descartar individual (dismiss),
 *   y Centro de Historial Completo (/api/me/notifications/history).
 * - Cerrado automático al hacer clic fuera del elemento (UX estándar bancario).
 * ============================================================================
 */
export default function DashboardHeader({
  username = 'Usuario',
  unreadCount = 0,
  notifications = [],
  hasMomentum = false,
  hasDonations = false,
  onClearNotifications,
  onDismissNotification,
  onOpenSettings,
  onLogout
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  // Cerrar menús al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cargar historial de notificaciones
  const handleOpenHistory = async () => {
    setNotifOpen(false);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('token');
      const API_URL = getApiUrl();
      const res = await fetch(`${API_URL}/api/me/notifications/history`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('[DashboardHeader] Error al cargar historial de notificaciones:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Helper para asignar icono según el contenido del mensaje
  const getNotificationIcon = (msg = '') => {
    const lower = msg.toLowerCase();
    if (lower.includes('aprobada') || lower.includes('aprobado') || lower.includes('🎉') || lower.includes('✅')) return '✅';
    if (lower.includes('rechazada') || lower.includes('error') || lower.includes('⚠️') || lower.includes('❌')) return '⚠️';
    if (lower.includes('pagada') || lower.includes('acreditado') || lower.includes('ganado') || lower.includes('💰')) return '💰';
    if (lower.includes('solicitud') || lower.includes('📩') || lower.includes('participar')) return '📩';
    return '🔔';
  };

  // Helper para formatear fechas de notificaciones con tolerancia a fallos en WebView
  const formatDateSafe = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  };

  return (
    <>
      {/* ============================================================= */}
      {/* MENÚ ORIGINAL MÓVIL (header-menu) - Paridad visual legacy     */}
      {/* Clases CSS legacy: .header-menu, .profile-menu,               */}
      {/* .profile-trigger, .dropdown-content, .notification-menu,      */}
      {/* .notification-trigger, .notification-badge                    */}
      {/* Definidas en style.css líneas ~2637-2740                      */}
      {/* ============================================================= */}
      <div className="header-menu">
        {/* Menú de Perfil del Usuario */}
        <div className="profile-menu" ref={profileRef}>
          {/* Trigger: nombre de usuario + ícono hamburguesa (idéntico al HTML legado) */}
          <div
            className="profile-trigger"
            style={{ alignItems: 'flex-start', marginTop: '-10px', cursor: 'pointer' }}
            onClick={() => {
              setProfileOpen(prev => !prev);
              setNotifOpen(false);
            }}
            role="button"
            tabIndex={0}
            aria-expanded={profileOpen}
          >
            <span id="usernameDisplay">{username}</span>
            {/* Ícono hamburguesa SVG idéntico al HTML legado */}
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor"
              className="bi bi-list" viewBox="0 0 16 16" style={{ marginTop: '-2px', marginLeft: '8px' }}>
              <path fillRule="evenodd"
                d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z" />
            </svg>
          </div>

          {/* Dropdown de Perfil (misma estructura y enlaces que el HTML legado) */}
          {profileOpen && (
            <div className="dropdown-content" id="profileDropdown" style={{ display: 'block' }}>
              <a href="como-funciona.html" onClick={() => setProfileOpen(false)}>¿Cómo funciona?</a>
              <Link to="/exchange" style={{ color: '#38bdf8', fontWeight: 600 }} onClick={() => setProfileOpen(false)}>
                Exchange BLUE/USDT
              </Link>
              <a href="history.html" onClick={() => setProfileOpen(false)}>Historial</a>
              <a href="transactions.html" onClick={() => setProfileOpen(false)}>Transacciones</a>
              <a href="referrals.html" onClick={() => setProfileOpen(false)}>Referidos</a>
              <a href="booster-profile.html" onClick={() => setProfileOpen(false)}>Perfil de Impulsor</a>
              <a href="profile.html" id="menuUserProfile" style={{ color: '#ffffff', fontWeight: 600 }}
                onClick={() => setProfileOpen(false)}>👤 Mi Perfil</a>
              <Link to="/wallet" style={{ color: '#10B981', fontWeight: 600 }} onClick={() => setProfileOpen(false)}>
                Billetera Web3
              </Link>

              {/* Enlace dinámico Donaciones ❤️ (oculto por defecto, visible si tiene causas) */}
              {hasDonations && (
                <a href="solicitud-solidaria.html" id="menuSolidarioHistory"
                  style={{ color: '#e83e8c', fontWeight: 600 }} onClick={() => setProfileOpen(false)}>
                  Donaciones ❤️
                </a>
              )}

              {/* Enlace dinámico Winton Momentum ⚡ (oculto por defecto, visible si tiene tier activo) */}
              {hasMomentum && (
                <a href="momentum-dashboard.html" id="momentumMenuLink"
                  style={{ color: '#f59e0b', fontWeight: 600 }} onClick={() => setProfileOpen(false)}>
                  Winton Momentum ⚡
                </a>
              )}

              <a href="love.html" onClick={() => setProfileOpen(false)}>Página L.O.V.</a>
              <a href="documentation.html" onClick={() => setProfileOpen(false)}>Documentación</a>
              <a href="/" target="_blank" rel="noopener noreferrer" onClick={() => setProfileOpen(false)}>
                🌐 Ir al Sitio Web
              </a>
              <a href="#" id="openSettingsModal" onClick={(e) => {
                e.preventDefault();
                setProfileOpen(false);
                if (onOpenSettings) onOpenSettings();
              }}>⚙️ Configuración</a>
              <a href="#" id="logoutLink" onClick={(e) => {
                e.preventDefault();
                setProfileOpen(false);
                if (onLogout) onLogout();
              }}>Cerrar Sesión</a>
            </div>
          )}
        </div>

        {/* Menú de Notificaciones (campana + badge, idéntico al HTML legado) */}
        <div className="notification-menu" ref={notifRef}>
          <div
            className="notification-trigger"
            style={{ marginTop: '-5px', cursor: 'pointer' }}
            onClick={() => {
              setNotifOpen(prev => !prev);
              setProfileOpen(false);
            }}
            role="button"
            tabIndex={0}
            aria-label="Notificaciones"
          >
            {/* Campana SVG idéntica al HTML legado */}
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="currentColor"
              className="bi bi-bell-fill" viewBox="0 0 16 16">
              <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zm.995-14.901a1 1 0 1 0-1.99 0A5.002 5.002 0 0 0 3 6c0 1.098-.5 6-2.5 7h13c-2-1-2.5-5.902-2.5-7 0-2.42-1.72-4.44-4.005-4.901z" />
            </svg>
            {/* Badge de notificaciones no leídas (clase legacy .notification-badge) */}
            {unreadCount > 0 && (
              <span className="notification-badge" id="notificationBadge" style={{ display: 'flex' }}>
                {unreadCount}
              </span>
            )}
          </div>

          {/* Dropdown de Notificaciones */}
          {notifOpen && (
            <div className="dropdown-content" id="notificationDropdown" style={{ display: 'block' }}>
              {/* Acciones de Cabecera: Limpiar y Ver Historial */}
              <div className="notification-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.9rem', color: '#fff' }}>Notificaciones</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                  {notifications.length > 0 && (
                    <span className="notification-footer-link" style={{ cursor: 'pointer' }}
                      onClick={() => onClearNotifications && onClearNotifications()}>
                      Limpiar
                    </span>
                  )}
                  <span className="notification-footer-link" style={{ cursor: 'pointer' }}
                    onClick={handleOpenHistory}>
                    Ver historial
                  </span>
                </div>
              </div>

              {notifications.length === 0 ? (
                <p style={{ margin: '16px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No tienes notificaciones nuevas
                </p>
              ) : (
                notifications.map((n, i) => (
                  <div key={n.id || i} className="notification-item">
                    <p>
                      <span style={{ marginRight: '6px' }}>{getNotificationIcon(n.message)}</span>
                      {n.message || n.body}
                    </p>
                    {n.created_at && (
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                        {formatDateSafe(n.created_at)}
                      </div>
                    )}
                    <span
                      className="notification-dismiss"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDismissNotification) onDismissNotification(n.id);
                      }}
                      title="Descartar"
                    >
                      &times;
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Centro de Historial de Notificaciones (Paridad 100% con renderHistoryModal) */}
      {historyModalOpen && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '16px' }}
          onClick={() => setHistoryModalOpen(false)}
        >
          <div
            style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px', maxWidth: '500px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem', fontWeight: 700 }}>
                📜 Historial de Notificaciones
              </h3>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                  Cargando historial...
                </div>
              ) : historyItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                  Aún no tienes notificaciones en tu historial.
                </div>
              ) : (
                historyItems.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      background: item.is_read ? 'rgba(255, 255, 255, 0.02)' : 'rgba(56, 189, 248, 0.05)',
                      border: item.is_read ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(56, 189, 248, 0.2)',
                      borderRadius: '10px',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px'
                    }}
                  >
                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{getNotificationIcon(item.message)}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.85rem', lineHeight: 1.4 }}>
                        {item.message}
                      </p>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                        {new Date(item.created_at).toLocaleString('es-ES')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pie del Modal */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#cbd5e1', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
