# Plan Maestro de Migración Android: WintonCoin App

**Fecha:** 28 de Diciembre, 2025
**Estado:** En Progreso
**Objetivo:** Desarrollar una aplicación nativa Android (Kotlin/Compose) que replique con exactitud (1:1) la funcionalidad, diseño y lógica de negocio del frontend web existente, asegurando el cumplimiento estricto de las Reglas Económicas (V2).

---

## 1. Arquitectura del Proyecto (Clean Architecture)

Para garantizar profesionalismo, escalabilidad y facilidad de prueba, utilizaremos una arquitectura por capas:

*   **UI Layer (Presentación):**
    *   **Tecnología:** Jetpack Compose (Material Design 3).
    *   **Patrón:** MVVM (Model-View-ViewModel).
    *   **Responsabilidad:** Mostrar datos y capturar eventos del usuario. No contiene lógica de negocio.
*   **Domain Layer (Dominio):**
    *   **Componentes:** UseCases (Casos de Uso) y Modelos de Dominio.
    *   **Responsabilidad:** Lógica de negocio pura (ej: `CalcularDeudaRed`, `VerificarLimitePago`). Independiente de Android.
*   **Data Layer (Datos):**
    *   **Componentes:** Repositories, DataSources (Remote/Local).
    *   **Tecnología:** Retrofit (API REST), Room (Base de datos local - opcional para caché), EncryptedSharedPreferences (Seguridad).
    *   **Responsabilidad:** Gestionar el origen de los datos (Nube vs Local).

---

## 2. Mapeo de Pantallas (Frontend -> Android)

Cada archivo HTML del frontend tiene su contraparte directa en una pantalla (`@Composable`) de Android:

| Archivo Frontend | Pantalla Android (Composable) | Funcionalidades Clave |
| :--- | :--- | :--- |
| `index.html` / `login.js` | `LoginScreen` | Login con usuario/password, **Autenticación Biométrica**, Toggle Password, Link Registro. |
| `register.html` | `RegisterScreen` | Formulario de registro, validación de campos, selección de país (prefijo). |
| `contract_interaction.html` | `DashboardScreen` | **Home**: Balances (Blue/Red/Escrow) con Tooltips, Banner Valor, Feed de Publicaciones, Acceso Rápido (FAB). |
| `publish.html` | `CreatePublicationScreen` | Formulario dinámico (Solicitud/Venta/Donación), Switches (Expiración/Auto-approve), Modal Tutor. |
| `publication-detail.html` | `PublicationDetailScreen` | Detalles completos, Lógica de Estados (Aceptar/Aprobar/Pagar), Chat/Comentarios (si aplica). |
| `profile.html` | `UserProfileScreen` | Ver calificaciones, comentarios y reputación. |
| `booster-profile.html` | `BoosterScreen` | Estadísticas Booster, Saldo "Blue IOU" (Pre-lanzamiento), Gráficos de rendimiento. |
| `history.html` | `HistoryScreen` | Lista de transacciones pasadas, filtro por estado. |
| `transactions.html` | `WalletScreen` | Tabla detallada de movimientos financieros. |
| `referrals.html` | `ReferralScreen` | Código QR de referido, estadísticas de invitados. |

---

## 3. Estrategia de Seguridad (Nivel Bancario)

Dado que la app maneja "dinero" (tokens), la seguridad es la prioridad número uno.

1.  **Almacenamiento Seguro:**
    *   El Token JWT de sesión **nunca** se guardará en texto plano. Usaremos `EncryptedSharedPreferences` que utiliza el Keystore de Android.
2.  **Biometría:**
    *   Implementación de `BiometricPrompt` para acciones críticas:
        *   Confirmar un pago (`POST /publications/:id/confirm-payment`).
        *   Quemar tokens (`POST /users/burn`).
        *   Acceso a la app (opcional).
3.  **Protección de Red:**
    *   **SSL Pinning:** La app rechazará cualquier conexión que no provenga de tu servidor certificado, evitando ataques "Man-in-the-Middle".
    *   Tráfico 100% HTTPS.
4.  **Protección de Pantalla:**
    *   Uso de `FLAG_SECURE` en pantallas sensibles (Wallet, Dashboard) para evitar capturas de pantalla maliciosas o grabación de pantalla (configurable).
5.  **Validación de Inputs:**
    *   Validación estricta en UI (ej: no permitir decimales incorrectos) antes de enviar a la API, replicando la lógica de `utils.js`.

---

## 4. Plan de Implementación (Fases)

### Fase 1: Cimientos (Día 1)
*   Configuración del proyecto Gradle (Hilt, Retrofit, Compose).
*   Definición del `Theme` (Colores extraídos de `style.css`: `#1a1a2e`, `#6a5acd`).
*   Implementación de la Capa de Red (API Service).

### Fase 2: Autenticación (Día 2)
*   Pantallas de Login y Registro.
*   Gestión de Sesión (SessionManager).

### Fase 3: Core y Balances (Día 3-4)
*   Dashboard Principal.
*   Lógica de visualización de Balances y Tooltips.
*   Integración de Reglas Económicas (Pre-lanzamiento vs Lanzamiento).

### Fase 4: Marketplace y Operaciones (Día 5-7)
*   Crear Publicación.
*   Flujo completo de Tarea (Publicar -> Aceptar -> Aprobar -> Pagar).
*   Implementación de Biometría.

---

Este documento sirve como hoja de ruta para el desarrollo. Procederemos a crear la estructura de carpetas.

