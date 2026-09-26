# Mejoras Futuras & Roadmap Tecnológico - WintonCoin

Este documento detalla la planificación arquitectónica, estándares de ciberseguridad y especificaciones técnicas para las próximas fases de evolución de la plataforma WintonCoin.

---

## 1. Fase 2 de Autocustodia: Autenticación Biométrica (WebAuthn / Passkeys / Face ID / Touch ID)

### 1.1. Resumen Ejecutivo y Objetivo
Actualmente, WintonCoin implementa la **Fase 1 de Autocustodia** basada en un **PIN de Seguridad de 6 dígitos** con derivación PBKDF2 (100.000 iteraciones) y cifrado autenticado AES-256-GCM, lo que garantiza que la plataforma opere bajo el modelo **Non-Custodial (No Custodio)** sin custodiar claves privadas en texto plano.

La **Fase 2** llevará la experiencia de usuario (UX) al nivel de las aplicaciones fintech y neobancos más avanzados del mundo (Apple Pay, Revolut, Binance, Coinbase), permitiendo a los usuarios autorizar la emisión de compromisos RED, el cobro de tokens BLUE y pagos de tareas mediante **Face ID**, **Touch ID** o **reconocimiento dactilar en Android (BiometricPrompt)**, sin fricción de contraseñas.

---

### 1.2. Principios de Ingeniería y Ciberseguridad

1. **Hardware-Enclave Security (Enclave Seguro en Dispositivo):**
   - Las claves criptográficas se generan y almacenan físicamente dentro del **Apple Secure Enclave** (iOS/macOS) o del **Android StrongBox / Titan M2 / TEE (Trusted Execution Environment)**.
   - La clave privada biométrica **NUNCA puede ser extraída** ni leída por software, ni siquiera por el sistema operativo o aplicaciones con permisos root.

2. **Privacidad Absoluta (Zero Biometric Data on Servers):**
   - Cumplimiento estricto de **GDPR (UE)**, **CCPA (California)**, regulaciones bancarias y leyes de protección de datos personales.
   - WintonCoin **NUNCA recibe, procesa ni almacena datos biométricos** (huellas dactilares o escaneos faciales). El sensor biométrico del teléfono simplemente valida al usuario localmente y libera una firma digital basada en la curva elíptica NIST P-256 (secp256r1).

3. **Inmunidad contra Phishing (W3C WebAuthn / FIDO2 Standard):**
   - Las credenciales WebAuthn están enlazadas criptográficamente al dominio del navegador (`demo.wintoncoin.com` o `wintoncoin.com`).
   - Incluso si un atacante crea un sitio idéntico de phishing, el navegador se negará a firmar la petición porque el `rpId` (Relying Party ID) no coincidirá con el origen del atacante.

4. **Arquitectura Criptográfica Híbrida y Fallback Seguro:**
   - El **PIN de 6 dígitos** permanece como el ancla de confianza de respaldo (Root of Trust / Fallback) para situaciones en las que el sensor biométrico falle, el dispositivo no soporte biometría o el usuario cambie de teléfono.
   - En el dispositivo móvil, la clave biométrica desbloqueará la clave simétrica derivada localmente para firmar autorizaciones EIP-712 instantáneamente con solo tocar el sensor o mirar la pantalla.

---

### 1.3. Integración con Blockchain y Account Abstraction (ERC-4337 / RIP-7212)

A nivel de Smart Contracts en Capa 2 (Optimism Sepolia / Base / Arbitrum), la autenticación biométrica se integrará con el ecosistema de **Abstracción de Cuentas (ERC-4337)**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   DISPOSITIVO DEL USUARIO (CLIENTE)                    │
│                                                                        │
│   [ Sensor Face ID / Touch ID ]                                        │
│                 │                                                      │
│                 ▼  (Autenticación Local en Secure Enclave)             │
│   [ Secure Enclave / Android StrongBox ]                               │
│                 │                                                      │
│                 ▼  (Firma NIST P-256 / secp256r1)                      │
│   [ WebAuthn Passkey Signature ] ───▶ [ Payload EIP-712 / UserOp ]    │
└─────────────────────────────────────────────┬──────────────────────────┘
                                              │
                                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    RED OPTIMISM SEPOLIA (L2)                           │
│                                                                        │
│   [ RIP-7212 Precompile ] (Verificación nativa en hardware de P-256)   │
│                 │                                                      │
│                 ▼                                                      │
│   [ ERC-4337 Smart Account ] ───▶ [ CoreProtocol.sol (Suite V4) ]      │
│   (Valida la firma biométrica)   (Liquida emisión BLUE y compromiso)   │
└────────────────────────────────────────────────────────────────────────┘
```

1. **RIP-7212 Precompilado de Curva secp256r1:**
   - Las redes Capa 2 de Ethereum están incorporando el precompilado RIP-7212, el cual permite verificar firmas de Passkeys directamente on-chain a un costo de gas ínfimo (~3.000 gas vs ~300.000 gas sin precompilado).
2. **Smart Contract Wallets P256:**
   - La billetera del usuario en Optimism Sepolia se convertirá en un Smart Contract Wallet cuya clave pública maestra será la clave pública generada por el Secure Enclave del teléfono.

---

### 1.4. Flujo de Usuario Propuesto (UX Móvil)

1. **Activación de Biometría:**
   - En su primer inicio de sesión o al ingresar a su perfil tras configurar el PIN de 6 dígitos, la app muestra un banner amigable:
     > *"⚡ ¿Deseas activar Face ID / Huella Dactilar para autorizar tus pagos en 1 segundo?"*
   - El usuario pulsa "Activar", el navegador solicita la huella o rostro vía `navigator.credentials.create()`, y la credencial queda registrada.

2. **Autorización de Pago de Tareas / Emisión de Compromiso:**
   - Al hacer clic en "Autorizar y Pagar":
     - En lugar de teclear manualmente los 6 dígitos, aparece el prompt nativo del sistema operativo (Face ID o Huella).
     - El usuario confirma con su rostro o huella.
     - La transacción se firma criptográficamente y se asienta on-chain en menos de 2 segundos.
   - Si el usuario prefiere o la biometría falla, siempre tiene el botón *"Usar mi PIN de 6 dígitos"*.

---

### 1.5. Plan de Implementación por Sprints

| Sprint | Entregable Técnico | Librerías / Componentes |
| :--- | :--- | :--- |
| **Sprint 1** | Registro y autenticación de Passkeys en backend y base de datos | `@simplewebauthn/server`, `@simplewebauthn/browser`, tabla `user_passkeys` |
| **Sprint 2** | UI/UX para registrar y gestionar biometría desde el Perfil y tras registro/KYC | React Components en `frontend/src/pages/`, Modal de Activación Rápida |
| **Sprint 3** | Firma biométrica de pagos de tareas y transferencias | Integración en `publication-detail.js` y `publicationService.js` |
| **Sprint 4** | Integración on-chain con Account Abstraction ERC-4337 y RIP-7212 | `WintonWebAuthnAccount.sol`, EntryPoint v0.7 |

---

## 2. Auditoría y Cumplimiento Legal (VASP / MiCA / SOC 2)

- **Clasificación No-Custodia:** Tanto con el PIN de 6 dígitos como con Passkeys biométricas, WintonCoin califica legalmente como un proveedor de software puramente no-custodio. La empresa no tiene la capacidad unilateral de mover fondos de usuarios, eliminando los requerimientos de custodia fiduciaria bancaria tradicionales bajo el régimen MiCA (UE) y FinCEN (EE.UU.).
- **Trazabilidad de Sesión:** Cada autorización biométrica generará un evento auditable en `audit_logs` con `authenticator_attachment: 'platform'`, `user_verification: 'required'` y el identificador de la credencial usada.
