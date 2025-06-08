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

// Es importante inicializar los listeners una vez que el DOM esté cargado.
// Podríamos añadir un inicializador aquí o asegurarnos de que se llama
// desde los otros scripts. Por simplicidad, añadiremos un listener aquí.
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('customAlertModal');
    const closeButtons = document.querySelectorAll('.alert-close-button');

    if (modal) {
         // Cerrar el modal si se hace clic fuera del contenido
        window.addEventListener('click', (event) => {
            if (event.target == modal) {
                closeCustomAlert();
            }
        });

        // Listeners para los botones de cerrar
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                closeCustomAlert();
            });
        });
    }
}); 