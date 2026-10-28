# Conciliación de migración a la suite V5

Estado: herramienta local de inventario y ensayo, **no** migración ejecutable. Versión revisada: commit `ae0f47f`, Optimism Sepolia (`11155420`).

## Resultado de diseño

`backend/scripts/audit_v5_migration_readonly.js` consulta la suite fuente y la V5 en el mismo bloque finalizado. No contiene signer, clave privada, llamadas de escritura, transacciones ni acceso a la base remota. La salida es un reporte JSON y el proceso termina con código `2` ante cualquier bloqueo o dato incompleto.

La herramienta compara:

- KYC, límite de crédito, nivel y margen de extensión;
- balances y suministro total BLUE/RED, incluyendo BLUE bloqueado;
- lotes RED con saldo y vencimiento, y lotes BLUE en parking con fecha de liberación;
- nonces de autorización de pago;
- colateral, reservas, pendiente de reserva, orden de amortización y consentimiento automático en Vault;
- libro de órdenes, prioridad FIFO, órdenes de amortización y colateral asociado;
- refunds BLUE/USDT individuales y globales;
- solvencia mínima del Vault y Exchange contra los pasivos contables visibles.

## Condiciones fail-closed

El ensayo se considera no apto si ocurre cualquiera de estos casos:

1. El inventario de billeteras no declara `complete: true`. Los mappings de Solidity no son enumerables; una lista parcial puede producir un falso “cero saldos”.
2. Falta bytecode, el RPC apunta a otra red, un getter no existe o se supera un límite de órdenes/lotes.
3. Una suite presenta `totalSupply(BLUE) != totalSupply(RED)` o decimales incompatibles.
4. Vault o Exchange no cubren los pasivos visibles.
5. Hay estado sin importador verificable: balances, lotes, parking, nonces, reservas, órdenes o refunds.

La igualdad neta final no autoriza una migración. Toda emisión y toda quema del procedimiento debe crear o destruir BLUE y RED en la misma cantidad 1:1 dentro de la misma operación protocolar.

## Uso local

1. Copiar `backend/scripts/v5-migration-readonly.example.json` fuera del repositorio o con un nombre ignorado.
2. Sustituir la billetera de ejemplo por una exportación completa y conciliada. Confirmar las direcciones de la suite fuente contra el ambiente Render en el momento del corte.
3. Definir `READONLY_RPC_URL` en la sesión, sin guardarlo en el archivo ni añadir claves privadas.
4. Ejecutar:

```powershell
$env:READONLY_RPC_URL = '<endpoint solo lectura>'
node backend/scripts/audit_v5_migration_readonly.js --config .\ruta\inventario.json --output .\ruta\reporte-nuevo.json
```

El archivo de salida se crea con modo exclusivo (`wx`): no sobreescribe evidencia previa. Sin `--output`, imprime JSON en la consola. Código `0` significa que el conjunto leído no tiene bloqueos; código `2` significa no migrar.

## Estado que no es migrable automáticamente en V5 actual

- Balances BLUE/RED: no hay puente ni importador pareado por usuario.
- Lotes RED: no hay función que conserve `id`, `remainingAmount`, `dueAt`, extensiones y orden FIFO.
- Parking BLUE: no hay importador que conserve cada `releaseAt`.
- Nonces: no hay setter; reiniciarlos exige invalidar autorizaciones antiguas y separar dominios de firma.
- Vault: los USDT están físicamente custodiados por el contrato fuente. Copiar números no mueve los tokens ni mantiene reservas.
- Órdenes: recrearlas modifica `sequenceId`, `createdAt` y prioridad FIFO.
- Refunds: deben reclamarse o liquidarse en la suite fuente; no son saldo libre transferible.
- Consentimiento automático: debe aceptarse de nuevo de forma explícita y versionada para la dirección V5; no se copia como simple bandera.

KYC, límite y beneficios cuentan con setters administrativos en V5, pero su repetición sería una operación privilegiada separada, sujeta a aprobación, trazabilidad y revisión; este script solo prepara las diferencias.

## Plan verificable de corte

1. Obtener una exportación completa de todas las direcciones presentes en KYC, límites, transacciones, eventos de tokens, lotes, Vault, órdenes y refunds; deduplicarla y documentar fuente/fecha.
2. Ejecutar un primer inventario en bloque finalizado y conservar bloque/hash/reporte.
3. Resolver en origen órdenes, refunds, reservas y compromisos, o diseñar un contrato migrador específico auditado que preserve tiempos y FIFO. La V5 actual no lo hace.
4. Con autorización humana concreta, congelar nuevas operaciones económicas en origen y fijar bloque de corte.
5. Repetir el inventario. Cualquier lectura incompleta o estado no importable mantiene el bloqueo.
6. Preparar, sin ejecutar aquí, las operaciones administrativas y el mecanismo pareado de migración. Revisar cada transacción y su gas en simulación.
7. Exigir aceptación legal aplicable a V5 antes de reactivar la garantía automática.
8. Tras una migración autorizada, repetir la conciliación y verificar eventos de emisión/quema pareados, supplies, saldos, lotes, Vault, órdenes y refunds.

## Barrera de selección de despliegue

El backend no interpreta el último manifiesto como autorización de corte. En Optimism Sepolia selecciona por defecto `V4_ACTIVE`, que corresponde a la suite que estaba sirviendo Render antes de V5. Las variables individuales solo pueden confirmar esa época; si mezclan una dirección de otra suite, el proceso falla cerrado.

`V5_CODEX_163` únicamente se selecciona con `WINTON_DEPLOYMENT_EPOCH=V5_CODEX_163`. En ese mismo cambio deben coincidir todas las direcciones de contratos y `EXCHANGE_INDEXER_START_BLOCK=50667758`. El indexador rechaza un bloque inicial de otra época para no omitir eventos.

Antes de habilitar esa variable deben cumplirse conjuntamente:

1. reporte de conciliación fijado a bloque finalizado, inventario completo y cero bloqueos;
2. migraciones 125 y 126 aplicadas correctamente;
3. documento de consentimiento específico publicado y flujo probado;
4. direcciones, enlaces, bytecode y seis decimales verificados;
5. aprobación humana del corte, de cualquier gasto y de las operaciones privilegiadas;
6. ventana de observación con endpoint `/api/web3/deployment` mostrando `epoch: V5_CODEX_163` y el fingerprint esperado.

La migración ordinaria 124 no cambia parámetros mientras siga activa V4. Después de seleccionar y validar V5, los parámetros se aplican de forma explícita con `node backend/scripts/apply_v5_demo_settings.js`; el comando vuelve atrás toda la transacción ante cualquier fallo. Ejecutarlo requiere la aprobación humana del corte y no sustituye la conciliación previa.

Volver a `V4_ACTIVE` es un recurso previo al inicio de operaciones V5, no una reversión económica general. Si V5 ya recibió órdenes, garantías, emisiones o quemas, cambiar de época sin una conciliación de incidente puede dividir el estado y queda prohibido.

## Datos aún necesarios

- Exportación completa y reproducible de billeteras afectadas. Las direcciones de las 20 cuentas QA no sustituyen el inventario on-chain.
- Confirmación fechada de las direcciones realmente configuradas en Render al cortar.
- RPC de solo lectura y bloque de corte finalizado.
- Decisión técnica: liquidar todo el estado fuente o desarrollar un migrador versionado. Esta decisión es material porque la suite V5 desplegada no ofrece importación.
- Revisión jurídica del traslado de consentimientos y obligaciones; este documento no certifica cumplimiento.
