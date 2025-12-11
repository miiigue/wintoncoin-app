ok pero borra "gener# Mejoras Técnicas Propuestas para el Proyecto WintonCoin (Priorizadas)

Este documento describe una serie de mejoras técnicas y de arquitectura sugeridas para fortalecer el código base del proyecto, mejorar su mantenibilidad, escalabilidad y seguridad. Las tareas están **ordenadas por prioridad**, desde la más crítica a la más recomendable.

---

## 0. Blindar Configuraciones Críticas con RBAC + MFA

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