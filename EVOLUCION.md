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

#### Estado Final
El sistema de notificaciones push está ahora sincronizado en todo el ecosistema (Admin y Usuarios), con logs de diagnóstico profesional activos para facilitar el mantenimiento futuro.

---

