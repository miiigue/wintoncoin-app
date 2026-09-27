import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * ============================================================================
 * [WINTONCOIN] - CONTEXTO GLOBAL PWA: PWAContext
 * ============================================================================
 * Maneja el ciclo de vida de instalación de la Progressive Web App en React:
 * - Captura y retiene el evento nativo 'beforeinstallprompt' desde la raíz.
 * - Detecta si la aplicación ya se ejecuta en modo standalone (instalada).
 * - Expone el método 'promptInstall()' para disparar la instalación nativa desde
 *   cualquier botón o modal de la interfaz sin perder eventos.
 * - Monitorea el evento 'appinstalled' para actualizar el estado reactivamente.
 * ============================================================================
 */

const PWAContext = createContext({
  isInstallable: false,
  isInstalled: false,
  promptInstall: async () => false,
  dismissInstall: () => {},
});

export function PWAProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Comprobar si ya está instalada o ejecutándose en modo standalone
  const checkInstallationState = useCallback(() => {
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    const domainKey = `pwa_installed_${window.location.hostname}`;
    const storedInstalled = localStorage.getItem(domainKey) === 'true';

    setIsInstalled(isStandalone || storedInstalled);
  }, []);

  useEffect(() => {
    checkInstallationState();

    // 1. Escuchar el evento antes de que el navegador descarte el prompt de instalación
    const handleBeforeInstallPrompt = (event) => {
      console.log('[PWAContext] Evento beforeinstallprompt capturado en la raíz de React.');
      // Prevenir el mini-infobar automático del navegador
      event.preventDefault();
      // Guardar el evento para invocarlo cuando el usuario decida instalar
      setDeferredPrompt(event);
      window.__deferredPrompt = event;
    };

    // 2. Escuchar cuando la instalación se completa con éxito
    const handleAppInstalled = () => {
      console.log('[PWAContext] Aplicación instalada exitosamente en el dispositivo.');
      setDeferredPrompt(null);
      window.__deferredPrompt = null;
      setIsInstalled(true);
      const domainKey = `pwa_installed_${window.location.hostname}`;
      localStorage.setItem(domainKey, 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [checkInstallationState]);

  /**
   * Invoca el diálogo nativo de instalación del sistema operativo (Android/Desktop)
   * @returns {Promise<boolean>} true si el usuario aceptó instalar la app
   */
  const promptInstall = useCallback(async () => {
    const promptEvent = deferredPrompt || window.__deferredPrompt;
    if (!promptEvent) {
      console.warn('[PWAContext] No hay evento de instalación pendiente disponible.');
      return false;
    }

    try {
      // Mostrar el diálogo de instalación nativo
      promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      console.log(`[PWAContext] Respuesta del usuario a la instalación: ${choiceResult.outcome}`);

      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
        window.__deferredPrompt = null;
        return true;
      }
      return false;
    } catch (err) {
      console.error('[PWAContext] Error al ejecutar promptInstall:', err);
      return false;
    }
  }, [deferredPrompt]);

  /**
   * Registra que el usuario prefirió descartar temporalmente el banner
   */
  const dismissInstall = useCallback(() => {
    const domainKey = `pwa_install_dismissed_${window.location.hostname}`;
    localStorage.setItem(domainKey, 'true');
  }, []);

  const value = {
    isInstallable: !!deferredPrompt && !isInstalled,
    isInstalled,
    promptInstall,
    dismissInstall,
  };

  return (
    <PWAContext.Provider value={value}>
      {children}
    </PWAContext.Provider>
  );
}

/**
 * Hook para consumir las capacidades de la PWA en cualquier componente
 */
export function usePWA() {
  return useContext(PWAContext);
}

export default PWAContext;
