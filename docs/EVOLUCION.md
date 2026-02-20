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

### 2026-01-24 — Referidos: orden por acumulado + fecha corta

- **Contexto**: en móvil la tabla de referidos necesitaba ordenarse por relevancia económica y usar fecha compacta.
- **Decisión**:
  - Ordenar la lista por **BLUE iou acumulado** (descendente).
  - Mostrar fecha en formato corto `dd/mm/yy`.
- **Impacto**: la tabla prioriza referidos con mayor aporte y se ve mejor en pantallas pequeñas.
- **Evidencia (commits)**: pendiente de push.

### 2026-01-24 — Impulsor: Ranking Mundial + ranking entre amigos

- **Contexto**: se quería distinguir el ranking global del ranking dentro de tu red de referidos.
- **Decisión**:
  - Renombrar el bloque a **Ranking Mundial**.
  - Añadir **Ranking entre amigos** con tooltip explicativo.
  - Calcular ranking entre el usuario y sus referidos (por BLUE iou acumulado).
- **Impacto**: gamificación más clara; el usuario compara su progreso global vs su círculo.
- **Evidencia (commits)**: pendiente de push.

### 2026-01-24 — Publicación: botón compartir con icono oficial + CTA duplicado

- **Contexto**: se quería mantener consistencia visual del icono de compartir y facilitar la acción final en móvil.
- **Decisión**:
  - Reemplazar el icono de compartir por el de 3 nodos (mismo que pantalla principal).
  - Mover compartir arriba y duplicar “Marcar como Culminada” abajo para alcance rápido.
  - Ajustar inputs de formulario a fondo blanco para mejor UX de escritura.
- **Impacto**: UI más intuitiva y consistente; acción final más accesible en móvil.
- **Evidencia (commits)**: pendiente de push.

### 2026-01-24 — Publicación: CTA verde + compartir compacto

- **Contexto**: se pidió enfatizar la acción de culminar y hacer el compartir más ligero visualmente.
- **Decisión**:
  - Renombrar el CTA a **“He culminado”** y ponerlo en verde.
  - Convertir el compartir en **icono + texto** (sin botón sólido), manteniendo la acción.
- **Impacto**: jerarquía visual más clara; compartir más discreto y rápido de identificar.
- **Evidencia (commits)**: pendiente de push.

### 2026-01-24 — Admin: buscador + orden en publicaciones plataforma

- **Contexto**: se necesitaba encontrar y priorizar publicaciones de plataforma rápidamente en admin.
- **Decisión**:
  - Agregar buscador por título/descripcion/autor/ID.
  - Añadir selector de orden (pendientes, fecha, recompensa, participantes, aprobaciones/pagos).
  - Ajustar layout para mantener consistencia visual.
  - Default de repetición: **12 minutos** al habilitar la opción.
- **Impacto**: gestión más rápida y menos fricción operativa en panel admin.
- **Evidencia (commits)**: pendiente de push.

### 2026-01-24 — Repetición: cooldown en minutos (12 min default)

- **Contexto**: el sistema seguía bloqueando por 24 horas aunque el UI mostraba 12 minutos.
- **Decisión**:
  - Permitir precisión en `repeat_cooldown_hours` (NUMERIC).
  - Calcular cooldown desde días/horas/minutos y default de 12 minutos cuando se habilita.
  - Mensajes de espera en minutos cuando aplica.
- **Impacto**: el bloqueo respeta minutos reales y coincide con la configuración del admin.
- **Evidencia (commits)**: pendiente de push.

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

### 2026-01-25 — Onboarding: guía del menú principal

- **Contexto**: algunos usuarios no encontraban rápido accesos clave (P2P, Historial, Impulsor).
- **Decisión**: agregar un paso en el tour de bienvenida que resalta el menú superior y sus accesos.
- **Impacto**: navegación inicial más clara y menos fricción en el primer uso.
- **Evidencia (commits)**: pendiente de push.


### 2026-01-26 a 2026-01-28 — Landing Page: Rediseño Visual y Contenido

- **Contexto**: La página de inicio necesitaba transmitir profesionalismo y claridad sobre la propuesta de valor "Token Engineering" y "Proof of Task".
- **Decisión**:
  - Implementar nueva estructura visual con tarjetas de servicios ("Hyper-Scalar Economic Engineering").
  - Integrar assets gráficos generados (imágenes 3D, dualidad de tokens).
  - Refinar textos para enfatizar la innovación tecnológica y económica.
- **Impacto**: Primera impresión mucho más potente y alineada con una Fintech de alto nivel.
- **Evidencia**: Conversaciones "Refining Website Content And Layout".

### 2026-01-29 a 2026-02-01 — Refactorización Backend: Autenticación Modular

- **Contexto**: La lógica de autenticación estaba acoplada en `server.js`, dificultando el mantenimiento y la escalabilidad.
- **Decisión**:
  - Extraer lógica a `src/controllers/authController.js` y `src/routes/authRoutes.js`.
  - Aislar validaciones y manejo de errores.
  - Preparar el terreno para migración a arquitectura serverless/microservicios.
- **Impacto**: Código backend más limpio, testearle y mantenible. Reducción de deuda técnica crítica.
- **Evidencia**: Conversaciones "Refactoring Authentication Logic".

### 2026-01-30 a 2026-02-05 — Seguridad y Políticas: Anti-Sybil y KYC

- **Contexto**: Necesidad de proteger la economía del token contra granjas de cuentas y abusos.
- **Decisión**:
  - Definir e implementar políticas estrictas contra multi-cuentas (Sybil attacks).
  - Condicionar recompensas de referidos a verificación de identidad (KYC).
  - Actualizar Términos y Condiciones y mensajes de UI para reflejar estas reglas.
- **Impacto**: Protección de la tesorería del proyecto y mayor confianza para inversores/usuarios legítimos.
- **Evidencia**: Conversaciones "User Security Policy", "Refining Referral Policies".

### 2026-02-01 a 2026-02-06 — Branding Integral y PWA Assets

- **Contexto**: Inconsistencia en logos e iconos en diferentes dispositivos y resoluciones.
- **Decisión**:
  - Generar set completo de iconos estandarizados (manifest PWA, favicons, Apple touch icons).
  - Implementar nuevos logos para Token BLUE y WintonCoin (círculo dorado).
  - Actualizar `manifest.json` y headers HTML.
- **Impacto**: Identidad de marca cohesiva y profesional en todas las plataformas (Web, Móvil, Desktop).
- **Evidencia**: Conversaciones "Branding & Icon Generation".

### 2026-02-07 a 2026-02-09 — Dashboard de Agentes y Gestión de Campañas

- **Contexto**: Falta de herramientas para que los agentes gestionen su performance y para configurar campañas específicas.
- **Decisión**:
  - Crear Dashboard de Agente con KPIs (leads, conversión, actividad).
  - Implementar configuración de "Targets" para campañas (Nicho, Plataforma, Presupuesto).
  - Resolver discrepancias en filtros de tareas activas en Admin Panel.
- **Impacto**: Empoderamiento de la fuerza de ventas (agentes) y campañas de marketing más precisas y medibles.
- **Evidencia**: Conversaciones "Agent Performance Dashboard", "Campaign Target Configuration".

### 2026-02-11 a 2026-02-14 — Seguridad en Pagos y Notificaciones Push

- **Contexto**: Vulnerabilidades potenciales en confirmación de pagos admin y problemas con la entrega de notificaciones en PWA.
- **Decisión**:
  - Blindar lógica de confirmación de pagos (verificación de roles y sesión).
  - Depurar flujo completo de Web Push Notifications (Service Worker, suscripción DB, entrega).
  - Actualizar mensajes de referidos para mayor viralidad.
- **Impacto**: Operativa financiera segura y canal de retención de usuarios (Push) funcional.
- **Evidencia**: Conversaciones "Admin Payment Confirmation Security", "Push Notification Debugging".

### 2026-02-14 a 2026-02-17 — Migración de Dominio, Roadmap y Pulido Final

- **Contexto**: Preparación para lanzamiento en dominio principal (`www`) y necesidad de mostrar visión a largo plazo.
- **Decisión**:
  - Estrategia de migración de PWA de subdominio a dominio raíz.
  - Creación de página `roadmap.html` con hitos visuales 2024-2027.
  - Actualización de Whitepaper (`docs.html`) con protocolo "Proof-of-Task".
  - Ajustes finos de UI: Footer profesional, iconos redes sociales SVG, textos de "Ayuda" optimizados.
- **Impacto**: Plataforma lista para "Go Live" público con narrativa de futuro clara y experiencia de usuario pulida.
- **Evidencia**: Conversaciones "PWA Domain Migration", "Roadmap & Icon Fixes".

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

