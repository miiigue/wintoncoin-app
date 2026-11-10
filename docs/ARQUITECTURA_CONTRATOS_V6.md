# Arquitectura contractual modular V6

Estado: candidata local. No desplegada.

## Reglas no negociables

- Cada emisión y cada quema de BLUE y RED es atómica, pareada y por el mismo importe.
- La igualdad `totalSupply(BLUE) == totalSupply(RED)` se verifica antes y después de cada mutación monetaria.
- Todos los módulos económicos consultan un único modo global: `NORMAL`, `PRELAUNCH_FROZEN` o `EMERGENCY_EXIT_ONLY`.
- Prelanzamiento impide toda mutación económica de usuarios.
- Emergencia impide exposición nueva y permite únicamente reducción de deuda, cancelación y salida de activos libres.
- Ningún módulo puede reactivar localmente una operación bloqueada globalmente.
- La primera versión se compone con llamadas normales e interfaces estrechas: sin `delegatecall`, Diamond ni proxies.

## Módulos

### Gobierno y moneda

- `ProtocolModeController`: fuente canónica del modo operativo.
- `PairedSupplyController`: única autoridad que solicita emisión o quema pareada a los tokens.

### Core

- `PaymentEngine`: orquestador atómico de pagos y amortizaciones.
- `CommitmentLedger`: lotes RED, vencimientos y amortización FIFO.
- `PaymentAuthorization`: EIP-712, ERC-1271, nonces y protección contra repetición.
- `ExtensionManager`: prórrogas y márgenes.
- `RiskRegistry`: KYC on-chain, nivel y límites de crédito.
- `ProtocolConfig`: parámetros económicos y cambios con espera.

### Exchange

- `ExchangeRouter`: única entrada mutativa y defensa contra reentrancia.
- `FifoOrderBook`: prioridades, órdenes y estados; nunca mueve tokens.
- `ExchangeCustody`: depósitos, reservas, devoluciones, comisiones y solvencia.
- `AmortizationAdapter`: integración limitada con Core y Bóveda.
- `ExchangeConfig`: comisión y tesorería con espera.

## Política de tamaño y compilación

- Advertencia a partir de 16.000 bytes de bytecode desplegado.
- Objetivo máximo: 18.000 bytes por contrato económico.
- Excepción documentada hasta 20.000 bytes con revisión independiente.
- CI bloquea cualquier artefacto desplegable superior a 20.000 bytes.
- El límite ampliado de Hardhat solo puede existir en pruebas separadas de harnesses adversariales.
- Cada candidato registra compilador, optimizador, bytecode, `codehash` y gas de despliegue.

## Secuencia de entrega

1. Conservar la suite actual como referencia de comportamiento.
2. Implementar módulos aislados y pruebas unitarias.
3. Integrar `PaymentEngine` y `ExchangeRouter` con pruebas atómicas.
4. Ejecutar invariantes, fuzzing, reentrancia, gas y tamaño.
5. Adaptar backend y panel al controlador global.
6. Auditoría independiente.
7. Con autorización separada, desplegar una nueva suite exclusivamente en Demo y nacida en Prelanzamiento.

La suite actualmente desplegada no se migra ni se modifica automáticamente por este trabajo.
