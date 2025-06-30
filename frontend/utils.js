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

// --- Configuración Global de la Aplicación ---

// Guardamos la configuración en una variable global para que todos los scripts puedan acceder a ella.
window.appSettings = {
    public_profiles_enabled: false // Valor por defecto hasta que se cargue del backend
};

/**
 * Carga las configuraciones desde el backend y las almacena en window.appSettings.
 * @returns {Promise<void>}
 */
async function loadAppSettings() {
    // Lógica para determinar la URL del API automáticamente
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';

    try {
        const response = await fetch(`${API_URL}/api/settings`);
        if (!response.ok) {
            console.warn('No se pudo cargar la configuración de la aplicación desde el backend.');
            return;
        }
        const settings = await response.json();
        // Mezclamos los nuevos settings con los que ya pudieran existir
        window.appSettings = { ...window.appSettings, ...settings };
        
        // Disparamos un evento personalizado para notificar a otros scripts que la configuración ha cargado.
        // Esto es una práctica profesional para manejar tareas asíncronas.
        document.dispatchEvent(new CustomEvent('app-settings-loaded'));

    } catch (error) {
        console.error('Error de red al cargar la configuración de la aplicación:', error);
    }
}

// Invocamos la carga de configuración tan pronto como el script se ejecuta.
// Usamos una función autoejecutable para no contaminar el scope global.
(async () => {
    await loadAppSettings();
})(); 