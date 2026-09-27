import React from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: BottomNav
 * ============================================================================
 * Barra de navegación inferior fija para teléfonos móviles (UX estilo Rappi/Binance):
 * - Inicio (Dashboard central).
 * - Publicar (Acción principal).
 * - Exchange FIFO (1 BLUE = 1 USDT).
 * - Billetera Web3 (Balances on-chain y compensaciones).
 * - Perfil (Cuenta de usuario).
 * ============================================================================
 */
export default function BottomNav({ onOpenCreatePublication }) {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <>
      <style>{`
        @media (min-width: 768px) {
          .dashboard-mobile-bottom-nav {
            display: none !important;
          }
        }
      `}</style>
      <nav
        className="dashboard-mobile-bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '62px',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 9999,
          padding: '0 8px',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.4)'
        }}
        aria-label="Navegación móvil inferior"
      >
      {/* 1. Inicio */}
      <Link
        to="/dashboard"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          textDecoration: 'none',
          color: currentPath === '/dashboard' || currentPath === '/' ? '#38bdf8' : '#94a3b8',
          fontSize: '0.72rem',
          fontWeight: 600,
          flex: 1
        }}
      >
        <span style={{ fontSize: '1.25rem' }}>🏠</span>
        <span>Inicio</span>
      </Link>

      {/* 2. Publicar */}
      <button
        type="button"
        onClick={onOpenCreatePublication}
        style={{
          background: 'none',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          color: '#94a3b8',
          fontSize: '0.72rem',
          fontWeight: 600,
          cursor: 'pointer',
          flex: 1
        }}
      >
        <span style={{ fontSize: '1.25rem' }}>➕</span>
        <span>Publicar</span>
      </button>

      {/* 3. Exchange */}
      <Link
        to="/exchange"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          textDecoration: 'none',
          color: currentPath === '/exchange' || currentPath === '/exchange.html' ? '#38bdf8' : '#94a3b8',
          fontSize: '0.72rem',
          fontWeight: 600,
          flex: 1
        }}
      >
        <span style={{ fontSize: '1.25rem' }}>💱</span>
        <span>Exchange</span>
      </Link>

      {/* 4. Billetera */}
      <Link
        to="/wallet"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          textDecoration: 'none',
          color: currentPath === '/wallet' || currentPath === '/wallet.html' ? '#10b981' : '#94a3b8',
          fontSize: '0.72rem',
          fontWeight: 600,
          flex: 1
        }}
      >
        <span style={{ fontSize: '1.25rem' }}>💳</span>
        <span>Billetera</span>
      </Link>

      {/* 5. Perfil */}
      <a
        href="profile.html"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          textDecoration: 'none',
          color: '#94a3b8',
          fontSize: '0.72rem',
          fontWeight: 600,
          flex: 1
        }}
      >
        <span style={{ fontSize: '1.25rem' }}>👤</span>
        <span>Perfil</span>
      </a>
    </nav>
    </>
  );
}
