# Correcciones CODEX-080 — 28 de septiembre de 2026

Miguel autorizó corregir los problemas encontrados al revisar ANTIGRAVITY-055 y continuar la implementación. Esta entrega modifica backend y frontend localmente; no publica Demo, no aplica migraciones reales y no modifica contratos Solidity, reglas FIFO ni la paridad de emisión/quema BLUE–RED.

## Seis problemas corregidos

1. **Pago realizado pero olvidado por el servidor.** Antes, un pago podía llegar a blockchain y perder su registro al revertirse la transacción de base de datos de la publicación. Ahora la transacción firmada se guarda de forma independiente antes de enviarla. Una referencia estable identifica cada pago. Al recuperar la operación se comprueba esa misma transacción, sin crear otro pago. La publicación y su historial se actualizan a partir del recibo confirmado, en una sola transacción SQL. Una confirmación en blockchain no se presenta como publicación liquidada hasta completar ese registro.
2. **Sesiones de usuarios suspendidos.** Las rutas que conservaban un verificador antiguo usan ahora el control centralizado, que consulta el estado actual de la cuenta. Las operaciones económicas vuelven a comprobar que la cuenta esté activa antes de firmar. Se conservan las sesiones necesarias para completar la solicitud de tutor; esto no habilita pagos reales de menores.
3. **BLUE total confundido con disponible.** La API consulta en el mismo bloque el total y el parking. La billetera separa total, disponible para vender y parking. El BLUE en parking sigue computando donde el contrato permite amortizar. En modo económico real, un fallo RPC devuelve indisponibilidad; no se reemplaza por saldos SQL antiguos. El dashboard usa la capacidad disponible calculada por el contrato.
4. **Operaciones incompletas sin salida clara.** La interfaz permite recuperar una operación guardada y abandonar únicamente pasos todavía no firmados. No permite borrar una transacción pendiente ni deshacer una aprobación ya confirmada. Conserva las referencias ante errores de comunicación y explica que los pasos ejecutados mantienen su efecto.
5. **Una excepción detenía la política global de límites.** Los fallos individuales se registran por usuario y versión de política. El proceso continúa con los demás. El administrador puede consultar incidencias por nombre y solicitar una nueva evaluación con la política vigente. Una transacción pendiente o conflictiva no se vuelve a emitir ciegamente.
6. **Confirmación con respuestas contradictorias del proveedor.** Se comprueban nuevamente el recibo, su bloque y el bloque de referencia seguro. Una contradicción, desaparición o cambio evita tratar la operación como confirmada. Esto no equivale a consenso entre varios proveedores ni protege frente a un proveedor que falsee coherentemente todas sus respuestas.

## Ajustes relacionados necesarios

- Los pagos reales de publicaciones solicitan PIN y muestran la comisión consultada al contrato. Un cambio de comisión exige volver a abrir el resumen. Cero es un valor válido. La duración mostrada es una estimación del parámetro actual, no una promesa de que no pueda cambiar antes de ejecutar.
- Solicitudes, ventas y donaciones tienen referencias de recuperación. El identificador de donación persiste en el navegador. Un rechazo confirmado permite un nuevo intento con nuevo consentimiento; un resultado incierto conserva la operación anterior.
- El historial registra los importes reales de `PaymentProcessed` y las amortizaciones de `DebtAmortized`. Se amplía la precisión de campos históricos a seis decimales con la migración 117.
- Se impide cancelar o alterar una publicación con un pago pendiente de conciliación. La conciliación puede recuperarse tras una caída del proceso o de SQL.
- Los envíos institucionales del puente usan el mismo registro y bloqueo de firmante para evitar colisiones de nonce.
- Marketplace y financiación de gas de billetera comparten cuotas por usuario y presupuesto diario UTC. Los pagos firmados reservan presupuesto; un pago revertido en blockchain sigue consumiendo gas. Las preparaciones de marketplace sin firma no consumen cuota.
- Se reutilizan los parámetros `gas_sponsor_enabled`, `gas_sponsor_daily_user_operations`, `gas_sponsor_daily_budget_wei` y `gas_sponsor_max_topup_wei`. Este último limita también la reserva máxima por pago patrocinado del marketplace. Deben revisarse operativamente: valores ausentes, cero o patrocinio desactivado bloquean el envío sin presupuesto. No se modificó ningún valor real.
- Se corrigió una referencia de variable antes de su inicialización en la consulta de saldos y un desbordamiento horizontal de la billetera en un panel estrecho.

## Escenarios comprobados

- El servidor pierde la actualización SQL después de enviar el pago: al recuperar se liquida una sola vez, con la misma transacción.
- Se vuelve a pulsar pagar o se recupera una donación: no aparece una segunda emisión por el mismo pago.
- Falla la proyección del recibo: la actualización SQL se revierte completa y queda pendiente de recuperación.
- El receptor amortiza automáticamente al recibir BLUE: el historial incluye la quema informada por el contrato.
- La comisión es cero, cambia antes de autorizar, o el importe usa seis decimales: se conserva la precisión y se exige consentimiento actualizado cuando corresponde.
- Un usuario suspendido conserva su token de sesión: se rechaza su acceso; una cuenta activa mantiene el flujo normal.
- Una aprobación ya fue confirmada: se pueden abandonar los pasos restantes, conservando la aprobación y su registro.
- Un usuario falla en una actualización de límites: se registra su incidencia y se sigue con los demás; la revisión posterior usa la política actual.
- El proveedor contradice el bloque seguro o modifica/desaparece un recibo: no se da por confirmado.
- El usuario consume su cuota en marketplace e intenta usar patrocinio desde billetera: ambos consultan el mismo consumo y se rechaza el exceso antes de enviar.
- La API recibe saldos SQL antiguos que contradicen el contrato: responde los datos del contrato; si este no puede leerse, devuelve error sin inventar disponibilidad.

## Verificación realizada

- **28 pruebas de integración** en `web3-contracts/test/PinOperationsRecovery.test.js`, con contratos locales reales y PostgreSQL aislado, aprobadas. Después se reforzó y volvió a ejecutar el caso de cuota compartida: aprobado.
- **35 pruebas backend en seis suites**, aprobadas: `web3Corrections`, `transactionPinSelfCustody`, `chainSigning`, `chainConfirmation`, `activeAccountSession`, `walletBalanceSource`.
- **27 comprobaciones de seguridad** de `backend/scripts/security-hardening-test.cjs`, aprobadas en PostgreSQL aislado. Esta ejecución precedió al ajuste de cuota compartida, verificado después por la integración específica.
- En conjunto son **90 comprobaciones seleccionadas**, no toda la suite del repositorio ni una certificación de seguridad.
- Construcción frontend Demo completada. Persisten avisos anteriores sobre scripts laterales heredados, una imagen antigua ausente y un fragmento vacío; no impidieron compilar.
- Navegador local con datos sintéticos: total 100 BLUE, disponibles 35, parking 65; comprobado a 409 píxeles sin desbordamiento horizontal. No fue una prueba en Demo ni con dinero real.
- Migración 117 probada sobre esquemas sintéticos, incluyendo repetición. No ejecutada sobre las bases reales del proyecto.

## Comparación de gas

La confirmación adicional, recuperación, registro de incidencias, consulta de saldos y control de cuotas son lecturas RPC y trabajo de servidor/base de datos: no añaden una transacción blockchain por sí mismos. El pago conserva la llamada económica del contrato existente. Se evita crear una nueva transacción económica para recuperar un pago ya enviado.

Abandonar pasos sin firmar es una acción del servidor: no deshace ni devuelve el gas de aprobaciones ya ejecutadas. Un intento rechazado que llegue a incluirse en blockchain consume gas. La financiación de una billetera por el patrocinador sigue requiriendo su propia transferencia, como antes. El presupuesto usa reservas conservadoras, no un cierre exacto de gasto por fecha de inclusión; las tarifas L1 pueden variar. No se midió ni se promete un coste monetario de producción.

## Antes de publicar y pendientes explícitos

1. Revisar el diff y este informe con Antigravity. No se delegó autorización de despliegue mediante este documento.
2. Hacer respaldo y aplicar las migraciones pendientes 114–117 en orden dentro del entorno autorizado. El preflight ahora exige las cuatro. No arrancar una versión nueva sin revisar el comportamiento del runner de migraciones.
3. Conservar el secreto de cifrado existente. Verificar firmantes separados, roles, red, direcciones, RPC, ETH y presupuesto de patrocinio dentro del servidor real. Ejecutar el preflight allí; un resultado local no acredita la configuración remota.
4. Publicar backend/frontend de forma coordinada y verificar recuperación, PIN, administración, saldos y patrocinio en Demo antes de abrir los flujos al público.
5. Revisar manualmente operaciones históricas del mecanismo anterior pendientes de conciliación: no se puede reconstruir una transacción firmada que nunca se guardó.
6. Los pagos reales de menores están bloqueados hasta implementar consentimiento independiente del tutor. El flujo anterior mezclaba atribución SQL al tutor con firma del menor; no se sustituyó por una autorización implícita.
7. Los agregados completos del calendario, próxima liberación de BLUE y todas las vistas económicas heredadas requieren continuar su integración con blockchain. Esta entrega deja en `null` resúmenes de fechas no disponibles en vez de mostrarlos desde SQL antiguo. Los lotes de compromisos siguen disponibles en la consulta paginada del contrato.
8. Persisten los pendientes anteriores fuera de este alcance: robustez completa del indexador señalada en CODEX-073, procesamiento de historiales masivos y revisión integral de flujos heredados. Esta entrega no afirma que todo el ecosistema esté listo para lanzamiento.
9. El PIN sigue siendo una autorización asistida por servidor. No se convierte en autocustodia exclusiva por usar cifrado ni por eliminar una referencia en memoria.

Las modificaciones se prepararon en una copia aislada. Su integración local se realiza con comprobación de huellas SHA-256 y respaldo previo, para no sobrescribir cambios concurrentes.
