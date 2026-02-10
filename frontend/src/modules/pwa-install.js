// ============================================================================
// WintonCoin PWA Install Button Module
// ============================================================================
// Maneja el botón de instalación de la PWA (Add to Home Screen)
// El botón siempre aparece mientras la app no esté instalada
// En la página de registro, el botón es más grande y prominente
// ============================================================================

// Usar variable global para persistir entre navegaciones
if (typeof window.__pwaInstallInitialized === 'undefined') {
    window.__pwaInstallInitialized = false;
    window.__deferredPrompt = null;
}

/**
 * Guarda el código de referido de la URL en localStorage
 * para que persista después de instalar la PWA
 * @returns {boolean} true si había un código de referido en la URL
 */
function saveReferralCodeFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    if (refCode) {
        localStorage.setItem('pending_referral_code', refCode.trim().toUpperCase());
        console.log('[PWA] Código de referido guardado:', refCode);
        return true;
    }
    return false;
}

/**
 * Verifica si hay un registro pendiente (código de referido + sin sesión)
 * En este caso, el usuario necesita instalar la app para registrarse
 */
function hasPendingRegistration() {
    const pendingRefCode = localStorage.getItem('pending_referral_code');
    const token = localStorage.getItem('token');

    // Si hay código de referido Y no hay sesión activa = registro pendiente
    return pendingRefCode && !token;
}

/**
 * Restaura el código de referido de localStorage al campo del formulario
 * Se llama cuando la PWA se abre después de instalarse
 */
export function restoreReferralCode() {
    const savedRefCode = localStorage.getItem('pending_referral_code');
    const referralInput = document.getElementById('referral_code');

    if (savedRefCode && referralInput && !referralInput.value) {
        referralInput.value = savedRefCode;
        console.log('[PWA] Código de referido restaurado:', savedRefCode);
    }
}

/**
 * Detecta si estamos en la página de registro
 */
function isRegisterPage() {
    return window.location.pathname.includes('register.html');
}

/**
 * Inicializa el manejador de instalación PWA
 */
export function initPWAInstall() {
    console.log('[PWA] initPWAInstall llamado');
    console.log('[PWA] pathname:', window.location.pathname);
    console.log('[PWA] isPWAInstalled:', isPWAInstalled());
    console.log('[PWA] pwa_installed localStorage:', localStorage.getItem('pwa_installed'));

    // Service Worker is registered by VitePWA via registerSW.js (sw-source.js)
    // NO registrar sw.js manualmente aquí - interfiere con el SW que tiene push handlers

    // Siempre guardar el código de referido si viene en la URL
    const hasNewRefCode = saveReferralCodeFromUrl();

    // VERIFICACIÓN 1: Si estamos DENTRO de la PWA instalada (modo standalone)
    // No mostrar botón, solo restaurar código de referido
    if (isPWAInstalled()) {
        console.log('[PWA] Ejecutando DENTRO de la PWA instalada - no mostrar botón');
        restoreReferralCode();
        return;
    }

    // Solo añadir listeners una vez globalmente
    if (!window.__pwaInstallInitialized) {
        window.__pwaInstallInitialized = true;

        // Escuchar evento de instalación disponible
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('[PWA] beforeinstallprompt disparado');
            e.preventDefault();
            window.__deferredPrompt = e;
        });

        // Escuchar cuando la app se instala
        window.addEventListener('appinstalled', () => {
            console.log('[PWA] App instalada exitosamente');
            window.__deferredPrompt = null;
            const installBtn = document.getElementById('pwa-install-btn');
            if (installBtn) installBtn.remove();
            // Guardar en localStorage que ya está instalada
            localStorage.setItem('pwa_installed', 'true');
        });
    }

    // VERIFICACIÓN 2: Si hay un registro pendiente (código de referido + sin sesión)
    // SIEMPRE mostrar el botón para que el usuario pueda instalar y registrarse
    if (hasPendingRegistration()) {
        console.log('[PWA] Registro pendiente detectado - mostrando botón de instalación');
        showInstallButton();
        return;
    }

    // VERIFICACIÓN 3: Si la app YA FUE instalada anteriormente y NO hay registro pendiente
    // (detectado por localStorage, aplica cuando navegas en el browser normal)
    const alreadyInstalled = localStorage.getItem('pwa_installed') === 'true';
    if (alreadyInstalled) {
        console.log('[PWA] App ya fue instalada previamente - no mostrar botón');
        return;
    }

    // Si llegamos aquí, la app NO está instalada - mostrar botón
    // En la página de registro, el botón es más grande
    console.log('[PWA] App NO instalada - mostrando botón de instalación');
    showInstallButton();
}

/**
 * Muestra el botón verde de instalación
 * En la página de registro es 3x más grande y prominente
 */
function showInstallButton() {
    console.log('[PWA] showInstallButton llamado');

    const existingBtn = document.getElementById('pwa-install-btn');
    if (existingBtn) {
        console.log('[PWA] Botón ya existe - saliendo');
        return;
    }

    // Solo mostrar en páginas principales
    const allowedPages = ['contract_interaction.html', 'index.html', 'register.html', '/'];
    const currentPath = window.location.pathname;
    console.log('[PWA] currentPath:', currentPath);
    console.log('[PWA] allowedPages:', allowedPages);

    const isAllowed = allowedPages.some(page => currentPath.includes(page) || currentPath === page);
    console.log('[PWA] isAllowed:', isAllowed);

    if (!isAllowed) {
        console.log('[PWA] Página no permitida - saliendo');
        return;
    }

    console.log('[PWA] Creando botón de instalación');

    // Detectar si estamos en la página de registro para botón grande
    const onRegisterPage = isRegisterPage();

    const installBtn = document.createElement('button');
    installBtn.id = 'pwa-install-btn';

    if (onRegisterPage) {
        // Botón GRANDE para página de registro
        installBtn.innerHTML = `
            <div class="pwa-install-content">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                    <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                </svg>
                <div class="pwa-install-text">
                    <strong>Primero debes instalar la app</strong>
                    <span>Toca aquí para iniciar la instalación</span>
                </div>
            </div>
        `;

        // Estilos del botón GRANDE - 3x más alto
        installBtn.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            background: linear-gradient(135deg, #00d4aa 0%, #00b894 100%);
            color: white;
            border: none;
            padding: 24px 20px;
            border-radius: 20px 20px 0 0;
            cursor: pointer;
            font-family: 'Poppins', sans-serif;
            box-shadow: 0 -4px 30px rgba(0, 212, 170, 0.6);
            z-index: 9999;
            animation: pulseGreenLarge 2s infinite;
            transition: transform 0.2s ease;
        `;
    } else {
        // Botón normal para otras páginas
        installBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
            </svg>
            <span>Instalar App</span>
        `;

        // Estilos del botón normal - Verde centrado abajo
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
    }

    // Añadir estilos de animación
    if (!document.getElementById('pwa-install-styles')) {
        const style = document.createElement('style');
        style.id = 'pwa-install-styles';
        style.textContent = `
            @keyframes pulseGreen {
                0%, 100% { box-shadow: 0 4px 20px rgba(0, 212, 170, 0.5); }
                50% { box-shadow: 0 4px 30px rgba(0, 212, 170, 0.7); }
            }
            @keyframes pulseGreenLarge {
                0%, 100% { box-shadow: 0 -4px 30px rgba(0, 212, 170, 0.6); }
                50% { box-shadow: 0 -4px 50px rgba(0, 212, 170, 0.9); }
            }
            #pwa-install-btn:hover {
                transform: translateX(-50%) scale(1.05);
            }
            #pwa-install-btn:active {
                transform: translateX(-50%) scale(0.98);
            }
            /* Estilos para el botón grande de registro */
            #pwa-install-btn .pwa-install-content {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 16px;
            }
            #pwa-install-btn .pwa-install-text {
                display: flex;
                flex-direction: column;
                text-align: left;
            }
            #pwa-install-btn .pwa-install-text strong {
                font-size: 18px;
                font-weight: 700;
                margin-bottom: 4px;
            }
            #pwa-install-btn .pwa-install-text span {
                font-size: 14px;
                opacity: 0.9;
            }
            /* Hover para botón grande - sin transform porque no tiene translateX */
            #pwa-install-btn.pwa-large-btn:hover {
                transform: none;
                filter: brightness(1.1);
            }
            #pwa-install-btn.pwa-large-btn:active {
                transform: none;
                filter: brightness(0.95);
            }
        `;
        document.head.appendChild(style);
    }

    // Añadir clase para botón grande
    if (onRegisterPage) {
        installBtn.classList.add('pwa-large-btn');
    }

    installBtn.addEventListener('click', handleInstallClick);
    document.body.appendChild(installBtn);

    // Reducir animación después de 10 segundos (solo para botón pequeño)
    if (!onRegisterPage) {
        setTimeout(() => {
            if (installBtn.parentElement) {
                installBtn.style.animation = 'none';
                installBtn.style.boxShadow = '0 4px 15px rgba(0, 212, 170, 0.4)';
            }
        }, 10000);
    }
}

/**
 * Maneja el click en el botón de instalación
 */
async function handleInstallClick() {
    // Si hay prompt disponible, usarlo
    if (window.__deferredPrompt) {
        try {
            window.__deferredPrompt.prompt();
            const { outcome } = await window.__deferredPrompt.userChoice;

            console.log('[PWA] Usuario eligió:', outcome);

            if (outcome === 'accepted') {
                const installBtn = document.getElementById('pwa-install-btn');
                if (installBtn) installBtn.remove();
            }

            window.__deferredPrompt = null;
        } catch (error) {
            console.error('[PWA] Error al mostrar prompt:', error);
            showInstallInstructions();
        }
    } else {
        // Si no hay prompt, mostrar instrucciones manuales
        showInstallInstructions();
    }
}

/**
 * Muestra instrucciones para instalar manualmente
 */
function showInstallInstructions() {
    // Detectar el navegador/dispositivo
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isChrome = /Chrome/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !isChrome;

    let instructions = '';

    if (isIOS && isSafari) {
        instructions = '📱 Para instalar en iOS:\n\n1. Toca el botón "Compartir" (📤) en Safari\n2. Desplázate y toca "Añadir a pantalla de inicio"\n3. Toca "Añadir"';
    } else if (isAndroid && isChrome) {
        instructions = '📱 Para instalar en Android:\n\n1. Toca el menú (⋮) en Chrome\n2. Toca "Instalar aplicación" o "Añadir a pantalla de inicio"\n3. Confirma la instalación';
    } else if (isChrome) {
        instructions = '💻 Para instalar en Chrome:\n\n1. Haz clic en el icono de instalación (⊕) en la barra de direcciones\n2. O ve al menú (⋮) → "Instalar WintonCoin"';
    } else {
        instructions = '📱 Para instalar:\n\n1. Abre el menú de tu navegador\n2. Busca "Instalar" o "Añadir a pantalla de inicio"\n3. Confirma la instalación';
    }

    // Mostrar modal con instrucciones
    showInstallModal(instructions);
}

/**
 * Muestra un modal con las instrucciones de instalación
 */
function showInstallModal(instructions) {
    // Remover modal existente si hay
    const existingModal = document.getElementById('pwa-install-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'pwa-install-modal';
    modal.innerHTML = `
        <div class="pwa-modal-backdrop"></div>
        <div class="pwa-modal-content">
            <button class="pwa-modal-close">&times;</button>
            <h3>📲 Instalar WintonCoin</h3>
            <pre class="pwa-instructions">${instructions}</pre>
            <div class="pwa-modal-actions">
                <button class="pwa-btn-later">Más tarde</button>
                <button class="pwa-btn-dismiss">No mostrar más</button>
            </div>
        </div>
    `;

    // Estilos del modal
    const style = document.createElement('style');
    style.textContent = `
        #pwa-install-modal .pwa-modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.6);
            z-index: 10000;
        }
        #pwa-install-modal .pwa-modal-content {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a2e;
            color: white;
            padding: 24px;
            border-radius: 16px;
            max-width: 90%;
            width: 340px;
            z-index: 10001;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        }
        #pwa-install-modal h3 {
            margin: 0 0 16px 0;
            font-size: 18px;
            text-align: center;
        }
        #pwa-install-modal .pwa-instructions {
            background: rgba(255,255,255,0.1);
            padding: 16px;
            border-radius: 8px;
            white-space: pre-wrap;
            font-size: 14px;
            line-height: 1.6;
            margin: 0 0 16px 0;
            font-family: inherit;
        }
        #pwa-install-modal .pwa-modal-close {
            position: absolute;
            top: 12px;
            right: 12px;
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            opacity: 0.7;
        }
        #pwa-install-modal .pwa-modal-close:hover {
            opacity: 1;
        }
        #pwa-install-modal .pwa-modal-actions {
            display: flex;
            gap: 10px;
        }
        #pwa-install-modal .pwa-btn-later,
        #pwa-install-modal .pwa-btn-dismiss {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
        }
        #pwa-install-modal .pwa-btn-later {
            background: #4a90d9;
            color: white;
        }
        #pwa-install-modal .pwa-btn-dismiss {
            background: rgba(255,255,255,0.1);
            color: white;
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.pwa-modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.pwa-modal-backdrop').addEventListener('click', () => modal.remove());
    modal.querySelector('.pwa-btn-later').addEventListener('click', () => modal.remove());
    modal.querySelector('.pwa-btn-dismiss').addEventListener('click', () => {
        localStorage.setItem('pwa_installed', 'true'); // Marcar como "no mostrar más"
        modal.remove();
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) installBtn.remove();
    });
}

/**
 * Verifica si la app ya está instalada como PWA
 */
export function isPWAInstalled() {
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return true;
    }
    if (window.navigator.standalone === true) {
        return true;
    }
    return false;
}

/**
 * Verifica si la app puede ser instalada
 */
export function isInstallable() {
    return window.__deferredPrompt !== null;
}

/**
 * Fuerza mostrar el prompt de instalación (si está disponible)
 */
export async function promptInstall() {
    if (window.__deferredPrompt) {
        window.__deferredPrompt.prompt();
        const { outcome } = await window.__deferredPrompt.userChoice;
        window.__deferredPrompt = null;
        return outcome;
    }
    return null;
}
