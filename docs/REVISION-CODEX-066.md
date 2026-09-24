# Correcciones autorizadas por Miguel — CODEX-066

Fecha: 23-09-2026. Candidato de revisión, **NO aprobado para despliegue**.
Base: HEAD 0f1f8ff3faff106cd1a4f4048a2ae4a442967479, incluyendo los cambios sin commit de Antigravity. Trabajo y pruebas realizados en copia aislada; entrega al árbol original solo tras comparar SHA-256 con el estado inicial. No se ejecutaron migraciones de DB, transacciones remotas ni despliegues. No se leyeron claves ni archivos .env.

## Regla corregida por Miguel

- Niveles 1–2: sin prórroga.
- Niveles 3–4: prórroga antes del vencimiento, respetando la capacidad ordinaria. Si falta capacidad para el recargo, amortizar o aportar USDT de garantía.
- Desde nivel 5: margen configurable exclusivamente para recargos. Valor inicial cero; el nivel por sí solo no concede importe.
- El fondo todavía no tiene operación ni fuente de financiación definidas. No se implementó que pague por los usuarios; RED no es transferible ni se usa como aportación al fondo. El receptor y las opciones de prórroga nacen sin configurar; los ejemplos de pruebas no son política aprobada ni un fondo real.

## Implementación de este lote

**CoreProtocol:** prórroga por compromiso, no por saldo global. Conserva las fechas BLUE del trabajador; el recargo crea BLUE con parking nuevo y la misma cantidad RED. Dos prórrogas por compromiso, al menos 15 días entre primera y segunda, sobre el principal pendiente sin capitalizar tarifas anteriores. Cotización comprobada al ejecutar: importe, vencimiento anterior, receptor y caducidad. Amortización aplica tarifas pendientes primero y libera el margen efectivamente pagado. Son decisiones de implementación sometidas a revisión, no nuevas instrucciones atribuidas a Miguel.

Plazo ordinario 30 días configurable (segundos, hasta 365 días), sin gracia adicional. No hay nuevos pagos estando en mora. Capacidad ordinaria = máximo de cero y límite + garantía − RED; incluye garantía en Vault y Exchange una sola vez. Orden de amortización por vencimiento real y luego ID, mediante heap; prorrogar no desordena compromisos. Autoamortización al recibir pagos, antes de vender y tras compras ordinarias cuando hay vencidos. Un ejecutor también puede solicitar la liquidación de BLUE contra vencidos. La blockchain necesita una transacción: no se ejecuta sola al avanzar el reloj.

Pago de 100 BLUE con comisión de plataforma del 5 %: trabajador recibe 100, receptor institucional 5 con parking, pagador recibe 105 RED. Comisión cero válida. KYC de participantes y receptores institucionales. El relayer ya no cambia límites ni atribuye compromisos unilateralmente. Pago directo por el pagador o autorización EIP-712, con nonce secuencial, expiración, red/contrato, importe, comisión y destinatario; comprobación ERC-1271 para cuentas contractuales.

**BlueToken:** parking por ingreso y fecha, solo Core emite/quema, BLUE libre solo circula por Exchange, sin P2P. Limpieza acotada del prefijo maduro sin quitar saldo. Venta descuenta los registros maduros consumidos. No se implementa aquí la cola previa de ventas en parking ni el pago nuevo compensado con BLUE.

**CollateralVault / FifoExchange:** una compra de amortización activa por usuario y reserva pendiente. Nuevos importes no aumentan prioridad de una orden antigua; la siguiente entra al final mediante otra llamada pública. USDT depositado sigue perteneciendo a la misma garantía aunque cambie de custodia. Solo el BLUE efectivamente recibido del cruce amortiza RED. Compra parcial, devolución del sobrante tras amortización por trabajo y cancelación retornan al Vault. Retiro a billetera separado, solicitado por el usuario y sujeto a todos sus compromisos. Liquidación pública solo para compromisos vencidos. No se cambia la prioridad FIFO ni se financia una compra con un fondo.

El gasto bruto incluye comisión del Exchange y puede amortizar menos RED. Se comprueba que el cruce no aumente un déficit de cobertura: con límite100 + garantía100 y RED200, gastar100 con comisión1 % requiere garantía adicional para no terminar con RED101 sin respaldo suficiente. Si falta, revierte toda la transacción; no hay pérdida parcial de fondos.

**Backend y administración:** ABI alineada con artefactos reales, lotes paginados y auditoría de saldos en un mismo bloque; fallos RPC no se convierten en ceros de éxito. Comisión0, KYC booleano estricto, rutas para opciones de prórroga y beneficios 3/5, firma de auditoría corregida. Formulario administrativo de pagos exige autorización y firma del pagador. Faucet público desactivado; emisión de prueba solo por administración, con bandera explícita, red local/Optimism Sepolia, KYC y máximo 5.000 tokens de prueba. No se han implementado cuotas globales de patrocinio.

**Wallet / Exchange / simulador:** etiqueta visible de demostración; prórroga por compromiso, reloj real del simulador, seis decimales contables y microresiduos visibles; saldo de billetera se descuenta al comprar, FIFO respeta participantes anteriores, cancelación devuelve solo saldo remanente y no dinero ya gastado. Reserva y modal proceden del mismo estado, sin duplicar garantía. Exclusión mutua entre operaciones y reversión del estado si fallan. Cuota agotada deja continuar sin patrocinio. Ninguna operación del simulador es evidencia de una transacción real ni actualiza DB de producción.

**Preparación de despliegue:** corregido enlace Vault→Exchange (antes apuntaba a Treasury), enlaces BLUE/Exchange/Core y verificaciones. Bloqueo por defecto de despliegue remoto; redes de prueba explícitas. El script NO se ejecutó. No configura fondo, KYC institucional, niveles o tarifas inventados. Estos requisitos siguen siendo pasos de activación explícitos.

## Verificación ejecutada

- Hardhat: **119 pruebas aprobadas**, incluida la suite previa de FIFO, prórrogas, firmas de cuentas contractuales, KYC, pausas, límites, fechas, cancelaciones, compras parciales, amortización por trabajo, reserva, cobertura de comisiones, ABI del backend y secuencia reproducible de 80 operaciones mixtas. En cada paso relevante: suministro BLUE=RED, suma de lotes=RED, reservas físicas y contables. Las 80 operaciones son una muestra, no una prueba exhaustiva.
- Backend Jest: **29 pruebas aprobadas** en web3Corrections, adminSubmodulesIntegrity y adminUserDossier. No se ejecutó toda la suite del backend ni pruebas contra DB/RPC reales.
- Frontend Node: **14 pruebas aprobadas** del modelo financiero y Exchange simulado.
- Vite demo: compilación aprobada. Advertencias heredadas de scripts HTML sin type=module y referencia de imagen de Venezuela pendiente; no se afirma ausencia total de advertencias.
- Navegador local: acceso redirigió al login. No se usaron credenciales ni se eludió autenticación. Pendiente revisión visual autenticada de modales y pantalla administrativa.
- Las pruebas de Merkle/timelock Treasury se aíslan con ERC20 de prueba; **no acreditan compatibilidad con BLUE**. Otra prueba verifica expresamente que Treasury no puede repartir BLUE directamente y que el rechazo no consume el derecho de reclamo.

Reproducción con dependencias instaladas: `npx hardhat test` en web3-contracts; `node --test test/financial-demo.test.mjs` en frontend; Jest con los tres archivos indicados en backend; `npm run build:demo` en frontend. En la copia local las dependencias se enlazaron mediante junctions y se usaron los flags Node preserve-symlinks para ejecutar herramientas. No modificar esos enlaces/dependencias como parte de la revisión.

## Gas medido, no estimación monetaria

Hardhat local chainId1337, Solidity0.8.24, optimizador200, EVM paris. `GasScaling.test.js` mide el mismo usuario acumulando posiciones. Los importes y configuraciones están en el test, no son datos reales de clientes.

- 1 posición: pago384.510; consulta de garantía43.136; prórroga287.442 unidades de gas.
- 10 posiciones: pago315.224; consulta43.136; prórroga255.254.
- 100 posiciones: pago315.224; consulta43.136; prórroga255.254.
- 1.000 posiciones aún vigentes: pago315.224; consulta43.136; prórroga255.266.
- Tras adelantar31 días en ese escenario: consulta de garantía7.846.957. No se oculta este cuello de botella. Hay cuatro posiciones prorrogadas y996 vencidas.

Antes de podar subárboles cuyo primer vencimiento es futuro y evitar liquidación sin saldo, el pago de1.000 posiciones consumía5.147.707. La reducción aproximada94 % solo corresponde a ese escenario. No implica gas mínimo, coste fijo universal ni coste enUSDT: Optimism incluye componentes adicionales de datos/L1. Amortizar muchos lotes y recorridos de parking aún requieren trabajo.

## Bloqueos y decisiones pendientes antes de desplegar

1. Fondo: definir quién aporta, qué cubre, límites, pérdidas, liquidez, propiedad/retiro y recargos. El contrato receptor configurado no prueba respaldo ni autoriza uso de fondos de usuarios. Prórrogas deben permanecer deshabilitadas hasta completar esa política y su integración.
2. Treasury: reclamos BLUE directos y retiro de excedentes son incompatibles con la restricción Exchange. Definir ruta de beneficios compatible; además revisar ciclos Merkle, reservas y salida USDT. No abrir excepción de transferencia ni prometer ganancias.
3. Escala: muchos vencidos y parking siguen generando trabajo proporcional al historial activo. Hace falta procesamiento acotado, progreso reanudable y pruebas de la operación completa, no solo cotización. No desplegar usando una medición favorable de prórroga para ocultar amortizaciones costosas.
4. KYC suspendido en cabeza de cola puede bloquear matching; core pausado también bloquea amortización. La protección de cobertura ante comisión puede detener el cruce hasta aportar respaldo o cancelar. Definir cuarentena/reanudación/cancelación sin saltar prioridades arbitrariamente ni devolver garantía a billetera. Pruebas adversariales adicionales de carreras y callbacks necesarias.
5. Residuo menor de1token: el mínimo vigente para nueva orden se respeta y queda reserva; no se borra RED, pero falta ruta de cierre para saldos pequeños sin inventar prioridad o exención de comisión.
6. Marketplace y contabilidad: firma requerida en Core/bridge aún debe integrarse en el flujo completo de publicación/pago. El flujo histórico de publicación calcula DB primero y no queda convertido en indexador por este lote. Completar eventos, bloque/logIndex, cursor durable, idempotencia, reorganizaciones y conciliación; DB económica solo desde confirmaciones blockchain. No activar estas funciones en producción mientras coexista contabilidad paralela.
7. Compensación de pagos nuevos con BLUE, cola de parking, halving y recuperación gradual del límite, comisiones por categorías, patrocinio4337, recuperación de cuenta y prueba de reservas no quedan terminados por estas correcciones.
8. Firma de pago: nonce secuencial usado aquí; decidir soporte de múltiples autorizaciones simultáneas. El acuerdo firmado incluye hash, pero falta cerrar validación de publicación/categoría y protección explícita frente a cambio de duración durante la validez de la firma.
9. Roles: owner configura beneficios; relayer no es automáticamente owner. Falta integrar firma multisig en administración, propiedad final, recuperación y política de cambios. Contratos enlazados inmutables no permiten añadir cualquier lógica en el futuro sin migración. Arranque Exchange debe impedir aceptación de órdenes antes de completar enlaces/KYC; hoy la suite standalone permite Exchange sin Core.
10. El simulador no modela toda la seguridad del contrato ni todos los participantes. Falta prueba de interfaz autenticada, firma y transacción real completa en red de pruebas cuando Miguel autorice el despliegue. No es certificación ni auditoría externa.

## Solicitud a Antigravity

Revisar el diff, reproducir resultados y señalar fallos concretos con caso, estado antes/después, corrección y prueba. Priorizar alcance3/5, cobertura neta de comisiones, paridad global, FIFO sin privilegios, consentimiento, rutas BLUE, indexador y gas de muchos vencidos. Proponer siguiente lote separado y distinguir regla de Miguel, recomendación y asunto pendiente. No desplegar: la autorización actual fue corregir código y solicitar verificación.
