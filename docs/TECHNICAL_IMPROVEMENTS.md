# Mejoras Técnicas Propuestas para el Proyecto WintonCoin (Priorizadas)

Este documento describe una serie de mejoras técnicas y de arquitectura sugeridas para fortalecer el código base del proyecto, mejorar su mantenibilidad, escalabilidad y seguridad. Las tareas están **ordenadas por prioridad**, desde la más crítica a la más recomendable.

## 0.1. Reestructuración de Controladores Monolíticos (Deuda Técnica)

**Prioridad: Urgente (Deuda Técnica / SOC 2)**

**Problema Actual:**
Los controladores como `userController.js` (aprox. 1,000 líneas) y `adminController.js` (más de 3,000 líneas) tienen un diseño monolítico. Mezclan la lógica de manejo de solicitudes HTTP (routing) con cálculos complejos de negocio, reglas económicas, validaciones on-chain y llamadas directas a la base de datos. Esto dificulta el mantenimiento, viola el principio de Responsabilidad Única (SRP) y complica las auditorías de seguridad.

**Solución Propuesta (Opción A):**
1. **Separación en Servicios:** Extraer toda la lógica de negocio a una nueva capa de servicios (ej. `creditScoringService.js`, `kycService.js`, `boosterLedgerService.js`).
2. **Refactorización de Controladores:** Dejar los controladores estrictamente para validar la entrada HTTP (req.body/params), llamar al servicio correspondiente, y devolver la respuesta (res.status).
3. **Mantenimiento de Seguridad:** Mantener los estándares SOC 2, validación anti-SQL injection y validaciones OTP en la refactorización para garantizar un ecosistema blindado.

---

## 0.5. Refactorización de Llaves Foráneas (Deuda Técnica)

**Prioridad: Urgente (Deuda Técnica)**

**Problema Actual:**
La tabla `publication_acceptances` utiliza `acceptor_username` (VARCHAR) como llave foránea. Esto va en contra de los estándares de bases de datos relacionales en Fintech, donde siempre se debe usar un `user_id` inmutable para relacionar tablas. Si se permitiera el cambio de nombres de usuario en el futuro, se rompería la integridad de los datos.

**Solución Propuesta:**
1. Crear una migración que agregue una columna `acceptor_user_id` tipo Integer a la tabla `publication_acceptances`.
2. Poblar esa columna cruzando datos con la tabla `users`.
3. Eliminar la columna `acceptor_username`.
4. Refactorizar todas las consultas en `server.js`, `publicationService.js`, y `creditScoringService.js` para usar el nuevo `user_id`.

---

## 0.6. Refactorización de Llaves Foráneas en Deudas, Escrows y P2P (Deuda Técnica — Opción B.2)

**Prioridad: Alta (Deuda Técnica)**

**Problema Actual:**
Múltiples tablas del dominio financiero y de intercambio peer-to-peer de la base de datos (tales como `red_token_debts`, `blue_token_escrows`, `p2p_offers`, `p2p_orders`, `p2p_disputes`, `p2p_ratings`) continúan vinculadas a la identidad de los usuarios a través del campo `username` (VARCHAR) en lugar de una referencia a su identificador de clave primaria inmutable `user_id` (INTEGER). 

Esto contraviene los estándares de seguridad SOC 2, leyes FinTech y las mejores prácticas de auditoría bancaria. El uso de cadenas de texto mutables aumenta el costo de indexación y arriesga la consistencia relacional de la plataforma en producción en caso de que se implementen flujos de cambio de nombre de usuario o eliminación (Derecho al Olvido / GDPR).

**Solución Propuesta:**
1. **Mapeo y Backfill en base de datos**: Asegurar la integridad de claves foráneas `FOREIGN KEY` indexadas sobre `user_id`.
2. **Refactorización del Backend**: Modificar todos los servicios financieros (`financialCoreService.js`), de publicaciones (`publicationService.js`), controladores de usuario (`userController.js`), panel de administración (`adminController.js`) y el controlador modular P2P (`p2pController.js`) para que las consultas y actualizaciones operen y filtren estrictamente por `user_id = $1` en lugar de `username = $1`.
3. **Migración de Vistas del Frontend**: Sincronizar el envío de identificadores desde el cliente Web3 e interfaces administrativas.

---

## 0.7. Desacoplamiento de Inicialización de Base de Datos del Ciclo de Arranque (Deuda Técnica / SOC 2)

**Prioridad: Alta (Arquitectura y SOC 2)**

**Problema Actual:**
El archivo `server.js` invoca `await initializeDatabase();` (en `databaseInit.js`) en cada inicio del servidor. Esto causa dos problemas críticos de escala de producción y seguridad:
1. **Riesgo de Condiciones de Carrera (DDL Locks):** Si se levantan múltiples instancias del backend simultáneamente (balanceo de carga), todas intentarán competir para recrear funciones y alterar tablas al mismo tiempo, lo que puede causar caídas inmediatas del servidor.
2. **Ambivalencia de Firmas (Regresiones en Caliente):** Si una migración en caliente modifica o elimina una función base (como ocurrió con la sobrecarga de la función `record_booster_event` en la migración 083/085), reiniciar el servidor hace que `databaseInit.js` la vuelva a recrear con su firma antigua obsoleta. Como el Migration Runner no re-ejecuta migraciones ya marcadas como exitosas, la base de datos queda en un estado inconsistente y duplicado (causando errores del tipo `function is not unique`).

**Solución Propuesta:**
1. **Desacoplamiento del Arranque:** Eliminar la invocación de `initializeDatabase()` de `server.js`.
2. **Pre-Despliegue (Release Phase):** Mover la lógica de `databaseInit.js` al script de migraciones iniciales (`001`) o a un comando de pre-despliegue (`npm run migrate`) que se ejecute en el pipeline de CI/CD (Render/AWS) antes de levantar los servidores.
3. **Consistencia de Ledger:** Asegurar que cualquier cambio en las firmas de funciones de base de datos se maneje estrictamente a través de migraciones inmutables de base de datos, evitando scripts reactivos de inicialización.

---

## 1. Blindar Configuraciones Críticas con RBAC + MFA

**Prioridad: Urgente (primer paso)**

**Problema Actual:**
- Existen rutas que confían únicamente en un `username` recibido desde el cuerpo de la petición para ejecutar acciones sensibles. Ejemplo: `/notifications/mark-read` y `/users/burn` aceptan `username` sin verificar que pertenezca al usuario autenticado, lo que abre la puerta a suplantaciones (`backend/server.js`).
- Las páginas administrativas (`frontend/admin*.html/js`) no cuentan con un guardado robusto en el backend; cualquier cliente que conozca la ruta puede intentar consumir los endpoints y modificar configuraciones, saldos o notificaciones.

**Solución Propuesta (primer paso a implementar):**
1. **Crear Roles y Permisos Claros:** Añadir columnas como `role` o `is_admin` en `users` (o una tabla `user_roles`). Solo estos usuarios pueden tocar configuraciones o funciones administrativas.
2. **JWT + Middleware RBAC:** Generar un JWT al iniciar sesión, incluir el rol dentro del token y crear middleware tipo `requireAuth` + `requireRole('admin')` que verifique:
   - Token válido firmado con `JWT_SECRET`.
   - Usuario activo y sin bloqueo.
   - Rol con permisos para la ruta solicitada.
3. **MFA para Acciones Sensibles:** Antes de permitir cambios de configuración (por ejemplo, mutar `app_settings` o ejecutar scripts de balance), solicitar un segundo factor (OTP via Twilio o WebAuthn) y validar que fue completado en los últimos minutos.
4. **Just-in-Time Access:** Para tareas operativas críticas, emitir sesiones privilegiadas que expiren tras unos minutos y que se aprueben mediante un flujo tipo “four-eyes” (al menos dos operadores).
5. **Registro Inmutable y Alertas:** Loggear cada cambio administrativo en una tabla append-only (`admin_audit_log`) y enviar eventos a un SIEM/SOC cuando se modifique una configuración.
6. **Endurecer el Frontend:** Eliminar cualquier lógica administrativa del lado del cliente que dependa solo de `localStorage`. Todos los formularios administrativos deben consumir APIs protegidas por el middleware anterior.

**Beneficios:**
- Garantiza que solo usuarios autenticados y autorizados tocan configuraciones o saldos.
- Ofrece trazabilidad para auditorías y respuesta a incidentes.
- Sienta las bases para controles adicionales (aprobaciones duales, firmas digitales) sin rehacer la arquitectura.

---

## 1. Implementar un Middleware de Autenticación Basado en JWT

**Prioridad: Máxima**

**Problema Actual:**
Muchas rutas de la API reciben un `username` en el cuerpo de la solicitud (`req.body`) para identificar al usuario. Esto es una **vulnerabilidad de seguridad crítica**, ya que un usuario malintencionado podría enviar el `username` de otra persona para realizar acciones en su nombre.

**Solución Propuesta:**
Crear un "middleware" de autenticación.

1.  **Login:** Cuando un usuario inicia sesión correctamente, el servidor genera un **JSON Web Token (JWT)** que contiene el ID o `username` del usuario y lo envía al cliente.
2.  **Solicitudes Protegidas:** El frontend guarda este token y lo envía en la cabecera (`Authorization`) de cada solicitud a rutas que requieran autenticación.
3.  **Middleware en el Backend:** Se crea una función middleware que se ejecuta antes de cada ruta protegida. Esta función:
    - Verifica la validez del token JWT.
    - Extrae la información del usuario (ej. `userId`) del token.
    - Añade esta información al objeto `req` (ej. `req.user`).
4.  **Lógica de la Ruta:** Las rutas protegidas ya no necesitan recibir el `username` del `body`. Simplemente acceden a `req.user.id` para saber quién está realizando la acción de forma segura.

**Beneficios:**
- **Seguridad robusta:** La identidad del usuario es verificada criptográficamente por el servidor. Se previene la suplantación de identidad.
- **Código más limpio:** Las rutas no se preocupan por la identidad del usuario, solo por su lógica de negocio.
- **Estándar de la industria:** Es el método estándar para proteger APIs REST.

**Implementación en el Frontend:**
- Tras un login exitoso, el frontend debe recibir y almacenar el token JWT (en lugar del `username`) de forma segura en `localStorage` o `sessionStorage`.
- Para cada solicitud a una ruta protegida, el frontend debe adjuntar el token en la cabecera `Authorization` (ej: `Authorization: Bearer <token>`).
- Al cerrar sesión, el token debe ser eliminado del almacenamiento del cliente.

---

## 2. Integrar Pruebas Automatizadas (Testing)

**Prioridad: Alta**

**Problema Actual:**
El proyecto no cuenta con un sistema de pruebas automatizadas. Esto significa que cada cambio (incluyendo el parche de seguridad anterior) requiere pruebas manuales extensivas para asegurar que no se ha roto nada, lo cual es lento y propenso a errores humanos.

**Solución Propuesta:**
Introducir un framework de pruebas como **Jest** y una librería de aserción de HTTP como **Supertest**.

**Pasos a seguir:**
1.  Configurar Jest en el proyecto.
2.  Crear una base de datos de prueba separada que se pueda reiniciar antes de cada ejecución de pruebas.
3.  Empezar a escribir pruebas para los endpoints de la API, cubriendo casos de éxito y de error. Por ejemplo:
    - `POST /register`: ¿Crea un usuario correctamente? ¿Falla si el usuario ya existe?
    - `POST /login`: ¿Funciona con credenciales correctas? ¿Falla con contraseña incorrecta?
    - `POST /publish`: ¿Un usuario autenticado puede crear una publicación?

**Beneficios:**
- **Confianza en el código:** Permite hacer cambios y refactorizaciones con la seguridad de que no se han introducido regresiones.
- **Detección temprana de errores:** Los errores se detectan durante el desarrollo, no en producción.
- **Documentación viva:** Las pruebas sirven como documentación de cómo se espera que funcione la API.

---

## 3. Refactorización del Backend (Separación de Responsabilidades)

**Prioridad: Alta**

**Problema Actual:**
El archivo `backend/server.js` contiene toda la lógica de la aplicación (configuración del servidor, definición de rutas, lógica de negocio y acceso a la base de datos). Esto se conoce como un archivo "monolítico". A medida que el proyecto crezca, será cada vez más difícil de leer, mantener y depurar.

**Solución Propuesta:**
Reestructurar el backend para seguir un patrón de diseño más modular, como **Rutas, Controladores y Servicios/Modelos**.

*   **`routes/`**: Una carpeta que contendrá archivos dedicados a agrupar rutas por entidad. Por ejemplo, `routes/publications.js` manejaría endpoints como `/publications/active`, `/publications/:id/accept`, etc.
*   **`controllers/`**: Cada ruta llamaría a una función en un "controlador". Por ejemplo, `controllers/publicationController.js` contendría funciones como `getActivePublications`, `acceptPublication`, etc. La responsabilidad del controlador es gestionar la solicitud (`req`) y la respuesta (`res`).
*   **`services/` o `models/`**: El controlador llamaría a funciones en esta capa para ejecutar la lógica de negocio y las consultas a la base de datos. Por ejemplo, `services/publicationService.js` contendría la lógica para interactuar con la tabla `publications` en la base de datos.

**Beneficios:**
- **Código más limpio y organizado:** Cada archivo tiene una única responsabilidad.
- **Mayor facilidad de mantenimiento:** Es más fácil encontrar y modificar el código.
- **Reutilización de código:** La lógica de base de datos se puede reutilizar en diferentes controladores.
- **Facilita las pruebas:** Se pueden probar las unidades de lógica de negocio de forma aislada.

---

## 4. Adoptar un Sistema de Migraciones de Base de Datos Dedicado

**Prioridad: Media**

**Problema Actual:**
El esquema de la base de datos se gestiona a través de una larga serie de consultas `CREATE TABLE IF NOT EXISTS` y `ALTER TABLE` dentro de `server.js`. Esto funciona, pero puede volverse difícil de gestionar y propenso a errores a medida que el proyecto evoluciona.

**Solución Propuesta:**
Utilizar una librería de migraciones como `node-pg-migrate` o el constructor de consultas `Knex.js`, que incluye un sistema de migraciones robusto.

**Cómo funciona:**
- Cada cambio en el esquema de la base de datos (crear una tabla, añadir una columna) se define en su propio archivo de migración.
- Cada migración tiene una función `up` (para aplicar el cambio) y una función `down` (para revertirlo).
- Se utilizan comandos de terminal para aplicar (`migrate:latest`) o revertir (`migrate:rollback`) las migraciones.
- La librería lleva un registro en la base de datos de qué migraciones ya se han aplicado.

**Beneficios:**
- **Control de versiones del esquema:** El historial de cambios de la base de datos queda versionado junto con el código.
- **Colaboración en equipo:** Facilita que múltiples desarrolladores trabajen en la misma base de datos.
- **Fiabilidad:** Reduce el riesgo de errores al actualizar la base de datos en diferentes entornos (desarrollo, producción).

---

## 5. Mejoras en la Arquitectura del Frontend

**Prioridad: Media**

**Problema Actual:**
El frontend, aunque funcional, podría beneficiarse de técnicas que reduzcan la repetición de código y mejoren la gestión del estado a medida que la aplicación crezca.

**Soluciones Propuestas:**

*   **Manejo de Componentes Reutilizables (HTML)**:
    - **Observación:** Elementos como la barra de navegación o los modales se repiten en múltiples archivos HTML.
    - **Solución a corto plazo:** Utilizar JavaScript para cargar dinámicamente estos componentes comunes en las páginas. Por ejemplo, tener un `nav.html` y cargarlo con `fetch()` en cada página.
    - **Solución a largo plazo:** Considerar la adopción de un framework de frontend (como **React, Vue o Svelte**). Estas herramientas están diseñadas para construir interfaces basadas en componentes reutilizables, lo que simplifica enormemente el desarrollo y mantenimiento de aplicaciones complejas.

*   **Gestión del Estado del Frontend**:
    - **Observación:** Los datos del usuario (saldos, notificaciones) se guardan en `localStorage`. Es crucial asegurar que la UI siempre refleje el estado más actual.
    - **Práctica recomendada:** Crear funciones claras para actualizar tanto el `localStorage` como los elementos visibles en la página después de cada operación (ej. una transacción, leer una notificación). Esto asegura que la interfaz de usuario sea reactiva y no requiera una recarga manual para mostrar los datos correctos.

---

## 6. Optimización de Procesos en Segundo Plano (Backend)

**Prioridad: Baja**

**Problema Actual:**
Los procesos periódicos (Colector de Deudas, Liberador de Tokens) se gestionan con `setInterval`. Si bien es funcional, carece de la precisión y expresividad de un programador de tareas dedicado.

**Solución Propuesta:**
Utilizar la librería `node-cron`, que ya es una dependencia en el proyecto. `node-cron` permite definir tareas utilizando la sintaxis cron, que es un estándar en la industria.

**Ejemplo de cambio:**
- **Antes (`setInterval`):** `setInterval(myTask, 24 * 60 * 60 * 1000);` (Ejecutar cada 24 horas).
- **Después (`node-cron`):** `cron.schedule('0 0 * * *', myTask);` (Ejecutar todos los días a la medianoche, hora del servidor).

**Beneficios:**
- **Precisión:** Permite programar tareas en momentos muy específicos (ej. "el primer día de cada mes a las 5:00 AM").
- **Claridad:** La sintaxis cron es muy legible y universalmente entendida por los desarrolladores.
- **Robustez:** Ofrece mejor control sobre la ejecución de tareas programadas.

---

## 7. Mejoras en la Configuración y Consistencia del Código

**Prioridad: Baja**

**Problema Actual:**
El proyecto carece de un archivo de ejemplo para las variables de entorno y tiene algunas rutas duplicadas o con lógica similar en el backend.

**Soluciones Propuestas:**

*   **Crear un archivo `.env.example`**:
    - Añadir un archivo llamado `.env.example` al repositorio.
    - Este archivo debe ser una copia del `.env.development` pero con los valores sensibles eliminados (ej. `DATABASE_URL=postgres://user:password@host:port/database`).
    - **Beneficio:** Facilita a cualquier desarrollador la configuración inicial del proyecto sin exponer credenciales.

*   **Unificar Rutas Duplicadas**:
    - Durante la refactorización del backend, identificar y unificar endpoints que cumplen la misma función (ej. se encontraron varias rutas para `/api/admin/users`).
    - **Beneficio:** Se reduce la duplicación de código y se crea una única fuente de verdad, simplificando el mantenimiento.

---

## 8. Sistema de Alias Público para Referidos (Vanity Codes)

**Prioridad: Media/Futura**

**Problema Actual:**
Los códigos de referido actuales son generados aleatoriamente o mezclados con parte del nombre de usuario. Si bien esto es seguro, no es amigable para el marketing personal. Por otro lado, usar el `username` de login directamente como código de referido es un riesgo de seguridad grave.

**Solución Propuesta:**
Implementar un sistema de "Alias Público" que permita a los usuarios personalizar su código de referido después del registro.

*   **Desacoplamiento:** Mantener el `username` (login) estrictamente privado y usar el campo `referral_code` como el identificador público.
*   **Personalización:** Crear un endpoint `POST /api/user/update-referral-code` que permita al usuario elegir un alias (ej. `JUANPRO`) si está disponible.
*   **Validaciones:** Asegurar unicidad global y aplicar filtros de palabras prohibidas.

**Beneficios:**
- **Seguridad:** Se mantiene protegida la credencial de inicio de sesión.
- **Experiencia de Usuario:** Facilita compartir el enlace con un nombre fácil de recordar y personal.
- **Marketing:** Fomenta que los usuarios compartan más su enlace al sentirse identificados con él.

---

## 9. Roadmap de Seguridad y Auditoría (Pendiente / Futuro)

Estas mejoras **no son obligatorias para que el sistema funcione hoy**, pero son recomendaciones típicas para endurecer la plataforma hacia estándares más estrictos (fintech/banca) y auditorías profundas.

- **CSRF para Admin (crítico si usas cookies cross-site)**: agregar protección anti-CSRF para todas las acciones administrativas (POST/DELETE/PUT), ya sea con tokens CSRF o validación estricta de `Origin/Referer` + token.
- **Admins individuales + RBAC**: evitar “admin genérico” y crear cuentas admin con roles (`support`, `moderator`, `finance`, `superadmin`) y permisos por endpoint.
- **Correlation ID (request_id)**: generar un `request_id` por petición y propagarlo a logs/errores/audit log para trazabilidad.
- **Audit log más fuerte**: añadir campos de `success/fail`, `error_code`, `reason` (sin datos sensibles) y/o envío a SIEM (Splunk/Elastic/Datadog) para centralizar monitoreo.
- **Log tamper-evident / WORM**: para auditorías estrictas, diseñar un esquema de inmutabilidad (hash encadenado) o almacenamiento WORM externo.
- **Dominio propio para API**: migrar a `api.wintoncoin.com` para reducir dependencia de third-party cookies y permitir `SameSite` más estricto.

---

## 10. Refactorizar y Modularizar el Frontend (KISS & DRY)

**Prioridad: Media**

**Problema Actual:**
- El archivo `register.js` tiene casi 1000 líneas de código y tiene múltiples responsabilidades (orquestación visual del Wizard, validación asíncrona de campos, cálculo de edad, gestión de modales). Esto viola el principio KISS y hace el código monolítico y difícil de testear.
- La función de seguridad `_getSafeReturnTo` está duplicada exactamente en `login.js` y `register.js` (violando el principio DRY).

**Solución Propuesta:**
1. Extraer la validación de redirección segura (`_getSafeReturnTo`) a un archivo centralizado `src/modules/security.js`.
2. Modularizar `register.js` moviendo la lógica de control del Wizard a `src/modules/wizardController.js` y las validaciones a `src/modules/validators.js`.

**Beneficios:**
- Código más mantenible, desacoplado y legible.
- Reutilización de lógica de seguridad centralizada.

---

## 11. Endurecer el Almacenamiento de Sesiones (Seguridad de Cookies HttpOnly)

**Prioridad: Alta (Seguridad)**

**Problema Actual:**
- El JWT (token de sesión) se almacena en `localStorage` del cliente. Si la aplicación sufre alguna vulnerabilidad de XSS (Cross-Site Scripting), un script malicioso de un tercero podría leer el token y robar la sesión del usuario.

**Solución Propuesta:**
- Configurar el backend para enviar el JWT en una cookie con los atributos `HttpOnly`, `Secure` y `SameSite=Strict`.
- El frontend ya no necesitará guardar ni enviar el token en la cabecera `Authorization` de forma manual; el navegador se encargará de enviarlo automáticamente y de forma protegida en cada petición HTTP al mismo dominio.

**Beneficios:**
- Protección total del token de sesión contra robos vía XSS.
- Alineación con los estándares FinTech y SOC 2 de máxima seguridad de datos de usuario.

---

## 12. Plan de Refactorización y Auditoría del Frontend

**Prioridad: Alta (Mantenibilidad, UX y Seguridad Client-Side)**

**Problemas Identificados:**
1. **Controladores Frontend Monolíticos**: Archivos como `contract-interaction.js` (~3,100+ líneas) y `admin-panel.js` (~6,500+ líneas) concentran múltiples responsabilidades (feed, modales, temporizadores de deuda/escrow, encuestas y ratings), dificultando el mantenimiento y las pruebas automatizadas.
2. **Ambigüedad Visual en Saldos**: Falta diferenciar explícitamente en la UI el token de activo `BLUE` circulante (post-lanzamiento) de los pagarés `BLUE IOU` (perfil de impulsor/pre-lanzamiento), previniendo confusión en transferencias.
3. **Auditoría y Telemetría Client-Side**: Ausencia de trazabilidad y logs estandarizados en el cliente ante eventos financieros o errores de interacción Web3.
4. **Optimización Responsiva Móvil**: Necesidad de garantizar Touch Targets mayores a 48px y evitar overflow horizontal en modales e historiales P2P para pantallas estrechas (<380px).
5. **Consistencia de Entradas Multi-Página en Vite**: Requisito de mantener al día `vite.config.js` ante cualquier creación o cambio de nombre de vistas HTML para garantizar compilación limpia en producción.

**Solución Propuesta:**
1. **Modularización Progresiva**: Desacoplar gradualmente los controladores monolíticos en módulos especializados (`feedManager.js`, `walletManager.js`, `countdownManager.js`, `ratingModal.js`).
2. **Clarificación UI de Tokens**: Añadir indicadores visuales (badging / tooltips explicativos) entre saldo líquido y saldo IOU.
3. **Logs Auditables Client-Side**: Implementar logger estandarizado para eventos críticos de cliente.
4. **UX Responsiva Élite**: Ajustar la rejilla de modales y tablas P2P para cumplimiento de guías estilo Binance/Coinbase/Rappi.
5. **Sincronización Vite**: Automatizar o verificar las entradas de `rollupOptions.input` en `vite.config.js`.

---

## 13. Plan de Refactorización y Auditoría de la Base de Datos, Migraciones y Auditoría Bancaria

**Prioridad: Crítica / Alta (Arquitectura, Ciberseguridad, SOC 2 e Integridad Relacional)**

**Problemas Identificados y Severidad Asignada:**

1. **Dualidad Arquitectónica e Inicialización Redundante (`databaseInit.js` vs `migrationRunner.js`)**
   - **Severidad: CRÍTICA / URGENTE**
   - **Problema:** En el inicio del servidor (`server.js`), se ejecuta primero `databaseInit.js` (más de 1,500 líneas de DDL inline) y luego `migrationRunner.js` (102 archivos de migración). Esto provoca DDLs duplicados, condiciones de carrera en inicios concurrentes y riesgo de recrear firmas de funciones obsoletas.
   - **Solución Propuesta:** Consolidar todo el esquema DDL en las migraciones numeradas de `backend/migrations/`, desacoplando `databaseInit.js` del ciclo de arranque del servidor.

2. **Duplicidad y Fracturación de las Tablas de Auditoría (`audit_log` vs `audit_logs`)**
   - **Severidad: CRÍTICA / SOC 2**
   - **Estado:** ✅ **COMPLETADO E IMPLEMENTADO (2026-08-12)**
   - **Solución Aplicada:** Se creó la migración DDL `105_consolidate_audit_logs.js` para migrar los registros históricos de `audit_logs` (plural) hacia `audit_log` (singular) y eliminar la tabla obsoleta. Se refactorizaron `financialCoreService.js`, `victimController.js` y `delete_last_sos_user.js` canalizando el 100% de los eventos a través de la tabla unificada `audit_log`.

3. **Colisión de Prefijos de Migración (`050_...`) y Compatibilidad Legacy (`MockPool`)**
   - **Severidad: ALTA**
   - **Problema:** Dos archivos comparten el prefijo `050_` (`050_add_web3_wallet_and_scoring_settings.js` y `050_create_booster_stages.js`), lo que puede causar orden de ejecución indeterminado. Además, el runner utiliza un parche dinámico (`MockPool`) para ejecutar migraciones legacy (001-049).
   - **Solución Propuesta:** Renombrar la migración duplicada al prefijo correlativo único disponible y refactorizar progresivamente las migraciones legacy al formato estándar exportado `exports.up = async (client) => { ... }`.

4. **Instanciación Duplicada de Pools de Conexión (`pg.Pool`)**
   - **Severidad: ALTA**
   - **Problema:** `db.js` instancia el pool principal, pero `migrationRunner.js` y varios scripts independientes instancian pools adicionales de `pg.Pool`, incrementando innecesariamente el número de conexiones simultáneas a PostgreSQL.
   - **Solución Propuesta:** Reutilizar la instancia singleton del pool de `db.js` en el runner de migraciones y scripts auxiliares.

5. **Construcción de SQL Dinámico e Identificadores Concatenados**
   - **Severidad: MEDIA**
   - **Problema:** Aunque las variables de datos están 100% parametrizadas (`$1, $2`), en módulos como `victimController.js` (`whereSql`) y `backup-database.js` se interpolan fragmentos de SQL o nombres de tabla mediante template strings (`${...}`).
   - **Solución Propuesta:** Aplicar listas blancas (*whitelisting*) estrictas o sanitización con `pg-format` para la construcción de consultas dinámicas avanzadas.

6. **Campos Redundantes Legacy en `users` (`phone` vs `phone_number`)**
   - **Severidad: MEDIA**
   - **Problema:** Existen dos columnas para el teléfono de los usuarios debido a parches acumulados en el monolito `databaseInit.js`.
   - **Solución Propuesta:** Deprecar la columna redundante y unificar todas las lecturas/escrituras en un único campo estandarizado (`phone_number`).

---

## 14. Automatizaci�n de Despliegues con CI/CD (GitHub Actions)

**Prioridad: Media / Alta (DevOps y Estandarizaci�n Profesional)**

**Problema Actual:**
Actualmente los procesos de construcci�n (build) de los entornos de Producci�n (
pm run build) y Demostraci�n (
pm run build:demo) se ejecutan de manera local. Aunque se ha solucionado el aislamiento de directorios (dist/ vs dist-demo/), depender de builds locales introduce riesgos de inconsistencia (diferentes versiones de Node, cach� corrupta) y vulnera el est�ndar de cero confianza (Zero-Trust) para despliegues a producci�n.

**Soluci�n Propuesta:**
1. **Implementar GitHub Actions:** Crear workflows (ej. .github/workflows/deploy-prod.yml y deploy-demo.yml) que automaticen el proceso de build y despliegue.
2. **Entornos Ef�meros:** Configurar el pipeline para que, ante cada push a la rama main o demo, levante un contenedor inmaculado, instale dependencias, ejecute el build correspondiente y lo transfiera autom�ticamente al proveedor de alojamiento v�a FTP/SSH o integraciones directas.
3. **Bloqueo de Modificaciones Manuales:** Requerir que todos los cambios pasen por Pull Requests revisados, garantizando que el c�digo que llega a los usuarios fue compilado y auditado por los servidores de integraci�n y no por la m�quina de un desarrollador individual.

**Beneficios:**
- **Seguridad Inquebrantable:** Cumplimiento total del est�ndar Zero-Trust, con auditor�a de qui�n aprob� y qu� bot ejecut� el despliegue.
- **Eficiencia y Confiabilidad:** Se elimina el error humano (ej. subir dist-demo a producci�n accidentalmente) y se garantiza un entorno de compilaci�n id�ntico cada vez.

---

## 15. Optimización de Base de Datos para Escala Masiva: Índice B-Tree en `pending_verifications(expires_at)`

**Prioridad: Baja / Futura (Requerido únicamente para Millones de Usuarios Concurrentes)**

**Contexto & Diagnóstico:**
El worker de mantenimiento `stagingCleanupJob.js` ejecuta periódicamente cada 48 horas la purga de registros temporales en `pending_verifications` (`WHERE expires_at < NOW() - INTERVAL '48 hours'`).
En el volumen actual y a mediano plazo (cientos o miles de solicitudes diarias), la consulta se resuelve de forma instantánea en memoria en menos de 2 milisegundos sin requerir índices adicionales.

**Mejora Propuesta para Escala Masiva:**
Cuando la plataforma alcance un tráfico masivo de millones de registros o censos humanitarios concurrentes diarios, se recomienda crear una migración dedicada para añadir un índice B-Tree sobre la columna `expires_at`:
```sql
CREATE INDEX IF NOT EXISTS idx_pending_verifications_expires_at 
ON pending_verifications (expires_at);
```

**Beneficios a Escala:**
- **Transformación a Escaneo de Índice O(log N):** Evita escaneos secuenciales de disco durante la purga en tablas con millones de registros históricos.
- **Cero Bloqueos:** Minimiza el tiempo de retención de bloqueos a nivel de fila a microsegundos, optimizando el consumo de I/O en hardware de base de datos a gran escala.
