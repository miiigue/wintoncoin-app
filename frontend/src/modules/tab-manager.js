// ============================================================================
// WintonCoin Tab Manager - Prevención de Pestañas Duplicadas
// ============================================================================
// Detecta de forma proactiva si la aplicación ya está abierta en otra pestaña
// del navegador actual, notificando al usuario para evitar problemas de sincronía
// de sesión y duplicación de procesos innecesarios.
// ============================================================================

export function initTabManager() {
    // Si no está en entorno navegador o no soporta BroadcastChannel, ignorar
    if (typeof window === 'undefined' || !window.BroadcastChannel) return;

    // Solo habilitar en el Dashboard para evitar molestar en las landing o login/registro básico
    // MOTIVO: El Dashboard es donde ocurren las operaciones en caliente y consultas de saldo
    const path = window.location.pathname;
    if (!path.includes('contract_interaction.html')) return;

    const CHANNEL_NAME = 'wintoncoin_active_tabs_channel';
    const bc = new BroadcastChannel(CHANNEL_NAME);
    const tabId = Math.random().toString(36).substring(2, 9);
    
    let isDuplicate = false;

    // Escuchar mensajes de otras pestañas
    bc.onmessage = (event) => {
        if (event.data.type === 'PING') {
            // Otra pestaña se acaba de abrir, le respondemos PONG
            bc.postMessage({ type: 'PONG', senderId: tabId });
        } else if (event.data.type === 'PONG') {
            // Recibimos respuesta de una pestaña ya existente
            if (!isDuplicate) {
                isDuplicate = true;
                showDuplicateTabWarning();
            }
        }
    };

    // Mandamos PING al iniciar la carga para ver si alguien responde
    bc.postMessage({ type: 'PING', senderId: tabId });
}

function showDuplicateTabWarning() {
    // Si ya existe la advertencia visual, no duplicarla
    if (document.getElementById('duplicate-tab-warning')) return;

    // Crear un banner elegante de advertencia con Glassmorphism
    const warningDiv = document.createElement('div');
    warningDiv.id = 'duplicate-tab-warning';
    warningDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(20, 20, 25, 0.95);
        border: 1px solid rgba(255, 193, 7, 0.5);
        border-radius: 12px;
        padding: 18px 24px;
        z-index: 999999;
        max-width: 90%;
        width: 420px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(255, 193, 7, 0.2);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: #fff;
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        display: flex;
        flex-direction: column;
        gap: 12px;
        animation: slideDownFade 0.3s ease-out;
    `;

    // Inyectar animación slideDownFade si no existe
    if (!document.getElementById('slide-down-fade-style')) {
        const style = document.createElement('style');
        style.id = 'slide-down-fade-style';
        style.textContent = `
            @keyframes slideDownFade {
                from { transform: translate(-50%, -20px); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    warningDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px; color: #ffc107; display: flex; align-items: center;">⚠️</span>
            <strong style="font-size: 1.1rem; font-weight: 700; color: #ffc107;">Pestaña Duplicada Detectada</strong>
        </div>
        <p style="margin: 0; font-size: 0.9rem; color: rgba(255, 255, 255, 0.85); line-height: 1.5; font-weight: 500;">
            Ya tienes otra pestaña activa del Panel de WintonCoin. Te sugerimos cerrar esta ventana y usar la pestaña original para evitar conflictos con tu saldo y transacciones.
        </p>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px;">
            <button id="close-duplicate-btn" style="
                background: linear-gradient(135deg, #ffc107, #ff9800);
                border: none;
                color: #000;
                font-weight: bold;
                padding: 8px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 0.85rem;
                box-shadow: 0 0 10px rgba(255, 193, 7, 0.3);
                transition: all 0.2s;
            ">Entendido</button>
        </div>
    `;

    document.body.appendChild(warningDiv);

    document.getElementById('close-duplicate-btn').onclick = () => {
        warningDiv.remove();
    };
}
