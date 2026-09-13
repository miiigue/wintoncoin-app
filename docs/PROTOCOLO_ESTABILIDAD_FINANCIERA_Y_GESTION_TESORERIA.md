# PROTOCOLO DE ESTABILIDAD FINANCIERA Y GESTIÓN DE TESORERÍA (WINTONCOIN)
**Versión**: V3.3.6 — Candidato a Congelamiento Técnico  
**Estado**: VIGENTE / FORMALMENTE ADOPTADO  
**Fecha**: Septiembre 2026  

---

## 1. DEROGACIÓN Y ARCHIVO HISTÓRICO DEL MODELO DAP (DEBT ANCHOR PROTOCOL)

Queda formal y definitivamente **DEROGADO Y ARCHIVADO** el antiguo modelo denominado:

> **DAP — Debt Anchor Protocol**

como mecanismo de estabilización, valoración o intercambio dentro del ecosistema WintonCoin.

### 1.1 Elementos Derogados y Archivados
No forman parte de la arquitectura activa y se declaran obsoletos los siguientes conceptos:
1. **Rango de Arbitraje $0.95 – $1.05**: Queda eliminado todo esquema de fluctuación de banda, suelo artificial (*floor*) a $0.95 o techo artificial (*ceiling*) a $1.05.
2. **Intervención Corporativa de Precios**: Se deroga cualquier compromiso o mecanismo donde la Tesorería actúe como compradora o vendedora de último recurso para defender un precio variable.
3. **Recompra o Venta Corporativa Subsidiada**: Ninguna tesorería recomprará a $0.95 ni venderá a $1.05 en el mercado secundario.
4. **Best Execution basado en DAP**: Queda sin efecto todo algoritmo de enrutamiento que dependa de spreads DAP.

---

## 2. MECANISMO DE INTERCAMBIO VIGENTE: WINTONFIFOEXCHANGE

El único mecanismo oficial y vigente para la liquidación e intercambio entre el token utilitario del ecosistema (`BLUE`, 6 decimales) y la moneda estable de referencia (`USDT`, 6 decimales) es el contrato:

> **`WintonFifoExchange`**

### 2.1 Principios Fundamentales del Motor de Intercambio
* **Tasa Bruta Fija 1:1**: El motor ejecuta cruces estrictamente a paridad contable bruta:
  $$\text{Gross Amount BLUE} = \text{Gross Amount USDT}$$
* **Prelación FIFO Monotónica Global**: La prioridad de liquidación está determinada irreversiblemente por el orden de inclusión on-chain a través del identificador secuencial `sequenceId`. La metadata de creación (`createdAt`) no altera la prioridad.
* **Liquidación Parcial (Partial Fills)**: Una orden con saldo mayor que su contraparte se liquida parcialmente; el saldo no ejecutado permanece en la cabeza de la cola como `PARTIALLY_FILLED`, conservando su prioridad FIFO original.
* **Cancelación Autónoma Garantizada**: El creador de una orden no liquidada puede cancelarla en cualquier momento —incluso bajo estado de pausa de emergencia— recuperando el 100% de su saldo remanente no cruzado.
* **Poda Perezosa (Lazy Pruning)**: Las órdenes terminales (`FILLED` o `CANCELLED`) son podadas durante el avance del motor sin bloquear las colas, respetando el presupuesto estricto de inspección `maxOrdersScanned`.
* **Matching Permissionless**: Cualquier participante de la red puede activar la ejecución de cruces invocando `matchOrders(maxMatches, maxOrdersScanned)`.
* **Transparencia en Comisiones (Gross vs Net vs Fee)**:
  - `Gross Amount`: Volumen bruto emparejado 1:1.
  - `Fee`: Deducción porcentual institucional ($0 \le \text{feeBps} \le 500$, equivalente a máximo 5.00%).
  - `Net Amount`: Monto neto recibido por el usuario:
    $$\text{net} = \text{gross} - \text{fee}$$
  - **Lanzamiento Oficial**: Se adopta formalmente una comisión inicial de **0 BPS (0.00%)**, garantizando $\text{net} = \text{gross}$ en el arranque.

---

## 3. POLÍTICA DE RESERVAS Y GESTIÓN DE TESORERÍA

Se establece una separación estricta entre el **mecanismo de intercambio** (contrato autónomo `WintonFifoExchange`) y la **política de tesorería y reservas**.

### 3.1 Prioridad Absoluta de Custodia de Fondos de Usuarios
La solvencia del Exchange se rige por la ecuación de custodia segregada:
$$\text{balanceOf}(token) \ge \text{totalReserved}(token) + \text{accumulatedFees}(token)$$
* **Inviolabilidad de Reservas**: Los fondos depositados por los usuarios para respaldar órdenes activas (`totalReserved`) tienen prioridad jurídica y matemática absoluta.
* **Reclamo Conservador de Comisiones (`claimFees`)**: La tesorería solo puede retirar comisiones devengadas si **ambos activos** (BLUE y USDT) satisfacen plenamente sus obligaciones de reserva y custodia. Ante cualquier anomalía de solvencia en cualquiera de los dos activos, el retiro de comisiones se bloquea preventivamente en su totalidad.

### 3.2 Gobernanza y Controles Administrativos
* **Gobernanza en Dos Pasos (`Ownable2Step`)**: La administración del contrato solo puede transferirse mediante oferta y aceptación expresa del nuevo propietario, eliminando el riesgo de pérdida por error tipográfico.
* **Deshabilitación de Renuncia (`renounceOwnership`)**: La función de renuncia de propiedad está permanentemente deshabilitada para evitar que el contrato quede huérfano de gestión en situaciones de emergencia.
* **Timelock Forzoso de 48 Horas**: Toda modificación de parámetros críticos (tasa de comisión `feeBps` o dirección de `treasury`) requiere una propuesta previa con 48 horas exactas de espera pública y una ventana de caducidad estricta de 7 días (`TIMELOCK_GRACE_PERIOD`).
* **Protección Anti-Rescate de Fondos del Par**: El propietario tiene expresamente prohibido utilizar `rescueForeignToken` sobre los tokens `BLUE` o `USDT`. Las reservas del par son intocables por diseño.

### 3.3 Proof of Reserve y Transparencia On-Chain
* **Superávit Libre (`freeSurplus`)**: Cualquier token transferido directamente al Exchange sin orden asociada no se computa como pasivo de órdenes; pasa a incrementar el superávit libre consultable on-chain mediante `freeSurplus()`.
* **Cero Secretos Hardcodeados**: Todas las operaciones respetan el estándar Zero-Trust Engineering sin dependencias de claves privadas estáticas en código fuente ni canales de comunicación inseguros.

---

## 4. CONTROL DE VERSIONES Y TRAZABILIDAD

| Versión | Fecha | Estado | Descripción de Cambios |
| :--- | :--- | :--- | :--- |
| **V1.0 – V2.0** | 2024–2025 | ARCHIVADO | Antiguo modelo conceptual DAP (Debt Anchor Protocol), bandas $0.95–$1.05. |
| **V3.3.6** | Septiembre 2026 | VIGENTE | Derogación oficial de DAP; adopción definitiva de `WintonFifoExchange` a tasa bruta 1:1 FIFO, fee inicial 0 BPS y custodia institucional de reservas. |
