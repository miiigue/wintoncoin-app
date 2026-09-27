# Catálogo Maestro y Auditoría de Migración Frontend a React SPA

> **DOCUMENTO DE LECTURA Y ACTUALIZACIÓN OBLIGATORIA**
> **Última Actualización:** 27 de Septiembre de 2026
> **Estándar:** Zero-Trust, SOC 2, FinTech Banking Standards, Paridad 100% Sin Omisiones
> **Regla de Lenguaje:** Queda estrictamente prohibida la palabra *deuda*. Todo saldo u obligación de restitución se denomina **compromiso RED** o **compromiso financiero**.

---

## 1. Directiva y Regla de Oro de la Migración

1. **Consulta Previa Obligatoria:** Todo desarrollador o agente de IA que inicie una sesión de trabajo en el frontend **DEBE LEER ESTE DOCUMENTO PRIMERO** para conocer exactamente qué páginas han sido migradas y cuáles permanecen en la cola de migración.
2. **Actualización Inmediata:** Cada vez que una pantalla sea migrada a React:
   - Se debe cambiar su estado en la tabla de este catálogo de `Pendiente` a `Migrada a React`.
   - Se debe registrar el componente React creado (ej. `frontend/src/pages/NombrePagina.jsx`), las rutas activadas en `frontend/src/App.jsx` y las entradas del servidor en `frontend/vite.config.js`.
   - Se debe registrar la evolución en `EVOLUCION.md`.
3. **Regla Especial de Panel de Administración (Definida por el Usuario):**
   > *El panel de administración actual se mantiene en su estado legado (HTML/JS vanilla) y NO se migrará en bloque por ahora. Si a futuro se requiere crear una nueva pantalla, módulo o herramienta administrativa interna, se construirá DIRECTAMENTE en React (ejemplo: `AdminWeb3Panel.jsx`).*
4. **Cero Pantallas Nuevas en Vanilla:** Cumpliendo con la regla `<RULE[frontend_react_migration]>`, cualquier nueva pantalla, modal o vista debe construirse exclusivamente en React dentro de `frontend/src/`.

---

## 2. Resumen Métrico de Estado

| Categoría | Cantidad | Porcentaje (%) | Estado de Acción |
| :--- | :---: | :---: | :--- |
| **Migradas a React SPA (Producción/Demo)** | 8 | 17.0% | Operativas, probadas y enrutadas en Vite SPA |
| **Panel de Administración Legado (Conservado)** | 7 | 14.9% | Mantenido en Vanilla HTML/JS según directiva |
| **Pendientes de Migración (Prioridad Alta - Finanzas/Perfil)** | 6 | 12.8% | Próximo objetivo de migración |
| **Pendientes de Migración (Prioridad Alta - Marketplace/P2P)** | 4 | 8.5% | Segundo bloque de migración |
| **Pendientes de Migración (Prioridad Media - SOS Solidario)** | 5 | 10.6% | Tercer bloque de migración |
| **Pendientes de Migración (Prioridad Media - Winton Momentum)** | 3 | 6.4% | Cuarto bloque de migración |
| **Pendientes de Migración (Informativas / Legales / Docs)** | 14 | 29.8% | Quinto bloque de migración |
| **Total Páginas Auditadas** | **47** | **100.0%** | Auditoría Exhaustiva Completada |

---

## 3. Catálogo Exhaustivo de Páginas y Estado de Migración

### Bloque 1: Páginas Migradas a React SPA (100% Funcionales)

| # | Archivo Original HTML | Componente / Ruta React | Estado | Endpoints / Servicios Vinculados |
| :---: | :--- | :--- | :---: | :--- |
| 1 | `index.html` | Vanilla HTML/JS (`/`, `/index.html`) | **Vanilla Original Preservada** | Landing institucional original, animaciones GPU nativas, FAQ dinámico (Restaurada por directiva de estabilidad visual) |
| 2 | `dashboard.html` / `contract_interaction.html` | `src/pages/Dashboard.jsx` (`/dashboard`, `/contract_interaction.html`) | **Migrada a React** | `/api/users/profile`, `/api/users/transactions`, `/api/referrals/stats`, balance BLUE/RED, modals |
| 3 | `wallet.html` | `src/pages/Wallet.jsx` (`/wallet`, `/wallet.html`) | **Migrada a React** | `/api/wallet/summary`, Web3 providers, gestión de activos y transferencias |
| 4 | `exchange.html` | `src/pages/Exchange.jsx` (`/exchange`, `/exchange.html`) | **Migrada a React** | `/api/exchange/orderbook`, motor FIFO BLUE/USDT, amortizaciones |
| 5 | `login.html` | `src/pages/Login.jsx` (`/login`, `/login.html`) | **Migrada a React** | `/api/auth/login`, `/api/auth/webauthn/*`, gestión JWT |
| 6 | `register.html` | `src/pages/Register.jsx` (`/register`, `/register.html`) | **Migrada a React** | `/api/auth/register`, wizard de 3 pasos, verificación de código |
| 7 | `forgot-password.html` | `src/pages/ForgotPassword.jsx` (`/forgot-password`, `/forgot-password.html`) | **Migrada a React** | `/api/auth/forgot-password`, `/api/auth/reset-password` |
| 8 | `admin-web3.html` | `src/pages/AdminWeb3Panel.jsx` (`/admin/web3`, `/admin-web3.html`) | **Migrada a React** | Gobernanza V4 Smart Contracts, balances de reserva, control de tesorería |

---

### Bloque 2: Panel de Administración (Conservado en Legado)

> **Regla de Negocio:** No se migran a React por el momento. Si se agrega una nueva funcionalidad o pantalla de administración, debe desarrollarse directamente en React bajo `frontend/src/pages/Admin*.jsx`.

| # | Archivo HTML Legado | Descripción del Módulo | Estado | Política Futura |
| :---: | :--- | :--- | :---: | :--- |
| 9 | `admin-panel.html` | Consola maestra de administración general | **Mantenido en Legado** | Solo corrección de bugs críticos; nuevas vistas en React |
| 10 | `admin.html` | Acceso y autenticación de administradores | **Mantenido en Legado** | Autenticación administrativa legada |
| 11 | `admin-register.html` | Registro de nuevos administradores con clave de seguridad | **Mantenido en Legado** | Mantenido en legado |
| 12 | `admin-user-detail.html` | Ficha técnica y auditoría individual de usuarios | **Mantenido en Legado** | Si se crea versión v2, se hará en React |
| 13 | `admin-recruitment.html` | Gestión de candidatos a Impulsores / Boosters | **Mantenido en Legado** | Mantenido en legado |
| 14 | `admin-email-templates.html` | Editor y preview de correos transaccionales | **Mantenido en Legado** | Mantenido en legado |
| 15 | `governance-panel.html` | Parámetros macroeconómicos del protocolo | **Mantenido en Legado** | Convive con `AdminWeb3Panel.jsx` |

---

### Bloque 3: Prioridad Alta - Contabilidad, Score y Perfil de Usuario

| # | Archivo Original HTML | Ruta Destino Propuesta en React | Estado | Impacto Funcional |
| :---: | :--- | :--- | :---: | :--- |
| 16 | `estado-cuenta.html` | `src/pages/EstadoCuenta.jsx` (`/estado-cuenta`) | **Pendiente** | **CRÍTICO:** Muestra extracto bancario oficial, cálculo orgánico de score crediticio y desglose de amortizaciones y compromisos RED. Enlazado desde Dashboard. |
| 17 | `booster-profile.html` | `src/pages/BoosterProfile.jsx` (`/booster-profile`) | **Pendiente** | **CRÍTICO:** Gamificación, árbol de referidos, recompensas por rol de Impulsor. Enlazado desde Dashboard. |
| 18 | `profile.html` | `src/pages/Profile.jsx` (`/profile`) | **Pendiente** | **ALTO:** Configuración de perfil, gestión de llaves biométricas Passkeys/WebAuthn, 2FA y KYC. |
| 19 | `history.html` | `src/pages/History.jsx` (`/history`) | **Pendiente** | **MEDIO-ALTO:** Historial consolidado de movimientos, compras y pagos. |
| 20 | `transactions.html` | `src/pages/Transactions.jsx` (`/transactions`) | **Pendiente** | **MEDIO-ALTO:** Detalle granular de transacciones financieras y auditoría. |
| 21 | `referrals.html` | `src/pages/Referrals.jsx` (`/referrals`) | **Pendiente** | **MEDIO:** Centro de referidos, enlaces únicos de invitación y cálculo de bonos. |

---

### Bloque 4: Prioridad Alta - Marketplace, Publicaciones y P2P

| # | Archivo Original HTML | Ruta Destino Propuesta en React | Estado | Impacto Funcional |
| :---: | :--- | :--- | :---: | :--- |
| 22 | `publish.html` | `src/pages/Publish.jsx` (`/publish`) | **Pendiente** | **ALTO:** Formulario de creación de publicaciones de productos/servicios y venta rápida. |
| 23 | `publication-detail.html` | `src/pages/PublicationDetail.jsx` (`/publication/:id`) | **Pendiente** | **ALTO:** Sala de negociación, chat en tiempo real, confirmación de orden y liberación de garantía (escrow). |
| 24 | `p2p.html` | `src/pages/P2P.jsx` (`/p2p`) | **Pendiente** | **ALTO:** Libro de órdenes P2P Fiat / Cripto (Bs / USD / USDT) con arbitraje protocolar. |
| 25 | `p2p-history.html` | `src/pages/P2PHistory.jsx` (`/p2p/history`) | **Pendiente** | **MEDIO:** Historial de intercambios entre pares y disputas abiertas. |

---

### Bloque 5: Prioridad Media - SOS Solidario y Ayuda Humanitaria

| # | Archivo Original HTML | Ruta Destino Propuesta en React | Estado | Impacto Funcional |
| :---: | :--- | :--- | :---: | :--- |
| 26 | `sos-venezuela.html` | `src/pages/SosVenezuela.jsx` (`/sos-venezuela`) | **Pendiente** | Hub principal de causas sociales y donaciones con parking protocolar. |
| 27 | `causa-solidaria.html` | `src/pages/CausaSolidaria.jsx` (`/causa-solidaria/:id`) | **Pendiente** | Ficha de recaudación y auditoría de fondos para una causa social específica. |
| 28 | `solicitud-solidaria.html` | `src/pages/SolicitudSolidaria.jsx` (`/solicitud-solidaria`) | **Pendiente** | Formulario formal de postulación comunitaria. |
| 29 | `ofrecer-ayuda.html` | `src/pages/OfrecerAyuda.jsx` (`/ofrecer-ayuda`) | **Pendiente** | Registro de padrinos y donantes voluntarios. |
| 30 | `pedir-ayuda.html` | `src/pages/PedirAyuda.jsx` (`/pedir-ayuda`) | **Pendiente** | Portal de asistencia alimentaria/médica de emergencia. |

---

### Bloque 6: Prioridad Media - Programa Winton Momentum

| # | Archivo Original HTML | Ruta Destino Propuesta en React | Estado | Impacto Funcional |
| :---: | :--- | :--- | :---: | :--- |
| 31 | `momentum-landing.html` | `src/pages/MomentumLanding.jsx` (`/momentum`) | **Pendiente** | Landing explicativa del programa de aceleración de liquidez Momentum. |
| 32 | `momentum-dashboard.html` | `src/pages/MomentumDashboard.jsx` (`/momentum/dashboard`) | **Pendiente** | Tablero de control de participantes Momentum. |
| 33 | `momentum-admin.html` | `src/pages/MomentumAdmin.jsx` (`/momentum/admin`) | **Pendiente** | Panel de administración y auditoría de rondas Momentum. |

---

### Bloque 7: Prioridad Informativa, Legal y Soporte

| # | Archivo Original HTML | Ruta Destino Propuesta en React | Estado | Impacto Funcional |
| :---: | :--- | :--- | :---: | :--- |
| 34 | `como-funciona.html` | `src/pages/ComoFunciona.jsx` (`/como-funciona`) | **Pendiente** | Guía educativa del modelo de paridad BLUE/RED y amortizaciones. |
| 35 | `faq.html` | `src/pages/FAQ.jsx` (`/faq`) | **Pendiente** | Centro de preguntas frecuentes categorizadas. |
| 36 | `docs.html` | `src/pages/Docs.jsx` (`/docs`) | **Pendiente** | Documentación técnica del protocolo. |
| 37 | `documentation.html` | `src/pages/Docs.jsx` (Redirige a `/docs`) | **Pendiente** | Redirección canónica a la documentación central. |
| 38 | `roadmap.html` | `src/pages/Roadmap.jsx` (`/roadmap`) | **Pendiente** | Línea de tiempo interactiva de desarrollo e hitos. |
| 39 | `love.html` | `src/pages/Love.jsx` (`/love`) | **Pendiente** | Explicación del modelo L.O.V. (Línea de Operación de Valores). |
| 40 | `terms.html` | `src/pages/Terms.jsx` (`/terms`) | **Pendiente** | Términos y condiciones del servicio regulados FinTech. |
| 41 | `privacy.html` | `src/pages/Privacy.jsx` (`/privacy`) | **Pendiente** | Política de privacidad y tratamiento de datos personales. |
| 42 | `legales-campana.html` | `src/pages/LegalesCampana.jsx` (`/legales-campana`) | **Pendiente** | Marco legal y descargos de responsabilidad de campañas promocionales. |
| 43 | `trabaja-con-nosotros.html` | `src/pages/TrabajaConNosotros.jsx` (`/trabaja-con-nosotros`) | **Pendiente** | Bolsa de empleo y reclutamiento de talento. |
| 44 | `legado.html` | `src/pages/Legado.jsx` (`/legado`) | **Pendiente** | Memoria histórica de versiones fundacionales. |
| 45 | `migrate.html` | `src/pages/Migrate.jsx` (`/migrate`) | **Pendiente** | Asistente de transición de credenciales entre versiones. |
| 46 | `landing-legacy.html` | N/A (Deprecado) | **Deprecado** | Archivo estático preservado solo para respaldo histórico. |
| 47 | `contract_interaction.html` | Redirige a `/dashboard` | **Migrada a React** | Alias de entrada histórica resuelto por `App.jsx`. |

---

## 4. Guía Metodológica para Cada Migración

Cada vez que se aborde la migración de una pantalla, se deben ejecutar los siguientes 7 pasos sin excepción:

1. **Revisión del Código Legado:**
   - Inspeccionar el archivo `.html` y sus scripts asociados (`scripts/*.js` o `src/pages/*.js`).
   - Identificar llamadas a la API (`fetch`, `axios`), sockets y dependencias de Web3/WebAuthn.
2. **Creación del Componente React en `frontend/src/pages/`:**
   - Crear el componente funcional modular con Hooks (`useState`, `useEffect`, etc.).
   - Utilizar las clases canónicas de CSS (`style.css`), garantizando diseño responsive, microinteracciones y modo oscuro.
   - **Regla Estricta de Terminología:** Sustituir cualquier mención de la palabra "deuda" por **"compromiso RED"** o **"compromiso"**.
3. **Registro de Rutas en `frontend/src/App.jsx`:**
   - Importar el nuevo componente.
   - Declarar tanto la ruta limpia (ej. `/estado-cuenta`) como la ruta de retrocompatibilidad (ej. `/estado-cuenta.html`).
4. **Actualización de `frontend/vite.config.js`:**
   - Asegurarse de que el `spaFallbackPlugin` reconozca la ruta para servir `index.html` en recargas directas en desarrollo y producción.
5. **Verificación de Compilación y Calidad:**
   - Ejecutar `npm run build:demo` en `frontend/` para validar que no haya errores de empaquetado ni dependencias rotas.
6. **Actualización Obligatoria de este Catálogo:**
   - Cambiar el estado de la página a `Migrada a React`.
   - Especificar el componente creado y fecha de migración.
7. **Actualización de `EVOLUCION.md` y Commit:**
   - Registrar la evolución del sistema en `EVOLUCION.md`.
   - Solicitar confirmación previa al usuario antes de ejecutar `git commit` y mostrar el hash resultante.
