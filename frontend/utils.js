/* --- Funciones del Modal de Alerta Personalizado --- */

// Variable para guardar la acción a realizar después de cerrar el modal
let onAlertCloseCallback = null;

/**
 * Muestra un modal de alerta personalizado con un mensaje.
 * @param {string} message El mensaje a mostrar en el modal.
 * @param {function} [onClose] Una función opcional que se ejecutará cuando el modal se cierre.
 */
function showCustomAlert(message, onClose) {
    const modal = document.getElementById('customAlertModal');
    const messageElement = document.getElementById('customAlertMessage');
    
    if (modal && messageElement) {
        messageElement.textContent = message;
        onAlertCloseCallback = typeof onClose === 'function' ? onClose : null;
        modal.style.display = 'flex';
    } else {
        // Fallback al alert nativo si el modal no se encuentra en el DOM
        alert(message);
        // Si hay una función de callback, ejecutarla también aquí
        if (typeof onClose === 'function') {
            onClose();
        }
    }
}

/**
 * Cierra el modal de alerta personalizado y ejecuta el callback si existe.
 */
function closeCustomAlert() {
    const modal = document.getElementById('customAlertModal');
    if (modal) {
        modal.style.display = 'none';
    }

    // Si hay una función guardada, la ejecutamos y luego la limpiamos
    if (onAlertCloseCallback) {
        onAlertCloseCallback();
        onAlertCloseCallback = null;
    }
}

// --- Funciones del Modal de Confirmación ---
let onConfirmCallback = null;

/**
 * Muestra un modal de confirmación personalizado.
 * @param {string} message El mensaje a mostrar.
 * @param {function} onConfirm La función a ejecutar si el usuario confirma.
 */
function showCustomConfirm(message, onConfirm) {
    const modal = document.getElementById('customConfirmModal');
    const messageElement = document.getElementById('customConfirmMessage');
    
    if (modal && messageElement) {
        messageElement.textContent = message;
        onConfirmCallback = typeof onConfirm === 'function' ? onConfirm : null;
        modal.style.display = 'flex';
    } else {
        // Fallback al confirm nativo si el modal no se encuentra
        if (confirm(message)) {
            if (typeof onConfirm === 'function') {
                onConfirm();
            }
        }
    }
}

/**
 * Cierra el modal de confirmación y limpia el callback.
 */
function closeCustomConfirm() {
    const modal = document.getElementById('customConfirmModal');
    if (modal) {
        modal.style.display = 'none';
    }
    onConfirmCallback = null;
}

/**
 * Función interna que se llama al hacer clic en el botón de confirmar.
 */
function handleConfirm() {
    if (onConfirmCallback) {
        onConfirmCallback();
    }
    closeCustomConfirm();
}

// Es importante inicializar los listeners una vez que el DOM esté cargado.
// Podríamos añadir un inicializador aquí o asegurarnos de que se llama
// desde los otros scripts. Por simplicidad, añadiremos un listener aquí.
document.addEventListener('DOMContentLoaded', () => {
    const alertModal = document.getElementById('customAlertModal');
    const alertCloseButtons = document.querySelectorAll('.alert-close-button');
    const confirmModal = document.getElementById('customConfirmModal');

    // Listener global para cerrar modales al hacer clic fuera
    window.addEventListener('click', (event) => {
        if (event.target === alertModal) {
            closeCustomAlert();
        }
        if (event.target === confirmModal) {
            closeCustomConfirm();
        }
    });
    
    // Listeners para el modal de alerta
    if (alertModal) {
        alertCloseButtons.forEach(button => {
            button.addEventListener('click', closeCustomAlert);
        });
    }

    // Listeners para el modal de confirmación
    if (confirmModal) {
        const closeBtn = confirmModal.querySelector('.confirm-close-button');
        const cancelBtn = confirmModal.querySelector('.cancel-button');
        const confirmBtn = confirmModal.querySelector('.confirm-button');

        if (closeBtn) closeBtn.addEventListener('click', closeCustomConfirm);
        if (cancelBtn) cancelBtn.addEventListener('click', closeCustomConfirm);
        if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
    }
}); 

/**
 * Busca texto que parezca un enlace (http, https, www) y lo convierte en una etiqueta <a> clicable.
 * @param {string} text - El texto a procesar.
 * @returns {string} El texto con los enlaces convertidos a HTML.
 */
function linkify(text) {
    if (!text) return '';
    
    // Primero, escapamos el HTML básico para evitar inyección de XSS simple.
    // Esto convierte < en &lt;, etc.
    const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Regex para encontrar URLs.
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;

    return escapedText.replace(urlRegex, function(url) {
        // Para los enlaces que empiezan con 'www', añadimos 'http://' para que funcionen.
        const fullUrl = url.startsWith('www.') ? 'http://' + url : url;
        return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="embedded-link">${url}</a>`;
    });
}

// --- Configuración Global de la Aplicación ---

// Guardamos la configuración en una variable global para que todos los scripts puedan acceder a ella.
window.appSettings = {};

/**
 * Carga las configuraciones desde el backend y las almacena en window.appSettings.
 * @returns {Promise<void>}
 */
window.fetchAndStoreAppSettings = async function() {
    // Lógica para determinar la URL del API automáticamente
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';

    try {
        // Si ya hemos cargado la configuración, no la volvemos a pedir.
        if (Object.keys(window.appSettings).length > 0) {
            return;
        }

        const response = await fetch(`${API_URL}/api/app-settings`); // APUNTAMOS A LA NUEVA RUTA SEGURA
        if (!response.ok) {
            throw new Error('No se pudo cargar la configuración de la aplicación.');
        }
        const settingsObject = await response.json();
        
        window.appSettings = settingsObject;
        
        // Opcional: Disparar un evento para notificar que la configuración está lista
        document.dispatchEvent(new CustomEvent('app-settings-loaded'));

    } catch (error) {
        console.error('Error de red al cargar la configuración de la aplicación:', error);
        // En caso de error, podríamos querer manejarlo de alguna forma, 
        // por ahora solo lo mostraremos en la consola.
    }
}; 