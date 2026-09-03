import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './ForgotPassword.module.css';
import { getApiUrl, showCustomAlert } from '../modules/index.js';

/**
 * ============================================================================
 * [WINTONCOIN] - PÁGINA: ForgotPassword (Recuperación de Contraseña)
 * ============================================================================
 * Flujo reactivo seguro de 3 pasos para restablecimiento de credenciales.
 * Principios: Zero CSS Leakage, OWASP A07, validación estricta de contraseñas.
 * ============================================================================
 */
function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Temporizador de reenvío
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    let interval = null;
    if (step === 2 && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, resendTimer]);

  /**
   * Paso 1: Solicitar código al correo
   */
  const handleRequestCode = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showCustomAlert('Por favor, ingresa tu correo electrónico.');
      return;
    }

    setIsLoading(true);
    const API_URL = getApiUrl();

    try {
      const response = await fetch(`${API_URL}/forgot-password/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep(2);
        setResendTimer(60);
        setCanResend(false);
      } else {
        showCustomAlert(data.message || 'Error al procesar la solicitud.');
      }
    } catch (error) {
      console.error('[ForgotPassword] Error en request:', error);
      showCustomAlert('No se pudo conectar con el servidor. Inténtalo más tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Paso 2: Verificar código y cambiar contraseña
   */
  const handleResetPassword = async (e) => {
    e.preventDefault();
    const trimmedCode = code.trim();

    if (!trimmedCode || trimmedCode.length !== 6) {
      showCustomAlert('Ingresa el código de 6 dígitos enviado a tu correo.');
      return;
    }

    if (newPassword.length < 8) {
      showCustomAlert('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showCustomAlert('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);
    const API_URL = getApiUrl();

    try {
      const response = await fetch(`${API_URL}/forgot-password/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: trimmedCode,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep(3);
      } else {
        showCustomAlert(data.message || 'Error al verificar el código.');
      }
    } catch (error) {
      console.error('[ForgotPassword] Error en verify:', error);
      showCustomAlert('No se pudo conectar con el servidor. Inténtalo más tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reenviar código OTP
   */
  const handleResendCode = async () => {
    if (!canResend || !email.trim()) return;

    setIsLoading(true);
    const API_URL = getApiUrl();

    try {
      const response = await fetch(`${API_URL}/forgot-password/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (response.ok) {
        showCustomAlert('Se ha enviado un nuevo código a tu correo.');
        setResendTimer(60);
        setCanResend(false);
      } else {
        const data = await response.json();
        showCustomAlert(data.message || 'Error al reenviar el código.');
      }
    } catch {
      showCustomAlert('No se pudo conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <Link to="/" title="Ir al Inicio">
          <img src="assets/icons/icon-192x192.png" alt="WintonCoin" className={styles.logo} />
        </Link>
        <h1 className={styles.title}>Recuperar Contraseña</h1>

        {/* PASO 1: Formulario de ingreso de email */}
        {step === 1 && (
          <div>
            <p className={styles.infoText}>
              Ingresa el correo electrónico asociado a tu cuenta. Te enviaremos un código de verificación para
              restablecer tu contraseña.
            </p>

            <form onSubmit={handleRequestCode}>
              <div className={styles.formGroup}>
                <label htmlFor="forgot-email" className={styles.label}>
                  Correo electrónico:
                </label>
                <input
                  type="email"
                  id="forgot-email"
                  required
                  autoComplete="email"
                  placeholder="tu@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className={styles.input}
                />
              </div>

              <div>
                <button type="submit" disabled={isLoading} className={styles.btnSubmit}>
                  {isLoading ? 'Enviando código...' : 'Enviar código'}
                </button>
              </div>
            </form>

            <div style={{ marginTop: '1.5rem' }}>
              <Link to="/login" className={styles.navLink}>
                ← Volver a Iniciar Sesión
              </Link>
            </div>
          </div>
        )}

        {/* PASO 2: Ingreso de código OTP y nueva clave */}
        {step === 2 && (
          <div>
            <p className={styles.infoText}>
              Hemos enviado un código de 6 dígitos a <span className={styles.emailDisplay}>{email}</span>.
              <br />Ingresa el código y tu nueva contraseña.
            </p>

            <form onSubmit={handleResetPassword}>
              <div className={styles.formGroup}>
                <label htmlFor="forgot-code" className={styles.label}>
                  Código de verificación:
                </label>
                <input
                  type="text"
                  id="forgot-code"
                  maxLength={6}
                  required
                  placeholder="000000"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  disabled={isLoading}
                  className={styles.otpInput}
                  autoFocus
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="newPassword" className={styles.label}>
                  Nueva contraseña:
                </label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="newPassword"
                    minLength={8}
                    required
                    placeholder="Mínimo 8 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isLoading}
                    className={styles.input}
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
                <label htmlFor="confirmPassword" className={styles.label}>
                  Confirmar contraseña:
                </label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    minLength={8}
                    required
                    placeholder="Repite tu nueva contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    className={styles.input}
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

              <div>
                <button type="submit" disabled={isLoading} className={styles.btnSubmit}>
                  {isLoading ? 'Restableciendo...' : 'Restablecer contraseña'}
                </button>
              </div>
            </form>

            <div className={styles.resendContainer}>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={!canResend || isLoading}
                className={styles.resendBtn}
              >
                Reenviar código
              </button>
              {!canResend && <span> ({resendTimer}s)</span>}
            </div>

            <div style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className={styles.navLink}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ← Cambiar correo
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: Confirmación de Éxito */}
        {step === 3 && (
          <div>
            <div className={styles.successIcon}>✅</div>
            <h2 className={styles.successTitle}>¡Contraseña restablecida!</h2>
            <p className={styles.infoText}>
              Tu contraseña ha sido actualizada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.
            </p>
            <Link to="/login" className={styles.btnSuccess}>
              Ir a iniciar sesión
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;
