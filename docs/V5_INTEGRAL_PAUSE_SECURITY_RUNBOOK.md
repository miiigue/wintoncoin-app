# Procedimiento de seguridad para preparar la pausa integral V5 en Demo

Estado: **paquete en preparación; ejecución no autorizada**.
Fecha de referencia: 4 de noviembre de 2026.
Ambiente exclusivo: Demo sobre Optimism Sepolia (`chainId 11155420`).

Este documento no autoriza firmas, difusión de transacciones, cambios en Render, gastos, movimientos de fondos ni operaciones en producción. Miguel autorizó preparar el paquete; cualquier envío on-chain requiere una segunda aprobación expresa sobre el paquete exacto.

## 1. Objetivo y límite verificable

El objetivo inmediato es preparar una operación coordinada que active `pause()` en los cuatro contratos económicos V5:

- CoreProtocol: `0x103C502611008dAf8B0488E99486e46CCB00F41b`
- CollateralVault: `0xF970332060f1DB1475Fe2DAF1b5dfd89111c1A2B`
- FifoExchange: `0xE229ca0F66fA7b56130B81BadcfcB028C85c4917`
- ProtocolTreasury: `0x0723B1943Cb4EcDFcDD842B517006A076F281238`

El manifiesto V5 identifica como deployer y propietario observado de los cuatro contratos a `0x7d2C6c16EDe986a8bea0204A9824b4C264256C77`. La revisión del 4 de noviembre de 2026 observó que esa dirección no contiene bytecode y que los cuatro `paused()` devolvían `false`. Estos datos deben verificarse otra vez inmediatamente antes de preparar y antes de ejecutar.

La bandera SQL `pre_launch_mode_enabled` y `economicWriteGate` contienen las rutas del backend. No pueden impedir una llamada directa a contratos públicos. La pausa contractual corrige parte de esa separación, pero no equivale por sí sola a impedir literalmente toda interacción blockchain.

### Alcance residual obligatorio

`pause()` solo bloquea las funciones protegidas con `whenNotPaused`. En la suite V5 ya desplegada existen mutaciones que requieren análisis adicional, por ejemplo:

- `CollateralVault.setAutomaticExchangeCollateral(bool)` no usa `whenNotPaused` en el bytecode desplegado;
- cancelaciones, reembolsos y el reclamo de comisiones de Exchange no están todos protegidos por `whenNotPaused` en el bytecode desplegado;
- funciones administrativas `onlyOwner` siguen disponibles;
- los contratos de tokens, las cuentas Safe y las aprobaciones ERC-20 tienen controles propios.

Por tanto, después de pausar debe publicarse una matriz `contrato → función mutante → actor permitido → bloqueada por pausa → riesgo residual`. Hasta completar esa matriz, la comunicación correcta es: **rutas económicas principales pausadas**, no “toda interacción on-chain imposible”.

El código candidato posterior añade `whenNotPaused` a consentimiento automático, cancelación, reclamo de reembolsos y reclamo de comisiones, con pruebas específicas y regresión completa. Esa mejora **no cambia el bytecode V5 existente**: solo será efectiva on-chain después de desplegar una suite versionada, auditarla y realizar una migración autorizada. Las aprobaciones ERC-20 y otras interacciones propias de tokens o cuentas siguen fuera de la pausa de estos cuatro contratos.

## 2. Separación de funciones

| Función | Responsable | Prohibición |
|---|---|---|
| Propietario del requisito | Miguel | No firma sobre un paquete distinto del revisado. |
| Coordinación y registro | Codex/CEO | No firma ni sustituye la decisión humana. |
| Preparación técnica | Blockchain/Ingeniería | No accede a la clave ni transmite transacciones. |
| Revisión de seguridad | Seguridad | No aprueba su propio artefacto técnico. |
| Auditoría independiente | Auditor | No modifica el paquete revisado. |
| Firma owner | Titular autorizado de `0x7d2C…6C77` | No comparte semilla, clave, archivo de wallet ni código de recuperación. |
| Difusión | Operador autorizado tras segunda aprobación | No reordena, reemplaza ni acelera transacciones sin nueva revisión. |

El owner actual es una EOA y representa un punto único de compromiso y de operación. La migración a una Safe/multisig debe prepararse como cambio separado. No se mezcla una transferencia de propiedad con la pausa de emergencia.

## 3. Puertas de control

### Puerta G0 — Autorización

Debe existir un registro fechado que distinga:

1. autorización para preparar —ya concedida—;
2. aprobación técnica del contenido exacto;
3. aprobación humana posterior para firmar y transmitir cuatro transacciones;
4. cualquier gasto de gas o aporte de ETH, que requiere aprobación específica si fuera necesario;
5. autorización separada futura para reanudar.

La aprobación de preparación no se reutiliza como aprobación de ejecución.

### Puerta G1 — Identidad del ambiente

Dos revisores deben confirmar y registrar, sin secretos:

- red `optimismSepolia` y `chainId 11155420`;
- época `V5_CODEX_163` y fingerprint de despliegue esperado;
- las cuatro direcciones exactas del manifiesto;
- bytecode presente y hash de bytecode esperado en cada dirección;
- enlaces entre Core, Vault, Exchange, Treasury, BLUE, RED y USDT;
- `owner()` idéntico y esperado en los cuatro contratos;
- `eth_getCode(owner) == 0x` mientras siga siendo EOA;
- `paused()` actual de cada contrato;
- Prelanzamiento activo en la aplicación y writers/keeper contenidos.

Si red, dirección, bytecode, owner, fingerprint o enlaces no coinciden, se detiene la preparación. No se corrige una dirección por tanteo.

### Puerta G2 — Estado económico inicial

Tomar un snapshot fechado y ligado a un bloque `finalized` que incluya:

- `totalSupply(BLUE)` y `totalSupply(RED)`;
- comprobación separada de que `BLUE == RED`;
- balances de Vault, Exchange y Treasury;
- órdenes, reservas, refunds, garantías y comisiones pendientes;
- transacciones pendientes del owner y del relayer;
- cursor, target, lag y último éxito del indexador;
- operaciones administrativas preparadas o pendientes en la base.

La pausa no emite ni quema tokens. Cualquier diferencia económica antes/después es un incidente y bloquea el cierre.

### Puerta G3 — Nonce, gas y colisiones

Sin firmar ni transmitir:

- leer nonce `latest` y `pending` del owner mediante al menos dos RPC confiables;
- detener si difieren por una transacción no identificada;
- inventariar transacciones pendientes, reemplazadas o atascadas;
- estimar gas por separado con `eth_estimateGas` usando `from=owner`, destino exacto, valor cero y calldata `pause()`;
- simular cada llamada con `eth_call` en el bloque más reciente y desde el owner;
- calcular el máximo de gas de las cuatro operaciones con margen explícito;
- comprobar saldo ETH suficiente sin revelar balances de otras cuentas;
- no financiar la cuenta ni aprobar gasto sin autorización concreta.

Cada propuesta debe fijar red, destino, calldata, valor cero, nonce esperado, límite de gas, política de tarifa, fecha de expiración operativa y hash del artefacto. No incluir firma ni clave.

## 4. Secuencia coordinada propuesta

Los cuatro contratos existentes requieren cuatro transacciones. **No existe atomicidad EVM entre ellas** con el owner EOA actual. “Paquete integral” significa secuencia controlada y verificada, no una única transacción indivisible.

Orden preliminar sujeto a simulación y aprobación:

1. CoreProtocol — corta pagos, amortización y liquidaciones protegidas.
2. FifoExchange — corta creación/reanudación y matching protegido.
3. ProtocolTreasury — corta reclamos y ejecución de retiros protegidos.
4. CollateralVault — corta depósitos, retiros, garantías y amortizaciones protegidas; se deja al final porque su pausa también inmoviliza retiros ordinarios.

Después de cada confirmación:

1. esperar recibo exitoso y bloque suficiente según la política de finalidad definida;
2. comprobar `to`, `from`, nonce, valor cero, selector y chainId;
3. volver a consultar `paused()==true` mediante dos RPC;
4. registrar hash, bloque y hash de bloque;
5. comprobar que no cambió BLUE/RED ni apareció un evento económico inesperado;
6. solo entonces habilitar el siguiente paso.

No se firman las cuatro transacciones de antemano. Esto evita dejar transacciones válidas pendientes si cambia el estado o el nonce.

### Fallo parcial

- Si una transacción no fue encontrada: no repetir la firma; consultar mempool/nonce y esperar.
- Si revierte: detener la secuencia, conservar las pausas ya confirmadas y diagnosticar.
- Si confirma una pausa y falla la siguiente: no despausar automáticamente. La contención parcial es preferible a reabrir rutas sin análisis.
- Si cambia owner, bytecode, chain, nonce o destino: cancelar el paquete y reconstruirlo desde G1.
- No usar reemplazos por mayor comisión, transacciones de cancelación o nonces manuales sin revisión y aprobación nuevas.

## 5. Doble aprobación antes de ejecutar

La segunda aprobación de Miguel debe referenciar un informe resumido con:

- fecha y ambiente;
- commit y versión de los scripts de preparación;
- chainId y cuatro destinos completos;
- owner verificado;
- estado `paused` inicial;
- nonces propuestos;
- estimaciones de gas y coste máximo;
- hash del paquete sin firmar;
- orden de ejecución;
- riesgos residuales y efecto sobre retiros/cancelaciones;
- plan de fallo parcial y reanudación;
- nombres de preparador, revisor y auditor.

Una captura de pantalla no sustituye la comparación determinista del paquete. La billetera debe mostrar los mismos destinos, red, valor cero y calldata revisados.

## 6. Verificación posterior

El cierre requiere:

1. `paused()==true` para los cuatro contratos en bloque finalizado y por dos RPC;
2. receipts exitosos y canónicos para las cuatro transacciones;
3. ausencia de emisión BLUE/RED;
4. ausencia de quema BLUE/RED;
5. `totalSupply(BLUE) == totalSupply(RED)` antes y después;
6. balances de contratos, garantías, órdenes, reservas, refunds y comisiones conciliados;
7. backend todavía en `prelaunch_read_only` y writers deshabilitados;
8. simulaciones `eth_call`, sin transacción real, de las rutas económicas principales revirtiendo por pausa;
9. matriz de mutaciones residuales no cubiertas por `whenNotPaused`;
10. informe independiente con estado PASS/FAIL/BLOCKED por contrato.

No debe afirmarse “contención universal” si queda una función pública mutante utilizable durante la pausa.

## 7. Reanudación y rollback

`unpause()` no es un rollback automático ni forma parte de esta autorización.

Para preparar una reanudación futura se exige:

- causa original corregida y prueba de regresión;
- inventario on-chain y off-chain conciliado;
- indexador estable y fresco;
- revisión de todas las funciones residuales;
- writers aún deshabilitados durante la reanudación contractual;
- paquete nuevo, nonces nuevos, simulación nueva y aprobación humana nueva.

Orden preliminar de reanudación, sujeto al análisis de dependencias: Vault, Treasury, Exchange y Core al final. Core permanece pausado hasta que sus dependencias estén verificadas. Después de cada paso se vuelve a comprobar el conjunto completo.

En un fallo parcial no se intenta restaurar el estado previo por reflejo. Seguridad, Blockchain y Auditor determinan si conviene completar la pausa o preparar una reanudación parcial; Miguel decide cualquier transacción adicional.

## 8. Respuesta a incidentes

Se detiene toda firma y difusión si ocurre cualquiera de estos eventos:

- chainId, dirección, bytecode, owner o fingerprint inesperado;
- `latest nonce != pending nonce` sin explicación;
- transacción desconocida desde owner o relayer;
- simulación revertida o gas anómalo;
- saldo ETH insuficiente;
- cambio de Prelanzamiento o habilitación de writers;
- emisión, quema o cambio económico inesperado;
- RPCs en desacuerdo sobre bloque, nonce, bytecode o recibo;
- pérdida, exposición o sospecha sobre la clave owner;
- una interfaz solicita semilla, clave privada o código de recuperación.

Acciones de respuesta:

1. conservar evidencias y no publicar secretos;
2. detener el siguiente nonce;
3. mantener pausas ya confirmadas;
4. comprobar receipts y canonicalidad mediante fuentes independientes;
5. escalar a Miguel con impacto, alcance y opciones;
6. si existe sospecha de clave comprometida, preparar por separado migración de ownership a multisig; no improvisar transferencias.

## 9. Gobernanza multisig recomendada

La EOA owner actual es un riesgo operativo material. La recomendación es una Safe/multisig con:

- umbral que impida control unilateral y conserve capacidad de emergencia;
- firmantes en dispositivos y canales separados;
- política documentada de sustitución/recuperación;
- simulación y revisión de cada propuesta;
- roles separados para preparar, revisar y firmar;
- alertas de cambios de owner y transacciones administrativas.

La selección de firmantes, umbral, jurisdicción y custodia requiere decisión humana y revisión legal/operativa. No se despliega ni transfiere ownership como parte de la pausa actual.

## 10. Evidencia que debe archivarse

- autorización de preparación y posterior autorización de ejecución;
- manifiesto y fingerprint usados;
- snapshots G1/G2/G3 sin secretos;
- hashes de bytecode;
- package hash sin firmar;
- resultados de simulación y gas;
- comparación independiente del paquete;
- receipts y verificación de finalidad;
- snapshots económicos antes/después;
- matriz de funciones residuales;
- informe de incidentes o discrepancias;
- decisión posterior de mantener pausa o preparar reanudación.

Los artefactos no deben contener semillas, claves, archivos de wallet, códigos, tokens de sesión, variables `.env`, PII ni raw transactions firmadas.

## 11. Decisiones humanas aún necesarias

1. Aprobar o rechazar el paquete exacto después de su revisión independiente.
2. Aprobar el gasto máximo de gas si el owner necesita fondos o si el coste no estaba previamente autorizado.
3. Designar quién firma y quién presencia/verifica cada paso.
4. Definir si la intención es pausar solo rutas económicas o impedir también mutaciones no económicas permitidas durante `pause()`.
5. Decidir posteriormente la migración a multisig y sus firmantes/umbral.
6. Aprobar por separado cualquier reanudación futura.

Este procedimiento es una preparación técnica de seguridad. No constituye certificación de cumplimiento, asesoría jurídica ni autorización para operar fondos.
