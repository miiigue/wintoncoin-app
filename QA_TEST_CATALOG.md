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
