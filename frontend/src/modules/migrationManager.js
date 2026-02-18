/**
 * Módulo de Gestión de Migración (Sunset de sc.wintoncoin.com)
 * Detecta el dominio antiguo y redirige a los usuarios a la nueva Web o App Android.
 */

export function initMigrationCheck() {
    const hostname = window.location.hostname;
    // Dominio antiguo que queremos deprecar
    const OLD_DOMAIN = 'sc.wintoncoin.com';

    // Verificamos si estamos en el dominio viejo
    // Nota: Para probar en local, puedes cambiar esto temporalmente a 'localhost'
    const isOldDomain = hostname === OLD_DOMAIN;

    if (!isOldDomain) return; // Si estamos en el nuevo dominio, no hacemos nada.

    // Detectamos si es Android
    const isAndroid = /Android/i.test(navigator.userAgent);

    renderMigrationModal(isAndroid);
}

function renderMigrationModal(isAndroid) {
    // URLs de destino
    const NEW_WEB_URL = 'https://www.wintoncoin.com';
    // TODO: Reemplazar con el link real de la Play Store cuando esté publicada
    const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.wintoncoin.app';

    const modalHtml = `
        <div id="migration-modal" style="
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.92); z-index: 99999;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            padding: 24px; text-align: center; color: white; font-family: 'Inter', system-ui, sans-serif;
            backdrop-filter: blur(8px);
        ">
            <div style="
                background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                padding: 32px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.15);
                box-shadow: 0 20px 50px rgba(0,0,0,0.6); max-width: 420px; width: 100%;
                animation: popIn 0.3s ease-out;
            ">
                <style>
                    @keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                </style>
                <div style="font-size: 54px; margin-bottom: 20px;">🚀</div>
                <h2 style="margin: 0 0 12px 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">¡Nos estamos mudando!</h2>
                <p style="margin: 0 0 25px 0; font-size: 16px; line-height: 1.6; color: rgba(255,255,255,0.9);">
                    Hemos lanzado una <strong>nueva versión 2.0</strong> de WintonCoin. Esta versión dejará de funcionar en breve.
                </p>

                ${isAndroid ? getAndroidContent(PLAY_STORE_URL) : getWebContent(NEW_WEB_URL)}
                
                <div style="margin-top: 25px; pt-3; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                    <p style="font-size: 12px; opacity: 0.6; margin: 0;">
                        Migrando de <code>sc.wintoncoin.com</code><br>a <code>wintoncoin.com</code>
                    </p>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function getAndroidContent(url) {
    return `
        <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 16px; margin-bottom: 10px;">
            <p style="font-size: 14px; margin-bottom: 12px; font-weight: 500;">🤖 Usuarios Android detectado</p>
            <a href="${url}" target="_blank" style="
                display: flex; align-items: center; justify-content: center; width: 100%; padding: 16px; 
                background: #00d084; color: #fff; font-weight: 700; text-decoration: none;
                border-radius: 12px; font-size: 16px; box-shadow: 0 4px 15px rgba(0,208,132,0.4);
                transition: transform 0.2s;
            " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                <span style="font-size: 20px; margin-right: 10px;">▶️</span> DESCARGAR APP OFICIAL
            </a>
            <p style="font-size: 11px; margin-top: 10px; opacity: 0.7;">Disponible en Google Play Store</p>
        </div>
    `;
}

function getWebContent(url) {
    return `
        <a href="${url}" style="
            display: block; width: 100%; padding: 16px; 
            background: #ffffff; color: #1e3c72; font-weight: 800; text-decoration: none;
            border-radius: 12px; font-size: 16px; box-shadow: 0 4px 15px rgba(255,255,255,0.3);
            transition: transform 0.2s;
        " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
            IR A LA NUEVA WEB 🌐
        </a>
    `;
}
