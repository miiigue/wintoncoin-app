# Preparación de pausa integral V5 — Demo

Estado: **preparado para revisión, no autorizado para ejecución**.

Este documento cubre exclusivamente Optimism Sepolia (`chainId 11155420`). No autoriza producción, firmas, transmisión de transacciones, movimientos de fondos ni uso de claves.

## Por qué se requiere

La bandera `pre_launch_mode_enabled` y `economicWriteGate` contienen las rutas del backend, pero no son leídas por contratos públicos. La pausa contractual debe comprobarse por separado en:

1. `CoreProtocol`;
2. `FifoExchange`;
3. `CollateralVault`;
4. `ProtocolTreasury`.

El owner V5 observado es una cuenta externa. Por ello la pausa necesita cuatro transacciones y **no es atómica**. Una interrupción puede dejar un estado parcial. El operador debe verificar cada recibo antes de continuar y detenerse ante cualquier diferencia.

## Herramienta de preparación

Desde la raíz del repositorio:

```text
node web3-contracts/scripts/prepare-v5-integral-pause.js --action pause --rpc-secondary URL_PUBLICA_INDEPENDIENTE
```

Para guardar un artefacto nuevo sin sobrescribir uno existente:

```text
node web3-contracts/scripts/prepare-v5-integral-pause.js --action pause --rpc-secondary URL_PUBLICA_INDEPENDIENTE --out ruta-segura/pausa-v5.json
```

El preparador:

- usa dos proveedores públicos independientes y no carga `.env`;
- valida chain ID, direcciones, bytecode, owners y `paused()`;
- fija la época `V5_CODEX_163`, fingerprint, owner esperado, hashes de bytecode, enlaces entre contratos y decimales;
- exige una segunda fuente RPC y compara bytecode, estados, bloques y nonces `latest`/`pending`;
- simula `pause()` mediante llamadas sin cambio de estado;
- estima gas desde el owner sin firmar;
- propone nonces como fotografía temporal;
- incluye calldatas de rollback `unpause()`;
- marca siempre `signed=false`, `broadcast=false` y `approvedForExecution=false`.

No existe opción para proporcionar clave privada ni para transmitir transacciones.

## Orden de contención

1. CoreProtocol.
2. FifoExchange.
3. ProtocolTreasury.
4. CollateralVault.

El Core se pausa primero porque varias rutas dependientes consultan su estado. Exchange se pausa inmediatamente después para impedir nuevas órdenes y matches. Treasury se pausa antes que Vault para cerrar reclamos de recompensas y salidas de tesorería antes de completar la contención de depósitos, retiros y garantías en Vault.

El rollback propuesto usa el orden inverso. No debe ejecutarse hasta conocer la causa de la contingencia, reconciliar el estado y recibir aprobación expresa.

## Puerta previa a una futura ejecución

Un segundo turno, separado de esta preparación, debe verificar:

- aprobación expresa de Miguel para cuatro transacciones on-chain;
- manifiesto y fingerprint V5 vigentes;
- `chainId=11155420`, bloques latest/safe/finalized y proveedor consistente;
- bytecode y owner iguales a los revisados;
- estado `paused()` actual de los cuatro contratos;
- balance de gas suficiente y ausencia de transacciones pendientes del owner;
- presupuesto total de gas calculado con margen y reserva explícita para la tarifa de datos L1;
- nonce y tarifas recalculados inmediatamente antes de firmar;
- simulación actualizada de cada operación;
- snapshot económico antes de la primera transacción;
- procedimiento de detención ante estado parcial;
- acceso al owner mediante mecanismo seguro, nunca por chat;
- revisión independiente del paquete y del rollback.

Los nonces, tarifas y estimaciones del JSON preparado caducan. Nunca se reutilizan ciegamente.

El preparador usa por defecto un margen de balance del 200% sobre el límite de gas L2 y una reserva adicional de `0.001 ETH` para la tarifa de datos L1. Ambos son configurables para revisión mediante `--balance-margin-bps` y `--l1-fee-buffer-wei`; el script falla cerrado si el balance observado no cubre el total. Cambiar estos valores requiere justificación y nueva revisión.

## Verificación posterior requerida

Después de cada recibo, antes de continuar:

1. confirmar `status=1`, chain, `to`, sender, nonce y calldata;
2. comprobar que el contrato objetivo devuelve `paused()==true`;
3. comprobar que los contratos ya pausados siguen pausados;
4. registrar bloque y hash sin publicar secretos;
5. detenerse ante cualquier resultado distinto.

Al completar los cuatro pasos:

- los cuatro `paused()` deben ser `true` en `latest`, `safe` y `finalized` cuando corresponda;
- el backend debe mantener Prelanzamiento activo;
- ninguna operación económica de prueba debe transmitirse;
- la comprobación de rechazo se realiza primero por simulación;
- BLUE y RED se concilian antes y después: emisiones pareadas, quemas pareadas y `totalSupply(BLUE)==totalSupply(RED)`.

## Estado parcial y rollback

La prioridad durante una pausa incompleta es terminar la contención, no reanudar automáticamente lo ya pausado. Si una transacción falla:

1. detener envíos nuevos;
2. leer estados y nonces otra vez;
3. conservar Prelanzamiento del backend;
4. identificar causa y volver a simular;
5. solicitar una decisión humana nueva si cambia el plan.

`unpause()` no debe usarse como reacción automática. Reanudar requiere conciliación, causa resuelta, simulación, revisión independiente y aprobación expresa.

## Limitaciones y mejora definitiva

- Un owner EOA es un punto único de control y no permite un lote verdaderamente atómico.
- La gobernanza futura debe evaluar un multisig con separación de funciones y procedimiento de emergencia.
- El panel administrativo debe mostrar el estado de los cuatro contratos, no solo Core/Vault.
- El diseño definitivo debe vincular Prelanzamiento con un control on-chain gobernado; una bandera SQL por sí sola no puede restringir llamadas directas.
- El código candidato bloquea durante `paused` el consentimiento automático, cancelaciones, reembolsos y retiro de comisiones. La suite V5 ya desplegada conserva su bytecode original; aplicar esta cobertura requiere una nueva suite versionada y una migración separada, no un deploy silencioso sobre V5.
