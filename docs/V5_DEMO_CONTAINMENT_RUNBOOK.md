# Contención, habilitación y rollback de V5 en Demo

Este procedimiento es exclusivo de Demo. No autoriza producción, gastos ni movimientos de fondos.

## Estado seguro por defecto

Con `WINTON_DEPLOYMENT_EPOCH=V5_CODEX_163`, el backend opera en modo de solo lectura salvo que se cumplan simultáneamente estos controles:

1. `WINTON_V5_ECONOMIC_WRITES_ENABLED=true`.
2. `WINTON_V5_WRITE_FINGERPRINT` coincide exactamente con el fingerprint que devuelve `/api/web3/deployment`.
3. El indexador FIFO de la misma época está en estado `ready`, sin error y actualizado durante los últimos 120 segundos.

El modo de contención permite consultas y acciones administrativas de pausa. Bloquea pagos, órdenes, patrocinios, mantenimiento automático, emisiones de prueba y cambios administrativos que puedan modificar el estado económico. Reanudar contratos también queda bloqueado.

## Preflight reproducible

- Contención esperada: `node backend/scripts/check_v5_operational_readiness.js --expect-contained`.
- Operación esperada: `node backend/scripts/check_v5_operational_readiness.js --expect-operational`.

El segundo comando solo puede aprobar después de validar bytecode, enlaces de la suite, fingerprint, base de datos e indexador. No imprime secretos.

## Activación controlada

1. Confirmar que la auditoría V4→V5 vigente terminó sin bloqueos y que el inventario de billeteras proviene de una exportación verificable de Demo.
2. Ejecutar suites completas de backend/PostgreSQL, contratos y recorridos E2E de las cuentas QA.
3. Verificar `/api/web3/exchange-queue` y una billetera QA: ambos deben usar snapshots V5 frescos.
4. Registrar el fingerprint V5 verificado en `WINTON_V5_WRITE_FINGERPRINT` y habilitar `WINTON_V5_ECONOMIC_WRITES_ENABLED=true` en una sola actualización de configuración.
5. Desplegar y ejecutar el preflight operacional. Si falla, no probar pagos ni corregir variables por tanteo.

## Rollback

1. Bloquear nuevas escrituras y detener el keeper antes de tomar el bloque de corte.
2. Consultar bloques `latest`, `safe` y `finalized`. Verificar BLUE/RED, Vault, Exchange, órdenes, refunds y operaciones pendientes. Un snapshot finalizado vacío no basta si `latest` contiene actividad.
3. Si V5 permanece completamente vacía, restaurar atómicamente la época V4 y su configuración completa. No mezclar direcciones individuales.
4. Si existe cualquier estado V5, no cambiar de época: conservar contención y preparar conciliación explícita.
5. Después del rollback, comprobar endpoint de despliegue, fingerprint V4, indexador V4, salud de la base y ausencia de operaciones firmadas para V5.

Las migraciones 125/126 son aditivas, pero su presencia no demuestra por sí sola que un rollback económico sea seguro.
