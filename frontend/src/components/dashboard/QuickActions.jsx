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
  isPreLaunch = false,
}) {
  return (
    <div
      className="main-actions-container"
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '10px',
        justifyContent: 'center',
        alignItems: 'stretch',
        width: '100%',
        margin: '0 auto 1.5rem auto'
      }}
    >
      <a
        href="#"
        id="openPublicationModalBtn"
        className="button-link primary-action"
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '12px 6px',
          fontSize: '0.92rem',
          lineHeight: '1.25',
          borderRadius: '12px'
        }}
        onClick={(e) => {
          e.preventDefault();
          if (onOpenCreatePublication) onOpenCreatePublication();
        }}
      >
        Crear Nueva Publicación
      </a>
      {!isPreLaunch && (
        <a
          href="#"
          id="openQuickSaleModalBtn"
          className="button-link secondary-action"
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            padding: '12px 6px',
            fontSize: '0.92rem',
            lineHeight: '1.25',
            borderRadius: '12px'
          }}
          onClick={(e) => {
            e.preventDefault();
            if (onOpenQuickSale) onOpenQuickSale();
          }}
        >
          ⚡ Venta Rápida
        </a>
      )}
    </div>
  );
}
