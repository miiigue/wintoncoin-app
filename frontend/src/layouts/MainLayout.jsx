import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import BackToTop from '../components/common/BackToTop';

/**
 * ============================================================================
 * [WINTONCOIN] - LAYOUT MAESTRO: MainLayout
 * ============================================================================
 * Molde estructural global para todas las vistas públicas y corporativas.
 * Incluye:
 * - Menú de Navegación Global (Header)
 * - Contenedor Dinámico de Ruta (Outlet)
 * - Pie de Página Global (Footer)
 * - Botón Flotante "Volver Arriba" (BackToTop)
 * ============================================================================
 */
function MainLayout() {
  return (
    <>
      {/* Menú de Navegación Global */}
      <Header />

      {/* Contenido Dinámico de la Página Actual */}
      <main id="main-content">
        <Outlet />
      </main>

      {/* Pie de Página Global */}
      <Footer />

      {/* Botón flotante accesible en todas las vistas */}
      <BackToTop />
    </>
  );
}

export default MainLayout;
