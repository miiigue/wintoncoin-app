import React from 'react';
import { Link } from 'react-router-dom';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: QuickActions
 * ============================================================================
 * Botones de acción rápida en el dashboard con paridad visual y diseño responsivo:
 * - Crear Publicación (Solicitar ayuda / Ofrecer servicio).
 * - Venta Rápida (Generador de enlace de pago express con QR).
 * - Acceso a Billetera Web3 y Exchange FIFO.
 * ============================================================================
 */
export default function QuickActions({
  onOpenCreatePublication,
  onOpenQuickSale,
}) {
  return (
    <div style={{ margin: '0 auto 24px auto', maxWidth: '800px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
        <button
          type="button"
          onClick={onOpenCreatePublication}
          style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#fff',
            border: 'none',
            padding: '14px 12px',
            borderRadius: '14px',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(2, 132, 199, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>➕</span> Crear Publicación
        </button>

        <button
          type="button"
          onClick={onOpenQuickSale}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#fff',
            border: 'none',
            padding: '14px 12px',
            borderRadius: '14px',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>⚡</span> Venta Rápida (QR)
        </button>

        <Link
          to="/exchange"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: '#38bdf8',
            padding: '14px 12px',
            borderRadius: '14px',
            fontWeight: 700,
            fontSize: '0.9rem',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <span>💱</span> Exchange FIFO
        </Link>

        <Link
          to="/wallet"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            padding: '14px 12px',
            borderRadius: '14px',
            fontWeight: 700,
            fontSize: '0.9rem',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <span>💳</span> Billetera Web3
        </Link>
      </div>
    </div>
  );
}
