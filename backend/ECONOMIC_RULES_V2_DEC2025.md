# Reglas Económicas Inmutables de WintonCoin

Este documento describe las reglas fundamentales e inquebrantables que rigen la economía del ecosistema WintonCoin. Estas reglas aseguran la estabilidad, equidad y previsibilidad del sistema. Todo el código, tanto del backend como del frontend, debe adherirse estrictamente a estos principios.

Debido a la naturaleza evolutiva del proyecto, las reglas se dividen en dos fases operativas distintas.

---

## PARTE I: FASE DE PRE-LANZAMIENTO (ACTUAL)

Durante la fase inicial de pre-lanzamiento, se aplican las siguientes modificaciones temporales a las reglas económicas para fomentar la participación temprana y construir una comunidad de impulsores sólida sin afectar la economía principal de tokens. El administrador de la plataforma controla la activación de esta fase.

### 1. Suspensión de Creación de Tokens (`BLUE`/`RED`)
La creación de tokens `BLUE` y `RED` por la finalización de tareas **está completamente suspendida**. Los saldos de la billetera principal (`liquid_blue_balance`, `escrow_blue_balance`, `red_balance`) de los usuarios no se verán afectados por la actividad de publicación. El balance económico del sistema se mantiene en CERO.

### 2. Acumulación Exclusiva en Perfil de Impulsor
Todas las recompensas obtenidas por completar tareas (de cualquier tipo: solicitud, venta o donación) durante esta fase se acreditan **exclusivamente** a la cuenta de perfil de impulsor (`booster_blue_ledger`) del usuario beneficiario. Esto se registra técnicamente como un **BLUE IOU** (Pagaré Digital), es decir, una deuda futura no líquida que la plataforma tiene con el usuario.

**Fuentes de Acumulación en esta fase:**
1.  **Recompensas por Referidos y Bonos**: Bonos de bienvenida y recompensas por referidos se acreditan aquí. Estas acumulaciones se registran como **BLUE IOU** y no son tokens `BLUE` reales.
2.  **Tareas de Impulsor**: La plataforma puede publicar tareas especiales marcadas "de impulsor". Al completarlas, la recompensa se paga en **BLUE IOU** a esta billetera.

### 3. No se generan Deudas `RED`
Dado que no se crea `BLUE` circulante, el usuario que publica una tarea **no incurre en ninguna deuda `RED`**.

### 4. Sin Comisiones de Plataforma
Al no haber un flujo real de tokens `BLUE` como pago, la plataforma **no cobra comisiones** por las transacciones completadas durante esta fase.

### 5. Control de Tipos de Publicación
El administrador puede habilitar o deshabilitar de forma independiente la capacidad de crear tipos específicos de publicaciones (`solicitud`, `venta`, `donación`) para guiar la actividad de la plataforma durante esta fase.

### 6. Donaciones y Transferencias de BLUE IOU
En esta fase, los usuarios solo pueden donar o transferir **BLUE IOU** hasta la cantidad acumulada en su perfil de impulsor. La cantidad transferida se resta del ledger de BLUE IOU del donante y se suma al del receptor, manteniendo el balance total del sistema en cero.

### 7. Requisito de Perfil Aprobado
Para realizar cualquier publicación o transferencia, el usuario debe tener su perfil **aprobado**. Esta medida es obligatoria para garantizar que cada cuenta pertenezca a una **persona real** y evitar estafas mediante la creación de múltiples cuentas falsas.

---

## PARTE II: FASE DE LANZAMIENTO OFICIAL (FUTURO)

### 1. Creación de Tokens: El Acto del Pago

-   **Principio Fundamental**: Los tokens `BLUE` (activo) y `RED` (deuda) **solo se crean en el momento en que un usuario realiza un pago o una donación a otro usuario**. No existen pre-minados ni se asignan de forma gratuita.
-   **Balance Cero**: Todo el sistema, incluyendo las billeteras de los usuarios y la plataforma, se inicia con un balance de `0 BLUE` y `0 RED`.
-   **Creación Equilibrada y Distribución**: Por cada `X` cantidad de `BLUE` creada (suma del pago más la comisión), se crea simultáneamente una cantidad idéntica `X` de `RED`.
    -   **Distribución de RED**: El total `X` se asigna como deuda al **pagador**.
    -   **Distribución de BLUE**: El total `X` se divide: la parte correspondiente al pago va al **beneficiario** y la parte de la comisión va a la **plataforma**.

### 2. Quema de Tokens: La Destrucción del Valor

La quema de tokens es la eliminación simultánea de `BLUE` y `RED` del sistema. Ocurre de dos maneras:

-   **A) Quema Voluntaria**: Un usuario puede decidir voluntariamente quemar una cantidad de sus `BLUE` para reducir una cantidad equivalente de su deuda `RED`.

-   **B) Quema Automática por Vencimiento (Cobro de Deuda)**: Este es un proceso automático e inevitable.
    -   **Activación**: Se activa cuando una deuda `RED` de un usuario alcanza su fecha de vencimiento.
    -   **Sistema FIFO de Deudas**: Las deudas se procesan en orden de antigüedad (primero en entrar, primero en salir).
    -   **Prioridad de Fondos para la Quema**: Para saldar la deuda vencida, el sistema quema automáticamente los `BLUE` del deudor en el siguiente orden:
        1.  Primero, se utiliza el saldo `BLUE` disponible (líquido).
        2.  Si no es suficiente, se utiliza el saldo `BLUE` pendiente (en `escrow`), **consumiendo los depósitos más antiguos primero (FIFO)**.
    -   **Consecuencia**: La cantidad de `BLUE` quemada se deduce del saldo del usuario, y una cantidad idéntica de `RED` se elimina de su deuda.

### 3. El Perfil de Impulsor (Booster)

-   **Doble Propósito**: El perfil de impulsor es tanto un sistema de reputación como una billetera de ganancias separada.
-   **Sistema Aislado**: La billetera del impulsor está **completamente separada** de la billetera principal. Los fondos no son transferibles directamente por el usuario.
-   **Pago Futuro (Post-Lanzamiento)**: Los fondos acumulados como **BLUE IOU** en el perfil de impulsor **son pagaderos al usuario mensualmente tras el lanzamiento oficial de la plataforma**. El mecanismo de pago se basa en las comisiones que la plataforma recauda cada mes. Por ejemplo: si al final del mes se recaudan 2,000 `BLUE` en comisiones y la deuda total (**BLUE IOU**) con los impulsores es de 20,000, se calcula un porcentaje de pago (2,000 / 20,000 * 100 = 10%). Este porcentaje se aplica a la deuda de cada impulsor, pagando con prioridad a los niveles más bajos primero como un beneficio para incentivar la participación temprana. Este proceso se repite mensualmente hasta saldar toda la deuda acumulada, asegurando que ningún `BLUE` se pague sin respaldo de comisiones reales.

### 4. Sistema de Comisiones de la Plataforma

-   **Fuente de Ingresos**: La plataforma obtiene sus ingresos a través de una comisión porcentual sobre los pagos de `BLUE`. Esta comisión se **adiciona** al monto de la transacción (pago) y se mintea como nuevos tokens.
-   **Mecánica de Cobro (Ejemplo)**: Si Juan paga 100 a Luis y la comisión es 5%:
    1.  Se mintean **105 BLUE** y **105 RED** (regla inviolable).
    2.  Luis recibe **100 BLUE**.
    3.  La Plataforma recibe **5 BLUE**.
    4.  Juan asume una deuda de **105 RED**.
-   **Registro Transparente**: Cada comisión generada se registra en un log (`platform_commission_log`) para una total transparencia y auditoría.

### 5. Sistema de Referidos y Bonos

-   **Bono de Bienvenida**: Los nuevos usuarios que se registran **sin** un código de referido reciben un bono de bienvenida. Este bono se acredita directamente en su perfil de impulsor como **BLUE IOU**, no en su billetera principal.
-   **Recompensa por Referido**: Cuando un usuario se registra con el código de otro, tanto el referente como el referido reciben una recompensa. Estas recompensas también se acreditan exclusivamente en sus respectivos perfiles de impulsor como **BLUE IOU**. 

### 6. Control de Endeudamiento y Plazos (Reglas de Bloqueo)

-   **Límite de Deuda Dinámico**: El límite de endeudamiento en tokens `RED` no es fijo. Se inicia con un valor base y **aumenta progresivamente** conforme el usuario demuestra actividad positiva y mantiene una buena reputación. A mayor confianza generada, mayor capacidad de crédito otorga el sistema.
-   **Plazos de Pago Estrictos**: Todas las deudas contraídas tienen un límite de tiempo definido para ser saldadas.
-   **Bloqueo de Solicitudes**: Si un usuario incumple un plazo de pago (deuda vencida), el sistema **bloqueará automáticamente** la creación de nuevas solicitudes. El usuario no podrá generar nueva deuda hasta que regularice su situación.

