# CODEX-088 — Comparación y reemplazo de contratos de Demo

30 de septiembre de 2026. Miguel autorizó resolver conexión, firma administrativa y revisión/reemplazo de contratos de Demo.

La comparación del bytecode real con los artefactos compilados, normalizando únicamente metadatos e inmutables de constructor, confirmó que BlueToken y CoreProtocol del manifiesto del 25/09 eran anteriores a CODEX-087. RED, Vault, Treasury y Exchange sí coincidían en lógica. Los enlaces se fijan una sola vez: cambiar Core/BLUE exige desplegar de nuevo los seis componentes enlazados. Se reutiliza el mismo USDT de prueba.

Antes de desplegar se verificaron BLUE/RED con suministro cero, Exchange sin órdenes (nextOrderId=1), reservas y devoluciones cero, y balances USDT cero en Exchange/Vault/Treasury. No se borró el estado anterior ni se cambió el manifiesto activo.

La nueva suite está desplegada en Optimism Sepolia (11155420). Direcciones y seis transacciones de creación: web3-contracts/deployments/optimism-sepolia-candidate-088.json. Enlaces, owner, relayer, decimales, paridad inicial y comisión Exchange cero comprobados. Se conservaron propietario y relayer existentes, sin generar ni divulgar claves. El despliegue usó únicamente ETH de prueba y un diario local de 14 transacciones firmadas/confirmadas para recuperación. El código coincide con el ensayado en CODEX-087; desplegado no equivale a activado en la aplicación ni a auditoría externa.

## Recuperación de sincronización

Alchemy ya configurado localmente y PublicNode coincidieron en safe/finalized y hash del cursor. Endpoint alternativo verificado en https://www.publicnode.com/ : https://optimism-sepolia-rpc.publicnode.com . Se incorpora como alternativa por defecto SOLO al indexador de cadena 11155420 cuando EXCHANGE_INDEXER_FALLBACK_RPC_URLS no está definida. Una lista explícita reemplaza el valor, y [] lo deshabilita. No afecta mainnet ni redes locales. Mantiene mismo cursor, finalidad, verificación canónica y conciliación. Cinco pruebas de configuración aprobadas. No se asume que un proveedor público tenga disponibilidad ilimitada.

## Activación pendiente en Render

El navegador integrado abre Render sin sesión. Está solicitado el inicio de sesión de Miguel. No hay acceso autenticado para modificar variables, y no se exportaron claves a documentos ni al puente.

1. ADMIN_CHAIN_PRIVATE_KEY debe contener la clave del owner existente, cuya dirección pública es 0x7d2C6c16EDe986a8bea0204A9824b4C264256C77. La clave local está en web3-contracts/.env bajo DEPLOYER_PRIVATE_KEY; verificar dirección antes de configurarla y nunca pegarla por chat. No rotar ENCRYPTION_SECRET. Revisar por separado RELAYER_PRIVATE_KEY y GAS_SPONSOR_PRIVATE_KEY y sus saldos.
2. OPTIMISM_RPC_URL y EXCHANGE_INDEXER_RPC_URL deben utilizar una conexión consistente. Existe Alchemy configurado localmente; su URL privada no se incluye. Alternativa pública indicada arriba. El fallback publicado corrige únicamente el indexador; no sustituye comprobar las otras lecturas del servidor.
3. Antes de activar la suite nueva: registrar/copiar exclusivamente los parámetros y autorizaciones KYC que estén confirmados en el Core anterior; verificar ausencia continuada de actividad/fondos; comprobar que no existan operaciones firmadas pendientes. Coordinar las direcciones de Core/Blue/Red/Vault/Treasury/Exchange, el manifiesto, y EXCHANGE_INDEXER_ADDRESS con startBlock 49469937. Mantener separado el stream anterior y no borrar sus registros. Esperar que el bloque de despliegue llegue a finalized para habilitar su proyección.
4. Ejecutar readiness autenticado y el flujo integral de Demo; comprobar nuevas direcciones visibles tanto en backend como en frontend. No activar parcialmente un conjunto mezclado ni concluir que todo está operativo por el mero despliegue.

La solicitud a Render es un bloqueo de acceso real, no otra petición de autorización sobre el trabajo ya encargado. La nueva suite queda como candidata hasta completar la activación coordinada. No se ha desplegado mainnet ni transferido dinero real.
