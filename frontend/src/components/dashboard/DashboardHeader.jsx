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
      <div className="header-menu" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        {/* Menú de Perfil del Usuario */}
        <div className="profile-menu" ref={profileRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="profile-trigger"
            onClick={() => {
              setProfileOpen(prev => !prev);
              setNotifOpen(false);
            }}
            style={{ background: 'none', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px', fontSize: '1rem', fontWeight: 600 }}
            aria-expanded={profileOpen}
          >
            <span>👤 {username}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" style={{ transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z" />
            </svg>
          </button>

          {profileOpen && (
            <div className="dropdown-content show" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '8px 0', minWidth: '220px', zIndex: 1000, boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)' }}>
              <Link to="/wallet" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', color: '#10B981', textDecoration: 'none', fontWeight: 700 }} onClick={() => setProfileOpen(false)}>
                <span>💳</span> Billetera Web3
              </Link>
              <Link to="/exchange" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', color: '#38bdf8', textDecoration: 'none', fontWeight: 700 }} onClick={() => setProfileOpen(false)}>
                <span>💱</span> Exchange BLUE/USDT
              </Link>

              {/* Enlace dinámico Winton Momentum ⚡ si el usuario tiene tier activo */}
              {hasMomentum && (
                <a href="momentum-dashboard.html" style={{ display: 'block', padding: '8px 16px', color: '#f59e0b', textDecoration: 'none', fontWeight: 600 }} onClick={() => setProfileOpen(false)}>
                  Winton Momentum ⚡
                </a>
              )}

              {/* Enlace dinámico Donaciones ❤️ */}
              {hasDonations && (
                <a href="solicitud-solidaria.html" style={{ display: 'block', padding: '8px 16px', color: '#e83e8c', textDecoration: 'none', fontWeight: 600 }} onClick={() => setProfileOpen(false)}>
                  Donaciones ❤️
                </a>
              )}

              <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />
              <a href="como-funciona.html" style={{ display: 'block', padding: '8px 16px', color: '#cbd5e1', textDecoration: 'none' }} onClick={() => setProfileOpen(false)}>¿Cómo funciona?</a>
              <a href="history.html" style={{ display: 'block', padding: '8px 16px', color: '#cbd5e1', textDecoration: 'none' }} onClick={() => setProfileOpen(false)}>Historial</a>
              <a href="transactions.html" style={{ display: 'block', padding: '8px 16px', color: '#cbd5e1', textDecoration: 'none' }} onClick={() => setProfileOpen(false)}>Transacciones</a>
              <a href="estado-cuenta.html" style={{ display: 'block', padding: '8px 16px', color: '#38bdf8', textDecoration: 'none' }} onClick={() => setProfileOpen(false)}>📄 Estado de Cuenta</a>
              <a href="referrals.html" style={{ display: 'block', padding: '8px 16px', color: '#cbd5e1', textDecoration: 'none' }} onClick={() => setProfileOpen(false)}>Referidos</a>
              <a href="booster-profile.html" style={{ display: 'block', padding: '8px 16px', color: '#cbd5e1', textDecoration: 'none' }} onClick={() => setProfileOpen(false)}>Perfil de Impulsor</a>
              <a href="profile.html" style={{ display: 'block', padding: '8px 16px', color: '#cbd5e1', textDecoration: 'none' }} onClick={() => setProfileOpen(false)}>👤 Mi Perfil</a>
              <a href="love.html" style={{ display: 'block', padding: '8px 16px', color: '#cbd5e1', textDecoration: 'none' }} onClick={() => setProfileOpen(false)}>Página L.O.V.</a>
              <a href="documentation.html" style={{ display: 'block', padding: '8px 16px', color: '#cbd5e1', textDecoration: 'none' }} onClick={() => setProfileOpen(false)}>Documentación</a>
              <a href="/" target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '8px 16px', color: '#cbd5e1', textDecoration: 'none' }} onClick={() => setProfileOpen(false)}>🌐 Ir al Sitio Web</a>
              <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  if (onOpenSettings) onOpenSettings();
                }}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '8px 16px', color: '#38bdf8', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                ⚙️ Configuración & App
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  if (onLogout) onLogout();
                }}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '8px 16px', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
              >
                🚪 Cerrar Sesión
              </button>
            </div>
          )}
        </div>

        {/* Menú de Notificaciones */}
        <div className="notification-menu" ref={notifRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="notification-trigger"
            onClick={() => {
              setNotifOpen(prev => !prev);
              setProfileOpen(false);
            }}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', padding: '6px' }}
            aria-label="Notificaciones"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zm.995-14.901a1 1 0 1 0-1.99 0A5.002 5.002 0 0 0 3 6c0 1.098-.5 6-2.5 7h13c-2-1-2.5-5.902-2.5-7 0-2.42-1.72-4.44-4.005-4.901z" />
            </svg>
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: '0', right: '0', background: '#ef4444', color: '#fff', borderRadius: '50%', fontSize: '0.7rem', fontWeight: 700, padding: '2px 5px', lineHeight: 1 }}>
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="dropdown-content show" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '12px', minWidth: '300px', maxWidth: '340px', zIndex: 1000, boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)' }}>
              {/* Acciones de Cabecera: Limpiar y Ver Historial */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
                <strong style={{ fontSize: '0.9rem', color: '#fff' }}>Notificaciones</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onClearNotifications && onClearNotifications()}
                      style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0, fontSize: '0.75rem', fontWeight: 600 }}
                    >
                      Limpiar
                    </button>
                  )}
                  <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
                  <button
                    type="button"
                    onClick={handleOpenHistory}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, fontSize: '0.75rem' }}
                  >
                    Ver historial
                  </button>
                </div>
              </div>

              {notifications.length === 0 ? (
                <p style={{ margin: '16px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No tienes notificaciones nuevas
                </p>
              ) : (
                <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {notifications.map((n, i) => (
                    <div
                      key={n.id || i}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        padding: '10px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        color: '#cbd5e1',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        position: 'relative'
                      }}
                    >
                      <span style={{ fontSize: '1rem', lineHeight: 1.2 }}>{getNotificationIcon(n.message)}</span>
                      <div style={{ flex: 1, paddingRight: '16px' }}>
                        <div style={{ lineHeight: 1.4 }}>{n.message || n.body}</div>
                        {n.created_at && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                            {formatDateSafe(n.created_at)}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onDismissNotification) onDismissNotification(n.id);
                        }}
                        style={{ position: 'absolute', top: '6px', right: '6px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '2px' }}
                        title="Descartar"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
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
