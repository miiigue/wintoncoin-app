/**
 * ══════════════════════════════════════════════════════════════════════════════
 * MÓDULO REUTILIZABLE: GESTIÓN DE BORRADORES Y NAVEGACIÓN OTP (Frontend DRY)
 * ══════════════════════════════════════════════════════════════════════════════
 * Permite serializar, resguardar y restaurar el 100% de los datos de cualquier
 * formulario del ecosistema (Damnificados SOS, Voluntarios SOS, Comerciantes,
 * Refugios, etc.) en 'sessionStorage'.
 *
 * Ofrece la experiencia estándar de la industria ("In-Flight Editing"):
 * Si el usuario se equivoca de correo o de cualquier otro campo al recibir el OTP,
 * hace clic en "← Modificar datos o cambiar correo", regresa al formulario con
 * todos sus datos intactos, corrige el error y reenvía sin perder su progreso.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/**
 * Guarda todos los campos editables de un formulario en sessionStorage
 * 
 * @param {string|HTMLFormElement} form - ID del formulario o elemento HTML
 * @param {string} storageKey - Clave única para sessionStorage
 */
export function saveFormDraft(form, storageKey) {
    try {
        const formEl = (typeof form === 'string') ? document.getElementById(form) : form;
        if (!formEl) return;

        const draftData = {};
        const elements = formEl.querySelectorAll('input, select, textarea');

        elements.forEach(el => {
            const key = el.id || el.name;
            if (!key) return;

            // Por seguridad Zero-Trust, nunca persistir contraseñas ni archivos binarios locales
            if (el.type === 'password' || el.type === 'file') return;

            if (el.type === 'checkbox') {
                draftData[key] = el.checked;
            } else if (el.type === 'radio') {
                if (el.checked) draftData[el.name] = el.value;
            } else {
                draftData[key] = el.value;
            }
        });

        draftData._timestamp = Date.now();
        sessionStorage.setItem(storageKey, JSON.stringify(draftData));
    } catch (e) {
        console.warn(`[FORM DRAFT] No se pudo guardar el borrador (${storageKey}):`, e.message);
    }
}

/**
 * Restaura todos los campos de un formulario desde sessionStorage y dispara eventos reactivos
 * 
 * @param {string|HTMLFormElement} form - ID del formulario o elemento HTML
 * @param {string} storageKey - Clave única de sessionStorage
 * @returns {boolean} true si se restauraron datos válidos
 */
export function restoreFormDraft(form, storageKey) {
    try {
        const formEl = (typeof form === 'string') ? document.getElementById(form) : form;
        if (!formEl) return false;

        const rawData = sessionStorage.getItem(storageKey);
        if (!rawData) return false;

        const draftData = JSON.parse(rawData);
        if (!draftData || typeof draftData !== 'object') return false;

        // Expiración del borrador a las 24 horas
        if (draftData._timestamp && (Date.now() - draftData._timestamp > 24 * 60 * 60 * 1000)) {
            sessionStorage.removeItem(storageKey);
            return false;
        }

        const elements = formEl.querySelectorAll('input, select, textarea');
        elements.forEach(el => {
            const key = el.id || el.name;
            if (!key || !(key in draftData)) return;

            if (el.type === 'checkbox') {
                el.checked = Boolean(draftData[key]);
            } else if (el.type === 'radio') {
                if (draftData[el.name] === el.value) el.checked = true;
            } else {
                el.value = draftData[key];
            }

            // Disparar eventos reactivos para que los listeners de validación habiliten botones
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });

        return true;
    } catch (e) {
        console.warn(`[FORM DRAFT] Error al restaurar el borrador (${storageKey}):`, e.message);
        return false;
    }
}

/**
 * Limpia el borrador almacenado en sessionStorage
 * 
 * @param {string} storageKey 
 */
export function clearFormDraft(storageKey) {
    try {
        sessionStorage.removeItem(storageKey);
    } catch (e) {
        // Silencioso
    }
}

/**
 * Conecta de forma modular la navegación entre un formulario y su tarjeta de OTP
 * 
 * @param {Object} options
 * @param {string} options.formId - ID del formulario
 * @param {string} options.otpCardId - ID del contenedor/card de OTP
 * @param {string} options.editBtnId - ID del botón "← Modificar datos o cambiar correo"
 * @param {string} options.storageKey - Clave de sessionStorage
 * @param {Function} [options.onEdit] - Callback opcional ejecutado al volver al formulario
 */
export function setupFormOtpNavigation({ formId, otpCardId, editBtnId, storageKey, onEdit }) {
    const formEl = document.getElementById(formId);
    const otpCardEl = document.getElementById(otpCardId);
    const editBtnEl = document.getElementById(editBtnId);

    if (!editBtnEl) return;

    editBtnEl.addEventListener('click', () => {
        // 1. Ocultar Tarjeta OTP
        if (otpCardEl) {
            otpCardEl.style.display = 'none';
        }

        // 2. Mostrar Formulario
        if (formEl) {
            formEl.style.display = 'block';
            // Restaurar los datos intactos desde el borrador
            restoreFormDraft(formEl, storageKey);
            // Scroll suave hacia el inicio del formulario
            formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // 3. Callback personalizado si fue provisto
        if (typeof onEdit === 'function') {
            onEdit();
        }
    });
}
