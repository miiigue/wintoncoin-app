// ============================================================================
// WintonCoin PWA Install Button Module (Refactorizado)
// ============================================================================
// Maneja la instalación de la PWA (Add to Home Screen) con:
// - Botón flotante en páginas principales
// - Botón grande en página de registro
// - Botón en el modal de Configuración (⚙️)
// - Detección mejorada de iOS/iPad modernos
// - Seguridad XSS: inyección de texto con textContent (no innerHTML)
// - Estilos extraídos a src/styles/pwa-install.css (Separation of Concerns)
// ============================================================================

// --- Importar estilos separados (Vite los inyecta automáticamente) ---
import '../styles/pwa-install.css';

// --- Variables globales persistentes entre navegaciones SPA ---
// MOTIVO: En una SPA, los módulos se re-ejecutan al navegar.
// Usamos window.* para evitar duplicar listeners del beforeinstallprompt.
if (typeof window.__pwaInstallInitialized === 'undefined') {
    window.__pwaInstallInitialized = false; // Flag para evitar listeners duplicados
    window.__deferredPrompt = null;         // Almacena el evento nativo de instalación
}

// --- Constantes de localStorage (POR DOMINIO) ---
// MOTIVO: Producción (wintoncoin.com) y Demo (demo.wintoncoin.com) son
// PWAs independientes. Las claves de localStorage deben incluir el hostname
// para que instalar una no marque la otra como instalada.
// Ejemplo: 'pwa_installed_demo.wintoncoin.com' vs 'pwa_installed_wintoncoin.com'
const HOSTNAME = window.location.hostname;
const PWA_INSTALLED_KEY = `pwa_installed_${HOSTNAME}`;           // Marca si la app fue instalada en ESTE dominio
const PWA_INSTALL_DISMISSED_KEY = `pwa_install_dismissed_${HOSTNAME}`; // Marca si el usuario descartó el botón en ESTE dominio

// ============================================================================
// FUNCIONES DE REFERIDO — Persistencia del código entre browser y PWA
// ============================================================================

/**
 * Guarda el código de referido de la URL en localStorage
 * para que persista después de instalar la PWA.
 * MOTIVO: Cuando el usuario instala la PWA, pierde los parámetros de la URL.
 * @returns {boolean} true si había un código de referido en la URL
 */
function saveReferralCodeFromUrl() {
    // Extraer parámetro ?ref=CODIGO de la URL actual
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    if (refCode) {
        // Guardar en localStorage para que sobreviva la instalación de la PWA
        localStorage.setItem('pending_referral_code', refCode.trim().toUpperCase());
        console.log('[PWA] Código de referido guardado:', refCode);
        return true;
    }
    return false;
}

/**
 * Verifica si hay un registro pendiente (código de referido + sin sesión).
 * MOTIVO: Si el usuario llegó por referido y no tiene sesión,
 * necesita instalar la app para completar el registro.
 * @returns {boolean} true si hay registro pendiente
 */
function hasPendingRegistration() {
    const pendingRefCode = localStorage.getItem('pending_referral_code');
    const token = localStorage.getItem('token');
    // Si hay código de referido Y no hay sesión activa = registro pendiente
    return pendingRefCode && !token;
}

/**
 * Restaura el código de referido de localStorage al campo del formulario.
 * Se llama cuando la PWA se abre después de instalarse.
 * MOTIVO: El campo de referido debe llenarse automáticamente para
 * que el usuario no tenga que volver a escribirlo.
 */
export function restoreReferralCode() {
    const savedRefCode = localStorage.getItem('pending_referral_code');
    const referralInput = document.getElementById('referral_code');

    // Solo restaurar si hay código guardado, existe el input y está vacío
    if (savedRefCode && referralInput && !referralInput.value) {
        referralInput.value = savedRefCode;
        console.log('[PWA] Código de referido restaurado:', savedRefCode);
    }
}

// ============================================================================
// DETECCIÓN DE PÁGINA Y DISPOSITIVO
// ============================================================================

/**
 * Detecta si estamos en la página de registro.
 * MEJORA: Soporta URLs con y sin extensión .html para compatibilidad
 * futura con rutas limpias (ej: /register en vez de /register.html).
 * @returns {boolean}
 */
function isRegisterPage() {
    const path = window.location.pathname;
    // Soportar ambos formatos: /register.html y /register
    return path.includes('register.html') || path.endsWith('/register');
}

/**
 * Detecta si el dispositivo es iOS (iPhone, iPad, iPod).
 * MEJORA CRÍTICA: Los iPads modernos (iPadOS 13+) se identifican como
 * "Macintosh" en el User Agent. Se usa la detección de puntos táctiles
 * como fallback para identificarlos correctamente.
 * @returns {boolean}
 */
function isIOSDevice() {
    // Detección clásica para iPhone/iPod y iPads antiguos
    const classicIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    // Detección moderna para iPads con iPadOS 13+ (se disfrazan de Mac)
    // MOTIVO: Apple cambió el UA de iPads para parecer Mac Desktop.
    // Detectamos "Macintosh" + pantalla táctil (maxTouchPoints > 1).
    const modernIPad = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
    return classicIOS || modernIPad;
}

// ============================================================================
// FUNCIÓN PRINCIPAL DE INICIALIZACIÓN
// ============================================================================

/**
 * Inicializa el manejador de instalación PWA.
 * Se llama desde cada página que necesite mostrar el botón de instalación.
 * FLUJO:
 * 1. Guardar código de referido si viene en la URL
 * 2. Si ya está instalada (standalone) → no mostrar botón
 * 3. Registrar listeners globales (solo una vez)
 * 4. Evaluar si mostrar botón según el estado del usuario
 */
export function initPWAInstall() {
    console.log('[PWA] initPWAInstall llamado');
    console.log('[PWA] pathname:', window.location.pathname);
    console.log('[PWA] isPWAInstalled:', isPWAInstalled());

    // Service Worker is registered by VitePWA via registerSW.js (sw-source.js)
    // NO registrar sw.js manualmente aquí - interfiere con el SW que tiene push handlers

    // --- MIGRACIÓN DE CLAVES LEGACY ---
    // Las versiones anteriores usaban 'pwa_installed' sin hostname.
    // Migramos al nuevo formato y limpiamos la clave vieja para evitar
    // que producción y demo compartan el mismo flag.
    const legacyInstalled = localStorage.getItem('pwa_installed');
    if (legacyInstalled === 'true') {
        // Migrar al formato nuevo (con hostname)
        localStorage.setItem(PWA_INSTALLED_KEY, 'true');
        // Limpiar clave legacy
        localStorage.removeItem('pwa_installed');
        console.log('[PWA] Migrada clave legacy pwa_installed → ', PWA_INSTALLED_KEY);
    }
    const legacyDismissed = localStorage.getItem('pwa_install_dismissed');
    if (legacyDismissed === 'true') {
        localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, 'true');
        localStorage.removeItem('pwa_install_dismissed');
        console.log('[PWA] Migrada clave legacy pwa_install_dismissed → ', PWA_INSTALL_DISMISSED_KEY);
    }

    // Siempre guardar el código de referido si viene en la URL
    saveReferralCodeFromUrl();

    // VERIFICACIÓN 1: Si estamos DENTRO de la PWA instalada (modo standalone)
    // No mostrar botón flotante, solo restaurar código de referido
    if (isPWAInstalled()) {
        console.log('[PWA] Ejecutando DENTRO de la PWA instalada - no mostrar botón');
        restoreReferralCode();
        return;
    }

    // Solo añadir listeners globales UNA VEZ (evitar duplicados entre navegaciones)
    if (!window.__pwaInstallInitialized) {
        window.__pwaInstallInitialized = true;

        // Escuchar evento nativo de instalación disponible
        // MOTIVO: El navegador dispara este evento cuando detecta que la PWA
        // cumple los criterios de instalación (manifest + SW + HTTPS).
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('[PWA] beforeinstallprompt disparado');
            e.preventDefault(); // Prevenir el mini-infobar nativo
            window.__deferredPrompt = e; // Guardar para usar cuando el usuario haga click
        });

        // Escuchar cuando la app se instala exitosamente
        window.addEventListener('appinstalled', () => {
            console.log('[PWA] App instalada exitosamente');
            window.__deferredPrompt = null; // Limpiar prompt usado
            // Remover botón flotante si existe
            const installBtn = document.getElementById('pwa-install-btn');
            if (installBtn) installBtn.remove();
            // Marcar en localStorage para no volver a mostrar el botón
            localStorage.setItem(PWA_INSTALLED_KEY, 'true');
            localStorage.removeItem(PWA_INSTALL_DISMISSED_KEY);
            // Actualizar el botón del modal de configuración si está visible
            updateSettingsInstallButton();
        });
    }

    // VERIFICACIÓN 2: Registro pendiente → SIEMPRE mostrar botón
    if (hasPendingRegistration()) {
        console.log('[PWA] Registro pendiente detectado - mostrando botón de instalación');
        showInstallButton();
        return;
    }

    // VERIFICACIÓN 3: Ya fue instalada anteriormente
    if (localStorage.getItem(PWA_INSTALLED_KEY) === 'true') {
        console.log('[PWA] App ya fue instalada previamente - no mostrar botón');
        return;
    }

    // VERIFICACIÓN 4: Usuario descartó la instalación
    if (localStorage.getItem(PWA_INSTALL_DISMISSED_KEY) === 'true') {
        console.log('[PWA] Usuario descartó instalación previamente - no mostrar botón');
        return;
    }

    // Si ninguna verificación aplica → la app NO está instalada → mostrar botón
    console.log('[PWA] App NO instalada - mostrando botón de instalación');
    showInstallButton();
}

// ============================================================================
// BOTÓN FLOTANTE DE INSTALACIÓN
// ============================================================================

/**
 * Crea y muestra el botón flotante verde de instalación.
 * En la página de registro es 3x más grande y prominente.
 * MEJORA: Los estilos ahora vienen del CSS separado (pwa-install.css).
 * Solo se aplican clases CSS, no estilos inline.
 */
function showInstallButton() {
    console.log('[PWA] showInstallButton llamado');

    // Evitar duplicados si el botón ya existe
    const existingBtn = document.getElementById('pwa-install-btn');
    if (existingBtn) {
        console.log('[PWA] Botón ya existe - saliendo');
        return;
    }

    // Solo mostrar en páginas principales (lista blanca de seguridad)
    const allowedPages = ['contract_interaction.html', 'index.html', 'register.html', '/'];
    const currentPath = window.location.pathname;
    const isAllowed = allowedPages.some(page => currentPath.includes(page) || currentPath === page);

    if (!isAllowed) {
        console.log('[PWA] Página no permitida para botón flotante - saliendo');
        return;
    }

    // Detectar si estamos en la página de registro para botón grande
    const onRegisterPage = isRegisterPage();

    // Crear el elemento botón
    const installBtn = document.createElement('button');
    installBtn.id = 'pwa-install-btn';

    if (onRegisterPage) {
        // --- BOTÓN GRANDE para página de registro ---
        installBtn.classList.add('pwa-large-btn');
        // Crear contenido de forma segura (sin innerHTML para prevenir XSS)
        const content = document.createElement('div');
        content.className = 'pwa-install-content';

        // Icono SVG de descarga
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', '32');
        svg.setAttribute('height', '32');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.innerHTML = '<path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>';

        // Texto informativo
        const textDiv = document.createElement('div');
        textDiv.className = 'pwa-install-text';
        const strong = document.createElement('strong');
        strong.textContent = 'Primero debes instalar la app'; // textContent = seguro contra XSS
        const span = document.createElement('span');
        span.textContent = 'Toca aquí para iniciar la instalación';
        textDiv.appendChild(strong);
        textDiv.appendChild(span);

        content.appendChild(svg);
        content.appendChild(textDiv);
        installBtn.appendChild(content);
    } else {
        // --- BOTÓN NORMAL para otras páginas ---
        // Crear contenido de forma segura
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.innerHTML = '<path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>';
        const span = document.createElement('span');
        span.textContent = 'Instalar App';
        installBtn.appendChild(svg);
        installBtn.appendChild(span);
    }

    // Registrar el handler de click y añadir al DOM
    installBtn.addEventListener('click', handleInstallClick);
    document.body.appendChild(installBtn);

    // Reducir animación después de 10 segundos (solo para botón pequeño)
    // MOTIVO: La animación continua puede distraer al usuario después de un rato
    if (!onRegisterPage) {
        setTimeout(() => {
            if (installBtn.parentElement) {
                installBtn.style.animation = 'none';
                installBtn.style.boxShadow = '0 4px 15px rgba(0, 212, 170, 0.4)';
            }
        }, 10000);
    }
}

// ============================================================================
// HANDLER DE INSTALACIÓN (compartido entre botón flotante y menú)
// ============================================================================

/**
 * Maneja el click en cualquier botón de instalación.
 * Si hay prompt nativo disponible → lo muestra.
 * Si no → muestra instrucciones manuales adaptadas al dispositivo.
 */
async function handleInstallClick() {
    // Si hay prompt nativo disponible (Chrome, Edge, Samsung Internet)
    if (window.__deferredPrompt) {
        try {
            // Mostrar el diálogo nativo del navegador
            window.__deferredPrompt.prompt();
            const { outcome } = await window.__deferredPrompt.userChoice;

            console.log('[PWA] Usuario eligió:', outcome);

            if (outcome === 'accepted') {
                // Remover botón flotante si existe
                const installBtn = document.getElementById('pwa-install-btn');
                if (installBtn) installBtn.remove();
            }

            // El prompt solo se puede usar una vez
            window.__deferredPrompt = null;
        } catch (error) {
            console.error('[PWA] Error al mostrar prompt:', error);
            // Fallback: mostrar instrucciones manuales
            showInstallInstructions();
        }
    } else {
        // Si no hay prompt nativo (iOS, navegadores que no lo soportan)
        showInstallInstructions();
    }
}

// ============================================================================
// INSTRUCCIONES MANUALES DE INSTALACIÓN
// ============================================================================

/**
 * Detecta el dispositivo/navegador y muestra instrucciones específicas.
 * MEJORA: Usa isIOSDevice() para detectar correctamente iPads modernos
 * que se disfrazan como Mac en el User Agent.
 */
function showInstallInstructions() {
    // Detectar el dispositivo y navegador
    const isIOS = isIOSDevice();
    const isAndroid = /Android/.test(navigator.userAgent);
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
    // Detectar Samsung Internet — genera WebAPKs con SDK antiguo que
    // Google Play Protect bloquea como "app no segura"
    const isSamsungBrowser = /SamsungBrowser/.test(navigator.userAgent);
    // NOTA: isSafari se detecta implícitamente: si es iOS y no es Chrome = Safari.
    // No se declara como variable para evitar dead code (hallazgo de auditoría).

    let instructions = '';

    // Instrucciones adaptadas a cada plataforma
    if (isIOS) {
        // iOS Safari (iPhone, iPad clásico, iPad moderno)
        instructions = '📱 Para instalar en tu dispositivo Apple:\n\n1. Abre esta página en Safari\n2. Toca el botón "Compartir" (📤)\n3. Desplázate y toca "Añadir a pantalla de inicio"\n4. Toca "Añadir"';
    } else if (isAndroid && isSamsungBrowser) {
        // Samsung Internet — caso especial: recomendar Chrome
        // MOTIVO: Samsung Internet genera WebAPKs con targetSdkVersion antigua
        // que Google Play Protect bloquea con "Se bloqueó la app no segura"
        instructions = '⚠️ Samsung Internet puede bloquear la instalación.\n\n✅ Para instalar sin problemas:\n\n1. Abre Google Chrome\n2. Ve a esta misma página\n3. Toca el menú (⋮) → "Instalar aplicación"\n4. Confirma la instalación\n\n💡 Chrome es el navegador recomendado para instalar la app de forma segura.';
    } else if (isAndroid && isChrome) {
        // Android Chrome — instalación directa
        instructions = '📱 Para instalar en Android:\n\n1. Toca el menú (⋮) en Chrome\n2. Toca "Instalar aplicación" o "Añadir a pantalla de inicio"\n3. Confirma la instalación';
    } else if (isChrome) {
        // Chrome Desktop
        instructions = '💻 Para instalar en Chrome:\n\n1. Haz clic en el icono de instalación (⊕) en la barra de direcciones\n2. O ve al menú (⋮) → "Instalar WintonCoin"';
    } else {
        // Navegador genérico — incluir recomendación de Chrome
        instructions = '📱 Para instalar:\n\n1. Abre el menú de tu navegador\n2. Busca "Instalar" o "Añadir a pantalla de inicio"\n3. Confirma la instalación\n\n💡 Para mejor experiencia, usa Google Chrome.';
    }

    // Mostrar modal con las instrucciones
    showInstallModal(instructions);
}

/**
 * Muestra un modal con las instrucciones de instalación.
 * MEJORA: Usa textContent en vez de innerHTML para inyectar el texto
 * de instrucciones (prevención XSS).
 * @param {string} instructions - Texto de instrucciones a mostrar
 */
function showInstallModal(instructions) {
    // Remover modal existente si hay uno abierto
    const existingModal = document.getElementById('pwa-install-modal');
    if (existingModal) existingModal.remove();

    // Crear estructura del modal de forma segura (DOM API)
    const modal = document.createElement('div');
    modal.id = 'pwa-install-modal';

    // Backdrop (fondo oscuro)
    const backdrop = document.createElement('div');
    backdrop.className = 'pwa-modal-backdrop';

    // Contenido del modal
    const content = document.createElement('div');
    content.className = 'pwa-modal-content';

    // Botón de cerrar (X)
    const closeBtn = document.createElement('button');
    closeBtn.className = 'pwa-modal-close';
    closeBtn.textContent = '×'; // Seguro: textContent, no innerHTML

    // Título
    const title = document.createElement('h3');
    title.textContent = '📲 Instalar WintonCoin';

    // Bloque de instrucciones (SEGURIDAD: textContent previene XSS)
    const instructionsBlock = document.createElement('pre');
    instructionsBlock.className = 'pwa-instructions';
    instructionsBlock.textContent = instructions; // CRÍTICO: textContent, NO innerHTML

    // Botones de acción
    const actions = document.createElement('div');
    actions.className = 'pwa-modal-actions';

    const laterBtn = document.createElement('button');
    laterBtn.className = 'pwa-btn-later';
    laterBtn.textContent = 'Más tarde';

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'pwa-btn-dismiss';
    dismissBtn.textContent = 'No mostrar más';

    // Ensamblar el modal
    actions.appendChild(laterBtn);
    actions.appendChild(dismissBtn);
    content.appendChild(closeBtn);
    content.appendChild(title);
    content.appendChild(instructionsBlock);
    content.appendChild(actions);
    modal.appendChild(backdrop);
    modal.appendChild(content);

    document.body.appendChild(modal);

    // Event listeners para cerrar el modal
    closeBtn.addEventListener('click', () => modal.remove());
    backdrop.addEventListener('click', () => modal.remove());
    laterBtn.addEventListener('click', () => modal.remove());
    dismissBtn.addEventListener('click', () => {
        // Marcar como "no mostrar más" en localStorage
        localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, 'true');
        modal.remove();
        // También remover el botón flotante
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) installBtn.remove();
    });
}

// ============================================================================
// BOTÓN "DESCARGAR APP" EN MODAL DE CONFIGURACIÓN
// ============================================================================

/**
 * Inicializa la sección "Descargar App" dentro del modal de Configuración.
 * Se llama desde el módulo que maneja el modal de settings.
 *
 * LÓGICA DE SEGURIDAD:
 * - Si la PWA ya está instalada (standalone) → muestra mensaje "Ya instalada"
 * - Si NO está instalada → muestra botón verde "Descargar App"
 * - Escucha el evento 'appinstalled' para actualizar en tiempo real
 *
 * MOTIVO: Este botón sirve como "segunda oportunidad" para usuarios que
 * descartaron el botón flotante inicial. Es el estándar de la industria
 * (Twitter/X, Starbucks, Spotify hacen exactamente esto).
 */
export function initSettingsInstallButton() {
    // Buscar el contenedor de la sección PWA en el modal de configuración
    const section = document.getElementById('pwa-settings-section');
    if (!section) {
        console.log('[PWA] Sección de configuración PWA no encontrada en el DOM');
        return;
    }

    // Actualizar estado del botón
    updateSettingsInstallButton();
}

/**
 * Actualiza el estado visual del botón "Descargar App" en Configuración.
 * Se llama al abrir el modal y cuando la app se instala (evento appinstalled).
 *
 * ESTADOS POSIBLES:
 * 1. PWA instalada → botón deshabilitado + mensaje "✅ Tu app ya está instalada"
 * 2. PWA no instalada → botón habilitado + mensaje informativo
 */
export function updateSettingsInstallButton() {
    const btn = document.getElementById('pwa-settings-install-btn');
    const status = document.getElementById('pwa-settings-status');
    if (!btn) return;

    const installed = isPWAInstalled() || localStorage.getItem(PWA_INSTALLED_KEY) === 'true';

    if (installed) {
        // Estado: APP YA INSTALADA
        btn.disabled = true;
        btn.textContent = '✅ App instalada';
        if (status) {
            status.textContent = 'WintonCoin ya está instalada en tu dispositivo.';
            status.className = 'pwa-settings-status installed';
        }
    } else {
        // Estado: APP NO INSTALADA — botón activo
        btn.disabled = false;
        // Limpiar handler previo para evitar acumulación (prevención memory leak)
        btn.onclick = null;
        // Reconstruir contenido del botón de forma segura
        btn.textContent = ''; // Limpiar contenido anterior
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.innerHTML = '<path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>';
        const span = document.createElement('span');
        span.textContent = 'Descargar App';
        btn.appendChild(svg);
        btn.appendChild(span);

        // Asignar handler de click (onclick reemplaza, no acumula)
        btn.onclick = handleInstallClick;

        if (status) {
            status.textContent = 'Instala WintonCoin en tu dispositivo para acceso rápido.';
            status.className = 'pwa-settings-status';
        }
    }
}

// ============================================================================
// FUNCIONES DE UTILIDAD (EXPORTADAS)
// ============================================================================

/**
 * Verifica si la app ya está instalada como PWA (modo standalone)
 * Y que el standalone corresponde a ESTE dominio, no a otro.
 *
 * PROBLEMA RESUELTO: Si el usuario tiene instalada la PWA de producción
 * (wintoncoin.com) y abre demo.wintoncoin.com desde esa app, el
 * display-mode sigue siendo 'standalone' aunque demo NO esté instalada.
 *
 * SOLUCIÓN: Verificar standalone + que el Service Worker activo
 * pertenezca a este origen. Si no hay SW para este origen,
 * el standalone viene de otra PWA → devolver false.
 *
 * Usa tres métodos de detección para máxima compatibilidad:
 * 1. CSS media query display-mode: standalone (W3C estándar)
 * 2. navigator.standalone (propiedad propietaria de Apple/iOS)
 * 3. Verificación de Service Worker del mismo origen
 * @returns {boolean}
 */
export function isPWAInstalled() {
    // Método 1: Media query estándar W3C (Chrome, Edge, Firefox, Samsung)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    // Método 2: Propiedad propietaria de iOS Safari
    const isIOSStandalone = window.navigator.standalone === true;

    if (!isStandalone && !isIOSStandalone) {
        // No está en modo standalone en absoluto → no está instalada
        return false;
    }

    // Está en standalone, pero ¿es la PWA de ESTE dominio?
    // Verificar si hay un Service Worker registrado para este origen.
    // Si no hay SW propio, el standalone viene de otra PWA (ej: producción
    // abriendo demo en su ventana standalone).
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        // Hay un SW controlando esta página → ES la PWA de este dominio
        return true;
    }

    // Standalone pero sin SW propio → probablemente abierto desde otra PWA
    // Verificar también el localStorage como fallback (por si el SW
    // aún no tomó control en la primera carga)
    if (localStorage.getItem(PWA_INSTALLED_KEY) === 'true') {
        return true;
    }

    // Standalone sin SW ni flag → NO es la PWA de este dominio
    return false;
}

/**
 * Verifica si la app puede ser instalada en este momento.
 * @returns {boolean} true si el prompt de instalación está disponible
 */
export function isInstallable() {
    return window.__deferredPrompt !== null;
}

/**
 * Fuerza mostrar el prompt de instalación (si está disponible).
 * Útil para botones personalizados en otras partes de la app.
 * @returns {Promise<string|null>} 'accepted' | 'dismissed' | null
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
