# Reglas Económicas Oficiales del Ecosistema WintonCoin (Versión 3 - 2026)

Este documento constituye la especificación canónica e inmutable de las reglas económicas que rigen el ecosistema WintonCoin. Deroga y sustituye cualquier disposición previa contradictoria (incluyendo versiones preliminares de 2025 y menciones históricas de anulación inmediata). Todo el código fuente de los contratos inteligentes, el backend, las aplicaciones móviles y el frontend web se rigen estrictamente por los principios aquí establecidos.

---

## 1. Principio Sagrado de Emisión Pareada y Balance Cero

1. **Paridad Absoluta de Emisión:**
   - Los tokens **BLUE** (activo representativo de valor generado) y **RED** (obligación de pago / deuda contraída) **solo pueden nacer en el momento exacto en que un usuario realiza un pago por un servicio/producto o emite una donación institucional en el Marketplace**.
   - No existe pre-minado, ni venta fiduciaria inicial, ni asignación gratuita de tokens.
   - En todo momento se cumple la regla contable inquebrantable:
     **Total de BLUE Creados en el Ecosistema = Total de RED Creados en el Ecosistema**.

2. **Desglose del Pago Comercial (Ejemplo con Comisión del 5%):**
   Cuando un usuario (David) contrata y aprueba un servicio realizado por un prestador (Bob) por un valor de 100 dólares:
   - **Al Prestador (Bob):** Se le mintean **100 BLUE en Parking** (custodiados por el período de regla en el protocolo).
   - **A la Plataforma / Tesorería:** Se le mintean **5 BLUE en Parking** correspondientes a la comisión comercial de la plataforma.
   - **Al Pagador (David):** Se le mintean **105 RED de Deuda** (100 por el trabajo + 5 por la comisión del servicio).
   - **Balance Contable:** 100 BLUE (Bob) + 5 BLUE (Tesorería) = 105 BLUE creados, exactamente iguales a los 105 RED de deuda asumidos por David.

3. **Donaciones Institucionales Originadas con RED:**
   - Las donaciones no consumen saldos de caja previos: operan como un compromiso crediticio del donante.
   - Al donar 50 dólares a una causa u ONG verificada: se originan 50 RED de deuda al donante y 50 BLUE en parking a la entidad benéfica (más la comisión de plataforma correspondiente si la política de la versión la contempla).

4. **Quién Paga la Comisión de la Plataforma:**
   - La comisión de la plataforma la paga **única y exclusivamente quien contrata el servicio o genera la deuda RED** por el beneficio de financiarse y utilizar la infraestructura.
   - El trabajador humilde o prestador de servicios **recibe el 100% del valor pactado por su trabajo** limpio de comisiones de plataforma.

---

## 2. Período de Parking Universal y Liberación Distribuida

1. **Los Dos Estados del Token BLUE:**
   - **BLUE en Parking (Retenido en Protocolo):** Todo BLUE recién emitido entra en custodia y garantía en el contrato `WintonProtocol` durante el período de vigencia de la política de la tarea (habitualmente 30 días, configurable para nuevas políticas). Durante este tiempo, el saldo no puede venderse en el Exchange ni transferirse a billeteras externas, pero puede utilizarse internamente para pagar nuevos servicios (Ruta A) o saldar deudas RED propias.
   - **BLUE Liberado (Disponible):** Al transcurrir el plazo exacto de parking, el token se consolida como saldo disponible para el usuario, habilitado para ser retirado o vendido en el Exchange por USDT.

2. **Fecha de Liberación Individual por Pago (Distribución Natural 24h):**
   - Para evitar aglomeraciones o una "carrera de caballos" a una misma hora fija del día (como ocurriría si todos vencieran a las 00:00:00 UTC), **la fecha de liberación se computa a partir de la marca de tiempo exacta de la transacción en blockchain que originó el pago**.
   - Si una tarea se aprueba a las 14:35 UTC, su liberación ocurre a las 14:35 UTC del mes siguiente.
   - Esto distribuye las notificaciones push y las entradas al Exchange de forma natural y orgánica durante las 24 horas del día.
   - Para la Tesorería Institucional (que recibe miles de micro-comisiones), los fondos se consolidan en balances agregados para no saturar el almacenamiento de red.

3. **Liberación Pasiva (Zero Gas de Fondo):**
   - El contrato inteligente no ejecuta programas automáticos que consuman gas. La liberación es pasiva: cuando el usuario entra a su aplicación móvil a retirar o vender, el contrato evalúa al instante si la fecha actual ya superó la fecha de liberación del trabajo. Si ya se cumplió, se procesa en ese mismo segundo.

4. **Niveles de Usuario y Acceso:**
   - **Niveles 1 y 2 (Usuarios Base):** Al cumplirse el plazo de su trabajo, reciben una notificación push en su teléfono y pulsan el botón *"Vender en Exchange"*.
   - **Nivel 3+ (VIP / Reputación Alta):** Tienen disponible desde el día 1 la opción *"Auto-listar en Exchange al liberarse"*. Si la dejan activada, el relayer institucional de WintonCoin envía la orden a la cola de venta automáticamente en cuanto se cumple la fecha, sin que el usuario tenga que estar pendiente de su teléfono.

---

## 3. Rieles Oficiales y Prohibición de Mercados Secundarios P2P

1. **Aislamiento en Rieles Oficiales:**
   - El contrato `BlueToken.sol` restringe las transferencias directas libres entre billeteras privadas no identificadas.
   - Todo movimiento de valor debe canalizarse a través de los contratos autorizados del ecosistema: `WintonProtocol` (pagos y amortizaciones), `WintonFifoExchange` (compra/venta regulada por USDT) y `WintonTreasury` (reservas institucionales).
2. **Protección contra Fraude y Arbitraje:**
   - Se elimina por completo la posibilidad de que personas inescrupulosas creen mercados negros de BLUE con descuento fuera de la plataforma o laven dinero eludiendo las normas de cumplimiento y trazabilidad bancaria.

---

## 4. Mercado de Liquidez: WintonFifoExchange V3.3.6

1. **Propósito Único del Exchange:**
   - El Exchange no es una reserva monetaria corporativa ni emite tokens. Es un mercado secundario limpio entre usuarios que intercambia **BLUE Liberado por USDT** a tasa fija bruta 1:1.
2. **Estructura de Dos Colas Limpias:**
   - **Fila de Venta:** Exclusivamente prestadores con BLUE Liberado (cero parking en el Exchange).
   - **Fila de Compra:** Usuarios con USDT que desean comprar BLUE para:
     a) Pagar deuda RED preexistente (`repay`).
     b) Pre-fondear pagos en el Marketplace mediante Ruta A (compensación atómica).
3. **Cruce Inmediato (Create + Instant Match):**
   - Al publicar una orden de compra o venta, si ya existe una orden esperando en la fila contraria, la misma transacción ejecuta el cambio de inmediato (hasta 5 cruces por llamada como límite de seguridad de gas).
   - Si no hay contraparte suficiente, el saldo restante se anota en el libro de órdenes por estricto orden de llegada (FIFO).
4. **Independencia Total de Comisiones:**
   - La comisión del Exchange corresponde a un servicio financiero independiente (el cambio de liquidez).
   - Tiene su propia configuración (inicia en 0% en el lanzamiento oficial y puede ajustarse hasta un máximo del 5% bajo timelock de gobernanza).
   - Cobrar comisión de intercambio en el Exchange no contradice la regla de que el trabajador humilde no paga la comisión de la plataforma en el Marketplace.

---

## 5. Disciplina Crediticia, Respaldo en USDT y Buena Fe Financiera

1. **Regla de Oro del Respaldo en USDT (Innegociable):**
   - **Los USDT que un deudor deposite en el Exchange para respaldar el pago de un compromiso RED NO SE PUEDEN RETIRAR BAJO NINGUNA CIRCUNSTANCIA mientras el compromiso de deuda exista.**
   - Esta regla aplica sin importar si la deuda está corriente o vencida, y sin importar si el usuario tiene cupo de crédito libre.
   - Cancelar o modificar la orden en el Exchange no devuelve el dinero a la billetera: los fondos permanecen custodiados y etiquetados para comprar BLUE y liquidar esa deuda. Solo si el usuario salda su deuda por otra vía (por ejemplo, trabajando mediante Ruta A) y queda un remanente libre, ese excedente puede ser devuelto.

2. **Recuperación Inmediata de Capacidad Crediticia por Respaldo:**
   - Cuando un usuario deposita USDT en garantía en el Exchange para pagar su deuda, la plataforma le reconoce de inmediato esa solvencia y le permite seguir utilizando su crédito sin esperar a que aparezca un vendedor.
   - **Cálculo de Cobertura Neta:** La cobertura se computa sobre el monto neto de BLUE que efectivamente se obtendrá tras descontar la comisión del Exchange.
   - **Cero Duplicación de Crédito:** El sistema calcula el crédito disponible de forma transparente:
     * Deuda Total menos Cobertura en Garantía = Deuda Neta al Descubierto.
     * El usuario solo puede gastar lo que le quede disponible respecto a su **límite efectivo vigente** (el cual respeta si el usuario venía de un halving o está en recuperación gradual).
     * Transición contable en tres pasos seguros: **USDT en Garantía $\rightarrow$ BLUE Comprado Retenido $\rightarrow$ Quema Pareada de BLUE y RED**. Al quemar la deuda, la cobertura y la deuda disminuyen a la vez, garantizando que el usuario jamás reciba cupo doble por error.

3. **Estatus de "Buena Fe / Voluntad de Pago" Proporcional:**
   - Si llega la fecha de vencimiento de una deuda RED y el usuario no tiene BLUE, pero tiene USDT depositados en el Exchange en orden de compra:
     - **La porción de deuda efectivamente respaldada por los USDT NO entra en mora.**
     - **NO se le aplica halving del 50% sobre esa porción cubierta.**
     - **NO pierde el patrocinio de gas para sus transacciones.**
     - **NO es reportado en la Lista de Obligaciones Vencidas (LOV).**
   - Si la cobertura es parcial (por ejemplo, debe 100 y solo cubrió 30 con USDT), los 30 quedan amparados bajo Buena Fe y los 70 restantes sin respaldo siguen el tratamiento ordinario de mora.

4. **Consecuencias de la Mora Real (Incumplimiento Total):**
   - Si vence el plazo y el usuario ni pagó con BLUE ni depositó USDT de respaldo para esa porción de deuda:
     1. **Halving Inmediato:** Su límite de crédito futuro se reduce automáticamente al 50% en el instante del vencimiento.
     2. **Halvings Mensuales:** Cada 30 días adicionales de mora continua aplican un halving sucesivo (hasta un piso mínimo configurado).
     3. **Pérdida de Subsidios:** Pierde el derecho a transacciones gratuitas patrocinadas por el relayer.
     4. **Reporte LOV:** Tras 60 días de impago, su registro se traslada a la Lista de Obligaciones Vencidas off-chain (sin datos personales públicos en blockchain).
     5. **Vía de Recuperación:** El usuario moroso nunca es expulsado: puede seguir trabajando para ganar BLUE. Al saldar el 100% de su deuda vencida, entra en estado de CURA y recupera gradualmente un 10% de su límite recortado por cada mes de conducta intachable (restauración total en 10 meses).

---

## 6. Manejo de Identidad KYC y Resiliencia del Sistema

1. **Aprobación de Identidad Obligatoria:**
   - Toda interacción económica requiere verificación de identidad (KYC) off-chain asociada a la dirección de la billetera.
2. **Poda Perezosa ante Cuentas Suspendidas:**
   - Si una cuenta que tiene una orden en el Exchange es suspendida por motivos legales o de cumplimiento, el contrato no frena el mercado: aparta temporalmente esa orden a un estado de custodia segura y continúa atendiendo de inmediato a los demás usuarios de la fila, garantizando la continuidad operativa 24/7.
3. **Aislamiento de Fallos Técnicos:**
   - El cruce de monedas en el Exchange y la quema de deuda en el protocolo operan con protección de dos pasos: si la quema de deuda sufriera algún fallo técnico externo, la compra de USDT del vendedor queda consolidada de forma irreversible y los BLUE comprados quedan resguardados en depósito para liquidar la deuda en el siguiente bloque.

---

## 7. Tabla Resumen de Roles y Flujos Económicos

| Acción del Usuario | Contrato Responsable | Tokens Involucrados | Regla Clave |
| :--- | :--- | :--- | :--- |
| **Pagar Tarea en Marketplace** | `WintonProtocol` | +BLUE (Trabajador), +BLUE (Tesorería), +RED (Pagador) | Emisión pareada idéntica. El trabajador recibe el 100% de su pago. |
| **Pagar con Saldo Previo (Ruta A)** | `WintonProtocol` | -BLUE (Pagador), +BLUE (Trabajador), +BLUE (Tesorería) | Compensación atómica: el pagador quema su BLUE contra su nuevo RED. Deuda neta = 0. |
| **Vender BLUE Liberado** | `WintonFifoExchange` | BLUE Liberado $\rightarrow$ USDT | Solo BLUE con 30 días cumplidos. Cruce 1:1 bruto. |
| **Comprar BLUE para Deuda** | `WintonFifoExchange` + `WintonProtocol` | USDT $\rightarrow$ BLUE $\rightarrow$ Quema contra RED | USDT en garantía innegociable. No genera mora si está en espera. |
| **Mora sin Fondos** | `WintonProtocol` | RED Vencido | Halving del 50% a los 30 días. Recuperación gradual del 10%/mes tras pagar. |
