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

// Wizard State
let currentStep = 0;
const wizardSteps = [
    {
        title: "Ayúdanos a protegerte 🛡️",
        text: "Las notificaciones son <strong>indispensables</strong> para la seguridad de tu cuenta y confirmar transacciones.<br><br>Parece que están bloqueadas. Te explicamos cómo activarlas en unos segundos.",
        img: "assets/images/tutorial/intro_security.png",
        icon: "🛡️"
    },
    {
        title: "Paso 1: Toca el Candado",
        text: "En la barra de dirección de tu navegador, toca el icono del <strong>Candado 🔒</strong> o Ajustes.",
        img: "assets/images/tutorial/step1_lock.png",
        icon: "🔒"
    },
    {
        title: "Paso 2: Permisos",
        text: "En el menú que se abre, busca y selecciona <strong>'Permisos'</strong> (icono 🎛️ o ⚙️).",
        img: "assets/images/tutorial/step2_permissions.png",
        icon: "🎛️"
    },
    {
        title: "Paso 3: Activar",
        text: "Busca 'Notificaciones' y <strong>Activa el interruptor</strong> 🟢 para habilitarlas.",
        img: "assets/images/tutorial/step3_toggle.png",
        icon: "🔔"
    }
];

function showGate(isDenied) {
    if (document.querySelector('.notification-gate-overlay')) return;

    // Si NO está denegado (primera vez), mostrar prompt simple
    if (!isDenied) {
        showSimpleGate();
        return;
    }

    // Si ESTÁ denegado, mostrar Wizard
    showWizardGate();
}

function showSimpleGate() {
    const overlay = document.createElement('div');
    overlay.className = 'notification-gate-overlay';
    overlay.innerHTML = `
        <div class="gate-content">
            <span class="gate-icon">🔔</span>
            <h2 class="gate-title">Activar Notificaciones</h2>
            <p class="gate-text">Recibe actualizaciones importantes sobre tu cuenta en tiempo real.</p>
            <button class="gate-btn" id="gate-action-btn">Continuar</button>
        </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    document.getElementById('gate-action-btn').addEventListener('click', async () => {
        await requestPermissionFromGate();
    });
}

function showWizardGate() {
    const overlay = document.createElement('div');
    overlay.className = 'notification-gate-overlay';

    // CSS dinámico para el Wizard
    const wizardStyles = `
        <style>
            .gate-wizard-img-container {
                width: 100%;
                height: 160px;
                background: #f0f2f5;
                border-radius: 12px;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }
            .gate-wizard-img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .gate-wizard-placeholder {
                font-size: 50px;
                opacity: 0.3;
            }
            .gate-dots {
                display: flex;
                justify-content: center;
                gap: 6px;
                margin-bottom: 20px;
            }
            .gate-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #e0e0e0;
                transition: all 0.3s ease;
            }
            .gate-dot.active {
                background: #4F46E5;
                width: 24px;
                border-radius: 4px;
            }
            .gate-nav {
                display: flex;
                gap: 12px;
            }
            .gate-btn-secondary {
                background: #f3f4f6;
                color: #4b5563;
                border: none;
                padding: 12px 20px;
                font-size: 16px;
                font-weight: 500;
                border-radius: 12px;
                cursor: pointer;
                flex: 1;
            }
        </style>
    `;

    overlay.innerHTML = `
        ${wizardStyles}
        <div class="gate-content">
            <div id="wizard-step-container">
                <!-- Inyectado por JS -->
            </div>
            
            <div class="gate-dots" id="wizard-dots">
                <!-- Dots dinámicos -->
            </div>

            <div class="gate-nav">
                <button class="gate-btn-secondary" id="wizard-prev" style="display:none">Atrás</button>
                <button class="gate-btn" id="wizard-next">Siguiente</button>
            </div>
            
            <div id="gate-msg" style="margin-top:15px; font-size:12px; color:#666; display:none"></div>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Inicializar lógica
    currentStep = 0;
    renderWizardStep();

    document.getElementById('wizard-next').addEventListener('click', () => {
        if (currentStep < wizardSteps.length - 1) {
            currentStep++;
            renderWizardStep();
        } else {
            checkPermissionsAndFinish();
        }
    });

    document.getElementById('wizard-prev').addEventListener('click', () => {
        if (currentStep > 0) {
            currentStep--;
            renderWizardStep();
        }
    });

    // Auto-detectar cambios
    if ('permissions' in navigator) {
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
}

function renderWizardStep() {
    const step = wizardSteps[currentStep];
    const container = document.getElementById('wizard-step-container');
    const dotsContainer = document.getElementById('wizard-dots');
    const nextBtn = document.getElementById('wizard-next');
    const prevBtn = document.getElementById('wizard-prev');

    // Contenido del paso (con fallback de icono si la imagen falla)
    container.innerHTML = `
        <div class="gate-wizard-img-container">
            <img src="${step.img}" class="gate-wizard-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
            <div class="gate-wizard-placeholder" style="display:none">${step.icon}</div>
        </div>
        <h2 class="gate-title">${step.title}</h2>
        <p class="gate-text" style="min-height: 50px;">${step.text}</p>
    `;

    // Dots
    dotsContainer.innerHTML = wizardSteps.map((_, idx) =>
        `<div class="gate-dot ${idx === currentStep ? 'active' : ''}"></div>`
    ).join('');

    // Botones
    prevBtn.style.display = currentStep === 0 ? 'none' : 'block';

    if (currentStep === 0) {
        nextBtn.textContent = "Mostrarme cómo";
        nextBtn.style.background = "#4F46E5";
    } else if (currentStep === wizardSteps.length - 1) {
        nextBtn.textContent = "Ya las habilité";
        nextBtn.style.background = "#10B981"; // Green
    } else {
        nextBtn.textContent = "Siguiente";
        nextBtn.style.background = "#4F46E5"; // Indigo
    }
}

async function checkPermissionsAndFinish() {
    if (Notification.permission === 'granted') {
        removeGate();
        await registerPushNotifications();
        if (gateResolver) gateResolver();
    } else {
        const msg = document.getElementById('gate-msg');
        if (msg) {
            msg.innerHTML = '⚠️ Aún aparecen bloquedas. Si ya cambiaste el ajuste, pulsa aquí para recargar.';
            msg.style.display = 'block';
            msg.style.cursor = 'pointer';
            msg.onclick = () => window.location.reload();
        }
        // Animación "shake"
        const btn = document.getElementById('wizard-next');
        btn.style.transform = "translateX(5px)";
        setTimeout(() => btn.style.transform = "translateX(-5px)", 100);
        setTimeout(() => btn.style.transform = "none", 200);
    }
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
