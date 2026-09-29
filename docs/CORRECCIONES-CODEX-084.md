# CODEX-084 — Menú administrativo y RPC atrasado

## Evidencia comprobada el 28 de septiembre de 2026

Consulta HTTP pública, sin iniciar sesión ni operar cuentas:

- `https://demo.wintoncoin.com/admin-panel.html`: 200, contiene el enlace Smart Contracts, `Cache-Control: no-cache, no-store, must-revalidate`, CDN DYNAMIC.
- `/sw-source.js`: 200, no-cache/no-store, CDN MISS.
- `/registerSW.js`: 200, `public, max-age=31536000, immutable`, CDN HIT, Age 272826. Cuerpo antiguo registra el worker al cargar, sin coordinar actualización del documento administrativo.
- `/registerSW.js?diagnostic=CODEX084`: 200, no-cache/no-store, CDN MISS. Esto demuestra una copia antigua retenida en CDN para la URL habitual, aunque la respuesta nueva ya tiene cabeceras correctas. No prueba por sí solo qué copia exacta usa el dispositivo de Miguel.

Lectura SQL de la conexión Demo guardada localmente, transacción READ ONLY, sin datos personales ni modificaciones:

- Red 11155420, Exchange `0xde41187f8943623e34af7249d9691d58e28230ca`.
- Inicio 49253937; política `finalized`; cursor y objetivo almacenados 49414462; estado almacenado `ready`, error nulo en esa lectura puntual.
- Hash del cursor: `0x1fbe1ec71a75cd3a5b498f00c53d829ddfe0bb697ae8a534812ea8a10f663297`.
- Contraste independiente contra `https://sepolia.optimism.io`: latest 49416321, finalized 49100720; el hash del bloque 49414462 coincide con el guardado. La diferencia con finalized es 313742 bloques.

El bloque guardado existe en la cadena consultada, pero ese proveedor no lo presenta todavía como finalizado. No se ha demostrado que sea el mismo endpoint utilizado por Render ni por qué el cursor llegó a esa altura bajo la política guardada. El estado SQL ready puntual no prueba recuperación estable; puede haber alternancia de respuestas o diferencias de configuración/proveedores. No borrar ni retroceder el cursor, no cambiar a latest para silenciar el aviso, no declarar este desfase resuelto en Render.

## Cambios realizados

### Actualización del panel

Vite incorpora el registro del Service Worker como un módulo con huella en el nombre y deja de inyectar una referencia a `registerSW.js` sin versión. El registro solicita actualización sin caché HTTP y vuelve a comprobarla al recuperar visibilidad/foco, con limitación de frecuencia. Si cambia el worker o el navegador restaura una página administrativa desde su historial, una página sin cambios pendientes se recarga una vez. Si el administrador ya escribió o cambió un formulario, se conserva y se muestra un aviso para guardar y recargar. No recarga páginas de billetera ni pagos por esta vía.

Se refuerzan las cabeceras del HTML administrativo y archivos de worker/registro para LiteSpeed. Una regla nueva no elimina retroactivamente una copia ya guardada en un CDN o navegador: purgar la caché del CDN es un paso de publicación necesario. Los clientes que todavía ejecuten el código antiguo necesitarán que la versión nueva llegue a su siguiente navegación/recarga normal; no se promete modificar una página antigua ya abierta sin que descargue el actualizador nuevo.

### Sincronizador del Exchange

- `RPC_BEHIND_CURSOR` informa cursor, objetivo recibido y diferencia; no imprime URLs ni credenciales del proveedor.
- Guarda el objetivo observado y marca error sin borrar registros, disminuir el cursor ni alterar el hash.
- Mantiene la protección que impide ofrecer una proyección en error como saldo actualizado.
- Reintentos progresivos hasta 60 segundos y mensajes repetidos resumidos cada cinco minutos o al cambiar de error. La comprobación sigue activa; no se oculta el fallo. El trabajador embebido registra recuperación cuando vuelve a completar una comprobación.
- El lector rechaza una respuesta que devuelve una altura distinta de la solicitada numéricamente.
- Se corrige la cancelación del temporizador y sus listeners al detener el trabajador embebido.
- Nuevo diagnóstico: desde `backend`, `npm run indexer:diagnose`. Lee configuración del entorno actual, la fila del cursor y los bloques latest/finalized/objetivo/cursor. Solo SQL READ ONLY y llamadas RPC de lectura. No necesita firmantes, no cambia parámetros y no reconstruye la base. No expone credenciales.

## Verificación

33 pruebas aprobadas en tres suites: integración del indexador con PostgreSQL aislado real, ruta de consulta y política de reintentos/lector. Cinco pruebas frontend aprobadas: registro sin caché, recarga única, protección de formularios editados, ausencia de interrupción de billetera y restauración desde historial. Compilación Demo aprobada; HTML compilado referencia el módulo de registro con huella y deja de depender del registro antiguo. No son pruebas end-to-end de publicación Hostinger/Render ni una garantía sobre todos los proveedores.

El caso de recuperación comprobó conservación exacta de órdenes, historial y devoluciones, ocultación de saldos durante error y recuperación al volver a alcanzar el cursor. La base real solo fue leída; las migraciones de prueba se ejecutaron en esquemas de PostgreSQL local aislado.

## Qué falta en Demo

1. Revisar/publicar estos cambios junto con la entrega visual CODEX-083, que se conserva.
2. Purgar en Hostinger/CDN la copia antigua de `/registerSW.js` y cualquier HTML administrativo retenido. Verificar las cabeceras de la URL habitual, sin parámetros, después de la purga. No borrar sesiones, claves ni almacenamiento económico del navegador.
3. Ejecutar `npm run indexer:diagnose` dentro del mismo servicio Render donde aparece el error. Contrastar cadena, Exchange, inicio, finality, cursor y objetivo. Conservar esa evidencia antes de tocar configuración.
4. Si el endpoint finalizado queda atrás, comprobar otro proveedor autorizado con la misma red y política. Si es consistente, actualizar el endpoint configurado manteniendo la base y la comprobación del hash; si persiste, investigar disponibilidad/finalización de la red y procedencia del cursor. No se agregó un cambio automático a proveedores desconocidos ni se rebajó la finalidad.
5. Los mensajes TOKEN RELEASER/DEBT COLLECTOR/DONATION REFUND sin registros son mensajes de tareas sin trabajo encontrado, no ese error. Los dos primeros consultan tablas SQL heredadas: que estén vacías no demuestra que no existan compromisos o parking en blockchain. Su integración completa sigue siendo un pendiente anterior; esta entrega no modifica reglas económicas ni esos trabajadores.

Sin cambios Solidity, FIFO, mint/burn, credenciales, parámetros económicos, migraciones reales, commit, push ni despliegue realizados por Codex en esta entrega.
