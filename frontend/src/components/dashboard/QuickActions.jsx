import React, {useEffect} from 'react';
import {installPublicationEntryGuards} from '../../modules/publicationAccess.js';
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
  allowQuickSale = true,
}) {
  useEffect(() => installPublicationEntryGuards(), []);

  // En Vanilla (contract-interaction.js línea 535):
  // quickSaleBtn.style.display = (settings.allow_quick_sale_publications === false || (settings.pre_launch_mode_enabled && !isPlatform)) ? 'none' : 'inline-flex';
  const showQuickSale = allowQuickSale && !isPreLaunch;

  return (
    <div className="main-actions-container">
      <a
        href="#"
        id="openPublicationModalBtn"
        className="button-link primary-action"
        onClick={(e) => {
          e.preventDefault();
          if (onOpenCreatePublication) onOpenCreatePublication();
        }}
      >
        Crear Nueva Publicación
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
          ⚡ Venta Rápida
        </a>
      )}
    </div>
  );
}
