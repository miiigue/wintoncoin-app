// ============================================================================
// WintonCoin PWA Registration v1.5.0
// ============================================================================
// Este script registra el Service Worker y maneja la instalación de la PWA
// ============================================================================

(function() {
  'use strict';

  // ============================================================================
  // Configuración
  // ============================================================================
  const SW_PATH = '/sw.js';
  const DEBUG = false;

  function log(...args) {
    if (DEBUG) console.log('[PWA]', ...args);
  }

  // ============================================================================
  // Registrar Service Worker
  // ============================================================================
  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      log('Service Worker no soportado en este navegador');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register(SW_PATH, {
        scope: '/'
      });

      log('Service Worker registrado:', registration.scope);

      // Escuchar actualizaciones
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        log('Nueva versión del Service Worker encontrada');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Hay una nueva versión lista
            log('Nueva versión disponible');
            showUpdateNotification();
          }
        });
      });

      return registration;
    } catch (error) {
      console.error('[PWA] Error al registrar Service Worker:', error);
      return null;
    }
  }

  // ============================================================================
  // Mostrar notificación de actualización disponible
  // ============================================================================
  function showUpdateNotification() {
    // Crear un banner discreto para notificar al usuario
    const existingBanner = document.getElementById('pwa-update-banner');
    if (existingBanner) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-update-banner';
    banner.innerHTML = `
      <style>
        #pwa-update-banner {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          z-index: 10000;
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: 'Poppins', sans-serif;
          font-size: 14px;
          animation: slideUp 0.3s ease-out;
        }
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(100px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        #pwa-update-banner button {
          background: white;
          color: #357abd;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
        }
        #pwa-update-banner button:hover {
          background: #f0f0f0;
        }
        #pwa-update-banner .close-btn {
          background: transparent;
          color: white;
          padding: 4px 8px;
          opacity: 0.7;
        }
        #pwa-update-banner .close-btn:hover {
          opacity: 1;
        }
      </style>
      <span>🔄 Nueva versión disponible</span>
      <button onclick="location.reload()">Actualizar</button>
      <button class="close-btn" onclick="this.parentElement.remove()">✕</button>
    `;
    document.body.appendChild(banner);
  }

  // ============================================================================
  // Manejo de instalación de PWA (A2HS - Add to Home Screen)
  // ============================================================================
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    log('beforeinstallprompt disparado');
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });

  function showInstallButton() {
    // Crear botón de instalación si no existe
    const existingBtn = document.getElementById('pwa-install-btn');
    if (existingBtn) return;

    // Mostrar en páginas principales (login, dashboard, registro)
    const allowedPages = ['contract_interaction.html', 'index.html', 'register.html', '/'];
    const currentPath = window.location.pathname;
    if (!allowedPages.some(page => currentPath.includes(page) || currentPath === page)) {
      return;
    }

    const installBtn = document.createElement('button');
    installBtn.id = 'pwa-install-btn';
    installBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
      </svg>
      <span>Instalar App</span>
    `;
    
    // Estilos del botón - Centrado horizontalmente abajo
    installBtn.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #00d4aa 0%, #00b894 100%);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 50px;
      cursor: pointer;
      font-family: 'Poppins', sans-serif;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 4px 20px rgba(0, 212, 170, 0.5);
      z-index: 9999;
      animation: pulseGreen 2s infinite;
      transition: transform 0.2s ease;
    `;

    // Añadir animación y hover
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulseGreen {
        0%, 100% { box-shadow: 0 4px 20px rgba(0, 212, 170, 0.5); }
        50% { box-shadow: 0 4px 30px rgba(0, 212, 170, 0.7); }
      }
      #pwa-install-btn:hover {
        transform: translateX(-50%) scale(1.05);
      }
      #pwa-install-btn:active {
        transform: translateX(-50%) scale(0.98);
      }
    `;
    document.head.appendChild(style);

    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      log('Usuario eligió:', outcome);
      
      if (outcome === 'accepted') {
        installBtn.remove();
      }
      
      deferredPrompt = null;
    });

    document.body.appendChild(installBtn);

    // Después de 10 segundos, reducir animación pero mantener visible
    setTimeout(() => {
      if (installBtn.parentElement) {
        installBtn.style.animation = 'none';
        installBtn.style.boxShadow = '0 4px 15px rgba(0, 212, 170, 0.4)';
      }
    }, 10000);
  }

  // ============================================================================
  // Detectar si ya está instalada como PWA
  // ============================================================================
  function isPWAInstalled() {
    // Método 1: display-mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    // Método 2: iOS Safari
    if (window.navigator.standalone === true) {
      return true;
    }
    return false;
  }

  // ============================================================================
  // Evento cuando la app se instala
  // ============================================================================
  window.addEventListener('appinstalled', () => {
    log('PWA instalada exitosamente');
    deferredPrompt = null;
    
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) installBtn.remove();
  });

  // ============================================================================
  // Inicialización
  // ============================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function init() {
    log('Inicializando PWA...');
    
    // Registrar Service Worker
    await registerServiceWorker();
    
    // Mostrar indicador si está en modo PWA
    if (isPWAInstalled()) {
      log('Ejecutando como PWA instalada');
      document.body.classList.add('pwa-standalone');
    }
    
    log('PWA inicializada');
  }

  // Exponer función para forzar instalación (útil para botones custom)
  window.WintonPWA = {
    install: async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        return outcome;
      }
      return null;
    },
    isInstalled: isPWAInstalled,
    isInstallable: () => deferredPrompt !== null
  };

})();
