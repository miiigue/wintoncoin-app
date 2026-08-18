/**
 * MÓDULO: Censo y Registro de Damnificados SOS Venezuela
 * ════════════════════════════════════════════════════════════════════
 * Maneja la interacción del formulario de registro de víctimas,
 * validación de prefijo telefónico (+58), Cédula de identidad,
 * carga dual de fotos/enlaces de Google Fotos, validación en tiempo real
 * del formulario para activar/desactivar el botón de envío,
 * definición de contraseña en la verificación OTP (Opción A),
 * y presentación del expediente inteligente generado (#SOS-VZLA-XXX-XXXXX).
 */

'use strict';

import { getApiUrl } from '../modules/index.js';

document.addEventListener('DOMContentLoaded', () => {
    // ── Referencias del DOM (Formulario Principal) ────────────────────────
    const victimForm = document.getElementById('sos-victim-registration-form');
    const feedbackEl = document.getElementById('sos-victim-feedback');
    const resultCard = document.getElementById('sos-victim-result-card');
    const dossierNumberEl = document.getElementById('sos-dossier-number-display');
    const submitBtn = document.getElementById('sos-submit-btn');

    // Si no existe el formulario en la página, no ejecutar nada (guard clause)
    if (!victimForm) return;

    // Determinación de API_URL centralizada de la aplicación
    const API_URL = getApiUrl();

    // ═══════════════════════════════════════════════════════════════════════
    // SECCIÓN 1: VALIDACIÓN EN TIEMPO REAL Y ACTIVACIÓN DEL BOTÓN DE ENVÍO
    // ═══════════════════════════════════════════════════════════════════════

    // Lista de IDs de los campos obligatorios del formulario de censo
    const requiredFieldIds = [
        'sos-fullname', 'sos-iddocument', 'sos-birthdate', 'sos-email',
        'sos-phone', 'sos-state', 'sos-municipality', 'sos-sector',
        'sos-address', 'sos-description'
    ];
    // IDs de los checkboxes legales obligatorios (Habeas Data y Declaración Jurada)
    const requiredCheckboxIds = ['sos-data-consent', 'sos-sworn-declaration'];

    /**
     * Evalúa si TODOS los campos obligatorios tienen contenido y
     * AMBOS checkboxes legales están marcados. Activa o desactiva
     * el botón de envío en consecuencia con feedback visual.
     * 
     * Analogía: Es como una puerta de seguridad que solo se abre
     * cuando todas las llaves (campos) están en su lugar.
     */
    function evaluateFormCompleteness() {
        // Verificar que todos los campos de texto tengan contenido válido (no solo prefijos iniciales)
        const allFieldsFilled = requiredFieldIds.every(id => {
            const el = document.getElementById(id);
            if (!el) return false;
            const val = el.value.trim();
            if (id === 'sos-iddocument') return val.length > 2 && val !== 'V-';
            if (id === 'sos-phone') return val.length > 4 && val !== '+58';
            return val !== '';
        });

        // Verificar que todos los checkboxes legales estén marcados (checked)
        const allCheckboxesChecked = requiredCheckboxIds.every(id => {
            const el = document.getElementById(id);
            return el && el.checked;
        });

        // Solo habilitar el botón si AMBAS condiciones se cumplen
        const isComplete = allFieldsFilled && allCheckboxesChecked;

        if (submitBtn) {
            // Activar/Desactivar el botón de envío con feedback visual
            submitBtn.disabled = !isComplete;
            submitBtn.style.opacity = isComplete ? '1' : '0.5';
            submitBtn.style.cursor = isComplete ? 'pointer' : 'not-allowed';
        }
    }

    // Registrar listeners de validación en tiempo real para cada campo obligatorio
    requiredFieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // 'input' se dispara con cada caracter escrito (feedback inmediato)
            el.addEventListener('input', evaluateFormCompleteness);
            // 'change' se dispara al seleccionar una opción (selects, dates)
            el.addEventListener('change', evaluateFormCompleteness);
        }
    });

    // Registrar listeners para los checkboxes legales
    requiredCheckboxIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // 'change' se dispara cuando el usuario marca/desmarca el checkbox
            el.addEventListener('change', evaluateFormCompleteness);
        }
    });

    // Ejecutar evaluación inicial por si el navegador autocompleta campos
    evaluateFormCompleteness();

    // ═══════════════════════════════════════════════════════════════════════
    // SECCIÓN 2: MANEJO AUTOMÁTICO DE PREFIJO EN CÉDULA DE IDENTIDAD
    // ═══════════════════════════════════════════════════════════════════════

    const idDocInput = document.getElementById('sos-iddocument');
    if (idDocInput) {
        // Prellenar con "V-" si está vacío (formato estándar de Venezuela)
        if (!idDocInput.value.trim()) {
            idDocInput.value = 'V-';
        }
        // Al enfocar: prellenar si está vacío
        idDocInput.addEventListener('focus', () => {
            if (!idDocInput.value.trim()) {
                idDocInput.value = 'V-';
            }
        });
        // Al salir del campo: normalizar el prefijo (V-, E-, J-, P-)
        idDocInput.addEventListener('blur', () => {
            let val = idDocInput.value.trim().toUpperCase();
            if (val && !val.startsWith('V-') && !val.startsWith('E-') && !val.startsWith('J-') && !val.startsWith('P-')) {
                val = 'V-' + val.replace(/^V/i, '');
                idDocInput.value = val;
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECCIÓN 3: VALIDACIÓN EN TIEMPO REAL DEL PREFIJO TELEFÓNICO (+58)
    // ═══════════════════════════════════════════════════════════════════════

    const phoneInput = document.getElementById('sos-phone');
    if (phoneInput) {
        // Al enfocar: prellenar con "+58 " si está vacío (formato Venezuela)
        phoneInput.addEventListener('focus', () => {
            if (!phoneInput.value.trim()) {
                phoneInput.value = '+58 ';
            }
        });
        // Al salir del campo: feedback visual si no tiene prefijo +58
        phoneInput.addEventListener('blur', () => {
            let val = phoneInput.value.trim().replace(/[\s\-\(\)]/g, '');
            if (val && !val.startsWith('+58')) {
                phoneInput.style.borderColor = '#ef4444'; // Borde rojo = error
            } else {
                phoneInput.style.borderColor = ''; // Restaurar borde normal
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECCIÓN 4: VISTA PREVIA DE ARCHIVOS DE EVIDENCIA SELECCIONADOS
    // ═══════════════════════════════════════════════════════════════════════

    const photoFilesInput = document.getElementById('sos-photo-files');
    const photoPreviewsContainer = document.getElementById('sos-photo-previews');

    if (photoFilesInput && photoPreviewsContainer) {
        photoFilesInput.addEventListener('change', () => {
            // Limpiar previews anteriores
            photoPreviewsContainer.innerHTML = '';
            // Limitar a 15 archivos máximo
            const files = Array.from(photoFilesInput.files).slice(0, 15);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    // Crear miniatura de preview para cada foto seleccionada
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

    // ═══════════════════════════════════════════════════════════════════════
    // SECCIÓN 5: MANEJO DE ENVÍO DEL FORMULARIO DE CENSO
    // ═══════════════════════════════════════════════════════════════════════

    victimForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevenir envío nativo del formulario

        const originalText = submitBtn ? submitBtn.textContent : 'Enviar';

        // Limpiar feedback anterior
        if (feedbackEl) {
            feedbackEl.style.display = 'none';
            feedbackEl.className = 'sos-feedback';
        }

        // ── 5.1 Recopilación de todos los datos del formulario ─────────────
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

        // ── 5.2 Validación Final de Checkboxes (Defensa en profundidad) ────
        // Aunque el botón esté deshabilitado, se valida de nuevo por seguridad
        if (!dataConsent || !swornDeclaration) {
            showError('Debes marcar las casillas de consentimiento legal y declaración jurada.');
            return;
        }

        // ── 5.3 Indicador de Carga en el Botón ────────────────────────────
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Subiendo Evidencias e Iniciando Expediente...';
        }

        let evidenceUrls = [];

        // ── 5.4 Subida Directa de Archivos (Fotos desde teléfono/PC - Hasta 15 fotos) ──
        if (photoFilesInput && photoFilesInput.files.length > 0) {
            const formData = new FormData();
            formData.append('max_images', '15');
            Array.from(photoFilesInput.files).slice(0, 15).forEach(f => formData.append('images', f));

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
                // No bloquear el envío si falla la subida de fotos
                console.warn('[SOS UPLOAD] No se pudieron subir algunos archivos:', upErr);
            }
        }

        // Agregar enlace manual de Google Fotos/Drive si fue proporcionado
        if (photoLink) {
            evidenceUrls.push(photoLink);
        }

        // ── 5.5 Envío del Registro al API Backend ──────────────────────────
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
                const hasActiveSession = Boolean(localStorage.getItem('token'));
                const btnLabel = hasActiveSession ? '👤 Ir a mi cuenta' : '🔑 Iniciar Sesión';
                const btnHref = hasActiveSession ? 'profile.html' : 'login.html';

                if (data && data.already_active) {
                    showError(`
                        <div style="font-weight: 700; font-size: 1rem; color: #991b1b; margin-bottom: 6px;">
                            ${data.message}
                        </div>
                        <div style="font-size: 0.88rem; color: #475569; margin-bottom: 14px;">
                            ${hasActiveSession ? 'Ya tienes una sesión activa en este dispositivo. Puedes consultar tu expediente directamente en tu perfil.' : 'Inicia sesión con tu cuenta para consultar el estatus de tu expediente.'}
                        </div>
                        <div style="margin-top: 6px;">
                            <a href="${btnHref}" class="btn-primary-campaign" style="display: inline-block; background: #db2777; color: #ffffff; padding: 10px 24px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(219,39,119,0.25);">
                                ${btnLabel}
                            </a>
                        </div>
                    `);
                    return;
                }
                throw new Error(data.message || 'Error al registrar la solicitud.');
            }

            // Guardar email, expediente e is_new_user registrado para la verificación OTP y en sessionStorage
            window._registeredVictimEmail = data.email || email;
            window._registeredDossierNumber = data.dossier_number;
            window._isNewUser = Boolean(data.is_new_user);

            try {
                sessionStorage.setItem('sos_pending_otp', JSON.stringify({
                    email: window._registeredVictimEmail,
                    dossier_number: data.dossier_number,
                    is_new_user: window._isNewUser,
                    timestamp: Date.now()
                }));
            } catch (sErr) {}

            // Configurar UI de la tarjeta OTP según si es usuario nuevo o existente
            configureOtpCardState();

            // Si es reanudación inteligente de un expediente previo, mostrar aviso informativo
            if (data.resume_verification) {
                showOtpMsg(`ℹ️ ${data.message}`, '#0284c7');
            }

            // Mostrar Paso 1 (Formulario OTP) y ocultar planilla de registro
            victimForm.style.display = 'none';
            if (resultCard) {
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
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
            }
        }
    });

    // ── 5.6 Restaurar Estado de OTP Pendiente al Recargar (sessionStorage) ──
    try {
        const savedOtpState = sessionStorage.getItem('sos_pending_otp');
        if (savedOtpState) {
            const parsed = JSON.parse(savedOtpState);
            // Expiración a los 15 minutos (900,000 ms)
            if (parsed.email && parsed.dossier_number && (Date.now() - parsed.timestamp < 15 * 60 * 1000)) {
                window._registeredVictimEmail = parsed.email;
                window._registeredDossierNumber = parsed.dossier_number;
                window._isNewUser = (parsed.is_new_user !== undefined) ? Boolean(parsed.is_new_user) : true;
                victimForm.style.display = 'none';
                if (resultCard) {
                    resultCard.style.display = 'block';
                }
                configureOtpCardState();
            } else {
                sessionStorage.removeItem('sos_pending_otp');
            }
        }
    } catch (e) {
        sessionStorage.removeItem('sos_pending_otp');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECCIÓN 6: VERIFICACIÓN OTP + DEFINICIÓN DE CONTRASEÑA (Opción A)
    // ═══════════════════════════════════════════════════════════════════════

    const btnVerifyOtp = document.getElementById('sos-btn-verify-otp');
    const otpInput = document.getElementById('sos-otp-code-input');
    const otpFeedback = document.getElementById('sos-otp-feedback-msg');
    const newPasswordInput = document.getElementById('sos-new-password');
    const confirmPasswordInput = document.getElementById('sos-confirm-password');

    // Elementos de UI de éxito y ocultamiento
    const otpCard = document.getElementById('sos-otp-verification-card');
    const successCard = document.getElementById('sos-activation-success');

    // Función auxiliar para adaptar la interfaz del OTP si es usuario nuevo o existente
    function configureOtpCardState() {
        const passwordContainer = document.getElementById('sos-password-fields-container');
        const activationDesc = document.getElementById('sos-activation-desc');

        if (window._isNewUser === false) {
            if (passwordContainer) passwordContainer.style.display = 'none';
            if (activationDesc) activationDesc.textContent = 'Para completar tu solicitud, ingresa el código de verificación de 6 dígitos que enviamos a tu correo electrónico.';
            if (btnVerifyOtp) btnVerifyOtp.textContent = 'Confirmar Solicitud SOS';
        } else {
            if (passwordContainer) passwordContainer.style.display = 'block';
            if (activationDesc) activationDesc.textContent = 'Para completar tu solicitud, ingresa el código de verificación de 6 dígitos que enviamos a tu correo electrónico y crea una contraseña para tu cuenta.';
            if (btnVerifyOtp) btnVerifyOtp.textContent = 'Activar mi Cuenta';
        }
        validateOtpForm();
    }

    // ── 6.0 Toggle de Mostrar/Ocultar Contraseñas ──────────────────────────
    const toggleNewPwd = document.getElementById('toggle-new-password');
    const toggleConfirmPwd = document.getElementById('toggle-confirm-password');

    if (toggleNewPwd && newPasswordInput) {
        toggleNewPwd.addEventListener('click', () => {
            const type = newPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            newPasswordInput.setAttribute('type', type);
        });
    }

    if (toggleConfirmPwd && confirmPasswordInput) {
        toggleConfirmPwd.addEventListener('click', () => {
            const type = confirmPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            confirmPasswordInput.setAttribute('type', type);
        });
    }

    // ── 6.1 Validación en Tiempo Real para Habilitar Botón ──────────────────
    function validateOtpForm() {
        if (!btnVerifyOtp || !otpInput) return;

        const code = otpInput.value.trim();
        let isValid = code.length === 6;

        if (window._isNewUser !== false && newPasswordInput && confirmPasswordInput) {
            const pwd = newPasswordInput.value;
            const confirm = confirmPasswordInput.value;
            isValid = isValid && pwd.length >= 8 && pwd === confirm;
        }

        btnVerifyOtp.disabled = !isValid;
        btnVerifyOtp.style.opacity = isValid ? '1' : '0.5';
        btnVerifyOtp.style.cursor = isValid ? 'pointer' : 'not-allowed';
    }

    if (otpInput) otpInput.addEventListener('input', validateOtpForm);
    if (newPasswordInput) newPasswordInput.addEventListener('input', validateOtpForm);
    if (confirmPasswordInput) confirmPasswordInput.addEventListener('input', validateOtpForm);

    if (btnVerifyOtp && otpInput) {
        btnVerifyOtp.addEventListener('click', async () => {
            const code = otpInput.value.trim();
            const email = window._registeredVictimEmail || document.getElementById('sos-email').value.trim();
            const password = newPasswordInput ? newPasswordInput.value : '';
            const passwordConfirm = confirmPasswordInput ? confirmPasswordInput.value : '';

            // ── 6.2 Validaciones del Cliente ───────────────────────────────
            if (!code || code.length < 6) {
                showOtpMsg('Por favor ingresa los 6 dígitos del código enviado a tu correo.', '#ef4444');
                return;
            }

            if (window._isNewUser !== false) {
                if (!password || password.length < 8) {
                    showOtpMsg('La contraseña debe tener al menos 8 caracteres.', '#ef4444');
                    return;
                }

                if (password !== passwordConfirm) {
                    showOtpMsg('Las contraseñas no coinciden. Por favor verifica.', '#ef4444');
                    return;
                }
            }

            // ── 6.3 Indicador de Carga ─────────────────────────────────────
            btnVerifyOtp.disabled = true;
            btnVerifyOtp.textContent = (window._isNewUser === false) ? 'Verificando solicitud...' : 'Activando cuenta...';

            // ── 6.3 Envío al Endpoint de Verificación OTP ──────────────────
            try {
                const res = await fetch(`${API_URL}/api/public/sos-venezuela/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        email,
                        otp_code: code,
                        password: password,
                        password_confirm: passwordConfirm
                    })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || 'Código incorrecto.');
                }

                // Limpiar estado de OTP pendiente en sessionStorage
                sessionStorage.removeItem('sos_pending_otp');

                // ── 6.4 Sesión JWT: Guardar Token de Acceso ────────────────
                if (data.token) {
                    localStorage.setItem('token', data.token);
                }
                if (data.username) {
                    localStorage.setItem('username', data.username);
                }

                // ── 6.5 Feedback Visual de Éxito (PASO 2) ──────────────────
                // Actualizar número de expediente generado en la tarjeta final
                if (dossierNumberEl) {
                    const dossierNo = window._registeredDossierNumber || data.dossier_number || '';
                    if (dossierNo) {
                        dossierNumberEl.textContent = `#${dossierNo}`;
                    }
                }

                // Ocultar la UI de código OTP / contraseñas (PASO 1)
                if (otpCard) {
                    otpCard.style.display = 'none';
                }
                
                // Mostrar la tarjeta final de éxito completo (PASO 2)
                if (successCard) {
                    successCard.style.display = 'block';
                    successCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }

            } catch (err) {
                showOtpMsg(err.message, '#ef4444');
                btnVerifyOtp.disabled = false;
                btnVerifyOtp.textContent = 'Activar mi Cuenta';
            }
        });
    }

    // ── 6.6 Manejo de Reenvío de Código OTP (Botón con Cooldown de 60s) ───
    const btnResendOtp = document.getElementById('sos-btn-resend-otp');
    const resendTimerSpan = document.getElementById('sos-resend-timer-span');
    const timerSecondsEl = document.getElementById('sos-timer-seconds');
    let resendCooldownInterval = null;

    function startResendCooldown(seconds = 60) {
        if (!btnResendOtp || !resendTimerSpan || !timerSecondsEl) return;
        btnResendOtp.style.display = 'none';
        resendTimerSpan.style.display = 'inline';
        let remaining = seconds;
        timerSecondsEl.textContent = String(remaining);

        if (resendCooldownInterval) clearInterval(resendCooldownInterval);
        resendCooldownInterval = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(resendCooldownInterval);
                resendCooldownInterval = null;
                resendTimerSpan.style.display = 'none';
                btnResendOtp.style.display = 'inline';
            } else {
                timerSecondsEl.textContent = String(remaining);
            }
        }, 1000);
    }

    if (btnResendOtp) {
        btnResendOtp.addEventListener('click', async () => {
            const targetEmail = window._registeredVictimEmail || document.getElementById('sos-email').value.trim();
            if (!targetEmail) {
                showOtpMsg('No se encontró el correo electrónico registrado.', '#ef4444');
                return;
            }

            try {
                btnResendOtp.disabled = true;
                btnResendOtp.textContent = 'Enviando...';

                const res = await fetch(`${API_URL}/api/public/sos-venezuela/resend-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: targetEmail })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || 'Error al reenviar el código.');
                }

                showOtpMsg('✅ Nuevo código enviado a tu correo. Por favor revisa tu bandeja de entrada o spam.', '#10b981');
                startResendCooldown(60);
            } catch (rErr) {
                showOtpMsg(rErr.message, '#ef4444');
            } finally {
                if (btnResendOtp) {
                    btnResendOtp.disabled = false;
                    btnResendOtp.textContent = 'Reenviar código';
                }
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECCIÓN 7: FUNCIONES AUXILIARES DE FEEDBACK VISUAL
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Muestra un mensaje en la sección de OTP con color indicativo.
     * @param {string} msg - Mensaje a mostrar
     * @param {string} color - Color hexadecimal (#10b981 = verde éxito, #ef4444 = rojo error)
     */
    function showOtpMsg(msg, color) {
        if (otpFeedback) {
            otpFeedback.textContent = msg;
            otpFeedback.style.display = 'block';
            otpFeedback.style.color = color;
            otpFeedback.style.background = color === '#10b981' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        }
    }

    /**
     * Muestra un mensaje de error en la sección principal del formulario.
     * @param {string} msg - Mensaje de error a mostrar al usuario
     */
    function showError(msg) {
        if (feedbackEl) {
            feedbackEl.innerHTML = msg;
            feedbackEl.style.display = 'block';
            feedbackEl.style.color = '#991b1b';
            feedbackEl.style.background = '#fef2f2';
            feedbackEl.style.border = '1px solid #fecdd3';
            feedbackEl.style.padding = '14px 16px';
            feedbackEl.style.borderRadius = '12px';
            feedbackEl.style.marginTop = '1rem';
            feedbackEl.style.lineHeight = '1.5';
            feedbackEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECCIÓN 8: CARGA DINÁMICA DEL CÓDIGO ESPECIAL DE REFERIDOS (ADMIN CONFIG)
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Consulta la API pública de referidos para obtener el código especial activo
     * (ej: SOSVENEZUELADEMO) y actualizar dinámicamente todos los elementos de la interfaz.
     */
    async function loadDynamicSpecialCode() {
        try {
            const res = await fetch(`${API_URL}/api/referral-settings`);
            if (res.ok) {
                const data = await res.json();
                const code = data.referral_custom_share_code || 'SOSVENEZUELA';
                
                // Actualizar todos los elementos con la clase dynamic-special-code
                const codeElements = document.querySelectorAll('.dynamic-special-code');
                codeElements.forEach(el => {
                    el.textContent = code;
                });

                // Actualizar el botón enlace para referir con el código real
                const registerLink = document.getElementById('sos-register-ref-link');
                if (registerLink) {
                    registerLink.href = `register.html?ref=${encodeURIComponent(code)}`;
                }
            }
        } catch (err) {
            console.warn("[SOS DYNAMIC CODE] Error al obtener la configuración pública de referidos:", err);
        }
    }

    // Cargar el código dinámico al inicializar la página
    loadDynamicSpecialCode();

    // ═══════════════════════════════════════════════════════════════════════
    // SECCIÓN 9: MÓDULO DE REGISTRO DE VOLUNTARIO SOS (FORMULARIO E INTERACCIÓN)
    // ═══════════════════════════════════════════════════════════════════════
    const volForm = document.getElementById('sos-volunteer-registration-form');
    const volSubmitBtn = document.getElementById('vol-submit-btn');
    const volFeedback = document.getElementById('vol-feedback-msg');
    const volResultCard = document.getElementById('vol-result-card');
    const volOtpCard = document.getElementById('vol-otp-verification-card');
    const volOtpInput = document.getElementById('vol-otp-code-input');
    const volBtnVerifyOtp = document.getElementById('vol-btn-verify-otp');
    const volOtpFeedback = document.getElementById('vol-otp-feedback-msg');
    const volSuccessCard = document.getElementById('vol-activation-success');
    const volDossierDisplay = document.getElementById('vol-dossier-number-display');
    const volRewardDisplay = document.getElementById('vol-reward-amount-display');

    if (volForm) {
        const requiredVolIds = ['vol-fullname', 'vol-iddocument', 'vol-birthdate', 'vol-email', 'vol-phone', 'vol-country', 'vol-state', 'vol-municipality', 'vol-sector'];
        const requiredVolChecks = ['vol-data-consent', 'vol-legal-disclaimer'];

        /**
         * Evalúa si el formulario de voluntario está completo para activar el botón.
         */
        function evaluateVolCompleteness() {
            const allFilled = requiredVolIds.every(id => {
                const el = document.getElementById(id);
                if (!el) return false;
                const val = el.value.trim();
                if (id === 'vol-iddocument') return val.length >= 2;
                if (id === 'vol-phone') return val.length >= 7;
                return val !== '';
            });

            const allChecked = requiredVolChecks.every(id => {
                const el = document.getElementById(id);
                return el && el.checked;
            });

            // Verificar que al menos una opción de área y disponibilidad esté seleccionada
            const selectedTypes = document.querySelectorAll('input[name="vol-types"]:checked');
            const selectedAvail = document.querySelectorAll('input[name="vol-avail"]:checked');
            const hasTypes = selectedTypes.length > 0;
            const hasAvail = selectedAvail.length > 0;

            const isReady = allFilled && allChecked && hasTypes && hasAvail;

            if (volSubmitBtn) {
                volSubmitBtn.disabled = !isReady;
                volSubmitBtn.style.opacity = isReady ? '1' : '0.5';
                volSubmitBtn.style.cursor = isReady ? 'pointer' : 'not-allowed';
            }
        }

        // Listeners de validación en tiempo real
        requiredVolIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', evaluateVolCompleteness);
                el.addEventListener('change', evaluateVolCompleteness);
            }
        });
        requiredVolChecks.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', evaluateVolCompleteness);
        });
        document.querySelectorAll('input[name="vol-types"]').forEach(el => el.addEventListener('change', evaluateVolCompleteness));
        document.querySelectorAll('input[name="vol-avail"]').forEach(el => el.addEventListener('change', evaluateVolCompleteness));

        evaluateVolCompleteness();

        let currentVolEmail = '';
        let isVolunteerNewUser = true;

        // Envío de Formulario de Voluntario
        volForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (volSubmitBtn) {
                volSubmitBtn.disabled = true;
                volSubmitBtn.innerText = 'Enviando Registro...';
            }
            if (volFeedback) volFeedback.style.display = 'none';

            const selectedTypes = Array.from(document.querySelectorAll('input[name="vol-types"]:checked')).map(el => el.value);
            const selectedAvail = Array.from(document.querySelectorAll('input[name="vol-avail"]:checked')).map(el => el.value);

            const payload = {
                full_name: document.getElementById('vol-fullname')?.value?.trim() || '',
                id_document: document.getElementById('vol-iddocument')?.value?.trim() || '',
                birth_date: document.getElementById('vol-birthdate')?.value || '',
                gender: document.getElementById('vol-gender')?.value || 'female',
                email: document.getElementById('vol-email')?.value?.trim() || '',
                phone_number: document.getElementById('vol-phone')?.value?.trim() || '',
                country: document.getElementById('vol-country')?.value?.trim() || 'Venezuela',
                state: document.getElementById('vol-state')?.value?.trim() || '',
                municipality: document.getElementById('vol-municipality')?.value?.trim() || '',
                sector_city: document.getElementById('vol-sector')?.value?.trim() || '',
                volunteer_types: selectedTypes,
                availability: selectedAvail,
                profession_skills: document.getElementById('vol-skills')?.value?.trim() || '',
                data_consent_accepted: document.getElementById('vol-data-consent')?.checked,
                legal_disclaimer_accepted: document.getElementById('vol-legal-disclaimer')?.checked
            };

            try {
                const res = await fetch(`${API_URL}/api/volunteers/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (!res.ok || !data.success) {
                    // Manejo seguro de cuenta ya registrada / sesión activa
                    if (data && data.already_active) {
                        const hasActiveSession = Boolean(localStorage.getItem('token'));
                        const currentLoggedUser = localStorage.getItem('username') || '';

                        let sessionNotice = '';
                        if (hasActiveSession && currentLoggedUser) {
                            sessionNotice = `
                                <div style="margin-top: 10px; font-size: 0.88rem; color: #475569; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px;">
                                    ℹ️ Actualmente tienes una sesión activa como <strong>@${escapeHtml(currentLoggedUser)}</strong>.
                                    <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                                        <a href="profile.html" class="btn-primary-campaign" style="font-size: 0.85rem; padding: 6px 14px; text-decoration: none; border-radius: 20px;">Ir a mi Perfil actual</a>
                                        <button type="button" id="vol-btn-switch-account" style="font-size: 0.85rem; padding: 6px 14px; background: #ef4444; color: white; border: none; border-radius: 20px; cursor: pointer;">Cerrar sesión e Iniciar con esta cuenta</button>
                                    </div>
                                </div>
                            `;
                        } else {
                            sessionNotice = `
                                <div style="margin-top: 10px;">
                                    <a href="login.html" class="btn-primary-campaign" style="font-size: 0.88rem; padding: 8px 18px; text-decoration: none; border-radius: 20px; display: inline-block;">🔑 Iniciar Sesión</a>
                                </div>
                            `;
                        }

                        if (volFeedback) {
                            volFeedback.innerHTML = `
                                <div style="font-weight: 700; color: #991b1b; margin-bottom: 4px;">⚠️ ${escapeHtml(data.message)}</div>
                                ${sessionNotice}
                            `;
                            volFeedback.style.display = 'block';
                            volFeedback.style.background = '#fef2f2';
                            volFeedback.style.border = '1px solid #fecdd3';
                            volFeedback.style.padding = '14px';
                            volFeedback.style.borderRadius = '12px';
                            volFeedback.style.marginTop = '1rem';

                            const switchBtn = document.getElementById('vol-btn-switch-account');
                            if (switchBtn) {
                                switchBtn.addEventListener('click', () => {
                                    localStorage.removeItem('token');
                                    localStorage.removeItem('username');
                                    localStorage.removeItem('user');
                                    window.location.href = 'login.html';
                                });
                            }
                        }
                        return;
                    }

                    throw new Error(data.message || 'Error al procesar el registro de voluntario.');
                }

                currentVolEmail = payload.email;
                isVolunteerNewUser = (data.is_new_user !== false);

                // Ocultar formulario y mostrar tarjeta OTP
                volForm.style.display = 'none';
                if (volResultCard) volResultCard.style.display = 'block';
                if (volOtpCard) volOtpCard.style.display = 'block';
                if (volSuccessCard) volSuccessCard.style.display = 'none';

                const passContainer = document.getElementById('vol-password-fields-container');
                if (passContainer) {
                    passContainer.style.display = isVolunteerNewUser ? 'block' : 'none';
                }

                validateVolOtpForm();
                if (volOtpInput) volOtpInput.focus();

            } catch (err) {
                if (volFeedback) {
                    volFeedback.textContent = '❌ ' + err.message;
                    volFeedback.style.display = 'block';
                    volFeedback.style.color = '#ef4444';
                    volFeedback.style.background = '#fef2f2';
                    volFeedback.style.border = '1px solid #fecdd3';
                    volFeedback.style.padding = '12px';
                    volFeedback.style.borderRadius = '10px';
                    volFeedback.style.marginTop = '1rem';
                }
            } finally {
                if (volSubmitBtn) {
                    volSubmitBtn.disabled = false;
                    volSubmitBtn.innerText = 'Enviar Postulación de Voluntario';
                }
            }
        });

        // ── Toggle de Visibilidad de Contraseñas en OTP de Voluntario ───────
        const volToggleNewPwd = document.getElementById('vol-toggle-new-password');
        const volToggleConfirmPwd = document.getElementById('vol-toggle-confirm-password');
        const volNewPwdInput = document.getElementById('vol-new-password');
        const volConfirmPwdInput = document.getElementById('vol-confirm-password');
        const volPwdHelper = document.getElementById('vol-password-match-helper');

        if (volToggleNewPwd && volNewPwdInput) {
            volToggleNewPwd.addEventListener('click', () => {
                const type = volNewPwdInput.getAttribute('type') === 'password' ? 'text' : 'password';
                volNewPwdInput.setAttribute('type', type);
                volToggleNewPwd.textContent = type === 'password' ? '👁️' : '🙈';
            });
        }

        if (volToggleConfirmPwd && volConfirmPwdInput) {
            volToggleConfirmPwd.addEventListener('click', () => {
                const type = volConfirmPwdInput.getAttribute('type') === 'password' ? 'text' : 'password';
                volConfirmPwdInput.setAttribute('type', type);
                volToggleConfirmPwd.textContent = type === 'password' ? '👁️' : '🙈';
            });
        }

        /**
         * Validación en Tiempo Real del Formulario OTP de Voluntario
         * (Exige OTP de 6 dígitos Y coincidencia estricta de contraseña si es usuario nuevo)
         */
        function validateVolOtpForm() {
            if (!volBtnVerifyOtp || !volOtpInput) return;

            const code = volOtpInput.value.trim();
            let isCodeValid = (code.length === 6);
            let isPasswordValid = true;

            if (isVolunteerNewUser && volNewPwdInput && volConfirmPwdInput) {
                const pwd = volNewPwdInput.value;
                const confirm = volConfirmPwdInput.value;

                if (pwd.length === 0 && confirm.length === 0) {
                    if (volPwdHelper) volPwdHelper.textContent = '';
                    isPasswordValid = false;
                } else if (pwd.length < 8) {
                    if (volPwdHelper) {
                        volPwdHelper.textContent = '⚠️ La contraseña debe tener al menos 8 caracteres.';
                        volPwdHelper.style.color = '#d97706';
                    }
                    isPasswordValid = false;
                } else if (confirm.length > 0 && pwd !== confirm) {
                    if (volPwdHelper) {
                        volPwdHelper.textContent = '❌ Las contraseñas no coinciden.';
                        volPwdHelper.style.color = '#ef4444';
                    }
                    isPasswordValid = false;
                } else if (pwd.length >= 8 && pwd === confirm) {
                    if (volPwdHelper) {
                        volPwdHelper.textContent = '✅ Las contraseñas coinciden.';
                        volPwdHelper.style.color = '#10b981';
                    }
                    isPasswordValid = true;
                } else {
                    isPasswordValid = false;
                }
            }

            const canSubmit = isCodeValid && isPasswordValid;
            volBtnVerifyOtp.disabled = !canSubmit;
            volBtnVerifyOtp.style.opacity = canSubmit ? '1' : '0.5';
            volBtnVerifyOtp.style.cursor = canSubmit ? 'pointer' : 'not-allowed';
        }

        if (volOtpInput) volOtpInput.addEventListener('input', validateVolOtpForm);
        if (volNewPwdInput) volNewPwdInput.addEventListener('input', validateVolOtpForm);
        if (volConfirmPwdInput) volConfirmPwdInput.addEventListener('input', validateVolOtpForm);

        // Verificación de OTP para Voluntario
        if (volBtnVerifyOtp) {
            volBtnVerifyOtp.addEventListener('click', async () => {
                const otpCode = volOtpInput?.value?.trim() || '';
                const password = volNewPwdInput?.value || '';
                const passwordConfirm = volConfirmPwdInput?.value || '';

                if (otpCode.length !== 6) return;
                if (isVolunteerNewUser && (password.length < 8 || password !== passwordConfirm)) return;

                volBtnVerifyOtp.disabled = true;
                volBtnVerifyOtp.innerText = 'Verificando...';
                if (volOtpFeedback) volOtpFeedback.style.display = 'none';

                try {
                    const res = await fetch(`${API_URL}/api/volunteers/verify-otp`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: currentVolEmail,
                            otp_code: otpCode,
                            password: password,
                            password_confirm: passwordConfirm
                        })
                    });

                    const data = await res.json();
                    if (!res.ok || !data.success) {
                        throw new Error(data.message || 'Código OTP incorrecto.');
                    }

                    // Guardar credenciales de sesión activa para el voluntario
                    if (data.token) localStorage.setItem('token', data.token);
                    if (data.user?.username) localStorage.setItem('username', data.user.username);
                    if (data.user) localStorage.setItem('user', JSON.stringify(data.user));

                    // Éxito: Ocultar OTP y mostrar tarjeta de felicitación
                    if (volOtpCard) volOtpCard.style.display = 'none';
                    if (volSuccessCard) volSuccessCard.style.display = 'block';

                    if (volDossierDisplay) volDossierDisplay.textContent = `#${data.dossier_number}`;
                    if (volRewardDisplay) volRewardDisplay.textContent = `${data.reward_amount || 0} BLUE IOU`;

                } catch (err) {
                    if (volOtpFeedback) {
                        volOtpFeedback.textContent = '❌ ' + err.message;
                        volOtpFeedback.style.display = 'block';
                        volOtpFeedback.style.color = '#ef4444';
                        volOtpFeedback.style.background = '#fef2f2';
                    }
                } finally {
                    volBtnVerifyOtp.disabled = false;
                    volBtnVerifyOtp.innerText = 'Activar mi Cuenta de Voluntario';
                }
            });
        }
    }
});

