// ============================================================================
// WintonCoin - Módulo de Alertas y Modales
// ============================================================================
// Sistema de alertas y confirmaciones personalizadas
// ============================================================================

// Variable para guardar la acción a realizar después de cerrar el modal
let onAlertCloseCallback = null;
let onConfirmCallback = null;

/**
 * Muestra un modal de alerta personalizado con un mensaje.
 * @param {string} message El mensaje a mostrar en el modal.
 * @param {function} [onClose] Una función opcional que se ejecutará cuando el modal se cierre.
 */
export function showCustomAlert(message, onClose) {
    const container = document.getElementById('custom-alert-container');
    
    if (container) {
        // Limpiamos cualquier alerta anterior
        container.innerHTML = '';
        
        // Creamos la estructura del modal dinámicamente
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        const messageElement = document.createElement('p');
        messageElement.textContent = message;
        
        const closeButton = document.createElement('button');
        closeButton.className = 'action-button';
        closeButton.textContent = 'Cerrar';
        
        modalContent.appendChild(messageElement);
        modalContent.appendChild(closeButton);
        modal.appendChild(modalContent);
        container.appendChild(modal);
        
        onAlertCloseCallback = typeof onClose === 'function' ? onClose : null;

        const closeModal = () => {
            container.innerHTML = ''; // Limpiamos al cerrar
            if (onAlertCloseCallback) {
                onAlertCloseCallback();
                onAlertCloseCallback = null;
            }
        };

        closeButton.addEventListener('click', closeModal);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });
        
    } else {
        // Fallback al alert nativo si el contenedor no se encuentra
        alert(message);
        if (typeof onClose === 'function') {
            onClose();
        }
    }
}

/**
 * Cierra el modal de alerta personalizado y ejecuta el callback si existe.
 */
export function closeCustomAlert() {
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

/**
 * Muestra un modal de confirmación personalizado.
 * @param {string} message El mensaje a mostrar.
 * @param {function} onConfirm La función a ejecutar si el usuario confirma.
 */
export function showCustomConfirm(message, onConfirm) {
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
export function closeCustomConfirm() {
    const modal = document.getElementById('customConfirmModal');
    if (modal) {
        modal.style.display = 'none';
    }
    onConfirmCallback = null;
}

/**
 * Función interna que se llama al hacer clic en el botón de confirmar.
 */
export function handleConfirm() {
    if (onConfirmCallback) {
        onConfirmCallback();
    }
    closeCustomConfirm();
}

/**
 * Inicializa los listeners para los modales de alerta y confirmación.
 * Debe llamarse cuando el DOM esté listo.
 */
export function initializeAlertListeners() {
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
}
