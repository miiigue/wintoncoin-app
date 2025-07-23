# Reglas Económicas Inmutables de WintonCoin

Este documento describe las reglas fundamentales e inquebrantables que rigen la economía del ecosistema WintonCoin. Estas reglas aseguran la estabilidad, equidad y previsibilidad del sistema. Todo el código, tanto del backend como del frontend, debe adherirse estrictamente a estos principios.

### 1. Creación de Tokens: El Acto del Pago

-   **Principio Fundamental**: Los tokens `BLUE` (activo) y `RED` (deuda) **solo se crean en el momento en que un usuario realiza un pago o una donación a otro usuario**. No existen pre-minados ni se asignan de forma gratuita.
-   **Balance Cero**: Todo el sistema, incluyendo las billeteras de los usuarios y la plataforma, se inicia con un balance de `0 BLUE` y `0 RED`.
-   **Creación Equilibrada**: Por cada `X` cantidad de `BLUE` creada, se crea simultáneamente una cantidad idéntica `X` de `RED`. El `BLUE` se entrega al receptor del pago (el vendedor, el trabajador, el beneficiario de la donación) y el `RED` se asigna como deuda al emisor del pago.

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
-   **Acumulación de Fondos**: Los fondos se acumulan en la billetera del impulsor de dos maneras:
    1.  **Recompensas por Referidos y Bonos**: Bonos de bienvenida y recompensas por referidos se acreditan aquí.
    2.  **Tareas de Impulsor**: La plataforma puede publicar tareas especiales marcadas "de impulsor". Al completarlas, la recompensa `BLUE` se paga a esta billetera, no a la principal.
-   **Sistema Aislado**: La billetera del impulsor está **completamente separada** de la billetera principal. Los fondos no son transferibles directamente por el usuario.
-   **Pago Futuro**: Los fondos acumulados en el perfil de impulsor **son pagaderos al usuario en el futuro**, de acuerdo a un conjunto de reglas de pago que establecerá la plataforma.

### 4. Sistema de Comisiones de la Plataforma

-   **Fuente de Ingresos**: La plataforma obtiene sus ingresos a través de una comisión porcentual sobre los pagos de `BLUE` que se realizan entre usuarios, incluyendo tareas, ventas y donaciones.
-   **Registro Transparente**: Cada comisión generada se registra en un log (`platform_commission_log`) para una total transparencia y auditoría.

### 5. Sistema de Referidos y Bonos

-   **Bono de Bienvenida**: Los nuevos usuarios que se registran **sin** un código de referido reciben un bono de bienvenida. Este bono se acredita directamente en su perfil de impulsor, no en su billetera principal.
-   **Recompensa por Referido**: Cuando un usuario se registra con el código de otro, tanto el referente como el referido reciben una recompensa. Estas recompensas también se acreditan exclusivamente en sus respectivos perfiles de impulsor. 

---

### Anexo A: Fase de Pre-Lanzamiento (Temporal)

Durante la fase inicial de pre-lanzamiento, se aplican las siguientes modificaciones temporales a las reglas económicas para fomentar la participación temprana y construir una comunidad de impulsores sólida sin afectar la economía principal de tokens. El administrador de la plataforma controla la activación de esta fase.

-   **Suspensión de Creación de Tokens (`BLUE`/`RED`)**: La creación de tokens `BLUE` y `RED` por la finalización de tareas **está completamente suspendida**. Los saldos de la billetera principal (`liquid_blue_balance`, `escrow_blue_balance`, `red_balance`) de los usuarios no se verán afectados por la actividad de publicación. El balance económico del sistema se mantiene en CERO.

-   **Acumulación Exclusiva en Perfil de Impulsor**: Todas las recompensas obtenidas por completar tareas (de cualquier tipo: solicitud, venta o donación) durante esta fase se acreditan **exclusivamente** al `booster_blue_ledger` del usuario beneficiario. Esto se registra como una deuda futura que la plataforma tiene con el usuario, pagadera según las reglas del sistema de impulsores.

-   **No se generan Deudas `RED`**: Dado que no se crea `BLUE` circulante, el usuario que publica una tarea **no incurre en ninguna deuda `RED`**.

-   **Sin Comisiones de Plataforma**: Al no haber un flujo real de tokens `BLUE` como pago, la plataforma **no cobra comisiones** por las transacciones completadas durante esta fase.

-   **Control de Tipos de Publicación**: El administrador puede habilitar o deshabilitar de forma independiente la capacidad de crear tipos específicos de publicaciones (`solicitud`, `venta`, `donación`) para guiar la actividad de la plataforma durante esta fase. 