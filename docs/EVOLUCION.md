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

### 2026-01-13 — UI móvil: instrucciones de publicación legibles

- **Contexto**: en móvil, la descripción larga de algunas tareas se veía centrada y el enlace de WhatsApp podía “perderse” por el largo del URL.
- **Decisión**:
  - Alinear la descripción a la izquierda y mejorar el wrap de enlaces largos.
  - Normalizar la indentación común de textos multilínea antes de renderizar, para evitar “desplazamientos” en la primera línea.
- **Impacto**:
  - Lectura más clara en pantallas pequeñas.
  - Enlaces largos visibles y clicables sin romper el layout.
- **Evidencia (commits)**: `31de990`.

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

### 2026-01-12 — Encabezado principal: alineación y jerarquía visual

- **Contexto**: el enlace “¿Cómo funciona?” debía verse más discreto y alineado con el título principal para mejorar la lectura.
- **Decisión**: colocar el enlace junto a “WintonCoin”, reducir tamaño (~30%), usar cursiva y color secundario.
- **Impacto**: encabezado más compacto y profesional; menor ruido visual.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Encabezado en móvil: más aire superior

- **Contexto**: en móviles el encabezado quedaba muy pegado arriba y se veía apretado.
- **Decisión**: aumentar el padding superior del contenedor del panel y el margen del título en móvil.
- **Impacto**: mejora la legibilidad y evita sensación de elementos “apretados” en pantalla pequeña.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Menú de usuario: estilo compacto sin fondo

- **Contexto**: el fondo del nombre de usuario ocupaba espacio y chocaba con “¿Cómo funciona?” en móvil.
- **Decisión**: quitar fondo y borde del trigger, con padding mínimo y hover sutil.
- **Impacto**: más aire en el encabezado y mejor jerarquía visual.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Contador de publicaciones disponibles

- **Contexto**: el usuario necesita ver cuántas publicaciones puede aceptar en ese momento.
- **Decisión**: mostrar un contador junto a “Publicaciones Activas” basado en cupos, estado y repetición permitida.
- **Impacto**: claridad inmediata sobre oportunidades disponibles para cada usuario.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Contador discreto en el título

- **Contexto**: el contador debía verse más sutil en móvil.
- **Decisión**: moverlo entre paréntesis, sin fondo, usando color secundario.
- **Impacto**: mejor legibilidad sin robar protagonismo al título.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Contador en el título sin paréntesis

- **Contexto**: el contador debía verse aún más limpio.
- **Decisión**: mostrar el número sin paréntesis, con color secundario discreto.
- **Impacto**: título más minimalista y legible.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Contador: refleja lo visible en lista

- **Contexto**: el contador mostraba “0” aunque había publicaciones visibles.
- **Decisión**: contar el listado filtrado/renderizado en pantalla.
- **Impacto**: número coherente con lo que ve el usuario.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Repetición por usuario con límite auditable

- **Contexto**: se requiere definir cuántas veces puede repetir una misma tarea cada usuario.
- **Decisión**: agregar `max_repeat_per_user` en `publications`, con input en admin y en publicación normal, validado en backend.
- **Impacto**: control fino, auditable y coherente con reglas fintech.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Mini tarjeta de Impulsor en pantalla principal

- **Contexto**: el usuario necesita ver su estado de Impulsor sin salir del panel.
- **Decisión**: mostrar un widget compacto con nivel, total BLUE iou, progreso y acceso al perfil.
- **Impacto**: más claridad y motivación sin saturar la UI.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Banner horizontal de Impulsor (comparativa UI)

- **Contexto**: comparar una opción más visible tipo banner.
- **Decisión**: reemplazar la tarjeta por un banner con ícono, métricas y barra de progreso.
- **Impacto**: mayor presencia visual sin perder jerarquía.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Título junto al ícono (Impulsor)

- **Contexto**: se necesitaba compactar el encabezado del banner.
- **Decisión**: poner la estrella al lado del título y quitar el fondo del ícono.
- **Impacto**: encabezado más limpio y alineado.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Banner de Impulsor sin barra de progreso

- **Contexto**: se solicitó una vista más limpia del banner.
- **Decisión**: eliminar la barra de progreso del widget.
- **Impacto**: visual más simple y menos ruido.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Tipografía del banner de Impulsor

- **Contexto**: el título debía igualar el tamaño de SALDO BLUE/RED y el monto BLUE iou debía destacarse.
- **Decisión**: aplicar mayúsculas al título y aumentar tamaño + cursiva del monto BLUE iou.
- **Impacto**: mayor coherencia visual con los saldos.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Banner de Impulsor sin nivel

- **Contexto**: se pidió una vista más simple sin el nivel.
- **Decisión**: eliminar el badge de nivel del banner.
- **Impacto**: layout más limpio y directo.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Formato del monto BLUE iou en impulsor

- **Contexto**: se pidió separar miles y reducir tamaño de decimales.
- **Decisión**: reutilizar el formateo con separadores y `decimal-part`.
- **Impacto**: mejor legibilidad del monto en el banner.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Destacar monto BLUE iou en impulsor

- **Contexto**: el monto debía verse más grande y con más color.
- **Decisión**: separar valor/unidad con estilos y aumentar tamaño del valor.
- **Impacto**: mayor énfasis visual sin afectar el resto del banner.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Banner de valor sobre referidos

- **Contexto**: se pidió mostrar el texto de valor antes del bloque de referidos.
- **Decisión**: mover el banner arriba del botón “Comparte tu código” y fijar el texto solicitado.
- **Impacto**: jerarquía más clara del mensaje de valor.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Banner de Impulsor sin tareas y centrado

- **Contexto**: se pidió remover “tareas” y alinear mejor el bloque.
- **Decisión**: eliminar el texto de tareas y centrar el espaciado del meta.
- **Impacto**: banner más limpio y equilibrado.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Tarjeta de Impulsor como enlace

- **Contexto**: se pidió quitar “Ver perfil” y usar la tarjeta completa como acceso.
- **Decisión**: convertir el banner en enlace a `booster-profile.html`.
- **Impacto**: interacción más directa y limpia.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Título de Impulsor centrado

- **Contexto**: se pidió centrar el texto “Perfil de Impulsor”.
- **Decisión**: centrar el encabezado del banner.
- **Impacto**: mejor alineación visual.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Ícono de Impulsor simétrico

- **Contexto**: se pidió simetría visual en el título.
- **Decisión**: colocar una estrella a cada lado del texto.
- **Impacto**: banner más equilibrado.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Espaciado uniforme en el panel

- **Contexto**: se pidió un margen mínimo y consistente entre elementos.
- **Decisión**: unificar márgenes de banner impulsor, valor, referidos y botones.
- **Impacto**: layout más limpio y homogéneo.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Monto BLUE iou con mayor tamaño

- **Contexto**: el monto debía verse al doble de tamaño.
- **Decisión**: aumentar el tamaño del valor principal en el banner.
- **Impacto**: mayor énfasis visual del monto BLUE iou.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Separador de miles en BLUE iou

- **Contexto**: el monto debía mostrarse como `1.640,0000`.
- **Decisión**: formatear el valor del banner con separador de miles fijo.
- **Impacto**: formato numérico consistente y más legible.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Tamaño de “BLUE iou” igual al título

- **Contexto**: se pidió que el texto “BLUE iou” igualara el tamaño de “Perfil de Impulsor”.
- **Decisión**: aumentar el tamaño de la unidad en el banner.
- **Impacto**: coherencia tipográfica en el banner.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Protocolo de release documentado

- **Contexto**: se necesitaba una guía persistente de versionado y despliegue.
- **Decisión**: crear `docs/RELEASE_PROTOCOL.md` con flujo SemVer + checklist.
- **Impacto**: releases consistentes y auditables en futuros cambios.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Archivo VERSION para releases

- **Contexto**: se necesitaba un punto único y auditable de la versión.
- **Decisión**: agregar el archivo `VERSION` y referenciarlo en el protocolo.
- **Impacto**: claridad de versión en cada release.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Versionado manual de assets (v1.4.0)

- **Contexto**: el cache del navegador podía mantener estilos/scripts viejos tras un deploy.
- **Decisión**: renombrar assets estáticos a `style.v1.4.0.css`, `utils.v1.4.0.js` y `interaction.v1.4.0.js` y actualizar referencias en HTML.
- **Impacto**: control explícito de cache y actualizaciones inmediatas tras release.
- **Evidencia**: commit pendiente de push.

### 2026-01-12 — Versionado estricto (solo assets con versión)

- **Contexto**: mantener archivos “originales” sin versión genera ambigüedad sobre cuál es el asset oficial del release.
- **Decisión**: conservar únicamente archivos versionados (`*.vX.Y.Z.*`) y eliminar los duplicados sin versión.
- **Impacto**: single source of truth en releases, caché más predecible y menos riesgo de cargar assets obsoletos.
- **Evidencia**: commit pendiente de push.

### 2026-01-19 — Gamificación en perfil de Impulsor

- **Contexto**: se buscaba motivar tareas con ranking y metas diarias.
- **Decisión**: agregar ranking (#posición y top %) y meta diaria comparando hoy vs ayer, con confeti y brillo cuando hay mejora.
- **Impacto**: refuerzo positivo y mayor incentivo a mantener actividad diaria.
- **Evidencia**: commit pendiente de push.

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

