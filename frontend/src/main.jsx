import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';
import { PWAProvider } from './context/PWAContext';

// =====================================================================
// IMPORTACIÓN DE ESTILOS GLOBALES
// =====================================================================
// 1. style.css: CSS maestro de WintonCoin (paleta zafiro, Poppins, Inter,
//    clases del dashboard, wallet-tabs, referral card, publicaciones, etc.)
// 2. admin-switch.css: Estilos del toggle de administración (sidebar premium)
// 3. landing.css / landing-fomo.css: Estilos específicos de la landing page
// =====================================================================
import '../style.css';
import '../admin-switch.css';
import '../landing.css';
import '../landing-fomo.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PWAProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PWAProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

