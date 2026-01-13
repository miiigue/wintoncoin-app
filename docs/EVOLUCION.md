# Evolución del proyecto (historia técnica + decisiones)

Este documento explica **cómo y por qué** evolucionó el código (decisiones, trade-offs y impacto).  
Para el detalle “tipo release”, ver `CHANGELOG.md`.

## Cómo leer este documento

- **Hitos**: cambios grandes que alteran comportamiento, seguridad o arquitectura.
- **Evidencia**: commits (hash corto) que anclan cada cambio al historial real.
- **Impacto**: qué problema resolvió y qué habilita hacia adelante.

## Línea de tiempo (hitos)

### 2025-07-15 — Donaciones: categoría dedicada (UI + lógica)

- **Contexto**: “donación” es un tipo de publicación distinto (no es venta ni solicitud). Si se trata como genérico, la UX y las reglas se vuelven confusas.
- **Decisión**: crear categoría de donaciones con estilos y lógica específica en frontend, con soporte backend donde aplica.
- **Impacto**: mejor claridad para usuarios al publicar/consumir donaciones.
- **Evidencia (commits)**: `ddf788a`.

### 2025-07-18 — Onboarding: bono de bienvenida y estado de impulsor

- **Contexto**: si el usuario recibe un bono inicial pero su “perfil de impulsor” no refleja saldo/estado, la experiencia se siente rota y genera desconfianza.
- **Decisión**: implementar bono de bienvenida y asegurar que el backend actualice el estado/balance asociado al programa de impulsores.
- **Impacto**: onboarding más consistente; el usuario ve beneficios reflejados desde el inicio.
- **Evidencia (commits)**: `bc867c6`.

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

### 2025-07-24 — Recompensas: bonos de registro “gateados” por pre-launch

- **Contexto**: si los bonos se aplican fuera de la fase esperada, se rompe el control de emisión y la narrativa económica.
- **Decisión**: condicionar (gate) UI/flujo de bonos de registro a que el modo pre-launch esté habilitado.
- **Impacto**: reglas más consistentes según fase.
- **Evidencia (commits)**: `5c51b4e`.

### 2025-08-30 — Seguridad/UX: advertencia obligatoria para donaciones

- **Contexto**: donaciones requieren claridad explícita para evitar confusiones (“esto no es una venta”, “no hay reembolso”, etc.).
- **Decisión**: modal de advertencia obligatorio al crear publicaciones de donación.
- **Impacto**: menos malentendidos y menos soporte manual.
- **Evidencia (commits)**: `0e0a3e5`.

### 2025-09-11 — Registro: verificación por SMS

- **Contexto**: la verificación de identidad/contacto es clave para reducir fraude y mejorar calidad de cuentas.
- **Decisión**: incorporar verificación por SMS en registro (backend + UI de registro).
- **Impacto**: mayor seguridad y mejor control de cuentas.
- **Evidencia (commits)**: `45f50d6`.

### 2025-11-04 — Correcciones de DB por deriva de esquema (documentado por chat)

- **Contexto**: errores críticos en admin y confirmación de pagos por columnas faltantes o valores `NULL` en columnas `NOT NULL`.
- **Decisión**: aplicar estrategia de “auto-repair” con migraciones idempotentes y asegurar que inserciones críticas incluyan `user_id` (obtenido antes de insertar).
- **Impacto**: menos caídas en producción por “schema drift”, y más integridad referencial.
- **Evidencia**:
  - Documento: `docs/RESUMEN_CHAT_2025-11-04.md` (este hito está descrito ahí).
  - Nota: el commit exacto de este chat no está referenciado en el resumen; por eso aquí lo tratamos como “documentado” más que como release con hash.

### 2025-11-05 — Refactor DB: `transactions` migra a `user_id`

- **Contexto**: usar `username` como llave en tablas transaccionales crea problemas de integridad, cambios de username, y joins frágiles.
- **Decisión**: migrar `transactions` a `user_id` como clave estable (y ajustar backend/front donde aplica).
- **Impacto**: base de datos más consistente y consultas más seguras.
- **Evidencia (commits)**: `4992766`.

### 2025-11-21 — Gobernanza de referidos (expiración configurable)

- **Contexto**: los referidos sin expiración se vuelven difíciles de controlar y auditar (abuso, campañas viejas, inconsistencias).
- **Decisión**: implementar expiración y exponer configuración/admin + ajustes en frontend.
- **Impacto**: control operativo del crecimiento y reducción de fraude.
- **Evidencia (commits)**: `f1d1565`.

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

### 2025-11-23 a 2025-11-27 — Estabilización del schema + endpoints admin + validaciones en registro

- **Contexto**: después de cambios profundos de DB, suelen aparecer desalineaciones entre columnas reales y el código.
- **Decisión**:
  - Sincronizar columnas (`account_status`, `booster_level_settings`, `tutor_user_id`) y scripts de reset/migración.
  - Mejorar calidad de datos y UX con validaciones en tiempo real (email, username, phone).
- **Impacto**:
  - Menos errores por columnas faltantes/renombradas.
  - Menos fricción de registro y menos usuarios “mal formados”.
- **Evidencia (commits)**: `6a132e4`, `b3efff1`, `8fd9e91`, `8079fe9`, `5babf26`, `f8c2f82`, `8ff741e`, `438bb9e`, `9026626`, `3717c29`.

### 2025-11-28 a 2025-11-29 — UX y resiliencia del registro

- **Contexto**: registros fallidos (timeouts / refresh / navegación) generan abandono y soporte manual.
- **Decisión**: recuperación robusta con persistencia de estado + validación backend; pulido de mensajes/contraste.
- **Impacto**: mayor tasa de conversión y menor frustración del usuario.
- **Evidencia (commits)**: `b497d59`, `59cd196`.

### 2025-12-01 a 2025-12-03 — Marco legal/auditoría (documentos + logs inmutables)

- **Contexto**: para productos con economía interna, la parte legal y su auditoría tiene que ser reproducible y verificable.
- **Decisión**:
  - Poblar documentos legales en DB.
  - Implementar auditoría legal inmutable y carga dinámica de documentos.
  - Asegurar triggers y lógica server para evitar alteraciones indebidas.
- **Impacto**: “compliance” más serio, mejor defensa ante disputas y cambios controlados.
- **Evidencia (commits)**: `97bbe34`, `93365d2`, `a819aa6`, `3ce3d3e`.

### 2025-12-04 a 2025-12-05 — Controles operativos + mejoras de login/registro

- **Contexto**: se necesitaba control admin sobre features sensibles (p. ej. “Venta Rápida”) y mejorar UX básica.
- **Decisión**:
  - Switch admin para controlar “Venta Rápida” y proteger el endpoint.
  - Toggle de visibilidad de contraseña y limpieza de scripts inline redundantes.
  - Ajustes de texto/checkboxes en términos.
- **Impacto**: operación más segura y UX más amigable sin tocar arquitectura.
- **Evidencia (commits)**: `1159951`, `62ca67c`, `fc81164`, `b5c78ca`, `a0e111e`.

### 2025-12-11 — Reglas económicas más claras (Pre/Post-Launch)

- **Contexto**: reglas económicas confusas generan bugs, disputas y mal uso.
- **Decisión**: documentar/ordenar reglas por fases; definir BLUE IOU y comisiones con más precisión.
- **Impacto**: base de negocio más fácil de implementar, testear y explicar.
- **Evidencia (commits)**: `a64ac44`.

### 2025-12-29 — App Android inicial

- **Contexto**: expansión de plataforma: cliente móvil con auth segura y flujo de publicación.
- **Decisión**: app Android inicial con arquitectura básica (auth, dashboard, publicación) y utilidades como biometría.
- **Impacto**: habilita pruebas móviles tempranas y validación del backend desde otro cliente.
- **Evidencia (commits)**: `c3effb0`.

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

### 2026-01-06 — Publicaciones auditables y mejor admin (soft delete + filtros + restore)

- **Contexto**: borrar físicamente registros rompe auditoría y puede romper relaciones (FK).
- **Decisión**: soft delete (`deleted_at`) y herramientas de admin para filtrar/restore.
- **Impacto**: auditoría preservada y operaciones admin más seguras.
- **Evidencia (commits)**: `9c2cc76`, `1ce9312`.

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

