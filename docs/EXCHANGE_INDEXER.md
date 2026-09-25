# Sincronización del Exchange desde blockchain

## Alcance

Proceso independiente del servidor web y del relayer. Lee órdenes y devoluciones retenidas del `FifoExchange` integrado actual. No firma ni envía transacciones, no necesita claves privadas y no altera FIFO, KYC, comisiones ni garantías. Las lecturas no consumen gas de usuario; sí requieren servidor, PostgreSQL y servicio RPC con capacidad suficiente.

No reemplaza todavía la sincronización de compromisos, parking, Vault completo, tesorería ni las escrituras económicas del marketplace legado. Tampoco cambia pantallas: entrega un endpoint para integrar las vistas React. La tabla antigua `web3_fifo_exchange_orders`, que no identifica red/contrato, queda separada y no se presenta como historial verificado.

## Funcionamiento

1. Identifica explícitamente la red, el Exchange y su bloque de creación. Rechaza empezar después de la creación porque omitiría operaciones anteriores.
2. Lee eventos de bloques finalizados, por páginas. Para las órdenes y billeteras afectadas consulta los valores efectivos del contrato en el mismo bloque identificado por su hash. No calcula el saldo sumando devoluciones ni interpreta una cancelación como transferencia a la billetera.
3. Guarda eventos, órdenes, saldos y avance en una única transacción de PostgreSQL. Conserva cantidades como texto decimal exacto de seis decimales como máximo, sin `parseFloat`.
4. Un candado por red/contrato impide procesar simultáneamente la misma página. Si un proceso muere, PostgreSQL revierte su transacción abierta y libera el candado; otro puede continuar desde el último avance confirmado.
5. Si cambia un bloque previamente guardado, marca el historial anterior como retirado de la cadena y reconstruye las proyecciones desde la creación, por páginas. Conserva los logs originales con sus hashes. Durante la recuperación no entrega saldos parciales como actuales.
6. Si falla una lectura o el proveedor está atrasado, no inventa saldos ni salta bloques. El estado pasa a error; el proceso reintenta. Un estado sin comprobar durante 120 segundos se informa como desactualizado.

`refunded_amount` de una orden expresa importe retirado de esa orden. No equivale a saldo personal pendiente. `pendingRefunds` reproduce los mapas de devoluciones retenidas del contrato; un valor positivo tampoco garantiza que pueda retirarse ahora, pues siguen vigentes KYC y pausas. `is_amortization=true` identifica compras para amortizar mediante Vault; sus devoluciones vuelven al Vault y no se suman a devoluciones personales.

## Activación operativa pendiente

El código no se activa al importar sus módulos. No se ejecutaron migraciones en las bases del proyecto ni se arrancó este proceso contra redes públicas. Para una puesta en marcha autorizada:

- Aplicar las migraciones del proyecto, incluida `112_exchange_indexer.js`, con el runner transaccional existente. Requiere `111`. El servidor existente descubre migraciones pendientes al arrancar; tenerlo en cuenta al publicar esta versión. No iniciar el servidor solo para probar este cambio contra una base real.
- Configurar los valores reales del despliegue y verificar la correspondencia con la ABI compilada. Este lector es para el Exchange integrado actual; no se debe usar una dirección de otra versión por similitud de nombre.
- Ejecutar `npm run indexer:exchange` desde `backend` como servicio continuo con reinicio supervisado. `npm run indexer:exchange -- --once` procesa una sola página y sale; no reemplaza al servicio continuo para recuperar todo el historial.
- El servidor API necesita la misma identificación de red/Exchange y acceso a la misma base. El trabajador necesita acceso a lecturas RPC históricas, logs completos y llamadas por hash con `requireCanonical` (EIP-1898). Comprobar este soporte con el proveedor elegido antes de activar.
- Usar una conexión PostgreSQL directa o agrupación por sesión. El candado de sesión no es compatible con PgBouncer en modo transacción. La cuenta del trabajador debe tener permisos de lectura/escritura sobre sus tablas, sin necesidad de permisos DDL una vez migrado.
- Supervisar `status`, `errorCode`, antigüedad, diferencia entre bloque objetivo/procesado y reinicios. La API responde 503 cuando los datos todavía no son utilizables; el consumidor debe mostrar “Actualizando” o “Sin conexión”, nunca sustituirlo por cero.

Variables, sin valores de contratos inventados:

```dotenv
EXCHANGE_INDEXER_RPC_URL=<RPC de lectura con historial y EIP-1898>
EXCHANGE_INDEXER_CHAIN_ID=<identificador decimal de la red>
EXCHANGE_INDEXER_ADDRESS=<dirección real del Exchange integrado>
EXCHANGE_INDEXER_START_BLOCK=<bloque exacto de creación, mayor que cero>
EXCHANGE_INDEXER_FINALITY=finalized
EXCHANGE_INDEXER_BATCH_BLOCKS=100
EXCHANGE_INDEXER_MAX_LOGS=2000
EXCHANGE_INDEXER_POLL_MS=5000
```

La conexión a la base reutiliza la configuración del backend. No copiar claves privadas del relayer al trabajador. El límite de página se reduce automáticamente si supera `MAX_LOGS`; si un único bloque supera ese máximo, falla visiblemente sin omitirlo: revisar capacidad y aumentar el límite dentro del máximo permitido (10000). Un límite/rechazo de rango impuesto por el proveedor exige ajustar `BATCH_BLOCKS` (1–2000); no existe fallback silencioso que se salte logs.

`finalized` es la política por defecto. Opcionalmente puede seleccionarse explícitamente `confirmations:N`, con N entre 1 y 999999; en ese modo el bloque objetivo es la altura más reciente menos N. No equivale a finalidad definitiva. Si el proveedor no soporta `finalized`, el servicio falla sin cambiar de política por su cuenta. Cambiar el bloque inicial o la política de una corriente ya guardada requiere una operación explícita de mantenimiento y reconstrucción, no editar silenciosamente su cursor.

Si ya existen devoluciones para esa red/Exchange sin un cursor del nuevo indexador, el arranque falla con `EXISTING_REFUNDS_REQUIRE_RECONCILIATION`. Los datos previos se conservan: deben conciliarse y archivarse antes de comenzar la nueva proyección. No borrar saldos o inventar procedencia para evitar este control.

## Consulta para la aplicación

`GET /api/web3/exchange/:wallet?after=0&limit=50`

Devuelve red, dirección del Exchange, billetera, política de confirmación, último bloque/hash verificado, objetivo, fechas de comprobación y estado. `data` contiene órdenes y devoluciones solo cuando `usable=true`. Importes e identificadores grandes se devuelven como cadenas. La paginación usa `order_id`, no expresa prioridad FIFO; la posición del contrato se conserva en `sequence_id`. `nextAfter` permite continuar (máximo 100 órdenes por página). No se expone documentación KYC ni datos privados.

`usable` significa que la proyección terminó de alcanzar el objetivo conocido y fue comprobada recientemente. No autoriza movimientos, no predice una inclusión posterior y no sustituye la validación del contrato. En modo finalizado, una operación recién enviada puede tardar en aparecer. Una pantalla puede mostrar su transacción como pendiente por separado, sin sumarla a los saldos verificados.

## Límites y recuperación

- La reconstrucción completa tras una reorganización simplifica la recuperación y conserva evidencia, pero puede demorar si hay mucho historial. No se promete disponibilidad inmediata. El RPC debe conservar el estado histórico necesario.
- La lectura confía en que el proveedor entregue logs completos y datos correctos. Se contrastan hashes y valores del contrato; todavía no hay quorum de proveedores ni reconciliación periódica exhaustiva de todas las órdenes contra sus contadores.
- El hash del código desplegado se fija al crear la corriente y se comprueba durante las páginas. Un cambio de código detiene la sincronización. No hay soporte automático para contratos actualizables mediante proxy ni versiones de ABI futuras.
- Una reorganización posterior a confirmar una página se detecta en la siguiente comprobación. Este espejo no sustituye a la blockchain como autoridad del dinero.
- Al detener el servicio, la API marca los datos como desactualizados al superar 120 segundos. Al volver a iniciarlo, continúa desde el cursor persistido; no requiere que el usuario repita pagos o reclamos.

## Pruebas reproducibles aisladas

Las pruebas PostgreSQL requieren `WINTON_MIGRATION_TEST_PORT` y verifican que la instancia usa un directorio `pg-review-070`, en localhost y con usuario de pruebas `review070`. Nunca apuntarlas a las bases del producto. Cada caso utiliza un esquema aleatorio y elimina únicamente su propio esquema de prueba.

```text
backend: jest --runInBand __tests__/exchangeIndexer.integration.test.js __tests__/exchangeSnapshotRoute.test.js
web3-contracts: hardhat test test/ExchangeIndexerIntegration.test.js
```

Sin el puerto, los casos SQL y de integración con PostgreSQL se omiten deliberadamente. Eso no equivale a haberlos aprobado. La prueba de ABI sí se ejecuta sin PostgreSQL.
