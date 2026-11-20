import React, {useEffect} from 'react';
import {installPublicationEntryGuards} from '../../modules/publicationAccess.js';
import { Link } from 'react-router-dom';

/**
 * ============================================================================
 * [WINTONCOIN] - DASHBOARD: QuickActions
 * ============================================================================
 * Botones de acción rápida en el dashboard con paridad visual y diseño responsivo:
 * - Publicar (Solicitar ayuda / Ofrecer servicio).
 * - Venta Rápida (Generador de enlace de pago express con QR).
 * - Exchange (Acceso directo al libro de órdenes BLUE/USDT).
 * ============================================================================
 */
export default function QuickActions({
  onOpenCreatePublication,
  onOpenQuickSale,
  isPreLaunch = false,
  allowQuickSale = true,
}) {
  useEffect(() => installPublicationEntryGuards(), []);

  // En Vanilla (contract-interaction.js línea 535):
  // quickSaleBtn.style.display = (settings.allow_quick_sale_publications === false || (settings.pre_launch_mode_enabled && !isPlatform)) ? 'none' : 'inline-flex';
  const showQuickSale = allowQuickSale && !isPreLaunch;

  return (
    <div className="main-actions-container" role="navigation" aria-label="Acciones rápidas principales">
      <a
        href="#"
        id="openPublicationModalBtn"
        className="button-link primary-action"
        onClick={(e) => {
          e.preventDefault();
          if (onOpenCreatePublication) onOpenCreatePublication();
        }}
      >
        <span className="action-btn-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
        <span className="action-btn-label">Publicar</span>
      </a>
      {showQuickSale && (
        <a
          href="#"
          id="openQuickSaleModalBtn"
          className="button-link secondary-action"
          onClick={(e) => {
            e.preventDefault();
            if (onOpenQuickSale) onOpenQuickSale();
          }}
        >
          <span className="action-btn-icon" aria-hidden="true">⚡</span>
          <span className="action-btn-label">Venta Rápida</span>
        </a>
      )}
      <Link
        to="/exchange"
        id="openExchangeActionBtn"
        className="button-link exchange-action"
      >
        <span className="action-btn-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </span>
        <span className="action-btn-label">Exchange</span>
      </Link>
    </div>
  );
}
