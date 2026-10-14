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
  onOpenSolidarioHistory,
  onLogout
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [copiedHash, setCopiedHash] = useState(null);

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

  // Helper para clasificar y separar metadatos de notificaciones (mensaje, hash de blockchain, badge)
  const parseNotificationContent = (rawMsg = '') => {
    let title = 'Notificación';
    let badge = 'Info';
    let badgeColor = '#38bdf8';
    let badgeBg = 'rgba(56, 189, 248, 0.12)';
    let icon = '🔔';
    let txHash = null;
    let cleanMessage = rawMsg;

    // Extraer referencia de transacción si existe
    const refMatch = rawMsg.match(/Referencia:\s*(0x[a-fA-F0-9]+)/i);
    if (refMatch) {
      txHash = refMatch[1];
      cleanMessage = rawMsg.replace(/Referencia:\s*0x[a-fA-F0-9]+/i, '').trim();
      cleanMessage = cleanMessage.replace(/\.\s*$/, '.');
    }

    const lower = rawMsg.toLowerCase();
    if (lower.includes('pago') || lower.includes('pagad') || lower.includes('acreditad') || lower.includes('ganad') || lower.includes('💰')) {
      title = 'Pago Confirmado';
      badge = 'Blockchain';
      badgeColor = '#10b981';
      badgeBg = 'rgba(16, 185, 129, 0.15)';
      icon = '💰';
    } else if (lower.includes('aprobada') || lower.includes('aprobado') || lower.includes('culminada') || lower.includes('completada') || lower.includes('✅') || lower.includes('🎉')) {
      title = 'Tarea Completada';
      badge = 'Completada';
      badgeColor = '#3b82f6';
      badgeBg = 'rgba(59, 130, 246, 0.15)';
      icon = '✅';
    } else if (lower.includes('rechazad') || lower.includes('error') || lower.includes('cancelad') || lower.includes('⚠️') || lower.includes('❌')) {
      title = 'Aviso';
      badge = 'Alerta';
      badgeColor = '#f59e0b';
      badgeBg = 'rgba(245, 158, 11, 0.15)';
      icon = '⚠️';
    } else if (lower.includes('solicitud') || lower.includes('participar') || lower.includes('📩')) {
      title = 'Solicitud de Tarea';
      badge = 'Marketplace';
      badgeColor = '#8b5cf6';
      badgeBg = 'rgba(139, 92, 246, 0.15)';
      icon = '📩';
    }

    return { title, badge, badgeColor, badgeBg, icon, txHash, cleanMessage };
  };

  // Helper para formatear fechas de notificaciones con fecha y hora completa
  const formatDateTime = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      const dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${dateStr}, ${timeStr}`;
    } catch (_) {
      return '';
    }
  };

  // Copia rápida de hash de blockchain al portapapeles
  const handleCopyHash = async (hash, e) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(hash);
      } else {
        const ta = document.createElement('textarea');
        ta.value = hash;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch (_) {}
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
                <a
                  href="#"
                  id="menuSolidarioHistory"
                  style={{ color: '#e83e8c', fontWeight: 600 }}
                  onClick={(e) => {
                    e.preventDefault();
                    setProfileOpen(false);
                    if (onOpenSolidarioHistory) onOpenSolidarioHistory();
                  }}
                >
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
              <Link to="/recovery" style={{ color: '#38bdf8', fontWeight: 600 }} onClick={() => setProfileOpen(false)}>
                🛡️ Recuperación
              </Link>
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

          {/* Dropdown de Notificaciones con Scroll Vertical y Máxima Altura */}
          {notifOpen && (
            <div
              className="dropdown-content"
              id="notificationDropdown"
              style={{
                display: 'block',
                width: 'min(calc(100vw - 24px), 380px)',
                maxWidth: 'calc(100vw - 24px)',
                maxHeight: '75vh',
                overflowY: 'auto',
                overflowX: 'hidden',
                right: 0,
                boxSizing: 'border-box',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {/* Acciones de Cabecera Sticky: Limpiar y Ver Historial */}
              <div
                className="notification-footer"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  backgroundColor: '#0f172a',
                  borderBottom: '1px solid #2a3b5c'
                }}
              >
                <strong style={{ fontSize: '0.9rem', color: '#fff' }}>Notificaciones</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                  {notifications.length > 0 && (
                    <span
                      className="notification-footer-link"
                      style={{ cursor: 'pointer' }}
                      role="button"
                      tabIndex={0}
                      onClick={() => onClearNotifications && onClearNotifications()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          onClearNotifications && onClearNotifications();
                        }
                      }}
                    >
                      Limpiar
                    </span>
                  )}
                  <span
                    className="notification-footer-link"
                    style={{ cursor: 'pointer' }}
                    role="button"
                    tabIndex={0}
                    onClick={handleOpenHistory}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleOpenHistory();
                      }
                    }}
                  >
                    Ver historial
                  </span>
                </div>
              </div>

              {notifications.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔔</div>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
                    No tienes notificaciones pendientes
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px' }}>
                  {notifications.map((n, i) => {
                    const parsed = parseNotificationContent(n.message || n.body || '');
                    const dateFormatted = formatDateTime(n.created_at);
                    return (
                      <div
                        key={n.id || i}
                        style={{
                          background: 'rgba(30, 41, 59, 0.75)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          position: 'relative',
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'flex-start',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                        }}
                      >
                        {/* Ícono de evento con fondo iluminado */}
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: parsed.badgeBg,
                            border: `1px solid ${parsed.badgeColor}33`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem',
                            flexShrink: 0
                          }}
                        >
                          {parsed.icon}
                        </div>

                        {/* Contenido principal */}
                        <div style={{ flex: 1, minWidth: 0, paddingRight: '18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: parsed.badgeColor, background: parsed.badgeBg, padding: '2px 8px', borderRadius: '4px' }}>
                              {parsed.badge}
                            </span>
                            {dateFormatted && (
                              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
                                🕒 {dateFormatted}
                              </span>
                            )}
                          </div>

                          <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: '#f1f5f9', lineHeight: 1.35, wordBreak: 'break-word' }}>
                            {parsed.cleanMessage}
                          </p>

                          {parsed.txHash && (
                            <div
                              style={{
                                marginTop: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(0, 0, 0, 0.35)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                color: '#94a3b8',
                                fontFamily: 'monospace'
                              }}
                            >
                              <span>🔗 {parsed.txHash.slice(0, 8)}...{parsed.txHash.slice(-6)}</span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyHash(parsed.txHash, e)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: copiedHash === parsed.txHash ? '#10b981' : '#38bdf8',
                                  cursor: 'pointer',
                                  padding: 0,
                                  fontSize: '0.72rem',
                                  fontWeight: 600
                                }}
                                title="Copiar referencia de blockchain"
                              >
                                {copiedHash === parsed.txHash ? '¡Copiado!' : 'Copiar'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Botón de descarte */}
                        <button
                          type="button"
                          aria-label="Descartar notificación"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onDismissNotification) onDismissNotification(n.id);
                          }}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            fontSize: '18px',
                            cursor: 'pointer',
                            lineHeight: 1,
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Descartar"
                        >
                          &times;
                        </button>
                      </div>
                    );
                  })}
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
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⏳</div>
                  Cargando historial...
                </div>
              ) : historyItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📭</div>
                  Aún no tienes notificaciones en tu historial.
                </div>
              ) : (
                historyItems.map((item, idx) => {
                  const parsed = parseNotificationContent(item.message || item.body || '');
                  const dateFormatted = formatDateTime(item.created_at);
                  return (
                    <div
                      key={item.id || idx}
                      style={{
                        background: item.is_read ? 'rgba(30, 41, 59, 0.45)' : 'rgba(30, 41, 59, 0.85)',
                        border: item.is_read ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(56, 189, 248, 0.25)',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      {/* Ícono de evento */}
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: parsed.badgeBg,
                          border: `1px solid ${parsed.badgeColor}33`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.15rem',
                          flexShrink: 0
                        }}
                      >
                        {parsed.icon}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Cabecera del ítem */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: parsed.badgeColor, background: parsed.badgeBg, padding: '2px 8px', borderRadius: '4px' }}>
                            {parsed.badge}
                          </span>
                          {dateFormatted && (
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                              🕒 {dateFormatted}
                            </span>
                          )}
                        </div>

                        {/* Mensaje limpio */}
                        <p style={{ margin: '4px 0 0 0', color: '#f1f5f9', fontSize: '0.88rem', lineHeight: 1.4, wordBreak: 'break-word' }}>
                          {parsed.cleanMessage}
                        </p>

                        {/* Referencia Web3 si existe */}
                        {parsed.txHash && (
                          <div
                            style={{
                              marginTop: '8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              background: 'rgba(0, 0, 0, 0.4)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              color: '#cbd5e1',
                              fontFamily: 'monospace'
                            }}
                          >
                            <span>Ref: {parsed.txHash.slice(0, 10)}...{parsed.txHash.slice(-8)}</span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyHash(parsed.txHash, e)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: copiedHash === parsed.txHash ? '#10b981' : '#38bdf8',
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}
                              title="Copiar hash de referencia"
                            >
                              {copiedHash === parsed.txHash ? '✓ Copiado' : 'Copiar'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
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
