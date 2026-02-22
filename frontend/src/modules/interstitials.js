import { getApiUrl } from './config.js';

/**
 * Módulo para gestionar modales intersticiales (mensajes de bloqueo informativo)
 */

/**
 * Verifica y muestra el mensaje intersticial global si está habilitado
 */
export async function initializeGlobalInterstitial() {
    // 1. Session Guard: No mostrar más de una vez por sesión
    if (sessionStorage.getItem('winton_global_modal_shown') === 'true') {
        return;
    }

    try {
        const response = await fetch(`${getApiUrl()}/api/interstitial/global`);
        if (!response.ok) return;

        const config = await response.json();

        if (config.enabled && config.message) {
            showGlobalInterstitialModal(config.title, config.message);
            // Marcar como mostrado en esta sesión
            sessionStorage.setItem('winton_global_modal_shown', 'true');
        }
    } catch (error) {
        console.error('[Interstitials] Error initializing global modal:', error);
    }
}

/**
 * Renderiza y muestra el modal con estética premium
 */
function showGlobalInterstitialModal(title, message) {
    // Definimos el ID único para este modal
    const modalId = 'global-app-interstitial';

    // Si ya existe por algún motivo, lo removemos
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    // Crear la estructura del modal
    const modalOverlay = document.createElement('div');
    modalOverlay.id = modalId;
    modalOverlay.className = 'interstitial-overlay';

    // Usamos Template Literals para un HTML limpio y profesional
    modalOverlay.innerHTML = `
        <div class="interstitial-container">
            <div class="interstitial-header">
                <div class="interstitial-icon-circle">
                    <span class="interstitial-icon">💡</span>
                </div>
                <h2>${title}</h2>
            </div>
            <div class="interstitial-body">
                <p>${message.replace(/\n/g, '<br>')}</p>
            </div>
            <div class="interstitial-footer">
                <button id="close-interstitial-btn" class="interstitial-action-btn">Entendido</button>
            </div>
        </div>
    `;

    // Añadir estilos dinámicos (para no depender de archivos CSS externos si no es necesario)
    // Aunque lo ideal es añadirlo a landing.css, lo pongo aquí para asegurar funcionalidad inmediata
    const styles = `
        .interstitial-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.4s ease;
        }
        .interstitial-container {
            background: #121926;
            width: 90%;
            max-width: 450px;
            border-radius: 24px;
            padding: 32px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            text-align: center;
            animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .interstitial-header h2 {
            color: #fff;
            margin: 16px 0 8px 0;
            font-size: 24px;
            font-weight: 800;
        }
        .interstitial-icon-circle {
            width: 64px;
            height: 64px;
            background: rgba(11, 95, 255, 0.15);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
        }
        .interstitial-icon {
            font-size: 32px;
        }
        .interstitial-body {
            color: #94a3b8;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 32px;
        }
        .interstitial-action-btn {
            width: 100%;
            padding: 16px;
            background: #0B5FFF;
            color: white;
            border: none;
            border-radius: 14px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .interstitial-action-btn:hover {
            background: #004ecc;
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(11, 95, 255, 0.4);
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    document.body.appendChild(modalOverlay);

    // Evento de cierre
    document.getElementById('close-interstitial-btn').addEventListener('click', () => {
        modalOverlay.style.opacity = '0';
        modalOverlay.style.transition = 'opacity 0.3s ease';
        setTimeout(() => modalOverlay.remove(), 300);
    });
}
