// ============================================================================
// WintonCoin - In-App Browser Detector (WhatsApp, Instagram, FB)
// ============================================================================
// Detecta si la aplicación se está cargando dentro de un WebView interno/sandbox
// (por ejemplo, al hacer clic en un enlace de referido desde WhatsApp o Instagram).
// Ofrece instrucciones claras y visuales al usuario para saltar al navegador
// nativo de su sistema operativo y poder utilizar la sesión activa y PWA.
// ============================================================================

export function initInAppDetector() {
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isWhatsApp = ua.indexOf('WhatsApp') > -1;
    const isInstagram = ua.indexOf('Instagram') > -1;
    const isFacebook = ua.indexOf('FBAN') > -1 || ua.indexOf('FBAV') > -1;

    // Si no es un navegador interno detectado, terminar de inmediato
    if (!isWhatsApp && !isInstagram && !isFacebook) return;

    // Si el banner ya está dibujado en el DOM, no hacer nada
    if (document.getElementById('in-app-browser-banner')) return;

    // Crear banner informativo estilizado con degradados premium y sombra
    const banner = document.createElement('div');
    banner.id = 'in-app-browser-banner';
    banner.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        background: linear-gradient(135deg, #1A1A29, #0B0B13);
        border-top: 3px solid #00f2fe;
        padding: 20px 24px;
        z-index: 1000000;
        box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
        color: #fff;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        box-sizing: border-box;
        animation: slideUpFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    // Inyectar animación slideUpFadeIn si no existe
    if (!document.getElementById('slide-up-fade-in-style')) {
        const style = document.createElement('style');
        style.id = 'slide-up-fade-in-style';
        style.textContent = `
            @keyframes slideUpFadeIn {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    // Detectar OS para adaptar las instrucciones específicas
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    let titleText = 'Navegador de WhatsApp detectado';
    if (isInstagram) titleText = 'Navegador de Instagram detectado';
    else if (isFacebook) titleText = 'Navegador de Facebook detectado';

    let instructionsText = '';
    if (isIOS) {
        instructionsText = 'Para iniciar sesión o ver tu cuenta, <strong>toca el icono de Safari (brújula)</strong> en la esquina inferior derecha para abrir la app correctamente.';
    } else {
        instructionsText = 'Para iniciar sesión o ver tu cuenta, <strong>toca los tres puntos (⋮)</strong> arriba a la derecha y selecciona <strong>"Abrir en el navegador"</strong> (o Chrome).';
    }

    banner.innerHTML = `
        <div style="max-width: 650px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; position: relative;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px; animation: bounceIcon 2s infinite;">📱</span>
                <strong style="font-size: 1.1rem; font-weight: 700; color: #00f2fe; letter-spacing: 0.5px;">${titleText}</strong>
            </div>
            <p style="margin: 0; font-size: 0.9rem; color: rgba(255, 255, 255, 0.9); line-height: 1.5; font-weight: 500;">
                ${instructionsText}
            </p>
            <button id="close-inapp-btn" style="
                position: absolute;
                top: -5px;
                right: -5px;
                background: transparent;
                border: none;
                color: rgba(255,255,255,0.4);
                font-size: 20px;
                cursor: pointer;
                padding: 5px;
                transition: color 0.2s;
            ">×</button>
        </div>
    `;

    // Agregar estilos extra para la animación del icono
    if (!document.getElementById('bounce-icon-style')) {
        const style = document.createElement('style');
        style.id = 'bounce-icon-style';
        style.textContent = `
            @keyframes bounceIcon {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-4px); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(banner);

    // Ajustar el margen inferior de la app para que el banner no tape contenido crítico
    document.body.style.paddingBottom = '110px';

    document.getElementById('close-inapp-btn').onclick = () => {
        banner.remove();
        document.body.style.paddingBottom = '';
    };
}
