# Changelog

Este archivo resume la evolución del proyecto **por hitos** a partir del historial de Git.

- Formato inspirado en *Keep a Changelog*
- Este repo todavía **no usa tags/versiones**; cuando empecemos a taggear (`v0.1.0`, `v0.2.0`, etc.) este changelog se puede reordenar por versión.
- Ordenado **cronológicamente**: del cambio más antiguo al más reciente.

## [Unreleased]

- Pendiente: definir primer versión/tag y automatizar generación del changelog desde commits.

## [2026-04-11]

### Changed
- Gobernanza — cambios de **membresía**: el time-lock (`gov_timelock_hours`) se programa en la base de datos **al alcanzar el quórum de aprobación** (`NOW() + interval` en PostgreSQL), no al crear la solicitud. Evita ejecución casi inmediata cuando el quórum llega tarde respecto a la fecha calculada al crear.
- Textos de admin, seed de configuración y correo `GOV_REQUEST_CREATED` alineados: sin fecha de ejecución en membresía hasta aprobar; mensaje explícito en panel de gobernanza para solicitudes `pending` sin `execution_time`.
- **Recompensas demo → producción**: la importación de actividad de gobernanza desde demo ahora aplica el **multiplicador de la etapa booster vigente** al momento del pago (`boosterService.calculateMultipliedAmount`), igual que el flujo real de voto. Tasa final por voto = `tasa base × multiplicador`.
- Preview de importación en el panel de admin: muestra Base/voto, Multiplicador (con nombre de etapa), Subtotal base y Total final por guardián. Correo del guardián incluye el desglose completo (base × multiplicador = final).
- Persistencia en `demo_reward_imports.metadata`: se guardan `base_rate`, `multiplier`, `stage_name`, `rate_per_vote` y `formula` para trazabilidad contable posterior.

### Added
- Candado optimista preview↔process: la UI envía `expectedMultiplier` (visto en la preview) al endpoint `demo-import-process`. Si la etapa booster cambió en ese intervalo, el backend responde `409 MULTIPLIER_CHANGED` y la UI fuerza re-validar el archivo antes de pagar (maker-checker real).

### Fixed
- Coherencia entre política operativa (“horas tras aprobar”) y datos persistidos para solicitudes de membresía.
- Vista previa de importación de recompensas demo: contraste legible (ya no hay texto invisible) y desglose por guardián con `request_id`, voto, fecha y `demo_vote_id` leídos del JSON firmado. Solo frontend; el flujo de pago no cambia.
- Importaciones demo previas **no aplicaban** el multiplicador (pagaban solo la base): corregido hacia adelante. Pagos anteriores quedan como realizados; una eventual compensación retroactiva se tratará como hito separado (no automático).

## [2025-07-15]

### Added
- Categoría de donaciones con UI/estilos y lógica dedicada. (`ddf788a`)

## [2025-07-18]

### Added
- Bono de bienvenida para nuevos usuarios (lógica backend + soporte admin). (`bc867c6`)

## [2025-07-23]

### Added
- Regla de donación en pre-launch como **transferencia directa** entre perfiles de impulsor (sin mintear BLUE/RED), con actualización de reglas económicas y soporte admin/UX. (`5f75b00`)

### Changed
- Estandarización y cumplimiento de reglas económicas en backend (ajustes de lógica server). (`038ce28`)
- Refactor: aislar lógica de negocio en funciones helper para reducir complejidad y facilitar mantenimiento. (`18d7ef7`)

### Fixed
- Flujo de pagos: asegurar actualización de estado de aceptación al completar el pago; mejoras en formulario de publicación. (`c20b896`)

## [2025-07-24]

### Changed
- Recompensas/bonos: “gate” de bonos de registro detrás del modo pre-launch (principalmente frontend/UI). (`5c51b4e`)

## [2025-08-30]

### Added
- Modal de advertencia obligatorio para publicaciones de donación. (`0e0a3e5`)

## [2025-09-11]

### Added
- Verificación por SMS en el registro (backend + `register` frontend). (`45f50d6`)

## [2025-11-05]

### Changed
- Refactor DB: migrar tabla `transactions` de `username` a `user_id` para mejores prácticas e integridad. (`4992766`)

## [2025-11-11]

### Fixed
- Cumplimiento de reglas económicas: bonos vía `booster_blue_ledger`, comisiones a plataforma como BLUE real, y correcciones asociadas en server. (`c88f743`)

## [2025-11-21]

### Added
- Expiración de código de referidos con configuración admin + updates en frontend. (`f1d1565`)

## [2025-11-22]

### Changed
- Migración de TOKEN RELEASER a Event Sourcing y correcciones de actualización de saldo. (`6c19b46`)
- Desactivar migraciones automáticas al inicio (confiar en `reset_db`) y ajustar tiempo de escrow. (`ff50201`)

### Fixed
- Corregir nombre de columna `phone -> phone_number` en creación de usuario. (`623b568`)

### Security
- Event Sourcing + seguridad inmutable en base de datos (tablas de eventos, triggers de bloqueo, hashing). (`5b067b8`)

## [2025-11-23]

### Added
- Auto-migration para columnas en `booster_level_settings`. (`8fd9e91`)

### Fixed
- Corregir uso de columna `account_status` en endpoints admin. (`8079fe9`)
- Sincronización de columnas DB y `reset_db.js`. (`b3efff1`, `6a132e4`)

## [2025-11-24]

### Fixed
- Estandarizar query de comisiones con `JOIN`. (`f8c2f82`)
- Ajustes de aliases/columnas en endpoints admin de usuarios. (`5babf26`)

## [2025-11-25]

### Added
- Validación en tiempo real de username y email durante registro. (`8ff741e`)

### Changed
- Términos y política de privacidad reforzados (anti-fraude y alineación técnica). (`6812157`)

## [2025-11-27]

### Added
- Validación en tiempo real de teléfono. (`438bb9e`)

### Fixed
- Columna faltante `tutor_user_id` en `users` y migración asociada. (`3717c29`, `9026626`)

## [2025-11-28]

### Added
- Flujo robusto de recuperación de registro (persistencia de estado + validación backend). (`b497d59`)

## [2025-11-29]

### Changed
- Mejoras de UX en registro (mensaje de timeout y contraste de link). (`59cd196`)

## [2025-12-01]

### Added
- Poblar documentos legales iniciales en DB. (`93365d2`)

### Fixed
- Sincronizar schema de DB (`booster_payment_log`) y asegurar lógica server. (`97bbe34`)

## [2025-12-02]

### Fixed
- Endurecer triggers/seguridad DB para auditoría legal. (`a819aa6`)

## [2025-12-03]

### Added
- Audit logs legales inmutables + carga dinámica de documentos. (`3ce3d3e`)

## [2025-12-04]

### Added
- Switch admin para controlar “Venta Rápida” + protección de endpoint. (`1159951`)

### Fixed
- Actualizar mensaje de compartir referidos. (`62ca67c`)

## [2025-12-05]

### Added
- Toggle de visibilidad de contraseña en login/registro. (`fc81164`)

### Changed
- Texto de términos y UX de registro (checkboxes más grandes). (`a0e111e`)

### Fixed
- Eliminar script inline redundante en `register.html` y mover lógica a `password-toggle.js`. (`b5c78ca`)

## [2025-12-11]

### Changed
- Reglas económicas reorganizadas en fases Pre/Post-Launch; definición de BLUE IOU y mecánica de comisiones. (`a64ac44`)

## [2025-12-29]

### Added
- App Android inicial con auth segura, dashboard y flujo de publicación. (`c3effb0`)

## [2026-01-05]

### Security
- Hardening de autenticación admin con cookies HttpOnly + validación de inputs + sanitización de outputs (prevención XSS). (`89e2c9f`)

### Added
- Lógica estricta de repetición de tareas con política de “Hard Reject” y lock de concurrencia. (`364a2d1`)
- Migración para permitir/denegar repetición de participación (`allow_repeat_participation`). (`364a2d1`)
- Auditoría tipo “bank-grade” (`audit_log`) con IP + User-Agent y retención de 48 meses; instrumentación de endpoints críticos. (`880ff29`)

### Fixed
- Bloquear repetición en tareas no repetibles (ocultar del feed, bloquear aceptar y gatear botones). (`1156f02`)

### Ops / Deploy
- Render: agregar `cookie-parser` como dependencia del backend. (`e421552`)
- Producción: permitir origen Hostinger en CORS y habilitar cookie admin cross-site (`SameSite=None`). (`3645551`)
- Producción: `trust proxy` en Render para rate limiting e IP real del cliente. (`c7022bc`)

## [2026-01-06]

### Added
- Badges/hitos en historial completo de usuario. (`1ce9312`)
- Filtros de publicaciones en panel admin + restore. (`1ce9312`)

### Changed
- Soft delete de publicaciones para preservar auditoría y evitar violaciones de FK (campo `deleted_at`). (`9c2cc76`, `1ce9312`)

### Fixed
- CORS: permitir `localhost:3000` solo fuera de producción. (`e419431`)

## [2026-01-10]

### Changed
- Historial de ganancias del impulsor: ocultar jerga técnica “Backfill” y normalizar texto a “Ajuste de saldo histórico (sin detalle disponible)”. (`b89f852`)
- Perfil de impulsor: al ver tu propio perfil (token presente), priorizar endpoint autenticado (`/api/me/booster-profile`) y dejar el endpoint público por `username` para perfiles ajenos. (`7bf35d2`)

### Fixed
- Registro: cuando hay sesión/token y el usuario está pendiente de verificación, mostrar bloque de estado con acciones (continuar verificación / ir al perfil / cerrar sesión) en vez de quedar “bloqueado”. (`7bf35d2`)
- UI: usar modal personalizado para avisos relevantes (evitar `alert()` nativo cuando corresponde). (`7bf35d2`)
- Admin: guard **fail-closed** al desactivar pre-launch; si faltan columnas críticas en DB (`red_token_debts.user_id`, `blue_token_escrows.user_id`), responder `409` con mensaje claro para evitar romper pagos por “schema drift”. (`7bf35d2`)

## [2026-01-20]

### Added
- Repetición de tareas con cooldown configurable (días/horas/minutos) y validación server-side.
- Migración 014 para `repeat_cooldown_hours` en `publications`.
- Script para inventario de pantallas UI + hook pre-commit para mantenerlo actualizado.

### Changed
- Versionado de assets a `v1.5.0` y actualización de referencias en HTML.
- UI de repetición de tareas: labels alineados, inputs compactos y estructura consistente de toggles.

### Fixed
- CORS en desarrollo: permitir IPs LAN para pruebas desde teléfono.

## [2026-02-20]

### Added
- Centro de Notificaciones integral en Panel Admin con tres pestañas: Alertas Push, Difusión de Email y Mensajes Diarios.
- Sistema de Difusión de Email con selección de grupos (Todos, Verificados, Impulsores, Específicos) y editor HTML.
- Historial de difusiones con métricas en tiempo real (enviados, fallidos, total, estado).
- Mail Worker profesional basado en colas de base de datos (`skip locked`) para envíos masivos controlados.
- Optimización de Bulk Insert para destinatarios por lotes de 1000 para alta escalabilidad.
- Auto-migración idempotente de esquemas al arranque del servidor.

### Changed
- Refactor de inicialización de servidor: cambio de `setInterval` a `setTimeout` recursivo para procesamiento de correos.
- Mejora de capacidad de envío: aumento de lote del worker a 20 correos cada 30 segundos.

### Security
- Validación de contenido y confirmación obligatoria para envíos masivos.

## [2026-04-09]

### Added
- Sistema de recompensas BLUE IOU por voto de gobernanza (Event-Driven, point-in-time pricing con snapshot).
- Migración 047: columna `reward_credited` en `governance_votes` con índice parcial.
- Procesamiento batch admin para votos históricos sin recompensar (notificación consolidada).
- Sistema de transferencia de recompensas Demo→Producción con HMAC-SHA256 y triple deduplicación.
- Migración 048: tabla `demo_reward_imports` para deduplicación de importaciones con crash-safety.
- Migración 049: tabla `demo_reward_exports` (Message Archive pattern) con re-download capability.
- UI admin "Recompensas Gov." con estadísticas, procesamiento batch, export/import demo, historial de exportaciones.
- Persistencia de notificaciones in-app: 15 eventos del EventBus ahora guardan en tabla `notifications` (helpers `_storeNotification`/`_storeNotificationByUserId`).

### Fixed
- Query LATERAL en booster-profile usaba `ORDER BY DESC` causando match duplicado de transacciones cercanas en tiempo. Corregido a match por proximidad temporal (`ABS(EXTRACT(EPOCH FROM ...))`).
- 3 vulnerabilidades Stored XSS: `notification.message` en dropdown y modal de notificaciones, `entry.description` en historial de ganancias — corregidas con `escapeHtml()`.
- `_storeNotificationByUserId` era `async` sin `await` en callers — podía causar crash por `UnhandledPromiseRejection`. Cambiada a función síncrona con `.then()/.catch()`.

### Security
- Parámetros de gobernanza (timelock, quórum, expiración, recompensa) configurables desde admin via `app_settings`.
- Secure by Default: `gov_vote_reward_blue` default a `0` (requiere activación explícita).
- Firma HMAC-SHA256 y timing-safe comparison en export/import de recompensas demo.
- XSS: `escapeHtml()` aplicado en renderizado de notificaciones y historial de ganancias.

