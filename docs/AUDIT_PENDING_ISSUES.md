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

### C-01 — [RESUELTO] Función `startCountdown` no existe (Runtime Error)

- **Archivo:** `frontend/src/pages/contract-interaction.js`
- **Ubicación aprox.:** Función `handleCountdownTimers`, dentro de la rama "Available countdown"
- **Patrón a buscar:** `startAvailableCountdown(data.next_available_at`
- **Descripción:** La función `handleCountdownTimers` invocaba `startCountdown(...)` que no existía → `ReferenceError` en runtime.
- > ✅ Resuelto: 2026-04-02 — Creada función `startAvailableCountdown()` siguiendo el patrón de `startDebtCountdown`/`startEscrowCountdown`. Limpia interval previo, formatea monto, muestra countdown, refresca saldos al llegar a 0. Llamada actualizada en `handleCountdownTimers`.

---

### C-02 — [RESUELTO] Polling agresivo de 5 segundos sin control de visibilidad

- **Archivo:** `frontend/src/pages/contract-interaction.js`
- **Patrón a buscar:** `POLLING_INTERVAL_MS`, `handleVisibilityChange`, `startPolling`, `stopPolling`
- **Descripción:** `loadAllData` disparaba 5 llamadas HTTP cada 5 segundos sin pausarse cuando el tab estaba oculto.
- > ✅ Resuelto: 2026-04-02 — Implementado sistema de polling inteligente con Page Visibility API (W3C): `startPolling()`/`stopPolling()` controlados por `visibilitychange`. Intervalo aumentado a 10s. Tab oculto = 0 requests. Al volver al tab = refresh inmediato + reinicio del ciclo.

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

### I-01 — [RESUELTO] XSS potencial: datos del servidor insertados sin sanitizar en HTML

- **Archivo:** `frontend/src/pages/contract-interaction.js`
- **Ubicación aprox.:** Función `getPublicationCardHTML`
- **Descripción:** `pub.author_username` y `pub.title` se insertaban en HTML sin escape → riesgo XSS.
- > ✅ Resuelto: 2026-04-02 — Creado módulo `frontend/src/modules/sanitize.js` con `escapeHtml()` y `escapeAttr()` (OWASP compliant, escapa & < > " '). Aplicado en `getPublicationCardHTML`: título usa `escapeHtml(pub.title)`, autor usa `escapeHtml`/`escapeAttr` + `encodeURIComponent` para query params. Módulo registrado en `index.js` y expuesto en `window.*` para compatibilidad global.

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

## Severidad: PUSH NOTIFICATIONS — Auditoría 2026-04-02

> Los siguientes hallazgos fueron identificados y **resueltos** en la auditoría integral del sistema push del 2026-04-02.

### PUSH-01 — [RESUELTO] Panel Admin push completamente roto (frontend ↔ backend desalineados)

- **Archivos:** `backend/src/controllers/notificationController.js`, `frontend/src/pages/admin-panel.js`
- **Descripción:** Frontend enviaba `message`, backend esperaba `body`. No existía lógica de envío individual. Respuesta sin campo `success`.
- > ✅ Resuelto: 2026-04-02 — Controller reescrito: acepta `body` y `message`, implementa envío individual por username, respuesta con `{ success, sent, failed, total_active }`.

### PUSH-02 — [RESUELTO] Preferencias de notificación se borraban al guardar

- **Archivos:** `frontend/src/modules/notificationSettings.js`, `backend/src/controllers/notificationController.js`, `backend/src/services/notificationService.js`
- **Descripción:** Frontend enviaba `{ social, marketing }` directo, controller esperaba `{ settings: {...} }`. Resultado: `settings = undefined` → preferencias reseteadas.
- > ✅ Resuelto: 2026-04-02 — Frontend envía `{ settings: { social, marketing } }`. Controller acepta ambos formatos. Service hace merge con preferencias actuales.

### PUSH-03 — [RESUELTO] 9/18 llamadas push con `url` en raíz (navegación rota al click)

- **Archivos:** `backend/src/controllers/publicationController.js`, `backend/src/controllers/authController.js`
- **Descripción:** SW lee `event.notification.data.url` pero 9 llamadas ponían `url` en la raíz del payload → click siempre iba a página por defecto.
- > ✅ Resuelto: 2026-04-02 — Todas las llamadas corregidas a `data: { url }`. Función `normalizePayload()` como safety net.

### PUSH-04 — [RESUELTO] SQL Injection en broadcast masivo

- **Archivo:** `backend/src/services/notificationService.js`
- **Descripción:** `typeKey` se concatenaba directamente en la query SQL de `sendNotificationToAll`.
- > ✅ Resuelto: 2026-04-02 — Query parametrizada con `$1`. Tipo validado contra whitelist.

### PUSH-05 — [RESUELTO] Alerta de seguridad de login usaba tipo SOCIAL

- **Archivo:** `backend/src/services/notificationEventBus.js`
- **Descripción:** `SECURITY_LOGIN_ALERT` no pasaba tipo → default SOCIAL → bloqueble por usuario.
- > ✅ Resuelto: 2026-04-02 — Tipo explícito `'SECURITY'` (nunca bloqueable por preferencias).

### PUSH-06 — [RESUELTO] Contadores de envío inexactos

- **Archivo:** `backend/src/services/notificationService.js`
- **Descripción:** `sendNotificationToUser` contaba intentos, no éxitos reales.
- > ✅ Resuelto: 2026-04-02 — Contadores `successCount`/`failCount` precisos.

### PUSH-07 — [RESUELTO] 5 eventos de gobernanza sin URL de navegación

- **Archivo:** `backend/src/services/notificationEventBus.js`
- **Descripción:** GOV_REQUEST_APPROVED, GOV_REQUEST_EXECUTED, GOV_REQUEST_REJECTED, GOV_GUARDIAN_ONBOARDED, GOV_GUARDIAN_REMOVED sin `data.url`.
- > ✅ Resuelto: 2026-04-02 — Cada evento ahora incluye `data: { url: panelUrl }` apuntando al panel de gobernanza.

---

## Registro de resoluciones

| ID | Fecha | Resolución |
|----|-------|------------|
| I-04 | 2026-03-27 | Resuelto: Select único reemplazado por filter chips (tipo) + sort dropdown (orden) separados. Se eliminó código muerto de `applySortAndFilter`. |
| I-05 | 2026-03-27 | Resuelto: Rama `if (!selected)` eliminada al reescribir `applySortAndFilter` con nueva arquitectura de filtro + orden. |
| C-03 | 2026-03-27 | Resuelto: `userRatingsCache` promovido a variable de módulo (persistente). Se invalida solo al traer publicaciones frescas del servidor. Los re-renderizados por filtro/orden/búsqueda ya no generan peticiones HTTP de ratings. |
| PUSH-01 | 2026-04-02 | Resuelto: Panel admin push reescrito — acepta body/message, envío individual + broadcast, respuesta con success. |
| PUSH-02 | 2026-04-02 | Resuelto: Preferencias: frontend envía { settings: {...} }, controller acepta ambos formatos, service hace merge. |
| PUSH-03 | 2026-04-02 | Resuelto: 9 payloads corregidos de `url` raíz a `data: { url }` + normalizePayload() como safety net. |
| PUSH-04 | 2026-04-02 | Resuelto: SQL injection eliminado con query parametrizada + whitelist de tipos. |
| PUSH-05 | 2026-04-02 | Resuelto: SECURITY_LOGIN_ALERT reclasificado de SOCIAL a SECURITY (no bloqueable). |
| PUSH-06 | 2026-04-02 | Resuelto: Contadores de entrega precisos (éxitos reales, no intentos). |
| PUSH-07 | 2026-04-02 | Resuelto: 5 eventos de gobernanza ahora incluyen data.url para navegación correcta. |
| C-01 | 2026-04-02 | Resuelto: Creada función `startAvailableCountdown()` — corrige ReferenceError en runtime para countdown de fondos pendientes. |
| I-01 | 2026-04-02 | Resuelto: Módulo `sanitize.js` (escapeHtml/escapeAttr OWASP) aplicado en pub.title y pub.author_username. |
| C-02 | 2026-04-02 | Resuelto: Polling inteligente con Page Visibility API — pausa en tab oculto, refresh inmediato al volver, intervalo 10s. |
| AUTH-01 | 2026-04-02 | Resuelto: Bearer token faltante en POST /publish, POST /api/minor/add-tutor, POST /publications/:id/accept (donación), POST /api/quick-sale. Token se lee al momento del fetch (no al cargar página). |
| XSS-02 | 2026-04-02 | Resuelto: publication-detail.js — 7 puntos de inyección XSS sanitizados (pub.title, pub.author_username, p.username, form fields, form responses). |

---

> **Nota final:** Este documento debe actualizarse cada vez que se resuelva un hallazgo. Al confirmar que un issue fue resuelto, mover su entrada a la tabla de resoluciones con la fecha y una breve descripción de cómo se solucionó.
