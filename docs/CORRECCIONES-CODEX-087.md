# CODEX-087 — Correcciones y preparación de Demo

30 de septiembre de 2026. Trabajo autorizado por Miguel: completar las correcciones pendientes y elegir una política de patrocinio de gas para Demo basada en prácticas de proveedores de la industria.

## Presupuesto de gas

La documentación oficial de Alchemy permite límites de gasto total, por remitente y por transacción, cuotas de operaciones y reglas de acceso: https://www.alchemy.com/docs/wallets/transactions/sponsor-gas/conditional-sponsorship-rules . Se adoptaron esos mecanismos de control, no una cifra atribuida a Alchemy ni una integración con su servicio.

Política piloto elegida para Optimism Sepolia (11155420), con ETH de prueba:

- 0,01 ETH por día UTC como presupuesto global.
- 0,0001 ETH como máximo por paso patrocinado. Una operación de varios pasos no equivale necesariamente a una única transacción.
- 3 operaciones patrocinadas por usuario y día.
- 0,002 ETH por día para amortizaciones automáticas, INCLUIDOS en los 0,01, no adicionales.
- 0,0001 ETH máximo por amortización automática.

Valores aplicados en la base de Demo mediante transacción, con comprobación de red/despliegue, comparación del estado previo y registro `demo_gas_policy_initialized`, referencia CODEX-087. Esto configura topes: no transfiere ETH ni demuestra que todos los firmantes remotos estén disponibles y financiados. No activar automáticamente esta política en mainnet. La función `demoGasPolicy` rechaza otra red.

Las reservas de operaciones firmadas pendientes siguen contando al cambiar de día. Un fallo confirmado también conserva su reserva de gasto. Se abandonan únicamente preparaciones de mantenimiento vencidas SIN firma; no se borra evidencia de transacciones firmadas. Un presupuesto reducido se vuelve a verificar antes de firmar una preparación antigua.

## Contratos: consumo de muchos movimientos

CoreProtocol conserva el orden (vencimiento, identificador original) con un árbol AVL y sumas de importes y margen de recargos por subárbol. Puede amortizar un rango completo sin escribir cada compromiso por separado. Las prórrogas retiran y reinsertan la posición; no dejan duplicados activos. Los recargos se amortizan primero y el margen utilizado baja exactamente lo pagado. Los getters públicos conservan las firmas y las salidas nombradas; verifican el estado activo para no mostrar importes históricos ya consumidos como pendientes.

BlueToken usa grupos internos de 32 posiciones y una marca por posición activa. Cada pago conserva su importe y fecha individual: NO se agrupan económicamente por día ni se redondean fechas. Un grupo completo se consume usando su suma; dentro de un grupo se mantiene el orden de recepción. Para vender, se recorren únicamente posiciones liberadas y se comprueba que estas más el saldo libre sin parking cubran la venta. Si no cubren, revierte todo. No se recorre dos veces el mismo historial para validar y consumir.

Se preservan KYC, prohibición de transferencias BLUE fuera del Exchange, RED intransferible, emisión/quema pareadas, permisos, orden del Exchange y reglas existentes de prórroga. FifoExchange, RedToken, CollateralVault y ProtocolTreasury no cambian su código en esta entrega.

Mediciones locales finales de gas, no precios en ETH ni dólares:

- Cruce y amortización de 996 compromisos entre 1.000 posiciones: 469.352 gas. Antes agotaba un presupuesto de 16 millones.
- Crear la venta de 996 BLUE liberados de ese historial: 653.012 gas.
- Amortizar con 1.000 ingresos BLUE aún en parking: 397.235 gas; estimación 498.871.
- Vender 499 BLUE de 1.000 posiciones con fechas alternadas: 4.681.460 gas; estimación 4.754.607. El margen de seguridad del servidor permanece dentro de 8 millones.
- Crear un pago con 1.000 compromisos activos: 921.434 gas; la mejora exige almacenamiento adicional al registrar movimientos. No todas las operaciones se abaratan.
- Despliegue local CoreProtocol: 4.695.377 gas, bytecode 20.839 bytes. BlueToken: 1.822.824 gas, bytecode 7.817 bytes. Ambos caben en el límite configurado de 5 millones y el límite de tamaño EVM.

La prueba que alterna fechas deliberadamente obliga al administrador a cambiar el plazo entre pagos. Es una prueba adversarial, no una previsión de uso normal. El parking sigue teniendo coste proporcional al número de grupos o posiciones examinadas en fechas mezcladas: NO se demuestra soporte ilimitado de historial. Se probó hasta 1.000 posiciones. No se elevó el límite de gas para ocultar fallos.

Se descartó un árbol de rangos para BLUE porque la venta de fechas alternadas agotaba gas. El código entregado usa grupos y marcas de posiciones; el árbol AVL se usa para RED. Las pruebas comparan con modelos independientes de listas: 1.800 operaciones aleatorias RED y 1.400 BLUE, además de regresiones de integración.

**Estos cambios de almacenamiento requieren nuevos despliegues coordinados. No son una actualización compatible de almacenamiento de un proxy y no modifican contratos ya publicados.** Mantener el manifiesto actual hasta disponer de direcciones y enlaces nuevos verificados. No trasladar balances ni borrar el historial del despliegue anterior de manera implícita.

## Servidor y datos confirmados

- Los trabajadores de liberación y cobro basados en SQL se sustituyen por un mantenimiento único, sin ciclos superpuestos. Lee estado on-chain, guarda la procedencia del bloque y solicita `settleMatured` solo cuando corresponde y hay política de gas configurada.
- Migración 118 crea `web3_wallet_snapshots`, identificada por red, Core y billetera. Incluye máximos de mantenimiento inicialmente cero, sin sobrescribir configuraciones existentes.
- Cada lectura de billetera usa un único hash canónico; verifica red, frescura y el hash al terminar. Una reorganización o lectura fallida no permite fabricar un saldo SQL. El mantenimiento no usa el reloj de la base para decidir el vencimiento.
- Se retiran los endpoints heredados que aceptaban un depósito declarado por el navegador o amortizaban escribiendo solo SQL. La consulta de saldo de una cuenta activa no cae silenciosamente a un saldo antiguo de base de datos. Se conserva el contexto separado de pre-lanzamiento/IOU.
- La firma administrativa comprueba que la clave configurada corresponda al owner antes de preparar la transacción. No se creó ninguna clave ni se sustituyó el secreto que protege las billeteras.

## Exchange e inconsistencias RPC

El indexador concilia cantidad de órdenes, identificadores, número de cruces, reservas BLUE/USDT y devoluciones pendientes contra el contrato, anclado al mismo bloque, antes de avanzar el cursor o renovar el estado listo. Si el proveedor omite eventos, no acepta silenciosamente un cero o una proyección incompleta. Es conciliación agregada: no sustituye una auditoría exhaustiva de la distribución por cuenta.

La cola pública queda identificada por red y Exchange, usa una instantánea SQL coherente y exige sincronización reciente. Los totales son importes decimales exactos; no sumas de números flotantes.

`EXCHANGE_INDEXER_FALLBACK_RPC_URLS` acepta un arreglo JSON de hasta tres endpoints alternativos autorizados. El cambio de proveedor repite el ciclo completo con sus verificaciones, sin combinar fragmentos de una página ni bajar la finalidad. No es un quorum. Una configuración inválida deja el indexador inactivo con aviso, sin derribar el resto del servidor.

Lectura real del 29/09 a las 23:27 UTC: Demo tenía cursor 49.460.414 con hash que coincidía con el nodo público; el objetivo registrado por Render era 49.100.720 y el estado RPC_BEHIND_CURSOR. En esa consulta el nodo público devolvió latest 49.460.942, finalized 49.460.414 y safe 49.101.310. Safe y finalized no eran coherentes entre sí. Esto acredita respuestas inconsistentes; no identifica el endpoint privado usado dentro de Render. No se retrocedió el cursor, se borraron órdenes ni se rebajó la finalidad.

## Validación y límites operativos

- Backend completo: 26 suites, 189 pruebas aprobadas, incluida integración PostgreSQL aislada.
- Contratos e integración: 197 pruebas aprobadas; prueba adicional de gas/tamaño de despliegue aprobada. Incluyen PIN, KYC suspendido, recuperación de envío, reversión de SQL, reservas y devoluciones, comisiones, prórrogas, reentrancia, paridad y estrés.
- Frontend: 15 pruebas aprobadas y compilación Demo aprobada. La interfaz de contratos incorpora los dos máximos de mantenimiento.
- Las pruebas usan contratos locales y esquemas aislados. No prueban disponibilidad del proveedor remoto ni sustituyen revisión externa del nuevo ledger.

Para cerrar la operación real de Demo aún hace falta: acceso autenticado a Render para comprobar/configurar el firmante administrativo owner sin compartir su clave por chat; confirmar saldos y separación de firmantes; configurar y verificar un RPC consistente, con sus alternativas; publicar servidor/interfaz y verificar su versión; aplicar 118; revisar y desplegar la nueva suite con enlaces/manifiesto comprobados; recorrer el flujo completo en Demo. Los presupuestos sí se aplicaron; no confundirlo con despliegue de contratos.

Los procesos de IOU/incentivos/donaciones de pre-lanzamiento que no pertenecen a estos endpoints no se declaran migrados integralmente por esta entrega. Tampoco se cierran por estas pruebas todas las propuestas económicas históricas del proyecto. No se certifica seguridad absoluta ni preparación para mainnet.
