# Evolución de WintonCoin

## [2026-02-21] - Homenaje a Sir Nicholas Winton

### Descripción
Implementación de una página dedicada al legado de Sir Nicholas Winton, integrando su historia humanitaria como la base filosófica y motivación detrás de WintonCoin.

### Cambios realizados
- Creación de `EVOLUCION.md` para seguimiento.
- Investigación histórica sobre Nicholas Winton y el Kindertransport.
- Diseño y creación de `frontend/legado.html` con estética premium.
- Ajuste estético: Eliminación de iconos innecesarios (trencito) para un look más profesional.
- Contenido Histórico: Añadida la tragedia del noveno tren (250 niños) para resaltar la urgencia de la misión.
- Identidad Visual: Unificación de la paleta de colores eliminando los tonos amarillos y dorados en favor de los azules oficiales de WintonCoin para una mayor coherencia de marca.
- Simplificación de Diseño: Eliminación de la tarjeta secundaria y textos explicativos redundantes para que los hechos y la cronología hablen por sí mismos, logrando una narrativa más sobria y profesional.
- Multimedia: Integración del video histórico de la BBC ("That's Life") donde Nicholas Winton se reencuentra con los niños salvados, reforzando el impacto emocional de la página.
- Enlace desde la Landing Page (`index.html`) al nuevo portal del legado. ✅ INTEGRADO
- Corrección de compatibilidad CSS en `legado.html`. ✅ OK

### [2026-02-22] - Sistema de Comunicaciones Intersticiales Globales
- **App-Wide Interstitials (Global Modal)**: Implementado sistema de modales informativos globales gestionables desde el Admin Panel. Incluye persistencia en base de datos, lógica de "una vez por sesión" y diseño premium con Glassmorphism. (Completado y Probado)
- **Admin UI**: Añadido interruptor de activación global en el Centro de Notificaciones con feedback visual premium.
- **Frontend UX**: Implementado modal con efecto Glassmorphism y control de frecuencia (una vez por sesión) para maximizar impacto sin reducir la usabilidad. ✅ DESPLEGADO

### [2026-02-23] - Refactorización Profesional del Flujo de Donaciones
#### Descripción
Transformación del sistema de donaciones para alinearlo con estándares internacionales de Crowdfunding (Kickstarter/GoFundMe), profesionalizando la arquitectura y mejorando drásticamente la UX.

#### Cambios realizados
- **Arquitectura Backend**: Implementación de `goal_amount` y `current_amount` en la base de datos para seguimiento real de campañas.
- **Flujo Directo (Fintech Standard)**: Eliminación de los pasos de "aprobación" y "culminación" para donaciones. Ahora las donaciones son instantáneas, procesando el pago BLUE eou y generando la deuda RED iou en un solo paso. ✅ COMPLETADO
- **Dashboard UI**:
    - **Visual Progress Bar**: Implementada barra de progreso animada con gradientes premium que muestra el avance de la recaudación en tiempo real.
    - **Quick Donation Input**: Añadida caja de entrada numérica integrada en la tarjeta para donar montos variables con un solo clic.
- **Página de Detalle**: Actualizada con la misma lógica profesional y barra de progreso para mantener la coherencia en todo el ecosistema.
- **Modelo Económico**: Asegurada la integridad transaccional (Atomicity) mediante el uso de transacciones SQL (`BEGIN/COMMIT`) para el procesamiento de pagos y actualizaciones de meta. ✅ SEGURO

#### Ajustes Estéticos y UX (Corrección)
- **Identidad de Marca**: Se cambió el esquema de colores de las donaciones de verde a **Magenta/Rosa Winton** (coincidiendo con el ícono del corazón) para una coherencia visual total. ✅
- **UI de Tarjetas**:
    - Implementación de un **Meta Badge** destacado en la cabecera de las tarjetas para mejor visibilidad del objetivo.
    - Rediseño del **Input de Donación Rápida**: Ahora tiene mayor ancho, mejor padding y placeholders descriptivos, facilitando la participación del usuario.
- **Simplificación del Formulario (`publish.html`)**: Se ocultaron los campos de "Aprobación automática" y "Cupos disponibles" para el tipo donación, eliminando ruido visual y opciones irrelevantes para este flujo.

#### Correcciones Técnicas y Estabilidad
- **Base de Datos (Transaccionalidad)**: Implementación de la migración `028_add_blue_cost_to_acceptances` para añadir la columna `blue_cost` a la tabla de aceptaciones. Esto permite rastrear aportes individuales en donaciones variables de forma prolija. ✅ ERROR SQL RESUELTO
- **Backend Integrity**: Actualizadas todas las rutas de aceptación para registrar el costo pactado en el momento de la acción, mejorando la integridad histórica de las transacciones financieras.
- **Transparencia en UI**: La lista de participantes en la página de detalles ahora muestra el monto exacto aportado por cada donante (+X BLUE), utilizando el color magenta oficial para resaltar la generosidad de la comunidad. ✅ PROFESIONAL

### [2026-02-24] - Winton Momentum — Sistema de Gestión de Influencers
#### Descripción
Implementación completa del módulo **Winton Momentum**, un sistema integral e independiente para gestionar el programa de influencers/creadores de contenido de WintonCoin. Incluye backend (DB, servicio, controlador, rutas), frontend (landing, dashboard, admin) y panel de administración.

#### Arquitectura
- **100% Modular**: Tablas propias (`momentum_*`), servicio dedicado, controlador separado, rutas aisladas.
- **Integración mínima**: Solo 4 líneas añadidas a `server.js` (import + mount).
- **Reutilización**: Se integra con `booster_blue_ledger`, `booster_transactions` y `emailService` existentes.

#### Backend
- **Migración** (`029_create_momentum_system.js`): 4 tablas nuevas — `momentum_profiles`, `momentum_global_config`, `momentum_campaigns`, `momentum_submissions`.
- **Servicio** (`momentumService.js`): Lógica de negocio pura — config global, perfiles, campañas, entregas, cálculo de pagos (base × multiplicador + bono), acreditación de BLUE IOU.
- **Controlador** (`momentumController.js`): Endpoints HTTP — públicos, influencer (auth JWT), admin (auth cookie).
- **Rutas** (`momentumRoutes.js`): Factory pattern con inyección de dependencias (pool, auth middleware, audit).

#### Frontend
- **Landing Page** (`momentum-landing.html/css/js`): Hero, barra FOMO con cupos/countdown, simulador interactivo por tier, social proof, formulario de postulación. Estética Fintech Dark Mode.
- **Dashboard Influencer** (`momentum-dashboard.html/css/js`): Balance confirmado/pendiente, marketplace de misiones con modal de entrega, historial de submissions con estados.
- **Admin Panel** (`momentum-admin.html/js`): Config global, gestión de postulantes (asignar tiers), CRUD campañas, verificación de entregas (aprobar con bono / rechazar con nota obligatoria).
- **Navegación**: Botón "⚡ Momentum" añadido al sidebar del `admin-panel.html`.

#### Seguridad
- Locks `FOR UPDATE` para concurrencia en aprobaciones.
- Transacciones SQL para operaciones críticas (BLUE IOU + historial).
- Validaciones en controller y servicio. XSS prevention en frontend.
- Notas de auditoría obligatorias en rechazos.

#### Mejoras y Estabilidad (Cierre de fase)
- **Corrección de Autenticación**: Resuelto el bug crítico de nomenclatura (`isAuthenticated` vs `isLoggedIn`) que impedía a los influencers logueados acceder a su dashboard. ✅ ESTABLE
- **Estrategia de Landing**: El formulario de postulación ahora es siempre visible, solicitando login solo al momento del envío para mejorar la conversión de creadores.
- **Ajuste de Terminología (Pre-lanzamiento)**: Actualización de la marca en el módulo Momentum y su sección dedicada en la landing — donde decía "BLUE" ahora dice "**BLUE IOU**" para ser 100% transparentes con la comunidad sobre el estado del token del programa de creadores. ✅ TRANSPARENCIA
- **Integridad Técnica**: Ejecución de las migraciones `029` y `030` para activar el sistema de recompensas y misiones repetibles.

## [2026-02-25] - Refinamiento Estético: Rediseño Premium de Publicaciones

### Descripción
Evolución visual de las tarjetas de publicación, reemplazando el esquema oscuro básico por una estética "Sapphire Premium" con efectos de profundidad y gradientes, alineada con los estándares de diseño de aplicaciones financieras modernas.

### Cambios realizados
- **Identidad Visual**: Migración del fondo `#1a1a2e` (oscuro plano) a un gradiente dinámico `Sapphire-to-Midnight` (`#1c2e6b` a `#121d4a`).
- **Profundidad y Elevación**:
    - Implementación de bordes semi-transparentes (`rgba(255,255,255,0.1)`) para un acabado tipo cristal (Glassmorphism).
    - Refinamiento de sombras (`box-shadow`) para mayor sensación de jerarquía visual.
- **Micro-interacciones**: Optimización de transiciones y efectos hover para una navegación más fluida y profesional.
- **Coherencia de Tipos**: Ajuste de los bordes y acentos en tarjetas de donación y venta para que armonicen con el nuevo fondo azul elegante. ✅ ESTÉTICA MEJORADA
- **Alineación de Marca**: Reajuste cromático del gradiente de las tarjetas para igualar el azul oficial `#3b82f6` y el gradiente `#60a5fa`-`#2563eb` de la palabra "Coin" en el logotipo.
- **Optimización UX**: Compactación de las descripciones de tareas a 1 sola línea (`line-clamp: 1`) para lograr tarjetas más delgadas y una mayor densidad de información en pantalla. ✅ UX MEJORADA

### Estándares Aplicados
- **Modularidad**: Uso de variables CSS para facilitar cambios globales.
- **UX/UI**: Mejora del contraste y legibilidad con tipografía blanca sobre fondos azules profundos.
- **Auditoría**: Registro documentado en `EVOLUCION.md`.
- **Solución Error 404 Admin**: Implementado endpoint de compatibilidad `/api/legal-status` en el backend para asegurar que componentes antiguos del panel administrativo no fallen al cargar. ✅ OK
- **Refinamiento UX Dashboard**:
    - **Interacción**: Arreglado problema CSS de `pointer-events` que impedía hacer clic en los botones "Entregar" debido a la superposición del efecto de borde iluminado.
    - **Robustez**: Migración de listeners de eventos a un sistema de **Delegación de Eventos** en el contenedor principal, mejorando el rendimiento y la detección de clics en elementos dinámicos. ✅ FLUIDO
- **Ajuste de Seguridad Económica**:
    - **Multiplicador Neutral**: Se ha neutralizado el multiplicador global de **15x a 1x** mediante la migración auditable `031`. 
    - **Razón**: Establecer un baseline de 1x (elemento neutro) garantiza que los pagos base sean los efectivos por defecto, permitiendo al Admin escalar la aceleración de forma controlada y segura para la economía de la plataforma. ✅ AUDITABLE

#### Fórmula de Pago
```
Pago Final = (Tarifa Base del Tier × Multiplicador Global) + Bono Extra del Admin (en BLUE IOU)
```

### [2026-02-25] - Educación y Experiencia de Usuario: Onboarding & UI Coordination

#### Descripción
Implementación de un sistema de tutoriales dinámicos para educar a los usuarios sobre los detalles técnicos de las publicaciones y resolución del conflicto de superposición entre modales y tours (Modal Clash).

#### Cambios realizados
- **Tutorial Interactivo de Tareas**:
    - Implementado `startTaskTour` en `onboarding.js`.
    - Guía paso a paso sobre: Título, Recompensa/Costo, Autor, Reputación (estrellas) y Cupos.
    - **Robustez Técnica**: Implementación de `waitForElement` (espera activa) y generación de `uniqueClass` dinámica por cada ejecución para evitar conflictos de selectores en el DOM. ✅ PROFESIONAL
- **Coordinación de UI (Zero Overlap)**:
    - **Evento Global**: Modificado `interstitials.js` para despachar el evento `winton_interstitial_closed` al cerrar mensajes del administrador.
    - **Lógica Reactiva**: Implementada función `executeWhenSafe` en el sistema de onboarding. Los tours ahora "escuchan" a la plataforma y solo inician cuando la pantalla está libre de modales bloqueantes. ✅ UX MEJORADA
- **Acceso Directo**: Añadida tarjeta "📝 Detalle de Tarea" en `como-funciona.html` para acceso manual al tutorial.
- **Micro-ajuste Estético**: Actualización del gradiente Sapphire en tarjetas (`style.css`) a 180 grados para una transición de color más vertical y sobria.

### Estándares de Ingeniería:
- **Zero Hardcoded Secrets**: Mantenimiento de la integridad ambiental.
- **Auditabilidad**: Todo cambio de lógica coordinado y documentado.
- **Seguridad**: Bloqueo de interacciones del usuario durante los tours ("Modo Museo") para evitar estados inconsistentes.

## [2026-02-26] - Corrección Crítica: Enforcement de Cooldown en Tareas Repetibles

### Descripción
Corrección de un bug donde el campo `repeat_cooldown_hours` se almacenaba correctamente en la base de datos al crear publicaciones repetibles, pero **nunca se validaba** durante el flujo de aceptación ni se filtraba en el feed. Los usuarios podían repetir tareas inmediatamente sin respetar el intervalo de espera configurado.

### Bug identificado
- `repeat_cooldown_hours` se guardaba en la tabla `publications` (ruta `/publish`).
- La ruta `/publications/:id/accept` verificaba: rechazo, solicitud activa, máximo de repeticiones — pero **nunca el cooldown**.
- La query `/publications/active` ocultaba publicaciones completadas o con máx. repeticiones — pero **nunca por cooldown activo**.
- **Resultado**: Código muerto. El cooldown existía en la BD pero era ignorado por toda la lógica de negocio.

### Cambios realizados
- **Validación Backend (server.js - ruta `/accept`)**: Añadido paso #5 "COOLDOWN CHECK". Consulta `created_at` de la última aceptación `confirmed_paid` del usuario, calcula el tiempo transcurrido y lo compara con `repeat_cooldown_hours`. Si no ha pasado suficiente tiempo, retorna HTTP 429 con el tiempo restante formateado (ej: "Debes esperar 18h 30min antes de volver a participar"). ✅ SEGURO
- **Filtro de Feed (server.js - query `/publications/active`)**: Añadido "Caso C" en el bloque `AND NOT (...)`. Oculta la publicación del feed si el usuario tiene una participación `confirmed_paid` cuyo `created_at` está dentro del período de cooldown (`NOW() - repeat_cooldown_hours * INTERVAL '1 hour'`). ✅ UX MEJORADA
- **Query mejorada**: La consulta de aceptaciones previas ahora incluye `created_at` y está ordenada por `created_at DESC` para obtener la participación más reciente primero.

### Estándares aplicados
- **Defensa en profundidad**: Doble protección (feed + validación backend) para que incluso si el frontend falla, el servidor bloquee la repetición prematura.
- **UX Informativa**: El mensaje de error incluye el tiempo restante exacto para que el usuario sepa cuándo puede volver.
- **Auditabilidad**: Documentado en `EVOLUCION.md`. Código comentado exhaustivamente.

## [2026-02-27] - Automatización de Despliegue (Investigación CD)

### Descripción
Análisis y propuesta de arquitectura de Despliegue Continuo (Continuous Deployment) para conectar el repositorio de GitHub con Hostinger.

### Acciones
- Revisión de `package.json` y estructura del proyecto.
- Propuesta de soluciones basadas en Hostinger Git Integration (Webhooks) y GitHub Actions.
- **Implementación de GitHub Actions (CD Ciberseguro)**: Creación del flujo automatizado `.github/workflows/deploy-frontend.yml` para despliegue por FTP exclusivo de la carpeta `frontend/dist/`. 
    - Implementación de script nativo **LFTP** en Ubuntu para evitar comportamientos anómalos de subcarpetas (`public_html/public_html`) causados por plugins obstinados de terceros (`ftp-deploy-action`).
    - Se protege el backend de exposición pública cumpliendo el estándar **Zero Hardcoded Secrets** para Hostinger.
### [2026-03-01] - Winton Academy CMS & Sistema de Tutoriales Interactivos

#### Descripción
Implementación de un sistema integral de gestión de contenidos (CMS) para la "Winton Academy", permitiendo administrar dinámicamente los tutoriales interactivos que guían a los usuarios en el ecosistema WintonCoin.

#### Cambios realizados
- **CMS de Academia**: Implementación completa de un sistema de gestión de videos dentro del Admin Panel. Los administradores pueden agregar, ocultar, reordenar y eliminar videos de YouTube de forma dinámica.
- **Backend (Arquitectura)**:
    - **Fase de Datos**: Creación de la tabla `academy_videos` mediante la migración `036_create_academy_videos.js`.
    - **Controlador API**: Implementación de `academyController.js` con soporte para CRUD y respuestas estandarizadas (`success: true`).
    - **Rutas**: Creación de `academyRoutes.js` con separación estricta entre rutas públicas (`/public`) y protegidas por administrador (`/all`, `/add`, etc.).
- **Admin Panel (UI/UX)**:
    - **Nueva Sección**: Añadido el módulo "Winton Academy" al sidebar del panel de control.
    - **Gestor de Contenidos**: Formulario con detección inteligente de YouTube IDs (soporta URLs largas, cortas e IDs directos).
    - **Visualización**: Tabla de administración con previsualización de miniaturas (thumbnails) oficiales de YouTube.
    - **Interactividad**: Botones de acción rápida para publicar/ocultar videos y borrado definitivo con diálogos de confirmación premium.
- **Página Pública (`como-funciona.html`)**:
    - **Galería Dinámica**: Refactorización de la cuadrícula de videos para cargar datos desde la API del CMS en tiempo real vía `fetch`.
    - **Optimización (Lazy Loading)**: El reproductor de video se carga dentro de un modal solo cuando el usuario hace clic, mejorando drásticamente el rendimiento inicial de la página.
- **Estabilidad y Ciberseguridad**:
    - **Resolución de Conflictos**: Fix de un bug de routing que causaba cierres de sesión (401) al solaparse middlewares de usuario y administrador.
    - **Integridad de Datos**: Corregido el envío de payloads del frontend (snake_case) para coincidir con la estructura de la base de datos PostgreSQL.
    - **Codificación**: Reparación de errores de encoding (UTF-8) en textos informativos para visualización correcta de tildes en español.
- **Mantenimiento de Servidor**: Limpieza forzada de procesos de Node.js en memoria para asegurar la persistencia de los cambios del CMS. ✅ DESPLEGADO Y AUDITABLE

### [2026-03-01] - Debugging Crítico: Reparación de Consistencia en Campañas Momentum
#### Descripción
Resolución de un error de base de datos (PostgreSQL) que impedía la creación de nuevas campañas en el módulo Winton Momentum debido a una discrepancia de esquema entre los entornos local y producción (Render).

#### Cambios realizados
- **Investigación de Error**: Identificado fallo `column "allow_multiple" does not exist` al intentar publicar campañas desde el Admin Panel en producción (Render).
- **Backend (Reparación de Esquema)**:
    - **Nueva Migración (`037_ensure_momentum_campaigns_columns.js`)**: Implementación de una migración de "seguridad" que utiliza `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para garantizar la presencia de las columnas `allow_multiple`, `base_pay_visionario` y `base_pay_platino`.
    - Esta migración soluciona inconsistencias técnicas que impedían la persistencia de datos de campañas. ✅ RESUELTO
- **Frontend & UI/UX**:
    - **Hero Animation**: Añadida animación dinámica con iconos de redes sociales (Instagram, YouTube, X, TikTok) en la landing de Momentum ("¿Eres creador de contenido?").
    - **Dashboard Cleanup**: Eliminación del botón "← Panel Principal" en el header del dashboard de Momentum para una interfaz más limpia y enfocada.
- **Estándares de Ingeniería**:
    - Implementación de **Auto-reparación de Esquema** al arranque del servidor para garantizar que la base de datos siempre coincida con la lógica de negocio del código. ✅ PROFESIONAL
- **Auditabilidad**: Todos los cambios registrados y documentados para cumplimiento de normas técnicas.

### [2026-03-01] - UX Upgrade: Visualización Completa de Misiones Momentum
#### Descripción
Mejora en la experiencia de usuario (UX) para influencers. Se ha resuelto el problema de las descripciones truncadas permitiendo abrir un modal informativo con las instrucciones completas de la misión al tocar la tarjeta.

#### Cambios realizados
- **Interactividad Total**: Se habilitó la delegación de eventos para que **toda la tarjeta de la misión** abra los detalles, facilitando el acceso en dispositivos móviles.
- **Rediseño de Modal (Dual Function)**: El modal de entrega ahora incluye un bloque de "Instrucciones" con scroll interno y respeto de saltos de línea (`pre-wrap`).
- **Frontend (Modularidad)**:
    - Adición de variables de datos (`data-campaign-desc`) en las tarjetas generadas dinámicamente.
    - Estilización premium del contenedor de información con efectos de transparencia y bordes dorados suaves.
- **Beneficio**: Los influencers ahora pueden leer las instrucciones detalladas paso a paso en el mismo lugar donde envían el link, eliminando errores en las tareas. ✅ PROFESIONAL

### [2026-03-01] - Auditoría de Contexto y Sincronización de Agente
#### Descripción
Revisión integral de la base de código, estructura de archivos y reglas de negocio para asegurar la alineación del agente con los estándares de ingeniería y objetivos del proyecto WintonCoin.

#### Acciones realizadas
- **Inventario Completo**: Mapeo de la estructura del proyecto, detectando el monolito `server.js` (4588 líneas) y los módulos ya extraídos en `src/`.
- **Análisis de Seguridad**: Verificación de la política "Zero Hardcoded Secrets" y uso de middlewares de autenticación técnica y administrativa.
- **Sincronización Económica**: Estudio profundo de `ECONOMIC_RULES.md`, comprendiendo el sistema de tokens BLUE/RED, el ledger de impulsores (Booster) y las reglas de quema/deuda (FIFO).
- **Validación de Estándares**: Confirmación de los flujos de auditoría bancaria (`logAuditEvent`) y las reglas de diseño responsive premium.
- **Preparación para Modularización**: Identificación de bloques candidatos en `server.js` para ser extraídos a controladores y servicios independientes siguiendo las mejores prácticas.

### [2026-03-01] - Fase de Profesionalización: Notificaciones Push & Auditoría Bancaria
#### Descripción
Auditoría integral y diagnóstico del sistema de comunicaciones push. Se inicia la transición de un sistema funcional a uno de grado industrial/bancario, reforzando la seguridad, auditabilidad y escalabilidad.

#### Diagnóstico Técnico
- **Frontend**: Estado "Premium". Implementación exitosa de Workbox y Wizard de consentimiento dinámico.
- **Backend**: Estado "Funcional/Monolítico". Identificada necesidad de desacoplamiento de lógica de DB en controladores.
- **Brecha de Auditoría**: Detectada falta de registros en `logAuditEvent` para acciones críticas de comunicación.

#### Plan de Acción
1. **Auditoría**: Inyección de logs de auditoría en `notificationService` y `notificationController`.
2. **Refactorización Core**: Migración de lógica de base de datos desde el controlador hacia el servicio para cumplir con S.O.L.I.D.
3. **Escalabilidad**: Implementación de procesamiento por lotes (chunking) para notificaciones masivas.
4. **Seguridad**: Sanitización de payloads para prevenir ataques de inyección de contenido en dispositivos finales. ✅ EN PROCESO

### [2026-03-02] - Culminación de Profesionalización: Notificaciones Push de Grado Industrial
#### Descripción
Finalización de la refactorización profunda del sistema de comunicaciones en tiempo real, logrando un sistema escalable, auditable y ciberseguro que cumple con los estándares bancarios de WintonCoin.

#### Cambios realizados
- **Arquitectura de Notificaciones (Notificaciones 2.0)**:
    - **Escalabilidad Batch**: Implementación de procesamiento por lotes (Chunks de 50 dispositivos) en `notificationService.js` para prevenir caídas del servidor ante bases de datos de usuarios masivas.
    - **Broadcast Omnicanal**: Integración de notificaciones push en el ciclo de vida de las tareas:
        - Envío masivo automático al publicar nuevas tareas (Usuario y Administrador).
        - Notificaciones instantáneas para Referidos, Donaciones, Aprobaciones y Pagos.
    - **Inyección de Dependencias**: Refactorización técnica del controlador y rutas de notificaciones para soportar la inyección del `pool` de base de datos, siguiendo el principio de inversión de dependencia (SOLID). ✅ ESTÁNDAR INDUSTRIAL
- **Reparación del Monolito (`server.js`)**:
    - **Diagnóstico de Rutas**: Identificación y corrección de la ruta de Administración de Plataforma (`/api/admin/platform/create-publication`) para incluir el nuevo sistema de broadcast.
    - **Instrumentación**: Inyección de logs de diagnóstico (`[ROUTE DIAGNOSTIC]`) para monitoreo del flujo de red en tiempo real desde la terminal.
- **Auditoría y Ciberseguridad**:
    - **Zero Null Audit**: Corrección de fallos críticos en `logAuditEvent` que impedían el registro de suscripciones por referencias nulas.
    - **XSS Prevention**: Saneo mandatorio de todos los payloads de notificación para evitar inyecciones de código malicioso en browsers de usuarios finales.
    - **Trazabilidad Total**: Todas las comunicaciones iniciadas (ya sea por usuario o admin) ahora generan un registro reproducible en la bitácora de auditoría. ✅ CIBERSEGURO
- **Correcciones Técnicas**:
    - **Bug Fix**: Reparación de un error de nomenclatura en la validación de *cooldown* de tareas (`lastConfirmedAt` -> `lastCompletedAt`) en `publicationController.js`.
    - **Routing Fix**: Resolución de error `router is not defined` en módulos recién extraídos. ✅ ESTABLE Y OPERATIVO

### [2026-03-02] - Reparación Crítica: Gestión Administrativa de Rechazos (Discard Fix)
#### Descripción
Resolución de un error de permisos y lógica en producción que impedía a los administradores rechazar tareas marcadas como "Culminadas" por los usuarios. Se profesionaliza el flujo de supervisión.

#### Cambios realizados
- **Backend (Reparación de Lógica)**:
    - **Admin Override**: Se modificó la ruta `/publications/:id/discard` en `publicationController.js` para permitir que usuarios con rol de `admin` gestionen rechazos, eliminando la restricción que solo permitía al autor original realizar esta acción.
    - **Flexibilidad de Estados**: Ahora el sistema permite rechazar tareas en estados `pending`, `pending_approval` y `completed`, asegurando que el administrador pueda invalidar entregas mal realizadas.
- **Notificaciones Push (Vincular al Usuario)**:
    - Se integró el envío automático de notificaciones push al usuario cuya tarea ha sido rechazada: *"Tarea Rechazada ❌: [Título]"*.
- **Integridad Técnica**:
    - Se corrigió el uso del cliente de base de datos en los logs de auditoría para evitar errores de referencia nula durante el proceso de descarte. ✅ RESUELTO Y AUDITABLE
- **Fine-Tuning de Marca & Navegación**:
    - Se ajustó la URL de redirección global para que las notificaciones de plataforma lleven al **Dashboard General** (`/dashboard.html`), unificando la entrada al ecosistema.
    - Implementación de `badge` de marca (72x72) para visualización profesional en la barra de estado de dispositivos Android. ✅ OPTIMIZADO

### [2026-03-04] - Fase de Mejora y Auditoría de Landing Page
#### Descripción
Inicio de la fase de trabajo sobre la Landing Page principal. Se ha realizado una auditoría completa del código (HTML, CSS, JS) y de las reglas económicas para asegurar coherencia técnica y visual.

#### Acciones realizadas
- **Auditoría de Contexto**: Lectura integral de `index.html`, `landing.css`, `landing.js` y `ECONOMIC_RULES.md`.
- **Sincronización de Diseño**: Verificación de la paleta Sapphire Premium y efectos Glassmorphism.
- **Preparación**: Identificación de puntos de mejora en modularidad y responsividad. ✅ CONTEXTO COMPLETADO

### [2026-03-12] - Actualización de Referidos: Sistema de Promoción Dinámica (FOMO)
#### Descripción
Implementación de un sistema de "Sentido de Urgencia" (FOMO) en el módulo de referidos. Ahora los usuarios ven en tiempo real cuánto tiempo queda para aprovechar la recompensa máxima de 1000 BLUE IOU antes de que baje a su valor base.

#### Cambios realizados
- **Arquitectura de Base de Datos**: 
    - Creación de la migración `040_add_referral_promo_settings.js`.
    - Adición del parámetro `referral_reward_after_expiry` (valor base pos-promo) en `app_settings`.
- **Backend (Optimización de API)**:
    - Actualización del endpoint `/api/referral-settings` para centralizar toda la información de la promoción (monto actual, monto futuro, fecha de expiración).
- **Frontend (Rediseño Sapphire Premium)**:
    - **UI Renovada**: Transformación del botón simple de referidos en una tarjeta de promoción de alto impacto visual.
    - **Countdown Timer**: Implementación de un cronómetro en tiempo real (`ReferralPromoTimer`) que calcula los días, horas y minutos restantes comparando la hora local con la fecha configurada en el Admin Panel.
    - **Tiered Rewards**: Visualización clara de "Recompensa actual" vs "Después de la promo", utilizando tachado visual para incentivar el registro inmediato.
- **Refinamiento Estético y Funcional Final**: 
    - **Compactación Ultra-Slim**: Rediseño de la tarjeta para ocupar el mínimo espacio vertical, moviendo unidades de tiempo (`d, h, m, s`) y etiquetas de moneda (`BLUE IOU`) a una disposición horizontal integrada.
    - **Psicología de Conversión**: Actualización de copys estratégicos ("Bono por referir hoy" y "Después baja a") junto con un icono de tendencia bajista para maximizar el FOMO.
    - **Estética Sobria**: Eliminación de animaciones y efectos de destello exagerados para mantener un aspecto profesional, limpio y centrado en la información de valor.
    - **Admin Panel**: Integración completa para control dinámico de la recompensa pos-promoción. ✅ FINALIZADO Y PULIDO
### [2026-03-12] - Modularización del Backend: Fase 1 (Seguridad y Validación)
#### Descripción
Inicio de la refactorización arquitectónica del monolito `server.js`. Siguiendo un protocolo de "Zero Risk", se han extraído las primeras funcionalidades hacia módulos independientes en `src/routes/` para mejorar la mantenibilidad y auditabilidad.

#### Cambios realizados
- **Arquitectura de Rutas**:
    - Creación de `backend/src/routes/validationRoutes.js`: Centralización de validaciones de disponibilidad de usuario, email y teléfono.
    - Creación de `backend/src/routes/solidarioRoutes.js`: Modularización completa del módulo "Winton Solidario" (Postulaciones Humanitarias).
- **Control de Calidad (Protocolo de Fidelidad)**:
    - Auditoría línea por línea para asegurar copias exactas de la lógica original.
    - Verificación técnica mediante pruebas de API directas (`Invoke-RestMethod`) tras cada movimiento.
- **Transición Segura**:
    - El código original en `server.js` ha sido **comentado** (no eliminado) temporalmente como medida de respaldo mientras se validan los nuevos módulos en el entorno de ejecución.
- **Sincronización de Mejoras**:
    - Integración forzada de la nueva lógica de `/api/referral-settings` (sistema FOMO) dentro del flujo modularizado, asegurando compatibilidad con los cambios manuales del usuario. ✅ ESTRUCTURA PROFESIONAL

### [2026-03-13] - Refuerzo de Marca: Inmunidad Económica (Anti-Ballenas)
#### Descripción
Actualización de la narrativa de seguridad en la Landing Page principal para resaltar la protección contra la manipulación de mercado por grandes capitales (Ballenas), integrando el concepto dentro del bloque de Inmunidad Matemática.

#### Cambios realizados
- **Landing UI (`index.html`)**: 
    - Rediseño de la tarjeta **BLK_003** para integrar **"Anti-Ballenas"** justo debajo de "Anti-Rug Pull", unificando tipografías para un look 100% simétrico.
    - Actualización del copy de seguridad: *"Es imposible robar liquidez o manipular el mercado."*
    - Simplificación del copy en la sección Marketplace: Eliminación de referencias redundantes para mayor impacto visual. ✅ PROFESIONAL
- **Arquitectura Visual**: Implementación de un contenedor `flex-column` dentro del `data-header` para mantener la jerarquía sin romper el diseño responsive.

### [2026-03-13] - Rediseño del Footer: Minimalismo y Corrección Estructural
#### Descripción
Evolución visual del pie de página (Footer) para lograr un estilo institucional, eliminando colores secundarios y corrigiendo un error técnico en el CSS que impedía la visualización correcta en desktop.

#### Cambios realizados
- **Corrección de Ámbito (Scope Fix)**: Se detectó que los estilos del footer estaban atrapados dentro de una media query móvil accidental. Se movieron todos los estilos a un **ámbito global**, garantizando que el diseño premium se vea en todas las resoluciones.
- **Estética "Total White"**: 
    - Se forzaron todos los enlaces a blanco puro (`#ffffff`) con `!important`.
    - **No Underline**: Se eliminó el subrayado (`text-decoration: none`) para que los enlaces parezcan "palabras normales", siguiendo las tendencias de diseño minimalista de la industria.
- **Distribución Multicapa**: 
    - **Desktop**: 5 columnas equitativas.
    - **Tablet**: 3 columnas.
    - **Mobile**: 1-2 columnas con centrado automático.
- **Enriquecimiento de Contenido**:
    - **Sección Solidario**: Integración del acceso directo a "Postular Causa" en la primera columna, reforzando el ADN social del proyecto. ✅
    - **Winton Academy**: Inclusión del acceso a tutoriales interactivos en la sección de Recursos. ✅
- **Optimización de UX**: Se mantuvo el efecto hover (desplazamiento lateral y opacidad al 100%) para dar feedback sin ensuciar la estética limpia. ✅ PROFESIONAL

### [2026-03-15] - Infraestructura AWS: Auditoría de Facturación Global
#### Descripción
Análisis preventivo tras recibir notificación oficial de AWS sobre el cambio de remitente para facturas electrónicas (`invoicing@aws.com`) a partir del 25 de marzo de 2026.

#### Acciones realizadas
- **Auditoría de Código**: Búsqueda exhaustiva en el backend y scripts de mantenimiento para detectar dependencias de automatización (parsers/scrapers) vinculadas a correos de AWS.
- **Resultado**: No se detectaron dependencias técnicas activas. El impacto en el código es NULO.
- **Recomendación Operativa**: Actualizar filtros de correo en la cuenta administrativa de Gmail para asegurar que las facturas no sean marcadas como spam o ignoren reglas de reenvío contables. ✅ CIBERSEGURO

### [2026-03-18] - Rediseño Premium de Email Service (Anti-Spam & Zero-Image)
#### Descripción
Refactorización de la cabecera de los correos automáticos (OTP, Transacciones, Gobernanza, Anuncios) para eliminar la deformación de imágenes y usar una estrategia de tipografía nativa con estética Cripto-Premium.

#### Cambios realizados
- **Identidad Visual 100% CSS**: Reemplazo del logo anterior por una cabecera oscura (Azul Nocturno `#0A0F1C`) con la palabra `Winton` en blanco puro y `Coin` en azul corporativo. 
- **Optimización Anti-Spam**: Al eliminar las peticiones a imágenes externas (`<img>`), se blinda el sistema OTP aumentando dramáticamente la confianza (Trust Score) ante filtros de Google y Outlook.
- **Micro-Performance**: Velocidad de carga instantánea del correo al depender exclusivamente de código nativo, brindando una experiencia "bancaria" ininterrumpida. ✅ PROFESIONAL

### [2026-03-19] - Despliegue del Sistema de Reclutamiento Profesional (Winton Talent)
#### Descripción
Creación e integración completa del portal de captación de talento externo para el crecimiento del ecosistema WintonCoin, bajo el programa de compensación temprana.

#### Cambios realizados
- **Backend de Reclutamiento**: Implementación del controlador `recruitmentController.js` y middleware `recruitmentUpload.js` (Multer) con validación estricta de archivos PDF de hasta 5MB y trazabilidad de IP.
- **Base de Datos (Migración 043)**: Creación de la tabla `recruitment_proposals` para el almacenamiento seguro y auditable de las postulaciones, incluyendo el multiplicador aplicado en el momento (15x).
- **Frontend Premium**: Nueva página `trabaja-con-nosotros.html` con estética Sapphire y Glassmorphism, destacando el beneficio de 1500 BLUE IOU por cada $100 USD de valor aportado.
- **Integración en Footer**: Actualización de la landing page principal (`index.html`) para incluir el enlace oficial en la sección de Plataforma.
- **Legal & Compliance**: Inclusión de la cláusula de tratamiento de datos de WTN Solutions LLC conforme a estándares internacionales de privacidad. ✅ PROFESIONAL

### [2026-03-22] - Reclutamiento Endurecido: Sin Archivos + Multiplicador Dinámico desde DB
#### Descripción
Ajuste integral de seguridad y consistencia del módulo de Talento para eliminar completamente la subida de CV por archivo, mover el cálculo del multiplicador a fuente dinámica de base de datos y endurecer el backend contra abuso y datos inválidos.

#### Cambios realizados
- **Política sin Archivos (LinkedIn-first)**: La ruta `POST /api/recruitment/apply` dejó de usar middleware de upload y ahora acepta exclusivamente `application/json`. Se bloquea explícitamente `multipart/form-data` con respuesta `415`.
- **Validación Backend Estricta**: Se añadieron validaciones server-side para `full_name`, `email`, `role`, `linkedin_url` y `expected_salary`, con normalización de entradas para mejorar calidad de datos y reducir superficie de ataque.
- **Rate Limit Anti-Spam**: Se incorporó limitador por IP en postulaciones públicas (`10 requests / 15 min`) para mitigar abuso automatizado.
- **Multiplicador Dinámico**: El valor aplicado en `recruitment_proposals.multiplier_applied` ya no está hardcodeado; ahora se obtiene desde `momentum_global_config.multiplier` (configurado desde `momentum-admin`), con fallback seguro a `1x`.
- **Config Pública de Reclutamiento**: Nuevo endpoint `GET /api/recruitment/config` para exponer el multiplicador vigente de forma controlada al frontend.
- **Frontend Reclutamiento Sin Multipart**: `trabaja-con-nosotros.html` ahora envía JSON (sin `FormData`) y consulta dinámicamente el multiplicador para renderizar badge y ejemplo de compensación en tiempo real.
- **Hardening CORS en Producción**: En `server.js`, se eliminó el allow-all efectivo para producción y se restringe a orígenes permitidos, manteniendo flexibilidad solo en desarrollo.

### [2026-03-25] - Hardening Crítico de Seguridad + Robustez PWA Android
#### Descripción
Se aplicó un paquete de correcciones críticas orientadas a estándares fintech/bancarios: cierre de exposición por `username`, validación de identidad contra JWT (anti-suplantación), y ajustes de PWA para mejorar la consistencia de instalación/actualización en Android.

#### Cambios realizados
- **Autorización Anti-Suplantación (IDOR Mitigation)**:
  - Refuerzo de `requireAcceptedLegalByUsernameField` en `backend/src/middleware/legalAcceptanceMiddleware.js`.
  - Nueva política: actor autenticado obligatorio + coincidencia estricta `JWT.username === body.username` en flujos de usuario final.
  - Exenciones controladas únicamente para actores administrativos/sistema autenticados.
- **Cierre de Endpoints Legacy Expuestos**:
  - Endurecidos con `verifyUserToken` y validación de propiedad (`req.user.username === :username` o body):
    - `GET /notifications/:username`
    - `POST /notifications/mark-read`
    - `POST /notifications/:id/dismiss`
    - `GET /users/:username/history`
    - `GET /users/:username/transactions`
    - `GET /users/:username/balance`
  - Resultado: no se permite consultar/alterar datos de terceros aunque se conozca su username.
- **Consistencia de Moderación de Cuentas**:
  - Login ahora evalúa estado desde `account_status` con fallback legacy a `status`.
  - Se corrige endpoint admin de cambio de estado para evitar dependencia inconsistente de `res.locals.admin.id` y proteger cuentas de sistema (`platform/admin`).
- **Frontend Seguro (Token Propagation)**:
  - Se agregó `Authorization: Bearer <token>` a llamadas críticas que faltaban en `frontend/src/pages/contract-interaction.js`:
    - Confirmación de pago.
    - Eliminación de publicaciones.
    - Quema de tokens.
  - Resultado: backend endurecido y frontend alineados sin regresión funcional.
- **PWA Android (Instalación/Actualización más robusta)**:
  - `frontend/public/manifest.json`:
    - Se añadió `id` estable.
    - Se versionó `start_url` con `?source=pwa` para identidad consistente de instalación.
  - `frontend/src/sw-source.js`:
    - Se corrigió regex de cache runtime para assets con hashes reales de Vite (`A-Za-z0-9_-`), evitando fallos silenciosos de caché.
  - `frontend/src/modules/pwa-install.js`:
    - Se separó estado `pwa_installed` de `pwa_install_dismissed` para no bloquear instalación futura por descarte de UI.

#### Nota operativa (Android / Google Play Protect)
- La alerta de Play Protect observada por usuarios suele corresponder a una instalación previa tipo APK/WebAPK antigua o envoltorio legacy en el dispositivo.
- Recomendación: desinstalar app previa del dispositivo y reinstalar desde Chrome (PWA), validando que tome el nuevo `manifest id/start_url`.

### [2026-03-25] - Android Hardening (Cleartext por entorno)
#### Descripción
Se aplicó un ajuste de seguridad en la app Android nativa para cumplir práctica estándar: tráfico HTTP permitido solo en desarrollo (`debug`) y bloqueado en producción (`release`).

#### Cambios realizados
- **Manifest seguro por placeholder**:
  - `android-app/app/src/main/AndroidManifest.xml` ahora usa `android:usesCleartextTraffic="${usesCleartextTraffic}"`.
- **Gradle por entorno**:
  - `android-app/app/build.gradle.kts`:
    - `release` -> `manifestPlaceholders["usesCleartextTraffic"] = "false"`
    - `debug` -> `manifestPlaceholders["usesCleartextTraffic"] = "true"`

#### Impacto
- **Producción**: endurecida (sin HTTP plano).
- **Desarrollo local**: sin ruptura, se mantiene acceso a backend local HTTP.

### [2026-03-25] - PWA: Manifest explícito en Landing principal
#### Descripción
Ajuste puntual para robustecer la instalabilidad PWA en Android desde la URL principal (`www.wintoncoin.com`), asegurando que la landing incluya manifiesto y color de tema.

#### Cambios realizados
- `frontend/index.html`:
  - Se añadió `<meta name="theme-color" content="#4a90d9">`.
  - Se añadió `<link rel="manifest" href="manifest.json">`.

#### Impacto
- Mejora la detección de instalación PWA desde la primera página de entrada.
- Reduce comportamientos inconsistentes de “instalar app” en navegadores Android cuando el manifiesto no estaba presente en la landing.

### [2026-03-25] - Migración segura a identidad JWT (`/api/me`) en Historial/Transacciones
#### Descripción
Paso incremental de estandarización: se introducen endpoints autenticados por JWT para historial y transacciones, reduciendo dependencia de rutas con `username` en URL.

#### Cambios realizados
- **Backend (`backend/server.js`)**
  - Nuevo `GET /api/me/history`:
    - Usa `req.user.userId` como fuente de verdad para publicaciones creadas.
    - Usa `req.user.username` para historial completado donde el modelo legacy aún depende de username.
  - Nuevo `GET /api/me/transactions`:
    - Consulta por `t.user_id = req.user.userId`.
- **Frontend**
  - `frontend/src/pages/history.js`:
    - Cambia consumo a `GET /api/me/history`.
    - Envía `Authorization: Bearer <token>`.
    - Endurece `postToServer` para incluir token en acciones.
  - `frontend/src/pages/transactions.js`:
    - Cambia consumo a `GET /api/me/transactions`.
    - Envía `Authorization: Bearer <token>`.

#### Impacto
- Disminuye superficie de ataque por URL basada en username.
- Alinea el flujo con práctica profesional fintech: identidad canónica por JWT/userId.
- Mantiene compatibilidad, sin retirar de inmediato endpoints legacy.

### [2026-03-25] - Hardening de sesión JWT en `verifyUserToken`
#### Descripción
Se endureció el middleware principal de autenticación del monolito (`server.js`) para aplicar invalidación de sesión por cambio de contraseña en todas las rutas que usan `verifyUserToken`.

#### Cambios realizados
- `backend/server.js`:
  - `verifyUserToken` ahora:
    - valida existencia de `userId` en el token,
    - consulta `users.password_invalidate_before`,
    - rechaza JWT emitidos antes del timestamp de invalidación (`code: SESSION_INVALIDATED`),
    - rechaza tokens de usuarios inexistentes.
  - En caso de fallo de DB durante validación de sesión, responde `503` (fail-safe) para no autorizar sin comprobación.

#### Impacto
- Cierra brecha de inconsistencia: antes, algunas rutas del monolito aceptaban tokens viejos tras reset de contraseña.
- Uniforma el estándar de seguridad con el middleware `authenticateToken` ya existente.

### [2026-03-25] - Normalización de identidad admin en `verifyAdminToken`
#### Descripción
Se aplicó un ajuste corto de consistencia para evitar divergencias de autorización entre controladores que esperan `req.user.role === 'admin'`.

#### Cambios realizados
- `backend/server.js`:
  - `verifyAdminToken` ahora usa lectura segura de cookie (`req.cookies?.admin_token`).
  - Tras verificar JWT admin, normaliza:
    - `req.user.role = 'admin'`.
    - `res.locals.admin = req.user` (compatibilidad con módulos legacy).

#### Impacto
- Elimina inconsistencias de permisos admin en rutas que validan `req.user.role`.
- Mejora compatibilidad sin cambiar contratos de API ni flujo funcional del frontend.

### [2026-03-25] - Middleware combinado para flujos de publicaciones (`verifyAdminOrUserToken`)
#### Descripción
Paso incremental de autorización: se habilita autenticación dual (admin o usuario autenticado) en rutas de publicación que operativamente usan autores y, en algunos casos, override administrativo.

#### Cambios realizados
- `backend/server.js`:
  - Nuevo middleware `verifyAdminOrUserToken`:
    - Si existe cookie admin válida -> autentica como admin (`role: 'admin'`).
    - Si no existe o es inválida -> valida JWT de usuario (`verifyUserToken`).
  - El router de publicaciones (`publicationRoutes`) pasa a usar este middleware combinado en lugar de `verifyAdminToken`.

#### Impacto
- Evita bloqueo de flujos legítimos del autor en endpoints de publicaciones.
- Mantiene soporte de override admin cuando aplique.
- No amplía permisos en endpoints admin-only globales, ya que el cambio se limita al router de publicaciones.
