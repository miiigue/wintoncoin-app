import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';
import { PWAProvider } from './context/PWAContext';

// Importamos estilos globales temporalmente aquí hasta modularizarlos
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

