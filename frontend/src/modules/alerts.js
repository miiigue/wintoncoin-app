// ============================================================================

import { getApiUrl } from './config.js';
import { escapeHtml, escapeAttr } from './sanitize.js';

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

/**
 * Muestra el modal de aceptación legal para Términos y Condiciones / Política de Privacidad.
 * Diseño premium, glassmorphism, responsive, accesible y 100% seguro contra inyecciones XSS.
 * 
 * @param {Array} pendingDocs Lista de documentos pendientes (e.g. [{type, version, content_hash}])
 * @param {Function} onAccepted Callback a ejecutar cuando el usuario acepta con éxito en el servidor
 * @param {Function} onCancelled Callback a ejecutar si el usuario cancela o cierra el modal
 */
export function showLegalAcceptanceModal(pendingDocs, onAccepted, onCancelled) {
    // 1. Validar o buscar contenedor global de alertas
    let container = document.getElementById('custom-alert-container');
    if (!container) {
        // Si no existe, lo creamos dinámicamente en el body para evitar bloquear la UI
        container = document.createElement('div');
        container.id = 'custom-alert-container';
        document.body.appendChild(container);
    }

    // 2. Eliminar cualquier instancia previa del modal para evitar conflictos de id/estado
    const existingModal = document.getElementById('legalAcceptanceModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 3. Crear el nodo contenedor principal del modal
    const modal = document.createElement('div');
    modal.id = 'legalAcceptanceModal';
    modal.className = 'modal';
    modal.style.display = 'flex';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    // 4. Evaluar si es un error de configuración legal en DB o un flujo normal de aceptación
    const isConfigError = !Array.isArray(pendingDocs) || pendingDocs.length === 0;

    if (isConfigError) {
        // Caso A: Bloqueo de seguridad por falta de configuración en la Base de Datos
        const title = document.createElement('h3');
        title.textContent = 'Error de Configuración';
        modalContent.appendChild(title);

        const warningBox = document.createElement('div');
        warningBox.className = 'legal-warning-box';
        warningBox.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #ef4444; margin-right: 8px;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>La plataforma requiere publicar documentos legales activos antes de habilitar operaciones. Por favor, contacte con el soporte técnico o al administrador.</span>
        `;
        modalContent.appendChild(warningBox);

        const actionsLayout = document.createElement('div');
        actionsLayout.className = 'legal-actions-layout';
        actionsLayout.style.width = '100%';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'legal-btn legal-btn-cancel';
        closeBtn.style.width = '100%';
        closeBtn.textContent = 'Cerrar';
        closeBtn.addEventListener('click', () => {
            modal.remove();
            if (typeof onCancelled === 'function') onCancelled();
        });

        actionsLayout.appendChild(closeBtn);
        modalContent.appendChild(actionsLayout);
    } else {
        // Caso B: Aceptación regular de documentos legales pendientes
        const title = document.createElement('h3');
        title.textContent = 'Aceptación Legal';
        modalContent.appendChild(title);

        const checklist = document.createElement('div');
        checklist.className = 'legal-checklist';

        pendingDocs.forEach((doc, index) => {
            const item = document.createElement('div');
            item.className = 'legal-item';

            // Determinar títulos amigables y urls correspondientes
            let docTitle = 'Términos y Condiciones';
            let docUrl = 'terms.html';

            if (doc.type === 'privacy' || doc.type === 'privacy_policy') {
                docTitle = 'Política de Privacidad';
                docUrl = 'privacy.html';
            } else if (doc.type === 'terms' || doc.type === 'terms_and_conditions') {
                docTitle = 'Términos y Condiciones';
                docUrl = 'terms.html';
            } else {
                docTitle = doc.type.charAt(0).toUpperCase() + doc.type.slice(1);
                docUrl = `${doc.type}.html`;
            }

            // Evitar duplicación de la letra 'v' en la visualización de la versión
            const displayVersion = String(doc.version || '').startsWith('v')
                ? doc.version
                : `v${doc.version}`;

            const checkboxId = `legal-chk-${index}`;

            // Seguridad de Datos: Sanitizamos todos los atributos y textos insertados dinámicamente
            item.innerHTML = `
                <label class="legal-checkbox-container" for="${checkboxId}">
                    <input type="checkbox" id="${checkboxId}" class="legal-checkbox" data-type="${escapeAttr(doc.type)}" data-version="${escapeAttr(doc.version)}" data-hash="${escapeAttr(doc.content_hash)}">
                    <span class="legal-checkmark"></span>
                </label>
                <span class="legal-label-text">
                    He leído y acepto la versión más reciente de la 
                    <a href="${docUrl}" target="_blank" class="legal-link">${escapeHtml(docTitle)}</a> (${escapeHtml(displayVersion)})
                </span>
            `;
            checklist.appendChild(item);
        });

        modalContent.appendChild(checklist);

        // Contenedor para mostrar posibles errores de red o del backend
        const errorContainer = document.createElement('div');
        errorContainer.id = 'legal-modal-error';
        errorContainer.style.display = 'none';
        modalContent.appendChild(errorContainer);

        const actionsLayout = document.createElement('div');
        actionsLayout.className = 'legal-actions-layout';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'legal-btn legal-btn-cancel';
        cancelBtn.id = 'btnLegalCancel';
        cancelBtn.textContent = 'Cancelar';

        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'legal-btn legal-btn-accept';
        acceptBtn.id = 'btnLegalAccept';
        acceptBtn.textContent = 'Aceptar y Continuar';
        acceptBtn.disabled = true; // Deshabilitado inicialmente por seguridad

        actionsLayout.appendChild(cancelBtn);
        actionsLayout.appendChild(acceptBtn);
        modalContent.appendChild(actionsLayout);

        // Control de estado de botón de aceptación (Active Assent legal)
        const checkboxes = checklist.querySelectorAll('.legal-checkbox');
        const updateAcceptButtonState = () => {
            const allChecked = Array.from(checkboxes).every(chk => chk.checked);
            acceptBtn.disabled = !allChecked;
        };

        checkboxes.forEach(chk => {
            chk.addEventListener('change', updateAcceptButtonState);
        });

        // Event listener para cancelar la operación
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            if (typeof onCancelled === 'function') onCancelled();
        });

        // Event listener para registrar las aceptaciones de forma segura
        acceptBtn.addEventListener('click', async () => {
            acceptBtn.disabled = true;
            acceptBtn.textContent = 'Registrando firma...';
            errorContainer.style.display = 'none';
            errorContainer.innerHTML = '';

            const token = localStorage.getItem('token');
            const API_URL = getApiUrl();

            // Mapeamos los inputs a la estructura de firma requerida por la API
            const acceptedDocuments = Array.from(checkboxes).map(chk => ({
                type: chk.getAttribute('data-type'),
                version: chk.getAttribute('data-version'),
                content_hash: chk.getAttribute('data-hash')
            }));

            try {
                const response = await fetch(`${API_URL}/api/legal/accept`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ acceptedDocuments })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || 'Error al registrar la aceptación legal en el servidor.');
                }

                // Cierre limpio del modal y disparo del callback de continuación
                modal.remove();
                if (typeof onAccepted === 'function') {
                    onAccepted(result);
                }
            } catch (err) {
                console.error('[LEGAL] Fallo en aceptación:', err);
                acceptBtn.disabled = false;
                acceptBtn.textContent = 'Aceptar y Continuar';

                // Mostrar error visual al usuario
                errorContainer.className = 'legal-warning-box';
                errorContainer.style.display = 'flex';
                errorContainer.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #ef4444; margin-right: 8px;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>${escapeHtml(err.message)}</span>
                `;
            }
        });
    }

    modal.appendChild(modalContent);
    container.appendChild(modal);

    // Activar transiciones CSS suaves de entrada
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

