/**
 * MÓDULO: Censo y Registro de Damnificados SOS Venezuela
 * ════════════════════════════════════════════════════════════════════
 * Maneja la interacción del formulario de registro de víctimas,
 * validación de prefijo telefónico (+58), Cédula de identidad,
 * carga dual de fotos/enlaces de Google Fotos y presentación del
 * expediente inteligente generado (#SOS-VZLA-XXX-XXXXX).
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const victimForm = document.getElementById('sos-victim-registration-form');
    const feedbackEl = document.getElementById('sos-victim-feedback');
    const resultCard = document.getElementById('sos-victim-result-card');
    const dossierNumberEl = document.getElementById('sos-dossier-number-display');

    if (!victimForm) return;

    // Determinación de API_URL
    const API_URL = window.location.origin.includes('localhost')
        ? 'http://localhost:10000'
        : window.location.origin;

    // Validación en tiempo real del prefijo telefónico (+58)
    const phoneInput = document.getElementById('sos-phone');
    if (phoneInput) {
        phoneInput.addEventListener('focus', () => {
            if (!phoneInput.value.trim()) {
                phoneInput.value = '+58 ';
            }
        });

        phoneInput.addEventListener('blur', () => {
            let val = phoneInput.value.trim().replace(/[\s\-\(\)]/g, '');
            if (val && !val.startsWith('+58')) {
                phoneInput.style.borderColor = '#ef4444';
            } else {
                phoneInput.style.borderColor = '';
            }
        });
    }

    // Manejo de envío del formulario
    victimForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = victimForm.querySelector('button[type="submit"]');
        const originalText = submitBtn ? submitBtn.textContent : 'Enviar';

        if (feedbackEl) {
            feedbackEl.style.display = 'none';
            feedbackEl.className = 'sos-feedback';
        }

        // Recopilación de datos
        const fullName = document.getElementById('sos-fullname').value.trim();
        const idDocument = document.getElementById('sos-iddocument').value.trim();
        const gender = document.getElementById('sos-gender').value;
        const isHeadOfFamily = document.getElementById('sos-headof-family').checked;
        const email = document.getElementById('sos-email').value.trim();
        const phone = document.getElementById('sos-phone').value.trim();
        const state = document.getElementById('sos-state').value.trim();
        const municipality = document.getElementById('sos-municipality').value.trim();
        const sector = document.getElementById('sos-sector').value.trim();
        const addressDetails = document.getElementById('sos-address').value.trim();
        const minors = parseInt(document.getElementById('sos-minors').value, 10) || 0;
        const elderly = parseInt(document.getElementById('sos-elderly').value, 10) || 0;
        const disabled = parseInt(document.getElementById('sos-disabled').value, 10) || 0;
        const affectationLevel = document.getElementById('sos-affectation-level').value;
        const description = document.getElementById('sos-description').value.trim();
        const photoLink = document.getElementById('sos-photo-link').value.trim();

        const dataConsent = document.getElementById('sos-data-consent').checked;
        const swornDeclaration = document.getElementById('sos-sworn-declaration').checked;

        if (!dataConsent || !swornDeclaration) {
            showError('Debes marcar las casillas de consentimiento legal y declaración jurada.');
            return;
        }

        let evidenceUrls = [];
        if (photoLink) {
            evidenceUrls.push(photoLink);
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Procesando Expediente...';
        }

        try {
            const response = await fetch(`${API_URL}/api/public/sos-venezuela/register-victim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: fullName,
                    id_document: idDocument,
                    gender,
                    is_head_of_family: isHeadOfFamily,
                    email,
                    phone_number: phone,
                    state,
                    municipality,
                    sector,
                    address_details: addressDetails,
                    dependents_minors: minors,
                    dependents_elderly: elderly,
                    dependents_disabled: disabled,
                    affectation_level: affectationLevel,
                    description,
                    evidence_urls: evidenceUrls,
                    data_consent_accepted: dataConsent,
                    sworn_declaration_accepted: swornDeclaration
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Error al registrar la solicitud.');
            }

            // Mostrar resultado exitoso
            victimForm.style.display = 'none';
            if (resultCard && dossierNumberEl) {
                dossierNumberEl.textContent = `#${data.dossier_number}`;
                resultCard.style.display = 'block';
                resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } catch (err) {
            console.error('[SOS FORM] Error:', err);
            showError(err.message);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    });

    function showError(msg) {
        if (feedbackEl) {
            feedbackEl.textContent = msg;
            feedbackEl.style.display = 'block';
            feedbackEl.style.color = '#ef4444';
            feedbackEl.style.background = 'rgba(239, 68, 68, 0.1)';
            feedbackEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
            feedbackEl.style.padding = '12px';
            feedbackEl.style.borderRadius = '8px';
            feedbackEl.style.marginTop = '1rem';
        }
    }
});
