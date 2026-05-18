# Evolución de WintonCoin

---

# Evolución del proyecto (historia técnica + decisiones)

Este documento explica **cómo y por qué** evolucionó el código (decisiones, trade-offs y impacto).  
Para el detalle “tipo release”, ver `CHANGELOG.md`.

## Cómo leer este documento

- **Hitos**: cambios grandes que alteran comportamiento, seguridad o arquitectura.
- **Evidencia**: commits (hash corto) que anclan cada cambio al historial real.
- **Impacto**: qué problema resolvió y qué habilita hacia adelante.

## Línea de tiempo (hitos)

---

### 2025-07-15 — Donaciones: categoría dedicada (UI + lógica)

- **Contexto**: “donación” es un tipo de publicación distinto (no es venta ni solicitud). Si se trata como genérico, la UX y las reglas se vuelven confusas.
- **Decisión**: crear categoría de donaciones con estilos y lógica específica en frontend, con soporte backend donde aplica.
- **Impacto**: mejor claridad para usuarios al publicar/consumir donaciones.
- **Evidencia (commits)**: `ddf788a`.

---

### 2025-07-18 — Onboarding: bono de bienvenida y estado de impulsor

- **Contexto**: si el usuario recibe un bono inicial pero su “perfil de impulsor” no refleja saldo/estado, la experiencia se siente rota y genera desconfianza.
- **Decisión**: implementar bono de bienvenida y asegurar que el backend actualice el estado/balance asociado al programa de impulsores.
- **Impacto**: onboarding más consistente; el usuario ve beneficios reflejados desde el inicio.
- **Evidencia (commits)**: `bc867c6`.

---

### 2025-07-23 — Pre-launch: donaciones como transferencia (sin minteo) + refactor de pagos

- **Contexto**: en pre-launch, las donaciones deben respetar reglas económicas (no crear tokens BLUE/RED si la fase requiere “balance cero”).
- **Decisión**:
  - Implementar regla de donación pre-launch como **transferencia de saldo** entre perfiles de impulsor (sin mintear).
  - Documentar la regla en `backend/ECONOMIC_RULES.md` y ajustar soporte admin/UX.
  - Refactorizar backend para aislar lógica de negocio en helpers (menos monolítico).
  - Corregir el flujo de pago para que el estado final se actualice correctamente al completar.
- **Impacto**:
  - Coherencia económica: donaciones en pre-launch no rompen el ledger.
  - Código más mantenible y menos propenso a bugs por condicionales gigantes.
- **Evidencia (commits)**: `5f75b00`, `038ce28`, `18d7ef7`, `c20b896`.

---

### 2025-07-24 — Recompensas: bonos de registro “gateados” por pre-launch

- **Contexto**: si los bonos se aplican fuera de la fase esperada, se rompe el control de emisión y la narrativa económica.
- **Decisión**: condicionar (gate) UI/flujo de bonos de registro a que el modo pre-launch esté habilitado.
- **Impacto**: reglas más consistentes según fase.
- **Evidencia (commits)**: `5c51b4e`.

---

### 2025-08-30 — Seguridad/UX: advertencia obligatoria para donaciones

- **Contexto**: donaciones requieren claridad explícita para evitar confusiones (“esto no es una venta”, “no hay reembolso”, etc.).
- **Decisión**: modal de advertencia obligatorio al crear publicaciones de donación.
- **Impacto**: menos malentendidos y menos soporte manual.
- **Evidencia (commits)**: `0e0a3e5`.

---

### 2025-09-11 — Registro: verificación por SMS

- **Contexto**: la verificación de identidad/contacto es clave para reducir fraude y mejorar calidad de cuentas.
- **Decisión**: incorporar verificación por SMS en registro (backend + UI de registro).
- **Impacto**: mayor seguridad y mejor control de cuentas.
- **Evidencia (commits)**: `45f50d6`.

---

### 2025-11-04 — Correcciones de DB por deriva de esquema (documentado por chat)

- **Contexto**: errores críticos en admin y confirmación de pagos por columnas faltantes o valores `NULL` en columnas `NOT NULL`.
- **Decisión**: aplicar estrategia de “auto-repair” con migraciones idempotentes y asegurar que inserciones críticas incluyan `user_id` (obtenido antes de insertar).
- **Impacto**: menos caídas en producción por “schema drift”, y más integridad referencial.
- **Evidencia**:
  - Documento: `docs/RESUMEN_CHAT_2025-11-04.md` (este hito está descrito ahí).
  - Nota: el commit exacto de este chat no está referenciado en el resumen; por eso aquí lo tratamos como “documentado” más que como release con hash.

---

### 2025-11-05 — Refactor DB: `transactions` migra a `user_id`

- **Contexto**: usar `username` como llave en tablas transaccionales crea problemas de integridad, cambios de username, y joins frágiles.
- **Decisión**: migrar `transactions` a `user_id` como clave estable (y ajustar backend/front donde aplica).
- **Impacto**: base de datos más consistente y consultas más seguras.
- **Evidencia (commits)**: `4992766`.

---

### 2025-11-21 — Gobernanza de referidos (expiración configurable)

- **Contexto**: los referidos sin expiración se vuelven difíciles de controlar y auditar (abuso, campañas viejas, inconsistencias).
- **Decisión**: implementar expiración y exponer configuración/admin + ajustes en frontend.
- **Impacto**: control operativo del crecimiento y reducción de fraude.
- **Evidencia (commits)**: `f1d1565`.

---

### 2025-11-22 — Cambio estructural: Event Sourcing + DB inmutable + Token Releaser

- **Contexto**: sistemas de balance/comisiones son sensibles: un bug o update directo puede romper auditoría y confianza.
- **Decisión**:
  - Migrar lógica crítica a **Event Sourcing** (los “eventos” son la fuente de verdad).
  - Endurecer DB con **triggers de bloqueo** y **hashing** para inmutabilidad/auditoría.
  - Desactivar migraciones automáticas al inicio y usar `reset_db.js` como fuente controlada del schema inicial.
- **Impacto**:
  - Mejor trazabilidad (por qué cambió un saldo y cuándo).
  - Menos riesgo de “writes silenciosos” y manipulación.
  - Base más sólida para auditoría legal/financiera.
- **Evidencia (commits)**: `5b067b8`, `ff50201`, `623b568`, `6c19b46`.

---

### 2025-11-23 a 2025-11-27 — Estabilización del schema + endpoints admin + validaciones en registro

- **Contexto**: después de cambios profundos de DB, suelen aparecer desalineaciones entre columnas reales y el código.
- **Decisión**:
  - Sincronizar columnas (`account_status`, `booster_level_settings`, `tutor_user_id`) y scripts de reset/migración.
  - Mejorar calidad de datos y UX con validaciones en tiempo real (email, username, phone).
- **Impacto**:
  - Menos errores por columnas faltantes/renombradas.
  - Menos fricción de registro y menos usuarios “mal formados”.
- **Evidencia (commits)**: `6a132e4`, `b3efff1`, `8fd9e91`, `8079fe9`, `5babf26`, `f8c2f82`, `8ff741e`, `438bb9e`, `9026626`, `3717c29`.

---

### 2025-11-28 a 2025-11-29 — UX y resiliencia del registro

- **Contexto**: registros fallidos (timeouts / refresh / navegación) generan abandono y soporte manual.
- **Decisión**: recuperación robusta con persistencia de estado + validación backend; pulido de mensajes/contraste.
- **Impacto**: mayor tasa de conversión y menor frustración del usuario.
- **Evidencia (commits)**: `b497d59`, `59cd196`.

---

### 2025-12-01 a 2025-12-03 — Marco legal/auditoría (documentos + logs inmutables)

- **Contexto**: para productos con economía interna, la parte legal y su auditoría tiene que ser reproducible y verificable.
- **Decisión**:
  - Poblar documentos legales en DB.
  - Implementar auditoría legal inmutable y carga dinámica de documentos.
  - Asegurar triggers y lógica server para evitar alteraciones indebidas.
- **Impacto**: “compliance” más serio, mejor defensa ante disputas y cambios controlados.
- **Evidencia (commits)**: `97bbe34`, `93365d2`, `a819aa6`, `3ce3d3e`.

---

### 2025-12-04 a 2025-12-05 — Controles operativos + mejoras de login/registro

- **Contexto**: se necesitaba control admin sobre features sensibles (p. ej. “Venta Rápida”) y mejorar UX básica.
- **Decisión**:
  - Switch admin para controlar “Venta Rápida” y proteger el endpoint.
  - Toggle de visibilidad de contraseña y limpieza de scripts inline redundantes.
  - Ajustes de texto/checkboxes en términos.
- **Impacto**: operación más segura y UX más amigable sin tocar arquitectura.
- **Evidencia (commits)**: `1159951`, `62ca67c`, `fc81164`, `b5c78ca`, `a0e111e`.

---

### 2025-12-11 — Reglas económicas más claras (Pre/Post-Launch)

- **Contexto**: reglas económicas confusas generan bugs, disputas y mal uso.
- **Decisión**: documentar/ordenar reglas por fases; definir BLUE IOU y comisiones con más precisión.
- **Impacto**: base de negocio más fácil de implementar, testear y explicar.
- **Evidencia (commits)**: `a64ac44`.

---

### 2025-12-29 — App Android inicial

- **Contexto**: expansión de plataforma: cliente móvil con auth segura y flujo de publicación.
- **Decisión**: app Android inicial con arquitectura básica (auth, dashboard, publicación) y utilidades como biometría.
- **Impacto**: habilita pruebas móviles tempranas y validación del backend desde otro cliente.
- **Evidencia (commits)**: `c3effb0`.

---

### 2026-01-05 — Semana de seguridad/operación (hardening + auditoría + repetición de tareas + fixes de prod)

- **Contexto**: al acercarse a producción, aparecen 3 frentes críticos: **seguridad**, **consistencia**, **deploy**.
- **Decisión**:
  - Hardening de seguridad (cookies HttpOnly admin, validación, sanitización).
  - Reglas estrictas de repetición de tareas (con lock de concurrencia y hard reject).
  - `audit_log` con IP + UA y retención larga, instrumentado en endpoints críticos.
  - Ajustes de producción (CORS, `trust proxy`, `cookie-parser`).
- **Impacto**:
  - Reduce superficie XSS y riesgos de auth.
  - Menos duplicidades/fraude por repetición.
  - Mejor forense/observabilidad ante incidentes.
- **Evidencia (commits)**: `89e2c9f`, `364a2d1`, `1156f02`, `880ff29`, `e421552`, `3645551`, `c7022bc`.

---

### 2026-01-06 — Publicaciones auditables y mejor admin (soft delete + filtros + restore)

- **Contexto**: borrar físicamente registros rompe auditoría y puede romper relaciones (FK).
- **Decisión**: soft delete (`deleted_at`) y herramientas de admin para filtrar/restore.
- **Impacto**: auditoría preservada y operaciones admin más seguras.
- **Evidencia (commits)**: `9c2cc76`, `1ce9312`.

---

### 2026-01-10 — Pulido final de UX y consistencia de flags

- **Contexto**: detalles “técnicos” visibles al usuario (jerga interna) y toggles de configuración que, si se cambian con el schema incompleto, pueden romper pagos.
- **Decisión**:
  - **Historial booster**: ocultar “Backfill” y normalizar el texto a una versión profesional (“Ajuste de saldo histórico…”).
  - **Booster profile**: cuando el usuario ve su propio perfil (token presente), usar endpoint autenticado (`/api/me/booster-profile`) y dejar endpoint público por `username` para perfiles ajenos.
  - **Registro**: cuando hay sesión/token y el usuario está “pendiente de verificación”, mostrar un bloque de estado con acciones (continuar verificación / ir al perfil / cerrar sesión) para evitar sensación de bloqueo.
  - **Admin pre-launch**: implementar guard **fail-closed**: si un admin intenta desactivar pre-launch y faltan columnas críticas, el backend devuelve `409` con mensaje claro.
- **Impacto**:
  - UX más profesional (sin jerga interna).
  - Menos errores por “schema drift” al tocar toggles críticos.
  - Onboarding más claro cuando existe sesión pendiente.
- **Evidencia (commits)**: `b89f852`, `7bf35d2`.
- **Nota operativa (importante)**: para desactivar pre-launch de forma segura, la DB debe tener columnas requeridas (según el resumen del chat): `red_token_debts.user_id` y `blue_token_escrows.user_id`.

---

### 2026-01-12 — Encabezado principal: alineación y jerarquía visual

- **Contexto**: el enlace “¿Cómo funciona?” debía verse más discreto y alineado con el título principal para mejorar la lectura.
- **Decisión**: colocar el enlace junto a “WintonCoin”, reducir tamaño (~30%), usar cursiva y color secundario.
- **Impacto**: encabezado más compacto y profesional; menor ruido visual.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Encabezado en móvil: más aire superior

- **Contexto**: en móviles el encabezado quedaba muy pegado arriba y se veía apretado.
- **Decisión**: aumentar el padding superior del contenedor del panel y el margen del título en móvil.
- **Impacto**: mejora la legibilidad y evita sensación de elementos “apretados” en pantalla pequeña.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Menú de usuario: estilo compacto sin fondo

- **Contexto**: el fondo del nombre de usuario ocupaba espacio y chocaba con “¿Cómo funciona?” en móvil.
- **Decisión**: quitar fondo y borde del trigger, con padding mínimo y hover sutil.
- **Impacto**: más aire en el encabezado y mejor jerarquía visual.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Contador de publicaciones disponibles

- **Contexto**: el usuario necesita ver cuántas publicaciones puede aceptar en ese momento.
- **Decisión**: mostrar un contador junto a “Publicaciones Activas” basado en cupos, estado y repetición permitida.
- **Impacto**: claridad inmediata sobre oportunidades disponibles para cada usuario.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Contador discreto en el título

- **Contexto**: el contador debía verse más sutil en móvil.
- **Decisión**: moverlo entre paréntesis, sin fondo, usando color secundario.
- **Impacto**: mejor legibilidad sin robar protagonismo al título.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Contador en el título sin paréntesis

- **Contexto**: el contador debía verse aún más limpio.
- **Decisión**: mostrar el número sin paréntesis, con color secundario discreto.
- **Impacto**: título más minimalista y legible.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Contador: refleja lo visible en lista

- **Contexto**: el contador mostraba “0” aunque había publicaciones visibles.
- **Decisión**: contar el listado filtrado/renderizado en pantalla.
- **Impacto**: número coherente con lo que ve el usuario.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Repetición por usuario con límite auditable

- **Contexto**: se requiere definir cuántas veces puede repetir una misma tarea cada usuario.
- **Decisión**: agregar `max_repeat_per_user` en `publications`, con input en admin y en publicación normal, validado en backend.
- **Impacto**: control fino, auditable y coherente con reglas fintech.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Mini tarjeta de Impulsor en pantalla principal

- **Contexto**: el usuario necesita ver su estado de Impulsor sin salir del panel.
- **Decisión**: mostrar un widget compacto con nivel, total BLUE iou, progreso y acceso al perfil.
- **Impacto**: más claridad y motivación sin saturar la UI.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Banner horizontal de Impulsor (comparativa UI)

- **Contexto**: comparar una opción más visible tipo banner.
- **Decisión**: reemplazar la tarjeta por un banner con ícono, métricas y barra de progreso.
- **Impacto**: mayor presencia visual sin perder jerarquía.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Título junto al ícono (Impulsor)

- **Contexto**: se necesitaba compactar el encabezado del banner.
- **Decisión**: poner la estrella al lado del título y quitar el fondo del ícono.
- **Impacto**: encabezado más limpio y alineado.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Banner de Impulsor sin barra de progreso

- **Contexto**: se solicitó una vista más limpia del banner.
- **Decisión**: eliminar la barra de progreso del widget.
- **Impacto**: visual más simple y menos ruido.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Tipografía del banner de Impulsor

- **Contexto**: el título debía igualar el tamaño de SALDO BLUE/RED y el monto BLUE iou debía destacarse.
- **Decisión**: aplicar mayúsculas al título y aumentar tamaño + cursiva del monto BLUE iou.
- **Impacto**: mayor coherencia visual con los saldos.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Banner de Impulsor sin nivel

- **Contexto**: se pidió una vista más simple sin el nivel.
- **Decisión**: eliminar el badge de nivel del banner.
- **Impacto**: layout más limpio y directo.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Formato del monto BLUE iou en impulsor

- **Contexto**: se pidió separar miles y reducir tamaño de decimales.
- **Decisión**: reutilizar el formateo con separadores y `decimal-part`.
- **Impacto**: mejor legibilidad del monto en el banner.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Destacar monto BLUE iou en impulsor

- **Contexto**: el monto debía verse más grande y con más color.
- **Decisión**: separar valor/unidad con estilos y aumentar tamaño del valor.
- **Impacto**: mayor énfasis visual sin afectar el resto del banner.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Banner de valor sobre referidos

- **Contexto**: se pidió mostrar el texto de valor antes del bloque de referidos.
- **Decisión**: mover el banner arriba del botón “Comparte tu código” y fijar el texto solicitado.
- **Impacto**: jerarquía más clara del mensaje de valor.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Banner de Impulsor sin tareas y centrado

- **Contexto**: se pidió remover “tareas” y alinear mejor el bloque.
- **Decisión**: eliminar el texto de tareas y centrar el espaciado del meta.
- **Impacto**: banner más limpio y equilibrado.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Tarjeta de Impulsor como enlace

- **Contexto**: se pidió quitar “Ver perfil” y usar la tarjeta completa como acceso.
- **Decisión**: convertir el banner en enlace a `booster-profile.html`.
- **Impacto**: interacción más directa y limpia.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Título de Impulsor centrado

- **Contexto**: se pidió centrar el texto “Perfil de Impulsor”.
- **Decisión**: centrar el encabezado del banner.
- **Impacto**: mejor alineación visual.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Ícono de Impulsor simétrico

- **Contexto**: se pidió simetría visual en el título.
- **Decisión**: colocar una estrella a cada lado del texto.
- **Impacto**: banner más equilibrado.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Espaciado uniforme en el panel

- **Contexto**: se pidió un margen mínimo y consistente entre elementos.
- **Decisión**: unificar márgenes de banner impulsor, valor, referidos y botones.
- **Impacto**: layout más limpio y homogéneo.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Monto BLUE iou con mayor tamaño

- **Contexto**: el monto debía verse al doble de tamaño.
- **Decisión**: aumentar el tamaño del valor principal en el banner.
- **Impacto**: mayor énfasis visual del monto BLUE iou.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Separador de miles en BLUE iou

- **Contexto**: el monto debía mostrarse como `1.640,0000`.
- **Decisión**: formatear el valor del banner con separador de miles fijo.
- **Impacto**: formato numérico consistente y más legible.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Tamaño de “BLUE iou” igual al título

- **Contexto**: se pidió que el texto “BLUE iou” igualara el tamaño de “Perfil de Impulsor”.
- **Decisión**: aumentar el tamaño de la unidad en el banner.
- **Impacto**: coherencia tipográfica en el banner.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Protocolo de release documentado

- **Contexto**: se necesitaba una guía persistente de versionado y despliegue.
- **Decisión**: crear `docs/RELEASE_PROTOCOL.md` con flujo SemVer + checklist.
- **Impacto**: releases consistentes y auditables en futuros cambios.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Archivo VERSION para releases

- **Contexto**: se necesitaba un punto único y auditable de la versión.
- **Decisión**: agregar el archivo `VERSION` y referenciarlo en el protocolo.
- **Impacto**: claridad de versión en cada release.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Versionado manual de assets (v1.4.0)

- **Contexto**: el cache del navegador podía mantener estilos/scripts viejos tras un deploy.
- **Decisión**: renombrar assets estáticos a `style.v1.4.0.css`, `utils.v1.4.0.js` y `interaction.v1.4.0.js` y actualizar referencias en HTML.
- **Impacto**: control explícito de cache y actualizaciones inmediatas tras release.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-12 — Versionado estricto (solo assets con versión)

- **Contexto**: mantener archivos “originales” sin versión genera ambigüedad sobre cuál es el asset oficial del release.
- **Decisión**: conservar únicamente archivos versionados (`*.vX.Y.Z.*`) y eliminar los duplicados sin versión.
- **Impacto**: single source of truth en releases, caché más predecible y menos riesgo de cargar assets obsoletos.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-13 — Registro: verificación por correo (OTP) con AWS SES (estándar fintech)

- **Contexto**:
  - La verificación por SMS (Twilio) es útil, pero para onboarding fintech moderno normalmente se prioriza **verificación por email** (y se deja el teléfono como verificación adicional más adelante).
  - Guardar el código OTP en texto plano es un riesgo (exposición por logs/backups/DB leaks).
  - En producción real, también se necesita control anti-abuso: rate limiting, límite de intentos y reenvíos.
- **Decisión**:
  - Migrar el registro a **OTP de 6 dígitos por email**, enviándolo con **AWS SES**.
  - Cambiar el almacenamiento del OTP en DB a **hash HMAC** (no texto plano) y validar con comparación en tiempo constante.
  - Implementar controles anti-fraude:
    - expiración del OTP (10 min)
    - límite de intentos (ej. 5) con invalidación
    - límite de reenvíos + cooldown server-side
    - rate limiting por IP en endpoints de request/verify/resend
  - Mejorar el correo transaccional con diseño tipo “bank/fintech” (preheader, código destacado, aviso anti-phishing y soporte).
  - Añadir “auto-migración” de columnas para compatibilidad cuando una BD ya existente no tiene las nuevas columnas de `pending_verifications` (porque `CREATE TABLE IF NOT EXISTS` no altera tablas existentes).
- **Impacto**:
  - Onboarding más alineado a fintech: verificación por email como primera capa y teléfono como futura segunda capa.
  - Seguridad mejorada: OTP no se almacena en claro y hay mitigaciones de fuerza bruta/reintentos.
  - Operación: guía de configuración de SES (DNS DKIM/SPF/DMARC, MAIL FROM, sandbox → producción) y posibilidad de personalizar branding (logo/color) vía variables de entorno.
- **Evidencia**:
  - Commit de implementación inicial: `c3a9e56`.
  - Documento: `docs/AWS_SES_SETUP.md`.
  - Nota UX: ajuste de cabecera del correo para mostrar el logo de forma más visible (tamaño mayor) sin depender del cliente de correo.

---

### 2026-01-13 — UI móvil: instrucciones de publicación legibles

- **Contexto**: en móvil, la descripción larga de algunas tareas se veía centrada y el enlace de WhatsApp podía “perderse” por el largo del URL.
- **Decisión**:
  - Alinear la descripción a la izquierda y mejorar el wrap de enlaces largos.
  - Normalizar la indentación común de textos multilínea antes de renderizar, para evitar “desplazamientos” en la primera línea.
- **Impacto**:
  - Lectura más clara en pantallas pequeñas.
  - Enlaces largos visibles y clicables sin romper el layout.
- **Evidencia (commits)**: `31de990`.

---

### 2026-01-13 — Página “Cómo funciona” (guía de uso)

- **Contexto**: se necesitaba una explicación breve, profesional y accesible dentro de la app, que oriente a usuarios nuevos sin saturar la UI principal.
- **Decisión**:
  - Agregar una página “Cómo funciona” con flujo básico, tips de uso y seguridad.
  - Incluirla en el menú desplegable del panel principal para acceso rápido.
  - Ajustar el texto para aclarar el uso de tooltips sin depender de subrayados.
  - Mejorar legibilidad del subtítulo para evitar solapamientos visuales.
  - Añadir iconos en las tarjetas del panel y simplificar el título principal.
  - Incluir requisito de asociar Metamask en Optimism dentro de la sección de seguridad.
  - Convertir los puntos de cada sección en tarjetas para mejorar lectura.
  - Ajustar el texto del menú a “¿Cómo funciona?” para mayor claridad.
  - Reemplazar “Flujo básico” por timeline con dos perfiles de usuario.
  - Ajustar el flujo a tarjetas con número para un UX más claro.
  - Corregir conteo de tareas del perfil de impulsor para alinear con el historial.
  - Añadir icono de WhatsApp en el enlace de reporte de seguridad.
  - Agregar tooltip en la banda de “Pre-lanzamiento”.
  - Ajustar el tooltip de “Pre-lanzamiento” para que no se salga de pantalla.
  - Permitir overflow visible en el panel principal para el tooltip de “Pre-lanzamiento”.
  - Simplificar el título de “Tips” en la guía de uso.
  - Añadir flechas entre pasos del flujo para enfatizar secuencia.
  - Simplificar el flujo “Si publicas” y ajustar el paso de confirmación.
  - Ajustar el texto de aprobación en el flujo de participantes.
  - Mostrar “BLUE iou” en publicaciones de la plataforma durante pre-lanzamiento.
  - Mover “Prototipo Alfa” al badge de pre‑lanzamiento.
  - Quitar “Prototipo Alfa” del encabezado para evitar duplicación.
  - Agregar selector simple de orden y filtro por tipo en publicaciones.
  - Ajustar el selector de orden para que el label quede arriba y más compacto.
  - Reemplazar el label por placeholder “Ordenar por” dentro del dropdown.
  - Añadir un icono sutil de filtro dentro del selector.
  - Alinear el enlace “← Volver” a la izquierda en todas las vistas.
  - Actualizar la página LOVE con back-link y diseño responsive móvil.
  - Ajustar LOVE: título en rojo y tabla sin desbordes.
  - Cambiar el texto del banner de referidos a “BLUE iou”.
  - Añadir badges de pendientes y metadatos en publicaciones del admin.
  - Mostrar badge de pendientes sin entrar a la sección (auto‑refresh).
  - Mostrar si la publicación permite repetición por el mismo usuario.
  - Priorizar pendientes y agregar filtro “En proceso” en la lista principal.
  - Mover “En proceso” al primer lugar del selector de orden.
  - Añadir módulo P2P BLUE (ofertas, órdenes, escrow y disputas).
  - Ajustar pantalla P2P para evitar cortes de contenido en modal.
  - Mostrar “Mis anuncios” y corregir el listado por tipo (buy/sell).
  - Añadir migraciones 008/009/010 para user_id en deudas, escrows y transactions.
  - Endurecer confirmación de pago en solicitudes usando acceptor de DB.
  - Añadir migración 011 para eliminar transactions.username tras migrar a user_id.
  - Añadir panel de auditoria en admin con filtros y tabla.
  - Agregar guard para impedir RED asignado al trabajador en solicitudes.
  - Exportar auditoria a CSV desde el panel admin.
  - Mostrar direccion de pago BLUE/RED en historial de solicitudes.
  - Usar user_id en asignacion de deuda RED para solicitudes (evitar errores).
  - En solicitudes, deuda RED se asigna al autor (sin tutor) por regla economica.
  - Sincronizar tipo de anuncio P2P con la pestaña activa (Comprar/Vender).
  - Simplificar modal P2P: tipo fijo segun pestaña con explicacion.
  - Mover "Mis ordenes" al inicio de la pantalla P2P.
  - Usar record_balance_event en P2P para evitar updates directos.
  - Registrar auditoria detallada en movimientos de escrow P2P.
  - Añadir acciones P2P en ordenes (pagar, liberar, cancelar).
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
  - Añadir instrucciones paso a paso en solicitudes con flujo visual.
  - Mostrar instrucciones paso a paso como bloque fijo en formulario.
  - Ajustar bloque de pasos (sin contenedor visible y max 20).
  - Agregar pasos a publicaciones de plataforma en panel admin.
  - Permitir editar publicaciones de plataforma desde admin.
  - Asegurar carga de datos al editar publicaciones.
  - Añadir migración 012 para publications.updated_at.
  - Ajustar textos en "Cómo funciona" y verificación OTP.
  - Añadir título "Publicaciones Activas" en el panel principal.
- **Impacto**:
  - Menor fricción de onboarding.
  - Mejor comprensión de saldos, publicaciones y seguridad.
  - Navegación más limpia en las pantallas internas.
- **Evidencia**: commits de la mejora UI (pendiente de push).

---

### 2026-01-19 — Gamificación en perfil de Impulsor

- **Contexto**: se buscaba motivar tareas con ranking y metas diarias.
- **Decisión**: agregar ranking (#posición y top %) y meta diaria comparando hoy vs ayer, con confeti y brillo cuando hay mejora.
- **Impacto**: refuerzo positivo y mayor incentivo a mantener actividad diaria.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-20 — Repetición con cooldown + versionado v1.5.0

- **Contexto**: era necesario controlar cuánto tiempo debe pasar antes de repetir una tarea y estandarizar el release.
- **Decisión**:
  - agregar cooldown configurable (días/horas/minutos) en UI y validación en backend.
  - migración 014 para `repeat_cooldown_hours`.
  - versionar assets a `v1.5.0` y actualizar referencias HTML.
  - automatizar inventario UI con script y hook pre-commit.
  - permitir IPs LAN en CORS dev para pruebas desde teléfono.
- **Impacto**: reglas de repetición claras, releases consistentes y pruebas móviles más rápidas.
- **Evidencia**: commit pendiente de push.

---

### 2026-01-21 — PWA: Progressive Web App instalable en móviles

- **Contexto**: los usuarios necesitaban una forma de acceder a la app desde la pantalla de inicio de su móvil sin pasar por Play Store, con experiencia similar a una app nativa.
- **Decisión**:
  - Implementar **PWA completa** con `manifest.json`, Service Worker y botón de instalación.
  - Generar **iconos en todos los tamaños** requeridos (72px a 512px) incluyendo maskable para Android.
  - Estrategia de cache: **Network First** para HTML, **Cache First** para assets estáticos, **Network Only** para APIs.
  - Preparar estructura para **Push Notifications** (Firebase pendiente).
  - Botón de instalación verde centrado ("Instalar App") visible en login/dashboard/registro.
- **Archivos creados**:
  - `frontend/manifest.json` — metadata de la PWA
  - `frontend/sw.js` — Service Worker con estrategias de cache
  - `frontend/pwa-register.js` — registro SW + UI de instalación
  - `frontend/assets/icons/` — 14 iconos PNG + SVG fuente + scripts de generación
- **Impacto**:
  - La app puede instalarse en móviles desde el navegador.
  - Funciona offline (páginas cacheadas).
  - Se ve y comporta como app nativa (sin barra de navegador).
  - Base lista para notificaciones push.
- **Evidencia (commits)**: `20a10f3`.

---

### 2026-01-22 — Migración frontend a Vite con ES Modules

- **Contexto**: el frontend usaba scripts inline y globales, lo cual dificultaba el mantenimiento, testing y optimización. Se necesitaba una arquitectura moderna.
- **Decisión**:
  - **Migrar a Vite** como bundler: build rápido, HMR, y soporte nativo de ES Modules.
  - **Separar scripts por página** en `frontend/src/pages/`: cada HTML carga solo su módulo.
  - **Módulos compartidos** en `frontend/src/modules/`: `config.js`, `alerts.js`, `password-toggle.js`, `pwa-install.js`.
  - **Mantener compatibilidad** con scripts versionados existentes (`*.v1.5.0.js`).
  - **Mover manifest.json** a `frontend/public/` para que Vite lo copie al build.
- **Archivos migrados**:
  - 17 páginas HTML actualizadas con imports de ES Modules
  - 13 nuevos scripts en `src/pages/`
  - Estilos separados: `admin-style.css`, `booster-style.css`
  - Configuración: `vite.config.js`
- **Impacto**:
  - Código más modular y mantenible.
  - Build optimizado con tree-shaking.
  - Hot Module Replacement para desarrollo más rápido.
  - Base lista para testing y futuras mejoras.
- **Evidencia (commits)**: `d404ef1`.

---

### 2026-01-22 — PWA: flujo de instalación con código de referido y admin panel restaurado

- **Contexto**: cuando un usuario llegaba por enlace de referido, instalaba la PWA y la abría, perdía el código de referido y quedaba en la pantalla de login en vez de registro. Además, el admin panel había perdido funcionalidades durante la migración a ES Modules.
- **Decisión**:
  - **Botón de instalación grande** en página de registro: más visible (3x más alto) con mensaje claro "Primero debes instalar la app".
  - **Persistencia del código de referido** en `localStorage` para que sobreviva la instalación de la PWA.
  - **Redirección inteligente**: al abrir la PWA, si hay código de referido pendiente y no hay sesión, redirige a registro SOLO la primera vez (usa `sessionStorage`). Después el usuario puede navegar libremente.
  - **Restauración del admin panel**: recuperar las 2000+ líneas de funcionalidad que se habían perdido en la migración.
  - **Iconos PWA con fondo blanco**: evitar bordes negros en Android con iconos maskable.
  - **Herramienta generate-maskable.html**: permite generar iconos con color de fondo personalizado.
- **Impacto**:
  - Flujo de referidos sin fricción: el código se mantiene desde el navegador hasta la PWA instalada.
  - UX profesional tipo fintech: redirección controlada sin bloquear navegación.
  - Admin panel 100% funcional con todas las secciones restauradas.
  - Iconos sin bordes negros en Android.
- **Evidencia (commits)**: `4a6a439`.

---

### 2026-01-23 — Validación de username: estándar de industria

- **Contexto**: el campo de nombre de usuario no tenía validaciones completas, permitiendo caracteres especiales, espacios y longitudes arbitrarias.
- **Decisión**:
  - Implementar validación completa: **3-30 caracteres**, solo **letras, números y guiones bajos** (`a-zA-Z0-9_`).
  - Validación en **frontend** (UX) y **backend** (seguridad crítica).
  - Verificación **case-insensitive** para evitar duplicados (`User` = `user`).
  - Mensaje descriptivo en el formulario explicando los requisitos.
  - Cambiar etiquetas del formulario de registro para mayor claridad.
- **Impacto**:
  - Prevención de XSS e inyección SQL.
  - Evita suplantación de identidad por mayúsculas/minúsculas.
  - UX clara con requisitos visibles.
- **Evidencia (commits)**: `pending`.

---

### 2026-01-23 — UX: icono de menú hamburguesa + soporte LAN para desarrollo

- **Contexto**: el icono de flecha (▼) junto al nombre de usuario no era suficientemente visible en móvil, y el desarrollo desde dispositivos móviles en la red local no funcionaba.
- **Decisión**:
  - Reemplazar el icono de flecha por un **icono de hamburguesa** (☰) de 30px.
  - Aumentar el icono de campana de notificaciones a 26px para mantener simetría.
  - Ajustar posiciones verticales de ambos iconos para evitar solapamientos.
  - Corregir `config.js` para detectar IPs privadas y conectar al backend en puerto 3000.
- **Impacto**:
  - Menú más visible y accesible en móvil.
  - Desarrollo local desde teléfono funcional (conectando a la IP de la PC).
- **Evidencia (commits)**: `ed187c7`.

---

### 2026-01-23 — Seguridad: validación de username + manejo de sesión expirada

- **Contexto**: el campo de nombre de usuario no tenía validaciones completas, permitiendo caracteres especiales, espacios y longitudes arbitrarias. Además, cuando el token JWT expiraba, el usuario veía un error técnico sin orientación.
- **Decisión**:
  - **Validación de username**: 3-30 caracteres, solo alfanuméricos y guiones bajos, verificación case-insensitive (`User` = `user` = duplicado).
  - **Helper `handleSessionExpired()`**: función reutilizable en `auth.js` que detecta respuestas 401, limpia la sesión y redirige al login con mensaje amigable.
  - **Aplicar helper en todas las páginas protegidas**: dashboard, P2P, historial P2P, perfil de impulsor (13 puntos de manejo).
  - **Cambio de icono**: reemplazar flecha dropdown por icono de hamburguesa (☰) junto al nombre de usuario.
- **Impacto**:
  - Prevención de XSS e inyección SQL por usernames malformados.
  - UX profesional cuando expira la sesión (no más errores técnicos).
  - Código DRY: el manejo de 401 está centralizado en un solo helper.
- **Evidencia (commits)**: `30682bf`, `e30bd35`, `cec14a8`.

---

### 2026-01-23 — Dashboard: restauración de funcionalidad perdida + fix CSS banner

- **Contexto**: durante refactorizaciones anteriores, se perdieron varias funcionalidades del dashboard de publicaciones: ordenamiento por prioridad de tareas en proceso, información de expiración, rating del autor, y el texto del banner de estado "pendiente" era invisible (CSS sobrescribía el color del texto al mismo color del fondo).
- **Decisión**:
  - **Restaurar ordenamiento por prioridad**: funciones `sortByPendingPriority()`, `isPendingForUser()`, `getPendingPriority()` para mostrar primero las tareas donde el usuario tiene participación activa (approved > pending > completed > otros).
  - **Restaurar información de expiración**: función `getExpirationStatusHTML()` que muestra tiempo restante ("Vence en 2 días", "Vence en 3 horas", etc.) con indicador visual de publicaciones expiradas.
  - **Restaurar rating del autor**: funciones `generateStarRating()` y `fetchUserRating()` para mostrar calificación del autor en cada tarjeta.
  - **Restaurar enlace al perfil**: el nombre del autor ahora es clickeable si los perfiles públicos están habilitados.
  - **Fix CSS crítico**: el selector `.publication-item .status-pending` sobrescribía el color del texto a naranja (`#f39c12`), mismo color que el fondo del banner, haciendo el mensaje invisible. Corregido con `:not(.publication-status-banner)`.
- **Impacto**:
  - UX mejorada: las tareas en proceso aparecen primero, facilitando el seguimiento.
  - Información completa: usuarios ven expiración, ratings y pueden navegar a perfiles.
  - Bug visual corregido: el banner "Solicitud enviada. Esperando aprobación." ahora es visible.
- **Evidencia (commits)**: `7b02f1a`.

---

### 2026-01-23 — UX: badge de acción para autores + ordenamiento inteligente

- **Contexto**: cuando un usuario publicaba una tarea y otros la aceptaban, el autor no tenía indicación visual de que había acciones pendientes (aprobar solicitudes o confirmar pagos). Esto causaba que las solicitudes quedaran sin atender.
- **Decisión**:
  - **Badge naranja para el autor**: cuando hay participantes esperando aprobación o pago, se muestra un banner naranja con el conteo ("2 por aprobar · 1 por pagar").
  - **Ordenamiento por prioridad**: las publicaciones del autor con acciones pendientes aparecen primero (prioridad 0-1), seguidas de las tareas donde el usuario participa (prioridad 2-4).
  - **Diferenciación de colores**: amarillo brillante (`#FFE600`) para participante esperando, naranja (`#e67e22`) para autor con acciones pendientes.
- **Impacto**:
  - Autores ven inmediatamente qué publicaciones requieren su atención.
  - Menos fricción: no hay que buscar manualmente qué aprobar o pagar.
  - UX más clara con colores distintivos para cada rol.
- **Evidencia (commits)**: `819899b`.

---

### 2026-01-24 — Fecha de aceptación en participantes + mejoras UX botón referidos

- **Contexto**: El autor no podía ver cuándo un usuario había solicitado participar en su publicación. Además, el botón de referidos necesitaba mejor copy y efectos visuales.
- **Decisión**:
  - **Backend**: Agregado campo `accepted_at` a todos los endpoints que devuelven participantes. Ordenamiento cronológico (quien pidió primero, aparece primero).
  - **Seguridad**: Removido `phone_number` de endpoints públicos. Solo se muestra cuando el participante está aprobado (para contacto vía WhatsApp).
  - **Admin Panel + Publication Detail**: Muestran "Solicitó: fecha/hora" debajo de cada participante.
  - **Botón de referidos**: Nuevo copy persuasivo, icono de compartir SVG con efecto pulse+glow mejorado.
- **Impacto**:
  - Autores pueden ver el orden cronológico de solicitudes.
  - Mejor privacidad de datos de usuarios.
  - UX mejorada en botón de referidos.
- **Evidencia (commits)**: `b46547b`.

---

### 2026-01-24 — UX: tooltips en Perfil de Impulsor + tabla responsive

- **Contexto**: El perfil de impulsor mostraba métricas (nivel, ranking, meta diaria, etc.) sin explicación de qué significaba cada una. Usuarios nuevos no entendían el sistema de niveles ni cómo subir.
- **Decisión**:
  - **7 tooltips informativos**: Nivel (descripción dinámica desde backend), Total BLUE iou, Meta diaria, Ranking, Tareas completadas, Progreso al siguiente nivel, Historial.
  - **Tooltip de progreso con FOMO**: muestra cuántos BLUE iou faltan + frase motivadora ("¡No te quedes atrás, otros impulsores ya están subiendo!").
  - **Descripciones dinámicas**: el tooltip del nivel actual usa `levelInfo.description` del backend (editable desde admin).
  - **Tabla de historial responsive**: ajustes CSS para móviles (`table-layout: fixed`, anchos de columna proporcionales, font-size reducido).
- **Impacto**:
  - Onboarding mejorado: usuarios entienden cada métrica al primer clic.
  - Gamificación: el FOMO en el progreso incentiva completar más tareas.
  - UX móvil: la tabla de historial se lee correctamente en pantallas pequeñas.
- **Evidencia (commits)**: `3d5db92`.

---

### 2026-01-24 — Auditoría de migraciones + referidos con acumulado visible

- **Contexto**:
  - Se necesitaba que las migraciones quedaran **auditables** y ejecutables de forma manual con evidencia persistente.
  - La lista de referidos no mostraba el acumulado de cada usuario, y en móvil la tabla quedaba apretada.
- **Decisión**:
  - **Migraciones manuales auditables**: crear `schema_migrations` y registrar `applied_at`, `applied_by`, `environment`, `checksum` desde cada script.
  - **Scripts manuales**: convertir 014/015/016/017 a ejecución `node` con transacciones y `IF NOT EXISTS`.
  - **Eliminar helper automático**: retirar `run-migrations.js` para evitar ejecución no controlada.
  - **Referidos**: exponer `total_booster_blue` por referido y mostrarlo en la tabla; reducir tipografía en móvil.
  - **Formularios**: guardar `form_responses_submitted_at` y registrar evento `publication.form_responses_submitted` en `audit_log`.
- **Impacto**:
  - Migraciones con trazabilidad en BD y logs operativos (estándar fintech).
  - Lista de referidos más informativa; UI móvil legible.
  - Envíos de formulario con timestamp y auditoría.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-01-24 — Referidos: orden por acumulado + fecha corta

- **Contexto**: en móvil la tabla de referidos necesitaba ordenarse por relevancia económica y usar fecha compacta.
- **Decisión**:
  - Ordenar la lista por **BLUE iou acumulado** (descendente).
  - Mostrar fecha en formato corto `dd/mm/yy`.
- **Impacto**: la tabla prioriza referidos con mayor aporte y se ve mejor en pantallas pequeñas.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-01-24 — Impulsor: Ranking Mundial + ranking entre amigos

- **Contexto**: se quería distinguir el ranking global del ranking dentro de tu red de referidos.
- **Decisión**:
  - Renombrar el bloque a **Ranking Mundial**.
  - Añadir **Ranking entre amigos** con tooltip explicativo.
  - Calcular ranking entre el usuario y sus referidos (por BLUE iou acumulado).
- **Impacto**: gamificación más clara; el usuario compara su progreso global vs su círculo.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-01-24 — Publicación: botón compartir con icono oficial + CTA duplicado

- **Contexto**: se quería mantener consistencia visual del icono de compartir y facilitar la acción final en móvil.
- **Decisión**:
  - Reemplazar el icono de compartir por el de 3 nodos (mismo que pantalla principal).
  - Mover compartir arriba y duplicar “Marcar como Culminada” abajo para alcance rápido.
  - Ajustar inputs de formulario a fondo blanco para mejor UX de escritura.
- **Impacto**: UI más intuitiva y consistente; acción final más accesible en móvil.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-01-24 — Publicación: CTA verde + compartir compacto

- **Contexto**: se pidió enfatizar la acción de culminar y hacer el compartir más ligero visualmente.
- **Decisión**:
  - Renombrar el CTA a **“He culminado”** y ponerlo en verde.
  - Convertir el compartir en **icono + texto** (sin botón sólido), manteniendo la acción.
- **Impacto**: jerarquía visual más clara; compartir más discreto y rápido de identificar.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-01-24 — Admin: buscador + orden en publicaciones plataforma

- **Contexto**: se necesitaba encontrar y priorizar publicaciones de plataforma rápidamente en admin.
- **Decisión**:
  - Agregar buscador por título/descripcion/autor/ID.
  - Añadir selector de orden (pendientes, fecha, recompensa, participantes, aprobaciones/pagos).
  - Ajustar layout para mantener consistencia visual.
  - Default de repetición: **12 minutos** al habilitar la opción.
- **Impacto**: gestión más rápida y menos fricción operativa en panel admin.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-01-24 — Repetición: cooldown en minutos (12 min default)

- **Contexto**: el sistema seguía bloqueando por 24 horas aunque el UI mostraba 12 minutos.
- **Decisión**:
  - Permitir precisión en `repeat_cooldown_hours` (NUMERIC).
  - Calcular cooldown desde días/horas/minutos y default de 12 minutos cuando se habilita.
  - Mensajes de espera en minutos cuando aplica.
- **Impacto**: el bloqueo respeta minutos reales y coincide con la configuración del admin.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-01-25 — Recibos por correo y correo oficial de plataforma

- **Contexto**:
  - Faltaba notificación transaccional por email en pagos/completaciones.
  - El usuario “Plataforma” podía quedar con email aleatorio en instalaciones previas.
- **Decisión**:
  - Enviar **correos de recibo** a autor y trabajador para pagos de tareas, compras/donaciones.
  - Agregar **plantilla transaccional** con monto, estado y detalles, con fallback DEV.
  - Forzar el email oficial del usuario Plataforma a `accounting@wintoncoin.com` (creación y mantenimiento).
  - Actualizar el asset del logo.
- **Impacto**:
  - Comunicación profesional tipo fintech y trazabilidad para usuarios.
  - Plataforma con email consistente y auditable en todas las instalaciones.
- **Evidencia (commits)**: `791b2c1`, `0b12dcd`.

---

### 2026-01-25 — Onboarding: guía del menú principal

- **Contexto**: algunos usuarios no encontraban rápido accesos clave (P2P, Historial, Impulsor).
- **Decisión**: agregar un paso en el tour de bienvenida que resalta el menú superior y sus accesos.
- **Impacto**: navegación inicial más clara y menos fricción en el primer uso.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-01-26 a 2026-01-28 — Landing Page: Rediseño Visual y Contenido

- **Contexto**: La página de inicio necesitaba transmitir profesionalismo y claridad sobre la propuesta de valor "Token Engineering" y "Proof of Task".
- **Decisión**:
  - Implementar nueva estructura visual con tarjetas de servicios ("Hyper-Scalar Economic Engineering").
  - Integrar assets gráficos generados (imágenes 3D, dualidad de tokens).
  - Refinar textos para enfatizar la innovación tecnológica y económica.
- **Impacto**: Primera impresión mucho más potente y alineada con una Fintech de alto nivel.
- **Evidencia**: Conversaciones "Refining Website Content And Layout".

---

### 2026-01-29 a 2026-02-01 — Refactorización Backend: Autenticación Modular

- **Contexto**: La lógica de autenticación estaba acoplada en `server.js`, dificultando el mantenimiento y la escalabilidad.
- **Decisión**:
  - Extraer lógica a `src/controllers/authController.js` y `src/routes/authRoutes.js`.
  - Aislar validaciones y manejo de errores.
  - Preparar el terreno para migración a arquitectura serverless/microservicios.
- **Impacto**: Código backend más limpio, testearle y mantenible. Reducción de deuda técnica crítica.
- **Evidencia**: Conversaciones "Refactoring Authentication Logic".

---

### 2026-01-30 a 2026-02-05 — Seguridad y Políticas: Anti-Sybil y KYC

- **Contexto**: Necesidad de proteger la economía del token contra granjas de cuentas y abusos.
- **Decisión**:
  - Definir e implementar políticas estrictas contra multi-cuentas (Sybil attacks).
  - Condicionar recompensas de referidos a verificación de identidad (KYC).
  - Actualizar Términos y Condiciones y mensajes de UI para reflejar estas reglas.
- **Impacto**: Protección de la tesorería del proyecto y mayor confianza para inversores/usuarios legítimos.
- **Evidencia**: Conversaciones "User Security Policy", "Refining Referral Policies".

---

### 2026-02-01 a 2026-02-06 — Branding Integral y PWA Assets

- **Contexto**: Inconsistencia en logos e iconos en diferentes dispositivos y resoluciones.
- **Decisión**:
  - Generar set completo de iconos estandarizados (manifest PWA, favicons, Apple touch icons).
  - Implementar nuevos logos para Token BLUE y WintonCoin (círculo dorado).
  - Actualizar `manifest.json` y headers HTML.
- **Impacto**: Identidad de marca cohesiva y profesional en todas las plataformas (Web, Móvil, Desktop).
- **Evidencia**: Conversaciones "Branding & Icon Generation".

---

### 2026-02-07 a 2026-02-09 — Dashboard de Agentes y Gestión de Campañas

- **Contexto**: Falta de herramientas para que los agentes gestionen su performance y para configurar campañas específicas.
- **Decisión**:
  - Crear Dashboard de Agente con KPIs (leads, conversión, actividad).
  - Implementar configuración de "Targets" para campañas (Nicho, Plataforma, Presupuesto).
  - Resolver discrepancias en filtros de tareas activas en Admin Panel.
- **Impacto**: Empoderamiento de la fuerza de ventas (agentes) y campañas de marketing más precisas y medibles.
- **Evidencia**: Conversaciones "Agent Performance Dashboard", "Campaign Target Configuration".

---

### 2026-02-11 a 2026-02-14 — Seguridad en Pagos y Notificaciones Push

- **Contexto**: Vulnerabilidades potenciales en confirmación de pagos admin y problemas con la entrega de notificaciones en PWA.
- **Decisión**:
  - Blindar lógica de confirmación de pagos (verificación de roles y sesión).
  - Depurar flujo completo de Web Push Notifications (Service Worker, suscripción DB, entrega).
  - Actualizar mensajes de referidos para mayor viralidad.
- **Impacto**: Operativa financiera segura y canal de retención de usuarios (Push) funcional.
- **Evidencia**: Conversaciones "Admin Payment Confirmation Security", "Push Notification Debugging".

---

### 2026-02-14 a 2026-02-17 — Migración de Dominio, Roadmap y Pulido Final

- **Contexto**: Preparación para lanzamiento en dominio principal (`www`) y necesidad de mostrar visión a largo plazo.
- **Decisión**:
  - Estrategia de migración de PWA de subdominio a dominio raíz.
  - Creación de página `roadmap.html` con hitos visuales 2024-2027.
  - Actualización de Whitepaper (`docs.html`) con protocolo "Proof-of-Task".
  - Ajustes finos de UI: Footer profesional, iconos redes sociales SVG, textos de "Ayuda" optimizados.
- **Impacto**: Plataforma lista para "Go Live" público con narrativa de futuro clara y experiencia de usuario pulida.
- **Evidencia**: Conversaciones "PWA Domain Migration", "Roadmap & Icon Fixes".

---

### 2026-02-20 — Centro de Notificaciones y Difusión Masiva (Email Broadcast System)

- **Contexto**: Necesidad de un canal de comunicación institucional para anuncios masivos y gestión de mensajes diarios sin intervención manual en base de datos.
- **Decisión**:
  - Implementar un **Sistema de Difusión Masiva** con interfaz de pestañas en el Panel Admin (Push, Email, Mensajes Diarios).
  - Arquitectura de **Mail Worker (Queue-based)** utilizando PostgreSQL (`FOR UPDATE SKIP LOCKED`) para procesar envíos secuenciales de forma segura y auditable.
  - Optimización de base de datos mediante **Bulk Inserts por lotes (1000 users)** para manejar miles de destinatarios sin saturar la memoria o el pool de conexiones.
  - Implementar **auto-reparación de esquema** en el arranque (migrations idempotentes) para asegurar la integridad de las nuevas tablas transaccionales.
  - Registro de auditoría detallado por cada difusión (quién envió, cuándo, éxito/error por destinatario).
- **Impacto**: Infraestructura escalable para comunicaciones oficiales, con capacidad de procesar 50k+ correos diarios respetando límites de AWS SES y manteniendo trazabilidad total para auditorías Fintech.
- **Evidencia**: Conversación "Admin Broadcast UI Implementation".

## Observaciones de manager (deuda técnica / riesgos)

### Higiene del repo (importante)

En el historial aparece un commit grande donde entraron **artefactos generados** (ej.: `android-app/app/build/**`, `android-app/.gradle/**`) e incluso cambios asociados a `node_modules`/locks.  
Esto no rompe el producto, pero **sí rompe la mantenibilidad** (repo pesado, diffs ruidosos, conflictos).

**Recomendación** (cuando quieras lo hacemos):
- Asegurar `.gitignore` para Android: ignorar `**/build/`, `.gradle/`, `.idea/`, `local.properties`, etc.
- Dejar `node_modules/` fuera del repo (solo `package-lock.json`/`package.json`).
- Si ya están trackeados, hacer limpieza con `git rm -r --cached` (sin borrar local) y commit de “repo hygiene”.

## Próximos pasos sugeridos (para profesionalizar releases)

- Adoptar **Conventional Commits** (muchos ya lo están) y empezar a crear **tags** (`v0.1.0`, `v0.2.0`).
- Automatizar changelog (por ejemplo con `git-cliff` o similar).
- Definir checklist de release: migraciones, smoke tests frontend, endpoints críticos, y validación de cookies/CORS en prod.

---

### 2026-02-20 � Email Broadcast 2.0 y Evoluci�n de Identidad Visual

- **Contexto**: El sistema de difusi�n original era limitado y la marca necesitaba una actualizaci�n visual coherente.
- **Decisi�n**:
  - **Botones de Acci�n**: Habilitar campos de 'Texto' y 'URL' para el bot�n de acci�n.
  - **Saltos de L�nea Inteligentes**: Implementar conversi�n autom�tica de \
\ a \<br>\.
  - **Seguridad Simplificada**: Refinar el 'Recordatorio de Seguridad' eliminando jerga t�cnica como 'OTP'.
  - **Comparativa de Branding**: Estructura visual vertical para mostrar la transici�n de marca.
- **Impacto**: Comunicaciones masivas efectivas, profesionalismo y mayor tasa de clics.
- **Evidencia (commits)**: aa1defa, 653d488.

---

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

---

### 2026-02-21 � Sincronizaci�n de Marca y Contacto Directo

- **Cambios Realizados**:
  - **Landing Page**: Sustituci�n del texto 'WintonCoin' por el logotipo oficial \wintoncoin_transparent_phrase.png\ en el encabezado.
  - **Atenci�n al Cliente**: Integraci�n del correo \customerservice@wintoncoin.com\ en el footer de la web y en las plantillas de email.
  - **UX Footer**: Limpieza de textos redundantes y reestructuraci�n de la columna de contacto.
- **Impacto**: Mejora significativa en la percepci�n de marca y profesionalismo del soporte t�cnico.
  - **Build Config**: Registro de \legado.html\ en los entry points de Vite para asegurar su disponibilidad en el entorno de producci�n.
- **Impacto**: Mejora significativa en la percepci�n de marca y profesionalismo del soporte t�cnico.
- **Evidencia (commits)**: e896969, e981ebf.

---

### [2026-02-22] - Sistema de Comunicaciones Intersticiales Globales
- **App-Wide Interstitials (Global Modal)**: Implementado sistema de modales informativos globales gestionables desde el Admin Panel. Incluye persistencia en base de datos, lógica de "una vez por sesión" y diseño premium con Glassmorphism. (Completado y Probado)
- **Admin UI**: Añadido interruptor de activación global en el Centro de Notificaciones con feedback visual premium.
- **Frontend UX**: Implementado modal con efecto Glassmorphism y control de frecuencia (una vez por sesión) para maximizar impacto sin reducir la usabilidad. ✅ DESPLEGADO

---

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

---

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

---

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

---

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

---

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

---

## [2026-02-27] - Automatización de Despliegue (Investigación CD)

### Descripción
Análisis y propuesta de arquitectura de Despliegue Continuo (Continuous Deployment) para conectar el repositorio de GitHub con Hostinger.

### Acciones
- Revisión de `package.json` y estructura del proyecto.
- Propuesta de soluciones basadas en Hostinger Git Integration (Webhooks) y GitHub Actions.
- **Implementación de GitHub Actions (CD Ciberseguro)**: Creación del flujo automatizado `.github/workflows/deploy-frontend.yml` para despliegue por FTP exclusivo de la carpeta `frontend/dist/`. 
    - Implementación de script nativo **LFTP** en Ubuntu para evitar comportamientos anómalos de subcarpetas (`public_html/public_html`) causados por plugins obstinados de terceros (`ftp-deploy-action`).
    - Se protege el backend de exposición pública cumpliendo el estándar **Zero Hardcoded Secrets** para Hostinger.

---

### 2026-02-27 - Fijacion de Formularios, Arquitectura de Testing y Bugfix

- **Contexto**: Bug en configuracion de sub-formularios Admin y necesidad de validacion estricta.
- **Decision**: Reescritura frontend para inyectar formFields. Integracion de Unit Tests con Jest (Mocking DB, Cron y Migrations). Bugfix critico de escapeHtml en emailService.js resuelto.
- **Impacto**: UI restaurada, Testing modular blindando rutas de backend.
- **Evidencia (commits)**: pendiente de push.

---

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

---

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

---

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

---

### [2026-03-01] - Auditoría de Contexto y Sincronización de Agente
#### Descripción
Revisión integral de la base de código, estructura de archivos y reglas de negocio para asegurar la alineación del agente con los estándares de ingeniería y objetivos del proyecto WintonCoin.

#### Acciones realizadas
- **Inventario Completo**: Mapeo de la estructura del proyecto, detectando el monolito `server.js` (4588 líneas) y los módulos ya extraídos en `src/`.
- **Análisis de Seguridad**: Verificación de la política "Zero Hardcoded Secrets" y uso de middlewares de autenticación técnica y administrativa.
- **Sincronización Económica**: Estudio profundo de `ECONOMIC_RULES.md`, comprendiendo el sistema de tokens BLUE/RED, el ledger de impulsores (Booster) y las reglas de quema/deuda (FIFO).
- **Validación de Estándares**: Confirmación de los flujos de auditoría bancaria (`logAuditEvent`) y las reglas de diseño responsive premium.
- **Preparación para Modularización**: Identificación de bloques candidatos en `server.js` para ser extraídos a controladores y servicios independientes siguiendo las mejores prácticas.

---

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

---

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

---

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

---

### [2026-03-04] - Fase de Mejora y Auditoría de Landing Page
#### Descripción
Inicio de la fase de trabajo sobre la Landing Page principal. Se ha realizado una auditoría completa del código (HTML, CSS, JS) y de las reglas económicas para asegurar coherencia técnica y visual.

#### Acciones realizadas
- **Auditoría de Contexto**: Lectura integral de `index.html`, `landing.css`, `landing.js` y `ECONOMIC_RULES.md`.
- **Sincronización de Diseño**: Verificación de la paleta Sapphire Premium y efectos Glassmorphism.
- **Preparación**: Identificación de puntos de mejora en modularidad y responsividad. ✅ CONTEXTO COMPLETADO

---

### 2026-03-06 — Winton Solidario: Gestión Admin + Motor Hold & Release (BLUE IOU)

- **Contexto**: Las causas humanitarias requieren un nivel de verificación superior para evitar fraudes y asegurar que los fondos (BLUE IOU) provengan de personas reales antes de ser efectivos.
- **Decisión**:
  - Implementar **Panel de Administración Solidario** para la postulación privada de casos.
  - Diseñar motor de **"Hold & Release"**: Las donaciones de BLUE IOU se debitan del donante pero quedan en "Hold" (espera).
  - Condicionar la liberación: Los fondos solo se acreditan al beneficiario cuando el administrador aprueba el **KYC del donante**.
  - Aislamiento económico: La transferencia ocurre exclusivamente entre balances de impulsor (`booster_balance`), sin tocar el sistema de tokens RED.
- **Impacto**:
  - Seguridad bancaria: Blindaje contra bots y multicuentas que intenten "inflar" causas.
  - Transparencia: El beneficiario sabe que su saldo depende de la verificación de su red.
  - Trazabilidad: Cada gramo de BLUE IOU donado tiene un origen humano verificado.
- **Evidencia**: Implementación modular en `humanitarianController.js` y `humanitarianRoutes.js`.

---

### 2026-03-07 — Winton Solidario: Motor Hold & Release + Servicio de Donaciones

- **Contexto**: Con el Panel Admin listo, se necesitaba el motor financiero que procese las donaciones de BLUE IOU con garantía de integridad y trazabilidad.
- **Decisión**:
  - **Migración 039** (`039_solidario_hold_release_engine.js`): Crea la tabla `humanitarian_donations` y un **Trigger de PostgreSQL** (`fn_release_humanitarian_donations`) que libera automáticamente las donaciones en "Hold" cuando el donante pasa el KYC (`is_verified = true`).
  - **Servicio reescrito** (`humanitarianService.js`): Corregidos errores críticos del borrador inicial (consultaba columna inexistente, usaba UPDATE directo en lugar de Event Sourcing). Ahora usa `record_booster_event()` y `booster_blue_ledger` para compatibilidad total con la arquitectura existente.
  - **Rutas de usuario** (`humanitarianUserRoutes.js`): Endpoints para postular causas, donar BLUE IOU, consultar mis causas y ver detalle de donaciones. Protegidas con `authenticateToken`.
  - **Aislamiento modular**: Rutas admin (`/api/admin/humanitarian`) y rutas de usuario (`/api/humanitarian`) en archivos separados con middlewares distintos.
- **Impacto**:
  - Motor financiero a nivel de Base de Datos (Trigger): garantiza liberación automática sin depender del código de Node.js.
  - Compatibilidad con Event Sourcing: todas las operaciones de saldo usan `record_booster_event`.
  - Seguridad anti-fraude: validación de saldo, prevención de auto-donación, KYC obligatorio para liberar fondos.
- **Evidencia (commits)**: pendiente de push.

---

### 2026-03-08 — Winton Solidario: Interfaz Pública y Tarjeta Dashboard

- **Contexto**: Las causas solidarias requerían visibilidad tanto para el público general/donantes como para el propio creador de la causa, manteniendo una experiencia nivel fintech.
- **Decisión**:
  - **Página Pública Dedicada (`causa-solidaria.html` y `.js`)**: UI moderna con barra de progreso, lista de donantes (clasificados por estado de acreditación u "on hold") y modal seguro para realizar donaciones de BLUE IOU verificando el KYC del donante (`/api/auth/status`).
  - **Botón Compartir**: Integración con Web Share API (nativo móvil) o WhatsApp web (fallback).
  - **Tarjeta en el Dashboard (`contract_interaction.html` y `.js`)**: Un widget en el panel principal (`contract-interaction`) que muestra al usuario el progreso en tiempo real de su causa, su estado (pendiente, aprobada, rechazada) y acceso rápido para compartirla.
- **Impacto**:
  - Creadores empoderados: pueden seguir el progreso en su dashboard.
  - Donantes seguros: la barrera de aporte tiene UX premium y alertas claras (KYC impactando el "Hold" de los fondos).
  - Efecto de red facilitado gracias al botón de compartir.
- **Evidencia (commits)**: pendiente de push.

---

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

---

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

---

### [2026-03-13] - Refuerzo de Marca: Inmunidad Económica (Anti-Ballenas)
#### Descripción
Actualización de la narrativa de seguridad en la Landing Page principal para resaltar la protección contra la manipulación de mercado por grandes capitales (Ballenas), integrando el concepto dentro del bloque de Inmunidad Matemática.

#### Cambios realizados
- **Landing UI (`index.html`)**: 
    - Rediseño de la tarjeta **BLK_003** para integrar **"Anti-Ballenas"** justo debajo de "Anti-Rug Pull", unificando tipografías para un look 100% simétrico.
    - Actualización del copy de seguridad: *"Es imposible robar liquidez o manipular el mercado."*
    - Simplificación del copy en la sección Marketplace: Eliminación de referencias redundantes para mayor impacto visual. ✅ PROFESIONAL
- **Arquitectura Visual**: Implementación de un contenedor `flex-column` dentro del `data-header` para mantener la jerarquía sin romper el diseño responsive.

---

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

---

### [2026-03-15] - Infraestructura AWS: Auditoría de Facturación Global
#### Descripción
Análisis preventivo tras recibir notificación oficial de AWS sobre el cambio de remitente para facturas electrónicas (`invoicing@aws.com`) a partir del 25 de marzo de 2026.

#### Acciones realizadas
- **Auditoría de Código**: Búsqueda exhaustiva en el backend y scripts de mantenimiento para detectar dependencias de automatización (parsers/scrapers) vinculadas a correos de AWS.
- **Resultado**: No se detectaron dependencias técnicas activas. El impacto en el código es NULO.
- **Recomendación Operativa**: Actualizar filtros de correo en la cuenta administrativa de Gmail para asegurar que las facturas no sean marcadas como spam o ignoren reglas de reenvío contables. ✅ CIBERSEGURO

---

### [2026-03-18] - Rediseño Premium de Email Service (Anti-Spam & Zero-Image)
#### Descripción
Refactorización de la cabecera de los correos automáticos (OTP, Transacciones, Gobernanza, Anuncios) para eliminar la deformación de imágenes y usar una estrategia de tipografía nativa con estética Cripto-Premium.

#### Cambios realizados
- **Identidad Visual 100% CSS**: Reemplazo del logo anterior por una cabecera oscura (Azul Nocturno `#0A0F1C`) con la palabra `Winton` en blanco puro y `Coin` en azul corporativo. 
- **Optimización Anti-Spam**: Al eliminar las peticiones a imágenes externas (`<img>`), se blinda el sistema OTP aumentando dramáticamente la confianza (Trust Score) ante filtros de Google y Outlook.
- **Micro-Performance**: Velocidad de carga instantánea del correo al depender exclusivamente de código nativo, brindando una experiencia "bancaria" ininterrumpida. ✅ PROFESIONAL

---

### [2026-03-19] - Despliegue del Sistema de Reclutamiento Profesional (Winton Talent)
#### Descripción
Creación e integración completa del portal de captación de talento externo para el crecimiento del ecosistema WintonCoin, bajo el programa de compensación temprana.

#### Cambios realizados
- **Backend de Reclutamiento**: Implementación del controlador `recruitmentController.js` y middleware `recruitmentUpload.js` (Multer) con validación estricta de archivos PDF de hasta 5MB y trazabilidad de IP.
- **Base de Datos (Migración 043)**: Creación de la tabla `recruitment_proposals` para el almacenamiento seguro y auditable de las postulaciones, incluyendo el multiplicador aplicado en el momento (15x).
- **Frontend Premium**: Nueva página `trabaja-con-nosotros.html` con estética Sapphire y Glassmorphism, destacando el beneficio de 1500 BLUE IOU por cada $100 USD de valor aportado.
- **Integración en Footer**: Actualización de la landing page principal (`index.html`) para incluir el enlace oficial en la sección de Plataforma.
- **Legal & Compliance**: Inclusión de la cláusula de tratamiento de datos de WTN Solutions LLC conforme a estándares internacionales de privacidad. ✅ PROFESIONAL

---

### 2026-03-20 — Panel de Reclutamiento (Winton Talent) y Gestión de Candidatos

- **Contexto**: Para la fase de crecimiento de la startup, se necesitaba un portal profesional para recibir y gestionar candidaturas de forma centralizada y segura.
- **Decisión**:
  - **Admin Portal de Talento (`admin-recruitment.html`)**: Rediseño "Sapphire Premium" con cabecera superior compacta para mayor eficiencia de espacio. Añadida visualización directa de salarios pretendidos, LinkedIn y perfiles de candidatos.
  - **Seguridad Bancaria (Auth & Cookies)**: Migración de autenticación `localStorage` a **cookies httpOnly** con `credentials: 'include'`, alineando el portal de talento con la seguridad del panel admin principal.
  - **Protección OWASP Path Traversal (CRITICAL FIX)**: Implementación de validación de rutas mediante `process.cwd()` y `path.join` para garantizar la correcta descarga de CVs en entornos de producción distribuidos (Render/Hostinger).
  - **Migraciones 044 y 045**: Evolución de la tabla para auditoría (`reviewed_at`, `reviewer_notes`) y filtrado económico (`expected_salary`).
  - **Middleware `authenticateAdmin`**: Protección estricta de todos los endpoints administrativos.
- **Impacto**:
  - Gestión centralizada: El equipo de RRHH puede revisar postulaciones, descargar CVs y actualizar estados desde el panel admin.
  - Seguridad reforzada: Los datos sensibles de candidatos y archivos CV están protegidos bajo estándares de ciberseguridad industrial.
  - Trazabilidad: Cada cambio de estado genera un registro en el log de auditoría bancaria.
- **Evidencia (commits)**: `a85e34c`.

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

### [2026-03-25] - Canonicalización de actor en `publicationController` (discard/approve/confirm-payment)
#### Descripción
Se redujo dependencia de campos `...Username` enviados por cliente, usando identidad canónica de `req.user` siempre que exista (JWT), manteniendo fallback controlado para compatibilidad.

#### Cambios realizados
- `backend/src/controllers/publicationController.js`:
  - Nuevo helper `resolveActorUsername(req, fallbackUsername)`.
  - Aplicado en:
    - `POST /publications/:id/discard`
    - `POST /publications/:id/approve`
    - `POST /publications/:id/confirm-payment`
  - Las validaciones de permisos y logs de auditoría usan `actorUsername` canónico.
  - En `confirm-payment`, `targetUsername` del log final se normaliza al `acceptor_username` de DB (fuente de verdad).

#### Impacto
- Menor riesgo de spoofing funcional por manipulación de `username` en body.
- Mejor trazabilidad de auditoría (actor/target consistentes con datos canónicos).
- Compatibilidad preservada para flujos admin legacy.

---

---

## [2026-03-26] - Fix CORS: agregar dominio principal de producción

### Descripción
El frontend de producción migró de `sc.wintoncoin.com` a `wintoncoin.com`, pero la lista de orígenes permitidos (CORS) del backend no incluía los nuevos dominios. Esto provocaba que todas las peticiones desde producción fueran bloqueadas por el navegador (error CORS 403).

#### Cambios realizados
- `backend/server.js`:
  - Agregado `https://wintoncoin.com` a `ALLOWED_ORIGINS` (dominio principal de producción).
  - Agregado `https://www.wintoncoin.com` a `ALLOWED_ORIGINS` (variante con www).
  - Se mantienen los dominios legacy (`sc.wintoncoin.com`) para compatibilidad.

#### Impacto
- Resuelve error CORS que impedía el funcionamiento de la página de reclutamiento (`trabaja-con-nosotros.html`) y cualquier otra petición al backend desde el dominio principal.
- Sin impacto en seguridad: solo se agregan dominios legítimos del proyecto.

---

---

## [2026-03-26] - Fix auth: agregar token Bearer a publication-detail.js

### Descripción
La función `fetchFromServer` en `publication-detail.js` no incluía el header `Authorization: Bearer` en las peticiones al backend. Tras el endurecimiento de seguridad que requiere JWT en todas las rutas autenticadas, las acciones como "Aceptar Tarea", "Aprobar", "Completar" y "Confirmar Pago" fallaban con error "No autenticado".

#### Cambios realizados
- `frontend/src/pages/publication-detail.js`:
  - Agregada lectura de `localStorage.getItem('token')` al inicio del módulo.
  - `fetchFromServer()` ahora incluye `Authorization: Bearer <token>` en todas las peticiones.

#### Impacto
- Resuelve error "No autenticado" al intentar aceptar, aprobar, completar o confirmar pago en publicaciones.
- Todas las acciones de publicación ahora envían identidad JWT verificable al backend.

---

---

### 2026-03-27 — Auditoría técnica: renderizado PWA y selector de publicaciones

- **Contexto**: Se realizó una auditoría de ingeniería nivel Senior sobre las funciones de renderizado de la PWA (`contract-interaction.js`) y el selector de filtros/orden de publicaciones. El objetivo fue identificar errores activos, riesgos de seguridad y deuda técnica.
- **Decisión**: Documentar todos los hallazgos en `docs/AUDIT_PENDING_ISSUES.md` como backlog técnico auditable, con instrucciones para verificación y resolución progresiva.
- **Hallazgos principales**:
  - 3 hallazgos CRÍTICOS: función `startCountdown` inexistente (runtime error), polling agresivo de 5s sin `visibilitychange`, caché de ratings que se destruye en cada render.
  - 7 hallazgos IMPORTANTES: XSS potencial en `pub.title`/`pub.author_username`, CDN RawGit descontinuado, `document.execCommand` deprecado, select que mezcla filtros con ordenamientos, memory leak por listeners acumulativos, código muerto, `Promise.all` sin tolerancia a fallos parciales.
  - 5 hallazgos MENORES: meta tag duplicada, polución de `window.*`, onclick inline, sin loading state, CSS duplicado.
- **Impacto**: Se genera un documento de referencia que permite a cualquier agente futuro resolver estos issues de forma ordenada y verificable.
- **Documento de referencia**: `docs/AUDIT_PENDING_ISSUES.md`.

---

### 2026-03-27 — Refactor: Separar filtros y ordenamiento de publicaciones (I-04, I-05)

- **Contexto**: El selector de publicaciones mezclaba filtros por tipo (solicitud, venta, donación, en proceso) con ordenamientos (fecha, recompensa) en un solo `<select>`. Esto impedía combinar filtro + orden y generaba confusión en la UX. Además, contenía código muerto (`if (!selected)`) que nunca se ejecutaba.
- **Decisión**: Reemplazar el `<select>` único por dos controles con responsabilidades separadas siguiendo el principio SRP (Single Responsibility Principle):
  - **Filter chips** (`<button>` con `data-filter`): fila horizontal de pills para filtrar por tipo — "Todos", "En proceso", "Solicitud", "Venta", "Donación". Usan event delegation, ARIA `role="group"` y `aria-pressed`, y son scrollable en móvil.
  - **Sort dropdown** (`<select>`): selector de ordenamiento — "Más reciente", "Más antigua", "Mayor recompensa", "Menor recompensa". Con `<label>` asociado para accesibilidad.
- **Cambios técnicos**:
  - `contract_interaction.html`: Reemplazado el `<select id="publicationSortFilter">` por chips + sort.
  - `contract-interaction.js`: Nueva variable de estado `currentFilter`, nueva función `handleFilterChipClick` con event delegation, `applySortAndFilter` reescrita con pipeline claro (filtrar → ordenar → priorizar pendientes). Se eliminó rama de código muerto.
  - `style.css`: Nuevas clases `.publication-filter-chips`, `.filter-chip`, `.publication-sort-container`, `.publication-sort-select`, `.publication-sort-label`. Se eliminaron clases obsoletas `.publication-controls-select`. Responsive para móvil.
- **Impacto**: El usuario ahora puede filtrar por tipo de publicación Y ordenar simultáneamente (ej: "solo Solicitudes" ordenadas por "Mayor recompensa"). Mejor UX en PWA móvil con chips tappables. Código más limpio y mantenible.
- **Issues resueltos**: `AUDIT_PENDING_ISSUES.md` → I-04, I-05.

---

### 2026-03-27 — Fix: Mobile-first responsive para controles de publicaciones

- **Contexto**: Los filter chips, el input de búsqueda y el dropdown de ordenamiento se veían rotos en dispositivos móviles. Los estilos globales de `button` (`width:100%`, `padding:15px`, `background:primary`) e `input[type="text"]` (`padding:12px 15px`, `background:#fff`, `color:#111`, `font-size:1rem`) sobreescribían los estilos de componente, causando chips gigantes, search input con fondo blanco y tamaño incorrecto.
- **Decisión**: Reescribir toda la sección CSS de publication controls con enfoque **mobile-first**:
  - Base (320px+): chips compactos (30px alto, 0.72rem), search y sort apilados verticalmente al 100% de ancho.
  - `@media (min-width: 420px)`: search + sort en fila horizontal, search flexible y sort con ancho mínimo.
  - `@media (min-width: 480px)`: chips ligeramente más grandes.
  - Especificidad elevada (`.publication-controls .filter-chip`) para vencer los globales sin usar `!important`.
- **Impacto**: Los controles se ven correctamente en cualquier teléfono desde 320px de ancho, con transición suave a layout horizontal en pantallas medianas.

---

### 2026-03-27 — Fix: Caché de ratings persistente (C-03) y layout inline obligatorio

- **Contexto**: Al cambiar filtro, orden o búsqueda, la función `renderPublicationsWithFilters` recreaba un `Map` vacío de ratings de usuario en cada invocación. Esto generaba N peticiones HTTP al servidor por cada re-renderizado (una por cada autor único), causando demoras visibles de varios segundos.
- **Decisión**: Promover `userRatingsCache` a variable de módulo (persistente entre renderizados). Se invalida únicamente cuando `fetchAndDisplayPublications` trae datos frescos del servidor (`userRatingsCache.clear()`). Dentro de `renderPublicationsWithFilters`, ahora solo se buscan los autores que no estén ya en caché, se les hace fetch en paralelo, y luego se genera el HTML de forma síncrona.
- **Cambios técnicos**:
  - `contract-interaction.js`: `userRatingsCache` movido a scope de módulo (línea ~113). `fetchAndDisplayPublications` llama `.clear()` antes de renderizar. `renderPublicationsWithFilters` filtra autores no cacheados, los fetchea una sola vez, y genera HTML con `.map()` síncrono en lugar de `Promise.all` con callbacks async.
  - `style.css`: Filter chips con `flex-wrap: nowrap` + `overflow-x: auto` (siempre 1 línea). Sort container con `flex-direction: row` obligatorio (buscar + ordenar siempre lado a lado).
- **Impacto**: Cambiar filtro/orden/búsqueda es ahora instantáneo (0 peticiones HTTP). Solo la carga inicial o el polling generan requests de ratings. Resuelve issue C-03 de la auditoría.

---

### 2026-03-28 — UX: Eliminación del mensaje "¡Transacción completada!" en detalle de tarea

- **Contexto**: En la vista de detalle de publicación (`publication-detail.js`), cuando el estado del participante era `confirmed_paid`, se mostraba un mensaje estático `"¡Transacción completada!"` al final de los pasos de la tarea. Este mensaje generaba confusión porque aparecía siempre visible (no como resultado de una acción inmediata), dando la impresión de que la tarea ya fue completada cuando el usuario podría estar revisándola.
- **Decisión**: Eliminar el mensaje siguiendo principios de diseño minimalista y UX profesional — no mostrar feedback de éxito permanente cuando el contexto ya lo hace evidente. El usuario sabe que completó la tarea porque pasó por todos los pasos del flujo.
- **Cambios técnicos**:
  - `frontend/src/pages/publication-detail.js`: En el `switch(userStatus)`, caso `confirmed_paid`, se eliminó la asignación `messageHTML = '¡Transacción completada!'`. El `messageHTML` queda como string vacío (su valor por defecto). La lógica del botón "de nuevo" (si hay cupos disponibles) se mantiene intacta.
- **Impacto**: Interfaz más limpia y menos confusa. No se afecta ninguna lógica de negocio, validación ni flujo funcional. Cambio puramente visual/UX.

---

### 2026-03-29 — CI/CD: Deploy dual — mismo build a sc.wintoncoin.com y wintoncoin.com

- **Contexto**: El workflow de GitHub Actions (`deploy-frontend.yml`) solo desplegaba el build del frontend al subdominio `sc.wintoncoin.com`. Se necesita que el dominio principal `wintoncoin.com` también reciba el mismo build automáticamente al hacer push.
- **Decisión**: Agregar un segundo paso de sincronización FTP en el mismo workflow. Se reutiliza el mismo build (no se compila dos veces), y se usa un set de secrets FTP independiente para el dominio principal (`FTP_SERVER_MAIN`, `FTP_USERNAME_MAIN`, `FTP_PASSWORD_MAIN`). También se separó la instalación de `lftp` en su propio paso para evitar instalarlo dos veces.
- **Cambios técnicos**:
  - `.github/workflows/deploy-frontend.yml`: Se agregó paso "Instalar lftp" separado. Se renombró el paso de deploy existente a "Deploy a sc.wintoncoin.com". Se agregó nuevo paso "Deploy a wintoncoin.com" con secrets dedicados.
- **Impacto**: Un solo push despliega a ambos dominios. Requiere crear 3 nuevos secrets en GitHub (`FTP_SERVER_MAIN`, `FTP_USERNAME_MAIN`, `FTP_PASSWORD_MAIN`) con las credenciales FTP del dominio principal en Hostinger.

---

### 2026-04-02 — Auditoría Integral del Sistema Push Notifications (10 errores corregidos)

Auditoría completa del sistema VAPID/Web Push. Se encontraron y corrigieron 10 errores (3 críticos, 4 importantes, 3 moderados) en 7 archivos. Ver `docs/EVOLUCION.md` y `docs/AUDIT_PENDING_ISSUES.md` para el detalle completo de cada corrección.

---

---

### 2026-04-02 — Auditoría y Corrección Integral del Sistema Push Notifications

- **Contexto**: Auditoría completa del sistema de notificaciones push (VAPID/Web Push) reveló **10 errores** en 7 archivos, incluyendo 3 críticos que afectaban la funcionalidad en producción. El sistema involucraba: `notificationService.js`, `notificationController.js`, `notificationEventBus.js`, `publicationController.js`, `authController.js`, `notificationSettings.js` (frontend), y `sw-source.js` (Service Worker).
- **Errores críticos corregidos**:
  - **E-01 Panel Admin Push ROTO**: Frontend enviaba `message` pero backend esperaba `body` → siempre 400. No había lógica de envío individual (solo broadcast). Respuesta sin `success` que el frontend buscaba. CORREGIDO: Controller acepta ambos campos, implementa envío individual por username, y retorna `{ success, sent, failed }`.
  - **E-02 Preferencias se BORRABAN al guardar**: Frontend enviaba `{ social, marketing }` directo, backend hacía `const { settings } = req.body` → `undefined` → preferencias reseteadas a solo `{ security: true }`. CORREGIDO: Controller acepta ambos formatos (`{ settings: {...} }` y directo). Service hace merge con preferencias actuales en vez de reemplazar.
  - **E-03 9/18 llamadas con `url` en raíz**: SW lee `data.url` para navegación, pero 9 llamadas ponían `url` en la raíz del payload → click en notificación siempre iba a `/contract_interaction.html`. CORREGIDO: Todas las llamadas ahora usan `data: { url }`. Además, `normalizePayload()` en el servicio maneja el formato legacy como fallback.
- **Errores de seguridad corregidos**:
  - **E-04 SQL Injection en broadcast**: `typeKey` se concatenaba directo en SQL. CORREGIDO: Query parametrizada con `$1`.
  - **E-05 Login alert como SOCIAL**: `SECURITY_LOGIN_ALERT` usaba tipo default `SOCIAL`, permitiendo que usuarios lo desactivaran. CORREGIDO: Tipo explícito `'SECURITY'`.
- **Mejoras de robustez**:
  - **E-06**: Contadores de entrega ahora cuentan solo éxitos reales (no intentos).
  - **E-07**: 5 eventos de gobernanza sin `data.url` corregidos con URL al panel de gobernanza.
  - **E-08**: Whitelist de tipos (`VALID_NOTIFICATION_TYPES`) con fallback seguro.
  - **E-09**: Verificación de VAPID (`assertVapidReady()`) antes de cada envío.
  - Tipos `TRANSACTIONAL` y `SECURITY` marcados como `MANDATORY_TYPES` (no bloqueables por usuario).
  - Notificaciones de pago, donación y acreditación reclasificadas de `SOCIAL` a `TRANSACTIONAL`.
- **Archivos modificados**: `backend/src/services/notificationService.js` (reescrito), `backend/src/controllers/notificationController.js` (reescrito), `backend/src/controllers/publicationController.js` (6 payloads), `backend/src/controllers/authController.js` (3 payloads), `backend/src/services/notificationEventBus.js` (6 correcciones), `frontend/src/modules/notificationSettings.js` (body format).
- **Impacto**: Sistema push completamente funcional, seguro, auditable y alineado con estándares fintech/bancarios. Panel admin puede enviar push individual y masivo. Preferencias de usuario funcionan correctamente. Navegación al hacer click en notificación lleva a la página correcta en todos los casos.

---

### 2026-04-02 — Corrección de C-01, I-01 y C-02 (Runtime Error, XSS, Polling)

- **Contexto**: Tres hallazgos de la auditoría técnica pendientes de resolución: un error de runtime que rompía funcionalidad activa (C-01), una vulnerabilidad XSS en la renderización de publicaciones (I-01), y un polling agresivo que desperdiciaba recursos del servidor y batería del usuario (C-02).
- **C-01 — ReferenceError `startCountdown` (CRÍTICO)**:
  - `handleCountdownTimers()` llamaba a `startCountdown()` que no existía → `ReferenceError` silencioso que impedía mostrar el countdown de fondos pendientes de liberación.
  - **Solución**: Creada función `startAvailableCountdown(availableDateString, availableAmount)` siguiendo el mismo patrón profesional de `startDebtCountdown` y `startEscrowCountdown`. Limpia interval previo, formatea monto, muestra cuenta regresiva, y al llegar a cero oculta el contenedor y refresca saldos vía `fetchAndDisplayBalances()`.
- **I-01 — XSS en `pub.title` y `pub.author_username` (IMPORTANTE/SEGURIDAD)**:
  - Datos del servidor (`pub.title`, `pub.author_username`) se insertaban directamente en HTML sin escapar → riesgo de ejecución de código malicioso en el navegador de todos los usuarios.
  - **Solución**: Creado módulo `frontend/src/modules/sanitize.js` con funciones `escapeHtml()` y `escapeAttr()` (cumple OWASP XSS Prevention Cheat Sheet, escapa `& < > " '`). Registrado en `index.js` y expuesto en `window.*`. Aplicado en `getPublicationCardHTML`: título usa `escapeHtml(pub.title)`, autor usa `escapeHtml`/`escapeAttr` para contenido y atributos, URL del perfil usa `encodeURIComponent` para query params.
- **C-02 — Polling agresivo sin control de visibilidad (CRÍTICO)**:
  - `setInterval(loadAllData, 5000)` ejecutaba 5 peticiones HTTP cada 5 segundos sin importar si el usuario estaba mirando la pestaña o si el teléfono estaba en el bolsillo.
  - **Solución**: Implementado sistema de polling inteligente usando Page Visibility API (W3C estándar). Funciones `startPolling()`/`stopPolling()` idempotentes controladas por listener `visibilitychange`. Cuando el tab está oculto: 0 requests. Al volver: refresh inmediato + reinicio del ciclo. Intervalo aumentado de 5s a 10s.
- **Archivos modificados**: `frontend/src/pages/contract-interaction.js`, `frontend/src/modules/sanitize.js` (nuevo), `frontend/src/modules/index.js`.
- **Impacto**: Eliminado error de runtime que afectaba a usuarios con fondos pendientes. Eliminada vulnerabilidad XSS en el feed de publicaciones. Reducción significativa de carga al servidor (~50% menos requests cuando visible, ~100% menos cuando oculto) y ahorro de batería en dispositivos móviles.

---

### 2026-04-02 — Fix auth faltante en publish/donación/quick-sale + XSS en publication-detail

- **Contexto**: Durante las pruebas de los fixes anteriores en demo, se detectaron 2 problemas adicionales.
- **AUTH-01 — Bearer token faltante en 4 endpoints protegidos**:
  - El commit de seguridad `cc01f22` añadió `requireAcceptedLegalByUsernameField` a `POST /publish`, `POST /api/minor/add-tutor`, `POST /publications/:id/accept` y `POST /api/quick-sale`, pero el frontend nunca fue actualizado para enviar el header `Authorization: Bearer <token>`.
  - **Solución**: Añadido `Authorization: Bearer ${token}` a los 4 fetch. Token se lee al momento del fetch (no al cargar la página) siguiendo el patrón de `postToServer`. Añadido `handleSessionExpired` para redirigir al login si el token expiró.
- **XSS-02 — 7 puntos de inyección XSS en publication-detail.js**:
  - La protección XSS de I-01 solo cubría `contract-interaction.js` (tarjetas del dashboard). La página de detalle (`publication-detail.js`) tenía 7 inserciones de datos del servidor sin escapar: título, autor, participantes, labels de formulario, respuestas de formulario.
  - **Solución**: Aplicado `escapeHtml()`/`escapeAttr()`/`encodeURIComponent()` en los 7 puntos. Verificado en demo: el payload `<img src=x onerror=alert('XSS')>` ya no ejecuta código.
- **Archivos modificados**: `frontend/src/pages/publish.js`, `frontend/src/pages/contract-interaction.js`, `frontend/src/pages/publication-detail.js`.
- **Impacto**: Publicar, donar y venta rápida vuelven a funcionar. XSS eliminado en todas las vistas de publicaciones.

---

### 2026-04-04 — Eliminación de cabecera (nav) rota en faq.html

- **Contexto**: La página `frontend/faq.html` contenía un elemento `<nav>` con enlaces a `landing.html` (logo "WintonCoin" e "Inicio") y `register.html` ("Registrarse"). La página `landing.html` no existe en el servidor, generando error 404 al hacer clic en cualquiera de esos enlaces.
- **Solución**: Se eliminó completamente el bloque `<nav class="glass-nav">` con todos sus enlaces rotos. Se ajustó el `padding-top` de `.faq-section` de `120px` a `60px` ya que el padding original compensaba la altura del nav fijo que fue removido. También se eliminó el enlace "Inicio" (`landing.html`) del footer que igualmente apuntaba a la página inexistente. Se eliminó la columna de redes sociales del footer (iconos 𝕏, in, IG) ya que eran `<span>` sin enlaces funcionales.
- **Archivos modificados**: `frontend/faq.html`.
- **Impacto**: Los usuarios de la página FAQ ya no ven enlaces que llevan a páginas inexistentes (404). Se eliminaron iconos de redes sociales no funcionales. La página queda limpia con solo elementos que realmente funcionan: las 17 preguntas FAQ, el CTA de WhatsApp, y enlaces válidos en el footer (register, login, boosters).

---

### 2026-04-09 — Gobernanza: Recompensa por voto + Demo→Producción + Message Archive

- **Recompensa por voto (BLUE IOU)**: Acreditación automática al votar con snapshot de precio (point-in-time pricing). Default seguro: 0. Procesamiento batch admin para votos históricos.
- **Transferencia Demo→Producción**: Export/Import seguro con HMAC-SHA256, matching por username, triple deduplicación, crash-safety.
- **Message Archive**: Almacenamiento de exports en BD para re-download (patrón SWIFT). UI de historial con audit log.
- **Migraciones**: 047 (reward_credited), 048 (demo_reward_imports), 049 (demo_reward_exports).
- Ver `docs/EVOLUCION.md` para detalle técnico completo.

---

### 2026-04-09 — Fix: Notificaciones in-app + Historial de Ganancias + XSS

- **Notificaciones in-app**: 15 eventos del EventBus ahora guardan en tabla `notifications` (antes solo push+email).
- **Historial de Ganancias**: Query LATERAL corregida — match por proximidad temporal en vez de `ORDER BY DESC`.
- **Seguridad**: 3 puntos de Stored XSS corregidos con `escapeHtml()` en notificaciones y historial de ganancias.
- **Estabilidad**: `_storeNotificationByUserId` cambiada para prevenir crash por UnhandledPromiseRejection.

---

---

### 2026-04-09 — Gobernanza: Recompensa por voto (BLUE IOU) + Transferencia Demo→Producción + Archivo de Exportaciones

- **Contexto**: Los guardianes del sistema Winton-Consensus participan en la toma de decisiones críticas (votación de solicitudes de configuración y membresía). Se requería un mecanismo de incentivo económico por su participación, junto con un sistema seguro para compensar actividad de votación realizada en el entorno demo.
- **Decisión**:
  - **Recompensa por voto (Event-Driven)**: Al emitir un voto (`GOV_VOTE_SUBMITTED`), se acreditan BLUE IOU al guardián usando un snapshot del valor configurado (`gov_vote_reward_blue`) para garantizar "point-in-time pricing". Default seguro: `0` (Secure by Default).
  - **Migración 047**: Columna `reward_credited` en `governance_votes` con índice parcial para consultas eficientes de votos sin pagar.
  - **Procesamiento batch**: Botón admin para procesar votos históricos sin recompensar (notificación consolidada).
  - **Transferencia Demo→Producción**: Export/Import seguro con HMAC-SHA256, matching por `username`, triple deduplicación (demo_exported_at, file_hash UNIQUE, vote_ids_json), crash-safety con status incremental.
  - **Message Archive (Migración 049)**: Tabla `demo_reward_exports` para almacenar copias firmadas de exports con re-download capability, UI de historial, y audit log de re-descargas.
  - **UI Admin**: Sección "Recompensas Gov." con estadísticas, botón de procesamiento batch, export/import demo, e historial de exportaciones.
- **Impacto**:
  - Incentivo económico alineado con mejores prácticas de gobernanza descentralizada.
  - Seguridad bancaria: idempotencia, atomicidad, snapshot de precios, firma criptográfica.
  - Operación demo→producción segura con protección contra doble pago y crash recovery.
  - Message Archive pattern (estándar SWIFT) para recoverability de datos exportados.
- **Evidencia**: Migraciones 047, 048, 049. Archivos: `governanceRewardService.js`, `governanceDemoRewardService.js`, `governanceService.js`, `governanceController.js`, `notificationEventBus.js`, `server.js`, `admin-panel.html`, `admin-panel.js`.

---

### 2026-04-09 — Fix: Notificaciones in-app y match de transacciones en Historial de Ganancias

- **Contexto**: Dos problemas detectados en producción:
  1. Las notificaciones push de gobernanza (y de otros módulos) se enviaban correctamente pero **no se guardaban** en la tabla `notifications`, por lo que el "Historial de Notificaciones" in-app aparecía vacío para estos eventos.
  2. El "Historial de Ganancias" (perfil impulsor) mostraba el mismo número de solicitud (#45) para dos votos distintos (#44 y #45), cuando el "Historial de Transacciones" mostraba correctamente cada uno.
- **Decisión**:
  - **Problema 1 — Persistencia de notificaciones**: Creados helpers `_storeNotification(recipientUsername, message)` y `_storeNotificationByUserId(userId, message)` en `notificationEventBus.js`. Patrón fire-and-forget con `.catch()` para no bloquear el flujo principal. Se agregó INSERT en los **15 eventos activos** (8 de gobernanza + 7 generales: participación, tareas, P2P, seguridad).
  - **Problema 2 — Query LATERAL ambigua**: La query `LEFT JOIN LATERAL` en booster-profile usaba `ORDER BY bt.created_at DESC LIMIT 1`, tomando siempre la transacción más reciente. Dos votos con mismo monto dentro de 2 minutos hacían match con la misma fila. Corregido a `ORDER BY ABS(EXTRACT(EPOCH FROM (bt.created_at - bbl.created_at))) ASC LIMIT 1` para match por proximidad temporal. Aplicado en ambos endpoints (público y autenticado).
  - **Seguridad XSS**: Durante la revisión se detectaron 3 puntos de Stored XSS: `notification.message` se insertaba sin escapar en el dropdown y modal de notificaciones, y `description` en el historial de ganancias. Corregidos con `escapeHtml()` (OWASP).
  - **Estabilidad**: `_storeNotificationByUserId` cambiada de `async` a función síncrona con `.then()/.catch()` encadenado para prevenir `UnhandledPromiseRejection` que podría crashear el proceso Node.js.
- **Archivos modificados**: `backend/src/services/notificationEventBus.js`, `backend/server.js` (2 queries), `frontend/src/pages/contract-interaction.js` (2 puntos XSS), `frontend/src/pages/booster-profile.js` (1 punto XSS + import).
- **Impacto**:
  - Historial de notificaciones in-app completamente funcional para todos los eventos de la plataforma.
  - Historial de ganancias muestra correctamente cada solicitud de gobernanza por separado.
  - 3 vulnerabilidades Stored XSS eliminadas.
  - Estabilidad del proceso Node.js mejorada (sin rejected promises sin manejar).

---

## 2026-04-11 — Time-Lock de membresía alineado al quórum (seguridad operativa)

- **Problema**: Para `membership_change`, `execution_time` se calculaba al **crear** la solicitud (`created_at + gov_timelock_hours`). Si el quórum se alcanzaba **después** de esa marca, el worker de ejecución podía correr casi de inmediato (~1 min), incoherente con la política “tras aprobar” y con el texto del admin.
- **Decisión**:
  - **Creación**: `execution_time` queda **`NULL`** hasta aprobación (solo membresía; `config_change` sin cambio de semántica inmediata donde aplique).
  - **Aprobación (quórum alcanzado)**: Un único `UPDATE` en transacción pone `status = approved` y `execution_time = NOW() + (interval '1 hour' * timelockHours)` en **PostgreSQL** (reloj del servidor, una sola fuente de verdad). Si el `UPDATE` no devuelve fila o `execution_time`, se lanza error explícito (no se deja estado ambiguo).
  - **Auditoría**: Evento `GOV_REQUEST_APPROVED_TIMELOCK` con `timelockHours` y `executionTime` devuelto por la BD.
  - **Notificaciones**: En correo de solicitud creada, si es membresía y no hay `execution_time`, se explica que el time-lock cuenta **después del quórum**.
  - **UX**: Panel de gobernanza muestra fila “Time-Lock” para solicitudes de membresía en `pending` sin fecha aún; admin/help y seed de `databaseInit` alineados al nuevo texto (“horas tras el quórum”).
- **Archivos tocados**: `backend/src/services/governanceService.js`, `backend/src/services/notificationEventBus.js`, `backend/src/config/databaseInit.js`, `frontend/src/pages/admin-panel.js`, `frontend/src/pages/governance-panel.js`.
- **Impacto**: Ventana de cancelación predecible respecto al momento real de aprobación; menos riesgo de ejecución “instantánea” por desfase temporal; trazabilidad clara en auditoría y en comunicaciones al usuario.
- **Revisión adicional (defensa en profundidad)**:
  - `UPDATE ... WHERE id = $1 AND status = 'pending'` al aprobar membresía: evita transiciones ambiguas si el estado no fuera el esperado.
  - `GOV_REQUEST_APPROVED` en EventBus: si `executionTime` llega vacío, relectura vía `getRequestById`; si la fecha sigue siendo inválida, texto seguro y log de error (evita `Invalid Date` en push/email).

---

### 2026-04-11 — Vista previa de import demo: auditoría por guardián + contraste legible

- **Problema**:
  - Contraste: el bloque "Vista Previa de Importación" pintaba sobre `admin-card` con tema oscuro y dejaba texto ilegible (solo se veían los emojis ✅/⚠️). No se podían auditar visualmente los datos antes de pagar.
  - Detalle: la previa solo mostraba agregados (votos nuevos, ya importados, recompensa), sin desglose por voto, a pesar de que el JSON firmado HMAC ya trae `request_id`, `vote`, `voted_at` y `demo_vote_id` por cada voto.
- **Decisión (solo frontend — `frontend/src/pages/admin-panel.js`)**:
  - Forzar colores explícitos en `p`, `th`, `td` y fondos (`#FFFFFF`, `#F9FAFB`, etc.) para que el texto sea legible en cualquier tema del admin panel.
  - Por cada guardián, añadir botón "Ver votos / Ocultar votos" que expande una fila con el detalle firmado del archivo (`Solicitud`, `Voto`, `Fecha`, `Demo vote ID`). Sin `onclick` inline (binding con `addEventListener`) para mantener la política anti-XSS.
  - Fechas formateadas con `toLocaleString('es-ES', { timeZone: 'America/Bogota' })` y valores de voto traducidos a "Aprobar"/"Rechazar".
- **Alcance**: no altera `governanceDemoRewardService.js` ni el flujo de pago. La lógica de HMAC, `file_hash`, dedup y `record_booster_event` queda intacta. Si no se pulsa "Confirmar y Procesar Pagos", nada se acredita.
- **Impacto**: admin puede verificar "qué hizo cada guardián" antes de confirmar la importación; refuerza el control (Four-Eyes) y la auditabilidad operativa en cumplimiento del estándar bancario del proyecto.

---

### 2026-04-11 — Recompensas demo → producción: multiplicador de etapa booster aplicado + candado maker-checker

- **Problema detectado**: al procesar la importación de actividad de gobernanza exportada desde demo, el monto acreditado se calculaba únicamente como `votos × tasa_base`, **sin** aplicar el multiplicador de la etapa booster vigente. El flujo "voto real" sí lo aplicaba (`governanceRewardService` vía `boosterService.calculateMultipliedAmount`). Resultado: pagos demo subvaluados y falta de coherencia contable entre ambos caminos. Además, la preview del admin y el correo al guardián no mostraban el multiplicador, por lo que el admin no podía auditar visualmente el monto final antes de autorizar.
- **Decisión**:
  - En `governanceDemoRewardService.previewImport`: consultar `boosterService.calculateMultipliedAmount(baseRate)` y devolver por guardián `base_per_vote`, `multiplier`, `stage_name`, `total_base` y `total_reward` (ya multiplicado). También `summary.total_base` separado de `summary.total_amount` para mostrar el ahorro/incremento por multiplicador.
  - En `governanceDemoRewardService.processImport`: re-leer el multiplicador en el momento del pago (point-in-time) y acreditar `votos × base × multiplicador`. La descripción de `booster_transactions` y `transactions` incluye la fórmula `base × multiplier [stage]` — mismo formato que los pagos de voto real para facilitar auditoría en `history.html`. El registro `demo_reward_imports.metadata` persiste `base_rate`, `multiplier`, `stage_name`, `rate_per_vote` y `formula` completa.
  - **Candado optimista preview↔process** (Maker-Checker fuerte): la UI envía `expectedMultiplier` (valor visto en la preview) al endpoint `demo-import-process`. El backend recalcula antes de pagar; si cambió la etapa booster en ese intervalo, responde `409 MULTIPLIER_CHANGED` con el nuevo multiplicador/etapa. La UI invalida el estado pendiente y obliga a re-validar el archivo. Así, el admin nunca autoriza con una tasa y paga con otra.
  - **Auditoría**: evento `GOV_DEMO_REWARD_IMPORTED` registra `multiplier`, `stageName`, `finalRatePerVote` junto al `fileHash`, totales y guardianes afectados.
  - **Email al guardián**: detalles con `Tasa base por voto`, `Multiplicador (etapa)`, `Tasa final por voto`, `Subtotal base`, `Total acreditado` y `Nuevo saldo BLUE IOU` — mismo nivel de desglose que el email de voto real.
- **Alcance**:
  - JSON firmados previamente siguen siendo **válidos** para importar: contienen la identidad del guardián y la evidencia de sus votos; la tasa y el multiplicador se calculan al importar en producción, no se conservan en el archivo.
  - Pagos demo ya procesados (antes de este cambio) quedan **como están** (forward-only fix). Una compensación retroactiva, si se decide, se tramitará como un hito separado con su propia auditoría.
- **Impacto**:
  - Coherencia económica total entre flujo "voto real" y flujo "import demo": ambos aplican el multiplicador vigente en el pago.
  - Transparencia para el admin (preview con desglose completo) y para el guardián (correo con fórmula).
  - Trazabilidad contable futura: el registro `demo_reward_imports.metadata` guarda la fórmula exacta aplicada.
  - Seguridad: el candado de multiplicador elimina el riesgo de divergencia preview↔process cuando rotan etapas.
- **Archivos tocados**: `backend/src/services/governanceDemoRewardService.js` (import de `boosterService`, enriquecimiento de preview/process/metadata/audit), `backend/server.js` (endpoint `demo-import-process` con candado 409 + email enriquecido), `frontend/src/pages/admin-panel.js` (nuevo header económico, columnas `Base/voto`, `Multiplicador`, `Subtotal base`, `Total final` por guardián, envío de `expectedMultiplier`, manejo de 409 con re-validación).

---

### 2026-04-13 — Modularización de Infraestructura: Extracción de Entorno Android Nativo

#### Descripción
Se asienta en auditoría la remoción física de la subcarpeta `android-app` (App nativa y envoltorio PWA) del repositorio principal (`smart-contract`) para fines de aligeramiento, limpieza y modularización de la infraestructura operativa.

#### Impacto Técnico y Trazabilidad (Evaluación de Auditoría)
- **Frontend y Backend:** **Sin Impacto**. La eliminación de esta carpeta no afecta el despliegue del PWA, el servicio APIs de Node.js, las transacciones financieras en PostgresSQL ni el motor económico (BLUE IOU/RED). 
- **Ciberseguridad:** Los esquemas de protección y *Zero Hardcoded Secrets* se mantienen inalterados en la web.
- **Compilación Nativa:** La única consecuencia directa es que las compilaciones y firma de claves para el `.apk`/`.aab` en la Google Play Store quedan desacopladas de este monolito de desarrollo. Se deberá restablecer el código o ubicarlo en un repositorio remoto independiente para futuros lanzamientos nativos, cumpliendo con la separación recomendada (Frontend Web vs Mobile App nativa).

---

### 2026-04-14 — Protocolo de Multiplicadores de Booster + Modularización del Panel Admin

- **Contexto**: Para incentivar la participación temprana, se requería un sistema dinámico de multiplicadores (`BLUE IOU x Etapa`) que recompensara más a los usuarios en las fases iniciales del proyecto. Además, el backend administrativo residía en un monolito (`server.js`), lo que dificultaba la escalabilidad y auditoría.
- **Decisión**:
  - **Modularización Estricta**: Extracción de la lógica administrativa de `server.js` hacia `adminController.js` (funciones independientes, sin clases — previene bugs de `this` binding en Express) y `adminRoutes.js`.
  - **Protocolo de Compensación**: Implementación del `boosterService.js` con etapas y multiplicadores dinámicos según protocolo documentado en `boosters.wintoncoin.com`:
    - Etapa 1: Mayo–Oct 2025 → 20x
    - Etapa 2: Nov 2025–Abr 2026 → 15x
    - Etapa 3: May–Oct 2026 → 9x
    - Etapa 4: Nov 2026–Ene 2027 → 5x
    - Etapa 5: 1–14 Feb 2027 → 3x
  - **Integración en Gobernanza**: `creditVoteReward()` y `processPendingRewards()` aplican automáticamente: `Recompensa Final = Base * Multiplicador de Etapa`.
  - **Governance Guard**: Los multiplicadores son parámetros económicos protegidos — si hay guardianes activos, los cambios deben pasar por Winton-Consensus (Maker-Checker).
  - **Transparencia en Email**: El correo de recompensa al guardián ahora incluye el desglose: recompensa base, multiplicador aplicado, etapa y total acreditado.
  - **Auditoría Bancaria**: Cada `GOV_VOTE_REWARD_CREDITED` registra en metadata la fórmula completa: `{ baseReward, multiplierUsed, stageName, formula }`.
  - **Migración 050**: Tabla `booster_config_stages` con CASCADE, índice de rendimiento, idempotencia en inserción de datos iniciales, y validación de solapamiento de fechas en `boosterService.saveStage()`.
- **Impacto**:
  - **Escalabilidad**: Backend modular con funciones puras (sin `this` binding issues).
  - **Incentivación**: Multiplicadores aplicados automáticamente en recompensas de gobernanza y extensibles a otras actividades.
  - **Auditabilidad**: Trazabilidad completa base→multiplicador→total en ledger, audit log y correo.
  - **Seguridad**: Governance Guard, validación de solapamiento, idempotencia, fallback seguro (1.0x sin etapa).
- **Evidencia**: Migración `050_create_booster_stages.js`, `boosterService.js`, `adminController.js`, `adminRoutes.js`, `governanceRewardService.js`, `notificationEventBus.js`.

---

### 2026-04-14 — Auditoría End-to-End del Protocolo de Multiplicadores

- **Contexto**: Revisión profesional de todos los archivos modificados, verificando la cadena completa de ejecución desde la migración hasta el correo electrónico al guardián.
- **Hallazgos Corregidos**:
  - **ERROR CRÍTICO: Funciones broadcast faltantes en `adminController.js`**. Las rutas `POST /broadcast-email` y `GET /broadcast-email` referenciaban `adminController.createBroadcastEmail` y `adminController.getBroadcasts` que NO estaban definidas. Esto habría causado un crash `TypeError: undefined is not a function` al acceder a esos endpoints. Se añadieron ambas funciones (createBroadcastEmail como 501 pendiente de migración, getBroadcasts funcional).
  - Verificación completa de imports/exports en 10 archivos.
  - Verificación de registro de rutas en `server.js` (línea 170).
  - Verificación de endpoints frontend vs backend (admin-panel.js ↔ adminRoutes.js).
  - Verificación del `vite.config.js` para inclusión de `admin-panel.html`.
  - Verificación del `migrationRunner.js` para compatibilidad con patrón `up(client)`.
- **Resultado**: **Todos los checks pasaron**. El sistema está listo para despliegue con las notas de la funcionalidad broadcast pendiente de migración completa.
- **Evidencia**: Auditoría E2E documentada y archivada.

---

### 2026-04-14 — Auditoría de Seguridad Profesional (OWASP + Fintech)

- **Contexto**: Tercera revisión del código aplicando metodología OWASP Top 10 y evaluación de escenarios de ataque para endpoints administrativos de parámetros económicos.
- **Vulnerabilidades Encontradas y Corregidas**:
  1. **`id` de etapa sin sanitizar (ALTA)**: El campo `id` en `boosterService.saveStage()` controlaba la estructura de la query SQL (`${id ? 'AND id != $3' : ''}`). Aunque parametrizado, la decisión de incluir/excluir la cláusula dependía del valor crudo. **Fix**: `parseInt(id, 10)` + validación `isFinite && > 0`.
  2. **`userId` de URL params sin parseInt (MEDIA)**: En `updateUserStatus()`, `req.params.userId` se pasaba directamente a PostgreSQL sin sanitizar. **Fix**: `parseInt + validación isFinite`.
  3. **Sin límite superior en multiplicador (MEDIA)**: Un admin podía poner multiplicador `999999` accidentalmente. **Fix**: `MAX_MULTIPLIER = 100` como guardrail económico con mensaje de error descriptivo.
  4. **Pattern matching incompleto en error handler**: Los nuevos mensajes de error (`exceder`, `inválido`) no eran capturados como errores 400. **Fix**: Array de patrones ampliado.
- **Escenarios Evaluados**: 8 escenarios de uso (happy path + edge cases), 14 vectores de ataque (SQL injection, broken access control, authentication failures, business logic flaws).
- **Evidencia**: Auditoría de seguridad documentada con checklist OWASP, defensa en profundidad verificada (7 capas).

---

### 2026-04-30 — PWA Install: Refactorización modular + botón en Configuración

- **Contexto**: El módulo de instalación de la PWA (`pwa-install.js`) presentaba varios problemas:
  1. Estilos CSS mezclados con lógica JS (violación de Separation of Concerns).
  2. Detección defectuosa de iPads modernos (iPadOS 13+ se identifica como "Macintosh").
  3. Inyección de texto con `innerHTML` en el modal de instrucciones (riesgo XSS).
  4. Sin opción de "segunda oportunidad" para instalar la app si el usuario descartaba el botón flotante.
  5. Detección de página basada solo en extensión `.html` (frágil ante rutas limpias futuras).
- **Decisión**:
  - **Separar estilos a CSS** (`src/styles/pwa-install.css`): todos los estilos del botón flotante, botón grande de registro, modal de instrucciones y sección de configuración extraídos del JS.
  - **Corregir detección de iPad**: Usar `navigator.maxTouchPoints > 1` además del User Agent para detectar iPads modernos que se disfrazan de Mac.
  - **Prevención XSS**: Reemplazar `innerHTML` por `textContent` y DOM API (`createElement`) para inyección segura de contenido.
  - **Botón "Descargar App" en Configuración**: Nueva sección dentro del modal de ⚙️ Configuración del dashboard con botón dinámico que se desactiva automáticamente si la PWA ya está instalada. Reacciona en tiempo real al evento `appinstalled`.
  - **Detección de URL mejorada**: Soporta rutas con y sin extensión `.html` para compatibilidad futura.
- **Rama**: `feature/pwa-install-improvements` (aislada de `feature/web3-wallet`).
- **Archivos creados**:
  - `frontend/src/styles/pwa-install.css` — Estilos extraídos y documentados línea por línea.
- **Archivos modificados**:
  - `frontend/src/modules/pwa-install.js` — Refactorización completa, nuevas exportaciones `initSettingsInstallButton()` y `updateSettingsInstallButton()`.
  - `frontend/contract_interaction.html` — Sección "📲 Descargar App" en modal de Configuración.
  - `frontend/src/pages/contract-interaction.js` — Import y llamada a `initSettingsInstallButton()`.
- **Impacto**:
  - Código 100% modular y auditable (CSS separado del JS).
  - iPads modernos reciben instrucciones correctas de instalación para iOS.
  - Seguridad reforzada contra XSS en inyección de texto dinámico.
  - UX mejorada: usuarios que descartaron el botón flotante pueden instalar desde Configuración.
  - Estándar de industria (Twitter/X, Starbucks, Spotify usan el mismo patrón de doble opción).
- **Evidencia (commits)**: pendiente de push.

---

### 2026-05-02 — Infraestructura Web3 y Scoring Conductual (Migración 050)

- **Contexto**: El sistema requería una base sólida para el almacenamiento de billeteras Web3 y la configuración del Scoring de Crédito RED (WTS) en el entorno de producción/demo.
- **Decisión**:
  - Implementar la **Migración 050** para añadir las columnas `web3_wallet_address` y `web3_private_key_encrypted` a la tabla `users`.
  - Registrar las variables maestras de Scoring en `app_settings` (base 100, bonos por referido/actividad) para permitir ajustes sin redespliegue.
  - Asegurar la **idempotencia** de la migración para despliegues seguros en Render.
- **Impacto**:
  - Habilitación del sistema de "Bóvedas Invisibles" para usuarios.
  - Sincronización automática de límites de crédito entre DB y Smart Contracts.
- **Evidencia**: Archivo de migración `050_add_web3_wallet_and_scoring_settings.js` desplegado y ejecutado.

---

### 2026-05-02 — Despliegue de WintonProtocol en Optimism Sepolia (Testnet Pública)

- **Contexto**: El entorno Demo necesitaba operar bajo estándares profesionales de la industria Web3 (Staging real), abandonando simulaciones locales (`localhost`) para conectarse a una Blockchain pública.
- **Decisión**:
  - Compilación y despliegue del contrato inteligente `WintonProtocol.sol` en la red de Capa 2 **Optimism Sepolia**.
  - Configuración de un nodo RPC mediante **Alchemy** para el puente de comunicación.
  - Implementación de una billetera segura de despliegue ("Deployer Demo") actuando como el **Relayer** autorizado del protocolo.
- **Impacto**:
  - La aplicación (Demo) ahora es una DApp 100% funcional y auditable on-chain.
  - Los pagos (Off-chain) y el Scoring de Crédito WTS se sincronizan de forma segura con la Testnet sin costo de gas para el usuario final ("Cero Fricción").
- **Evidencia**: 
  - Contrato desplegado en la dirección: `0x0066269E090a38618A24A1fB65b52AEBBa3c00C4`

---

### 2026-05-01 — Rediseño del Banner de Referidos (Booster Edition)

- **Contexto**: El botón de compartir código de referido tenía una estética desalineada con el resto del ecosistema "Booster" (Impulsor). Tras iterar con Montserrat, se detectó que el "molde" de la letra no encajaba con la seriedad fintech buscada.
- **Decisión**:
  - Implementar un diseño **Azure Glass** con la tipografía **Inter** (UI Premium).
  - Adoptar Inter por su molde más estilizado, vertical y compacto, ideal para interfaces Web3.
  - Aplicar `backdrop-filter: blur(16px)` para lograr un efecto de cristal esmerilado.
  - Mantener el dorado para los valores numéricos con peso `800` (Extra Bold) para máxima legibilidad sobre el vidrio.
- **Impacto**:
  - Estética profesional de alto nivel, alineada con estándares de industria.
  - Mayor densidad de información sin sacrificar la elegancia.
- **Evidencia**: Rediseño aplicado en `style.css` con tipografía Inter y nuevo icono de nodos estilo WhatsApp en `contract_interaction.html`.

---

### 2026-05-08 — Migración a EIP-7702 (Pectra/Isthmus) + Auditoría de Seguridad Profunda

- **Contexto**: Los Smart Contracts (BlueToken, RedToken, WintonProtocol, WintonTreasury) usaban ERC-2771 (meta-transacciones de primera generación). Optimism activó EIP-7702 (Pectra/Isthmus) en mayo 2025, habilitando el estándar más moderno de Account Abstraction sin necesidad de Trusted Forwarder.
- **Decisión**:
  - **Migración a EIP-7702**: Eliminar `ERC2771Context` de WintonProtocol y WintonTreasury. Con EIP-7702, `msg.sender` ES la dirección real del usuario (la red lo resuelve nativamente). Se eliminaron los 3 overrides de contexto (`_msgSender`, `_msgData`, `_contextSuffixLength`).
  - **Relayer explícito**: Añadir variable `relayer` separada del Owner. `processPayment` ahora recibe `payer` como parámetro (verificado por el backend), protegido por `onlyRelayerOrOwner`.
  - **Vigilante de Auto-Amortización**: Implementar hook en `BlueToken._update()` que llama a `WintonProtocol.triggerAutoAmortize(receptor)` en cada recepción de BLUE. Esto cierra la vulnerabilidad de transferencia directa que permitía acumular BLUE y RED simultáneamente.
  - **Optimización de gas**: Lista de direcciones exentas del vigilante (Treasury, Protocol) + eliminación de llamada redundante a `_autoAmortize` en `processPayment`.
  - **Circuit Breaker**: Añadir `maxTransactionAmount` (1M BLUE) como límite por transacción individual.
  - **Bloqueo de `renounceOwnership()`**: Sobreescrito en los 4 contratos para prevenir que el protocolo quede huérfano accidental o maliciosamente.
- **Auditoría de Seguridad**: Se probaron 20+ escenarios de ataque incluyendo: bypass del backend, reentrada, overflow, dust attack, impersonación del relayer, front-running de Merkle root, ataque de polvo, envío de ETH directo, y compromiso de llave del Owner. Cero vulnerabilidades encontradas.
- **Impacto**:
  - Contratos más simples (menos herencia, menos código ejecutable, menor superficie de ataque).
  - Gas reducido (~5,000 gas menos por transacción al eliminar overrides de contexto).
  - Compatibilidad con el estándar más moderno de la industria (EIP-7702, mayo 2025).
  - Regla Materia-Antimateria ahora es matemáticamente inviolable sin importar el origen de los tokens.
- **Evidencia**: Compilación exitosa con Hardhat 2.28.6, OpenZeppelin v5.6.1, Solidity 0.8.24.

#### ⚠️ MEJORAS FUTURAS (Pre-Producción):

1. **Sistema de Roles con AccessControl (OpenZeppelin)**:
   - `KYC_MANAGER_ROLE` → Backend automático (sin multifirma) para `setKYCStatus`.
   - `FINANCIAL_ADMIN_ROLE` → Gnosis Safe multifirma para cambios de comisión, retiro de excedentes, cambio de Relayer.
   - `EMERGENCY_ROLE` → Cualquier firmante individual del Safe puede pausar (velocidad crítica en emergencias).
2. **Gnosis Safe Multisig como Owner**: Transferir ownership a un Safe (3/5 multifirma) antes de ir a mainnet.
3. **Timelock en cambios financieros**: Agregar un contrato Timelock (24-48h de espera) para cambios de comisión y retiros del Treasury, dando tiempo a la comunidad de reaccionar.
4. **Evaluación de EIP-7702 nativo**: Cuando el ecosistema de SDKs (Pimlico, ZeroDev) madure, implementar transacciones patrocinadas tipo 0x04 directamente desde el frontend.

---    
### 2026-05-04 — Estado de Cuenta Web3 (Auditoría Financiera)

- **Contexto**: La página principal de la billetera debía mantenerse simple para las transacciones diarias, pero se necesitaba un espacio profesional para mostrar métricas financieras y Web3, el límite de crédito RED, equivalencia fiat y estadísticas transaccionales, cumpliendo estándares de auditoría.
- **Decisión**:
  - Implementar un diseño de "Divulgación Progresiva" (Progressive Disclosure) creando la nueva página `estado-cuenta.html`.
  - Agregar la Llave Pública con estado de conexión a la red "Optimism Sepolia" y enlace directo al Explorador de Bloques.
  - Mostrar el detalle de la Línea de Crédito RED y estructurar vencimientos a 30 días y a fin de mes.
  - Mostrar la Liquidez BLUE detallando fondos disponibles vs bloqueados (escrow) y su fecha de liberación.
  - Generar un bloque de estadísticas de actividad de red (interacciones, enviadas, recibidas).
- **Impacto**: 
  - Mayor transparencia técnica y financiera sin ensuciar la UX principal de la billetera.
  - Interfaz estandarizada a la de plataformas como Binance y Coinbase.
- **Evidencia**: Archivos creados `estado-cuenta.html`, `estado-cuenta.js` e inclusión en `vite.config.js`.

---

### 2026-05-08 — Integración Gobernanza → Blockchain (Winton-Consensus + Web3 Bridge)

- **Contexto**: Los Smart Contracts desplegados en Optimism Sepolia tienen funciones administrativas (`pause`, `setMaxTransactionAmount`, `setFoundersWallet`, `withdrawSurplus`) que solo se podían ejecutar por consola de Hardhat. Se necesitaba integrarlas con el sistema de gobernanza Winton-Consensus existente para que los guardianes pudieran gestionarlas con multifirma, votación y auditoría.
- **Decisión**:
  - **Ampliar `web3BridgeService.js`**: Reescribir con ABI completa del protocolo y treasury. Agregar funciones para `pauseProtocol`, `unpauseProtocol`, `setMaxTransactionAmount`, `setFoundersWallet`, `withdrawSurplus` y `getProtocolStatus` (lectura sin gas).
  - **Integrar en `_executeAction` de `governanceService.js`**: Después de actualizar `app_settings`, si el `target_key` empieza con `web3_`, ejecutar la operación blockchain correspondiente vía el bridge. El tx_hash se guarda en `audit_log` y en `governance_requests.metadata`.
  - **Catálogo de settings** (`settingsDisplayMap.js`): Agregar las 4 opciones Web3 con etiquetas en español para que aparezcan en el formulario de gobernanza.
  - **Migración 052**: Insertar los 4 registros de `app_settings` con valores iniciales que coinciden con los Smart Contracts desplegados.
- **Impacto**:
  - Los guardianes pueden gestionar los Smart Contracts desde el panel de gobernanza existente, sin tocar consola.
  - Cada cambio on-chain queda registrado con tx_hash en el audit_log (trazabilidad completa DB + Blockchain).
  - El formulario de solicitud existente se reutiliza sin cambios de frontend.
- **Evidencia**: Archivos modificados: `web3BridgeService.js`, `governanceService.js`, `settingsDisplayMap.js`. Migración `052_add_web3_governance_settings.js`.

---

### 2026-05-16 — Sistema KYC Compliance (Freno Pre-Publicación + Admin Panel On-Chain)

- **Contexto**: El Smart Contract `WintonProtocol` exige que las billeteras del pagador tengan KYC verificado on-chain (`isKYCVerified`). Sin una validación previa en el backend, los usuarios podían crear publicaciones tipo "request" (que implican pago) y los trabajadores invertían tiempo en tareas que luego fallaban al intentar cobrar, generando un `CALL_EXCEPTION: Payer KYC not verified`. Además, se detectó un deadlock de base de datos (self-deadlock) por uso de `pool.query` dentro de transacciones activas con `client.query` (bloqueo `FOR UPDATE`).
- **Decisión**:
  - **Corrección de Deadlock (Patrón Outbox)**: Reemplazar todas las llamadas a `pool.query` por `client.query` dentro de `processRequestPayment` y `processDirectPaymentCompletion` en `publicationService.js`, asegurando que las operaciones de auditoría se ejecuten en la misma conexión transaccional.
  - **Freno KYC Pre-Publicación**: En `publicationController.js`, antes de permitir la creación de publicaciones tipo `request`, se consulta directamente la blockchain (`isKYCVerified`) para verificar el KYC del autor (o su tutor si es menor de edad). Si no tiene KYC → se bloquea la publicación con HTTP 403. Política Fail-Safe: ante duda, se bloquea.
  - **Método `checkUserKYC()` en `web3BridgeService.js`**: Lectura gratuita (sin gas, función `view`) con timeout de 3 segundos para no congelar el servidor si Alchemy está caído.
  - **Método `setUserKYC()` en `web3BridgeService.js`**: Escritura on-chain (`setKYCStatus`) con prevención de revert (verifica estado actual antes de gastar gas), validación de dirección Ethereum y tipo booleano explícito.
  - **Endpoint Admin `POST /api/governance/kyc`**: Protegido por `verifyAdminToken`. Valida usuario/wallet, ejecuta la operación blockchain, y registra TODA la acción en `audit_log` con IP, user-agent, wallet, txHash, timestamp y resultado (éxito o fracaso). Categoría: `compliance`.
  - **Panel de Administración (Frontend)**: Nueva sección "🔐 KYC" en `admin-panel.html` con formulario de búsqueda de usuario, visualización de estado KYC, y botones de "Aprobar" / "Revocar" con diálogo de confirmación. Listeners protegidos contra doble-clic y registro duplicado.
- **Arquitectura preparada para proveedores externos**: El método `setUserKYC()` es la pieza final del rompecabezas. Hoy lo llama un admin manualmente. Mañana, un webhook de Onfido/Jumio/Sumsub llamará al mismo endpoint sin cambios en el Smart Contract ni en el freno de publicaciones.
- **Impacto**:
  - Eliminación de deadlocks de base de datos.
  - Los trabajadores nunca más perderán tiempo en tareas impagables.
  - Cumplimiento de normativa KYC/AML: sin verificación, sin transacciones financieras.
  - Trazabilidad bancaria completa: toda operación KYC queda en `audit_log` y en la blockchain.
- **Evidencia**: Archivos modificados: `publicationService.js`, `web3BridgeService.js`, `publicationController.js`, `governanceController.js`, `governanceRoutes.js`, `admin-panel.html`, `admin-panel.js`.

---

### 2026-05-17 — Defensa en Profundidad KYC (Freno en Aceptación de Tareas + Propagación de Errores Web3)

- **Contexto**: El Smart Contract `WintonProtocol` tiene una regla de cumplimiento financiero estricta (AML/KYC): exige que **TANTO el Payer (pagador) COMO el Payee (trabajador/beneficiario)** tengan su KYC verificado on-chain (`isKYCVerified`). Aunque se había implementado un freno pre-publicación para el autor, los trabajadores sin KYC podían aceptar tareas, invertir tiempo y completarlas. Al momento de confirmar el pago, el Smart Contract revertía con `WintonProtocol: Payee KYC not verified`. Al capturarse el error de forma genérica en el backend, el usuario veía un mensaje inespecífico en pantalla, generando confusión y falsos reportes de error en el autor.
- **Decisión**:
  - **Freno KYC Preventivo (Capa 1 - Fail-Fast)**: En `publicationController.js`, se modificó el endpoint `POST /publications/:id/accept`. Si la publicación implica remuneración (`request`), se consulta la blockchain para verificar que la wallet del trabajador (o la de su tutor si es menor de edad) tenga el KYC aprobado on-chain. Si no lo tiene, se bloquea la aceptación con HTTP 403 y un mensaje claro indicando que debe verificar su identidad antes de realizar trabajos pagados.
  - **Propagación Exacta de Errores Web3 (Capa 2 - Defensa en Profundidad)**: En `web3BridgeService.js`, se modificó `syncPaymentToBlockchain` para no silenciar los errores de revert de la blockchain con `return null`, sino propagar la excepción (`throw error`).
  - **Manejo de Errores en `publicationService.js`**: En `processRequestPayment` y `processDirectPaymentCompletion`, se implementó un bloque `try...catch` específico para analizar el mensaje de error de Web3. Si contiene `Payee KYC not verified`, `Payer KYC not verified` o errores de gas (`insufficient funds`), se arroja un mensaje HTTP 502 preciso y en español para mostrarse en el frontend, y se guarda el motivo exacto en la tabla `web3_pending_transactions`.
- **Impacto**:
  - **Cero Trabajo Perdido**: Los trabajadores sin KYC no pueden iniciar tareas remuneradas, garantizando que todo el que trabaja cobrará sin problemas técnicos ni legales.
  - **Claridad Total en UX**: Si por algún motivo de auditoría se revoca un KYC a mitad de camino, el autor verá en su pantalla el motivo exacto del rechazo de la blockchain.
  - **Trazabilidad de Errores**: La base de datos registra el motivo exacto del fallo de sincronización Web3 en el patrón Outbox.
- **Evidencia**: Archivos modificados: `publicationController.js`, `publicationService.js`, `web3BridgeService.js`, `EVOLUCION.md`.

---

### 2026-05-17 (Parte 3) — Resiliencia KYC en Base de Datos (Migración 055) y Optimización de Inputs de Búsqueda Admin

- **Contexto**: Tras las auditorías de UX y Web3, el usuario identificó dos problemas críticos en el entorno de demostración. Primero, el campo de búsqueda de usuario en el panel KYC de administración se comprimía y resultaba muy pequeño para escribir debido a que el botón adyacente tomaba el 100% del ancho por herencia global. Segundo, en la tarjeta de Identidad Web3, el estatus KYC aparecía erróneamente como "Pendiente de Aprobación" para usuarios que ya habían sido aprobados previamente, debido a que los reinicios del nodo local de blockchain (Anvil/Hardhat) borraban el estado en memoria de los contratos inteligentes, provocando que las consultas on-chain (`isKYCVerified`) retornaran `false`.
- **Decisión**:
  - **Optimización de Inputs de Búsqueda (`admin-panel.html` y `admin-style.css`)**: Se reestructuró el contenedor flex del campo de búsqueda KYC con `flex-wrap: wrap` y se asignaron anchos mínimos explícitos (`min-width: 250px` al input y `min-width: 150px` al botón) para evitar la compresión. Además, se redefinió la clase `.admin-input-dark` para renderizar un recuadro blanco amplio, luminoso y espacioso (`padding: 14px 18px; font-size: 1.1rem; background-color: #ffffff`) con texto oscuro, asegurando máxima visibilidad al escribir.
  - **Migración 055 (Respaldo KYC en Base de Datos)**: Se creó el archivo `055_add_kyc_verified_to_users.js` para inyectar la columna `kyc_verified BOOLEAN DEFAULT FALSE` en la tabla `users`, dotando al sistema de una caché local resiliente.
  - **Sincronización Transaccional (`governanceController.js`)**: Al aprobar o revocar KYC desde el panel de administración, el controlador ahora actualiza `users.kyc_verified` en la base de datos de forma paralela a la transacción on-chain, con lógica de fallback automática para entornos de desarrollo y demostración.
  - **Mecanismo de Fallback Robusto (`server.js` y `publicationController.js`)**: En los endpoints de balance (`/api/me/balance`) y en los frenos de publicación/aceptación de tareas, se implementó una verificación de respaldo: si la consulta on-chain `Web3BridgeService.checkUserKYC` retorna `false` por reinicios del nodo o timeouts del RPC, el sistema consulta `users.kyc_verified` en la base de datos para mantener la consistencia inmutable en la interfaz de usuario.
- **Impacto**:
  - **UX Impecable y Amplia**: Los administradores disponen de campos de texto grandes, cómodos y perfectamente visibles para ingresar nombres de usuario.
  - **Resiliencia Total ante Reinicios Web3**: El estatus KYC en la Identidad Web3 y los permisos de publicación se mantienen estables y correctos incluso si el nodo local de blockchain se reinicia o pierde conexión.
- **Evidencia**: Archivos modificados/creados: `055_add_kyc_verified_to_users.js`, `governanceController.js`, `server.js`, `publicationController.js`, `admin-panel.html`, `admin-style.css`, `EVOLUCION.md`.

---

### 2026-05-18 — Resolución de Colisión Semántica KYC vs Email OTP en Winton Solidario (Migración 056)

- **Contexto**: Durante la revisión de la arquitectura de resiliencia KYC (Migración 055), el usuario identificó una colisión conceptual e inconsistencia en el uso de la columna heredada `is_verified`. Tras un rastreo exhaustivo en el código base, se confirmó que `authController.js` y `register.js` utilizaban `is_verified` para representar la **Verificación de Correo Electrónico (OTP)**, marcándola como `TRUE` en cuanto el usuario completaba su registro. Sin embargo, el módulo de donaciones humanitarias (`humanitarianService.js`) y el Trigger de base de datos de la migración 039 (`fn_release_humanitarian_donations`) asumían erróneamente que `is_verified` representaba la **Verificación KYC Web3 aprobada por Admin**. Esto generaba un fallo de seguridad silencioso: todos los usuarios registrados tenían `is_verified = TRUE`, evadiendo el estado de retención (`on_hold`) y liberando fondos de Winton Solidario a usuarios sin KYC en la blockchain.
- **Decisión**:
  - **Separación Semántica Estricta (Opción 1)**: Se decidió mantener `is_verified` exclusivamente para la verificación de correo electrónico (OTP) en el flujo de registro/login, y utilizar la nueva columna `kyc_verified` (introducida en la migración 055) exclusivamente para el estatus KYC Web3.
  - **Migración 056 (`056_update_solidario_trigger_to_kyc_verified.js`)**: Se creó una nueva migración para actualizar la función PL/pgSQL `fn_release_humanitarian_donations`. El Trigger ahora evalúa exclusivamente cambios en `kyc_verified` (`OLD.kyc_verified IS DISTINCT FROM NEW.kyc_verified AND NEW.kyc_verified = true`) para liberar las donaciones en estado `on_hold`.
  - **Refactorización de `humanitarianService.js`**: Se modificaron las consultas SQL en `donateToCause` y `getCauseDonations` para verificar `kyc_verified` en lugar de `is_verified`, y se actualizaron todos los comentarios arquitectónicos del servicio para reflejar la separación de responsabilidades.
- **Impacto**:
  - **Auditoría Fintech y AML Impecable**: Se establece una barrera clara e inmutable entre un dato de contacto verificado (Email) y una acreditación de identidad financiera y legal gubernamental (KYC Web3).
  - **Cierre de Brecha en Winton Solidario**: Las donaciones humanitarias de usuarios sin KYC Web3 ahora quedan correctamente retenidas en estado `on_hold` y solo se liberan cuando un administrador aprueba legítimamente el KYC on-chain y en la base de datos.
- **Evidencia**: Archivos modificados/creados: `056_update_solidario_trigger_to_kyc_verified.js`, `humanitarianService.js`, `EVOLUCION.md`.

---

### 2026-05-18 (Parte 2) — Exención Dinámica de KYC Web3 en Modo Pre-lanzamiento

- **Contexto**: Durante la evaluación arquitectónica predictiva del despliegue a Producción (merge a `main`), el usuario identificó un riesgo crítico de denegación de servicio lógica (bloqueo masivo) para la comunidad de Impulsores. En Producción, la plataforma opera en Modo Pre-lanzamiento (`pre_launch_mode_enabled = 'true'`), donde toda la actividad económica de tareas se registra off-chain en el Libro de Impulsores (puntos BLUE IOU) sin requerir gas ni interacción con contratos inteligentes Web3. Sin embargo, las barreras KYC recientemente implementadas en `createPublication` y `acceptPublication` consultaban y exigían KYC Web3 para todas las tareas de tipo `request` de forma incondicional. Como resultado, al hacer el merge a producción, cualquier usuario existente (`kyc_verified = FALSE`) habría quedado bloqueado al intentar publicar o aceptar tareas remuneradas en BLUE IOU.
- **Decisión**:
  - **Exención Dinámica en Pre-lanzamiento (Opción 1)**: En `publicationController.js`, se condicionaron los frenos KYC de creación y aceptación de tareas para que solo se ejecuten si la plataforma **NO** está en Modo Pre-lanzamiento (`settings.pre_launch_mode_enabled !== 'true'`).
  - **Armonización de Reglas de Cumplimiento**: Se establece una distinción clara entre la actividad de fomento comunitario off-chain (exenta de KYC para eliminar fricción de adopción) y las donaciones de crowdfunding en Winton Solidario (donde se mantiene el KYC obligatorio para prevenir granjas de bots y lavado de puntos).
- **Impacto**:
  - **Cero Interrupción en Producción**: Los miles de usuarios de la comunidad de Impulsores pueden continuar publicando, aceptando y completando tareas en BLUE IOU sin ningún tipo de bloqueo o fricción técnica.
  - **Transición Futura Automatizada**: En el momento en que administración desactive el Modo Pre-lanzamiento (`pre_launch_mode_enabled = 'false'`), el candado KYC Web3 se activará de forma instantánea y automática para todo el marketplace.
- **Evidencia**: Archivos modificados: `publicationController.js`, `EVOLUCION.md`.
