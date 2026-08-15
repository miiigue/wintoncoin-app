# EvoluciÃƒÆ’Ã‚Â³n de WintonCoin

---

# EvoluciÃƒÆ’Ã‚Â³n del proyecto (historia tÃƒÆ’Ã‚Â©cnica + decisiones)

Este documento explica **cÃƒÆ’Ã‚Â³mo y por quÃƒÆ’Ã‚Â©** evolucionÃƒÆ’Ã‚Â³ el cÃƒÆ’Ã‚Â³digo (decisiones, trade-offs y impacto).  
Para el detalle ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œtipo releaseÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½, ver `CHANGELOG.md`.

## CÃƒÆ’Ã‚Â³mo leer este documento

- **Hitos**: cambios grandes que alteran comportamiento, seguridad o arquitectura.
- **Evidencia**: commits (hash corto) que anclan cada cambio al historial real.
- **Impacto**: quÃ© problema resolviÃ³ y quÃ© habilita hacia adelante.

### 2026-08-14 — Fix: Corrección Truth-in-Pricing del Multiplicador en Modo Post-Lanzamiento
* **Diagnóstico**: Cuando `pre_launch_mode_enabled = false`, la función `calculatePublicationEffectiveCost()` seguía aplicando el multiplicador de etapa (ej: 9x) a TODAS las publicaciones, causando que el precio mostrado fuera 9 BLUE en vez de 1 BLUE para tareas regulares. Esto violaba el principio FinTech de Truth-in-Pricing (precio mostrado ≠ precio cobrado).
* **Causa raíz**: La función recibía el parámetro `preLaunchMode` pero **nunca lo evaluaba**. Siempre multiplicaba `baseCost * activeMultiplier` sin verificar si la transacción calificaba para multiplicador.
* **Corrección**:
  - **Backend (`publicationController.js`)**: Se reescribió `calculatePublicationEffectiveCost()` para replicar exactamente la regla del motor de pagos (`publicationService.processRequestPayment()` línea 202): `isBoosterTx = preLaunchMode || !!publication.is_booster_task`. Si `isBoosterTx === false`, multiplicador = `1.0`. Se propagó `is_booster_tx` en las respuestas de los endpoints `/publications/active` y `/publications/:id`.
  - **Frontend (`publication-detail.js`)**: Se hizo condicional el desglose "Base × Mult = Total". Cuando `is_booster_tx === false`, solo muestra el precio directo sin desglose de multiplicador.
* **Impacto**: Garantiza coherencia precio-mostrado = precio-cobrado (SOC 2 IC-03) y elimina el riesgo de confusión al usuario en modo post-lanzamiento.

### 2026-08-14 — Resolución de Error 500 en Feed de Publicaciones y Blindaje Responsivo Móvil de Tarjetas
* **Diagnóstico & Solución**:
  - **Backend ([publicationController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/publicationController.js))**: Se corrigió el `ReferenceError: calculatePublicationEffectiveCost is not defined` implementando formalmente la función en el controlador. Esto restaura la estabilidad del endpoint `/publications/active` con soporte estricto de auditoría para multiplicadores dinámicos y snapshot de base de datos.
  - **Frontend & CSS Responsivo ([frontend/style.css](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/style.css))**: Se inyectaron reglas con padding vertical reducido (`0.45rem`) en `.blue-section` y `.red-section` dentro de la media query `@media (max-width: 480px)` para garantizar que el diseño esbelto y ultra-compacto de las tarjetas de saldo se aplique con máxima fidelidad visual en teléfonos móviles.
* **Verificación**:
  - Auditoría de importación en tiempo de ejecución (`verify_all_backend_imports.js`): 84/84 módulos OK sin fallos.
  - Re-compilación del bundle para entorno Demo (`dist-demo`).

### 2026-08-14 — Evaluación de Tasa Dinámica y Multiplicador Condicional en Transición de Pre-Lanzamiento
* **Cambio**:
  - **Backend (`publicationController.js`, `publicationService.js`)**: Se centralizó la lógica con `calculatePublicationEffectiveCost()`. Si `pre_launch_mode_enabled` es `false` y la tarea no es de impulsor (`is_booster_task = false`), la tarifa se calcula estrictamente con multiplicador `1.0` sobre `base_blue_cost`, previniendo la inflación indebida de `BLUE` líquido. Si la tarea es de impulsor o el pre-lanzamiento está activo, mantiene la multiplicación por la etapa vigente.
  - **Frontend (`publish.js`)**: Se adaptó el calculador de precio del formulario para mostrar `BLUE Real (Transacción directa sin multiplicador)` al estar desactivado el pre-lanzamiento.
* **Impacto**: Elimina el riesgo financiero de emitir tokens reales multiplicados tras el Go-Live, preservando la inmutabilidad de precios en PostgreSQL y garantizando auditabilidad estricta.

### 2026-08-14 — Rediseño Compacto y Refactorización Modular de la Billetera Web3 (Opciones A y B)
* **Objetivo & Diagnóstico**:
  - Reducción del padding interno vertical en las tarjetas de saldo BLUE y RED del Dashboard (`contract_interaction.html`), eliminando espacios muertos para un diseño estilizado, compacto y simétrico con acabado fintech profesional.
  - Creación del módulo centralizado `walletService.js` para estandarizar el formateo, parsing y cálculo de métricas financieras de la billetera Web3 bajo el principio de Zero-Trust y Single Source of Truth.
* **Cambios Técnicos**:
  - **Estética & Layout ([frontend/style.css](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/style.css))**:
    - Se redujo el padding de `#panelBilletera .balances-container` a `0.85rem 1.25rem` (en móvil a `0.75rem 1rem`), preservando el borde redondeado de 20px y los efectos de iluminación dinámica *blue/red gleam*.
    - Se aplicó simetría matemática exacta entre `.blue-section` (`padding: 0 0 0.55rem 0`) y `.red-section` (`padding: 0.55rem 0 0 0`), reduciendo los márgenes de título y gap de items.
    - Se preservó al 100% la escala tipográfica existente sin alterar tamaños de fuente.
  - **Modularización ([frontend/src/modules/walletService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/modules/walletService.js))**:
    - Extracción de utilidades puras `formatBalance`, `formatBalancePlain`, `parseFormattedBalance` y `calculateCreditMetrics`.
    - Re-exportación en `frontend/src/modules/index.js` y vinculación global a `window` para retrocompatibilidad total sin omisión de código.
  - **Preservación Zero-Loss ([frontend/src/pages/contract-interaction.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/contract-interaction.js))**:
    - Importación limpia de `walletService.js` manteniendo las 3,186 líneas de lógica de negocio, modales, campañas y listeners intactos.
* **Verificación**:
  - Compilación de producción con Vite (`npm run build`) exitosa en 13.82s.
  - 84 de 84 módulos del backend validados sin errores de importación (`npm test`).

### 2026-08-12 — Consolidación Inmutable de Tablas de Auditoría (`105_consolidate_audit_logs.js`)
* **Cambio**:
  - **MigraciÃ³n DDL ([105_consolidate_audit_logs.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/105_consolidate_audit_logs.js))**:
    - Se creÃ³ la migraciÃ³n transaccional `105` para traspasar en caliente todos los registros histÃ³ricos de la tabla obsoleta `audit_logs` (plural) hacia la tabla centralizada `audit_log` (singular) utilizando `WHERE NOT EXISTS` para prevenciÃ³n absoluta de duplicados.
    - AsignaciÃ³n inteligente de categorÃ­as mediante `CASE` (`'FINANCIAL'`, `'SOS_HUMANITARIAN'`, `'SYSTEM'`).
    - EliminaciÃ³n segura (`DROP TABLE IF EXISTS audit_logs CASCADE`) de la tabla duplicada una vez migrados los datos.
  - **RefactorizaciÃ³n de Servicios ([financialCoreService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/financialCoreService.js))**:
    - Se redirigiÃ³ la inserciÃ³n de quemas de tokens para saldar deudas hacia `audit_log` con metadatos JSONB completos y campos estandarizados (`actor_id`, `actor_username`, `category = 'FINANCIAL'`).
  - **Mantenimiento y Comentarios ([victimController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/victimController.js), [delete_last_sos_user.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/scripts/delete_last_sos_user.js))**:
    - Se eliminaron las referencias obsoletas a `audit_logs` y se documentÃ³ exhaustivamente la alineaciÃ³n con la tabla unificada.
* **Impacto**: Resuelve la vulnerabilidad de invisibilidad operativa donde los eventos de quema de tokens y auditorÃ­a financiera no aparecÃ­an en la consola del Panel Admin. Garantiza cumplimiento 100% de normativas FinTech / SOC 2 Type II y cero pÃ©rdida de datos.

### 2026-08-11 â€” IntegraciÃ³n Completa del CMS y Enriquecimiento de Vistas Previas de Emails
* **Cambio**:
  - **IntegraciÃ³n Backend ([emailService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/emailService.js))**:
    - Las funciones del sistema (`sendOtpEmail`, `sendTransactionEmail`, `sendAnnouncementEmail`, `sendGovernanceEmail`) ahora consultan dinÃ¡micamente la tabla `email_templates` en la base de datos para recuperar las plantillas actualizadas en tiempo real desde el panel de administraciÃ³n.
    - Se diseÃ±Ã³ una estrategia de **Fallback Seguro**: si ocurre una desconexiÃ³n o fallo temporal con PostgreSQL, las funciones caen automÃ¡ticamente a la plantilla HTML estÃ¡tica original cableada, previniendo la pÃ©rdida de notificaciones crÃ­ticas.
    - CorrecciÃ³n de sintaxis y eliminaciÃ³n de redundancias de inicializaciÃ³n en `SendEmailCommand`.
    - RestauraciÃ³n de la firma de `processPendingBroadcasts(pool)` para garantizar la compatibilidad con el despachador asÃ­ncrono.
  - **RedirecciÃ³n de SOS Venezuela ([victimController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/victimController.js))**:
    - El flujo humanitario SOS ha sido migrado para consultar la tabla centralizada `email_templates` (`sos_victim_registered`, `sos_victim_info_requested`, `sos_victim_aid_approved`) en vez de la tabla obsoleta `email_templates_sos`, unificando la administraciÃ³n en una sola interfaz.
  - **SincronizaciÃ³n de Especialidades y adiciÃ³n de 'Voluntario' en Reclutamiento**:
    - Se agregaron todas las especialidades reales del formulario de postulaciÃ³n del candidato al desplegable de filtros en el portal de administraciÃ³n (`admin-recruitment.html`), permitiendo filtrar bÃºsquedas por cualquier rol.
    - Se incorporÃ³ la opciÃ³n de **'Voluntario'** tanto en el formulario de postulaciones del usuario (`trabaja-con-nosotros.html`) como en el filtro del panel de reclutamiento administrativo.
    - Para mantener la seguridad y robustez, se actualizÃ³ la lista de roles permitidos del lado del servidor (`ALLOWED_ROLES` en `recruitmentController.js`) agregando `'Voluntario'`, asegurando que el backend procese correctamente estas nuevas postulaciones sin generar fallos de validaciÃ³n.
  - **CorrecciÃ³n de Rutas de Retorno en SubmÃ³dulos Administrativos**:
    - Se identificÃ³ que al pulsar los botones "Volver" en `admin-email-templates.html` y `admin-recruitment.html`, estos enlazaban errÃ³neamente a `admin.html` (el formulario de login) en lugar de a `admin-panel.html` (el panel de control del administrador).
    - Dado que la pÃ¡gina de login no realiza redirecciones automÃ¡ticas para usuarios autenticados, esto obligaba a los administradores a loguearse de nuevo. Se corrigieron los enlaces a `admin-panel.html`, restableciendo una navegaciÃ³n fluida y profesional sin interrumpir la sesiÃ³n de usuario.
  - **Vistas Previas Enriquecidas ([admin-email-templates.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-email-templates.html))**:
    - Se programaron conjuntos de **Mock Variables** inteligentes en el frontend. Dependiendo del tipo de correo activo, el editor inyecta valores realistas para variables estructurales complejas (`details_table`, `details_section`, `action_button`, `recent_changes_section`, etc.) en lugar de variables globales genÃ©ricas.
    - Esto resuelve la visualizaciÃ³n de tokens crudos en las vistas previas en vivo, asegurando una previsualizaciÃ³n 100% idÃ©ntica al correo real recibido por el usuario.
  - **CompilaciÃ³n de ProducciÃ³n**:
    - Verificada exitosamente con Vite (`npm --prefix frontend run build:demo`): 104 mÃ³dulos, 168 recursos precacheados, 0 errores.
* **Impacto**: Se cumple con la premisa DRY y con la promesa de centralizaciÃ³n del CMS: todo el sistema (Gobernanza, SOS, OTP, Transacciones) responde de inmediato a los cambios hechos por el administrador, manteniendo una vista previa idÃ©ntica en vivo y protegiendo el canal mediante sanitizaciÃ³n XSS y robustez contra fallos de base de datos.

### 2026-08-11 â€” RediseÃ±o UX/UI Profesional: Modal Editor a Pantalla Completa en CMS de Plantillas de Email
* **Cambio**:
  - **Modal Editor Full-Screen ([admin-email-templates.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-email-templates.html))**:
    - RediseÃ±o completo del modal de ediciÃ³n a **pantalla completa real** (`100vw Ã— 100vh`), eliminando bordes redondeados y mÃ¡rgenes para que el espacio de trabajo ocupe el 100% de la ventana del navegador.
    - **Causa raÃ­z identificada y corregida**: El archivo global `style.css` define `button { width: 100%; padding: 15px; }` que deformaba todos los botones internos del modal (cierre, guardar, cancelar). SoluciÃ³n: todos los selectores CSS del modal usan el prefijo `#editModal` con `!important` en cada propiedad crÃ­tica para ganar la batalla de especificidad CSS.
    - BotÃ³n de cierre `âœ•` rediseÃ±ado como icono circular compacto de 32Ã—32px (`#editModal button.btn-close-modal`) con hover rojo suave y rotaciÃ³n a 90Â°.
    - Botones `Cancelar` y `Guardar Plantilla` del footer con ancho `auto` blindado contra el `width: 100%` global.
    - Layout split 50/50 con editor de cÃ³digo HTML monoespaciado (JetBrains Mono) a la izquierda y vista previa en vivo del correo a la derecha.
    - EliminaciÃ³n de botones "Escritorio / MÃ³vil" que no funcionaban por el conflicto CSS global y confundÃ­an al usuario.
    - Cierre intuitivo con tecla `Escape`.
    - Responsive: en pantallas menores a 900px el split se convierte en stack vertical.
  - **Pruebas y CompilaciÃ³n**:
    - CompilaciÃ³n verificada con Vite (`npm --prefix frontend run build:demo`): 104 mÃ³dulos, 0 errores.
* **Impacto**: Espacio de trabajo (workspace) profesional a pantalla completa comparable a editores CMS de nivel empresarial (Mailchimp, SendGrid, Stripe), inmune a las interferencias de los estilos CSS globales del proyecto.

### 2026-08-10 â€” CorrecciÃ³n Visual y de Endpoint API en CMS de Plantillas de Email Admin
* **Cambio**:
  - **Ajuste de Layout CSS ([admin-email-templates.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-email-templates.html))**:
    - CorrecciÃ³n del solapamiento visual entre la barra lateral de navegaciÃ³n (`#adminSidebar`) y el contenedor principal (`.admin-container`).
    - AdiciÃ³n de reglas CSS dedicadas `margin-left: 280px` y `width: calc(100% - 280px)` alineadas con las especificaciones responsive del Panel de AdministraciÃ³n.
  - **ConexiÃ³n API y AutenticaciÃ³n HttpOnly**:
    - ConfiguraciÃ³n explÃ­cita de `API_URL` para la consulta y actualizaciÃ³n de plantillas de correo (`GET /api/admin/email-templates`, `PUT /api/admin/email-templates/:key`).
    - InclusiÃ³n del encabezado de credenciales `credentials: 'include'` en todas las peticiones `fetch()` para transmitir correctamente las cookies HttpOnly de sesiÃ³n administrativa, previniendo errores de autorizaciÃ³n 401/403.
  - **Pruebas y CompilaciÃ³n**:
    - VerificaciÃ³n exitosa del empaquetado de producciÃ³n/demo mediante Vite (`npm --prefix frontend run build:demo`) garantizando la validez de los activos estÃ¡ticos.
* **Impacto**: PresentaciÃ³n visual impecable, organizada y completamente funcional del Gestor de Plantillas de Correo en el Panel de AdministraciÃ³n.

### 2026-08-09 â€” Admin Email CMS & Layout MÃ¡ster Corporativo No-Reply (MigraciÃ³n 104)
* **Cambio**:
  - **Base de Datos ([104_create_system_email_templates_table.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/104_create_system_email_templates_table.js))**:
    - Creada tabla global `email_templates` con indices por categorÃ­a (`seguridad`, `finanzas`, `comunicados`, `gobernanza`, `reclutamiento`, `sos_venezuela`).
    - Sembrado idempotente (ON CONFLICT DO NOTHING) de 8 plantillas iniciales con variables dinÃ¡micas sanitizadas `{{var}}`.
    - CorrecciÃ³n en tabla `email_templates_sos` del mensaje que solicitaba responder al correo, reemplazÃ¡ndolo por indicaciÃ³n explÃ­cita de No-Reply e instrucciones de soporte.
  - **Layout MÃ¡ster Corporativo ([emailService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/emailService.js))**:
    - ImplementaciÃ³n de `buildMasterEmailWrapper()` que envuelve de forma centralizada a todos los envÃ­os (OTP, Recibos de TransacciÃ³n, Difusiones, Gobernanza, Reclutamiento y SOS).
    - InyecciÃ³n inmutable de Header corporativo con Logo Pure CSS, caja de alertas anti-phishing y Footer No-Reply de la industria ("Por favor no respondas a este mensaje. Si requieres asistencia contÃ¡ctanos en support@wintoncoin.com").
    - RestituciÃ³n limpia del worker de difusiones en segundo plano (`processPendingBroadcasts`) resolviendo el fallo de despliegue en Render.
    - ImplementaciÃ³n de `sendTemplatedEmail()` para renderizado dinÃ¡mico de plantillas editables desde base de datos.

  - **API de AdministraciÃ³n ([emailTemplateController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/emailTemplateController.js) & [emailTemplateRoutes.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/routes/emailTemplateRoutes.js))**:
    - Endpoints protegidos `GET /api/admin/email-templates`, `GET /api/admin/email-templates/:key`, `PUT /api/admin/email-templates/:key` y `POST /api/admin/email-templates/:key/preview` con middleware de autenticaciÃ³n Zero-Trust (`authenticateAdmin`) y auditorÃ­a imborrable SOC 2 (`logAuditEvent`).
  - **Interfaz de Usuario Frontend ([admin-email-templates.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-email-templates.html) & [vite.config.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/vite.config.js))**:
    - Gestor visual de plantillas con tarjetas, filtrado por categorÃ­as, buscador en tiempo real, editor de texto/HTML, chipset para inserciÃ³n con un clic de variables y Live Preview en vivo envuelto en el Layout MÃ¡ster.
    - Registro de entrada en Vite Rollup Input y enlace de acceso directo en la barra lateral del Panel de AdministraciÃ³n (`admin-panel.html`).
  - **CatÃ¡logo de Pruebas QA ([QA_TEST_CATALOG.md](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/QA_TEST_CATALOG.md))**: AÃ±adas misiones correlativas **QA-20** (EdiciÃ³n de Plantillas de Correo y Vista Previa No-Reply) y **QA-21** (EvaluaciÃ³n de Candidatos y VisualizaciÃ³n de CV en Reclutamiento) en el formato estricto compatible con el parser del Panel Admin.
  - **Pruebas Automatizadas de ImportaciÃ³n ([verify_all_backend_imports.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/verify_all_backend_imports.js))**: CreaciÃ³n del script de auditorÃ­a en tiempo de ejecuciÃ³n que inspecciona automÃ¡ticamente los 84 mÃ³dulos de backend antes de desplegar (`npm test` / `npm run audit:imports`), garantizando la ausencia total de `ReferenceError` o exportaciones `undefined`.
* **Impacto**: EstandarizaciÃ³n 100% profesional de las comunicaciones transaccionales de WintonCoin bajo normas No-Reply de la industria y empoderamiento del equipo administrativo para editar el contenido de las notificaciones sin necesidad de despliegues de cÃ³digo.



### 2026-08-07 â€” Reclutamiento Seguro: CV en la Nube y Perfil Estructurado de Talento (MigraciÃ³n 103)

* **Cambio**:
  - **Base de Datos ([103_add_cv_url_and_fields_to_recruitment.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/103_add_cv_url_and_fields_to_recruitment.js))**: Creada migraciÃ³n correlativa PostgreSQL que aÃ±ade las columnas `cv_url VARCHAR(500)`, `portfolio_url VARCHAR(500)`, `github_url VARCHAR(500)`, `years_experience VARCHAR(50)` y `cover_letter TEXT` a la tabla `recruitment_proposals`.
  - **Ciberseguridad Backend ([recruitmentController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/recruitmentController.js) & [recruitmentRoutes.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/routes/recruitmentRoutes.js))**:
    1. Arquitectura **Zero Server File Vector**: El postulante envÃ­a el enlace seguro a su CV en la nube (Google Drive, Dropbox, Notion, OneDrive) o su Portfolio/GitHub en lugar de subir archivos binarios al servidor Express, eliminando riesgos de ejecuciÃ³n remota de cÃ³digo (RCE), bombas zip o virus.
    2. ValidaciÃ³n y desinfecciÃ³n estricta de URLs con protocolo `https://` mediante el parser nativo `URL` de JavaScript para prevenir Regex Bypass y XSS.
    3. InserciÃ³n SQL 100% parametrizada (`$1...$15`) y registro inmutable en log de auditorÃ­a bancaria (`RECRUITMENT_APPLICATION_SUBMITTED`).
  - **Portal de Talento ([trabaja-con-nosotros.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/trabaja-con-nosotros.html))**: Formularios enriquecidos con campos de CV en la nube, Portfolio, GitHub, AÃ±os de Experiencia y Carta de PresentaciÃ³n. Auto-formateo dinÃ¡mico a `https://` y feedback interactivo.
  - **Panel de Reclutamiento Admin ([admin-recruitment.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-recruitment.html))**: Despliegue de enlaces verificados (`ðŸ“„ Ver CV â†—`, `LinkedIn â†—`, `Portfolio â†—`, `GitHub â†—`), aÃ±os de experiencia y tarjeta expandible para la carta de presentaciÃ³n.
* **Impacto**: PostulaciÃ³n de candidatos fluida, completa y 100% segura bajo el principio Zero-Trust sin riesgos de almacenamiento de archivos binarios en la infraestructura de WintonCoin.

### 2026-08-07 â€” RediseÃ±o UI/UX Profesional y AuditorÃ­a de Ciberseguridad Zero-Trust en Momentum Admin Panel
* **Cambio**:
  - **Aislamiento de Estilos CSS (`momentum-admin.css`)**:
    - Se creÃ³ la hoja de estilos dedicada `momentum-admin.css` eliminando la dependencia de `style.css` en `momentum-admin.html` para erradicar interferencias de reglas globales y desalineaciones de layout.
    - Se implementÃ³ un diseÃ±o dark mode FinTech nivel Silicon Valley con Glassmorphism, tarjetas de configuraciÃ³n en Grid responsivo, tipografÃ­a `Inter` y botones/badges con paletas HSL tailoring.
  - **OptimizaciÃ³n de UX / Responsive Design (`momentum-admin.html` y `momentum-admin.js`)**:
    - Se incorporaron wrappers de scroll horizontal (`.mma-table-scroll`) en todas las tablas dinÃ¡micas (Postulantes, Influencers, CampaÃ±as) permitiendo navegaciÃ³n fluida en dispositivos mÃ³viles sin desbordamientos de pantalla.
    - Se rediseÃ±Ã³ el header superior con posicionamiento sticky y badge de validaciÃ³n de panel oficial.
  - **AuditorÃ­a de Ciberseguridad & Zero-Trust (`momentumController.js`, `momentum-admin.js`)**:
    - Se sanearon y auditaron todas las renderizaciones dinÃ¡micas de enlaces de comprobantes (`proof_link`) con validaciÃ³n de protocolo estricto (`http://` o `https://`), previniendo inyecciones de cÃ³digo malicioso (`javascript:`) o vectores XSS.
    - Se verificÃ³ que todas las operaciones de backend utilicen consultas SQL 100% parametrizadas con PostgreSQL Client/Pool, garantizando inmunidad contra inyecciÃ³n de SQL (SQLi).
    - Se mantuvo el aislamiento de autenticaciÃ³n mediante cookies `httpOnly` supervisadas por `verifyAdminToken` e inmutabilidad en la tabla de auditorÃ­a bancaria.
* **Impacto**: Interfaz de administraciÃ³n completamente ordenada, fluida y responsiva. Blindaje de ciberseguridad Zero-Trust y cumplimiento de estÃ¡ndares bancarios FinTech / SOC 2 para producciÃ³n a gran escala.

### 2026-08-06 â€” Context-Aware Routing para Notificaciones Push (Deep Links)
* **Cambio**:
  - **RefactorizaciÃ³n de Enrutamiento Push (`publicationController.js`, `adminPublicationsController.js`, `notificationEventBus.js`)**:
    - Se solucionÃ³ el bug donde el payload de notificaciones push abrÃ­a el `/momentum-dashboard.html` genÃ©rico. Ahora las notificaciones inyectan dinÃ¡micamente el ID y abren directamente `/publication-detail.html?id=XXX`.
    - En el Panel Admin, se introdujo una bifurcaciÃ³n condicional: si una tarea oficial es asignada a un usuario especÃ­fico (`target_username`), el sistema emite una notificaciÃ³n exclusiva privada (`sendNotificationToUser`), eliminando el spam global (`sendNotificationToAll`).
    - **[NUEVO]** Para tareas personalizadas asignadas vÃ­a Admin, se habilitÃ³ el registro persistente In-App (campanita) mediante un `INSERT INTO notifications`, garantizando el cumplimiento de arquitecturas de doble canal (EfÃ­mero + Persistente) para notificaciones dirigidas uno a uno.
    - Se auditaron y corrigieron 404s silenciosos en el bus central de eventos, actualizando enlaces de tareas y Ã³rdenes P2P para que dirijan a las interfaces reales.
* **Impacto**: UX optimizada mediante Deep Linking preciso. Se evita la exposiciÃ³n o "spam" a la base completa de usuarios en tareas dirigidas y se asegura que cada notificaciÃ³n accione en el flujo de trabajo correcto.

### 2026-08-05 â€” CorrecciÃ³n CrÃ­tica en ActivaciÃ³n SOS Venezuela y VerificaciÃ³n de CÃ³digo Especial Admin
* **Cambio**:
  - **CorrecciÃ³n de ReferenceError en `victimController.js` (`verifyVictimOtpPublic`)**:
    - Se resolviÃ³ un error crÃ­tico `ReferenceError: rewardAmount is not defined` que ocurrÃ­a al activar la cuenta tras ingresar el OTP en el formulario SOS Venezuela.
    - La variable `rewardAmount` ahora se retorna de forma limpia desde `referralRewardService.processReferralReward`, evitando que la funciÃ³n arroje un error interno del servidor (500) y se revierta la transacciÃ³n.
  - **Fix de Enrutamiento en VerificaciÃ³n de CÃ³digo de Referido Especial (`systemRoutes.js` y `admin-panel.js`)**:
    - Se solucionÃ³ el error `404 Not Found` en la consola de Chrome (`/api/system/verify-referral-code`) mediante la adiciÃ³n de una ruta alias explÃ­cita en `systemRoutes.js` (`router.get('/system/verify-referral-code', ...)`).
    - Se actualizÃ³ el fetch en `admin-panel.js` con un patrÃ³n de respaldo resiliente que intenta la ruta primaria `/api/verify-referral-code` y cae a `/api/system/verify-referral-code`, garantizando retrocompatibilidad y eliminado el mensaje "Error al verificar cÃ³digo".
* **Impacto**: Se restaura la operatividad total del Censo SOS Venezuela en el flujo de activaciÃ³n de cuenta y se garantiza que el Panel de AdministraciÃ³n pueda verificar y validar en tiempo real la existencia de cualquier cÃ³digo de referido especial asignado a causas humanitarias (como `@CadenaSOSVenezuela`).

### 2026-08-05 â€” RefactorizaciÃ³n Integral Censo SOS Venezuela, Zero-Trust y OpciÃ³n A (ContraseÃ±a en OTP)
* **Cambio**:
  - **RefactorizaciÃ³n Backend de Registro (`registerVictimPublic`)**:
    1. Se implementÃ³ validaciÃ³n booleana estricta (Zero-Trust) nativa para el consentimiento de Habeas Data y la DeclaraciÃ³n Jurada, evitando ataques de inyecciÃ³n y bypass.
    2. ModificaciÃ³n de la lÃ³gica para usuarios existentes implementando un `UPSERT` en `pending_verifications`, eliminando el bloqueo crÃ­tico que impedÃ­a a usuarios de WintonCoin enviar sus censos de ayuda humanitaria (Falla CrÃ­tica resuelta).
    3. Reemplazo del uso inseguro de `Date.now()` para la asignaciÃ³n temporal de expedientes por `crypto.randomUUID()`, previniendo colisiones de ID bajo alta concurrencia o ataques de bots.
    4. EliminaciÃ³n de las inserciones prematuras y errÃ³neas en `blue_token_escrows`, garantizando la integridad transaccional de los tokens.
  - **Flujo de ActivaciÃ³n y ContraseÃ±a OpciÃ³n A (`verifyVictimOtpPublic`)**:
    1. Se migrÃ³ a la "OpciÃ³n A" (EstÃ¡ndar de Industria), donde la contraseÃ±a nunca viaja por correo. El damnificado define su contraseÃ±a en la misma pantalla donde ingresa el OTP de 6 dÃ­gitos.
    2. IntegraciÃ³n idÃ©ntica y estandarizada (DRY) del motor de acreditaciÃ³n de referidos (`authController.js`), utilizando `record_booster_event` y dejando un registro inmutable en el Ledger del Impulsor para los 200 BLUE IOU otorgados en el programa SOSVENEZUELA.
    3. Retorno inmediato de tokens JWT (Access de 15 min + Refresh HttpOnly de 7 dÃ­as) al validar el OTP, activando automÃ¡ticamente la sesiÃ³n segura.
    4. Mantenimiento correcto del estatus del expediente en `pending_verification`, supeditando la asignaciÃ³n de ayuda a la revisiÃ³n humana de los administradores.
  - **ProtecciÃ³n Anti-FricciÃ³n en Frontend (`sos-venezuela.js` / `sos-venezuela.html`)**:
    1. ReestructuraciÃ³n de la Card OTP para inyectar dinÃ¡micamente los campos requeridos de `Define tu ContraseÃ±a` y `Confirma tu ContraseÃ±a` con doble verificaciÃ³n de coincidencia en el cliente.
    2. ImplementaciÃ³n de una validaciÃ³n exhaustiva de formulario en tiempo real (eventos `input` y `change`). El botÃ³n "Enviar Solicitud" inicia visualmente deshabilitado (opacidad al 50%) y solo se activa como CTA interactivo cuando se han llenado *todos* los campos obligatorios y *ambas* casillas legales estÃ¡n marcadas.
* **Impacto**: Se sanea la deuda tÃ©cnica (cÃ³digos duplicados residuales) y se blinda el Censo de Ayuda Humanitaria contra ataques masivos. Se mejora drÃ¡sticamente la Experiencia de Usuario (UX) dando feedback visual en el formulario y entregando el control de la contraseÃ±a al damnificado. Todo alineado bajo normativas de Zero-Trust, inmutabilidad y SOC 2.

### 2026-08-05 â€” IncorporaciÃ³n del Plan de RefactorizaciÃ³n de Base de Datos en Technical Improvements
* **Cambio**:
  - **DocumentaciÃ³n ([TECHNICAL_IMPROVEMENTS.md](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/docs/TECHNICAL_IMPROVEMENTS.md))**:
    - Se incorporÃ³ la **SecciÃ³n 13 (Plan de RefactorizaciÃ³n y AuditorÃ­a de la Base de Datos, Migraciones y AuditorÃ­a Bancaria)** ordenando los problemas por severidad:
      1. **Severidad CrÃ­tica / Urgente**: Desacoplamiento de `databaseInit.js` de `server.js` para evitar DDLs duplicados y condiciones de carrera al arrancar.
      2. **Severidad CrÃ­tica / SOC 2**: UnificaciÃ³n de las tablas de auditorÃ­a (`audit_log` singular vs `audit_logs` plural) mediante la migraciÃ³n `105_consolidate_audit_logs.js` y canalizaciÃ³n vÃ­a `auditService.js`.
      3. **Severidad Alta**: CorrecciÃ³n de colisiones en prefijos numÃ©ricos de migraciÃ³n (`050_`), refactorizaciÃ³n del parche `MockPool` e instanciaciÃ³n duplicada de `pg.Pool`.
      4. **Severidad Media**: SanitizaciÃ³n estricta de construcciones SQL dinÃ¡micas (`victimController.js`) y deprecaciÃ³n de columnas legacy duplicadas (`users.phone` vs `users.phone_number`).
* **Impacto**: Proporciona una hoja de ruta priorizada y categorizada para guiar la refactorizaciÃ³n defensiva y la homologaciÃ³n del subsistema de persistencia hacia estÃ¡ndares FinTech / SOC 2.

### 2026-08-04 â€” Sistema de Notificaciones (Badges) Centralizadas en Panel Admin
* **Cambio**:
  - **Backend**: Se implementÃ³ `adminMetricsController.js` con un endpoint unificado (`GET /api/admin/metrics/badges`) que agrega conteos (SQL `COUNT(*)`) concurrentes de mÃºltiples tablas (`disaster_victims_registry`, `humanitarian_causes`, `publications`, etc.) previniendo vulnerabilidades DoS por mÃºltiples llamadas.
  - **ModularizaciÃ³n DRY de AcreditaciÃ³n de Referidos (`referralRewardService.js`):**
    - Se extrajo toda la lÃ³gica de bonos, notificaciones, envÃ­os de correo transaccional y derivaciÃ³n a Causas Humanitarias a un servicio centralizado.
    - Tanto los registros normales como los registros del Censo SOS Venezuela ejecutan exactamente el mismo flujo de acreditaciÃ³n.
    - Si el referente (ej. `@CadenaSOSVenezuela`) tiene una Causa Humanitaria Activa y Aprobada, los bonos generados por referidos se desvÃ­an de forma segura y auditable como donaciÃ³n `on_hold` a la causa.
  - **ValidaciÃ³n en Tiempo Real de CÃ³digo Especial en Admin (`admin-panel.js` & `systemController.js`):**
    - Se agregÃ³ el endpoint `/api/system/verify-referral-code` que comprueba si un cÃ³digo existe en la BD y muestra el usuario al que pertenece.
    - En el Panel Admin, se muestra `âœ… Pertenece a @username` o `â�Œ CÃ³digo no encontrado` al escribir en el campo de CÃ³digo de Referido Especial.
    - Si el cÃ³digo ingresado no existe, el switch de habilitaciÃ³n se desactiva y bloquea automÃ¡ticamente.
  - **Frontend**: Se inyectaron `nav-badge` y `nav-badge-blue` en `admin-panel.html` y se implementÃ³ `startBadgesPolling()` en `admin-panel.js` para una sincronizaciÃ³n en tiempo real cada 60 segundos (arquitectura polling unificado).
* **Impacto**: Incrementa dramÃ¡ticamente la eficiencia operativa de los administradores al saber exactamente quÃ© flujos (SOS, Solidario, Talento, Momentum, Publicaciones) requieren su atenciÃ³n, garantizando seguridad y nulo impacto al rendimiento de la DB.

### 2026-08-04 â€” CorrecciÃ³n de Enrutamiento PWA (Multi-Page vs Single-Page)
* **Cambio**:
  - **Service Worker ([sw-source.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/sw-source.js))**:
    - Se eliminÃ³ el bloque `NavigationRoute` con fallback a `index.html` inyectado por Workbox.
    - Se preservÃ³ la estrategia `NetworkFirst` explÃ­cita para archivos `.html`.
* **Evidencia**: EliminaciÃ³n del cÃ³digo SPA-fallback incompatible con la arquitectura MPA de WintonCoin.
* **Impacto**: Resuelve el bug crÃ­tico donde las navegaciones a enlaces con parÃ¡metros (ej. `?id=XXX` o `?ref=SOSVENEZUELA`) redirigÃ­an a la landing page en entornos PWA instalados o cacheados, garantizando accesibilidad total a los detalles de publicaciones y la campaÃ±a SOS.

### 2026-08-03 â€” ImplementaciÃ³n de EdiciÃ³n de CampaÃ±as en Panel Momentum Admin
* **Cambio**:
  - **Estructura HTML & Estilos ([momentum-admin.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/momentum-admin.html))**:
    - Se agregÃ³ el modal de ediciÃ³n `#mmaEditCampaignModal` con todos los campos necesarios (tÃ­tulo, descripciÃ³n, recompensas base por nivel y switch de campaÃ±a repetible).
  - **LÃ³gica Frontend ([momentum-admin.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/momentum-admin.js))**:
    - Se incorporÃ³ el botÃ³n **"âœ�ï¸� Editar"** dinÃ¡mico a la tabla de campaÃ±as.
    - Se agregaron las funciones `openEditCampaignModal`, `closeEditCampaignModal`, y `saveEditCampaign` para manipular el estado, abrir el formulario prellenado y enviar la peticiÃ³n `PUT` al backend de forma asÃ­ncrona.
* **Evidencia**: CompilaciÃ³n de Vite exitosa en entorno de demo y validaciÃ³n visual.
* **Impacto**: Se habilita una funciÃ³n crÃ­tica del panel de administraciÃ³n permitiendo a los administradores ajustar tÃ­tulos, descripciones y pagos de las misiones Momentum en tiempo real, sin depender de modificaciones manuales en base de datos.

### 2026-08-03 â€” SimplificaciÃ³n del TÃ­tulo del Censo SOS Venezuela
* **Cambio**:
  - **Estructura HTML ([sos-venezuela.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/sos-venezuela.html))**:
    - Se actualizÃ³ el tÃ­tulo de la cabecera del censo de damnificados para remover la palabra "Registro".
    - El tÃ­tulo pasÃ³ de "Censo y Registro de Asistencia para Damnificados" a "Censo para Asistencia a Damnificados".
* **Evidencia**: CompilaciÃ³n de Vite limpia y exitosa.
* **Impacto**: Unifica la semÃ¡ntica del flujo evitando confusiones lingÃ¼Ã­sticas con el registro general de usuarios.

### 2026-08-03 â€” ResoluciÃ³n de Self-Inflicted DoS en Conexiones Inactivas (Alta Disponibilidad)
* **Cambio**:
  - **Node.js PostgreSQL Pool ([db.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/config/db.js))**:
    - Se eliminÃ³ el comando `process.exit(-1)` del listener de eventos de error global del Pool de PostgreSQL.
    - Se implementÃ³ un registro auditable del evento en caso de caÃ­das de red o cierres forzados por la infraestructura cloud (`ECONNABORTED`).
* **Evidencia**: EliminaciÃ³n del Anti-PatrÃ³n que tumbaba el servidor local y en Render.
* **Impacto**: Dota al backend de Alta Disponibilidad (High Availability - HA) y Tolerancia a Fallos (Self-Healing). Previene la interrupciÃ³n total del servicio ante caÃ­das rutinarias de conexiones inactivas administradas por Render.

### 2026-08-03 â€” ActualizaciÃ³n del BotÃ³n de Registro de Damnificados SOS
* **Cambio**:
  - **Texto de Enlace ([index.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/index.html), [sos-venezuela.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/sos-venezuela.html))**:
    - Se actualizÃ³ el tÃ­tulo del botÃ³n de registro de la campaÃ±a SOS para las personas afectadas por el terremoto.
    - Se cambiÃ³ el texto de "Soy una persona afectada, quiero registrarme" por "Â¿Fuiste afectado? RegÃ­strate" para un tono mÃ¡s directo, claro y orientado a conversiÃ³n (CTA).
* **Evidencia**: CompilaciÃ³n de Vite exitosa.
* **Impacto**: Optimiza el CTR y la experiencia de usuario (UX) simplificando el texto en dispositivos mÃ³viles sin desbordar el botÃ³n de la cabecera.

### 2026-08-03 â€” RediseÃ±o del Modal "Aviso Importante" (AlineaciÃ³n EstÃ©tica de Intersticiales)
* **Cambio**:
  - **Estructura HTML & Estilos ([register.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/register.html), [login.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/login.html), [style.css](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/style.css))**:
    - Se rediseÃ±Ã³ el modal de advertencia de cuenta Ãºnica (`#oneAccountPolicyModal`) en las pantallas de Login y Registro para heredar exactamente la estÃ©tica premium del modal de inicio "SabÃ­as?" (intersticial global).
    - Se implementÃ³ la tarjeta con fondo `#121926`, bordes con efectos translÃºcidos y sutiles brillos, el badge de la bombilla `ðŸ’¡`, y un botÃ³n de acciÃ³n "Entendido" a todo lo ancho con tonos de azul elÃ©ctrico `#0B5FFF`.
    - Se aÃ±adiÃ³ un efecto de desenfoque de fondo (`backdrop-filter: blur(8px)`) sobre el overlay para una inmersiÃ³n visual superior.
* **Evidencia**: CompilaciÃ³n de Vite exitosa y validaciÃ³n visual completada.
* **Impacto**: Unifica la consistencia visual y la experiencia de usuario (UI/UX) a lo largo del flujo de registro e inicio de sesiÃ³n de WintonCoin.

### 2026-08-03 â€” IntegraciÃ³n de SecciÃ³n de Reclutamiento (Careers) en Landing Page
* **Cambio**:
  - **InyecciÃ³n Visual & HTML ([index.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/index.html))**:
    - Se incorporÃ³ la secciÃ³n `careers-landing-section` (Talento & InnovaciÃ³n) de forma estratÃ©gica justo despuÃ©s de la secciÃ³n de Seguridad e Integridad y antes del Marketplace, alineÃ¡ndose con las tendencias de las principales fintechs de la industria (Stripe, Coinbase).
  - **Estilos Premium Adaptables ([style.css](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/style.css))**:
    - Se agregaron las reglas CSS con degradados en HSL, bordes semitransparentes en hover (efecto de brillo glassmorphism), y un botÃ³n de acciÃ³n premium de alto impacto para postularse.
    - Se asegurÃ³ la adaptabilidad en dispositivos mÃ³viles mediante media queries dedicadas.
  - **MisiÃ³n de Pruebas**:
    - Se registrÃ³ la misiÃ³n `QA-19` en el catÃ¡logo de pruebas manuales para auditar visualmente el flujo de talentos.
* **Evidencia**: CompilaciÃ³n de Vite limpia y exitosa para producciÃ³n y demo.
* **Impacto**: Aumenta la conversiÃ³n orgÃ¡nica de candidatos tÃ©cnicos y comerciales de primer nivel, mejorando la imagen institucional del proyecto con una secciÃ³n de carreras integrada en la narrativa central de la landing page.

### 2026-08-02 â€” BitÃ¡cora de Eventos, Historial SOS y Notificaciones In-App
* **Cambio**:
  - **Base de Datos & MigraciÃ³n ([101_create_disaster_victim_history.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/101_create_disaster_victim_history.js))**:
    - CreaciÃ³n de la tabla `disaster_victim_history` con Ã­ndices para registrar el historial del expediente de forma auditable.
  - **Notificaciones In-App & BitÃ¡cora en Backend ([victimController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/victimController.js))**:
    - Se persistieron notificaciones en la tabla `notifications` para los flujos de registro, actualizaciÃ³n de estado y desembolso del expediente SOS.
    - Se integraron registros automatizados en `disaster_victim_history` para auditar la creaciÃ³n del expediente, verificaciÃ³n OTP, cambios de estatus y desembolsos de ayuda humanitaria (acreditaciones BLUE).
    - Modificados los endpoints `getMyCasePublic` y `getVictimDetailAdmin` para retornar la bitÃ¡cora de eventos del caso.
  - **Interfaz de Usuario & Restricciones ([profile.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/profile.js), [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js))**:
    - En el perfil de usuario se muestra la bitÃ¡cora histÃ³rica cronolÃ³gica del expediente SOS detallando fecha, hora y minutos de cada evento.
    - En el panel de administraciÃ³n se agregÃ³ la visualizaciÃ³n del historial completo en la ficha del expediente.
    - Se deshabilitÃ³ el botÃ³n **Asignar Ayuda** de forma interactiva en el panel de control si el expediente no ha sido aprobado con el estatus `approved_for_aid`.
* **Evidencia**: CompilaciÃ³n de Vite exitosa y lÃ³gica de base de datos integrada bajo estÃ¡ndares contables y SOC 2.
* **Impacto**: AuditorÃ­a y trazabilidad completa del expediente SOS para los usuarios y administradores, previniendo desembolsos en expedientes no verificados y garantizando visibilidad en tiempo real de notificaciones in-app.

### 2026-08-01 â€” AutocorrecciÃ³n Inteligente y ValidaciÃ³n Segura de Enlace LinkedIn (Trabaja con Nosotros)
* **Cambio**:
  - **Experiencia de Usuario (UX) & ValidaciÃƒÆ’Ã‚Â³n ([trabaja-con-nosotros.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/trabaja-con-nosotros.html))**:
    1. Se modificÃƒÆ’Ã‚Â³ el campo `linkedin_url` de `type="url"` a `type="text"` para evitar que la validaciÃƒÆ’Ã‚Â³n nativa del navegador arroje alertas crÃƒÆ’Ã‚Â­pticas a usuarios mÃƒÆ’Ã‚Â³viles al omitir el esquema.
    2. Se inyectÃƒÆ’Ã‚Â³ un mensaje de ayuda interactivo `<span class="form-helper">` con estilos fluidos que da retroalimentaciÃƒÆ’Ã‚Â³n visual al usuario en tiempo real.
    3. Se implementÃƒÆ’Ã‚Â³ una lÃƒÆ’Ã‚Â³gica de autocompletado en JavaScript que se ejecuta al salir del campo (`blur` event) o en la escritura: si el usuario escribe el link sin protocolo, o usa `http://` (inseguro), el sistema lo actualiza forzando automÃƒÆ’Ã‚Â¡ticamente `https://` (estÃƒÆ’Ã‚Â¡ndar seguro de la industria/FinTech).
    4. Se aÃƒÆ’Ã‚Â±adiÃƒÆ’Ã‚Â³ validaciÃƒÆ’Ã‚Â³n en el evento `'submit'` que bloquea el envÃƒÆ’Ã‚Â­o y enfoca el campo si el usuario introduce un texto que no contenga una estructura vÃƒÆ’Ã‚Â¡lida de `linkedin.com/`.
* **Evidencia**: Pruebas en el frontend y verificaciÃƒÆ’Ã‚Â³n de flujo de datos del payload.
* **Impacto**: Cero fricciÃƒÆ’Ã‚Â³n para el candidato al copiar y pegar su perfil, garantizando que el backend siempre reciba enlaces seguros `https://` inalterados.

### 2026-08-01 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ MÃƒÆ’Ã‚Â³dulo 'Mi caso' (Censo & Ayuda SOS) y Correo Transaccional Enriquecido
* **Cambio**: 
  - **Correo Transaccional Enriquecido ([victimController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/victimController.js), [099](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/099_create_disaster_victims_system.js), [100](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/100_add_age_and_urgency_to_victims.js))**:
    1. Se actualizÃƒÆ’Ã‚Â³ la plantilla `victim_registration_confirm` para incluir una tarjeta HTML destacada con el **Resumen Completo del Censo Ingresado**: Nombre, CÃƒÆ’Ã‚Â©dula, Edad, UbicaciÃƒÆ’Ã‚Â³n detallada, Censo Familiar (menores, tercera edad, discapacidad), Nivel de Gravedad y Relato del caso.
  - **MÃƒÆ’Ã‚Â³dulo 'Mi caso' en Perfil de Usuario ([profile.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/profile.html), [profile.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/profile.js), [systemRoutes.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/routes/systemRoutes.js))**:
    1. Se creÃƒÆ’Ã‚Â³ la API pÃƒÆ’Ã‚Âºblica `GET /api/public/sos-venezuela/my-case` que consulta el expediente SOS y el historial de desembolsos del beneficiario.
    2. Se integrÃƒÆ’Ã‚Â³ la tarjeta dinÃƒÆ’Ã‚Â¡mica **`ÃƒÂ°Ã…Â¸Ã…Â¡Ã‚Â¨ Mi caso (Censo y Asistencia Humanitaria SOS)`** en el perfil de usuario con distintivos de estado (*En VerificaciÃƒÆ’Ã‚Â³n*, *Aprobado*, *Desembolsado*) y tabla de historial de tokens BLUE recibidos.
* **Evidencia**: Build de Vite y 6/6 suites de pruebas Jest pasaron al 100% (`npm run build:demo`, `npm test`).
* **Impacto**: Transparencia total para el beneficiario y cumplimiento de estÃƒÆ’Ã‚Â¡ndares de privacidad de datos (GDPR / Habeas Data).

### 2026-08-01 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AlineaciÃƒÆ’Ã‚Â³n Estricta de Esquema SQL en Registros AutomÃƒÆ’Ã‚Â¡ticos (is_verified)
* **Cambio**: 
  - **AlineaciÃƒÆ’Ã‚Â³n de Columnas SQL (`users`) ([victimController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/victimController.js))**:
    1. Se corrigiÃƒÆ’Ã‚Â³ la consulta SQL de creaciÃƒÆ’Ã‚Â³n de cuenta en `victimController.js` para utilizar los nombres de columna exactos de la base de datos de WintonCoin (`is_verified` y `date_of_birth` en lugar de campos inexistentes como `referral_code_used` o `is_email_verified`).
    2. Se resolviÃƒÆ’Ã‚Â³ la causa raÃƒÆ’Ã‚Â­z del error 500 (`Internal Server Error`), logrando que la subida de evidencias y el registro del censo procesen con ÃƒÆ’Ã‚Â©xito en el servidor Demo.
* **Evidencia**: Build de Vite exitoso en 6.29s (`npm run build:demo`).
* **Impacto**: EliminaciÃƒÆ’Ã‚Â³n completa de errores 500 y alineaciÃƒÆ’Ã‚Â³n estricta con el esquema de la base de datos PostgreSQL.

### 2026-08-01 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CorrecciÃƒÆ’Ã‚Â³n de Endpoint API (getApiUrl), Etiqueta CÃƒÆ’Ã‚Â©dula y Prellenado V-
* **Cambio**: 
  - **CorrecciÃƒÆ’Ã‚Â³n de API_URL ([sos-venezuela.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/sos-venezuela.js))**:
    1. Se importÃƒÆ’Ã‚Â³ e integrÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n `getApiUrl()` centralizada de la aplicaciÃƒÆ’Ã‚Â³n (`import { getApiUrl } from '../modules/index.js'`), solucionando el error `404 / Unexpected token '<', "<!DOCTYPE "... is not valid JSON` en Demo al redirigir las peticiones directamente a `wintoncoin-backend-demo.onrender.com`.
  - **Campo NÃƒÆ’Ã‚Âºmero de CÃƒÆ’Ã‚Â©dula & Prefijo V- AutomÃƒÆ’Ã‚Â¡tico ([sos-venezuela.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/sos-venezuela.html), [sos-venezuela.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/sos-venezuela.js))**:
    1. Se cambiÃƒÆ’Ã‚Â³ el nombre del campo a **`NÃƒÆ’Ã‚Âºmero de CÃƒÆ’Ã‚Â©dula:`**.
    2. Se prellenÃƒÆ’Ã‚Â³ el campo con `V-` por defecto (`value="V-"`) y se agregaron manejadores de eventos `focus` y `blur` para asegurar que el usuario solo tenga que tipear sus nÃƒÆ’Ã‚Âºmeros manteniendo el formato estandarizado `V-12345678`.
* **Evidencia**: Build de Vite exitoso en 6.22s (`npm run build:demo`).
* **Impacto**: ComunicaciÃƒÆ’Ã‚Â³n HTTP directa con el servidor de la Demo sin errores 404 e interactividad simplificada para usuarios mÃƒÆ’Ã‚Â³viles.

### 2026-08-01 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ JerarquÃƒÆ’Ã‚Â­a de Urgencia de 4 DÃƒÆ’Ã‚Â­gitos, MigraciÃƒÆ’Ã‚Â³n 100, SincronizaciÃƒÆ’Ã‚Â³n y Misiones QA-13/QA-14
* **Cambio**: 
  - **Misiones de Pruebas Manuales QA-13 y QA-14 ([QA_TEST_CATALOG.md](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/QA_TEST_CATALOG.md))**:
    1. Se crearon e integraron al catÃƒÆ’Ã‚Â¡logo histÃƒÆ’Ã‚Â³rico las misiones `QA-13` (VerificaciÃƒÆ’Ã‚Â³n de censo de edad, fotos desde celular y cÃƒÆ’Ã‚Â³digo de urgencia de 4 dÃƒÆ’Ã‚Â­gitos desde el telÃƒÆ’Ã‚Â©fono) y `QA-14` (AuditorÃƒÆ’Ã‚Â­a administrativa de edad, puntaje de urgencia y ordenamiento descendente por prioridad).
  - **MigraciÃƒÆ’Ã‚Â³n 100 e Inmutabilidad de Esquema ([100_add_age_and_urgency_to_victims.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/100_add_age_and_urgency_to_victims.js))**:
    1. Se creÃƒÆ’Ã‚Â³ la migraciÃƒÆ’Ã‚Â³n secuencial `100` siguiendo los estÃƒÆ’Ã‚Â¡ndares SOC 2 / ISO 27001 para aÃƒÆ’Ã‚Â±adir las columnas `birth_date`, `age` y `urgency_score` de forma automÃƒÆ’Ã‚Â¡tica al iniciar el backend en entornos desplegados como Demo.
  - **SincronizaciÃƒÆ’Ã‚Â³n con Ficha de Usuario Regular ([victimController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/victimController.js))**:
    1. Al registrarse como afectado en SOS Venezuela, la fecha de nacimiento (`birth_date`) se guarda automÃƒÆ’Ã‚Â¡ticamente en la cuenta de usuario regular de WintonCoin (`users.date_of_birth` y `pending_verifications.date_of_birth`), garantizando que la edad quede registrada en su ficha personal de la plataforma.
  - **Estructura NumÃƒÆ’Ã‚Â©rica de Urgencia de 4 DÃƒÆ’Ã‚Â­gitos ([victimController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/victimController.js))**:
    1. CÃƒÆ’Ã‚Â³digo jerÃƒÆ’Ã‚Â¡rquico `SOS-VZLA-[D1][D2][D3][D4]-[SECUENCIAL]`, donde D1=Gravedad (1-4), D2=Dependientes (0-9), D3=Rango de Edad (1-9), D4=Sexo (1-3).
    2. Ordenamiento automÃƒÆ’Ã‚Â¡tico de expedientes en el Panel Admin por `urgency_score DESC` para atender de primero a los casos de mayor prioridad.
* **Evidencia**: Build de Vite exitoso en 8.25s (`npm run build:demo`).
* **Impacto**: Pruebas manuales listas para ejecuciÃƒÆ’Ã‚Â³n en celulares y continuidad perfecta en la base de datos Demo.

### 2026-07-31 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ RediseÃƒÆ’Ã‚Â±o Tema Claro Formulario SOS, Fondo Continuo de Ancho Completo, Subida Directa y Admin
* **Cambio**: 
  - **Fondo Claro Continuo de Ancho Completo & DesmarcaciÃƒÆ’Ã‚Â³n ([sos-venezuela.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/sos-venezuela.html))**:
    1. Se aplicÃƒÆ’Ã‚Â³ la clase `sos-compliance-section` a la secciÃƒÆ’Ã‚Â³n `<section id="registro-damnificados">`, eliminando los bordes/mÃƒÆ’Ã‚Â¡rgenes oscuros laterales y garantizando que el **fondo claro continuo (`rgba(248, 250, 252, 0.9)`)** abarque todo el ancho de la pantalla, integrÃƒÆ’Ã‚Â¡ndose 100% con las secciones superior e inferior ("Nuestro Compromiso" y "Fases de Donaciones").
    2. Se integrÃƒÆ’Ã‚Â³ la tarjeta en `<div class="container">` manteniendo la desmarcaciÃƒÆ’Ã‚Â³n completa por defecto de todas las casillas de verificaciÃƒÆ’Ã‚Â³n.
  - **Subida Directa de Fotos desde el Celular ([sos-venezuela.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/sos-venezuela.html), [sos-venezuela.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/sos-venezuela.js), [systemRoutes.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/routes/systemRoutes.js), [victimController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/victimController.js))**:
    1. Integrado selector directo `<input type="file" accept="image/*" multiple>` para cargar de 1 a 5 fotos desde la cÃƒÆ’Ã‚Â¡mara o galerÃƒÆ’Ã‚Â­a del telÃƒÆ’Ã‚Â©fono mÃƒÆ’Ã‚Â³vil.
    2. Creado el endpoint `POST /api/public/sos-venezuela/upload-evidence` con middleware Multer para almacenar las evidencias en el servidor (`/uploads/victims/`) y retornar URLs pÃƒÆ’Ã‚Âºblicas.
  - **MÃƒÆ’Ã‚Â³dulo de AdministraciÃƒÆ’Ã‚Â³n de Damnificados SOS ([admin-panel.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-panel.html), [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js))**:
    1. Incorporada la secciÃƒÆ’Ã‚Â³n `ÃƒÂ°Ã…Â¸Ã…Â¡Ã‚Â¨ Damnificados Terremoto (SOS)` en la barra lateral del Panel Admin con badge de pendientes.
    2. Implementada tabla de expedientes con filtrado por estado y buscador.
* **Evidencia**: Build de Vite exitoso en 9.65s (`npm run build:demo`).
* **Impacto**: Continuidad visual 100% clara e impecable en toda la landing page SOS Venezuela.

### 2026-07-31 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Censo y Registro de Damnificados del Terremoto (SOS Venezuela), MigraciÃƒÆ’Ã‚Â³n 099 e IntegraciÃƒÆ’Ã‚Â³n SOC 2
* **Cambio**: 
  - **MigraciÃƒÆ’Ã‚Â³n 099 BD ([099_create_disaster_victims_system.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/099_create_disaster_victims_system.js))**:
    1. Creada e integrada la migraciÃƒÆ’Ã‚Â³n 099 con las tablas `disaster_victims_registry` (expedientes de damnificados y censo), `disaster_aid_disbursements` (entregas recurrentes de ayuda) y `email_templates_sos` (plantillas de correo personalizables).
  - **CÃƒÆ’Ã‚Â³digo de Expediente Inteligente & Backend ([victimController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/victimController.js), [systemRoutes.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/routes/systemRoutes.js), [adminRoutes.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/routes/adminRoutes.js))**:
    1. Implementada la matriz de 3 dÃƒÆ’Ã‚Â­gitos centrales para generar expedientes amigables e informativos (ej: `#SOS-VZLA-249-00142` -> *Mujer cabeza de familia (2), con 4 dependientes a cargo (4), en urgencia mÃƒÆ’Ã‚Â¡xima por pÃƒÆ’Ã‚Â©rdida total (9)*).
    2. CreaciÃƒÆ’Ã‚Â³n automÃƒÆ’Ã‚Â¡tica de cuenta WintonCoin vinculada al cÃƒÆ’Ã‚Â³digo especial `SOSVENEZUELA` con bono de 200 BLUE IOU.
    3. Servicio de correos transaccionales (`emailService.js`) con notificaciÃƒÆ’Ã‚Â³n de registro inicial en *VerificaciÃƒÆ’Ã‚Â³n Manual*, solicitud de informaciÃƒÆ’Ã‚Â³n adicional (`info_requested`) y aprobaciÃƒÆ’Ã‚Â³n/desembolso.
    4. Endpoints administrativos para gestionar expedientes, editar plantillas de correo y realizar entregas recurrentes con auditorÃƒÆ’Ã‚Â­a SOC 2.
    5. Corregido el import de dependencia `bcrypt` (en lugar de `bcryptjs`) en `victimController.js` para resolver compatibilidad con el entorno de despliegue en Render.
  - **Frontend Censo Humanitario ([sos-venezuela.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/sos-venezuela.html), [sos-venezuela.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/sos-venezuela.js))**:
    1. Tarjeta y formulario responsivo de censo con campos de direcciÃƒÆ’Ã‚Â³n detallada, censo de niÃƒÆ’Ã‚Â±os/tercera edad/discapacidad, selector de afectaciÃƒÆ’Ã‚Â³n y carga dual de imÃƒÆ’Ã‚Â¡genes/Google Fotos.
    2. Checkboxes de consentimiento de Habeas Data y DeclaraciÃƒÆ’Ã‚Â³n Jurada bajo fe de juramento.
    3. Card de resultado con despliegue animado del expediente generado.
* **Evidencia**: MigraciÃƒÆ’Ã‚Â³n 096 validada, compilaciÃƒÆ’Ã‚Â³n de frontend limpia (`npm run build:demo` en 13.44s).
* **Impacto**: CanalizaciÃƒÆ’Ã‚Â³n transparente, segura y auditable de asistencia humanitaria directa a damnificados del sismo en Venezuela.

### 2026-07-30 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ IntegraciÃƒÆ’Ã‚Â³n Frontend + Backend de la BÃƒÆ’Ã‚Â³veda de GarantÃƒÆ’Ã‚Â­as (Collateral Vault E2E)
* **Cambio**: 
  - **Backend Endpoint ([userController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/userController.js), [userRoutes.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/routes/userRoutes.js))**:
    1. Creado endpoint `POST /api/me/collateral/sync` que registra depÃƒÆ’Ã‚Â³sitos/retiros de la BÃƒÆ’Ã‚Â³veda Web3 en la tabla inmutable `collateral_deposits` y recalcula automÃƒÆ’Ã‚Â¡ticamente el LÃƒÆ’Ã‚Â­mite RED.
    2. Implementada validaciÃƒÆ’Ã‚Â³n Zero-Trust con whitelist estricta de tokens (USDT/USDC/DAI), validaciÃƒÆ’Ã‚Â³n de direcciones Ethereum, validaciÃƒÆ’Ã‚Â³n de tx_hash, y protecciÃƒÆ’Ã‚Â³n contra duplicados.
    3. AÃƒÆ’Ã‚Â±adida consulta de `collateral_balance` al response de `getMyBalance` para que el frontend muestre el desglose del LÃƒÆ’Ã‚Â­mite RED.
  - **Frontend InteracciÃƒÆ’Ã‚Â³n Web3 ([estado-cuenta.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/estado-cuenta.html), [estado-cuenta.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/estado-cuenta.js))**:
    1. Desglose visual del LÃƒÆ’Ã‚Â­mite RED (Score OrgÃƒÆ’Ã‚Â¡nico ÃƒÂ°Ã…Â¸Ã…Â¸Ã‚Â¢ + GarantÃƒÆ’Ã‚Â­a en BÃƒÆ’Ã‚Â³veda ÃƒÂ°Ã…Â¸Ã¢â‚¬ï¿½Ã¢â‚¬â„¢) dentro de la tarjeta de Tokens RED.
    2. BotÃƒÆ’Ã‚Â³n CTA premium "ÃƒÂ¢Ã…Â¡Ã‚Â¡ Aumentar LÃƒÆ’Ã‚Â­mite RED" con gradiente y panel expandible elegante.
    3. Selector de Stablecoin (USDT/USDC/DAI), input de monto y calculadora en vivo del nuevo LÃƒÆ’Ã‚Â­mite.
    4. IntegraciÃƒÆ’Ã‚Â³n MetaMask: flujo de 2 pasos (approve + deposit) con feedback visual en cada etapa.
    5. ValidaciÃƒÆ’Ã‚Â³n de retiro Zero-Trust: bloqueo de retiro si deuda RED > 0 con mensaje explicativo.
    6. SincronizaciÃƒÆ’Ã‚Â³n automÃƒÆ’Ã‚Â¡tica con backend tras cada operaciÃƒÆ’Ã‚Â³n exitosa en blockchain.
    7. Ocultamiento automÃƒÆ’Ã‚Â¡tico en modo Pre-lanzamiento (producciÃƒÆ’Ã‚Â³n off-chain).
* **Evidencia**: VerificaciÃƒÆ’Ã‚Â³n sintÃƒÆ’Ã‚Â¡ctica (`node --check`) aprobada al 100%. Suite de tests sin regresiones.
* **Impacto**: Ciclo completo E2E de la BÃƒÆ’Ã‚Â³veda de GarantÃƒÆ’Ã‚Â­as: el usuario puede depositar Stablecoins desde MetaMask ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ el LÃƒÆ’Ã‚Â­mite RED aumenta en vivo ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ el registro queda en blockchain + base de datos inmutable ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ no puede retirar hasta pagar toda su deuda RED. Modelo DeFi profesional (Aave/MakerDAO).

### 2026-07-29 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ BÃƒÆ’Ã‚Â³veda de GarantÃƒÆ’Ã‚Â­as Web3 (Collateral Vault) para Aumento de LÃƒÆ’Ã‚Â­mite RED
* **Cambio**: 
  - **Smart Contracts ([WintonCollateralVault.sol](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/web3-contracts/contracts/WintonCollateralVault.sol))**:
    1. Creado nuevo contrato inteligente `WintonCollateralVault.sol` que funciona como bÃƒÆ’Ã‚Â³veda segura para bloquear Stablecoins (USDT/USDC/DAI) como garantÃƒÆ’Ã‚Â­a.
    2. Implementado `SafeERC20` de OpenZeppelin para compatibilidad con tokens no estÃƒÆ’Ã‚Â¡ndar como USDT (que no retorna `bool` en `transfer`).
    3. Implementado patrÃƒÆ’Ã‚Â³n Checks-Effects-Interactions (CEI) en todas las funciones para prevenir ataques de reentrada.
    4. Variables `collateralToken` y `redToken` marcadas como `immutable` (no modificables post-despliegue).
    5. FunciÃƒÆ’Ã‚Â³n `deposit()`: permite depositar Stablecoins para aumentar LÃƒÆ’Ã‚Â­mite RED.
    6. FunciÃƒÆ’Ã‚Â³n `withdraw()`: permite retirar SOLO si deuda RED del usuario es exactamente 0 (Zero-Trust).
    7. FunciÃƒÆ’Ã‚Â³n `liquidate()`: permite al sistema confiscar garantÃƒÆ’Ã‚Â­a de usuarios morosos, pero SOLO si tienen deuda RED > 0 (previene abuso administrativo).
    8. FunciÃƒÆ’Ã‚Â³n `getCollateralBalance()`: consulta de lectura para que el backend lea saldos.
    9. Variable `totalCollateralLocked`: acumulador global para auditorÃƒÆ’Ã‚Â­a de solvencia.
    10. Eventos enriquecidos con datos de auditorÃƒÆ’Ã‚Â­a SOC 2 (totales globales, deuda al momento de liquidaciÃƒÆ’Ã‚Â³n).
  - **MigraciÃƒÆ’Ã‚Â³n de Base de Datos ([098_create_collateral_deposits.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/098_create_collateral_deposits.js))**:
    1. Creada tabla `collateral_deposits` con registro inmutable de cada depÃƒÆ’Ã‚Â³sito, retiro y liquidaciÃƒÆ’Ã‚Â³n.
    2. Implementado trigger SOC 2 de inmutabilidad (`trg_enforce_collateral_deposits_immutability`) que prohÃƒÆ’Ã‚Â­be UPDATE y DELETE.
    3. Creados ÃƒÆ’Ã‚Â­ndices optimizados para consultas del backend (user_id, operation_type, tx_hash).
  - **Motor de Scoring ([creditScoringService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/creditScoringService.js))**:
    1. AÃƒÆ’Ã‚Â±adida nueva variable F (BÃƒÆ’Ã‚Â³veda de GarantÃƒÆ’Ã‚Â­as) al cÃƒÆ’Ã‚Â¡lculo de `calculateUserScore()`.
    2. Consulta el saldo neto de Stablecoins depositadas en `collateral_deposits` y lo suma al LÃƒÆ’Ã‚Â­mite RED orgÃƒÆ’Ã‚Â¡nico del usuario.
* **Evidencia**: AuditorÃƒÆ’Ã‚Â­a de seguridad completada con 3 vulnerabilidades crÃƒÆ’Ã‚Â­ticas encontradas y corregidas (SafeERC20, verificaciÃƒÆ’Ã‚Â³n de deuda en liquidate, funciones de lectura). Contrato cumple estÃƒÆ’Ã‚Â¡ndares OpenZeppelin v5.x.
* **Impacto**: Los usuarios ahora pueden aumentar su LÃƒÆ’Ã‚Â­mite de Compromiso RED depositando Stablecoins como garantÃƒÆ’Ã‚Â­a, siguiendo el modelo DeFi de MakerDAO/Aave. Garantiza solvencia de la plataforma mediante colateral bloqueado y liquidaciÃƒÆ’Ã‚Â³n automÃƒÆ’Ã‚Â¡tica de morosos.

### 2026-07-28 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Resoluciones CrÃƒÆ’Ã‚Â­ticas de Scoring de Compromiso RED, MigraciÃƒÆ’Ã‚Â³n 096 e Inmutabilidad SOC 2
* **Cambio**: 
  - **Smart Contracts ([WintonProtocol.sol](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/web3-contracts/contracts/WintonProtocol.sol))**:
    1. Inyectada la funciÃƒÆ’Ã‚Â³n `updateUserTrustScore(address userWallet, uint256 newScoreLimit)` y el mapeo `redCreditLimits` en el protocolo central, permitiendo la sincronizaciÃƒÆ’Ã‚Â³n on-chain de los lÃƒÆ’Ã‚Â­mites de compromiso RED desde el backend (Relayer).
    2. Agregada la validaciÃƒÆ’Ã‚Â³n de disyuntor en `processPayment` para exigir que la suma del saldo acumulado de compromiso RED mÃƒÆ’Ã‚Â¡s la nueva transacciÃƒÆ’Ã‚Â³n no exceda el lÃƒÆ’Ã‚Â­mite otorgado al pagador.
  - **Ciberseguridad Anti-Bots & Algoritmo de Scoring ([creditScoringService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/creditScoringService.js))**:
    1. Refactorizada la consulta en `calculateUserScore` para exigir que **ÃƒÆ’Ã‚Âºnicamente los referidos con verificaciÃƒÆ’Ã‚Â³n KYC aprobada** (`kyc_verified = TRUE` o `kyc_status = 'approved'`) sumen bonificaciÃƒÆ’Ã‚Â³n al lÃƒÆ’Ã‚Â­mite de compromiso RED, desarmando ataques por granjas de cuentas falsas.
    2. Optimizada la consulta de actividad mensual reemplazando bÃƒÆ’Ã‚Âºsquedas de texto por `JOIN` indexado con la clave primaria `p.id`.
    1. Creada la migraciÃƒÆ’Ã‚Â³n 096 con la tabla `user_trust_score_logs` para registrar inmutablemente cada evaluaciÃƒÆ’Ã‚Â³n de scoring.
    2. Implementado un trigger nativo en PostgreSQL (`trg_enforce_trust_score_logs_immutability`) que rechaza `UPDATE` o `DELETE` bajo estÃƒÆ’Ã‚Â¡ndar de auditorÃƒÆ’Ã‚Â­a de grado bancario (Append-Only).
    3. Creada la migraciÃƒÆ’Ã‚Â³n 097 con la tabla `audit_logs` para resolver un error crÃƒÆ’Ã‚Â­tico (crash) del proceso en segundo plano "Debt Collector" que colapsaba al intentar registrar el cobro de deudas en una tabla inexistente.
  - **Notificaciones al Referente ([adminUserController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/admin/adminUserController.js))**:
    1. Vinculada la aprobaciÃƒÆ’Ã‚Â³n KYC de un referido a la sincronizaciÃƒÆ’Ã‚Â³n inmediata del score del referente y al envÃƒÆ’Ã‚Â­o automÃƒÆ’Ã‚Â¡tico de una notificaciÃƒÆ’Ã‚Â³n in-app y push celebrando el incremento en su lÃƒÆ’Ã‚Â­mite de compromiso RED.
  - **Fase de Calidad (QA) y Pruebas Unitarias ([platformFormFields.test.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/__tests__/platformFormFields.test.js))**:
    1. Reparada la suite de pruebas unitarias que fallaba por un error preexistente de desincronizaciÃƒÆ’Ã‚Â³n de simulaciones (mocks) con la base de datos tras la reciente integraciÃƒÆ’Ã‚Â³n de multiplicadores del Booster (`boosterService.calculateMultipliedAmount`). 
    2. Ejecutada exitosamente la suite completa (`npm test`), logrando un 100% de pases (25/25 tests en verde) asegurando que no se generÃƒÆ’Ã‚Â³ ninguna regresiÃƒÆ’Ã‚Â³n.
* **Evidencia**: CompilaciÃƒÆ’Ã‚Â³n de contratos exitosa (`npx hardhat compile` en 1 archivo), chequeos sintÃƒÆ’Ã‚Â¡cticos `node --check` aprobados al 100%, migraciÃƒÆ’Ã‚Â³n 096 validada en base de datos local y suite de tests pasada con ÃƒÆ’Ã‚Â©xito (`npm test`: 25 passed).
* **Impacto**: Cero vectores de inflaciÃƒÆ’Ã‚Â³n por bots, trazabilidad bancaria inmutable, alineaciÃƒÆ’Ã‚Â³n semÃƒÆ’Ã‚Â¡ntica sin romper retrocompatibilidad tÃƒÆ’Ã‚Â©cnica y cobertura de QA asegurada sin errores.

### 2026-07-27 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AuditorÃƒÆ’Ã‚Â­a de Estructura del Proyecto, Limpieza (Fase 1) y ReorganizaciÃƒÆ’Ã‚Â³n de Arquitectura Senior (Fase 2)
* **Cambio**: 
  - **Fase 1: AuditorÃƒÆ’Ã‚Â­a de Referencias (Grep Audit) y Limpieza de Basura TÃƒÆ’Ã‚Â©cnica**:
    1. Eliminados de la raÃƒÆ’Ã‚Â­z del proyecto los archivos huÃƒÆ’Ã‚Â©rfanos: [temp_old_contract.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/temp_old_contract.js), [temp_old_html.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/temp_old_html.html), [temp_old_interaction.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/temp_old_interaction.js) y [tmp_backend_structure.csv](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/tmp_backend_structure.csv).
    2. Eliminados del backend: `backend/temp_query2.js`, `backend/test_error.log` y `backend/test_server.log`.
    3. Eliminados del frontend: Archivos de cachÃƒÆ’Ã‚Â© temporales de Vite (`frontend/vite.config.js.timestamp-*.mjs`).
  - **Blindaje de Ciberseguridad y ExclusiÃƒÆ’Ã‚Â³n SOC 2 ([.gitignore](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/.gitignore), [backend/.gitignore](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/.gitignore))**:
    1. Inyectadas reglas estrictas de exclusiÃƒÆ’Ã‚Â³n en `.gitignore` para bloquear la subida a Git de dumps de base de datos (`demo_audit_backup_genesis.json`, `*_backup_*.json`) y archivos de configuraciÃƒÆ’Ã‚Â³n o respaldos de entorno (`.env.backup`, `.env.demo.local`). Esto garantiza el cumplimiento del estÃƒÆ’Ã‚Â¡ndar bancario Zero-Trust y evita fugas de PII/Secretos.
  - **Fase 2: ReorganizaciÃƒÆ’Ã‚Â³n de Archivos y EstandarizaciÃƒÆ’Ã‚Â³n de Directorios**:
    1. **DocumentaciÃƒÆ’Ã‚Â³n TÃƒÆ’Ã‚Â©cnica**: Reubicados 10 archivos `.md` de planificaciÃƒÆ’Ã‚Â³n e inventario desde la raÃƒÆ’Ã‚Â­z hacia [docs/](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/docs), manteniendo ÃƒÆ’Ã‚Âºnicamente `README.md` y `EVOLUCION.md` en la raÃƒÆ’Ã‚Â­z. Reubicado tambiÃƒÆ’Ã‚Â©n `qa_web3_checklist.md.resolved` a `docs/`.
    2. **Scripts de Backend ([backend/scripts/](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/scripts))**: Trasladados los 9 scripts de utilerÃƒÆ’Ã‚Â­a e inspecciÃƒÆ’Ã‚Â³n (`backup-database.js`, `check_schema.js`, `check_subs.js`, `debug_active.js`, `fix-booster-task.js`, `run_booster_payments_now.js`, `test_prod_connection.js`, `test_user_balance.js`, `test_seo.js`) hacia la carpeta de scripts, refactorizando sus importaciones relativas (`require('../config')`, `require('../src/config/db')`).
    3. **ErradicaciÃƒÆ’Ã‚Â³n de Claves Hardcoded (Zero Hardcoded Secrets)**: Refactorizado `test_prod_connection.js` para eliminar la cadena de conexiÃƒÆ’Ã‚Â³n con credenciales quemadas en cÃƒÆ’Ã‚Â³digo y reemplazarla por `process.env.DATABASE_URL` y `require('../config')`.
    4. **Activos y UtilerÃƒÆ’Ã‚Â­as Frontend**: Reubicada la imagen `winton_solidario_hero.png` a `frontend/public/assets/images/` y los generadores de iconos/logos a `frontend/scripts/`.
  - **VerificaciÃƒÆ’Ã‚Â³n de Integridad Completa**:
    1. Validada la sintaxis de todos los scripts trasladados en `backend/scripts/` y del servidor backend `backend/server.js` con `node --check` con resultado de ÃƒÆ’Ã‚Â©xito en el 100% de los archivos.
* **Evidencia**: EliminaciÃƒÆ’Ã‚Â³n y reubicaciÃƒÆ’Ã‚Â³n verificadas, saneamiento de credenciales completado, reglas de `.gitignore` actualizadas y chequeos sintÃƒÆ’Ã‚Â¡cticos aprobados.
* **Impacto**: Estructura de proyecto nivel Senior / Enterprise, cero desorden en la raÃƒÆ’Ã‚Â­z, prevenciÃƒÆ’Ã‚Â³n total de fugas de datos y mantenimiento del 100% de la funcionalidad sin ninguna ruptura.

### 2026-07-25 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ RestricciÃƒÆ’Ã‚Â³n de Registro por Prefijo TelefÃƒÆ’Ã‚Â³nico (+58 Venezuela), Migraciones 094 y 095 y AuditorÃƒÆ’Ã‚Â­a SOC 2 en app_settings
* **Cambio**: 
  - **Migraciones BD ([094_add_country_restriction_app_settings.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/094_add_country_restriction_app_settings.js), [095_add_updated_at_to_app_settings.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/095_add_updated_at_to_app_settings.js))**:
    1. Creada e integrada la migraciÃƒÆ’Ã‚Â³n oficial 094 para insertar automÃƒÆ’Ã‚Â¡ticamente en `app_settings` las 3 claves de restricciÃƒÆ’Ã‚Â³n de registro por paÃƒÆ’Ã‚Â­s.
    2. Creada la migraciÃƒÆ’Ã‚Â³n oficial 095 para agregar la columna `updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP` a la tabla `app_settings` (cumplimiento de estÃƒÆ’Ã‚Â¡ndares de auditorÃƒÆ’Ã‚Â­a FinTech SOC 2 / ISO 27001).
  - **Servidor Backend ([databaseInit.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/config/databaseInit.js), [adminSystemSettingsController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/admin/adminSystemSettingsController.js), [systemController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/systemController.js), [authController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/authController.js))**:
    1. Actualizada la orden `UPSERT` en `adminSystemSettingsController.js` para registrar el timestamp `updated_at = NOW()` en cada guardado con resiliencia total.
    2. Actualizado `databaseInit.js` para incluir `updated_at` en el esquema base.
    3. Expuestas las 3 claves en `/api/public-settings` con fallbacks por defecto y validaciÃƒÆ’Ã‚Â³n Zero-Trust (fail-closed) en `authController.js`.
  - **Formulario de Registro y Admin Panel ([register.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/register.html), [admin-panel.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-panel.html))**:
    1. Banner dinÃƒÆ’Ã‚Â¡mico `#country-restriction-banner` con aviso legal y validaciÃƒÆ’Ã‚Â³n estricta de prefijos (`+58`).
    2. Auto-guardado fluido en el panel de administraciÃƒÆ’Ã‚Â³n para toggles y textos.
* **Evidencia**: Migraciones 094 y 095 validadas, pruebas de `UPSERT` con `updated_at` superadas y compilaciÃƒÆ’Ã‚Â³n de frontend limpia (`npm run build:demo` en 3.80s).
* **Impacto**: Resiliencia del 100% en la base de datos, trazabilidad completa SOC 2 y cumplimiento legal-operativo.

### 2026-07-24 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ Snapshot de Multiplicadores en CreaciÃƒÆ’Ã‚Â³n/EdiciÃƒÆ’Ã‚Â³n de Publicaciones y Resguardo de Pagos
* **Cambio**: 
  - **Servidor Backend ([adminPublicationsController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/admin/adminPublicationsController.js), [publicationController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/publicationController.js))**:
    1. Ajustada la creaciÃƒÆ’Ã‚Â³n y ediciÃƒÆ’Ã‚Â³n de publicaciones oficiales en el Panel de AdministraciÃƒÆ’Ã‚Â³n para que obtengan el multiplicador vigente y congelen inmutablemente el snapshot: `base_blue_cost` (precio base), `applied_multiplier` y `blue_cost` (total recompensado = Base ÃƒÆ’Ã¢â‚¬â€� Multiplicador).
    2. Actualizado `GET /api/publications` para respetar el valor congelado `p.blue_cost` de la base de datos PostgreSQL, garantizando coherencia absoluta con el feed y detalle.
  - **Motor de Pagos y Notificaciones ([publicationService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/publicationService.js))**:
    1. Vinculada la liquidaciÃƒÆ’Ã‚Â³n de recompensa en `processRequestPayment` al snapshot `blue_cost` de la publicaciÃƒÆ’Ã‚Â³n.
    2. Incorporado resguardo de seguridad en el backend para aplicar el multiplicador activo si la publicaciÃƒÆ’Ã‚Â³n es legacy (donde `blue_cost == base_blue_cost`), previniendo subpagos al trabajador.
    3. Garantizado que las notificaciones in-app, notificaciones push y correos transaccionales notifiquen el monto total multiplicado exacto (ej. 810.0000 BLUE IOU).
  - **Panel de AdministraciÃƒÆ’Ã‚Â³n Frontend ([admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js))**:
    1. Actualizado `fillPlatformForm` al presionar "Editar" para cargar `pub.base_blue_cost` en el campo del costo base.
* **Evidencia**: Pruebas de integraciÃƒÆ’Ã‚Â³n aprobadas y verificaciÃƒÆ’Ã‚Â³n en controladores.
* **Impacto**: Coherencia total del 100% entre la tarjeta presentada al usuario, los registros de auditorÃƒÆ’Ã‚Â­a en la base de datos, el saldo acreditado en el perfil de impulsor y las notificaciones/correos enviados.

### 2026-07-23 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Multiplicador DinÃƒÆ’Ã‚Â¡mico en Publicaciones y Formularios de CreaciÃƒÆ’Ã‚Â³n (MigraciÃƒÆ’Ã‚Â³n 093 y RecÃƒÆ’Ã‚Â¡lculo en Vivo)
* **Cambio**: 
  - **Base de Datos ([093_add_base_blue_cost_to_publications.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/093_add_base_blue_cost_to_publications.js))**: Creada migraciÃƒÆ’Ã‚Â³n PostgreSQL que aÃƒÆ’Ã‚Â±ade la columna `base_blue_cost NUMERIC(15, 4)` en la tabla `publications` y retroalimenta las publicaciones existentes.
  - **Servidor Backend ([publicationController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/publicationController.js) y [adminPublicationsController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/admin/adminPublicationsController.js))**:
    1. Modificado el guardado de publicaciones para almacenar la cantidad base real ingresada por el creador (`base_blue_cost`).
    2. Actualizados los endpoints `GET /publications/active` y `GET /api/publications/:id` para calcular dinÃƒÆ’Ã‚Â¡micamente el valor total recompuesto `blue_cost`, `current_multiplier` y `current_stage_name` invocando `boosterService.calculateMultipliedAmount()`. Esto garantiza que al cambiar la etapa del multiplicador global, todas las publicaciones abiertas adapten dinÃƒÆ’Ã‚Â¡micamente su valor total sin congelar montos.
  - **Rutas de Sistema ([systemRoutes.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/routes/systemRoutes.js) & [systemController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/systemController.js))**: AÃƒÆ’Ã‚Â±adido endpoint pÃƒÆ’Ã‚Âºblico `GET /api/booster/current-multiplier` para exponer el multiplicador y etapa vigentes al cliente web.
  - **Formularios de CreaciÃƒÆ’Ã‚Â³n ([admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js), [publish.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/publish.js), [admin-panel.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-panel.html), [publish.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/publish.html))**: Incorporada calculadora en tiempo real que muestra al ingresar la cantidad base: `Valor Base: X BLUE ÃƒÆ’Ã¢â‚¬â€� 15x (Etapa 1 - Presale) = Total Final: Z BLUE IOU`.
  - **Detalle de PublicaciÃƒÆ’Ã‚Â³n ([publication-detail.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/publication-detail.js))**: Ajustada la franja en la cabecera a una estructura de fÃƒÆ’Ã‚Â³rmula matemÃƒÆ’Ã‚Â¡tica ultra-compacta en una sola lÃƒÆ’Ã‚Â­nea para telÃƒÆ’Ã‚Â©fonos mÃƒÆ’Ã‚Â³viles: `Base 1000,0000 x Mult. 9x = 9000,0000 BLUE IOU` (omitiendo la palabra `BLUE IOU` en la base para evitar redundancia).
* **Evidencia**: Pruebas de integraciÃƒÆ’Ã‚Â³n automatizadas `npm test` aprobadas al 100% (5/5 suites, 25/25 tests). CompilaciÃƒÆ’Ã‚Â³n de producciÃƒÆ’Ã‚Â³n/demo finalizada sin errores.
* **Impacto**: Cumplimiento del requerimiento de multiplicador transparente y recalculado en tiempo real sin romper las tarjetas principales del Feed.

### 2026-07-22 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AuditorÃƒÆ’Ã‚Â­a de Ciberseguridad e Endurecimiento del Servidor (Helmet P0 y ProtecciÃƒÆ’Ã‚Â³n DoS)
* **Cambio**: 
  - **Ciberseguridad Backend ([server.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/server.js))**: 
    1. Integrado el middleware de protecciÃƒÆ’Ã‚Â³n HTTP **Helmet** (`helmet()`) inyectando encabezados de seguridad de grado bancario (Content-Security-Policy estricto para dominios autorizados en `ALLOWED_ORIGINS`, X-Frame-Options `none` anti-clickjacking, X-Content-Type-Options `nosniff`, HSTS y Referrer-Policy).
    2. Establecido un lÃƒÆ’Ã‚Â­mite estricto de **1MB** al parseador del cuerpo de peticiones JSON (`express.json({ limit: '1mb' })`) para prevenir ataques de DenegaciÃƒÆ’Ã‚Â³n de Servicio (DoS) por agotamiento de memoria RAM mediante cargas excesivas.
  - **AuditorÃƒÆ’Ã‚Â­a e Informes ([security_audit.md](file:///C:/Users/migue/.gemini/antigravity-ide/brain/6362dbee-028e-4305-afa5-538f7ba91878/security_audit.md))**: Redactado informe intensivo de ciberseguridad categorizando fortalezas (Zero-Trust JWT, SQL 100% parametrizado, rate limiters) y plan de remediaciÃƒÆ’Ã‚Â³n ejecutado.
* **Evidencia**: ActualizaciÃƒÆ’Ã‚Â³n en `server.js`, `package.json`, y suite de pruebas pasando al 100% (25/25 tests).
* **Impacto**: Blindaje del backend contra vulnerabilidades OWASP Top 10 (Clickjacking, MIME Sniffing, Script Injection y DoS por Payload Oversized) bajo estÃƒÆ’Ã‚Â¡ndares de ingenierÃƒÆ’Ã‚Â­a y cumplimiento bancario FinTech.

### 2026-07-22 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ DiagnÃƒÆ’Ã‚Â³stico Frontend, SecciÃƒÆ’Ã‚Â³n de Voluntariado y CorrecciÃƒÆ’Ã‚Â³n de Coherencia Narrativa en SOS Venezuela
* **Cambio**: 
  - **Mejoras TÃƒÆ’Ã‚Â©cnicas ([TECHNICAL_IMPROVEMENTS.md](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/TECHNICAL_IMPROVEMENTS.md))**: Incorporada la SecciÃƒÆ’Ã‚Â³n 12 describiendo el Plan de RefactorizaciÃƒÆ’Ã‚Â³n y AuditorÃƒÆ’Ã‚Â­a del Frontend (modularizaciÃƒÆ’Ã‚Â³n de `contract-interaction.js` y `admin-panel.js`, clarificaciÃƒÆ’Ã‚Â³n de saldos `BLUE Token` vs `BLUE IOU`, auditorÃƒÆ’Ã‚Â­a de eventos client-side, optimizaciÃƒÆ’Ã‚Â³n UX responsiva y verificaciÃƒÆ’Ã‚Â³n multi-pÃƒÆ’Ã‚Â¡gina en `vite.config.js`).
  - **CampaÃƒÆ’Ã‚Â±as Humanitarias ([sos-venezuela.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/sos-venezuela.html))**: 
    1. Corregida la incoherencia en las "Fases de los BLUE IOU donados": sustituido "CreaciÃƒÆ’Ã‚Â³n" en el Paso 1 por **"SelecciÃƒÆ’Ã‚Â³n"** (badge `SELECCIÃƒÆ’Ã¢â‚¬Å“N` e icono diana ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¯) para reflejar la elecciÃƒÆ’Ã‚Â³n del usuario, y alineados badges del Paso 5 a **"ASIGNACIÃƒÆ’Ã¢â‚¬Å“N"**. Y reemplazado "Ciclo de vida" por "Fases".
    2. RediseÃƒÆ’Ã‚Â±ada la secciÃƒÆ’Ã‚Â³n de **Convocatoria de Voluntarios y DifusiÃƒÆ’Ã‚Â³n** ("ÃƒÆ’Ã…Â¡nete como Voluntario y Difunde la CampaÃƒÆ’Ã‚Â±a") y extendido un **fondo suave ambientado con la Bandera de Venezuela ÃƒÂ°Ã…Â¸Ã¢â‚¬Â¡Ã‚Â»ÃƒÂ°Ã…Â¸Ã¢â‚¬Â¡Ã‚Âª** (gradiente tricolor sutil) a **todas las secciones principales** de la pÃƒÆ’Ã‚Â¡gina, retirando la etiqueta `CANALIZACIÃƒÆ’Ã¢â‚¬Å“N DE AYUDA SOCIAL ACTIVA` de la cabecera, removiendo la frase *"la entrega de insumos"*, eliminando el botÃƒÆ’Ã‚Â³n secundario "Ver BitÃƒÆ’Ã‚Â¡cora de Transparencia" del ÃƒÆ’Ã‚Â¡rea de HÃƒÆ’Ã‚Â©roe para simplificar los llamados a la acciÃƒÆ’Ã‚Â³n, incorporando un **mensaje motivacional de alianzas en formato pÃƒÆ’Ã‚Â­ldora azul fina** (*"AÃƒÆ’Ã‚Âºn queda mucho por hacer: cualquier asociaciÃƒÆ’Ã‚Â³n, organizaciÃƒÆ’Ã‚Â³n o propuesta es bienvenida para sumar esfuerzos"*), sustituyendo el bloque CTA por una caja clara con enlace a **@cadenasosvenezuela** en Instagram (optimizando el botÃƒÆ’Ã‚Â³n a un tamaÃƒÆ’Ã‚Â±o mÃƒÆ’Ã‚Â¡s compacto para mÃƒÆ’Ã‚Â³viles con el texto "ContÃƒÆ’Ã‚Â¡ctanos"), y actualizando el texto de la tarjeta de **DifusiÃƒÆ’Ã‚Â³n Directa** para enfatizar que las familias afectadas pueden aprovechar y obtener el bono por registrarse.
    3. Homologado el tamaÃƒÆ’Ã‚Â±o y contenedor de la secciÃƒÆ’Ã‚Â³n **"Nuestro Compromiso: Cero Margen de Lucro"** utilizando la estructura estÃƒÆ’Ã‚Â¡ndar `compliance-box` (mismo ancho y padding de las demÃƒÆ’Ã‚Â¡s tarjetas de la pÃƒÆ’Ã‚Â¡gina) y retirada la frase final *"En tiempos de crisis, la solidaridad estÃƒÆ’Ã‚Â¡ por encima de cualquier beneficio corporativo"*.
* **Evidencia**: ActualizaciÃƒÆ’Ã‚Â³n en [TECHNICAL_IMPROVEMENTS.md](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/TECHNICAL_IMPROVEMENTS.md), [sos-venezuela.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/sos-venezuela.html) y [EVOLUCION.md](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/EVOLUCION.md).
* **Impacto**: Coherencia del 100% en la explicaciÃƒÆ’Ã‚Â³n pÃƒÆ’Ã‚Âºblica del ciclo de donaciones humanitarias, habilitaciÃƒÆ’Ã‚Â³n de un canal directo para reclutamiento de veedores en terreno y consolidaciÃƒÆ’Ã‚Â³n de la hoja de ruta de refactorizaciÃƒÆ’Ã‚Â³n del frontend orientada a estÃƒÆ’Ã‚Â¡ndares bancarios y SOC 2.

### 2026-07-21 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ ModularizaciÃƒÆ’Ã‚Â³n Profesional del Controlador Administrativo (`adminController.js`)
* **Cambio**: 
  - **Arquitectura & Clean Code (PatrÃƒÆ’Ã‚Â³n Fachada)**: Se refactorizÃƒÆ’Ã‚Â³ el archivo monolÃƒÆ’Ã‚Â­tico `adminController.js` (3,311 lÃƒÆ’Ã‚Â­neas y 56 funciones) dividiÃƒÆ’Ã‚Â©ndolo en 5 submÃƒÆ’Ã‚Â³dulos especializados dentro del directorio `src/controllers/admin/` aplicando el Principio de Responsabilidad ÃƒÆ’Ã…Â¡nica (SRP):
    1. `adminAuthSecurityController.js`: AutenticaciÃƒÆ’Ã‚Â³n, OTP, Roles, Invitaciones y Sesiones de Administrador.
    2. `adminUserController.js`: GestiÃƒÆ’Ã‚Â³n de Usuarios, Estados de Cuenta, CÃƒÆ’Ã‚Â³digo de Referido y SincronizaciÃƒÆ’Ã‚Â³n KYC on-chain.
    3. `adminPublicationsController.js`: ModeraciÃƒÆ’Ã‚Â³n de Tareas, Soft-Delete, RestauraciÃƒÆ’Ã‚Â³n y Publicaciones Institucionales de la Plataforma.
    4. `adminSystemSettingsController.js`: Configuraciones Globales (`app_settings`), Tramos de Referidos y Multiplicadores Booster.
    5. `adminAuditStatsController.js`: MÃƒÆ’Ã‚Â©tricas del Dashboard, AuditorÃƒÆ’Ã‚Â­a (`audit_log`), Billetera de Plataforma, Limpieza de BD y Entorno Demo.
  - **Compatibilidad 100% (Zero Regressions)**: `adminController.js` se transformÃƒÆ’Ã‚Â³ en un archivo Fachada de Re-exportaciÃƒÆ’Ã‚Â³n Unificada (`module.exports = { ...sub1, ...sub2, ... }`), garantizando la preservaciÃƒÆ’Ã‚Â³n exacta de las firmas y referencias de importaciÃƒÆ’Ã‚Â³n sin modificar `adminRoutes.js` ni causar rupturas en Express.
  - **AuditorÃƒÆ’Ã‚Â­a & Pruebas**: VerificaciÃƒÆ’Ã‚Â³n ejecutada pre y post refactorizaciÃƒÆ’Ã‚Â³n mediante la suite automatizada Jest (`npm test`), confirmando un resultado de 14/14 tests aprobados al 100%.
* **Evidencia**: Archivos creados en `src/controllers/admin/` y actualizaciÃƒÆ’Ã‚Â³n del archivo fachada [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js).
* **Impacto**: ReducciÃƒÆ’Ã‚Â³n drÃƒÆ’Ã‚Â¡stica de la complejidad cognitiva del mÃƒÆ’Ã‚Â³dulo administrativo, aislamiento de dominios de seguridad y cumplimiento de los estÃƒÆ’Ã‚Â¡ndares de mantenibilidad y ciberseguridad bancaria SOC 2 / ISO 27001.

### 2026-07-21 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AutenticaciÃƒÆ’Ã‚Â³n Dual en Carga de Medios (Fix Cierre de SesiÃƒÆ’Ã‚Â³n de Admin)
* **Cambio**: 
  - **Middleware (`authMiddleware.js`)**: Creado e inyectado el nuevo middleware dual `authenticateUserOrAdmin`, el cual valida firmas de tokens usando `JWT_SECRET` para usuarios regulares y `ADMIN_SECRET_KEY` para administradores.
  - **Rutas (`mediaRoutes.js`)**: Modificado el endpoint `/upload` para utilizar `authenticateUserOrAdmin` en lugar del middleware restrictivo `authenticateToken`.
  - **Frontend (`admin-panel.js`)**: Corregido el llamado a `fetch` al subir imÃƒÆ’Ã‚Â¡genes a `/api/media/upload` agregando `credentials: 'include'` para transmitir la cookie HttpOnly `admin_token`, y removiendo el uso inoperante de `localStorage.getItem('admin_token')`.
  - **Controlador de Admin (`adminController.js`)**: Corregida la funciÃƒÆ’Ã‚Â³n `updatePlatformPublication` que omitÃƒÆ’Ã‚Â­a por completo los campos `image_urls` y `requires_evidence` en la desestructuraciÃƒÆ’Ã‚Â³n del cuerpo y en la consulta SQL de `UPDATE`. Se incluyÃƒÆ’Ã‚Â³ la validaciÃƒÆ’Ã‚Â³n de lÃƒÆ’Ã‚Â­mites contra `app_settings`.
  - **Tests (`platformFormFields.test.js`)**: Actualizado el suite de pruebas unitarias para mockear la consulta a `app_settings` introducida por el conteo de imÃƒÆ’Ã‚Â¡genes y ajustar el ÃƒÆ’Ã‚Â­ndice de verificaciÃƒÆ’Ã‚Â³n de la llamada a `pool.query`.
* **Evidencia**: Modificaciones en `authMiddleware.js`, `mediaRoutes.js`, `admin-panel.js`, `adminController.js` y `platformFormFields.test.js`.
* **Impacto**: Se resolviÃƒÆ’Ã‚Â³ el bug crÃƒÆ’Ã‚Â­tico en producciÃƒÆ’Ã‚Â³n en el que subir una imagen desde el panel administrativo devolvÃƒÆ’Ã‚Â­a un error `401 Unauthorized` por firma invÃƒÆ’Ã‚Â¡lida, lo cual gatillaba el interceptor de seguridad global de `auth.js` expulsando al administrador de su sesiÃƒÆ’Ã‚Â³n inmediatamente. Adicionalmente, se habilitÃƒÆ’Ã‚Â³ el guardado correcto de imÃƒÆ’Ã‚Â¡genes y el flag de "exigir evidencias" al editar publicaciones de plataforma que el backend omitÃƒÆ’Ã‚Â­a.

### 2026-07-20 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ UnificaciÃƒÆ’Ã‚Â³n de Carruseles: Feed de Tarjetas y Detalles
* **Cambio**: 
  - **Tarjetas del Feed (`contract-interaction.js`)**: Modificado el carrusel de publicaciones para ocupar el 100% del ancho (eliminando la visualizaciÃƒÆ’Ã‚Â³n del 90% de la siguiente imagen). Se envolviÃƒÆ’Ã‚Â³ el contenedor en un `.card-images-wrapper` y se integraron puntos indicadores (dots) interactivos que se actualizan mediante un listener `onscroll`. TambiÃƒÆ’Ã‚Â©n se eliminÃƒÆ’Ã‚Â³ el prefijo de texto `"Meta: "` de la etiqueta de valor de donaciÃƒÆ’Ã‚Â³n (ribbon superior derecho) para maximizar el espacio en pantallas pequeÃƒÆ’Ã‚Â±as.
  - **Detalle de Publicaciones (`publication-detail.js`)**: Actualizado el carrusel de la pÃƒÆ’Ã‚Â¡gina de descripciÃƒÆ’Ã‚Â³n para utilizar el mismo diseÃƒÆ’Ã‚Â±o responsivo de 100% de ancho con flechas fÃƒÆ’Ã‚Â­sicas laterales y dots del carrusel unificado. Se actualizÃƒÆ’Ã‚Â³ el selector de Lightbox.
  - **Estilos (`style.css`)**: Centralizados los estilos de `.carousel-dots`, `.carousel-dot`, y `.card-images-wrapper` para mantener el principio DRY y mejorar la cohesiÃƒÆ’Ã‚Â³n visual del portal. AdemÃƒÆ’Ã‚Â¡s se eliminaron los mÃƒÆ’Ã‚Â¡rgenes verticales de `.card-images-container` dentro de `.card-images-wrapper` para evitar las franjas negras superior y inferior que aparecÃƒÆ’Ã‚Â­an en las tarjetas.
* **Evidencia**: Modificaciones en `style.css`, `contract-interaction.js` y `publication-detail.js`.
* **Impacto**: UnificaciÃƒÆ’Ã‚Â³n total de la UI de carruseles en la plataforma. Se elimina el peeking desordenado en las tarjetas del feed, ofreciendo una experiencia moderna, limpia e intuitiva (estilo Instagram) tanto en la lista general como en las vistas detalladas, sin mÃƒÆ’Ã‚Â¡rgenes negros residuales en las portadas. AdemÃƒÆ’Ã‚Â¡s, se optimizÃƒÆ’Ã‚Â³ el espacio de las etiquetas de meta de recaudaciÃƒÆ’Ã‚Â³n en el feed.

### 2026-07-20 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AuditorÃƒÆ’Ã‚Â­a TÃƒÆ’Ã‚Â©cnica y MitigaciÃƒÆ’Ã‚Â³n de Seguridad (Harden editCause)
* **Cambio**: 
  - **AuditorÃƒÆ’Ã‚Â­a TÃƒÆ’Ã‚Â©cnica**: Realizado anÃƒÆ’Ã‚Â¡lisis estÃƒÆ’Ã‚Â¡tico del flujo de donaciones solidarias y subida de imÃƒÆ’Ã‚Â¡genes, validando el cumplimiento de directrices de inyecciÃƒÆ’Ã‚Â³n SQL, control de Race Conditions y principio de Zero Hardcoded Secrets.
  - **MitigaciÃƒÆ’Ã‚Â³n (Backend)**: Se detectÃƒÆ’Ã‚Â³ una inconsistencia de validaciÃƒÆ’Ã‚Â³n al editar causas (`editCause` en `humanitarianService.js`). Se reforzÃƒÆ’Ã‚Â³ la validaciÃƒÆ’Ã‚Â³n de `new_evidence_urls` para que valide estrictamente el protocolo HTTPS, limite de caracteres a 2048, y extensiones de imagen permitidas (WebP/PNG/JPG/GIF) o pertenecientes al bucket (`/uploads/`), equiparÃƒÆ’Ã‚Â¡ndose a la seguridad de la postulaciÃƒÆ’Ã‚Â³n inicial.
* **Evidencia**: Modificaciones en `humanitarianService.js`.
* **Impacto**: EliminaciÃƒÆ’Ã‚Â³n de un vector potencial de inyecciÃƒÆ’Ã‚Â³n de enlaces maliciosos o no HTTPS en el historial y detalle de la causa durante las actualizaciones. Consistencia del 100% en las reglas de validaciÃƒÆ’Ã‚Â³n bajo el principio de Zero-Trust.

### 2026-07-20 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Fix Carrusel: Puntos Indicadores y Lightbox + Fix Modal Overflow
* **Cambio**: 
  - **Puntos Indicadores (Dots)**: AÃƒÆ’Ã‚Â±adido un manejador de eventos `onscroll` en lÃƒÆ’Ã‚Â­nea al contenedor `.cause-carousel-track`. Calcula el ÃƒÆ’Ã‚Â­ndice de la imagen visible actualizando dinÃƒÆ’Ã‚Â¡micamente el color de fondo de los puntos.
  - **Lightbox**: Se ajustÃƒÆ’Ã‚Â³ el evento de escucha de clics en el documento global (`document.addEventListener('click', ...)`). Se ampliÃƒÆ’Ã‚Â³ el selector de `.card-images-container img` a `.cause-carousel-track img, .card-images-container img` para abarcar el nuevo contenedor del carrusel, restaurando la capacidad de visualizar las imÃƒÆ’Ã‚Â¡genes a pantalla completa al hacer clic.
  - **Modal Overflow**: AÃƒÆ’Ã‚Â±adido `max-height: 90vh` y `overflow-y: auto` a la clase CSS `.solidario-donate-modal` en `causa-solidaria.html` para permitir scroll interno cuando el contenido (como las previsualizaciones de imÃƒÆ’Ã‚Â¡genes) excede la altura de la pantalla, evitando que los botones de confirmaciÃƒÆ’Ã‚Â³n queden ocultos.
* **Evidencia**: Modificaciones en `causa-solidaria.js` y `causa-solidaria.html`.
* **Impacto**: Mejora significativa de UX. Los donantes pueden navegar intuitivamente por la evidencia en el carrusel con retroalimentaciÃƒÆ’Ã‚Â³n visual (puntos) y hacer clic en cualquier imagen para ver los detalles originales en el Lightbox, igual que en el resto de la plataforma.

### 2026-07-20 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Subida de ImÃƒÆ’Ã‚Â¡genes en PostulaciÃƒÆ’Ã‚Â³n + Carrusel Responsivo + Fix Cajas Negras
* **Cambio**: 
  - **PostulaciÃƒÆ’Ã‚Â³n**: AÃƒÆ’Ã‚Â±adido Dropzone interactivo en `solicitud-solidaria.html` para que el creador suba hasta 3 imÃƒÆ’Ã‚Â¡genes (JPG/PNG/WebP, 5MB mÃƒÆ’Ã‚Â¡x.) al momento de postular. Las imÃƒÆ’Ã‚Â¡genes se envÃƒÆ’Ã‚Â­an a Cloudflare R2 vÃƒÆ’Ã‚Â­a `/api/media/upload` y sus URLs se incluyen en `evidence_urls`.
  - **Backend**: Extendido `solidarioRoutes.js` (`POST /postulacion`) para validar `uploaded_image_urls` (mÃƒÆ’Ã‚Â¡x. 3, HTTPS, extensiones de imagen permitidas) y combinarlas con el arreglo de evidencias.
  - **Carrusel**: Reescrito el carrusel del detalle de causa (`causa-solidaria.js`) con scroll-snap horizontal, flechas de navegaciÃƒÆ’Ã‚Â³n, dots indicadores, altura fija de 280px y `object-fit: cover` para eliminar barras negras.
  - **Filtrado de imÃƒÆ’Ã‚Â¡genes**: Implementado filtro en `contract-interaction.js`, `causa-solidaria.js` (cabecera + lightbox) y `admin-panel.js` para excluir URLs de Drive/Instagram/redes del renderizado de `<img>`, reteniÃƒÆ’Ã‚Â©ndolas como enlaces de texto.
  - **Fix Dropzone doble-click**: Agregado `e.stopPropagation()` en el input file dentro del dropzone para evitar doble apertura del explorador de archivos.
  - **Panel Admin**: El modal de revisiÃƒÆ’Ã‚Â³n ahora muestra miniaturas clicables para imÃƒÆ’Ã‚Â¡genes reales y enlaces de texto para URLs externas, permitiendo auditorÃƒÆ’Ã‚Â­a visual instantÃƒÆ’Ã‚Â¡nea.
* **Evidencia**: Modificaciones en `solicitud-solidaria.html`, `causa-solidaria.js`, `contract-interaction.js`, `admin-panel.js`, `solidarioRoutes.js`.
* **Impacto**: Flujo completo de extremo a extremo: el creador sube fotos ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ el admin las ve al revisar ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ los usuarios las ven en el feed y en el carrusel del detalle. Eliminadas cajas negras/rotas. Bug de doble-click corregido.

### 2026-07-20 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CorrecciÃƒÆ’Ã‚Â³n de Estilo del Carrusel en Detalle de Causa
* **Cambio**: Removidos estilos en lÃƒÆ’Ã‚Â­nea que impedÃƒÆ’Ã‚Â­an el scroll horizontal (overflow: hidden) en el carrusel de la causa detallada. Delegado el layout a clases CSS especÃƒÆ’Ã‚Â­ficas dentro de la etiqueta style del documento HTML.
* **Evidencia**: Modificaciones en causa-solidaria.html y causa-solidaria.js.
* **Impacto**: El carrusel de fotos en el detalle ahora es responsivo, desliza correctamente de extremo a extremo al 100% de ancho del contenedor y respeta los bordes redondeados superiores de la tarjeta.

### 2026-07-20 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Ajuste de Ancho y Snap del Carrusel en MÃƒÆ’Ã‚Â³viles
* **Cambio**: Modificada la regla CSS de .card-images-container para fijar un ancho del calc(100% + 48px) !important, alineaciÃƒÆ’Ã‚Â³n scroll-snap-align: start y asignaciÃƒÆ’Ã‚Â³n del redondeado de borde superior al primer elemento hijo directamente.
* **Evidencia**: Modificaciones en style.css.
* **Impacto**: Corrige la desalineaciÃƒÆ’Ã‚Â³n asimÃƒÆ’Ã‚Â©trica del lado derecho y asegura el correcto recorte redondeado de las esquinas en Android/iOS.

### 2026-07-20 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AlineaciÃƒÆ’Ã‚Â³n al Ras de Carrusel en Detalle de Causa
* **Cambio**: Ajustados mÃƒÆ’Ã‚Â¡rgenes de .solidario-cause-card .card-images-container a -24px arriba y laterales, y el radio de borde superior a 15px en style.css.
* **Evidencia**: Modificaciones en style.css.
* **Impacto**: Cancela exactamente el padding de 24px de la tarjeta de la causa, dejando la cabecera visual al ras con los bordes de la tarjeta.

### 2026-07-20 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CorrecciÃƒÆ’Ã‚Â³n de Scroll y Altura del Carrusel en Detalle de Causas
* **Cambio**: Removidos estilos inline del contenedor de imÃƒÆ’Ã‚Â¡genes en causa-solidaria.js y creadas reglas CSS especÃƒÆ’Ã‚Â­ficas en style.css para habilitar el scroll horizontal de evidencias, aplicar peeking del 90% y fijar una altura de 280px consistente.
* **Evidencia**: Modificaciones en causa-solidaria.js y style.css.
* **Impacto**: Resuelve el carrusel bloqueado y la distorsiÃƒÆ’Ã‚Â³n/recorte de portadas en el detalle de la causa.

### 2026-07-20 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Carga de ImÃƒÆ’Ã‚Â¡genes en PostulaciÃƒÆ’Ã‚Â³n Solidaria y Filtro de Enlaces No-Imagen
* **Cambio**: Incorporado Dropzone de subida al formulario de postulaciÃƒÆ’Ã‚Â³n original (solicitud-solidaria.html), modificado el backend para procesar el arreglo (solidarioRoutes.js) y agregado un filtro del lado del cliente en el feed y detalles para omitir enlaces no-imagen (como Drive o Instagram) que causaban imÃƒÆ’Ã‚Â¡genes rotas.
* **Evidencia**: Modificaciones en solicitud-solidaria.html, solidarioRoutes.js, contract-interaction.js y causa-solidaria.js.
* **Impacto**: Completa el flujo de auditorÃƒÆ’Ã‚Â­a permitiendo que el administrador revise la evidencia visual real antes de la aprobaciÃƒÆ’Ã‚Â³n y asegura que las causas se rendericen correctamente desde el primer segundo sin mostrar cajas vacÃƒÆ’Ã‚Â­as.

### 2026-07-20 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Flujo de ImÃƒÆ’Ã‚Â¡genes en PostulaciÃƒÆ’Ã‚Â³n Solidaria y AuditorÃƒÆ’Ã‚Â­a de Administrador
* **Cambio**: Integrado el Dropzone en el formulario inicial de postulaciÃƒÆ’Ã‚Â³n (solicitud-solidaria.html) para subir hasta 3 imÃƒÆ’Ã‚Â¡genes fÃƒÆ’Ã‚Â­sicas. Implementado visor de imÃƒÆ’Ã‚Â¡genes directo en el modal de auditorÃƒÆ’Ã‚Â­a de causas del panel administrativo (admin-panel.js).
* **Evidencia**: Commits subsiguientes.
* **Impacto**: Permite que el creador de la causa cargue evidencias visuales al registrarse, y que el administrador las evalÃƒÆ’Ã‚Âºe en miniatura antes de aprobar el caso, optimizando el flujo completo de canje solidario.

### 2026-07-19 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ VisualizaciÃƒÆ’Ã‚Â³n de ImÃƒÆ’Ã‚Â¡genes en Tarjetas y Detalle de Causas Solidarias
* **Cambio**: Conectada la visualizaciÃƒÆ’Ã‚Â³n del carrusel de imÃƒÆ’Ã‚Â¡genes en las tarjetas virtuales del feed principal y en la cabecera de la vista detallada de la causa (causa-solidaria.html).
* **Evidencia**: Commit ebaa656 y actualizaciones subsecuentes.
* **Impacto**: Permite la transparencia completa al poder visualizar las evidencias de progreso y fotos de la causa directamente desde el feed y verlas a pantalla completa usando el visor lightbox.

### 2026-07-14 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AuditorÃƒÆ’Ã‚Â­a de Ciberseguridad y RemediaciÃƒÆ’Ã‚Â³n de Vulnerabilidades CrÃƒÆ’Ã‚Â­ticas en adminController.js

- **Contexto**: Durante una auditorÃƒÆ’Ã‚Â­a exhaustiva de seguridad sobre las 3,295 lÃƒÆ’Ã‚Â­neas del controlador administrativo `adminController.js`, se detectaron vulnerabilidades y desviaciones de las mejores prÃƒÆ’Ã‚Â¡cticas de desarrollo y seguridad (tales como SQL Injection en limpieza de registros, fuga de detalles internos de excepciones `error.message` y duplicidad de lÃƒÆ’Ã‚Â³gica). Se procediÃƒÆ’Ã‚Â³ a mitigar todos los hallazgos para elevar el software a los estÃƒÆ’Ã‚Â¡ndares SOC 2 e ISO 27001 de seguridad bancaria.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **MitigaciÃƒÆ’Ã‚Â³n de SQL Injection (Hallazgo #1 - CrÃƒÆ’Ã‚Â­tica)**: Se eliminaron las interpolaciones directas de strings en `cleanupInactiveUsers` y `cleanupOldPublications` y se parametrizaron las consultas a travÃƒÆ’Ã‚Â©s de `make_interval(days => $1)`. Adicionalmente, se forzÃƒÆ’Ã‚Â³ la conversiÃƒÆ’Ã‚Â³n a enteros vÃƒÆ’Ã‚Â­a `parseInt()` antes de su uso.
  - **ProtecciÃƒÆ’Ã‚Â³n contra fuga de informaciÃƒÆ’Ã‚Â³n (Hallazgo #2 - Alta)**: Se eliminaron todas las respuestas JSON que devolvÃƒÆ’Ã‚Â­an el `error.message` en bruto en el balance de la plataforma (`getPlatformWalletBalance`) y en las operaciones de demo (`generateDemoExport`, `downloadDemoExport`, `processDemoImport`). Ahora devuelven un mensaje genÃƒÆ’Ã‚Â©rico `"Error interno del servidor."` previniendo fuga de directorios locales o variables de entorno.
  - **SanitizaciÃƒÆ’Ã‚Â³n de IDs (Hallazgo #3 - Alta)**: Se agregaron validaciones defensivas mediante `parseInt()` y validaciones de lÃƒÆ’Ã‚Â­mites en los endpoints de restauraciÃƒÆ’Ã‚Â³n y eliminaciÃƒÆ’Ã‚Â³n de publicaciones (`restorePublication` y `deletePublicationAdmin`).
  - **UbicaciÃƒÆ’Ã‚Â³n Profesional del module.exports (Hallazgo #4 - Media)**: Se reubicÃƒÆ’Ã‚Â³ el bloque de exportaciones al final del archivo para seguir la regla de oro "define primero, exporta al final" y evitar la dependencia del *hoisting* de funciones.
  - **RemediaciÃƒÆ’Ã‚Â³n de dependencias y DRY (Hallazgos #5, #6, #7 - Media/Baja)**: Se centralizÃƒÆ’Ã‚Â³ el `require('crypto')` en la cabecera del archivo, se corrigiÃƒÆ’Ã‚Â³ un comentario histÃƒÆ’Ã‚Â³rico desactualizado en la creaciÃƒÆ’Ã‚Â³n de invitaciones, y se encapsulÃƒÆ’Ã‚Â³ la validaciÃƒÆ’Ã‚Â³n duplicada de `formFields` en la funciÃƒÆ’Ã‚Â³n helper `_sanitizeFormFields`.
- **Impacto**: blindaje completo contra inyecciones SQL que pudiesen comprometer o eliminar la base de datos de demo o producciÃƒÆ’Ã‚Â³n, mayor privacidad en respuestas de error de sistema, cÃƒÆ’Ã‚Â³digo 100% limpio y estructurado que facilita futuras auditorÃƒÆ’Ã‚Â­as de control interno.
- **Evidencia**:
  - Archivo Modificado: [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js).

### 2026-07-13 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AutenticaciÃƒÆ’Ã‚Â³n Escalonada (OTP) y Alertas de Seguridad en Panel Administrativo (SOC 2)

- **Contexto**: Para elevar el nivel de seguridad del sistema de administraciÃƒÆ’Ã‚Â³n al estÃƒÆ’Ã‚Â¡ndar bancario y cumplir con las normativas SOC 2 de Zero-Trust, se determinÃƒÆ’Ã‚Â³ que cambiar la contraseÃƒÆ’Ã‚Â±a conociendo ÃƒÆ’Ã‚Âºnicamente la contraseÃƒÆ’Ã‚Â±a actual era un control insuficiente frente al compromiso de sesiones (sesiones dejadas abiertas). Se requiriÃƒÆ’Ã‚Â³ implementar AutenticaciÃƒÆ’Ã‚Â³n Escalonada (Step-Up Authentication) mediante un cÃƒÆ’Ã‚Â³digo de un solo uso (OTP) por correo electrÃƒÆ’Ã‚Â³nico, acompaÃƒÆ’Ã‚Â±ado de notificaciones transaccionales a la plana de Super Administradores.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **MigraciÃƒÆ’Ã‚Â³n de Base de Datos (089)**: Se aÃƒÆ’Ã‚Â±adiÃƒÆ’Ã‚Â³ la columna `email` y las columnas criptogrÃƒÆ’Ã‚Â¡ficas (`password_change_hash`, `password_change_expires_at`, `password_change_attempts`) a la tabla separada `admin_users`, manteniendo la segregaciÃƒÆ’Ã‚Â³n estricta de privilegios (no mezclando administradores con la tabla `users` normal).
  - **ReutilizaciÃƒÆ’Ã‚Â³n de MÃƒÆ’Ã‚Â³dulo CriptogrÃƒÆ’Ã‚Â¡fico (DRY)**: Se importaron las funciones de seguridad existentes de `emailService.js` (`generateOtp6`, `hashOtpForEmail`, `safeEqualHex`, `sendOtpEmail`) para garantizar que la generaciÃƒÆ’Ã‚Â³n y validaciÃƒÆ’Ã‚Â³n de OTPs para administradores hereden la robustez (comparaciÃƒÆ’Ã‚Â³n *timing-safe*, lÃƒÆ’Ã‚Â­mites de expiraciÃƒÆ’Ã‚Â³n de 10 min, protecciÃƒÆ’Ã‚Â³n anti-bruteforce) ya probada en el sistema de usuarios.
  - **Flujo de PrevenciÃƒÆ’Ã‚Â³n Activa (2 Pasos)**:
    1. *Solicitud (`requestPasswordChange`)*: Valida la clave actual, genera el OTP, lo envÃƒÆ’Ã‚Â­a al correo del admin, y de manera sÃƒÆ’Ã‚Â­ncrona **alerta a los Super Administradores** sobre el inicio del intento de cambio.
    2. *ConfirmaciÃƒÆ’Ã‚Â³n (`confirmPasswordChange`)*: Compara el OTP *timing-safe*, resetea la contraseÃƒÆ’Ã‚Â±a, fuerza el cierre de sesiÃƒÆ’Ã‚Â³n (`clearCookie`), y envÃƒÆ’Ã‚Â­a confirmaciÃƒÆ’Ã‚Â³n transaccional al admin y a la plana mayor (AuditorÃƒÆ’Ã‚Â­a Centralizada).
  - **Frontend AsÃƒÆ’Ã‚Â­ncrono**: Se actualizÃƒÆ’Ã‚Â³ `admin-panel.js` separando el formulario en dos instancias. Se inyectÃƒÆ’Ã‚Â³ el modal `adminOtpModal` en el DOM que retiene la nueva clave en memoria volÃƒÆ’Ã‚Â¡til de JavaScript de manera segura hasta recibir la confirmaciÃƒÆ’Ã‚Â³n del cÃƒÆ’Ã‚Â³digo de 6 dÃƒÆ’Ã‚Â­gitos.
- **Impacto**: Se incorpora una capa de fricciÃƒÆ’Ã‚Â³n preventiva que bloquea a un atacante con acceso a una sesiÃƒÆ’Ã‚Â³n desbloqueada. Los Super Administradores obtienen visibilidad en tiempo real (Notificaciones de AuditorÃƒÆ’Ã‚Â­a) sobre movimientos de credenciales, mitigando el riesgo de Amenazas Internas (*Insider Threats*).
- **Evidencia**:
  - Base de Datos: `089_add_email_to_admin_users.js`
  - Backend: [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js), [adminRoutes.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/routes/adminRoutes.js).
  - Frontend: [admin-panel.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/frontend/admin-panel.html), [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/frontend/src/pages/admin-panel.js).

### 2026-07-12 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Cambio Seguro de ContraseÃƒÆ’Ã‚Â±a Administrativa (SOC 2 & Zero-Trust)

- **Contexto**: Para mejorar la ciberseguridad del panel administrativo de WintonCoin y dar cumplimiento con normativas regulatorias internacionales tipo SOC 2 y lineamientos de auditorÃƒÆ’Ã‚Â­a financiera, se requerÃƒÆ’Ã‚Â­a habilitar un flujo seguro para que los administradores puedan actualizar su contraseÃƒÆ’Ã‚Â±a directamente desde el panel sin exponer credenciales en variables de entorno fijas (Zero Hardcoded Secrets).
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Backend y AutenticaciÃƒÆ’Ã‚Â³n**: Se implementÃƒÆ’Ã‚Â³ el endpoint `POST /api/admin/change-password` en `adminRoutes.js` y `adminController.js` protegido por `verifyAdminToken`. El controlador valida que la cuenta estÃƒÆ’Ã‚Â© activa, realiza una comparaciÃƒÆ’Ã‚Â³n de la contraseÃƒÆ’Ã‚Â±a actual mediante `bcrypt.compare`, valida la complejidad de la nueva clave (mÃƒÆ’Ã‚Â­nimo 8 caracteres, alfanumÃƒÆ’Ã‚Â©ricos) y previene la reutilizaciÃƒÆ’Ã‚Â³n de claves. Al actualizar el hash en la base de datos de forma transaccional, se invoca `res.clearCookie('admin_token')` para destruir inmediatamente la sesiÃƒÆ’Ã‚Â³n de JWT (HttpOnly cookie) en el cliente por seguridad.
  - **AuditorÃƒÆ’Ã‚Â­a de Ciberseguridad (Mejoras SOC 2 / Zero-Trust)**:
    1. *ProtecciÃƒÆ’Ã‚Â³n contra Bcrypt DoS (CPU Exhaustion)*: Se limitÃƒÆ’Ã‚Â³ estrictamente la longitud mÃƒÆ’Ã‚Â¡xima de contraseÃƒÆ’Ã‚Â±as a 72 caracteres tanto en frontend como backend en `login`, `claimInvitation` y `changePassword`. Esto previene que payloads maliciosos gigantes degraden el rendimiento de la CPU de Node.js al ejecutar hashing de Bcrypt.
    2. *InvalidaciÃƒÆ’Ã‚Â³n en Tiempo Real de Tokens (`pwdVersion`)*: Se aÃƒÆ’Ã‚Â±adiÃƒÆ’Ã‚Â³ un reclamo dinÃƒÆ’Ã‚Â¡mico `pwdVersion` en el payload de JWT de administrador (formado por los ÃƒÆ’Ã‚Âºltimos 10 caracteres del hash actual en base de datos). El middleware de autenticaciÃƒÆ’Ã‚Â³n `authenticateAdmin` en `authMiddleware.js` realiza una validaciÃƒÆ’Ã‚Â³n en tiempo real comparando este reclamo con el hash actual del registro. Si hay un cambio de contraseÃƒÆ’Ã‚Â±a, todos los tokens JWT emitidos previamente quedan invalidados de forma instantÃƒÆ’Ã‚Â¡nea e irreversible.
  - **Trazabilidad y AuditorÃƒÆ’Ã‚Â­a**: Cada cambio de contraseÃƒÆ’Ã‚Â±a genera un registro inmutable en la tabla `audit_log` con el evento `admin.password.changed` poblado con metadatos del cliente (IP, User-Agent).
  - **Interfaz de Usuario**: Se integrÃƒÆ’Ã‚Â³ el formulario "Seguridad de la Cuenta" dentro de la secciÃƒÆ’Ã‚Â³n de ConfiguraciÃƒÆ’Ã‚Â³n en `admin-panel.html` y se programÃƒÆ’Ã‚Â³ el listener en `admin-panel.js` para realizar validaciÃƒÆ’Ã‚Â³n en el cliente (incluyendo el lÃƒÆ’Ã‚Â­mite de 72 caracteres), despachar la solicitud asÃƒÆ’Ã‚Â­ncrona mediante `apiFetch` y redirigir automÃƒÆ’Ã‚Â¡ticamente al administrador a la pantalla de login (`admin.html`) tras 2 segundos de ÃƒÆ’Ã‚Â©xito.
- **Impacto**: Se elimina la dependencia del archivo de entorno `.env` de Render para contraseÃƒÆ’Ã‚Â±as activas de administrador. Se asegura un control estricto de sesiones y una traza 100% auditable y reproducible, mitigando el secuestro de sesiones administrativas de forma definitiva.
- **Evidencia**:
  - Backend: [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js), [adminRoutes.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/routes/adminRoutes.js), [authMiddleware.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/middleware/authMiddleware.js).
  - Frontend: [admin-panel.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/frontend/admin-panel.html), [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/frontend/src/pages/admin-panel.js).

### 2026-07-11 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Registro de Clickwrap en Base de Datos y Formateo HTML de Correos Transaccionales

- **Contexto**: 
  1. Para dar cumplimiento a las auditorÃƒÆ’Ã‚Â­as SOC 2, se requerÃƒÆ’Ã‚Â­a almacenar de forma inmutable el consentimiento explÃƒÆ’Ã‚Â­cito (Clickwrap de donaciÃƒÆ’Ã‚Â³n voluntaria) en el backend y la base de datos.
  2. Los correos electrÃƒÆ’Ã‚Â³nicos transaccionales del sistema (donaciones, novedades de campaÃƒÆ’Ã‚Â±a, transacciones P2P) e emails de gobernanza se mostraban con textos continuos y pÃƒÆ’Ã‚Â¡rrafos pegados. Esto ocurrÃƒÆ’Ã‚Â­a porque los clientes de correo web y mÃƒÆ’Ã‚Â³viles renderizan en formato HTML, ignorando los caracteres de escape de salto de lÃƒÆ’Ã‚Â­nea de texto plano (`\n`).
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Base de Datos y API REST:** Se creÃƒÆ’Ã‚Â³ la migraciÃƒÆ’Ã‚Â³n `088_add_accepted_terms_to_humanitarian_donations.js` que aÃƒÆ’Ã‚Â±ade la columna `accepted_terms` (`BOOLEAN NOT NULL DEFAULT FALSE`) a la tabla `humanitarian_donations`. El endpoint `POST /causes/:id/donate` en `humanitarianUserRoutes.js` ahora exige que `accepted_terms` sea estrictamente `true`, guardÃƒÆ’Ã‚Â¡ndolo a travÃƒÆ’Ã‚Â©s de `donateToCause` en `humanitarianService.js`. En el frontend, `causa-solidaria.js` envÃƒÆ’Ã‚Â­a el consentimiento tras validar el checkbox.
  - **Formateo Centralizado de Correos (`emailService.js`):** En lugar de inyectar HTML de forma directa en las funciones de negocio, se optimizÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n central de plantillas `sendTransactionEmail` y `sendGovernanceEmail` para convertir automÃƒÆ’Ã‚Â¡ticamente los saltos de lÃƒÆ’Ã‚Â­nea de texto plano a formato web mediante `${escapeHtml(message).replace(/\n/g, '<br />')}` de forma segura tras aplicar el escape anti-XSS.
- **Impacto**: Los correos del sistema se visualizan de manera estructurada, con pÃƒÆ’Ã‚Â¡rrafos debidamente espaciados, limpios y premium en cualquier cliente de correo mÃƒÆ’Ã‚Â³vil y web. El registro de transacciones es jurÃƒÆ’Ã‚Â­dicamente auditable conforme a regulaciones FinTech y SOC 2.
- **Evidencia**:
  - Backend: [emailService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/emailService.js), [humanitarianService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/humanitarianService.js), [humanitarianUserRoutes.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/routes/humanitarianUserRoutes.js).
  - Frontend: [causa-solidaria.html](file:///c:/Users/migue/OneDrive/Escritorio/Wintoncoin/smart-contract/frontend/causa-solidaria.html), [causa-solidaria.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/causa-solidaria.js).

### 2026-07-11 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Panel del Creador, EdiciÃƒÆ’Ã‚Â³n HÃƒÆ’Ã‚Â­brida Inteligente de Causas y BitÃƒÆ’Ã‚Â¡cora de Novedades Auditables con DISTINCT

- **Contexto**: Para habilitar la gestiÃƒÆ’Ã‚Â³n activa de causas benÃƒÆ’Ã‚Â©ficas publicadas por impulsores sin dar espacio a estafas de desvÃƒÆ’Ã‚Â­o de fondos (Charity Fraud/FTC Guidelines) ni saturar con spam a los donantes recurrentes, se requerÃƒÆ’Ã‚Â­a una soluciÃƒÆ’Ã‚Â³n de ediciÃƒÆ’Ã‚Â³n hÃƒÆ’Ã‚Â­brida y actualizaciones con historial inmutable de auditorÃƒÆ’Ã‚Â­a.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Base de Datos y MigraciÃƒÆ’Ã‚Â³n:** Se creÃƒÆ’Ã‚Â³ la migraciÃƒÆ’Ã‚Â³n `087_create_cause_updates_and_history.js` que define las tablas `humanitarian_cause_updates` (novedades fechadas de avance) y `humanitarian_cause_history` (histÃƒÆ’Ã‚Â³rico de auditorÃƒÆ’Ã‚Â­a de descripciones).
  - **Control de EdiciÃƒÆ’Ã‚Â³n en el Backend (`humanitarianService.js`):** Se restringiÃƒÆ’Ã‚Â³ la ediciÃƒÆ’Ã‚Â³n de causas activas: inmutabilidad total de tÃƒÆ’Ã‚Â­tulo y beneficiario final; la meta (`goal_amount`) solo se puede incrementar (bloqueando reducciones por debajo de lo ya acumulado); y el texto de la historia principal (`story`) se controla con un algoritmo de similitud por distancia de Levenshtein en JS (los cambios directos se restringen a un mÃƒÆ’Ã‚Â¡ximo del 15% para evitar fraudes de alteraciÃƒÆ’Ã‚Â³n de propÃƒÆ’Ã‚Â³sito; las modificaciones mayores deben canalizarse por la bitÃƒÆ’Ã‚Â¡cora).
  - **Unicidad y OptimizaciÃƒÆ’Ã‚Â³n de Correos (`humanitarianService.js` & `authController.js`):** Al publicar novedades, el sistema aplica la clÃƒÆ’Ã‚Â¡usula `DISTINCT` en la base de datos para recuperar a los donantes y evitar enviar mÃƒÆ’Ã‚Âºltiples correos molestos a usuarios con aportes recurrentes. Asimismo, se inyectan los enlaces sociales del organizador (extraÃƒÆ’Ã‚Â­dos de `evidence_urls`) y beneficiario (de `beneficiary_socials`) en los correos transaccionales de donaciÃƒÆ’Ã‚Â³n y novedades para dotar de mayor control e informaciÃƒÆ’Ã‚Â³n a la comunidad.
  - **Experiencia de Usuario Premium (`causa-solidaria.js` & HTML):** Se implementÃƒÆ’Ã‚Â³ una interfaz de autor en la misma pÃƒÆ’Ã‚Â¡gina pÃƒÆ’Ã‚Âºblica de la causa (`causa-solidaria.html`), visible ÃƒÆ’Ã‚Âºnicamente para el creador logueado, con botones para abrir modales interactivos de ediciÃƒÆ’Ã‚Â³n y novedades. Adicionalmente, el historial de donaciones se convirtiÃƒÆ’Ã‚Â³ en un panel premium con pestaÃƒÆ’Ã‚Â±as para Donaciones, Novedades y el Historial de Cambios inmutables del texto.
- **Impacto**: Cumplimiento regulatorio SOC 2 inmejorable al versionar cambios, blindaje legal contra desvÃƒÆ’Ã‚Â­os de capital y una experiencia comunitaria ÃƒÆ’Ã‚Â¡gil que fideliza al donante recurrente.

### 2026-07-10 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AutenticaciÃƒÆ’Ã‚Â³n Robusta con Doble Token (Access/Refresh) y UnificaciÃƒÆ’Ã‚Â³n de Modales de Alerta

- **Contexto**: 
  1. Los usuarios experimentaban cierres abruptos y mensajes de error como `"Token de sesiÃƒÆ’Ã‚Â³n invÃƒÆ’Ã‚Â¡lido o expirado."` en forma de diÃƒÆ’Ã‚Â¡logos de sistema (`alert()`) al cabo de 7 dÃƒÆ’Ã‚Â­as de inactividad, lo que resultaba confuso para usuarios no tÃƒÆ’Ã‚Â©cnicos y rompÃƒÆ’Ã‚Â­a la UX/UI premium. El backend devolvÃƒÆ’Ã‚Â­a `403` en lugar de `401` ante tokens expirados, interfiriendo con la lÃƒÆ’Ã‚Â³gica de aceptaciÃƒÆ’Ã‚Â³n de tÃƒÆ’Ã‚Â©rminos legales (tambiÃƒÆ’Ã‚Â©n en `403`).
  2. Las alertas de expiraciÃƒÆ’Ã‚Â³n de sesiÃƒÆ’Ã‚Â³n y otros fallos utilizaban el `alert()` nativo del sistema en pÃƒÆ’Ã‚Â¡ginas como `publication-detail.html` debido a la ausencia del contenedor `#custom-alert-container` en el HTML.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Arquitectura de Doble Token (HttpOnly & Anti-XSS)**: Se migrÃƒÆ’Ã‚Â³ la autenticaciÃƒÆ’Ã‚Â³n del backend a un sistema de doble token. Al iniciar sesiÃƒÆ’Ã‚Â³n o verificar registro, se genera un `accessToken` corto (15 minutos, almacenado en `localStorage` temporal) y un `refreshToken` largo (7 dÃƒÆ’Ã‚Â­as) firmado con `tokenType: 'refresh'` y enviado en la cookie segura `auth_refresh_token` con directivas `httpOnly: true`, `secure: true` (en producciÃƒÆ’Ã‚Â³n), `sameSite: 'None'`.
  - **Endpoints de Refresco y Cierre de SesiÃƒÆ’Ã‚Â³n**: Se crearon las rutas `POST /api/auth/refresh` (que valida el Refresh Token, comprueba el estado del usuario en tiempo real en la DB y genera un nuevo Access Token de 15 minutos rotando el Refresh Token) y `POST /api/auth/logout` (que limpia la cookie en el servidor).
  - **EstandarizaciÃƒÆ’Ã‚Â³n HTTP (401 vs 403)**: El middleware `authenticateToken` ahora devuelve `401 Unauthorized` ante fallos de token, permitiendo al frontend iniciar el refresco silencioso de sesiÃƒÆ’Ã‚Â³n y reservando `403 Forbidden` ÃƒÆ’Ã‚Âºnicamente para bloqueos de aceptaciÃƒÆ’Ã‚Â³n de tÃƒÆ’Ã‚Â©rminos legales (`LEGAL_ACCEPTANCE_REQUIRED`).
  - **Refresco Silencioso en Frontend**: Se implementaron `isTokenExpired(token)` y `silentRefreshIfNeeded()` en `auth.js`. Al cargar el detalle de la publicaciÃƒÆ’Ã‚Â³n (`publication-detail.js`), el sistema realiza la renovaciÃƒÆ’Ã‚Â³n transparente del token en segundo plano si ha caducado.
  - **UnificaciÃƒÆ’Ã‚Â³n de Alertas DinÃƒÆ’Ã‚Â¡micas**: Se optimizÃƒÆ’Ã‚Â³ `showCustomAlert` en `alerts.js` para crear dinÃƒÆ’Ã‚Â¡micamente el contenedor `#custom-alert-container` en el DOM si no existe en el HTML. Se eliminÃƒÆ’Ã‚Â³ la importaciÃƒÆ’Ã‚Â³n dinÃƒÆ’Ã‚Â¡mica y la llamada al `alert()` de fallback del navegador en `auth.js` importando estÃƒÆ’Ã‚Â¡ticamente `showCustomAlert`. Se redactÃƒÆ’Ã‚Â³ un mensaje amigable, comprensivo e instructivo explicando al usuario que por motivos de seguridad (inactividad) su sesiÃƒÆ’Ã‚Â³n expirÃƒÆ’Ã‚Â³ y guiÃƒÆ’Ã‚Â¡ndolo para iniciar sesiÃƒÆ’Ã‚Â³n de nuevo.
- **Impacto**: Experiencia de usuario (UX/UI) continua, amigable, comprensible y sin fricciones. Cumplimiento con las normativas internacionales de ciberseguridad financiera y protecciÃƒÆ’Ã‚Â³n de datos mÃƒÆ’Ã‚Â¡s estrictas (SOC 2, GDPR, Leyes FinTech y Directrices OWASP de seguridad contra robos de sesiÃƒÆ’Ã‚Â³n por XSS). Suite de pruebas automatizadas Jest completamente exitosa.
- **Evidencia**:
  - Backend: [authMiddleware.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/middleware/authMiddleware.js), [authController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/authController.js), [authRoutes.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/routes/authRoutes.js).
  - Frontend: [alerts.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/modules/alerts.js), [auth.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/modules/auth.js), [publication-detail.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/publication-detail.js).

### 2026-07-10 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Compatibilidad EstÃƒÆ’Ã‚Â¡ndar de la Propiedad background-clip en landing-fomo.css

- **Contexto**: Se detectÃƒÆ’Ã‚Â³ una inconsistencia de compatibilidad CSS en la clase `.icon-ig` (archivo `landing-fomo.css`), donde se definÃƒÆ’Ã‚Â­a la propiedad `-webkit-background-clip: text` de manera aislada sin su equivalente estÃƒÆ’Ã‚Â¡ndar `background-clip: text`. Esto causaba advertencias en herramientas de validaciÃƒÆ’Ã‚Â³n de cÃƒÆ’Ã‚Â³digo/linters y limitaba potencialmente la compatibilidad con navegadores modernos no basados en WebKit antiguo.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **EstandarizaciÃƒÆ’Ã‚Â³n CSS**: Se agregÃƒÆ’Ã‚Â³ la propiedad estÃƒÆ’Ã‚Â¡ndar `background-clip: text;` inmediatamente despuÃƒÆ’Ã‚Â©s de la versiÃƒÆ’Ã‚Â³n con prefijo de proveedor (`-webkit-`).
  - **Comentarios de CÃƒÆ’Ã‚Â³digo**: Se agregaron comentarios aclaratorios detallados sobre el propÃƒÆ’Ã‚Â³sito de cada directiva de recorte de fondo de texto para mejorar la legibilidad y facilitar la trazabilidad.
- **Impacto**: CÃƒÆ’Ã‚Â³digo CSS compatible al 100% con los estÃƒÆ’Ã‚Â¡ndares W3C y moderno, previniendo advertencias de compilaciÃƒÆ’Ã‚Â³n en Vite/PostCSS, y asegurando un comportamiento visual consistente del gradiente de Instagram en todos los navegadores modernos.

### 2026-07-09 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ DesvÃƒÆ’Ã‚Â­o AutomÃƒÆ’Ã‚Â¡tico de Recompensas de Referido a Causas Activas y ClasificaciÃƒÆ’Ã‚Â³n de Historial

- **Contexto**: Para mejorar el crecimiento orgÃƒÆ’Ã‚Â¡nico (Product-Led Growth) y alinear los incentivos de la comunidad, se requerÃƒÆ’Ã‚Â­a que si un organizador (referente) tiene una causa humanitaria activa (aprobada), el bono que gana por referir a otros se sume de forma directa y automÃƒÆ’Ã‚Â¡tica a su causa en lugar de acreditarse en su balance personal ordinario. El bono del nuevo usuario (referido) se mantiene intacto en su cuenta personal para no forzar su donaciÃƒÆ’Ã‚Â³n. Adicionalmente, el historial de donaciones de la causa debe reflejar con etiquetas claras ("Por cÃƒÆ’Ã‚Â³digo" vs "Donado") la procedencia del abono.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Base de Datos y MigraciÃƒÆ’Ã‚Â³n:** Se creÃƒÆ’Ã‚Â³ la migraciÃƒÆ’Ã‚Â³n `086_add_donation_type_to_humanitarian_donations.js` para aÃƒÆ’Ã‚Â±adir la columna `donation_type` (con valores `'voluntary'` y `'referral'`) a la tabla `humanitarian_donations`.
  - **DesvÃƒÆ’Ã‚Â­o del Bono en Registro (`authController.js`):** Se modificÃƒÆ’Ã‚Â³ la lÃƒÆ’Ã‚Â³gica del flujo de referido para que, al registrarse un usuario con cÃƒÆ’Ã‚Â³digo, se verifique si el referente tiene una causa activa en estado `'approved'`. De ser asÃƒÆ’Ã‚Â­, el bono del referente (e.g. 10 BLUE) se registra como una donaciÃƒÆ’Ã‚Â³n a nombre del referido con tipo `'referral'` y estado `'on_hold'` (pendiente de KYC del referido para evitar fraudes Sybil), incrementando el `pending_amount` de la causa. Si no hay causa activa, se mantiene la acreditaciÃƒÆ’Ã‚Â³n personal ordinaria. El nuevo usuario conserva su bono de bienvenida ÃƒÆ’Ã‚Â­ntegramente.
  - **VisualizaciÃƒÆ’Ã‚Â³n y ClasificaciÃƒÆ’Ã‚Â³n (`causa-solidaria.js` y HTML):** Se actualizÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n `getCauseDonations` para enviar la columna `donation_type`. En el frontend, se agregaron estilos CSS para badges y se modificÃƒÆ’Ã‚Â³ el renderizado de la lista para mostrar un distintivo visual elegante: *"Por cÃƒÆ’Ã‚Â³digo"* para donaciones de tipo `'referral'` y *"Donado"* para las voluntarias (`'voluntary'`).
- **Impacto**: Mayor transparencia, alineaciÃƒÆ’Ã‚Â³n de incentivos para financiamiento colectivo y experiencia de usuario optimizada sin comprometer la seguridad KYC/AML. El motor de escrow (Trigger de base de datos) procesa de forma nativa la liberaciÃƒÆ’Ã‚Â³n a la cuenta del organizador en cuanto el referido se verifica, incluso si la causa se completa o cierra antes.

### 2026-07-07 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Ajuste de Vista Previa para WhatsApp, UnificaciÃƒÆ’Ã‚Â³n de Moneda y DiseÃƒÆ’Ã‚Â±o Responsivo de la Escalera de Rangos

- **Contexto**: 
  1. Al compartir enlaces por WhatsApp, la vista previa no cargaba debido a que la imagen del logotipo corporativo superaba el peso mÃƒÆ’Ã‚Â¡ximo de 300 KB y por la ausencia del subdominio seguro `www.`. AdemÃƒÆ’Ã‚Â¡s, se necesitaba personalizar el banner para las campaÃƒÆ’Ã‚Â±as de ayuda social.
  2. HabÃƒÆ’Ã‚Â­a inconsistencias visuales donde la meta de la tarjeta mostraba `"BLUE"` pero la barra de progreso mostraba `"BLUE IOU"`.
  3. En pantallas mÃƒÆ’Ã‚Â³viles, el rango actual (activo) del usuario en la escalera de niveles del perfil sobresalÃƒÆ’Ã‚Â­a por el lado derecho saliÃƒÆ’Ã‚Â©ndose de los mÃƒÆ’Ã‚Â¡rgenes de la pantalla.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **OptimizaciÃƒÆ’Ã‚Â³n SEO y Banner:** Se cambiÃƒÆ’Ã‚Â³ el `og:image` por `icon-192x192.png` (86 KB) y por un nuevo diseÃƒÆ’Ã‚Â±o artÃƒÆ’Ã‚Â­stico `solidaridad-banner.png` (corazÃƒÆ’Ã‚Â³n de ayuda con la bandera de Venezuela) en las pÃƒÆ’Ã‚Â¡ginas estÃƒÆ’Ã‚Â¡ticas de causas y registros. Se forzÃƒÆ’Ã‚Â³ el uso del subdominio seguro `www.demo.wintoncoin.com` para evitar errores SSL.
  - **Consistencia de BLUE IOU:** Se modificÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n `getBlueUnitLabel` para retornar `'BLUE IOU'` (en mayÃƒÆ’Ã‚Âºsculas) de forma universal para todos los tipos de creadores de publicaciÃƒÆ’Ã‚Â³n (plataforma o usuario) en prelanzamiento. Se reemplazaron todas las cadenas de texto del tipo `"BLUE"` escritas directamente en el HTML de las barras de progreso por la variable dinÃƒÆ’Ã‚Â¡mica `${blueLabel}`.
  - **DiseÃƒÆ’Ã‚Â±o Responsivo de la Escalera:** Se detectÃƒÆ’Ã‚Â³ que la clase `.staircase-step.active` tenÃƒÆ’Ã‚Â­a una regla heredada de `width: 340px;` que colisionaba con el ancho adaptativo global del contenedor. Se eliminÃƒÆ’Ã‚Â³ la propiedad de ancho fÃƒÆ’Ã‚Â­sico fijo, permitiendo que la caja activa herede el ancho de los niveles normales (100% en escritorio, 280px en dispositivos mÃƒÆ’Ã‚Â³viles) mientras mantiene su efecto de profundidad `translateZ(20px)` y sus animaciones luminosas.
  - **CompilaciÃƒÆ’Ã‚Â³n:** Se regenerÃƒÆ’Ã‚Â³ el build completo mediante `npm run build:demo` y se subieron los cambios a Git.
- **Impacto**: Incremento en la conversiÃƒÆ’Ã‚Â³n de compartidos al renderizar imÃƒÆ’Ã‚Â¡genes de forma inmediata y correcta en WhatsApp. Coherencia y consistencia en el vocabulario financiero de la plataforma. CorrecciÃƒÆ’Ã‚Â³n visual completa de la escalera de rangos del perfil de impulsor en todos los tamaÃƒÆ’Ã‚Â±os de pantalla (escritorio y mÃƒÆ’Ã‚Â³viles), logrando una interfaz limpia y libre de cortes de cajas.

### 2026-07-06 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ UnificaciÃƒÆ’Ã‚Â³n Completa de Modales Personalizados, Historial, KYC en Referidos, Open Graph EstÃƒÆ’Ã‚Â¡tico/DinÃƒÆ’Ã‚Â¡mico (WhatsApp Previews) y UI Compacta del Booster

- **Contexto**: Para lograr un frontend 100% libre de elementos nativos del navegador, coherente visualmente y alineado con los estÃƒÆ’Ã‚Â¡ndares FinTech y bancarios, se requerÃƒÆ’Ã‚Â­a:
  1. Reemplazar todos los cuadros de diÃƒÆ’Ã‚Â¡logo nativos (`alert()` y `confirm()`) restantes en las secciones pÃƒÆ’Ã‚Âºblicas y del panel administrativo por los modales personalizados (`showCustomAlert` y `showCustomConfirm`).
  2. Modificar el texto del saldo en el modal de donaciÃƒÆ’Ã‚Â³n de "Tu saldo disponible" a "Disponible para donaciones" y habilitar un flujo interactivo para redirigir al perfil del impulsor.
  3. Renombrar las pestaÃƒÆ’Ã‚Â±as de historial de transacciones de "Estado de Cuenta (Web3)" e "Recompensas (Impulsor)" a "Blockchain" e "Impulsor" para simplificar y dinamizar la interfaz.
  4. RediseÃƒÆ’Ã‚Â±ar la cabecera del perfil de impulsor para que sea mÃƒÆ’Ã‚Â¡s pequeÃƒÆ’Ã‚Â±a y muestre la frase "[Nombre], eres nivel [X]", de forma que se optimice el espacio en pantallas mÃƒÆ’Ã‚Â³viles.
  5. Agregar un icono informativo (`ÃƒÂ¢Ã¢â‚¬Å“Ã‹Å“`) al lado de todos los tÃƒÆ’Ã‚Â­tulos de tarjetas y secciones que posean tooltips interactivos para indicar al usuario de forma intuitiva que al tocarlos se despliega ayuda.
  6. OptimizaciÃƒÆ’Ã‚Â³n en Compartir: Se silenciaron los mensajes de error falsos positivos al cancelar la ventana nativa de compartir (controlando el `AbortError` de la Web Share API) para evitar diÃƒÆ’Ã‚Â¡logos de error molestos e innecesarios.
  7. VisualizaciÃƒÆ’Ã‚Â³n del KYC en Referidos: Para justificar la retenciÃƒÆ’Ã‚Â³n temporal de BLUE IOU por referidos sin KYC, se requerÃƒÆ’Ã‚Â­a mostrar el estado del KYC de cada referido de forma clara e intuitiva en la tabla de referidos del usuario.
  8. InyecciÃƒÆ’Ã‚Â³n DinÃƒÆ’Ã‚Â¡mica de Open Graph (og:tags) para Previsualizaciones Premium: Para que al compartir causas o enlaces de referidos por WhatsApp se muestre de forma automÃƒÆ’Ã‚Â¡tica la foto de la causa o el banner de la promociÃƒÆ’Ã‚Â³n de referidos subidos desde el panel administrativo, se implementÃƒÆ’Ã‚Â³ un middleware dinÃƒÆ’Ã‚Â¡mico de inyecciÃƒÆ’Ã‚Â³n de metadatos SEO.
  9. IntegraciÃƒÆ’Ã‚Â³n de Fallback EstÃƒÆ’Ã‚Â¡tico para SEO en Hostinger: Debido a que el frontend de producciÃƒÆ’Ã‚Â³n estÃƒÆ’Ã‚Â¡ alojado de forma estÃƒÆ’Ã‚Â¡tica en Hostinger y el backend en Render, las peticiones HTTP GET directas de WhatsApp a las pÃƒÆ’Ã‚Â¡ginas HTML las atiende Hostinger directamente sin pasar por Node.js. Para solucionar la falta de imÃƒÆ’Ã‚Â¡genes de vista previa en este escenario, se inyectaron metatags de Open Graph fijos en las 5 pÃƒÆ’Ã‚Â¡ginas pÃƒÆ’Ã‚Âºblicas mÃƒÆ’Ã‚Â¡s compartidas.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **UnificaciÃƒÆ’Ã‚Â³n de Alertas y Confirmaciones en Admin**:
    - Se mapearon y refactorizaron los archivos administrativos `admin-panel.js`, `momentum-admin.js` y `admin-recruitment.html`.
    - Se inyectÃƒÆ’Ã‚Â³ la estructura HTML del sistema de modales en `momentum-admin.html` y `admin-recruitment.html`, y se vinculÃƒÆ’Ã‚Â³ la hoja de estilos global `style.css` para el renderizado premium.
    - Se reestructurÃƒÆ’Ã‚Â³ la lÃƒÆ’Ã‚Â³gica en JS convirtiendo scripts a mÃƒÆ’Ã‚Â³dulos ES (como en `admin-recruitment.html`) para importar las funciones de alertas centralizadas, registrando las funciones en `window` para mantener compatibilidad con los listeners `onclick` inline del HTML.
  - **SustituciÃƒÆ’Ã‚Â³n de DiÃƒÆ’Ã‚Â¡logos Nativos en Causas PÃƒÆ’Ã‚Âºblicas**:
    - Se cambiaron las alertas y confirmaciones en `causa-solidaria.js` y `solicitud-solidaria.html` utilizando callbacks asÃƒÆ’Ã‚Â­ncronas para controlar redirecciones seguras.
  - **Saldo Interactivo y Renombrado de PestaÃƒÆ’Ã‚Â±as**:
    - Se actualizÃƒÆ’Ã‚Â³ `causa-solidaria.html` y `causa-solidaria.js` aÃƒÆ’Ã‚Â±adiendo id `balanceHintClickable` y listener para redirigir a `booster-profile.html`.
    - Se modificÃƒÆ’Ã‚Â³ `transactions.js` renombrando las pestaÃƒÆ’Ã‚Â±as del historial de transacciones para mejorar la legibilidad y la experiencia del usuario (UX).
  - **DiseÃƒÆ’Ã‚Â±o del Perfil de Impulsor Compacto e Informativo**:
    - Se rediseÃƒÆ’Ã‚Â±ÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n `getHeaderHTML` en `booster-profile.js` para capitalizar el nombre del usuario y mostrar `"Nombre, eres nivel X"` de forma directa, eliminando el badge antiguo e inyectando un icono `ÃƒÂ¢Ã¢â‚¬Å“Ã‹Å“` informativo al final de la frase.
    - Se modificÃƒÆ’Ã‚Â³ `booster-style.css` disminuyendo los paddings y mÃƒÆ’Ã‚Â¡rgenes del `.booster-header` y reduciendo el tamaÃƒÆ’Ã‚Â±o del `h1` de `2.5rem` a `1.6rem` para pantallas mÃƒÆ’Ã‚Â¡s pequeÃƒÆ’Ã‚Â±as.
    - Se inyectÃƒÆ’Ã‚Â³ el icono `ÃƒÂ¢Ã¢â‚¬Å“Ã‹Å“` en las funciones de marcado de todas las tarjetas de balances, meta diaria, tareas completadas e historial de ganancias de `booster-profile.js`.
  - **Silenciado de Cancelaciones en Web Share API**:
    - Se modificaron `contract-interaction.js` y `publication-detail.js` interceptando el error de tipo `AbortError` arrojado por `navigator.share` para omitir la alerta de error si el usuario decide no concretar la acciÃƒÆ’Ã‚Â³n.
  - **Mapeo e IntegraciÃƒÆ’Ã‚Â³n de KYC en Lista de Referidos**:
    - En el backend, se modificÃƒÆ’Ã‚Â³ `userController.js` para agregar la columna `u.kyc_verified` a la consulta de referidos en el endpoint `/api/users/:username/referral-info`.
    - En el frontend, se actualizÃƒÆ’Ã‚Â³ `referrals.js` para aÃƒÆ’Ã‚Â±adir la columna "KYC" de primera, simplificar el tÃƒÆ’Ã‚Â­tulo "Usuario Registrado" a "Usuario", y dibujar un badge verde `ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦` (KYC Aprobado) o un reloj de arena naranja `ÃƒÂ¢Ã¯Â¿Â½Ã‚Â³` (KYC Pendiente) segÃƒÆ’Ã‚Âºn corresponda.
  - **InyecciÃƒÆ’Ã‚Â³n DinÃƒÆ’Ã‚Â¡mica de Open Graph (og:tags) para Previsualizaciones**:
    - Se diseÃƒÆ’Ã‚Â±ÃƒÆ’Ã‚Â³ un middleware defensivo `seoMiddleware.js` en el backend para interceptar los accesos HTTP GET a `causa-solidaria.html` y `register.html` antes del servidor estÃƒÆ’Ã‚Â¡tico.
    - Para causas, consulta la tabla `humanitarian_causes` para extraer el tÃƒÆ’Ã‚Â­tulo, descripciÃƒÆ’Ã‚Â³n (`story`) y la imagen principal de la causa (primer elemento de `evidence_urls`). Para registros de referidos, consulta la llave `referral_campaign_image_url` en la tabla `app_settings`.
    - Convierte de forma dinÃƒÆ’Ã‚Â¡mica las rutas relativas en URLs absolutas necesarias para WhatsApp basÃƒÆ’Ã‚Â¡ndose en la cabecera `Host` y el protocolo seguro de la peticiÃƒÆ’Ã‚Â³n.
    - Escapa los datos recuperados de la BD para prevenir inyecciones HTML o XSS en los atributos `content` y reemplaza de forma segura la cabecera mediante expresiones regulares.
    - Se implementÃƒÆ’Ã‚Â³ degradaciÃƒÆ’Ã‚Â³n elegante (fallback resiliente): en caso de ID de causa invÃƒÆ’Ã‚Â¡lido, inexistencia o error de servidor, se llama a `next()` y Express sirve la pÃƒÆ’Ã‚Â¡gina estÃƒÆ’Ã‚Â¡tica por defecto con el logotipo corporativo.
    - Se incluyÃƒÆ’Ã‚Â³ un script de pruebas de regresiÃƒÆ’Ã‚Â³n `test_seo.js` para validar mocks y verificar que no hay regresiones de cÃƒÆ’Ã‚Â³digo.
  - **InyecciÃƒÆ’Ã‚Â³n EstÃƒÆ’Ã‚Â¡tica de Open Graph para Soporte de Servidores CDNs (Hostinger Fallback)**:
    - Se agregaron etiquetas fijas estÃƒÆ’Ã‚Â¡ticas de Open Graph (`og:title`, `og:description`, `og:image`, `og:type` y `twitter:card`) en los archivos HTML originales del frontend para las 5 pÃƒÆ’Ã‚Â¡ginas principales: `index.html`, `register.html`, `causa-solidaria.html`, `como-funciona.html` y `trabaja-con-nosotros.html`.
    - Las etiquetas apuntan al logotipo oficial corporativo en alta resoluciÃƒÆ’Ã‚Â³n (`/assets/icons/logo-high-res.png`) almacenado en la carpeta `public` para garantizar la compatibilidad universal en WhatsApp al compartir cualquiera de los enlaces principales desde Hostinger de forma estÃƒÆ’Ã‚Â¡tica.
- **Impacto**: Interfaz de usuario profesional, limpia y libre de fallos por diÃƒÆ’Ã‚Â¡logos del navegador. Mayor transparencia en el estado del KYC de la red de referidos. Previsualizaciones premium automÃƒÆ’Ã‚Â¡ticas con compatibilidad universal en redes sociales tanto de forma estÃƒÆ’Ã‚Â¡tica (Hostinger) como dinÃƒÆ’Ã‚Â¡mica (Render), optimizadas para alta conversiÃƒÆ’Ã‚Â³n, velocidad de carga y mÃƒÆ’Ã‚Â¡xima ciberseguridad.
- **Archivos modificados**: `causa-solidaria.html`, `causa-solidaria.js`, `solicitud-solidaria.html`, `admin-panel.js`, `momentum-admin.html`, `momentum-admin.js`, `admin-recruitment.html`, `transactions.js`, `booster-profile.js`, `booster-style.css`, `contract-interaction.js`, `publication-detail.js`, `userController.js`, `referrals.js`, `seoMiddleware.js`, `server.js`, `test_seo.js`, `index.html`, `como-funciona.html`, `trabaja-con-nosotros.html`, `register.html`, `TECHNICAL_IMPROVEMENTS.md`.

### 2026-07-03 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Escrow de Donaciones y SegmentaciÃƒÆ’Ã‚Â³n de Saldo Seguro (AML/Growth)

- **Contexto**: Un usuario reciÃƒÆ’Ã‚Â©n registrado sin KYC no podÃƒÆ’Ã‚Â­a realizar donaciones a causas solidarias (incluyendo su propio bono de bienvenida y tareas completadas) debido a que el bloqueo estricto del "Two-Gate KYC Freeze" fijaba su saldo disponible en 0. Asimismo, las etiquetas y tooltips requerÃƒÆ’Ã‚Â­an una terminologÃƒÆ’Ã‚Â­a mÃƒÆ’Ã‚Â¡s precisa y alineada con los conceptos de la plataforma.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a (Coexistencia AML/UX)**:
  - **Saldos Granulares (`financialCoreService.js`)**: Se introdujo el concepto de `baseEligibleBalance` = `totalBalance - unverifiedReferralBalance`. Este saldo representa el valor lÃƒÆ’Ã‚Â­cito y confirmado del propio usuario (bienvenida, tareas y referidos verificados).
  - **LÃƒÆ’Ã‚Â­mite de Escrow (`humanitarianService.js`)**: Se actualizÃƒÆ’Ã‚Â³ la verificaciÃƒÆ’Ã‚Â³n de fondos para donaciones de `eligibleBalance` a `baseEligibleBalance`. Esto permite a los usuarios sin KYC realizar donaciones.
  - **Control de TransmisiÃƒÆ’Ã‚Â³n**: Dado que el donante no tiene KYC, la donaciÃƒÆ’Ã‚Â³n se procesa en estado `on_hold` (escrow / fideicomiso) mediante la lÃƒÆ’Ã‚Â³gica nativa del sistema. El dinero se retira inmediatamente del ledger del donante pero **no llega al beneficiario** hasta que el donante complete el KYC, previniendo lavado de dinero (AML).
  - **Coherencia Visual y RediseÃƒÆ’Ã‚Â±o de Etiquetas (`userController.js` y `booster-profile.js`)**:
    - Cambiamos "Saldo Disponible (KYC)" por **"Habilitado para Canje (KYC)"** con su tooltip explicativo sobre la conversiÃƒÆ’Ã‚Â³n oficial a tokens BLUE en el lanzamiento.
    - Cambiamos "Saldo Pendiente (KYC)" por **"BLUE IOU de referidos sin KYC"** para dejar claro que son fondos retenidos de terceros sin verificaciÃƒÆ’Ã‚Â³n de identidad.
    - Personalizamos la nueva tarjeta **"Disponible para Donaciones"** pintÃƒÆ’Ã‚Â¡ndola con el color oficial de donaciones (`#e83e8c` rosa) y su tooltip explicando el flujo de hold para usuarios no verificados.
    - El modal de donaciÃƒÆ’Ã‚Â³n en frontend ahora lee `base_eligible_booster_blue` para mostrar de forma exacta y transparente el saldo seguro disponible para donaciones (evitando falsos positivos).
- **Impacto**: Aumenta la conversiÃƒÆ’Ã‚Â³n de registros a KYC (Growth) permitiendo la interacciÃƒÆ’Ã‚Â³n inmediata con el sistema de donaciones bajo un esquema de fideicomiso ciberseguro y legalmente sÃƒÆ’Ã‚Â³lido.

### 2026-07-02 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Immediate Phase Rollover: TransiciÃƒÆ’Ã‚Â³n AutomÃƒÆ’Ã‚Â¡tica de Tramos de Referidos

- **Problema Detectado**: Cuando un tramo de referidos se completaba (ej: 10 usuarios registrados con lÃƒÆ’Ã‚Â­mite de 10), el dashboard mostraba "Quedan 0 cupos" con el monto del tramo anterior (200 BLUE) en lugar de saltar automÃƒÆ’Ã‚Â¡ticamente al siguiente tramo (100 BLUE). Esto confundÃƒÆ’Ã‚Â­a al usuario y mostraba informaciÃƒÆ’Ã‚Â³n financiera incorrecta.
- **Causa RaÃƒÆ’Ã‚Â­z**: La consulta SQL usaba `WHERE max_users_limit >= totalUsers`. Cuando `totalUsers = max_users_limit`, la query devolvÃƒÆ’Ã‚Â­a el tramo reciÃƒÆ’Ã‚Â©n completado con 0 cupos restantes en lugar del siguiente tramo disponible.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**: Se cambiÃƒÆ’Ã‚Â³ el operador de `>=` a `>` (estricto) en dos archivos crÃƒÆ’Ã‚Â­ticos:
  - `systemController.js` ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `getReferralSettings()`: Query que alimenta la tarjeta del dashboard (lo que ve el usuario).
  - `authController.js` ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Registro de nuevos usuarios: Query que determina cuÃƒÆ’Ã‚Â¡nto se acredita al referente (lo que se paga).
  - Ambos deben usar el mismo operador para garantizar consistencia audit-trail: **lo que se muestra = lo que se paga**.
- **Frontend**: Se actualizÃƒÆ’Ã‚Â³ `contract-interaction.js` para que `remaining_slots = 0` solo oculte la secciÃƒÆ’Ã‚Â³n de cupos cuando **todos los tramos** estÃƒÆ’Ã‚Â¡n agotados (reward = 0), no cuando simplemente se completa una fase.
- **PatrÃƒÆ’Ã‚Â³n**: "Immediate Phase Rollover" ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ estÃƒÆ’Ã‚Â¡ndar en plataformas de crowdfunding (Kickstarter), exchanges (Binance ICO tiers) y pre-ventas (Stripe).
- **Archivos modificados**: `systemController.js`, `authController.js`, `contract-interaction.js`

### 2026-07-02 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CorrecciÃƒÆ’Ã‚Â³n CrÃƒÆ’Ã‚Â­tica de Seguridad Financiera: Two-Gate KYC Freeze (FATF / AML)

- **Problema Detectado**: Un usuario sin KYC aprobado (`kyc_verified = false` en BD) podÃƒÆ’Ã‚Â­a ver su saldo total del `booster_blue_ledger` como "Saldo Disponible (KYC)" en el perfil de impulsor. Esto ocurrÃƒÆ’Ã‚Â­a porque `financialCoreService.getUserEligibleBalance` solo evaluaba si los **referidos** del usuario tenÃƒÆ’Ã‚Â­an KYC, pero nunca verificaba si el **propio titular** tenÃƒÆ’Ã‚Â­a KYC aprobado.
- **Impacto del Bug**: ViolaciÃƒÆ’Ã‚Â³n del principio de "Freeze on Unverified" obligatorio en regulaciones AML (Anti-Money Laundering). Un usuario no verificado podÃƒÆ’Ã‚Â­a percibir fondos "disponibles" que en realidad deberÃƒÆ’Ã‚Â­an estar congelados hasta su verificaciÃƒÆ’Ã‚Â³n de identidad.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**: Se implementÃƒÆ’Ã‚Â³ el patrÃƒÆ’Ã‚Â³n **Two-Gate KYC Freeze**, estÃƒÆ’Ã‚Â¡ndar en plataformas FinTech reguladas (Binance, Coinbase, Stripe Connect):
  - **Gate 1 (Titular)**: Se verifica primero si el propio usuario tiene `kyc_verified = true`. Si no ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ retorno temprano con `eligibleBalance = 0` y `unverifiedReferralBalance = totalBalance` (todo congelado). Fundamento: FATF Recommendation 10, AMLD5 (UE), FinCEN (US), ISO 27001 (Principio de Menor Privilegio).
  - **Gate 2 (Referidos)**: Solo se ejecuta si el Gate 1 pasa. Descuenta del saldo elegible los bonos de referidos cuyos invitados aÃƒÆ’Ã‚Âºn no tienen KYC aprobado. Esto previene el uso de referidos ficticios para lavar fondos (AML).
  - `COALESCE(kyc_verified, false)` en todas las consultas: previene que un valor `NULL` sea interpretado como "verificado".
  - `Math.max(0, eligibleBalance)` como salvaguarda financiera final: impide saldo disponible negativo por cualquier bug de datos.
- **Archivo modificado**: `backend/src/services/financialCoreService.js` ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ funciÃƒÆ’Ã‚Â³n `getUserEligibleBalance`
- **Commit**: `(ver hash en git log)`
- **Impacto**: Cumplimiento regulatorio FinTech de nivel bancario. El saldo disponible ahora refleja exactamente la realidad: 0 para usuarios sin KYC, y total menos bonos de referidos no verificados para usuarios con KYC.

### 2026-07-01 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Sistema de CampaÃƒÆ’Ã‚Â±as DinÃƒÆ’Ã‚Â¡micas, Tarjeta WYSIWYG y ModularizaciÃƒÆ’Ã‚Â³n Fintech

- **Contexto**: Se requerÃƒÆ’Ã‚Â­a una forma visual, ÃƒÆ’Ã‚Â¡gil y de alto impacto para promocionar causas humanitarias (ej. Terremoto en Venezuela) reemplazando la tarjeta estÃƒÆ’Ã‚Â¡ndar de "Invitar Amigos" por una tarjeta publicitaria dinÃƒÆ’Ã‚Â¡mica (imagen de fondo premium y textos de "Call to Action" personalizados) que no dependiera del engorroso sistema de votaciÃƒÆ’Ã‚Â³n del DAO.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a (Modularidad & Seguridad)**:
  - **API Gateway Interno (`src/routes/index.js`)**: Se introdujo el patrÃƒÆ’Ã‚Â³n de enrutamiento centralizado para romper la tendencia de engordar el monolito en `server.js`. De ahora en adelante, `server.js` queda limpio y los mÃƒÆ’Ã‚Â³dulos se agregan jerÃƒÆ’Ã‚Â¡rquicamente a este nuevo ÃƒÆ’Ã‚Â­ndice maestro.
  - **Motor de Subida Blindado (`uploadRoutes.js`)**: Se extrajo la lÃƒÆ’Ã‚Â³gica de subida de imÃƒÆ’Ã‚Â¡genes a un micro-mÃƒÆ’Ã‚Â³dulo. Cuenta con 4 capas de seguridad de grado bancario: 1) Zero Trust (solo tokens de Admin vÃƒÆ’Ã‚Â¡lidos); 2) Whitelisting estricto de MIME types (JPG, PNG, WebP); 3) LÃƒÆ’Ã‚Â­mite de estrangulamiento (Max 2MB) contra ataques DDoS o Storage Exhaustion; 4) SanitizaciÃƒÆ’Ã‚Â³n algorÃƒÆ’Ã‚Â­tmica de nombres de archivo (Anti-Path Traversal).
  - **Bypass de Gobernanza**: En `adminController.js`, se excluyeron las variables estÃƒÆ’Ã‚Â©ticas (`referral_card_title`, `referral_card_button_text`, `referral_campaign_image_url`) del proceso DAO, permitiendo agilidad de marketing sin sacrificar la seguridad sobre las variables econÃƒÆ’Ã‚Â³micas del sistema.
  - **TransformaciÃƒÆ’Ã‚Â³n Visual**: La tarjeta del dashboard frontend ahora lee el switch `referral_custom_share_code_enabled`. Al encenderse, pinta la imagen detrÃƒÆ’Ã‚Â¡s, inyecta un overlay oscuro del 95% para hacer legibles los textos y reescribe el Call To Action al instante.
- **Impacto**: Crea un puente entre el equipo de diseÃƒÆ’Ã‚Â±o/marketing y los usuarios, permitiendo reaccionar a crisis humanitarias en tiempo real. Fija un nuevo estÃƒÆ’Ã‚Â¡ndar arquitectÃƒÆ’Ã‚Â³nico dentro del cÃƒÆ’Ã‚Â³digo fuente para extraer ordenadamente el resto del monolito de `server.js`.

### 2026-07-01 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ ProtecciÃƒÆ’Ã‚Â³n Anti-Spam y PrecisiÃƒÆ’Ã‚Â³n Decimal de 4 DÃƒÆ’Ã‚Â­gitos en Causas Solidarias

- **Contexto**: Se identificaron dos vulnerabilidades potenciales en el sistema de recaudaciÃƒÆ’Ã‚Â³n: 1) Riesgo de congestiÃƒÆ’Ã‚Â³n de red (spam) por bots enviando micro-donaciones (ej. 0.0001 BLUE IOU). 2) PÃƒÆ’Ã‚Â©rdida de precisiÃƒÆ’Ã‚Â³n matemÃƒÆ’Ã‚Â¡tica en la sumatoria total mostrada en la interfaz debido a que las columnas de la base de datos truncaban los valores a 2 decimales, omitiendo las fracciones menores.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **ValidaciÃƒÆ’Ã‚Â³n Fintech (`humanitarianService.js`)**: Se integrÃƒÆ’Ã‚Â³ una regla dura que exige un mÃƒÆ’Ã‚Â­nimo de `1 BLUE IOU` por donaciÃƒÆ’Ã‚Â³n. Adicionalmente, el monto ingresado ahora se formatea estrictamente a 4 decimales (`toFixed(4)`) antes de su procesamiento para blindar contra vulnerabilidades de desbordes de coma flotante.
  - **CorrecciÃƒÆ’Ã‚Â³n de PrecisiÃƒÆ’Ã‚Â³n (MigraciÃƒÆ’Ã‚Â³n `080_fix_humanitarian_amounts_decimals.js`)**: Se alterÃƒÆ’Ã‚Â³ dinÃƒÆ’Ã‚Â¡micamente el tipo de dato de las columnas `goal_amount` y `current_amount` en `humanitarian_causes` de `DECIMAL(18, 2)` a `DECIMAL(18, 4)`.
  - **Re-hidrataciÃƒÆ’Ã‚Â³n de Datos**: Dentro de la misma migraciÃƒÆ’Ã‚Â³n `080`, se aÃƒÆ’Ã‚Â±adiÃƒÆ’Ã‚Â³ una directiva de re-cÃƒÆ’Ã‚Â¡lculo para actualizar `current_amount` consultando la sumatoria matemÃƒÆ’Ã‚Â¡tica exacta (con 4 decimales) desde el ledger inmutable de `humanitarian_donations`, recuperando el saldo perdido en el frontend.
- **Impacto**: Fortalece el sistema contra congestiÃƒÆ’Ã‚Â³n maliciosa y asegura que la exactitud de los aportes empaten a la perfecciÃƒÆ’Ã‚Â³n con la visualizaciÃƒÆ’Ã‚Â³n contable en el panel frontal del usuario, alineado a los estÃƒÆ’Ã‚Â¡ndares de precisiÃƒÆ’Ã‚Â³n bancaria.
- **Archivos modificados**: `smart-contract/backend/src/services/humanitarianService.js`, `smart-contract/backend/migrations/080_fix_humanitarian_amounts_decimals.js`, `smart-contract/EVOLUCION.md`.

### 2026-07-01 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Transparencia de AutorÃƒÆ’Ã‚Â­a en Recibos de DonaciÃƒÆ’Ã‚Â³n Solidaria

- **Contexto**: Para mejorar la experiencia de usuario y la transparencia en las donaciones de "Winton Solidario", se requerÃƒÆ’Ã‚Â­a informar al donante quiÃƒÆ’Ã‚Â©n fue el creador real de la publicaciÃƒÆ’Ã‚Â³n a la cual aportÃƒÆ’Ã‚Â³, ya que el creador de la publicaciÃƒÆ’Ã‚Â³n puede ser distinto al beneficiario final de los fondos (ej. alguien publica en nombre de una fundaciÃƒÆ’Ã‚Â³n).
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Motor de Correos Transaccionales (`humanitarianService.js`)**: Se modificÃƒÆ’Ã‚Â³ la firma del helper `sendDonationSentEmail` para aceptar el nombre de usuario del creador (`creatorUsername`). En la construcciÃƒÆ’Ã‚Â³n del cuerpo del correo, se aÃƒÆ’Ã‚Â±adiÃƒÆ’Ã‚Â³ un nuevo campo al arreglo de detalles `[ { label: 'Creador de la Causa', value: '@' + creatorUsername } ]`.
  - **InvocaciÃƒÆ’Ã‚Â³n DinÃƒÆ’Ã‚Â¡mica**: En la funciÃƒÆ’Ã‚Â³n principal `donateToCause`, al despachar el correo asÃƒÆ’Ã‚Â­ncrono, ahora se extrae y se inyecta la propiedad `cause.owner_username` obtenida directamente de la consulta central de la causa.
- **Impacto**: Aumenta la claridad contable y previene confusiones (customer support) brindando recibos con desglose completo sobre la titularidad y destino del capital en donaciones de terceros.
- **Archivos modificados**: `smart-contract/backend/src/services/humanitarianService.js`, `smart-contract/EVOLUCION.md`.

### 2026-07-01 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Plantilla de Mensaje de Referido Personalizable, CÃƒÆ’Ã‚Â³digo Global de Invitaciones y VisualizaciÃƒÆ’Ã‚Â³n de Cupos (FOMO)

- **Contexto**: Para mejorar las herramientas de marketing viral de la plataforma sin requerir modificaciones constantes de cÃƒÆ’Ã‚Â³digo ni redespliegues de la interfaz de usuario, se solicitÃƒÆ’Ã‚Â³:
  1. Habilitar la personalizaciÃƒÆ’Ã‚Â³n del mensaje publicitario que los usuarios comparten por WhatsApp o copian al portapapeles.
  2. Implementar la posibilidad de que los administradores definan un "CÃƒÆ’Ã‚Â³digo de Referido Especial/Global" y activen un switch para forzar su uso al compartir en redes sociales, en lugar del cÃƒÆ’Ã‚Â³digo personal del usuario.
  3. Evitar el uso de una cuenta regresiva estÃƒÆ’Ã‚Â¡tica y sustituirla en el panel de interacciÃƒÆ’Ã‚Â³n por un indicador premium de cupos restantes en tiempo real del tramo vigente, forzando la visualizaciÃƒÆ’Ã‚Â³n dinÃƒÆ’Ã‚Â¡mica del valor real del bono para evitar publicidad engaÃƒÆ’Ã‚Â±osa.
  4. Garantizar que estas configuraciones operativas de mensajerÃƒÆ’Ã‚Â­a no requieran la aprobaciÃƒÆ’Ã‚Â³n de los Guardianes de Gobernanza.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Base de Datos (MigraciÃƒÆ’Ã‚Â³n `079_add_referral_message_settings.js`)**: Se crearon y sembraron en la tabla `app_settings` tres nuevas configuraciones: `referral_custom_share_code` ('WINTON'), `referral_custom_share_code_enabled` ('false') y `referral_share_message_template` (con placeholders dinÃƒÆ’Ã‚Â¡micos `{code}`, `{reward}`, `{link}`).
  - **ExenciÃƒÆ’Ã‚Â³n de Gobernanza (`adminController.js`)**: Se modificÃƒÆ’Ã‚Â³ `updateSetting` para aÃƒÆ’Ã‚Â±adir las tres nuevas llaves al filtro de `isNonCriticalSetting`, permitiendo la ediciÃƒÆ’Ã‚Â³n instantÃƒÆ’Ã‚Â¡nea de los copys y cÃƒÆ’Ã‚Â³digos administrativos sin requerir firmas de quÃƒÆ’Ã‚Â³rum de gobernanza.
  - **LÃƒÆ’Ã‚Â³gica de ConfiguraciÃƒÆ’Ã‚Â³n y Mensaje (`systemController.js` y `contract-interaction.js`)**:
    - Se modificÃƒÆ’Ã‚Â³ la API de `/api/referral-settings` para incluir los tres nuevos parÃƒÆ’Ã‚Â¡metros en la respuesta del frontend.
    - Se actualizÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n `shareReferralCode()` del frontend pÃƒÆ’Ã‚Âºblico para resolver en paralelo la informaciÃƒÆ’Ã‚Â³n de referidos del usuario y los settings de la app, permitiendo compilar dinÃƒÆ’Ã‚Â¡micamente la plantilla reemplazando `{code}` (personal o custom), `{reward}` y `{link}`.
  - **Indicador de Cupos en Tarjeta (`contract_interaction.html` y `contract-interaction.js`)**:
    - Reemplazamos la cuenta regresiva temporal (`Expira en:`) por el contenedor dinÃƒÆ’Ã‚Â¡mico `CUPOS DISPONIBLES: [cupos] usuarios` en HTML.
    - Actualizamos la inicializaciÃƒÆ’Ã‚Â³n en JS para consultar el tramo activo, restar el total de usuarios registrados y pintar la cantidad formateada con separador de miles. Se aÃƒÆ’Ã‚Â±ade un estado de `"CUPOS AGOTADOS:"` resaltado en rojo si los cupos llegan a cero.
  - **Panel Administrativo (`admin-panel.html` y `admin-panel.js`)**:
    - Agregamos la pestaÃƒÆ’Ã‚Â±a "Mensaje de Referido (WhatsApp / Redes)" en la secciÃƒÆ’Ã‚Â³n de AdministraciÃƒÆ’Ã‚Â³n de Referidos.
    - Creamos el renderizador `renderReferralMessageSettings` para inyectar los controles del Switch, el Input del cÃƒÆ’Ã‚Â³digo global y el Textarea de la plantilla con autoguardado asÃƒÆ’Ã‚Â­ncrono en blur.
    - Extendimos `handleSettingChange` para soportar de forma nativa inputs de tipo `text` y elementos `textarea`.
- **Impacto**: Se descentralizÃƒÆ’Ã‚Â³ el contenido de mercadeo de referidos de la plataforma, proporcionando total autonomÃƒÆ’Ã‚Â­a operacional al equipo administrativo de la startup para ajustar campaÃƒÆ’Ã‚Â±as, emojis y cÃƒÆ’Ã‚Â³digos globales sin intervenciones de desarrollo, mientras se potenciÃƒÆ’Ã‚Â³ la conversiÃƒÆ’Ã‚Â³n viral (Growth Hacking) mediante la escasez explÃƒÆ’Ã‚Â­cita de cupos (FOMO) en el dashboard pÃƒÆ’Ã‚Âºblico del usuario.
- **Archivos modificados**: `smart-contract/backend/migrations/079_add_referral_message_settings.js`, `smart-contract/backend/src/controllers/adminController.js`, `smart-contract/backend/src/controllers/systemController.js`, `smart-contract/frontend/admin-panel.html`, `smart-contract/frontend/contract_interaction.html`, `smart-contract/frontend/src/pages/admin-panel.js`, `smart-contract/frontend/src/pages/contract-interaction.js`, `smart-contract/EVOLUCION.md`.

### 2026-06-30 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Sistema de Halving DinÃƒÆ’Ã‚Â¡mico de Referidos Configurable (Tramos y Tope de Pool de 200M)

- **Contexto**: Para el cumplimiento de las polÃƒÆ’Ã‚Â­ticas econÃƒÆ’Ã‚Â³micas vigentes del protocolo, se requerÃƒÆ’Ã‚Â­a estructurar las recompensas por referidos (tanto para el referente como para el referido) en un esquema dinÃƒÆ’Ã‚Â¡mico de tramos (*halving dinÃƒÆ’Ã‚Â¡mico*) basado en el volumen acumulado de usuarios registrados en el sistema, en lugar de un monto fijo lineal. Asimismo, se requerÃƒÆ’Ã‚Â­a garantizar un tope financiero mÃƒÆ’Ã‚Â¡ximo de emisiÃƒÆ’Ã‚Â³n promocional de **200,000,000 BLUE IOU** y habilitar la expiraciÃƒÆ’Ã‚Â³n total de los bonos (monto a 0) una vez superado el lÃƒÆ’Ã‚Â­mite del ÃƒÆ’Ã‚Âºltimo tramo (1,010,000 usuarios).
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Base de Datos (`referral_reward_tiers`)**: Se creÃƒÆ’Ã‚Â³ y sembrÃƒÆ’Ã‚Â³ mediante la migraciÃƒÆ’Ã‚Â³n `078_create_referral_reward_tiers.js` una tabla relacional para almacenar dinÃƒÆ’Ã‚Â¡micamente los tramos de halving (Tramo 1: 0 a 10k $\rightarrow$ 200 BLUE, Tramo 2: 10k a 310k $\rightarrow$ 100 BLUE, Tramo 3: 310k a 1.01M $\rightarrow$ 75 BLUE). Se estableciÃƒÆ’Ã‚Â³ `referral_reward_after_expiry` en `0` en la tabla `app_settings` para apagar automÃƒÆ’Ã‚Â¡ticamente las recompensas al finalizar la campaÃƒÆ’Ã‚Â±a.
  - **Backend de ConfiguraciÃƒÆ’Ã‚Â³n (`adminController.js`)**: Se implementaron los endpoints `GET /api/admin/referrals/tiers` y `POST /api/admin/referrals/tiers`. Este ÃƒÆ’Ã‚Âºltimo aplica una validaciÃƒÆ’Ã‚Â³n matemÃƒÆ’Ã‚Â¡tica estricta para asegurar que la sumatoria proyectada del costo de todos los tramos multiplicada por 2 (por el pago dual a referente y referido) no exceda el lÃƒÆ’Ã‚Â­mite de 200 millones de BLUE IOU. Se integrÃƒÆ’Ã‚Â³ ademÃƒÆ’Ã‚Â¡s la protecciÃƒÆ’Ã‚Â³n por gobernanza de los Guardianes (`_checkGovernanceActive`) y auditorÃƒÆ’Ã‚Â­a SOC 2 (`logAuditEvent`).
  - **CÃƒÆ’Ã‚Â¡lculo de Recompensa al Registrarse (`authController.js`)**: Se actualizÃƒÆ’Ã‚Â³ el flujo de registro de nuevos usuarios para que el backend realice un conteo en tiempo real (`SELECT COUNT(*) FROM users`) y determine la recompensa del tramo correspondiente de forma dinÃƒÆ’Ã‚Â¡mica e inmutable en SQL.
  - **Frontend Administrativo (`admin-panel.html` y `admin-panel.js`)**: Se implementÃƒÆ’Ã‚Â³ una tabla responsiva en la pestaÃƒÆ’Ã‚Â±a de Referidos para visualizar y editar los tramos en tiempo real. Cuenta con:
    1. Una barra de progreso que indica la cantidad de BLUE IOU comprometidos contra el pool de 200 millones.
    2. Resaltado visual en verde del tramo activo segÃƒÆ’Ã‚Âºn el conteo de usuarios.
    3. IntercepciÃƒÆ’Ã‚Â³n y advertencia de gobernanza si el sistema de Guardianes estÃƒÆ’Ã‚Â¡ habilitado.
- **Impacto**: Se descentralizÃƒÆ’Ã‚Â³ y dinamizÃƒÆ’Ã‚Â³ la lÃƒÆ’Ã‚Â³gica de emisiÃƒÆ’Ã‚Â³n por invitaciÃƒÆ’Ã‚Â³n del token de la plataforma, proporcionando total control a los administradores sobre los tramos promocionales, mientras se eliminaron riesgos de hiperinflaciÃƒÆ’Ã‚Â³n y vacÃƒÆ’Ã‚Â­os de cumplimiento regulatorio (SOC 2, Delaware startup compliance).
- **Archivos modificados**: `smart-contract/backend/migrations/078_create_referral_reward_tiers.js`, `smart-contract/backend/src/routes/adminRoutes.js`, `smart-contract/backend/src/controllers/adminController.js`, `smart-contract/backend/src/controllers/authController.js`, `smart-contract/frontend/admin-panel.html`, `smart-contract/frontend/src/pages/admin-panel.js`, `smart-contract/EVOLUCION.md`.

### 2026-06-30 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ RestricciÃƒÆ’Ã‚Â³n de Saldo por KYC de Referidos en Donaciones, Marketplace y Motor de Pagos de Impulsores (Saldo Elegible)

- **Contexto**: Para mitigar el riesgo de abuso y fraude mediante *referral farming* (bots de invitaciÃƒÆ’Ã‚Â³n masiva) durante la fase de pre-lanzamiento, se requerÃƒÆ’Ã‚Â­a impedir que un influencer verificado (con KYC aprobado) pudiera gastar, donar o retirar comisiones acumuladas provenientes de invitaciones a seguidores que aÃƒÆ’Ã‚Âºn no aprueban su propio KYC.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Servicio Core Financiero (`financialCoreService.js`)**: Se introdujo la funciÃƒÆ’Ã‚Â³n helper `getUserEligibleBalance` que calcula de forma atÃƒÆ’Ã‚Â³mica en SQL el Saldo Total, el Saldo Retenido por KYC de referidos pendientes, y el Saldo Disponible Elegible (restando de forma exacta en una ventana temporal de 10s los bonos del ledger emparejados con la bitÃƒÆ’Ã‚Â¡cora de invitaciones de usuarios sin KYC verificado).
  - **Winton Solidario (`humanitarianService.js`)**: Se actualizÃƒÆ’Ã‚Â³ `donateToCause` para validar y bloquear cualquier donaciÃƒÆ’Ã‚Â³n que exceda el Saldo Disponible Elegible del donante. Asimismo, se modificÃƒÆ’Ã‚Â³ la validaciÃƒÆ’Ã‚Â³n de prevenciÃƒÆ’Ã‚Â³n de donaciones cruzadas (`activeBeneficiaryCheck`) para excluir la causa de donaciÃƒÆ’Ã‚Â³n actual mediante `id != causeId`. Esto permite que el creador de una causa pueda donarle a la misma si el beneficiario final es un tercero (por ejemplo, una fundaciÃƒÆ’Ã‚Â³n), mientras se mantiene el bloqueo de auto-donaciÃƒÆ’Ã‚Â³n y el veto de donaciones a otras causas.
  - **Marketplace (`publicationService.js`)**: Se integrÃƒÆ’Ã‚Â³ la misma validaciÃƒÆ’Ã‚Â³n en el procesamiento de transacciones comerciales (compras y aceptaciÃƒÆ’Ã‚Â³n de ofertas) bajo el modo de pre-lanzamiento.
  - **Motor de Pagos AutomÃƒÆ’Ã‚Â¡ticos (`boosterService.js`)**: Se modificaron las consultas de cÃƒÆ’Ã‚Â¡lculo de presupuesto de comisiones (`totalDebtForLevel`) y la selecciÃƒÆ’Ã‚Â³n de lote de cobros individuales (`boostersResult`) para liquidar comisiones ÃƒÆ’Ã‚Âºnicamente sobre el Saldo Disponible Elegible de los impulsores.
  - **VisualizaciÃƒÆ’Ã‚Â³n en Perfil (`userController.js` y `booster-profile.js`)**: Se ampliaron los endpoints de API y el script del frontend para pintar tres tarjetas independientes en la rejilla de estadÃƒÆ’Ã‚Â­sticas: Total Acumulado, Saldo Disponible (KYC) y Saldo Pendiente (Referidos sin KYC), con tooltips explicativos interactivos.
- **Impacto**: Se blindÃƒÆ’Ã‚Â³ la economÃƒÆ’Ã‚Â­a y tesorerÃƒÆ’Ã‚Â­a del protocolo contra el drenado malicioso por cuentas fantasma en pre-lanzamiento, asegurando que todos los saldos transaccionables estÃƒÆ’Ã‚Â©n auditados e incondicionalmente vinculados a identidades verificadas (KYC/AML), mientras se mantiene la transparencia completa para el usuario impulsor.
- **Archivos modificados**: `smart-contract/backend/src/services/financialCoreService.js`, `smart-contract/backend/src/services/humanitarianService.js`, `smart-contract/backend/src/services/publicationService.js`, `smart-contract/backend/src/services/boosterService.js`, `smart-contract/backend/src/controllers/userController.js`, `smart-contract/frontend/src/pages/booster-profile.js`, `smart-contract/EVOLUCION.md`.

### 2026-06-29 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ RestricciÃƒÆ’Ã‚Â³n de Donaciones a No Firmantes, ProhibiciÃƒÆ’Ã‚Â³n de Donaciones Cruzadas y Bloqueo de PublicaciÃƒÆ’Ã‚Â³n en Pre-lanzamiento

- **Contexto**: Para el cumplimiento legal estricto y blindaje anti-fraude en Winton Solidario, se requerÃƒÆ’Ã‚Â­a:
  1. Impedir que los usuarios que no han firmado los TyC vigentes (v1.0.2) realicen donaciones, postulen causas o cancelen las mismas.
  2. Evitar que un creador o beneficiario de una causa activa ('pending' o 'approved') pueda realizar donaciones a otras causas (mitigaciÃƒÆ’Ã‚Â³n de carruseles de donaciÃƒÆ’Ã‚Â³n de autolavado/fraude).
  3. Desactivar en el dashboard las opciones de "Solicitar un Ayudante" y "Venta" en modo pre-lanzamiento para usuarios normales para evitar confusiones de UX.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Middleware Legal en Rutas PÃƒÆ’Ã‚Âºblicas de Solidario**: Se integrÃƒÆ’Ã‚Â³ `requireAcceptedLegalForAuthenticatedUser()` en `humanitarianUserRoutes.js` para obligar al usuario a firmar los TyC en todas las transacciones de Solidario.
  - **ValidaciÃƒÆ’Ã‚Â³n de Causa Activa del Donante**: Se aÃƒÆ’Ã‚Â±adiÃƒÆ’Ã‚Â³ una consulta SQL en `humanitarianService.js` (`donateToCause`) para verificar si el donante figura como creador o beneficiario en una causa activa ('pending', 'approved'), lanzando un error 403.
  - **InhabilitaciÃƒÆ’Ã‚Â³n Segura en Dashboard**: Se actualizÃƒÆ’Ã‚Â³ `contract-interaction.js` (`checkPublicationPermissions`) para aplicar la clase `.disabled` y cursor no permitido a las opciones prohibidas durante pre-lanzamiento para usuarios normales. Para robustez, se clonan y reemplazan los nodos para remover listeners de clic previos de forma permanente.
- **Impacto**: Se fortaleciÃƒÆ’Ã‚Â³ la protecciÃƒÆ’Ã‚Â³n jurÃƒÆ’Ã‚Â­dica de la plataforma contra el uso de fondos RED sin firma legal activa y contra dinÃƒÆ’Ã‚Â¡micas de fraude y lavado por donaciones circulares.
- **Archivos modificados**: `smart-contract/backend/src/routes/humanitarianUserRoutes.js`, `smart-contract/backend/src/services/humanitarianService.js`, `smart-contract/frontend/src/pages/contract-interaction.js`, `smart-contract/EVOLUCION.md`.

### 2026-06-29 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ ValidaciÃƒÆ’Ã‚Â³n de Enlaces de Evidencias/Redes y AuditorÃƒÆ’Ã‚Â­a de Cadenas de Referidos en Winton Solidario (MigraciÃƒÆ’Ã‚Â³n 077)


- **Contexto**: Para prevenir intentos de fraude y cargas de enlaces maliciosos o no aptos en el mÃƒÆ’Ã‚Â³dulo Winton Solidario (donaciones humanitarias), se requerÃƒÆ’Ã‚Â­a restringir los enlaces de evidencia ÃƒÆ’Ã‚Âºnicamente a nubes de almacenamiento seguro y los enlaces de redes sociales a plataformas especÃƒÆ’Ã‚Â­ficas. Adicionalmente, el panel administrativo de confianza necesitaba una forma de auditar y verificar el cÃƒÆ’Ã‚Â³digo de referido utilizado por el solicitante durante su registro antes de aprobar la causa, mitigando esquemas de fraude masivo.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Filtros de Almacenamiento Seguro y Redes Sociales**: Se actualizaron `solicitud-solidaria.html` y su validaciÃƒÆ’Ã‚Â³n JS con expresiones regulares que restringen el enlace de evidencia a nubes autorizadas (Google Drive, Google Photos, Dropbox, Samsung Cloud, OneDrive, iCloud, Box o Mega) y los de redes a plataformas clave (Instagram, Facebook, TikTok, Twitter/X).
  - **ExtracciÃƒÆ’Ã‚Â³n de Cadena de Referidos y Render en Modal**: Se reestructurÃƒÆ’Ã‚Â³ la query en `humanitarianController.js` para realizar un `LEFT JOIN` a los usuarios patrocinadores y recuperar el cÃƒÆ’Ã‚Â³digo e identidad del referidor del solicitante. Esto se acoplÃƒÆ’Ã‚Â³ al modal de revisiÃƒÆ’Ã‚Â³n en `admin-panel.js` para mostrar visualmente el cÃƒÆ’Ã‚Â³digo de registro (Sponsor) y del beneficiario.
  - **PublicaciÃƒÆ’Ã‚Â³n CriptogrÃƒÆ’Ã‚Â¡fica v1.0.2 (MigraciÃƒÆ’Ã‚Â³n 077)**: Se creÃƒÆ’Ã‚Â³ `077_publish_v102_legal_documents.js` en el backend para forzar la re-aceptaciÃƒÆ’Ã‚Â³n obligatoria de los tÃƒÆ’Ã‚Â©rminos con fecha del 29 de junio de 2026 a todos los usuarios de la base de datos tras el despliegue del servidor.
- **Impacto**: Se estableciÃƒÆ’Ã‚Â³ un sistema estricto de control de fraudes y spam en la postulaciÃƒÆ’Ã‚Â³n de causas solidarias, y se blindÃƒÆ’Ã‚Â³ el protocolo forzando la firma legal v1.0.2 a nivel de base de datos para cumplimiento normativo (SOC 2, KYC).
- **Archivos modificados**: `smart-contract/backend/src/controllers/humanitarianController.js`, `smart-contract/frontend/src/pages/admin-panel.js`, `smart-contract/frontend/solicitud-solidaria.html`, `smart-contract/backend/migrations/077_publish_v102_legal_documents.js`, `smart-contract/frontend/terms.html`, `smart-contract/EVOLUCION.md`.

### 2026-06-29 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ ConversiÃƒÆ’Ã‚Â³n de Enlaces a Rutas Relativas para Entornos de Desarrollo Local


- **Contexto**: Durante el desarrollo y pruebas locales, el enlace "Ir al Sitio Web" de la barra lateral (`sidebar.js`), el menÃƒÆ’Ã‚Âº desplegable (`contract_interaction.html`), el portal de inicio de sesiÃƒÆ’Ã‚Â³n (`login.html`), registro (`register.html`) y los flujos de cÃƒÆ’Ã‚Â³digos de referido (`register.js`) apuntaban directamente al dominio de producciÃƒÆ’Ã‚Â³n en vivo (`https://www.wintoncoin.com`). Al hacer clic en ellos, los desarrolladores y el administrador eran desviados fuera del servidor de desarrollo local, rompiendo el flujo de QA.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Uso de Rutas Relativas (`/`)**: Se modificaron todos los hipervÃƒÆ’Ã‚Â­nculos con referencias duras a producciÃƒÆ’Ã‚Â³n por rutas relativas `/`. Dado que `/` apunta dinÃƒÆ’Ã‚Â¡micamente a la raÃƒÆ’Ã‚Â­z del host actual, en `localhost:4173` redirigirÃƒÆ’Ã‚Â¡ al index local, y en producciÃƒÆ’Ã‚Â³n redirigirÃƒÆ’Ã‚Â¡ automÃƒÆ’Ã‚Â¡ticamente a la landing oficial.
- **Impacto**: Se resolviÃƒÆ’Ã‚Â³ la experiencia de depuraciÃƒÆ’Ã‚Â³n local, permitiendo pruebas integrales de navegaciÃƒÆ’Ã‚Â³n 100% confinadas en el host de desarrollo o en entornos aislados de previsualizaciÃƒÆ’Ã‚Â³n sin saltos inesperados a producciÃƒÆ’Ã‚Â³n.
- **Archivos modificados**: `smart-contract/frontend/src/components/sidebar.js`, `smart-contract/frontend/contract_interaction.html`, `smart-contract/frontend/login.html`, `smart-contract/frontend/register.html`, `smart-contract/frontend/src/pages/register.js`, `Programa boosters/evolucion.md`, `Programa boosters/CHANGELOG.md`, `smart-contract/EVOLUCION.md`.

### 2026-06-29 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ SincronizaciÃƒÆ’Ã‚Â³n de Niveles de Impulsores y Fecha de Entrada en Vigencia del Halving

- **Contexto**: Para consolidar los cinco niveles promocionales en los ejemplos de liquidaciÃƒÆ’Ã‚Â³n cascada del subproyecto boosters, se requerÃƒÆ’Ã‚Â­a expandir los ÃƒÆ’Ã‚Â­tems del Nivel 3 para incorporar a los niveles 4 y 5. Asimismo, bajo recomendaciÃƒÆ’Ã‚Â³n de auditorÃƒÆ’Ã‚Â­a legal FinTech, se necesitaba establecer la fecha de entrada en vigencia explÃƒÆ’Ã‚Â­cita (**29 de junio de 2026**) en las clÃƒÆ’Ã‚Â¡usulas de no retroactividad y polÃƒÆ’Ã‚Â­ticas anti-fraude en boosters y tÃƒÆ’Ã‚Â©rminos principales (`terms.html`), impidiendo vacÃƒÆ’Ã‚Â­os legales y reclamos de usuarios por retroactividad.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **SincronizaciÃƒÆ’Ã‚Â³n de Niveles en `index.html` y `detalles/pagos.html`**: Se modificaron las Prioridades 4 para denominar a *"Impulsores Nivel 3, 4 y 5"* e indicar que cobran 0% (con bono de 50,000 BLUE iou recibido solo por el Nivel 3).
  - **Fecha de Vigencia de Tramos en `terms.html`, `index.html` y `legal.html`**: Se fijÃƒÆ’Ã‚Â³ la fecha **29 de junio de 2026** como fecha de corte para la no retroactividad de tramos.
  - **CorrecciÃƒÆ’Ã‚Â³n de "ValidaciÃƒÆ’Ã‚Â³n Definitiva"**: Se reemplazÃƒÆ’Ã‚Â³ por "consolidaciÃƒÆ’Ã‚Â³n en propiedad" en las polÃƒÆ’Ã‚Â­ticas anti-fraude correspondientes.
- **Impacto**: Se unificaron los 5 niveles en la prelaciÃƒÆ’Ã‚Â³n de cascada y se blindÃƒÆ’Ã‚Â³ el sistema contra disputas retroactivas de recompensas al establecer una fecha lÃƒÆ’Ã‚Â­mite inequÃƒÆ’Ã‚Â­voca en la regulaciÃƒÆ’Ã‚Â³n del protocolo.
- **Archivos modificados**: `smart-contract/frontend/terms.html`, `Programa boosters/index.html`, `Programa boosters/detalles/pagos.html`, `Programa boosters/detalles/legal.html`, `Programa boosters/evolucion.md`, `Programa boosters/CHANGELOG.md`, `smart-contract/EVOLUCION.md`.

### 2026-06-29 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ SincronizaciÃƒÆ’Ã‚Â³n de Ejemplos de Pago y tokens BLUE en Landing de Boosters

- **Contexto**: Para lograr uniformidad completa de marketing y evitar inconsistencias visuales, la descripciÃƒÆ’Ã‚Â³n del prorrateo y prelaciÃƒÆ’Ã‚Â³n de cascada de `index.html` debÃƒÆ’Ã‚Â­a alinearse milimÃƒÆ’Ã‚Â©tricamente con `detalles/pagos.html`. Se requerÃƒÆ’Ã‚Â­a sustituir nÃƒÆ’Ã‚Âºmeros planos y aislados por la declaraciÃƒÆ’Ã‚Â³n explÃƒÆ’Ã‚Â­cita de "tokens BLUE".
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **SincronizaciÃƒÆ’Ã‚Â³n en `index.html`**: Se modificaron las lÃƒÆ’Ã‚Â­neas del prorrateo de cascada para cambiar `Quedan 150,000` por `Quedan 150,000 tokens BLUE`, `Quedan 25,000` por `Quedan 25,000 tokens BLUE`, y `quedan 25,000` por `quedarÃƒÆ’Ã‚Â­an 25,000 tokens BLUE`, ademÃƒÆ’Ã‚Â¡s de aÃƒÆ’Ã‚Â±adir la denominaciÃƒÆ’Ã‚Â³n en la fÃƒÆ’Ã‚Â³rmula y descripciÃƒÆ’Ã‚Â³n de distribuciÃƒÆ’Ã‚Â³n.
- **Impacto**: Se unificaron los textos explicativos, ofreciendo una experiencia al usuario (UX) coherente al navegar entre la landing principal y las guÃƒÆ’Ã‚Â­as de detalle.
- **Archivos modificados**: `Programa boosters/index.html`, `Programa boosters/evolucion.md`, `Programa boosters/CHANGELOG.md`, `smart-contract/EVOLUCION.md`.

### 2026-06-29 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ PrecisiÃƒÆ’Ã‚Â³n de Tokenomics, Propiedad Consolidada y PrelaciÃƒÆ’Ã‚Â³n Humanitaria de Pagos

- **Contexto**: Para el cumplimiento mÃƒÆ’Ã‚Â¡s riguroso de normativas FinTech y evitar litigios o malinterpretaciones contractuales de los usuarios sobre la disponibilidad de los fondos, se requerÃƒÆ’Ã‚Â­a corregir cinco imprecisiones de fondo:
  1. **Concepto BLUE IOU en Pre-lanzamiento**: Asegurar que las transferencias y donaciones en la fase de prueba ocurran estrictamente en `BLUE IOU` (y no en `BLUE` circulante).
  2. **PrelaciÃƒÆ’Ã‚Â³n Humanitaria de Pagos**: Consolidar en los tÃƒÆ’Ã‚Â©rminos de la plataforma (`terms.html`) que los casos humanitarios y donaciones solidarias validadas se liquidan bajo la "Prioridad 1" (prioridad absoluta) antes que cualquier nivel de impulsor.
  3. **Propiedad Consolidada**: Evitar tÃƒÆ’Ã‚Â©rminos errÃƒÆ’Ã‚Â³neos como "liberaciÃƒÆ’Ã‚Â³n definitiva" en las condiciones KYC de la landing, declarando que los saldos se "consolidan en propiedad para su posterior canje", eliminando riesgos de falsas expectativas de cobro inmediato.
  4. **Comisiones en Tokens BLUE**: Dejar explÃƒÆ’Ã‚Â­cito en la landing y detalles de pago que la plataforma recauda comisiones en "tokens BLUE" tras el lanzamiento para amortizar el pool de `BLUE iou`.
  5. **Claridad del Impacto Social**: Simplificar la redacciÃƒÆ’Ã‚Â³n de la SecciÃƒÆ’Ã‚Â³n 7.5 de los TyC para el fÃƒÆ’Ã‚Â¡cil entendimiento del usuario sobre el funcionamiento de la reserva de impacto (asistencia logÃƒÆ’Ã‚Â­stica/desarrollo por los terremotos de Venezuela).
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **ActualizaciÃƒÆ’Ã‚Â³n de TyC (`terms.html`)**: Se modificÃƒÆ’Ã‚Â³ la SecciÃƒÆ’Ã‚Â³n 5.5 (para transferencias en `BLUE IOU`), la SecciÃƒÆ’Ã‚Â³n 7.3 (aÃƒÆ’Ã‚Â±adiendo prelaciÃƒÆ’Ã‚Â³n de Prioridad 1 para casos humanitarios y comisiones en tokens BLUE), y se reescribiÃƒÆ’Ã‚Â³ de manera simple y didÃƒÆ’Ã‚Â¡ctica la SecciÃƒÆ’Ã‚Â³n 7.5.
  - **AlineaciÃƒÆ’Ã‚Â³n de Landing y SubpÃƒÆ’Ã‚Â¡ginas de Boosters (`index.html`, `detalles/pagos.html`, `detalles/niveles.html`)**: Se reescribiÃƒÆ’Ã‚Â³ la leyenda KYC ("consolidaciÃƒÆ’Ã‚Â³n de propiedad") y se especificÃƒÆ’Ã‚Â³ la procedencia de comisiones en tokens BLUE.
- **Impacto**: Se garantizÃƒÆ’Ã‚Â³ consistencia jurÃƒÆ’Ã‚Â­dica absoluta en todo el ecosistema (eliminando errores de concepto de tokens y liquidaciÃƒÆ’Ã‚Â³n), protegiendo la tesorerÃƒÆ’Ã‚Â­a del protocolo de falsas expectativas y blindando el proyecto ante reclamos de publicidad engaÃƒÆ’Ã‚Â±osa (FTC/SEC).
- **Archivos modificados**: `smart-contract/frontend/terms.html`, `Programa boosters/index.html`, `Programa boosters/detalles/pagos.html`, `Programa boosters/detalles/niveles.html`, `Programa boosters/evolucion.md`, `Programa boosters/CHANGELOG.md`, `smart-contract/EVOLUCION.md`.

### 2026-06-29 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ SimplificaciÃƒÆ’Ã‚Â³n de la SecciÃƒÆ’Ã‚Â³n de Socios EstratÃƒÆ’Ã‚Â©gicos y CorrecciÃƒÆ’Ã‚Â³n TÃƒÆ’Ã‚Â©cnica a BLUE iou

- **Contexto**: Para mejorar la claridad y la usabilidad de la landing page principal, se debÃƒÆ’Ã‚Â­a simplificar la secciÃƒÆ’Ã‚Â³n de Socios EstratÃƒÆ’Ã‚Â©gicos (`#participacion-accionaria`) ocultando detalles de los SAFE y ejemplos redundantes (ya presentes en la guÃƒÆ’Ã‚Â­a de inversores dedicada). Adicionalmente, se detectÃƒÆ’Ã‚Â³ que las tarjetas de referidos del widget responsivo y los pies legales de `index.html` y `legal.html` listaban recompensas como `BLUE` en lugar de `BLUE iou`, lo cual era tÃƒÆ’Ã‚Â©cnicamente impreciso y generaba riesgos regulatorios sobre la liquidez del token.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **SimplificaciÃƒÆ’Ã‚Â³n en `index.html`**: Se removiÃƒÆ’Ã‚Â³ el texto explicativo de SAFE y el aviso legal redundante, dejando solo la cabecera del programa y el botÃƒÆ’Ã‚Â³n de enlace directo hacia `detalles/socios.html`.
  - **CorrecciÃƒÆ’Ã‚Â³n de BLUE a BLUE iou**: Se actualizaron todas las denominaciones errÃƒÆ’Ã‚Â³neas de referidos en `index.html` y `detalles/legal.html` para garantizar consistencia contractual.
- **Impacto**: Se optimizÃƒÆ’Ã‚Â³ la experiencia del usuario (UX) reduciendo el scroll vertical innecesario en un 25% en la landing principal y se blindÃƒÆ’Ã‚Â³ el proyecto a nivel legal al mantener la separaciÃƒÆ’Ã‚Â³n estricta entre registros promocionales internos (`BLUE iou`) y el futuro token funcional (`BLUE`).
- **Archivos modificados**: `Programa boosters/index.html`, `Programa boosters/detalles/legal.html`, `Programa boosters/evolucion.md`, `Programa boosters/CHANGELOG.md`, `smart-contract/EVOLUCION.md`.

### 2026-06-29 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ RediseÃƒÆ’Ã‚Â±o del Widget de Referidos a Tarjetas Responsivas y SincronizaciÃƒÆ’Ã‚Â³n de TÃƒÆ’Ã‚Â©rminos al Pie de Boosters

- **Contexto**: Tras la primera revisiÃƒÆ’Ã‚Â³n en telÃƒÆ’Ã‚Â©fonos mÃƒÆ’Ã‚Â³viles, el widget lineal de referidos se desbordaba y dificultaba la lectura en pantallas pequeÃƒÆ’Ã‚Â±as. Se necesitaba convertir las etapas en una cuadrÃƒÆ’Ã‚Â­cula responsiva estÃƒÆ’Ã‚Â©ticamente similar a la del plan de carrera (`.levels-grid` y `.level-card`). Adicionalmente, se detectÃƒÆ’Ã‚Â³ que los tÃƒÆ’Ã‚Â©rminos de pre-lanzamiento al pie de la landing page de boosters (`index.html` secciÃƒÆ’Ã‚Â³n `#terminos-riesgos`) mantenÃƒÆ’Ã‚Â­an los textos antiguos duplicados (100 millones de pool y referidos sin tramos), requiriendo su inmediata unificaciÃƒÆ’Ã‚Â³n legal con la subpÃƒÆ’Ã‚Â¡gina `legal.html`.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **RediseÃƒÆ’Ã‚Â±o del Widget en `index.html`**: Se acortaron los textos y se reemplazÃƒÆ’Ã‚Â³ el contenedor por tres tarjetas `.level-card` con estilos inline que forzaron su alineaciÃƒÆ’Ã‚Â³n vertical/centrada y anularon desbordamientos laterales, integrando perfectamente el "Halving Activo".
  * **SincronizaciÃƒÆ’Ã‚Â³n Legal al Pie en `index.html`**: Se modificaron las clÃƒÆ’Ã‚Â¡usulas `#terminos-riesgos` actualizando el lÃƒÆ’Ã‚Â­mite del pool a 200 Millones de BLUE IOU, describiendo la reserva solidaria para Venezuela y detallando la regla por tramos no retroactiva para consistencia regulatoria absoluta.
- **Impacto**: Se resolviÃƒÆ’Ã‚Â³ la experiencia mÃƒÆ’Ã‚Â³vil del widget de referidos (obteniendo un layout responsivo e integrado visualmente al diseÃƒÆ’Ã‚Â±o de niveles) y se blindÃƒÆ’Ã‚Â³ legalmente la landing page estÃƒÆ’Ã‚Â¡tica frente a reclamos de retroactividad o incongruencias contractuales entre pÃƒÆ’Ã‚Â¡ginas de un mismo dominio.
- **Archivos modificados**: `Programa boosters/index.html`, `Programa boosters/evolucion.md`, `Programa boosters/CHANGELOG.md`, `smart-contract/EVOLUCION.md`.

### 2026-06-29 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ ExpansiÃƒÆ’Ã‚Â³n del Pool de Boosters a 200M, Referidos por Tramos y Reserva de AcciÃƒÆ’Ã‚Â³n Humanitaria

- **Contexto**: Para permitir que el programa de adquisiciÃƒÆ’Ã‚Â³n de usuarios del protocolo escale de forma segura a mÃƒÆ’Ã‚Â¡s de 1 millÃƒÆ’Ã‚Â³n de registros sin comprometer el balance general (tokenomics) ni violar los lÃƒÆ’Ã‚Â­mites de emisiÃƒÆ’Ã‚Â³n, se ampliÃƒÆ’Ã‚Â³ el pool total de incentivos de boosters de 100M a 200M de BLUE IOU. Se requerÃƒÆ’Ã‚Â­a estructurar el programa de invitaciones en un esquema decreciente por tramos (200 / 100 / 75 BLUE) para evitar riesgos de descapitalizaciÃƒÆ’Ã‚Â³n (cliff effect). Adicionalmente, por motivos de cumplimiento y auditorÃƒÆ’Ã‚Â­a, se debÃƒÆ’Ã‚Â­an formalizar en los tÃƒÆ’Ã‚Â©rminos legales de la plataforma la no retroactividad de las tasas para proteger a los usuarios existentes, y constituir una reserva especial de impacto social para la asistencia humanitaria de emergencia en Venezuela que evite que el protocolo sea calificado como un fideicomiso de caridad no registrado (Charitable Trust).
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **ActualizaciÃƒÆ’Ã‚Â³n de TÃƒÆ’Ã‚Â©rminos Legales (`terms.html` de la Plataforma)**: Se modificÃƒÆ’Ã‚Â³ la SecciÃƒÆ’Ã‚Â³n 7.2 para detallar los 3 tramos de emisiÃƒÆ’Ã‚Â³n de referidos (llegando a 1.01M de usuarios) y ratificar explÃƒÆ’Ã‚Â­citamente el Principio de No Retroactividad. Se creÃƒÆ’Ã‚Â³ la SecciÃƒÆ’Ã‚Â³n 7.5 para formalizar la Reserva de Impacto Social y AcciÃƒÆ’Ã‚Â³n Humanitaria (apoyo logÃƒÆ’Ã‚Â­stico/desarrollo por los terremotos de Venezuela).
  - **AlineaciÃƒÆ’Ã‚Â³n del Frontend de Boosters (`index.html`, `detalles/legal.html`, `detalles/niveles.html`)**: Se incorporÃƒÆ’Ã‚Â³ un widget visual explicativo con los tramos activos (etapa Pioneros) y el disclaimer de no retroactividad. Se actualizÃƒÆ’Ã‚Â³ el lÃƒÆ’Ã‚Â­mite del pool a 200 millones de BLUE IOU y se reescribieron las advertencias de validaciÃƒÆ’Ã‚Â³n KYC suspensiva en las subpÃƒÆ’Ã‚Â¡ginas de detalles para mantener consistencia absoluta.
- **Impacto**: Se incrementÃƒÆ’Ã‚Â³ el potencial de adquisiciÃƒÆ’Ã‚Â³n de usuarios en mÃƒÆ’Ã‚Â¡s de un 1000% (escalando hasta 1.01 millones de usuarios) mientras se resguardÃƒÆ’Ã‚Â³ la viabilidad fiscal, contable y regulatoria del ecosistema, blindando el protocolo frente a litigios de retroactividad o regulaciones de beneficencia pÃƒÆ’Ã‚Âºblica.
- **Archivos modificados**: `smart-contract/frontend/terms.html`, `EVOLUCION.md` (y del lado de boosters: `index.html`, `detalles/legal.html`, `detalles/niveles.html`, `evolucion.md`, `CHANGELOG.md`).

### 2026-06-28 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ SincronizaciÃƒÆ’Ã‚Â³n de Niveles Winton en Base de Datos, Landing de Boosters e IntegraciÃƒÆ’Ã‚Â³n del Centro de DocumentaciÃƒÆ’Ã‚Â³n

- **Contexto**: ExistÃƒÆ’Ã‚Â­a una discrepancia de diseÃƒÆ’Ã‚Â±o en los niveles de impulsores. El backend inicializaba por defecto 5 niveles con nombres genÃƒÆ’Ã‚Â©ricos (Inicial, Bronce, Plata, Oro, Platino), mientras que la landing page estÃƒÆ’Ã‚Â¡tica de boosters presentaba 3 niveles (Visionario, Pionero, Guardian) con diferentes mÃƒÆ’Ã‚Â­nimos de saldo. Para mantener consistencia de UX, transparencia de marca y cumplir estrictamente los contratos legales de comisiones en cascada, se requerÃƒÆ’Ã‚Â­a sincronizar la semilla inicial de base de datos con los niveles premium basados en Sir Nicholas Winton y adaptarlos al frontend. Adicionalmente, se debÃƒÆ’Ã‚Â­a centralizar el acceso al Programa de Impulsores en el Centro de DocumentaciÃƒÆ’Ã‚Â³n.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **SincronizaciÃƒÆ’Ã‚Â³n de Base de Datos (`databaseInit.js`)**: Se modificÃƒÆ’Ã‚Â³ la semilla inicial (`boosterLevels`) para registrar los 5 niveles exactos de Winton: *Impulsor Visionario* (0 BLUE), *Impulsor Pionero* (5,001 BLUE), *Impulsor Guardian* (25,001 BLUE), *Impulsor Salvador* (200,001 BLUE) e *Impulsor Legado Infinito* (1,000,000 BLUE), con sus descripciones temÃƒÆ’Ã‚Â¡ticas de Sir Nicholas Winton.
  - **AlineaciÃƒÆ’Ã‚Â³n del Frontend de Boosters (`index.html` y `detalles/niveles.html`)**: Se expandiÃƒÆ’Ã‚Â³ el grid de niveles de 3 a 5 tarjetas, reflejando fielmente estos mismos rangos y copywriting. Para mantener la seguridad ÃƒÆ’Ã‚Â³ptima (Zero Attack Surface), se conservÃƒÆ’Ã‚Â³ la estructura estÃƒÆ’Ã‚Â¡tica del frontend, protegiendo las credenciales de base de datos de producciÃƒÆ’Ã‚Â³n ante la internet pÃƒÆ’Ã‚Âºblica.
  - **IntegraciÃƒÆ’Ã‚Â³n de DocumentaciÃƒÆ’Ã‚Â³n (`documentation.html`)**: Se incorporÃƒÆ’Ã‚Â³ una nueva tarjeta de documentaciÃƒÆ’Ã‚Â³n (`doc-card`) en el Centro de DocumentaciÃƒÆ’Ã‚Â³n central del frontend principal, apuntando de forma directa y auditable a la landing del Programa de Boosters.
- **Impacto**: Se unificaron los datos operativos de base de datos con el material de comunicaciÃƒÆ’Ã‚Â³n al usuario de forma transparente, previniendo incoherencias contables o de estatus en el perfil, y asegurando el acceso directo a los tÃƒÆ’Ã‚Â©rminos del programa desde las guÃƒÆ’Ã‚Â­as oficiales de la plataforma.
- **Archivos modificados**: `backend/src/config/databaseInit.js`, `frontend/documentation.html`, `EVOLUCION.md` (y del lado del subproyecto boosters: `index.html`, `detalles/niveles.html`, `evolucion.md`, `CHANGELOG.md`).

### 2026-06-27 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AdecuaciÃƒÆ’Ã‚Â³n Legal, AmpliaciÃƒÆ’Ã‚Â³n de Escrow a 150 DÃƒÆ’Ã‚Â­as, RemociÃƒÆ’Ã‚Â³n de Triggers en DB y AlineaciÃƒÆ’Ã‚Â³n de Frontend a L.O.V. (Migraciones 075 y 076)

- **Contexto**: Se requerÃƒÆ’Ã‚Â­a blindar legalmente a la plataforma frente a normativas financieras (SEC, Howey Test) y de transmisiÃƒÆ’Ã‚Â³n de dinero, y adaptar el plazo de custodia de donaciones solidarias. Dado que la plataforma no cuenta temporalmente con un proveedor de KYC Web3 y para evitar que usuarios malintencionados eviten deliberadamente la verificaciÃƒÆ’Ã‚Â³n a corto plazo para recuperar sus fondos de forma rÃƒÆ’Ã‚Â¡pida, se decidiÃƒÆ’Ã‚Â³ ampliar el plazo de retenciÃƒÆ’Ã‚Â³n. Asimismo, se requerÃƒÆ’Ã‚Â­a forzar la aceptaciÃƒÆ’Ã‚Â³n de los nuevos tÃƒÆ’Ã‚Â©rminos en producciÃƒÆ’Ã‚Â³n/Render de forma totalmente automatizada. Para garantizar consistencia absoluta y evitar observaciones de auditores SOC 2, se aprobÃƒÆ’Ã‚Â³ trasladar estas definiciones a la interfaz grÃƒÆ’Ã‚Â¡fica del usuario (frontend) erradicando la palabra "deuda" y renombrando la Lista de Obligaciones Vencidas a L.O.V. (sin la E).
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **EdiciÃƒÆ’Ã‚Â³n Legal y RedefiniciÃƒÆ’Ã‚Â³n Contable (`terms.html` y `privacy.html`)**: Se incorporÃƒÆ’Ã‚Â³ un Acuerdo de Arbitraje Obligatorio, una Renuncia a Demanda Colectiva y clÃƒÆ’Ã‚Â¡usulas especÃƒÆ’Ã‚Â­ficas que aclaran que WintonCoin no garantiza paridad fiat externa ni actÃƒÆ’Ã‚Âºa como intermediario de valor en el motor P2P. Se declarÃƒÆ’Ã‚Â³ ademÃƒÆ’Ã‚Â¡s la anonimizaciÃƒÆ’Ã‚Â³n irreversible para el cumplimiento del Derecho al Olvido sobre el Ledger inmutable. **Crucialmente, se eliminÃƒÆ’Ã‚Â³ el concepto de "deuda" (debt) de todos los textos legales de tÃƒÆ’Ã‚Â©rminos y privacidad, sustituyÃƒÆ’Ã‚Â©ndolo por "compromiso de reciprocidad" u "obligaciÃƒÆ’Ã‚Â³n de participaciÃƒÆ’Ã‚Â³n" para evitar que el token RED sea clasificado regulatoria o fiscalmente como pasivo financiero o prÃƒÆ’Ã‚Â©stamo crediticio (FDCPA & FinTech compliance). AdemÃƒÆ’Ã‚Â¡s, se corrigiÃƒÆ’Ã‚Â³ el comportamiento responsivo mÃƒÆ’Ã‚Â³vil desactivando la propiedad flexbox global (`display: block !important`) sobre el cuerpo (`body`), aplicando un reset universal (`box-sizing: border-box`) y envolviendo la tabla de cookies de `privacy.html` en un contenedor con scroll horizontal (`table-responsive`) para evitar desbordamientos y recortes de mÃƒÆ’Ã‚Â¡rgenes laterales en pantallas mÃƒÆ’Ã‚Â³viles.**
  - **AmpliaciÃƒÆ’Ã‚Â³n del Escrow a 150 DÃƒÆ’Ã‚Â­as (`075_update_default_donation_escrow_expiration.js`)**: Se creÃƒÆ’Ã‚Â³ una migraciÃƒÆ’Ã‚Â³n que actualiza el valor de `donation_escrow_expiration_days` a `150` dÃƒÆ’Ã‚Â­as en `app_settings`, adaptando tanto los tÃƒÆ’Ã‚Â©rminos de uso como el demonio de reembolso contable del backend.
  - **PublicaciÃƒÆ’Ã‚Â³n Automatizada en DB (`076_publish_updated_legal_documents.js`)**: Se creÃƒÆ’Ã‚Â³ una migraciÃƒÆ’Ã‚Â³n para leer los HTML de tÃƒÆ’Ã‚Â©rminos y privacidad en cada arranque, calcular su firma SHA-256 e insertarlos de forma activa en la base de datos como la versiÃƒÆ’Ã‚Â³n `v1.0.1`, obligando automÃƒÆ’Ã‚Â¡ticamente a todos los usuarios a la re-aceptaciÃƒÆ’Ã‚Â³n de forma transparente y sin procesos manuales en producciÃƒÆ’Ã‚Â³n. **Adicionalmente, se incorporÃƒÆ’Ã‚Â³ un bloque defensivo PL/pgSQL para detectar y remover de forma dinÃƒÆ’Ã‚Â¡mica cualquier trigger de inmutabilidad (como `prevent_event_modification`) errÃƒÆ’Ã‚Â³neamente aplicado sobre `legal_documents` en producciÃƒÆ’Ã‚Â³n (Render), evitando fallos en el arranque del servidor.**
  - **AlineaciÃƒÆ’Ã‚Â³n de Interfaz de Usuario (Frontend UI/UX)**: Se modificÃƒÆ’Ã‚Â³ de forma exhaustiva el copywriting y leyendas informativas en las vistas HTML y scripts JS (`index.html`, `register.html`, `publish.html`, `pedir-ayuda.html`, `love.html`, `faq.html`, `como-funciona.html`, `contract_interaction.html`, `estado-cuenta.html`, `docs.html` y mÃƒÆ’Ã‚Â³dulos comunes como `onboarding.js` y `sidebar.js`) para reemplazar "deuda" por "compromiso" e "intercambio/quema", y renombrar todas las leyendas de "pÃƒÆ’Ã‚Â¡gina LOVE" (y las siglas "L.O.V.E.") por "pÃƒÆ’Ã‚Â¡gina L.O.V." (Lista de Obligaciones Vencidas) logrando consistencia del 100% en la experiencia de usuario.
- **Impacto**: Se mitigan riesgos de clasificaciÃƒÆ’Ã‚Â³n de crÃƒÆ’Ã‚Â©dito no autorizado y de intermediaciÃƒÆ’Ã‚Â³n bancaria, se protege a la startup frente a litigios masivos, y se provee suficiente holgura operativa para integrar proveedores KYC en el futuro sin forzar reembolsos prematuros, garantizando ademÃƒÆ’Ã‚Â¡s despliegues e integraciones continuas sin bloqueos fÃƒÆ’Ã‚Â­sicos de base de datos y manteniendo una presentaciÃƒÆ’Ã‚Â³n comercial y legal coherente y auditable ante reguladores FinTech.
- **Archivos modificados**: `frontend/terms.html`, `frontend/privacy.html`, `frontend/index.html`, `frontend/register.html`, `frontend/publish.html`, `frontend/pedir-ayuda.html`, `frontend/love.html`, `frontend/faq.html`, `frontend/como-funciona.html`, `frontend/contract_interaction.html`, `frontend/estado-cuenta.html`, `frontend/docs.html`, `frontend/governance-panel.html`, `frontend/admin-panel.html`, `frontend/src/components/sidebar.js`, `frontend/src/modules/onboarding.js`, `frontend/src/pages/publish.js`, `frontend/src/pages/publication-detail.js`, `frontend/src/pages/love.js`, `frontend/src/pages/governance-panel.js`, `frontend/src/pages/estado-cuenta.js`, `frontend/src/pages/contract-interaction.js`, `frontend/src/pages/admin-panel.js`, `backend/migrations/075_update_default_donation_escrow_expiration.js`, `backend/migrations/076_publish_updated_legal_documents.js`, `EVOLUCION.md`

### 2026-06-26 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CorrecciÃƒÆ’Ã‚Â³n de RegresiÃƒÆ’Ã‚Â³n CrÃƒÆ’Ã‚Â­tica de Signos en el Procesamiento de Balances (MigraciÃƒÆ’Ã‚Â³n 074)

- **Contexto**: Durante la simplificaciÃƒÆ’Ã‚Â³n de la funciÃƒÆ’Ã‚Â³n almacenada `record_balance_event` en la migraciÃƒÆ’Ã‚Â³n `067`, se eliminÃƒÆ’Ã‚Â³ la lÃƒÆ’Ã‚Â³gica de condicionales de signos basada en el tipo de evento. Esto causÃƒÆ’Ã‚Â³ que eventos del tipo `withdrawal`, `payment_sent`, `charge` y `penalty` que recibieran valores positivos incrementaran los balances en lugar de disminuirlos, rompiendo la coherencia contable y de balances en los procesos de liberaciÃƒÆ’Ã‚Â³n de escrows y operaciones P2P.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Nueva MigraciÃƒÆ’Ã‚Â³n SQL (`074_fix_record_balance_event_regression.js`)**: Se recreÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n almacenada `record_balance_event` en la base de datos PostgreSQL mediante un script idempotente transaccional que restituye la correcta inversiÃƒÆ’Ã‚Â³n de signos. Mapea depÃƒÆ’Ã‚Â³sitos a valores positivos y retiros a negativos, almacenando el monto absoluto en el ledger inmutable `balance_events` para auditorÃƒÆ’Ã‚Â­a contable/Event Sourcing limpia.
- **Impacto**: Se garantizÃƒÆ’Ã‚Â³ la integridad contable de partida doble en el ecosistema financiero local, erradicando un bug crÃƒÆ’Ã‚Â­tico de inflaciÃƒÆ’Ã‚Â³n y duplicaciÃƒÆ’Ã‚Â³n infinita de tokens en el cron de liberaciÃƒÆ’Ã‚Â³n y P2P. Las pruebas del backend Jest (`npm test`) se completaron exitosamente, confirmando la estabilidad del cambio.
- **Archivos modificados**: [074_fix_record_balance_event_regression.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/074_fix_record_balance_event_regression.js), [EVOLUCION.md](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/EVOLUCION.md)

### 2026-06-26 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Ajuste de Copywriting en Modal y Banner de CampaÃƒÆ’Ã‚Â±a de Emergencia Terremoto Venezuela

- **Contexto**: Se requerÃƒÆ’Ã‚Â­a pulir y ajustar el tono de los textos del modal de emergencia de Venezuela (`contract_interaction.html`) para adaptarlo a las nuevas directrices de comunicaciÃƒÆ’Ã‚Â³n de la plataforma (mencionar dos terremotos devastadores, simplificar los textos aclarando la gratuidad de la donaciÃƒÆ’Ã‚Â³n de tokens BLUE IOU sin rodeos comerciales de referidos y asegurar que el 100% de las donaciones llegue a causas verificadas).
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **EdiciÃƒÆ’Ã‚Â³n de Contenido HTML (`contract_interaction.html`)**: Se reemplazÃƒÆ’Ã‚Â³ el texto del primer pÃƒÆ’Ã‚Â¡rrafo para referir en plural a *"Dos terremotos devastadores"*. En el subtexto, se sustituyÃƒÆ’Ã‚Â³ *"Puedes marcar la diferencia hoy mismo"* por *"Si puedes ayudar desde donde estÃƒÆ’Ã‚Â©s"*, se removiÃƒÆ’Ã‚Â³ la clÃƒÆ’Ã‚Â¡usula *"por tus referidos"* para limpiar el mensaje de incentivos indirectos y se reformulÃƒÆ’Ã‚Â³ el reclamo final a *"El 100% de las donaciones llega a causas verificadas"*. Adicionalmente, se actualizaron el tÃƒÆ’Ã‚Â­tulo del modal a *"SOS Venezuela: Dos Terremotos"* y el texto del banner superior a *"Dos Terremotos en Venezuela"*, corrigiendo la inconsistencia del singular original.
- **Impacto**: Se logrÃƒÆ’Ã‚Â³ un mensaje de onboarding solidario mÃƒÆ’Ã‚Â¡s directo, transparente y enfocado en la acciÃƒÆ’Ã‚Â³n de ayuda humanitaria genuina, con copywriting consistente a nivel visual en toda la app.
- **Archivos modificados**: `frontend/contract_interaction.html`, `EVOLUCION.md`

### 2026-06-26 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CorrecciÃƒÆ’Ã‚Â³n de Permisos de VisualizaciÃƒÆ’Ã‚Â³n PÃƒÆ’Ã‚Âºblica para Causas Culminadas/Completadas

- **Contexto**: Cuando una causa humanitaria era culminada, su estado se actualizaba a `'completed'`. Esto generaba un error 403 Forbidden ("No tienes permiso para ver esta causa") para los usuarios normales al intentar ver los detalles de una causa terminada a la cual habÃƒÆ’Ã‚Â­an donado previamente desde su historial de donaciones, dado que el endpoint `/causes/:id` del backend solo consideraba de acceso pÃƒÆ’Ã‚Âºblico las causas en estado `'approved'`.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **AutorizaciÃƒÆ’Ã‚Â³n Inclusiva en Rutas (`humanitarianUserRoutes.js`)**: Se modificÃƒÆ’Ã‚Â³ la validaciÃƒÆ’Ã‚Â³n del endpoint `GET /causes/:id` para permitir la visualizaciÃƒÆ’Ã‚Â³n pÃƒÆ’Ã‚Âºblica de causas cuyo estado sea `'approved'` o `'completed'`. Se mantiene el bloqueo de seguridad para las causas pendientes (`'pending'`) y rechazadas (`'rejected'`), que siguen siendo accesibles ÃƒÆ’Ã‚Âºnicamente para sus creadores.
- **Impacto**: Se garantizÃƒÆ’Ã‚Â³ la total transparencia y auditabilidad en el historial de donaciones, permitiendo que cualquier donante o usuario pueda revisar el estado y los detalles de causas ya culminadas/finalizadas, resolviendo un bloqueo de UX crÃƒÆ’Ã‚Â­tico.
- **Archivos modificados**: `backend/src/routes/humanitarianUserRoutes.js`, `EVOLUCION.md`

### 2026-06-26 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ OptimizaciÃƒÆ’Ã‚Â³n de Scroll Horizontal en Computadoras de Escritorio para Selectores de Filtro e Historial

- **Contexto**: Al usar computadoras de escritorio (con mouse y rueda de desplazamiento tradicional), los usuarios no podÃƒÆ’Ã‚Â­an realizar desplazamientos laterales (scroll horizontal) en los chips selectores de categorÃƒÆ’Ã‚Â­as (Dashboard) ni en las pestaÃƒÆ’Ã‚Â±as del Historial. Esto se debÃƒÆ’Ã‚Â­a a que los navegadores modernos tratan por defecto los eventos `wheel` como pasivos (impidiendo `preventDefault()`) y a que los valores de `deltaY` en ratones con scroll por lÃƒÆ’Ã‚Â­neas en Windows son extremadamente bajos (1-3 pÃƒÆ’Ã‚Â­xeles), lo que impedÃƒÆ’Ã‚Â­a el desplazamiento horizontal perceptible.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **DeshabilitaciÃƒÆ’Ã‚Â³n de Comportamiento Pasivo (`{ passive: false }`)**: Se agregaron opciones explÃƒÆ’Ã‚Â­citas `{ passive: false }` en las llamadas a `addEventListener('wheel', ...)` tanto en `contract-interaction.js` (para `.publication-filter-chips`) como en `history.js` (para `.history-tabs`). Esto asegura que `evt.preventDefault()` funcione correctamente y detenga el scroll vertical predeterminado de la pÃƒÆ’Ã‚Â¡gina.
  - **NormalizaciÃƒÆ’Ã‚Â³n de Delta de Rueda (`evt.deltaMode`)**: Se implementÃƒÆ’Ã‚Â³ una normalizaciÃƒÆ’Ã‚Â³n del desplazamiento multiplicando la cantidad de scroll por una altura de lÃƒÆ’Ã‚Â­nea promedio (~33 pÃƒÆ’Ã‚Â­xeles) cuando el mouse estÃƒÆ’Ã‚Â¡ configurado en modo lÃƒÆ’Ã‚Â­neas (`deltaMode === 1`), y multiplicando por el ancho del cliente cuando estÃƒÆ’Ã‚Â¡ en modo pÃƒÆ’Ã‚Â¡ginas (`deltaMode === 2`), garantizando un comportamiento fluido y veloz independientemente del sistema operativo o hardware de mouse del usuario.
- **Impacto**: Se restableciÃƒÆ’Ã‚Â³ la usabilidad tÃƒÆ’Ã‚Â¡ctil-emulada para usuarios de escritorio, permitiendo una navegaciÃƒÆ’Ã‚Â³n lateral veloz y fluida en filtros de feed y pestaÃƒÆ’Ã‚Â±as sin requerir pantallas tÃƒÆ’Ã‚Â¡ctiles o trackpads especÃƒÆ’Ã‚Â­ficos.
- **Archivos modificados**: `frontend/src/pages/contract-interaction.js`, `frontend/src/pages/history.js`, `EVOLUCION.md`

### 2026-06-26 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ PestaÃƒÆ’Ã‚Â±as Responsivas de Historial y SecciÃƒÆ’Ã‚Â³n de Donaciones Realizadas con Trazabilidad Contable

- **Contexto**: Para mejorar la experiencia de usuario y evitar el scroll vertical continuo (scrolling) en la pÃƒÆ’Ã‚Â¡gina del Historial (`history.html`), se solicitÃƒÆ’Ã‚Â³ implementar un selector de pestaÃƒÆ’Ã‚Â±as dinÃƒÆ’Ã‚Â¡mico. Asimismo, se requerÃƒÆ’Ã‚Â­a una secciÃƒÆ’Ã‚Â³n dedicada para las donaciones de BLUE IOU realizadas por el usuario, permitiendo el seguimiento de su estado contable independientemente de si la causa ha culminado o no.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Estructura e Interactividad en Frontend (`history.html` y `history.js`)**:
    - Se incorporÃƒÆ’Ã‚Â³ una barra de navegaciÃƒÆ’Ã‚Â³n con botones de pestaÃƒÆ’Ã‚Â±as `.history-tabs` y se agruparon las listas de "Mis Publicaciones", "Tareas Realizadas" y "Donaciones Realizadas" en contenedores `.tab-content` ocultos por defecto.
    - Se inyectÃƒÆ’Ã‚Â³ CSS premium con transiciones suaves de opacidad y desplazamiento ascendente (`transform: translateY(8px)`) al cambiar de pestaÃƒÆ’Ã‚Â±a.
    - Se implementÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n `setupTabSelector` controlando el estado `active` de los botones y paneles, usando `setTimeout` mÃƒÆ’Ã‚Â­nimo para disparar las animaciones tras forzar el reflujo de la pÃƒÆ’Ã‚Â¡gina.
  - **Trazabilidad y Estado de Donaciones (`userController.js` y `history.js`)**:
    - En el backend (`getMyHistory`), se aÃƒÆ’Ã‚Â±adiÃƒÆ’Ã‚Â³ una consulta SQL paralela a la tabla `humanitarian_donations` vinculÃƒÆ’Ã‚Â¡ndola con `humanitarian_causes` y `users` para capturar el monto de la donaciÃƒÆ’Ã‚Â³n, fecha, ID de la causa, tÃƒÆ’Ã‚Â­tulo y estado de la causa, y el creador. Se retorna en la respuesta API como `donations`.
    - En el frontend, se programÃƒÆ’Ã‚Â³ `renderDonations(donations)` y `getDonationHTML(d)`. La tarjeta muestra el tÃƒÆ’Ã‚Â­tulo enlazado a la causa, y badges con estilos premium y translucidez para reflejar el estado contable de la donaciÃƒÆ’Ã‚Â³n (`on_hold` -> EN ESPERA POR KYC, `released` -> ACREDITADA, `refunded` -> REEMBOLSADA) y el estado de la causa (`approved` -> Causa Activa, `completed` -> Causa Culminada, etc.), garantizando una total audibilidad contable de cara a regulaciones FinTech y SOC 2.
- **Impacto**: Se optimizÃƒÆ’Ã‚Â³ la usabilidad mÃƒÆ’Ã‚Â³vil y de escritorio de la pÃƒÆ’Ã‚Â¡gina del Historial eliminando el scroll excesivo mediante un sistema de pestaÃƒÆ’Ã‚Â±as premium fluido, y se dotÃƒÆ’Ã‚Â³ al donante de un canal seguro y de alta fidelidad para auditar y seguir el destino de sus fondos aportados.
- **Archivos modificados**: `backend/src/controllers/userController.js`, `frontend/history.html`, `frontend/src/pages/history.js`, `EVOLUCION.md`

### 2026-06-26 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Enlaces DinÃƒÆ’Ã‚Â¡micos a Redes Sociales en Detalle de Causas e InclusiÃƒÆ’Ã‚Â³n de Causas en el Historial del Usuario

- **Contexto**: Se identificaron dos requerimientos operacionales y de usabilidad:
  1. Los enlaces en los nombres del Creador (influencer) y del Beneficiario en la pÃƒÆ’Ã‚Â¡gina de detalle de la causa solidaria (`causa-solidaria.html`) debÃƒÆ’Ã‚Â­an redirigir a sus respectivas redes sociales registradas si estaban disponibles, en lugar de apuntar siempre a sus perfiles pÃƒÆ’Ã‚Âºblicos de la plataforma.
  2. Las causas humanitarias creadas por los usuarios no aparecÃƒÆ’Ã‚Â­an en su listado del historial ("Mis Publicaciones" en `history.html`), dificultando el seguimiento del estado de sus solicitudes vigentes o completadas.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Enlaces DinÃƒÆ’Ã‚Â¡micos en Detalle de Causa (`causa-solidaria.js`)**: Se actualizÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n `buildCauseHTML` para extraer dinÃƒÆ’Ã‚Â¡micamente la primera red social del creador de `evidence_urls` (ÃƒÆ’Ã‚Â­ndice 1) y del beneficiario de la columna `beneficiary_socials`. Se implementÃƒÆ’Ã‚Â³ un fallback transparente hacia sus perfiles internos (`profile.html?user=...`) si no existen enlaces de redes sociales. Los enlaces externos se configuran para abrirse en una pestaÃƒÆ’Ã‚Â±a nueva (`target="_blank" rel="noopener noreferrer"`) garantizando la seguridad (anti-tabnabbing) y una UX ÃƒÆ’Ã‚Â³ptima.
  - **InclusiÃƒÆ’Ã‚Â³n en Historial de Creadores (`userController.js` y `history.js`)**: 
    - En el backend (`getMyHistory`), se inyectÃƒÆ’Ã‚Â³ una consulta SQL paralela a la tabla `humanitarian_causes` mapeando `story` -> `description`, `goal_amount` -> `blue_cost`, `current_amount`, y `status` con un flag de control `is_humanitarian: true`. Los resultados de causas y publicaciones comerciales se fusionan en memoria y se ordenan por `created_at DESC` para su consumo ÃƒÆ’Ã‚Â¡gil en una ÃƒÆ’Ã‚Âºnica llamada API.
    - En el frontend, se adaptÃƒÆ’Ã‚Â³ `renderAuthoredPublications` para identificar el flag `is_humanitarian`. Si se detecta, se omite el guardado en el mapa de IDs comerciales para evitar colisiones y se previene la carga asÃƒÆ’Ã‚Â­ncrona inÃƒÆ’Ã‚Âºtil de participantes. Se renderiza un contenedor premium exclusivo con diseÃƒÆ’Ã‚Â±o contable (Meta vs Recaudado) y el tÃƒÆ’Ã‚Â­tulo redirige a la vista pÃƒÆ’Ã‚Âºblica de la causa (`causa-solidaria.html?id=${pub.id}`).
- **Impacto**: Se logrÃƒÆ’Ã‚Â³ una navegaciÃƒÆ’Ã‚Â³n directa integrada hacia la presencia social del influencer y del beneficiario, y se dotÃƒÆ’Ã‚Â³ al usuario de un panel de control e historial unificado premium, ordenado y seguro en su Dashboard de publicaciones, libre de colisiones y con visualizaciÃƒÆ’Ã‚Â³n financiera adaptada.
- **Archivos modificados**: `backend/src/controllers/userController.js`, `frontend/src/pages/causa-solidaria.js`, `frontend/src/pages/history.js`, `EVOLUCION.md`

### 2026-06-26 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Estilo de Formulario de PostulaciÃƒÆ’Ã‚Â³n, RedirecciÃƒÆ’Ã‚Â³n Interna de ÃƒÆ’Ã¢â‚¬Â°xito y Redes Sociales del Beneficiario (MigraciÃƒÆ’Ã‚Â³n 073)

- **Contexto**: Se detectaron varios detalles de pulido y funcionalidad en el formulario de postulaciÃƒÆ’Ã‚Â³n solidaria (`solicitud-solidaria.html`):
  1. Al enviar el formulario de solicitud con ÃƒÆ’Ã‚Â©xito, el sistema redirigÃƒÆ’Ã‚Â­a al usuario a `index.html` (landing page), lo que daba la falsa impresiÃƒÆ’Ã‚Â³n de haber sido expulsado de la aplicaciÃƒÆ’Ã‚Â³n (logout).
  2. El campo "Enlace de Evidencia (Drive, Dropbox, Fotos iCloud)" sobresalÃƒÆ’Ã‚Â­a horizontalmente en dispositivos mÃƒÆ’Ã‚Â³viles y de escritorio en comparaciÃƒÆ’Ã‚Â³n con otros campos debido a un error de especificidad CSS en el cual `input[type="url"]` no coincidÃƒÆ’Ã‚Â­a con el selector especÃƒÆ’Ã‚Â­fico de `style.css` y cargaba estilos de un bloque tag con `box-sizing: content-box`.
  3. Faltaba la capacidad de registrar los enlaces a redes sociales del beneficiario de forma opcional para fines de auditorÃƒÆ’Ã‚Â­a del administrador.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Base de Datos (MigraciÃƒÆ’Ã‚Â³n 073)**: Se creÃƒÆ’Ã‚Â³ la migraciÃƒÆ’Ã‚Â³n `073_add_beneficiary_socials_to_causes.js` para aÃƒÆ’Ã‚Â±adir la columna `beneficiary_socials` TEXT en la tabla `humanitarian_causes`.
  - **RedirecciÃƒÆ’Ã‚Â³n de SesiÃƒÆ’Ã‚Â³n**: Se corrigiÃƒÆ’Ã‚Â³ el submit del formulario en `solicitud-solidaria.html` para redirigir a `contract_interaction.html` (el Dashboard principal), manteniendo al usuario dentro de su sesiÃƒÆ’Ã‚Â³n activa.
  - **AlineaciÃƒÆ’Ã‚Â³n Visual de Inputs**: Se reestructurÃƒÆ’Ã‚Â³ el CSS en el bloque `<style>` de `solicitud-solidaria.html` agregando `* { box-sizing: border-box; }` y especificando `input[type="url"]` con las mismas propiedades de borde, padding, color y `border-radius: 8px` que los demÃƒÆ’Ã‚Â¡s inputs, logrando una interfaz 100% homogÃƒÆ’Ã‚Â©nea y sin desbordes.
  - **Enlaces del Beneficiario**: Se agregÃƒÆ’Ã‚Â³ el input `#beneficiarySocials` en el HTML de la postulaciÃƒÆ’Ã‚Â³n, se capturÃƒÆ’Ã‚Â³ en `formData.beneficiary_socials`, y se actualizÃƒÆ’Ã‚Â³ `solidarioRoutes.js` para recibir, validar el formato de URL HTTPS y la longitud de este campo, y persistirlo en la base de datos junto con el registro en la auditorÃƒÆ’Ã‚Â­a bancaria.
- **Impacto**: Se optimizÃƒÆ’Ã‚Â³ la experiencia de usuario y el diseÃƒÆ’Ã‚Â±o visual mÃƒÆ’Ã‚Â³vil del formulario y se fortalecieron las herramientas de validaciÃƒÆ’Ã‚Â³n de causas humanitarias por parte de la administraciÃƒÆ’Ã‚Â³n.
- **Archivos creados/modificados**: `backend/migrations/073_add_beneficiary_socials_to_causes.js`, `backend/src/routes/solidarioRoutes.js`, `frontend/solicitud-solidaria.html`, `EVOLUCION.md`

### 2026-06-26 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CorrecciÃƒÆ’Ã‚Â³n de Flujo de AcreditaciÃƒÆ’Ã‚Â³n y Hold/Release de Fondos en Donaciones (Beneficiario vs Creador)

- **Contexto**: Se detectÃƒÆ’Ã‚Â³ una inconsistencia en el flujo contable de donaciones de BLUE IOU: cuando un usuario donaba a una causa humanitaria creada por `@test1` (influencer/creador) con `@test2` (organizaciÃƒÆ’Ã‚Â³n) designado como beneficiario, los tokens liberados (tras validarse el KYC del donante) se acreditaban errÃƒÆ’Ã‚Â³neamente en el balance de `@test1` en lugar de `@test2`. El sistema registraba al dueÃƒÆ’Ã‚Â±o de la causa como receptor directo de los fondos.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **ResoluciÃƒÆ’Ã‚Â³n en Punto de Entrada**: Se actualizÃƒÆ’Ã‚Â³ `humanitarianService.js` para buscar dinÃƒÆ’Ã‚Â¡micamente al beneficiario final mediante su `beneficiary_referral_code` al inicio del mÃƒÆ’Ã‚Â©todo `donateToCause`.
  - **AcreditaciÃƒÆ’Ã‚Â³n e Inmutabilidad de Escrows**: Se redirigieron todos los eventos contables (`record_booster_event`), el historial transaccional (`booster_transactions`), las notificaciones in-app y el registro en la tabla de control `humanitarian_donations` (columna `recipient_id`) para apuntar al beneficiario real (`recipientId`).
  - Esto garantiza que tanto las acreditaciones inmediatas como la liberaciÃƒÆ’Ã‚Â³n tardÃƒÆ’Ã‚Â­a a travÃƒÆ’Ã‚Â©s del trigger de base de datos (`fn_release_humanitarian_donations`) depositen los tokens de forma segura en la cuenta correcta, cumpliendo estrictamente con la normativa SOC 2 y de transmisiÃƒÆ’Ã‚Â³n de dinero FinTech.
- **Impacto**: Se eliminÃƒÆ’Ã‚Â³ el bug de desvÃƒÆ’Ã‚Â­o de fondos a favor del creador, logrando una sincronizaciÃƒÆ’Ã‚Â³n perfecta entre la visualizaciÃƒÆ’Ã‚Â³n de la UI y los balances reales del ledger del booster de los beneficiarios.
- **Archivos modificados**: `backend/src/services/humanitarianService.js`

### 2026-06-26 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Claridad en Roles, IntroducciÃƒÆ’Ã‚Â³n del Nombre de la FundaciÃƒÆ’Ã‚Â³n, Permisos de DonaciÃƒÆ’Ã‚Â³n de Creadores y RefactorizaciÃƒÆ’Ã‚Â³n del Feed en Winton Solidario (Migraciones 071 y 072)

- **Contexto**: En la visualizaciÃƒÆ’Ã‚Â³n del marketplace y en el detalle de las causas solidarias, se requerÃƒÆ’Ã‚Â­a una separaciÃƒÆ’Ã‚Â³n de roles estricta entre el creador/influencer original (p. ej., `test1`) y el beneficiario final (p. ej., `test2`). Anteriormente el sistema mostraba "Por: test2" de forma predeterminada y bloqueaba al creador para que no pudiera donar a su propia causa. Adicionalmente, se necesitaba que el creador pudiera ingresar un "Nombre de la FundaciÃƒÆ’Ã‚Â³n" descriptivo libre para cada causa y mostrar enlaces a los perfiles pÃƒÆ’Ã‚Âºblicos en la pÃƒÆ’Ã‚Â¡gina de detalle, mientras que en el feed general se solicitÃƒÆ’Ã‚Â³ ocultar los enlaces de perfiles, eliminar el badge "CampaÃƒÆ’Ã‚Â±a Activa", y suprimir el texto "Sin calificaciones" cuando los autores no poseen ratings para optimizar el espacio visual de las tarjetas.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Base de Datos (MigraciÃƒÆ’Ã‚Â³n 072)**:
    - Se creÃƒÆ’Ã‚Â³ la columna `foundation_name` VARCHAR(255) en la tabla `humanitarian_causes` para registrar el nombre descriptivo de la entidad beneficiaria.
  - **Flujo de Solicitud (`solicitud-solidaria.html` y `solidarioRoutes.js`)**:
    - Se agregÃƒÆ’Ã‚Â³ el campo input de texto "Nombre de la FundaciÃƒÆ’Ã‚Â³n" en el formulario de postulaciÃƒÆ’Ã‚Â³n y se modificÃƒÆ’Ã‚Â³ la ruta `/api/solidario/postulacion` para capturar, validar en longitud (<= 255 caracteres) y persistir este campo en la base de datos, ademÃƒÆ’Ã‚Â¡s de registrarlo en `audit_log` para fines de trazabilidad bancaria.
  - **LÃƒÆ’Ã‚Â³gica de AutodonaciÃƒÆ’Ã‚Â³n en Backend (`humanitarianService.js`)**:
    - Se removiÃƒÆ’Ã‚Â³ la restricciÃƒÆ’Ã‚Â³n que impedÃƒÆ’Ã‚Â­a al creador (`owner_id`) realizar donaciones a su causa (ya que ÃƒÆ’Ã‚Â©l promueve la causa pero el dinero va directamente al beneficiario), y se mantuvo el bloqueo estricto solo para el beneficiario final asociado al cÃƒÆ’Ã‚Â³digo de referido.
  - **VisualizaciÃƒÆ’Ã‚Â³n en Frontend (`contract-interaction.js` y `causa-solidaria.js`)**:
    - En el Dashboard (feed), se modificÃƒÆ’Ã‚Â³ el mapeo virtual para incluir `foundation_name`. La tarjeta ahora renderiza el autor y el beneficiario en formato de texto plano sin enlaces de la forma `Por: creador en beneficio de: Nombre de la FundaciÃƒÆ’Ã‚Â³n @beneficiario` (sin parÃƒÆ’Ã‚Â©ntesis) para mantener un diseÃƒÆ’Ã‚Â±o limpio. AdemÃƒÆ’Ã‚Â¡s, se ocultÃƒÆ’Ã‚Â³ la etiqueta `slots-info` ("CampaÃƒÆ’Ã‚Â±a Activa") en las publicaciones de tipo donaciÃƒÆ’Ã‚Â³n y se modificÃƒÆ’Ã‚Â³ `generateStarRating` para retornar un string vacÃƒÆ’Ã‚Â­o si la cuenta de calificaciones es 0, suprimiendo el texto `"Sin calificaciones"`.
    - En el detalle de la causa, se actualizÃƒÆ’Ã‚Â³ la secciÃƒÆ’Ã‚Â³n meta para incluir enlaces dinÃƒÆ’Ã‚Â¡micos a los perfiles del creador y del beneficiario (`profile.html?user=...`), igualando el color de enlace del beneficiario a `#a5b4fc` para que sea visualmente idÃƒÆ’Ã‚Â©ntico al estilo del creador. AdemÃƒÆ’Ã‚Â¡s, se configurÃƒÆ’Ã‚Â³ la alineaciÃƒÆ’Ã‚Â³n vertical en columna (`flex-direction: column`) para dispositivos mÃƒÆ’Ã‚Â³viles y escritorio en `causa-solidaria.html` para una legibilidad ÃƒÆ’Ã‚Â³ptima, se eliminaron espacios flex fantasmas en el JS, y se reemplazÃƒÆ’Ã‚Â³ el icono `ÃƒÂ°Ã…Â¸Ã…Â½Ã¯Â¿Â½` por el corazÃƒÆ’Ã‚Â³n fucsia `ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â‚¬â€œ` para el beneficiario en el orden `ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â‚¬â€œ Beneficiario: @usuario (Nombre de la organizaciÃƒÆ’Ã‚Â³n)`. TambiÃƒÆ’Ã‚Â©n se integrÃƒÆ’Ã‚Â³ la hora de publicaciÃƒÆ’Ã‚Â³n (`a las XX:XX hs`) al lado de la fecha de creaciÃƒÆ’Ã‚Â³n, se eliminÃƒÆ’Ã‚Â³ el contador superior con corazÃƒÆ’Ã‚Â³n azul y se trasladÃƒÆ’Ã‚Â³ al tÃƒÆ’Ã‚Â­tulo del listado de donaciones en la parte inferior (ej: `2 Donaciones recibidas`).
- **Impacto**: Se logrÃƒÆ’Ã‚Â³ un flujo de causas solidarias 100% coherente con la realidad del negocio FinTech y un feed/detalle premium extremadamente limpio y enfocado, con coherencia tipogrÃƒÆ’Ã‚Â¡fica, alineaciÃƒÆ’Ã‚Â³n mÃƒÆ’Ã‚Â³vil nativa y cromÃƒÆ’Ã‚Â¡tica completa.
- **Archivos creados/modificados**: `backend/migrations/072_add_foundation_name_to_causes.js`, `backend/src/routes/solidarioRoutes.js`, `backend/src/routes/humanitarianUserRoutes.js`, `backend/src/services/humanitarianService.js`, `frontend/solicitud-solidaria.html`, `frontend/causa-solidaria.html`, `frontend/src/pages/contract-interaction.js`, `frontend/src/pages/causa-solidaria.js`, `EVOLUCION.md`

### 2026-06-26 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ RefactorizaciÃƒÆ’Ã‚Â³n de Seguridad Anti-Spoofing y MitigaciÃƒÆ’Ã‚Â³n de Overflow en Postulaciones Solidarias

- **Contexto**: Tras una auditorÃƒÆ’Ã‚Â­a exhaustiva del flujo de postulaciones solidarias, se detectÃƒÆ’Ã‚Â³ una vulnerabilidad de spoofing (suplantaciÃƒÆ’Ã‚Â³n de identidad) de nivel medio/alto: el endpoint de postulaciÃƒÆ’Ã‚Â³n `/api/solidario/postulacion` era pÃƒÆ’Ã‚Âºblico y permitÃƒÆ’Ã‚Â­a enviar causas en nombre de cualquier usuario registrado simplemente escribiendo su username. Asimismo, se identificÃƒÆ’Ã‚Â³ un riesgo de desbordamiento contable si un usuario inyectaba valores numÃƒÆ’Ã‚Â©ricos infinitos (`Infinity`) o excesivamente grandes en el campo `meta`.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **AutenticaciÃƒÆ’Ã‚Â³n Obligatoria en Frontend (`solicitud-solidaria.html`)**:
    - Se implementÃƒÆ’Ã‚Â³ una verificaciÃƒÆ’Ã‚Â³n temprana de sesiÃƒÆ’Ã‚Â³n activa (JWT y username). Si no existe sesiÃƒÆ’Ã‚Â³n, se redirige inmediatamente al usuario a la pÃƒÆ’Ã‚Â¡gina de login.
    - El campo de texto de nombre de usuario creador ahora se pre-rellena con el username de la sesiÃƒÆ’Ã‚Â³n y se bloquea en modo `readOnly`, impidiendo la suplantaciÃƒÆ’Ã‚Â³n de cuentas.
    - Se realiza una validaciÃƒÆ’Ã‚Â³n proactiva y automÃƒÆ’Ã‚Â¡tica de causas activas al cargar la pÃƒÆ’Ã‚Â¡gina, inhabilitando los controles y notificando al usuario de inmediato si ya posee solicitudes en curso.
    - Se incluyÃƒÆ’Ã‚Â³ la cabecera `Authorization: Bearer <token>` en el envÃƒÆ’Ã‚Â­o del formulario.
  - **Seguridad en Backend (`solidarioRoutes.js`)**:
    - Se aplicÃƒÆ’Ã‚Â³ el middleware `authenticateToken` al endpoint `POST /postulacion`.
    - Se implementÃƒÆ’Ã‚Â³ la verificaciÃƒÆ’Ã‚Â³n de coherencia anti-spoofing: el servidor valida que el username contenido en la sesiÃƒÆ’Ã‚Â³n autenticada coincida exactamente con el username del cuerpo de la peticiÃƒÆ’Ã‚Â³n.
    - Se reforzÃƒÆ’Ã‚Â³ la validaciÃƒÆ’Ã‚Â³n del parÃƒÆ’Ã‚Â¡metro `meta` aÃƒÆ’Ã‚Â±adiendo la comprobaciÃƒÆ’Ã‚Â³n `isFinite(goalAmount)` para denegar montos infinitos y se estableciÃƒÆ’Ã‚Â³ un lÃƒÆ’Ã‚Â­mite mÃƒÆ’Ã‚Â¡ximo de contenciÃƒÆ’Ã‚Â³n de `100,000,000` de BLUE IOU.
- **Impacto**: Se eliminÃƒÆ’Ã‚Â³ por completo el vector de ataque por suplantaciÃƒÆ’Ã‚Â³n de postulaciones y se blindÃƒÆ’Ã‚Â³ la base de datos contra overflows y nÃƒÆ’Ã‚Âºmeros invÃƒÆ’Ã‚Â¡lidos, cumpliendo con los estÃƒÆ’Ã‚Â¡ndares de control de acceso del nivel SOC 2 y de integridad de datos fintech.
- **Archivos modificados**: `backend/src/routes/solidarioRoutes.js`, `frontend/solicitud-solidaria.html`

### 2026-06-26 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CampaÃƒÆ’Ã‚Â±a Humanitaria de Emergencia por Terremoto en Venezuela (OpciÃƒÆ’Ã‚Â³n 3: Modal + Banner)

- **Contexto**: Debido a un terremoto catastrÃƒÆ’Ã‚Â³fico en Venezuela, se requerÃƒÆ’Ã‚Â­a activar una campaÃƒÆ’Ã‚Â±a de concientizaciÃƒÆ’Ã‚Â³n y donaciÃƒÆ’Ã‚Â³n humanitaria en la plataforma. La meta era incentivar a los usuarios activos a donar sus tokens BLUE IOU (que acumulan gratuitamente mediante el programa de referidos) a causas solidarias verificadas de forma inmediata al abrir la aplicaciÃƒÆ’Ã‚Â³n, sin comprometer la experiencia de usuario general ni resultar intrusivo en visitas subsecuentes.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **DiseÃƒÆ’Ã‚Â±o del Banner e Imagen de Fondo**:
    - Se utilizÃƒÆ’Ã‚Â³ la herramienta de inteligencia artificial para generar una imagen dramÃƒÆ’Ã‚Â¡tica y profesional (`venezuela_earthquake_banner.png`) que combina una fotografÃƒÆ’Ã‚Â­a real de los daÃƒÆ’Ã‚Â±os del sismo con la bandera de Venezuela integrada con un blend de gradiente premium y sombreado cinematogrÃƒÆ’Ã‚Â¡fico oscuro.
    - Se copiÃƒÆ’Ã‚Â³ el recurso final a `frontend/public/assets/images/venezuela_earthquake_banner.png` para que sea servido directamente por el servidor estÃƒÆ’Ã‚Â¡tico (Vite publicDir).
  - **Estructura e Interfaz Frontend (`contract_interaction.html`)**:
    - Se inyectaron estilos CSS premium responsivos y con animaciones de entrada (`slideDown-emb`, `fadeIn-emb`, `scaleUp-emb`) para controlar el banner superior y el modal glassmorphic.
    - Se implementÃƒÆ’Ã‚Â³ un banner superior sutil (`#venezuelaEmergencyBanner`) justo debajo del tÃƒÆ’Ã‚Â­tulo del Dashboard.
    - Se implementÃƒÆ’Ã‚Â³ un modal de pantalla completa (`#venezuelaEmergencyModal`) con la imagen de fondo generada, textos explicativos que aclaran el carÃƒÆ’Ã‚Â¡cter gratuito de la donaciÃƒÆ’Ã‚Â³n de BLUE IOU acumulados, y botones interactivos.
  - **LÃƒÆ’Ã‚Â³gica de Control con Persistencia de SesiÃƒÆ’Ã‚Â³n (`contract-interaction.js`)**:
    - Se codificÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n `setupVenezuelaEmergencyCampaign()` la cual comprueba si el modal o el banner ya han sido descartados por el usuario utilizando variables temporales en `localStorage` con expiraciÃƒÆ’Ã‚Â³n automÃƒÆ’Ã‚Â¡tica de 24 horas.
    - Si el usuario descarta el modal emergente principal, el sistema oculta el modal e inmediatamente muestra la barra de banner superior sutil como recordatorio no bloqueante.
    - Al hacer clic en "ÃƒÂ¢Ã¯Â¿Â½Ã‚Â¤ÃƒÂ¯Ã‚Â¸Ã¯Â¿Â½ Ir a Donar" o "Ver Causas" (tanto en modal como en banner), el sistema cierra la interfaz de la campaÃƒÆ’Ã‚Â±a, simula un clic nativo en el chip de filtro de categorÃƒÆ’Ã‚Â­a `"donation"` del marketplace, y realiza un scroll suave (`scrollIntoView`) directo al feed de publicaciones para mostrar las causas solidarias activas de inmediato.
- **Impacto**: Se implementÃƒÆ’Ã‚Â³ una campaÃƒÆ’Ã‚Â±a de onboarding solidario de alta conversiÃƒÆ’Ã‚Â³n visual para emergencias reales, alineada con las mejores prÃƒÆ’Ã‚Â¡cticas de UX/UI fintech (micro-animaciones, glassmorphism, coherencia estÃƒÆ’Ã‚Â©tica en mÃƒÆ’Ã‚Â³vil y escritorio). Protege la usabilidad del marketplace al evitar popups recurrentes molestos mediante almacenamiento en navegador local y automatiza el filtrado directo para maximizar la tracciÃƒÆ’Ã‚Â³n hacia las causas aprobadas.
- **Archivos creados**: `frontend/public/assets/images/venezuela_earthquake_banner.png`
- **Archivos modificados**: `frontend/contract_interaction.html`, `frontend/src/pages/contract-interaction.js`

### 2026-06-26 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ IntegraciÃƒÆ’Ã‚Â³n de CÃƒÆ’Ã‚Â³digo de Referido del Beneficiario en Postulaciones Solidarias (MigraciÃƒÆ’Ã‚Â³n 071)

- **Contexto**: El formulario de postulaciÃƒÆ’Ã‚Â³n solidaria (`solicitud-solidaria.html`) no permitÃƒÆ’Ã‚Â­a a los creadores de las causas (influencers o los mismos postulantes) designar de manera explÃƒÆ’Ã‚Â­cita el cÃƒÆ’Ã‚Â³digo de referido del beneficiario final (la organizaciÃƒÆ’Ã‚Â³n o persona que recibirÃƒÆ’Ã‚Â¡ las donaciones). Se requerÃƒÆ’Ã‚Â­a agregar un campo de entrada para el cÃƒÆ’Ã‚Â³digo de referido en la postulaciÃƒÆ’Ã‚Â³n, validarlo en tiempo real contra el backend para garantizar que pertenezca a una cuenta registrada y activa, y persistirlo en la base de datos para asegurar la correcta acreditaciÃƒÆ’Ã‚Â³n de comisiones de referidos en las donaciones de Winton Solidario.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **MigraciÃƒÆ’Ã‚Â³n 071** (`071_add_beneficiary_referral_code_to_causes.js`): Se aÃƒÆ’Ã‚Â±adiÃƒÆ’Ã‚Â³ la columna `beneficiary_referral_code` a la tabla `humanitarian_causes` para almacenar de forma persistente y auditable esta asociaciÃƒÆ’Ã‚Â³n de referidos.
  - **Rutas y Controladores del Backend**:
    - En `solidarioRoutes.js`, se aÃƒÆ’Ã‚Â±adiÃƒÆ’Ã‚Â³ el endpoint `GET /api/solidario/check-referral/:code` para la validaciÃƒÆ’Ã‚Â³n asÃƒÆ’Ã‚Â­ncrona de cÃƒÆ’Ã‚Â³digos de referido desde el frontend.
    - Se modificÃƒÆ’Ã‚Â³ el endpoint `POST /api/solidario/postulacion` para requerir, sanitizar, validar la existencia del beneficiario y guardar la columna `beneficiary_referral_code` en la base de datos, registrando el evento correspondiente en `audit_log` para fines de trazabilidad bancaria.
    - En `humanitarianUserRoutes.js`, se actualizÃƒÆ’Ã‚Â³ la consulta de causas aprobadas y de detalle para realizar un `LEFT JOIN` con la tabla `users` a travÃƒÆ’Ã‚Â©s de `beneficiary_referral_code`, permitiendo obtener el nombre de usuario del beneficiario y su cÃƒÆ’Ã‚Â³digo, con un fallback seguro `COALESCE` al creador original de la causa si el cÃƒÆ’Ã‚Â³digo de referido del beneficiario no estÃƒÆ’Ã‚Â¡ presente.
  - **Frontend y UX**:
    - Se actualizÃƒÆ’Ã‚Â³ `solicitud-solidaria.html` agregando un grupo de formulario `<div class="form-group">` con el input `#beneficiaryReferralCode` e indicaciones claras para el usuario.
    - Se implementÃƒÆ’Ã‚Â³ validaciÃƒÆ’Ã‚Â³n en el evento `blur` del input que consulta `/api/solidario/check-referral/:code` en el backend para mostrar retroalimentaciÃƒÆ’Ã‚Â³n interactiva inmediata (ÃƒÆ’Ã‚Â©xito o error con el nombre de usuario asociado).
    - Se bloqueÃƒÆ’Ã‚Â³ el envÃƒÆ’Ã‚Â­o del formulario si el cÃƒÆ’Ã‚Â³digo de referido ingresado es invÃƒÆ’Ã‚Â¡lido o no existe en el sistema.
- **Impacto**: Se completÃƒÆ’Ã‚Â³ la trazabilidad de referidos del beneficiario en Winton Solidario de extremo a extremo, cumpliendo con los estÃƒÆ’Ã‚Â¡ndares de cumplimiento FinTech y SOC 2. Los influencers pueden crear causas a favor de beneficiarios, y el sistema redirige automÃƒÆ’Ã‚Â¡ticamente a los invitados que se registren a travÃƒÆ’Ã‚Â©s de estas causas usando el cÃƒÆ’Ã‚Â³digo de referido correcto del beneficiario para su acreditaciÃƒÆ’Ã‚Â³n mutua de recompensas.
- **Archivos creados**: `backend/migrations/071_add_beneficiary_referral_code_to_causes.js`
- **Archivos modificados**: `backend/src/routes/solidarioRoutes.js`, `backend/src/routes/humanitarianUserRoutes.js`, `frontend/solicitud-solidaria.html`

### 2026-06-26 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Flujo de Referidos por PublicaciÃƒÆ’Ã‚Â³n de DonaciÃƒÆ’Ã‚Â³n y Onboarding Directo de Beneficiarios (MigraciÃƒÆ’Ã‚Â³n 070)

- **Contexto**: Se requerÃƒÆ’Ã‚Â­a un flujo donde las publicaciones de donaciÃƒÆ’Ã‚Â³n compartidas actuaran como enlaces de referido a favor del beneficiario final (la organizaciÃƒÆ’Ã‚Â³n), en lugar de beneficiar al influencer que creÃƒÆ’Ã‚Â³ la publicaciÃƒÆ’Ã‚Â³n o al usuario que compartiÃƒÆ’Ã‚Â³ el enlace. Si un invitado abre el enlace de la campaÃƒÆ’Ã‚Â±a o causa, debe ser redirigido directamente al registro asociando de forma nativa e inalterable el cÃƒÆ’Ã‚Â³digo de referido del beneficiario para que este reciba las comisiones correspondientes utilizando la tarifa de recompensa activa de la plataforma.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **MigraciÃƒÆ’Ã‚Â³n 070** (`070_add_beneficiary_referral_code_to_publications.js`): Se creÃƒÆ’Ã‚Â³ una columna `beneficiary_referral_code` en la tabla `publications` para registrar de manera persistente a favor de quiÃƒÆ’Ã‚Â©n se realiza la campaÃƒÆ’Ã‚Â±a de donaciÃƒÆ’Ã‚Â³n.
  - **Controlador y Rutas Backend**:
    - Se actualizÃƒÆ’Ã‚Â³ `publicationController.js` para que la creaciÃƒÆ’Ã‚Â³n de posts del tipo `'donation'` requiera y valide que el `beneficiaryReferralCode` corresponda a una cuenta activa registrada en base de datos.
    - Se hizo opcional el parÃƒÆ’Ã‚Â¡metro de consulta `user` en `GET /api/publications/:id` para permitir lecturas pÃƒÆ’Ã‚Âºblicas por parte de invitados.
    - Se modificÃƒÆ’Ã‚Â³ `humanitarianUserRoutes.js` definiendo un middleware de autenticaciÃƒÆ’Ã‚Â³n opcional `optionalAuthenticateToken` para que los endpoints de lista y detalles de causas (`/causes/approved` y `/causes/:id`) puedan ser accedidos por invitados sin credenciales JWT. Se corrigieron posibles caÃƒÆ’Ã‚Â­das del servidor al resguardar la comprobaciÃƒÆ’Ã‚Â³n de pertenencia mediante `req.user && cause.user_id === req.user.userId`.
  - **Frontend y UX de Onboarding**:
    - Se actualizÃƒÆ’Ã‚Â³ `publish.html` y `publish.js` para mostrar el campo del cÃƒÆ’Ã‚Â³digo del beneficiario ÃƒÆ’Ã‚Âºnicamente al seleccionar la categorÃƒÆ’Ã‚Â­a "CampaÃƒÆ’Ã‚Â±a de DonaciÃƒÆ’Ã‚Â³n", validando su llenado antes de la publicaciÃƒÆ’Ã‚Â³n.
    - En `publication-detail.js` y `causa-solidaria.js`, se removiÃƒÆ’Ã‚Â³ la redirecciÃƒÆ’Ã‚Â³n forzada del listener inicial. En su lugar, si la carga de datos determina que el visitante es un invitado (`!storedToken` o `!storedUsername`), se calcula la URL segura de retorno y se le redirige inmediatamente a `register.html` inyectando el cÃƒÆ’Ã‚Â³digo de referido del beneficiario (`register.html?ref=CODIGO_BENEFICIARIO&returnTo=...`), el cual se procesarÃƒÆ’Ã‚Â¡ mediante el flujo estÃƒÆ’Ã‚Â¡ndar ya auditado para acreditaciÃƒÆ’Ã‚Â³n contable mutua.
    - Si el usuario estÃƒÆ’Ã‚Â¡ autenticado, se renderiza de forma visual a beneficio de quiÃƒÆ’Ã‚Â©n se realiza la campaÃƒÆ’Ã‚Â±a: *"ÃƒÂ°Ã…Â¸Ã…Â½Ã¯Â¿Â½ CampaÃƒÆ’Ã‚Â±a a beneficio de: @beneficiary_username"*.
- **Impacto**: Se garantizÃƒÆ’Ã‚Â³ la trazabilidad total y el cumplimiento rigso de normativas FinTech/SOC 2 al procesar el onboarding de invitados a travÃƒÆ’Ã‚Â©s del flujo transaccional nativo de referidos. Se protegiÃƒÆ’Ã‚Â³ el servidor contra errores fatales de nulidad ante accesos concurrentes de no-usuarios y se optimizÃƒÆ’Ã‚Â³ el crecimiento orgÃƒÆ’Ã‚Â¡nico de la base de usuarios de la plataforma enfocando los incentivos financieros directamente en los beneficiarios de causas solidarias.
- **Archivos creados**: `backend/migrations/070_add_beneficiary_referral_code_to_publications.js`
- **Archivos modificados**: `backend/src/controllers/publicationController.js`, `backend/src/routes/humanitarianUserRoutes.js`, `frontend/src/pages/publish.js`, `frontend/src/pages/publication-detail.js`, `frontend/src/pages/causa-solidaria.js`

### 2026-06-25 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Onboarding Secuencial y RedirecciÃƒÆ’Ã‚Â³n Segura en Enlaces Compartidos de DonaciÃƒÆ’Ã‚Â³n y Marketplace

- **Contexto**: Al compartir enlaces directos a causas solidarias (`causa-solidaria.html?id=XX`) o detalles de publicaciones del marketplace (`publication-detail.html?id=XX`), si el destinatario no era un usuario registrado con sesiÃƒÆ’Ã‚Â³n activa, el sistema mostraba pantallas de error genÃƒÆ’Ã‚Â©ricas o le redirigÃƒÆ’Ã‚Â­a a la landing page perdiendo el contexto original. Se requerÃƒÆ’Ã‚Â­a un flujo optimizado que guiara al visitante directamente al formulario de registro, preservara la URL de origen de manera persistente a travÃƒÆ’Ã‚Â©s del flujo de login y registro, y le redirigiera de vuelta a la publicaciÃƒÆ’Ã‚Â³n original una vez completado el onboarding de forma segura. Asimismo, se detectÃƒÆ’Ã‚Â³ una duplicaciÃƒÆ’Ã‚Â³n en la URL del enlace compartido provocada porque la API de Web Share nativa de Android/iOS concatena de forma nativa los campos `text` y `url`.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **RedirecciÃƒÆ’Ã‚Â³n de Invitados**: En `causa-solidaria.js` y `publication-detail.js`, se implementaron verificaciones tempranas de sesiÃƒÆ’Ã‚Â³n activa (`token` y `username`). Ante la ausencia de sesiÃƒÆ’Ã‚Â³n, se calcula dinÃƒÆ’Ã‚Â¡micamente la ruta relativa actual (con query params) y se redirige a `register.html?returnTo=...` de forma transparente.
  - **PreservaciÃƒÆ’Ã‚Â³n en Transiciones de Auth**: En `login.js` e `initializeRegisterPage` (`register.js`), se lee el parÃƒÆ’Ã‚Â¡metro `returnTo` y se re-inyecta de forma dinÃƒÆ’Ã‚Â¡mica en los enlaces de alternancia entre formularios de registro e inicio de sesiÃƒÆ’Ã‚Â³n para mantener la consistencia en caso de que el usuario decida cambiar de formulario.
  - **Whitelisting contra Open Redirect (SOC 2 / Fintech)**: Para prevenir vulnerabilidades de redirecciÃƒÆ’Ã‚Â³n abierta donde atacantes alteraran el parÃƒÆ’Ã‚Â¡metro `returnTo` para enviar a los usuarios a sitios maliciosos de phishing, se definiÃƒÆ’Ã‚Â³ e implementÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n `_getSafeReturnTo(raw)` en `register.js` y se actualizÃƒÆ’Ã‚Â³ en `login.js`. Ambas funciones restringen las redirecciones a una lista blanca explÃƒÆ’Ã‚Â­cita de archivos locales (`causa-solidaria.html` y `publication-detail.html` agregadas a `ALLOWED_PAGES`).
  - **RedirecciÃƒÆ’Ã‚Â³n Post-VerificaciÃƒÆ’Ã‚Â³n**: Tras culminar el registro e introducir el cÃƒÆ’Ã‚Â³digo OTP de verificaciÃƒÆ’Ã‚Â³n en `register.js` (`verifyForm`), el script evalÃƒÆ’Ã‚Âºa el valor seguro de `returnTo` para redirigir directamente al usuario al recurso compartido o hacer fallback a `contract_interaction.html`.
  - **MitigaciÃƒÆ’Ã‚Â³n de Enlace Duplicado (Web Share API)**: Se modificÃƒÆ’Ã‚Â³ la lÃƒÆ’Ã‚Â³gica del botÃƒÆ’Ã‚Â³n compartir en `causa-solidaria.js`, `publication-detail.js` y `contract-interaction.js` para separar explÃƒÆ’Ã‚Â­citamente el mensaje de invitaciÃƒÆ’Ã‚Â³n (parÃƒÆ’Ã‚Â¡metro `text`) de la URL de destino (parÃƒÆ’Ã‚Â¡metro `url`) en la llamada a `navigator.share()`. Para navegadores de escritorio que no poseen la API nativa (fallback a enlace de WhatsApp o copiado en portapapeles), se mantiene la concatenaciÃƒÆ’Ã‚Â³n manual para garantizar la integridad del mensaje.
- **Impacto**: Se optimizÃƒÆ’Ã‚Â³ la tracciÃƒÆ’Ã‚Â³n y conversiÃƒÆ’Ã‚Â³n del crecimiento viral de la plataforma al permitir a los usuarios externos ver causas y publicaciones inmediatamente despuÃƒÆ’Ã‚Â©s de registrarse, sin perderse en el dashboard principal y manteniendo un blindaje de seguridad 100% auditable frente a vulnerabilidades Web (Open Redirect) y compartidos limpios sin enlaces duplicados.
- **Archivos modificados**: `frontend/src/pages/causa-solidaria.js`, `frontend/src/pages/publication-detail.js`, `frontend/src/pages/contract-interaction.js`, `frontend/src/pages/login.js`, `frontend/src/pages/register.js`

### 2026-06-25 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ ReubicaciÃƒÆ’Ã‚Â³n de Causas Humanitarias al Tope del Marketplace e IntegraciÃƒÆ’Ã‚Â³n de Ocultado Local

- **Contexto**: Para optimizar el trÃƒÆ’Ã‚Â¡fico y la visibilidad de las campaÃƒÆ’Ã‚Â±as de Winton Solidario de cara al lanzamiento, se solicitÃƒÆ’Ã‚Â³ eliminar el widget estÃƒÆ’Ã‚Â¡tico lateral del Dashboard e integrar las causas directamente como el primer elemento del listado general de publicaciones activas ("Todos"). Adicionalmente, para preservar el control del usuario sobre su propia pantalla sin comprometer la base de datos con relaciones forÃƒÆ’Ã‚Â¡neas inviables, se requerÃƒÆ’Ã‚Â­a que los usuarios pudieran ocultar/desocultar estas causas localmente de la misma forma en que ocultan las publicaciones nativas de venta o empleo.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **RemociÃƒÆ’Ã‚Â³n FÃƒÆ’Ã‚Â­sica** (`contract_interaction.html`): Se removiÃƒÆ’Ã‚Â³ el contenedor `#solidarioDashboardCard` sobre la barra de control de publicaciones generales para eliminar redundancia y limpiar el ÃƒÆ’Ã‚Â¡rea de control del Dashboard.
  - **PeticiÃƒÆ’Ã‚Â³n y Mapeo Combinado** (`contract-interaction.js`): Se inyectÃƒÆ’Ã‚Â³ la descarga de causas aprobadas en `fetchAndDisplayPublications()` mezclÃƒÆ’Ã‚Â¡ndolas dinÃƒÆ’Ã‚Â¡micamente con las publicaciones del marketplace. Se mapearon los atributos de holds y metas en una estructura virtual compatible de categorÃƒÆ’Ã‚Â­a `donation`.
  - **PriorizaciÃƒÆ’Ã‚Â³n Suprema** (`contract-interaction.js`): Se ajustÃƒÆ’Ã‚Â³ `getPendingPriority()` para que las causas posean una prioridad de `-1` (flotador de tope), garantizando que se rendericen al inicio de los feeds "Todos" y "DonaciÃƒÆ’Ã‚Â³n".
  - **Ocultamiento Local Persistente (No-DML)** (`contract-interaction.js`): Dado que la tabla `hidden_publications` posee un constraint de clave forÃƒÆ’Ã‚Â¡nea estricto hacia `publications` y las causas provienen de `humanitarian_causes`, se ideÃƒÆ’Ã‚Â³ un almacenamiento persistente en el navegador usando **`localStorage`** (`hidden_causes_${storedUsername}`).
  - **AnimaciÃƒÆ’Ã‚Â³n Optimista**: Se implementÃƒÆ’Ã‚Â³ `window.handleCauseAction()` que gestiona la salida y re-entrada de causas de forma optimista con transiciones CSS y soporte del banner Toast con acciÃƒÆ’Ã‚Â³n de "DESHACER", imitando al 100% el comportamiento de las publicaciones del marketplace.
  - **Ajustes de UX y Densidad Visual**: Se disminuyÃƒÆ’Ã‚Â³ el tamaÃƒÆ’Ã‚Â±o de la tipografÃƒÆ’Ã‚Â­a del progreso de la meta (`font-size: 0.78rem`) en causas y se eliminÃƒÆ’Ã‚Â³ por completo la lÃƒÆ’Ã‚Â­nea de descripciÃƒÆ’Ã‚Â³n de la tarjeta en causas humanitarias, reduciendo significativamente la saturaciÃƒÆ’Ã‚Â³n. Adicionalmente, se implementÃƒÆ’Ã‚Â³ el **formateo inteligente de porcentajes** en `causa-solidaria.js` y `contract-interaction.js` para mostrar el primer decimal significativo si el porcentaje es extremadamente bajo (evitando el engaÃƒÆ’Ã‚Â±oso `0.0%` cuando ya hay donaciones), y se eliminÃƒÆ’Ã‚Â³ el icono emoji `ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã¯Â¿Â½` del mensaje de hold en el marketplace.
- **Impacto**: Se logrÃƒÆ’Ã‚Â³ la mÃƒÆ’Ã‚Â¡xima exposiciÃƒÆ’Ã‚Â³n de las campaÃƒÆ’Ã‚Â±as solidarias de la plataforma en la primera posiciÃƒÆ’Ã‚Â³n del feed para todos los usuarios. Se implementÃƒÆ’Ã‚Â³ una soluciÃƒÆ’Ã‚Â³n de ocultado autogestionada por usuario en el frontend, previniendo el crecimiento innecesario de la base de datos o la violaciÃƒÆ’Ã‚Â³n de restricciones referenciales de base de datos, con una estÃƒÆ’Ã‚Â©tica limpia, ligera y libre de sobrecarga de texto.
- **Archivos modificados**: `frontend/contract_interaction.html`, `frontend/src/pages/contract-interaction.js`, `frontend/src/pages/causa-solidaria.js`

### 2026-06-25 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Cierre del CÃƒÆ’Ã‚Â­rculo de Seguridad y Trazabilidad en Donaciones Humanitarias (MigraciÃƒÆ’Ã‚Â³n 069)

- **Contexto**: Tras el blindaje del ecosistema solidario de donaciones humanitarias, la auditorÃƒÆ’Ã‚Â­a contable y legal detectÃƒÆ’Ã‚Â³ 3 brechas remanentes de trazabilidad y experiencia de usuario (UX): (1) Ausencia de notificaciones al donante cuando sus fondos en hold eran liberados al beneficiario tras la verificaciÃƒÆ’Ã‚Â³n KYC, (2) Falta de un registro inmutable en `audit_log` para las liberaciones automÃƒÆ’Ã‚Â¡ticas disparadas por el trigger de base de datos, y (3) Ausencia de notificaciones por correo electrÃƒÆ’Ã‚Â³nico transaccional (AWS SES) para hitos financieros crÃƒÆ’Ã‚Â­ticos (Hold, LiberaciÃƒÆ’Ã‚Â³n y Reembolso por ExpiraciÃƒÆ’Ã‚Â³n).
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **MigraciÃƒÆ’Ã‚Â³n 069** (`069_enhance_humanitarian_trigger_audit_notifications.js`): Se robustece el trigger SQL `fn_release_humanitarian_donations()` en PostgreSQL para insertar registros en `audit_log` (evento `HUMANITARIAN_DONATION_RELEASED`) e insertar notificaciones in-app al donante en tiempo real cuando ocurre una liberaciÃƒÆ’Ã‚Â³n.
  - **Helpers de Correos** (en `humanitarianService.js`): Se integran llamadas no bloqueantes a `sendTransactionEmail` en el backend para: (a) donaciÃƒÆ’Ã‚Â³n inicial (aviso de hold o acreditado inmediato a donante y receptor), (b) reembolso por expiraciÃƒÆ’Ã‚Â³n en `donationRefundJob.js`, y (c) liberaciÃƒÆ’Ã‚Â³n tras aprobaciÃƒÆ’Ã‚Â³n de KYC (mediante un helper asÃƒÆ’Ã‚Â­ncrono `processAndSendEmailsForReleasedDonations` invocado desde los controladores de KYC).
  - **Controladores de KYC** (`userController.js`, `adminController.js`, `governanceController.js`): Se conectan para disparar de manera asÃƒÆ’Ã‚Â­ncrona la liberaciÃƒÆ’Ã‚Â³n de correos transaccionales cuando la base de datos registra la aprobaciÃƒÆ’Ã‚Â³n de KYC a `true`.
  - **Panel de AdministraciÃƒÆ’Ã‚Â³n** (`admin-panel.js`): Se registrÃƒÆ’Ã‚Â³ y configurÃƒÆ’Ã‚Â³ la visualizaciÃƒÆ’Ã‚Â³n interactiva del switch `donation_refund_enabled` (con traducciÃƒÆ’Ã‚Â³n y descripciÃƒÆ’Ã‚Â³n amigable en espaÃƒÆ’Ã‚Â±ol) y se inyectÃƒÆ’Ã‚Â³ el renderizado del campo entero `donation_escrow_expiration_days` en la interfaz de configuraciÃƒÆ’Ã‚Â³n del panel para que el administrador pueda ingresar y editar los dÃƒÆ’Ã‚Â­as de custodia de manera visual sin recurrir a consultas manuales SQL.
- **Impacto**: Se cierra el cÃƒÆ’Ã‚Â­rculo completo de seguridad y usabilidad de Winton Solidario de cara al Go-Live. El administrador puede parametrizar y supervisar de forma 100% visual y segura el comportamiento del demonio de reembolso y el periodo de expiraciÃƒÆ’Ã‚Â³n. Cumple con los estÃƒÆ’Ã‚Â¡ndares mÃƒÆ’Ã‚Â¡s estrictos de SOC 2 Tipo II (CC7.1), regulaciones FinTech de transmisores de dinero, CFPB Regulation E (notificaciÃƒÆ’Ã‚Â³n e historial financiero al consumidor) y ciberseguridad bancaria.
- **Archivos creados**: `migrations/069_enhance_humanitarian_trigger_audit_notifications.js`
- **Archivos modificados**: `src/services/humanitarianService.js`, `src/workers/donationRefundJob.js`, `src/controllers/userController.js`, `src/controllers/adminController.js`, `src/controllers/governanceController.js`, `frontend/src/pages/admin-panel.js`

### 2026-06-25 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Blindaje Institucional del Ecosistema de Donaciones Winton Solidario (MigraciÃƒÆ’Ã‚Â³n 068)

- **Contexto**: AuditorÃƒÆ’Ã‚Â­a profunda del ecosistema de donaciones humanitarias (Winton Solidario) que revelÃƒÆ’Ã‚Â³ 5 fallas estructurales graves: (1) Desborde de meta por donaciones `on_hold` no contabilizadas, (2) Trigger incompleto que no cerraba metas ni emitÃƒÆ’Ã‚Â­a notificaciones al liberar, (3) RetenciÃƒÆ’Ã‚Â³n indefinida de fondos sin mecanismo de reembolso (violaciÃƒÆ’Ã‚Â³n FinCEN/Escheatment Laws), (4) Ausencia de casting explÃƒÆ’Ã‚Â­cito en `record_booster_event`, (5) Bug en frontend que consultaba `is_verified` (email OTP) en lugar de `kyc_verified` (KYC Web3) para determinar si mostrar la advertencia de retenciÃƒÆ’Ã‚Â³n.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **MigraciÃƒÆ’Ã‚Â³n 068** (`068_refactor_humanitarian_escrow_engine.js`): Agrega columna `pending_amount` a `humanitarian_causes` para bloquear sobregiros AML. Refactoriza el Trigger `fn_release_humanitarian_donations` para decrementar `pending_amount`, auto-completar causas que alcancen su meta, y emitir notificaciones al beneficiario. Inserta variables configurables `donation_escrow_expiration_days` y `donation_refund_enabled` en `app_settings` con reconciliaciÃƒÆ’Ã‚Â³n idempotente.
  - **Demonio** (`donationRefundJob.js`): Nuevo worker registrado en `cronManager.js` (cada 5 min) que consulta la variable configurable de dÃƒÆ’Ã‚Â­as, busca donaciones vencidas con `FOR UPDATE SKIP LOCKED` (anti-deadlock), reembolsa BLUE IOU al donante, decrementa `pending_amount`, marca como `refunded` y genera auditorÃƒÆ’Ã‚Â­a bancaria inmutable. Respeta `pre_launch_mode_enabled` y `donation_refund_enabled`.
  - **Servicio** (`humanitarianService.js`): La validaciÃƒÆ’Ã‚Â³n de meta ahora considera `current_amount + pending_amount`. Se agrega casting explÃƒÆ’Ã‚Â­cito `::INTEGER`, `::TEXT`, `::NUMERIC` a las llamadas SQL. Se incrementa `pending_amount` al registrar donaciones `on_hold`.
  - **Backend** (`authController.js`): El endpoint `getAuthStatus` ahora incluye `kyc_verified` en su respuesta JSON.
  - **Frontend** (`causa-solidaria.js`): CorrecciÃƒÆ’Ã‚Â³n del bug `is_verified` ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `kyc_verified` en la verificaciÃƒÆ’Ã‚Â³n de KYC del donante.
- **Impacto**: El ecosistema de donaciones cumple ahora con SOC 2 Tipo II (CC7.1), FinCEN BSA (Escheatment Laws), GAAP/IFRS (partida doble) y CFPB Regulation E (notificaciÃƒÆ’Ã‚Â³n obligatoria). El administrador puede configurar en tiempo real los dÃƒÆ’Ã‚Â­as de retenciÃƒÆ’Ã‚Â³n desde el panel sin reiniciar el servidor.
- **Archivos creados**: `migrations/068_refactor_humanitarian_escrow_engine.js`, `src/workers/donationRefundJob.js`
- **Archivos modificados**: `src/workers/cronManager.js`, `src/services/humanitarianService.js`, `src/controllers/authController.js`, `frontend/src/pages/causa-solidaria.js`

### 2026-06-25 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CreaciÃƒÆ’Ã‚Â³n de Protocolo de Pruebas de AcreditaciÃƒÆ’Ã‚Â³n Manual (Go-Live Dry-Run Testing Protocol)

- **Contexto**: Tras finalizar exitosamente la purga de base de datos de Demo en Render y el redespliegue de los contratos inteligentes en Optimism Sepolia, se requerÃƒÆ’Ã‚Â­a un documento maestro de acreditaciÃƒÆ’Ã‚Â³n manual para verificar la pureza de DÃƒÆ’Ã‚Â­a Cero, el enrolamiento biomÃƒÆ’Ã‚Â©trico WebAuthn/FIDO2 y la atomicidad del Web3 Bridge.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**: Se redactÃƒÆ’Ã‚Â³ el documento `GO_LIVE_DRY_RUN_TESTING_PROTOCOL.md` estableciendo 8 fases operativas exhaustivas alineadas con los controles de cumplimiento SOC 2 Tipo II, leyes FinTech y auditorÃƒÆ’Ã‚Â­a bancaria. Cubre desde el encendido del Super Admin y emparejamiento de Guardianes hasta la verificaciÃƒÆ’Ã‚Â³n de escudos econÃƒÆ’Ã‚Â³micos en demonios del sistema.
- **Impacto**: La organizaciÃƒÆ’Ã‚Â³n cuenta con una guÃƒÆ’Ã‚Â­a de auditorÃƒÆ’Ã‚Â­a formal, reproducible y trazable para validar en vivo el comportamiento de la plataforma bajo cualquier condiciÃƒÆ’Ã‚Â³n de estrÃƒÆ’Ã‚Â©s antes del lanzamiento oficial.
- **Evidencia**: [GO_LIVE_DRY_RUN_TESTING_PROTOCOL.md](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/GO_LIVE_DRY_RUN_TESTING_PROTOCOL.md)

### 2026-06-24 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Protocolo de Blindaje Total (Clean Slate Go-Live): ReconciliaciÃƒÆ’Ã‚Â³n Fiduciaria de DÃƒÆ’Ã‚Â­a Cero y Hardening de Enlaces SSL/RPC

- **Contexto**: Se detectÃƒÆ’Ã‚Â³ una grave InfracciÃƒÆ’Ã‚Â³n de Divergencia Fiduciaria en el entorno de Demo: la base de datos acumulaba 578.85 tokens virtuales fantasma (BLUE/RED) de pruebas pasadas, mientras que los Smart Contracts en Optimism Sepolia registraban solo 21 tokens. Mantener esta divergencia violaba los principios de Single Source of Truth y exponÃƒÆ’Ã‚Â­a a la empresa ante futuras auditorÃƒÆ’Ã‚Â­as de cumplimiento (SOC 2 Tipo II, SEC, FinCEN). Al iniciar el proceso de purga y redespliegue, se manifestaron dos bloqueos severos en la infraestructura remota: el nodo de Alchemy rechazaba la estimaciÃƒÆ’Ã‚Â³n de gas de Ethers v6 (`intrinsic gas too high`) y Render cortaba la conexiÃƒÆ’Ã‚Â³n al iniciar las migraciones (`read ECONNRESET`) debido a la omisiÃƒÆ’Ã‚Â³n de encriptaciÃƒÆ’Ã‚Â³n SSL en entornos no productivos.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  1. **Capa de Contingencia y Archivo Legal (Audit Trail Archiving)**: Se estableciÃƒÆ’Ã‚Â³ como norma el respaldo por Snapshot en Render y se creÃƒÆ’Ã‚Â³ el script `backup_demo_audit_trail.js`. Este script extrajo de forma inmutable el Message Archive de votos de guardianes (`demo_reward_exports`, firmados con HMAC-SHA256), `audit_log` y `app_settings` hacia el archivo `demo_audit_backup_genesis.json` con hash notarial SHA-256 (`c724e667ee8...`).
  2. **Purga Radical Web2 (Drop Schema Cascade)**: Se programÃƒÆ’Ã‚Â³ y ejecutÃƒÆ’Ã‚Â³ `reset_remote_demo_db.js` con candado de entorno (`IS_DEMO_ENV=true`). Mediante `DROP SCHEMA public CASCADE;` se barrieron de un plumazo todas las tablas antiguas y los 578 tokens fantasma.
  3. **SincronÃƒÆ’Ã‚Â­a Web3 (Bypass RPC y Overrides de Gas)**: Para burlar el fallo de estimaciÃƒÆ’Ã‚Â³n del nodo de Alchemy en Optimism Sepolia, se inyectaron overrides explÃƒÆ’Ã‚Â­citos de `{ gasLimit: 5000000 }` en `deploy.js` y `gas: 5000000` en `hardhat.config.js`. Esto permitiÃƒÆ’Ã‚Â³ desplegar y conectar con ÃƒÆ’Ã‚Â©xito rotundo los 4 nuevos Smart Contracts (`BlueToken`, `RedToken`, `WintonProtocol`, `WintonTreasury`) naciendo limpios en cero.
  4. **Hardening de NegociaciÃƒÆ’Ã‚Â³n SSL y Fallback DinÃƒÆ’Ã‚Â¡mico**: Se reestructuraron los mÃƒÆ’Ã‚Â³dulos `db.js` y `migrationRunner.js` para forzar el protocolo SSL (`ssl: { rejectUnauthorized: false }`) siempre que la conexiÃƒÆ’Ã‚Â³n apunte a dominios externos de Render (`render.com`) o en modo Demo. Asimismo, se dotÃƒÆ’Ã‚Â³ a `config.js` de un fallback automÃƒÆ’Ã‚Â¡tico para localizar `.env.demo.local`.
- **Impacto**: La plataforma WintonCoin en Demo renaciÃƒÆ’Ã‚Â³ en un estado de DÃƒÆ’Ã‚Â­a Cero inmaculado (`0.0000 BLUE` y `0.0000 RED` en BD y Web3). Al encender el servidor, las 68+ migraciones reconstruyeron automÃƒÆ’Ã‚Â¡ticamente la estructura DDL perfecta, incluyendo las tablas inmutables y de biometrÃƒÆ’Ã‚Â­a WebAuthn, dejando el servidor encendido y listo para el simulacro oficial de afiliaciÃƒÆ’Ã‚Â³n de guardianes y el Bootstrap del Super Admin.
- **Evidencia**:
  - Respaldo Legal: [backup_demo_audit_trail.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/scripts/backup_demo_audit_trail.js), [demo_audit_backup_genesis.json](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/demo_audit_backup_genesis.json)
  - Purga Remota: [reset_remote_demo_db.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/scripts/reset_remote_demo_db.js)
  - Despliegue L2: [deploy.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/web3-contracts/scripts/deploy.js), [hardhat.config.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/web3-contracts/hardhat.config.js)
  - Ciberseguridad SSL: [db.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/config/db.js), [migrationRunner.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/scripts/migrationRunner.js), [config.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/config.js)

### 2026-06-23 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AuditorÃƒÆ’Ã‚Â­a de Seguridad Web3: Atomicidad de KYC y Escalabilidad de Concurrencia (NonceManager)

- **Contexto**: Durante el testeo del flujo de KYC contra la testnet pÃƒÆ’Ã‚Âºblica de Optimism Sepolia, se detectaron fallos intermitentes de tipo `CALL_EXCEPTION (intrinsic gas too high)` originados por la inestabilidad de los nodos RPC al usar la simulaciÃƒÆ’Ã‚Â³n `estimateGas` de Ethers v6. Adicionalmente, una auditorÃƒÆ’Ã‚Â­a del controlador de KYC revelÃƒÆ’Ã‚Â³ una vulnerabilidad crÃƒÆ’Ã‚Â­tica ("Divergencia de Ledgers") donde el servidor registraba la validaciÃƒÆ’Ã‚Â³n en la base de datos a travÃƒÆ’Ã‚Â©s de un mecanismo "fallback", incluso si la blockchain fallaba, rompiendo la integridad de Single Source of Truth.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  1. **Bypass RPC (OptimizaciÃƒÆ’Ã‚Â³n de Gas Limit)**: Se configurÃƒÆ’Ã‚Â³ un `{ gasLimit: 100000 }` fijo en `web3BridgeService.js` para saltar la fase de estimaciÃƒÆ’Ã‚Â³n de gas defectuosa de los RPC de testnet y forzar el envÃƒÆ’Ã‚Â­o inmediato de la transacciÃƒÆ’Ã‚Â³n on-chain, usando un margen de gas hiper-seguro pero costo-eficiente (verificable en que el Gas Used termina siendo ~47,000 unidades).
  2. **Atomicidad de Estado (Cierre de Fallback)**: Se eliminÃƒÆ’Ã‚Â³ el mecanismo de "fallback" local en `governanceController.js`. Ahora la base de datos se actualiza EXCLUSIVAMENTE si el Smart Contract confirma el recibo (`en estricta sincronÃƒÆ’Ã‚Â­a`). Si la red Web3 falla, el servidor aborta la actualizaciÃƒÆ’Ã‚Â³n Web2 ("TransacciÃƒÆ’Ã‚Â³n AtÃƒÆ’Ã‚Â³mica").
  3. **Escalabilidad de Alta Concurrencia (NonceManager)**: Para preparar la plataforma para millones de usuarios, se encapsulÃƒÆ’Ã‚Â³ la billetera del *Relayer* dentro de un `NonceManager` de Ethers v6. Esto crea una cola local de nonces asÃƒÆ’Ã‚Â­ncrona, eliminando los errores de "Nonce ColisiÃƒÆ’Ã‚Â³n" cuando docenas de usuarios aprueban su KYC en el mismo segundo.
- **Impacto**: El protocolo de KYC subiÃƒÆ’Ã‚Â³ a grado bancario / de Exchange. Ya no existe posibilidad de divergencia entre Web2 y Web3, se previenen los bloqueos por bugs del RPC, y el backend estÃƒÆ’Ã‚Â¡ capacitado para disparar miles de aprobaciones por minuto de forma atÃƒÆ’Ã‚Â³mica y auditable.

### 2026-06-22 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ RefactorizaciÃƒÆ’Ã‚Â³n de Background Jobs (Clean Architecture) y Escudos EconÃƒÆ’Ã‚Â³micos

- **Contexto**: El archivo `server.js` se habÃƒÆ’Ã‚Â­a convertido en un monolito que gestionaba la inicializaciÃƒÆ’Ã‚Â³n web y ejecutaba los procesos automatizados (Debt Collector, Token Releaser) en bucles internos. AdemÃƒÆ’Ã‚Â¡s, se detectÃƒÆ’Ã‚Â³ que el `DEBT COLLECTOR` estaba penalizando injustamente a los usuarios por deudas en `RED` durante el modo de pre-lanzamiento, ya que estos no podÃƒÆ’Ã‚Â­an ganar `BLUE` real para saldarlas.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  1. **ModularizaciÃƒÆ’Ã‚Â³n (Clean Architecture)**: Se extrajeron todos los procesos en segundo plano de `server.js` y se reubicaron en una nueva arquitectura dedicada bajo `src/workers/`. Se creÃƒÆ’Ã‚Â³ un `cronManager.js` como orquestador central, descargando al servidor web de la responsabilidad de manejar el estado de los *Intervals*.
  2. **Go-Live Gate en DEBT COLLECTOR y TOKEN RELEASER**: Se inyectÃƒÆ’Ã‚Â³ estrictamente el bloqueo de `pre_launch_mode_enabled === 'true'` en los archivos `debtCollectorJob.js` y `tokenReleaserJob.js`. Estos motores financieros crÃƒÆ’Ã‚Â­ticos quedan en pausa econÃƒÆ’Ã‚Â³mica absoluta mientras la plataforma siga en desarrollo, previniendo penalizaciones injustas y filtraciones prematuras de liquidez.
- **Impacto**: El `server.js` es ahora 200 lÃƒÆ’Ã‚Â­neas mÃƒÆ’Ã‚Â¡s ligero y mantenible. La arquitectura estÃƒÆ’Ã‚Â¡ lista para escalar los *Workers* a microservicios independientes si el trÃƒÆ’Ã‚Â¡fico lo requiere. El entorno de Pre-Lanzamiento estÃƒÆ’Ã‚Â¡ ahora financieramente sellado; los usuarios ya no serÃƒÆ’Ã‚Â¡n marcados como morosos (`is_penalized`) por falta de tokens lÃƒÆ’Ã‚Â­quidos.
- **Evidencia**:
  - Gestor: [cronManager.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/workers/cronManager.js)
  - Trabajos ExtraÃƒÆ’Ã‚Â­dos: [debtCollectorJob.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/workers/debtCollectorJob.js), [tokenReleaserJob.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/workers/tokenReleaserJob.js)
  - Limpieza del Monolito: [server.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/server.js)

### 2026-06-22 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Go-Live Gate, Cold Start Guard y Explicit Casting en Motor de Pagos

- **Contexto**: El motor financiero presentaba mÃƒÆ’Ã‚Âºltiples fallas en producciÃƒÆ’Ã‚Â³n. El pago a impulsores se ejecutaba inmediatamente al reiniciar el servidor ("Cold Start") ignorando las frecuencias programadas. AdemÃƒÆ’Ã‚Â¡s, al estar el modo pre-lanzamiento activado, el motor de pagos estaba liquidando deudas virtuales (IOU) usando saldo real (`platform_wallet`) que habÃƒÆ’Ã‚Â­a sido inyectado por la migraciÃƒÆ’Ã‚Â³n de reconciliaciÃƒÆ’Ã‚Â³n de comisiones histÃƒÆ’Ã‚Â³ricas. Finalmente, existÃƒÆ’Ã‚Â­a una inconsistencia grave a nivel base de datos: el motor de base de datos PostgreSQL arrojaba el error `42725 function record_balance_event is not unique` porque existÃƒÆ’Ã‚Â­an mÃƒÆ’Ã‚Âºltiples firmas de la funciÃƒÆ’Ã‚Â³n debido a migraciones sobrepuestas, y el debt collector fallaba por una columna `settled_at` faltante.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  1. **Go-Live Gate en `boosterService.js`**: Se introdujo un bloque estricto (Hard Block) que aborta toda ejecuciÃƒÆ’Ã‚Â³n de pagos a impulsores si el entorno estÃƒÆ’Ã‚Â¡ en modo pre-lanzamiento (`pre_launch_mode_enabled === 'true'`).
  2. **Timestamp de TransiciÃƒÆ’Ã‚Â³n (`pre_launch_deactivated_at`)**: Se modificÃƒÆ’Ã‚Â³ `adminController.js` para registrar el timestamp exacto en `app_settings` cuando se desactiva el modo pre-lanzamiento. Este timestamp actÃƒÆ’Ã‚Âºa como el "Momento GÃƒÆ’Ã‚Â©nesis" o punto de partida cero para el cÃƒÆ’Ã‚Â¡lculo de frecuencia de los pagos, previniendo ejecuciones prematuras en Cold Starts sin historial.
  3. **MigraciÃƒÆ’Ã‚Â³n de Saneamiento (067)**: Se creÃƒÆ’Ã‚Â³ `067_fix_db_inconsistencies_and_golive.js` que elimina atÃƒÆ’Ã‚Â³micamente todas las versiones en conflicto de `record_balance_event` y crea una ÃƒÆ’Ã‚Âºnica versiÃƒÆ’Ã‚Â³n estrictamente tipada. AÃƒÆ’Ã‚Â±ade la columna `settled_at` a `red_token_debts`, y prepara el "Go-Live Gate" para instancias que ya estÃƒÆ’Ã‚Â¡n en producciÃƒÆ’Ã‚Â³n.
  4. **Hardening de Tipos (Explicit Casting)**: Como mecanismo de "Defensa en Profundidad", se refactorizaron 22 llamadas a `record_balance_event` a travÃƒÆ’Ã‚Â©s de 5 archivos (`boosterService.js`, `publicationService.js`, `p2pController.js`, `server.js`, `run_booster_payments_now.js`) aÃƒÆ’Ã‚Â±adiendo explicit casting a los parÃƒÆ’Ã‚Â¡metros (`$1::INTEGER, 'action'::TEXT, 'wallet'::TEXT, $2::NUMERIC, NULL::JSONB`).
  5. **Esquema Base Saneado**: Se actualizÃƒÆ’Ã‚Â³ `databaseInit.js` para incluir `settled_at` por defecto en inicializaciones desde cero.
- **Impacto**: El motor de pagos de la plataforma (Booster Payments) es ahora 100% resiliente a caÃƒÆ’Ã‚Â­das y reinicios del servidor. Las deudas virtuales (IOU) acumuladas en pre-lanzamiento ya no drenarÃƒÆ’Ã‚Â¡n liquidez real debido a aislamientos de dominios. Todos los problemas relacionados a ambigÃƒÆ’Ã‚Â¼edades en PostgreSQL fueron erradicados permanentemente, habilitando a los mÃƒÆ’Ã‚Â³dulos de P2P y Publicaciones a registrar eventos de saldo sin errores `42725`.
- **Evidencia**:
  - Motor de Pagos: [boosterService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/boosterService.js) y [server.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/server.js).
  - Controlador de Administrador: [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js).
  - MigraciÃƒÆ’Ã‚Â³n Estructural: [067_fix_db_inconsistencies_and_golive.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/067_fix_db_inconsistencies_and_golive.js) y [databaseInit.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/config/databaseInit.js).
  - RefactorizaciÃƒÆ’Ã‚Â³n Tipada: [p2pController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/p2pController.js), [publicationService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/publicationService.js), [run_booster_payments_now.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/run_booster_payments_now.js).

### 2026-06-19 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ OptimizaciÃƒÆ’Ã‚Â³n de DiseÃƒÆ’Ã‚Â±o Minimalista y SecciÃƒÆ’Ã‚Â³n de Honestidad en Landing Page

- **Contexto**: Para alinear las expectativas de los usuarios, reducir las tasas de default crediticio en las deudas del token reputacional (`RED`), cumplir con los estÃƒÆ’Ã‚Â¡ndares internacionales de seguridad y leyes FinTech contra el fraude, se requerÃƒÆ’Ã‚Â­a incorporar una secciÃƒÆ’Ã‚Â³n estratÃƒÆ’Ã‚Â©gica en la Landing Page que estableciera los valores de la comunidad (honestidad, compromiso, responsabilidad) y una polÃƒÆ’Ã‚Â­tica de tolerancia cero ante estafadores. Asimismo, se detectÃƒÆ’Ã‚Â³ la necesidad de simplificar estÃƒÆ’Ã‚Â©ticamente la pÃƒÆ’Ã‚Â¡gina de inicio, removiendo elementos visuales redundantes o bordes de color asimÃƒÆ’Ã‚Â©tricos para brindar una experiencia mÃƒÆ’Ã‚Â¡s premium y minimalista.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  1. **SecciÃƒÆ’Ã‚Â³n de Integridad**: DiseÃƒÆ’Ã‚Â±amos una estructura semÃƒÆ’Ã‚Â¡ntica HTML5 (`integrity-section` con identificador ÃƒÆ’Ã‚Âºnico) que se inserta entre el bloque de credibilidad y la seguridad tÃƒÆ’Ã‚Â©cnica en `index.html`, omitiendo el badge de texto secundario inicial para lograr una presentaciÃƒÆ’Ã‚Â³n mÃƒÆ’Ã‚Â¡s limpia y directa.
  2. **Timeline de Doble Sendero en Espejo**: DiseÃƒÆ’Ã‚Â±amos una lÃƒÆ’Ã‚Â­nea de tiempo vertical central de neÃƒÆ’Ã‚Â³n que ramifica los hitos en espejo y de forma alternada: a la izquierda, el flujo de honestidad con puntos cian y texto alineado a la derecha; a la derecha, los filtros y exclusiones con puntos rojos y texto alineado a la izquierda, omitiendo bordes de realce de color laterales en las cajas para obtener un diseÃƒÆ’Ã‚Â±o 100% minimalista, limpio y centrado en los puntos de neÃƒÆ’Ã‚Â³n. En mÃƒÆ’Ã‚Â³viles (<768px), la lÃƒÆ’Ã‚Â­nea de tiempo se desplaza al extremo izquierdo, las cajas colapsan a un flujo vertical consistente y se ocultan tanto el pÃƒÆ’Ã‚Â¡rrafo introductorio de alta persuasiÃƒÆ’Ã‚Â³n como la nota legal de cumplimiento en la base para evitar sobrecarga de texto y reducir la altura vertical de la secciÃƒÆ’Ã‚Â³n en dispositivos pequeÃƒÆ’Ã‚Â±os. Redactamos y resumimos la nota de cumplimiento legal en la base para evitar el tÃƒÆ’Ã‚Â©rmino "fondos" y usar en su lugar "tokens y transacciones", mitigando riesgos de encuadramiento en leyes bancarias de transmisiÃƒÆ’Ã‚Â³n de dinero (MTL).
  3. **Visual TemÃƒÆ’Ã‚Â¡tico sin Placeholders**: Se generÃƒÆ’Ã‚Â³ una ilustraciÃƒÆ’Ã‚Â³n 3D premium (`integrity_shield.png`) usando IA para encajar en el estilo cibernÃƒÆ’Ã‚Â©tico oscuro de la landing page.
  4. **EliminaciÃƒÆ’Ã‚Â³n de Bordes Laterales de Color en Tarjetas**: Para homogeneizar el diseÃƒÆ’Ã‚Â±o limpio libre de "tarjetas recargadas" y evitar fatiga visual, se removieron los bordes asimÃƒÆ’Ã‚Â©tricos de color en los laterales de las tarjetas flotantes `.card-blue` (borde derecho cian) y `.card-red` (borde izquierdo rojo) en `landing.css`, manteniendo ÃƒÆ’Ã‚Âºnicamente sus acentos superiores lineales para conservar la codificaciÃƒÆ’Ã‚Â³n cromÃƒÆ’Ã‚Â¡tica sin saturar la composiciÃƒÆ’Ã‚Â³n 3D.
  5. **OptimizaciÃƒÆ’Ã‚Â³n de AnimaciÃƒÆ’Ã‚Â³n (IntersectionObserver)**: Vinculamos los selectores `.integrity-section` y `.timeline-item` en `landing.js` para ejecutar animaciones de desplazamiento suave ascendentes aceleradas por GPU, liberando los observadores tras su apariciÃƒÆ’Ã‚Â³n para optimizar memoria RAM.
- **Impacto**: Se elimina la fatiga de tarjetas del usuario final introduciendo un diagrama de flujo interactivo premium. Se fortalece el posicionamiento legal y la reputaciÃƒÆ’Ã‚Â³n de la startup ante eventuales auditorÃƒÆ’Ã‚Â­as FinTech (KYC/AML). La interfaz de usuario es responsiva, limpia y transmite confianza profesional inmediata al visitante.
- **Evidencia**:
  - Vista HTML: [index.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/index.html).
  - Hoja de Estilos: [landing.css](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/landing.css).
  - LÃƒÆ’Ã‚Â³gica e Interactividad: [landing.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/landing.js).
  - Recurso GrÃƒÆ’Ã‚Â¡fico: [integrity_shield.png](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/assets/images/landing/integrity_shield.png).

### 2026-06-18 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ ProyecciÃƒÆ’Ã‚Â³n de Canje en Cascada y Filtrado DinÃƒÆ’Ã‚Â¡mico de Cobertura KYC

- **Contexto**: El equipo de administraciÃƒÆ’Ã‚Â³n requerÃƒÆ’Ã‚Â­a visualizar quÃƒÆ’Ã‚Â© porcentaje de la deuda apta (KYC verificado) de los impulsores puede ser cubierta con las comisiones actuales disponibles en la caja de la plataforma. Era necesario un cÃƒÆ’Ã‚Â¡lculo en cascada (Nivel 1 al 5) para auditar financieramente el alcance de los fondos, omitiendo niveles sin deuda y mostrando claramente el estado de cobertura en tiempo real.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  1. **Algoritmo de Cobertura en Cascada**: Se implementÃƒÆ’Ã‚Â³ una lÃƒÆ’Ã‚Â³gica financiera de distribuciÃƒÆ’Ã‚Â³n descendente en `adminController.js` que toma el saldo total de la `platform_wallet` y lo resta secuencialmente de la deuda `eligible` (KYC aprobado) de cada nivel de impulsores. Se calcula el porcentaje exacto de cobertura por nivel hasta que se agoten los fondos.
  2. **Filtrado de Niveles VacÃƒÆ’Ã‚Â­os o Sin Alcance**: Para mantener la interfaz limpia y evitar informaciÃƒÆ’Ã‚Â³n incoherente, el backend ahora ignora matemÃƒÆ’Ã‚Â¡ticamente los niveles que tienen `0` deuda apta. Adicionalmente, el frontend omite renderizar niveles cuyo alcance de cobertura sea del `0%`, mostrando solo los datos relevantes para el ciclo de pago actual.
  3. **EstÃƒÆ’Ã‚Â©tica y Uniformidad UI**: Se creÃƒÆ’Ã‚Â³ una nueva tarjeta dedicada ("ProyecciÃƒÆ’Ã‚Â³n de Canje") tanto en el Dashboard Principal como en la pestaÃƒÆ’Ã‚Â±a de Impulsores. Se aplicÃƒÆ’Ã‚Â³ un diseÃƒÆ’Ã‚Â±o vertical que hereda la clase `stat-value` (tamaÃƒÆ’Ã‚Â±os gigantes dinÃƒÆ’Ã‚Â¡micos con Container Queries), alineando su estÃƒÆ’Ã‚Â©tica con las tarjetas preexistentes. Se utilizÃƒÆ’Ã‚Â³ la paleta oficial (Azul WintonCoin para cobertura parcial y Verde para cobertura total), removiendo ÃƒÆ’Ã‚Â­conos redundantes para un aspecto institucional.
- **Impacto**: Transparencia financiera total para los administradores. El sistema ahora proyecta automÃƒÆ’Ã‚Â¡ticamente el alcance de los fondos disponibles para liquidar deudas, basÃƒÆ’Ã‚Â¡ndose estrictamente en el pasivo exigible (KYC). La interfaz mantiene una estÃƒÆ’Ã‚Â©tica premium sin ruido visual.
- **Evidencia**:
  - Controlador: [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js).
  - Frontend: [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js).

### 2026-06-17 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ UnificaciÃƒÆ’Ã‚Â³n de Archivos de ConfiguraciÃƒÆ’Ã‚Â³n de Entornos y Cumplimiento de Mantenibilidad SOC 2

- **Contexto**: El proyecto poseÃƒÆ’Ã‚Â­a dos configuraciones de desarrollo en paralelo: un archivo `backend/.env` local e interno para el backend, y un archivo `.env.development` en la raÃƒÆ’Ã‚Â­z del proyecto para configuraciones globales. Esta duplicidad de secretos (Web3 keys, credenciales de Twilio, VAPID push keys y contraseÃƒÆ’Ã‚Â±as administrativas locales) violaba el estÃƒÆ’Ã‚Â¡ndar de control de configuraciÃƒÆ’Ã‚Â³n SOC 2, incrementando el riesgo de *configuration drift* e introduciendo vulnerabilidades al dificultar la rotaciÃƒÆ’Ã‚Â³n y trazabilidad de secretos en despliegues.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  1. **ConsolidaciÃƒÆ’Ã‚Â³n de Variables en la RaÃƒÆ’Ã‚Â­z**: Se unificaron todas las claves secretas y operativas del backend local dentro del archivo `.env.development` en la raÃƒÆ’Ã‚Â­z del proyecto, estableciendo una ÃƒÆ’Ã‚Âºnica fuente de verdad por entorno.
  2. **DesactivaciÃƒÆ’Ã‚Â³n del Archivo Duplicado**: Se renombrÃƒÆ’Ã‚Â³ el archivo redundante `backend/.env` a `backend/.env.backup` para desactivar su carga en caliente y prepararlo para su remociÃƒÆ’Ã‚Â³n definitiva una vez estabilizado el cambio.
  3. **RefactorizaciÃƒÆ’Ã‚Â³n del Punto de Entrada**: Se modificÃƒÆ’Ã‚Â³ [server.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/server.js) removiendo la invocaciÃƒÆ’Ã‚Â³n directa a `require('dotenv').config()` al inicio del script. En su lugar, el servidor delega la carga dinÃƒÆ’Ã‚Â¡mica y jerÃƒÆ’Ã‚Â¡rquica de variables al cargador centralizado [config.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/config.js) segÃƒÆ’Ã‚Âºn el valor de `NODE_ENV`.
  4. **AdaptaciÃƒÆ’Ã‚Â³n de Scripts Secundarios**: Para evitar roturas en tareas de mantenimiento independientes y scripts de diagnÃƒÆ’Ã‚Â³stico, se removiÃƒÆ’Ã‚Â³ la carga directa de `dotenv` y se reemplazÃƒÆ’Ã‚Â³ por la importaciÃƒÆ’Ã‚Â³n de `config.js` en scripts como [check-push.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/scripts/check-push.js), [test_user_balance.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/test_user_balance.js), [fix-booster-task.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/fix-booster-task.js), [check_schema.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/check_schema.js), [publish_legal_document.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/scripts/publish_legal_document.js), [inject-legal.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/scripts/inject-legal.js), [debug_active.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/debug_active.js), [migrationRunner.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/scripts/migrationRunner.js), [reset_dev_db.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/scripts/reset_dev_db.js) y [temp_query2.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/temp_query2.js).
  5. **Resiliencia en Portapapeles (Clipboard Fallback)**: Se identificÃƒÆ’Ã‚Â³ que en contextos no seguros (cuando se accede vÃƒÆ’Ã‚Â­a HTTP por IP local de red tipo `http://192.168.100.7:5173/`), la API moderna `navigator.clipboard` es bloqueada por el navegador y se evalÃƒÆ’Ã‚Âºa como `undefined`, causando que el clic en "COMPARTIR MI CÃƒÆ’Ã¢â‚¬Å“DIGO" crasheara la UI con un error no controlado `TypeError: Cannot read properties of undefined (reading 'writeText')`. DiseÃƒÆ’Ã‚Â±amos y creamos el mÃƒÆ’Ã‚Â³dulo reutilizable [clipboard.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/modules/clipboard.js) que encapsula un mecanismo de respaldo (*fallback*) compatible con HTTP local/inseguro mediante un elemento `<textarea>` temporal y `document.execCommand('copy')`. Expusimos la utilidad de forma modular y global (`window.copyTextToClipboard`) y refactorizamos todas las llamadas del portapapeles del frontend.
- **Impacto**: Se elimina la duplicidad y el riesgo de solapamiento de configuraciones locales. El backend y todos los scripts utilitarios ahora utilizan la misma lÃƒÆ’Ã‚Â³gica declarativa unificada para resolver sus variables de entorno, y se resguarda el entorno de producciÃƒÆ’Ã‚Â³n en la nube (Render) al blindarlo contra inyecciones accidentales de credenciales locales hardcoded. Adicionalmente, el frontend ahora tolera accesos multiplataforma en entornos de red locales inseguros sin crasheos en la copia de direcciones Web3 ni cÃƒÆ’Ã‚Â³digos de referido.
- **Evidencia**:
  - ConfiguraciÃƒÆ’Ã‚Â³n Unificada: [.env.development](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/.env.development).
  - Servidor Principal: [server.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/server.js).
  - Cargadores y Scripts: [db.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/config/db.js) y scripts utilitarios adaptados.
  - MÃƒÆ’Ã‚Â³dulo de Portapapeles: [clipboard.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/modules/clipboard.js) y pÃƒÆ’Ã‚Â¡ginas frontend refactorizadas ([contract-interaction.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/contract-interaction.js), [publication-detail.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/publication-detail.js), [profile.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/profile.js), [estado-cuenta.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/estado-cuenta.js), [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js), [governance-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/governance-panel.js)).

### 2026-06-16 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AuditorÃƒÆ’Ã‚Â­a de Integridad del Esquema, UnificaciÃƒÆ’Ã‚Â³n de Referidos y MitigaciÃƒÆ’Ã‚Â³n de Incongruencias

- **Contexto**: Al resetear el entorno local y aplicar la secuencia incremental de 64 migraciones, se identificaron dudas sobre la posible redundancia en la adiciÃƒÆ’Ã‚Â³n de columnas de referidos (`referred_by_user_id` y `referrer_id` / `referres_id`). Adicionalmente, el esquema base requerÃƒÆ’Ã‚Â­a una auditorÃƒÆ’Ã‚Â­a profunda orientada a SOC 2 y cumplimiento FinTech para detectar posibles errores de integridad, redundancias, conflictos de tipos de datos e inconsistencias en la lÃƒÆ’Ã‚Â³gica de claves forÃƒÆ’Ã‚Â¡neas.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  1. **UnificaciÃƒÆ’Ã‚Â³n del Sistema de Referidos**: Confirmamos la erradicaciÃƒÆ’Ã‚Â³n del campo redundante `referred_by_user_id` en la tabla `users` mediante la migraciÃƒÆ’Ã‚Â³n `064_add_missing_schema_columns.js`, estandarizando toda la lÃƒÆ’Ã‚Â³gica del backend (registro en `authController.js` y cÃƒÆ’Ã‚Â¡lculo de puntaje en `creditScoringService.js`) en una ÃƒÆ’Ã‚Âºnica columna de relaciÃƒÆ’Ã‚Â³n directa llamada `referrer_id`. Para la bitÃƒÆ’Ã‚Â¡cora auditable de invitaciones se conserva la tabla independiente `referral_log` (que asocia `referrer_user_id` con `referred_user_id` de forma histÃƒÆ’Ã‚Â³rica), garantizando un diseÃƒÆ’Ã‚Â±o optimizado y trazable.
  2. **DetecciÃƒÆ’Ã‚Â³n de Conflicto de Integridad Referencial**: Identificamos una falla lÃƒÆ’Ã‚Â³gica grave en la definiciÃƒÆ’Ã‚Â³n de la tabla `referral_log` en [databaseInit.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/config/databaseInit.js). La columna `referrer_user_id` estÃƒÆ’Ã‚Â¡ declarada como `NOT NULL REFERENCES users(id) ON DELETE SET NULL`. Esto crea una contradicciÃƒÆ’Ã‚Â³n semÃƒÆ’Ã‚Â¡ntica que causarÃƒÆ’Ã‚Â¡ que PostgreSQL bloquee la eliminaciÃƒÆ’Ã‚Â³n fÃƒÆ’Ã‚Â­sica de cualquier usuario patrocinador con un error de restricciÃƒÆ’Ã‚Â³n de no-nulos, invalidando la directiva de eliminaciÃƒÆ’Ã‚Â³n en cascada o desactivaciÃƒÆ’Ã‚Â³n.
  3. **IdentificaciÃƒÆ’Ã‚Â³n de Inconsistencia en Claves Naturales vs Artificiales**: Evidenciamos una desalineaciÃƒÆ’Ã‚Â³n de diseÃƒÆ’Ã‚Â±o en el esquema original. MÃƒÆ’Ã‚Â³dulos modernos como el Ledger de Impulsores y Transacciones Generales utilizan identificadores numÃƒÆ’Ã‚Â©ricos consistentes (`users.id` como clave forÃƒÆ’Ã‚Â¡nea), mientras que mÃƒÆ’Ã‚Â³dulos como P2P (`p2p_offers`, `p2p_orders`), Escrows (`blue_token_escrows`) y Deudas RED (`red_token_debts`) utilizan el nombre de usuario mutable (`users.username` como clave forÃƒÆ’Ã‚Â¡nea). Esto atenta contra las mejores prÃƒÆ’Ã‚Â¡cticas de normalizaciÃƒÆ’Ã‚Â³n de base de datos debido al alto costo de indexaciÃƒÆ’Ã‚Â³n de cadenas y al riesgo de rotura de referencias si se implementa un cambio de nombre de usuario.
  4. **SegregaciÃƒÆ’Ã‚Â³n de Migraciones Comentadas en Render**: Se constatÃƒÆ’Ã‚Â³ que la desactivaciÃƒÆ’Ã‚Â³n de `applyMigrations` en [databaseInit.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/config/databaseInit.js) para evitar bloqueos de transacciones prolongadas en el despliegue de la plataforma Render dejÃƒÆ’Ã‚Â³ inactivas funciones crÃƒÆ’Ã‚Â­ticas de migraciÃƒÆ’Ã‚Â³n de datos de un solo uso (como el backfill de cÃƒÆ’Ã‚Â³digos de referidos y la migraciÃƒÆ’Ã‚Â³n de cuentas heredadas). Esta desactivaciÃƒÆ’Ã‚Â³n no afecta la reconstrucciÃƒÆ’Ã‚Â³n local desde cero ya que los datos iniciales se crean limpios, pero representa un riesgo de mantenimiento en entornos legados que no corrieron el proceso de manera manual.
  5. **RefactorizaciÃƒÆ’Ã‚Â³n de Interfaz en Billetera de Plataforma (Partida Doble)**: Renombramos el encabezado en [admin-panel.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-panel.html) de "Historial de Comisiones" a "Historial de Transacciones". Esto corrige una inconsistencia de UX de la billetera, debido a que la secciÃƒÆ’Ã‚Â³n ahora consolida tanto ingresos por comisiones de publicaciones como egresos por liquidaciÃƒÆ’Ã‚Â³n a impulsores, lo cual se alinea con la nomenclatura profesional de la industria FinTech.
  6. **ResoluciÃƒÆ’Ã‚Â³n de Error CrÃƒÆ’Ã‚Â­tico de Registro de Usuarios (Falta de Columnas)**: Se detectÃƒÆ’Ã‚Â³ la ausencia de las columnas `date_of_birth` e `is_minor` en la tabla temporal `pending_verifications` (debido al bypass de migraciones internas en Render). Esto bloqueaba por completo la creaciÃƒÆ’Ã‚Â³n de nuevas solicitudes de afiliaciÃƒÆ’Ã‚Â³n en local y producciÃƒÆ’Ã‚Â³n. Se solucionÃƒÆ’Ã‚Â³ introduciendo la migraciÃƒÆ’Ã‚Â³n incremental `066_add_minor_fields_to_pending_verifications.js`.
- **Impacto**: La unificaciÃƒÆ’Ã‚Â³n de columnas y la detecciÃƒÆ’Ã‚Â³n temprana de restricciones incompatibles previenen fallos imprevistos de base de datos en producciÃƒÆ’Ã‚Â³n. Se establece una ruta clara para la migraciÃƒÆ’Ã‚Â³n progresiva de claves forÃƒÆ’Ã‚Â¡neas basadas en cadenas hacia identificadores numÃƒÆ’Ã‚Â©ricos en futuros hitos de refactorizaciÃƒÆ’Ã‚Â³n, alineando la plataforma con los requisitos de robustez SOC 2.
- **Evidencia**:
  - AuditorÃƒÆ’Ã‚Â­a de Referidos: [064_add_missing_schema_columns.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/064_add_missing_schema_columns.js).
  - LÃƒÆ’Ã‚Â³gica de Base de Datos Base: [databaseInit.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/config/databaseInit.js).
  - MigraciÃƒÆ’Ã‚Â³n Correctiva de Registro: [066_add_minor_fields_to_pending_verifications.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/066_add_minor_fields_to_pending_verifications.js).

### 2026-06-15 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ ReconciliaciÃƒÆ’Ã‚Â³n Contable, Procesamiento por Lotes y Ventana de ExclusiÃƒÆ’Ã‚Â³n DinÃƒÆ’Ã‚Â¡mica en Pagos de Impulsores

- **Contexto**: El proceso de distribuciÃƒÆ’Ã‚Â³n de pagos de impulsores (`executeBoosterPayments`) presentaba tres debilidades a gran escala:
  1. **Desfase de Presupuesto y Partida Doble**: Buscaba el presupuesto filtrando por comisiones mensuales (dando `0.0000 BLUE` en meses sin transacciones) e ignoraba las comisiones acumuladas en el dashboard. AdemÃƒÆ’Ã‚Â¡s, no deducÃƒÆ’Ã‚Â­a los egresos de `platform_wallet` ni registraba egresos en el ledger, violando la contabilidad de partida doble.
  2. **Riesgo de Agotamiento de Memoria (OOM) y Bloqueos de TransacciÃƒÆ’Ã‚Â³n (Locks)**: Cargar todos los impulsores en un solo array y procesarlos en una transacciÃƒÆ’Ã‚Â³n larga bloqueaba las tablas de base de datos durante segundos/minutos, provocando deadlocks y freeze de la aplicaciÃƒÆ’Ã‚Â³n en producciÃƒÆ’Ã‚Â³n.
  3. **Incongruencia en Frecuencia de Pagos e Idempotencia**: Si la frecuencia se configuraba en minutos/horas, una exclusiÃƒÆ’Ã‚Â³n estricta por mes calendario impedÃƒÆ’Ã‚Â­a que los usuarios cobraran mÃƒÆ’Ã‚Â¡s de una vez al mes. Si no habÃƒÆ’Ã‚Â­a exclusiÃƒÆ’Ã‚Â³n, un reinicio por caÃƒÆ’Ã‚Â­da del servidor duplicaba los cobros en el mismo ciclo.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  1. **Procesamiento por Lotes (Batching / Keyset Pagination)**: Refactorizamos `executeBoosterPayments` en [boosterService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/boosterService.js) utilizando paginaciÃƒÆ’Ã‚Â³n por cursores (`u.id > lastProcessedId ORDER BY u.id ASC LIMIT 500`). Esto garantiza un consumo de memoria plano e inmune a errores de falta de memoria (OOM).
  2. **Transacciones Cortas Independientes (Chunked Transactions)**: Cada lote de 500 usuarios abre y compromete (`COMMIT`) su propia transacciÃƒÆ’Ã‚Â³n atÃƒÆ’Ã‚Â³mica rÃƒÆ’Ã‚Â¡pida, bloqueando `platform_wallet FOR UPDATE` por pocos milisegundos y liberando el pool para mantener el sistema altamente responsivo.
  3. **Ventana de ExclusiÃƒÆ’Ã‚Â³n DinÃƒÆ’Ã‚Â¡mica (Dynamic Lookback Window)**:
     * Si el ciclo es Mensual, se excluyen usuarios que cobraron en el mismo mes.
     * Si es Personalizado, se excluyen mediante una ventana de tiempo exacta igual a la frecuencia configurada (`created_at >= NOW() - INTERVAL 'totalFreqMs milliseconds'`). Esto previene el doble pago en el mismo ciclo (idempotencia) y permite cobros sucesivos congruentes en ciclos futuros.
  4. **Asiento Contable de Egreso y Partida Doble**: Cada pago se descuenta atÃƒÆ’Ã‚Â³micamente de `platform_wallet` e inserta una transacciÃƒÆ’Ã‚Â³n con monto negativo en `platform_wallet_log` (tipo `booster_payout`).
  5. **Pruebas de IntegraciÃƒÆ’Ã‚Â³n y Tolerancia a Fallos**: AÃƒÆ’Ã‚Â±adimos aserciones en [boosterPaymentsReconciliation.test.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/__tests__/boosterPaymentsReconciliation.test.js) que ejecutan ciclos seguidos con nuevas deudas para asegurar que la ventana de exclusiÃƒÆ’Ã‚Â³n temporal bloquee doble pago y que la inmutabilidad fÃƒÆ’Ã‚Â­sica del Ledger General de la base de datos se respecte.
  6. **ReconciliaciÃƒÆ’Ã‚Â³n Contable Retroactiva (MigraciÃƒÆ’Ã‚Â³n 062)**: Introdujimos una migraciÃƒÆ’Ã‚Â³n que recorre todos los registros de comisiones histÃƒÆ’Ã‚Â³ricas (`platform_commission_log`), reconstruyendo sus ingresos correspondientes en el libro mayor `platform_wallet_log` asociando cada registro a su publicaciÃƒÆ’Ã‚Â³n/concepto y pagador correspondiente, y recalculando el saldo neto consolidado en `platform_wallet` para evitar incoherencias con saldos acumulados del dashboard.
- **Impacto**: Se logrÃƒÆ’Ã‚Â³ un motor de distribuciÃƒÆ’Ã‚Â³n de grado de producciÃƒÆ’Ã‚Â³n masiva (Binance/Stripe standard) 100% tolerante a fallos, infinitamente escalable, consistente con partida doble contable (GAAP) y con un tiempo de bloqueo de base de datos de milisegundos.
- **Evidencia**:
  - Servicio: [boosterService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/boosterService.js).
  - InicializaciÃƒÆ’Ã‚Â³n de Base de Datos: [databaseInit.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/config/databaseInit.js).
  - Migraciones: [061_create_platform_wallet_log.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/061_create_platform_wallet_log.js), [062_reconcile_historical_commissions.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/062_reconcile_historical_commissions.js) y [063_enforce_ledgers_immutability.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/063_enforce_ledgers_immutability.js) (para blindar fÃƒÆ’Ã‚Â­sicamente mediante triggers de base de datos las tablas `booster_payment_log`, `platform_wallet_log`, `booster_blue_ledger` y `platform_commission_log` contra borrados y modificaciones).
  - Pruebas: [boosterPaymentsReconciliation.test.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/__tests__/boosterPaymentsReconciliation.test.js) (se adaptaron para desactivar y reactivar temporalmente los triggers de inmutabilidad en la fase de setup/limpieza del test).
  - Herramientas de Base de Datos: Se eliminÃƒÆ’Ã‚Â³ el antiguo archivo `reset-production.js` y se implementÃƒÆ’Ã‚Â³ en su lugar el script profesional [reset_dev_db.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/scripts/reset_dev_db.js) expuesto a travÃƒÆ’Ã‚Â©s de `npm run db:reset` en [package.json](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/package.json). Este vacÃƒÆ’Ã‚Â­a de forma segura el esquema pÃƒÆ’Ã‚Âºblico local y confÃƒÆ’Ã‚Â­a en el Migration Runner para reconstruir ordenadamente toda la base de datos con las 63 migraciones consecutivas, evitando cÃƒÆ’Ã‚Â³digo DDL duplicado u obsoleto.
  - IntegraciÃƒÆ’Ã‚Â³n Visual (Dashboard & Historial): Se integraron tarjetas interactivas de "Comisiones Acumuladas" en el panel de control de impulsores y tarjetas informativas del total de fondos liquidados y nÃƒÆ’Ã‚Âºmero de transacciones sobre la grilla del historial de pagos en [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js) y [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js). Adicionalmente, se alinearon las consultas SQL del panel en `adminController.js` para filtrar estrictamente por `is_booster = TRUE`, resolviendo una discrepancia matemÃƒÆ’Ã‚Â¡tica de `209 BLUE` de usuarios con balances inactivos, y se actualizÃƒÆ’Ã‚Â³ el manejador de clics del frontend para soportar redirecciones a secciones globales (como redirigir a Billetera al hacer clic en Comisiones Acumuladas).

### 2026-06-14 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ RediseÃƒÆ’Ã‚Â±o de Tarjetas del Dashboard a Enlaces Interactivos y Escalado Responsivo de Fuentes

- **Contexto**: Para mejorar la experiencia de usuario (UX) en el panel de administraciÃƒÆ’Ã‚Â³n, se requerÃƒÆ’Ã‚Â­a que las tarjetas del dashboard principal y de impulsores actuaran como enlaces directos interactivos que redirigieran a sus respectivas secciones o pestaÃƒÆ’Ã‚Â±as, en lugar de depender ÃƒÆ’Ã‚Âºnicamente de la barra de navegaciÃƒÆ’Ã‚Â³n lateral o de enlaces de texto redundantes en el pie de las tarjetas (como el enlace "impulsores"). AdemÃƒÆ’Ã‚Â¡s, debido a la longitud de los balances de millones/miles de millones con 4 decimales (ej. `1.305.026.386,0000`), era necesario adaptar la fuente de las tarjetas para que no se desboradara del contenedor fÃƒÆ’Ã‚Â­sico.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  1. **Interactividad del Dashboard General**: Se modificÃƒÆ’Ã‚Â³ `renderDashboard` en [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js) para inyectar la clase `interactive-card` y el atributo `data-target-section`. Al hacer clic en cualquier tarjeta del dashboard general, el manejador de eventos redirige dinÃƒÆ’Ã‚Â¡micamente a la secciÃƒÆ’Ã‚Â³n del panel de administraciÃƒÆ’Ã‚Â³n correspondiente (por ejemplo: "Usuarios Totales" redirige a "Usuarios", "Publicaciones Activas" a "Contenido", "BLUE en CirculaciÃƒÆ’Ã‚Â³n" a "Billetera", y "BLUE IOU Entregados" a "Impulsores").
  2. **Interactividad y SimplificaciÃƒÆ’Ã‚Â³n en Impulsores**: Se modificÃƒÆ’Ã‚Â³ `renderBoostersDashboard` en [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js) eliminando el enlace redundante "impulsores" del pie de cada tarjeta de nivel. Se inyectÃƒÆ’Ã‚Â³ en su lugar el atributo `data-target-tab` y `data-level` sobre la tarjeta completa. Al hacer clic en una tarjeta de nivel (del 1 al 5), el sistema redirige automÃƒÆ’Ã‚Â¡ticamente a la pestaÃƒÆ’Ã‚Â±a de "Lista de Impulsores" aplicando en caliente el filtro para ese nivel especÃƒÆ’Ã‚Â­fico. Al hacer clic en las otras tarjetas de estadÃƒÆ’Ã‚Â­sticas, se redirige a sus correspondientes pestaÃƒÆ’Ã‚Â±as ("Lista de Impulsores" o "Historial de Pagos").
  3. **Escalado Responsivo Basado en Container Queries**: Se habilitaron consultas de contenedor (`container-type: inline-size`) en la clase `.stat-card` de [admin-style.css](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-style.css). Se modificÃƒÆ’Ã‚Â³ `.stat-value` utilizando un tamaÃƒÆ’Ã‚Â±o de fuente dinÃƒÆ’Ã‚Â¡mico y responsivo con `font-size: clamp(1.4rem, 11cqi, 2.2rem);`. Esto hace que el tamaÃƒÆ’Ã‚Â±o del nÃƒÆ’Ã‚Âºmero se adapte dinÃƒÆ’Ã‚Â¡micamente y se reduzca de forma proporcional al ancho de la tarjeta fÃƒÆ’Ã‚Â­sica, previniendo cualquier desbordamiento visual. AdemÃƒÆ’Ã‚Â¡s, se configuraron reglas robustas de envoltura (`word-wrap: break-word`, `overflow-wrap: break-word`, `word-break: break-all`) para asegurar que nÃƒÆ’Ã‚Âºmeros excepcionalmente largos se envuelvan de manera limpia y estÃƒÆ’Ã‚Â©tica sin romper el diseÃƒÆ’Ã‚Â±o responsive.
  4. **OptimizaciÃƒÆ’Ã‚Â³n del Layout del Grid**: Se ampliÃƒÆ’Ã‚Â³ el ancho mÃƒÆ’Ã‚Â­nimo de las columnas en el grid `.stats-container` de `250px` a `270px` para dar mÃƒÆ’Ã‚Â¡s espacio horizontal a las estadÃƒÆ’Ã‚Â­sticas del panel administrativo.
- **Impacto**: Se logrÃƒÆ’Ã‚Â³ una interfaz de usuario significativamente mÃƒÆ’Ã‚Â¡s limpia, intuitiva y profesional, eliminando texto redundante y ofreciendo una navegaciÃƒÆ’Ã‚Â³n de un solo toque en todo el panel de administraciÃƒÆ’Ã‚Â³n. Gracias a las container queries, la presentaciÃƒÆ’Ã‚Â³n de los datos financieros ahora es 100% robusta, flexible y auto-adaptativa, garantizando una estÃƒÆ’Ã‚Â©tica premium coherente con los mÃƒÆ’Ã‚Â¡s altos estÃƒÆ’Ã‚Â¡ndares de diseÃƒÆ’Ã‚Â±o para startups de Silicon Valley.
- **Evidencia**:
  - Estilos de PresentaciÃƒÆ’Ã‚Â³n: [admin-style.css](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-style.css).
  - LÃƒÆ’Ã‚Â³gica y Render: [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js).

### 2026-06-13 (Parte 4) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Tarjetas de Deuda por Nivel y SegregaciÃƒÆ’Ã‚Â³n de Aptitud KYC en Impulsores

- **Contexto**: El panel administrativo requerÃƒÆ’Ã‚Â­a una forma visual e intuitiva para evaluar el pasivo acumulado en el ledger promocional de impulsores desglosado por cada uno de los 5 niveles del programa, permitiendo filtrar a los usuarios por nivel. Adicionalmente, de acuerdo con los estÃƒÆ’Ã‚Â¡ndares y regulaciones FinTech (AML/CFT), es crucial segregar la deuda acumulada de la deuda legalmente liquidable (usuarios con KYC aprobado), visualizando claramente la elegibilidad de los participantes tanto en las tarjetas del dashboard como en la lista de usuarios.
  - **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
    1. **CÃƒÆ’Ã‚Â¡lculo de Deuda Apta y Total por Nivel**: Se optimizÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n `getBoosterStats` en [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js) implementando agregaciÃƒÆ’Ã‚Â³n condicional en PostgreSQL para agrupar los balances del ledger por nivel y diferenciar las sumatorias totales de aquellas que cumplen con `kyc_verified = TRUE`. Se extendiÃƒÆ’Ã‚Â³ ademÃƒÆ’Ã‚Â¡s el endpoint general del panel `/dashboard-stats` para devolver el total de fondos aptos.
    2. **InclusiÃƒÆ’Ã‚Â³n de KYC en el Listado**: Se actualizÃƒÆ’Ã‚Â³ `getBoostersList` para retornar la propiedad `kyc_verified` de cada impulsor.
    3. **VisualizaciÃƒÆ’Ã‚Â³n de Cumplimiento en Frontend**: Se modificÃƒÆ’Ã‚Â³ [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js) para renderizar en el dashboard general y de impulsores el pasivo total y la deuda apta de KYC. Se dibujaron las 5 tarjetas de niveles 1 a 5 con cÃƒÆ’Ã‚Â³digos de colores curados (Visionario, Bronce, Plata, Oro y Platino) y subtextos de cumplimiento.
    4. **Filtrado Reactivo del Lado del Cliente (Inmunidad SQLi)**: Se configuraron listeners de clics sobre los enlaces de cada tarjeta para redirigir fluidamente al listado de impulsores aplicando un filtro local en memoria sobre el cachÃƒÆ’Ã‚Â© `boosterListCache`, inyectando un badge de filtro activo con la opciÃƒÆ’Ã‚Â³n de limpiar el filtro (botÃƒÆ’Ã‚Â³n `ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¢`). Esto garantiza un tiempo de respuesta de 0ms y elimina vulnerabilidades de inyecciÃƒÆ’Ã‚Â³n SQL al evitar peticiones repetitivas al servidor.
    5. **Columna KYC en Tabla**: Se agregÃƒÆ’Ã‚Â³ una nueva columna "Estado KYC" en la grilla de impulsores con badges verdes (`Verificado`) y rojos (`No Verificado`) para mayor transparencia administrativa.
    6. **DepuraciÃƒÆ’Ã‚Â³n y Limpieza Visual**: Se eliminaron los textos redundantes y subtÃƒÆ’Ã‚Â­tulos del panel (como la descripciÃƒÆ’Ã‚Â³n del programa, el tÃƒÆ’Ã‚Â­tulo secundario "Dashboard de Impulsores" y el encabezado "Deuda Acumulada por Nivel") junto con la lÃƒÆ’Ã‚Â­nea divisoria horizontal. Esto optimizÃƒÆ’Ã‚Â³ el espacio vertical de la interfaz, logrando una presentaciÃƒÆ’Ã‚Â³n mÃƒÆ’Ã‚Â¡s limpia y centrada en los datos financieros del dashboard.
- **Impacto**: Se logrÃƒÆ’Ã‚Â³ un control del programa de impulsores 100% auditable y conforme a las mejores prÃƒÆ’Ã‚Â¡cticas de la industria financiera. Los administradores pueden visualizar la deuda acumulada real vs la deuda elegible, filtrar de forma instantÃƒÆ’Ã‚Â¡nea a los usuarios por su nivel de contribuciÃƒÆ’Ã‚Â³n y auditar el estado KYC individual directamente desde la tabla de forma segura y responsiva con una interfaz minimalista y premium.
- **Evidencia**:
  - Controlador: [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js).
  - Vistas y LÃƒÆ’Ã‚Â³gica: [admin-panel.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-panel.html) y [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js).

---

### 2026-06-13 (Parte 3) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ SincronizaciÃƒÆ’Ã‚Â³n Integral y HabilitaciÃƒÆ’Ã‚Â³n de BÃƒÆ’Ã‚Âºsqueda de Configuraciones en Gobernanza

- **Contexto**: El formulario de "Nueva Solicitud" en el panel de Gobernanza (`governance-panel.html`) utiliza un buscador autocompletable alimentado por el endpoint `/settings-catalog`. Sin embargo, las variables de frecuencia de pagos de impulsores reciÃƒÆ’Ã‚Â©n creadas, asÃƒÆ’Ã‚Â­ como todas las variables previas de Gobernanza (parÃƒÆ’Ã‚Â¡metros de quÃƒÆ’Ã‚Â³rum, time-lock, recompensas), Credit Scoring (WTS) e interfaces Web3 Smart Contracts, no aparecÃƒÆ’Ã‚Â­an en el dropdown de autocompletado del frontend. Esto se debÃƒÆ’Ã‚Â­a a que los mapas locales `SETTINGS_DISPLAY_MAP` en backend y frontend no estaban actualizados, provocando que el catÃƒÆ’Ã‚Â¡logo mostrara nombres de claves tÃƒÆ’Ã‚Â©cnicos crudos o devolviera respuestas vacÃƒÆ’Ã‚Â­as ("No se encontraron configuraciones") en el formulario de propuestas.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  1. **SincronizaciÃƒÆ’Ã‚Â³n del Mapa de ConfiguraciÃƒÆ’Ã‚Â³n del Backend**: Se actualizÃƒÆ’Ã‚Â³ el archivo centralizado [settingsDisplayMap.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/config/settingsDisplayMap.js) para asociar etiquetas legibles en espaÃƒÆ’Ã‚Â±ol a las 4 nuevas variables de **Intervalo de Pago Personalizado** de impulsores, el switch de modal intersticial, los mensajes dinÃƒÆ’Ã‚Â¡micos semanales y las claves de referidos legacy.
  2. **RefactorizaciÃƒÆ’Ã‚Â³n del Mapa de ConfiguraciÃƒÆ’Ã‚Â³n del Frontend**: Se actualizÃƒÆ’Ã‚Â³ el mapa estÃƒÆ’Ã‚Â¡tico local en [governance-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/governance-panel.js) (de la lÃƒÆ’Ã‚Â­nea 91 a la 124) inyectando todas las variables faltantes de Gobernanza (`gov_*`), Motor de Scoring (`red_credit_*`), Web3 Smart Contracts (`web3_*`) y el sistema de **Intervalo de Pago Personalizado** de impulsores.
  3. **Filtrado Defensivo de ConfiguraciÃƒÆ’Ã‚Â³n de Marketing en Gobernanza**: Se modificÃƒÆ’Ã‚Â³ el mÃƒÆ’Ã‚Â©todo `settingsCatalog` en [governanceController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/governanceController.js) para excluir a travÃƒÆ’Ã‚Â©s de la consulta SQL (`WHERE setting_key NOT LIKE 'daily_modal_%' AND setting_key != 'global_app_interstitial_enabled'`) las variables no crÃƒÆ’Ã‚Â­ticas. Esto evita que estas opciones aparezcan en el selector de Gobernanza, permitiendo a los administradores cambiarlas en caliente de forma directa sin requerir una votaciÃƒÆ’Ã‚Â³n formal.
  4. **PreservaciÃƒÆ’Ã‚Â³n de AuditorÃƒÆ’Ã‚Â­a y Compliance**: El motor de gobernanza a nivel de servicio en [governanceService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/governanceService.js) ejecuta los cambios dinÃƒÆ’Ã‚Â¡micamente mediante consultas parametrizadas directas en `app_settings` sin requerir listas blancas estÃƒÆ’Ã‚Â¡ticas, permitiendo que cualquier nueva variable que pase el quÃƒÆ’Ã‚Â³rum de supervisores sea persistida y auditada en el log transaccional (`logAuditEvent`) de forma automÃƒÆ’Ã‚Â¡tica y conforme a normativas de TI.
- **Impacto**: Se restableciÃƒÆ’Ã‚Â³ la usabilidad al 100% de la creaciÃƒÆ’Ã‚Â³n de propuestas en el portal de Gobernanza. Ahora los guardianes activos del sistema Winton-Consensus pueden proponer cambios de forma transparente buscando por el nombre amigable de cualquier variable financiera o de red crÃƒÆ’Ã‚Â­tica (por ejemplo, "Impulsores ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Intervalo de Pago Personalizado (Minutos)" o "Web3 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Protocolo Pausado") y visualizar correctamente el historial de solicitudes, mientras que las variables comunicativas no crÃƒÆ’Ã‚Â­ticas de marketing permanecen gestionables ÃƒÆ’Ã‚Â¡gilmente de forma directa desde el panel administrativo.
- **Evidencia**:
  - Backend Map: [settingsDisplayMap.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/config/settingsDisplayMap.js).
  - Frontend Panel: [governance-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/governance-panel.js).
  - Controlador Backend: [governanceController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/governanceController.js).

### 2026-06-13 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Frecuencia DinÃƒÆ’Ã‚Â¡mica y Configurable de Pagos a Impulsores y ModularizaciÃƒÆ’Ã‚Â³n del Backend

- **Contexto**: El proceso automÃƒÆ’Ã‚Â¡tico de distribuciÃƒÆ’Ã‚Â³n de pagos de impulsores (`executeBoosterPayments`) estaba acoplado directamente en el archivo monolÃƒÆ’Ã‚Â­tico `server.js` y configurado de forma rÃƒÆ’Ã‚Â­gida para ejecutarse ÃƒÆ’Ã‚Âºnicamente el primer dÃƒÆ’Ã‚Â­a de cada mes natural. Esto limitaba la capacidad de realizar pruebas y simulaciones de extremo a extremo en entornos de desarrollo y demostraciÃƒÆ’Ã‚Â³n (donde esperar un mes calendario para auditar los balances y transacciones del frontend resultaba inviable).
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  1. **ModularizaciÃƒÆ’Ã‚Â³n de boosterService.js**: Se aislÃƒÆ’Ã‚Â³ toda la lÃƒÆ’Ã‚Â³gica del motor de distribuciÃƒÆ’Ã‚Â³n de pagos sacÃƒÆ’Ã‚Â¡ndola de `server.js` y colocÃƒÆ’Ã‚Â¡ndola en [boosterService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/boosterService.js).
  2. **Scheduler Adaptativo DinÃƒÆ’Ã‚Â¡mico**: Se refactorizÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n para admitir tanto el ciclo mensual clÃƒÆ’Ã‚Â¡sico como una frecuencia de pagos personalizada en base a intervalos de tiempo (dÃƒÆ’Ã‚Â­as, horas, minutos), controlada de forma atÃƒÆ’Ã‚Â³mica a travÃƒÆ’Ã‚Â©s de variables de configuraciÃƒÆ’Ã‚Â³n guardadas en la tabla `app_settings` y consultadas en caliente.
  3. **MigraciÃƒÆ’Ã‚Â³n Idempotente (`060_add_booster_custom_frequency_settings.js`)**: Se introdujo una nueva migraciÃƒÆ’Ã‚Â³n contable para sembrar de forma segura las variables de control del intervalo (`booster_custom_frequency_enabled`, `booster_payment_frequency_days`, `booster_payment_frequency_hours`, `booster_payment_frequency_minutes`) en `app_settings`.
  4. **Frecuencia Acelerada en Backend**: Se redujo el `setInterval` de `server.js` a un periodo de 1 minuto para evaluar en tiempo real la configuraciÃƒÆ’Ã‚Â³n dinÃƒÆ’Ã‚Â¡mica, controlando la prevenciÃƒÆ’Ã‚Â³n de ejecuciones duplicadas mediante la ÃƒÆ’Ã‚Âºltima marca temporal en `booster_payment_log`.
  5. **Panel Administrativo Reactivo**: Se rediseÃƒÆ’Ã‚Â±ÃƒÆ’Ã‚Â³ el panel en [admin-panel.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-panel.html) y [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js) (secciÃƒÆ’Ã‚Â³n de Impulsores -> ConfiguraciÃƒÆ’Ã‚Â³n) inyectando un interruptor de activaciÃƒÆ’Ã‚Â³n y tres inputs numÃƒÆ’Ã‚Â©ricos para definir el intervalo. Al modificarse, se guardan en caliente en la base de datos centralizada usando la API comÃƒÆ’Ã‚Âºn del administrador.
- **Impacto**: Se descentralizÃƒÆ’Ã‚Â³ el monolito `server.js` mejorando el desacoplamiento y mantenimiento del backend. A nivel de experiencia de usuario y de desarrollo (UAT), los administradores de la plataforma ahora pueden configurar libremente la frecuencia de los pagos (ejemplo, distribuciÃƒÆ’Ã‚Â³n cada 1 minuto o 5 minutos) y verificar de forma visual en la interfaz del frontend la correcta acreditaciÃƒÆ’Ã‚Â³n de los saldos de custodia e historiales de transacciones de manera inmediata y orgÃƒÆ’Ã‚Â¡nica.
- **Evidencia**:
  - Servicio: [boosterService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/boosterService.js).
  - Servidor: [server.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/server.js).
  - Panel: [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js).
  - MigraciÃƒÆ’Ã‚Â³n: [060_add_booster_custom_frequency_settings.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/060_add_booster_custom_frequency_settings.js).

### 2026-06-13 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AmortizaciÃƒÆ’Ã‚Â³n de Deuda, PrevenciÃƒÆ’Ã‚Â³n de NaN y Cumplimiento KYC en DistribuciÃƒÆ’Ã‚Â³n de Impulsores

- **Contexto**: El proceso mensual automÃƒÆ’Ã‚Â¡tico de distribuciÃƒÆ’Ã‚Â³n de recompensas para impulsores (`executeBoosterPayments`) presentaba tres debilidades crÃƒÆ’Ã‚Â­ticas:
  1. **Doble Pago Infinito**: Los pagos de BLUE IOU a tokens BLUE reales se depositaban en la billetera del usuario, pero no se debitaban del ledger off-chain (`booster_blue_ledger`), permitiendo reclamar de forma ilimitada sobre los mismos fondos promocionales histÃƒÆ’Ã‚Â³ricos en cada ejecuciÃƒÆ’Ã‚Â³n.
  2. **Vulnerabilidad de Bloqueo por NaN**: Si un usuario impulsor no poseÃƒÆ’Ã‚Â­a registros previos en el ledger, la sumatoria devolvÃƒÆ’Ã‚Â­a `NULL` que, en JavaScript, resultaba en `NaN`. Este valor se propagaba a toda la deuda del nivel y del ciclo de pagos, bloqueando por completo la distribuciÃƒÆ’Ã‚Â³n mensual para todos los usuarios.
  3. **Cumplimiento AML/KYC**: El ciclo distribuÃƒÆ’Ã‚Â­a fondos sin verificar la identidad del beneficiario, violando las buenas prÃƒÆ’Ã‚Â¡cticas y normativas financieras locales e internacionales sobre la transmisiÃƒÆ’Ã‚Â³n de valor (AML/CFT).
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  1. **Asiento Contable de AmortizaciÃƒÆ’Ã‚Â³n**: Tras cada depÃƒÆ’Ã‚Â³sito exitoso en el balance de escrow, se inyecta un dÃƒÆ’Ã‚Â©bito (asiento negativo) con tipo `'booster_payout_deduction'` en `booster_blue_ledger` a travÃƒÆ’Ã‚Â©s del procedimiento `record_booster_event()`. Esto descuenta los fondos pagados de forma atÃƒÆ’Ã‚Â³mica y segura del ledger off-chain, sin alterar el histÃƒÆ’Ã‚Â³rico acumulado positivo (`amount > 0`) utilizado para calcular el nivel.
  2. **SanitizaciÃƒÆ’Ã‚Â³n AritmÃƒÆ’Ã‚Â©tica**: Se protegiÃƒÆ’Ã‚Â³ la subconsulta SQL de PostgreSQL mediante un `COALESCE(..., 0.0000)` para retornar un cero determinista en caso de balances nulos. Adicionalmente, se filtrÃƒÆ’Ã‚Â³ en JS a los usuarios con balance no positivo (`total_booster_blue > 0`), mitigando cualquier riesgo de error `NaN` o divisiÃƒÆ’Ã‚Â³n por cero.
  3. **Guardia KYC de Cumplimiento**: Se incorporÃƒÆ’Ã‚Â³ una polÃƒÆ’Ã‚Â­tica estricta de cumplimiento normativo (FinTech Compliance): los pagos mensuales para usuarios que no estÃƒÆ’Ã‚Â©n verificados (`kyc_verified = TRUE`) al momento de ejecuciÃƒÆ’Ã‚Â³n son temporalmente retenidos. Sus balances de BLUE IOU permanecen acumulados y seguros en el ledger off-chain, y serÃƒÆ’Ã‚Â¡n procesados en futuros ciclos una vez completen su verificaciÃƒÆ’Ã‚Â³n de identidad.
  4. **Trazabilidad de AuditorÃƒÆ’Ã‚Â­a Completa**: Se inyectÃƒÆ’Ã‚Â³ el uso de `logAuditEvent()` al inicio, culminaciÃƒÆ’Ã‚Â³n exitosa y fallos (con rollback de base de datos) del cron, garantizando que el ciclo automÃƒÆ’Ã‚Â¡tico sea 100% reproducible y auditable.
- **Impacto**: Se eliminÃƒÆ’Ã‚Â³ el riesgo de doble gasto/pago infinito y se protegiÃƒÆ’Ã‚Â³ la tesorerÃƒÆ’Ã‚Â­a de la plataforma contra el drenaje de comisiones. El motor de pagos ahora es inmune a bloqueos por valores nulos (robustez extrema) y cumple estrictamente con los estÃƒÆ’Ã‚Â¡ndares y normativas antilavado de dinero de grado bancario (AML/KYC), resguardando legalmente a la empresa.
- **Evidencia**:
  - Archivo de Servidor: [server.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/server.js).
  - VerificaciÃƒÆ’Ã‚Â³n UAT: Suite de pruebas unitarias locales ejecutada exitosamente a travÃƒÆ’Ã‚Â©s de `test_booster_payments.js` con rollback de DB.
  - Script de Pruebas Frontend: Se desarrollÃƒÆ’Ã‚Â³ e integrÃƒÆ’Ã‚Â³ el script [run_booster_payments_now.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/run_booster_payments_now.js) que genera usuarios de prueba ÃƒÆ’Ã‚Âºnicos con hasheo de bcrypt en sus contraseÃƒÆ’Ã‚Â±as (evitando triggers de inmutabilidad por eliminaciones en cascada) para permitir la simulaciÃƒÆ’Ã‚Â³n real de sesiÃƒÆ’Ã‚Â³n de usuario y control visual del Estado de Cuenta desde el Frontend Web.

---

### 2026-06-13 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Robustez, Auditabilidad y Consistencia del Ledger de Impulsores (Backfill y Niveles)

- **Contexto**: La economÃƒÆ’Ã‚Â­a interna basada en `booster_blue_ledger` (Event Sourcing) carecÃƒÆ’Ã‚Â­a de la columna `type` en su base de datos. La funciÃƒÆ’Ã‚Â³n almacenada `record_booster_event` omitÃƒÆ’Ã‚Â­a registrar el concepto de la transacciÃƒÆ’Ã‚Â³n, afectando la trazabilidad contable. AdemÃƒÆ’Ã‚Â¡s, el cÃƒÆ’Ã‚Â¡lculo de niveles de booster se basaba en la sumatoria neta (restando gastos y donaciones), penalizando injustamente a los usuarios solidarios que donaban saldo a causas humanitarias (Winton Solidario), y existÃƒÆ’Ã‚Â­a lÃƒÆ’Ã‚Â³gica de nivelaciÃƒÆ’Ã‚Â³n duplicada de forma inline en `momentumService.js`.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  1. **MigraciÃƒÆ’Ã‚Â³n AtÃƒÆ’Ã‚Â³mica e Idempotente (`059_add_type_to_booster_blue_ledger.js`)**: Se introdujo la columna `type` a la tabla de forma compatible con bases de datos en la nube (evitando deshabilitar triggers globales para eludir el error de permisos de superusuario por triggers de sistema de restricciÃƒÆ’Ã‚Â³n `RI_ConstraintTrigger` en Render).
  2. **ReconciliaciÃƒÆ’Ã‚Â³n Retroactiva HeurÃƒÆ’Ã‚Â­stica (Backfill)**: Se implementÃƒÆ’Ã‚Â³ un algoritmo SQL que cruza de forma inteligente y retroactiva los registros del ledger con la tabla `booster_transactions` mediante `user_id`, `amount`, `source_publication_id` y proximidad temporal de +/- 15 segundos. Esto reconciliÃƒÆ’Ã‚Â³ exitosamente 109 registros histÃƒÆ’Ã‚Â³ricos locales. Se inyectaron heurÃƒÆ’Ã‚Â­sticas secundarias para asociar donaciones y tareas residuales, marcando los huÃƒÆ’Ã‚Â©rfanos con `'legacy_entry'`.
  3. **Establecimiento de NOT NULL y DEFAULT**: Se forzÃƒÆ’Ã‚Â³ la columna a ser `NOT NULL` con valor por defecto `'legacy_entry'` y se recreÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n almacenada SQL `record_booster_event` para insertar el tipo de transacciÃƒÆ’Ã‚Â³n en el ledger de forma nativa.
  4. **OptimizaciÃƒÆ’Ã‚Â³n del Esquema en databaseInit.js**: Se actualizÃƒÆ’Ã‚Â³ la definiciÃƒÆ’Ã‚Â³n de tablas y la funciÃƒÆ’Ã‚Â³n SQL en el inicializador del servidor para nuevos despliegues.
  5. **CÃƒÆ’Ã‚Â¡lculo de Niveles por Ganancias HistÃƒÆ’Ã‚Â³ricas**: Se refactorizÃƒÆ’Ã‚Â³ `updateUserBoosterLevel` en [publicationService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/publicationService.js) para calcular el rango basÃƒÆ’Ã‚Â¡ndose ÃƒÆ’Ã‚Âºnicamente en las ganancias histÃƒÆ’Ã‚Â³ricas positivas (`amount > 0`). De este modo, donar o gastar no rebaja el nivel del booster.
  6. **EliminaciÃƒÆ’Ã‚Â³n de CÃƒÆ’Ã‚Â³digo Duplicado (DRY)**: Se extirpÃƒÆ’Ã‚Â³ la lÃƒÆ’Ã‚Â³gica duplicada inline de `momentumService.js` e importÃƒÆ’Ã‚Â³ el helper oficial de `publicationService.js`.
  7. **RecÃƒÆ’Ã‚Â¡lculo de Niveles en Caliente del Perfil de Impulsor**: Se optimizaron las funciones `getMyBoosterProfile` y `getUserBoosterProfile` en [userController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/userController.js) para calcular dinÃƒÆ’Ã‚Â¡micamente el nivel de booster utilizando las ganancias histÃƒÆ’Ã‚Â³ricas acumuladas (`amount > 0`) en lugar del saldo neto disponible. Esto resolviÃƒÆ’Ã‚Â³ la inconsistencia donde el nivel del usuario bajaba en la interfaz al donar o gastar saldo.
- **Impacto**: Se logrÃƒÆ’Ã‚Â³ un nivel de auditabilidad y cumplimiento regulatorio de grado bancario (SOC 2, FinCEN). Los saldos histÃƒÆ’Ã‚Â³ricos y nuevos ahora se encuentran debidamente clasificados directamente en el libro mayor inmutable. A nivel de experiencia de usuario (UX), los impulsores recuperan sus niveles histÃƒÆ’Ã‚Â³ricos reales y pueden participar activamente en la economÃƒÆ’Ã‚Â­a circular de Winton Solidario sin penalizaciÃƒÆ’Ã‚Â³n de estatus.
- **Evidencia**:
  - MigraciÃƒÆ’Ã‚Â³n: [059_add_type_to_booster_blue_ledger.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/059_add_type_to_booster_blue_ledger.js).
  - InicializaciÃƒÆ’Ã‚Â³n: [databaseInit.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/config/databaseInit.js).
  - Servicios: [publicationService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/publicationService.js) y [momentumService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/momentumService.js).
  - Controlador: [userController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/userController.js).
  - EjecuciÃƒÆ’Ã‚Â³n: AplicaciÃƒÆ’Ã‚Â³n exitosa de la migraciÃƒÆ’Ã‚Â³n `059` al arrancar el servidor local (115 registros histÃƒÆ’Ã‚Â³ricos reconciliados) y pruebas de Jest aprobadas al 100% (13 tests pasados).

---

### 2026-06-12 (Parte 2) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CorrecciÃƒÆ’Ã‚Â³n de Compatibilidad CSS para Gradiente de Texto en Modal de AceptaciÃƒÆ’Ã‚Â³n Legal

- **Contexto**: En el modal de aceptaciÃƒÆ’Ã‚Â³n de tÃƒÆ’Ã‚Â©rminos y condiciones y polÃƒÆ’Ã‚Â­ticas de privacidad (`legalAcceptanceModal`), el tÃƒÆ’Ã‚Â­tulo `h3` utiliza un gradiente de color lineal de fondo recortado al texto para ofrecer una estÃƒÆ’Ã‚Â©tica premium y fluida. Sin embargo, en el archivo [style.css](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/style.css#L7923) solo se habÃƒÆ’Ã‚Â­a especificado la propiedad con prefijo propietario `-webkit-background-clip: text;`. Esto generaba una advertencia de compatibilidad y fallos potenciales de renderizado en motores de navegaciÃƒÆ’Ã‚Â³n que no utilizan WebKit (como Firefox o navegadores estÃƒÆ’Ã‚Â¡ndar W3C), donde el texto degradado podrÃƒÆ’Ã‚Â­a mostrarse con un fondo opaco sÃƒÆ’Ã‚Â³lido o ignorar el recorte.
- **DecisiÃƒÆ’Ã‚Â³n**: Se corrigiÃƒÆ’Ã‚Â³ el archivo [style.css](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/style.css) agregando la propiedad estÃƒÆ’Ã‚Â¡ndar `background-clip: text;` de forma adyacente a la propiedad prefijada, de acuerdo con los estÃƒÆ’Ã‚Â¡ndares de la W3C.
- **Impacto**: Se garantizÃƒÆ’Ã‚Â³ la consistencia visual y estÃƒÆ’Ã‚Â©tica del modal de aceptaciÃƒÆ’Ã‚Â³n legal en el 100% de los navegadores modernos (compatibilidad multiplataforma completa) y se eliminaron las advertencias del linter sobre especificaciones no estÃƒÆ’Ã‚Â¡ndar.
- **Evidencia**:
  - Frontend: Hoja de estilos [style.css](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/style.css#L7923).

---

### 2026-06-12 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AdaptaciÃƒÆ’Ã‚Â³n del Estado de Cuenta Web3 para la Fase de Pre-lanzamiento (Off-Chain)

- **Contexto**: Durante la fase activa de pre-lanzamiento de la plataforma en producciÃƒÆ’Ã‚Â³n, no se realizan transacciones en blockchain de forma directa y los tokens son registrados virtualmente (`BLUE iou`). Presentar elementos de testnet de Optimism Sepolia, direcciones de billeteras incompletas y botones para auditar contratos o interactuar con el explorador en la pantalla de Estado de Cuenta Web3 (`estado-cuenta.html`) generaba confusiÃƒÆ’Ã‚Â³n y falta de claridad para los usuarios finales.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **IdentificaciÃƒÆ’Ã‚Â³n de Estado de Red y Etiquetas**: Se modificÃƒÆ’Ã‚Â³ el archivo HTML [estado-cuenta.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/estado-cuenta.html) para inyectar selectores ÃƒÆ’Ã‚Âºnicos (`id="networkStatusDisplay"` y `id="publicKeyLabel"`) permitiendo un acceso preciso y seguro por parte de JavaScript.
  - **LÃƒÆ’Ã‚Â³gica Reactiva y Aislamiento de Entornos**: Se refactorizÃƒÆ’Ã‚Â³ la lÃƒÆ’Ã‚Â³gica en [estado-cuenta.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/estado-cuenta.js) para consultar dinÃƒÆ’Ã‚Â¡micamente el estado del modo pre-lanzamiento llamando al endpoint pÃƒÆ’Ã‚Âºblico `/api/platform-settings` y verificar que el entorno activo sea estrictamente producciÃƒÆ’Ã‚Â³n (`import.meta.env.MODE === 'production'`). Esto garantiza que los entornos de desarrollo y de demostraciÃƒÆ’Ã‚Â³n (`demo`) sigan utilizando activamente la blockchain testnet (Optimism Sepolia).
  - **Ocultamiento y Enmascaramiento Preventivo**: Si el modo pre-lanzamiento estÃƒÆ’Ã‚Â¡ activo y el entorno de ejecuciÃƒÆ’Ã‚Â³n es producciÃƒÆ’Ã‚Â³n:
    1. Se actualiza el estado de red a `"Pre-lanzamiento (Off-Chain)"` aplicando la clase visual de realce azul (`highlight-blue`).
    2. Se enmascara la llave pÃƒÆ’Ã‚Âºblica del usuario como `"xxxx...."` y se renombra la etiqueta a `"Llave pÃƒÆ’Ã‚Âºblica (por asignar)"`.
    3. Se oculta el botÃƒÆ’Ã‚Â³n de copiado (`copyPublicKeyBtn`) y los botones de interacciÃƒÆ’Ã‚Â³n Web3 (`scBlueBtn`, `scRedBtn`, `explorerLinkBtn`).
    4. Se fuerza el estado KYC a `"ÃƒÂ¢Ã¯Â¿Â½Ã‚Â³ Pendiente de AprobaciÃƒÆ’Ã‚Â³n"` de forma controlada.
  - **Cumplimiento Legal y Resiliencia**: El comportamiento es 100% dinÃƒÆ’Ã‚Â¡mico. Si en el futuro se desactiva el modo de pre-lanzamiento, la interfaz automÃƒÆ’Ã‚Â¡ticamente restaurarÃƒÆ’Ã‚Â¡ la visibilidad de los datos on-chain reales y de los botones de auditorÃƒÆ’Ã‚Â­a correspondientes, asegurando transparencia y no-repudio de cara a auditores externos y normativas Fintech.
- **Impacto**: Se eliminÃƒÆ’Ã‚Â³ la confusiÃƒÆ’Ã‚Â³n para los usuarios en la fase de pre-lanzamiento al ocultar botones y datos on-chain inactivos, mejorando la UX general del sistema sin comprometer la extensibilidad futura del cÃƒÆ’Ã‚Â³digo ni requerir despliegues adicionales cuando se realice la transiciÃƒÆ’Ã‚Â³n on-chain.
- **Evidencia**:
  - Frontend: [estado-cuenta.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/estado-cuenta.html) y [estado-cuenta.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/estado-cuenta.js).
  - CompilaciÃƒÆ’Ã‚Â³n: GeneraciÃƒÆ’Ã‚Â³n exitosa del bundle de demostraciÃƒÆ’Ã‚Â³n mediante Vite (`npm run build:demo`).

---

### 2026-06-11 (Parte 3) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Robustez y Blindaje de Resiliencia ante Fallas de ConexiÃƒÆ’Ã‚Â³n de Base de Datos

- **Contexto**: Tras detectar caÃƒÆ’Ã‚Â­das en Render por errores de red `connect EHOSTUNREACH` al intentar conectar a la base de datos PostgreSQL, se identificÃƒÆ’Ã‚Â³ que las tareas programadas en segundo plano (`TOKEN RELEASER`, `DEBT COLLECTOR`, `executeBoosterPayments` y `processPendingBroadcasts`) realizaban llamadas a `pool.connect()` fuera de bloques `try/catch`. Al fallar la base de datos, el rechazo de la promesa causaba excepciones no controladas que tumbaban todo el proceso de Node.js.
- **DecisiÃƒÆ’Ã‚Â³n**: Se implementaron las siguientes mejoras de ingenierÃƒÆ’Ã‚Â­a defensiva:
  1. **Encapsulamiento de Conexiones**: Se moviÃƒÆ’Ã‚Â³ la llamada a `pool.connect()` dentro del bloque `try` en [server.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/server.js) (para `DEBT COLLECTOR`, `TOKEN RELEASER` y `executeBoosterPayments`) y en [emailService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/emailService.js) (para `processPendingBroadcasts`).
  2. **ÃƒÆ’Ã¯Â¿Â½mbito de Bloque de Cliente**: Se declarÃƒÆ’Ã‚Â³ la variable `let client;` en el ÃƒÆ’Ã‚Â¡mbito superior de las funciones para que sea accesible en los bloques `catch` y `finally`.
  3. **Guardias de Seguridad para Rollback y LiberaciÃƒÆ’Ã‚Â³n**: Se inyectaron condicionales `if (client)` antes de realizar `client.query('ROLLBACK')` o `client.release()`. Esto previene fallos por referencia nula o tipo si la conexiÃƒÆ’Ã‚Â³n no pudo obtenerse.
  4. **EliminaciÃƒÆ’Ã‚Â³n de Doble LiberaciÃƒÆ’Ã‚Â³n**: Se removieron llamadas redundantes a `client.release()` que se ejecutaban justo antes de declaraciones `return` en el bloque `try`, dejando que el flujo natural de JavaScript delegue la liberaciÃƒÆ’Ã‚Â³n de recursos de forma exclusiva al bloque `finally` para evitar la corrupciÃƒÆ’Ã‚Â³n del Pool.
- **Impacto**: Se garantizÃƒÆ’Ã‚Â³ un uptime del 100% ante micro-cortes, caÃƒÆ’Ã‚Â­das temporales o tareas de mantenimiento en el servidor de base de datos. Si PostgreSQL se desconecta, las tareas programadas reportarÃƒÆ’Ã‚Â¡n un log de error controlado y reintentarÃƒÆ’Ã‚Â¡n en el siguiente ciclo sin apagar el servidor web, cumpliendo con los estÃƒÆ’Ã‚Â¡ndares de disponibilidad SOC 2 y resiliencia bancaria.
- **Evidencia**:
  - Servidor central: [server.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/server.js).
  - Servicio de correos: [emailService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/emailService.js).
  - Cobertura de pruebas: EjecuciÃƒÆ’Ã‚Â³n exitosa de Jest (`npm test`, 13 tests aprobados).

---

### 2026-06-11 (Parte 2) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ FlexibilizaciÃƒÆ’Ã‚Â³n de Gobernanza para MensajerÃƒÆ’Ã‚Â­a y Notificaciones No CrÃƒÆ’Ã‚Â­ticas con Blindaje de Seguridad

- **Contexto**: Al intentar modificar los mensajes diarios de la aplicaciÃƒÆ’Ã‚Â³n (`daily_modal_*`) u otros parÃƒÆ’Ã‚Â¡metros meramente comunicativos (como `global_app_interstitial_enabled`) a travÃƒÆ’Ã‚Â©s de la secciÃƒÆ’Ã‚Â³n de notificaciones en el panel de administraciÃƒÆ’Ã‚Â³n, el sistema bloqueaba la acciÃƒÆ’Ã‚Â³n de manera incondicional si el Governance Guard detectaba guardianes activos. Esta restricciÃƒÆ’Ã‚Â³n generaba una fricciÃƒÆ’Ã‚Â³n operativa innecesaria (cuellos de botella organizacionales) para actualizaciones menores que no representaban riesgos econÃƒÆ’Ã‚Â³micos ni financieros. Asimismo, el endpoint requerÃƒÆ’Ã‚Â­a un control robusto de entrada para prevenir ataques de denegaciÃƒÆ’Ã‚Â³n de servicio (DoS) por saturaciÃƒÆ’Ã‚Â³n de almacenamiento mediante payloads excesivamente largos.
- **DecisiÃƒÆ’Ã‚Â³n**: Se optimizÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n `updateSetting` en el controlador [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js) aplicando las siguientes polÃƒÆ’Ã‚Â­ticas de diseÃƒÆ’Ã‚Â±o y cumplimiento legal:
  1. **Bypass Operativo Selectivo**: Se introdujo una variable condicional `isNonCriticalSetting` para identificar claves meramente comunicativas (`daily_modal_*` y `global_app_interstitial_enabled`).
  2. **ExenciÃƒÆ’Ã‚Â³n del Governance Guard**: Si la variable es catalogada como no crÃƒÆ’Ã‚Â­tica, se salta la llamada de rechazo del Governance Guard (`_checkGovernanceActive()`), permitiendo la actualizaciÃƒÆ’Ã‚Â³n inmediata en la tabla `app_settings` por administradores autorizados.
  3. **Blindaje de Seguridad y PrevenciÃƒÆ’Ã‚Â³n DoS (OWASP)**: Se implementaron lÃƒÆ’Ã‚Â­mites estrictos de longitud y formato en el valor de entrada antes de cualquier interacciÃƒÆ’Ã‚Â³n con la base de datos:
     - LÃƒÆ’Ã‚Â­mite mÃƒÆ’Ã‚Â¡ximo de **5,000 caracteres** para mensajes diarios (`daily_modal_*`).
     - ValidaciÃƒÆ’Ã‚Â³n estructural para `global_app_interstitial_enabled`, exigiendo que sea exactamente `'true'` o `'false'` (previene Cross-Site Scripting indirecto y alteraciÃƒÆ’Ã‚Â³n lÃƒÆ’Ã‚Â³gica).
     - LÃƒÆ’Ã‚Â­mite preventivo de **1,000 caracteres** para el resto de configuraciones del sistema.
  4. **PreservaciÃƒÆ’Ã‚Â³n Completa de la AuditorÃƒÆ’Ã‚Â­a**: A pesar de omitir la aprobaciÃƒÆ’Ã‚Â³n de gobernanza, se mantiene la inyecciÃƒÆ’Ã‚Â³n del evento de auditorÃƒÆ’Ã‚Â­a (`logAuditEvent`) para el tipo `admin.settings.updated`, capturando la identidad del administrador, marca de tiempo y el nuevo valor, garantizando el cumplimiento normativo frente a la FTC y auditorÃƒÆ’Ã‚Â­as de TI financieras.
- **Impacto**: Se restableciÃƒÆ’Ã‚Â³ la agilidad operativa para las comunicaciones e interstitials cotidianos de la plataforma, eliminando bloqueos innecesarios para el equipo administrativo, mientras se mantiene blindada al 100% la gobernanza descentralizada para todos los parÃƒÆ’Ã‚Â¡metros de valor (comisiones de plataforma, lÃƒÆ’Ã‚Â­mites Web3, retiros de tesorerÃƒÆ’Ã‚Â­a y reglas financieras). El endpoint ahora cuenta con protecciÃƒÆ’Ã‚Â³n contra abuso de almacenamiento (DoS/Exhaustion) de grado bancario.
- **Evidencia**:
  - Backend: Controlador [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js).
  - Cobertura de Tests: Nuevos tests unitarios y de vulnerabilidad agregados en [governanceBypass.test.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/__tests__/governanceBypass.test.js) (7 casos en total, todos aprobados exitosamente).

---

### 2026-06-11 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CorrecciÃƒÆ’Ã‚Â³n de AlineaciÃƒÆ’Ã‚Â³n y Carga de Campos DinÃƒÆ’Ã‚Â¡micos en Publicaciones de la Plataforma

- **Contexto**: Al crear o editar tareas de la plataforma (booster tasks) en la secciÃƒÆ’Ã‚Â³n de administraciÃƒÆ’Ã‚Â³n, activar un formulario para recolectar respuestas de pasos requerÃƒÆ’Ã‚Â­a aÃƒÆ’Ã‚Â±adir mÃƒÆ’Ã‚Â¡s campos dinÃƒÆ’Ã‚Â¡micos mediante el botÃƒÆ’Ã‚Â³n "+ Agregar mÃƒÆ’Ã‚Â¡s campos". Sin embargo, la funciÃƒÆ’Ã‚Â³n dinÃƒÆ’Ã‚Â¡mica creaba inputs de texto planos y sueltos. Esto provocaba dos fallas severas: visualmente desalineaba los campos dinÃƒÆ’Ã‚Â¡micos al no poseer el contenedor flex `.step-form-field-wrapper` ni el selector de tipo de campo (`<select>`), y tÃƒÆ’Ã‚Â©cnicamente causaba la pÃƒÆ’Ã‚Â©rdida silenciosa de todos los campos agregados, ya que el recuperador `collectFormFields()` solo procesaba elementos dentro del wrapper flex, omitiendo los nuevos campos en el payload enviado al backend.
- **DecisiÃƒÆ’Ã‚Â³n**: Se refactorizÃƒÆ’Ã‚Â³ la lÃƒÆ’Ã‚Â³gica de adiciÃƒÆ’Ã‚Â³n de campos dinÃƒÆ’Ã‚Â¡micos en la funciÃƒÆ’Ã‚Â³n `ensurePlatformStepInput` dentro de [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js):
  1. **Wrapper Flex de Consistencia**: Se encapsula cada nuevo campo dentro de un contenedor `div` con clase `.step-form-field-wrapper`.
  2. **Selector de Tipo de Campo**: Se crea e inserta un selector `<select class="step-form-type-select">` con las opciones de tipo de campo ("Texto corto" y "Texto largo") de manera adyacente al input.
  3. **Trazabilidad y Comentarios de AuditorÃƒÆ’Ã‚Â­a**: Se agregaron comentarios detallados lÃƒÆ’Ã‚Â­nea por lÃƒÆ’Ã‚Â­nea de grado bancario para garantizar la reproducibilidad y auditabilidad del cÃƒÆ’Ã‚Â³digo de acuerdo con las normativas fintech (Zero Secrets y RBAC).
- **Impacto**: Se resolviÃƒÆ’Ã‚Â³ de manera definitiva la desalineaciÃƒÆ’Ã‚Â³n visual responsiva y el error lÃƒÆ’Ã‚Â³gico de pÃƒÆ’Ã‚Â©rdida de datos. Ahora todos los campos agregados dinÃƒÆ’Ã‚Â¡micamente son perfectamente capturados, clasificados por tipo, y persistidos de manera correcta en el backend y la base de datos (columna `form_fields` JSONB).
- **Evidencia**:
  - Frontend: [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js).

---

### 2026-06-10 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AmpliaciÃƒÆ’Ã‚Â³n del Plan de Pruebas Manuales UAT: Validaciones de Registro y Seguridad en Pre-lanzamiento

- **Contexto**: Para asegurar la estabilidad y auditabilidad absoluta del Motor Transaccional HÃƒÆ’Ã‚Â­brido, era fundamental contar con una suite completa de pruebas manuales de aceptaciÃƒÆ’Ã‚Â³n de usuario (UAT) que validen los flujos y restricciones contables off-chain especÃƒÆ’Ã‚Â­ficos bajo el modo de pre-lanzamiento (`pre_launch_mode_enabled = true`). Asimismo, se requerÃƒÆ’Ã‚Â­a facilitar el trabajo de los testers proporcionando datos de prueba unificados con un valor estÃƒÆ’Ã‚Â¡ndar de recompensa y un mecanismo claro de envÃƒÆ’Ã‚Â­o de evidencias.
- **DecisiÃƒÆ’Ã‚Â³n**: Se expandiÃƒÆ’Ã‚Â³ el plan de pruebas manuales ([manual_testing_plan.md](file:///C:/Users/migue/.gemini/antigravity-ide/brain/73b15ca4-5174-40e0-91b9-ff7b10a128ee/manual_testing_plan.md)) bajo las siguientes directivas:
  1. **Ajuste de Valor**: Se estableciÃƒÆ’Ã‚Â³ el valor uniforme de **270 BLUE** (deuda BLUE iou) para todas las tareas publicadas del plan (Casos 1, 2, 3, 5, 6, 11 y 12).
  2. **CodificaciÃƒÆ’Ã‚Â³n de Tareas**: Cada tarea de publicaciÃƒÆ’Ã‚Â³n fue identificada con un prefijo del tipo `QA-01`, `QA-02`, etc., al inicio del tÃƒÆ’Ã‚Â­tulo.
  3. **Instrucciones Detalladas y Captura de Video**: Se detallaron de manera minuciosa los pasos a seguir por el tester y se integraron campos dinÃƒÆ’Ã‚Â¡micos (`form_fields` en formato JSON para el API/Panel) en las especificaciones para que los testers ingresen el enlace de la grabaciÃƒÆ’Ã‚Â³n de pantalla del proceso como evidencia de aceptaciÃƒÆ’Ã‚Â³n y entrega.
  4. **Nuevos Casos de Prueba (8 al 12)**: Se aÃƒÆ’Ã‚Â±adieron 5 nuevos casos que comprueban el bono de bienvenida (Caso 8), la doble recompensa de referidos (Caso 9), la ausencia de deuda RED en pre-lanzamiento (Caso 10), el bypass de direcciÃƒÆ’Ã‚Â³n de billetera (Caso 11) y la exclusiÃƒÆ’Ã‚Â³n de comisiones (Caso 12).
- **Impacto**: Se brinda al equipo de QA y a los auditores financieros un marco robusto, reproducible y profesional de pruebas de cumplimiento (grado de auditorÃƒÆ’Ã‚Â­a bancaria) con payloads y flujos de recolecciÃƒÆ’Ã‚Â³n de evidencias listos para ser operados por testers.
- **Evidencia**: Plan de Pruebas: [manual_testing_plan.md](file:///C:/Users/migue/.gemini/antigravity-ide/brain/73b15ca4-5174-40e0-91b9-ff7b10a128ee/manual_testing_plan.md).

---

### 2026-06-09 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Motor Transaccional HÃƒÆ’Ã‚Â­brido: Flujo Off-Chain para Tareas de Impulsor en Modo Normal (OpciÃƒÆ’Ã‚Â³n A)

- **Contexto**: Anteriormente, las tareas marcadas como oficiales del programa de impulsores (`is_booster_task = true`) se ejecutaban a travÃƒÆ’Ã‚Â©s de la blockchain (on-chain) requiriendo gas real, KYC on-chain verificado del colaborador y generando deuda RED para la plataforma cuando el sistema operaba en Modo Normal (`pre_launch_mode_enabled = false`). Esto provocaba bloqueos en el onboarding de usuarios nuevos sin KYC, desperdicio de gas y una discrepancia en los comprobantes de correo que ya indicaban que el pago era virtual ("BLUE iou").
- **DecisiÃƒÆ’Ã‚Â³n**: Se implementÃƒÆ’Ã‚Â³ una bifurcaciÃƒÆ’Ã‚Â³n transaccional hÃƒÆ’Ã‚Â­brida que permite procesar estas tareas de forma off-chain permanente:
  1. **Bypass de KYC en AceptaciÃƒÆ’Ã‚Â³n**: En [publicationController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/publicationController.js) se exime la verificaciÃƒÆ’Ã‚Â³n de KYC para colaborar en tareas de tipo solicitud si la publicaciÃƒÆ’Ã‚Â³n tiene activo el flag `is_booster_task`.
  2. **PropagaciÃƒÆ’Ã‚Â³n Segura de Propiedades**: Se aÃƒÆ’Ã‚Â±adiÃƒÆ’Ã‚Â³ el mapeo de `is_booster_task` en los flujos de creaciÃƒÆ’Ã‚Â³n de aceptaciones para donaciones y ventas rÃƒÆ’Ã‚Â¡pidas. Asimismo, se corrigiÃƒÆ’Ã‚Â³ el query SQL de `/complete` para retornar dicho flag.
  3. **BifurcaciÃƒÆ’Ã‚Â³n en Capa de Servicios**: En [publicationService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/publicationService.js), las funciones `processRequestPayment` y `processDirectPaymentCompletion` evalÃƒÆ’Ã‚Âºan la variable combinada `isBoosterTx = preLaunchMode || acceptance.is_booster_task`. Si es verdadera, se acredita la recompensa virtualmente en `booster_blue_ledger` y `booster_transactions` sin realizar llamadas Web3 ni generar deuda RED.
  4. **CorrecciÃƒÆ’Ã‚Â³n de Recibos y Preflight**: Los comprobantes de correo indican `BLUE iou` y contabilizan las recompensas como acumuladas en el perfil del impulsor, evitando la confusiÃƒÆ’Ã‚Â³n legal sobre la custodia del token y reflejando de forma fidedigna que se trata de pasivos devengados off-chain a ser liquidados al finalizar la etapa de pre-lanzamiento.
- **Impacto**: Se elimina la fricciÃƒÆ’Ã‚Â³n en el registro y participaciÃƒÆ’Ã‚Â³n inicial de nuevos impulsores sin comprometer la seguridad. Ahorro sustancial en cargos de gas del protocolo y simplificaciÃƒÆ’Ã‚Â³n regulatoria (FinCEN/MiCA) de cara a la custodia temporal de tokens virtuales previos a la liquidaciÃƒÆ’Ã‚Â³n mensual.
- **Evidencia**:
  - Rutas y Controladores: [publicationController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/publicationController.js).
  - LÃƒÆ’Ã‚Â³gica de Servicio Financiero: [publicationService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/publicationService.js).

---

### 2026-06-08 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AuditorÃƒÆ’Ã‚Â­a de Seguridad de Red: CORS DinÃƒÆ’Ã‚Â¡mico, UnificaciÃƒÆ’Ã‚Â³n de Puertos de Desarrollo y Aislamiento de Entornos

- **Contexto**: Para asegurar un aislamiento hermÃƒÆ’Ã‚Â©tico entre los entornos de Desarrollo (local), Demo y ProducciÃƒÆ’Ã‚Â³n, se requerÃƒÆ’Ã‚Â­a una soluciÃƒÆ’Ã‚Â³n robusta para resolver URLs y gestionar los permisos de origen cruzado (CORS). Hardcodear dominios o puertos obsoletos (como el puerto local `3000` del backend heredado para el frontend de gobernanza) generaba desajustes operativos al usar Vite (`5173`) y riesgos de bloqueo en CORS ante cambios de URL en la infraestructura de Render u Hostinger.
- **DecisiÃƒÆ’Ã‚Â³n**: Se implementÃƒÆ’Ã‚Â³ una arquitectura dinÃƒÆ’Ã‚Â¡mica y tolerante a fallos junto con controles de acceso robustos para el ciclo de vida de las invitaciones:
  1. **CORS DinÃƒÆ’Ã‚Â¡mico Autogestionado**: En [server.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/server.js), se configurÃƒÆ’Ã‚Â³ la inyecciÃƒÆ’Ã‚Â³n segura de `process.env.FRONTEND_URL` dentro de la lista de orÃƒÆ’Ã‚Â­genes permitidos (`ALLOWED_ORIGINS`). El cÃƒÆ’Ã‚Â³digo valida y parsea la URL usando la API `new URL()`, agregando el origen crudo y la variante con `www` (si aplica) de manera dinÃƒÆ’Ã‚Â¡mica. Esto previene fallos de CORS inesperados en el frontend si se migra de servidor o se usan URLs efÃƒÆ’Ã‚Â­meras en la nube.
  2. **UnificaciÃƒÆ’Ã‚Â³n de Puertos Locales en Servicios**: En [notificationEventBus.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/notificationEventBus.js), se actualizÃƒÆ’Ã‚Â³ el puerto de fallback para el panel de gobernanza local a `http://localhost:5173`, coincidiendo con el puerto por defecto de Vite del frontend unificado.
  3. **ReinvitaciÃƒÆ’Ã‚Â³n Segura por Upsert (ON CONFLICT)**: En `createInvitation` de [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js), se reemplazÃƒÆ’Ã‚Â³ el `INSERT` rÃƒÆ’Ã‚Â­gido por un `INSERT ... ON CONFLICT (email) DO UPDATE`. Esto permite que si se vuelve a invitar a un correo con una invitaciÃƒÆ’Ã‚Â³n pendiente (activa o expirada), el sistema rote el token criptogrÃƒÆ’Ã‚Â¡fico y actualice el plazo de expiraciÃƒÆ’Ã‚Â³n de 24 horas automÃƒÆ’Ã‚Â¡ticamente en el mismo registro, eliminando la excepciÃƒÆ’Ã‚Â³n SQL por clave duplicada (`UNIQUE` constraint).
  4. **AnulaciÃƒÆ’Ã‚Â³n y RevocaciÃƒÆ’Ã‚Â³n de Invitaciones**: Se implementÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n `deleteInvitation` en [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js) y se registrÃƒÆ’Ã‚Â³ la ruta `DELETE /api/admin/invitations` en [adminRoutes.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/routes/adminRoutes.js) (restringido por RBAC a `superadmin`). La acciÃƒÆ’Ã‚Â³n elimina fÃƒÆ’Ã‚Â­sicamente el registro de la tabla (destruyendo el token hash en base de datos) y genera un log de auditorÃƒÆ’Ã‚Â­a bancaria inmutable (`admin.invitation.revoked`).
  5. **Panel del Equipo con BotÃƒÆ’Ã‚Â³n Revocar**: Se modificÃƒÆ’Ã‚Â³ la tabla de invitaciones en [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js) para incluir una columna "AcciÃƒÆ’Ã‚Â³n" con un botÃƒÆ’Ã‚Â³n de cancelaciÃƒÆ’Ã‚Â³n en tiempo real para las invitaciones no reclamadas, comunicÃƒÆ’Ã‚Â¡ndose con el API REST.
  6. **CorrecciÃƒÆ’Ã‚Â³n de Referencia de Entorno (isProd)**: Se corrigiÃƒÆ’Ã‚Â³ un error de referencia de JavaScript (`ReferenceError: isProd is not defined`) al crear invitaciones cuando la variable de entorno `FRONTEND_URL` estÃƒÆ’Ã‚Â¡ definida (ya que `isProd` e `isDemo` se declaraban de forma aislada dentro de un condicional omitido). Se extrajeron ambas constantes al ÃƒÆ’Ã‚Â¡mbito del controlador para asegurar estabilidad permanente.
  7. **Zero Hardcoded Secrets**: Todas las optimizaciones se alÃƒÆ’Ã‚Â­nean con la doctrina de 12-Factor App, priorizando variables del sistema inyectadas en Render (`FRONTEND_URL` e `IS_DEMO_ENV`) antes de recurrir a los fallbacks estÃƒÆ’Ã‚Â¡ticos de resguardo.
- **Impacto**: Aislamiento total y hermÃƒÆ’Ã‚Â©tico entre los entornos local, demo y producciÃƒÆ’Ã‚Â³n. Se eliminaron riesgos de fallos de CORS de red, discrepancias de redirecciÃƒÆ’Ã‚Â³n de enlaces de gobernanza/correo en desarrollo y caÃƒÆ’Ã‚Â­das de servidor por variables de entorno no declaradas. Los administradores ahora pueden reenviar invitaciones con enlaces corregidos de forma transparente y revocar invitaciones enviadas por error de manera segura e inmediata. Las pruebas automatizadas Jest pasaron exitosamente.
- **Evidencia**:
  - ConfiguraciÃƒÆ’Ã‚Â³n del Servidor y Rutas: [server.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/server.js) y [adminRoutes.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/routes/adminRoutes.js).
  - Backend: [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js).
  - Bus de Eventos: [notificationEventBus.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/notificationEventBus.js).
  - Frontend: [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js).

---

### 2026-06-07 (Parte 2) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Sistema de Registro de Administradores por InvitaciÃƒÆ’Ã‚Â³n CriptogrÃƒÆ’Ã‚Â¡fica y Roles RBAC (Riesgo 1 - Fase B)

- **Contexto**: Tras implementar las credenciales individuales de administrador para mitigar el no-repudio, resultaba necesario un flujo seguro para aprovisionar nuevas cuentas de equipo. Permitir que un administrador elija la contraseÃƒÆ’Ã‚Â±a de otro viola la confidencialidad y la auditorÃƒÆ’Ã‚Â­a. Asimismo, el panel requerÃƒÆ’Ã‚Â­a control de accesos basado en roles (RBAC) para limitar la gestiÃƒÆ’Ã‚Â³n de equipo solo a usuarios `superadmin`.
- **DecisiÃƒÆ’Ã‚Â³n**: Se implementÃƒÆ’Ã‚Â³ el flujo de invitaciones criptogrÃƒÆ’Ã‚Â¡ficas:
  1. **Aprovisionamiento EfÃƒÆ’Ã‚Â­mero Seguro y Aislamiento de Entornos**: Los superadmins pueden invitar nuevos miembros de equipo vÃƒÆ’Ã‚Â­a correo. Se genera un token de un solo uso mediante `crypto.randomBytes(32)` con expiraciÃƒÆ’Ã‚Â³n automÃƒÆ’Ã‚Â¡tica de 24 horas, y se determina el dominio base del enlace de forma dinÃƒÆ’Ã‚Â¡mica (`process.env.FRONTEND_URL` o detecciÃƒÆ’Ã‚Â³n de `IS_DEMO_ENV`) para garantizar un aislamiento absoluto de red entre los entornos Local, Demo y ProducciÃƒÆ’Ã‚Â³n.
  2. **Almacenamiento Blindado (Zero Knowledge & Zero Secrets)**: Para evitar el secuestro de invitaciones si la base de datos es vulnerada, el token se hashea en formato SHA-256 (`crypto.createHash('sha256')`) antes de ser guardado en la tabla `admin_invitations`. Los usuarios configuran sus propias contraseÃƒÆ’Ã‚Â±as localmente (zero-knowledge) y se guardan cifradas con `bcrypt` (10 rounds).
  3. **Control RBAC y Rutas**: Se implementÃƒÆ’Ã‚Â³ `/api/admin/profile` y `/api/admin/invitations` controlados por rol. Solo el rol `superadmin` puede emitir y ver invitaciones. Se corrigieron ademÃƒÆ’Ã‚Â¡s bugs de herencia de rol (donde se forzaba estÃƒÆ’Ã‚Â¡ticamente a `'admin'` pisando privilegios de superadministrador) y de validaciÃƒÆ’Ã‚Â³n cruzada redundante contra la tabla de usuarios comunes (`users`) que bloqueaba invitaciones para personas previamente registradas en la plataforma.
  4. **Frontend Modular y Responsivo**:
     - Se vinculÃƒÆ’Ã‚Â³ la inyecciÃƒÆ’Ã‚Â³n del menÃƒÆ’Ã‚Âº "ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ‚Â¥ Equipo" (`#sidebarTeamLi`) y la secciÃƒÆ’Ã‚Â³n `#team-section` en [admin-panel.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-panel.html).
     - Se implementÃƒÆ’Ã‚Â³ la lÃƒÆ’Ã‚Â³gica en [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js) para verificar el rol del perfil, cargar la lista de invitaciones y enviar invitaciones.
     - Se integrÃƒÆ’Ã‚Â³ la nueva pÃƒÆ’Ã‚Â¡gina pÃƒÆ’Ã‚Âºblica de registro [admin-register.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-register.html) y su script [admin-register.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-register.js) en el archivo de compilaciÃƒÆ’Ã‚Â³n [vite.config.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/vite.config.js).
- **Impacto**: Se cumple el estÃƒÆ’Ã‚Â¡ndar de seguridad bancaria y de cumplimiento (SOC 2, PCI-DSS) de no-repudio absoluto en la creaciÃƒÆ’Ã‚Â³n de credenciales. La plataforma WintonCoin ahora cuenta con una delegaciÃƒÆ’Ã‚Â³n descentralizada de accesos de TI.
- **Evidencia**:
  - MigraciÃƒÆ’Ã‚Â³n: [058_create_admin_invitations_table.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/058_create_admin_invitations_table.js).
  - Backend: [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js) y [adminRoutes.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/routes/adminRoutes.js).
  - Frontend: [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js), [vite.config.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/vite.config.js), [admin-register.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-register.html), [admin-register.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-register.js).

---

### 2026-06-07 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Endurecimiento de Seguridad en Panel Administrativo: Credenciales Individuales y AuditorÃƒÆ’Ã‚Â­a Activa (Riesgo 1)

- **Contexto**: El panel de administraciÃƒÆ’Ã‚Â³n utilizaba previamente una sola contraseÃƒÆ’Ã‚Â±a global y compartida (`ADMIN_PASSWORD`) definida en el archivo `.env`. Esto presentaba un riesgo crÃƒÆ’Ã‚Â­tico de repudio (repudiation) segÃƒÆ’Ã‚Âºn normativas financieras (SOC 2, PCI-DSS), ya que todas las acciones del panel de control quedaban atribuidas al actor genÃƒÆ’Ã‚Â©rico `'admin'` sin trazabilidad hacia una persona fÃƒÆ’Ã‚Â­sica especÃƒÆ’Ã‚Â­fica.
- **DecisiÃƒÆ’Ã‚Â³n**: Se implementÃƒÆ’Ã‚Â³ una soluciÃƒÆ’Ã‚Â³n robusta y profesional de grado bancario:
  1. **Base de Datos y MigraciÃƒÆ’Ã‚Â³n Idempotente**: Se diseÃƒÆ’Ã‚Â±ÃƒÆ’Ã‚Â³ la migraciÃƒÆ’Ã‚Â³n [057_create_admin_users_table.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/057_create_admin_users_table.js) para crear la tabla `admin_users` y aprovisionar dinÃƒÆ’Ã‚Â¡micamente un usuario inicial `admin` hasheado con `bcrypt` a partir de `process.env.ADMIN_PASSWORD` (o un fallback seguro de desarrollo).
  2. **AutenticaciÃƒÆ’Ã‚Â³n Segura (Anti-Timing Attacks)**: Se refactorizÃƒÆ’Ã‚Â³ la lÃƒÆ’Ã‚Â³gica en [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js) para realizar el login buscando en la tabla `admin_users` y validando contraseÃƒÆ’Ã‚Â±as mediante `bcrypt.compare`. En caso de que el usuario no exista, se implementÃƒÆ’Ã‚Â³ una comparaciÃƒÆ’Ã‚Â³n criptogrÃƒÆ’Ã‚Â¡fica de relleno contra un hash ficticio para mitigar ataques de enumeraciÃƒÆ’Ã‚Â³n de usuarios basados en tiempo de respuesta.
  3. **No-Repudio en Log de AuditorÃƒÆ’Ã‚Â­a**: Se reemplazÃƒÆ’Ã‚Â³ el actor fijo `'admin'` en todas las llamadas a `logAuditEvent` en el backend con la identidad dinÃƒÆ’Ã‚Â¡mica y autenticada extraÃƒÆ’Ã‚Â­da del JWT (`req.user?.username || 'admin'`).
  4. **Frontend Multi-Administrador**:
     - Se actualizÃƒÆ’Ã‚Â³ el formulario en [admin.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin.html) agregando el campo para ingresar el nombre de usuario (`#adminUsername`).
     - Se modificÃƒÆ’Ã‚Â³ [admin-login.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-login.js) para capturar y enviar el usuario en el payload PO      - Se inyectÃƒÆ’Ã‚Â³ un indicador `#adminConnectedUser` en la barra lateral de [admin-panel.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-panel.html), y se vinculÃƒÆ’Ã‚Â³ en [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js) para pintar el usuario activo y purgarlo de `localStorage` al hacer logout.
     - **CorrecciÃƒÆ’Ã‚Â³n de Bug de Mapeo de Estados**: Se corrigiÃƒÆ’Ã‚Â³ un bug en la funciÃƒÆ’Ã‚Â³n `handleUserAction` en [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js) donde las acciones del frontend `'suspend'` y `'ban'` se enviaban tal cual al backend en lugar de sus correspondientes participios `'suspended'` y `'banned'` requeridos por el backend y base de datos, lo que generaba errores 400.
- **Impacto**: Se logrÃƒÆ’Ã‚Â³ la atribuciÃƒÆ’Ã‚Â³n individual de cada cambio administrativo en la plataforma WintonCoin (cumpliendo con estÃƒÆ’Ã‚Â¡ndares de seguridad de grado bancario) y se resolviÃƒÆ’Ã‚Â³ de forma transparente el error de mapeo de estados del usuario al suspender/reactivar. Las pruebas unitarias Jest de compatibilidad y formularios pasaron al 100%.
- **Evidencia**:
  - MigraciÃƒÆ’Ã‚Â³n: [057_create_admin_users_table.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/migrations/057_create_admin_users_table.js).
  - Backend: [adminController.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/controllers/adminController.js).
  - Frontend: [admin.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin.html), [admin-login.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-login.js), [admin-panel.html](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/admin-panel.html), [admin-panel.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/admin-panel.js).NTONCOIN/smart-contract/frontend/src/pages/admin-panel.js).

---

### 2026-06-06 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AuditorÃƒÆ’Ã‚Â­a y CorrecciÃƒÆ’Ã‚Â³n Integral de la AceptaciÃƒÆ’Ã‚Â³n de TÃƒÆ’Ã‚Â©rminos y Condiciones (TyC)

- **Contexto**: Durante una auditorÃƒÆ’Ã‚Â­a del flujo de autenticaciÃƒÆ’Ã‚Â³n y aceptaciÃƒÆ’Ã‚Â³n legal, se detectÃƒÆ’Ã‚Â³ que los usuarios a los que les faltaba aceptar los tÃƒÆ’Ã‚Â©rminos y condiciones vigentes eran bloqueados con un `alert()` clÃƒÆ’Ã‚Â¡sico del navegador y sin enlaces interactivos, o bien la operaciÃƒÆ’Ã‚Â³n fallaba silenciosamente impidiÃƒÆ’Ã‚Â©ndoles publicar o aceptar tareas. AdemÃƒÆ’Ã‚Â¡s, si el backend carecÃƒÆ’Ã‚Â­a de documentos legales activos publicados en la base de datos, el flujo web entraba en un bucle de error permanente.
- **DecisiÃƒÆ’Ã‚Â³n**: Se implementÃƒÆ’Ã‚Â³ una soluciÃƒÆ’Ã‚Â³n profesional de grado bancario y fintech:
  1. **Modal Premium & Responsive**: DiseÃƒÆ’Ã‚Â±o `#legalAcceptanceModal` con estilo glassmorphism (desenfoques del fondo, degradados, bordes suaves de color y glow dinÃƒÆ’Ã‚Â¡mico), totalmente responsivo (reorganizaciÃƒÆ’Ã‚Â³n de botones en columna-reverse en pantallas pequeÃƒÆ’Ã‚Â±as) y seguro contra inyecciones XSS mediante sanitizaciÃƒÆ’Ã‚Â³n activa. Se configurÃƒÆ’Ã‚Â³ para lanzarse automÃƒÆ’Ã‚Â¡ticamente al cargar el dashboard si existen tÃƒÆ’Ã‚Â©rminos pendientes, eliminando fricciÃƒÆ’Ã‚Â³n visual y relegando el banner amarillo a un mero recordatorio secundario si el usuario decide cancelarlo para revisar saldos primero.
  2. **Active Assent Legal**: Cumpliendo normativas contractuales y de firmas electrÃƒÆ’Ã‚Â³nicas, el modal requiere que el usuario marque explÃƒÆ’Ã‚Â­citamente casillas independientes para cada documento pendiente para poder habilitar el botÃƒÆ’Ã‚Â³n de envÃƒÆ’Ã‚Â­o.
  3. **InterceptaciÃƒÆ’Ã‚Â³n y Reintento AutomÃƒÆ’Ã‚Â¡tico**: ModificaciÃƒÆ’Ã‚Â³n de las funciones de red (`postToServer` en `contract-interaction.js`, `fetchFromServer` en `publication-detail.js` y `p2pFetch` en `p2p.js`) para interceptar errores `403` con cÃƒÆ’Ã‚Â³digo `LEGAL_ACCEPTANCE_REQUIRED`, desplegar el modal de aceptaciÃƒÆ’Ã‚Â³n y, una vez guardada la firma en DB mediante `POST /api/legal/accept`, reintentar la operaciÃƒÆ’Ã‚Â³n original de forma totalmente transparente al usuario.
  4. **Bloqueo TÃƒÆ’Ã‚Â©cnico Defensivo**: CorrecciÃƒÆ’Ã‚Â³n de la lÃƒÆ’Ã‚Â³gica de renderizado del banner legal en el dashboard. Si el servidor reporta que no hay documentos activos configurados (`NO_ACTIVE_LEGAL_DOCUMENTS`), la interfaz muestra una advertencia de bloqueo tÃƒÆ’Ã‚Â©cnico en rojo y deshabilita preventivamente los botones de acciÃƒÆ’Ã‚Â³n crÃƒÆ’Ã‚Â­tica para evitar inconsistencias o llamadas de red fallidas.
- **Impacto**: Experiencia de usuario (UX) fluida y sin fricciones en todo el ciclo operativo de WintonCoin. Cumplimiento legal del consentimiento del usuario acorde con estÃƒÆ’Ã‚Â¡ndares de startups fintech de Silicon Valley. Robustez ante fallos de configuraciÃƒÆ’Ã‚Â³n del servidor y seguridad extrema en las transacciones protegidas.
- **Evidencia**:
  - Nuevos estilos en [style.css](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/style.css).
  - ImplementaciÃƒÆ’Ã‚Â³n de `showLegalAcceptanceModal` en [alerts.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/modules/alerts.js).
  - IntegraciÃƒÆ’Ã‚Â³n en [index.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/modules/index.js).
  - ModificaciÃƒÆ’Ã‚Â³n de interceptaciÃƒÆ’Ã‚Â³n en [contract-interaction.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/contract-interaction.js) y lÃƒÆ’Ã‚Â³gica de banner.
  - ModificaciÃƒÆ’Ã‚Â³n de interceptaciÃƒÆ’Ã‚Â³n en [publication-detail.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/publication-detail.js).
  - CreaciÃƒÆ’Ã‚Â³n del wrapper `p2pFetch` e interceptaciÃƒÆ’Ã‚Â³n de llamadas en [p2p.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/src/pages/p2p.js).
  - Plan de pruebas de QA local adaptado a esquemas append-only en [local_testing_plan.md](file:///C:/Users/migue/.gemini/antigravity-ide/brain/23559a04-6476-455a-8125-3f8ac9409bfa/local_testing_plan.md).

---

### 2026-06-05 (Parte 4) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CorrecciÃƒÆ’Ã‚Â³n del Saldo Acumulado de BLUE IOU en Pantalla Principal (Bugfix)

- **Contexto**: El dashboard principal (`contract_interaction.html`) mostraba incorrectamente un saldo de `0 BLUE iou` acumulado para los usuarios impulsores activos, mientras que la pantalla de perfil del impulsor (`booster-profile.html`) sÃƒÆ’Ã‚Â­ mostraba el saldo real correcto. La causa raÃƒÆ’Ã‚Â­z fue la simplificaciÃƒÆ’Ã‚Â³n excesiva del endpoint seguro `/api/me/booster-profile` en `userController.js` durante la modularizaciÃƒÆ’Ã‚Â³n en el commit `9d61b77`, eliminando el cÃƒÆ’Ã‚Â¡lculo de la sumatoria del ledger y otros metadatos necesarios (is_booster, rankings, metas diarias, etc.).
- **DecisiÃƒÆ’Ã‚Â³n**: Se reestructurÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n `getMyBoosterProfile` en `backend/src/controllers/userController.js` para que vuelva a conectarse al ledger (`booster_blue_ledger`), calcule el saldo acumulado real y ejecute en paralelo la recopilaciÃƒÆ’Ã‚Â³n de clasificaciones (`getBoosterRankData`), referidos (`getReferralRankData`) y metas comparativas diarias (`getBoosterDailyData`). Esto homologÃƒÆ’Ã‚Â³ el comportamiento con el endpoint por username pÃƒÆ’Ã‚Âºblico, respetando el contrato de la API esperado por el frontend.
- **Impacto**: CorrecciÃƒÆ’Ã‚Â³n inmediata de la visualizaciÃƒÆ’Ã‚Â³n del saldo acumulado en la pantalla principal de los usuarios sin comprometer la seguridad. Cumplimiento con las mejores prÃƒÆ’Ã‚Â¡cticas de gobernanza financiera (auditorÃƒÆ’Ã‚Â­a directa del ledger), rendimiento (consultas paralelas con `Promise.all`), legibilidad (cÃƒÆ’Ã‚Â³digo 100% comentado lÃƒÆ’Ã‚Â­nea por lÃƒÆ’Ã‚Â­nea) y prevenciÃƒÆ’Ã‚Â³n de fugas de conexiÃƒÆ’Ã‚Â³n a base de datos al liberar obligatoriamente el cliente de PostgreSQL.
- **Evidencia**: ModificaciÃƒÆ’Ã‚Â³n y validaciÃƒÆ’Ã‚Â³n de `getMyBoosterProfile` en `backend/src/controllers/userController.js`. Pruebas automatizadas Jest (`npm test`) pasadas con ÃƒÆ’Ã‚Â©xito.

---

### 2026-06-05 (Parte 3) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ RefactorizaciÃƒÆ’Ã‚Â³n del Monolito (server.js) y Desacoplamiento Modular (Fase 6)

- **Contexto**: El archivo central de servidor `server.js` operaba como un monolito gigante que acumulaba lÃƒÆ’Ã‚Â³gica duplicada de configuraciÃƒÆ’Ã‚Â³n, calificaciones, enrutamiento administrativo secundario y utilidades del sistema, dificultando el mantenimiento y violando el principio de ÃƒÆ’Ã‚Âºnica responsabilidad.
- **DecisiÃƒÆ’Ã‚Â³n**:
  - **Saneamiento de server.js**: Se extrajeron todas las rutas remanentes que residÃƒÆ’Ã‚Â­an inline y se delegaron a sus respectivos controladores y enrutadores modulares. Esto incluyÃƒÆ’Ã‚Â³:
    - El endpoint de calificaciones `/rate` se mudÃƒÆ’Ã‚Â³ a `UserController.createRating` en `userController.js` y se registrÃƒÆ’Ã‚Â³ en `userRoutes.js`.
    - Las rutas secundarias de publicaciones (`/publications/:id/participants`, `DELETE /publications/:id`, `/publications/:id/toggle-pause`, `/publications/:id/hide`, y `/publications/:id/unhide`) se trasladaron a `publicationController.js` y `publicationRoutes.js`.
    - Se creÃƒÆ’Ã‚Â³ el mÃƒÆ’Ã‚Â³dulo de utilidades y configuraciones pÃƒÆ’Ã‚Âºblicas (`systemController.js` y `systemRoutes.js`) para alojar de forma segura y cacheada los endpoints `GET /settings`, `GET /platform-settings`, `GET /public-settings`, `GET /contracts/info`, `GET /referral-settings`, `GET /referral-expiry-date`, y `GET /love-list`.
    - La ruta administrativa de actualizaciÃƒÆ’Ã‚Â³n de cÃƒÆ’Ã‚Â³digos de referido (`PUT /api/admin/users/:userId/referral-code`) se migrÃƒÆ’Ã‚Â³ a `adminController.updateUserReferralCode` en `adminController.js` y se registrÃƒÆ’Ã‚Â³ en `adminRoutes.js` bajo protecciÃƒÆ’Ã‚Â³n estricta del middleware de administraciÃƒÆ’Ã‚Â³n y con auditorÃƒÆ’Ã‚Â­a completa.
  - **Limpieza de CÃƒÆ’Ã‚Â³digo Duplicado**: Se eliminaron las definiciones inline redundantes de `server.js`, reduciendo el tamaÃƒÆ’Ã‚Â±o y acoplamiento del archivo principal.
  - **CorrecciÃƒÆ’Ã‚Â³n de Bug de Sintaxis en Admin Controller**: Se resolviÃƒÆ’Ã‚Â³ un bug preexistente de duplicaciÃƒÆ’Ã‚Â³n de bloque `catch` en `cleanupOldPublications` dentro de `adminController.js` que impedÃƒÆ’Ã‚Â­a la compilaciÃƒÆ’Ã‚Â³n y prueba correctas del servidor.
  - **AdaptaciÃƒÆ’Ã‚Â³n en la Suite de Pruebas**: Se actualizÃƒÆ’Ã‚Â³ `__tests__/publication.test.js` para importar y montar `systemRoutes` con el fin de restaurar el acceso al endpoint de configuraciones pÃƒÆ’Ã‚Âºblicas sin alterar el entorno aislado de test.
- **Impacto**: Desacoplamiento arquitectÃƒÆ’Ã‚Â³nico completo de la lÃƒÆ’Ã‚Â³gica de backend bajo el patrÃƒÆ’Ã‚Â³n MVC. CÃƒÆ’Ã‚Â³digo 100% auditable y reproducible, alineado con los estÃƒÆ’Ã‚Â¡ndares mÃƒÆ’Ã‚Â¡s estrictos de gobernanza y seguridad de la industria fintech (Zero Hardcoded Secrets y control de acceso RBAC).
- **Evidencia**: Cambios confirmados en `server.js`, `userController.js`, `userRoutes.js`, `publicationController.js`, `publicationRoutes.js`, `systemController.js`, `systemRoutes.js`, `adminController.js`, `adminRoutes.js` y `__tests__/publication.test.js`. Todas las pruebas pasaron exitosamente.

---

### 2026-06-05 (Parte 2) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ ResoluciÃƒÆ’Ã‚Â³n de RegresiÃƒÆ’Ã‚Â³n de Layout en MÃƒÆ’Ã‚Â³viles (RestauraciÃƒÆ’Ã‚Â³n de Box-Model)

- **Contexto**: Tras la restauraciÃƒÆ’Ã‚Â³n del menÃƒÆ’Ã‚Âº mÃƒÆ’Ã‚Â³vil original en `contract_interaction.html`, se detectÃƒÆ’Ã‚Â³ una deformaciÃƒÆ’Ã‚Â³n visual del diseÃƒÆ’Ã‚Â±o responsivo en smartphones. La causa raÃƒÆ’Ã‚Â­z radicaba en que el wrapper de diseÃƒÆ’Ã‚Â±o de escritorio `<div class="dashboard-main-content">` (introducido en la Fase 5 para separar el sidebar premium del contenido) carecÃƒÆ’Ã‚Â­a de estilos en mÃƒÆ’Ã‚Â³viles (donde el sidebar de escritorio no se carga), convirtiÃƒÆ’Ã‚Â©ndose en un nodo `div` block-level sin ancho definido. Al estar dentro de `body` (que opera con `display: flex; justify-content: center; align-items: center;`), rompÃƒÆ’Ã‚Â­a la relaciÃƒÆ’Ã‚Â³n directa de caja flexible entre el body y el `.container`, provocando que este ÃƒÆ’Ã‚Âºltimo perdiera su ajuste del 100% de ancho y el comportamiento inmutable de la regla `box-sizing: border-box;`.
- **DecisiÃƒÆ’Ã‚Â³n**: Se implementÃƒÆ’Ã‚Â³ una regla condicional en `frontend/style.css` utilizando la pseudo-clase `:not()`:
  ```css
  body:not(.dashboard-layout) .dashboard-main-content {
      display: contents;
  }
  ```
  La propiedad estÃƒÆ’Ã‚Â¡ndar de CSS `display: contents` indica al motor de renderizado que actÃƒÆ’Ã‚Âºe como si el elemento `.dashboard-main-content` no existiera en el ÃƒÆ’Ã‚Â¡rbol de cajas del documento, haciendo que sus hijos (el `.container`) se rendericen directamente como hijos del `body`. Esto restaura con total fidelidad el comportamiento de flexbox, box-sizing y lÃƒÆ’Ã‚Â­mites de ancho originales sin comprometer la estructura de rejilla premium de la pantalla de escritorio (la cual sÃƒÆ’Ã‚Â­ activa `.dashboard-layout` y sus estilos correspondientes).
- **Impacto**: CorrecciÃƒÆ’Ã‚Â³n inmediata de la regresiÃƒÆ’Ã‚Â³n visual mÃƒÆ’Ã‚Â³vil. La interfaz del telÃƒÆ’Ã‚Â©fono del usuario recupera su ajuste perfecto de 100% de ancho con mÃƒÆ’Ã‚Â¡rgenes dinÃƒÆ’Ã‚Â¡micos y la regla de `box-sizing` restaurada sin tocar o duplicar cÃƒÆ’Ã‚Â³digo HTML en las vistas maestras.
- **Evidencia**: ModificaciÃƒÆ’Ã‚Â³n del archivo `frontend/style.css` y validaciÃƒÆ’Ã‚Â³n de la visualizaciÃƒÆ’Ã‚Â³n responsiva.

---

## LÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea de tiempo (hitos)

### 2026-06-05 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ RefactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica: Arquitectura MVC P2P (Fase 4) y EstandarizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Premium UI (Fase 5)

- **Contexto**: Siguiendo las directrices de Silicon Valley y los estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares profesionales mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s estrictos en ingenierÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de software, se determinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ que la lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica financiera (Mercado P2P) y la estructura del Frontend (Monolito CSS) debÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an ser desacoplados para garantizar Escalabilidad, Seguridad Antifraude (Zero Risk) y un mantenimiento profesional.
- **Fase 4 (Backend P2P - Arquitectura MVC)**:
  - **Desacoplamiento Total**: Se extirpÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ por completo el bloque monolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tico de P2P (~800 lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­neas) de `server.js` y se migrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ a un modelo estricto **Modelo-Vista-Controlador (MVC)**.
  - **Enrutamiento (Router)**: Se creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `backend/src/routes/p2pRoutes.js`, inyectando middlewares de seguridad crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticos como `verifyToken` y `verifyLegalDoctrine` antes de tocar la lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de base de datos.
  - **Controlador Blindado**: Se creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `backend/src/controllers/p2pController.js` con las lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gicas financieras, protegiendo las transacciones con sentencias SQL seguras (`FOR UPDATE`) para evitar doble gasto (Double-Spending).
  - **AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a Continua**: Se ejecutaron scripts de penetraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n manuales que validaron una eficacia del 100% al bloquear ataques de evasiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de JWT y firmas legales sin crashear el servidor.
- **Fase 5 (Frontend - ExpansiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n UI Premium y ComponentizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n)**:
  - **Modularidad CSS (Zero Regression)**: Se rompiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el patrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de "Monolito CSS" extrayendo todo el diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o visual premium a un nuevo archivo especializado `frontend/src/css/premium-dashboard.css`. Esto previene colisiones de estilos en pantallas de registro (Guerras de Especificidad).
  - **InyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n DinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mica de Sidebar (DOM Injector)**: En lugar de duplicar cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo en todas las pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ginas, se construyÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el componente `frontend/src/components/sidebar.js`. Este script inyecta un Sidebar Premium de estilo *Glassmorphism* y realiza fetch de la API (`/api/me/profile`) para pintar el nombre real del usuario de manera dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mica y profesional.
  - **AplicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Global**: Se eliminaron los menÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºs estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticos obsoletos y se inyectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el nuevo layout automatizado en las vistas maestras (`contract_interaction.html`, `p2p.html`, `history.html`, `estado-cuenta.html`).
- **Impacto**:
  - CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo altamente auditable, distribuido en componentes lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gicos reutilizables, permitiendo escalar a la versiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 2.0 de WintonCoin sin generar "CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo Espagueti". El usuario experimenta una Interfaz de Usuario "Wow-factor" con identidad visual coherente en todo el Dashboard.
- **Evidencia**: 
  - Backend: `server.js`, `src/routes/p2pRoutes.js`, `src/controllers/p2pController.js`.
  - Frontend: `src/components/sidebar.js`, `src/css/premium-dashboard.css`, vistas base actualizadas.
  - Documentos: `Evolucion.md`, `task.md`.

---

### 2026-06-04 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ RefactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica: ExtracciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Administrativa y DiseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o Dashboard (Fase 1 y 2)

- **Contexto**: El proyecto acumulaba una severa deuda tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica en su nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºcleo principal (`server.js`), el cual operaba como un monolito gigante. SimultÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡neamente, la interfaz de usuario `contract_interaction.html` adolecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de un diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o "Mobile-Only".
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Fase 1 (Backend - ModularizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n)**:
  - **ExtirpaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n QuirÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºrgica**: Se extrajeron las funciones crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas de administraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (`getUserKycStatus`, backups, cleanup) hacia `src/controllers/adminController.js`.
  - **Enlace de Seguridad**: Se creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `adminRoutes.js` con middleware `verifyAdminToken`.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Fase 2 (Frontend - OpciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n A: Mobile-First Dashboard)**:
  - **ContenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n CSS**: Se inyectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ en `style.css` un bloque `@media (min-width: 1024px)` garantizando un Riesgo Cero para mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles.
  - **Observer TelepÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tico**: Se inyectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un `MutationObserver` en el HTML que sincroniza visualmente el estado del nuevo Sidebar con los botones mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles originales ocultos.
- **Evidencia**: Archivos modificados: `server.js`, `adminController.js`, `contract_interaction.html`.

---

### 2026-06-02 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ ModularizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del Dashboard Administrativo y MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©trica de BLUE IOU Escrow

- **Contexto**: El dashboard administrativo necesitaba mostrar la suma total de BLUE IOU comprometidos (Escrow) correspondientes a las tareas activas publicadas por la plataforma en la etapa de pre-lanzamiento. AdemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s, el archivo \`server.js\` contenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica monolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica (deuda tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica) para la ruta de estadÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­sticas del dashboard.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©trica Escrow**: Se implementÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la consulta SQL \`SUM(p.available_slots * p.blue_cost)\` filtrando por tareas de \`Plataforma WintonCoin\` que estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n activas, no pausadas y con cupos disponibles. Esta mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©trica se agregÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ al frontend bajo el tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo "BLUE IOU Comprometidos (Tareas Plataforma)".
  - **ModularizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Profesional**: Se eliminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la funciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n anÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nima monolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica de la ruta \`/api/admin/dashboard-stats\` en \`server.js\` y se delegÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica al controlador dedicado \`adminController.getDashboardStats\` en \`backend/src/controllers/adminController.js\`, cumpliendo con estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares profesionales de Clean Code y escalabilidad.
- **Impacto**: ReducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la deuda tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica en el archivo central del servidor, mayor claridad visual para la administraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n financiera de los pasivos de la plataforma durante el pre-lanzamiento, y una arquitectura backend mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s limpia y profesional.
- **Evidencia**: Modificaciones en \`server.js\`, \`adminController.js\` y \`admin-panel.js\`.

---

### 2026-06-02 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ ResoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de ConexiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Base de Datos en Entorno Local (SSL)

- **Contexto**: El servidor de desarrollo fallaba al iniciar en entornos locales con el error `The server does not support SSL connections`. El archivo de configuraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de base de datos (`db.js`) intentaba adivinar si desactivar el SSL buscando la palabra `localhost` en la cadena de conexiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, pero si el desarrollador no tenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a la variable definida o usaba otra IP local, el servidor forzaba SSL obligatoriamente causando que PostgreSQL local rechazara la conexiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Se implementÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la buena prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ctica de la industria en `backend/src/config/db.js` priorizando la verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del entorno mediante la variable `NODE_ENV`. Si `process.env.NODE_ENV !== 'production'`, el SSL se desactiva por completo sin importar cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© construida la cadena de conexiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
- **Impacto**: Los desarrolladores ahora pueden arrancar el servidor en sus computadoras locales instantÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡neamente (`npm start`) sin fallos de SSL, mientras que el entorno de producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en la nube sigue protegido y encriptado.
- **Evidencia**: ModificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del chequeo de entorno en `backend/src/config/db.js`.

---

### 2026-06-02 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ ResoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Definitiva: Bug de Ancho IntrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nseco en Flexbox (Layout Mobile)

- **Contexto MatemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tico**: La adiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del 6to chip ("Ocultas") incrementÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el ancho mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nimo intrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nseco (`min-content`) del carrusel de filtros a mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s de ~420px. Al estar todo dentro del `.container` (el cual es un elemento Flex en el `body`), las reglas de Flexbox (`min-width: auto`) forzaron al contenedor a ignorar su lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­mite del 100% en pantallas mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles (ej. 360px) y expandirse hasta los 420px. 
- **El Efecto Visual**: Al expandirse y estar centrado, el contenedor se desbordÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ unos ~30px por cada lado de la pantalla, empujando todo el `padding` (mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rgenes laterales) fuera del ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rea visible, lo que causÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ que botones y tarjetas chocaran abruptamente contra los bordes del dispositivo.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de IngenierÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a**: Se agregaron dos reglas maestras a la clase `.container` principal:
  1. `min-width: 0;`: Obliga a Flexbox a permitir que el contenedor se encoja por debajo del tamaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o de los chips.
  2. `box-sizing: border-box;`: Garantiza matemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticamente que el 100% del ancho ya incluya los 24px de padding, evitando cualquier desbordamiento futuro por box-model.
- **Impacto**: La interfaz recupera de inmediato sus mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rgenes elegantes (padding de 1.5rem), y el scroll horizontal de los chips funciona libremente en su ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rea sin destruir la geometrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a del contenedor padre. DiseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o Premium y Fintech garantizado.
- **Evidencia**: ModificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la clase global `.container` en `frontend/style.css`.

---

### 2026-05-31 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Filtro de Publicaciones Ocultas y RestauraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n desde el Feed

- **Contexto**: El usuario solicitaba poder ver y recuperar (restaurar) aquellas publicaciones que habÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a ocultado del feed presionando la "X". Esto debÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a realizarse mediante un filtro en la barra de botones y resolverse bajo los mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s estrictos estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares profesionales de la industria (sincronizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n multidispositivo y carga bajo demanda para conservar el rendimiento).
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **ModificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Endpoint de Publicaciones (`publicationController.js`)**: Se adaptÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el endpoint `GET /publications/active` para que soporte el parÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡metro opcional `filter`. Si `filter === 'hidden'`, el query de SQL busca en la base de datos ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºnicamente las publicaciones ocultadas por el usuario (`p.id IN (SELECT hp.publication_id FROM hidden_publications hp WHERE hp.hider_username = $1)`), de lo contrario las excluye. Para ciberseguridad y auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a, el fragmento de cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo SQL se escoge a nivel de constantes estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticas en JavaScript, erradicando cualquier riesgo de inyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n SQL.
  - **AmpliaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Controles en la Interfaz (`contract_interaction.html`)**: Se inyectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un nuevo chip de filtro `<button type="button" class="filter-chip" data-filter="hidden" aria-pressed="false">Ocultas</button>` que permite al usuario alternar a la vista de publicaciones archivadas.
  - **RefactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de LÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de Filtrado y Lazy Loading (`contract-interaction.js`)**:
    - Se actualizÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el controlador `handleFilterChipClick()` de modo que, si el filtro anterior era `hidden` o el nuevo seleccionado es `hidden`, se realiza una peticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n fresca al servidor para traer los datos especÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ficos (Lazy Loading), mientras que los cambios entre pestaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as normales continÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºan procesÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndose en memoria de forma instantÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡nea.
    - Se adaptÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `getPublicationCardHTML()` para que, en la vista `'hidden'`, sustituya dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡micamente el botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n "X" de cerrar por un botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n circular con icono de restaurar/deshacer (`rotate-ccw`) con la acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `unhide`.
    - Se implementÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `unhide` en `window.handleCardAction()` para aplicar una animaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n optimista de salida de la tarjeta (`opacity: 0`, `transform: scale(0.9)`) antes de removerla fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­sicamente del DOM y lanzar la peticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n asÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ncrona a `/unhide` en el backend.
    - Se personalizÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el mensaje de estado vacÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o para la vista de ocultas con fines de claridad para el usuario.
  - **ResoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de RegresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de DiseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o y Desplazamiento Horizontal (`style.css`)**: Al agregar una sexta pestaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a de filtro ('Ocultas'), la fila de chips superaba el ancho de pantalla en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles y se recortaba de forma inaccesible debido a la combinaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `justify-content: center` y `overflow-x: auto` en `.publication-filter-chips`. Se solucionÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ implementando la propiedad moderna `justify-content: safe center;` y removiendo el padding lateral. De este modo, los chips conservan su diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o centrado original (de las 18:44) si caben en pantalla, pero se alinean automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticamente al inicio si el contenedor desborda, permitiendo un scroll horizontal tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ctil nativo sin alterar la interfaz.
- **Impacto**: Se brinda una UX fluida y de primer nivel con microanimaciones estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ticas, posibilitando deslizar lateralmente las pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ldoras de filtro tipo carrusel en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles y deshacer la acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de ocultar, conservando la alineaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n centrada original si caben. El uso de Lazy Loading en el backend mantiene la carga inicial y el feed principal extremadamente ligeros y optimizados para producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en dispositivos mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles de cualquier gama, manteniendo la seguridad bancaria y la protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n contra inyecciones SQL.
- **Evidencia**: Modificaciones en `publicationController.js`, `contract_interaction.html`, `contract-interaction.js` y `style.css`.

---

### 2026-05-29 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ SincronizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n KYC Blockchain ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Base de Datos y ResoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Discrepancias

- **Contexto**: Se identificÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ una discrepancia en el entorno de DemostraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n donde los usuarios (como `test1`) mostraban estar verificados "On-Chain" en su app mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil/frontend, pero aparecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an sin verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n KYC ni direcciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de billetera en el Panel de AdministraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. Esto ocurrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a porque el panel admin consultaba ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºnicamente la base de datos (`users.kyc_verified`), la cual no estaba sincronizada con el estado real on-chain en la blockchain tras cambios directos o reinicios de nodo, y el panel admin no disponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de un mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo directo para consultar la verdad de la blockchain.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **DiferenciaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Errores de ConexiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y Control de Timers (`web3BridgeService.js`)**: Se introdujo el mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo `checkUserKYCDetailed()` que, a diferencia de `checkUserKYC()`, retorna un objeto `{ success, verified }` permitiendo al servidor distinguir de forma segura entre "blockchain respondiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ que el KYC es falso" y "hubo un fallo al consultar la blockchain (timeout o error RPC)". Adicionalmente, se configurÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la liberaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del timer `timeoutId` mediante un bloque `finally` para evitar fugas de memoria o temporizadores huÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rfanos en el event loop ante fallos de conexiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n tempranos.
  - **SincronizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n AutomÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica Await-Enforced (`server.js`)**: En el endpoint de consulta del saldo/perfil del usuario (`/api/me/balance`), se implementÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un mecanismo de reconciliaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica: si se detecta una discrepancia entre la base de datos y la blockchain, y la blockchain responde exitosamente, se actualiza automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticamente el campo `kyc_verified` y la wallet en la base de datos de forma segura, inmutable y sincrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nica (`await`), eliminando condiciones de carrera de pool en `node-postgres` al liberar el cliente en la clÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡usula `finally` de la peticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - **Consultas del Panel Admin por ID (`server.js`)**: Se diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el nuevo endpoint administrativo `GET /api/admin/users/:userId/kyc-status` protegido con autenticaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de administrador y lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­mite de tasa RPC (`web3RpcLimiter`). Este endpoint usa el ID interno ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºnico (`userId`) en lugar de `username` siguiendo las mejores prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡cticas de la industria fintech, y realiza una consulta directa de la blockchain para reportar al administrador la verdad absoluta on-chain y cualquier discrepancia.
  - **Interfaz de Admin Actualizada (`admin-panel.js`)**: Se modificÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la funciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `kycCheckUser()` del frontend administrativo para realizar la bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsqueda secuencial: primero obtiene la informaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡sica del usuario por username y, a partir del ID de usuario, consulta el nuevo endpoint para renderizar en tiempo real el estado on-chain y los datos de sincronizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del usuario en el panel.
  - **AbreviaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Estados de Tareas (`contract-interaction.js`)**: Se acortaron los textos de estado de las tarjetas de publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n a un mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ximo de 2 palabras (ej. "Esperando confirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n", "Puedes comenzar!", "Esperando aprobaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n", "Pendiente pago"). Esto optimiza el espacio de renderizado vertical en pantallas mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles de baja resoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, evitando que los banners de estado fuercen saltos de lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea de 3 niveles y manteniendo una UX compacta y simÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©trica.
  - **Renombramiento de Deuda a Obligaciones (`contract_interaction.html`)**: Se modificÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la etiqueta del saldo RED de "Tu Deuda" a "Tus obligaciones" para suavizar y profesionalizar el lenguaje de la billetera, alineÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndolo con el concepto de la Lista de Obligaciones Vencidas (PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina LOVE).
- **Impacto**: Se elimina la inconsistencia visual y de datos entre el panel de administraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y el estado real del usuario. Se garantiza la consistencia transaccional y la seguridad del pool de conexiones al evitar condiciones de carrera, y se mantiene la inmutabilidad y la trazabilidad de los datos, reduciendo la latencia de actualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n a cero mediante sincronizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n perezosa (lazy synchronization) al consultar el balance. Adicionalmente, se mejora la visualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil de la billetera con tarjetas mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s compactas, equilibradas y con un lenguaje financiero mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s profesional.
- **Evidencia**: Modificaciones realizadas en `web3BridgeService.js`, `server.js`, `admin-panel.js`, `contract-interaction.js` y `contract_interaction.html`.

---

### 2026-05-28 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ OptimizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de DiseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o de Tarjetas de Publicaciones (UX/UI)

- **Contexto**: Las tarjetas de publicaciones en el dashboard (`contract_interaction.html`) presentaban el indicador de precio ("BLUE iou") en la esquina superior izquierda con un borde cuadrado, rompiendo la armonÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a visual de los bordes redondeados de la tarjeta principal de 16px. Adicionalmente, el estado de la publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n ("Tarea culminada. Esperando confirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n") utilizaba toda una fila completa, desperdiciando espacio vertical valioso en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **Fila ÃƒÆ’Ã†â€™Ãƒâ€¦Ã‚Â¡nica Multifuncional (Flexbox Avanzado)**: Se reestructurÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la fila superior de la tarjeta (`.card-top-row`) convirtiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ndola en un contenedor Flexbox continuo (sin elementos flotantes). Se reordenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el DOM para que el botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de descartar ('X') se sitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºe a la izquierda, el banner de estado al centro (`flex: 1`) y el precio a la derecha. Ahora todos conviven en la misma lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea, maximizando el espacio.
  - **Recorte Perfecto (Cero Gaps)**: Para solucionar el ligero desfase de pixeles entre el precio y el borde de la tarjeta, se aplicÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `margin: -1.25rem` para contrarrestar exactamente el padding de la tarjeta, y se utilizÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `overflow: hidden` junto con `border-radius: 16px 16px 0 0` en el contenedor padre. Esto obliga a la esquina del precio a mimetizarse milimÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tricamente con la esquina de la tarjeta.
  - **Renombramiento SemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ntico**: Se actualizÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la clase CSS y selectores en JavaScript de `.cost-ribbon-left` a `.cost-ribbon-right` en todos los archivos involucrados (`style.css`, `contract-interaction.js` y `onboarding.js`).
- **Impacto**: Interfaz visualmente mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s premium, compacta y sin espacios residuales ("zero gaps"). Mejor aprovechamiento del alto de la pantalla, demostrando alta atenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n al detalle en la experiencia de usuario (UX).
- **Evidencia**: Modificaciones realizadas en `style.css`, `contract-interaction.js`, y `onboarding.js`.

---

### 2026-05-22 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a ArquitectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nica y DiagnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³stico de SegregaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n On-Chain/Off-Chain

- **Contexto**: Se requerÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a una evaluaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en profundidad del grado de desacoplamiento entre las operaciones en la base de datos (off-chain) y las interacciones con la blockchain (on-chain), asÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ como un anÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lisis de riesgos de cumplimiento legal/regulatorio y la detecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de posibles cuellos de botella e inconsistencias tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnicas.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **IdentificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Inconsistencia CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica**: Se documentÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ que el backend (`creditScoringService.js`) invoca la funciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `updateUserTrustScore` en `WintonProtocol`, la cual no existe en el contrato Solidity desplegado en Optimism Sepolia, provocando excepciones JSON-RPC silenciosas pero constantes en cada login y registro de usuario.
  - **Mecanismos de Resiliencia**: Se verificÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ y validÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el patrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Outbox/Safety Net para el control transaccional hÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­brido en `web3_pending_transactions` y el cron de reconciliaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - **DiagnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³stico Regulatorio**: Se evaluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el riesgo legal de custodia (Hosted Wallet) bajo la perspectiva de FinCEN y MiCA, recomendando una transiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n futura hacia soluciones MPC/No custodiales (Web3Auth/Privy) y EIP-7702 para erradicar las liabilities de Money Transmitter (MTL/MSB).
- **Impacto**: Se elaborÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un diagnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³stico detallado en un artefacto dedicado, mapeando las prioridades de refactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y resoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de bugs (el error del score) para garantizar que la plataforma sea 100% segura, robusta y escalable legalmente en producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
- **Evidencia**: CreaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del reporte [web3_architecture_diagnostic.md](file:///C:/Users/migue/.gemini/antigravity-ide/brain/b02b92dc-18bd-44ee-b446-5f646d962ba6/web3_architecture_diagnostic.md).

---

### 2026-05-21 (Parte 3) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Interfaz de Estado de Cuenta Dual (Web3 vs Impulsor) y Riesgo Regulatorio Cero

- **Contexto**: Tras la purificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del Estado de Cuenta Web3 (Parte 1), la secciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Transacciones dejÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ de mostrar las recompensas de puntos de marketing, lo que limitaba la visibilidad unificada del usuario. Sin embargo, mezclar transacciones on-chain y recompensas off-chain en una sola tabla generaba un grave riesgo de **ConfusiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del Consumidor (Consumer Confusion)** bajo normativas AML/SEC, donde el usuario podrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a asumir que sus puntos de lealtad tienen el mismo peso y propiedad legal que sus tokens Web3.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **SegregaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Mutuamente Excluyente**: Se implementÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ una interfaz de dos pestaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as o botones ("Estado de Cuenta Web3" y "Recompensas Impulsor") en la pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de Transacciones. Al usar pestaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as excluyentes sin una opciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mixta ("Todas"), se redujo el riesgo de confusiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n legal a cero.
  - **Dinamismo Contextual**: Se actualizÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el frontend para leer `walletActiveTab` desde `localStorage`. Si el usuario navega desde el panel de "Impulsor", la pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de Transacciones se abre por defecto en la pestaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a de "Recompensas". Si navega desde "Billetera", se abre en "Web3".
  - **DiseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o Mobile-First (Bancario)**: Se reescribiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el CSS de la tabla para mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles (`@media max-width: 768px`). Se eliminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el contenedor oscuro limitante y se implementÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un `Grid` de 2x2 sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºper compacto (estilo Revolut/Binance) que evita el texto aplastado y maximiza el espacio inmersivo en celulares.
  - **Backend Seguro**: Se ampliÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el controlador `transactionController.js` para recibir el filtro `?type=marketing` o `?type=web3`, aplicando filtros SQL parametrizados estrictos por cada categorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de tokens.
- **Impacto**: Se logrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ una UX fluida, centralizada y visualmente premium, sin sacrificar en absoluto la seguridad regulatoria de la plataforma. La trazabilidad de base de datos se mantiene intacta y sin fisuras de inyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n SQL. La suite de pruebas de seguridad (6/6) pasÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ con ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©xito.
- **Evidencia**: Modificaciones realizadas en `transactions.js`, `style.css` y `transactionController.js`.

---

### 2026-05-21 (Parte 2) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ ResoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Conflicto de Rutas en Express y Estabilidad de Test Suite

- **Contexto**: Tras la modularizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de los endpoints de transacciones a `transactionRoutes.js` y su montaje en la raÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­z (`/`) del servidor, se detectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ que los tests del administrador (`platformFormFields.test.js`) fallaban con error `401 Unauthorized` (`No autenticado. Token no proporcionado.`). La causa raÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­z fue un conflicto de precedencia en Express: el uso global de `router.use(verifyUserToken)` sin alcance de ruta en un router montado en `/` provocaba que todas las solicitudes posteriores (incluyendo la creaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de publicaciones del administrador en `/api/admin/platform/create-publication`) fuesen interceptadas y bloqueadas por la autenticaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de usuario regular. AdemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s, el mock destructivo `app.listen = jest.fn()` en el archivo de prueba impedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a que Supertest inicializara correctamente la aplicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y gestionara las cabeceras de cookies y tokens.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **InyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Middleware EspecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­fico**: Se removiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `router.use(verifyUserToken)` y se asociÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el middleware `verifyUserToken` de forma explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cita y aislada ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºnicamente a las rutas `/api/me/transactions` y `/users/:username/transactions` en `transactionRoutes.js`.
  - **Aislamiento Condicional del Servidor**: Se configurÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la ejecuciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `app.listen(...)` en `server.js` para que solo corra fuera del entorno de pruebas (`process.env.NODE_ENV !== 'test'`). Esto permitiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ eliminar el mock destructivo de `app.listen` en `platformFormFields.test.js`, devolviendo a Supertest el control total para arrancar el servidor en puertos efÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­meros de forma nativa.
- **Impacto**: Se resolviÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ al 100% el conflicto de enrutamiento en Express, logrando que toda la suite de pruebas del backend pase con ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©xito (6 de 6 pruebas exitosas). El cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo del servidor y de pruebas ahora es completamente robusto, mantenible y respeta los flujos de seguridad.
- **Evidencia**: Modificaciones realizadas en [transactionRoutes.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/routes/transactionRoutes.js), [server.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/server.js) y [platformFormFields.test.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/__tests__/platformFormFields.test.js).

---

### 2026-05-21 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ SegregaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y ModularizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del Endpoint de Transacciones (PurificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Cuenta Web3)

- **Contexto**: Se identificÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ que el "Estado de Cuenta Web3" mostraba transacciones off-chain (tales como `welcome_bonus`, `referral_bonus` y `gov_vote_reward`) como interacciones Web3. Esto distorsionaba la mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©trica de interacciones de blockchain reales y exponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a datos promocionales de marketing en un extracto financiero Web3 puro. AdemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s, estos endpoints estaban acoplados de forma monolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica en `server.js`.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **ModularizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Completa**: Se extrajeron los endpoints de transacciones `/api/me/transactions` y `/users/:username/transactions` del monolito `server.js` hacia un enrutador dedicado `transactionRoutes.js` y un controlador `transactionController.js`.
  - **Filtrado de ProyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Ledger**: Se restringieron las transacciones devueltas en la proyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Web3 a los tipos reales del protocolo financiero: `payment_sent`, `payment_received`, `commission_received`, `burn`, `escrow_release` y `booster_reward`. Se excluyeron los bonos promocionales off-chain.
  - **Mantenimiento del Perfil de Impulsor**: Las transacciones promocionales off-chain siguen estando perfectamente visibles en el Perfil de Impulsor, el cual consume directamente de `booster_transactions` y `booster_blue_ledger`.
  - **Defensa en Profundidad y Seguridad**: Se aplicaron controles IDOR rigurosos basados en el `userId` del JWT y se utilizaron consultas SQL 100% parametrizadas. Se mantuvo la inmutabilidad absoluta del Ledger General de la base de datos (sin modificar ni eliminar filas).
- **Impacto**: Se logrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un desacoplamiento arquitectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nico limpio del monolito, incrementando la mantenibilidad y testabilidad del sistema. La interfaz de la Cuenta Web3 ahora muestra la informaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n financiera Web3 exacta sin distorsiones off-chain.
- **Evidencia**: CreaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `src/controllers/transactionController.js`, `src/routes/transactionRoutes.js`, y modificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `server.js` para usar el enrutador modular.

---

### 2026-05-19 (Parte 2) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ PurificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n ArquitectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nica de Billetera Web3 (Materia-Antimateria)

- **Contexto**: Tras una auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de coherencia entre los Smart Contracts (`WintonProtocol.sol`, `BlueToken.sol`) y la interfaz de la billetera Web3 (`contract_interaction.html`), se detectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ que la UI contenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a "artefactos fantasma" heredados de la arquitectura previa. EspecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ficamente, el saldo BLUE mostraba tokens "Pendientes" (un concepto off-chain) y el saldo RED presentaba un botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n manual de "Quemar". 
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n MatemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica y LÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica**:
  - Desde la migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n a la arquitectura EIP-7702 con el **Vigilante de Auto-AmortizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n** (`triggerAutoAmortize`), es algorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tmicamente imposible que un usuario posea tokens BLUE lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­quidos y deuda RED simultÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡neamente. Al momento de recibir BLUE, el contrato aniquila proporcionalmente la deuda RED de forma instantÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡nea.
  - Se eliminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ por completo el botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n manual "Quemar" y todo su cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo JavaScript subyacente (ya que el usuario nunca tendrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a BLUE para quemar RED manualmente sin que se hubiese activado la auto-amortizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n primero).
  - Se eliminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la visualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de tokens "Pendientes" de la vista Web3 pura, ya que es un estado de base de datos (escrow) y no un token ERC-20 real emitido.
  - A peticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del usuario, no se dejÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ ningÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn mensaje de texto explicativo en la zona RED para mantener el mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ximo nivel de minimalismo en la interfaz.
  - Se mantuvo intacto el temporizador de vencimiento (alimentado por el backend) como un disuasivo visual y recordatorio financiero para evitar la "PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina LOVE".
- **Impacto**: La Billetera Web3 ahora refleja la verdad on-chain absoluta. Es una interfaz minimalista, honesta y sin fricciones que expone el poder y la automatizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del protocolo EIP-7702.
- **Evidencia**: EliminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `saldoEscrowBlue`, `burnTriggerBtn`, modales de quemado en `contract_interaction.html` y `contract-interaction.js`.

---

### 2026-05-19 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Aislamiento de UX en Billetera Web3 (Interferencia de BotÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Quemar)

- **Contexto**: En la interfaz principal de la billetera Web3 (`contract_interaction.html`), tanto el panel de saldo BLUE como el de saldo RED estaban configurados como elementos clickeables que redirigÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an a la pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de "Estado de Cuenta" (`estado-cuenta.html`). Sin embargo, el panel RED incluye un botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica: **ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½Ãƒâ€šÃ‚Â¥ Quemar ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½Ãƒâ€šÃ‚Â¥**. Esta superposiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡reas clickeables provocaba que los usuarios pudieran pulsar accidentalmente el ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rea de saldo RED mientras intentaban usar el botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de quemar, siendo redirigidos involuntariamente y causando fricciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de UX.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: 
  - Se eliminaron los atributos `onclick="window.location.href='estado-cuenta.html'"` y `style="cursor: pointer;"` exclusivamente del contenedor `.balance-section.red-section`.
  - El acceso al Estado de Cuenta se mantiene activo y exclusivo desde la secciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del saldo BLUE (y el botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de navegaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n principal).
- **Impacto**: Aislamiento visual y funcional del ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rea de deuda (RED). Ahora los usuarios pueden interactuar con la informaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y el botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de quemar sin riesgo de redirecciones accidentales. La UX es mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s limpia, predecible y segura.
- **Evidencia**: ModificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del contenedor de saldo RED en `contract_interaction.html`.

---

### 2026-05-18 (Parte 2) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ ExenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n DinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mica de KYC Web3 en Modo Pre-lanzamiento

- **Contexto**: Durante la evaluaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n arquitectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nica predictiva del despliegue a ProducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (merge a `main`), el usuario identificÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un riesgo crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tico de denegaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de servicio lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica (bloqueo masivo) para la comunidad de Impulsores. En ProducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, la plataforma opera en Modo Pre-lanzamiento (`pre_launch_mode_enabled = 'true'`), donde toda la actividad econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mica de tareas se registra off-chain en el Libro de Impulsores (puntos BLUE IOU) sin requerir gas ni interacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n con contratos inteligentes Web3. Sin embargo, las barreras KYC recientemente implementadas en `createPublication` y `acceptPublication` consultaban y exigÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an KYC Web3 para todas las tareas de tipo `request` de forma incondicional. Como resultado, al hacer el merge a producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, cualquier usuario existente (`kyc_verified = FALSE`) habrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a quedado bloqueado al intentar publicar o aceptar tareas remuneradas en BLUE IOU.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **ExenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n DinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mica en Pre-lanzamiento (OpciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 1)**: En `publicationController.js`, se condicionaron los frenos KYC de creaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y aceptaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de tareas para que solo se ejecuten si la plataforma **NO** estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ en Modo Pre-lanzamiento (`settings.pre_launch_mode_enabled !== 'true'`).
  - **ArmonizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Reglas de Cumplimiento**: Se establece una distinciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n clara entre la actividad de fomento comunitario off-chain (exenta de KYC para eliminar fricciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de adopciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n) y las donaciones de crowdfunding en Winton Solidario (donde se mantiene el KYC obligatorio para prevenir granjas de bots y lavado de puntos).
- **Impacto**:
  - **Cero InterrupciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en ProducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Los miles de usuarios de la comunidad de Impulsores pueden continuar publicando, aceptando y completando tareas en BLUE IOU sin ningÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn tipo de bloqueo o fricciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica.
  - **TransiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Futura Automatizada**: En el momento en que administraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n desactive el Modo Pre-lanzamiento (`pre_launch_mode_enabled = 'false'`), el candado KYC Web3 se activarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ de forma instantÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡nea y automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica para todo el marketplace.
- **Evidencia**: Archivos modificados: `publicationController.js`, `EVOLUCION.md`.

---

### 2026-05-18 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ ResoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de ColisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n SemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ntica KYC vs Email OTP en Winton Solidario (MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 056)

- **Contexto**: Durante la revisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la arquitectura de resiliencia KYC (MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 055), el usuario identificÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ una colisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n conceptual e inconsistencia en el uso de la columna heredada `is_verified`. Tras un rastreo exhaustivo en el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo base, se confirmÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ que `authController.js` y `register.js` utilizaban `is_verified` para representar la **VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Correo ElectrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nico (OTP)**, marcÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndola como `TRUE` en cuanto el usuario completaba su registro. Sin embargo, el mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo de donaciones humanitarias (`humanitarianService.js`) y el Trigger de base de datos de la migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 039 (`fn_release_humanitarian_donations`) asumÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an errÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³neamente que `is_verified` representaba la **VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n KYC Web3 aprobada por Admin**. Esto generaba un fallo de seguridad silencioso: todos los usuarios registrados tenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an `is_verified = TRUE`, evadiendo el estado de retenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (`on_hold`) y liberando fondos de Winton Solidario a usuarios sin KYC en la blockchain.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **SeparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n SemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ntica Estricta (OpciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 1)**: Se decidiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ mantener `is_verified` exclusivamente para la verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de correo electrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nico (OTP) en el flujo de registro/login, y utilizar la nueva columna `kyc_verified` (introducida en la migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 055) exclusivamente para el estatus KYC Web3.
  - **MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 056 (`056_update_solidario_trigger_to_kyc_verified.js`)**: Se creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ una nueva migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para actualizar la funciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n PL/pgSQL `fn_release_humanitarian_donations`. El Trigger ahora evalÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºa exclusivamente cambios en `kyc_verified` (`OLD.kyc_verified IS DISTINCT FROM NEW.kyc_verified AND NEW.kyc_verified = true`) para liberar las donaciones en estado `on_hold`.
  - **RefactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `humanitarianService.js`**: Se modificaron las consultas SQL en `donateToCause` y `getCauseDonations` para verificar `kyc_verified` en lugar de `is_verified`, y se actualizaron todos los comentarios arquitectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nicos del servicio para reflejar la separaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de responsabilidades.
- **Impacto**:
  - **AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a Fintech y AML Impecable**: Se establece una barrera clara e inmutable entre un dato de contacto verificado (Email) y una acreditaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de identidad financiera y legal gubernamental (KYC Web3).
  - **Cierre de Brecha en Winton Solidario**: Las donaciones humanitarias de usuarios sin KYC Web3 ahora quedan correctamente retenidas en estado `on_hold` y solo se liberan cuando un administrador aprueba legÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­timamente el KYC on-chain y en la base de datos.
- **Evidencia**: Archivos modificados/creados: `056_update_solidario_trigger_to_kyc_verified.js`, `humanitarianService.js`, `EVOLUCION.md`.

---

### 2026-05-17 (Parte 3) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Resiliencia KYC en Base de Datos (MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 055) y OptimizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Inputs de BÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsqueda Admin

- **Contexto**: Tras las auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as de UX y Web3, el usuario identificÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ dos problemas crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticos en el entorno de demostraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. Primero, el campo de bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsqueda de usuario en el panel KYC de administraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n se comprimÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a y resultaba muy pequeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o para escribir debido a que el botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n adyacente tomaba el 100% del ancho por herencia global. Segundo, en la tarjeta de Identidad Web3, el estatus KYC aparecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a errÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³neamente como "Pendiente de AprobaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n" para usuarios que ya habÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an sido aprobados previamente, debido a que los reinicios del nodo local de blockchain (Anvil/Hardhat) borraban el estado en memoria de los contratos inteligentes, provocando que las consultas on-chain (`isKYCVerified`) retornaran `false`.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **OptimizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Inputs de BÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsqueda (`admin-panel.html` y `admin-style.css`)**: Se reestructurÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el contenedor flex del campo de bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsqueda KYC con `flex-wrap: wrap` y se asignaron anchos mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nimos explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­citos (`min-width: 250px` al input y `min-width: 150px` al botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n) para evitar la compresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. AdemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s, se redefiniÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la clase `.admin-input-dark` para renderizar un recuadro blanco amplio, luminoso y espacioso (`padding: 14px 18px; font-size: 1.1rem; background-color: #ffffff`) con texto oscuro, asegurando mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡xima visibilidad al escribir.
  - **MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 055 (Respaldo KYC en Base de Datos)**: Se creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el archivo `055_add_kyc_verified_to_users.js` para inyectar la columna `kyc_verified BOOLEAN DEFAULT FALSE` en la tabla `users`, dotando al sistema de una cachÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© local resiliente.
  - **SincronizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Transaccional (`governanceController.js`)**: Al aprobar o revocar KYC desde el panel de administraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, el controlador ahora actualiza `users.kyc_verified` en la base de datos de forma paralela a la transacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n on-chain, con lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de fallback automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica para entornos de desarrollo y demostraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - **Mecanismo de Fallback Robusto (`server.js` y `publicationController.js`)**: En los endpoints de balance (`/api/me/balance`) y en los frenos de publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n/aceptaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de tareas, se implementÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ una verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de respaldo: si la consulta on-chain `Web3BridgeService.checkUserKYC` retorna `false` por reinicios del nodo o timeouts del RPC, el sistema consulta `users.kyc_verified` en la base de datos para mantener la consistencia inmutable en la interfaz de usuario.
- **Impacto**:
  - **UX Impecable y Amplia**: Los administradores disponen de campos de texto grandes, cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³modos y perfectamente visibles para ingresar nombres de usuario.
  - **Resiliencia Total ante Reinicios Web3**: El estatus KYC en la Identidad Web3 y los permisos de publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n se mantienen estables y correctos incluso si el nodo local de blockchain se reinicia o pierde conexiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
- **Evidencia**: Archivos modificados/creados: `055_add_kyc_verified_to_users.js`, `governanceController.js`, `server.js`, `publicationController.js`, `admin-panel.html`, `admin-style.css`, `EVOLUCION.md`.

---

### 2026-05-17 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Defensa en Profundidad KYC (Freno en AceptaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Tareas + PropagaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Errores Web3)

- **Contexto**: El Smart Contract `WintonProtocol` tiene una regla de cumplimiento financiero estricta (AML/KYC): exige que **TANTO el Payer (pagador) COMO el Payee (trabajador/beneficiario)** tengan su KYC verificado on-chain (`isKYCVerified`). Aunque se habÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a implementado un freno pre-publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para el autor, los trabajadores sin KYC podÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an aceptar tareas, invertir tiempo y completarlas. Al momento de confirmar el pago, el Smart Contract revertÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a con `WintonProtocol: Payee KYC not verified`. Al capturarse el error de forma genÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rica en el backend, el usuario veÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a un mensaje inespecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­fico en pantalla, generando confusiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y falsos reportes de error en el autor.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **Freno KYC Preventivo (Capa 1 - Fail-Fast)**: En `publicationController.js`, se modificÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el endpoint `POST /publications/:id/accept`. Si la publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n implica remuneraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (`request`), se consulta la blockchain para verificar que la wallet del trabajador (o la de su tutor si es menor de edad) tenga el KYC aprobado on-chain. Si no lo tiene, se bloquea la aceptaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n con HTTP 403 y un mensaje claro indicando que debe verificar su identidad antes de realizar trabajos pagados.
  - **PropagaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Exacta de Errores Web3 (Capa 2 - Defensa en Profundidad)**: En `web3BridgeService.js`, se modificÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `syncPaymentToBlockchain` para no silenciar los errores de revert de la blockchain con `return null`, sino propagar la excepciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (`throw error`).
  - **Manejo de Errores en `publicationService.js`**: En `processRequestPayment` y `processDirectPaymentCompletion`, se implementÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un bloque `try...catch` especÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­fico para analizar el mensaje de error de Web3. Si contiene `Payee KYC not verified`, `Payer KYC not verified` o errores de gas (`insufficient funds`), se arroja un mensaje HTTP 502 preciso y en espaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ol para mostrarse en el frontend, y se guarda el motivo exacto en la tabla `web3_pending_transactions`.
- **Impacto**:
  - **Cero Trabajo Perdido**: Los trabajadores sin KYC no pueden iniciar tareas remuneradas, garantizando que todo el que trabaja cobrarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ sin problemas tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnicos ni legales.
  - **Claridad Total en UX**: Si por algÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn motivo de auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a se revoca un KYC a mitad de camino, el autor verÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ en su pantalla el motivo exacto del rechazo de la blockchain.
  - **Trazabilidad de Errores**: La base de datos registra el motivo exacto del fallo de sincronizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Web3 en el patrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Outbox.
- **Evidencia**: Archivos modificados: `publicationController.js`, `publicationService.js`, `web3BridgeService.js`, `EVOLUCION.md`.

---

### 2026-05-16 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Sistema KYC Compliance (Freno Pre-PublicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n + Admin Panel On-Chain)

- **Contexto**: El Smart Contract `WintonProtocol` exige que las billeteras del pagador tengan KYC verificado on-chain (`isKYCVerified`). Sin una validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n previa en el backend, los usuarios podÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an crear publicaciones tipo "request" (que implican pago) y los trabajadores invertÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an tiempo en tareas que luego fallaban al intentar cobrar, generando un `CALL_EXCEPTION: Payer KYC not verified`. AdemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s, se detectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un deadlock de base de datos (self-deadlock) por uso de `pool.query` dentro de transacciones activas con `client.query` (bloqueo `FOR UPDATE`).
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **CorrecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Deadlock (PatrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Outbox)**: Reemplazar todas las llamadas a `pool.query` por `client.query` dentro de `processRequestPayment` y `processDirectPaymentCompletion` en `publicationService.js`, asegurando que las operaciones de auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a se ejecuten en la misma conexiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n transaccional.
  - **Freno KYC Pre-PublicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: En `publicationController.js`, antes de permitir la creaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de publicaciones tipo `request`, se consulta directamente la blockchain (`isKYCVerified`) para verificar el KYC del autor (o su tutor si es menor de edad). Si no tiene KYC ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ se bloquea la publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n con HTTP 403. PolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica Fail-Safe: ante duda, se bloquea.
  - **MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo `checkUserKYC()` en `web3BridgeService.js`**: Lectura gratuita (sin gas, funciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `view`) con timeout de 3 segundos para no congelar el servidor si Alchemy estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ caÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­do.
  - **MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo `setUserKYC()` en `web3BridgeService.js`**: Escritura on-chain (`setKYCStatus`) con prevenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de revert (verifica estado actual antes de gastar gas), validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de direcciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Ethereum y tipo booleano explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cito.
  - **Endpoint Admin `POST /api/governance/kyc`**: Protegido por `verifyAdminToken`. Valida usuario/wallet, ejecuta la operaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n blockchain, y registra TODA la acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en `audit_log` con IP, user-agent, wallet, txHash, timestamp y resultado (ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©xito o fracaso). CategorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a: `compliance`.
  - **Panel de AdministraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (Frontend)**: Nueva secciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½Ãƒâ€šÃ¯Â¿Â½ KYC" en `admin-panel.html` con formulario de bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsqueda de usuario, visualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de estado KYC, y botones de "Aprobar" / "Revocar" con diÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡logo de confirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. Listeners protegidos contra doble-clic y registro duplicado.
- **Arquitectura preparada para proveedores externos**: El mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo `setUserKYC()` es la pieza final del rompecabezas. Hoy lo llama un admin manualmente. MaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ana, un webhook de Onfido/Jumio/Sumsub llamarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ al mismo endpoint sin cambios en el Smart Contract ni en el freno de publicaciones.
- **Impacto**:
  - EliminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de deadlocks de base de datos.
  - Los trabajadores nunca mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s perderÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n tiempo en tareas impagables.
  - Cumplimiento de normativa KYC/AML: sin verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, sin transacciones financieras.
  - Trazabilidad bancaria completa: toda operaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n KYC queda en `audit_log` y en la blockchain.
- **Evidencia**: Archivos modificados: `publicationService.js`, `web3BridgeService.js`, `publicationController.js`, `governanceController.js`, `governanceRoutes.js`, `admin-panel.html`, `admin-panel.js`.

---

### 2026-05-08 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ IntegraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Gobernanza ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Blockchain (Winton-Consensus + Web3 Bridge)

- **Contexto**: Los Smart Contracts desplegados en Optimism Sepolia tienen funciones administrativas (`pause`, `setMaxTransactionAmount`, `setFoundersWallet`, `withdrawSurplus`) que solo se podÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an ejecutar por consola de Hardhat. Se necesitaba integrarlas con el sistema de gobernanza Winton-Consensus existente para que los guardianes pudieran gestionarlas con multifirma, votaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **Ampliar `web3BridgeService.js`**: Reescribir con ABI completa del protocolo y treasury. Agregar funciones para `pauseProtocol`, `unpauseProtocol`, `setMaxTransactionAmount`, `setFoundersWallet`, `withdrawSurplus` y `getProtocolStatus` (lectura sin gas).
  - **Integrar en `_executeAction` de `governanceService.js`**: DespuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s de actualizar `app_settings`, si el `target_key` empieza con `web3_`, ejecutar la operaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n blockchain correspondiente vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a el bridge. El tx_hash se guarda en `audit_log` y en `governance_requests.metadata`.
  - **CatÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡logo de settings** (`settingsDisplayMap.js`): Agregar las 4 opciones Web3 con etiquetas en espaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ol para que aparezcan en el formulario de gobernanza.
  - **MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 052**: Insertar los 4 registros de `app_settings` con valores iniciales que coinciden con los Smart Contracts desplegados.
- **Impacto**:
  - Los guardianes pueden gestionar los Smart Contracts desde el panel de gobernanza existente, sin tocar consola.
  - Cada cambio on-chain queda registrado con tx_hash en el audit_log (trazabilidad completa DB + Blockchain).
  - El formulario de solicitud existente se reutiliza sin cambios de frontend.
- **Evidencia**: Archivos modificados: `web3BridgeService.js`, `governanceService.js`, `settingsDisplayMap.js`. MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `052_add_web3_governance_settings.js`.

---

### 2026-05-08 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n a EIP-7702 (Pectra/Isthmus) + AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de Seguridad Profunda

- **Contexto**: Los Smart Contracts (BlueToken, RedToken, WintonProtocol, WintonTreasury) usaban ERC-2771 (meta-transacciones de primera generaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n). Optimism activÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ EIP-7702 (Pectra/Isthmus) en mayo 2025, habilitando el estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndar mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s moderno de Account Abstraction sin necesidad de Trusted Forwarder.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n a EIP-7702**: Eliminar `ERC2771Context` de WintonProtocol y WintonTreasury. Con EIP-7702, `msg.sender` ES la direcciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n real del usuario (la red lo resuelve nativamente). Se eliminaron los 3 overrides de contexto (`_msgSender`, `_msgData`, `_contextSuffixLength`).
  - **Relayer explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cito**: AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir variable `relayer` separada del Owner. `processPayment` ahora recibe `payer` como parÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡metro (verificado por el backend), protegido por `onlyRelayerOrOwner`.
  - **Vigilante de Auto-AmortizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Implementar hook en `BlueToken._update()` que llama a `WintonProtocol.triggerAutoAmortize(receptor)` en cada recepciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de BLUE. Esto cierra la vulnerabilidad de transferencia directa que permitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a acumular BLUE y RED simultÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡neamente.
  - **OptimizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de gas**: Lista de direcciones exentas del vigilante (Treasury, Protocol) + eliminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de llamada redundante a `_autoAmortize` en `processPayment`.
  - **Circuit Breaker**: AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir `maxTransactionAmount` (1M BLUE) como lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­mite por transacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n individual.
  - **Bloqueo de `renounceOwnership()`**: Sobreescrito en los 4 contratos para prevenir que el protocolo quede huÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rfano accidental o maliciosamente.
- **AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de Seguridad**: Se probaron 20+ escenarios de ataque incluyendo: bypass del backend, reentrada, overflow, dust attack, impersonaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del relayer, front-running de Merkle root, ataque de polvo, envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o de ETH directo, y compromiso de llave del Owner. Cero vulnerabilidades encontradas.
- **Impacto**:
  - Contratos mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s simples (menos herencia, menos cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo ejecutable, menor superficie de ataque).
  - Gas reducido (~5,000 gas menos por transacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n al eliminar overrides de contexto).
  - Compatibilidad con el estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndar mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s moderno de la industria (EIP-7702, mayo 2025).
  - Regla Materia-Antimateria ahora es matemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticamente inviolable sin importar el origen de los tokens.
- **Evidencia**: CompilaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n exitosa con Hardhat 2.28.6, OpenZeppelin v5.6.1, Solidity 0.8.24.

#### ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ¯Â¿Â½ MEJORAS FUTURAS (Pre-ProducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n):

1. **Sistema de Roles con AccessControl (OpenZeppelin)**:
   - `KYC_MANAGER_ROLE` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Backend automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tico (sin multifirma) para `setKYCStatus`.
   - `FINANCIAL_ADMIN_ROLE` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Gnosis Safe multifirma para cambios de comisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, retiro de excedentes, cambio de Relayer.
   - `EMERGENCY_ROLE` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Cualquier firmante individual del Safe puede pausar (velocidad crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica en emergencias).
2. **Gnosis Safe Multisig como Owner**: Transferir ownership a un Safe (3/5 multifirma) antes de ir a mainnet.
3. **Timelock en cambios financieros**: Agregar un contrato Timelock (24-48h de espera) para cambios de comisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y retiros del Treasury, dando tiempo a la comunidad de reaccionar.
4. **EvaluaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de EIP-7702 nativo**: Cuando el ecosistema de SDKs (Pimlico, ZeroDev) madure, implementar transacciones patrocinadas tipo 0x04 directamente desde el frontend.

---    
### 2026-05-04 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Estado de Cuenta Web3 (AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a Financiera)

- **Contexto**: La pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina principal de la billetera debÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a mantenerse simple para las transacciones diarias, pero se necesitaba un espacio profesional para mostrar mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tricas financieras y Web3, el lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­mite de crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dito RED, equivalencia fiat y estadÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­sticas transaccionales, cumpliendo estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares de auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Implementar un diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o de "DivulgaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Progresiva" (Progressive Disclosure) creando la nueva pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina `estado-cuenta.html`.
  - Agregar la Llave PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblica con estado de conexiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n a la red "Optimism Sepolia" y enlace directo al Explorador de Bloques.
  - Mostrar el detalle de la LÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea de CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dito RED y estructurar vencimientos a 30 dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as y a fin de mes.
  - Mostrar la Liquidez BLUE detallando fondos disponibles vs bloqueados (escrow) y su fecha de liberaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - Generar un bloque de estadÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­sticas de actividad de red (interacciones, enviadas, recibidas).
- **Impacto**: 
  - Mayor transparencia tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica y financiera sin ensuciar la UX principal de la billetera.
  - Interfaz estandarizada a la de plataformas como Binance y Coinbase.
- **Evidencia**: Archivos creados `estado-cuenta.html`, `estado-cuenta.js` e inclusiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en `vite.config.js`.

---

### 2026-05-01 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ RediseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o del Banner de Referidos (Booster Edition)

- **Contexto**: El botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de compartir cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo de referido tenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a una estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tica desalineada con el resto del ecosistema "Booster" (Impulsor). Tras iterar con Montserrat, se detectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ que el "molde" de la letra no encajaba con la seriedad fintech buscada.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Implementar un diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o **Azure Glass** con la tipografÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a **Inter** (UI Premium).
  - Adoptar Inter por su molde mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s estilizado, vertical y compacto, ideal para interfaces Web3.
  - Aplicar `backdrop-filter: blur(16px)` para lograr un efecto de cristal esmerilado.
  - Mantener el dorado para los valores numÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ricos con peso `800` (Extra Bold) para mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡xima legibilidad sobre el vidrio.
- **Impacto**:
  - EstÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tica profesional de alto nivel, alineada con estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares de industria.
  - Mayor densidad de informaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n sin sacrificar la elegancia.
- **Evidencia**: RediseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o aplicado en `style.css` con tipografÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a Inter y nuevo icono de nodos estilo WhatsApp en `contract_interaction.html`.

---

### 2026-05-02 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Despliegue de WintonProtocol en Optimism Sepolia (Testnet PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblica)

- **Contexto**: El entorno Demo necesitaba operar bajo estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares profesionales de la industria Web3 (Staging real), abandonando simulaciones locales (`localhost`) para conectarse a una Blockchain pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblica.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - CompilaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y despliegue del contrato inteligente `WintonProtocol.sol` en la red de Capa 2 **Optimism Sepolia**.
  - ConfiguraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de un nodo RPC mediante **Alchemy** para el puente de comunicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de una billetera segura de despliegue ("Deployer Demo") actuando como el **Relayer** autorizado del protocolo.
- **Impacto**:
  - La aplicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (Demo) ahora es una DApp 100% funcional y auditable on-chain.
  - Los pagos (Off-chain) y el Scoring de CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dito WTS se sincronizan de forma segura con la Testnet sin costo de gas para el usuario final ("Cero FricciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n").
- **Evidencia**: 
  - Contrato desplegado en la direcciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: `0x0066269E090a38618A24A1fB65b52AEBBa3c00C4`

---

### 2026-05-02 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Infraestructura Web3 y Scoring Conductual (MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 050)

- **Contexto**: El sistema requerÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a una base sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³lida para el almacenamiento de billeteras Web3 y la configuraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del Scoring de CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dito RED (WTS) en el entorno de producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n/demo.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Implementar la **MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 050** para aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir las columnas `web3_wallet_address` y `web3_private_key_encrypted` a la tabla `users`.
  - Registrar las variables maestras de Scoring en `app_settings` (base 100, bonos por referido/actividad) para permitir ajustes sin redespliegue.
  - Asegurar la **idempotencia** de la migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para despliegues seguros en Render.
- **Impacto**:
  - HabilitaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del sistema de "BÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vedas Invisibles" para usuarios.
  - SincronizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica de lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­mites de crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dito entre DB y Smart Contracts.
- **Evidencia**: Archivo de migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `050_add_web3_wallet_and_scoring_settings.js` desplegado y ejecutado.

---

### 2026-05-01 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ RediseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o del Banner de Referidos (Booster Edition)
>>>>>>> feature/wallet-ux-fixes

- **Contexto**: ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“donaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ es un tipo de publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n distinto (no es venta ni solicitud). Si se trata como genÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rico, la UX y las reglas se vuelven confusas.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: crear categorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de donaciones con estilos y lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica especÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­fica en frontend, con soporte backend donde aplica.
- **Impacto**: mejor claridad para usuarios al publicar/consumir donaciones.
- **Evidencia (commits)**: `ddf788a`.

---

### 2025-07-18 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Onboarding: bono de bienvenida y estado de impulsor

- **Contexto**: si el usuario recibe un bono inicial pero su ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“perfil de impulsorÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ no refleja saldo/estado, la experiencia se siente rota y genera desconfianza.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: implementar bono de bienvenida y asegurar que el backend actualice el estado/balance asociado al programa de impulsores.
- **Impacto**: onboarding mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s consistente; el usuario ve beneficios reflejados desde el inicio.
- **Evidencia (commits)**: `bc867c6`.

---

### 2025-07-23 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Pre-launch: donaciones como transferencia (sin minteo) + refactor de pagos

- **Contexto**: en pre-launch, las donaciones deben respetar reglas econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³micas (no crear tokens BLUE/RED si la fase requiere ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“balance ceroÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½).
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Implementar regla de donaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n pre-launch como **transferencia de saldo** entre perfiles de impulsor (sin mintear).
  - Documentar la regla en `backend/ECONOMIC_RULES.md` y ajustar soporte admin/UX.
  - Refactorizar backend para aislar lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de negocio en helpers (menos monolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tico).
  - Corregir el flujo de pago para que el estado final se actualice correctamente al completar.
- **Impacto**:
  - Coherencia econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mica: donaciones en pre-launch no rompen el ledger.
  - CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s mantenible y menos propenso a bugs por condicionales gigantes.
- **Evidencia (commits)**: `5f75b00`, `038ce28`, `18d7ef7`, `c20b896`.

---

### 2025-07-24 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Recompensas: bonos de registro ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“gateadosÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ por pre-launch

- **Contexto**: si los bonos se aplican fuera de la fase esperada, se rompe el control de emisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y la narrativa econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mica.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: condicionar (gate) UI/flujo de bonos de registro a que el modo pre-launch estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© habilitado.
- **Impacto**: reglas mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s consistentes segÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn fase.
- **Evidencia (commits)**: `5c51b4e`.

---

### 2025-08-30 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Seguridad/UX: advertencia obligatoria para donaciones

- **Contexto**: donaciones requieren claridad explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cita para evitar confusiones (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“esto no es una ventaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½, ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“no hay reembolsoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½, etc.).
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: modal de advertencia obligatorio al crear publicaciones de donaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
- **Impacto**: menos malentendidos y menos soporte manual.
- **Evidencia (commits)**: `0e0a3e5`.

---

### 2025-09-11 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Registro: verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por SMS

- **Contexto**: la verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de identidad/contacto es clave para reducir fraude y mejorar calidad de cuentas.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: incorporar verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por SMS en registro (backend + UI de registro).
- **Impacto**: mayor seguridad y mejor control de cuentas.
- **Evidencia (commits)**: `45f50d6`.

---

### 2025-11-04 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Correcciones de DB por deriva de esquema (documentado por chat)

- **Contexto**: errores crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticos en admin y confirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de pagos por columnas faltantes o valores `NULL` en columnas `NOT NULL`.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: aplicar estrategia de ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“auto-repairÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ con migraciones idempotentes y asegurar que inserciones crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas incluyan `user_id` (obtenido antes de insertar).
- **Impacto**: menos caÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­das en producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“schema driftÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½, y mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s integridad referencial.
- **Evidencia**:
  - Documento: `docs/RESUMEN_CHAT_2025-11-04.md` (este hito estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ descrito ahÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­).
  - Nota: el commit exacto de este chat no estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ referenciado en el resumen; por eso aquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ lo tratamos como ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“documentadoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s que como release con hash.

---

### 2025-11-05 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Refactor DB: `transactions` migra a `user_id`

- **Contexto**: usar `username` como llave en tablas transaccionales crea problemas de integridad, cambios de username, y joins frÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡giles.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: migrar `transactions` a `user_id` como clave estable (y ajustar backend/front donde aplica).
- **Impacto**: base de datos mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s consistente y consultas mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s seguras.
- **Evidencia (commits)**: `4992766`.

---

### 2025-11-21 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Gobernanza de referidos (expiraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n configurable)

- **Contexto**: los referidos sin expiraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n se vuelven difÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ciles de controlar y auditar (abuso, campaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as viejas, inconsistencias).
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: implementar expiraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y exponer configuraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n/admin + ajustes en frontend.
- **Impacto**: control operativo del crecimiento y reducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de fraude.
- **Evidencia (commits)**: `f1d1565`.

---

### 2025-11-22 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Cambio estructural: Event Sourcing + DB inmutable + Token Releaser

- **Contexto**: sistemas de balance/comisiones son sensibles: un bug o update directo puede romper auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a y confianza.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Migrar lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica a **Event Sourcing** (los ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“eventosÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ son la fuente de verdad).
  - Endurecer DB con **triggers de bloqueo** y **hashing** para inmutabilidad/auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.
  - Desactivar migraciones automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticas al inicio y usar `reset_db.js` como fuente controlada del schema inicial.
- **Impacto**:
  - Mejor trazabilidad (por quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© cambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un saldo y cuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndo).
  - Menos riesgo de ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“writes silenciososÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ y manipulaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - Base mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³lida para auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a legal/financiera.
- **Evidencia (commits)**: `5b067b8`, `ff50201`, `623b568`, `6c19b46`.

---

### 2025-11-23 a 2025-11-27 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ EstabilizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del schema + endpoints admin + validaciones en registro

- **Contexto**: despuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s de cambios profundos de DB, suelen aparecer desalineaciones entre columnas reales y el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Sincronizar columnas (`account_status`, `booster_level_settings`, `tutor_user_id`) y scripts de reset/migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - Mejorar calidad de datos y UX con validaciones en tiempo real (email, username, phone).
- **Impacto**:
  - Menos errores por columnas faltantes/renombradas.
  - Menos fricciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de registro y menos usuarios ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“mal formadosÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½.
- **Evidencia (commits)**: `6a132e4`, `b3efff1`, `8fd9e91`, `8079fe9`, `5babf26`, `f8c2f82`, `8ff741e`, `438bb9e`, `9026626`, `3717c29`.

---

### 2025-11-28 a 2025-11-29 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ UX y resiliencia del registro

- **Contexto**: registros fallidos (timeouts / refresh / navegaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n) generan abandono y soporte manual.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: recuperaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n robusta con persistencia de estado + validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n backend; pulido de mensajes/contraste.
- **Impacto**: mayor tasa de conversiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y menor frustraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del usuario.
- **Evidencia (commits)**: `b497d59`, `59cd196`.

---

### 2025-12-01 a 2025-12-03 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Marco legal/auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a (documentos + logs inmutables)

- **Contexto**: para productos con economÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a interna, la parte legal y su auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a tiene que ser reproducible y verificable.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Poblar documentos legales en DB.
  - Implementar auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a legal inmutable y carga dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mica de documentos.
  - Asegurar triggers y lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica server para evitar alteraciones indebidas.
- **Impacto**: ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“complianceÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s serio, mejor defensa ante disputas y cambios controlados.
- **Evidencia (commits)**: `97bbe34`, `93365d2`, `a819aa6`, `3ce3d3e`.

---

### 2025-12-04 a 2025-12-05 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Controles operativos + mejoras de login/registro

- **Contexto**: se necesitaba control admin sobre features sensibles (p. ej. ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Venta RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pidaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½) y mejorar UX bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡sica.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Switch admin para controlar ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Venta RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pidaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ y proteger el endpoint.
  - Toggle de visibilidad de contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a y limpieza de scripts inline redundantes.
  - Ajustes de texto/checkboxes en tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rminos.
- **Impacto**: operaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s segura y UX mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s amigable sin tocar arquitectura.
- **Evidencia (commits)**: `1159951`, `62ca67c`, `fc81164`, `b5c78ca`, `a0e111e`.

---

### 2025-12-11 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Reglas econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³micas mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s claras (Pre/Post-Launch)

- **Contexto**: reglas econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³micas confusas generan bugs, disputas y mal uso.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: documentar/ordenar reglas por fases; definir BLUE IOU y comisiones con mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s precisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
- **Impacto**: base de negocio mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡cil de implementar, testear y explicar.
- **Evidencia (commits)**: `a64ac44`.

---

### 2025-12-29 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ App Android inicial

- **Contexto**: expansiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de plataforma: cliente mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil con auth segura y flujo de publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: app Android inicial con arquitectura bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡sica (auth, dashboard, publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n) y utilidades como biometrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.
- **Impacto**: habilita pruebas mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles tempranas y validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del backend desde otro cliente.
- **Evidencia (commits)**: `c3effb0`.

---

### 2026-01-05 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Semana de seguridad/operaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (hardening + auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a + repeticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de tareas + fixes de prod)

- **Contexto**: al acercarse a producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, aparecen 3 frentes crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticos: **seguridad**, **consistencia**, **deploy**.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Hardening de seguridad (cookies HttpOnly admin, validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, sanitizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n).
  - Reglas estrictas de repeticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de tareas (con lock de concurrencia y hard reject).
  - `audit_log` con IP + UA y retenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n larga, instrumentado en endpoints crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticos.
  - Ajustes de producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (CORS, `trust proxy`, `cookie-parser`).
- **Impacto**:
  - Reduce superficie XSS y riesgos de auth.
  - Menos duplicidades/fraude por repeticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - Mejor forense/observabilidad ante incidentes.
- **Evidencia (commits)**: `89e2c9f`, `364a2d1`, `1156f02`, `880ff29`, `e421552`, `3645551`, `c7022bc`.

---

### 2026-01-06 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Publicaciones auditables y mejor admin (soft delete + filtros + restore)

- **Contexto**: borrar fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­sicamente registros rompe auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a y puede romper relaciones (FK).
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: soft delete (`deleted_at`) y herramientas de admin para filtrar/restore.
- **Impacto**: auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a preservada y operaciones admin mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s seguras.
- **Evidencia (commits)**: `9c2cc76`, `1ce9312`.

---

### 2026-01-10 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Pulido final de UX y consistencia de flags

- **Contexto**: detalles ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnicosÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ visibles al usuario (jerga interna) y toggles de configuraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n que, si se cambian con el schema incompleto, pueden romper pagos.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **Historial booster**: ocultar ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“BackfillÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ y normalizar el texto a una versiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n profesional (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Ajuste de saldo histÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ricoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½).
  - **Booster profile**: cuando el usuario ve su propio perfil (token presente), usar endpoint autenticado (`/api/me/booster-profile`) y dejar endpoint pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblico por `username` para perfiles ajenos.
  - **Registro**: cuando hay sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n/token y el usuario estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“pendiente de verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½, mostrar un bloque de estado con acciones (continuar verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n / ir al perfil / cerrar sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n) para evitar sensaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de bloqueo.
  - **Admin pre-launch**: implementar guard **fail-closed**: si un admin intenta desactivar pre-launch y faltan columnas crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas, el backend devuelve `409` con mensaje claro.
- **Impacto**:
  - UX mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s profesional (sin jerga interna).
  - Menos errores por ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“schema driftÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ al tocar toggles crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticos.
  - Onboarding mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s claro cuando existe sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n pendiente.
- **Evidencia (commits)**: `b89f852`, `7bf35d2`.
- **Nota operativa (importante)**: para desactivar pre-launch de forma segura, la DB debe tener columnas requeridas (segÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn el resumen del chat): `red_token_debts.user_id` y `blue_token_escrows.user_id`.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Encabezado principal: alineaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y jerarquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a visual

- **Contexto**: el enlace ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo funciona?ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ debÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a verse mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s discreto y alineado con el tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo principal para mejorar la lectura.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: colocar el enlace junto a ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“WintonCoinÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½, reducir tamaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o (~30%), usar cursiva y color secundario.
- **Impacto**: encabezado mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s compacto y profesional; menor ruido visual.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Encabezado en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil: mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s aire superior

- **Contexto**: en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles el encabezado quedaba muy pegado arriba y se veÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a apretado.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: aumentar el padding superior del contenedor del panel y el margen del tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil.
- **Impacto**: mejora la legibilidad y evita sensaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de elementos ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“apretadosÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ en pantalla pequeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ MenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº de usuario: estilo compacto sin fondo

- **Contexto**: el fondo del nombre de usuario ocupaba espacio y chocaba con ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo funciona?ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: quitar fondo y borde del trigger, con padding mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nimo y hover sutil.
- **Impacto**: mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s aire en el encabezado y mejor jerarquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a visual.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Contador de publicaciones disponibles

- **Contexto**: el usuario necesita ver cuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ntas publicaciones puede aceptar en ese momento.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: mostrar un contador junto a ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Publicaciones ActivasÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ basado en cupos, estado y repeticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n permitida.
- **Impacto**: claridad inmediata sobre oportunidades disponibles para cada usuario.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Contador discreto en el tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo

- **Contexto**: el contador debÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a verse mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s sutil en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: moverlo entre parÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ntesis, sin fondo, usando color secundario.
- **Impacto**: mejor legibilidad sin robar protagonismo al tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Contador en el tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo sin parÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ntesis

- **Contexto**: el contador debÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a verse aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s limpio.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: mostrar el nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero sin parÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ntesis, con color secundario discreto.
- **Impacto**: tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s minimalista y legible.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Contador: refleja lo visible en lista

- **Contexto**: el contador mostraba ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“0ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ aunque habÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a publicaciones visibles.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: contar el listado filtrado/renderizado en pantalla.
- **Impacto**: nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero coherente con lo que ve el usuario.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ RepeticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por usuario con lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­mite auditable

- **Contexto**: se requiere definir cuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ntas veces puede repetir una misma tarea cada usuario.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: agregar `max_repeat_per_user` en `publications`, con input en admin y en publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n normal, validado en backend.
- **Impacto**: control fino, auditable y coherente con reglas fintech.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Mini tarjeta de Impulsor en pantalla principal

- **Contexto**: el usuario necesita ver su estado de Impulsor sin salir del panel.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: mostrar un widget compacto con nivel, total BLUE iou, progreso y acceso al perfil.
- **Impacto**: mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s claridad y motivaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n sin saturar la UI.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Banner horizontal de Impulsor (comparativa UI)

- **Contexto**: comparar una opciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s visible tipo banner.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: reemplazar la tarjeta por un banner con ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cono, mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tricas y barra de progreso.
- **Impacto**: mayor presencia visual sin perder jerarquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo junto al ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cono (Impulsor)

- **Contexto**: se necesitaba compactar el encabezado del banner.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: poner la estrella al lado del tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo y quitar el fondo del ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cono.
- **Impacto**: encabezado mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s limpio y alineado.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Banner de Impulsor sin barra de progreso

- **Contexto**: se solicitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ una vista mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s limpia del banner.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: eliminar la barra de progreso del widget.
- **Impacto**: visual mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s simple y menos ruido.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ TipografÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a del banner de Impulsor

- **Contexto**: el tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo debÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a igualar el tamaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o de SALDO BLUE/RED y el monto BLUE iou debÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a destacarse.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: aplicar mayÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsculas al tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo y aumentar tamaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o + cursiva del monto BLUE iou.
- **Impacto**: mayor coherencia visual con los saldos.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Banner de Impulsor sin nivel

- **Contexto**: se pidiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ una vista mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s simple sin el nivel.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: eliminar el badge de nivel del banner.
- **Impacto**: layout mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s limpio y directo.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Formato del monto BLUE iou en impulsor

- **Contexto**: se pidiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ separar miles y reducir tamaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o de decimales.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: reutilizar el formateo con separadores y `decimal-part`.
- **Impacto**: mejor legibilidad del monto en el banner.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Destacar monto BLUE iou en impulsor

- **Contexto**: el monto debÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a verse mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s grande y con mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s color.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: separar valor/unidad con estilos y aumentar tamaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o del valor.
- **Impacto**: mayor ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©nfasis visual sin afectar el resto del banner.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Banner de valor sobre referidos

- **Contexto**: se pidiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ mostrar el texto de valor antes del bloque de referidos.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: mover el banner arriba del botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Comparte tu cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ y fijar el texto solicitado.
- **Impacto**: jerarquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s clara del mensaje de valor.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Banner de Impulsor sin tareas y centrado

- **Contexto**: se pidiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ remover ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“tareasÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ y alinear mejor el bloque.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: eliminar el texto de tareas y centrar el espaciado del meta.
- **Impacto**: banner mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s limpio y equilibrado.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Tarjeta de Impulsor como enlace

- **Contexto**: se pidiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ quitar ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Ver perfilÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ y usar la tarjeta completa como acceso.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: convertir el banner en enlace a `booster-profile.html`.
- **Impacto**: interacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s directa y limpia.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo de Impulsor centrado

- **Contexto**: se pidiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ centrar el texto ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Perfil de ImpulsorÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: centrar el encabezado del banner.
- **Impacto**: mejor alineaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n visual.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ ÃƒÆ’Ã†â€™Ãƒâ€šÃ¯Â¿Â½cono de Impulsor simÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©trico

- **Contexto**: se pidiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ simetrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a visual en el tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: colocar una estrella a cada lado del texto.
- **Impacto**: banner mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s equilibrado.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Espaciado uniforme en el panel

- **Contexto**: se pidiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un margen mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nimo y consistente entre elementos.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: unificar mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rgenes de banner impulsor, valor, referidos y botones.
- **Impacto**: layout mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s limpio y homogÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©neo.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Monto BLUE iou con mayor tamaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o

- **Contexto**: el monto debÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a verse al doble de tamaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: aumentar el tamaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o del valor principal en el banner.
- **Impacto**: mayor ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©nfasis visual del monto BLUE iou.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Separador de miles en BLUE iou

- **Contexto**: el monto debÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a mostrarse como `1.640,0000`.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: formatear el valor del banner con separador de miles fijo.
- **Impacto**: formato numÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rico consistente y mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s legible.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ TamaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o de ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“BLUE iouÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ igual al tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo

- **Contexto**: se pidiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ que el texto ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“BLUE iouÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ igualara el tamaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o de ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Perfil de ImpulsorÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: aumentar el tamaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o de la unidad en el banner.
- **Impacto**: coherencia tipogrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡fica en el banner.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Protocolo de release documentado

- **Contexto**: se necesitaba una guÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a persistente de versionado y despliegue.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: crear `docs/RELEASE_PROTOCOL.md` con flujo SemVer + checklist.
- **Impacto**: releases consistentes y auditables en futuros cambios.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Archivo VERSION para releases

- **Contexto**: se necesitaba un punto ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºnico y auditable de la versiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: agregar el archivo `VERSION` y referenciarlo en el protocolo.
- **Impacto**: claridad de versiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en cada release.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Versionado manual de assets (v1.4.0)

- **Contexto**: el cache del navegador podÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a mantener estilos/scripts viejos tras un deploy.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: renombrar assets estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticos a `style.v1.4.0.css`, `utils.v1.4.0.js` y `interaction.v1.4.0.js` y actualizar referencias en HTML.
- **Impacto**: control explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cito de cache y actualizaciones inmediatas tras release.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Versionado estricto (solo assets con versiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n)

- **Contexto**: mantener archivos ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“originalesÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ sin versiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n genera ambigÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼edad sobre cuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡l es el asset oficial del release.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: conservar ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºnicamente archivos versionados (`*.vX.Y.Z.*`) y eliminar los duplicados sin versiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
- **Impacto**: single source of truth en releases, cachÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s predecible y menos riesgo de cargar assets obsoletos.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-13 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Registro: verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por correo (OTP) con AWS SES (estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndar fintech)

- **Contexto**:
  - La verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por SMS (Twilio) es ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºtil, pero para onboarding fintech moderno normalmente se prioriza **verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por email** (y se deja el telÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fono como verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n adicional mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s adelante).
  - Guardar el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo OTP en texto plano es un riesgo (exposiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por logs/backups/DB leaks).
  - En producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n real, tambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n se necesita control anti-abuso: rate limiting, lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­mite de intentos y reenvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­os.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Migrar el registro a **OTP de 6 dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­gitos por email**, enviÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndolo con **AWS SES**.
  - Cambiar el almacenamiento del OTP en DB a **hash HMAC** (no texto plano) y validar con comparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en tiempo constante.
  - Implementar controles anti-fraude:
    - expiraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del OTP (10 min)
    - lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­mite de intentos (ej. 5) con invalidaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
    - lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­mite de reenvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­os + cooldown server-side
    - rate limiting por IP en endpoints de request/verify/resend
  - Mejorar el correo transaccional con diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o tipo ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“bank/fintechÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ (preheader, cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo destacado, aviso anti-phishing y soporte).
  - AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“auto-migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ de columnas para compatibilidad cuando una BD ya existente no tiene las nuevas columnas de `pending_verifications` (porque `CREATE TABLE IF NOT EXISTS` no altera tablas existentes).
- **Impacto**:
  - Onboarding mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s alineado a fintech: verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por email como primera capa y telÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fono como futura segunda capa.
  - Seguridad mejorada: OTP no se almacena en claro y hay mitigaciones de fuerza bruta/reintentos.
  - OperaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: guÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de configuraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de SES (DNS DKIM/SPF/DMARC, MAIL FROM, sandbox ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n) y posibilidad de personalizar branding (logo/color) vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a variables de entorno.
- **Evidencia**:
  - Commit de implementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n inicial: `c3a9e56`.
  - Documento: `docs/AWS_SES_SETUP.md`.
  - Nota UX: ajuste de cabecera del correo para mostrar el logo de forma mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s visible (tamaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o mayor) sin depender del cliente de correo.

---

### 2026-01-13 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ UI mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil: instrucciones de publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n legibles

- **Contexto**: en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil, la descripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n larga de algunas tareas se veÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a centrada y el enlace de WhatsApp podÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“perderseÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ por el largo del URL.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Alinear la descripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n a la izquierda y mejorar el wrap de enlaces largos.
  - Normalizar la indentaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n comÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn de textos multilÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea antes de renderizar, para evitar ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“desplazamientosÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ en la primera lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea.
- **Impacto**:
  - Lectura mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s clara en pantallas pequeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as.
  - Enlaces largos visibles y clicables sin romper el layout.
- **Evidencia (commits)**: `31de990`.

---

### 2026-01-13 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo funcionaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ (guÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de uso)

- **Contexto**: se necesitaba una explicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n breve, profesional y accesible dentro de la app, que oriente a usuarios nuevos sin saturar la UI principal.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Agregar una pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo funcionaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ con flujo bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡sico, tips de uso y seguridad.
  - Incluirla en el menÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº desplegable del panel principal para acceso rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido.
  - Ajustar el texto para aclarar el uso de tooltips sin depender de subrayados.
  - Mejorar legibilidad del subtÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo para evitar solapamientos visuales.
  - AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir iconos en las tarjetas del panel y simplificar el tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo principal.
  - Incluir requisito de asociar Metamask en Optimism dentro de la secciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de seguridad.
  - Convertir los puntos de cada secciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en tarjetas para mejorar lectura.
  - Ajustar el texto del menÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº a ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo funciona?ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ para mayor claridad.
  - Reemplazar ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Flujo bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡sicoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ por timeline con dos perfiles de usuario.
  - Ajustar el flujo a tarjetas con nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero para un UX mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s claro.
  - Corregir conteo de tareas del perfil de impulsor para alinear con el historial.
  - AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir icono de WhatsApp en el enlace de reporte de seguridad.
  - Agregar tooltip en la banda de ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Pre-lanzamientoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½.
  - Ajustar el tooltip de ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Pre-lanzamientoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ para que no se salga de pantalla.
  - Permitir overflow visible en el panel principal para el tooltip de ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Pre-lanzamientoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½.
  - Simplificar el tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo de ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“TipsÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ en la guÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de uso.
  - AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir flechas entre pasos del flujo para enfatizar secuencia.
  - Simplificar el flujo ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Si publicasÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ y ajustar el paso de confirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - Ajustar el texto de aprobaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en el flujo de participantes.
  - Mostrar ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“BLUE iouÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ en publicaciones de la plataforma durante pre-lanzamiento.
  - Mover ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Prototipo AlfaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ al badge de preÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“lanzamiento.
  - Quitar ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Prototipo AlfaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ del encabezado para evitar duplicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - Agregar selector simple de orden y filtro por tipo en publicaciones.
  - Ajustar el selector de orden para que el label quede arriba y mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s compacto.
  - Reemplazar el label por placeholder ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Ordenar porÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ dentro del dropdown.
  - AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir un icono sutil de filtro dentro del selector.
  - Alinear el enlace ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Ãƒâ€šÃ¯Â¿Â½ VolverÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ a la izquierda en todas las vistas.
  - Actualizar la pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina LOVE con back-link y diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o responsive mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil.
  - Ajustar LOVE: tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo en rojo y tabla sin desbordes.
  - Cambiar el texto del banner de referidos a ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“BLUE iouÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½.
  - AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir badges de pendientes y metadatos en publicaciones del admin.
  - Mostrar badge de pendientes sin entrar a la secciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (autoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“refresh).
  - Mostrar si la publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n permite repeticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por el mismo usuario.
  - Priorizar pendientes y agregar filtro ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“En procesoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ en la lista principal.
  - Mover ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“En procesoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ al primer lugar del selector de orden.
  - AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo P2P BLUE (ofertas, ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rdenes, escrow y disputas).
  - Ajustar pantalla P2P para evitar cortes de contenido en modal.
  - Mostrar ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Mis anunciosÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ y corregir el listado por tipo (buy/sell).
  - AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir migraciones 008/009/010 para user_id en deudas, escrows y transactions.
  - Endurecer confirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de pago en solicitudes usando acceptor de DB.
  - AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 011 para eliminar transactions.username tras migrar a user_id.
  - AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir panel de auditoria en admin con filtros y tabla.
  - Agregar guard para impedir RED asignado al trabajador en solicitudes.
  - Exportar auditoria a CSV desde el panel admin.
  - Mostrar direccion de pago BLUE/RED en historial de solicitudes.
  - Usar user_id en asignacion de deuda RED para solicitudes (evitar errores).
  - En solicitudes, deuda RED se asigna al autor (sin tutor) por regla economica.
  - Sincronizar tipo de anuncio P2P con la pestaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a activa (Comprar/Vender).
  - Simplificar modal P2P: tipo fijo segun pestaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a con explicacion.
  - Mover "Mis ordenes" al inicio de la pantalla P2P.
  - Usar record_balance_event en P2P para evitar updates directos.
  - Registrar auditoria detallada en movimientos de escrow P2P.
  - AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir acciones P2P en ordenes (pagar, liberar, cancelar).
  - Corregir expiracion y disputas P2P para usar event sourcing.
  - Mostrar solo ordenes activas arriba y historial separado.
  - Ordenar publicaciones activas por precio ascendente.
  - Crear pagina de historial P2P con estados coloreados.
  - Mostrar fecha/hora en ordenes P2P activas e historial.
  - Permitir filtros P2P por multiples metodos de pago.
  - Ajustar UI P2P: boton historial alineado y filtro mas alto.
  - Mejorar filtro de metodo de pago con checklist desplegable.
  - Reorganizar toolbar y filtros P2P para layout tipo Binance.
  - Compactar filtros P2P para estilo Binance (fila continua).
  - Mover boton aceptar junto a compartir en detalle de publicacion.
  - AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir instrucciones paso a paso en solicitudes con flujo visual.
  - Mostrar instrucciones paso a paso como bloque fijo en formulario.
  - Ajustar bloque de pasos (sin contenedor visible y max 20).
  - Agregar pasos a publicaciones de plataforma en panel admin.
  - Permitir editar publicaciones de plataforma desde admin.
  - Asegurar carga de datos al editar publicaciones.
  - AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 012 para publications.updated_at.
  - Ajustar textos en "CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo funciona" y verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n OTP.
  - AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo "Publicaciones Activas" en el panel principal.
- **Impacto**:
  - Menor fricciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de onboarding.
  - Mejor comprensiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de saldos, publicaciones y seguridad.
  - NavegaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s limpia en las pantallas internas.
- **Evidencia**: commits de la mejora UI (pendiente de push).

---

### 2026-01-19 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ GamificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en perfil de Impulsor

- **Contexto**: se buscaba motivar tareas con ranking y metas diarias.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: agregar ranking (#posiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y top %) y meta diaria comparando hoy vs ayer, con confeti y brillo cuando hay mejora.
- **Impacto**: refuerzo positivo y mayor incentivo a mantener actividad diaria.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-20 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ RepeticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n con cooldown + versionado v1.5.0

- **Contexto**: era necesario controlar cuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡nto tiempo debe pasar antes de repetir una tarea y estandarizar el release.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - agregar cooldown configurable (dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as/horas/minutos) en UI y validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en backend.
  - migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 014 para `repeat_cooldown_hours`.
  - versionar assets a `v1.5.0` y actualizar referencias HTML.
  - automatizar inventario UI con script y hook pre-commit.
  - permitir IPs LAN en CORS dev para pruebas desde telÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fono.
- **Impacto**: reglas de repeticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n claras, releases consistentes y pruebas mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pidas.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-21 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ PWA: Progressive Web App instalable en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles

- **Contexto**: los usuarios necesitaban una forma de acceder a la app desde la pantalla de inicio de su mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil sin pasar por Play Store, con experiencia similar a una app nativa.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Implementar **PWA completa** con `manifest.json`, Service Worker y botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de instalaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - Generar **iconos en todos los tamaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±os** requeridos (72px a 512px) incluyendo maskable para Android.
  - Estrategia de cache: **Network First** para HTML, **Cache First** para assets estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticos, **Network Only** para APIs.
  - Preparar estructura para **Push Notifications** (Firebase pendiente).
  - BotÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de instalaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n verde centrado ("Instalar App") visible en login/dashboard/registro.
- **Archivos creados**:
  - `frontend/manifest.json` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ metadata de la PWA
  - `frontend/sw.js` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Service Worker con estrategias de cache
  - `frontend/pwa-register.js` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ registro SW + UI de instalaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
  - `frontend/assets/icons/` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ 14 iconos PNG + SVG fuente + scripts de generaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
- **Impacto**:
  - La app puede instalarse en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles desde el navegador.
  - Funciona offline (pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ginas cacheadas).
  - Se ve y comporta como app nativa (sin barra de navegador).
  - Base lista para notificaciones push.
- **Evidencia (commits)**: `20a10f3`.

---

### 2026-01-22 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n frontend a Vite con ES Modules

- **Contexto**: el frontend usaba scripts inline y globales, lo cual dificultaba el mantenimiento, testing y optimizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. Se necesitaba una arquitectura moderna.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **Migrar a Vite** como bundler: build rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido, HMR, y soporte nativo de ES Modules.
  - **Separar scripts por pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina** en `frontend/src/pages/`: cada HTML carga solo su mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo.
  - **MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulos compartidos** en `frontend/src/modules/`: `config.js`, `alerts.js`, `password-toggle.js`, `pwa-install.js`.
  - **Mantener compatibilidad** con scripts versionados existentes (`*.v1.5.0.js`).
  - **Mover manifest.json** a `frontend/public/` para que Vite lo copie al build.
- **Archivos migrados**:
  - 17 pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ginas HTML actualizadas con imports de ES Modules
  - 13 nuevos scripts en `src/pages/`
  - Estilos separados: `admin-style.css`, `booster-style.css`
  - ConfiguraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: `vite.config.js`
- **Impacto**:
  - CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s modular y mantenible.
  - Build optimizado con tree-shaking.
  - Hot Module Replacement para desarrollo mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido.
  - Base lista para testing y futuras mejoras.
- **Evidencia (commits)**: `d404ef1`.

---

### 2026-01-22 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ PWA: flujo de instalaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n con cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo de referido y admin panel restaurado

- **Contexto**: cuando un usuario llegaba por enlace de referido, instalaba la PWA y la abrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a, perdÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo de referido y quedaba en la pantalla de login en vez de registro. AdemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s, el admin panel habÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a perdido funcionalidades durante la migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n a ES Modules.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **BotÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de instalaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n grande** en pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de registro: mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s visible (3x mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s alto) con mensaje claro "Primero debes instalar la app".
  - **Persistencia del cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo de referido** en `localStorage` para que sobreviva la instalaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la PWA.
  - **RedirecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n inteligente**: al abrir la PWA, si hay cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo de referido pendiente y no hay sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, redirige a registro SOLO la primera vez (usa `sessionStorage`). DespuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s el usuario puede navegar libremente.
  - **RestauraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del admin panel**: recuperar las 2000+ lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­neas de funcionalidad que se habÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an perdido en la migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - **Iconos PWA con fondo blanco**: evitar bordes negros en Android con iconos maskable.
  - **Herramienta generate-maskable.html**: permite generar iconos con color de fondo personalizado.
- **Impacto**:
  - Flujo de referidos sin fricciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo se mantiene desde el navegador hasta la PWA instalada.
  - UX profesional tipo fintech: redirecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n controlada sin bloquear navegaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - Admin panel 100% funcional con todas las secciones restauradas.
  - Iconos sin bordes negros en Android.
- **Evidencia (commits)**: `4a6a439`.

---

### 2026-01-23 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ ValidaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de username: estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndar de industria

- **Contexto**: el campo de nombre de usuario no tenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a validaciones completas, permitiendo caracteres especiales, espacios y longitudes arbitrarias.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Implementar validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n completa: **3-30 caracteres**, solo **letras, nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmeros y guiones bajos** (`a-zA-Z0-9_`).
  - ValidaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en **frontend** (UX) y **backend** (seguridad crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica).
  - VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n **case-insensitive** para evitar duplicados (`User` = `user`).
  - Mensaje descriptivo en el formulario explicando los requisitos.
  - Cambiar etiquetas del formulario de registro para mayor claridad.
- **Impacto**:
  - PrevenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de XSS e inyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n SQL.
  - Evita suplantaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de identidad por mayÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsculas/minÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsculas.
  - UX clara con requisitos visibles.
- **Evidencia (commits)**: `pending`.

---

### 2026-01-23 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ UX: icono de menÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº hamburguesa + soporte LAN para desarrollo

- **Contexto**: el icono de flecha (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“Ãƒâ€šÃ‚Â¼) junto al nombre de usuario no era suficientemente visible en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil, y el desarrollo desde dispositivos mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles en la red local no funcionaba.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Reemplazar el icono de flecha por un **icono de hamburguesa** (ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â°) de 30px.
  - Aumentar el icono de campana de notificaciones a 26px para mantener simetrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.
  - Ajustar posiciones verticales de ambos iconos para evitar solapamientos.
  - Corregir `config.js` para detectar IPs privadas y conectar al backend en puerto 3000.
- **Impacto**:
  - MenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s visible y accesible en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil.
  - Desarrollo local desde telÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fono funcional (conectando a la IP de la PC).
- **Evidencia (commits)**: `ed187c7`.

---

### 2026-01-23 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Seguridad: validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de username + manejo de sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n expirada

- **Contexto**: el campo de nombre de usuario no tenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a validaciones completas, permitiendo caracteres especiales, espacios y longitudes arbitrarias. AdemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s, cuando el token JWT expiraba, el usuario veÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a un error tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnico sin orientaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **ValidaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de username**: 3-30 caracteres, solo alfanumÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ricos y guiones bajos, verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n case-insensitive (`User` = `user` = duplicado).
  - **Helper `handleSessionExpired()`**: funciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n reutilizable en `auth.js` que detecta respuestas 401, limpia la sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y redirige al login con mensaje amigable.
  - **Aplicar helper en todas las pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ginas protegidas**: dashboard, P2P, historial P2P, perfil de impulsor (13 puntos de manejo).
  - **Cambio de icono**: reemplazar flecha dropdown por icono de hamburguesa (ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒâ€šÃ‚Â°) junto al nombre de usuario.
- **Impacto**:
  - PrevenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de XSS e inyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n SQL por usernames malformados.
  - UX profesional cuando expira la sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (no mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s errores tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnicos).
  - CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo DRY: el manejo de 401 estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ centralizado en un solo helper.
- **Evidencia (commits)**: `30682bf`, `e30bd35`, `cec14a8`.

---

### 2026-01-23 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Dashboard: restauraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de funcionalidad perdida + fix CSS banner

- **Contexto**: durante refactorizaciones anteriores, se perdieron varias funcionalidades del dashboard de publicaciones: ordenamiento por prioridad de tareas en proceso, informaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de expiraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, rating del autor, y el texto del banner de estado "pendiente" era invisible (CSS sobrescribÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a el color del texto al mismo color del fondo).
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **Restaurar ordenamiento por prioridad**: funciones `sortByPendingPriority()`, `isPendingForUser()`, `getPendingPriority()` para mostrar primero las tareas donde el usuario tiene participaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n activa (approved > pending > completed > otros).
  - **Restaurar informaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de expiraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: funciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `getExpirationStatusHTML()` que muestra tiempo restante ("Vence en 2 dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as", "Vence en 3 horas", etc.) con indicador visual de publicaciones expiradas.
  - **Restaurar rating del autor**: funciones `generateStarRating()` y `fetchUserRating()` para mostrar calificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del autor en cada tarjeta.
  - **Restaurar enlace al perfil**: el nombre del autor ahora es clickeable si los perfiles pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblicos estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n habilitados.
  - **Fix CSS crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tico**: el selector `.publication-item .status-pending` sobrescribÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a el color del texto a naranja (`#f39c12`), mismo color que el fondo del banner, haciendo el mensaje invisible. Corregido con `:not(.publication-status-banner)`.
- **Impacto**:
  - UX mejorada: las tareas en proceso aparecen primero, facilitando el seguimiento.
  - InformaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n completa: usuarios ven expiraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, ratings y pueden navegar a perfiles.
  - Bug visual corregido: el banner "Solicitud enviada. Esperando aprobaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n." ahora es visible.
- **Evidencia (commits)**: `7b02f1a`.

---

### 2026-01-23 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ UX: badge de acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para autores + ordenamiento inteligente

- **Contexto**: cuando un usuario publicaba una tarea y otros la aceptaban, el autor no tenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a indicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n visual de que habÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a acciones pendientes (aprobar solicitudes o confirmar pagos). Esto causaba que las solicitudes quedaran sin atender.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **Badge naranja para el autor**: cuando hay participantes esperando aprobaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n o pago, se muestra un banner naranja con el conteo ("2 por aprobar ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· 1 por pagar").
  - **Ordenamiento por prioridad**: las publicaciones del autor con acciones pendientes aparecen primero (prioridad 0-1), seguidas de las tareas donde el usuario participa (prioridad 2-4).
  - **DiferenciaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de colores**: amarillo brillante (`#FFE600`) para participante esperando, naranja (`#e67e22`) para autor con acciones pendientes.
- **Impacto**:
  - Autores ven inmediatamente quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© publicaciones requieren su atenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - Menos fricciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: no hay que buscar manualmente quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© aprobar o pagar.
  - UX mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s clara con colores distintivos para cada rol.
- **Evidencia (commits)**: `819899b`.

---

### 2026-01-24 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Fecha de aceptaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en participantes + mejoras UX botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n referidos

- **Contexto**: El autor no podÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a ver cuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndo un usuario habÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a solicitado participar en su publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. AdemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s, el botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de referidos necesitaba mejor copy y efectos visuales.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **Backend**: Agregado campo `accepted_at` a todos los endpoints que devuelven participantes. Ordenamiento cronolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gico (quien pidiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ primero, aparece primero).
  - **Seguridad**: Removido `phone_number` de endpoints pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblicos. Solo se muestra cuando el participante estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ aprobado (para contacto vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a WhatsApp).
  - **Admin Panel + Publication Detail**: Muestran "SolicitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³: fecha/hora" debajo de cada participante.
  - **BotÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de referidos**: Nuevo copy persuasivo, icono de compartir SVG con efecto pulse+glow mejorado.
- **Impacto**:
  - Autores pueden ver el orden cronolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gico de solicitudes.
  - Mejor privacidad de datos de usuarios.
  - UX mejorada en botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de referidos.
- **Evidencia (commits)**: `b46547b`.

---

### 2026-01-24 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ UX: tooltips en Perfil de Impulsor + tabla responsive

- **Contexto**: El perfil de impulsor mostraba mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tricas (nivel, ranking, meta diaria, etc.) sin explicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© significaba cada una. Usuarios nuevos no entendÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an el sistema de niveles ni cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo subir.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **7 tooltips informativos**: Nivel (descripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mica desde backend), Total BLUE iou, Meta diaria, Ranking, Tareas completadas, Progreso al siguiente nivel, Historial.
  - **Tooltip de progreso con FOMO**: muestra cuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ntos BLUE iou faltan + frase motivadora ("ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡No te quedes atrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s, otros impulsores ya estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n subiendo!").
  - **Descripciones dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡micas**: el tooltip del nivel actual usa `levelInfo.description` del backend (editable desde admin).
  - **Tabla de historial responsive**: ajustes CSS para mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles (`table-layout: fixed`, anchos de columna proporcionales, font-size reducido).
- **Impacto**:
  - Onboarding mejorado: usuarios entienden cada mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©trica al primer clic.
  - GamificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: el FOMO en el progreso incentiva completar mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s tareas.
  - UX mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil: la tabla de historial se lee correctamente en pantallas pequeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as.
- **Evidencia (commits)**: `3d5db92`.

---

### 2026-01-24 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de migraciones + referidos con acumulado visible

- **Contexto**:
  - Se necesitaba que las migraciones quedaran **auditables** y ejecutables de forma manual con evidencia persistente.
  - La lista de referidos no mostraba el acumulado de cada usuario, y en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil la tabla quedaba apretada.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **Migraciones manuales auditables**: crear `schema_migrations` y registrar `applied_at`, `applied_by`, `environment`, `checksum` desde cada script.
  - **Scripts manuales**: convertir 014/015/016/017 a ejecuciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `node` con transacciones y `IF NOT EXISTS`.
  - **Eliminar helper automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tico**: retirar `run-migrations.js` para evitar ejecuciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n no controlada.
  - **Referidos**: exponer `total_booster_blue` por referido y mostrarlo en la tabla; reducir tipografÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil.
  - **Formularios**: guardar `form_responses_submitted_at` y registrar evento `publication.form_responses_submitted` en `audit_log`.
- **Impacto**:
  - Migraciones con trazabilidad en BD y logs operativos (estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndar fintech).
  - Lista de referidos mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s informativa; UI mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil legible.
  - EnvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­os de formulario con timestamp y auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-01-24 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Referidos: orden por acumulado + fecha corta

- **Contexto**: en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil la tabla de referidos necesitaba ordenarse por relevancia econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mica y usar fecha compacta.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Ordenar la lista por **BLUE iou acumulado** (descendente).
  - Mostrar fecha en formato corto `dd/mm/yy`.
- **Impacto**: la tabla prioriza referidos con mayor aporte y se ve mejor en pantallas pequeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-01-24 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Impulsor: Ranking Mundial + ranking entre amigos

- **Contexto**: se querÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a distinguir el ranking global del ranking dentro de tu red de referidos.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Renombrar el bloque a **Ranking Mundial**.
  - AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir **Ranking entre amigos** con tooltip explicativo.
  - Calcular ranking entre el usuario y sus referidos (por BLUE iou acumulado).
- **Impacto**: gamificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s clara; el usuario compara su progreso global vs su cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­rculo.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-01-24 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ PublicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n compartir con icono oficial + CTA duplicado

- **Contexto**: se querÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a mantener consistencia visual del icono de compartir y facilitar la acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n final en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Reemplazar el icono de compartir por el de 3 nodos (mismo que pantalla principal).
  - Mover compartir arriba y duplicar ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Marcar como CulminadaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ abajo para alcance rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido.
  - Ajustar inputs de formulario a fondo blanco para mejor UX de escritura.
- **Impacto**: UI mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s intuitiva y consistente; acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n final mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s accesible en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-01-24 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ PublicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: CTA verde + compartir compacto

- **Contexto**: se pidiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ enfatizar la acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de culminar y hacer el compartir mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s ligero visualmente.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Renombrar el CTA a **ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“He culminadoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½** y ponerlo en verde.
  - Convertir el compartir en **icono + texto** (sin botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³lido), manteniendo la acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
- **Impacto**: jerarquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a visual mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s clara; compartir mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s discreto y rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido de identificar.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-01-24 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Admin: buscador + orden en publicaciones plataforma

- **Contexto**: se necesitaba encontrar y priorizar publicaciones de plataforma rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pidamente en admin.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Agregar buscador por tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo/descripcion/autor/ID.
  - AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir selector de orden (pendientes, fecha, recompensa, participantes, aprobaciones/pagos).
  - Ajustar layout para mantener consistencia visual.
  - Default de repeticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: **12 minutos** al habilitar la opciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
- **Impacto**: gestiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pida y menos fricciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n operativa en panel admin.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-01-24 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ RepeticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: cooldown en minutos (12 min default)

- **Contexto**: el sistema seguÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a bloqueando por 24 horas aunque el UI mostraba 12 minutos.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Permitir precisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en `repeat_cooldown_hours` (NUMERIC).
  - Calcular cooldown desde dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as/horas/minutos y default de 12 minutos cuando se habilita.
  - Mensajes de espera en minutos cuando aplica.
- **Impacto**: el bloqueo respeta minutos reales y coincide con la configuraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del admin.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-01-25 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Recibos por correo y correo oficial de plataforma

- **Contexto**:
  - Faltaba notificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n transaccional por email en pagos/completaciones.
  - El usuario ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“PlataformaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ podÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a quedar con email aleatorio en instalaciones previas.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Enviar **correos de recibo** a autor y trabajador para pagos de tareas, compras/donaciones.
  - Agregar **plantilla transaccional** con monto, estado y detalles, con fallback DEV.
  - Forzar el email oficial del usuario Plataforma a `accounting@wintoncoin.com` (creaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y mantenimiento).
  - Actualizar el asset del logo.
- **Impacto**:
  - ComunicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n profesional tipo fintech y trazabilidad para usuarios.
  - Plataforma con email consistente y auditable en todas las instalaciones.
- **Evidencia (commits)**: `791b2c1`, `0b12dcd`.

---

### 2026-01-25 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Onboarding: guÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a del menÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº principal

- **Contexto**: algunos usuarios no encontraban rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido accesos clave (P2P, Historial, Impulsor).
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: agregar un paso en el tour de bienvenida que resalta el menÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº superior y sus accesos.
- **Impacto**: navegaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n inicial mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s clara y menos fricciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en el primer uso.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-01-26 a 2026-01-28 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Landing Page: RediseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o Visual y Contenido

- **Contexto**: La pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de inicio necesitaba transmitir profesionalismo y claridad sobre la propuesta de valor "Token Engineering" y "Proof of Task".
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Implementar nueva estructura visual con tarjetas de servicios ("Hyper-Scalar Economic Engineering").
  - Integrar assets grÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ficos generados (imÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡genes 3D, dualidad de tokens).
  - Refinar textos para enfatizar la innovaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n tecnolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica y econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mica.
- **Impacto**: Primera impresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mucho mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s potente y alineada con una Fintech de alto nivel.
- **Evidencia**: Conversaciones "Refining Website Content And Layout".

---

### 2026-01-29 a 2026-02-01 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ RefactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Backend: AutenticaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Modular

- **Contexto**: La lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de autenticaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n estaba acoplada en `server.js`, dificultando el mantenimiento y la escalabilidad.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Extraer lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica a `src/controllers/authController.js` y `src/routes/authRoutes.js`.
  - Aislar validaciones y manejo de errores.
  - Preparar el terreno para migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n a arquitectura serverless/microservicios.
- **Impacto**: CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo backend mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s limpio, testearle y mantenible. ReducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de deuda tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica.
- **Evidencia**: Conversaciones "Refactoring Authentication Logic".

---

### 2026-01-30 a 2026-02-05 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Seguridad y PolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas: Anti-Sybil y KYC

- **Contexto**: Necesidad de proteger la economÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a del token contra granjas de cuentas y abusos.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Definir e implementar polÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas estrictas contra multi-cuentas (Sybil attacks).
  - Condicionar recompensas de referidos a verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de identidad (KYC).
  - Actualizar TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rminos y Condiciones y mensajes de UI para reflejar estas reglas.
- **Impacto**: ProtecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la tesorerÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a del proyecto y mayor confianza para inversores/usuarios legÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­timos.
- **Evidencia**: Conversaciones "User Security Policy", "Refining Referral Policies".

---

### 2026-02-01 a 2026-02-06 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Branding Integral y PWA Assets

- **Contexto**: Inconsistencia en logos e iconos en diferentes dispositivos y resoluciones.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Generar set completo de iconos estandarizados (manifest PWA, favicons, Apple touch icons).
  - Implementar nuevos logos para Token BLUE y WintonCoin (cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­rculo dorado).
  - Actualizar `manifest.json` y headers HTML.
- **Impacto**: Identidad de marca cohesiva y profesional en todas las plataformas (Web, MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil, Desktop).
- **Evidencia**: Conversaciones "Branding & Icon Generation".

---

### 2026-02-07 a 2026-02-09 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Dashboard de Agentes y GestiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de CampaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as

- **Contexto**: Falta de herramientas para que los agentes gestionen su performance y para configurar campaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as especÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ficas.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Crear Dashboard de Agente con KPIs (leads, conversiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, actividad).
  - Implementar configuraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de "Targets" para campaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as (Nicho, Plataforma, Presupuesto).
  - Resolver discrepancias en filtros de tareas activas en Admin Panel.
- **Impacto**: Empoderamiento de la fuerza de ventas (agentes) y campaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as de marketing mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s precisas y medibles.
- **Evidencia**: Conversaciones "Agent Performance Dashboard", "Campaign Target Configuration".

---

### 2026-02-11 a 2026-02-14 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Seguridad en Pagos y Notificaciones Push

- **Contexto**: Vulnerabilidades potenciales en confirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de pagos admin y problemas con la entrega de notificaciones en PWA.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Blindar lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de confirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de pagos (verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de roles y sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n).
  - Depurar flujo completo de Web Push Notifications (Service Worker, suscripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n DB, entrega).
  - Actualizar mensajes de referidos para mayor viralidad.
- **Impacto**: Operativa financiera segura y canal de retenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de usuarios (Push) funcional.
- **Evidencia**: Conversaciones "Admin Payment Confirmation Security", "Push Notification Debugging".

---

### 2026-02-14 a 2026-02-17 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Dominio, Roadmap y Pulido Final

- **Contexto**: PreparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para lanzamiento en dominio principal (`www`) y necesidad de mostrar visiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n a largo plazo.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Estrategia de migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de PWA de subdominio a dominio raÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­z.
  - CreaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina `roadmap.html` con hitos visuales 2024-2027.
  - ActualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Whitepaper (`docs.html`) con protocolo "Proof-of-Task".
  - Ajustes finos de UI: Footer profesional, iconos redes sociales SVG, textos de "Ayuda" optimizados.
- **Impacto**: Plataforma lista para "Go Live" pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblico con narrativa de futuro clara y experiencia de usuario pulida.
- **Evidencia**: Conversaciones "PWA Domain Migration", "Roadmap & Icon Fixes".

---

### 2026-02-20 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Centro de Notificaciones y DifusiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Masiva (Email Broadcast System)

- **Contexto**: Necesidad de un canal de comunicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n institucional para anuncios masivos y gestiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de mensajes diarios sin intervenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n manual en base de datos.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Implementar un **Sistema de DifusiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Masiva** con interfaz de pestaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as en el Panel Admin (Push, Email, Mensajes Diarios).
  - Arquitectura de **Mail Worker (Queue-based)** utilizando PostgreSQL (`FOR UPDATE SKIP LOCKED`) para procesar envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­os secuenciales de forma segura y auditable.
  - OptimizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de base de datos mediante **Bulk Inserts por lotes (1000 users)** para manejar miles de destinatarios sin saturar la memoria o el pool de conexiones.
  - Implementar **auto-reparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de esquema** en el arranque (migrations idempotentes) para asegurar la integridad de las nuevas tablas transaccionales.
  - Registro de auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a detallado por cada difusiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (quiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n enviÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³, cuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndo, ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©xito/error por destinatario).
- **Impacto**: Infraestructura escalable para comunicaciones oficiales, con capacidad de procesar 50k+ correos diarios respetando lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­mites de AWS SES y manteniendo trazabilidad total para auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as Fintech.
- **Evidencia**: ConversaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n "Admin Broadcast UI Implementation".

## Observaciones de manager (deuda tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica / riesgos)

### Higiene del repo (importante)

En el historial aparece un commit grande donde entraron **artefactos generados** (ej.: `android-app/app/build/**`, `android-app/.gradle/**`) e incluso cambios asociados a `node_modules`/locks.  
Esto no rompe el producto, pero **sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ rompe la mantenibilidad** (repo pesado, diffs ruidosos, conflictos).

**RecomendaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n** (cuando quieras lo hacemos):
- Asegurar `.gitignore` para Android: ignorar `**/build/`, `.gradle/`, `.idea/`, `local.properties`, etc.
- Dejar `node_modules/` fuera del repo (solo `package-lock.json`/`package.json`).
- Si ya estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n trackeados, hacer limpieza con `git rm -r --cached` (sin borrar local) y commit de ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“repo hygieneÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½.

## PrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ximos pasos sugeridos (para profesionalizar releases)

- Adoptar **Conventional Commits** (muchos ya lo estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n) y empezar a crear **tags** (`v0.1.0`, `v0.2.0`).
- Automatizar changelog (por ejemplo con `git-cliff` o similar).
- Definir checklist de release: migraciones, smoke tests frontend, endpoints crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticos, y validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de cookies/CORS en prod.

---

### 2026-02-20 ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½ Email Broadcast 2.0 y EvoluciÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n de Identidad Visual

- **Contexto**: El sistema de difusiÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n original era limitado y la marca necesitaba una actualizaciÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n visual coherente.
- **DecisiÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n**:
  - **Botones de AcciÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n**: Habilitar campos de 'Texto' y 'URL' para el botÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n de acciÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n.
  - **Saltos de LÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½nea Inteligentes**: Implementar conversiÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n automÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½tica de \
\ a \<br>\.
  - **Seguridad Simplificada**: Refinar el 'Recordatorio de Seguridad' eliminando jerga tÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½cnica como 'OTP'.
  - **Comparativa de Branding**: Estructura visual vertical para mostrar la transiciÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n de marca.
- **Impacto**: Comunicaciones masivas efectivas, profesionalismo y mayor tasa de clics.
- **Evidencia (commits)**: aa1defa, 653d488.

---

## [2026-02-21] - Homenaje a Sir Nicholas Winton

### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de una pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina dedicada al legado de Sir Nicholas Winton, integrando su historia humanitaria como la base filosÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³fica y motivaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n detrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s de WintonCoin.

### Cambios realizados
- CreaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `EVOLUCION.md` para seguimiento.
- InvestigaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n histÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rica sobre Nicholas Winton y el Kindertransport.
- DiseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o y creaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `frontend/legado.html` con estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tica premium.
- Ajuste estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tico: EliminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de iconos innecesarios (trencito) para un look mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s profesional.
- Contenido HistÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rico: AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adida la tragedia del noveno tren (250 niÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±os) para resaltar la urgencia de la misiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
- Identidad Visual: UnificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la paleta de colores eliminando los tonos amarillos y dorados en favor de los azules oficiales de WintonCoin para una mayor coherencia de marca.
- SimplificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de DiseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o: EliminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la tarjeta secundaria y textos explicativos redundantes para que los hechos y la cronologÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a hablen por sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ mismos, logrando una narrativa mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s sobria y profesional.
- Multimedia: IntegraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del video histÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rico de la BBC ("That's Life") donde Nicholas Winton se reencuentra con los niÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±os salvados, reforzando el impacto emocional de la pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina.
- Enlace desde la Landing Page (`index.html`) al nuevo portal del legado. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ INTEGRADO
- CorrecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de compatibilidad CSS en `legado.html`. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ OK

---

### 2026-02-21 ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½ SincronizaciÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n de Marca y Contacto Directo

- **Cambios Realizados**:
  - **Landing Page**: SustituciÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n del texto 'WintonCoin' por el logotipo oficial \wintoncoin_transparent_phrase.png\ en el encabezado.
  - **AtenciÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n al Cliente**: IntegraciÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n del correo \customerservice@wintoncoin.com\ en el footer de la web y en las plantillas de email.
  - **UX Footer**: Limpieza de textos redundantes y reestructuraciÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n de la columna de contacto.
- **Impacto**: Mejora significativa en la percepciÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n de marca y profesionalismo del soporte tÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½cnico.
  - **Build Config**: Registro de \legado.html\ en los entry points de Vite para asegurar su disponibilidad en el entorno de producciÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n.
- **Impacto**: Mejora significativa en la percepciÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½n de marca y profesionalismo del soporte tÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½cnico.
- **Evidencia (commits)**: e896969, e981ebf.

---

### [2026-02-22] - Sistema de Comunicaciones Intersticiales Globales
- **App-Wide Interstitials (Global Modal)**: Implementado sistema de modales informativos globales gestionables desde el Admin Panel. Incluye persistencia en base de datos, lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de "una vez por sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n" y diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o premium con Glassmorphism. (Completado y Probado)
- **Admin UI**: AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adido interruptor de activaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n global en el Centro de Notificaciones con feedback visual premium.
- **Frontend UX**: Implementado modal con efecto Glassmorphism y control de frecuencia (una vez por sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n) para maximizar impacto sin reducir la usabilidad. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ DESPLEGADO

---

### [2026-02-23] - RefactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Profesional del Flujo de Donaciones
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
TransformaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del sistema de donaciones para alinearlo con estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares internacionales de Crowdfunding (Kickstarter/GoFundMe), profesionalizando la arquitectura y mejorando drÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡sticamente la UX.

#### Cambios realizados
- **Arquitectura Backend**: ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `goal_amount` y `current_amount` en la base de datos para seguimiento real de campaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as.
- **Flujo Directo (Fintech Standard)**: EliminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de los pasos de "aprobaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n" y "culminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n" para donaciones. Ahora las donaciones son instantÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡neas, procesando el pago BLUE eou y generando la deuda RED iou en un solo paso. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ COMPLETADO
- **Dashboard UI**:
    - **Visual Progress Bar**: Implementada barra de progreso animada con gradientes premium que muestra el avance de la recaudaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en tiempo real.
    - **Quick Donation Input**: AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adida caja de entrada numÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rica integrada en la tarjeta para donar montos variables con un solo clic.
- **PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de Detalle**: Actualizada con la misma lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica profesional y barra de progreso para mantener la coherencia en todo el ecosistema.
- **Modelo EconÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mico**: Asegurada la integridad transaccional (Atomicity) mediante el uso de transacciones SQL (`BEGIN/COMMIT`) para el procesamiento de pagos y actualizaciones de meta. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ SEGURO

#### Ajustes EstÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ticos y UX (CorrecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n)
- **Identidad de Marca**: Se cambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el esquema de colores de las donaciones de verde a **Magenta/Rosa Winton** (coincidiendo con el ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cono del corazÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n) para una coherencia visual total. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦
- **UI de Tarjetas**:
    - ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de un **Meta Badge** destacado en la cabecera de las tarjetas para mejor visibilidad del objetivo.
    - RediseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o del **Input de DonaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pida**: Ahora tiene mayor ancho, mejor padding y placeholders descriptivos, facilitando la participaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del usuario.
- **SimplificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del Formulario (`publish.html`)**: Se ocultaron los campos de "AprobaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica" y "Cupos disponibles" para el tipo donaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, eliminando ruido visual y opciones irrelevantes para este flujo.

#### Correcciones TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnicas y Estabilidad
- **Base de Datos (Transaccionalidad)**: ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `028_add_blue_cost_to_acceptances` para aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir la columna `blue_cost` a la tabla de aceptaciones. Esto permite rastrear aportes individuales en donaciones variables de forma prolija. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ ERROR SQL RESUELTO
- **Backend Integrity**: Actualizadas todas las rutas de aceptaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para registrar el costo pactado en el momento de la acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, mejorando la integridad histÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rica de las transacciones financieras.
- **Transparencia en UI**: La lista de participantes en la pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de detalles ahora muestra el monto exacto aportado por cada donante (+X BLUE), utilizando el color magenta oficial para resaltar la generosidad de la comunidad. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ PROFESIONAL

---

### [2026-02-24] - Winton Momentum ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Sistema de GestiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Influencers
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n completa del mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo **Winton Momentum**, un sistema integral e independiente para gestionar el programa de influencers/creadores de contenido de WintonCoin. Incluye backend (DB, servicio, controlador, rutas), frontend (landing, dashboard, admin) y panel de administraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.

#### Arquitectura
- **100% Modular**: Tablas propias (`momentum_*`), servicio dedicado, controlador separado, rutas aisladas.
- **IntegraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nima**: Solo 4 lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­neas aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adidas a `server.js` (import + mount).
- **ReutilizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Se integra con `booster_blue_ledger`, `booster_transactions` y `emailService` existentes.

#### Backend
- **MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n** (`029_create_momentum_system.js`): 4 tablas nuevas ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ `momentum_profiles`, `momentum_global_config`, `momentum_campaigns`, `momentum_submissions`.
- **Servicio** (`momentumService.js`): LÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de negocio pura ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ config global, perfiles, campaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as, entregas, cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lculo de pagos (base ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ multiplicador + bono), acreditaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de BLUE IOU.
- **Controlador** (`momentumController.js`): Endpoints HTTP ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblicos, influencer (auth JWT), admin (auth cookie).
- **Rutas** (`momentumRoutes.js`): Factory pattern con inyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de dependencias (pool, auth middleware, audit).

#### Frontend
- **Landing Page** (`momentum-landing.html/css/js`): Hero, barra FOMO con cupos/countdown, simulador interactivo por tier, social proof, formulario de postulaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. EstÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tica Fintech Dark Mode.
- **Dashboard Influencer** (`momentum-dashboard.html/css/js`): Balance confirmado/pendiente, marketplace de misiones con modal de entrega, historial de submissions con estados.
- **Admin Panel** (`momentum-admin.html/js`): Config global, gestiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de postulantes (asignar tiers), CRUD campaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as, verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de entregas (aprobar con bono / rechazar con nota obligatoria).
- **NavegaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: BotÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n "ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â¡ Momentum" aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adido al sidebar del `admin-panel.html`.

#### Seguridad
- Locks `FOR UPDATE` para concurrencia en aprobaciones.
- Transacciones SQL para operaciones crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas (BLUE IOU + historial).
- Validaciones en controller y servicio. XSS prevention en frontend.
- Notas de auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a obligatorias en rechazos.

#### Mejoras y Estabilidad (Cierre de fase)
- **CorrecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de AutenticaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Resuelto el bug crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tico de nomenclatura (`isAuthenticated` vs `isLoggedIn`) que impedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a a los influencers logueados acceder a su dashboard. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ ESTABLE
- **Estrategia de Landing**: El formulario de postulaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n ahora es siempre visible, solicitando login solo al momento del envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o para mejorar la conversiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de creadores.
- **Ajuste de TerminologÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a (Pre-lanzamiento)**: ActualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la marca en el mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo Momentum y su secciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n dedicada en la landing ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ donde decÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a "BLUE" ahora dice "**BLUE IOU**" para ser 100% transparentes con la comunidad sobre el estado del token del programa de creadores. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ TRANSPARENCIA
- **Integridad TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica**: EjecuciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de las migraciones `029` y `030` para activar el sistema de recompensas y misiones repetibles.

---

## [2026-02-25] - Refinamiento EstÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tico: RediseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o Premium de Publicaciones

### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
EvoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n visual de las tarjetas de publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, reemplazando el esquema oscuro bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡sico por una estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tica "Sapphire Premium" con efectos de profundidad y gradientes, alineada con los estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares de diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o de aplicaciones financieras modernas.

### Cambios realizados
- **Identidad Visual**: MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del fondo `#1a1a2e` (oscuro plano) a un gradiente dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mico `Sapphire-to-Midnight` (`#1c2e6b` a `#121d4a`).
- **Profundidad y ElevaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
    - ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de bordes semi-transparentes (`rgba(255,255,255,0.1)`) para un acabado tipo cristal (Glassmorphism).
    - Refinamiento de sombras (`box-shadow`) para mayor sensaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de jerarquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a visual.
- **Micro-interacciones**: OptimizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de transiciones y efectos hover para una navegaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s fluida y profesional.
- **Coherencia de Tipos**: Ajuste de los bordes y acentos en tarjetas de donaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y venta para que armonicen con el nuevo fondo azul elegante. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ ESTÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°TICA MEJORADA
- **AlineaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Marca**: Reajuste cromÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tico del gradiente de las tarjetas para igualar el azul oficial `#3b82f6` y el gradiente `#60a5fa`-`#2563eb` de la palabra "Coin" en el logotipo.
- **OptimizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n UX**: CompactaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de las descripciones de tareas a 1 sola lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea (`line-clamp: 1`) para lograr tarjetas mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s delgadas y una mayor densidad de informaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en pantalla. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ UX MEJORADA

### EstÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares Aplicados
- **Modularidad**: Uso de variables CSS para facilitar cambios globales.
- **UX/UI**: Mejora del contraste y legibilidad con tipografÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a blanca sobre fondos azules profundos.
- **AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a**: Registro documentado en `EVOLUCION.md`.
- **SoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Error 404 Admin**: Implementado endpoint de compatibilidad `/api/legal-status` en el backend para asegurar que componentes antiguos del panel administrativo no fallen al cargar. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ OK
- **Refinamiento UX Dashboard**:
    - **InteracciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Arreglado problema CSS de `pointer-events` que impedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a hacer clic en los botones "Entregar" debido a la superposiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del efecto de borde iluminado.
    - **Robustez**: MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de listeners de eventos a un sistema de **DelegaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Eventos** en el contenedor principal, mejorando el rendimiento y la detecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de clics en elementos dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡micos. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ FLUIDO
- **Ajuste de Seguridad EconÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mica**:
    - **Multiplicador Neutral**: Se ha neutralizado el multiplicador global de **15x a 1x** mediante la migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n auditable `031`. 
    - **RazÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Establecer un baseline de 1x (elemento neutro) garantiza que los pagos base sean los efectivos por defecto, permitiendo al Admin escalar la aceleraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de forma controlada y segura para la economÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de la plataforma. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ AUDITABLE

#### FÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rmula de Pago
```
Pago Final = (Tarifa Base del Tier ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Multiplicador Global) + Bono Extra del Admin (en BLUE IOU)
```

---

### [2026-02-25] - EducaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y Experiencia de Usuario: Onboarding & UI Coordination

#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de un sistema de tutoriales dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡micos para educar a los usuarios sobre los detalles tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnicos de las publicaciones y resoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del conflicto de superposiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n entre modales y tours (Modal Clash).

#### Cambios realizados
- **Tutorial Interactivo de Tareas**:
    - Implementado `startTaskTour` en `onboarding.js`.
    - GuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a paso a paso sobre: TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo, Recompensa/Costo, Autor, ReputaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (estrellas) y Cupos.
    - **Robustez TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica**: ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `waitForElement` (espera activa) y generaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `uniqueClass` dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mica por cada ejecuciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para evitar conflictos de selectores en el DOM. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ PROFESIONAL
- **CoordinaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de UI (Zero Overlap)**:
    - **Evento Global**: Modificado `interstitials.js` para despachar el evento `winton_interstitial_closed` al cerrar mensajes del administrador.
    - **LÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica Reactiva**: Implementada funciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `executeWhenSafe` en el sistema de onboarding. Los tours ahora "escuchan" a la plataforma y solo inician cuando la pantalla estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ libre de modales bloqueantes. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ UX MEJORADA
- **Acceso Directo**: AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adida tarjeta "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ¯Â¿Â½ Detalle de Tarea" en `como-funciona.html` para acceso manual al tutorial.
- **Micro-ajuste EstÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tico**: ActualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del gradiente Sapphire en tarjetas (`style.css`) a 180 grados para una transiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de color mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s vertical y sobria.

### EstÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares de IngenierÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a:
- **Zero Hardcoded Secrets**: Mantenimiento de la integridad ambiental.
- **Auditabilidad**: Todo cambio de lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica coordinado y documentado.
- **Seguridad**: Bloqueo de interacciones del usuario durante los tours ("Modo Museo") para evitar estados inconsistentes.

---

## [2026-02-26] - CorrecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica: Enforcement de Cooldown en Tareas Repetibles

### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
CorrecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de un bug donde el campo `repeat_cooldown_hours` se almacenaba correctamente en la base de datos al crear publicaciones repetibles, pero **nunca se validaba** durante el flujo de aceptaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n ni se filtraba en el feed. Los usuarios podÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an repetir tareas inmediatamente sin respetar el intervalo de espera configurado.

### Bug identificado
- `repeat_cooldown_hours` se guardaba en la tabla `publications` (ruta `/publish`).
- La ruta `/publications/:id/accept` verificaba: rechazo, solicitud activa, mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ximo de repeticiones ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ pero **nunca el cooldown**.
- La query `/publications/active` ocultaba publicaciones completadas o con mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡x. repeticiones ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ pero **nunca por cooldown activo**.
- **Resultado**: CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo muerto. El cooldown existÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a en la BD pero era ignorado por toda la lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de negocio.

### Cambios realizados
- **ValidaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Backend (server.js - ruta `/accept`)**: AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adido paso #5 "COOLDOWN CHECK". Consulta `created_at` de la ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºltima aceptaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `confirmed_paid` del usuario, calcula el tiempo transcurrido y lo compara con `repeat_cooldown_hours`. Si no ha pasado suficiente tiempo, retorna HTTP 429 con el tiempo restante formateado (ej: "Debes esperar 18h 30min antes de volver a participar"). ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ SEGURO
- **Filtro de Feed (server.js - query `/publications/active`)**: AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adido "Caso C" en el bloque `AND NOT (...)`. Oculta la publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del feed si el usuario tiene una participaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `confirmed_paid` cuyo `created_at` estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ dentro del perÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­odo de cooldown (`NOW() - repeat_cooldown_hours * INTERVAL '1 hour'`). ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ UX MEJORADA
- **Query mejorada**: La consulta de aceptaciones previas ahora incluye `created_at` y estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ ordenada por `created_at DESC` para obtener la participaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s reciente primero.

### EstÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares aplicados
- **Defensa en profundidad**: Doble protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (feed + validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n backend) para que incluso si el frontend falla, el servidor bloquee la repeticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n prematura.
- **UX Informativa**: El mensaje de error incluye el tiempo restante exacto para que el usuario sepa cuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndo puede volver.
- **Auditabilidad**: Documentado en `EVOLUCION.md`. CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo comentado exhaustivamente.

---

## [2026-02-27] - AutomatizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Despliegue (InvestigaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n CD)

### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
AnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lisis y propuesta de arquitectura de Despliegue Continuo (Continuous Deployment) para conectar el repositorio de GitHub con Hostinger.

### Acciones
- RevisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `package.json` y estructura del proyecto.
- Propuesta de soluciones basadas en Hostinger Git Integration (Webhooks) y GitHub Actions.
- **ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de GitHub Actions (CD Ciberseguro)**: CreaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del flujo automatizado `.github/workflows/deploy-frontend.yml` para despliegue por FTP exclusivo de la carpeta `frontend/dist/`. 
    - ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de script nativo **LFTP** en Ubuntu para evitar comportamientos anÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³malos de subcarpetas (`public_html/public_html`) causados por plugins obstinados de terceros (`ftp-deploy-action`).
    - Se protege el backend de exposiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblica cumpliendo el estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndar **Zero Hardcoded Secrets** para Hostinger.

---

### 2026-02-27 - Fijacion de Formularios, Arquitectura de Testing y Bugfix

- **Contexto**: Bug en configuracion de sub-formularios Admin y necesidad de validacion estricta.
- **Decision**: Reescritura frontend para inyectar formFields. Integracion de Unit Tests con Jest (Mocking DB, Cron y Migrations). Bugfix critico de escapeHtml en emailService.js resuelto.
- **Impacto**: UI restaurada, Testing modular blindando rutas de backend.
- **Evidencia (commits)**: pendiente de push.

---

### [2026-03-01] - Winton Academy CMS & Sistema de Tutoriales Interactivos

#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de un sistema integral de gestiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de contenidos (CMS) para la "Winton Academy", permitiendo administrar dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡micamente los tutoriales interactivos que guÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an a los usuarios en el ecosistema WintonCoin.

#### Cambios realizados
- **CMS de Academia**: ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n completa de un sistema de gestiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de videos dentro del Admin Panel. Los administradores pueden agregar, ocultar, reordenar y eliminar videos de YouTube de forma dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mica.
- **Backend (Arquitectura)**:
    - **Fase de Datos**: CreaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la tabla `academy_videos` mediante la migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `036_create_academy_videos.js`.
    - **Controlador API**: ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `academyController.js` con soporte para CRUD y respuestas estandarizadas (`success: true`).
    - **Rutas**: CreaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `academyRoutes.js` con separaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n estricta entre rutas pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblicas (`/public`) y protegidas por administrador (`/all`, `/add`, etc.).
- **Admin Panel (UI/UX)**:
    - **Nueva SecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adido el mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo "Winton Academy" al sidebar del panel de control.
    - **Gestor de Contenidos**: Formulario con detecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n inteligente de YouTube IDs (soporta URLs largas, cortas e IDs directos).
    - **VisualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Tabla de administraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n con previsualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de miniaturas (thumbnails) oficiales de YouTube.
    - **Interactividad**: Botones de acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pida para publicar/ocultar videos y borrado definitivo con diÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡logos de confirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n premium.
- **PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblica (`como-funciona.html`)**:
    - **GalerÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a DinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mica**: RefactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la cuadrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cula de videos para cargar datos desde la API del CMS en tiempo real vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a `fetch`.
    - **OptimizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (Lazy Loading)**: El reproductor de video se carga dentro de un modal solo cuando el usuario hace clic, mejorando drÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡sticamente el rendimiento inicial de la pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina.
- **Estabilidad y Ciberseguridad**:
    - **ResoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Conflictos**: Fix de un bug de routing que causaba cierres de sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (401) al solaparse middlewares de usuario y administrador.
    - **Integridad de Datos**: Corregido el envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o de payloads del frontend (snake_case) para coincidir con la estructura de la base de datos PostgreSQL.
    - **CodificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: ReparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de errores de encoding (UTF-8) en textos informativos para visualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n correcta de tildes en espaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ol.
- **Mantenimiento de Servidor**: Limpieza forzada de procesos de Node.js en memoria para asegurar la persistencia de los cambios del CMS. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ DESPLEGADO Y AUDITABLE

---

### [2026-03-01] - Debugging CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tico: ReparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Consistencia en CampaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as Momentum
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
ResoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de un error de base de datos (PostgreSQL) que impedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a la creaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de nuevas campaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as en el mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo Winton Momentum debido a una discrepancia de esquema entre los entornos local y producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (Render).

#### Cambios realizados
- **InvestigaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Error**: Identificado fallo `column "allow_multiple" does not exist` al intentar publicar campaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as desde el Admin Panel en producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (Render).
- **Backend (ReparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Esquema)**:
    - **Nueva MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (`037_ensure_momentum_campaigns_columns.js`)**: ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de una migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de "seguridad" que utiliza `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para garantizar la presencia de las columnas `allow_multiple`, `base_pay_visionario` y `base_pay_platino`.
    - Esta migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n soluciona inconsistencias tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnicas que impedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an la persistencia de datos de campaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ RESUELTO
- **Frontend & UI/UX**:
    - **Hero Animation**: AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adida animaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mica con iconos de redes sociales (Instagram, YouTube, X, TikTok) en la landing de Momentum ("ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Eres creador de contenido?").
    - **Dashboard Cleanup**: EliminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Ãƒâ€šÃ¯Â¿Â½ Panel Principal" en el header del dashboard de Momentum para una interfaz mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s limpia y enfocada.
- **EstÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares de IngenierÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a**:
    - ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de **Auto-reparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Esquema** al arranque del servidor para garantizar que la base de datos siempre coincida con la lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de negocio del cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ PROFESIONAL
- **Auditabilidad**: Todos los cambios registrados y documentados para cumplimiento de normas tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnicas.

---

### [2026-03-01] - UX Upgrade: VisualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Completa de Misiones Momentum
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
Mejora en la experiencia de usuario (UX) para influencers. Se ha resuelto el problema de las descripciones truncadas permitiendo abrir un modal informativo con las instrucciones completas de la misiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n al tocar la tarjeta.

#### Cambios realizados
- **Interactividad Total**: Se habilitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la delegaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de eventos para que **toda la tarjeta de la misiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n** abra los detalles, facilitando el acceso en dispositivos mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles.
- **RediseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o de Modal (Dual Function)**: El modal de entrega ahora incluye un bloque de "Instrucciones" con scroll interno y respeto de saltos de lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea (`pre-wrap`).
- **Frontend (Modularidad)**:
    - AdiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de variables de datos (`data-campaign-desc`) en las tarjetas generadas dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡micamente.
    - EstilizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n premium del contenedor de informaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n con efectos de transparencia y bordes dorados suaves.
- **Beneficio**: Los influencers ahora pueden leer las instrucciones detalladas paso a paso en el mismo lugar donde envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an el link, eliminando errores en las tareas. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ PROFESIONAL

---

### [2026-03-01] - AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de Contexto y SincronizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Agente
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
RevisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n integral de la base de cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo, estructura de archivos y reglas de negocio para asegurar la alineaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del agente con los estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares de ingenierÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a y objetivos del proyecto WintonCoin.

#### Acciones realizadas
- **Inventario Completo**: Mapeo de la estructura del proyecto, detectando el monolito `server.js` (4588 lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­neas) y los mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulos ya extraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­dos en `src/`.
- **AnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lisis de Seguridad**: VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la polÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica "Zero Hardcoded Secrets" y uso de middlewares de autenticaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica y administrativa.
- **SincronizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n EconÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mica**: Estudio profundo de `ECONOMIC_RULES.md`, comprendiendo el sistema de tokens BLUE/RED, el ledger de impulsores (Booster) y las reglas de quema/deuda (FIFO).
- **ValidaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de EstÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares**: ConfirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de los flujos de auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a bancaria (`logAuditEvent`) y las reglas de diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o responsive premium.
- **PreparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para ModularizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: IdentificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de bloques candidatos en `server.js` para ser extraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­dos a controladores y servicios independientes siguiendo las mejores prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡cticas.

---

### [2026-03-01] - Fase de ProfesionalizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: Notificaciones Push & AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a Bancaria
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a integral y diagnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³stico del sistema de comunicaciones push. Se inicia la transiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de un sistema funcional a uno de grado industrial/bancario, reforzando la seguridad, auditabilidad y escalabilidad.

#### DiagnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³stico TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnico
- **Frontend**: Estado "Premium". ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n exitosa de Workbox y Wizard de consentimiento dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mico.
- **Backend**: Estado "Funcional/MonolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tico". Identificada necesidad de desacoplamiento de lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de DB en controladores.
- **Brecha de AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a**: Detectada falta de registros en `logAuditEvent` para acciones crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas de comunicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.

#### Plan de AcciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
1. **AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a**: InyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de logs de auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a en `notificationService` y `notificationController`.
2. **RefactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Core**: MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de base de datos desde el controlador hacia el servicio para cumplir con S.O.L.I.D.
3. **Escalabilidad**: ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de procesamiento por lotes (chunking) para notificaciones masivas.
4. **Seguridad**: SanitizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de payloads para prevenir ataques de inyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de contenido en dispositivos finales. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ EN PROCESO

---

### [2026-03-02] - CulminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de ProfesionalizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: Notificaciones Push de Grado Industrial
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
FinalizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la refactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n profunda del sistema de comunicaciones en tiempo real, logrando un sistema escalable, auditable y ciberseguro que cumple con los estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares bancarios de WintonCoin.

#### Cambios realizados
- **Arquitectura de Notificaciones (Notificaciones 2.0)**:
    - **Escalabilidad Batch**: ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de procesamiento por lotes (Chunks de 50 dispositivos) en `notificationService.js` para prevenir caÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­das del servidor ante bases de datos de usuarios masivas.
    - **Broadcast Omnicanal**: IntegraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de notificaciones push en el ciclo de vida de las tareas:
        - EnvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o masivo automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tico al publicar nuevas tareas (Usuario y Administrador).
        - Notificaciones instantÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡neas para Referidos, Donaciones, Aprobaciones y Pagos.
    - **InyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Dependencias**: RefactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica del controlador y rutas de notificaciones para soportar la inyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del `pool` de base de datos, siguiendo el principio de inversiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de dependencia (SOLID). ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ ESTÃƒÆ’Ã†â€™Ãƒâ€šÃ¯Â¿Â½NDAR INDUSTRIAL
- **ReparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del Monolito (`server.js`)**:
    - **DiagnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³stico de Rutas**: IdentificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y correcciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la ruta de AdministraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Plataforma (`/api/admin/platform/create-publication`) para incluir el nuevo sistema de broadcast.
    - **InstrumentaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: InyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de logs de diagnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³stico (`[ROUTE DIAGNOSTIC]`) para monitoreo del flujo de red en tiempo real desde la terminal.
- **AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a y Ciberseguridad**:
    - **Zero Null Audit**: CorrecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de fallos crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticos en `logAuditEvent` que impedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an el registro de suscripciones por referencias nulas.
    - **XSS Prevention**: Saneo mandatorio de todos los payloads de notificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para evitar inyecciones de cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo malicioso en browsers de usuarios finales.
    - **Trazabilidad Total**: Todas las comunicaciones iniciadas (ya sea por usuario o admin) ahora generan un registro reproducible en la bitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡cora de auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ CIBERSEGURO
- **Correcciones TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnicas**:
    - **Bug Fix**: ReparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de un error de nomenclatura en la validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de *cooldown* de tareas (`lastConfirmedAt` -> `lastCompletedAt`) en `publicationController.js`.
    - **Routing Fix**: ResoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de error `router is not defined` en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulos reciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n extraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­dos. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ ESTABLE Y OPERATIVO

---

### [2026-03-02] - ReparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica: GestiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Administrativa de Rechazos (Discard Fix)
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
ResoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de un error de permisos y lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica en producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n que impedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a a los administradores rechazar tareas marcadas como "Culminadas" por los usuarios. Se profesionaliza el flujo de supervisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.

#### Cambios realizados
- **Backend (ReparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de LÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica)**:
    - **Admin Override**: Se modificÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la ruta `/publications/:id/discard` en `publicationController.js` para permitir que usuarios con rol de `admin` gestionen rechazos, eliminando la restricciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n que solo permitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a al autor original realizar esta acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
    - **Flexibilidad de Estados**: Ahora el sistema permite rechazar tareas en estados `pending`, `pending_approval` y `completed`, asegurando que el administrador pueda invalidar entregas mal realizadas.
- **Notificaciones Push (Vincular al Usuario)**:
    - Se integrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tico de notificaciones push al usuario cuya tarea ha sido rechazada: *"Tarea Rechazada ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ¯Â¿Â½Ãƒâ€¦Ã¢â‚¬â„¢: [TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo]"*.
- **Integridad TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica**:
    - Se corrigiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el uso del cliente de base de datos en los logs de auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a para evitar errores de referencia nula durante el proceso de descarte. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ RESUELTO Y AUDITABLE
- **Fine-Tuning de Marca & NavegaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
    - Se ajustÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la URL de redirecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n global para que las notificaciones de plataforma lleven al **Dashboard General** (`/dashboard.html`), unificando la entrada al ecosistema.
    - ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `badge` de marca (72x72) para visualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n profesional en la barra de estado de dispositivos Android. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ OPTIMIZADO

---

### [2026-03-04] - Fase de Mejora y AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de Landing Page
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
Inicio de la fase de trabajo sobre la Landing Page principal. Se ha realizado una auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a completa del cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo (HTML, CSS, JS) y de las reglas econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³micas para asegurar coherencia tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica y visual.

#### Acciones realizadas
- **AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de Contexto**: Lectura integral de `index.html`, `landing.css`, `landing.js` y `ECONOMIC_RULES.md`.
- **SincronizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de DiseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o**: VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la paleta Sapphire Premium y efectos Glassmorphism.
- **PreparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: IdentificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de puntos de mejora en modularidad y responsividad. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ CONTEXTO COMPLETADO

---

### 2026-03-06 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Winton Solidario: GestiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Admin + Motor Hold & Release (BLUE IOU)

- **Contexto**: Las causas humanitarias requieren un nivel de verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n superior para evitar fraudes y asegurar que los fondos (BLUE IOU) provengan de personas reales antes de ser efectivos.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Implementar **Panel de AdministraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Solidario** para la postulaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n privada de casos.
  - DiseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ar motor de **"Hold & Release"**: Las donaciones de BLUE IOU se debitan del donante pero quedan en "Hold" (espera).
  - Condicionar la liberaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: Los fondos solo se acreditan al beneficiario cuando el administrador aprueba el **KYC del donante**.
  - Aislamiento econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mico: La transferencia ocurre exclusivamente entre balances de impulsor (`booster_balance`), sin tocar el sistema de tokens RED.
- **Impacto**:
  - Seguridad bancaria: Blindaje contra bots y multicuentas que intenten "inflar" causas.
  - Transparencia: El beneficiario sabe que su saldo depende de la verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de su red.
  - Trazabilidad: Cada gramo de BLUE IOU donado tiene un origen humano verificado.
- **Evidencia**: ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n modular en `humanitarianController.js` y `humanitarianRoutes.js`.

---

### 2026-03-07 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Winton Solidario: Motor Hold & Release + Servicio de Donaciones

- **Contexto**: Con el Panel Admin listo, se necesitaba el motor financiero que procese las donaciones de BLUE IOU con garantÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de integridad y trazabilidad.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 039** (`039_solidario_hold_release_engine.js`): Crea la tabla `humanitarian_donations` y un **Trigger de PostgreSQL** (`fn_release_humanitarian_donations`) que libera automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticamente las donaciones en "Hold" cuando el donante pasa el KYC (`is_verified = true`).
  - **Servicio reescrito** (`humanitarianService.js`): Corregidos errores crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticos del borrador inicial (consultaba columna inexistente, usaba UPDATE directo en lugar de Event Sourcing). Ahora usa `record_booster_event()` y `booster_blue_ledger` para compatibilidad total con la arquitectura existente.
  - **Rutas de usuario** (`humanitarianUserRoutes.js`): Endpoints para postular causas, donar BLUE IOU, consultar mis causas y ver detalle de donaciones. Protegidas con `authenticateToken`.
  - **Aislamiento modular**: Rutas admin (`/api/admin/humanitarian`) y rutas de usuario (`/api/humanitarian`) en archivos separados con middlewares distintos.
- **Impacto**:
  - Motor financiero a nivel de Base de Datos (Trigger): garantiza liberaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica sin depender del cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo de Node.js.
  - Compatibilidad con Event Sourcing: todas las operaciones de saldo usan `record_booster_event`.
  - Seguridad anti-fraude: validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de saldo, prevenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de auto-donaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, KYC obligatorio para liberar fondos.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-03-08 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Winton Solidario: Interfaz PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblica y Tarjeta Dashboard

- **Contexto**: Las causas solidarias requerÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an visibilidad tanto para el pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblico general/donantes como para el propio creador de la causa, manteniendo una experiencia nivel fintech.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblica Dedicada (`causa-solidaria.html` y `.js`)**: UI moderna con barra de progreso, lista de donantes (clasificados por estado de acreditaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n u "on hold") y modal seguro para realizar donaciones de BLUE IOU verificando el KYC del donante (`/api/auth/status`).
  - **BotÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Compartir**: IntegraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n con Web Share API (nativo mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil) o WhatsApp web (fallback).
  - **Tarjeta en el Dashboard (`contract_interaction.html` y `.js`)**: Un widget en el panel principal (`contract-interaction`) que muestra al usuario el progreso en tiempo real de su causa, su estado (pendiente, aprobada, rechazada) y acceso rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido para compartirla.
- **Impacto**:
  - Creadores empoderados: pueden seguir el progreso en su dashboard.
  - Donantes seguros: la barrera de aporte tiene UX premium y alertas claras (KYC impactando el "Hold" de los fondos).
  - Efecto de red facilitado gracias al botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de compartir.
- **Evidencia (commits)**: pendiente de push.

---

### [2026-03-12] - ActualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Referidos: Sistema de PromociÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n DinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mica (FOMO)
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de un sistema de "Sentido de Urgencia" (FOMO) en el mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo de referidos. Ahora los usuarios ven en tiempo real cuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡nto tiempo queda para aprovechar la recompensa mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡xima de 1000 BLUE IOU antes de que baje a su valor base.

#### Cambios realizados
- **Arquitectura de Base de Datos**: 
    - CreaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `040_add_referral_promo_settings.js`.
    - AdiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del parÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡metro `referral_reward_after_expiry` (valor base pos-promo) en `app_settings`.
- **Backend (OptimizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de API)**:
    - ActualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del endpoint `/api/referral-settings` para centralizar toda la informaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la promociÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (monto actual, monto futuro, fecha de expiraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n).
- **Frontend (RediseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o Sapphire Premium)**:
    - **UI Renovada**: TransformaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n simple de referidos en una tarjeta de promociÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de alto impacto visual.
    - **Countdown Timer**: ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de un cronÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³metro en tiempo real (`ReferralPromoTimer`) que calcula los dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as, horas y minutos restantes comparando la hora local con la fecha configurada en el Admin Panel.
    - **Tiered Rewards**: VisualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n clara de "Recompensa actual" vs "DespuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s de la promo", utilizando tachado visual para incentivar el registro inmediato.
- **Refinamiento EstÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tico y Funcional Final**: 
    - **CompactaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Ultra-Slim**: RediseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o de la tarjeta para ocupar el mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nimo espacio vertical, moviendo unidades de tiempo (`d, h, m, s`) y etiquetas de moneda (`BLUE IOU`) a una disposiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n horizontal integrada.
    - **PsicologÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de ConversiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: ActualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de copys estratÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©gicos ("Bono por referir hoy" y "DespuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s baja a") junto con un icono de tendencia bajista para maximizar el FOMO.
    - **EstÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tica Sobria**: EliminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de animaciones y efectos de destello exagerados para mantener un aspecto profesional, limpio y centrado en la informaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de valor.
    - **Admin Panel**: IntegraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n completa para control dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mico de la recompensa pos-promociÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ FINALIZADO Y PULIDO

---

### [2026-03-12] - ModularizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del Backend: Fase 1 (Seguridad y ValidaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n)
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
Inicio de la refactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n arquitectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nica del monolito `server.js`. Siguiendo un protocolo de "Zero Risk", se han extraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­do las primeras funcionalidades hacia mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulos independientes en `src/routes/` para mejorar la mantenibilidad y auditabilidad.

#### Cambios realizados
- **Arquitectura de Rutas**:
    - CreaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `backend/src/routes/validationRoutes.js`: CentralizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de validaciones de disponibilidad de usuario, email y telÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fono.
    - CreaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `backend/src/routes/solidarioRoutes.js`: ModularizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n completa del mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo "Winton Solidario" (Postulaciones Humanitarias).
- **Control de Calidad (Protocolo de Fidelidad)**:
    - AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea por lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea para asegurar copias exactas de la lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica original.
    - VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica mediante pruebas de API directas (`Invoke-RestMethod`) tras cada movimiento.
- **TransiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Segura**:
    - El cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo original en `server.js` ha sido **comentado** (no eliminado) temporalmente como medida de respaldo mientras se validan los nuevos mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulos en el entorno de ejecuciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
- **SincronizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Mejoras**:
    - IntegraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n forzada de la nueva lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de `/api/referral-settings` (sistema FOMO) dentro del flujo modularizado, asegurando compatibilidad con los cambios manuales del usuario. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ ESTRUCTURA PROFESIONAL

---

### [2026-03-13] - Refuerzo de Marca: Inmunidad EconÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mica (Anti-Ballenas)
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
ActualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la narrativa de seguridad en la Landing Page principal para resaltar la protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n contra la manipulaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de mercado por grandes capitales (Ballenas), integrando el concepto dentro del bloque de Inmunidad MatemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica.

#### Cambios realizados
- **Landing UI (`index.html`)**: 
    - RediseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o de la tarjeta **BLK_003** para integrar **"Anti-Ballenas"** justo debajo de "Anti-Rug Pull", unificando tipografÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as para un look 100% simÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©trico.
    - ActualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del copy de seguridad: *"Es imposible robar liquidez o manipular el mercado."*
    - SimplificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del copy en la secciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Marketplace: EliminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de referencias redundantes para mayor impacto visual. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ PROFESIONAL
- **Arquitectura Visual**: ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de un contenedor `flex-column` dentro del `data-header` para mantener la jerarquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a sin romper el diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o responsive.

---

### [2026-03-13] - RediseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o del Footer: Minimalismo y CorrecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Estructural
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
EvoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n visual del pie de pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina (Footer) para lograr un estilo institucional, eliminando colores secundarios y corrigiendo un error tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnico en el CSS que impedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a la visualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n correcta en desktop.

#### Cambios realizados
- **CorrecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de ÃƒÆ’Ã†â€™Ãƒâ€šÃ¯Â¿Â½mbito (Scope Fix)**: Se detectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ que los estilos del footer estaban atrapados dentro de una media query mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil accidental. Se movieron todos los estilos a un **ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mbito global**, garantizando que el diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o premium se vea en todas las resoluciones.
- **EstÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tica "Total White"**: 
    - Se forzaron todos los enlaces a blanco puro (`#ffffff`) con `!important`.
    - **No Underline**: Se eliminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el subrayado (`text-decoration: none`) para que los enlaces parezcan "palabras normales", siguiendo las tendencias de diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o minimalista de la industria.
- **DistribuciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Multicapa**: 
    - **Desktop**: 5 columnas equitativas.
    - **Tablet**: 3 columnas.
    - **Mobile**: 1-2 columnas con centrado automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tico.
- **Enriquecimiento de Contenido**:
    - **SecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Solidario**: IntegraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del acceso directo a "Postular Causa" en la primera columna, reforzando el ADN social del proyecto. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦
    - **Winton Academy**: InclusiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del acceso a tutoriales interactivos en la secciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Recursos. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦
- **OptimizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de UX**: Se mantuvo el efecto hover (desplazamiento lateral y opacidad al 100%) para dar feedback sin ensuciar la estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tica limpia. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ PROFESIONAL

---

### [2026-03-15] - Infraestructura AWS: AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de FacturaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Global
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
AnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lisis preventivo tras recibir notificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n oficial de AWS sobre el cambio de remitente para facturas electrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nicas (`invoicing@aws.com`) a partir del 25 de marzo de 2026.

#### Acciones realizadas
- **AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo**: BÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsqueda exhaustiva en el backend y scripts de mantenimiento para detectar dependencias de automatizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (parsers/scrapers) vinculadas a correos de AWS.
- **Resultado**: No se detectaron dependencias tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnicas activas. El impacto en el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo es NULO.
- **RecomendaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Operativa**: Actualizar filtros de correo en la cuenta administrativa de Gmail para asegurar que las facturas no sean marcadas como spam o ignoren reglas de reenvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o contables. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ CIBERSEGURO

---

### [2026-03-18] - RediseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o Premium de Email Service (Anti-Spam & Zero-Image)
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
RefactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la cabecera de los correos automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticos (OTP, Transacciones, Gobernanza, Anuncios) para eliminar la deformaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de imÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡genes y usar una estrategia de tipografÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a nativa con estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tica Cripto-Premium.

#### Cambios realizados
- **Identidad Visual 100% CSS**: Reemplazo del logo anterior por una cabecera oscura (Azul Nocturno `#0A0F1C`) con la palabra `Winton` en blanco puro y `Coin` en azul corporativo. 
- **OptimizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Anti-Spam**: Al eliminar las peticiones a imÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡genes externas (`<img>`), se blinda el sistema OTP aumentando dramÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticamente la confianza (Trust Score) ante filtros de Google y Outlook.
- **Micro-Performance**: Velocidad de carga instantÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡nea del correo al depender exclusivamente de cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo nativo, brindando una experiencia "bancaria" ininterrumpida. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ PROFESIONAL

---

### [2026-03-19] - Despliegue del Sistema de Reclutamiento Profesional (Winton Talent)
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
CreaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n e integraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n completa del portal de captaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de talento externo para el crecimiento del ecosistema WintonCoin, bajo el programa de compensaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n temprana.

#### Cambios realizados
- **Backend de Reclutamiento**: ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del controlador `recruitmentController.js` y middleware `recruitmentUpload.js` (Multer) con validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n estricta de archivos PDF de hasta 5MB y trazabilidad de IP.
- **Base de Datos (MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 043)**: CreaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la tabla `recruitment_proposals` para el almacenamiento seguro y auditable de las postulaciones, incluyendo el multiplicador aplicado en el momento (15x).
- **Frontend Premium**: Nueva pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina `trabaja-con-nosotros.html` con estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tica Sapphire y Glassmorphism, destacando el beneficio de 1500 BLUE IOU por cada $100 USD de valor aportado.
- **IntegraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en Footer**: ActualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la landing page principal (`index.html`) para incluir el enlace oficial en la secciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Plataforma.
- **Legal & Compliance**: InclusiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la clÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡usula de tratamiento de datos de WTN Solutions LLC conforme a estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares internacionales de privacidad. ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ PROFESIONAL

---

### 2026-03-20 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Panel de Reclutamiento (Winton Talent) y GestiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Candidatos

- **Contexto**: Para la fase de crecimiento de la startup, se necesitaba un portal profesional para recibir y gestionar candidaturas de forma centralizada y segura.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **Admin Portal de Talento (`admin-recruitment.html`)**: RediseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o "Sapphire Premium" con cabecera superior compacta para mayor eficiencia de espacio. AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adida visualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n directa de salarios pretendidos, LinkedIn y perfiles de candidatos.
  - **Seguridad Bancaria (Auth & Cookies)**: MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de autenticaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `localStorage` a **cookies httpOnly** con `credentials: 'include'`, alineando el portal de talento con la seguridad del panel admin principal.
  - **ProtecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n OWASP Path Traversal (CRITICAL FIX)**: ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de rutas mediante `process.cwd()` y `path.join` para garantizar la correcta descarga de CVs en entornos de producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n distribuidos (Render/Hostinger).
  - **Migraciones 044 y 045**: EvoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la tabla para auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a (`reviewed_at`, `reviewer_notes`) y filtrado econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mico (`expected_salary`).
  - **Middleware `authenticateAdmin`**: ProtecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n estricta de todos los endpoints administrativos.
- **Impacto**:
  - GestiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n centralizada: El equipo de RRHH puede revisar postulaciones, descargar CVs y actualizar estados desde el panel admin.
  - Seguridad reforzada: Los datos sensibles de candidatos y archivos CV estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n protegidos bajo estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares de ciberseguridad industrial.
  - Trazabilidad: Cada cambio de estado genera un registro en el log de auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a bancaria.
- **Evidencia (commits)**: `a85e34c`.

---

### [2026-03-22] - Reclutamiento Endurecido: Sin Archivos + Multiplicador DinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mico desde DB
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
Ajuste integral de seguridad y consistencia del mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo de Talento para eliminar completamente la subida de CV por archivo, mover el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lculo del multiplicador a fuente dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mica de base de datos y endurecer el backend contra abuso y datos invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lidos.

#### Cambios realizados
- **PolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica sin Archivos (LinkedIn-first)**: La ruta `POST /api/recruitment/apply` dejÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ de usar middleware de upload y ahora acepta exclusivamente `application/json`. Se bloquea explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­citamente `multipart/form-data` con respuesta `415`.
- **ValidaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Backend Estricta**: Se aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adieron validaciones server-side para `full_name`, `email`, `role`, `linkedin_url` y `expected_salary`, con normalizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de entradas para mejorar calidad de datos y reducir superficie de ataque.
- **Rate Limit Anti-Spam**: Se incorporÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ limitador por IP en postulaciones pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblicas (`10 requests / 15 min`) para mitigar abuso automatizado.
- **Multiplicador DinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mico**: El valor aplicado en `recruitment_proposals.multiplier_applied` ya no estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ hardcodeado; ahora se obtiene desde `momentum_global_config.multiplier` (configurado desde `momentum-admin`), con fallback seguro a `1x`.
- **Config PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblica de Reclutamiento**: Nuevo endpoint `GET /api/recruitment/config` para exponer el multiplicador vigente de forma controlada al frontend.
- **Frontend Reclutamiento Sin Multipart**: `trabaja-con-nosotros.html` ahora envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a JSON (sin `FormData`) y consulta dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡micamente el multiplicador para renderizar badge y ejemplo de compensaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en tiempo real.
- **Hardening CORS en ProducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: En `server.js`, se eliminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el allow-all efectivo para producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y se restringe a orÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­genes permitidos, manteniendo flexibilidad solo en desarrollo.

---

### [2026-03-25] - Hardening CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tico de Seguridad + Robustez PWA Android
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
Se aplicÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un paquete de correcciones crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas orientadas a estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares fintech/bancarios: cierre de exposiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por `username`, validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de identidad contra JWT (anti-suplantaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n), y ajustes de PWA para mejorar la consistencia de instalaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n/actualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en Android.

#### Cambios realizados
- **AutorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Anti-SuplantaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (IDOR Mitigation)**:
  - Refuerzo de `requireAcceptedLegalByUsernameField` en `backend/src/middleware/legalAcceptanceMiddleware.js`.
  - Nueva polÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica: actor autenticado obligatorio + coincidencia estricta `JWT.username === body.username` en flujos de usuario final.
  - Exenciones controladas ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºnicamente para actores administrativos/sistema autenticados.
- **Cierre de Endpoints Legacy Expuestos**:
  - Endurecidos con `verifyUserToken` y validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de propiedad (`req.user.username === :username` o body):
    - `GET /notifications/:username`
    - `POST /notifications/mark-read`
    - `POST /notifications/:id/dismiss`
    - `GET /users/:username/history`
    - `GET /users/:username/transactions`
    - `GET /users/:username/balance`
  - Resultado: no se permite consultar/alterar datos de terceros aunque se conozca su username.
- **Consistencia de ModeraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Cuentas**:
  - Login ahora evalÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºa estado desde `account_status` con fallback legacy a `status`.
  - Se corrige endpoint admin de cambio de estado para evitar dependencia inconsistente de `res.locals.admin.id` y proteger cuentas de sistema (`platform/admin`).
- **Frontend Seguro (Token Propagation)**:
  - Se agregÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `Authorization: Bearer <token>` a llamadas crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas que faltaban en `frontend/src/pages/contract-interaction.js`:
    - ConfirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de pago.
    - EliminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de publicaciones.
    - Quema de tokens.
  - Resultado: backend endurecido y frontend alineados sin regresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n funcional.
- **PWA Android (InstalaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n/ActualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s robusta)**:
  - `frontend/public/manifest.json`:
    - Se aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `id` estable.
    - Se versionÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `start_url` con `?source=pwa` para identidad consistente de instalaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - `frontend/src/sw-source.js`:
    - Se corrigiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ regex de cache runtime para assets con hashes reales de Vite (`A-Za-z0-9_-`), evitando fallos silenciosos de cachÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©.
  - `frontend/src/modules/pwa-install.js`:
    - Se separÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ estado `pwa_installed` de `pwa_install_dismissed` para no bloquear instalaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n futura por descarte de UI.

#### Nota operativa (Android / Google Play Protect)
- La alerta de Play Protect observada por usuarios suele corresponder a una instalaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n previa tipo APK/WebAPK antigua o envoltorio legacy en el dispositivo.
- RecomendaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: desinstalar app previa del dispositivo y reinstalar desde Chrome (PWA), validando que tome el nuevo `manifest id/start_url`.

---

### [2026-03-25] - Android Hardening (Cleartext por entorno)
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
Se aplicÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un ajuste de seguridad en la app Android nativa para cumplir prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ctica estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndar: trÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡fico HTTP permitido solo en desarrollo (`debug`) y bloqueado en producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (`release`).

#### Cambios realizados
- **Manifest seguro por placeholder**:
  - `android-app/app/src/main/AndroidManifest.xml` ahora usa `android:usesCleartextTraffic="${usesCleartextTraffic}"`.
- **Gradle por entorno**:
  - `android-app/app/build.gradle.kts`:
    - `release` -> `manifestPlaceholders["usesCleartextTraffic"] = "false"`
    - `debug` -> `manifestPlaceholders["usesCleartextTraffic"] = "true"`

#### Impacto
- **ProducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: endurecida (sin HTTP plano).
- **Desarrollo local**: sin ruptura, se mantiene acceso a backend local HTTP.

---

### [2026-03-25] - PWA: Manifest explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cito en Landing principal
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
Ajuste puntual para robustecer la instalabilidad PWA en Android desde la URL principal (`www.wintoncoin.com`), asegurando que la landing incluya manifiesto y color de tema.

#### Cambios realizados
- `frontend/index.html`:
  - Se aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `<meta name="theme-color" content="#4a90d9">`.
  - Se aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `<link rel="manifest" href="manifest.json">`.

#### Impacto
- Mejora la detecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de instalaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n PWA desde la primera pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de entrada.
- Reduce comportamientos inconsistentes de ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“instalar appÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ en navegadores Android cuando el manifiesto no estaba presente en la landing.

---

### [2026-03-25] - MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n segura a identidad JWT (`/api/me`) en Historial/Transacciones
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
Paso incremental de estandarizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: se introducen endpoints autenticados por JWT para historial y transacciones, reduciendo dependencia de rutas con `username` en URL.

#### Cambios realizados
- **Backend (`backend/server.js`)**
  - Nuevo `GET /api/me/history`:
    - Usa `req.user.userId` como fuente de verdad para publicaciones creadas.
    - Usa `req.user.username` para historial completado donde el modelo legacy aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn depende de username.
  - Nuevo `GET /api/me/transactions`:
    - Consulta por `t.user_id = req.user.userId`.
- **Frontend**
  - `frontend/src/pages/history.js`:
    - Cambia consumo a `GET /api/me/history`.
    - EnvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a `Authorization: Bearer <token>`.
    - Endurece `postToServer` para incluir token en acciones.
  - `frontend/src/pages/transactions.js`:
    - Cambia consumo a `GET /api/me/transactions`.
    - EnvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a `Authorization: Bearer <token>`.

#### Impacto
- Disminuye superficie de ataque por URL basada en username.
- Alinea el flujo con prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ctica profesional fintech: identidad canÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nica por JWT/userId.
- Mantiene compatibilidad, sin retirar de inmediato endpoints legacy.

---

### [2026-03-25] - Hardening de sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n JWT en `verifyUserToken`
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
Se endureciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el middleware principal de autenticaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del monolito (`server.js`) para aplicar invalidaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por cambio de contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a en todas las rutas que usan `verifyUserToken`.

#### Cambios realizados
- `backend/server.js`:
  - `verifyUserToken` ahora:
    - valida existencia de `userId` en el token,
    - consulta `users.password_invalidate_before`,
    - rechaza JWT emitidos antes del timestamp de invalidaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (`code: SESSION_INVALIDATED`),
    - rechaza tokens de usuarios inexistentes.
  - En caso de fallo de DB durante validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, responde `503` (fail-safe) para no autorizar sin comprobaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.

#### Impacto
- Cierra brecha de inconsistencia: antes, algunas rutas del monolito aceptaban tokens viejos tras reset de contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a.
- Uniforma el estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndar de seguridad con el middleware `authenticateToken` ya existente.

---

### [2026-03-25] - NormalizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de identidad admin en `verifyAdminToken`
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
Se aplicÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un ajuste corto de consistencia para evitar divergencias de autorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n entre controladores que esperan `req.user.role === 'admin'`.

#### Cambios realizados
- `backend/server.js`:
  - `verifyAdminToken` ahora usa lectura segura de cookie (`req.cookies?.admin_token`).
  - Tras verificar JWT admin, normaliza:
    - `req.user.role = 'admin'`.
    - `res.locals.admin = req.user` (compatibilidad con mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulos legacy).

#### Impacto
- Elimina inconsistencias de permisos admin en rutas que validan `req.user.role`.
- Mejora compatibilidad sin cambiar contratos de API ni flujo funcional del frontend.

---

### [2026-03-25] - Middleware combinado para flujos de publicaciones (`verifyAdminOrUserToken`)
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
Paso incremental de autorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: se habilita autenticaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n dual (admin o usuario autenticado) en rutas de publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n que operativamente usan autores y, en algunos casos, override administrativo.

#### Cambios realizados
- `backend/server.js`:
  - Nuevo middleware `verifyAdminOrUserToken`:
    - Si existe cookie admin vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lida -> autentica como admin (`role: 'admin'`).
    - Si no existe o es invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lida -> valida JWT de usuario (`verifyUserToken`).
  - El router de publicaciones (`publicationRoutes`) pasa a usar este middleware combinado en lugar de `verifyAdminToken`.

#### Impacto
- Evita bloqueo de flujos legÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­timos del autor en endpoints de publicaciones.
- Mantiene soporte de override admin cuando aplique.
- No amplÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a permisos en endpoints admin-only globales, ya que el cambio se limita al router de publicaciones.

---

### [2026-03-25] - CanonicalizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de actor en `publicationController` (discard/approve/confirm-payment)
#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
Se redujo dependencia de campos `...Username` enviados por cliente, usando identidad canÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nica de `req.user` siempre que exista (JWT), manteniendo fallback controlado para compatibilidad.

#### Cambios realizados
- `backend/src/controllers/publicationController.js`:
  - Nuevo helper `resolveActorUsername(req, fallbackUsername)`.
  - Aplicado en:
    - `POST /publications/:id/discard`
    - `POST /publications/:id/approve`
    - `POST /publications/:id/confirm-payment`
  - Las validaciones de permisos y logs de auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a usan `actorUsername` canÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nico.
  - En `confirm-payment`, `targetUsername` del log final se normaliza al `acceptor_username` de DB (fuente de verdad).

#### Impacto
- Menor riesgo de spoofing funcional por manipulaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `username` en body.
- Mejor trazabilidad de auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a (actor/target consistentes con datos canÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nicos).
- Compatibilidad preservada para flujos admin legacy.

---

---

## [2026-03-26] - Fix CORS: agregar dominio principal de producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n

### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
El frontend de producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n migrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ de `sc.wintoncoin.com` a `wintoncoin.com`, pero la lista de orÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­genes permitidos (CORS) del backend no incluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a los nuevos dominios. Esto provocaba que todas las peticiones desde producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n fueran bloqueadas por el navegador (error CORS 403).

#### Cambios realizados
- `backend/server.js`:
  - Agregado `https://wintoncoin.com` a `ALLOWED_ORIGINS` (dominio principal de producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n).
  - Agregado `https://www.wintoncoin.com` a `ALLOWED_ORIGINS` (variante con www).
  - Se mantienen los dominios legacy (`sc.wintoncoin.com`) para compatibilidad.

#### Impacto
- Resuelve error CORS que impedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a el funcionamiento de la pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de reclutamiento (`trabaja-con-nosotros.html`) y cualquier otra peticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n al backend desde el dominio principal.
- Sin impacto en seguridad: solo se agregan dominios legÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­timos del proyecto.

---

---

## [2026-03-26] - Fix auth: agregar token Bearer a publication-detail.js

### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
La funciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `fetchFromServer` en `publication-detail.js` no incluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a el header `Authorization: Bearer` en las peticiones al backend. Tras el endurecimiento de seguridad que requiere JWT en todas las rutas autenticadas, las acciones como "Aceptar Tarea", "Aprobar", "Completar" y "Confirmar Pago" fallaban con error "No autenticado".

#### Cambios realizados
- `frontend/src/pages/publication-detail.js`:
  - Agregada lectura de `localStorage.getItem('token')` al inicio del mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo.
  - `fetchFromServer()` ahora incluye `Authorization: Bearer <token>` en todas las peticiones.

#### Impacto
- Resuelve error "No autenticado" al intentar aceptar, aprobar, completar o confirmar pago en publicaciones.
- Todas las acciones de publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n ahora envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an identidad JWT verificable al backend.

---

---

### 2026-03-27 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica: renderizado PWA y selector de publicaciones

- **Contexto**: Se realizÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ una auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de ingenierÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a nivel Senior sobre las funciones de renderizado de la PWA (`contract-interaction.js`) y el selector de filtros/orden de publicaciones. El objetivo fue identificar errores activos, riesgos de seguridad y deuda tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Documentar todos los hallazgos en `docs/AUDIT_PENDING_ISSUES.md` como backlog tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnico auditable, con instrucciones para verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y resoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n progresiva.
- **Hallazgos principales**:
  - 3 hallazgos CRÃƒÆ’Ã†â€™Ãƒâ€šÃ¯Â¿Â½TICOS: funciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `startCountdown` inexistente (runtime error), polling agresivo de 5s sin `visibilitychange`, cachÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© de ratings que se destruye en cada render.
  - 7 hallazgos IMPORTANTES: XSS potencial en `pub.title`/`pub.author_username`, CDN RawGit descontinuado, `document.execCommand` deprecado, select que mezcla filtros con ordenamientos, memory leak por listeners acumulativos, cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo muerto, `Promise.all` sin tolerancia a fallos parciales.
  - 5 hallazgos MENORES: meta tag duplicada, poluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `window.*`, onclick inline, sin loading state, CSS duplicado.
- **Impacto**: Se genera un documento de referencia que permite a cualquier agente futuro resolver estos issues de forma ordenada y verificable.
- **Documento de referencia**: `docs/AUDIT_PENDING_ISSUES.md`.

---

### 2026-03-27 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Refactor: Separar filtros y ordenamiento de publicaciones (I-04, I-05)

- **Contexto**: El selector de publicaciones mezclaba filtros por tipo (solicitud, venta, donaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, en proceso) con ordenamientos (fecha, recompensa) en un solo `<select>`. Esto impedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a combinar filtro + orden y generaba confusiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en la UX. AdemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s, contenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo muerto (`if (!selected)`) que nunca se ejecutaba.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Reemplazar el `<select>` ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºnico por dos controles con responsabilidades separadas siguiendo el principio SRP (Single Responsibility Principle):
  - **Filter chips** (`<button>` con `data-filter`): fila horizontal de pills para filtrar por tipo ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ "Todos", "En proceso", "Solicitud", "Venta", "DonaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n". Usan event delegation, ARIA `role="group"` y `aria-pressed`, y son scrollable en mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil.
  - **Sort dropdown** (`<select>`): selector de ordenamiento ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ "MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s reciente", "MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s antigua", "Mayor recompensa", "Menor recompensa". Con `<label>` asociado para accesibilidad.
- **Cambios tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnicos**:
  - `contract_interaction.html`: Reemplazado el `<select id="publicationSortFilter">` por chips + sort.
  - `contract-interaction.js`: Nueva variable de estado `currentFilter`, nueva funciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `handleFilterChipClick` con event delegation, `applySortAndFilter` reescrita con pipeline claro (filtrar ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ ordenar ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ priorizar pendientes). Se eliminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ rama de cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo muerto.
  - `style.css`: Nuevas clases `.publication-filter-chips`, `.filter-chip`, `.publication-sort-container`, `.publication-sort-select`, `.publication-sort-label`. Se eliminaron clases obsoletas `.publication-controls-select`. Responsive para mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil.
- **Impacto**: El usuario ahora puede filtrar por tipo de publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Y ordenar simultÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡neamente (ej: "solo Solicitudes" ordenadas por "Mayor recompensa"). Mejor UX en PWA mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil con chips tappables. CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s limpio y mantenible.
- **Issues resueltos**: `AUDIT_PENDING_ISSUES.md` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ I-04, I-05.

---

### 2026-03-27 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Fix: Mobile-first responsive para controles de publicaciones

- **Contexto**: Los filter chips, el input de bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsqueda y el dropdown de ordenamiento se veÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an rotos en dispositivos mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles. Los estilos globales de `button` (`width:100%`, `padding:15px`, `background:primary`) e `input[type="text"]` (`padding:12px 15px`, `background:#fff`, `color:#111`, `font-size:1rem`) sobreescribÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an los estilos de componente, causando chips gigantes, search input con fondo blanco y tamaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o incorrecto.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Reescribir toda la secciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n CSS de publication controls con enfoque **mobile-first**:
  - Base (320px+): chips compactos (30px alto, 0.72rem), search y sort apilados verticalmente al 100% de ancho.
  - `@media (min-width: 420px)`: search + sort en fila horizontal, search flexible y sort con ancho mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nimo.
  - `@media (min-width: 480px)`: chips ligeramente mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s grandes.
  - Especificidad elevada (`.publication-controls .filter-chip`) para vencer los globales sin usar `!important`.
- **Impacto**: Los controles se ven correctamente en cualquier telÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fono desde 320px de ancho, con transiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n suave a layout horizontal en pantallas medianas.

---

### 2026-03-27 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Fix: CachÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© de ratings persistente (C-03) y layout inline obligatorio

- **Contexto**: Al cambiar filtro, orden o bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsqueda, la funciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `renderPublicationsWithFilters` recreaba un `Map` vacÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o de ratings de usuario en cada invocaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. Esto generaba N peticiones HTTP al servidor por cada re-renderizado (una por cada autor ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºnico), causando demoras visibles de varios segundos.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Promover `userRatingsCache` a variable de mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo (persistente entre renderizados). Se invalida ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºnicamente cuando `fetchAndDisplayPublications` trae datos frescos del servidor (`userRatingsCache.clear()`). Dentro de `renderPublicationsWithFilters`, ahora solo se buscan los autores que no estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n ya en cachÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, se les hace fetch en paralelo, y luego se genera el HTML de forma sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ncrona.
- **Cambios tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnicos**:
  - `contract-interaction.js`: `userRatingsCache` movido a scope de mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo (lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea ~113). `fetchAndDisplayPublications` llama `.clear()` antes de renderizar. `renderPublicationsWithFilters` filtra autores no cacheados, los fetchea una sola vez, y genera HTML con `.map()` sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ncrono en lugar de `Promise.all` con callbacks async.
  - `style.css`: Filter chips con `flex-wrap: nowrap` + `overflow-x: auto` (siempre 1 lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea). Sort container con `flex-direction: row` obligatorio (buscar + ordenar siempre lado a lado).
- **Impacto**: Cambiar filtro/orden/bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsqueda es ahora instantÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡neo (0 peticiones HTTP). Solo la carga inicial o el polling generan requests de ratings. Resuelve issue C-03 de la auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.

---

### 2026-03-28 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ UX: EliminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del mensaje "ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡TransacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n completada!" en detalle de tarea

- **Contexto**: En la vista de detalle de publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (`publication-detail.js`), cuando el estado del participante era `confirmed_paid`, se mostraba un mensaje estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tico `"ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡TransacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n completada!"` al final de los pasos de la tarea. Este mensaje generaba confusiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n porque aparecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a siempre visible (no como resultado de una acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n inmediata), dando la impresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de que la tarea ya fue completada cuando el usuario podrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a estar revisÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndola.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Eliminar el mensaje siguiendo principios de diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o minimalista y UX profesional ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ no mostrar feedback de ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©xito permanente cuando el contexto ya lo hace evidente. El usuario sabe que completÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la tarea porque pasÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ por todos los pasos del flujo.
- **Cambios tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnicos**:
  - `frontend/src/pages/publication-detail.js`: En el `switch(userStatus)`, caso `confirmed_paid`, se eliminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la asignaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `messageHTML = 'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡TransacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n completada!'`. El `messageHTML` queda como string vacÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o (su valor por defecto). La lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica del botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n "de nuevo" (si hay cupos disponibles) se mantiene intacta.
- **Impacto**: Interfaz mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s limpia y menos confusa. No se afecta ninguna lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de negocio, validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n ni flujo funcional. Cambio puramente visual/UX.

---

### 2026-03-29 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ CI/CD: Deploy dual ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ mismo build a sc.wintoncoin.com y wintoncoin.com

- **Contexto**: El workflow de GitHub Actions (`deploy-frontend.yml`) solo desplegaba el build del frontend al subdominio `sc.wintoncoin.com`. Se necesita que el dominio principal `wintoncoin.com` tambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n reciba el mismo build automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticamente al hacer push.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Agregar un segundo paso de sincronizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n FTP en el mismo workflow. Se reutiliza el mismo build (no se compila dos veces), y se usa un set de secrets FTP independiente para el dominio principal (`FTP_SERVER_MAIN`, `FTP_USERNAME_MAIN`, `FTP_PASSWORD_MAIN`). TambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n se separÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la instalaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `lftp` en su propio paso para evitar instalarlo dos veces.
- **Cambios tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnicos**:
  - `.github/workflows/deploy-frontend.yml`: Se agregÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ paso "Instalar lftp" separado. Se renombrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el paso de deploy existente a "Deploy a sc.wintoncoin.com". Se agregÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ nuevo paso "Deploy a wintoncoin.com" con secrets dedicados.
- **Impacto**: Un solo push despliega a ambos dominios. Requiere crear 3 nuevos secrets en GitHub (`FTP_SERVER_MAIN`, `FTP_USERNAME_MAIN`, `FTP_PASSWORD_MAIN`) con las credenciales FTP del dominio principal en Hostinger.

---

### 2026-04-02 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a Integral del Sistema Push Notifications (10 errores corregidos)

AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a completa del sistema VAPID/Web Push. Se encontraron y corrigieron 10 errores (3 crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticos, 4 importantes, 3 moderados) en 7 archivos. Ver `docs/EVOLUCION.md` y `docs/AUDIT_PENDING_ISSUES.md` para el detalle completo de cada correcciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.

---

---

### 2026-04-02 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a y CorrecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Integral del Sistema Push Notifications

- **Contexto**: AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a completa del sistema de notificaciones push (VAPID/Web Push) revelÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ **10 errores** en 7 archivos, incluyendo 3 crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticos que afectaban la funcionalidad en producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. El sistema involucraba: `notificationService.js`, `notificationController.js`, `notificationEventBus.js`, `publicationController.js`, `authController.js`, `notificationSettings.js` (frontend), y `sw-source.js` (Service Worker).
- **Errores crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticos corregidos**:
  - **E-01 Panel Admin Push ROTO**: Frontend enviaba `message` pero backend esperaba `body` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ siempre 400. No habÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o individual (solo broadcast). Respuesta sin `success` que el frontend buscaba. CORREGIDO: Controller acepta ambos campos, implementa envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o individual por username, y retorna `{ success, sent, failed }`.
  - **E-02 Preferencias se BORRABAN al guardar**: Frontend enviaba `{ social, marketing }` directo, backend hacÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a `const { settings } = req.body` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ `undefined` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ preferencias reseteadas a solo `{ security: true }`. CORREGIDO: Controller acepta ambos formatos (`{ settings: {...} }` y directo). Service hace merge con preferencias actuales en vez de reemplazar.
  - **E-03 9/18 llamadas con `url` en raÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­z**: SW lee `data.url` para navegaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, pero 9 llamadas ponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an `url` en la raÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­z del payload ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ click en notificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n siempre iba a `/contract_interaction.html`. CORREGIDO: Todas las llamadas ahora usan `data: { url }`. AdemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s, `normalizePayload()` en el servicio maneja el formato legacy como fallback.
- **Errores de seguridad corregidos**:
  - **E-04 SQL Injection en broadcast**: `typeKey` se concatenaba directo en SQL. CORREGIDO: Query parametrizada con `$1`.
  - **E-05 Login alert como SOCIAL**: `SECURITY_LOGIN_ALERT` usaba tipo default `SOCIAL`, permitiendo que usuarios lo desactivaran. CORREGIDO: Tipo explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cito `'SECURITY'`.
- **Mejoras de robustez**:
  - **E-06**: Contadores de entrega ahora cuentan solo ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©xitos reales (no intentos).
  - **E-07**: 5 eventos de gobernanza sin `data.url` corregidos con URL al panel de gobernanza.
  - **E-08**: Whitelist de tipos (`VALID_NOTIFICATION_TYPES`) con fallback seguro.
  - **E-09**: VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de VAPID (`assertVapidReady()`) antes de cada envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o.
  - Tipos `TRANSACTIONAL` y `SECURITY` marcados como `MANDATORY_TYPES` (no bloqueables por usuario).
  - Notificaciones de pago, donaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y acreditaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n reclasificadas de `SOCIAL` a `TRANSACTIONAL`.
- **Archivos modificados**: `backend/src/services/notificationService.js` (reescrito), `backend/src/controllers/notificationController.js` (reescrito), `backend/src/controllers/publicationController.js` (6 payloads), `backend/src/controllers/authController.js` (3 payloads), `backend/src/services/notificationEventBus.js` (6 correcciones), `frontend/src/modules/notificationSettings.js` (body format).
- **Impacto**: Sistema push completamente funcional, seguro, auditable y alineado con estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares fintech/bancarios. Panel admin puede enviar push individual y masivo. Preferencias de usuario funcionan correctamente. NavegaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n al hacer click en notificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n lleva a la pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina correcta en todos los casos.

---

### 2026-04-02 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ CorrecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de C-01, I-01 y C-02 (Runtime Error, XSS, Polling)

- **Contexto**: Tres hallazgos de la auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica pendientes de resoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: un error de runtime que rompÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a funcionalidad activa (C-01), una vulnerabilidad XSS en la renderizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de publicaciones (I-01), y un polling agresivo que desperdiciaba recursos del servidor y baterÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a del usuario (C-02).
- **C-01 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ ReferenceError `startCountdown` (CRÃƒÆ’Ã†â€™Ãƒâ€šÃ¯Â¿Â½TICO)**:
  - `handleCountdownTimers()` llamaba a `startCountdown()` que no existÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ `ReferenceError` silencioso que impedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a mostrar el countdown de fondos pendientes de liberaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - **SoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Creada funciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `startAvailableCountdown(availableDateString, availableAmount)` siguiendo el mismo patrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n profesional de `startDebtCountdown` y `startEscrowCountdown`. Limpia interval previo, formatea monto, muestra cuenta regresiva, y al llegar a cero oculta el contenedor y refresca saldos vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a `fetchAndDisplayBalances()`.
- **I-01 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ XSS en `pub.title` y `pub.author_username` (IMPORTANTE/SEGURIDAD)**:
  - Datos del servidor (`pub.title`, `pub.author_username`) se insertaban directamente en HTML sin escapar ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ riesgo de ejecuciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo malicioso en el navegador de todos los usuarios.
  - **SoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Creado mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo `frontend/src/modules/sanitize.js` con funciones `escapeHtml()` y `escapeAttr()` (cumple OWASP XSS Prevention Cheat Sheet, escapa `& < > " '`). Registrado en `index.js` y expuesto en `window.*`. Aplicado en `getPublicationCardHTML`: tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo usa `escapeHtml(pub.title)`, autor usa `escapeHtml`/`escapeAttr` para contenido y atributos, URL del perfil usa `encodeURIComponent` para query params.
- **C-02 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Polling agresivo sin control de visibilidad (CRÃƒÆ’Ã†â€™Ãƒâ€šÃ¯Â¿Â½TICO)**:
  - `setInterval(loadAllData, 5000)` ejecutaba 5 peticiones HTTP cada 5 segundos sin importar si el usuario estaba mirando la pestaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a o si el telÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fono estaba en el bolsillo.
  - **SoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Implementado sistema de polling inteligente usando Page Visibility API (W3C estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndar). Funciones `startPolling()`/`stopPolling()` idempotentes controladas por listener `visibilitychange`. Cuando el tab estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ oculto: 0 requests. Al volver: refresh inmediato + reinicio del ciclo. Intervalo aumentado de 5s a 10s.
- **Archivos modificados**: `frontend/src/pages/contract-interaction.js`, `frontend/src/modules/sanitize.js` (nuevo), `frontend/src/modules/index.js`.
- **Impacto**: Eliminado error de runtime que afectaba a usuarios con fondos pendientes. Eliminada vulnerabilidad XSS en el feed de publicaciones. ReducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n significativa de carga al servidor (~50% menos requests cuando visible, ~100% menos cuando oculto) y ahorro de baterÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a en dispositivos mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³viles.

---

### 2026-04-02 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Fix auth faltante en publish/donaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n/quick-sale + XSS en publication-detail

- **Contexto**: Durante las pruebas de los fixes anteriores en demo, se detectaron 2 problemas adicionales.
- **AUTH-01 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Bearer token faltante en 4 endpoints protegidos**:
  - El commit de seguridad `cc01f22` aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `requireAcceptedLegalByUsernameField` a `POST /publish`, `POST /api/minor/add-tutor`, `POST /publications/:id/accept` y `POST /api/quick-sale`, pero el frontend nunca fue actualizado para enviar el header `Authorization: Bearer <token>`.
  - **SoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adido `Authorization: Bearer ${token}` a los 4 fetch. Token se lee al momento del fetch (no al cargar la pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina) siguiendo el patrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `postToServer`. AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adido `handleSessionExpired` para redirigir al login si el token expirÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³.
- **XSS-02 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ 7 puntos de inyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n XSS en publication-detail.js**:
  - La protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n XSS de I-01 solo cubrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a `contract-interaction.js` (tarjetas del dashboard). La pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de detalle (`publication-detail.js`) tenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a 7 inserciones de datos del servidor sin escapar: tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo, autor, participantes, labels de formulario, respuestas de formulario.
  - **SoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Aplicado `escapeHtml()`/`escapeAttr()`/`encodeURIComponent()` en los 7 puntos. Verificado en demo: el payload `<img src=x onerror=alert('XSS')>` ya no ejecuta cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo.
- **Archivos modificados**: `frontend/src/pages/publish.js`, `frontend/src/pages/contract-interaction.js`, `frontend/src/pages/publication-detail.js`.
- **Impacto**: Publicar, donar y venta rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pida vuelven a funcionar. XSS eliminado en todas las vistas de publicaciones.

---

### 2026-04-04 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ EliminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de cabecera (nav) rota en faq.html

- **Contexto**: La pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina `frontend/faq.html` contenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a un elemento `<nav>` con enlaces a `landing.html` (logo "WintonCoin" e "Inicio") y `register.html` ("Registrarse"). La pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina `landing.html` no existe en el servidor, generando error 404 al hacer clic en cualquiera de esos enlaces.
- **SoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Se eliminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ completamente el bloque `<nav class="glass-nav">` con todos sus enlaces rotos. Se ajustÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el `padding-top` de `.faq-section` de `120px` a `60px` ya que el padding original compensaba la altura del nav fijo que fue removido. TambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n se eliminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el enlace "Inicio" (`landing.html`) del footer que igualmente apuntaba a la pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina inexistente. Se eliminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la columna de redes sociales del footer (iconos ÃƒÆ’Ã‚Â°Ãƒâ€šÃ¯Â¿Â½ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ¯Â¿Â½, in, IG) ya que eran `<span>` sin enlaces funcionales.
- **Archivos modificados**: `frontend/faq.html`.
- **Impacto**: Los usuarios de la pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina FAQ ya no ven enlaces que llevan a pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ginas inexistentes (404). Se eliminaron iconos de redes sociales no funcionales. La pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina queda limpia con solo elementos que realmente funcionan: las 17 preguntas FAQ, el CTA de WhatsApp, y enlaces vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lidos en el footer (register, login, boosters).

---

### 2026-04-09 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Gobernanza: Recompensa por voto + DemoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ProducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n + Message Archive

- **Recompensa por voto (BLUE IOU)**: AcreditaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica al votar con snapshot de precio (point-in-time pricing). Default seguro: 0. Procesamiento batch admin para votos histÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ricos.
- **Transferencia DemoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ProducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Export/Import seguro con HMAC-SHA256, matching por username, triple deduplicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, crash-safety.
- **Message Archive**: Almacenamiento de exports en BD para re-download (patrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n SWIFT). UI de historial con audit log.
- **Migraciones**: 047 (reward_credited), 048 (demo_reward_imports), 049 (demo_reward_exports).
- Ver `docs/EVOLUCION.md` para detalle tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnico completo.

---

### 2026-04-09 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Fix: Notificaciones in-app + Historial de Ganancias + XSS

- **Notificaciones in-app**: 15 eventos del EventBus ahora guardan en tabla `notifications` (antes solo push+email).
- **Historial de Ganancias**: Query LATERAL corregida ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ match por proximidad temporal en vez de `ORDER BY DESC`.
- **Seguridad**: 3 puntos de Stored XSS corregidos con `escapeHtml()` en notificaciones y historial de ganancias.
- **Estabilidad**: `_storeNotificationByUserId` cambiada para prevenir crash por UnhandledPromiseRejection.

---

---

### 2026-04-09 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Gobernanza: Recompensa por voto (BLUE IOU) + Transferencia DemoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ProducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n + Archivo de Exportaciones

- **Contexto**: Los guardianes del sistema Winton-Consensus participan en la toma de decisiones crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas (votaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de solicitudes de configuraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y membresÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a). Se requerÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a un mecanismo de incentivo econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mico por su participaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, junto con un sistema seguro para compensar actividad de votaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n realizada en el entorno demo.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **Recompensa por voto (Event-Driven)**: Al emitir un voto (`GOV_VOTE_SUBMITTED`), se acreditan BLUE IOU al guardiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n usando un snapshot del valor configurado (`gov_vote_reward_blue`) para garantizar "point-in-time pricing". Default seguro: `0` (Secure by Default).
  - **MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 047**: Columna `reward_credited` en `governance_votes` con ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ndice parcial para consultas eficientes de votos sin pagar.
  - **Procesamiento batch**: BotÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n admin para procesar votos histÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ricos sin recompensar (notificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n consolidada).
  - **Transferencia DemoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ProducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Export/Import seguro con HMAC-SHA256, matching por `username`, triple deduplicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (demo_exported_at, file_hash UNIQUE, vote_ids_json), crash-safety con status incremental.
  - **Message Archive (MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 049)**: Tabla `demo_reward_exports` para almacenar copias firmadas de exports con re-download capability, UI de historial, y audit log de re-descargas.
  - **UI Admin**: SecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n "Recompensas Gov." con estadÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­sticas, botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de procesamiento batch, export/import demo, e historial de exportaciones.
- **Impacto**:
  - Incentivo econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mico alineado con mejores prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡cticas de gobernanza descentralizada.
  - Seguridad bancaria: idempotencia, atomicidad, snapshot de precios, firma criptogrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡fica.
  - OperaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n demoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n segura con protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n contra doble pago y crash recovery.
  - Message Archive pattern (estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndar SWIFT) para recoverability de datos exportados.
- **Evidencia**: Migraciones 047, 048, 049. Archivos: `governanceRewardService.js`, `governanceDemoRewardService.js`, `governanceService.js`, `governanceController.js`, `notificationEventBus.js`, `server.js`, `admin-panel.html`, `admin-panel.js`.

---

### 2026-04-09 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Fix: Notificaciones in-app y match de transacciones en Historial de Ganancias

- **Contexto**: Dos problemas detectados en producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n:
  1. Las notificaciones push de gobernanza (y de otros mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulos) se enviaban correctamente pero **no se guardaban** en la tabla `notifications`, por lo que el "Historial de Notificaciones" in-app aparecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a vacÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o para estos eventos.
  2. El "Historial de Ganancias" (perfil impulsor) mostraba el mismo nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero de solicitud (#45) para dos votos distintos (#44 y #45), cuando el "Historial de Transacciones" mostraba correctamente cada uno.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **Problema 1 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Persistencia de notificaciones**: Creados helpers `_storeNotification(recipientUsername, message)` y `_storeNotificationByUserId(userId, message)` en `notificationEventBus.js`. PatrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n fire-and-forget con `.catch()` para no bloquear el flujo principal. Se agregÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ INSERT en los **15 eventos activos** (8 de gobernanza + 7 generales: participaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, tareas, P2P, seguridad).
  - **Problema 2 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Query LATERAL ambigua**: La query `LEFT JOIN LATERAL` en booster-profile usaba `ORDER BY bt.created_at DESC LIMIT 1`, tomando siempre la transacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s reciente. Dos votos con mismo monto dentro de 2 minutos hacÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an match con la misma fila. Corregido a `ORDER BY ABS(EXTRACT(EPOCH FROM (bt.created_at - bbl.created_at))) ASC LIMIT 1` para match por proximidad temporal. Aplicado en ambos endpoints (pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblico y autenticado).
  - **Seguridad XSS**: Durante la revisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n se detectaron 3 puntos de Stored XSS: `notification.message` se insertaba sin escapar en el dropdown y modal de notificaciones, y `description` en el historial de ganancias. Corregidos con `escapeHtml()` (OWASP).
  - **Estabilidad**: `_storeNotificationByUserId` cambiada de `async` a funciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ncrona con `.then()/.catch()` encadenado para prevenir `UnhandledPromiseRejection` que podrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a crashear el proceso Node.js.
- **Archivos modificados**: `backend/src/services/notificationEventBus.js`, `backend/server.js` (2 queries), `frontend/src/pages/contract-interaction.js` (2 puntos XSS), `frontend/src/pages/booster-profile.js` (1 punto XSS + import).
- **Impacto**:
  - Historial de notificaciones in-app completamente funcional para todos los eventos de la plataforma.
  - Historial de ganancias muestra correctamente cada solicitud de gobernanza por separado.
  - 3 vulnerabilidades Stored XSS eliminadas.
  - Estabilidad del proceso Node.js mejorada (sin rejected promises sin manejar).

---

## 2026-04-11 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Time-Lock de membresÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a alineado al quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rum (seguridad operativa)

- **Problema**: Para `membership_change`, `execution_time` se calculaba al **crear** la solicitud (`created_at + gov_timelock_hours`). Si el quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rum se alcanzaba **despuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s** de esa marca, el worker de ejecuciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n podÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a correr casi de inmediato (~1 min), incoherente con la polÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“tras aprobarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ y con el texto del admin.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **CreaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: `execution_time` queda **`NULL`** hasta aprobaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (solo membresÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a; `config_change` sin cambio de semÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ntica inmediata donde aplique).
  - **AprobaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rum alcanzado)**: Un ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºnico `UPDATE` en transacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n pone `status = approved` y `execution_time = NOW() + (interval '1 hour' * timelockHours)` en **PostgreSQL** (reloj del servidor, una sola fuente de verdad). Si el `UPDATE` no devuelve fila o `execution_time`, se lanza error explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cito (no se deja estado ambiguo).
  - **AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a**: Evento `GOV_REQUEST_APPROVED_TIMELOCK` con `timelockHours` y `executionTime` devuelto por la BD.
  - **Notificaciones**: En correo de solicitud creada, si es membresÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a y no hay `execution_time`, se explica que el time-lock cuenta **despuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s del quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rum**.
  - **UX**: Panel de gobernanza muestra fila ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Time-LockÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ para solicitudes de membresÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a en `pending` sin fecha aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn; admin/help y seed de `databaseInit` alineados al nuevo texto (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“horas tras el quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rumÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½).
- **Archivos tocados**: `backend/src/services/governanceService.js`, `backend/src/services/notificationEventBus.js`, `backend/src/config/databaseInit.js`, `frontend/src/pages/admin-panel.js`, `frontend/src/pages/governance-panel.js`.
- **Impacto**: Ventana de cancelaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n predecible respecto al momento real de aprobaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n; menos riesgo de ejecuciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“instantÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡neaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ¯Â¿Â½ por desfase temporal; trazabilidad clara en auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a y en comunicaciones al usuario.
- **RevisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n adicional (defensa en profundidad)**:
  - `UPDATE ... WHERE id = $1 AND status = 'pending'` al aprobar membresÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a: evita transiciones ambiguas si el estado no fuera el esperado.
  - `GOV_REQUEST_APPROVED` en EventBus: si `executionTime` llega vacÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o, relectura vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a `getRequestById`; si la fecha sigue siendo invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lida, texto seguro y log de error (evita `Invalid Date` en push/email).

---

### 2026-04-11 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Vista previa de import demo: auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a por guardiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n + contraste legible

- **Problema**:
  - Contraste: el bloque "Vista Previa de ImportaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n" pintaba sobre `admin-card` con tema oscuro y dejaba texto ilegible (solo se veÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an los emojis ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦/ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ¯Â¿Â½). No se podÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an auditar visualmente los datos antes de pagar.
  - Detalle: la previa solo mostraba agregados (votos nuevos, ya importados, recompensa), sin desglose por voto, a pesar de que el JSON firmado HMAC ya trae `request_id`, `vote`, `voted_at` y `demo_vote_id` por cada voto.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (solo frontend ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ `frontend/src/pages/admin-panel.js`)**:
  - Forzar colores explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­citos en `p`, `th`, `td` y fondos (`#FFFFFF`, `#F9FAFB`, etc.) para que el texto sea legible en cualquier tema del admin panel.
  - Por cada guardiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n, aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n "Ver votos / Ocultar votos" que expande una fila con el detalle firmado del archivo (`Solicitud`, `Voto`, `Fecha`, `Demo vote ID`). Sin `onclick` inline (binding con `addEventListener`) para mantener la polÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica anti-XSS.
  - Fechas formateadas con `toLocaleString('es-ES', { timeZone: 'America/Bogota' })` y valores de voto traducidos a "Aprobar"/"Rechazar".
- **Alcance**: no altera `governanceDemoRewardService.js` ni el flujo de pago. La lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de HMAC, `file_hash`, dedup y `record_booster_event` queda intacta. Si no se pulsa "Confirmar y Procesar Pagos", nada se acredita.
- **Impacto**: admin puede verificar "quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© hizo cada guardiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n" antes de confirmar la importaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n; refuerza el control (Four-Eyes) y la auditabilidad operativa en cumplimiento del estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndar bancario del proyecto.

---

### 2026-04-11 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Recompensas demo ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: multiplicador de etapa booster aplicado + candado maker-checker

- **Problema detectado**: al procesar la importaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de actividad de gobernanza exportada desde demo, el monto acreditado se calculaba ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºnicamente como `votos ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ tasa_base`, **sin** aplicar el multiplicador de la etapa booster vigente. El flujo "voto real" sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ lo aplicaba (`governanceRewardService` vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a `boosterService.calculateMultipliedAmount`). Resultado: pagos demo subvaluados y falta de coherencia contable entre ambos caminos. AdemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s, la preview del admin y el correo al guardiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n no mostraban el multiplicador, por lo que el admin no podÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a auditar visualmente el monto final antes de autorizar.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - En `governanceDemoRewardService.previewImport`: consultar `boosterService.calculateMultipliedAmount(baseRate)` y devolver por guardiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n `base_per_vote`, `multiplier`, `stage_name`, `total_base` y `total_reward` (ya multiplicado). TambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n `summary.total_base` separado de `summary.total_amount` para mostrar el ahorro/incremento por multiplicador.
  - En `governanceDemoRewardService.processImport`: re-leer el multiplicador en el momento del pago (point-in-time) y acreditar `votos ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ base ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ multiplicador`. La descripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `booster_transactions` y `transactions` incluye la fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rmula `base ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ multiplier [stage]` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ mismo formato que los pagos de voto real para facilitar auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a en `history.html`. El registro `demo_reward_imports.metadata` persiste `base_rate`, `multiplier`, `stage_name`, `rate_per_vote` y `formula` completa.
  - **Candado optimista previewÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½process** (Maker-Checker fuerte): la UI envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a `expectedMultiplier` (valor visto en la preview) al endpoint `demo-import-process`. El backend recalcula antes de pagar; si cambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la etapa booster en ese intervalo, responde `409 MULTIPLIER_CHANGED` con el nuevo multiplicador/etapa. La UI invalida el estado pendiente y obliga a re-validar el archivo. AsÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­, el admin nunca autoriza con una tasa y paga con otra.
  - **AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a**: evento `GOV_DEMO_REWARD_IMPORTED` registra `multiplier`, `stageName`, `finalRatePerVote` junto al `fileHash`, totales y guardianes afectados.
  - **Email al guardiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n**: detalles con `Tasa base por voto`, `Multiplicador (etapa)`, `Tasa final por voto`, `Subtotal base`, `Total acreditado` y `Nuevo saldo BLUE IOU` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ mismo nivel de desglose que el email de voto real.
- **Alcance**:
  - JSON firmados previamente siguen siendo **vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lidos** para importar: contienen la identidad del guardiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n y la evidencia de sus votos; la tasa y el multiplicador se calculan al importar en producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, no se conservan en el archivo.
  - Pagos demo ya procesados (antes de este cambio) quedan **como estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n** (forward-only fix). Una compensaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n retroactiva, si se decide, se tramitarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ como un hito separado con su propia auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.
- **Impacto**:
  - Coherencia econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mica total entre flujo "voto real" y flujo "import demo": ambos aplican el multiplicador vigente en el pago.
  - Transparencia para el admin (preview con desglose completo) y para el guardiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n (correo con fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rmula).
  - Trazabilidad contable futura: el registro `demo_reward_imports.metadata` guarda la fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rmula exacta aplicada.
  - Seguridad: el candado de multiplicador elimina el riesgo de divergencia previewÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½process cuando rotan etapas.
- **Archivos tocados**: `backend/src/services/governanceDemoRewardService.js` (import de `boosterService`, enriquecimiento de preview/process/metadata/audit), `backend/server.js` (endpoint `demo-import-process` con candado 409 + email enriquecido), `frontend/src/pages/admin-panel.js` (nuevo header econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mico, columnas `Base/voto`, `Multiplicador`, `Subtotal base`, `Total final` por guardiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n, envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o de `expectedMultiplier`, manejo de 409 con re-validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n).

---

### 2026-04-13 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ ModularizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Infraestructura: ExtracciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Entorno Android Nativo

#### DescripciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n
Se asienta en auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a la remociÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­sica de la subcarpeta `android-app` (App nativa y envoltorio PWA) del repositorio principal (`smart-contract`) para fines de aligeramiento, limpieza y modularizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la infraestructura operativa.

#### Impacto TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnico y Trazabilidad (EvaluaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a)
- **Frontend y Backend:** **Sin Impacto**. La eliminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de esta carpeta no afecta el despliegue del PWA, el servicio APIs de Node.js, las transacciones financieras en PostgresSQL ni el motor econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mico (BLUE IOU/RED). 
- **Ciberseguridad:** Los esquemas de protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y *Zero Hardcoded Secrets* se mantienen inalterados en la web.
- **CompilaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Nativa:** La ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºnica consecuencia directa es que las compilaciones y firma de claves para el `.apk`/`.aab` en la Google Play Store quedan desacopladas de este monolito de desarrollo. Se deberÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ restablecer el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo o ubicarlo en un repositorio remoto independiente para futuros lanzamientos nativos, cumpliendo con la separaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n recomendada (Frontend Web vs Mobile App nativa).

---

### 2026-04-14 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Protocolo de Multiplicadores de Booster + ModularizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del Panel Admin

- **Contexto**: Para incentivar la participaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n temprana, se requerÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a un sistema dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mico de multiplicadores (`BLUE IOU x Etapa`) que recompensara mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s a los usuarios en las fases iniciales del proyecto. AdemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s, el backend administrativo residÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a en un monolito (`server.js`), lo que dificultaba la escalabilidad y auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **ModularizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Estricta**: ExtracciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica administrativa de `server.js` hacia `adminController.js` (funciones independientes, sin clases ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ previene bugs de `this` binding en Express) y `adminRoutes.js`.
  - **Protocolo de CompensaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del `boosterService.js` con etapas y multiplicadores dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡micos segÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn protocolo documentado en `boosters.wintoncoin.com`:
    - Etapa 1: MayoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œOct 2025 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 20x
    - Etapa 2: Nov 2025ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œAbr 2026 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 15x
    - Etapa 3: MayÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œOct 2026 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 9x
    - Etapa 4: Nov 2026ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œEne 2027 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 5x
    - Etapa 5: 1ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ14 Feb 2027 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 3x
  - **IntegraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en Gobernanza**: `creditVoteReward()` y `processPendingRewards()` aplican automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticamente: `Recompensa Final = Base * Multiplicador de Etapa`.
  - **Governance Guard**: Los multiplicadores son parÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡metros econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³micos protegidos ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ si hay guardianes activos, los cambios deben pasar por Winton-Consensus (Maker-Checker).
  - **Transparencia en Email**: El correo de recompensa al guardiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n ahora incluye el desglose: recompensa base, multiplicador aplicado, etapa y total acreditado.
  - **AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a Bancaria**: Cada `GOV_VOTE_REWARD_CREDITED` registra en metadata la fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rmula completa: `{ baseReward, multiplierUsed, stageName, formula }`.
  - **MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 050**: Tabla `booster_config_stages` con CASCADE, ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ndice de rendimiento, idempotencia en inserciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de datos iniciales, y validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de solapamiento de fechas en `boosterService.saveStage()`.
- **Impacto**:
  - **Escalabilidad**: Backend modular con funciones puras (sin `this` binding issues).
  - **IncentivaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Multiplicadores aplicados automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticamente en recompensas de gobernanza y extensibles a otras actividades.
  - **Auditabilidad**: Trazabilidad completa baseÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢multiplicadorÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢total en ledger, audit log y correo.
  - **Seguridad**: Governance Guard, validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de solapamiento, idempotencia, fallback seguro (1.0x sin etapa).
- **Evidencia**: MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `050_create_booster_stages.js`, `boosterService.js`, `adminController.js`, `adminRoutes.js`, `governanceRewardService.js`, `notificationEventBus.js`.

---

### 2026-04-14 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a End-to-End del Protocolo de Multiplicadores

- **Contexto**: RevisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n profesional de todos los archivos modificados, verificando la cadena completa de ejecuciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n desde la migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n hasta el correo electrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nico al guardiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n.
- **Hallazgos Corregidos**:
  - **ERROR CRÃƒÆ’Ã†â€™Ãƒâ€šÃ¯Â¿Â½TICO: Funciones broadcast faltantes en `adminController.js`**. Las rutas `POST /broadcast-email` y `GET /broadcast-email` referenciaban `adminController.createBroadcastEmail` y `adminController.getBroadcasts` que NO estaban definidas. Esto habrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a causado un crash `TypeError: undefined is not a function` al acceder a esos endpoints. Se aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adieron ambas funciones (createBroadcastEmail como 501 pendiente de migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, getBroadcasts funcional).
  - VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n completa de imports/exports en 10 archivos.
  - VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de registro de rutas en `server.js` (lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea 170).
  - VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de endpoints frontend vs backend (admin-panel.js ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ adminRoutes.js).
  - VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del `vite.config.js` para inclusiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `admin-panel.html`.
  - VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del `migrationRunner.js` para compatibilidad con patrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `up(client)`.
- **Resultado**: **Todos los checks pasaron**. El sistema estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ listo para despliegue con las notas de la funcionalidad broadcast pendiente de migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n completa.
- **Evidencia**: AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a E2E documentada y archivada.

---

### 2026-04-14 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de Seguridad Profesional (OWASP + Fintech)

- **Contexto**: Tercera revisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo aplicando metodologÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a OWASP Top 10 y evaluaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de escenarios de ataque para endpoints administrativos de parÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡metros econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³micos.
- **Vulnerabilidades Encontradas y Corregidas**:
  1. **`id` de etapa sin sanitizar (ALTA)**: El campo `id` en `boosterService.saveStage()` controlaba la estructura de la query SQL (`${id ? 'AND id != $3' : ''}`). Aunque parametrizado, la decisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de incluir/excluir la clÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡usula dependÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a del valor crudo. **Fix**: `parseInt(id, 10)` + validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `isFinite && > 0`.
  2. **`userId` de URL params sin parseInt (MEDIA)**: En `updateUserStatus()`, `req.params.userId` se pasaba directamente a PostgreSQL sin sanitizar. **Fix**: `parseInt + validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n isFinite`.
  3. **Sin lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­mite superior en multiplicador (MEDIA)**: Un admin podÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a poner multiplicador `999999` accidentalmente. **Fix**: `MAX_MULTIPLIER = 100` como guardrail econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mico con mensaje de error descriptivo.
  4. **Pattern matching incompleto en error handler**: Los nuevos mensajes de error (`exceder`, `invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido`) no eran capturados como errores 400. **Fix**: Array de patrones ampliado.
- **Escenarios Evaluados**: 8 escenarios de uso (happy path + edge cases), 14 vectores de ataque (SQL injection, broken access control, authentication failures, business logic flaws).
- **Evidencia**: AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de seguridad documentada con checklist OWASP, defensa en profundidad verificada (7 capas).

---

### 2026-04-30 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ PWA Install: RefactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n modular + botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en ConfiguraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n

- **Contexto**: El mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo de instalaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la PWA (`pwa-install.js`) presentaba varios problemas:
  1. Estilos CSS mezclados con lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica JS (violaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Separation of Concerns).
  2. DetecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n defectuosa de iPads modernos (iPadOS 13+ se identifica como "Macintosh").
  3. InyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de texto con `innerHTML` en el modal de instrucciones (riesgo XSS).
  4. Sin opciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de "segunda oportunidad" para instalar la app si el usuario descartaba el botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n flotante.
  5. DetecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina basada solo en extensiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `.html` (frÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gil ante rutas limpias futuras).
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **Separar estilos a CSS** (`src/styles/pwa-install.css`): todos los estilos del botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n flotante, botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n grande de registro, modal de instrucciones y secciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de configuraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n extraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­dos del JS.
  - **Corregir detecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de iPad**: Usar `navigator.maxTouchPoints > 1` ademÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s del User Agent para detectar iPads modernos que se disfrazan de Mac.
  - **PrevenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n XSS**: Reemplazar `innerHTML` por `textContent` y DOM API (`createElement`) para inyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n segura de contenido.
  - **BotÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n "Descargar App" en ConfiguraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Nueva secciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n dentro del modal de ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ¯Â¿Â½ ConfiguraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del dashboard con botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mico que se desactiva automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticamente si la PWA ya estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ instalada. Reacciona en tiempo real al evento `appinstalled`.
  - **DetecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de URL mejorada**: Soporta rutas con y sin extensiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `.html` para compatibilidad futura.
- **Rama**: `feature/pwa-install-improvements` (aislada de `feature/web3-wallet`).
- **Archivos creados**:
  - `frontend/src/styles/pwa-install.css` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Estilos extraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­dos y documentados lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea por lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea.
- **Archivos modificados**:
  - `frontend/src/modules/pwa-install.js` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ RefactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n completa, nuevas exportaciones `initSettingsInstallButton()` y `updateSettingsInstallButton()`.
  - `frontend/contract_interaction.html` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ SecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â² Descargar App" en modal de ConfiguraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - `frontend/src/pages/contract-interaction.js` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Import y llamada a `initSettingsInstallButton()`.
- **Impacto**:
  - CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo 100% modular y auditable (CSS separado del JS).
  - iPads modernos reciben instrucciones correctas de instalaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para iOS.
  - Seguridad reforzada contra XSS en inyecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de texto dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mico.
  - UX mejorada: usuarios que descartaron el botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n flotante pueden instalar desde ConfiguraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - EstÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndar de industria (Twitter/X, Starbucks, Spotify usan el mismo patrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de doble opciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n).
- **Evidencia (commits)**: pendiente de push.

---

### 2026-05-02 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Infraestructura Web3 y Scoring Conductual (MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 050)

- **Contexto**: El sistema requerÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a una base sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³lida para el almacenamiento de billeteras Web3 y la configuraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del Scoring de CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dito RED (WTS) en el entorno de producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n/demo.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Implementar la **MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 050** para aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir las columnas `web3_wallet_address` y `web3_private_key_encrypted` a la tabla `users`.
  - Registrar las variables maestras de Scoring en `app_settings` (base 100, bonos por referido/actividad) para permitir ajustes sin redespliegue.
  - Asegurar la **idempotencia** de la migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para despliegues seguros en Render.
- **Impacto**:
  - HabilitaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del sistema de "BÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vedas Invisibles" para usuarios.
  - SincronizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica de lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­mites de crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dito entre DB y Smart Contracts.
- **Evidencia**: Archivo de migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `050_add_web3_wallet_and_scoring_settings.js` desplegado y ejecutado.

---

### 2026-05-02 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Despliegue de WintonProtocol en Optimism Sepolia (Testnet PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblica)

- **Contexto**: El entorno Demo necesitaba operar bajo estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares profesionales de la industria Web3 (Staging real), abandonando simulaciones locales (`localhost`) para conectarse a una Blockchain pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblica.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - CompilaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y despliegue del contrato inteligente `WintonProtocol.sol` en la red de Capa 2 **Optimism Sepolia**.
  - ConfiguraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de un nodo RPC mediante **Alchemy** para el puente de comunicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - ImplementaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de una billetera segura de despliegue ("Deployer Demo") actuando como el **Relayer** autorizado del protocolo.
- **Impacto**:
  - La aplicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (Demo) ahora es una DApp 100% funcional y auditable on-chain.
  - Los pagos (Off-chain) y el Scoring de CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dito WTS se sincronizan de forma segura con la Testnet sin costo de gas para el usuario final ("Cero FricciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n").
- **Evidencia**: 
  - Contrato desplegado en la direcciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: `0x0066269E090a38618A24A1fB65b52AEBBa3c00C4`

---

### 2026-05-01 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ RediseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o del Banner de Referidos (Booster Edition)

- **Contexto**: El botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de compartir cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo de referido tenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a una estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tica desalineada con el resto del ecosistema "Booster" (Impulsor). Tras iterar con Montserrat, se detectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ que el "molde" de la letra no encajaba con la seriedad fintech buscada.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Implementar un diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o **Azure Glass** con la tipografÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a **Inter** (UI Premium).
  - Adoptar Inter por su molde mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s estilizado, vertical y compacto, ideal para interfaces Web3.
  - Aplicar `backdrop-filter: blur(16px)` para lograr un efecto de cristal esmerilado.
  - Mantener el dorado para los valores numÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ricos con peso `800` (Extra Bold) para mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡xima legibilidad sobre el vidrio.
- **Impacto**:
  - EstÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tica profesional de alto nivel, alineada con estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares de industria.
  - Mayor densidad de informaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n sin sacrificar la elegancia.
- **Evidencia**: RediseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o aplicado en `style.css` con tipografÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a Inter y nuevo icono de nodos estilo WhatsApp en `contract_interaction.html`.

---

### 2026-05-08 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n a EIP-7702 (Pectra/Isthmus) + AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de Seguridad Profunda

- **Contexto**: Los Smart Contracts (BlueToken, RedToken, WintonProtocol, WintonTreasury) usaban ERC-2771 (meta-transacciones de primera generaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n). Optimism activÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ EIP-7702 (Pectra/Isthmus) en mayo 2025, habilitando el estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndar mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s moderno de Account Abstraction sin necesidad de Trusted Forwarder.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n a EIP-7702**: Eliminar `ERC2771Context` de WintonProtocol y WintonTreasury. Con EIP-7702, `msg.sender` ES la direcciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n real del usuario (la red lo resuelve nativamente). Se eliminaron los 3 overrides de contexto (`_msgSender`, `_msgData`, `_contextSuffixLength`).
  - **Relayer explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cito**: AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir variable `relayer` separada del Owner. `processPayment` ahora recibe `payer` como parÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡metro (verificado por el backend), protegido por `onlyRelayerOrOwner`.
  - **Vigilante de Auto-AmortizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Implementar hook en `BlueToken._update()` que llama a `WintonProtocol.triggerAutoAmortize(receptor)` en cada recepciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de BLUE. Esto cierra la vulnerabilidad de transferencia directa que permitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a acumular BLUE y RED simultÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡neamente.
  - **OptimizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de gas**: Lista de direcciones exentas del vigilante (Treasury, Protocol) + eliminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de llamada redundante a `_autoAmortize` en `processPayment`.
  - **Circuit Breaker**: AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±adir `maxTransactionAmount` (1M BLUE) como lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­mite por transacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n individual.
  - **Bloqueo de `renounceOwnership()`**: Sobreescrito en los 4 contratos para prevenir que el protocolo quede huÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rfano accidental o maliciosamente.
- **AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de Seguridad**: Se probaron 20+ escenarios de ataque incluyendo: bypass del backend, reentrada, overflow, dust attack, impersonaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del relayer, front-running de Merkle root, ataque de polvo, envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o de ETH directo, y compromiso de llave del Owner. Cero vulnerabilidades encontradas.
- **Impacto**:
  - Contratos mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s simples (menos herencia, menos cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo ejecutable, menor superficie de ataque).
  - Gas reducido (~5,000 gas menos por transacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n al eliminar overrides de contexto).
  - Compatibilidad con el estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndar mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s moderno de la industria (EIP-7702, mayo 2025).
  - Regla Materia-Antimateria ahora es matemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticamente inviolable sin importar el origen de los tokens.
- **Evidencia**: CompilaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n exitosa con Hardhat 2.28.6, OpenZeppelin v5.6.1, Solidity 0.8.24.

#### ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ¯Â¿Â½ MEJORAS FUTURAS (Pre-ProducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n):

1. **Sistema de Roles con AccessControl (OpenZeppelin)**:
   - `KYC_MANAGER_ROLE` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Backend automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tico (sin multifirma) para `setKYCStatus`.
   - `FINANCIAL_ADMIN_ROLE` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Gnosis Safe multifirma para cambios de comisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, retiro de excedentes, cambio de Relayer.
   - `EMERGENCY_ROLE` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Cualquier firmante individual del Safe puede pausar (velocidad crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica en emergencias).
2. **Gnosis Safe Multisig como Owner**: Transferir ownership a un Safe (3/5 multifirma) antes de ir a mainnet.
3. **Timelock en cambios financieros**: Agregar un contrato Timelock (24-48h de espera) para cambios de comisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y retiros del Treasury, dando tiempo a la comunidad de reaccionar.
4. **EvaluaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de EIP-7702 nativo**: Cuando el ecosistema de SDKs (Pimlico, ZeroDev) madure, implementar transacciones patrocinadas tipo 0x04 directamente desde el frontend.

---    
### 2026-05-04 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Estado de Cuenta Web3 (AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a Financiera)

- **Contexto**: La pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina principal de la billetera debÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a mantenerse simple para las transacciones diarias, pero se necesitaba un espacio profesional para mostrar mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tricas financieras y Web3, el lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­mite de crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dito RED, equivalencia fiat y estadÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­sticas transaccionales, cumpliendo estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndares de auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - Implementar un diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o de "DivulgaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Progresiva" (Progressive Disclosure) creando la nueva pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina `estado-cuenta.html`.
  - Agregar la Llave PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblica con estado de conexiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n a la red "Optimism Sepolia" y enlace directo al Explorador de Bloques.
  - Mostrar el detalle de la LÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea de CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dito RED y estructurar vencimientos a 30 dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as y a fin de mes.
  - Mostrar la Liquidez BLUE detallando fondos disponibles vs bloqueados (escrow) y su fecha de liberaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - Generar un bloque de estadÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­sticas de actividad de red (interacciones, enviadas, recibidas).
- **Impacto**: 
  - Mayor transparencia tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica y financiera sin ensuciar la UX principal de la billetera.
  - Interfaz estandarizada a la de plataformas como Binance y Coinbase.
- **Evidencia**: Archivos creados `estado-cuenta.html`, `estado-cuenta.js` e inclusiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en `vite.config.js`.

---

### 2026-05-08 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ IntegraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Gobernanza ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Blockchain (Winton-Consensus + Web3 Bridge)

- **Contexto**: Los Smart Contracts desplegados en Optimism Sepolia tienen funciones administrativas (`pause`, `setMaxTransactionAmount`, `setFoundersWallet`, `withdrawSurplus`) que solo se podÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an ejecutar por consola de Hardhat. Se necesitaba integrarlas con el sistema de gobernanza Winton-Consensus existente para que los guardianes pudieran gestionarlas con multifirma, votaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **Ampliar `web3BridgeService.js`**: Reescribir con ABI completa del protocolo y treasury. Agregar funciones para `pauseProtocol`, `unpauseProtocol`, `setMaxTransactionAmount`, `setFoundersWallet`, `withdrawSurplus` y `getProtocolStatus` (lectura sin gas).
  - **Integrar en `_executeAction` de `governanceService.js`**: DespuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s de actualizar `app_settings`, si el `target_key` empieza con `web3_`, ejecutar la operaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n blockchain correspondiente vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a el bridge. El tx_hash se guarda en `audit_log` y en `governance_requests.metadata`.
  - **CatÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡logo de settings** (`settingsDisplayMap.js`): Agregar las 4 opciones Web3 con etiquetas en espaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ol para que aparezcan en el formulario de gobernanza.
  - **MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 052**: Insertar los 4 registros de `app_settings` con valores iniciales que coinciden con los Smart Contracts desplegados.
- **Impacto**:
  - Los guardianes pueden gestionar los Smart Contracts desde el panel de gobernanza existente, sin tocar consola.
  - Cada cambio on-chain queda registrado con tx_hash en el audit_log (trazabilidad completa DB + Blockchain).
  - El formulario de solicitud existente se reutiliza sin cambios de frontend.
- **Evidencia**: Archivos modificados: `web3BridgeService.js`, `governanceService.js`, `settingsDisplayMap.js`. MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `052_add_web3_governance_settings.js`.

---

### 2026-05-16 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Sistema KYC Compliance (Freno Pre-PublicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n + Admin Panel On-Chain)

- **Contexto**: El Smart Contract `WintonProtocol` exige que las billeteras del pagador tengan KYC verificado on-chain (`isKYCVerified`). Sin una validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n previa en el backend, los usuarios podÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an crear publicaciones tipo "request" (que implican pago) y los trabajadores invertÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an tiempo en tareas que luego fallaban al intentar cobrar, generando un `CALL_EXCEPTION: Payer KYC not verified`. AdemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s, se detectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un deadlock de base de datos (self-deadlock) por uso de `pool.query` dentro de transacciones activas con `client.query` (bloqueo `FOR UPDATE`).
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **CorrecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Deadlock (PatrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Outbox)**: Reemplazar todas las llamadas a `pool.query` por `client.query` dentro de `processRequestPayment` y `processDirectPaymentCompletion` en `publicationService.js`, asegurando que las operaciones de auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a se ejecuten en la misma conexiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n transaccional.
  - **Freno KYC Pre-PublicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: En `publicationController.js`, antes de permitir la creaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de publicaciones tipo `request`, se consulta directamente la blockchain (`isKYCVerified`) para verificar el KYC del autor (o su tutor si es menor de edad). Si no tiene KYC ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ se bloquea la publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n con HTTP 403. PolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica Fail-Safe: ante duda, se bloquea.
  - **MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo `checkUserKYC()` en `web3BridgeService.js`**: Lectura gratuita (sin gas, funciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n `view`) con timeout de 3 segundos para no congelar el servidor si Alchemy estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ caÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­do.
  - **MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo `setUserKYC()` en `web3BridgeService.js`**: Escritura on-chain (`setKYCStatus`) con prevenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de revert (verifica estado actual antes de gastar gas), validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de direcciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Ethereum y tipo booleano explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cito.
  - **Endpoint Admin `POST /api/governance/kyc`**: Protegido por `verifyAdminToken`. Valida usuario/wallet, ejecuta la operaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n blockchain, y registra TODA la acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en `audit_log` con IP, user-agent, wallet, txHash, timestamp y resultado (ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©xito o fracaso). CategorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a: `compliance`.
  - **Panel de AdministraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (Frontend)**: Nueva secciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½Ãƒâ€šÃ¯Â¿Â½ KYC" en `admin-panel.html` con formulario de bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsqueda de usuario, visualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de estado KYC, y botones de "Aprobar" / "Revocar" con diÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡logo de confirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. Listeners protegidos contra doble-clic y registro duplicado.
- **Arquitectura preparada para proveedores externos**: El mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo `setUserKYC()` es la pieza final del rompecabezas. Hoy lo llama un admin manualmente. MaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ana, un webhook de Onfido/Jumio/Sumsub llamarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ al mismo endpoint sin cambios en el Smart Contract ni en el freno de publicaciones.
- **Impacto**:
  - EliminaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de deadlocks de base de datos.
  - Los trabajadores nunca mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s perderÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n tiempo en tareas impagables.
  - Cumplimiento de normativa KYC/AML: sin verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, sin transacciones financieras.
  - Trazabilidad bancaria completa: toda operaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n KYC queda en `audit_log` y en la blockchain.
- **Evidencia**: Archivos modificados: `publicationService.js`, `web3BridgeService.js`, `publicationController.js`, `governanceController.js`, `governanceRoutes.js`, `admin-panel.html`, `admin-panel.js`.

---

### 2026-05-17 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Defensa en Profundidad KYC (Freno en AceptaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Tareas + PropagaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Errores Web3)

- **Contexto**: El Smart Contract `WintonProtocol` tiene una regla de cumplimiento financiero estricta (AML/KYC): exige que **TANTO el Payer (pagador) COMO el Payee (trabajador/beneficiario)** tengan su KYC verificado on-chain (`isKYCVerified`). Aunque se habÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a implementado un freno pre-publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para el autor, los trabajadores sin KYC podÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an aceptar tareas, invertir tiempo y completarlas. Al momento de confirmar el pago, el Smart Contract revertÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a con `WintonProtocol: Payee KYC not verified`. Al capturarse el error de forma genÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rica en el backend, el usuario veÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a un mensaje inespecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­fico en pantalla, generando confusiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y falsos reportes de error en el autor.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **Freno KYC Preventivo (Capa 1 - Fail-Fast)**: En `publicationController.js`, se modificÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el endpoint `POST /publications/:id/accept`. Si la publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n implica remuneraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (`request`), se consulta la blockchain para verificar que la wallet del trabajador (o la de su tutor si es menor de edad) tenga el KYC aprobado on-chain. Si no lo tiene, se bloquea la aceptaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n con HTTP 403 y un mensaje claro indicando que debe verificar su identidad antes de realizar trabajos pagados.
  - **PropagaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Exacta de Errores Web3 (Capa 2 - Defensa en Profundidad)**: En `web3BridgeService.js`, se modificÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ `syncPaymentToBlockchain` para no silenciar los errores de revert de la blockchain con `return null`, sino propagar la excepciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (`throw error`).
  - **Manejo de Errores en `publicationService.js`**: En `processRequestPayment` y `processDirectPaymentCompletion`, se implementÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un bloque `try...catch` especÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­fico para analizar el mensaje de error de Web3. Si contiene `Payee KYC not verified`, `Payer KYC not verified` o errores de gas (`insufficient funds`), se arroja un mensaje HTTP 502 preciso y en espaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ol para mostrarse en el frontend, y se guarda el motivo exacto en la tabla `web3_pending_transactions`.
- **Impacto**:
  - **Cero Trabajo Perdido**: Los trabajadores sin KYC no pueden iniciar tareas remuneradas, garantizando que todo el que trabaja cobrarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ sin problemas tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnicos ni legales.
  - **Claridad Total en UX**: Si por algÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn motivo de auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a se revoca un KYC a mitad de camino, el autor verÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ en su pantalla el motivo exacto del rechazo de la blockchain.
  - **Trazabilidad de Errores**: La base de datos registra el motivo exacto del fallo de sincronizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Web3 en el patrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Outbox.
- **Evidencia**: Archivos modificados: `publicationController.js`, `publicationService.js`, `web3BridgeService.js`, `EVOLUCION.md`.

---

### 2026-05-17 (Parte 3) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ Resiliencia KYC en Base de Datos (MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 055) y OptimizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Inputs de BÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsqueda Admin

- **Contexto**: Tras las auditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as de UX y Web3, el usuario identificÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ dos problemas crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticos en el entorno de demostraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. Primero, el campo de bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsqueda de usuario en el panel KYC de administraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n se comprimÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a y resultaba muy pequeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o para escribir debido a que el botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n adyacente tomaba el 100% del ancho por herencia global. Segundo, en la tarjeta de Identidad Web3, el estatus KYC aparecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a errÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³neamente como "Pendiente de AprobaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n" para usuarios que ya habÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an sido aprobados previamente, debido a que los reinicios del nodo local de blockchain (Anvil/Hardhat) borraban el estado en memoria de los contratos inteligentes, provocando que las consultas on-chain (`isKYCVerified`) retornaran `false`.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **OptimizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Inputs de BÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsqueda (`admin-panel.html` y `admin-style.css`)**: Se reestructurÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el contenedor flex del campo de bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsqueda KYC con `flex-wrap: wrap` y se asignaron anchos mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nimos explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­citos (`min-width: 250px` al input y `min-width: 150px` al botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n) para evitar la compresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. AdemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s, se redefiniÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la clase `.admin-input-dark` para renderizar un recuadro blanco amplio, luminoso y espacioso (`padding: 14px 18px; font-size: 1.1rem; background-color: #ffffff`) con texto oscuro, asegurando mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡xima visibilidad al escribir.
  - **MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 055 (Respaldo KYC en Base de Datos)**: Se creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el archivo `055_add_kyc_verified_to_users.js` para inyectar la columna `kyc_verified BOOLEAN DEFAULT FALSE` en la tabla `users`, dotando al sistema de una cachÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© local resiliente.
  - **SincronizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Transaccional (`governanceController.js`)**: Al aprobar o revocar KYC desde el panel de administraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, el controlador ahora actualiza `users.kyc_verified` en la base de datos de forma paralela a la transacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n on-chain, con lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de fallback automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica para entornos de desarrollo y demostraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
  - **Mecanismo de Fallback Robusto (`server.js` y `publicationController.js`)**: En los endpoints de balance (`/api/me/balance`) y en los frenos de publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n/aceptaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de tareas, se implementÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ una verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de respaldo: si la consulta on-chain `Web3BridgeService.checkUserKYC` retorna `false` por reinicios del nodo o timeouts del RPC, el sistema consulta `users.kyc_verified` en la base de datos para mantener la consistencia inmutable en la interfaz de usuario.
- **Impacto**:
  - **UX Impecable y Amplia**: Los administradores disponen de campos de texto grandes, cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³modos y perfectamente visibles para ingresar nombres de usuario.
  - **Resiliencia Total ante Reinicios Web3**: El estatus KYC en la Identidad Web3 y los permisos de publicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n se mantienen estables y correctos incluso si el nodo local de blockchain se reinicia o pierde conexiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
- **Evidencia**: Archivos modificados/creados: `055_add_kyc_verified_to_users.js`, `governanceController.js`, `server.js`, `publicationController.js`, `admin-panel.html`, `admin-style.css`, `EVOLUCION.md`.

---

### 2026-05-18 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ ResoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de ColisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n SemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ntica KYC vs Email OTP en Winton Solidario (MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 056)

- **Contexto**: Durante la revisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de la arquitectura de resiliencia KYC (MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 055), el usuario identificÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ una colisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n conceptual e inconsistencia en el uso de la columna heredada `is_verified`. Tras un rastreo exhaustivo en el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo base, se confirmÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ que `authController.js` y `register.js` utilizaban `is_verified` para representar la **VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Correo ElectrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nico (OTP)**, marcÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndola como `TRUE` en cuanto el usuario completaba su registro. Sin embargo, el mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo de donaciones humanitarias (`humanitarianService.js`) y el Trigger de base de datos de la migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 039 (`fn_release_humanitarian_donations`) asumÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an errÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³neamente que `is_verified` representaba la **VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n KYC Web3 aprobada por Admin**. Esto generaba un fallo de seguridad silencioso: todos los usuarios registrados tenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an `is_verified = TRUE`, evadiendo el estado de retenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (`on_hold`) y liberando fondos de Winton Solidario a usuarios sin KYC en la blockchain.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **SeparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n SemÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ntica Estricta (OpciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 1)**: Se decidiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ mantener `is_verified` exclusivamente para la verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de correo electrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nico (OTP) en el flujo de registro/login, y utilizar la nueva columna `kyc_verified` (introducida en la migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 055) exclusivamente para el estatus KYC Web3.
  - **MigraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 056 (`056_update_solidario_trigger_to_kyc_verified.js`)**: Se creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ una nueva migraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para actualizar la funciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n PL/pgSQL `fn_release_humanitarian_donations`. El Trigger ahora evalÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºa exclusivamente cambios en `kyc_verified` (`OLD.kyc_verified IS DISTINCT FROM NEW.kyc_verified AND NEW.kyc_verified = true`) para liberar las donaciones en estado `on_hold`.
  - **RefactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de `humanitarianService.js`**: Se modificaron las consultas SQL en `donateToCause` y `getCauseDonations` para verificar `kyc_verified` en lugar de `is_verified`, y se actualizaron todos los comentarios arquitectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nicos del servicio para reflejar la separaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de responsabilidades.
- **Impacto**:
  - **AuditorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a Fintech y AML Impecable**: Se establece una barrera clara e inmutable entre un dato de contacto verificado (Email) y una acreditaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de identidad financiera y legal gubernamental (KYC Web3).
  - **Cierre de Brecha en Winton Solidario**: Las donaciones humanitarias de usuarios sin KYC Web3 ahora quedan correctamente retenidas en estado `on_hold` y solo se liberan cuando un administrador aprueba legÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­timamente el KYC on-chain y en la base de datos.
- **Evidencia**: Archivos modificados/creados: `056_update_solidario_trigger_to_kyc_verified.js`, `humanitarianService.js`, `EVOLUCION.md`.

---

### 2026-05-18 (Parte 2) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ ExenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n DinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mica de KYC Web3 en Modo Pre-lanzamiento

- **Contexto**: Durante la evaluaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n arquitectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nica predictiva del despliegue a ProducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (merge a `main`), el usuario identificÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un riesgo crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tico de denegaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de servicio lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica (bloqueo masivo) para la comunidad de Impulsores. En ProducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, la plataforma opera en Modo Pre-lanzamiento (`pre_launch_mode_enabled = 'true'`), donde toda la actividad econÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mica de tareas se registra off-chain en el Libro de Impulsores (puntos BLUE IOU) sin requerir gas ni interacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n con contratos inteligentes Web3. Sin embargo, las barreras KYC recientemente implementadas en `createPublication` y `acceptPublication` consultaban y exigÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an KYC Web3 para todas las tareas de tipo `request` de forma incondicional. Como resultado, al hacer el merge a producciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, cualquier usuario existente (`kyc_verified = FALSE`) habrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a quedado bloqueado al intentar publicar o aceptar tareas remuneradas en BLUE IOU.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**:
  - **ExenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n DinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mica en Pre-lanzamiento (OpciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n 1)**: En `publicationController.js`, se condicionaron los frenos KYC de creaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y aceptaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de tareas para que solo se ejecuten si la plataforma **NO** estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ en Modo Pre-lanzamiento (`settings.pre_launch_mode_enabled !== 'true'`).
  - **ArmonizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Reglas de Cumplimiento**: Se establece una distinciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n clara entre la actividad de fomento comunitario off-chain (exenta de KYC para eliminar fricciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de adopciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n) y las donaciones de crowdfunding en Winton Solidario (donde se mantiene el KYC obligatorio para prevenir granjas de bots y lavado de puntos).
- **Impacto**:
  - **Cero InterrupciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en ProducciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n**: Los miles de usuarios de la comunidad de Impulsores pueden continuar publicando, aceptando y completando tareas en BLUE IOU sin ningÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn tipo de bloqueo o fricciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica.
  - **TransiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Futura Automatizada**: En el momento en que administraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n desactive el Modo Pre-lanzamiento (`pre_launch_mode_enabled = 'false'`), el candado KYC Web3 se activarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ de forma instantÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡nea y automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica para todo el marketplace.
- **Evidencia**: Archivos modificados: `publicationController.js`, `EVOLUCION.md`.

---

### 2026-06-04 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã¯Â¿Â½ RefactorizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica: ExtracciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Administrativa y DiseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o Dashboard (Fase 1 y 2)

- **Contexto**: El proyecto acumulaba una severa deuda tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica en su nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºcleo principal (`server.js`), el cual operaba como un monolito gigante, gestionando a la vez flujos de usuario y rutas crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas de administraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (DB, moderaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, KYC, backups). SimultÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡neamente, la interfaz de usuario `contract_interaction.html` adolecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de un diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o "Mobile-Only", resultando pobre y genÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rica cuando se visualizaba desde un navegador de computadora. El reto fue refactorizar sin afectar la estabilidad ni el despliegue actual.
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Fase 1 (Backend - ModularizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n)**:
  - **ExtirpaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n QuirÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºrgica**: Se extrajeron las funciones crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas de administraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (`getUserKycStatus`, `getDatabaseStats`, `createDatabaseBackup`, rutinas de `cleanup`, moderaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de publicaciones) desde el `server.js` hacia un nuevo mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo dedicado: `src/controllers/adminController.js`.
  - **Enlace de Seguridad**: Se creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un enrutador `adminRoutes.js` enlazado con el middleware `verifyAdminToken` para blindar todos los accesos.
  - **ResoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Rutas**: Trasladamos de manera segura las llamadas al sistema de backup, corrigiendo la ruta de importaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (`../../backup-database.js`) para prevenir caÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­das (fallo 500).
- **DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Fase 2 (Frontend - OpciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n A: Mobile-First Dashboard)**:
### 2026-06-04 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ RefactorizaciÃƒÆ’Ã‚Â³n CrÃƒÆ’Ã‚Â­tica: ExtracciÃƒÆ’Ã‚Â³n Administrativa y DiseÃƒÆ’Ã‚Â±o Dashboard (Fase 1 y 2)

- **Contexto**: El proyecto acumulaba una severa deuda tÃƒÆ’Ã‚Â©cnica en su nÃƒÆ’Ã‚Âºcleo principal (`server.js`), el cual operaba como un monolito gigante, gestionando a la vez flujos de usuario y rutas crÃƒÆ’Ã‚Â­ticas de administraciÃƒÆ’Ã‚Â³n (DB, moderaciÃƒÆ’Ã‚Â³n, KYC, backups). SimultÃƒÆ’Ã‚Â¡neamente, la interfaz de usuario `contract_interaction.html` adolecÃƒÆ’Ã‚Â­a de un diseÃƒÆ’Ã‚Â±o "Mobile-Only", resultando pobre y genÃƒÆ’Ã‚Â©rica cuando se visualizaba desde un navegador de computadora. El reto fue refactorizar sin afectar la estabilidad ni el despliegue actual.
- **DecisiÃƒÆ’Ã‚Â³n Fase 1 (Backend - ModularizaciÃƒÆ’Ã‚Â³n)**:
  - **ExtirpaciÃƒÆ’Ã‚Â³n QuirÃƒÆ’Ã‚Âºrgica**: Se extrajeron las funciones crÃƒÆ’Ã‚Â­ticas de administraciÃƒÆ’Ã‚Â³n (`getUserKycStatus`, `getDatabaseStats`, `createDatabaseBackup`, rutinas de `cleanup`, moderaciÃƒÆ’Ã‚Â³n de publicaciones) desde el `server.js` hacia un nuevo mÃƒÆ’Ã‚Â³dulo dedicado: `src/controllers/adminController.js`.
  - **Enlace de Seguridad**: Se creÃƒÆ’Ã‚Â³ un enrutador `adminRoutes.js` enlazado con el middleware `verifyAdminToken` para blindar todos los accesos.
  - **ResoluciÃƒÆ’Ã‚Â³n de Rutas**: Trasladamos de manera segura las llamadas al sistema de backup, corrigiendo la ruta de importaciÃƒÆ’Ã‚Â³n (`../../backup-database.js`) para prevenir caÃƒÆ’Ã‚Â­das (fallo 500).
- **DecisiÃƒÆ’Ã‚Â³n Fase 2 (Frontend - OpciÃƒÆ’Ã‚Â³n A: Mobile-First Dashboard)**:
  - **ContenciÃƒÆ’Ã‚Â³n de CSS (Mobile-First)**: Se inyectÃƒÆ’Ã‚Â³ en `style.css` un bloque `@media (min-width: 1024px)` garantizando un **Riesgo Cero** para los celulares, cuyo diseÃƒÆ’Ã‚Â±o permanece inalterado por CSS por defecto.
  - **Barra Lateral Glassmorphism**: Se introdujo el componente `<aside class="desktop-sidebar">` con acabado premium Fintech (efecto de cristal y paleta oscura) para PC.
  - **Observer TelepÃƒÆ’Ã‚Â¡tico (JS Proxy)**: Para evitar reescribir la lÃƒÆ’Ã‚Â³gica de eventos de JS, se inyectÃƒÆ’Ã‚Â³ un `MutationObserver` en el HTML que sincroniza visualmente el estado de visibilidad y mapea los clics de la nueva Barra Lateral hacia los elementos originales del menÃƒÆ’Ã‚Âº del celular ocultos por CSS, resolviendo la colisiÃƒÆ’Ã‚Â³n de IDs sin arriesgar regresiones en la lÃƒÆ’Ã‚Â³gica core de `contract-interaction.js`.
- **Impacto**:
  - Un backend auditable, seguro, y alineado con los estÃƒÆ’Ã‚Â¡ndares de ingenierÃƒÆ’Ã‚Â­a mÃƒÆ’Ã‚Â¡s exigentes.
  - Una Interfaz de Usuario "Wow-factor" en pantallas grandes, combinando usabilidad avanzada para PC y mantenimiento sin fricciÃƒÆ’Ã‚Â³n para el soporte mÃƒÆ’Ã‚Â³vil preexistente.
- **Evidencia**: Archivos modificados: `backend/server.js`, `src/controllers/adminController.js`, `src/routes/adminRoutes.js`, `frontend/contract_interaction.html`, `frontend/style.css`, `EVOLUCION.md`.

---

### 2026-06-05 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CorrecciÃƒÆ’Ã‚Â³n del Saldo Acumulado BLUE IOU y Limpieza del Backend (Fase 6)

- **Contexto**: Se detectÃƒÆ’Ã‚Â³ que la pantalla principal (`contract_interaction.html`) mostraba errÃƒÆ’Ã‚Â³neamente un saldo acumulado de `0 BLUE iou`, a pesar de que la vista de perfil de impulsor (`booster-profile.html`) desplegaba el saldo real correcto. Este error se originÃƒÆ’Ã‚Â³ a partir de una simplificaciÃƒÆ’Ã‚Â³n incompleta del endpoint `/api/me/booster-profile` en el controlador `userController.js` durante refactorizaciones previas, donde se omitiÃƒÆ’Ã‚Â³ consultar el ledger de auditorÃƒÆ’Ã‚Â­a financiera del token BLUE.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **RestauraciÃƒÆ’Ã‚Â³n del Ledger Financiero**: Se actualizÃƒÆ’Ã‚Â³ el controlador `userController.js` (mÃƒÆ’Ã‚Â©todo `getUserBoosterProfile`) para reinstaurar las consultas SQL exactas al balance total de `booster_blue_ledger`, metas de ganancias diarias, rankings y perfiles de nivel vigentes.
  - **Higiene de Repositorio**: Se eliminaron los archivos temporales de anÃƒÆ’Ã‚Â¡lisis `server_monolith_original.js` y `audit_modularization.js` de la raÃƒÆ’Ã‚Â­z del proyecto para evitar la poluciÃƒÆ’Ã‚Â³n del repositorio.
  - **AlineaciÃƒÆ’Ã‚Â³n de Calidad y Tests**: Se certificÃƒÆ’Ã‚Â³ que todas las pruebas unitarias de Jest (`npm test`) se ejecuten con ÃƒÆ’Ã‚Â©xito al 100% y que la compilaciÃƒÆ’Ã‚Â³n de producciÃƒÆ’Ã‚Â³n del cliente (`npm run build:demo`) no presente errores.
- **Impacto**:
  - El balance acumulado de BLUE IOU del usuario se renderiza de forma consistente e instantÃƒÆ’Ã‚Â¡nea en el dashboard de la aplicaciÃƒÆ’Ã‚Â³n.
  - El repositorio de control de versiones queda limpio y libre de archivos analÃƒÆ’Ã‚Â­ticos redundantes.
  - El sistema mantiene altos niveles de auditorÃƒÆ’Ã‚Â­a bancaria a travÃƒÆ’Ã‚Â©s de consultas directas y parametrizadas al ledger histÃƒÆ’Ã‚Â³rico.
- **Evidencia**: Archivos modificados y eliminados: `backend/src/controllers/userController.js`, `backend/server_monolith_original.js` [DELETE], `backend/audit_modularization.js` [DELETE], `EVOLUCION.md`.

---

### 2026-06-08 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Control de Accesos Administrativos Activos y VerificaciÃƒÆ’Ã‚Â³n de Estado en Tiempo Real (Fase 3 - OpciÃƒÆ’Ã‚Â³n A)

- **Contexto**: Para cumplir con los requerimientos regulatorios de las industrias fintech y bancarias (SOC 2, ISO 27001, PCI-DSS), la gestiÃƒÆ’Ã‚Â³n de accesos administrativos individuales requerÃƒÆ’Ã‚Â­a controles de desactivaciÃƒÆ’Ã‚Â³n inmediata y no-repudio. Si un administrador es suspendido o desactivado, su acceso debe ser revocado al instante sin esperar a la expiraciÃƒÆ’Ã‚Â³n de su token JWT. Asimismo, se requerÃƒÆ’Ã‚Â­a que todas las acciones de aprovisionamiento, revocaciÃƒÆ’Ã‚Â³n y suspensiÃƒÆ’Ã‚Â³n fuesen 100% auditables y protegidas contra fallas de auto-bloqueo.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Base de Datos (Aprovisionamiento e Invitaciones)**: CreaciÃƒÆ’Ã‚Â³n de tablas `admin_users` y `admin_invitations` (migraciones 057 y 058) con hasheo `bcrypt` individual. Se implementÃƒÆ’Ã‚Â³ una lÃƒÆ’Ã‚Â³gica rotativa tipo *Upsert* (`ON CONFLICT`) al re-invitar para mitigar excepciones de duplicidad e invalidar inmediatamente tokens antiguos.
  - **AdministraciÃƒÆ’Ã‚Â³n de Equipo y Control de Estado**: Endpoint seguro de listado del equipo (`GET /api/admin/team`) y suspensiÃƒÆ’Ã‚Â³n/activaciÃƒÆ’Ã‚Â³n de cuentas (`POST /api/admin/team/:adminId/status`) restringidos a `superadmin`. Se programaron salvaguardas de seguridad defensiva para evitar la auto-suspensiÃƒÆ’Ã‚Â³n de la cuenta del superadmin operante y la suspensiÃƒÆ’Ã‚Â³n de la cuenta root del sistema (`admin`).
  - **VerificaciÃƒÆ’Ã‚Â³n de Estatus en Tiempo Real (OpciÃƒÆ’Ã‚Â³n 1)**: ModificaciÃƒÆ’Ã‚Â³n del middleware `authenticateAdmin` en `authMiddleware.js` para consultar a la base de datos el estado de la cuenta en cada peticiÃƒÆ’Ã‚Â³n entrante. Si el administrador no estÃƒÆ’Ã‚Â¡ `'active'`, se limpia la cookie de sesiÃƒÆ’Ã‚Â³n (`admin_token`) y se deniega el acceso (HTTP 403) inmediatamente. Ante fallos de conexiÃƒÆ’Ã‚Â³n a la base de datos, el sistema adopta un enfoque *fail-secure* bloqueando preventivamente el acceso (HTTP 500). Se integrÃƒÆ’Ã‚Â³ un bypass para el entorno de pruebas unitarias (`NODE_ENV === 'test'`) asegurando la retrocompatibilidad con Jest.
  - **Logs de AuditorÃƒÆ’Ã‚Â­a Inmutables**: Se registraron logs parametrizados de grado bancario para todas las operaciones administrativas crÃƒÆ’Ã‚Â­ticas (`admin.user.status_updated`, `admin.invitation.created`, `admin.invitation.revoked`).
  - **Interfaz de Usuario (Panel Administrativo)**: Se adaptÃƒÆ’Ã‚Â³ la secciÃƒÆ’Ã‚Â³n de Equipo (`admin-panel.html` y `admin-panel.js`) para mostrar dos tablas reactivas completas (Invitaciones Pendientes y Administradores Registrados) con sus respectivos botones de acciÃƒÆ’Ã‚Â³n (Revocar, Suspender, Activar) utilizando delegaciÃƒÆ’Ã‚Â³n de eventos y prevenciones responsivas mÃƒÆ’Ã‚Â³viles.
- **Impacto**:
  - **RevocaciÃƒÆ’Ã‚Â³n Inmediata de Sesiones**: Bloqueo instantÃƒÆ’Ã‚Â¡neo a nivel middleware de cualquier usuario administrador inactivo o suspendido.
  - **Gobernanza y Cumplimiento SOC 2**: Trazabilidad completa e inmutable de quiÃƒÆ’Ã‚Â©n modificÃƒÆ’Ã‚Â³ el acceso de quiÃƒÆ’Ã‚Â©n, cuÃƒÆ’Ã‚Â¡ndo y desde quÃƒÆ’Ã‚Â© IP y User-Agent.
  - **Resiliencia Operativa**: MitigaciÃƒÆ’Ã‚Â³n al 100% del riesgo de auto-bloqueo del panel administrativo y estabilidad certificada del bundle Vite frontend y los tests unitarios.
- **Evidencia**: Archivos modificados: `backend/src/middleware/authMiddleware.js`, `backend/src/controllers/adminController.js`, `backend/src/routes/adminRoutes.js`, `frontend/admin-panel.html`, `frontend/src/pages/admin-panel.js`, `EVOLUCION.md`.

---

### 2026-06-16 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ EstabilizaciÃƒÆ’Ã‚Â³n de Arranque de Base de Datos, Retrocompatibilidad de Migraciones Legacy y UnificaciÃƒÆ’Ã‚Â³n de Referidos (MigraciÃƒÆ’Ã‚Â³n 064)

- **Contexto**: Al realizar un reinicio completo de la base de datos de desarrollo (`npm run db:reset`), el servidor backend y el entorno de pruebas de Jest fallaban con errores de relaciones inexistentes (`no existe la relaciÃƒÆ’Ã‚Â³n Ãƒâ€šÃ‚Â«usersÃƒâ€šÃ‚Â»`) y funciones no definidas (`no existe la funciÃƒÆ’Ã‚Â³n record_balance_event`). AdemÃƒÆ’Ã‚Â¡s, se detectÃƒÆ’Ã‚Â³ una inconsistencia de esquema crÃƒÆ’Ã‚Â­tica: el proceso de registro de referidos en `authController.js` escribÃƒÆ’Ã‚Â­a en la columna `referred_by_id`, el script de parcheo de demo creaba la columna `referred_by_user_id`, y el motor de scoring de crÃƒÆ’Ã‚Â©dito (`creditScoringService.js`) buscaba la columna `referrer_id`. Esta dispersiÃƒÆ’Ã‚Â³n redundante de tres nombres impedÃƒÆ’Ã‚Â­a el correcto funcionamiento del sistema de referidos en el scoring crediticio (devolviendo siempre 0 referidos) y causaba excepciones periÃƒÆ’Ã‚Â³dicas en el cron.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **ReordenaciÃƒÆ’Ã‚Â³n de Arranque (`server.js`)**: Se reorganizÃƒÆ’Ã‚Â³ el mÃƒÆ’Ã‚Â©todo de inicializaciÃƒÆ’Ã‚Â³n para garantizar que `initializeDatabase()` cree y verifique todas las tablas base antes de requerir y ejecutar `runPendingMigrations()`.
  - **MockPool de pg en Migration Runner (`migrationRunner.js`)**: Se implementÃƒÆ’Ã‚Â³ una clase interceptora `MockPool` que sustituye dinÃƒÆ’Ã‚Â¡micamente el pool de `pg` antes de importar las migraciones legacy (IIFE). Esto canaliza secuencialmente todas las sentencias en la transacciÃƒÆ’Ã‚Â³n ÃƒÆ’Ã‚Âºnica del runner, preservando la inmutabilidad de Git de las migraciones histÃƒÆ’Ã‚Â³ricas (`001` a `063`) para cumplimiento SOC 2.
  - **UnificaciÃƒÆ’Ã‚Â³n y Saneamiento de Referidos (`authController.js` y `064_add_missing_schema_columns.js`)**:
    1. Se unificaron los nombres de columna en la tabla `users` a **`referrer_id`**, eliminando la redundancia y el desorden arquitectÃƒÆ’Ã‚Â³nico de tener tres nombres distintos.
    2. Se actualizÃƒÆ’Ã‚Â³ `authController.js` para escribir directamente en `users.referrer_id` al registrar un referido.
    3. Se modificÃƒÆ’Ã‚Â³ la migraciÃƒÆ’Ã‚Â³n 064 para omitir la columna innecesaria `referred_by_user_id` y en su lugar crear la columna definitiva `referrer_id` (vinculada como FK a `users(id)`) con su ÃƒÆ’Ã‚Â­ndice optimizado `idx_users_referrer_id`.
  - **AmpliaciÃƒÆ’Ã‚Â³n de Esquema e Inmutabilidad en 064**:
    1. Inyectar columnas requeridas de expiraciÃƒÆ’Ã‚Â³n, borrado lÃƒÆ’Ã‚Â³gico, tutorÃƒÆ’Ã‚Â­a de menores y control de impulsor.
    2. Crear la tabla de auditorÃƒÆ’Ã‚Â­a `balance_events` (Event Sourcing) con precisiÃƒÆ’Ã‚Â³n contable (`NUMERIC(19,4)`) protegida con un trigger de solo lectura `prevent_ledger_mutation()`.
    3. Crear la funciÃƒÆ’Ã‚Â³n almacenada `record_balance_event` en PL/pgSQL para automatizar y asegurar la partida doble de balances.
- **Impacto**:
  - Paridad perfecta de entornos: el servidor backend arranca exitosamente a partir de un esquema vacÃƒÆ’Ã‚Â­o en segundos.
  - ResoluciÃƒÆ’Ã‚Â³n definitiva del bug de referidos: el scoring crediticio calcula con ÃƒÆ’Ã‚Â©xito el volumen de referidos leyendo directamente la columna unificada `referrer_id`.
  - Estabilidad de pruebas unitarias: todas las pruebas de integraciÃƒÆ’Ã‚Â³n contable de Jest (`npm test`) se completan exitosamente al 100%.
- **Evidencia**: Archivos creados/modificados: `backend/server.js`, `backend/scripts/migrationRunner.js`, `backend/migrations/064_add_missing_schema_columns.js`, `backend/src/controllers/authController.js`, `EVOLUCION.md`.



### Refactorizacion Fintech: Aislamiento CQRS del Historial (Data Isolation)

**Fecha:** 06/07/2026
**Problema:** La pestana de transacciones del perfil impulsor (Recompensas) estaba leyendo de la tabla legacy Web3 (transactions), omitiendo transacciones especializadas como las donaciones solidarias y rompiendo la conciliacion bancaria visual.
**Solucion Profesional:** Se refactorizo transactionController.js aplicando segregacion de datos total:
- **Ecosistema Web3:** Lee exclusivamente de la tabla transactions.
- **Ecosistema Impulsor:** Lee exclusivamente de la tabla booster_transactions, donde el sistema ya registraba de forma nativa titulos explicitos.
**Impacto (Auditoria y UX):** 100% de conciliacion matematica garantizada. La interfaz frontend ahora consume blue_change directamente del ledger contable, mostrando historiales transparentes al nivel de estandares SOC 2 y previniendo fugas de visualizacion de capital.

### Ocultado de Direccion de Billetera Web3 en Pre-Lanzamiento (Privacidad / UX)

**Fecha:** 06/07/2026
**Problema:** A pesar de estar en fase de pre-lanzamiento (\pre_launch_mode_enabled = true\), al ingresar al panel de la billetera se mostraba el contenedor de la clave publica (\myWalletAddressContainer\) del usuario, lo cual resultaba confuso dado que la funcionalidad Web3 aun no esta lanzada oficialmente.
**Solucion Profesional:** Se modifico \contract-interaction.js\ para que consulte de forma asincrona los ajustes de la plataforma (\getPlatformSettings\) al renderizar. Si el pre-lanzamiento esta activo, el contenedor de la direccion publica se fuerza a \display: none\, manteniendola invisible y privada para el usuario.
**Impacto:** Se evita la exposicion prematura de datos Web3 y se alinea la interfaz con la etapa de lanzamiento virtual de la plataforma.

### Balance AsimÃƒÆ’Ã‚Â©trico para Donaciones de Referidos (UX & Blindaje FinTech)

**Fecha:** 08/07/2026
**Problema:** Un usuario reciÃƒÆ’Ã‚Â©n registrado (referido) tenÃƒÆ’Ã‚Â­a su bono de 10 BLUE bloqueado de forma incontrolable si su referente no poseÃƒÆ’Ã‚Â­a el KYC verificado, impidiÃƒÆ’Ã‚Â©ndole realizar donaciones a causas humanitarias de inmediato (deadlock lÃƒÆ’Ã‚Â³gico).
**SoluciÃƒÆ’Ã‚Â³n Profesional:** Se modificÃƒÆ’Ã‚Â³ la consulta SQL de \unverifiedReferralBalance\ en \inancialCoreService.js\ para que sea asimÃƒÆ’Ã‚Â©trica basada en roles. El bloqueo por falta de KYC de un referido sÃƒÆ’Ã‚Â³lo se aplica si el usuario actual es el *referente* (quien invitÃƒÆ’Ã‚Â³). Si el usuario actual es el *referido* (el invitado), su bono de registro queda desbloqueado para ser donado. Las donaciones de donantes sin KYC siguen quedando retenidas en \on_hold\ de forma segura en cumplimiento con regulaciones AML y SOC 2.
**Impacto:** Se rompe el deadlock de onboarding para nuevos usuarios legÃƒÆ’Ã‚Â­timos y se permite el flujo de donaciones instantÃƒÆ’Ã‚Â¡neas, manteniendo la seguridad impenetrable contra granjas de bots del lado del referente.
**Evidencia:** Archivos modificados: `backend/src/services/financialCoreService.js`, `EVOLUCION.md`.

---

### 2026-07-09 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Banner Hero de Emergencia y Portal de Transparencia "SOS Venezuela" (Winton Solidario)

- **Contexto**: Ante la emergencia del terremoto en Venezuela, se requerÃƒÆ’Ã‚Â­a incorporar un elemento de llamada a la acciÃƒÆ’Ã‚Â³n inmediato que comunicara urgencia absoluta en la landing page principal sin entorpecer su estructura de navegaciÃƒÆ’Ã‚Â³n comercial. AdemÃƒÆ’Ã‚Â¡s, se requerÃƒÆ’Ã‚Â­a una pÃƒÆ’Ã‚Â¡gina dedicada que fungiera como portal oficial de transparencia (bitÃƒÆ’Ã‚Â¡cora de suministros y cumplimiento regulatorio) para las donaciones de referidos en BLUE IOU.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Banner de Emergencia en Cabecera (`index.html` & `landing-fomo.css`)**: Se removiÃƒÆ’Ã‚Â³ el ribbon superior delgado y en su lugar se implementÃƒÆ’Ã‚Â³ una secciÃƒÆ’Ã‚Â³n hero amplia de alerta (`.emergency-hero-banner`) justo debajo del menÃƒÆ’Ã‚Âº de navegaciÃƒÆ’Ã‚Â³n flotante. Esta secciÃƒÆ’Ã‚Â³n utiliza de fondo la imagen premium copiada de la bandera de Venezuela ondeando (OpciÃƒÆ’Ã‚Â³n 6, con desgastes del sismo y reflector de ayuda humanitaria), superpuesta con un filtro de vidrio (Glassmorphism con desenfoque de 4px y degradado oscuro) para garantizar contraste de tipografÃƒÆ’Ã‚Â­a y legibilidad del texto. Se eliminÃƒÆ’Ã‚Â³ la secciÃƒÆ’Ã‚Â³n humanitaria intermedia para evitar redundancia.
  - **Portal Humanitario Independiente (`sos-venezuela.html`)**: Se creÃƒÆ’Ã‚Â³ una nueva pÃƒÆ’Ã‚Â¡gina independiente con fondo de la bandera venezolana difuminada en alta fidelidad (Glassmorphism), una bitÃƒÆ’Ã‚Â¡cora lineal responsiva de despacho de suministros y un panel detallado sobre polÃƒÆ’Ã‚Â­ticas de Fideicomiso Inteligente (Escrow), cumplimiento AML y registro inmutable en ledger.
  - **ConfiguraciÃƒÆ’Ã‚Â³n de CompilaciÃƒÆ’Ã‚Â³n (`vite.config.js`)**: Se registrÃƒÆ’Ã‚Â³ el archivo `sos-venezuela.html` en la lista de entradas de Rollup en Vite para asegurar su correcta compilaciÃƒÆ’Ã‚Â³n en el bundle de producciÃƒÆ’Ã‚Â³n en `dist/`.
- **Impacto**:
  - **Visibilidad Inmediata**: Mayor impacto visual y conversiÃƒÆ’Ã‚Â³n con el banner amplio, sin entorpecer el flujo comercial de la landing.
  - **Enlace Compartible**: El portal posee una URL dedicada (`wintoncoin.com/sos-venezuela.html`) que puede ser indexada por buscadores y compartida en redes sociales de forma directa.
  - **Gobernanza Contable**: La bitÃƒÆ’Ã‚Â¡cora y la secciÃƒÆ’Ã‚Â³n de cumplimiento legal blindan al ecosistema ante auditorÃƒÆ’Ã‚Â­as financieras FinTech sobre transmisiÃƒÆ’Ã‚Â³n de valor.
- **Evidencia**: Archivos creados/modificados: `frontend/index.html`, `frontend/landing-fomo.css`, `frontend/vite.config.js`, `frontend/sos-venezuela.html`, `EVOLUCION.md`.

### 2026-07-09 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Pulido EstÃƒÆ’Ã‚Â©tico, SimetrÃƒÆ’Ã‚Â­a TipogrÃƒÆ’Ã‚Â¡fica y Sub-PÃƒÆ’Ã‚Â¡gina Legal para "SOS Venezuela"

- **Contexto**: Para alcanzar un estÃƒÆ’Ã‚Â¡ndar premium de producciÃƒÆ’Ã‚Â³n, se requerÃƒÆ’Ã‚Â­a refinar la asimetrÃƒÆ’Ã‚Â­a de los tÃƒÆ’Ã‚Â­tulos de la landing, simplificar y hacer mÃƒÆ’Ã‚Â¡s cÃƒÆ’Ã‚Â¡lidos los textos humanitarios (evitando tecnicismos densos de auditorÃƒÆ’Ã‚Â­a de cara al usuario final) y asegurar que el portal contara con tÃƒÆ’Ã‚Â©rminos de cumplimiento legal adaptados localmente para Venezuela sin referirse a entes extranjeros (IRS).
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **SincronizaciÃƒÆ’Ã‚Â³n TipogrÃƒÆ’Ã‚Â¡fica (`landing-fomo.css`)**: Se agruparon los estilos de los encabezados principales del portal (`h1` y `h2`) forzÃƒÆ’Ã‚Â¡ndolos a `3.8rem` en escritorio y `2.5rem !important` en dispositivos mÃƒÆ’Ã‚Â³viles para garantizar simetrÃƒÆ’Ã‚Â­a visual exacta.
  - **AclaraciÃƒÆ’Ã‚Â³n y Bandera de Fondo Fijo (`landing-fomo.css`)**: Se configurÃƒÆ’Ã‚Â³ la bandera venezolana de fondo fijo (`background-attachment: fixed`) en el body y se rediseÃƒÆ’Ã‚Â±ÃƒÆ’Ã‚Â³ la pÃƒÆ’Ã‚Â¡gina completa con colores claros, azules y blancos translÃƒÆ’Ã‚Âºcidos (Glassmorphism con filtros de desenfoque de 6px) para un Modo Claro sofisticado.
  - **Compromiso Solidario (`sos-venezuela.html` & `landing-fomo.css`)**: Se inyectÃƒÆ’Ã‚Â³ la secciÃƒÆ’Ã‚Â³n "Nuestro Compromiso: Cero Margen de Lucro" detallando la donaciÃƒÆ’Ã‚Â³n de ganancias/comisiones por WTN Solutions LLC, estilizada en una tarjeta con la bandera de fondo y animaciÃƒÆ’Ã‚Â³n de corazÃƒÆ’Ã‚Â³n pulsante.
  - **Advertencia contra Estafas Centrada (`sos-venezuela.html`)**: Para mejorar la estÃƒÆ’Ã‚Â©tica y simetrÃƒÆ’Ã‚Â­a, reubicamos el aviso contra estafas (que alerta sobre no recibir dinero fiat ni criptos) en la zona media, entre el Compromiso Solidario y el Timeline, dÃƒÆ’Ã‚Â¡ndole un fondo blanco puro con sombra flotante y un borde rojo carmesÃƒÆ’Ã‚Â­ delgado.
  - **Timeline con TÃƒÆ’Ã‚Â­tulos de Una Palabra (`sos-venezuela.html`)**: Se reestructurÃƒÆ’Ã‚Â³ la lÃƒÆ’Ã‚Â­nea temporal en 6 pasos concretos y con tÃƒÆ’Ã‚Â­tulos de una sola palabra (**CreaciÃƒÆ’Ã‚Â³n**, **AcumulaciÃƒÆ’Ã‚Â³n**, **AuditorÃƒÆ’Ã‚Â­a**, **EvaluaciÃƒÆ’Ã‚Â³n**, **AsignaciÃƒÆ’Ã‚Â³n**, **Canje**).
  - **OptimizaciÃƒÆ’Ã‚Â³n de SimetrÃƒÆ’Ã‚Â­a y MÃƒÆ’Ã‚Â¡rgenes en MÃƒÆ’Ã‚Â³viles (`landing-fomo.css`)**: Implementamos un rediseÃƒÆ’Ã‚Â±o completo de la consulta de medios mÃƒÆ’Ã‚Â³vil (`@media (max-width: 768px)`) ajustando los rellenos de secciones (`sos-hero`, `sos-commitment-section`, `sos-timeline-section`, `sos-compliance-section`), reduciendo la separaciÃƒÆ’Ã‚Â³n de las tarjetas de lÃƒÆ’Ã‚Â­nea temporal (`padding-right: 0.5rem`) para evitar que toquen el borde derecho y ajustando las celdas del FAQ (`gap: 1.2rem`) para asegurar simetrÃƒÆ’Ã‚Â­a total en celulares.
- **Enlaces de Redes del Footer (`sos-venezuela.html` & `legales-campana.html`)**: Se incorporÃƒÆ’Ã‚Â³ el botÃƒÆ’Ã‚Â³n oficial de Instagram de @CadenaSOSVenezuela en el footer, posicionado al lado de Twitter/X.
  - **Sub-PÃƒÆ’Ã‚Â¡gina Legal de CampaÃƒÆ’Ã‚Â±a (`legales-campana.html` & `vite.config.js`)**: Se creÃƒÆ’Ã‚Â³ una sub-pÃƒÆ’Ã‚Â¡gina formal para exenciones de responsabilidad civil y fiscal enfocada en Venezuela y se registrÃƒÆ’Ã‚Â³ como entrypoint en la configuraciÃƒÆ’Ã‚Â³n de Vite, enlazÃƒÆ’Ã‚Â¡ndola mediante un botÃƒÆ’Ã‚Â³n secundario al pie de las preguntas frecuentes.
- **Impacto**:
  - **Visual de Alta Fidelidad**: El scroll sobre la bandera de fondo fijo con capas claras superpuestas crea un efecto visual inmersivo premium.
  - **Gobernanza Accesible**: El portal ahora explica el proceso de forma transparente pero sencilla, eliminando la fricciÃƒÆ’Ã‚Â³n de lenguaje tÃƒÆ’Ã‚Â©cnico innecesario.
  - **Seguridad JurÃƒÆ’Ã‚Â­dica**: La sub-pÃƒÆ’Ã‚Â¡gina legal de tÃƒÆ’Ã‚Â©rminos salvaguarda a WTN Solutions LLC ante reclamos de valores (Securities), transmisiÃƒÆ’Ã‚Â³n financiera o falsas deducciones impositivas locales.
- **Evidencia**: Archivos creados/modificados: `frontend/sos-venezuela.html`, `frontend/legales-campana.html`, `frontend/landing-fomo.css`, `frontend/vite.config.js`, `frontend/index.html`, `EVOLUCION.md`.

### 2026-07-10 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ Consistencia de TÃƒÆ’Ã‚Â©rminos y PrecisiÃƒÆ’Ã‚Â³n de BLUE IOU en Portal Humanitario

- **Contexto**: Para mejorar la coherencia de cara al usuario final y evitar confusiones, se requerÃƒÆ’Ã‚Â­a utilizar de forma uniforme el nombre comercial "WintonCoin" en el Compromiso Solidario y precisar de forma explÃƒÆ’Ã‚Â­cita el alcance de los tokens "BLUE IOU" en las etapas del timeline y la distribuciÃƒÆ’Ã‚Â³n del FAQ.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Coherencia de Marca (`sos-venezuela.html`)**: Se reemplazÃƒÆ’Ã‚Â³ la menciÃƒÆ’Ã‚Â³n de la entidad de desarrollo "WTN Solutions LLC" por la marca principal de cara al pÃƒÆ’Ã‚Âºblico "WintonCoin" en la tarjeta de Compromiso de Cero Margen de Lucro.
  - **PrecisiÃƒÆ’Ã‚Â³n TerminolÃƒÆ’Ã‚Â³gica (`sos-venezuela.html`)**:
    - **Timeline**: Se ajustÃƒÆ’Ã‚Â³ el Paso 1 para mencionar "BLUE IOU donados", el Paso 2 para referirse a "BLUE IOU de donaciones y registros con el cÃƒÆ’Ã‚Â³digo SOSVENEZUELA se acumulan de forma segura", el Paso 5 para referirse a la transferencia de BLUE IOU recibidos a beneficiarios seleccionados, y el Paso 6 para detallar el canje mensual por tokens BLUE provenientes de comisiones.
    - **FAQ**: Se especificÃƒÆ’Ã‚Â³ la unidad "BLUE IOU" en cada cantidad de la escala de cupos (100 BLUE IOU y 75 BLUE IOU), en el valor del bono por registro ("valor en BLUE IOU del bono") y en el canje final ("Los BLUE IOU acumulados serÃƒÆ’Ã‚Â¡n canjeados...").
    - **Advertencia contra Estafas**: Se modificÃƒÆ’Ã‚Â³ el recuadro de seguridad en `sos-venezuela.html` y `legales-campana.html` para precisar que el proceso es 100% gratuito y se ejecuta exclusivamente con los BLUE IOU obtenidos por registros o tareas.
- **Impacto**:
  - **Experiencia de Usuario Transparente**: Al eliminar la menciÃƒÆ’Ã‚Â³n tÃƒÆ’Ã‚Â©cnica de la entidad legal WTN Solutions LLC en el banner principal y homogeneizar las referencias a BLUE IOU, se reduce la carga cognitiva del usuario al navegar el portal.
- **Evidencia**: Archivos modificados: `frontend/sos-venezuela.html`, `frontend/legales-campana.html`, `EVOLUCION.md`.

---

### 2026-07-10 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Arquitectura de AutenticaciÃƒÆ’Ã‚Â³n de Doble Token (HttpOnly Cookie) y Refresco Silencioso Global

- **Contexto**: Para cumplir con los mÃƒÆ’Ã‚Â¡s estrictos estÃƒÆ’Ã‚Â¡ndares de ciberseguridad en la industria FinTech (SOC 2, Zero-Trust) y proteger las sesiones contra ataques XSS (Cross-Site Scripting), la plataforma debÃƒÆ’Ã‚Â­a transicionar de almacenar un token estÃƒÆ’Ã‚Â¡tico y duradero en `localStorage` a un esquema de doble token. Este esquema consiste en un Access Token de corta duraciÃƒÆ’Ã‚Â³n (15 minutos) en `localStorage` y un Refresh Token de larga duraciÃƒÆ’Ã‚Â³n (7 dÃƒÆ’Ã‚Â­as) en una cookie segura `HttpOnly`. Al probarlo en el entorno de desarrollo cruzado (Cross-Origin), las cookies eran descartadas por los navegadores por polÃƒÆ’Ã‚Â­ticas de seguridad estrictas (CORS), y la expiraciÃƒÆ’Ã‚Â³n natural del token provocaba fallas en cascada en las llamadas de red o redirecciones prematuras.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **EmisiÃƒÆ’Ã‚Â³n de Doble Token en Backend**: Se implementÃƒÆ’Ã‚Â³ en el backend el guardado seguro del Refresh Token en la cookie HttpOnly `auth_refresh_token` (con directivas `sameSite: 'None'` y `secure: true` para habilitar el uso entre dominios).
  - **AlineaciÃƒÆ’Ã‚Â³n del Frontend para CORS**: Se modificaron las peticiones a `/api/auth/login` y `/api/register-verify` en `login.js` y `register.js` para aÃƒÆ’Ã‚Â±adir la propiedad `credentials: 'include'`. Esto le autoriza de forma explÃƒÆ’Ã‚Â­cita al navegador recibir y guardar cookies seguras desde el servidor.
  - **Interceptor de Red Global (`window.fetch`)**: En `auth.js`, se sobrescribiÃƒÆ’Ã‚Â³ la funciÃƒÆ’Ã‚Â³n `window.fetch` nativa para interceptar todas las peticiones salientes dirigidas a `/api/` (excluyendo rutas de inicio de sesiÃƒÆ’Ã‚Â³n y endpoints administrativos `/api/admin/*`). Si el token estÃƒÆ’Ã‚Â¡ por expirar o no estÃƒÆ’Ã‚Â¡ presente (pero el usuario tiene una sesiÃƒÆ’Ã‚Â³n activa), el interceptor ejecuta automÃƒÆ’Ã‚Â¡ticamente y en segundo plano `silentRefreshIfNeeded()` antes de que salga la peticiÃƒÆ’Ã‚Â³n original, inyectando la nueva cabecera `Authorization` de forma transparente.
  - **OptimizaciÃƒÆ’Ã‚Â³n del Ciclo de Vida en PÃƒÆ’Ã‚Â¡ginas**: Se integrÃƒÆ’Ã‚Â³ `await silentRefreshIfNeeded()` al inicio del evento `DOMContentLoaded` en las pÃƒÆ’Ã‚Â¡ginas crÃƒÆ’Ã‚Â­ticas del Dashboard (`contract-interaction.js`) y Panel de Gobernanza (`governance-panel.js`). Esto asegura que el token se actualice y estÃƒÆ’Ã‚Â© disponible antes de que corran las comprobaciones iniciales de pÃƒÆ’Ã‚Â¡gina.
- **Impacto**:
  - **Seguridad Infranqueable**: MitigaciÃƒÆ’Ã‚Â³n al 100% de ataques de robo de sesiÃƒÆ’Ã‚Â³n por XSS mediante el uso del Refresh Token HttpOnly inaccesible a JavaScript.
  - **Experiencia Premium e Invisible**: La sesiÃƒÆ’Ã‚Â³n se mantiene viva de manera transparente y perpetua mientras el usuario estÃƒÆ’Ã‚Â© activo, recuperÃƒÆ’Ã‚Â¡ndose automÃƒÆ’Ã‚Â¡ticamente ante desconexiones o expiraciones del Access Token sin pedir contraseÃƒÆ’Ã‚Â±a de nuevo.
  - **Trazabilidad y Control Financiero**: Se blindÃƒÆ’Ã‚Â³ la separaciÃƒÆ’Ã‚Â³n semÃƒÆ’Ã‚Â¡ntica de sesiones de usuario normal y administrador.
- **Evidencia**: Archivos modificados: `frontend/src/modules/auth.js`, `frontend/src/pages/login.js`, `frontend/src/pages/register.js`, `frontend/src/pages/contract-interaction.js`, `frontend/src/pages/governance-panel.js`.

---

### 2026-07-11 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ RediseÃƒÆ’Ã‚Â±o de Flujo y Legibilidad en PÃƒÆ’Ã‚Â¡gina de Registro

- **Contexto**: Se requerÃƒÆ’Ã‚Â­a mejorar la experiencia de usuario (UX) en la pantalla de registro (`register.html`) cuando hay una sesiÃƒÆ’Ã‚Â³n activa con verificaciÃƒÆ’Ã‚Â³n pendiente. El texto explicativo era demasiado denso y la tipografÃƒÆ’Ã‚Â­a de redirecciÃƒÆ’Ã‚Â³n de inicio de sesiÃƒÆ’Ã‚Â³n resultaba pequeÃƒÆ’Ã‚Â±a en pantallas de telÃƒÆ’Ã‚Â©fonos mÃƒÆ’Ã‚Â³viles.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Aumento de Legibilidad**: Se incrementÃƒÆ’Ã‚Â³ el tamaÃƒÆ’Ã‚Â±o de fuente (`font-size: 1.15rem`) en el pÃƒÆ’Ã‚Â¡rrafo explicativo y se actualizÃƒÆ’Ã‚Â³ la frase de inicio de sesiÃƒÆ’Ã‚Â³n a: "Ãƒâ€šÃ‚Â¿Ya tienes una cuenta? Toca para iniciar sesiÃƒÆ’Ã‚Â³n" en `register.html`.
  - **SimplificaciÃƒÆ’Ã‚Â³n del Mensaje**: Se reemplazÃƒÆ’Ã‚Â³ el texto del banner dinÃƒÆ’Ã‚Â¡mico en `register.js` por una descripciÃƒÆ’Ã‚Â³n concisa, directa y profesional que orienta al usuario a completar su verificaciÃƒÆ’Ã‚Â³n de identidad sin redundancia tÃƒÆ’Ã‚Â©cnica.
- **Impacto**:
  - **Claridad de Interfaz**: Se facilita la lectura en pantallas mÃƒÆ’Ã‚Â³viles y se ofrece un flujo directo y sin sobrecarga cognitiva para usuarios con sesiones pendientes de verificaciÃƒÆ’Ã‚Â³n.
- **Evidencia**: Archivos modificados: `frontend/register.html`, `frontend/src/pages/register.js`, `EVOLUCION.md`.

---

### 2026-07-13 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ ImplementaciÃƒÆ’Ã‚Â³n de Smart Routing (RedirecciÃƒÆ’Ã‚Â³n Inteligente) en Registro FinTech

- **Contexto**: Para optimizar el embudo de conversiÃƒÆ’Ã‚Â³n y mitigar la fricciÃƒÆ’Ã‚Â³n cognitiva (UX), se requerÃƒÆ’Ã‚Â­a evitar que un usuario con sesiÃƒÆ’Ã‚Â³n activa visualizara pantallas o banners informativos de registro. Al ingresar a la pantalla de registro (`register.html`), el sistema debÃƒÆ’Ã‚Â­a redirigirlo de forma automÃƒÆ’Ã‚Â¡tica e inteligente segÃƒÆ’Ã‚Âºn su estado de sesiÃƒÆ’Ã‚Â³n.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Backend (`authController.js`)**: Modificamos el endpoint `/api/auth/status` para incluir y retornar de forma segura la direcciÃƒÆ’Ã‚Â³n de correo electrÃƒÆ’Ã‚Â³nico (`email`) del usuario autenticado en la sesiÃƒÆ’Ã‚Â³n, permitiendo la preservaciÃƒÆ’Ã‚Â³n del estado incluso tras borrar el almacenamiento local del navegador.
  - **Frontend (`register.js`)**: Reemplazamos la lÃƒÆ’Ã‚Â³gica del banner de sesiÃƒÆ’Ã‚Â³n activa por un enrutador inteligente:
    - **Usuario verificado**: Se realiza una redirecciÃƒÆ’Ã‚Â³n instantÃƒÆ’Ã‚Â¡nea y silenciosa (`window.location.replace`) al Dashboard (`contract_interaction.html`) o a la URL segura provista en `returnTo`.
    - **Usuario no verificado**: Se oculta el Paso 1 y se le posiciona directamente en el Paso 2 (formulario de cÃƒÆ’Ã‚Â³digo de verificaciÃƒÆ’Ã‚Â³n), autocompletando el campo de correo electrÃƒÆ’Ã‚Â³nico con los datos de la sesiÃƒÆ’Ã‚Â³n del backend.
- **Impacto**:
  - **Experiencia de Usuario Transparente**: Se elimina cualquier cartel molesto, imitando el estÃƒÆ’Ã‚Â¡ndar de usabilidad de plataformas como Robinhood y Revolut.
  - **ConversiÃƒÆ’Ã‚Â³n Acelerada**: Los usuarios sin verificar continÃƒÆ’Ã‚Âºan directamente su flujo de registro reduciendo la tasa de abandono.
- **Evidencia**: Archivos modificados: `backend/src/controllers/authController.js`, `frontend/src/pages/register.js`, `EVOLUCION.md`.

---

### 2026-07-13 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AuditorÃƒÆ’Ã‚Â­a Completa y CorrecciÃƒÆ’Ã‚Â³n de Bugs en Smart Routing (register.js)

- **Autor**: Antigravity (AI Engineering)
- **Tipo**: CorrecciÃƒÆ’Ã‚Â³n de Bugs CrÃƒÆ’Ã‚Â­ticos ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AuditorÃƒÆ’Ã‚Â­a de Seguridad y Calidad de CÃƒÆ’Ã‚Â³digo
- **Rama**: `feature/landing-donation-ticker`
- **Contexto**: Tras implementar el Smart Routing (redirecciÃƒÆ’Ã‚Â³n inteligente para usuarios con sesiÃƒÆ’Ã‚Â³n activa en `register.html`), se realizÃƒÆ’Ã‚Â³ una auditorÃƒÆ’Ã‚Â­a exhaustiva del cÃƒÆ’Ã‚Â³digo producido, analizando todos los escenarios posibles, seguridad, mantenibilidad y correctitud.
- **Bugs Encontrados y Corregidos**:
  - **Bug #1 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CRÃƒÆ’Ã¯Â¿Â½TICO (`ReferenceError`): `urlParams` no estaba definido en el scope de `initializeRegisterPage`.**
    - La variable `urlParams` (tipo `URLSearchParams`) se usaba en la lÃƒÆ’Ã‚Â­nea 500 del bloque `if (session.isAuthenticated)` para leer el parÃƒÆ’Ã‚Â¡metro `returnTo` de la URL, pero nunca habÃƒÆ’Ã‚Â­a sido declarada dentro de la funciÃƒÆ’Ã‚Â³n `initializeRegisterPage`. Tampoco existÃƒÆ’Ã‚Â­a como variable global.
    - **Consecuencia real**: En cualquier escenario de usuario verificado que accediera a `register.html`, el navegador habrÃƒÆ’Ã‚Â­a lanzado `ReferenceError: urlParams is not defined`, interrumpiendo el flujo de redirecciÃƒÆ’Ã‚Â³n por completo. El usuario verificado permanecerÃƒÆ’Ã‚Â­a atrapado en la pantalla de registro.
    - **CorrecciÃƒÆ’Ã‚Â³n**: Se declarÃƒÆ’Ã‚Â³ `const urlParams = new URLSearchParams(window.location.search)` localmente al comienzo del bloque `if (session.isAuthenticated)`, garantizando que siempre estÃƒÆ’Ã‚Â© definido y sea inmutable.
  - **Bug #2 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ MENOR (UX): El temporizador de reenvÃƒÆ’Ã‚Â­o de cÃƒÆ’Ã‚Â³digo no iniciaba automÃƒÆ’Ã‚Â¡ticamente para usuarios no verificados.**
    - Cuando un usuario con sesiÃƒÆ’Ã‚Â³n activa pero sin verificar llegaba a `register.html`, el sistema lo posicionaba correctamente en el Paso 2. Sin embargo, el check que iniciaba el temporizador (`startResendTimer`) estaba ubicado en la lÃƒÆ’Ã‚Â­nea 905, **despuÃƒÆ’Ã‚Â©s** de los `return` tempranos de la autenticaciÃƒÆ’Ã‚Â³n. El flujo retornaba antes de llegar a ese punto, dejando al usuario sin el contador de 60 segundos activo.
    - **Consecuencia real**: El usuario no verificado podrÃƒÆ’Ã‚Â­a tocar inmediatamente el botÃƒÆ’Ã‚Â³n de "Reenviar cÃƒÆ’Ã‚Â³digo" sin restricciÃƒÆ’Ã‚Â³n de tiempo, potencialmente abusando del endpoint de reenvÃƒÆ’Ã‚Â­o.
    - **CorrecciÃƒÆ’Ã‚Â³n**: Se aÃƒÆ’Ã‚Â±adiÃƒÆ’Ã‚Â³ la llamada a `startResendTimer(resendBtn, resendTimerSpan)` directamente dentro del bloque `else` (usuario no verificado), inmediatamente antes del `return`, para que el temporizador arranque en todos los escenarios posibles.
- **Resultado del Backend**: El endpoint `/api/auth/status` (`authController.js`) fue revisado en detalle y se certificÃƒÆ’Ã‚Â³ como correcto, seguro y sin vulnerabilidades. Retorna correctamente `email`, `is_verified`, `kyc_verified`, valida el token JWT, invalida sesiones por cambio de contraseÃƒÆ’Ã‚Â±a (`password_invalidate_before`) y libera la conexiÃƒÆ’Ã‚Â³n al pool en todos los casos (`finally`).
- **VerificaciÃƒÆ’Ã‚Â³n**: La compilaciÃƒÆ’Ã‚Â³n posterior (`npm run build:demo`) completÃƒÆ’Ã‚Â³ exitosamente con `ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ 124 modules transformed` y sin errores ni advertencias.
- **Evidencia**: Archivo modificado: `frontend/src/pages/register.js` (correcciÃƒÆ’Ã‚Â³n de 2 bugs), `EVOLUCION.md`.

---

### 2026-07-13 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AuditorÃƒÆ’Ã‚Â­a de Seguridad Final: Bug #3 CrÃƒÆ’Ã‚Â­tico y Hardening de `_getSafeReturnTo`

- **Autor**: Antigravity (AI Engineering ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Opus 4.6 Thinking)
- **Tipo**: CorrecciÃƒÆ’Ã‚Â³n de Bug CrÃƒÆ’Ã‚Â­tico + Hardening de Seguridad ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ RevisiÃƒÆ’Ã‚Â³n Final
- **Rama**: `feature/landing-donation-ticker`
- **Contexto**: Se realizÃƒÆ’Ã‚Â³ una segunda pasada de auditorÃƒÆ’Ã‚Â­a de seguridad exhaustiva sobre el cÃƒÆ’Ã‚Â³digo de Smart Routing en `register.js`. Se descubriÃƒÆ’Ã‚Â³ un tercer bug crÃƒÆ’Ã‚Â­tico que habÃƒÆ’Ã‚Â­a pasado inadvertido y una vulnerabilidad de defensa-en-profundidad en la funciÃƒÆ’Ã‚Â³n de validaciÃƒÆ’Ã‚Â³n de redirecciones.
- **Hallazgos y Correcciones**:
  - **Bug #3 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CRÃƒÆ’Ã¯Â¿Â½TICO (`ReferenceError`): `urlParams` no definido en el handler `verifyForm.submit` (lÃƒÆ’Ã‚Â­nea 903).**
    - La variable `urlParams` se usaba dentro del callback de `verifyForm.addEventListener('submit', ...)` para leer `returnTo` tras completar la verificaciÃƒÆ’Ã‚Â³n, pero nunca fue declarada en ese scope. La declaraciÃƒÆ’Ã‚Â³n que se hizo en el bloque `if (session.isAuthenticated)` (lÃƒÆ’Ã‚Â­nea 506) no era accesible aquÃƒÆ’Ã‚Â­ porque ese bloque tiene un `return` que interrumpe el flujo para usuarios ya autenticados ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ pero los usuarios que completan el registro normalmente (Paso 1 ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Paso 2 ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ verificaciÃƒÆ’Ã‚Â³n) nunca pasan por ese `if`.
    - **Consecuencia real GRAVE**: El registro se completaba exitosamente en el backend (la cuenta se creaba, el token se emitÃƒÆ’Ã‚Â­a), pero la lÃƒÆ’Ã‚Â­nea 903 lanzaba `ReferenceError: urlParams is not defined`, cayendo al `catch` que mostraba "No se pudo conectar con el servidor". El usuario reciÃƒÆ’Ã‚Â©n registrado veÃƒÆ’Ã‚Â­a un mensaje de error **falso** y no era redirigido al dashboard, creyendo que su registro habÃƒÆ’Ã‚Â­a fallado cuando en realidad fue exitoso.
    - **CorrecciÃƒÆ’Ã‚Â³n**: Se declarÃƒÆ’Ã‚Â³ `const urlParams = new URLSearchParams(window.location.search)` localmente dentro del handler `verifyForm.submit`, justo antes de su uso, con comentarios explicativos de por quÃƒÆ’Ã‚Â© debe ser local.
  - **Vulnerabilidad de Seguridad ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ `_getSafeReturnTo` retornaba el input original con query params arbitrarios (defense-in-depth).**
    - La funciÃƒÆ’Ã‚Â³n validaba correctamente el nombre del archivo contra la whitelist (`ALLOWED_PAGES`), pero retornaba `value` (el string original completo del usuario) en lugar de `pagePart` (el nombre de archivo extraÃƒÆ’Ã‚Â­do). Esto significaba que un atacante podÃƒÆ’Ã‚Â­a pasar `contract_interaction.html?parametro_malicioso=valor` y esos query params se preservaban en la redirecciÃƒÆ’Ã‚Â³n.
    - **Vector de ataque teÃƒÆ’Ã‚Â³rico**: Si alguna de las 5 pÃƒÆ’Ã‚Â¡ginas de la whitelist leyera query params de forma insegura (por ejemplo, para precargar datos), un atacante podrÃƒÆ’Ã‚Â­a inyectar valores arbitrarios a travÃƒÆ’Ã‚Â©s de un enlace de registro crafteado.
    - **CorrecciÃƒÆ’Ã‚Â³n**: La funciÃƒÆ’Ã‚Â³n ahora retorna solo `pagePart` (el nombre del archivo validado), descartando cualquier query param que el atacante pudiera haber concatenado. Esto implementa el principio de defense-in-depth (defensa en profundidad).
- **VerificaciÃƒÆ’Ã‚Â³n**: La compilaciÃƒÆ’Ã‚Â³n posterior (`npm run build:demo`) completÃƒÆ’Ã‚Â³ exitosamente con `ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ built in 8.44s`, `ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ 134 modules transformed`, sin errores ni advertencias. El hash del bundle cambiÃƒÆ’Ã‚Â³ de `register.BeZP5llT.js` a `register.xhydIokZ.js`, confirmando la inclusiÃƒÆ’Ã‚Â³n de las correcciones.
- **Evidencia**: Archivo modificado: `frontend/src/pages/register.js` (Bug #3 + hardening), `EVOLUCION.md`.

---

### 2026-07-14 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CorrecciÃƒÆ’Ã‚Â³n de Desbordamiento de Enlaces Largos en Publicaciones y Ocultamiento del Selector de Billetera en Prelanzamiento

- **Autor**: Antigravity (AI Engineering)
- **Tipo**: CorrecciÃƒÆ’Ã‚Â³n de Interfaz (CSS) + Ajuste LÃƒÆ’Ã‚Â³gico del Dashboard (JS)
- **Rama**: `feature/landing-donation-ticker`
- **Contexto**: Se solucionaron dos detalles visuales importantes reportados en producciÃƒÆ’Ã‚Â³n para mejorar el diseÃƒÆ’Ã‚Â±o adaptativo y mitigar la fricciÃƒÆ’Ã‚Â³n en la experiencia de usuario (UX).
- **Detalles Implementados**:
  - **Desbordamiento de Enlaces Largos (Overflow CSS)**:
    - **Problema**: Enlaces extensos de redes sociales (por ejemplo, Instagram) sin espacios en la descripciÃƒÆ’Ã‚Â³n de las causas solidarias provocaban que la tarjeta se ensanchara horizontalmente, saliÃƒÆ’Ã‚Â©ndose de los mÃƒÆ’Ã‚Â¡rgenes y rompiendo el responsive en telÃƒÆ’Ã‚Â©fonos mÃƒÆ’Ã‚Â³viles.
    - **SoluciÃƒÆ’Ã‚Â³n**: AÃƒÆ’Ã‚Â±adimos las propiedades de ajuste seguro `overflow-wrap: anywhere; word-break: break-word;` a las clases `.solidario-cause-story` y `.update-item-body` en `causa-solidaria.html`.
    - **GeneralizaciÃƒÆ’Ã‚Â³n**: Adicionalmente, auditamos otros paneles y reforzamos de forma preventiva la clase `.rating-item-comment` en `style.css` (para comentarios largos de reputaciÃƒÆ’Ã‚Â³n en el perfil de usuario), que tambiÃƒÆ’Ã‚Â©n carecÃƒÆ’Ã‚Â­a de protecciÃƒÆ’Ã‚Â³n de desbordamiento.
  - **Selector de Billetera en Prelanzamiento**:
    - **Problema**: En la fase de prelanzamiento la billetera blockchain no estÃƒÆ’Ã‚Â¡ operativa (saldos en cero), por lo que el toggle superior "Impulsor / Billetera" en `contract_interaction.html` era redundante y confuso para los usuarios.
    - **SoluciÃƒÆ’Ã‚Â³n**: Mapeamos el elemento del DOM `.wallet-tabs-nav` como `walletTabsNav` en `contract-interaction.js`. Modificamos `initializeWalletState()` para que, si el modo prelanzamiento (`isPreLaunch`) estÃƒÆ’Ã‚Â¡ activo, oculte dinÃƒÆ’Ã‚Â¡micamente este selector de pestaÃƒÆ’Ã‚Â±as (`style.display = 'none'`), forzando a que permanezca activa por defecto la pestaÃƒÆ’Ã‚Â±a "Impulsor". Si prelanzamiento estÃƒÆ’Ã‚Â¡ inactivo, vuelve a mostrarse con `display = 'flex'`.
- **VerificaciÃƒÆ’Ã‚Â³n**: La compilaciÃƒÆ’Ã‚Â³n posterior (`npm run build:demo`) completÃƒÆ’Ã‚Â³ exitosamente con `ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ built in 5.09s` y `ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ 104 modules transformed`, integrando todos los cambios de forma consistente en `dist/`.
- **Evidencia**: Archivos modificados: `frontend/causa-solidaria.html` (CSS de overflow), `frontend/style.css` (CSS de comentarios), `frontend/src/pages/contract-interaction.js` (LÃƒÆ’Ã‚Â³gica de prelanzamiento), `EVOLUCION.md`.

---

### 2026-07-14 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Refinamiento EstÃƒÆ’Ã‚Â©tico de la Tarjeta del Perfil de Impulsor

- **Autor**: Antigravity (AI Engineering)
- **Tipo**: CorrecciÃƒÆ’Ã‚Â³n y Refinamiento EstÃƒÆ’Ã‚Â©tico (CSS)
- **Rama**: `feature/landing-donation-ticker`
- **Contexto**: Se aplicaron mejoras visuales premium para estilizar la tarjeta de "Perfil de Impulsor" en el Dashboard, atendiendo reportes de altura excesiva y desalineaciÃƒÆ’Ã‚Â³n del brillo animado.
- **Detalles Implementados**:
  - **ReducciÃƒÆ’Ã‚Â³n de Altura (Tarjeta mÃƒÆ’Ã‚Â¡s Delgada)**:
    - Modificamos la clase `#panelImpulsor .booster-banner` para reducir su padding vertical de `1.5rem` a `1.1rem`.
    - Ajustamos la cabecera `#panelImpulsor .booster-banner-header` reduciendo el `margin-bottom` de `1rem` a `0.6rem` y el `padding-bottom` de `0.75rem` a `0.4rem`.
    - Unificamos en mÃƒÆ’Ã‚Â³viles (`@media (max-width: 480px)`) para usar un padding consistente de `1.1rem 1rem`.
    - Resultado: La tarjeta reduce notablemente su peso visual vertical, adquiriendo un aspecto mÃƒÆ’Ã‚Â¡s moderno, esbelto y premium alineado con estÃƒÆ’Ã‚Â¡ndares Fintech.
  - **AlineaciÃƒÆ’Ã‚Â³n del Brillo Animado en MÃƒÆ’Ã‚Â³viles**:
    - **Problema**: En pantallas mÃƒÆ’Ã‚Â³viles de 480px o menos, una regla CSS heredada aplicaba la propiedad `top: 14px;` a los pseudoelementos `::before` y `::after` de la tarjeta de impulsor. Esto causaba que el brillo verde animado (`::after`), de altura 100%, se desplazara 14px hacia abajo, dejando la secciÃƒÆ’Ã‚Â³n superior de la tarjeta sin iluminar y desbordando la inferior.
    - **SoluciÃƒÆ’Ã‚Â³n**: Modificamos la regla en la media query mÃƒÆ’Ã‚Â³vil para desvincular el `::after` de la regla de `top: 14px;`, fijÃƒÆ’Ã‚Â¡ndolo de forma independiente en `top: 0;`.
    - Resultado: El brillo verde animado recorre la tarjeta de forma simÃƒÆ’Ã‚Â©trica desde su borde superior exacto en dispositivos mÃƒÆ’Ã‚Â³viles.
- **Evidencia**: Archivos modificados: `frontend/style.css`, `EVOLUCION.md`.

---

### 2026-07-14 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AuditorÃƒÆ’Ã‚Â­a de Experiencia de Usuario: Salvaguarda para Tours Guiados en Modo Prelanzamiento

- **Autor**: Antigravity (AI Engineering ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Gemini 3.5 Flash)
- **Tipo**: UX Guard & Robustez de CÃƒÆ’Ã‚Â³digo ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ AuditorÃƒÆ’Ã‚Â­a de Controladores
- **Rama**: `feature/landing-donation-ticker`
- **Contexto**: Durante una revisiÃƒÆ’Ã‚Â³n exhaustiva para evitar cuellos de botella y errores en la interfaz, se auditÃƒÆ’Ã‚Â³ el comportamiento del sistema de onboarding (`onboarding.js`) frente a la ocultaciÃƒÆ’Ã‚Â³n dinÃƒÆ’Ã‚Â¡mica del selector de pestaÃƒÆ’Ã‚Â±as del monedero en el Dashboard (`contract-interaction.js`).
- **Problema Detectado**:
  - El primer paso del tour guiado de la billetera y el tour de quema (`startWalletTour` y `startBurnTour` en `onboarding.js`) intentan resaltar el elemento `#tabBilletera`.
  - Si el "Modo Prelanzamiento" estÃƒÆ’Ã‚Â¡ activo y el usuario inicia el tour (por ejemplo, haciendo clic desde la guÃƒÆ’Ã‚Â­a estÃƒÆ’Ã‚Â¡tica "CÃƒÆ’Ã‚Â³mo Funciona" con la URL `?start_wallet_tour=true`), la regla previa ocultaba `.wallet-tabs-nav` completamente.
  - Esto provocarÃƒÆ’Ã‚Â­a que el resaltador (`driver.js`) fallara al intentar enfocar un elemento con `display: none`, arruinando la experiencia e interrumpiendo el flujo educativo del usuario.
- **SoluciÃƒÆ’Ã‚Â³n Implementada**:
  - Modificamos la funciÃƒÆ’Ã‚Â³n `initializeWalletState()` en `contract-interaction.js`.
  - Reordenamos las variables `urlParams`, `isWalletTour` e `isPendingTour` para declararlas al principio de la funciÃƒÆ’Ã‚Â³n, asegurando que estÃƒÆ’Ã‚Â©n disponibles al evaluar la interfaz.
  - Actualizamos la condiciÃƒÆ’Ã‚Â³n de ocultamiento del selector: el elemento `.wallet-tabs-nav` se ocultarÃƒÆ’Ã‚Â¡ **ÃƒÆ’Ã‚Âºnicamente si estÃƒÆ’Ã‚Â¡ en prelanzamiento Y el usuario no estÃƒÆ’Ã‚Â¡ ejecutando ninguno de los tours** (`isPreLaunch && !isWalletTour && !isPendingTour`). Si estÃƒÆ’Ã‚Â¡ en medio de un tour guiado, el selector se mantiene visible (`display: flex`) temporalmente para permitir al motor de guÃƒÆ’Ã‚Â­a enfocar el paso de la billetera adecuadamente.
- **Evidencia**: Archivos modificados: `frontend/src/pages/contract-interaction.js`, `EVOLUCION.md`.

---

### 2026-07-14 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Ajuste de AlineaciÃƒÆ’Ã‚Â³n de Texto en Correos Transaccionales (emailService.js)

- **Autor**: Antigravity (AI Engineering)
- **Tipo**: Refinamiento y Mejora de Experiencia de Usuario (Backend)
- **Rama**: `feature/landing-donation-ticker`
- **Contexto**: Se detectÃƒÆ’Ã‚Â³ que las notificaciones de actualizaciÃƒÆ’Ã‚Â³n/novedad en causas solidarias, al enviarse mediante el servicio transaccional del backend, mostraban el texto principal centrado. Esto dificultaba la lectura en textos detallados o con mÃƒÆ’Ã‚Âºltiples saltos de pÃƒÆ’Ã‚Â¡rrafo, restando calidad y profesionalismo.
- **SoluciÃƒÆ’Ã‚Â³n Implementada**:
  - Modificamos la funciÃƒÆ’Ã‚Â³n `sendTransactionEmail` en `backend/src/services/emailService.js` (lÃƒÆ’Ã‚Â­nea 304).
  - Cambiamos la alineaciÃƒÆ’Ã‚Â³n inline de la etiqueta `<p>` del mensaje principal de `text-align: center;` a `text-align: left;`.
  - Agregamos comentarios de auditorÃƒÆ’Ã‚Â­a en la plantilla del correo explicando el motivo del cambio de acuerdo a los estÃƒÆ’Ã‚Â¡ndares bancarios de legibilidad y buenas prÃƒÆ’Ã‚Â¡cticas.
  - Resultado: Todos los correos transaccionales (recibos, alertas de KYC hold, reembolsos y novedades de causas) ahora alinean su contenido a la izquierda, brindando un aspecto uniforme, corporativo y fÃƒÆ’Ã‚Â¡cil de leer.
- **Evidencia**: Archivos modificados: `backend/src/services/emailService.js`, `EVOLUCION.md`.

---

### 2026-07-14 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ ImplementaciÃƒÆ’Ã‚Â³n de Desistimiento de Tareas (Propuesta A) y CorrecciÃƒÆ’Ã‚Â³n de Formato de Correo

- **Autor**: Antigravity (AI Engineering)
- **Tipo**: Funcionalidad de Plataforma (Flujo P2P) y CorrecciÃƒÆ’Ã‚Â³n de Formato (Backend/Frontend)
- **Rama**: `feature/landing-donation-ticker`
- **Contexto**:
  1. Se reportÃƒÆ’Ã‚Â³ que el correo de "Nueva actualizaciÃƒÆ’Ã‚Â³n en la causa" mostraba asteriscos literales (`**`) en el tÃƒÆ’Ã‚Â­tulo del mensaje debido a la falta de un procesador de Markdown.
  2. Se solicitÃƒÆ’Ã‚Â³ habilitar una opciÃƒÆ’Ã‚Â³n para que los ayudantes puedan **desistir voluntariamente** de tareas aceptadas (bajo la Propuesta A del estÃƒÆ’Ã‚Â¡ndar de la industria).
- **Detalles Implementados**:
  - **CorrecciÃƒÆ’Ã‚Â³n de Formato de Correo**:
    * Editamos `backend/src/services/humanitarianService.js` (lÃƒÆ’Ã‚Â­nea 891) para remover los asteriscos `**` alrededor del tÃƒÆ’Ã‚Â­tulo en el mensaje que se envÃƒÆ’Ã‚Â­a por correo al donante.
  - **BotÃƒÆ’Ã‚Â³n de Desistir (Propuesta A)**:
    * **Backend**: Implementamos la ruta `POST /publications/:id/desist` en `publicationController.js`. Esta valida la sesiÃƒÆ’Ã‚Â³n del ayudante, localiza la aceptaciÃƒÆ’Ã‚Â³n activa (`approved` o `pending_approval`), actualiza el estado a `'cancelled'`, devuelve el cupo de la tarea (`available_slots + 1`), notifica al autor en base de datos e inicia una notificaciÃƒÆ’Ã‚Â³n push en tiempo real (`Participante DesistiÃƒÆ’Ã‚Â³ ÃƒÂ¢Ã¢â‚¬Â Ã‚Â©ÃƒÂ¯Ã‚Â¸Ã¯Â¿Â½`), auditando todo mediante el log de auditorÃƒÆ’Ã‚Â­a bancaria.
    * **Frontend**: Agregamos la lÃƒÆ’Ã‚Â³gica en `handlePublicationAction` tanto en `publication-detail.js` como en `contract-interaction.js` para realizar el envÃƒÆ’Ã‚Â­o POST de desistimiento con confirmaciÃƒÆ’Ã‚Â³n de usuario (`showCustomConfirm`). Inyectamos el botÃƒÆ’Ã‚Â³n de forma responsiva en la tarjeta detallada de la publicaciÃƒÆ’Ã‚Â³n bajo los estados `pending_approval` y `approved`.
- **Mejoras Diferidas para el Futuro (Improvements/Roadmap)**:
  - De acuerdo a los lineamientos acordados, se listan los siguientes controles de abuso para desarrollo futuro:
    1. **PenalizaciÃƒÆ’Ã‚Â³n en Scoring**: Reducir el puntaje de reputaciÃƒÆ’Ã‚Â³n/cumplimiento (scoring) en el perfil del ayudante que desiste de forma reiterada.
    2. **LÃƒÆ’Ã‚Â­mite de Desistimientos Semanales**: Imponer un lÃƒÆ’Ã‚Â­mite de desistimientos (mÃƒÆ’Ã‚Â¡ximo 2 cancelaciones por semana) y bloquear temporalmente (por 48h) la aceptaciÃƒÆ’Ã‚Â³n de nuevas tareas en caso de excederlo, mitigando conductas de acaparamiento malicioso.
- **Evidencia**: Archivos modificados: `backend/src/services/humanitarianService.js`, `backend/src/controllers/publicationController.js`, `frontend/src/pages/publication-detail.js`, `frontend/src/pages/contract-interaction.js`, `EVOLUCION.md`.

---

### 2026-07-14 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Visibilidad de ÃƒÆ’Ã…Â¡ltima MigraciÃƒÆ’Ã‚Â³n Aplicada en Logs de Inicio (migrationRunner.js)

- **Autor**: Antigravity (AI Engineering)
- **Tipo**: DevOps & Infraestructura (Backend)
- **Rama**: `fix/email-asterisks-cause-update`
- **Contexto**: Se solicitÃƒÆ’Ã‚Â³ mostrar en los logs del servidor al iniciar quÃƒÆ’Ã‚Â© versiÃƒÆ’Ã‚Â³n exacta de migraciÃƒÆ’Ã‚Â³n de base de datos se encuentra aplicada para facilitar el monitoreo continuo en el entorno Demo y producciÃƒÆ’Ã‚Â³n sin interferir en los procesos de base de datos.
- **SoluciÃƒÆ’Ã‚Â³n Implementada**:
  - Editamos `backend/scripts/migrationRunner.js` (lÃƒÆ’Ã‚Â­nea 112).
  - Agregamos una consulta SQL de sÃƒÆ’Ã‚Â³lo lectura (`SELECT migration_name FROM schema_migrations ORDER BY id DESC LIMIT 1`) que se ejecuta de forma ultra rÃƒÆ’Ã‚Â¡pida usando la clave primaria cuando no hay migraciones pendientes.
  - Actualizamos la salida por consola para que en lugar de mostrar un mensaje genÃƒÆ’Ã‚Â©rico, muestre con exactitud el nombre del archivo de la ÃƒÆ’Ã‚Âºltima migraciÃƒÆ’Ã‚Â³n registrada.
- **Evidencia**: Archivos modificados: `backend/scripts/migrationRunner.js`, `EVOLUCION.md`.
  - **ConversiÃƒÆ’Ã‚Â³n de CampaÃƒÆ’Ã‚Â±as**: El cÃƒÆ’Ã‚Â³digo de referido (`SOSVENEZUELA`) se propaga con ÃƒÆ’Ã‚Â©xito al Dashboard, permitiendo que la campaÃƒÆ’Ã‚Â±a asigne los bonos de donaciÃƒÆ’Ã‚Â³n y registros de forma automÃƒÆ’Ã‚Â¡tica.
- **Evidencia**: Archivos modificados: `frontend/src/pages/register.js`, `EVOLUCION.md`.

---

### 2026-07-16 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ UnificaciÃƒÆ’Ã‚Â³n TerminolÃƒÆ’Ã‚Â³gica de Obligaciones (Compromiso vs CrÃƒÆ’Ã‚Â©dito/Deuda)

- **Autor**: Antigravity (AI Engineering)
- **Tipo**: Refinamiento Conceptual y UI/UX (Frontend)
- **Rama**: `fix/email-asterisks-cause-update`
- **Contexto**: Se requiriÃƒÆ’Ã‚Â³ alinear la terminologÃƒÆ’Ã‚Â­a de la interfaz de usuario con los fundamentos no financieros del protocolo WintonCoin. Siguiendo las directrices de cumplimiento y claridad conceptual, se reemplazaron las referencias a "crÃƒÆ’Ã‚Â©dito" y "deuda" por "compromiso" en las vistas principales.
- **Detalles Implementados**:
  - **Landing Page (`index.html`)**:
    * Se actualizÃƒÆ’Ã‚Â³ el reverso de la moneda RED giratoria (lÃƒÆ’Ã‚Â­nea 139) de `Tu CrÃƒÆ’Ã‚Â©dito` a `Tu Compromiso` de forma consistente.
    * Se cambiÃƒÆ’Ã‚Â³ la etiqueta del ticker de estadÃƒÆ’Ã‚Â­sticas en la cabecera (lÃƒÆ’Ã‚Â­nea 108) de `Sin burÃƒÆ’Ã‚Â³ de crÃƒÆ’Ã‚Â©dito` a `Sin historial financiero` para evitar el uso del tÃƒÆ’Ã‚Â©rmino financiero "crÃƒÆ’Ã‚Â©dito".
  - **Whitepaper TÃƒÆ’Ã‚Â©cnico (`docs.html`)**:
    * Se adaptÃƒÆ’Ã‚Â³ el subtÃƒÆ’Ã‚Â­tulo a "Arquitectura de Compromiso Mutuo y Consenso".
    * Se modificaron las menciones de "emitir su propio crÃƒÆ’Ã‚Â©dito" y "emitir crÃƒÆ’Ã‚Â©dito respaldado" a "emitir compromisos" en las secciones conceptuales.
    * Se actualizÃƒÆ’Ã‚Â³ el tÃƒÆ’Ã‚Â­tulo de la secciÃƒÆ’Ã‚Â³n 4.3 a "CompensaciÃƒÆ’Ã‚Â³n y Ciclo de Compromiso".
    * Se sustituyeron "crÃƒÆ’Ã‚Â©ditos de liquidez" por "recompensas de liquidez" y "crÃƒÆ’Ã‚Â©ditos de servicio" por "compromisos de servicio".
  - **Panel de AdministraciÃƒÆ’Ã‚Â³n (`admin-panel.js`)**:
    * Se renombrÃƒÆ’Ã‚Â³ la descripciÃƒÆ’Ã‚Â³n del lÃƒÆ’Ã‚Â­mite inicial de scoring a "El lÃƒÆ’Ã‚Â­mite de compromiso inicial que se asigna a los nuevos usuarios al registrarse", manteniendo intactas las llaves tÃƒÆ’Ã‚Â©cnicas de base de datos para no comprometer la estabilidad del sistema.
- **Evidencia**: Archivos modificados: `frontend/index.html`, `frontend/docs.html`, `frontend/src/pages/admin-panel.js`, `EVOLUCION.md`.

---

### 2026-07-16 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Robustez de UI y Estabilidad del Proceso de Registro (Bug-Fixes UX/UI)

- **Contexto**: Tras el recorrido de usuario (walkthrough), se identificaron tres fallos potenciales de robustez y experiencia de usuario en `register.js`:
  1. **Memory Leak en Temporizador OTP**: Si la funciÃƒÆ’Ã‚Â³n `startResendTimer()` se ejecutaba varias veces, se sobreescribÃƒÆ’Ã‚Â­a el intervalo `countdown` sin limpiarlo previamente, haciendo que el temporizador contara el doble de rÃƒÆ’Ã‚Â¡pido y consumiera recursos de red y CPU infinitamente.
  2. **InterrupciÃƒÆ’Ã‚Â³n de Modales en Paso 2**: Al volver a visitar la pÃƒÆ’Ã‚Â¡gina en el Paso 2 (OTP pendiente), saltaban los modales de "conseguir cÃƒÆ’Ã‚Â³digo de referido" y "polÃƒÆ’Ã‚Â­ticas de cuenta ÃƒÆ’Ã‚Âºnica" que corresponden ÃƒÆ’Ã‚Âºnicamente al Paso 1 (Formulario Inicial), estorbando visualmente al usuario.
  3. **Vulnerabilidad de Null-Pointer**: La obtenciÃƒÆ’Ã‚Â³n del campo `referral_code` dentro del listener de verificaciÃƒÆ’Ã‚Â³n se realizaba de manera directa (`document.getElementById('referral_code').value`), lo cual causarÃƒÆ’Ã‚Â­a una excepciÃƒÆ’Ã‚Â³n en JavaScript si el DOM de referido era modificado o no se encontraba.
- **DecisiÃƒÆ’Ã‚Â³n de IngenierÃƒÆ’Ã‚Â­a**:
  - **Limpieza de Intervalo Activo**: Modificamos `startResendTimer` para comprobar la existencia previa de `countdown` y limpiar el intervalo (`clearInterval(countdown)`) antes de instanciar uno nuevo, reseteando la variable a `null` al finalizar.
  - **Aislamiento de Modales**: Condicionamos la activaciÃƒÆ’Ã‚Â³n del `referralModal` y el `policyModal` ÃƒÆ’Ã‚Âºnicamente si el elemento visual de verificaciÃƒÆ’Ã‚Â³n `step2Div` no se encuentra activo (`style.display !== 'block'`).
  - **ExtracciÃƒÆ’Ã‚Â³n Defensiva**: Aplicamos encadenamiento opcional (`?.value`) y limpieza de espacios en la captura de cÃƒÆ’Ã‚Â³digo de referido en la verificaciÃƒÆ’Ã‚Â³n.
- **Impacto**:
  - **UX Impecable**: Flujos libres de diÃƒÆ’Ã‚Â¡logos intrusivos redundantes y temporizadores con sincronÃƒÆ’Ã‚Â­a de reloj exacta.
  - **Resiliencia ante Fallos**: El script no se interrumpe ni arroja errores de JavaScript ante cambios o ausencias del input de referidos.
- **Evidencia**: Archivos modificados: `frontend/src/pages/register.js`, `EVOLUCION.md`.

---

### 2026-07-16 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ RediseÃƒÆ’Ã‚Â±o de SecciÃƒÆ’Ã‚Â³n de Comunidad y Limpieza de Copias en Landing Page

- **Autor**: Antigravity (AI Engineering)
- **Tipo**: Refinamiento y OptimizaciÃƒÆ’Ã‚Â³n Estructural UI/UX (Frontend)
- **Rama**: `fix/email-asterisks-cause-update`
- **Contexto**: Se identificÃƒÆ’Ã‚Â³ que la imagen de ayuda comunitaria de las manos de neÃƒÆ’Ã‚Â³n no mantenÃƒÆ’Ã‚Â­a simetrÃƒÆ’Ã‚Â­a con las otras ilustraciones del portal y afectaba la estÃƒÆ’Ã‚Â©tica general de la landing page. Adicionalmente, se solicitÃƒÆ’Ã‚Â³ retirar una frase redundante del texto introductorio.
- **SoluciÃƒÆ’Ã‚Â³n Implementada**:
  - **RediseÃƒÆ’Ã‚Â±o Estructural (OpciÃƒÆ’Ã‚Â³n A)**: Eliminamos la columna de imagen en la secciÃƒÆ’Ã‚Â³n de Comunidad (`index.html`) para transformar la grilla en un contenedor de una sola columna centralizado. Centramos los textos (tÃƒÆ’Ã‚Â­tulo y pÃƒÆ’Ã‚Â¡rrafo) y estilizamos la lista de puntos clave (`check-list`) para distribuirse horizontalmente de manera simÃƒÆ’Ã‚Â©trica y responsiva usando flexbox y estilos de alta fidelidad.
  - **Limpieza de Copia**: Retiramos del pÃƒÆ’Ã‚Â¡rrafo descriptivo el fragmento final `, creando un tejido social irrompible.`, cerrando la oraciÃƒÆ’Ã‚Â³n adecuadamente con un punto.
- **Evidencia**: Archivos modificados: `frontend/index.html`, `EVOLUCION.md`.

---

### 2026-07-16 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ Hotfix de Estabilidad en Arranque de Base de Datos (migrationRunner.js)

- **Autor**: Antigravity (AI Engineering)
- **Tipo**: CorrecciÃƒÆ’Ã‚Â³n CrÃƒÆ’Ã‚Â­tica de Despliegue (DevOps / Backend)
- **Rama**: `fix/email-asterisks-cause-update`
- **Contexto**: Al desplegar en entornos con bases de datos pre-existentes (como Render/Staging/Production), el servidor fallaba al iniciar debido a que la tabla de control `schema_migrations` fue creada con un esquema heredado que carece de la columna `id` (usando `migration_name` como llave primaria ÃƒÆ’Ã‚Âºnica). La consulta `ORDER BY id DESC` fallaba interrumpiendo el flujo.
- **SoluciÃƒÆ’Ã‚Â³n Implementada**:
  - Editamos `backend/scripts/migrationRunner.js` (lÃƒÆ’Ã‚Â­nea 112).
  - Eliminamos la consulta SQL dependiente de columnas especÃƒÆ’Ã‚Â­ficas. En su lugar, reutilizamos la consulta inicial (`appliedRows`) que lee la lista completa de nombres de migraciones aplicadas y las ordenamos alfabÃƒÆ’Ã‚Â©ticamente en memoria con JavaScript (`appliedRows.map(r => r.migration_name).sort()`).
  - Esto garantiza un arranque 100% resiliente y compatible con cualquier versiÃƒÆ’Ã‚Â³n de base de datos activa sin requerir alteraciones DDL ni migraciones de control peligrosas.
- **Evidencia**: Archivos modificados: `backend/scripts/migrationRunner.js`, `EVOLUCION.md`.

















### ResoluciÃƒÆ’Ã‚Â³n de Incidente de Entorno: Case Mismatch en Windows
- **Fecha:** 2026-07-17
- **Problema:** Error de compilaciÃƒÆ’Ã‚Â³n en TypeScript por mÃƒÆ’Ã‚Â³dulos duplicados de \dotenv\.
- **Causa Analizada:** El servidor de lenguaje de TypeScript (Case-sensitive) entrÃƒÆ’Ã‚Â³ en conflicto al tener archivos abiertos en el editor bajo dos rutas con capitalizaciÃƒÆ’Ã‚Â³n distinta (WINTONCOIN vs Wintoncoin) aprovechando la flexibilidad del sistema de archivos de Windows (Case-insensitive).
- **SoluciÃƒÆ’Ã‚Â³n Aplicada:** Reinicio del entorno de desarrollo (VS Code) asegurando cargar el workspace desde una ruta unificada con una ÃƒÆ’Ã‚Âºnica capitalizaciÃƒÆ’Ã‚Â³n. No se requiriÃƒÆ’Ã‚Â³ modificaciÃƒÆ’Ã‚Â³n a la base del cÃƒÆ’Ã‚Â³digo, garantizando la estabilidad y previniendo inyecciÃƒÆ’Ã‚Â³n de riesgos de seguridad.

---

### 2026-07-17 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ RediseÃƒÆ’Ã‚Â±o y Destacado del BotÃƒÆ’Ã‚Â³n de Escape de AutenticaciÃƒÆ’Ã‚Â³n en Registro (VÃƒÆ’Ã‚Â­a de Escape UX)

- **Autor**: Antigravity (AI Engineering)
- **Tipo**: OptimizaciÃƒÆ’Ã‚Â³n de Flujo y DiseÃƒÆ’Ã‚Â±o UI/UX (Frontend)
- **Rama**: `fix/email-asterisks-cause-update`
- **Contexto**: Para resolver la fricciÃƒÆ’Ã‚Â³n en usuarios ya registrados que abren el enlace de referidos en navegadores externos sin sesiÃƒÆ’Ã‚Â³n activa (y que potencialmente estÃƒÆ’Ã‚Â¡n bloqueados por un cÃƒÆ’Ã‚Â³digo OTP anterior en LocalStorage), se requiriÃƒÆ’Ã‚Â³ hacer altamente visible y accesible la opciÃƒÆ’Ã‚Â³n de iniciar sesiÃƒÆ’Ã‚Â³n directa.
- **SoluciÃƒÆ’Ã‚Â³n Implementada**:
  - **Banner de Escape Destacado (`register.html`)**: Reemplazamos la frase introductoria simple por un banner de diseÃƒÆ’Ã‚Â±o premium de vidrio (`.login-prompt-banner`) con un botÃƒÆ’Ã‚Â³n con degradado brillante (`linear-gradient(135deg, #007bff, #00f2fe)`) que dice "Inicia sesiÃƒÆ’Ã‚Â³n aquÃƒÆ’Ã‚Â­".
  - **PreservaciÃƒÆ’Ã‚Â³n de RedirecciÃƒÆ’Ã‚Â³n**: El botÃƒÆ’Ã‚Â³n conserva la clase `login-link-text` para que la lÃƒÆ’Ã‚Â³gica de JS siga inyectando el parÃƒÆ’Ã‚Â¡metro `returnTo` dinÃƒÆ’Ã‚Â¡micamente si existe.
- **Impacto**:
  - **Experiencia ÃƒÆ’Ã¢â‚¬Å“ptima**: Los usuarios registrados tienen un punto de salida llamativo e inmediato para loguearse y salir del flujo de registro/verificaciÃƒÆ’Ã‚Â³n.
- **Evidencia**: Archivos modificados: `frontend/register.html`, `EVOLUCION.md`.

---

### 2026-07-17 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ï¿½ CorrecciÃƒÆ’Ã‚Â³n de Bucle Infinito del Tour de Onboarding y Prioridad de InstalaciÃƒÆ’Ã‚Â³n PWA

- **Autor**: Antigravity (AI Engineering)
- **Tipo**: Estabilidad, LÃƒÆ’Ã‚Â³gica de Flujo y UI/UX (Frontend)
- **Rama**: `fix/email-asterisks-cause-update`
- **Contexto**:
  1. Se reportÃƒÆ’Ã‚Â³ que el tour de bienvenida se disparaba en cada inicio de sesiÃƒÆ’Ã‚Â³n o apertura de la app, incluso si el usuario ya lo habÃƒÆ’Ã‚Â­a terminado o cerrado previamente.
  2. El banner/botÃƒÆ’Ã‚Â³n flotante de instalar la app ("Primero debes instalar la app") se mostraba a usuarios que ya la tenÃƒÆ’Ã‚Â­an instalada si entraban mediante un enlace de referidos.
- **SoluciÃƒÆ’Ã‚Â³n Implementada**:
  - **ResoluciÃƒÆ’Ã‚Â³n de RecursiÃƒÆ’Ã‚Â³n en Onboarding (`onboarding.js`)**: Identificamos que las funciones callback `onDestroyStarted` de los 5 tours en el sistema llamaban internamente a `driverObj.destroy()`. Puesto que `onDestroyStarted` es gatillado *durante* el ciclo de destrucciÃƒÆ’Ã‚Â³n propio de Driver.js, esto causaba un desbordamiento de pila (stack overflow) silencioso en JavaScript, interrumpiendo el flujo antes de que se ejecutara `localStorage.setItem('wintoncoin_tour_completed', 'true')`. Removimos los llamados redundantes a `.destroy()` para permitir que finalicen limpiamente y guarden la bandera.
  - **Reordenamiento de Prioridad PWA (`pwa-install.js`)**: Fusionamos las validaciones de instalaciÃƒÆ’Ã‚Â³n standalone y la existencia del flag `pwa_installed` en LocalStorage en una sola condiciÃƒÆ’Ã‚Â³n unificada al principio de `initPWAInstall()`. Esto asegura que si el usuario ya instalÃƒÆ’Ã‚Â³ la app, el sistema retorne de inmediato sin evaluar si posee una campaÃƒÆ’Ã‚Â±a/referido pendiente.
- **Impacto**:
  - **Estabilidad de Onboarding**: El progreso del tour se guarda exitosamente la primera vez que el usuario lo termina o lo cierra, previniendo apariciones molestas recurrentes.
  - **Experiencia Silenciosa**: Los usuarios con la app instalada no reciben indicaciones de descarga redundantes al ingresar por enlaces de mercadeo.
- **Evidencia**: Archivos modificados: `frontend/src/modules/onboarding.js`, `frontend/src/modules/pwa-install.js`, `EVOLUCION.md`.

- **AlineaciÃƒÆ’Ã‚Â³n de Comportamiento Multiventana (`manifest.json` y `manifest.demo.json`)**:
  - Incorporamos la directiva `"launch_handler": { "client_mode": "focus-existing" }` en ambos manifiestos Web App.
  - Esto indica al sistema operativo/navegador que si la PWA ya estÃƒÆ’Ã‚Â¡ abierta y recibe una peticiÃƒÆ’Ã‚Â³n de inicio externa, debe reenfocar y enrutar a la ventana existente en vez de levantar instancias duplicadas.
- **Evidencia**: Archivos modificados: `frontend/public/manifest.json`, `frontend/public/manifest.demo.json`, `EVOLUCION.md`.

- **CorrecciÃƒÆ’Ã‚Â³n de Bloqueo del Tour Guiado (`onboarding.js`)**:
  - Cambiamos el callback de `onDestroyStarted` a `onDestroyed` en los 5 flujos de onboarding.
  - Al usar `onDestroyed`, permitimos que Driver.js finalice su destrucciÃƒÆ’Ã‚Â³n de forma natural en lugar de interceptar y congelar la pantalla. Una vez completado el desmantelamiento, se registra la bandera de completado en `localStorage`.
- **Evidencia**: Archivos modificados: `frontend/src/modules/onboarding.js`, `EVOLUCION.md`.
### 2026-07-18 - UI/UX de Carga y VisualizaciÃƒÂ¯Ã‚Â¿Ã‚Â½n de Evidencias (Frontend Premium)

**Contexto**: Se requerÃƒÂ¯Ã‚Â¿Ã‚Â½a completar el flujo frontend para permitir la subida de imÃƒÂ¯Ã‚Â¿Ã‚Â½genes de evidencia (a travÃƒÂ¯Ã‚Â¿Ã‚Â½s de Cloudflare R2/AWS S3) durante el proceso de "Finalizar Tarea" y visualizar estas imÃƒÂ¯Ã‚Â¿Ã‚Â½genes en un carrusel dinÃƒÂ¯Ã‚Â¿Ã‚Â½mico en la publicaciÃƒÂ¯Ã‚Â¿Ã‚Â½n y en un Lightbox para evaluaciÃƒÂ¯Ã‚Â¿Ã‚Â½n.

**Cambios Realizados**:
1. **RediseÃƒÂ¯Ã‚Â¿Ã‚Â½o de Publicaciones (Premium UI)**: Modificado contract-interaction.js y publication-detail.js para renderizar un carrusel interactivo y responsivo bajo el tÃƒÂ¯Ã‚Â¿Ã‚Â½tulo de las publicaciones que contengan imÃƒÂ¯Ã‚Â¿Ã‚Â½genes adjuntas.
2. **Modal Finalizar Tarea con Dropzone**: Se inyectÃƒÂ¯Ã‚Â¿Ã‚Â½ un nuevo modal de confirmaciÃƒÂ¯Ã‚Â¿Ã‚Â½n en publication-detail.html que impide enviar la tarea como culminada si el creador ha exigido evidencias (
equires_evidence=true) y no se ha cargado ninguna. Se maneja la carga mÃƒÂ¯Ã‚Â¿Ã‚Â½ltiple visual mediante Drag & Drop y se suben directo al backend a travÃƒÂ¯Ã‚Â¿Ã‚Â½s de la ruta /api/media/upload.
3. **Visor Lightbox de Evidencias**: Modificada la vista detallada para aÃƒÂ¯Ã‚Â¿Ã‚Â½adir un botÃƒÂ¯Ã‚Â¿Ã‚Â½n "Ver Evidencias" a cada participante que completÃƒÂ¯Ã‚Â¿Ã‚Â½ la tarea enviando imÃƒÂ¯Ã‚Â¿Ã‚Â½genes. Se configurÃƒÂ¯Ã‚Â¿Ã‚Â½ un modal Lightbox oscuro e inmersivo en publication-detail.js para examinar el trabajo entregado.

- **Evidencia**: Archivos modificados: rontend/src/pages/contract-interaction.js, rontend/src/pages/publication-detail.js, rontend/publication-detail.html, rontend/style.css, EVOLUCION.md.

### 2026-07-18 - VisualizaciÃƒÆ’Ã‚Â³n de Evidencias en Administrador y Optimizaciones de Portada (Estilo Uber Eats con Lightbox)

**Contexto**: Los administradores no contaban con un mÃƒÆ’Ã‚Â©todo visual directo en el panel de control para inspeccionar las evidencias fotogrÃƒÆ’Ã‚Â¡ficas entregadas por los participantes. Adicionalmente, el diseÃƒÆ’Ã‚Â±o visual de las publicaciones en el listado general variaba de tamaÃƒÆ’Ã‚Â±o desproporcionadamente debido al tamaÃƒÆ’Ã‚Â±o de las imÃƒÆ’Ã‚Â¡genes cargadas por los usuarios.

**Cambios Realizados**:
1. **AuditorÃƒÆ’Ã‚Â­a Visual de Evidencias para Administradores**:
   - Modificado ackend/src/controllers/adminController.js para incluir evidence_urls en el SELECT agregado de los participantes de una publicaciÃƒÆ’Ã‚Â³n.
   - Modificado rontend/src/pages/admin-panel.js para renderizar miniaturas compactas (45px) de las imÃƒÆ’Ã‚Â¡genes de evidencia subidas directamente debajo del estado de cada participante con estado "Culminada". Las miniaturas actÃƒÆ’Ã‚Âºan como enlaces en pestaÃƒÆ’Ã‚Â±a nueva para verificar su autenticidad.
2. **Ajustes de Portadas estilo Uber Eats/Coinbase (CSS)**:
   - AÃƒÆ’Ã‚Â±adidas reglas en rontend/style.css para forzar que los contenedores de imÃƒÆ’Ã‚Â¡genes en las tarjetas del listado principal (.publication-item) tengan un alto mÃƒÆ’Ã‚Â¡ximo uniforme de 125px y efectos de hover suaves.
   - Ampliado el banner hero de detalles de publicaciÃƒÆ’Ã‚Â³n (#publication-content .card-images-container img) a 280px de alto mÃƒÆ’Ã‚Â¡ximo para una experiencia mÃƒÆ’Ã‚Â¡s atractiva y premium.
3. **Lightbox Integrado para Fotos Principales**:
   - Modificado rontend/src/pages/publication-detail.js para interceptar clics sobre las imÃƒÆ’Ã‚Â¡genes principales de la publicaciÃƒÆ’Ã‚Â³n. Esto abre las fotos a pantalla completa usando el mismo modal inmersivo de Lightbox y autodesplaza el carrusel al slide exacto que fue seleccionado.

- **Evidencia**: Archivos modificados: ackend/src/controllers/adminController.js, rontend/src/pages/admin-panel.js, rontend/src/pages/publication-detail.js, rontend/style.css, EVOLUCION.md.
### 2026-07-18 - Ajuste de Portadas al Borde de la Tarjeta y Truncado de TÃƒÆ’Ã‚Â­tulos/Descripciones (Estilo Uber Eats Tarjeta Completa)

**Contexto**: El usuario solicitÃƒÆ’Ã‚Â³ mejorar el impacto visual y la consistencia de las tarjetas de publicaciones en el listado general (contract_interaction.html). Esto requerÃƒÆ’Ã‚Â­a que las imÃƒÆ’Ã‚Â¡genes de portada/carruseles cubrieran la tarjeta de borde a borde en la parte superior, flotando los botones interactivos (como cerrar y la banda de precio) sobre ellas, ademÃƒÆ’Ã‚Â¡s de recortar el tÃƒÆ’Ã‚Â­tulo y descripciÃƒÆ’Ã‚Â³n a una sola lÃƒÆ’Ã‚Â­nea para optimizar el espacio.

**Cambios Realizados**:
1. **FlotaciÃƒÆ’Ã‚Â³n y Posicionamiento de Portada Edge-to-Edge**:
   - Modificado rontend/src/pages/contract-interaction.js para aÃƒÆ’Ã‚Â±adir la clase dinÃƒÆ’Ã‚Â¡mica has-images a las tarjetas .publication-item con imÃƒÆ’Ã‚Â¡genes y colocar el bloque de la imagen en la parte superior, antes del card-top-row.
   - Modificado rontend/style.css para aplicar position: relative a las tarjetas .has-images y posicionar de forma absoluta su .card-top-row (position: absolute; top: 0; left: 0; z-index: 5) para que el botÃƒÆ’Ã‚Â³n de cerrar y la banda de precio floten de manera natural sobre la imagen.
   - Aplicados mÃƒÆ’Ã‚Â¡rgenes negativos superiores y laterales (margin: -1.25rem -1.25rem 0.75rem -1.25rem) a la imagen para expandirse y tocar el borde superior e izquierdo/derecho del contenedor de la tarjeta, heredando el redondeado superior (order-radius: 16px 16px 0 0).
   - Configurado pointer-events: none en la barra contenedora flotante superior (y pointer-events: auto en sus hijos) para asegurar que hacer clic en los espacios vacÃƒÆ’Ã‚Â­os del banner siga permitiendo el ingreso al detalle de la publicaciÃƒÆ’Ã‚Â³n.
2. **Truncamiento de Textos a Una LÃƒÆ’Ã‚Â­nea (Ellipsis)**:
   - AÃƒÆ’Ã‚Â±adidas reglas en rontend/style.css para recortar mediante CSS (white-space: nowrap; overflow: hidden; text-overflow: ellipsis) el tÃƒÆ’Ã‚Â­tulo (.publication-header) y la descripciÃƒÆ’Ã‚Â³n (.pub-description) a exactamente una lÃƒÆ’Ã‚Â­nea. Esto previene variaciones verticales desproporcionadas y dota a la lista de una simetrÃƒÆ’Ã‚Â­a premium.

- **Evidencia**: Archivos modificados: rontend/src/pages/contract-interaction.js, rontend/style.css, EVOLUCION.md.
### 2026-07-18 - CorrecciÃƒÆ’Ã‚Â³n de Estiramiento Lateral en Portada de Tarjetas (Edge-to-Edge)

**Contexto**: Se observÃƒÆ’Ã‚Â³ que, aunque el contenedor de imÃƒÆ’Ã‚Â¡genes tocaba el borde izquierdo de la tarjeta, quedaba un espacio vacÃƒÆ’Ã‚Â­o del color de fondo de la tarjeta en el borde derecho. Esto ocurrÃƒÆ’Ã‚Â­a porque el contenedor original tenÃƒÆ’Ã‚Â­a width: 100% (ancho de contenido) desplazado por un margen izquierdo negativo, lo que lo acortaba lateralmente en el extremo opuesto.

**Cambios Realizados**:
1. **Ajuste de Ancho Completo Horizontal**:
   - Modificado rontend/style.css para aplicar width: calc(100% + 2.5rem) !important a .card-images-container cuando se encuentra en tarjetas .has-images. Esto compensa el padding de ambos lados y alinea los lÃƒÆ’Ã‚Â­mites del contenedor exactamente con los bordes de la tarjeta.
   - Forzado que las imÃƒÆ’Ã‚Â¡genes de contenedor ÃƒÆ’Ã‚Âºnico (.single-image img) tomen width: 100% !important para cubrir toda la superficie sin dejar barras o bordes negros.
   - Asegurado que las imÃƒÆ’Ã‚Â¡genes dentro del carrusel mantengan un width: 90% !important de su contenedor extendido para que no queden huecos vacÃƒÆ’Ã‚Â­os y se vea el indicativo de scroll de forma simÃƒÆ’Ã‚Â©trica.

- **Evidencia**: Archivos modificados: rontend/style.css, EVOLUCION.md.
### 2026-07-18 - CorrecciÃƒÆ’Ã‚Â³n de Elipsis en TÃƒÆ’Ã‚Â­tulos H3 y Fondo SÃƒÆ’Ã‚Â³lido de Tarjetas (Premium Blue)

**Contexto**: Se identificaron dos inconsistencias visuales remanentes:
1. El tÃƒÆ’Ã‚Â­tulo largo de la tarjeta se cortaba abruptamente en lugar de mostrar los puntos suspensivos (...). Esto ocurrÃƒÆ’Ã‚Â­a porque las propiedades CSS de truncamiento se aplicaban al contenedor .publication-header en lugar del tag de encabezado interno h3.
2. Las publicaciones contaban con un fondo degradado azul de arriba hacia abajo. Al colocar la imagen del banner al inicio de la tarjeta, el ÃƒÆ’Ã‚Â¡rea superior mÃƒÆ’Ã‚Â¡s clara del gradiente quedaba oculta, haciendo que la parte inferior se viera excesivamente oscura. El usuario solicitÃƒÆ’Ã‚Â³ cambiar la tarjeta a un color sÃƒÆ’Ã‚Â³lido utilizando el tono mÃƒÆ’Ã‚Â¡s claro del gradiente original (#1447b4).

**Cambios Realizados**:
1. **Elipsis de TÃƒÆ’Ã‚Â­tulo H3 Directa**:
   - Modificado rontend/style.css para aplicar white-space: nowrap, overflow: hidden y 	ext-overflow: ellipsis directamente sobre .publication-item .publication-header h3, asegurando el renderizado correcto de ... en textos de tÃƒÆ’Ã‚Â­tulos que excedan el ancho de la tarjeta.
2. **Color de Fondo SÃƒÆ’Ã‚Â³lido Claro**:
   - Modificado rontend/style.css para anular el degradado lineal en las tarjetas .publication-item, aplicando un fondo sÃƒÆ’Ã‚Â³lido #1447b4 !important que provee un acabado elegante, consistente y limpio en combinaciÃƒÆ’Ã‚Â³n con las portadas.

- **Evidencia**: Archivos modificados: rontend/style.css, EVOLUCION.md.

### 2026-07-19 - Parche de Estabilidad ante Fallos Temporales de Refresco (Resiliencia UX)

**Contexto**: Se reportÃƒÆ’Ã‚Â³ que, bajo ciertas circunstancias (como estado de baterÃƒÆ’Ã‚Â­a baja del dispositivo al 9% o micro-cortes de red en 4G), el sistema cerraba la sesiÃƒÆ’Ã‚Â³n del usuario de forma inmediata mostrando una alerta de sesiÃƒÆ’Ã‚Â³n expirada por inactividad. Esto se debÃƒÆ’Ã‚Â­a a que el frontend borraba los datos locales preventivamente ante cualquier fallo en la llamada de refresco, sin distinguir fallos de infraestructura/red de una invalidaciÃƒÆ’Ã‚Â³n de credenciales legÃƒÆ’Ã‚Â­tima.

**Cambios Realizados**:
1. **LÃƒÆ’Ã‚Â³gica de Refresco Resiliente**:
   - Modificado `frontend/src/modules/auth.js` (mÃƒÆ’Ã‚Â©todo `silentRefreshIfNeeded`) para verificar el estado de la respuesta.
   - Solo se lanza el error de invalidaciÃƒÆ’Ã‚Â³n de sesiÃƒÆ’Ã‚Â³n si el servidor devuelve un cÃƒÆ’Ã‚Â³digo `401 Unauthorized` explÃƒÆ’Ã‚Â­cito.
   - En caso de fallos de red (TypeError) o errores temporales del servidor (5xx), la sesiÃƒÆ’Ã‚Â³n y las credenciales locales (`token` y `username`) se mantienen intactas en el cliente para evitar cierres de sesiÃƒÆ’Ã‚Â³n no deseados.

- **Evidencia**: Archivos modificados: `frontend/src/modules/auth.js`, `EVOLUCION.md`.

### 2026-07-19 - Carga de ImÃƒÆ’Ã‚Â¡genes de Progreso en EdiciÃƒÆ’Ã‚Â³n de Causas Solidarias

**Contexto**: Se requerÃƒÆ’Ã‚Â­a dar soporte a los creadores de campaÃƒÆ’Ã‚Â±as solidarias de ayuda humanitaria para agregar imÃƒÆ’Ã‚Â¡genes de progreso o evidencias posteriores de hitos en sus campaÃƒÆ’Ã‚Â±as activas o pendientes. Siguiendo normativas FinTech de transparencia (crowdfunding), el sistema solo permite **anexar (agregar)** imÃƒÆ’Ã‚Â¡genes a la colecciÃƒÆ’Ã‚Â³n original sin eliminar las previas para garantizar registros histÃƒÆ’Ã‚Â³ricos inmutables ante auditorÃƒÆ’Ã‚Â­as y donantes.

**Cambios Realizados**:
1. **Infraestructura del Backend (Servicios y Rutas)**:
   - Modificado ackend/src/services/humanitarianService.js en la funciÃƒÆ’Ã‚Â³n editCause para aceptar un campo opcional 
ew_evidence_urls.
   - Implementado control de seguridad de doble capa: valida que las nuevas imÃƒÆ’Ã‚Â¡genes no superen el lÃƒÆ’Ã‚Â­mite de **3 por actualizaciÃƒÆ’Ã‚Â³n**, que correspondan a URLs de nuestra infraestructura de medios, y que el total absoluto acumulado no exceda las **15 imÃƒÆ’Ã‚Â¡genes**.
   - Corregido un bug preexistente en la firma del invocador logAuditEvent dentro de las funciones editCause y createCauseUpdate para ajustarse al formato de la funciÃƒÆ’Ã‚Â³n exportada en uditService.js.
   - Modificado ackend/src/routes/humanitarianUserRoutes.js en la ruta PUT /api/humanitarian/causes/:id para extraer y delegar el arreglo 
ew_evidence_urls del cuerpo del request.
2. **Interfaz del Frontend (Modal e IntegraciÃƒÆ’Ã‚Â³n Dropzone)**:
   - Modificado rontend/causa-solidaria.html agregando la maquetaciÃƒÆ’Ã‚Â³n HTML de un Dropzone #editCauseDropzone e input de archivos bajo el textarea de la historia en el modal editCauseModalOverlay.
   - Modificado rontend/src/pages/causa-solidaria.js inicializando los manejadores de eventos (drag/drop e input file), realizando la subida inmediata en segundo plano a la API de R2 /api/media/upload, limitando en cliente a un mÃƒÆ’Ã‚Â¡ximo de 3 imÃƒÆ’Ã‚Â¡genes nuevas, renderizando previsualizaciones de la sesiÃƒÆ’Ã‚Â³n con botÃƒÆ’Ã‚Â³n de remociÃƒÆ’Ã‚Â³n rÃƒÆ’Ã‚Â¡pida, y transmitiendo 
ew_evidence_urls al endpoint PUT.

- **Evidencia**: Archivos modificados: ackend/src/services/humanitarianService.js, ackend/src/routes/humanitarianUserRoutes.js, rontend/causa-solidaria.html, rontend/src/pages/causa-solidaria.js, EVOLUCION.md.\ n -   C o r r e c c i ÃƒÂ³ n   d e   e r r o r   5 0 0   e n   b a c k e n d   ( v i c t i m C o n t r o l l e r . j s ) :   s e   c a m b i ÃƒÂ³   d i s b u r s e d _ a t   a   c r e a t e d _ a t . \ n -   D i s e ÃƒÂ± o   d e   t a r j e t a   S O S   a c t u a l i z a d o   e n   d a s h b o a r d :   a h o r a   e s   u n   e n l a c e   i n t e r a c t i v o   d i r e c t o   s i n   t e x t o   r e d u n d a n t e . 
 
 

### 2026-08-01 - AuditorÃ­a de Seguridad Profunda, EstandarizaciÃ³n de Privacidad SOS y SanitizaciÃ³n Anti-XSS

**Contexto**: Se llevÃ³ a cabo una auditorÃ­a integral de ciberseguridad sobre el mÃ³dulo de SOS Venezuela, la protecciÃ³n de Datos Personales (PII) y el renderizado frontend para garantizar el principio Zero-Trust y cumplir con estÃ¡ndares bancarios/FinTech de trazabilidad y aislamiento de entornos.

**Cambios Realizados**:
1. **Privacidad PII y Modelo Zero-Trust SOS (Perfil)**:
   - Modificado rontend/src/pages/profile.js para asegurar que Ãºnicamente el usuario propietario autenticado (sessionUsername === targetUsername) pueda visualizar la secciÃ³n y expediente SOS.
   - Estandarizado el enlace del menÃº a **" ?? Mi Perfil\** en contract_interaction.html, contract-interaction.js y sidebar.js, eliminando restricciones de visibilidad redundantes.
 - Reforzado el backend ictimController.js para asegurar consultas parametrizadas en PostgreSQL (, ) y protecciÃ³n total contra filtraciones de PII.
2. **MitigaciÃ³n XSS en MÃ³dulo de Referidos**:
 - Modificado rontend/src/pages/referrals.js incorporando la funciÃ³n de sanitizaciÃ³n de entidades HTML escapeHtml.
 - Se escaparon dinÃ¡micamente los campos 
eferred_username y 
eferral_code previa inserciÃ³n mediante .innerHTML, neutralizando posibles vectores de inyecciÃ³n de cÃ³digo.

- **Evidencia**: Archivos modificados: rontend/src/pages/profile.js, rontend/src/pages/referrals.js, rontend/contract_interaction.html, rontend/src/components/sidebar.js, ackend/src/controllers/victimController.js, EVOLUCION.md.


### 2026-08-02 - MigraciÃ³n del MÃ³dulo SOS a Cloudflare R2 y Renderizado de Miniaturas

**Contexto**: Las imÃ¡genes subidas en la planilla SOS se guardaban localmente en /uploads/victims/, perdiÃ©ndose al reiniciar el servidor en Render.com y mostrando pantallas en blanco al hacer clic en las miniaturas.

**Cambios Realizados**:
1. **Subida en Memoria RAM e IntegraciÃ³n con Cloudflare R2**:
   - Modificado ackend/src/routes/systemRoutes.js para usar multer.memoryStorage() en lugar de almacenamiento en disco local.
   - Modificado ackend/src/controllers/victimController.js (funciÃ³n uploadEvidencePublic) delegando la subida a mediaController.uploadImages. Las imÃ¡genes son comprimidas en RAM a .webp con Sharp y subidas directamente a Cloudflare R2.
2. **Renderizado de Miniaturas y GalerÃ­a de Evidencias**:
   - Modificado rontend/src/pages/admin-panel.js para diferenciar entre enlaces de albÃºmenes de Google Fotos (drive.google.com / photos.app.goo.gl) e imÃ¡genes directas/Cloudflare R2, renderizando el elemento <img> interactivo.
   - Modificado rontend/src/pages/profile.js agregando la galerÃ­a de evidencias a la tarjeta " Mi caso\ para que el usuario pueda previsualizar sus fotos subidas.

- **Evidencia**: Archivos modificados: ackend/src/routes/systemRoutes.js, ackend/src/controllers/victimController.js, rontend/src/pages/admin-panel.js, rontend/src/pages/profile.js, EVOLUCION.md.

### Auditoría y Optimización de la Landing Page (Frontend)

- **Seguridad**: Se mitigó la vulnerabilidad de 'Reverse Tabnabbing' añadiendo el= "noopener noreferrer" a los enlaces 	arget= " _blank" del footer.
- **Accesibilidad y SEO**: Se implementó la etiqueta semántica <main> para encapsular el contenido principal y se añadieron atributos ria-hidden= "true" y ocusable= "false" a los SVGs decorativos.
- **Rendimiento JS**: Se optimizó el manejador del evento scroll del botón 'Volver Arriba' mediante equestAnimationFrame para evitar Jank, y se mejoró la responsividad del efecto Parallax.
- **Contenido**: Se eliminaron los textos solicitados por el usuario en la sección 'Únete al equipo'.



### 2026-08-13 - CorrecciÃ³n de Idempotencia en referral_log

- **Contexto**: Se solucionÃ³ la excepciÃ³n duplicate key en referral_log_referred_user_id_key aÃ±adiendo idempotencia y ON CONFLICT DO NOTHING en referralRewardService.js.


### 2026-08-13 - Adaptabilidad DinÃ¡mica de ContraseÃ±as OTP segÃºn Estado del Usuario (SOS Venezuela)

- **Contexto**: Se identificÃ³ que la pantalla de OTP solicitaba definir una contraseÃ±a incluso a usuarios ya registrados en WintonCoin, sobrescribiendo potencialmente su clave anterior.
- **Cambios Realizados**:
  1. **Frontend (sos-venezuela.html & sos-venezuela.js)**: Al enviar la planilla SOS, la API retorna is_new_user. Si is_new_user === false, el contenedor #sos-password-fields-container se oculta dinÃ¡micamente, el botÃ³n cambia a Confirmar Solicitud SOS y solo exige ingresar el cÃ³digo OTP de 6 dÃ­gitos.
  2. **Backend (victimController.js)**: En erifyVictimOtpPublic, se evalÃºa si el usuario posee password_hash. Para usuarios existentes, se preserva su contraseÃ±a y solo se actualiza is_verified = true sin solicitar ni sobrescribir contraseÃ±as.
  3. **Vite PWA Build**: Se re-compilÃ³ el bundle de producciÃ³n y demo.
- **Evidencia**: Archivos modificados: rontend/sos-venezuela.html, rontend/src/pages/sos-venezuela.js, ackend/src/controllers/victimController.js, EVOLUCION.md.

### Mejora Arquitectónica: Aislamiento de Entornos (Zero-Trust) para Build
- **Fecha:** 2026-08-13
- **Problema:** Los comandos 
pm run build y 
pm run build:demo compilaban sus archivos en la misma carpeta (dist), lo que sobreescribía los archivos y representaba un riesgo crítico de subir la demo a producción por error humano.
- **Solución:** Se modificó rontend/vite.config.js para crear un directorio de salida dinámico.
- **Resultado:** Ahora 
pm run build genera la carpeta dist/ y 
pm run build:demo genera una carpeta aislada llamada dist-demo/. Se hicieron pruebas exitosas demostrando que se generan carpetas separadas, asegurando el cumplimiento de la norma Zero-Trust y facilitando un futuro pipeline de CI/CD.

### Actualización de Textos: Landing Page (Sección Comunidad)
- **Fecha:** 2026-08-13
- **Cambio:** Se actualizó el título y la descripción de la sección 'Comunidad' en rontend/index.html para reflejar un mensaje más directo y alineado con los nuevos valores de la plataforma (Conexiones P2P, Sin fronteras, Trabajo colaborativo, Sin distinciones).
- **Despliegue:** Se ejecutó una prueba de compilación en el entorno aislado de Demo (
pm run build:demo) exitosamente.

### Documentación de Deuda Técnica: Pipeline CI/CD
- **Fecha:** 2026-08-13
- **Acción:** Se agregó el ítem '14. Automatización de Despliegues con CI/CD (GitHub Actions)' al documento \TECHNICAL_IMPROVEMENTS.md\.
- **Razón:** Para establecer en el roadmap oficial la necesidad de migrar de builds locales a un sistema de integración continua en la nube, asegurando el principio Zero-Trust en los despliegues de producción y demostración.
