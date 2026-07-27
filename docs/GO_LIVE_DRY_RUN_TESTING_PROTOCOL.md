# Protocolo Oficial de Verificación Manual (Go-Live Dry-Run)

Este documento contiene la especificación de auditoría técnica, contable y legal para llevar a cabo el recorrido de pruebas manuales en el entorno de Demo de WintonCoin tras la inicialización del **Protocolo de Blindaje Total (Clean Slate Go-Live)**.

Está diseñado para certificar que la plataforma cumple con los estándares de ciberseguridad bancaria, normativas FinTech sobre transmisores de dinero y auditoría de cumplimiento **SOC 2 Tipo II**.

---

## FASE 1: INICIALIZACIÓN PRIMARIA, BALANCE CERO Y BOOTSTRAP

En esta fase se confirmará la pureza contable del sistema tras la purga de la base de datos y el encendido en cero.

### Paso 1.1: Ingreso al Portal de Administración
- Abre tu navegador e ingresa a tu URL pública de Demo en Render apuntando a `admin.html` (o `admin-panel.html`).
- Inicia sesión utilizando las credenciales nativas del Super Administrador (usuario `admin` y la contraseña de entorno `ADMIN_PASSWORD`).

### Paso 1.2: Auditoría del Balance Inicial de Día Cero (Prueba de Congruencia Fiduciaria)
- Dentro del panel de administración (`admin-panel.html`), dirígete al módulo de finanzas globales y localiza el saldo de la Billetera de la Plataforma (`accounting@wintoncoin.com`).
- **Escenario Exitoso (Obligatorio):** El sistema debe mostrar un balance inmaculado de exactamente `0.0000 BLUE` y `0.0000 RED`. Esto certifica ante auditores externos que se ha eliminado el arrastre de saldos fantasma.
- **Escenario Alterno (Persistencia de Caché):** Si llegaras a visualizar saldos antiguos en pantalla, esto ocurre cuando el navegador almacena datos previos en su memoria local (`localStorage` o caché HTTP). Para resolverlo, presiona `Ctrl + F5` (o `Cmd + Shift + R` en Mac) para forzar una recarga limpia, o borra el almacenamiento local desde las Herramientas de Desarrollo (DevTools).

### Paso 1.3: Simulación de Bootstrap y Parámetros Maestros
- Navega hacia la pestaña de configuración del sistema dentro de `admin-panel.html`.
- Confirma que el motor de inicialización haya cargado de forma exitosa las 61 reglas maestras de negocio (`app_settings`), las etapas de multiplicadores para impulsores (`booster_stages`) y los métodos de pago P2P por defecto.

---

## FASE 2: CIBERSEGURIDAD BIOMÉTRICA Y EMPAREJAMIENTO DE GUARDIANES

El objetivo de esta fase es someter a estrés el emparejamiento de llaves criptográficas FIDO2 / WebAuthn para garantizar el principio legal de "no repudio" (Non-repudiation).

### Paso 2.1: Registro de un Nuevo Guardián en Demo
- Abre una ventana de navegador en modo incógnito e ingresa a `register.html`.
- Completa el formulario de registro para crear una cuenta de prueba dedicada a gobernanza (por ejemplo, `guardian_demo_1` con un correo y número de teléfono válidos).

### Paso 2.2: Vinculación Biométrica WebAuthn / FIDO2 (Prueba de Hardware)
- Inicia sesión con el usuario `guardian_demo_1` y accede a `governance-panel.html` (Panel de Gobernanza) o a la configuración de seguridad de su perfil.
- Haz clic en el botón *"Registrar Dispositivo Biométrica"* (o *"Habilitar WebAuthn"*).
- El navegador desplegará el cuadro de diálogo del sistema operativo solicitando tu huella dactilar, reconocimiento facial (FaceID) o PIN de Windows Hello. Realiza el escaneo biométrico.
- **Escenario Exitoso:** La interfaz mostrará un mensaje de éxito confirmando que la credencial pública FIDO2 se generó y guardó correctamente en la base de datos remota de Render.
- **Escenario Alterno (Bloqueo por Contexto Inseguro o Incompatibilidad):** Si el navegador bloquea la acción o arroja un error de hardware, verifica en la barra de direcciones que estés navegando estrictamente bajo protocolo seguro `https://` (el estándar WebAuthn aborta cualquier petición sobre `http://` plano). Si estás en un equipo sin lector de huella, realiza esta prueba ingresando a la URL desde tu teléfono móvil.

### Paso 2.3: Simulación de Votación y Exportación de Auditoría
- En `governance-panel.html`, simula la emisión de un voto para aprobar un cambio en las reglas de consenso.
- Tras votar, haz clic en el botón *"Exportar Votaciones"* para descargar el comprobante de auditoría en formato JSON.
- **Verificación Legal:** Abre el archivo descargado y comprueba que contenga la firma criptográfica HMAC-SHA256 y el identificador de tu nueva credencial WebAuthn. Esto asegura que el voto está vinculado irrevocablemente a la biometría del Guardián.

---

## FASE 3: ATOMICIDAD WEB2/WEB3 Y CONTRATOS EN OPTIMISM SEPOLIA

En esta fase verificaremos que la base de datos de Render y los Smart Contracts en Optimism Sepolia operen en estricta sincronía como una Única Fuente de la Verdad (Single Source of Truth).

### Paso 3.1: Creación de Cuenta de Inversor y Bóveda Web3
- En una nueva ventana de incógnito, accede a `register.html` y registra a un usuario final de prueba (por ejemplo, `usuario_inversor_1`).
- Una vez dentro, navega hacia `estado-cuenta.html` o `contract_interaction.html`.
- **Verificación Exitosa:** Confirma que el backend haya inicializado correctamente la bóveda Web3 del usuario y que la pantalla muestre su dirección pública de blockchain asignada.

### Paso 3.2: Solicitud y Aprobación Atómica de KYC (Prueba de Fuego L2)
- Desde el perfil de `usuario_inversor_1`, dirígete a la sección de verificación KYC y carga un documento de prueba (imagen o PDF).
- Regresa a tu ventana de administración principal (`admin-panel.html`) donde tienes abierta la sesión del Super Administrador `admin`.
- Localiza la solicitud pendiente de `usuario_inversor_1` en la bandeja de entrada y haz clic en *"Aprobar KYC"*.
- **Evaluación de Escenarios Críticos en Blockchain:**
  - **Escenario Exitoso:** El motor `NonceManager` del backend empaquetará la transacción utilizando el override de `gasLimit: 5000000`. La transacción se confirmará en Optimism Sepolia y el panel de administración mostrará un aviso de éxito con el hash oficial de la transacción (`tx_hash`). El estado del usuario en la base de datos cambiará a verificado únicamente tras recibir la confirmación de la red.
  - **Escenario Alterno (Fondos Agotados en el Relayer):** Si la ventana arroja un error indicando fallo de ejecución o tiempo agotado, inspecciona los registros de Render. Si el mensaje indica `insufficient funds for gas`, significará que la cuenta de MetaMask del Relayer ha consumido su saldo de ETH de prueba en Optimism Sepolia, por lo que deberás enviarle fondos de testnet adicionales desde un faucet a su dirección pública.

### Paso 3.3: Interacción Directa en el Portal de Contratos
- Ingresa a `contract_interaction.html` para probar la lectura en vivo desde la blockchain.
- Haz clic en los botones para consultar el `totalSupply` y los balances de los contratos `BlueToken` y `RedToken`. El portal debe devolver instantáneamente los valores en cero comunicándose de forma transparente con el nodo de Alchemy.

---

## FASE 4: MERCADO P2P Y LIQUIDACIÓN DE DEUDAS

Aquí auditaremos el comportamiento del motor transaccional P2P y el cumplimiento contable de partida doble.

### Paso 4.1: Publicación de una Orden en el Mercado P2P
- Inicia sesión con `usuario_inversor_1` y dirígete a `p2p.html`.
- Crea una orden pública para vender tokens BLUE o liquidar un IOU, fijando el monto y el método de pago.

### Paso 4.2: Simulación de Aceptación y Cierre Contable
- Con un segundo usuario de prueba (`usuario_inversor_2`), ingresa a `p2p.html`, busca la orden publicada por el primer usuario y haz clic en *"Aceptar"*.
- Simula los pasos de confirmación de pago fiat y liberación de tokens en la interfaz.
- **Auditoría Contable:** Al finalizar, entra a `p2p-history.html` y `transactions.html`. Comprueba que el registro refleje un débito exacto en la cuenta del vendedor y un crédito idéntico en la del comprador, validando que la función de base de datos `record_balance_event` procesa el evento de forma 100% auditable.

---

## FASE 5: CREACIÓN Y PUBLICACIÓN DE SERVICIOS

Esta fase pone a prueba la lógica de publicaciones, costos en BLUE y controles de acceso en el marketplace de.

### Paso 5.1: Publicación de una Oferta o Solicitud Solidaria
- Inicia sesión con cualquier usuario verificado y accede a `publish.html` (o a las vistas especializadas `pedir-ayuda.html` y `ofrecer-ayuda.html`).
- Llena los datos del servicio o solicitud solidaria, definiendo un costo específico en tokens (`blue_cost`).

### Paso 5.2: Flujo de Aceptación y Manejo de Saldos
- Accede a la vista de detalle de la publicación (`publication-detail.html`) utilizando otra cuenta de usuario y haz clic en el botón para participar o contratar.
- **Escenario Exitoso (Con liquidez):** Si el usuario dispone de suficientes tokens BLUE, la solicitud se procesará y quedará en estado `pending_approval` en el panel del autor, donde este podrá aprobarla.
- **Escenario Alterno (Bloqueo por Liquidez Insuficiente):** Al estar en un entorno de Día Cero donde los usuarios nuevos nacen con saldo cero, al hacer clic en participar la interfaz debe interceptar la acción instantáneamente y mostrar una alerta roja indicando que no se poseen suficientes tokens BLUE para cubrir el `blue_cost`, bloqueando cualquier intento de fraude o sobregiro.

---

## FASE 6: REVISIÓN DEL MOTOR DE MARKETING Y CAMPAÑAS MOMENTUM

En esta fase evaluaremos la propagación de campañas publicitarias y la atribución de referidos.

### Paso 6.1: Creación de Campaña en el Portal Admin Momentum
- Inicia sesión con el Super Administrador `admin` y dirígete a `momentum-admin.html`.
- Genera una nueva campaña promocional (por ejemplo, una campaña de intriga titulada *"Haz la W de WintonCoin"*) definiendo las recompensas en tokens y fechas de vigencia.

### Paso 6.2: Interacción del Usuario en el Tablero Momentum
- Con un usuario final, ingresa a `momentum-dashboard.html` o `momentum-landing.html`.
- Confirma que las tarjetas visuales de la campaña se desplieguen correctamente, que el enlace de invitación en `referrals.html` copie correctamente el código de afiliado del usuario, y que el tablero refleje con precisión las métricas de participación.

---

## FASE 7: PERFIL DE IMPULSORES Y SISTEMA DE NIVELES

Aquí validaremos que la jerarquía de impulsores (Boosters) calcule adecuadamente sus beneficios y frecuencias.

### Paso 7.1: Auditoría del Tablero de Impulsor
- Inicia sesión con una cuenta que tenga el rol de impulsor activado (`is_booster = true`) y accede a `booster-profile.html`.
- Verifica que la pantalla consulte y muestre correctamente su nivel actual (`booster_level`), su etapa de multiplicador asignada (`booster_stages`) y los selectores para ajustar su frecuencia de cobro personalizada.

---

## FASE 8: ESCUDOS ECONÓMICOS Y PROCESOS EN SEGUNDO PLANO

Para concluir, verificaremos que los demonios financieros automatizados respeten las compuertas legales de protección en el entorno de pre-lanzamiento.

### Paso 8.1: Verificación de Demonios en los Registros de Render
- Esta prueba no se ejecuta haciendo clics en la web, sino accediendo a la pestaña *"Logs"* de tu servicio backend de Demo en el panel web de Render.com.
- Observa el flujo de registros generados en segundo plano por el orquestador `cronManager.js` para los demonios `debtCollectorJob.js` y `tokenReleaserJob.js`.
- **Evaluación de Escenario Legal de Cumplimiento:**
  - **Escenario Exitoso (Escudo Activo):** Al encontrarse la plataforma con el parámetro `pre_launch_mode_enabled === 'true'` en `app_settings`, los registros del demonio deben imprimir periódicamente un aviso confirmando que detectan el modo de pre-lanzamiento y suspenden el cobro de morosidad en RED y la liberación prematura de liquidez.
  - **Escenario Alterno (Intento de Cobro Prematuro):** Si observas en el registro que el `debtCollectorJob` inicia el escaneo de carteras para aplicar penalizaciones, significará que el modo de pre-lanzamiento fue desactivado accidentalmente en la base de datos. Para remediarlo, deberás ingresar inmediatamente a `admin-panel.html` y volver a activar la casilla de *"Modo Pre-Lanzamiento"* en la configuración global.
