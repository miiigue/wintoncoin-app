/**
 * MÓDULO: Censo y Registro de Damnificados SOS Venezuela
 * ════════════════════════════════════════════════════════════════════
 * Maneja la interacción del formulario de registro de víctimas,
 * validación de prefijo telefónico (+58), Cédula de identidad,
 * carga dual de fotos/enlaces de Google Fotos y presentación del
 * expediente inteligente generado (#SOS-VZLA-XXX-XXXXX).
 */

'use strict';

import { getApiUrl } from '../modules/index.js';

document.addEventListener('DOMContentLoaded', () => {
    const victimForm = document.getElementById('sos-victim-registration-form');
    const feedbackEl = document.getElementById('sos-victim-feedback');
    const resultCard = document.getElementById('sos-victim-result-card');
    const dossierNumberEl = document.getElementById('sos-dossier-number-display');

    if (!victimForm) return;

    // Determinación de API_URL centralizada de la aplicación
    const API_URL = getApiUrl();

    // Manejo automático de prefijo V- en la Cédula de Identidad
    const idDocInput = document.getElementById('sos-iddocument');
    if (idDocInput) {
        if (!idDocInput.value.trim()) {
            idDocInput.value = 'V-';
        }
        idDocInput.addEventListener('focus', () => {
            if (!idDocInput.value.trim()) {
                idDocInput.value = 'V-';
            }
        });
        idDocInput.addEventListener('blur', () => {
            let val = idDocInput.value.trim().toUpperCase();
            if (val && !val.startsWith('V-') && !val.startsWith('E-') && !val.startsWith('J-') && !val.startsWith('P-')) {
                val = 'V-' + val.replace(/^V/i, '');
                idDocInput.value = val;
            }
        });
    }

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

    // Vista previa de archivos de evidencia seleccionados
    const photoFilesInput = document.getElementById('sos-photo-files');
    const photoPreviewsContainer = document.getElementById('sos-photo-previews');

    if (photoFilesInput && photoPreviewsContainer) {
        photoFilesInput.addEventListener('change', () => {
            photoPreviewsContainer.innerHTML = '';
            const files = Array.from(photoFilesInput.files).slice(0, 5);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.width = '60px';
                    img.style.height = '60px';
                    img.style.objectFit = 'cover';
                    img.style.borderRadius = '6px';
                    img.style.border = '1px solid rgba(219,39,119,0.5)';
                    photoPreviewsContainer.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
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
        const birthDate = document.getElementById('sos-birthdate')?.value || '';
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

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Subiendo Evidencias e Iniciando Expediente...';
        }

        let evidenceUrls = [];

        // 1. Subida directa de archivos desde teléfono/computadora
        if (photoFilesInput && photoFilesInput.files.length > 0) {
            const formData = new FormData();
            Array.from(photoFilesInput.files).slice(0, 5).forEach(f => formData.append('images', f));

            try {
                const upRes = await fetch(`${API_URL}/api/public/sos-venezuela/upload-evidence`, {
                    method: 'POST',
                    body: formData
                });
                const upData = await upRes.json();
                if (upRes.ok && upData.success && Array.isArray(upData.urls)) {
                    evidenceUrls.push(...upData.urls);
                }
            } catch (upErr) {
                console.warn('[SOS UPLOAD] No se pudieron subir algunos archivos:', upErr);
            }
        }

        if (photoLink) {
            evidenceUrls.push(photoLink);
        }

        try {
            const response = await fetch(`${API_URL}/api/public/sos-venezuela/register-victim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: fullName,
                    id_document: idDocument,
                    birth_date: birthDate,
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

            // Guardar email registrado para la verificación OTP
            window._registeredVictimEmail = email;

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

    // Manejo de la Verificación OTP de 6 dígitos
    const btnVerifyOtp = document.getElementById('sos-btn-verify-otp');
    const otpInput = document.getElementById('sos-otp-code-input');
    const otpFeedback = document.getElementById('sos-otp-feedback-msg');

    if (btnVerifyOtp && otpInput) {
        btnVerifyOtp.addEventListener('click', async () => {
            const code = otpInput.value.trim();
            const email = window._registeredVictimEmail || document.getElementById('sos-email').value.trim();

            if (!code || code.length < 6) {
                showOtpMsg('Por favor ingresa los 6 dígitos del código enviado a tu correo.', '#ef4444');
                return;
            }

            btnVerifyOtp.disabled = true;
            btnVerifyOtp.textContent = 'Verificando...';

            try {
                const res = await fetch(`${API_URL}/api/public/sos-venezuela/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp_code: code })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || 'Código incorrecto.');
                }

                showOtpMsg('¡Cuenta y Billetera Activadas Exitosamente! Tus 200 BLUE IOU están disponibles.', '#10b981');
                const otpCard = document.getElementById('sos-otp-verification-card');
                if (otpCard) {
                    otpCard.style.borderColor = '#10b981';
                    otpCard.style.background = 'rgba(16, 185, 129, 0.1)';
                }
            } catch (err) {
                showOtpMsg(err.message, '#ef4444');
            } finally {
                btnVerifyOtp.disabled = false;
                btnVerifyOtp.textContent = 'Confirmar Código';
            }
        });
    }

    function showOtpMsg(msg, color) {
        if (otpFeedback) {
            otpFeedback.textContent = msg;
            otpFeedback.style.display = 'block';
            otpFeedback.style.color = color;
            otpFeedback.style.background = color === '#10b981' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        }
    }

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
