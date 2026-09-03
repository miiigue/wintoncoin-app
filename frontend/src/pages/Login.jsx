import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Login.module.css';
import { getApiUrl, showCustomAlert, getSafeReturnTo } from '../modules/index.js';
import { initPWAInstall } from '../modules/pwa-install.js';
import { syncPendingPushSubscription } from '../modules/pushManager.js';

/**
 * ============================================================================
 * [WINTONCOIN] - PÁGINA: Login (Inicio de Sesión)
 * ============================================================================
 * Módulo de autenticación FinTech con diseño encapsulado (CSS Modules).
 * 
 * Principios de Seguridad & Ciberseguridad:
 * - Zero-Leakage: Estilos 100% aislados que nunca interfieren con la Landing.
 * - Zero Hardcoded Secrets: Endpoints y configuraciones dinámicas.
 * - OWASP A07: Sanitización de inputs y prevención de replay attacks.
 * - Soporte nativo para cookies de sesión HttpOnly y sincronización push.
 * ============================================================================
 */
function Login() {
  const location = useLocation();

  // Estados del formulario
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Estado del modal de política de cuenta única
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  // Parámetro de retorno seguro (returnTo)
  const urlParams = new URLSearchParams(location.search);
  const returnTo = getSafeReturnTo(urlParams.get('returnTo'));

  useEffect(() => {
    // Inicialización del instalador PWA
    initPWAInstall();

    // Mostrar el modal de política de cuenta única solo la primera vez por sesión
    if (sessionStorage.getItem('policyModalShown') !== 'true') {
      setShowPolicyModal(true);
      sessionStorage.setItem('policyModalShown', 'true');
    }
  }, []);

  /**
   * Cierra el modal de política
   */
  const closePolicyModal = () => {
    setShowPolicyModal(false);
  };

  /**
   * Alterna la visibilidad del campo contraseña
   */
  const togglePassword = () => {
    setShowPassword(prev => !prev);
  };

  /**
   * Procesa el envío seguro del formulario de inicio de sesión
   */
  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) {
      showCustomAlert('Por favor, ingresa tu usuario/email y tu contraseña.');
      return;
    }

    setIsLoading(true);
    const API_URL = getApiUrl();
    const loginUrl = `${API_URL}/login`;

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Imprescindible para cookies de sesión en Android WebView y Web
        body: JSON.stringify({ identifier: trimmedIdentifier, password }),
      });

      if (response.ok) {
        const result = await response.json();

        if (result.token && result.username) {
          localStorage.setItem('token', result.token);
          localStorage.setItem('username', result.username);

          if (result.requires_terms_acceptance) {
            localStorage.setItem('requires_terms_acceptance', 'true');
          } else {
            localStorage.removeItem('requires_terms_acceptance');
          }

          // Sincronizar suscripción push en segundo plano (si existe)
          try {
            await syncPendingPushSubscription();
          } catch (pushErr) {
            console.warn('[Login] Aviso no crítico en sincronización push:', pushErr);
          }

          if (result.requires_terms_acceptance) {
            showCustomAlert(
              'Tu sesión está activa, pero necesitas aceptar los documentos legales vigentes para operar. Podrás entrar y explorar, pero las acciones estarán bloqueadas hasta aceptar.',
              () => {
                window.location.href = returnTo || 'contract_interaction.html';
              }
            );
          } else {
            // Redirección exitosa hacia el Dashboard/Billetera
            window.location.href = returnTo || 'contract_interaction.html';
          }
        } else {
          showCustomAlert('Error: La respuesta del servidor no incluyó un token de sesión.');
        }
      } else {
        const errorResult = await response.json().catch(() => ({ message: 'Error de autenticación' }));
        showCustomAlert(`Error: ${errorResult.message || 'Credenciales inválidas'}`);
        setPassword(''); // Limpieza defensiva del campo contraseña
      }
    } catch (error) {
      console.error('[Login] Error de red o conexión al servidor:', error);
      showCustomAlert('No se pudo conectar con el servidor. Asegúrate de que está en funcionamiento.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.authWrapper}>
      <div className={styles.authCard}>
        {/* Logo oficial enlazado al inicio */}
        <Link to="/" title="Ir al Inicio">
          <img src="assets/icons/icon-192x192.png" alt="WintonCoin" className={styles.authLogo} />
        </Link>
        <h1 className={styles.authTitle}>Bienvenido</h1>

        {/* Formulario de Login */}
        <form id="loginForm" onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="identifier" className={styles.formLabel}>
              Inicia sesión con tu Usuario o Email:
            </label>
            <input
              type="text"
              id="identifier"
              name="identifier"
              placeholder="Tu nombre de usuario o correo electrónico"
              required
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={isLoading}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.formLabel}>
              Contraseña:
            </label>
            <div className={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className={styles.formInput}
              />
              <span
                className={styles.passwordToggle}
                onClick={togglePassword}
                role="button"
                tabIndex={0}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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
            <div className={styles.forgotPasswordWrapper}>
              <Link to="/forgot-password" className={styles.forgotPasswordLink}>
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={styles.btnSubmit}
              style={{ opacity: isLoading ? 0.7 : 1 }}
            >
              {isLoading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </div>
        </form>

        {/* Botón hacia Registro */}
        <Link
          to={returnTo ? `/register?returnTo=${encodeURIComponent(returnTo)}` : '/register'}
          className={styles.btnSecondary}
        >
          Registrarse
        </Link>

        {/* Enlace de regreso instantáneo con React Router */}
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <Link to="/" className={styles.backHomeLink}>
            ← Volver al sitio principal
          </Link>
        </div>
      </div>

      {/* Modal de Advertencia de Política de Cuenta Única */}
      {showPolicyModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <button className={styles.modalCloseBtn} onClick={closePolicyModal} aria-label="Cerrar modal">
              &times;
            </button>
            <div className={styles.modalIcon}>💡</div>
            <h3 className={styles.modalTitle}>Aviso Importante</h3>
            <p className={styles.modalText}>
              Para mantener nuestra comunidad justa, segura y libre de estafadores, te recordamos que solo se permite
              una cuenta por persona. ¡Gracias por tu colaboración!
            </p>
            <button className={styles.btnSubmit} onClick={closePolicyModal}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
