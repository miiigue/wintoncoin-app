# Contexto operativo de WintonCoin

Versión 0.2 — 24 de octubre de 2026. Es un índice inicial de hechos y decisiones; no certifica conocimiento completo, estado actual de producción ni cumplimiento normativo.

## Regla económica universal, definida e inviolable

Miguel reafirma expresamente en este chat, el 24 de octubre de 2026: «se mintean y se queman siempre BLUE y RED en igual cantidad siempre 1 a 1 sin excepción [...] todo lo que se realice debe cumplir esa regla».

- Cada emisión debe crear exactamente la misma cantidad de BLUE y RED.
- Cada quema debe destruir exactamente la misma cantidad de BLUE y RED.
- En todo estado válido confirmado debe existir exactamente la misma cantidad total de BLUE y RED: totalSupply(BLUE) == totalSupply(RED), con unidades y decimales coherentes. Contar todo el suministro, incluidos parking y saldos en contratos; no solo el disponible en wallets. Los estados intermedios de ejecución no pueden permitir aprovechar un desequilibrio. Esta comprobación se exige además de comprobar cada emisión y quema pareadas.
- Se aplica a cualquier funcionalidad y ruta que emita o queme estos tokens: pagos, comisiones, amortización, tesorería, incentivos, migraciones y recuperación. No hay excepciones por usuario, rol, gas, emergencia ni conveniencia técnica.
- Igualar el resultado neto, o compensar una emisión desigual con una quema posterior, no cumple la regla.
- Un diseño, código o prueba que admita emisión o quema no pareada es incumplimiento y debe corregirse. No se redefine la regla para justificarlo ni se pide al usuario que vuelva a decidirla.
- Los ejemplos y las modalidades de pago son aplicaciones subordinadas a esta regla; no sustituyen las reglas económicas universales.

Esta regla está definida. Lo pendiente es verificar y adecuar la implementación a las reglas ya establecidas. Las dudas sobre otros detalles se investigan en las fuentes vigentes y se identifican expresamente, sin afirmar por ello que esta regla esté pendiente de definición.

## Fuentes y ubicaciones

Repositorio: C:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract.
Carpeta documental y de preparación: C:/Users/migue/.codex/.chatgpt-projects/g-p-698897501bac819185ceb2353ce40694.
Documentos sources/ son referencias sincronizadas de solo lectura. El repositorio real y la carpeta documental no son intercambiables.

Leer instrucciones aplicables del repositorio, incluidas .agents/AGENTS.md. Para frontend, consultar MIGRACION_REACT_CATALOGO.md antes de intervenir. Las pruebas manuales para testers siguen el formato del catálogo del proyecto cuando exista un encargo de crearlas; esta preparación no crea pruebas manuales nuevas.

## Mandato empresarial confirmado

- Miguel y su hija son el equipo humano actual. Sin presupuesto adicional para nuevos servicios.
- Miguel dispone de Codex Pro y Antigravity Pro; no se han verificado cuotas ni habilitado consumo de API.
- Mercado considerado: Latinoamérica, posiblemente Argentina o Venezuela; país inicial pendiente.
- WTN Solutions LLC en Wyoming es información aportada por Miguel, no documentación societaria auditada.
- Objetivos: producto funcional, seguridad, eficiencia de gas, usuarios reales, feedback y crecimiento. La meta de usuarios de 2027 es una aspiración, no una proyección demostrada.
- Miguel quiere un único informe consolidado; no administrar conversaciones de cada especialista.
- Antigravity inactivo según confirmación humana del 24 de octubre. Puente manual vigente; sin vigilancia.

## Evidencia técnica de esta preparación

- Rama local demo; HEAD eb65b65, commit del 17 de octubre. Cambios locales rastreados y archivos nuevos pendientes; conservarlos y comprobar git de nuevo al comenzar cada tarea.
- Stack observado: Node/Express/PostgreSQL, React/Vite/PWA, Solidity/Hardhat, componentes Safe y WebAuthn. No se auditó todo el conjunto.
- El documento ESTADO-REINICIO-DEMO-165.md registra una verificación del 18 de octubre: suite de siete contratos y sincronización correctos entonces, con recorrido completo de usuario nuevo/KYC/passkey/pago mixto pendiente. No confirma el runtime actual.
- El puente llega a ANTIGRAVITY-138 del 15 de octubre y CODEX-162 del 16. Hay decisiones posteriores en otros chats. No tomar el puente como único estado vigente.

## Decisiones recuperadas y clasificación

DEC-001 — Regla universal inviolable: cada emisión y cada quema de BLUE y RED son siempre por cantidades iguales 1:1, sin excepción. Está definida y no está abierta a reinterpretación por los agentes. Fuente directa más reciente: reafirmación de Miguel en este chat el 24 de octubre; también «Ejemplificar ciclos de amortización», chat 01a147f5-f15e-7030-b407-70fe3e3a6645, y continuación en «Exchange FIFO (Work) (2)».

DEC-002 — Modalidad de pago aceptada. En «Exchange FIFO (Work) (2)», chat 01a150c7-302d-7aa1-a08c-4b1a0050548f, el usuario acepta el ejemplo donde se emite el pago completo pareado y sus BLUE amortizan RED por FIFO dentro de la misma operación, atendiendo primero compromisos anteriores y luego el nuevo. Exige una interfaz clara, actualizada y oportuna. Los remanentes anteriores conservan su vencimiento. Estado: decisión de comportamiento esperado; falta contrastar e implementar/probar lo que proceda. No sustituirla por la alternativa anterior de amortizar exclusivamente antes de emitir.

Fuente exacta DEC-002: turno humano 01a1566a-c4e2-7ed0-9855-35c1079b04e8, 19 de octubre de 2026, 20:06:40 (-03). Miguel: «el ejemplo D parece razonable y lógico [...] así es como debería ser»; reproduce «Usarás 14 BLUE para amortizar 5 RED anteriores y 9 RED de esta compra». La emisión completa y FIFO se leen con el ejemplo anterior y su respuesta explicativa, no se deducen como texto literal del usuario.

DEC-003 — Reserva USDT. El usuario establece que el USDT destinado a cubrir RED vencido debe quedar inmovilizado esperando comprar BLUE y quemarlo contra RED. La contabilidad debe evitar doble cobertura y doble capacidad. Fuente: «Exchange FIFO (Work) (2)», consultas sobre bóveda y órdenes normales. La conversión parcial automática de una orden normal es diseño propuesto en ese chat; no asumir implementación ni todos sus detalles aprobados.

La cobertura suficiente inmovilizada debe proteger al usuario de mora y penalizaciones mientras espera comprar BLUE para amortizar. Este es un requisito humano, no una implementación comprobada. Fuente exacta: turno 01a15768-a960-7353-b39f-493bffdbcefb, 20 de octubre de 2026, 00:43:59 (-03): «los usdt en espera en el exchange son garantía para que el usuario no caiga en mora y no lo afecten las penalizaciones». Quedan por formalizar comisión, cobertura parcial, tratamiento del descubierto, doble cómputo y transición compra/quema.

DEC-004 — Umbral configurable. En «Exchange FIFO (Work) (3)», chat 01a160ff-284e-7b73-8a4d-53f0db7615e3, el usuario pide un mínimo exigible configurable y coherente con mora, usando >1 RED como ejemplo. Se suman importes por usuario; el ejemplo no prueba que el valor 1 esté configurado. Los importes inferiores no se consideran extinguidos.

Fuente exacta DEC-004: turno 01a16b57-d471-7cf2-ac30-71014b555086, 23 de octubre de 2026, 21:38:00 (-03): «el smart contract se debe poder configurar para el mínimo exigible de RED vencidos por ej. >1 RED [...] también para evaluar si el usuario cae en mora».

DEC-005 — Responsabilidad del usuario y gas. En el mismo chat, el usuario corrige la propuesta de gestión colectiva: el usuario aporta recursos y cumple umbrales; la plataforma establece reglas y facilita operaciones. No adoptar como decisión vigente las propuestas anteriores de compras colectivas o barridos periódicos financiados permanentemente. El usuario quiere el menor número de movimientos y menor consumo de patrocinio. La ruta de gas propio y los mecanismos propuestos requieren comprobación; no garantizan patrocinio inagotable.

Fuente exacta DEC-005: turno 01a16b74-cfa0-7371-a9d4-7bdaa68205fc, 23 de octubre de 2026, 22:09:39 (-03): «todo el trámite queda en manos del usuario y la plataforma solo establece los umbrales que el usuario debe cumplir». Esta orientación humana posterior corrige la propuesta previa del asistente de lotes automáticos.

DEC-006 — Exchange nominal. En el mismo chat, el usuario quiere intercambio nominal 1:1 y puntual. No añadir valoración dinámica o un oráculo que cambie la relación de intercambio por iniciativa del agente. Distinguir explicar el funcionamiento nominal de prometer paridad económica o liquidez garantizada.

DEC-007 — Pruebas y producción. En «Exchange FIFO (Work) (2)», Miguel confirma usuarios en producción y que las pruebas nuevas se harán en demo. La autorización histórica de borrar demo pertenece a su encargo original; no autoriza otro borrado en esta preparación.

DEC-008 — Autonomía del equipo. En el chat de organización de agentes, Miguel elige preparar cambios y probarlos, reservándose producción, gastos y movimientos de fondos. El montaje inicial prepara perfiles y comprueba coordinación de solo lectura.

## IOU y adquisición

Dashboard distingue perfil de impulsor IOU y billetera durante prelanzamiento. momentumController/approveSubmission contempla acreditación por entregas aprobadas. docs/BOOSTERS_COMPENSATION_PROTOCOL.md describe IOU fuera de blockchain, pool de 100 millones y compensación futura condicionada. Son evidencia de código y documentación, no verificación de cifras de producción, de límite global efectivo ni de liquidez de conversión.

Los agentes deben conciliar IOU, validaciones, condiciones aceptadas y compromisos. No tratar los IOU como caja disponible, salario jurídicamente validado, inversión garantizada ni garantía de que un proveedor los aceptará. Incentivar contribuciones reales y útiles; no cuentas ficticias, spam ni fraude. No atribuir multicuentas a una IP o VPN compartida sin más evidencia.

## Legal y cumplimiento

docs/MARCO_REGULATORIO_Y_BLINDAJE_FINTECH.md contiene conclusiones categóricas sobre exención y blindaje que no se han acreditado. Un nombre comercial, no manejar fiat o utilizar contratos no determina por sí mismo el régimen legal. Todo dictamen debe fundarse en actividades, control real, condiciones y fuentes primarias vigentes por país. Los perfiles preparan investigación y expedientes, no certificaciones ni actuaciones profesionales reservadas.

## Fuentes primarias de verificación por tarea

- docs/ECONOMIC_RULES_V3_2026.md y decisiones humanas posteriores, registrando discrepancias.
- web3-contracts/contracts/CoreProtocol.sol, BlueToken.sol, RedToken.sol, FifoExchange.sol, CollateralVault.sol, ProtocolTreasury.sol.
- backend/src/controllers/momentumController.js y backend/src/services/momentumService.js para IOU.
- frontend/src/pages/Dashboard.jsx, Wallet.jsx, Exchange.jsx y módulos de autorización/pago para experiencia.
- docs/RELEASE_PROTOCOL.md, docs/LEGAL_PUBLICATION_RUNBOOK.md y flujos .github/workflows para procesos existentes.
- CONTEXTO-COORDINACION-AGENTES-2026-10-24.md en la carpeta documental para trazabilidad y continuidad.

## Pendientes que impiden afirmar preparación completa

Completar la conciliación de decisiones y aprobaciones leyendo los turnos originales pertinentes; comprobar código frente a DEC-002/003/004; identificar versiones y configuración realmente desplegadas; validar recorrido completo en demo; conciliar IOU y condiciones aceptadas; resolver clasificación jurídica de cada operación antes de ampliación. Las cifras de pruebas históricas no sustituyen la verificación de esos cambios.
