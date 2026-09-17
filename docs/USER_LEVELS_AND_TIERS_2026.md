# Marco de Gobernanza de Niveles de Usuario y Beneficios — WintonCoin 2026
**Documento Oficial de Producto y Gamificación Financiera**  
**Versión:** 1.0 (Septiembre 2026)  
**Estado:** Canónico y Vinculante  
**Ámbito:** Backend (Engine de Scoring y Políticas), Frontend (React Vite SPA) y Smart Contracts

---

## 1. Visión General y Propósito

El ecosistema WintonCoin implementa una estructura de **7 Niveles de Usuario** diseñada bajo principios de **gamificación financiera**, ingeniería de incentivos y estándares de cumplimiento bancario (SOC 2, KYC/AML y Zero-Trust).

### Objetivos Principales:
1. **Alineación de Incentivos**: Recompensar la fidelidad, el volumen de trabajo honesto y el cumplimiento crediticio intachable.
2. **Mitigación Progresiva del Riesgo**: Nuevos usuarios operan con límites prudentes mientras consolidan su reputación; usuarios con historial comprobado desbloquean liquidez y capacidades avanzadas.
3. **Privacidad y Eficiencia en Gas (Cero PII On-Chain)**: Los niveles y los datos personales residen estrictamente en servidores seguros y bases de datos off-chain. La blockchain únicamente recibe parámetros cuantitativos y firmas EIP-712 sin exponer datos sensibles.

---

## 2. Matriz Maestra de los 7 Niveles de Usuario

| Nivel | Denominación | Cupo Base RED | Mecánica Ruta A | Patrocinio de Gas (Relayer) | Exchange FIFO | Auto-Listing |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **1** | **Explorador (Novato)** | $20 - $50 RED | **FIFO** (Consume más antiguo) | 1 tx / día | Manual (Día 31) | Desactivado |
| **2** | **Colaborador (Verificado)** | $100 RED | **FIFO** (Consume más antiguo) | 3 tx / día | Manual (Día 31) | Desactivado |
| **3** | **Profesional (Consolidado)** | $250 RED | **FIFO** (Consume más antiguo) | 5 tx / día | Manual (Día 31) | Desactivado |
| **4** | **Especialista (Avanzado)** | $500 RED | **LIFO** (Consume más nuevo) | 8 tx / día | Manual o Auto | **Habilitado** |
| **5** | **Líder Comercial (Experto)** | $1,000 RED | **LIFO** (Consume más nuevo) | 15 tx / día | Manual o Auto | **Habilitado** |
| **6** | **Embajador (Corporativo)** | $2,500 RED | **LIFO** configurable | 30 tx / día | Manual o Auto | **Habilitado** |
| **7** | **VIP / Institucional** | $5,000+ RED / Pignorado | **LIFO** optimizado | Ilimitado (Protocolo) | Prioritario en Bloque | **Habilitado** |

---

## 3. Desglose Detallado por Nivel

---

### Nivel 1: Explorador (Usuario Nuevo)
* **Perfil**: Usuario recién registrado que inicia su actividad en WintonCoin.
* **Requisitos de Acceso**:
  - Registro completado con verificación de correo electrónico y número móvil.
  - KYC Básico (Nivel 1: datos de identidad generales).
* **Límite de Compromiso RED**: $20 a $50 RED (calibrado dinámicamente según validación inicial).
* **Mecánica de Amortización (Ruta A)**:
  - **FIFO Estricto**: Al compensar deuda RED con BLUE en parking, el protocolo quema automáticamente el BLUE más antiguo recibido.
* **Patrocinio de Gas**:
  - 1 transacción patrocinada gratuita cada 24 horas (vía Relayer).
* **Operativa en Exchange FIFO**:
  - Creación manual de órdenes tras notificación en el Día 31.
  - Máximo 1 orden de venta activa simultánea en el Exchange.
  - Monto mínimo por orden: 5 BLUE (para evitar saturación de polvo/spam).

---

### Nivel 2: Colaborador (Usuario Verificado)
* **Perfil**: Usuario que ha completado sus primeras tareas con éxito y cuenta con verificación biométrica.
* **Requisitos de Acceso**:
  - KYC Biométrico aprobado (Tier 2: documento de identidad oficial y prueba de vida).
  - Al menos 5 tareas o contratos completados satisfactoriamente y pagados.
  - 0 disputas perdidas.
* **Límite de Compromiso RED**: $100 RED.
* **Mecánica de Amortización (Ruta A)**:
  - **FIFO Estricto**.
* **Patrocinio de Gas**:
  - Hasta 3 transacciones patrocinadas gratuitas por día.
* **Operativa en Exchange FIFO**:
  - Hasta 2 órdenes de venta activas simultáneas en el Exchange.
  - Notificaciones push de recordatorio 24 horas antes de la liberación de saldos.

---

### Nivel 3: Profesional (Usuario Consolidado)
* **Perfil**: Miembro activo y recurrente con comportamiento de pago intachable.
* **Requisitos de Acceso**:
  - Más de 20 tareas completadas y liquidadas en los últimos 60 días.
  - Cero moras crediticias en todo el historial.
  - Winton Trust Score superior a 150 puntos.
* **Límite de Compromiso RED**: $250 RED.
* **Mecánica de Amortización (Ruta A)**:
  - **FIFO Estricto**.
* **Patrocinio de Gas**:
  - Hasta 5 transacciones patrocinadas gratuitas por día.
* **Operativa en Exchange FIFO**:
  - Hasta 3 órdenes de venta simultáneas.
  - Ventana de gracia extendida: 48 horas adicionales para responder aclaraciones de tareas antes de mediación.

---

### Nivel 4: Especialista (Usuario Avanzado) — *El Salto de Nivel*
* **Perfil**: Usuario de alto rendimiento y confiabilidad comprobada.
* **Requisitos de Acceso**:
  - Más de 50 tareas completadas con éxito.
  - Antigüedad en la plataforma superior a 90 días.
  - Historial de crédito con 100% de cumplimiento en fechas de vencimiento.
* **Superpoder Financiero Desbloqueado: Quema LIFO en Ruta A**:
  - **Mecánica**: Al usar Ruta A para amortizar deuda RED, el sistema quema prioritariamente el **BLUE más reciente (el que tiene más tiempo de parking por delante)**.
  - **Impacto Económico**: El usuario **blinda y preserva su BLUE maduro (próximo a liberarse)**, permitiéndole cambiarlo por USDT en pocos días en el Exchange, mientras liquida su deuda con los tokens recién ganados.
* **Límite de Compromiso RED**: $500 RED.
* **Patrocinio de Gas**:
  - Hasta 8 transacciones patrocinadas gratuitas por día.
* **Habilitación de Auto-Listing en Exchange**:
  - El usuario puede pre-autorizar mediante EIP-712 la venta automática de su BLUE liberado. En el segundo exacto en que se cumplen los 30 días de parking, el relayer posiciona su orden en la cola FIFO sin requerir acción manual.
  - Hasta 5 órdenes de venta activas simultáneas.

---

### Nivel 5: Líder Comercial (Usuario Experto)
* **Perfil**: Emprendedores, contratistas frecuentes y comercios medianos.
* **Requisitos de Acceso**:
  - Más de 100 tareas o ventas completadas.
  - Volumen histórico acumulado superior a 2,000 BLUE / USDT.
  - Verificación de actividad comercial o profesional.
* **Límite de Compromiso RED**: $1,000 RED.
* **Mecánica de Amortización (Ruta A)**:
  - **LIFO Avanzado**: Quema preferencial del saldo más reciente, con opción en la interfaz de seleccionar lotes específicos si el usuario lo desea.
* **Patrocinio de Gas**:
  - Hasta 15 transacciones patrocinadas gratuitas por día.
* **Operativa en Exchange FIFO**:
  - Auto-listing prioritario en colas de relayer.
  - Descuento del 10% en comisiones de intercambio (Exchange Trading Fee), si aplica política con tarifa reducida.
  - Hasta 8 órdenes simultáneas.

---

### Nivel 6: Embajador (Corporativo / Red Comercial)
* **Perfil**: Empresas, agencias y usuarios con redes comerciales activas en la plataforma.
* **Requisitos de Acceso**:
  - Más de 250 operaciones exitosas.
  - KYC Corporativo / Institucional aprobado.
  - Más de 15 referidos activos con KYC verificado.
* **Límite de Compromiso RED**: $2,500 RED.
* **Mecánica de Amortización (Ruta A)**:
  - **LIFO Inteligente Multi-Lote**: Optimización algorítmica de saldos para maximizar la liquidez en dólares de la empresa.
* **Patrocinio de Gas**:
  - Hasta 30 transacciones patrocinadas gratuitas por día.
* **Operativa en Exchange FIFO**:
  - Capacidad de colocar órdenes de volumen comercial de hasta 1,000 BLUE por posición.
  - Relayer dedicado de alta prioridad para ejecución en el primer bloque disponible.

---

### Nivel 7: Consejo Winton / VIP Institucional
* **Perfil**: Grandes corporaciones, ONGs internacionales, creadores de mercado institucionales y socios fundadores.
* **Requisitos de Acceso**:
  - Aprobación formal por el Comité de Riesgo de WintonCoin.
  - Pignoración de colateral auditable en `WintonCollateralVault` o acuerdos institucionales regulados.
* **Límite de Compromiso RED**: Personalizado ($5,000+ RED respaldado por garantías o scoring corporativo).
* **Mecánica de Amortización (Ruta A)**:
  - **LIFO Institucional Total**: Máxima flexibilidad y preservación de liquidez circulante.
* **Patrocinio de Gas**:
  - **Ilimitado** para todas las transacciones legítimas del protocolo.
* **Operativa en Exchange FIFO**:
  - Soporte para cruces de bloques institucionales y liquidez dedicada.
  - Cero límites en cantidad de órdenes simultáneas.

---

## 4. Gobernanza y Reglas de Transición entre Niveles

### 4.1 Ascenso de Nivel
- El motor de scoring off-chain ([creditScoringService.js](file:///c:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/backend/src/services/creditScoringService.js)) evalúa continuamente la actividad de cada usuario.
- Al cumplirse los requisitos cuantitativos y de tiempo, el ascenso es automático y emite una notificación al usuario con la bienvenida a su nuevo estatus.

### 4.2 Protección contra Degradación Injusta (Buena Fe)
- Un usuario con deuda RED que mantenga una orden de compra en USDT en el Exchange (o colateral en `WintonCollateralVault`) **NO sufre degradación de nivel**, ya que se encuentra en "Estatus de Buena Fe".
- Si un usuario incurre en mora real no cubierta por más de 30 días, sufre una suspensión temporal de beneficios de nivel (pasa a operar temporalmente con reglas de Nivel 1) hasta que liquide el principal pendiente.

---

## 5. Implementación en Frontend (React) y Backend

1. **Dashboard de Billetera (`frontend/src/`)**:
   - Muestra una insignia con el Nivel actual del usuario (1 al 7), barra de progreso hacia el siguiente nivel y desglose de beneficios activos.
2. **Selector de Ruta A**:
   - En Niveles 1 a 3: Muestra etiqueta informativa: *"Amortización Estándar (FIFO)"*.
   - En Niveles 4 a 7: Muestra selector destacado: *"Amortización Inteligente LIFO (Protege tus fondos maduros)"*.
3. **Switch de Auto-Listing**:
   - Desbloqueado automáticamente a partir del Nivel 4 en la configuración del Exchange.
