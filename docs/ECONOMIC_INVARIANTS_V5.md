# WintonCoin — invariantes económicas V5

## Regla universal BLUE/RED

- Toda emisión crea exactamente la misma cantidad total de BLUE y RED.
- Toda extinción quema exactamente la misma cantidad total de BLUE y RED.
- Al finalizar cada operación monetaria, `CoreProtocol` compara ambos suministros totales. Si no coinciden, revierte toda la transacción.
- Un pago mixto emite primero el total bruto en pareja y después quema en pareja el BLUE aportado por el pagador y el RED FIFO correspondiente. El aumento neto de RED es solamente la parte no cubierta con BLUE.

## Vencimiento y BLUE en parking

- Un lote queda vencido desde `dueAt`, sin período de gracia adicional.
- Una blockchain no inicia transacciones por sí sola. La quema se ejecuta en la primera operación que llame a `settleMatured`, o mediante el trabajador de mantenimiento del backend.
- Antes de un nuevo pago, una venta de BLUE, una compra ordinaria de BLUE o una reserva de USDT para amortización, se intenta liquidar primero el RED vencido.
- La liquidación puede consumir BLUE todavía estacionado en parking. La restricción de parking impide su transferencia o venta externa, pero no la amortización interna obligatoria.
- Si el BLUE no cubre toda la deuda vencida, se quema hasta el saldo disponible y el remanente vencido bloquea nuevas operaciones de crédito.

## USDT, garantía y exchange

- Una cuenta con saldo RED no puede crear una orden ordinaria `USDT_FOR_BLUE` directamente en `FifoExchange`.
- Debe utilizar `CollateralVault.depositAndRepayWithCollateral`, que en una sola transacción:
  1. liquida primero BLUE/RED vencidos disponibles;
  2. deposita el USDT en la bóveda;
  3. lo registra como garantía del usuario;
  4. lo reserva en una orden FIFO especial de amortización.
- Mientras la orden especial espera liquidez, el USDT permanece incluido en `userCollateral`, reservado y no retirable.
- Al ejecutarse, el BLUE neto comprado se quema junto con la misma cantidad de RED. La comisión del exchange se descuenta antes de la amortización.
- Si se cancela la orden especial, el USDT retorna a la bóveda, no a la billetera; continúa sujeto a las reglas de garantía y retiro libre.
- Si una compra supera la cobertura RED necesaria, el backend separa el importe: primero bloquea la cobertura completa mediante la bóveda y solamente después crea una orden ordinaria por el excedente. El contrato rechaza el excedente ordinario mientras la reserva no cubra todo el RED.
- Una cuenta sin RED puede continuar creando órdenes ordinarias. Esas órdenes no se contabilizan como garantía RED.

### Reclasificación de USDT ya depositado en el exchange

- El USDT permanece físicamente una sola vez en `FifoExchange`. `CollateralVault` registra únicamente su afectación contable como garantía; no existe una segunda copia del activo.
- El titular puede autorizar voluntariamente una parte de una orden `USDT_FOR_BLUE` existente mediante `CollateralVault.collateralizeUsdtOrder`.
- La reclasificación conserva `orderId`, `sequenceId`, fecha y prioridad FIFO. No cancela ni recrea la orden.
- El usuario puede registrar o revocar para el futuro el consentimiento `automaticExchangeCollateral`. Revocarlo no libera importes ya afectados.
- Al vencimiento, una llamada permissionless a `CollateralVault.collateralizeMatured` ejecuta este orden:
  1. `CoreProtocol.settleMatured` quema primero BLUE disponible, incluido parking, junto con igual RED;
  2. calcula el RED vencido que todavía queda y el importe USDT bruto necesario según la comisión;
  3. bloquea únicamente ese importe de las órdenes activas indicadas en orden FIFO;
  4. mantiene libre cualquier excedente.
- La porción garantizada no puede cancelarse ni retirarse. `cancelOrder` vuelve a ejecutar la protección de vencimiento y solo devuelve la porción libre; si toda la orden queda afectada, la cancelación se convierte en una operación sin retiro.
- Si una devolución USDT estaba retenida por suspensión KYC, al recuperar KYC no puede escapar de un RED vencido autorizado: pasa físicamente al Vault y queda como reserva pendiente.
- Un cruce consume primero la porción garantizada. El BLUE neto comprado se quema con exactamente la misma cantidad de RED; después, si sobra parte ordinaria y ya no existe objetivo RED, puede continuar el cruce normal conservando la misma prioridad.
- “Automático al vencimiento” requiere una transacción confirmada de usuario, relayer o keeper; no ocurre por el mero paso del reloj.

## Transferibilidad de BLUE

- El usuario no puede transferir BLUE directamente a otra billetera.
- La transferencia externa iniciada por un usuario solo está habilitada hacia `FifoExchange`, y únicamente para BLUE liberado del parking.
- `CoreProtocol` conserva las facultades internas estrictamente necesarias para emitir BLUE pareado, quemarlo de forma pareada y liquidar vencimientos.
- El exchange puede devolver BLUE al propietario al cancelar una orden; antes de dejarlo disponible vuelve a intentar la liquidación de vencidos.

## Autorizaciones de pago V5

- Existe una única ruta firmada: `processAuthorizedMixedPayment`.
- El dominio EIP-712 es `WintonCore`, versión `5`.
- La firma incluye `payerStateHash`, que vincula el consentimiento con saldos BLUE/RED, cobertura, margen, versión del libro y ventanas de vencimiento.
- Si el estado económico cambia después de cotizar, la autorización deja de ser válida y debe generarse un resumen nuevo.
- La ruta firmada V4 fue eliminada para reducir superficie de ataque y tamaño del contrato.

## Despliegue y migración

- Estos cambios requieren desplegar una suite nueva y actualizar simultáneamente ABI, backend, frontend y manifiesto de direcciones.
- No se deben reutilizar firmas V4 ni operaciones preparadas antes del cambio.
- Antes de activar V5 se deben conciliar órdenes abiertas, devoluciones, garantías, suministros BLUE/RED y operaciones pendientes del backend.
- El despliegue debe comprobar el bytecode publicado y ejecutar nuevamente invariantes, pruebas de firmas, flujo FIFO, parking, vencimientos, KYC y recuperación de operaciones.
- Ninguno de estos cambios autoriza por sí mismo un despliegue a producción ni movimientos de fondos.

## Evidencia local

- `CoreProtocol`: 24.177 bytes desplegados; límite EVM: 24.576 bytes.
- `CollateralVault`: 14.480 bytes.
- `FifoExchange`: 24.393 bytes; límite EVM: 24.576 bytes.
- La suite nueva `ExchangeCollateralizationV5.test.js` cubre autorización voluntaria, quema previa de parking, idempotencia, fill pareado, carrera de cancelación y devolución retenida.
- Backend relacionado: 36 pruebas aprobadas.
- Frontend demo: compilación Vite/PWA aprobada.
