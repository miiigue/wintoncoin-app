import { registerPushNotifications } from './pushManager.js';

/**
 * Módulo: Notification Gate (Friendly UI)
 * Propósito: Invitar amigablemente al usuario a activar notificaciones.
 * Diseño: Azul confianza, Glassmorphism, lenguaje positivo.
 */

const gateStyles = `
.notification-gate-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    /* Fondo Glassmorphism amigable */
    background: rgba(10, 25, 50, 0.85); 
    backdrop-filter: blur(8px);
    z-index: 20000;
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    font-family: 'Inter', system-ui, sans-serif;
    animation: fadeInOverlay 0.5s ease-out;
}

@keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }

.gate-content {
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); /* Azul Profundo Profesional */
    padding: 40px 30px; 
    border-radius: 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
    max-width: 420px; width: 90%;
    text-align: center;
    color: white;
    transform-origin: center;
    animation: floatIn 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes floatIn {
    from { opacity: 0; transform: translateY(30px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

.gate-icon-wrapper {
    width: 80px; height: 80px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 25px auto;
    font-size: 36px;
    box-shadow: 0 10px 20px rgba(0,0,0,0.1);
    border: 1px solid rgba(255,255,255,0.2);
}

.gate-title { 
    font-size: 24px; font-weight: 700; margin-bottom: 12px; 
    color: #ffffff;
    letter-spacing: -0.5px;
}

.gate-text { 
    font-size: 15px; line-height: 1.6; margin-bottom: 30px; 
    color: rgba(255, 255, 255, 0.9); 
}

.gate-btn {
    background: white; 
    color: #1e3c72; 
    border: none; padding: 16px 32px;
    font-size: 16px; font-weight: 700; border-radius: 50px; cursor: pointer;
    width: 100%; 
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    transition: transform 0.2s, box-shadow 0.2s;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.gate-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
.gate-btn:active { transform: translateY(0); }

.gate-tech-note {
    margin-top: 25px; font-size: 13px; color: rgba(255,255,255,0.5);
    background: rgba(0,0,0,0.2); padding: 10px 15px; border-radius: 10px;
}
`;

export async function initNotificationGate() {
    if (!document.getElementById('gate-styles')) {
        const styleSheet = document.createElement("style");
        styleSheet.id = 'gate-styles';
        styleSheet.innerText = gateStyles;
        document.head.appendChild(styleSheet);
    }
    evaluateEnvironmentAndPermissions();
}

function evaluateEnvironmentAndPermissions() {
    if (!window.isSecureContext) {
        renderGate('insecure');
        return;
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        renderGate('unsupported');
        return;
    }

    const permission = Notification.permission;
    if (permission === 'granted') {
        closeGate();
        registerPushNotifications().catch(console.error);
    } else if (permission === 'denied') {
        renderGate('denied');
    } else {
        renderGate('default');
    }
}

function renderGate(state) {
    const existing = document.querySelector('.notification-gate-overlay');
    if (existing) existing.remove();

    const config = getUIConfig(state);

    const overlay = document.createElement('div');
    overlay.className = 'notification-gate-overlay';

    overlay.innerHTML = `
        <div class="gate-content">
            <div class="gate-icon-wrapper">
                <span>${config.icon}</span>
            </div>
            <h2 class="gate-title">${config.title}</h2>
            <p class="gate-text">${config.text}</p>
            
            ${config.showButton ? `<button class="gate-btn" id="gate-main-btn">${config.btnText}</button>` : ''}
            
            ${config.extraHtml ? config.extraHtml : ''}
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const btn = document.getElementById('gate-main-btn');
    if (btn) {
        btn.addEventListener('click', async () => {
            if (config.action === 'request') {
                await requestPermissionStrict();
            } else if (config.action === 'reload') {
                window.location.reload();
            }
        });
    }
}

function getUIConfig(state) {
    switch (state) {
        case 'insecure':
            return {
                icon: '🔒',
                title: 'Conexión Privada Requerida',
                text: 'Por tu seguridad, esta función solo está disponible en conexiones HTTPS seguras.<br><br><b>Nota Desarrollo:</b> Usa localhost o despliega en Hostinger/Vercel.',
                showButton: false,
                extraHtml: `<div class="gate-tech-note">URL detectada: ${window.location.protocol}//${window.location.host}</div>`
            };
        case 'unsupported':
            return {
                icon: '📱',
                title: 'Navegador No Compatible',
                text: 'Para la mejor experiencia, te recomendamos usar Chrome en Android o Safari en iOS (agregando a Inicio).',
                showButton: false
            };
        case 'denied':
            return {
                icon: '⚙️',
                title: 'Notificaciones Desactivadas',
                text: 'Parece que las notificaciones están bloqueadas en tu navegador. Para recibir tus alertas, necesitas habilitarlas manualmente.',
                btnText: 'Recargar Página',
                action: 'reload',
                showButton: true,
                extraHtml: `<div class="gate-tech-note">Tip: Toca el candado 🔒 en la barra de dirección > Permisos > Reset</div>`
            };
        case 'default':
        default:
            return {
                icon: '🔔',
                title: 'Por seguridad',
                text: 'Activa las notificaciones para mantenerte informado sobre tus transacciones.',
                btnText: 'Sí, Activar Alertas',
                action: 'request',
                showButton: true,
                extraHtml: ''
            };
    }
}

async function requestPermissionStrict() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            closeGate();
            await registerPushNotifications();
        } else {
            renderGate('denied');
        }
    } catch (error) {
        console.error("Error solicitando permiso:", error);
    }
}

function closeGate() {
    const overlay = document.querySelector('.notification-gate-overlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
}
