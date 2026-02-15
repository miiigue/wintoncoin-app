import { registerPushNotifications } from './pushManager.js';

// Estilos del muro (Overlay Amigable)
const styles = `
.notification-gate-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;      /* Fallback para navegadores viejos */
    height: 100dvh;     /* Altura dinámica exacta para móviles */
    background-color: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(5px);
    z-index: 99999;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 0;         /* Quitamos padding del contenedor padre */
    box-sizing: border-box;
    font-family: 'Poppins', sans-serif;
    animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.gate-content {
    background: white;
    padding: 30px;
    border-radius: 24px;
    max-width: 90%;      /* Ancho responsivo */
    width: 380px;        /* Ancho ideal */
    margin: 20px;        /* Margen de seguridad contra bordes */
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
    border: 1px solid rgba(0,0,0,0.05);
    box-sizing: border-box;
}

.gate-icon {
    font-size: 48px;
    margin-bottom: 15px;
    display: block;
    animation: float 3s ease-in-out infinite;
}

@keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
    100% { transform: translateY(0px); }
}

.gate-title {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 10px;
    color: #333;
}

.gate-text {
    font-size: 15px;
    line-height: 1.5;
    margin-bottom: 25px;
    color: #666;
}

.gate-btn {
    background: #4F46E5; /* Soft Indigo */
    color: white;
    border: none;
    padding: 12px 30px;
    font-size: 16px;
    font-weight: 500;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
}

.gate-btn:hover {
    background: #4338ca;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(79, 70, 229, 0.3);
}

.gate-refresh-link {
    margin-top: 15px;
    font-size: 13px;
    color: #999;
    cursor: pointer;
    text-decoration: underline;
    background: none;
    border: none;
}
`;

let gateResolver = null;

export function initNotificationGate() {
    return new Promise((resolve) => {
        // 1. Inyectar estilos
        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);

        // 2. Verificar estado actual
        const alreadyGranted = checkPermissionAndGate();
        if (alreadyGranted) {
            resolve();
        } else {
            gateResolver = resolve;
        }
    });
}

function checkPermissionAndGate() {
    if (!('Notification' in window)) return true; // Si no soporta, pasa

    const permission = Notification.permission;

    if (permission === 'granted') {
        removeGate();
        registerPushNotifications();
        return true;
    }

    // Mostrar Gate (tanto para default como denied)
    showGate(permission === 'denied');
    return false;
}

function showGate(isDenied) {
    if (document.querySelector('.notification-gate-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'notification-gate-overlay';

    // Contenido Ligero y Positivo
    const icon = isDenied ? '🔒' : '🔔';
    const title = isDenied ? 'Notificaciones Bloqueadas' : 'Activar Notificaciones';

    const text = isDenied
        ? 'Has bloqueado las notificaciones. Para continuar:<br><br><strong>1. Toca el candado 🔒 o ajustes en la barra de dirección.<br>2. Selecciona "Permisos" (icono 🎛️ o ⚙️).<br>3. Activa "Notificaciones" y regresa aquí.</strong>'
        : 'Recibe actualizaciones importantes sobre tu cuenta en tiempo real.';

    const btnText = isDenied ? 'Ya las habilité' : 'Continuar';

    overlay.innerHTML = `
        <div class="gate-content">
            <span class="gate-icon">${icon}</span>
            <h2 class="gate-title">${title}</h2>
            <p class="gate-text">${text}</p>
            <button class="gate-btn" id="gate-action-btn">${btnText}</button>
            ${isDenied ? '<div id="gate-msg" style="margin-top:10px; font-size:12px; color:#666;">Esperando cambio de permisos...</div>' : ''}
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden'; // Evitar scroll

    // Listener automático para detectar el desbloqueo sin recargar (Chrome/Edge)
    if (isDenied && 'permissions' in navigator) {
        navigator.permissions.query({ name: 'notifications' }).then(status => {
            status.onchange = () => {
                if (status.state === 'granted') {
                    removeGate();
                    registerPushNotifications();
                    if (gateResolver) gateResolver();
                }
            };
        }).catch(() => { });
    }

    document.getElementById('gate-action-btn').addEventListener('click', async () => {
        if (isDenied) {
            // Verificar estado actual
            if (Notification.permission === 'granted') {
                removeGate();
                await registerPushNotifications();
                if (gateResolver) gateResolver();
            } else {
                // Si sigue bloqueado, forzar recarga para asegurar que el navegador actualice
                const msg = document.getElementById('gate-msg');
                if (msg) {
                    msg.innerHTML = 'Recargando para verificar...';
                    msg.style.color = '#4F46E5';
                }
                setTimeout(() => window.location.reload(), 800);
            }
        } else {
            await requestPermissionFromGate();
        }
    });
}

async function requestPermissionFromGate() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            removeGate();
            await registerPushNotifications();
            // Resolver promesa para continuar flujo (ej: Tour)
            if (gateResolver) gateResolver();
        } else {
            // Si rechaza, recargamos la interfaz para mostrar el estado "denegado" (opcional, o mantenemos el gate)
            document.querySelector('.notification-gate-overlay').remove();
            showGate(true);
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

function removeGate() {
    const overlay = document.querySelector('.notification-gate-overlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
}
