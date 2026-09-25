# CODEX-072 — Indexador de órdenes y devoluciones

Fecha: 24 de septiembre de 2026. Implementación autorizada por Miguel: «ok implementa lo que dices de una vez». Continúa CODEX-070/071 y la revisión de ANTIGRAVITY-050/051. Alcance: backend y espejo de datos del Exchange integrado actual.

## Resultado

Implementado un trabajador continuo que lee la blockchain y actualiza PostgreSQL sin claves privadas ni envío de transacciones. Recupera el historial desde el bloque de creación, consulta el estado real de las órdenes y devoluciones, guarda avances de forma atómica y reanuda después de interrupciones. La API distingue actualización completa, reconstrucción, error y datos antiguos. Los saldos incompletos no se muestran como cero.

Ejemplo: Bob cancela una venta de 10 BLUE mientras su KYC está suspendido. El contrato conserva la devolución; el indexador refleja ese saldo retenido. Si Bob la reclama después, vuelve a consultar el saldo efectivo y lo refleja en cero. Releer el evento no agrega otros 10 BLUE. Si la cancelación desaparece por una reorganización, el historial de ese bloque se conserva como retirado de la cadena y se reconstruye el saldo canónico.

Una cancelación de compra financiada desde Vault está identificada por `is_amortization`. El importe devuelto de la orden no se presenta como saldo personal pendiente: retorna al Vault según las reglas existentes del contrato.

## Archivos y decisiones

- `backend/migrations/112_exchange_indexer.js`: cursor por red/Exchange, órdenes verificadas e historial de logs por bloque/hash/transacción/posición. Migración transaccional, repetible y sin reversión destructiva. No inventa procedencia para las órdenes antiguas.
- `backend/src/services/exchangeChainReader.js`: ABI contrastada con el contrato compilado, lector sin firmante, llamadas históricas fijadas por hash, configuración explícita y política `finalized` por defecto.
- `backend/src/services/exchangeIndexer.js`: exclusión entre procesos, lectura por páginas, deduplicación, consulta de saldos, guardado atómico, recuperación ante reorganizaciones, comprobación de hashes antes y durante el guardado. Reduce páginas que exceden su límite de eventos, sin saltarlas.
- `backend/src/services/exchangeSnapshotService.js` y `backend/src/routes/web3Routes.js`: consulta consistente con paginación y procedencia; sin datos parciales como saldos actuales, sin caché HTTP, sin divulgar errores de conexión.
- `backend/scripts/run_exchange_indexer.js` y `backend/package.json`: servicio independiente con reintentos y cierre ordenado; separado del relayer y del servidor web.
- Pruebas: `backend/__tests__/exchangeIndexer.integration.test.js`, `exchangeSnapshotRoute.test.js`, `helpers/exchangeDb.js` y `web3-contracts/test/ExchangeIndexerIntegration.test.js`.
- Operación y configuración: `docs/EXCHANGE_INDEXER.md`.

Se usa una proyección nueva de órdenes con red/Exchange. Reutilizar directamente la tabla antigua sin procedencia podría mezclar órdenes de pruebas y definitivas. Las devoluciones previas sin cursor del nuevo trabajador requieren conciliación; el servicio no las borra para arrancar.

## Verificación ejecutada

**71 pruebas backend aprobadas en seis suites:** 28 nuevas (19 de indexador/configuración y 9 de ruta), 14 de migración110/111 en PostgreSQL y 29 regresiones previas de Web3/administración/gobernanza. Es la batería afectada, no la totalidad del backend.

**4 pruebas Hardhat aprobadas:** correspondencia completa de la ABI del lector; orden y cruce parcial con devolución retenida y posterior reclamo; reorganización real con reconstrucción; devolución garantizada que retorna al Vault sin transformarse en retiro personal. Usan los contratos actuales y PostgreSQL real aislado. No se reejecutó toda la suite de contratos porque no se cambió Solidity; no se afirma una nueva ejecución de sus 151 casos anteriores.

Las pruebas incluyen duplicados, varios eventos en una transacción, reinicio, precisión máxima uint128, dos procesos, fallos RPC y SQL intermedios, cambio de cadena durante lectura y guardado, separación entre redes, paginación, bloque pendiente excluido, proveedor atrasado, configuración incompatible, exceso de eventos, datos antiguos y respeto de datos previos sin procedencia suficiente.

PostgreSQL17 de pruebas: localhost:54389, directorio `pg-review-070`, usuario de laboratorio `review070`. Cada caso verifica la instancia y crea un esquema propio. Contratos desplegados solo en Hardhat local desechable. No se leyeron credenciales del proyecto ni se ejecutaron migraciones en sus bases, ni transacciones en redes públicas. Los primeros ensayos detectaron y permitieron corregir un conflicto de tipos en la consulta SQL de inicialización. Las cifras anteriores corresponden a la ejecución final corregida.

## Coste y alcance pendiente

Este trabajador solo lee: **no añade gas de blockchain al usuario**. Sí tiene coste de infraestructura y consultas RPC; no se ha medido todavía con tráfico de producción.

No se arrancó contra redes públicas ni se activó en producción. La puesta en marcha necesita migración autorizada, configuración del despliegue real, RPC histórico compatible y servicio supervisado. El runner actual del servidor aplica migraciones pendientes al arrancar: considerar esto al publicar la versión.

La consulta está preparada para las vistas de la aplicación, pero este lote no cambia pantallas React. Tampoco completa el indexador del resto de contratos ni elimina todavía los flujos económicos DB-first del marketplace. No soluciona el problema de gas de historiales masivos documentado en CODEX-070.

La recuperación de reorganizaciones reconstruye desde la creación; es segura para la contabilidad del espejo pero puede tardar. El proveedor debe entregar logs completos. No se implementó quorum RPC ni reconciliación exhaustiva periódica de todos los contadores. Un bloque con más eventos que el límite permitido detiene el avance y exige revisar capacidad. No hay compatibilidad automática con proxies o futuras ABI. El estado `usable` certifica frescura del espejo, no permiso de retiro ni éxito de una futura transacción.

## Revisión solicitada a Antigravity

Reproducir las pruebas aisladas y revisar atomicidad, exclusión entre procesos, reorganizaciones, separación Vault/devoluciones personales, política de finalidad y tratamiento de errores. Proponer observaciones concretas antes de activar. Mantener separados los pendientes de escalabilidad, economía, interfaces y despliegue ya documentados. No interpretar la implementación del indexador como autorización para desplegar contratos o ejecutar migraciones reales.
