# Catálogo de Misiones de Pruebas Manuales (QA)

Este documento es el registro continuo y oficial de todas las misiones de pruebas (QA) generadas para el panel de administración de WintonCoin.
*Nota: Este archivo debe actualizarse automáticamente por la IA en numeración correlativa cada vez que se diseñen nuevas pruebas.*

---

```text
TITULO: QA-1 - Muro Anti-Bots (Referido sin KYC)
DESCRIPCION: El objetivo de esta misión es asegurarnos de que la plataforma no te deje ganar recompensas de límites de compromiso si invitas a un amigo pero este no sube sus fotos de seguridad (KYC). Solo necesitamos que hagas una prueba de registro con tu propio enlace para validarlo.
PASOS:
2. Ve a tu perfil y anota tu Límite de Compromiso RED actual.
3. Pídele a un amigo que se registre usando tu enlace de referido (o hazlo tú desde otro teléfono).
4. Completa el registro pero NO subas los documentos de KYC.
5. Regresa a tu cuenta principal y verifica que tu Límite de Compromiso RED sigue siendo el mismo y NO subió.
```

---

```text
TITULO: QA-2 - Bono por KYC Aprobado
DESCRIPCION: Esta prueba valida que la plataforma recompense exitosamente a los usuarios legítimos una vez que completen su verificación de identidad de manera satisfactoria.
PASOS:
2. Entra a la cuenta del referido que creaste en la prueba anterior.
3. Sube cualquier foto de prueba en la sección de Verificación de Identidad (KYC).
4. Pídele al administrador (o hazlo tú mismo en tu panel) que apruebe ese KYC.
5. Revisa tu cuenta principal: debes recibir una notificación celebrando el aumento y ver tu Límite de Compromiso RED incrementado en tu perfil.
```

---

```text
TITULO: QA-3 - Disyuntor de Pagos del Smart Contract
DESCRIPCION: Esta misión garantiza que nadie gaste más de lo que tiene permitido por su límite de confianza, bloqueando transacciones fraudulentas o excesivas antes de que ocurran.
PASOS:
2. Intenta pagar un servicio (o transferir a un comercio) por un monto total (incluyendo comisiones) que sea MAYOR a tu Límite de Compromiso RED.
3. Verifica que el sistema te bloquea mostrando un error indicando que excedes tu límite permitido.
4. Ahora realiza un pago por un monto MENOR a tu límite de compromiso.
5. Verifica que la transacción pase exitosamente sin bloqueos.
```

---

```text
TITULO: QA-4 - Cobro de Deuda Automático al Recibir Pagos
DESCRIPCION: El objetivo de esta prueba es comprobar que la plataforma retiene automáticamente el dinero si un usuario tiene una deuda pendiente. Necesitamos que recibas un pago pequeño y verifiques si el sistema descontó la deuda de forma correcta y te lo notificó, en lugar de darte el dinero libremente.
PASOS:
2. Pídele a un administrador que te asigne una pequeña deuda desde el panel (o crea una tú mismo incumpliendo una tarea).
3. Ingresa a la sección de tu Billetera y verifica que el sistema muestra claramente que tienes una deuda pendiente por pagar.
4. Pídele a otro usuario o amigo que te envíe un pago pequeño en tokens.
5. Revisa tu Billetera y comprueba que el sistema usó ese pago nuevo para descontar tu deuda automáticamente.
6. Toma captura de pantalla del historial de tu billetera donde se refleje el cobro automático.
```

---

```text
TITULO: QA-5 - Bloqueo de Compra de Impulsores
DESCRIPCION: Esta misión asegura que ningún usuario pueda comprar un plan de beneficios (Impulsor) si no tiene el dinero suficiente en su cuenta, evitando fraudes comerciales. Debes intentar adquirir un plan sin tener los fondos y asegurarte de que la aplicación te detenga de forma segura.
PASOS:
2. Entra a tu cuenta y asegúrate de que el saldo de tu billetera sea exactamente cero (0).
3. Navega hacia la sección de "Impulsores" (Boosters) en el menú de la aplicación.
4. Selecciona cualquier Impulsor que sea de pago y presiona el botón para comprarlo o activarlo.
5. Verifica que la pantalla te arroje un mensaje de error rojo indicando que no tienes fondos suficientes.
6. Regresa a tu perfil y asegúrate de que el Impulsor NO se haya activado por error.
```

---

```text
TITULO: QA-6 - Depósito de Garantía para Aumentar Límite RED
DESCRIPCION: El objetivo de esta prueba es verificar que el sistema de la Bóveda de Garantías funciona correctamente. Un usuario debe poder depositar tokens estables (como USDT o USDC) desde su billetera para que su Límite de Compromiso RED aumente automáticamente en la misma cantidad depositada. Se necesita confirmar que el saldo de la billetera baja, que el Límite RED sube y que la transacción queda registrada en el historial.
PASOS:
2. Conecta tu billetera MetaMask a la plataforma e ingresa a tu perfil.
3. Anota tu Límite de Compromiso RED actual y tu saldo de tokens estables (USDT o USDC) en MetaMask.
4. Busca la sección "Aumentar Límite RED" o "Bóveda de Garantías" y selecciona una cantidad para depositar.
5. Confirma la transacción en MetaMask cuando te aparezca la ventana de aprobación.
6. Espera a que la transacción se procese y verifica que tu Límite RED aumentó exactamente en la cantidad que depositaste.
```

---

```text
TITULO: QA-7 - Bloqueo de Retiro de Garantía con Deuda RED Pendiente
DESCRIPCION: Esta prueba verifica que la plataforma NO permite retirar el dinero depositado como garantía si el usuario todavía tiene compromisos (deuda RED) pendientes por pagar. El sistema debe bloquear el retiro y mostrar un mensaje claro explicando que primero debe pagar lo que debe. Esto protege a la plataforma de que alguien se lleve su garantía sin cumplir sus compromisos.
PASOS:
2. Asegúrate de que tu cuenta tenga un depósito de garantía activo en la Bóveda y que también tengas algún compromiso RED pendiente (deuda mayor a cero).
3. Ve a la sección "Bóveda de Garantías" en tu perfil e intenta presionar el botón de "Retirar" tu garantía.
4. Verifica que la plataforma te muestre un mensaje de error indicando que debes pagar toda tu deuda RED antes de poder retirar.
5. Confirma que tu saldo de garantía en la Bóveda no cambió y sigue intacto después del intento fallido.
```

---

```text
TITULO: QA-8 - Visualización del Desglose de Límite RED y Despliegue de Bóveda
DESCRIPCION: Esta prueba busca confirmar que la pantalla de Estado de Cuenta presenta de forma transparente el origen del Límite de Compromiso RED del usuario, separando claramente los puntos ganados por invitaciones y verificación de la garantía depositada en dinero estable. Además, se debe comprobar que el panel para depositar garantía se despliega y oculta de forma fluida al presionar el botón interactivo.
PASOS:
2. Inicia sesión en la aplicación y dirígete a la sección de Estado de Cuenta Web3 desde el menú principal.
3. Observa la tarjeta de Tokens RED y confirma que aparezca la casilla de Desglose de tu Límite con dos filas indicando el Score Orgánico y la Garantía en Bóveda.
4. Presiona el botón anaranjado que dice Aumentar Límite RED.
5. Verifica que se abra una caja explicativa mostrando el selector de moneda, la calculadora de monto y los botones de Depositar y Retirar.
6. Vuelve a presionar el botón superior para verificar que la caja se cierre correctamente sin desajustar la pantalla.
```

---

```text
TITULO: QA-9 - Calculadora en Tiempo Real y Validación de Retiro de Garantía
DESCRIPCION: Esta prueba valida que la calculadora interactiva responda al instante cuando el usuario escribe una cantidad a depositar, calculando exactamente cuánto aumentará su capacidad de compromiso antes de confirmar la operación en la red. Asimismo, confirma que el sistema rechace montos inválidos o vacíos al intentar presionar los botones de acción.
PASOS:
2. Ingresa al Estado de Cuenta Web3 y despliega el panel de Aumentar Límite RED.
3. Selecciona la moneda USDT en la lista desplegable y escribe la cantidad de 50 en el campo de monto.
4. Confirma que la etiqueta verde inferior cambie automáticamente mostrando la suma total de tu nuevo Límite RED proyectado.
5. Borra el número dejando el campo vacío e intenta presionar el botón de Depositar.
6. Verifica que la aplicación muestre un mensaje de aviso en letras rojas solicitando ingresar un monto válido mayor a cero.
```

