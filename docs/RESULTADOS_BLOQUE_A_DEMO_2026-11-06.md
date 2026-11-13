# Resultados del Bloque A no económico — Demo

Fecha: 6 de noviembre de 2026.  
Entorno: `https://demo.wintoncoin.com`, exclusivamente Demo.  
Versión observada: `19aafcf`.  
Alcance: pruebas públicas y autenticadas sin pagos, fondos, KYC real, publicaciones, firmas ni transacciones blockchain.

## Resultado ejecutivo

- Las cuatro cuentas QA normales (`QA-01` a `QA-04`) iniciaron sesión correctamente y mostraron la marca de Prelanzamiento.
- Pruebas E2E públicas: **5 aprobadas de 5**.
- Pruebas E2E autenticadas: **2 aprobadas de 2**, incluyendo un defecto conocido registrado como fallo esperado.
- Indexador FifoExchange: **tres observaciones consecutivas HTTP 200**, `ready=true` en términos operativos (`status=ready`, `usable=true`), época `V5_CODEX_163`, colas vacías.
- Prelanzamiento del backend: activo y fail-closed; las operaciones económicas permanecen deshabilitadas.
- Producción, contratos y fondos: sin cambios.

## Comprobaciones aprobadas

1. La portada carga, identifica inequívocamente Demo y ofrece acceso a Login.
2. Términos y Privacidad responden correctamente.
3. El formulario de Login vacío se detiene localmente y no envía una solicitud al backend.
4. Una ruta privada sin sesión no expone contenido privado; el destino seguro observado puede ser Login o la portada.
5. La API pública confirma `pre_launch_mode_enabled=true`, `enabled=false`, `mode=prelaunch_read_only` y `reason=PRELAUNCH_ACTIVE`.
6. Las cuatro cuentas QA pueden autenticarse sin exponer credenciales en archivos o evidencias.
7. El buscador autenticado acepta texto y se limpia sin realizar operaciones económicas.
8. Los avisos de campaña y notificaciones pueden completarse sin suscripción push real en la prueba automatizada; los service workers permanecen bloqueados durante el test.

## Defectos y riesgos encontrados

### A-DEF-01 — Prelanzamiento no pausa automáticamente los contratos

El interruptor administrativo guarda el estado en la base de datos y activa la barrera del backend, pero no ejecuta la pausa on-chain. Los cuatro contratos V5 continúan fuera de pausa según el último preflight. La corrección exige un diseño y autorización separados porque implicaría transacciones firmadas y gas.

### A-DEF-02 — KYC se evalúa antes que Prelanzamiento

En `contract_interaction.html`, un usuario normal ve `Crear la Primera Publicación`. Al pulsarlo aparece primero `Verificación para publicar` solicitando KYC, en vez del aviso universal de Prelanzamiento. La prueba E2E lo registra como fallo esperado para evitar aprobar silenciosamente el comportamiento.

### A-DEF-03 — Flujo normal permanece en interfaz heredada

El Login normal redirige a `contract_interaction.html`, mientras varias mejoras recientes se implementaron en el Dashboard React. Debe definirse un único recorrido canónico y eliminar divergencias de mensajes, permisos y controles.

### A-DEF-04 — Destino de ruta protegida no determinista

Una visita sin sesión a `/dashboard` no expone contenido privado, pero durante las pruebas terminó unas veces en Login y otras en `index.html`. La protección funciona, aunque conviene unificar el destino y el mensaje.

### A-LEGAL-01 — Afirmaciones públicas no acreditadas

La portada contiene afirmaciones absolutas como `Smart Contracts Auditados`, `Seguridad de Grado Militar`, `Código inquebrantable`, `Cero errores humanos`, `100% Atención Real` y `Cero Bots`. No deben usarse para adquisición o inversión sin evidencia externa suficiente y coherencia con los Términos.

## Archivos de automatización

- `frontend/playwright.config.js`
- `frontend/e2e/demo-public.spec.js`
- `frontend/e2e/demo-authenticated.spec.js`
- Script: `npm run test:e2e:demo`

Las credenciales se reciben únicamente mediante variables de entorno. Si no existen, las pruebas autenticadas se omiten de forma segura.

## Próximo bloque permitido

Puede continuar la ejecución manual de los 31 casos de `docs/MATRIZ_BLOQUE_A_DEMO.md`, comenzando por los públicos y autenticados no económicos. Las operaciones de escritura, pagos, garantías, emisión, quema y firma continúan fuera de alcance.
