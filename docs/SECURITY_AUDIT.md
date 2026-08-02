### Informe de Auditoría de Seguridad

**Fecha:** 8 de Julio, 2025
**Objetivo:** `backend/server.js`
**Nivel de Riesgo General (Actual):** Medio-Alto

---

#### 1. Inyección de SQL (SQL Injection)

*   **Análisis:** Se observa un uso generalizado de **consultas parametrizadas** (ej. `pool.query(sql, [valor1, valor2])`). Esta es la **práctica correcta y más importante** para prevenir la inyección de SQL. El driver de `pg` se encarga de escapar de forma segura los valores.
*   **Vulnerabilidad Encontrada:** Existe una vulnerabilidad en la ruta `GET /publications/active` (línea ~1239) donde se construye una parte de la consulta SQL (`searchCondition`) concatenando directamente el término de búsqueda (`req.query.search`). Un atacante podría inyectar SQL malicioso en este punto.
    ```javascript
    // LÍNEA VULNERABLE (~1246)
    if (search) {
        // El operador ILIKE es para búsquedas insensibles a mayúsculas.
        // El problema es la concatenación directa de `search`.
        searchCondition = `AND (p.title ILIKE '%${search}%' OR p.description ILIKE '%${search}%')`;
    }
    const finalQuery = baseQuery + searchCondition + ...
    ```
*   **Riesgo:** **Crítico**. Permite a un atacante leer, modificar o eliminar cualquier dato de la base de datos.
*   **Recomendación:** Modificar la consulta para que el término de búsqueda también se pase como un parámetro.
    ```javascript
    // SOLUCIÓN
    const queryParams = [username];
    if (search) {
        searchCondition = `AND (p.title ILIKE $${queryParams.length + 1} OR p.description ILIKE $${queryParams.length + 1})`;
        queryParams.push(`%${search}%`); // Se añade el término de búsqueda al array de parámetros
    }
    // ...
    const result = await client.query(finalQuery, queryParams);
    ```

---

#### 2. Control de Acceso (Broken Access Control)

*   **Análisis:** Muchas rutas realizan comprobaciones para asegurarse de que el usuario que realiza la acción es el que debería. Por ejemplo, en `POST /publications/:id/accept`, se comprueba que el autor no sea el mismo que acepta la tarea.
*   **Vulnerabilidad Encontrada:** Múltiples rutas críticas carecen de una validación de autorización adecuada. Un usuario autenticado podría, potencialmente, realizar acciones en nombre de otro usuario simplemente conociendo el ID correcto.
    *   **Pausar Tarea (`POST /publications/:id/pause`):** No se comprueba si el `username` que llega en el body es el verdadero autor de la publicación. Un atacante podría pausar la tarea de cualquier otro usuario.
    *   **Confirmar Trabajo (`POST /publications/:id/confirm`):** No se comprueba que quien confirma el trabajo sea el autor de la publicación. Un atacante podría confirmar un trabajo que no le corresponde.
    *   **Pagar Tarea (`POST /publications/:id/pay`):** Similar al anterior, no se valida que el pagador sea el autor.
*   **Riesgo:** **Alto**. Permite a un usuario manipular el estado de las publicaciones de otros, lo que podría llevar a fraudes o a la interrupción del servicio.
*   **Recomendación:** En cada una de estas rutas, antes de realizar cualquier acción, se debe añadir una consulta a la base de datos para verificar que el usuario que envía la petición es el `author_username` de la publicación que se intenta modificar.
    ```javascript
    // EJEMPLO DE SOLUCIÓN PARA /pause
    const publicationResult = await client.query('SELECT author_username FROM publications WHERE id = $1', [publicationId]);
    if (publicationResult.rows.length === 0) {
        return res.status(404).json({ message: "Publicación no encontrada." });
    }
    if (publicationResult.rows[0].author_username !== username) { // `username` del body
        return res.status(403).json({ message: "No tienes permiso para pausar esta publicación." });
    }
    // Si pasa la comprobación, se continúa con la lógica...
    ```

---

#### 3. Seguridad de Contraseñas y Autenticación

*   **Análisis:** Se utiliza `bcrypt` para hashear las contraseñas, lo cual es la **mejor práctica actual**. El número de rondas de salting está establecido en 10 (`const saltRounds = 10;`), que es un valor aceptable.
*   **Vulnerabilidad Encontrada (Baja):** El sistema no implementa un mecanismo de bloqueo de cuentas o limitación de intentos de inicio de sesión (`Rate Limiting`).
*   **Riesgo:** **Bajo**. Un atacante podría intentar un ataque de fuerza bruta contra las contraseñas de los usuarios de forma indefinida, aunque `bcrypt` lo hace computacionalmente costoso.
*   **Recomendación:** Implementar un middleware de `rate limiting` en las rutas de autenticación (`/login`, `/admin/login`). Paquetes como `express-rate-limit` son muy fáciles de configurar y pueden limitar el número de intentos de inicio de sesión desde una misma IP.
    ```javascript
    // EJEMPLO DE IMPLEMENTACIÓN
    const rateLimit = require('express-rate-limit');

    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 5, // 5 intentos por IP cada 15 minutos
        message: 'Demasiados intentos de inicio de sesión. Por favor, inténtelo de nuevo en 15 minutos.'
    });

    app.post('/login', loginLimiter, async (req, res) => { /* ... */ });
    ```

---

#### 4. Exposición de Información Sensible

*   **Análisis:** La mayoría de los endpoints devuelven solo la información necesaria. Sin embargo, hay un caso que podría mejorarse.
*   **Vulnerabilidad Encontrada:** La ruta de registro (`POST /register`) devuelve en su respuesta de éxito el objeto completo del nuevo usuario, que incluye el hash de la contraseña.
    ```javascript
    // LÍNEA VULNERABLE (~834)
    res.status(201).json({ message: "Usuario registrado con éxito", user: newUser.rows[0] });
    ```
*   **Riesgo:** **Bajo**. Aunque la contraseña está hasheada, es una buena práctica de seguridad nunca exponer los hashes de contraseña en las respuestas de la API.
*   **Recomendación:** Modificar la respuesta para que no incluya el objeto completo del usuario, o al menos eliminar la propiedad `password_hash` antes de enviarlo.
    ```javascript
    // SOLUCIÓN
    const registeredUser = newUser.rows[0];
    delete registeredUser.password_hash; // Se elimina el hash del objeto
    res.status(201).json({ message: "Usuario registrado con éxito", user: registeredUser });
    ```

### Resumen y Próximos Pasos

La plataforma tiene una base de seguridad decente gracias al uso de `bcrypt` y consultas parametrizadas. Sin embargo, las vulnerabilidades de **Inyección de SQL** y **Control de Acceso** deben ser tratadas con **máxima prioridad**, ya que presentan un riesgo crítico para la integridad de los datos y la confianza en la plataforma.

**Orden de Prioridad Recomendado:**
1.  **Crítico:** Arreglar la Inyección de SQL en la búsqueda de publicaciones.
2.  **Alto:** Implementar las comprobaciones de autorización en las rutas de `pause`, `confirm` y `pay`.
3.  **Bajo:** Implementar `rate limiting` en el login.
4.  **Bajo:** Ocultar el hash de la contraseña en la respuesta de registro.

Este informe debe servir como una guía para fortalecer la seguridad de la aplicación antes de su lanzamiento.

---

### Recomendaciones Futuras (Roadmap estilo fintech/banca)

Estas recomendaciones complementan los hallazgos anteriores y están orientadas a auditorías más estrictas (defensa en profundidad):

- **CSRF en Admin (si hay cookies HttpOnly y cross-site)**: implementar tokens CSRF o validación estricta de `Origin/Referer` en endpoints administrativos con efecto (POST/DELETE/PUT).
- **Admins individuales + RBAC**: sustituir “admin genérico” por cuentas con roles y permisos por endpoint (segregación de funciones).
- **Correlation ID / Request ID**: generar un identificador único por request y registrarlo en logs y en `audit_log` para trazabilidad total.
- **Audit log reforzado**: registrar `success/fail`, `error_code`, `reason` (sin PII sensible) y evaluar envío a SIEM centralizado.
- **Logs tamper-evident / WORM**: para evidenciar que el audit log no fue alterado (hash encadenado o almacenamiento WORM externo).
- **Arquitectura de dominios**: mover API a `api.wintoncoin.com` para reducir dependencia de third‑party cookies y endurecer política `SameSite`.