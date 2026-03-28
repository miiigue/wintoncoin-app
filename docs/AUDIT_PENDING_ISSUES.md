# Auditoría Técnica — Hallazgos Pendientes de Resolución

> **Fecha de auditoría:** 2026-03-27  
> **Alcance:** Funciones de renderizado de la PWA, selector/filtro de publicaciones, y calidad general del módulo `contract-interaction.js` y su HTML asociado.  
> **Auditor:** Agente IA — Revisión nivel Senior Engineering  
> **Estado del documento:** ACTIVO — Revisar periódicamente

---

## Instrucciones para cualquier agente o chat futuro

**IMPORTANTE:** Antes de implementar cualquier corrección de este documento:

1. **Verificar si ya fue resuelto** — Buscar en el código actual si el hallazgo sigue presente. El código evoluciona entre sesiones.
2. **Leer el contexto completo** — Cada hallazgo incluye la ubicación exacta (archivo + línea aproximada). Las líneas pueden haber cambiado; usar el patrón de código descrito para localizar.
3. **No asumir** — Si no encuentras el problema descrito, marcarlo como `[RESUELTO]` en este documento con la fecha.
4. **Priorizar** — Los hallazgos están ordenados por severidad. Resolver primero los CRÍTICOS.
5. **Actualizar este documento** — Al resolver un hallazgo, agregar una línea `> ✅ Resuelto: YYYY-MM-DD — breve descripción de la solución aplicada`.

---

## Severidad: CRÍTICA (Errores activos en producción)

### C-01 — Función `startCountdown` no existe (Runtime Error)

- **Archivo:** `frontend/src/pages/contract-interaction.js`
- **Ubicación aprox.:** Función `handleCountdownTimers`, dentro de la rama "Available countdown"
- **Patrón a buscar:** `startCountdown(data.next_available_at`
- **Descripción:** La función `handleCountdownTimers` invoca `startCountdown(...)` para el countdown de tokens "disponibles" próximos a liberarse. Sin embargo, esta función **no está definida** en ninguna parte del archivo ni en los módulos importados. Sí existen `startDebtCountdown` y `startEscrowCountdown` para los otros dos countdowns, pero falta la de "available".
- **Impacto:** `ReferenceError` en runtime. Cualquier usuario que tenga fondos pendientes de liberación no verá el countdown de "próxima liberación" y el error rompe silenciosamente la ejecución del bloque.
- **Solución sugerida:** Crear la función `startAvailableCountdown` (o `startCountdown`) con la misma estructura de `startEscrowCountdown`, adaptada para mostrar el mensaje de liberación de tokens disponibles. Actualizar la variable de intervalo `availableCountdownInterval` correctamente.

---

### C-02 — Polling agresivo de 5 segundos sin control de visibilidad

- **Archivo:** `frontend/src/pages/contract-interaction.js`
- **Patrón a buscar:** `setInterval(loadAllData, 5000)`
- **Descripción:** `loadAllData` dispara 5 llamadas HTTP al servidor cada 5 segundos (`fetchAndDisplayPublications`, `fetchNotifications`, `fetchAndDisplayBalances`, `fetchBoosterSummary`, `fetchSolidarioSummary`). No hay ninguna verificación con la API `document.visibilitychange` / `document.hidden`, así que **el polling continúa cuando el tab está en segundo plano**, desperdiciando batería (crítico en móviles/PWA) y sobrecargando el servidor.
- **Impacto:** Desperdicio de recursos del servidor y del dispositivo del usuario. En una PWA móvil, esto drena batería significativamente.
- **Solución sugerida:** Implementar `document.addEventListener('visibilitychange', ...)` para pausar el intervalo cuando el tab no es visible. Considerar también `AbortController` para cancelar requests en vuelo cuando se inicia un nuevo ciclo, y aumentar el intervalo a 15-30 segundos con actualización inmediata al volver al tab.

---

### C-03 — Caché de ratings de usuario se destruye en cada renderizado

- **Archivo:** `frontend/src/pages/contract-interaction.js`
- **Ubicación aprox.:** Función `renderPublicationsWithFilters`
- **Patrón a buscar:** `const userRatingsCache = new Map()`
- **Descripción:** El `Map` de caché de ratings se crea como variable **local** dentro de `renderPublicationsWithFilters`. Esto significa que se destruye y recrea en cada invocación. Combinado con el polling de 5 segundos, genera N requests HTTP de ratings cada 5 segundos (uno por cada autor único).
- **Impacto:** Carga innecesaria al servidor. Si hay 20 publicaciones de 10 autores, son 10 HTTP requests extra cada 5 segundos.
- **Solución sugerida:** Mover `userRatingsCache` a nivel de módulo (como variable del closure de `DOMContentLoaded`) con un TTL de 60 segundos, similar al patrón de `lastBoosterFetch`/`lastSolidarioFetch`.

---

## Severidad: IMPORTANTE (Riesgos potenciales)

### I-01 — XSS potencial: datos del servidor insertados sin sanitizar en HTML

- **Archivo:** `frontend/src/pages/contract-interaction.js`
- **Ubicación aprox.:** Función `getPublicationCardHTML`
- **Patrones a buscar:**
  - `` `<a href="profile.html?user=${pub.author_username}"` ``
  - `` `<h3>${pub.title}</h3>` ``
- **Descripción:** Los campos `pub.author_username` y `pub.title` se insertan directamente en template literals que generan HTML, sin ninguna sanitización ni escape. Si un usuario registra un username o título con payloads como `<img onerror=alert(1)>`, se ejecutaría JavaScript en el navegador de todos los usuarios que vean esa publicación.
- **Nota:** La función `linkify` sí sanitiza la descripción (escapa `<`, `>`, `&`), pero esta protección no se aplica al título ni al autor.
- **Solución sugerida:** Crear una función `escapeHTML(str)` reutilizable y aplicarla a todos los datos del servidor antes de insertarlos en HTML. Alternativamente, usar `textContent` donde sea posible en lugar de `innerHTML`.

---

### I-02 — `document.execCommand('copy')` deprecado

- **Archivo:** `frontend/src/pages/contract-interaction.js`
- **Patrón a buscar:** `document.execCommand('copy')`
- **Descripción:** Esta API está oficialmente deprecada. Funciona en la mayoría de navegadores actuales pero no hay garantía futura.
- **Solución sugerida:** Reemplazar por `navigator.clipboard.writeText(qrCodeUrlInput.value)`.

---

### I-03 — CDN RawGit discontinuado para librería QRCode

- **Archivo:** `frontend/contract_interaction.html`
- **Patrón a buscar:** `cdn.rawgit.com/davidshimjs/qrcodejs`
- **Descripción:** RawGit fue descontinuado oficialmente. El CDN puede dejar de servir el archivo en cualquier momento, rompiendo la funcionalidad de código QR de Venta Rápida.
- **Solución sugerida:** Migrar a `cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js` o instalar el paquete localmente vía npm.

---

### I-04 — Select mezcla filtros y ordenamientos (problema de UX y lógica)

- **Archivo:** `frontend/contract_interaction.html`
- **Patrón a buscar:** `<select id="publicationSortFilter"`
- **Descripción:** Un solo `<select>` contiene opciones de **filtrado** (excluyen resultados: "En proceso", "Solicitudes de tarea", "Ventas", "Donaciones") y de **ordenamiento** (reordenan: "Más reciente", "Más antigua", "Mayor/menor recompensa"). Esto hace imposible filtrar Y ordenar a la vez (ejemplo: ver solo "Solicitudes de tarea" ordenadas por "Mayor recompensa"). El label dice "Ordenar por" pero incluye filtros.
- **Solución sugerida:** Separar en dos controles: un selector de tipo/filtro y un selector de orden. O implementar un sistema de chips/tags de filtros combinables.

---

### I-05 — Código muerto en `applySortAndFilter`

- **Archivo:** `frontend/src/pages/contract-interaction.js`
- **Ubicación aprox.:** Función `applySortAndFilter`
- **Patrón a buscar:** `const selected = elements.publicationSortFilter?.value || 'recent'` seguido de `if (!selected)`
- **Descripción:** La línea `if (!selected) { return sortByPendingPriority(result); }` nunca se ejecuta porque el operador `|| 'recent'` ya garantiza que `selected` siempre sea truthy. Es código muerto.
- **Solución sugerida:** Eliminar la rama muerta o reestructurar la lógica del fallback.

---

### I-06 — Memory leak: event listeners acumulativos en `fetchSolidarioSummary`

- **Archivo:** `frontend/src/pages/contract-interaction.js`
- **Ubicación aprox.:** Dentro de `fetchSolidarioSummary`, bloque del historial
- **Patrón a buscar:** `window.addEventListener('click', (e) => {` dentro de fetchSolidarioSummary
- **Descripción:** Se añade un `window.addEventListener('click', ...)` cada vez que `fetchSolidarioSummary` se ejecuta. Aunque tiene caché de 60s, con el tiempo se acumulan listeners duplicados en `window` que nunca se remueven.
- **Solución sugerida:** Registrar el listener una sola vez fuera del flujo repetitivo, o usar `{ once: true }`, o asignar un named handler y remover antes de re-registrar.

---

### I-07 — `Promise.all` sin manejo de fallo parcial en renderizado

- **Archivo:** `frontend/src/pages/contract-interaction.js`
- **Ubicación aprox.:** Función `renderPublicationsWithFilters`
- **Patrón a buscar:** `const publicationsHTML = await Promise.all(filteredPublications.map(`
- **Descripción:** Si una sola llamada a `fetchUserRating` lanza una excepción no capturada dentro del `.map()`, `Promise.all` rechaza completamente y **toda la lista de publicaciones deja de renderizarse**. La función `fetchUserRating` tiene try/catch, pero si ocurre un error no anticipado, el renderizado completo se rompe.
- **Solución sugerida:** Usar `Promise.allSettled` y manejar resultados fallidos individualmente, o agregar un try/catch dentro del `.map()` callback.

---

## Severidad: MENOR (Mejoras de calidad)

### M-01 — Meta tag duplicada en HTML

- **Archivo:** `frontend/contract_interaction.html`
- **Patrón a buscar:** `apple-mobile-web-app-status-bar-style`
- **Descripción:** La meta tag `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` aparece duplicada (líneas ~16 y ~35 aprox.).
- **Solución sugerida:** Eliminar una de las dos ocurrencias.

---

### M-02 — Polución global excesiva del objeto `window`

- **Archivo:** `frontend/src/pages/contract-interaction.js`
- **Patrón a buscar:** `window.handleDirectDonation`, `window.handleCardAction`, `window.loadAllData`, `window.clearAllNotifications`, `window.openNotificationHistory`
- **Descripción:** Al menos 19 funciones/variables se exponen en `window.*`. En una arquitectura de ES Modules esto es un anti-patrón que dificulta testing, depuración y puede generar colisiones de nombres.
- **Solución sugerida:** Migrar progresivamente a event delegation y comunicación por eventos personalizados (`CustomEvent`) en vez de funciones globales.

---

### M-03 — Handlers `onclick` inline en template strings generados dinámicamente

- **Archivo:** `frontend/src/pages/contract-interaction.js`
- **Patrones a buscar:**
  - `onclick="document.getElementById('openPublicationModalBtn').click()"`
  - `onclick="event.preventDefault(); event.stopPropagation(); window.handleCardAction('hide'`
- **Descripción:** Uso de atributos `onclick` inline dentro de HTML generado por template literals. Mezcla presentación con lógica y dificulta CSP (Content Security Policy).
- **Solución sugerida:** Usar event delegation en el contenedor padre (`publications-list`) con `data-*` attributes.

---

### M-04 — Sin indicador de carga (loading state) para publicaciones

- **Archivo:** `frontend/src/pages/contract-interaction.js`
- **Ubicación aprox.:** Función `fetchAndDisplayPublications`
- **Descripción:** Cuando se cargan publicaciones, no se muestra ningún spinner ni skeleton ni indicador de progreso. El usuario ve la lista anterior sin retroalimentación visual.
- **Solución sugerida:** Agregar un estado de carga (skeleton cards o spinner) mientras se resuelve el fetch.

---

### M-05 — CSS: selector `.publication-item` definido dos veces en `style.css`

- **Archivo:** `frontend/style.css`
- **Patrón a buscar:** `.publication-item {` (buscar ambas ocurrencias)
- **Descripción:** El selector `.publication-item` está definido en dos ubicaciones separadas del CSS (~línea 2035 y ~línea 6717). Las propiedades de la segunda definición sobrescriben las de la primera. Esto dificulta el mantenimiento.
- **Solución sugerida:** Consolidar ambas definiciones en una sola ubicación.

---

## Registro de resoluciones

| ID | Fecha | Resolución |
|----|-------|------------|
| I-04 | 2026-03-27 | Resuelto: Select único reemplazado por filter chips (tipo) + sort dropdown (orden) separados. Se eliminó código muerto de `applySortAndFilter`. |
| I-05 | 2026-03-27 | Resuelto: Rama `if (!selected)` eliminada al reescribir `applySortAndFilter` con nueva arquitectura de filtro + orden. |
| C-03 | 2026-03-27 | Resuelto: `userRatingsCache` promovido a variable de módulo (persistente). Se invalida solo al traer publicaciones frescas del servidor. Los re-renderizados por filtro/orden/búsqueda ya no generan peticiones HTTP de ratings. |

---

> **Nota final:** Este documento debe actualizarse cada vez que se resuelva un hallazgo. Al confirmar que un issue fue resuelto, mover su entrada a la tabla de resoluciones con la fecha y una breve descripción de cómo se solucionó.
