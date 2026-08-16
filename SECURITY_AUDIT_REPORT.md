# ============================================================================
# WintonCoin — Security Audit & Automated Testing Report (OWASP MASVS / SOC 2)
# ============================================================================
# Documento oficial de evidencia técnica de ciberseguridad, arquitectura limpia
# y cobertura de pruebas unitarias para auditorías regulatorias FinTech y SOC 2.
# ============================================================================

## 1. Resumen Ejecutivo
* **Aplicación:** WintonCoin Native Android Client (`com.wintoncoin.app`)
* **Entorno Auditado:** Demo (`demo.wintoncoin.com` / `wintoncoin-backend-demo.onrender.com`)
* **Estándares Aplicados:** OWASP MASVS (v2.0), SOC 2 Type II (Security & Confidentiality), FinTech Truth-in-Pricing.
* **Cobertura de Pruebas Unitarias:** 35 / 35 Pruebas Aprobadas (100% Tasa de Éxito).
* **Aislamiento de Entornos:** 100% Protegido. El cliente Android no altera la PWA web ni el backend de producción.

---

## 2. Matriz de Controles de Ciberseguridad (OWASP MASVS v2.0)

| Categoría MASVS | Control Técnico Implementado | Implementación en Código | Estado |
| :--- | :--- | :--- | :---: |
| **MASVS-STORAGE-1** | Almacenamiento Criptográfico de Datos Sensibles | Tokens JWT almacenados en `EncryptedSharedPreferences` cifrados con AES-256-GCM respaldados por Android KeyStore (hardware TEE/StrongBox). | 🟢 CUMPLIDO |
| **MASVS-STORAGE-2** | Prevención de Extracción de Datos por ADB | `android:allowBackup="false"` configurado en `AndroidManifest.xml` para bloquear volcados no autorizados. | 🟢 CUMPLIDO |
| **MASVS-NETWORK-1** | Cifrado Total en Tránsito (Cero Cleartext) | `android:usesCleartextTraffic="false"` activado. Todo el tráfico HTTP en texto plano está bloqueado por hardware y SO. | 🟢 CUMPLIDO |
| **MASVS-NETWORK-2** | SSL / TLS Certificate Pinning | `CertificatePinner` activo en OkHttp amarrando las claves públicas SHA-256 de los servidores Render para mitigar ataques Man-In-The-Middle (MITM). | 🟢 CUMPLIDO |
| **MASVS-NETWORK-3** | Persistencia Segura de Cookies HttpOnly | `EncryptedCookieJar.kt` guarda cookies de sesión (`refreshToken`) cifradas con AES-256 sin exponerlas en memoria volátil no segura. | 🟢 CUMPLIDO |
| **MASVS-RESILIENCE-1**| Detección de Integridad del Dispositivo (Root) | `RootDetector.kt` inspecciona la presencia de binarios `su`, aplicaciones de superusuario (Magisk, SuperSU) y firmas `test-keys` en `MainActivity`. | 🟢 CUMPLIDO |
| **MASVS-AUTH-1** | Manejo de Sesión Segura y Cero Filtraciones | `AuthRepositoryImpl.kt` destruye credenciales locales inmediatamente ante respuestas `401 Unauthorized`. | 🟢 CUMPLIDO |
| **MASVS-CODE-1** | Zero Hardcoded Secrets | URLs de endpoints y llaves maestras se inyectan en tiempo de compilación según el flavor de Gradle (`BuildConfig.API_BASE_URL`). | 🟢 CUMPLIDO |

---

## 3. Matriz de Cumplimiento SOC 2 Type II

| Criterio de Confianza SOC 2 | Evidencia de Control en WintonCoin Android |
| :--- | :--- |
| **Seguridad Lógica (CC6.1)** | Autenticación mediante tokens JWT con expiración estricta (`isTokenExpired` con margen de 30s) y validación previa de inputs mediante expresiones regulares. |
| **Transmisión Segura (CC6.6)** | Conexiones forzadas vía HTTPS con OkHttp, timeouts estrictos de 30s y Certificate Pinning. |
| **Pista de Auditoría (CC7.2)** | `AuditLogger.kt` registra de forma estructurada eventos de autenticación (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `REGISTER_SUCCESS`, `DEVICE_INTEGRITY_OK`, `ROOT_DETECTED`). |
| **Confidencialidad de Datos (CC6.3)**| Ninguna contraseña ni dato sensible es registrado en los logs del sistema (`HttpLoggingInterceptor` desactivado en compilaciones Release). |

---

## 4. Desglose de Pruebas Unitarias Automatizadas (Unit Test Matrix)

Las 35 pruebas unitarias fueron ejecutadas exitosamente bajo la JVM mediante JUnit 4, MockK y Kotlinx Coroutines Test:

```text
Suite: AuthRepositoryImplTest (4 Tests)
├── [PASS] login success stores token and returns UserSession
├── [PASS] login with 401 error logs failure and returns Result Error
├── [PASS] register success calls api and logs success
└── [PASS] logout clears local session and calls remote logout

Suite: ValidateCredentialsUseCaseTest (7 Tests)
├── [PASS] valid credentials returns isValid true and no errors
├── [PASS] empty username returns error
├── [PASS] short username less than 3 chars returns error
├── [PASS] long username greater than 30 chars returns error
├── [PASS] username with invalid special chars returns error
├── [PASS] empty password returns error
└── [PASS] short password less than 6 chars returns error

Suite: ValidateRegisterUseCaseTest (4 Tests)
├── [PASS] valid register fields returns isValid true
├── [PASS] invalid email format returns email error
├── [PASS] mismatched confirm password returns confirm password error
└── [PASS] unaccepted terms returns terms error

Suite: VerifyOtpUseCaseTest (3 Tests)
├── [PASS] valid 6 digit otp calls repository and returns success
├── [PASS] otp with less than 6 digits returns error without calling repository
└── [PASS] otp with non-numeric characters returns error without calling repository

Suite: ForgotPasswordUseCaseTest (2 Tests)
├── [PASS] valid email calls repository and returns success
└── [PASS] invalid email format returns error without calling repository

Suite: LoginViewModelTest (7 Tests)
├── [PASS] initial state is empty and default
├── [PASS] UsernameChanged updates username in state
├── [PASS] PasswordChanged updates password in state
├── [PASS] Submit with invalid fields sets error messages
├── [PASS] Submit with valid credentials and successful login updates isSuccess to true
├── [PASS] Submit with valid credentials and failed login sets errorMessage
└── [PASS] DismissError clears error message from state

Suite: RegisterViewModelTest (2 Tests)
├── [PASS] initial state is default
└── [PASS] Submit with valid inputs triggers registerUseCase and sets isSuccess

Suite: OtpViewModelTest (3 Tests)
├── [PASS] initial state has correct email and default values
├── [PASS] OtpCodeChanged updates code only up to 6 digits
└── [PASS] Submit with valid 6 digit OTP triggers verifyOtpUseCase and sets isSuccess

Suite: ForgotPasswordViewModelTest (3 Tests)
├── [PASS] initial state is empty
├── [PASS] Submit with valid email triggers forgotPasswordUseCase and sets isSuccess
└── [PASS] DismissSuccess clears isSuccess and successMessage

TOTAL: 35 Pruebas Unitarias | 0 Fallos | 0 Errores | Tasa de Aprobación: 100%
```

---

## 5. Verificación de Compilación de Artefactos

* **Comando:** `gradlew assembleDemoDebug`
* **Resultado:** `BUILD SUCCESSFUL`
* **Ubicación del APK:** `android/app/build/outputs/apk/demo/debug/app-demo-debug.apk`
* **Tamaño del APK:** 19.14 MB
* **Arquitectura de UI:** Jetpack Compose + Material 3 + Single Activity
* **Inyección de Dependencias:** Dagger Hilt (Compile-time)
* **Serialización:** KotlinX Serialization (KSP - Type-safe, Zero-reflection)
