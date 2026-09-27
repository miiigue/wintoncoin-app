# Correcciones CODEX-078 — 27 de septiembre de 2026

## Resultado y alcance

Continuación autorizada de CODEX-076/077. Implementación local de autorización PIN para Vault/Exchange, recuperación durable de operaciones, aplicación progresiva de políticas RED y configuración de patrocinio. Sin cambios Solidity, sin publicación, sin migraciones en Demo, sin financiación ni cambios de propietarios. No constituye certificación de seguridad del ecosistema completo.

## Operaciones de usuario

La cuenta autenticada determina la única billetera asociada. Preparar no firma. El servidor valida identidad, KYC, red, contratos enlazados y seis decimales; presenta importe/destino/pasos/presupuesto y exige el PIN al firmar. No recibe una transacción arbitraria del navegador. Depósito, retiro libre, amortización, compra, venta, cancelación, reactivación y reclamo utilizan esta ruta. El envío externo admite únicamente USDT disponible de la propia billetera, separado de las garantías del Vault. Se añadió acceso directo a ese envío.

Los permisos de tokens se limitan al importe requerido cuando hace falta una aprobación nueva. Un permiso anterior más amplio no se incrementa ni revoca automáticamente. Cada paso se firma después de confirmar el anterior. Si falla un paso posterior, los anteriores no se deshacen: la pantalla informa, por ejemplo, que el depósito ya quedó en la bóveda. El PIN no se guarda en el navegador; queda temporalmente en memoria mientras se autorizan pasos de esa operación. La billetera sigue siendo asistida por servidor, no autocustodia demostrada ni abstracción ERC-4337.

## Recuperación y fuente de verdad

Migración116 crea chain_operations, credit_policy_versions y credit_policy_jobs. Se persiste la transacción firmada exacta antes de enviarla. La recuperación consulta su hash, red y bloque canónico y espera el bloque safe; un error de transporte no genera una firma nueva. La confirmación y la actualización del espejo administrativo comparten transacción SQL. Si SQL falla después de blockchain, se repite la conciliación, no el pago. La cola rota las comprobaciones para no dejar otras operaciones permanentemente atrás.

Los bloqueos de PostgreSQL por firmante y recurso evitan escritores concurrentes. Requieren conexión directa o pool por sesión; no son compatibles con un intermediario que cambie de sesión entre consultas. Una reorganización observada durante los pasos o un nonce consumido sin recibo deja el caso en revisión. No hay reemplazo automático por mayor comisión, cancelación de firmas ni reparación arbitraria de conflictos. Una transacción ya firmada puede seguir pendiente después de cerrar el navegador. La referencia persiste en sessionStorage y se vuelve a comprobar al abrir la app.

Una confirmación safe no es una garantía absoluta contra reorganizaciones profundas. No se implementó seguimiento perpetuo de operaciones ya confirmadas. Las comprobaciones de KYC previas al envío de USDT externo tampoco pueden modificar las reglas del contrato USDT para imponer un control adicional en el instante de inclusión.

## Administración y límites RED

Se mantiene la sección exclusiva Contratos y la selección individual por nombre de usuario incorporadas en076. Las escrituras administrativas usan ADMIN_CHAIN_PRIVATE_KEY, separada de RELAYER_PRIVATE_KEY y GAS_SPONSOR_PRIVATE_KEY. Un cambio recibido por el servidor se muestra pendiente hasta la confirmación de blockchain; no se presenta como aplicado antes de tiempo.

Cambiar una regla RED guarda una versión y una tarea reanudable. Se recorre una cuenta por ciclo, se preservan excepciones individuales y se evita sumar la garantía otra vez al límite base. Tras confirmar una operación anterior se vuelve a evaluar la cuenta con la política vigente: una actualización antigua no permite saltarse una política nueva. Si el límite ya coincide con el contrato, no se envía otra transacción. El cálculo usa unidades enteras de seis decimales para evitar errores como 0,1 + 0,2 al firmar.

Las versiones conservan el registro administrativo. La ejecución converge a la política más reciente; no promete terminar cada versión intermedia. Un fallo/reversión/conflicto detiene ese trabajo para revisión. Cuestionarios y pago anticipado siguen sin métricas integradas: la interfaz lo indica. Un cambio global no actualiza instantáneamente todas las billeteras y tiene gasto de gas por cuenta modificada.

## Patrocinio

Presupuesto global diario, cantidad diaria por usuario y máximo por paso configurables en Contratos. Desactivado y con presupuesto cero por defecto. Utiliza ETH existente en una billetera separada, sin emitir BLUE/RED. Una reserva de financiación se registra antes de enviarla y no se repite por un fallo de red. Las reservas sin firma de días anteriores no se firman bajo el presupuesto de hoy. No se libera automáticamente presupuesto de casos ambiguos.

El cálculo de Optimism incluye gas de ejecución, tarifa L1 sobre la transacción sin firma y tarifa de operador. Fuente técnica: https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts-bedrock/src/L2/GasPriceOracle.sol . Se rechaza la firma cuando la estimación supera el máximo autorizado. El máximo mostrado es presupuesto estimado previo, no un límite contractual absoluto sobre futuras tarifas L1. Las pruebas locales no miden precios reales de Optimism.

## Verificación

- 15 pruebas de integración con contratos reales en Hardhat y PostgreSQL17 aislado: identidad/PIN, KYC revocado, permisos exactos, depósito/retiro/envío, dueño de órdenes, parking, reserva Vault, paridad en amortización, interrupción tras envío, fallo SQL tras confirmación, concurrencia, patrocinio/cuotas, políticas y actualización anterior pendiente.
- 27 comprobaciones de seguridad con módulos reales y SQL aislado: administración, origen, revocación, política, identidad única, intentos PIN persistentes y migración de claves.
- 3 pruebas nuevas de cálculo de gas de Optimism y nonce pendiente, con proveedor simulado; 18 regresiones de controladores y PIN en la misma ejecución.
- 90 pruebas de diez suites seleccionadas habían pasado en esta misma revisión antes de los últimos ajustes; no se afirma que toda la suite backend esté validada.
- 4 pruebas frontend de identidad; compilación de React/PWA. Persisten avisos de páginas legacy e imagen previa.
- Navegador local con API sintética: saldos, envío de USDT, confirmación de destino y PIN y cierre satisfactorio. Sin fondos ni claves reales. Esta prueba visual no es una prueba en Demo.

## Activación y comprobación real

`npm run web3:readiness` en backend realiza comprobaciones de lectura; no imprime secretos ni aplica migraciones. Debe ejecutarse dentro del entorno real del servidor. La comprobación con backend/.env.demo.local el27/09 devolvió: secreto administrativo separado e identidades sin duplicados correctos; protección de billeteras, tres firmantes, red/permisos, migraciones114–116 y patrocinio no listos. Esto describe la configuración local disponible y la base consultada; no acredita las variables del servidor desplegado.

Antes de activar: respaldo probado de base/keystores; conservar el secreto de cifrado existente (no inventar ni rotar uno sobre claves antiguas); configurar los firmantes separados y comprobar permisos on-chain; definir y financiar presupuesto de gas; aplicar114/115/116 mediante el runner del proyecto; publicar backend/frontend coordinados y ejecutar el control en ese entorno. Arrancar el servidor puede ejecutar migraciones pendientes y no debe usarse como prueba inocua.

La migración116 no elimina datos. Las operaciones firmadas son evidencia sensible: limitar el acceso a la base y respaldos. No borrarlas para desbloquear un caso; comprobar hash, nonce, red y permisos antes de resolverlo.

## Límites que no resuelve este cambio

Persisten los pendientes anteriores de indexación/frescura y logs omitidos de073, gas con muchos lotes, flujos heredados del marketplace y demás decisiones económicas no implementadas. Tampoco se añadieron multisig, nuevo gobierno, recuperación de PIN perdido, custodia descentralizada ni publicación automática. El correcto funcionamiento de los casos probados no demuestra seguridad absoluta ni habilita un lanzamiento sin revisar estos pendientes.
