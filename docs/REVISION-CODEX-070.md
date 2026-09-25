# Revisión y correcciones CODEX-070 — ANTIGRAVITY-050/051

24-09-2026. Encargo de Miguel: leer, revisar, corregir y probar. No autoriza despliegue. Se revisó el estado real del repositorio (HEAD498abc9 con CODEX-068 y migración110 sin commit). Trabajo aislado en revision-wintoncoin-069.

## Qué hizo Antigravity y qué no

ANTIGRAVITY-050 comunica revisión de CODEX-068 y añade migración110. ANTIGRAVITY-051 propone amortización en grupos de30 y consolidación diaria; NO había implementado esos dos cambios en los contratos. Las cifras industriales y promesas de coste/tiempo no constituyen una medición de WintonCoin. El estado de Antigravity mezcla además119pruebas antiguas con149 actuales; esta revisión ejecutó las pruebas de nuevo.

## Correcciones de código aplicadas

- Migración110 ya no importa una conexión a la base de datos al cargar el módulo. Exige el cliente conectado y la transacción del ejecutor oficial. SAVEPOINT hace que un error revierta todos los cambios de esta migración y conserve el error visible. Faltas de tablas o permisos no se ocultan. Un esquema creado no significa datos sincronizados con blockchain.
- Estados SUSPENDED/OPEN y motivo de suspensión compatibles con el contrato. Identificadores y secuencias pasan de BIGINT firmado a NUMERIC(20,0), para poder representar uint64 completo. Epoch pasa a NUMERIC(78,0), para uint256.
- Época nueva sin observar =NULL, nunca1 inventado. Valor legado se conserva pero queda reward_epoch_observed=false; solo debe mostrarse como confirmado si esa bandera es verdadera y tiene bloque/hash de procedencia. La migración no consulta blockchain ni declara una observación por sí misma.
- web3_pending_refunds representa el saldo pendiente observado, identificado por red+Exchange+billetera+token. Exige bloque y hash. Evita mezclar una devolución de Optimism con la misma dirección en otra red o en otro despliegue.
- web3_refund_events guarda la procedencia por red+Exchange+transacción+logIndex. Dos eventos distintos en la misma transacción son válidos; el mismo evento repetido no se inserta dos veces. is_removed permite representar invalidación, pero gestionar reorganizaciones y reconstruir saldos sigue siendo responsabilidad del indexador pendiente.
- Importes NUMERIC exactos, con rango uint128 en unidades de token, no negativos y máximo6decimales. Se evita redondear silenciosamente una séptima cifra. Se probó el máximo340282366920938463463374607431768.211455.
- Se elimina la reversión destructiva DROP...CASCADE. down rechaza borrar el historial; corregir adelante con una migración explícita.
- Nueva migración111 aplica estas correcciones incluso si la primera110 ya fue registrada por el ejecutor. Un esquema110 antiguo vacío puede reemplazarse dentro de la transacción; si contiene devoluciones sin procedencia, se detiene y exige conciliarlas desde blockchain. No se borran ni se inventa su red. Las dependencias SQL también se respetan al no usar CASCADE.

Estas tablas son infraestructura de persistencia. Todavía no constituyen un indexador conectado, ni sustituyen automáticamente el flujo histórico DB-first del marketplace. No se activaron en bases del proyecto.

## Escenarios y verificación

Se creó PostgreSQL17 vacío exclusivamente para pruebas, en127.0.0.1:54389, directorio pg-review-070. El test verifica el directorio de la instancia antes de crear su esquema; cada caso usa transacción y rollback. Se ejecutó migración109 como antecedente con tablas mínimas locales, no una DB de usuarios. No se leyeron credenciales del proyecto.

La batería inicial de10casos produjo9fallos contra110 original y10aciertos tras corregirla. Se ampliaron a14casos: dependencias ausentes, aplicar dos veces, unicidad por red/contrato, negativos, fracciones inválidas, máximo uint128, dos logs en una transacción, secuencia uint64 y época uint256, prohibición de borrado, registros legados sin procedencia, error SQL intermedio con reversión completa, actualización vía111, observación sin bloque/hash y ejecución sin transacción.

Resultado backend:43pruebas aprobadas (14 PostgreSQL reales +29 de correcciones Web3/administración). No toda la suite del backend. Las pruebas PostgreSQL se omiten deliberadamente si no se configura WINTON_MIGRATION_TEST_PORT; una ejecución sin ese parámetro no debe anunciarse como verificación de SQL real.

Hardhat:151pruebas aprobadas. Incluyen las149previas y2casos nuevos de fechas/medición. Después se amplió la matriz de mediciones del mismo segundo caso y se repitieron ambos con éxito. No se modificaron contratos Solidity en este lote; tampoco se modificó frontend ni se afirmó una nueva prueba visual.

## Mediciones que corrigen la propuesta de30lotes

Entorno: Hardhat local chainId1337, Solidity0.8.24, optimizador200, EVM paris. Cada compromiso nace de un pago de1BLUE; comisión plataforma/Exchange0 en este experimento. Historial idéntico restaurado mediante snapshot para comparar tamaños. No son precios en dólares ni garantías de latencia/confirmación en Optimism.

- Historial30, amortizar30: cruce1.942.926gas; publicar venta429.974 y compra220.739; total2.593.639.
- Historial1000, amortizar1: cruce534.678; venta2.727.238; compra220.727; total3.482.643.
- Historial1000, amortizar5: cruce1.483.950; total4.439.043.
- Historial1000, amortizar10: cruce2.526.178; total5.490.181.
- Historial1000, amortizar30: cruce6.268.306; venta2.778.928; compra220.739; total9.267.973.

Por tanto: dividir trabajo es una dirección razonable, pero30NO equivale a450.000gas en estos contratos. Incluso publicar una venta pequeña recorre el parking y cuesta millones con historial grande. Reducir únicamente _amortizeLotsFifo no acota los demás recorridos.

El caso anterior de996 sigue fallando con presupuesto de transacción16millones; no corresponde llamarlo automáticamente límite de bloque de todas las L2. Las pruebas verdes incluyen confirmar ese fallo y la preservación de reservas: el pago masivo todavía NO está resuelto.

## La consolidación diaria cambia fechas si se aplica sin revisar

El código usa block.timestamp+COMMITMENT_DURATION. Ejemplo probado: un pago a01:00 y otro aproximadamente a02:00 del mismo día tienen vencimientos diferentes30días después. Sumar ambos en el lote de01:00 adelanta el segundo; sumarlos al de02:00 retrasa el primero. Lo mismo debe cuidarse en parking, prórrogas, importe pendiente, comisiones y seguimiento de cada operación.

La cláusula propuesta «si exactamente misma fecha de vencimiento» no agrupa en general todo un día. No se implementó redondeo diario ni reinicio de fechas, y no hay datos de actividad para prometer80–90% de reducción. Agrupar solo vencimientos exactamente iguales también exige separar compromisos prorrogados, derechos y recargos; no basta remainingAmount+=importe.

## Fuentes contrastadas y límites

Chainlink recomienda limitar el conjunto de trabajo, revalidar al ejecutar y evitar procesar repetidamente lo ya realizado. No establece30como lote universal ni450kcomo coste universal: https://docs.chain.link/chainlink-automation/reference/automation-interfaces

En el RewardsController oficial de Aave V3 revisado, claimRewards recibe assets y el procesamiento recorre assets.length; no aparece el supuesto máximo general20–50en esa ruta. No atribuir ese límite ni gas garantizado a todos los productos Aave/Compound sin fuente/version concreta: https://github.com/aave/aave-v3-periphery/blob/master/contracts/rewards/RewardsController.sol

Las analogías de compensación bancaria no demuestran coste EVM. La afirmación «menos de un centavo, un segundo, jamás agota gas» no está acreditada para WintonCoin y se descarta como base de diseño.

## Próxima corrección requerida en contratos

No insertar un corte de30después de quemar el importe total. Eso podría dejar la suma de compromisos sin concordar con RED. Cada etapa debe calcular el importe realmente procesable, consumir exactamente ese BLUE y ese RED, actualizar los compromisos correspondientes y conservar intacto el resto. Revertir después del corte tampoco genera progreso: deshace todo.

Se necesita acotar conjuntamente parking, selección por vencimiento, amortización, actualización de garantías y callback del Exchange. Medir operaciones completas y máximos de historial, no solo número de elementos. Conservar prioridad FIFO, fechas y protección contra doble gasto en cada paso. La interfaz puede coordinar etapas sin firmas repetidas del usuario cuando la autorización existente lo permita; un relayer no obtiene facultad para mover dinero por añadir un bucle.

Escenarios obligatorios del siguiente lote: interrupción entre etapas, dos ejecutores a la vez, KYC o pausa entre etapas, cambio de comisión/plazo, trabajo recibido durante compra pendiente, compromiso prorrogado que cambia el orden, parking con1000ingresos, devoluciones retenidas y una orden cuyo procesamiento excede gas sin bloquear a las siguientes. Cada etapa debe poder reanudarse y preservar BLUE=RED y saldos custodiados.

## Estado de entrega

Este lote corrige el código de persistencia que Antigravity agregó y deja experimentos reproducibles para rechazar supuestos de gas/fechas incorrectos. NO implementa aún la solución completa de amortización masiva ni declara funcionamiento perfecto. Siguen los bloqueos de CODEX-066/068: indexador real, arranque seguro, fondo, interfaces reales, residuos y demás funciones económicas pendientes. Sin despliegue ni migración de bases reales. Antigravity debe revisar CODEX-070 y reproducir los casos.
