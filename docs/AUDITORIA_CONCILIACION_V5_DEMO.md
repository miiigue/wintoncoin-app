# Auditoría de conciliación V4 a V5 — evidencia histórica no aprobada

Fecha del ensayo original: 2026-10-28 03:07:14 UTC

Red: Optimism Sepolia (`11155420`)

Bloque finalizado: `50676496`

Hash: `0x33df355bcba64a8ca41f1fa6a0755efa3bcfdde81f8185b0fe55f178c1702e97`

Modo: `READ_ONLY_DRY_RUN_FAIL_CLOSED`

## Veredicto fiel al archivo fuente

El archivo `backend/scripts/v5-audit-demo-report.json` contiene `ready: false` y cinco bloqueos `INCOMPLETE_READ`. Por tanto, este ensayo histórico **no aprobó el corte ni certificó una migración completa**.

La causa de esos cinco bloqueos fue consultar `automaticExchangeCollateral` en la bóveda V4, que no implementa esa capacidad. El lector corregido exige declarar las capacidades de cada suite y omite solamente las consultas marcadas explícitamente como inexistentes. Cualquier otra lectura fallida continúa bloqueando la salida.

## Evidencia que sí aporta el ensayo

En el bloque fijado, las lecturas globales de V4 indicaron:

- `blueSupply = 0`;
- `redSupply = 0`;
- `totalCollateralLocked = 0`;
- `totalExchangeReserved = 0`;
- `nextOrderId = 1`;
- saldos y reservas globales del Exchange en cero.

Esto aporta evidencia fuerte de que no había tokens, custodia ni órdenes on-chain que transportar en ese bloque. No demuestra por sí solo que el estado administrativo estuviera vacío: KYC, límites, niveles y nonces son mappings que requieren una lista exhaustiva de billeteras.

## Limitación del inventario original

La configuración histórica declaró `walletInventory.complete: true` con solo cinco direcciones y sin una exportación verificable de PostgreSQL. Esa declaración manual ya no es aceptada.

El flujo corregido requiere dos pasos:

1. Construir el inventario desde un snapshot PostgreSQL `REPEATABLE READ READ ONLY`. El generador une `users.web3_wallet_address` con órdenes, refunds, snapshots, consentimientos, lotes y acciones observados por los indexadores, además de relayer, owner y tesorerías declarados explícitamente:

   `node backend/scripts/build_v5_audit_inventory.js --config backend/scripts/v5-audit-demo-run.json --output <inventario-generado.json>`

2. Ejecutar la auditoría on-chain usando exclusivamente el inventario generado:

   `node backend/scripts/audit_v5_migration_readonly.js --config <inventario-generado.json> --output <reporte-nuevo.json>`

El inventario generado no contiene nombres, correos, teléfonos ni IDs internos de usuario. Conserva direcciones públicas de billetera, conteos agregados, fecha, huella de las consultas y SHA-256 del conjunto ordenado. Las direcciones son identificadores seudónimos y pueden considerarse datos personales cuando sean vinculables; el archivo debe protegerse con acceso mínimo y retención definida. La salida se crea con exclusión para impedir sobrescribir evidencia anterior.

## Criterio de aprobación

Un reporte posterior solo puede considerarse apto para revisión cuando cumpla simultáneamente:

- `ready: true`;
- cero `blockers` y cero lecturas incompletas;
- inventario PostgreSQL conciliado, sin direcciones inválidas o duplicadas;
- capacidades V4/V5 explícitas;
- bloque finalizado y hash registrados;
- diferencias administrativas revisadas por una persona autorizada;
- pruebas E2E y plan de rollback documentados por separado.

Las pruebas técnicas no constituyen certificación legal, bancaria, SOC 2 ni garantía absoluta de seguridad.
