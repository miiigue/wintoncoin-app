import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styles from './Register.module.css';
import { getApiUrl, showCustomAlert, getSafeReturnTo, checkAuthStatus } from '../modules/index.js';
import { initPWAInstall, restoreReferralCode, isPWAInstalled } from '../modules/pwa-install.js';
import { syncPendingPushSubscription } from '../modules/pushManager.js';

/**
 * ============================================================================
 * [WINTONCOIN] - PÁGINA: Register (Registro de Usuarios)
 * ============================================================================
 * Wizard de Registro FinTech de 3 pasos con verificación OTP y cumplimiento legal.
 * 
 * Principios de Ingeniería & Ciberseguridad:
 * - Zero CSS Leakage: Estilos 100% aislados en Register.module.css.
 * - OWASP A07 & SOC 2: Verificación de disponibilidad de credenciales en tiempo real.
 * - Validación Criptográfica Legal: Envío del hash de los documentos vigentes aceptados.
 * - Zero Hardcoded Secrets: Endpoints y prefijos dinámicos.
 * ============================================================================
 */
function Register() {
  const location = useLocation();
  const navigate = useNavigate();

  // Paso actual: 1, 2, 3 o 'otp'
  const [currentStep, setCurrentStep] = useState(1);

  // Paso 1: Credenciales
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState({ text: '', isError: false });
  const [isEmailTaken, setIsEmailTaken] = useState(false);

  // Paso 2: Identidad
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [isMinor, setIsMinor] = useState(false);
  const [usernameFeedback, setUsernameFeedback] = useState({ text: '', isError: false });
  const [isUsernameTaken, setIsUsernameTaken] = useState(false);
  const [phoneFeedback, setPhoneFeedback] = useState({ text: '', isError: false });
  const [isPhoneTaken, setIsPhoneTaken] = useState(false);
  const [countryNotice, setCountryNotice] = useState('Por el momento solo se aceptan registros de personas residentes en Venezuela (+58).');
  const [allowedPrefixes, setAllowedPrefixes] = useState(['+58']);

  // Paso 3: Legal & Referidos
  const [referralCode, setReferralCode] = useState('');
  const [activeLegalDocs, setActiveLegalDocs] = useState([]);
  const [agreements, setAgreements] = useState({
    termsGeneral: false,
    privacyPolicy: false,
    termsPreLaunch: false,
    termsEconomic: false,
    termsDebt: false,
    termsRisk: false,
  });

  // Paso OTP: Verificación
  const [verificationCode, setVerificationCode] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Estados generales
  const [isLoading, setIsLoading] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralModalData, setReferralModalData] = useState({
    isSpecial: false,
    code: 'SOSVENEZUELA',
    cause: 'Censo Humanitario SOS Venezuela',
    reward: 200,
  });

  // Parámetro de retorno seguro
  const urlParams = new URLSearchParams(location.search);
  const returnTo = getSafeReturnTo(urlParams.get('returnTo'));

  // --------------------------------------------------------------------------
  // INICIALIZACIÓN Y CARGA DE POLÍTICAS
  // --------------------------------------------------------------------------
  useEffect(() => {
    initPWAInstall();

    // Captura de referido en URL o PWA
    const refFromUrl = urlParams.get('ref');
    if (refFromUrl) {
      const cleanRef = refFromUrl.trim().toUpperCase();
      setReferralCode(cleanRef);
      localStorage.setItem('pending_referral_code', cleanRef);
    } else if (isPWAInstalled()) {
      restoreReferralCode();
      const savedRef = localStorage.getItem('pending_referral_code');
      if (savedRef) setReferralCode(savedRef);
    }

    const API_URL = getApiUrl();

    // 1. Cargar documentos legales activos
    fetch(`${API_URL}/api/legal/documents/active`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.activeDocuments)) {
          setActiveLegalDocs(data.activeDocuments);
        }
      })
      .catch(err => console.error('[Register] Error cargando documentos legales:', err));

    // 2. Cargar ajustes de país
    fetch(`${API_URL}/api/public-settings`)
      .then(res => res.json())
      .then(data => {
        if (data.registration_allowed_country_prefixes) {
          const prefixes = data.registration_allowed_country_prefixes.split(',').map(p => p.trim()).filter(Boolean);
          setAllowedPrefixes(prefixes);
        }
        if (data.registration_country_restriction_notice_text) {
          setCountryNotice(data.registration_country_restriction_notice_text);
        }
      })
      .catch(err => console.error('[Register] Error cargando public settings:', err));

    // 3. Cargar configuración de referidos
    fetch(`${API_URL}/api/referral-settings`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setReferralModalData({
            isSpecial: !!data.referral_custom_share_code_enabled,
            code: data.referral_custom_share_code || 'SOSVENEZUELA',
            cause: data.referral_custom_share_code_cause_title || 'Censo Humanitario SOS Venezuela',
            reward: Math.round(parseFloat(data.referral_reward_amount || '200')),
          });
        }
      })
      .catch(err => console.error('[Register] Error cargando referral settings:', err));

    // 4. Modales de bienvenida (si no hay referido en URL)
    if (!refFromUrl) {
      if (sessionStorage.getItem('referralModalShown') !== 'true') {
        setShowReferralModal(true);
        sessionStorage.setItem('referralModalShown', 'true');
      } else if (sessionStorage.getItem('policyModalShown') !== 'true') {
        setShowPolicyModal(true);
        sessionStorage.setItem('policyModalShown', 'true');
      }
    } else if (sessionStorage.getItem('policyModalShown') !== 'true') {
      setShowPolicyModal(true);
      sessionStorage.setItem('policyModalShown', 'true');
    }

    // 5. Comprobar si ya había una verificación pendiente en localStorage
    const pendingEmail = localStorage.getItem('pendingVerificationEmail');
    if (pendingEmail) {
      setEmail(pendingEmail);
    }
  }, []);

  // Temporizador para reenvío de OTP
  useEffect(() => {
    let interval = null;
    if (currentStep === 'otp' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentStep, resendTimer]);

  // --------------------------------------------------------------------------
  // VALIDACIONES EN TIEMPO REAL
  // --------------------------------------------------------------------------
  const checkEmailAvailability = async () => {
    const trimmed = email.trim();
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      setEmailFeedback({ text: 'Formato de correo inválido.', isError: true });
      return;
    }
    const API_URL = getApiUrl();
    try {
      const res = await fetch(`${API_URL}/api/check-email/${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!data.available) {
        setEmailFeedback({ text: data.message || 'Correo ya registrado.', isError: true });
        setIsEmailTaken(true);
      } else {
        setEmailFeedback({ text: 'Correo disponible.', isError: false });
        setIsEmailTaken(false);
      }
    } catch {
      setEmailFeedback({ text: '', isError: false });
    }
  };

  const checkUsernameAvailability = async () => {
    const trimmed = username.trim();
    if (!trimmed) return;
    if (trimmed.length < 3 || trimmed.length > 30 || !/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setUsernameFeedback({ text: 'Debe tener 3-30 caracteres, solo letras, números y guiones bajos (_).', isError: true });
      return;
    }
    const API_URL = getApiUrl();
    try {
      const res = await fetch(`${API_URL}/api/check-username/${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!data.available) {
        setUsernameFeedback({ text: data.message || 'Usuario no disponible.', isError: true });
        setIsUsernameTaken(true);
      } else {
        setUsernameFeedback({ text: '¡Usuario disponible!', isError: false });
        setIsUsernameTaken(false);
      }
    } catch {
      setUsernameFeedback({ text: '', isError: false });
    }
  };

  const checkPhoneAvailability = async () => {
    const trimmed = phone.trim().replace(/[\s\-\(\)]/g, '');
    if (!trimmed) return;

    const isAllowed = allowedPrefixes.some(prefix => trimmed.startsWith(prefix));
    if (!isAllowed) {
      setPhoneFeedback({ text: `Solo se aceptan registros con prefijo ${allowedPrefixes.join(' o ')}.`, isError: true });
      setIsPhoneTaken(true);
      return;
    }

    const API_URL = getApiUrl();
    try {
      const res = await fetch(`${API_URL}/api/check-phone/${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!data.available) {
        setPhoneFeedback({ text: data.message || 'Teléfono ya registrado.', isError: true });
        setIsPhoneTaken(true);
      } else {
        setPhoneFeedback({ text: 'Teléfono disponible.', isError: false });
        setIsPhoneTaken(false);
      }
    } catch {
      setPhoneFeedback({ text: '', isError: false });
    }
  };

  const handleDobChange = (e) => {
    const dob = e.target.value;
    setDateOfBirth(dob);
    if (!dob) {
      setIsMinor(false);
      return;
    }
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    setIsMinor(age >= 13 && age < 18);
  };

  // --------------------------------------------------------------------------
  // NAVEGACIÓN ENTRE PASOS
  // --------------------------------------------------------------------------
  const goToStep2 = () => {
    if (!email.trim() || !password || !confirmPassword) {
      showCustomAlert('Por favor, completa todos los campos del paso 1.');
      return;
    }
    if (password.length < 8) {
      showCustomAlert('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      showCustomAlert('Las contraseñas no coinciden.');
      return;
    }
    if (isEmailTaken) {
      showCustomAlert('El correo electrónico ya está en uso. Por favor, elige otro.');
      return;
    }
    setCurrentStep(2);
  };

  const goToStep3 = () => {
    if (!username.trim() || !phone.trim() || !dateOfBirth) {
      showCustomAlert('Por favor, completa todos los campos de tu perfil.');
      return;
    }
    if (isUsernameTaken) {
      showCustomAlert('El nombre de usuario no está disponible.');
      return;
    }
    if (isPhoneTaken) {
      showCustomAlert('El número telefónico no es válido o ya está en uso.');
      return;
    }
    // Validar edad mínima (13 años)
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 13) {
      showCustomAlert('Debes tener al menos 13 años para registrarte en la plataforma.');
      return;
    }
    setCurrentStep(3);
  };

  const areAllAgreementsChecked = Object.values(agreements).every(Boolean);

  // --------------------------------------------------------------------------
  // ENVÍO DE REGISTRO (PASO 1 -> PASO 2 OTP)
  // --------------------------------------------------------------------------
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!areAllAgreementsChecked) {
      showCustomAlert('Debes aceptar todos los términos y descargos obligatorios.');
      return;
    }

    setIsLoading(true);
    const API_URL = getApiUrl();

    // Mapear los hashes de los documentos vigentes aceptados
    const acceptedLegalDocuments = activeLegalDocs.filter(doc => {
      if (doc.type === 'terms_and_conditions') return agreements.termsGeneral;
      if (doc.type === 'privacy_policy') return agreements.privacyPolicy;
      return false;
    }).map(doc => ({
      type: doc.type,
      version: doc.version,
      content_hash: doc.content_hash,
    }));

    const payload = {
      username: username.trim(),
      password,
      email: email.trim(),
      phone: phone.trim(),
      date_of_birth: dateOfBirth,
      referral_code: referralCode.trim() || undefined,
      acceptedLegalDocuments,
    };

    try {
      const response = await fetch(`${API_URL}/api/register-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        showCustomAlert(result.message || 'Código de verificación enviado a tu correo.');
        localStorage.setItem('pendingVerificationPhone', phone.trim());
        localStorage.setItem('pendingVerificationEmail', email.trim());
        setCurrentStep('otp');
        setResendTimer(60);
        setCanResend(false);
      } else {
        showCustomAlert(`Error: ${result.message || 'No se pudo procesar el registro.'}`);
      }
    } catch (err) {
      console.error('[Register] Error al enviar registro:', err);
      showCustomAlert('No se pudo conectar con el servidor. Verifica tu conexión.');
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // VERIFICACIÓN DEL CÓDIGO OTP
  // --------------------------------------------------------------------------
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = verificationCode.trim();
    if (!code || code.length !== 6) {
      showCustomAlert('Por favor, ingresa el código de 6 dígitos.');
      return;
    }

    setIsLoading(true);
    const API_URL = getApiUrl();

    try {
      const response = await fetch(`${API_URL}/api/register-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim(),
          verificationCode: code,
          referral_code: referralCode.trim(),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        showCustomAlert(result.message + ' Has iniciado sesión correctamente.');
        localStorage.setItem('token', result.token);
        localStorage.setItem('username', result.username);

        localStorage.removeItem('pendingVerificationPhone');
        localStorage.removeItem('pendingVerificationEmail');
        localStorage.removeItem('pending_referral_code');

        try {
          await syncPendingPushSubscription();
        } catch (pushErr) {
          console.warn('[Register] Sincronización push opcional:', pushErr);
        }

        window.location.href = returnTo || 'contract_interaction.html';
      } else {
        showCustomAlert(`Error: ${result.message || 'Código inválido o expirado.'}`);
      }
    } catch (err) {
      console.error('[Register] Error en verificación OTP:', err);
      showCustomAlert('Error de red al verificar el código.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;
    const API_URL = getApiUrl();
    try {
      const response = await fetch(`${API_URL}/api/auth/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = await response.json();
      if (response.ok) {
        showCustomAlert(result.message || 'Nuevo código enviado.');
        setResendTimer(60);
        setCanResend(false);
      } else {
        showCustomAlert(`Error: ${result.message}`);
      }
    } catch {
      showCustomAlert('No se pudo conectar con el servidor para reenviar el código.');
    }
  };

  return (
    <div className={styles.registerWrapper}>
      <div className={styles.registerCard}>
        {/* Logo oficial */}
        <Link to="/" title="Ir al Inicio">
          <img src="assets/icons/icon-192x192.png" alt="WintonCoin" className={styles.authLogo} />
        </Link>
        <h1 className={styles.pageTitle}>Crear Cuenta</h1>

        {/* Banner de acceso rápido a Login */}
        <div className={styles.loginPromptBanner}>
          <span>¿Ya tienes una cuenta?</span>
          <Link to="/login" className={styles.loginHighlightBtn}>
            Inicia sesión aquí
          </Link>
        </div>

        {/* Barra de progreso Wizard (solo en pasos 1, 2 y 3) */}
        {currentStep !== 'otp' && (
          <div className={styles.wizardProgressContainer}>
            <div className={styles.wizardProgressBar}>
              <div className={styles.progressLineBackground}></div>
              <div
                className={styles.progressLineFill}
                style={{ width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%' }}
              ></div>
            </div>
            <div className={`${styles.wizardStepDot} ${currentStep >= 1 ? styles.active : ''}`}>
              <div>{currentStep > 1 ? '✓' : '1'}</div>
              <span className={styles.dotLabel}>Cuenta</span>
            </div>
            <div className={`${styles.wizardStepDot} ${currentStep >= 2 ? styles.active : ''}`}>
              <div>{currentStep > 2 ? '✓' : '2'}</div>
              <span className={styles.dotLabel}>Perfil</span>
            </div>
            <div className={`${styles.wizardStepDot} ${currentStep === 3 ? styles.active : ''}`}>
              <div>3</div>
              <span className={styles.dotLabel}>Legal</span>
            </div>
          </div>
        )}

        {/* WIZARD FORM: PASO 1 - CREDENCIALES */}
        {currentStep === 1 && (
          <div className={styles.wizardFormContainer}>
            <h2 className={styles.stepTitle}>Crea tus credenciales de acceso</h2>

            <div className={styles.formGroup}>
              <label htmlFor="email">Correo Electrónico</label>
              <input
                type="email"
                id="email"
                required
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailFeedback({ text: '', isError: false });
                }}
                onBlur={checkEmailAvailability}
              />
              {emailFeedback.text && (
                <span className={`${styles.feedbackMsg} ${emailFeedback.isError ? styles.feedbackError : styles.feedbackSuccess}`}>
                  {emailFeedback.text}
                </span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password">Contraseña</label>
              <small className={styles.hintText}>Mínimo 8 caracteres.</small>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  required
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span className={styles.passwordToggle} onClick={() => setShowPassword(p => !p)}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </span>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword">Confirma la Contraseña</label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  required
                  placeholder="Repite la contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <span className={styles.passwordToggle} onClick={() => setShowConfirmPassword(p => !p)}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showConfirmPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </span>
              </div>
            </div>

            <div className={styles.wizardButtons}>
              <button type="button" className={styles.btnPrimary} onClick={goToStep2}>
                Siguiente &rarr;
              </button>
            </div>
          </div>
        )}

        {/* WIZARD FORM: PASO 2 - IDENTIDAD */}
        {currentStep === 2 && (
          <div className={styles.wizardFormContainer}>
            <h2 className={styles.stepTitle}>Configura tu Identidad</h2>

            {/* Restricción de país (+58) */}
            <div className={styles.countryBanner}>
              <span style={{ fontSize: '1.25rem' }}>🇻🇪</span>
              <span className={styles.countryBannerText}>{countryNotice}</span>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="username">Nombre de Usuario (Pseudónimo / Alias)</label>
              <small className={styles.hintText}>Tu identificador público único en la red.</small>
              <input
                type="text"
                id="username"
                required
                maxLength={30}
                placeholder="Ej: CryptoMaster_23"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setUsernameFeedback({ text: '', isError: false });
                }}
                onBlur={checkUsernameAvailability}
              />
              {usernameFeedback.text && (
                <span className={`${styles.feedbackMsg} ${usernameFeedback.isError ? styles.feedbackError : styles.feedbackSuccess}`}>
                  {usernameFeedback.text}
                </span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="phone">Teléfono (con Código de País)</label>
              <small className={styles.hintText}>Para seguridad y recuperación (WhatsApp).</small>
              <input
                type="tel"
                id="phone"
                required
                placeholder="+58 414 123 4567"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneFeedback({ text: '', isError: false });
                }}
                onBlur={checkPhoneAvailability}
              />
              {phoneFeedback.text && (
                <span className={`${styles.feedbackMsg} ${phoneFeedback.isError ? styles.feedbackError : styles.feedbackSuccess}`}>
                  {phoneFeedback.text}
                </span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="date_of_birth">Fecha de Nacimiento</label>
              <input
                type="date"
                id="date_of_birth"
                required
                value={dateOfBirth}
                onChange={handleDobChange}
              />
            </div>

            {isMinor && (
              <div className={styles.minorAlert}>
                <h4>Información Importante (Menor de edad)</h4>
                <p>Necesitarás autorización de un tutor para operar financieramente, pero puedes crear tu cuenta ahora.</p>
              </div>
            )}

            <div className={styles.wizardButtons}>
              <button type="button" className={styles.btnSecondary} onClick={() => setCurrentStep(1)}>
                &larr; Atrás
              </button>
              <button type="button" className={styles.btnPrimary} onClick={goToStep3}>
                Siguiente &rarr;
              </button>
            </div>
          </div>
        )}

        {/* WIZARD FORM: PASO 3 - LEGAL Y REFERIDOS */}
        {currentStep === 3 && (
          <div className={styles.wizardFormContainer}>
            <h2 className={styles.stepTitle}>Revisión y Aceptación Legal</h2>
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '16px', textAlign: 'center' }}>
              Lee detenidamente y marca cada casilla para confirmar tu conformidad antes de crear tu cuenta.
            </p>

            <div className={styles.agreementsContainer}>
              <label className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  checked={agreements.termsGeneral}
                  onChange={(e) => setAgreements(a => ({ ...a, termsGeneral: e.target.checked }))}
                />
                <span>He leído y acepto los <a href="terms.html" target="_blank" rel="noreferrer">Términos y Condiciones</a> de WintonCoin.</span>
              </label>

              <label className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  checked={agreements.privacyPolicy}
                  onChange={(e) => setAgreements(a => ({ ...a, privacyPolicy: e.target.checked }))}
                />
                <span>He leído y acepto la <a href="privacy.html" target="_blank" rel="noreferrer">Política de Privacidad</a> de WintonCoin.</span>
              </label>

              <label className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  checked={agreements.termsPreLaunch}
                  onChange={(e) => setAgreements(a => ({ ...a, termsPreLaunch: e.target.checked }))}
                />
                <span>Acepto que las recompensas en pre-lanzamiento se acumulan en mi Perfil de Impulsor según el <a href="https://boosters.wintoncoin.com/" target="_blank" rel="noreferrer">programa de impulsores</a>.</span>
              </label>

              <label className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  checked={agreements.termsEconomic}
                  onChange={(e) => setAgreements(a => ({ ...a, termsEconomic: e.target.checked }))}
                />
                <span>Comprendo que WintonCoin crea tokens BLUE (activo) y RED (compromiso de reciprocidad) al realizar pagos, y asumo la responsabilidad de mis compromisos.</span>
              </label>

              <label className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  checked={agreements.termsDebt}
                  onChange={(e) => setAgreements(a => ({ ...a, termsDebt: e.target.checked }))}
                />
                <span>Acepto que los compromisos RED cuentan con plazo de vigencia y podrán amortizarse automáticamente con mis BLUE.</span>
              </label>

              <label className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  checked={agreements.termsRisk}
                  onChange={(e) => setAgreements(a => ({ ...a, termsRisk: e.target.checked }))}
                />
                <span>Reconozco los riesgos asociados con el uso de la plataforma. Durante el pre-lanzamiento, los tokens no tienen valor monetario real.</span>
              </label>
            </div>

            <div className={styles.formGroup} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <label htmlFor="referral_code">¿Tienes un Código de Referido? (Opcional)</label>
              <input
                type="text"
                id="referral_code"
                placeholder="Ej: JUAN-A1B2C3D4"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              />
              <small className={styles.hintText}>Ingrésalo para recibir bonos de bienvenida en tokens BLUE IOU.</small>
            </div>

            <div className={styles.wizardButtons}>
              <button type="button" className={styles.btnSecondary} onClick={() => setCurrentStep(2)}>
                &larr; Atrás
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={!areAllAgreementsChecked || isLoading}
                onClick={handleRegisterSubmit}
              >
                {isLoading ? 'Procesando...' : 'Crear Cuenta'}
              </button>
            </div>
          </div>
        )}

        {/* PASO 2: VERIFICACIÓN OTP */}
        {currentStep === 'otp' && (
          <div className={styles.otpCard}>
            <h2 className={styles.otpTitle}>Verifica tu Correo</h2>
            <p className={styles.otpSubtitle}>
              Hemos enviado un código de 6 dígitos a <strong>{email}</strong>. Ingrésalo a continuación para activar tu cuenta.
            </p>

            <form onSubmit={handleVerifyOtp}>
              <input
                type="text"
                maxLength={6}
                required
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className={styles.otpInput}
                autoFocus
              />

              <button type="submit" className={styles.btnPrimary} disabled={isLoading} style={{ width: '100%' }}>
                {isLoading ? 'Verificando...' : 'Confirmar y Entrar'}
              </button>
            </form>

            <div className={styles.resendWrapper}>
              <span>¿No recibiste el código?</span>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={!canResend}
                className={styles.resendBtn}
              >
                Reenviar código
              </button>
              {!canResend && <span>(espera {resendTimer}s)</span>}
            </div>
          </div>
        )}

        {/* Enlace de regreso al sitio principal */}
        <Link to="/" className={styles.backHomeLink}>
          ← Volver al sitio principal
        </Link>
      </div>

      {/* Modal de Referidos */}
      {showReferralModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <button className={styles.modalCloseBtn} onClick={() => setShowReferralModal(false)}>&times;</button>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
              {referralModalData.isSpecial ? '🤝' : '🎁'}
            </div>
            <h3 style={{ margin: '0 0 12px', color: '#00d2ff', fontSize: '1.3rem' }}>
              {referralModalData.isSpecial ? '¡Campaña Especial Activa!' : '¿No tienes código de referido?'}
            </h3>
            {referralModalData.isSpecial ? (
              <>
                <p style={{ fontSize: '0.95rem', color: '#e2e8f0', lineHeight: 1.5, marginBottom: '12px' }}>
                  ¿Quieres usar el código <strong style={{ color: '#ffd700', fontFamily: 'monospace' }}>{referralModalData.code}</strong> de la causa humanitaria <strong style={{ color: '#00d2ff' }}>"{referralModalData.cause}"</strong>?
                </p>
                <button
                  className={styles.btnPrimary}
                  style={{ width: '100%', background: 'linear-gradient(135deg, #00d2ff, #0072ff)' }}
                  onClick={() => {
                    setReferralCode(referralModalData.code);
                    setShowReferralModal(false);
                  }}
                >
                  Quiero mis {referralModalData.reward} BLUE IOU
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: '0.95rem', color: '#e2e8f0', lineHeight: 1.5, marginBottom: '16px' }}>
                  Al registrarte con un código de referido obtienes <strong style={{ color: '#00ff87' }}>{referralModalData.reward} BLUE IOU</strong> de bienvenida.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    className={styles.btnPrimary}
                    style={{ background: '#16a34a' }}
                    onClick={() => {
                      window.open('https://www.wintoncoin.com', '_blank', 'noopener,noreferrer');
                      setShowReferralModal(false);
                    }}
                  >
                    Conseguir Código Oficial
                  </button>
                  <button className={styles.btnSecondary} onClick={() => setShowReferralModal(false)}>
                    Continuar sin Código
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de Advertencia de Cuenta Única */}
      {showPolicyModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <button className={styles.modalCloseBtn} onClick={() => setShowPolicyModal(false)}>&times;</button>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>💡</div>
            <h3 style={{ margin: '0 0 12px', color: '#fff', fontSize: '1.3rem' }}>Aviso Importante</h3>
            <p style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '20px' }}>
              Para mantener nuestra comunidad justa, segura y libre de estafadores, te recordamos que solo se permite una cuenta por persona. ¡Gracias por tu colaboración!
            </p>
            <button className={styles.btnPrimary} onClick={() => setShowPolicyModal(false)}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Register;
