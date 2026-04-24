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

### 2. Quema de Tokens: La Ley de Anulación (Auto-Amortización)

La quema de tokens es la eliminación simultánea y equitativa de `BLUE` y `RED` del ecosistema. En la Fase de Lanzamiento, esta quema opera bajo un principio matemático estricto de anulación instantánea:

-   **Anulación Materia-Antimateria**: Es algorítmicamente imposible que un usuario posea saldo de `BLUE` líquido y deuda `RED` al mismo tiempo en su billetera. Ambos saldos se destruyen al entrar en contacto.
-   **Auto-Amortización de Ingresos**: Si un usuario con deuda `RED` activa recibe un pago en `BLUE`, el Smart Contract intercepta esos fondos y los quema instantáneamente, reduciendo su deuda exacta.
-   **Renovación de Cupo**: Al ocurrir la auto-amortización, el límite de crédito del usuario se restablece proporcionalmente en tiempo real (Crédito Rotativo), recuperando su poder adquisitivo en la plataforma.
-   **Inviolabilidad del Escrow**: Los fondos `BLUE` retenidos en garantía (Escrow) de una tarea en progreso jamás serán confiscados ni quemados para saldar deudas, garantizando la inviolabilidad del pago a terceros.

### 3. El Perfil de Impulsor (Booster)

-   **Doble Propósito**: El perfil de impulsor es tanto un sistema de reputación como una billetera de ganancias separada.
-   **Sistema Aislado**: La billetera del impulsor está **completamente separada** de la billetera principal. Los fondos no son transferibles directamente por el usuario.
-   **Pago Futuro (Post-Lanzamiento)**: Los fondos acumulados como **BLUE IOU** en el perfil de impulsor **son pagaderos al usuario mensualmente tras el lanzamiento oficial de la plataforma**. El mecanismo de pago se basa en las comisiones que la plataforma recauda cada mes. Este proceso se repite mensualmente hasta saldar toda la deuda acumulada, asegurando que ningún `BLUE` se pague sin respaldo de comisiones reales. el mecanismo de pago se hara segun el mecanismo descrito en BOOSTER_COMPENSATION_PROTOCOL.md 

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

### 6. Control de Endeudamiento, Plazos y Penalidades (El Muro LOVE)

-   **Límite de Deuda Dinámico y Rotativo**: El límite de endeudamiento no es fijo; aumenta conforme el usuario demuestra buena reputación. Opera como un crédito rotativo que se libera instantáneamente cada vez que el sistema le auto-amortiza pagos entrantes.
-   **Vencimiento de Deuda y Muro LOVE**: Dado que la regla de anulación impide que un moroso tenga saldo líquido confiscable, la sanción por vencimiento de deuda no es una quema de fondos, sino una penalidad punitiva sistémica:
    1.  **Exposición Pública**: El perfil del usuario se expone automáticamente en la página **LOVE** (Lista de Obligaciones Vencidas).
    2.  **Suspensión de Crédito**: Su límite de crédito `RED` se reduce a cero, inhabilitándolo totalmente para crear nuevas solicitudes (contratar).
-   **Vía de Recuperación Activa**: El usuario en el Muro LOVE **NO** es bloqueado de la plataforma. Mantiene intacta su capacidad de *recibir* transferencias y *postularse* a tareas de terceros. Esta es su única vía de escape: deberá trabajar para ganar `BLUE`, provocando que el sistema ejecute la Auto-Amortización hasta limpiar su deuda, momento en el cual su nombre se borra del Muro LOVE y recupera sus privilegios.

### 7. Protocolo de Seguridad Web3 (Identidad y Cero Fricción)

Los Smart Contracts On-Chain operarán bajo dos candados inquebrantables de seguridad institucional:

-   **Muro KYC On-Chain**: Toda billetera que desee ejecutar acciones financieras en el contrato (endeudarse, mintear, transferir) debe estar en la Lista Blanca de identidades verificadas (KYC) del backend. Cuentas no verificadas son consideradas de "Solo Recepción".
-   **Transacciones Cero Fricción (Cero Gas)**: La plataforma funcionará bajo abstracción de cuentas (Meta-Transacciones / Pectra EIP-7702). El usuario firmará intenciones desde su teléfono y WintonCoin actuará como *Relayer*, pagando las comisiones de red subyacentes. El usuario jamás necesitará recargar activos externos (ej. ETH) para usar el ecosistema.
