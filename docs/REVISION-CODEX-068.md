# Entrega de correcciones CODEX-068

Fecha: 24-09-2026. Base revisada: HEAD 498abc9, incluido el cambio 27c6228 de Antigravity. Responde a ANTIGRAVITY-048/049 y al encargo de Miguel de revisar, corregir y probar. Se trabajó en copia aislada. No se desplegó, no se migró ninguna base de datos y no se usaron claves ni RPC externos.

## Resultado y alcance

La revisión confirma avances, pero no confirma que la suite esté lista para desplegar. Se corrigieron continuidad de órdenes, custodia de devoluciones, aplicación de BLUE devuelto a vencidos y ejecución real de bonos de tesorería. La limitación de gas para muchos vencidos permanece reproducida. Que las pruebas pasen incluye verificar este rechazo conocido; no significa que ese caso grande funcione.

## Fallos reproducidos y cambios

### 1. Orden omitida por KYC quedaba fuera de la cola sin poder regresar

Antes: Bob publica venta10, pierde KYC y el motor avanza el puntero. La orden conserva estado OPEN y reserva, pero restaurar KYC no hace que se vuelva a visitar. El test añadido esperaba suspensión recuperable y falló con OPEN.

Ahora: estado SUSPENDED (valor5), evento con motivo (1:KYC, 2:cobertura de comisión), cancelación posible y reanudación explícita por el titular. Al reanudar entra al final con nueva secuencia; conserva ID, saldo y depósito original, sin privilegio frente a órdenes válidas que esperaron. Esta política de reingreso es una decisión de implementación para revisión, no una frase atribuida a Miguel. Ni el dueño del contrato ni un ejecutor pueden elegir parejas arbitrariamente.

### 2. Una compra sin cobertura suficiente para la comisión bloqueaba todas las siguientes

Ejemplo: límite100 + garantía100 respaldan RED200. Comprar con100USDT y comisión Exchange1% quema99RED y deja101RED con garantía0. La comprobación de cobertura rechazaba correctamente ese resultado, pero revertía el procesamiento entero de la cola.

Ahora: se revierte únicamente el intento de cruce, se suspende esa compra y se puede continuar con compradores válidos. La garantía100 no se pierde ni se quema RED ficticio. Tras depositar1USDT adicional, el titular puede reanudar al final y cruzar. La llamada de ejecución aislada solo admite al propio Exchange; las entradas públicas siguen protegidas contra reentrancia. Solo se maneja de esta forma el error concreto de cobertura emitido por el Vault. Errores desconocidos o pausa global de Core no se ocultan: revierten. Esto NO soluciona órdenes cuyo procesamiento completo agota gas.

### 3. Cancelaciones y devoluciones no respetaban toda la política económica

Antes: cancelar compra ordinaria podía devolver USDT a una cuenta sin KYC. La cancelación BLUE sí exigía KYC y quedaba bloqueada. Además, un BLUE que regresaba desde custodia no disparaba amortización de compromisos vencidos contraídos después de publicar la venta.

Ahora: se puede cancelar y detener la exposición de la orden, pero el dinero pendiente se conserva en custodia mientras falte KYC. Se registra por usuario y por token; no se confunde con excedente ni comisiones. Con KYC aprobado puede reclamarse una vez. Las compras de amortización canceladas siempre regresan al Vault, conservando las garantías requeridas: jamás se convierten en devolución directa a billetera.

Al devolver BLUE se ejecuta su amortización contra vencidos. Ejemplo: Bob vende100, después adquiere40RED y estos vencen. Al cancelar recupera60BLUE y se extinguen40BLUE/40RED. Si Core está pausado, la cancelación registra100BLUE pendientes hasta poder aplicar correctamente la amortización. Un USDT ordinario pendiente puede retirarse independientemente de ese BLUE detenido, con KYC aprobado. El cobro de comisiones del Exchange también exige KYC de la tesorería receptora.

Contabilidad: saldo físico Exchange = reservas + comisiones acumuladas + devoluciones pendientes + excedente. Los contadores históricos totalRefunded representan importe asignado a devolución; la transferencia efectiva retenida queda diferenciada por RefundHeld/PendingRefundClaimed. Un indexador no debe interpretar OrderCancelled como retiro ya pagado.

### 4. Regla de tesorería documentada, pero todavía sin ejecución compatible con BLUE

Antigravity registró la regla de pago ordinario en .agents/AGENTS.md. ProtocolTreasury seguía haciendo safeTransfer directo, rechazado por el BLUE real. Los tests unitarios anteriores con un ERC20 genérico ocultaban esa incompatibilidad; la prueba de integración previa la documentaba como pendiente.

Ahora: enlace único al Core correcto, pago ordinario y amortización dentro de una misma transacción. No hay excepción de tesorería en Core ni en tokens. Se mantienen KYC, capacidad, comisión vigente y parking ordinarios. Recompensas y pago corporativo sujeto a48h usan esa ruta. Pausa de tesorería también detiene el pago corporativo.

Ejemplo: tesorería tiene100BLUE y paga bono100 al5%. Se generan100BLUE con parking al beneficiario,5BLUE de comisión para tesorería y105RED a tesorería. Se queman sus105BLUE contra105RED. Gasta100BLUE netos, no queda RED nuevo suyo y el suministro total BLUE/RED termina igual al inicial. Necesita capacidad ordinaria para105, aunque solo gaste100 netos. No se le concede capacidad privilegiada ni se configura un límite productivo arbitrario en el script de despliegue. Las pruebas conceden explícitamente un límite de prueba.

Los ciclos de recompensa ahora están separados: hoja Merkle con doble hash de abi.encode(chainId, direcciónTreasury, rewardEpoch, usuario, importe). Cada setMerkleRoot incrementa rewardEpoch; al construir la raíz se usa el siguiente valor. Un bono viejo no es válido en otra época, red, contrato, importe o usuario. resetClaims se conserva como selector que rechaza el uso antiguo; ya no rehabilita la misma prueba. Esto requiere actualizar cualquier generador externo de raíces antes de activar bonos. No se encontró generador conectado a estas funciones en backend/src o frontend/src. No se implantó una salida USDT de tesorería ni un fondo de cobertura no definido.

### 5. La consulta limitada por importe no es un límite general de gas

Se corrigió getMaturedDebtUpTo para devolver como máximo el importe solicitado, devolver0 si se solicita0 y no reservar memoria proporcional al tamaño total del heap. getMaturedDebt sigue devolviendo el total mediante type(uint256).max. Antes devolvía el total del lote que alcanzaba el importe y0 significaba consultar todo. Los consumidores externos del método nuevo deben adoptar la semántica corregida. El Core ya aplicaba un mínimo antes de quemar: el sobrepaso de la consulta anterior NO demuestra una quema excesiva.

Persiste trabajo proporcional al número de posiciones en consultas totales, amortización y parking. Ni el límite de importe ni maxMatches/maxOrdersScanned acotan el trabajo interno de liquidar cientos de compromisos. No afirmar un máximo500.000 de gas ni un sistema blindado100%.

## Verificación

Hardhat: 149 pruebas aprobadas. Incluye regresiones que fallaron contra el código original, tesorería con BLUE real en lugar del sustituto ERC20, restricciones de KYC y pausas, reanudación FIFO sin duplicados, devolución y doble reclamo, igualdad de suministros, conservación de garantías, falta de cobertura de comisión, capacidad para bonos, ciclos y dominios de recompensa, ABI del backend y las secuencias mixtas existentes.

Backend Jest: 29 pruebas aprobadas en web3Corrections, adminSubmodulesIntegrity y adminUserDossier. No toda la suite del backend; no hubo DB ni RPC productivos. Aparecen avisos de configuración de notificaciones del entorno de pruebas. No se cambió frontend, ni se repitió su build, ni se afirma haber probado una interfaz autenticada nueva.

Reproducción: en web3-contracts, Hardhat test; en backend, Jest sobre los tres archivos indicados. La copia aislada usa node --preserve-symlinks --preserve-symlinks-main debido a dependencias enlazadas. Pruebas locales chainId1337, Solidity0.8.24, optimizador200, EVM paris.

## Gas comparado

- Cruce integrado sencillo: Exchange original192.035 frente a corregido193.231 unidades; aumento1.196, aproximadamente0,62%. Comparación aislada del Exchange con iguales Core/Treasury corregidos y mismo escenario. No incluye coste adicional de una suspensión ni prueba todos los tamaños.
- Bono100 por tesorería:419.911 con comisión0%;456.167 con5% o10% en el escenario probado. La ruta anterior no funcionaba con BLUE real, por lo que no corresponde compararla como alternativa viable más barata.
- Con1.000 posiciones (996 vencidas y4 prorrogadas): consulta total de garantía7.462.010; consulta limitada a1BLUE43.642. Son necesidades distintas: no presentar esa diferencia como acelerar una liquidación completa.
- Comprar996BLUE para amortizar en ese escenario falla con presupuesto16.000.000 de gas. El trazado local llega a KECCAK256 en Core con20 unidades restantes (insuficientes para su coste base); la llamada revierte y conserva RED y reservas. Esta es una prueba que documenta un bloqueo, no una simulación exitosa de ese pago.
- Pago con1.000 posiciones aún vigentes315.224; no extrapolarlo al caso con vencidos.

No se estiman dólares ni tarifas actuales de Optimism a partir de estas unidades.

## Pendientes que impiden aprobar despliegue

1. Resolver liquidación y parking masivos con progreso acotado y reanudable, conservando fechas, igualdad BLUE/RED y orden por vencimiento. Un relayer puede encadenar preparación limitada sin veinte acciones manuales del usuario; los fondos preparados no deben poder gastarse dos veces ni dejar salir BLUE mientras existe compromiso vencido sin tratar. Medir cada etapa y recuperación tras interrupción. No implementar un límite arbitrario de cinco lotes ni prometer500k sin medición.
2. Integrar estados SUSPENDED, devoluciones retenidas y nueva época de bonos en la interfaz e indexador reales. El bridge expone ABI/eventos, pero eso no crea un indexador durable. Persisten el flujo histórico DB-first, confirmaciones/reorganizaciones/idempotencia y pago marketplace firmado extremo a extremo pendientes de CODEX-066.
3. Arranque sin aceptar órdenes antes de todos los enlaces y KYC; definición de fondo y salidaUSDT institucional; residuos menores al mínimo; cola de ventas en parking y compensación de pagos con BLUE; halving/recuperación; comisiones por categoría; cuotas de patrocinio; roles/multisig y ampliaciones futuras. Nada de esto se considera terminado por este lote.
4. Decidir reservas de presupuesto de bonos frente a pagos corporativos y múltiples reclamos. Un derecho a bono publicado puede quedarse sin liquidez si otros pagos consumen la tesorería. Actualmente revierte sin consumir el reclamo; no hay promesa de liquidez reservada que el contrato no implemente.
5. Revisar autorización firmada frente a cambios del plazo y soporte de pagos simultáneos. Mantener los bloqueos y advertencias de CODEX-066 salvo lo expresamente corregido aquí.

## Entrega a Antigravity

Revisar el diff y reproducir las pruebas. Priorizar: límites de trabajo en Core/BLUE/Vault, comportamiento de una cabeza que agota gas, recursos custodiados durante pausa/KYC, adaptación del indexador y arranque seguro. Proponer prueba que falle antes y pase después de cada siguiente corrección, con cifras de gas. No atribuir a Miguel reglas nuevas de fondo o privilegios FIFO. No desplegar: este turno autorizó correcciones y pruebas, no despliegues.
