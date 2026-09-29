# CODEX-085 — Preparación operativa y publicación Demo

Miguel pidió resolver los problemas de los contratos y de las interfaces administrativa y de usuario. Esta entrega continúa CODEX-083/084 y publica esas correcciones en Demo. No equivale a certificar todos los flujos económicos ni desplegar nuevos contratos.

## Hallazgos comprobados

- Lectura SQL Demo, sin cambios: migraciones 114, 115, 116 y 117 aplicadas. El pendiente anterior de ejecutarlas ya no corresponde.
- Patrocinio activado, pero presupuesto diario y máximo por paso en cero. Eso impide financiar operaciones por diseño. No se inventó ni asignó un presupuesto.
- La configuración Demo local disponible no contiene las tres claves separadas, ENCRYPTION_SECRET ni OPTIMISM_RPC_URL. Esto NO demuestra su ausencia en Render: falta revisar ese entorno autenticado. No se deben generar claves nuevas para sustituir las existentes; cambiar la clave de cifrado puede impedir recuperar billeteras.
- Lectura pública de Optimism Sepolia: código, enlaces y seis decimales del despliegue del manifiesto verificados; CoreProtocol no pausado. No se firmaron transacciones ni se modificaron saldos.
- El proveedor público respondió alturas finalizadas diferentes en comprobaciones sucesivas. Una respuesta con altura mayor no demuestra recuperación estable del endpoint de Render. Se conserva cursor, finalidad e historial.

## Correcciones adicionales

1. El indexador comprueba la antigüedad del bloque latest antes de renovar el estado ready. Umbral predeterminado de 300 segundos, configurable mediante EXCHANGE_INDEXER_MAX_HEAD_AGE_SECONDS entre 30 y 3600. Un bloque con fecha futura superior a 60 segundos también falla. RPC_HEAD_STALE evita presentar un proveedor congelado como fresco. Se comprueba coherencia entre latest/finalized y el hash canónico del objetivo, sin bajar finality.
2. El lector exige timestamp válido y solicita no reutilizar caché HTTP. Esto no sustituye un proveedor fiable ni garantiza que todos los intermediarios respeten la cabecera.
3. Diagnóstico administrativo protegido por la autenticación y el límite de consultas existentes. Comprueba configuración sin exponer claves, permisos owner/relayer, saldos de gas, pausas, preparación SQL, presupuesto y estado del indexador. Comparte implementación con web3:readiness.
4. El panel Smart Contracts muestra el diagnóstico y permite repetirlo. Se corrige el rótulo que confundía el procesador de pagos con la billetera separada del patrocinador.
5. Se incluyen las correcciones visuales de billetera CODEX-083 y actualización de caché/reintentos CODEX-084.

## Verificación

40 pruebas backend en cuatro suites: indexación con PostgreSQL aislado, consulta de Exchange, reintentos/lector y preparación del servicio. Incluyen proveedor congelado, finalidad contradictoria, recuperación sin perder historial, presupuesto cero y relayer incorrecto. Compilación Demo y comprobación visual local del diagnóstico. No son pagos con usuarios reales.

## Condiciones que requieren operación del entorno

Revisar el diagnóstico dentro del servicio Render y conservar la configuración de cifrado existente. Corregir únicamente valores comprobados incorrectos, con firmantes separados y permisos del despliegue. Definir y financiar presupuesto de gas con autorización de Miguel. Confirmar publicación frontend/backend y caché del CDN. El diagnóstico es una comprobación de preparación, no una auditoría completa ni una prueba end-to-end de todos los pagos.

Los pendientes anteriores (procesamiento masivo de lotes, conciliación exhaustiva, tareas económicas SQL heredadas, entre otros documentados en CODEX-070/073/080) no quedan resueltos por esta entrega. No declarar lanzamiento general seguro por el resultado verde de estas comprobaciones.
