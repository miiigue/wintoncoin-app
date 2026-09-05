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

---

```text
TITULO: QA-10 - Registro de Damnificados del Terremoto y Código de Expediente Inteligente
DESCRIPCION: Esta prueba valida que una persona afectada por el desastre pueda registrar su censo de emergencia desde su teléfono móvil. Se debe verificar que el formulario capture la ubicación, censo familiar, fotos de evidencia y que genere su número de expediente inteligente sin bloqueos.
PASOS:
2. Abre tu navegador en el teléfono móvil e ingresa a la página del portal SOS Venezuela (sos-venezuela.html).
3. Desplázate hacia abajo hasta ubicar el formulario de "Censo y Registro de Asistencia para Damnificados" o presiona el botón rosa de acceso rápido.
4. Llenar los datos personales: tu nombre completo, Cédula de Identidad con formato V-, género, teléfono venezolano con prefijo +58 y correo electrónico.
5. Indicar la ubicación exacta de la emergencia con tu Estado, Municipio, Sector y la dirección detallada de la vivienda afectada.
6. Completar el censo de cargas familiares indicando cuántos niños, adultos mayores y personas con discapacidad viven contigo.
7. Seleccionar el nivel de afectación (ejemplo: Pérdida Total o Daños Parciales) y escribir un relato breve de la situación vivida.
8. Dejar marcadas las casillas de consentimiento legal y declaración jurada, y presionar el botón "Enviar Solicitud de Asistencia Humanitaria".
9. Confirmar que la pantalla muestre el mensaje verde de éxito y que en el texto se despliegue tu número de expediente asignado (ejemplo: #SOS-VZLA-249-00001).
```

---

```text
TITULO: QA-11 - Verificación de Cuenta por Código de 6 Dígitos en SOS Venezuela
DESCRIPCION: Esta misión garantiza que el usuario pueda activar su cuenta recién creada e ingresar sus 6 dígitos de seguridad en la misma pantalla del portal SOS sin perder su número de expediente. Se debe verificar la llegada del correo y la acreditación de los 200 BLUE IOU iniciales.
PASOS:
2. Tras completar el registro de damnificado en la prueba anterior, ubica en la pantalla la caja destacada que dice "Activa tu Billetera de Ayuda Humanitaria".
3. Revisa la bandeja de entrada de tu correo electrónico (o la carpeta de correo no deseado) y busca el mensaje de confirmación enviado por WintonCoin.
4. Anota el código de seguridad numérico de 6 dígitos que viene en el correo (ejemplo: 849201).
5. Regresa a la página en tu teléfono e ingresa exactamente esos 6 dígitos en el campo de texto.
6. Presiona el botón que dice "Confirmar Código".
7. Verifica que la caja cambie a color verde y te muestre el mensaje de éxito informándote que tu cuenta y tus 200 BLUE IOU han sido activados correctamente.
```

---

```text
---

```text
TITULO: QA-13 - Censo de Edad, Subida de Fotos desde Móvil y Código de Urgencia de 4 Dígitos
DESCRIPCION: El objetivo de esta prueba es comprobar que el formulario de censo para personas afectadas permite ingresar la fecha de nacimiento y subir fotos de evidencia directamente desde la cámara o galería del teléfono. Asimismo, valida que el sistema genere el código de expediente inteligente con la nueva jerarquía de 4 dígitos (Gravedad, Cargas, Rango de Edad y Sexo) ordenando el caso según su nivel de prioridad.
PASOS:
2. Abre el navegador de tu teléfono e ingresa al portal SOS Venezuela (sos-venezuela.html).
3. Ingresa tu Nombre, Cédula de Identidad con formato V- y selecciona tu Fecha de Nacimiento en la casilla interactiva de calendario.
4. Selecciona tu género, indica si eres cabeza de familia e ingresa tu teléfono venezolano (+58) y tu correo electrónico.
5. Completa los datos de tu ubicación (Estado, Municipio y Sector) e indica cuántas personas menores, adultos mayores y con discapacidad viven contigo.
6. Selecciona el nivel de afectación (ejemplo: Pérdida Total) y presiona el botón de subir fotos de evidencia eligiendo hasta 3 imágenes desde la cámara de tu celular.
7. Marca las casillas de consentimiento legal y declaración jurada, y presiona el botón "Enviar Solicitud de Asistencia Humanitaria".
8. Verifica que la solicitud procese con éxito y que tu número de expediente muestre la nueva estructura de 4 dígitos centrados (ejemplo: #SOS-VZLA-4532-00001).
```

---

```text
TITULO: QA-14 - Auditoría Administrativa de Edad y Priorización por Mayor Urgencia
DESCRIPCION: Esta prueba garantiza que desde el Panel de Administración los gestores puedan visualizar la edad del solicitante, su fecha de nacimiento y el puntaje numérico de urgencia. Además, comprueba que la lista de expedientes se ordene automáticamente colocando los casos de mayor gravedad e impacto en la parte superior para una atención prioritaria.
PASOS:
2. Inicia sesión en el Panel de Administración (admin-panel.html) con tu cuenta de administrador.
3. Navega al menú lateral y presiona la sección de "Damnificados Terremoto (SOS)".
4. Observa la tabla de expedientes y confirma que la lista aparezca ordenada de mayor a menor según el número de urgencia asignado.
5. Presiona el botón "Ver Ficha" en la fila del expediente creado recientemente.
6. Revisa los datos de la ficha flotante y comprueba que se muestre la edad calculada en años, la fecha de nacimiento entre paréntesis y el recuadro destacado con el Puntaje de Urgencia.
7. Cierra la ficha y confirma que los datos coincidan exactamente con la información enviada desde el teléfono móvil.
```




```text
TITULO: QA-15 - Verificación de Privacidad y Aislamiento del Expediente SOS en Mi Perfil
DESCRIPCION: Esta prueba valida que los datos sensibles del expediente de ayuda humanitaria (SOS Venezuela) solo puedan ser vistos por el usuario creador dentro de su propio perfil. Se comprueba que otros usuarios no puedan ver la información personal de la víctima al visitar su perfil público.
PASOS:
2. Inicia sesión con la cuenta del usuario que registró la solicitud SOS y navega al menú principal.
3. Toca la opción "👤 Mi Perfil" en el menú de navegación y confirma que aparezca la pestaña "Mi caso (SOS)" con el estado de tu expediente.
4. Cierra sesión e inicia sesión con una cuenta de usuario distinta (ejemplo: test8 u otro usuario).
5. Ve al menú y presiona "👤 Mi Perfil". Confirma que puedes ver tu reputación y billetera sin presentar errores.
6. Intenta acceder al perfil público del primer usuario (profile.html?user=UsuarioSOS).
7. Confirma que solo se visualice la reputación pública y comentarios, y que en ningún momento se muestre la información privada del expediente SOS.
```

---

```text
TITULO: QA-16 - Verificación de Sanitización Anti-XSS en el Historial de Referidos
DESCRIPCION: Esta prueba permite verificar que la página de referidos procese los códigos y nombres de usuarios referidos sin interpretar caracteres especiales ni vulnerar la seguridad del navegador.
PASOS:
2. Inicia sesión con tu cuenta de usuario e ingresa a la sección de Referidos.
3. Copia tu enlace de referido y comparte tu código con un nuevo usuario.
4. Registra una nueva cuenta usando el enlace de referido.
5. Regresa a la cuenta principal y refresca la pantalla de Referidos.
6. Observa la tabla de usuarios referidos y confirma que el nombre de usuario y el código de referido se muestren correctamente como texto plano sanitizado sin alteraciones en la pantalla.
```

---

```text
TITULO: QA-17 - Trazabilidad y Bitácora del Expediente SOS en el Historial de Mi Perfil
DESCRIPCION: Esta prueba garantiza que los usuarios puedan ver el historial detallado de su expediente de ayuda humanitaria (registro, verificación de contacto, aprobación y entregas de fondos) en forma de bitácora cronológica con la fecha, hora y minutos exactos de cada evento desde su perfil.
PASOS:
2. Inicia sesión con la cuenta de usuario que registró la solicitud de asistencia humanitaria SOS.
3. Navega al menú principal y haz clic en "Mi Perfil".
4. Baja hasta la sección "Mi caso" y localiza la tarjeta destacada de tu expediente.
5. Confirma que aparezca una sección titulada "📋 Historial y Bitácora del Expediente".
6. Verifica que se muestre el evento de creación inicial "EXPEDIENTE CREADO" detallando la fecha y hora con precisión de minutos (ejemplo: 02/08/2026 14:32).
7. Simula un cambio de estado en el panel de administración a "Aprobado para Ayuda" y confirma que al refrescar tu perfil se añada de forma instantánea el evento "APROBADO PARA AYUDA" con su respectiva fecha y hora exacta.
```

---

```text
TITULO: QA-18 - Restricción del Desembolso de Ayuda SOS en el Panel de Administración
DESCRIPCION: Esta prueba valida que los administradores no puedan hacer clic ni activar el botón "Asignar Ayuda" para asignar fondos (BLUE IOU) a una víctima si su expediente no se encuentra previamente en el estado de aprobado (Aprobado para Ayuda).
PASOS:
2. Inicia sesión en el Panel de Administración (admin-panel.html) con tu cuenta de administrador.
3. Dirígete al menú lateral y abre la sección de "Damnificados Terremoto (SOS)".
4. Busca un expediente que se encuentre en estado "En Verificación" o "Info Requerida".
5. Localiza el botón "Asignar Ayuda" en la columna de acciones para dicha fila.
6. Confirma que el botón esté deshabilitado visualmente (opacidad reducida) y que no responda a clics del cursor (no se abre el formulario de asignación).
7. Selecciona un expediente en estado "Aprobado" y confirma que el botón "Asignar Ayuda" para esta fila sí esté habilitado y permita abrir el formulario al hacer clic.
```

---

```text
TITULO: QA-19 - Navegación e Integración Visual de la Sección de Talentos (Careers)
DESCRIPCION: Esta prueba comprueba la correcta visualización de la sección de Reclutamiento (Talento & Innovación) colocada en la página principal, asegurando que se muestren los beneficios de compensación y las vacantes técnicas, y que el botón de postulación redirija correctamente al formulario de talentos.
PASOS:
2. Ingresa a la página principal de WintonCoin (index.html) desde tu navegador.
3. Baja por el contenido de la landing page hasta pasar la sección de "Seguridad e Integridad".
4. Confirma que visualizas una sección premium titulada "Talento & Innovación" con un fondo degradado azul sutil.
5. Verifica que se muestren las tres tarjetas de beneficios (Compensación Elite, Retos Web3 E2E y Cultura de Impacto).
6. Confirma que la sección liste las vacantes técnicas destacadas ("Senior Solidity / Rust Engineer" y "Full-Stack Web3 Developer") y que tengan su insignia verde de "Remoto".
7. Toca el botón "Ver Vacantes y Postularse ↗" y confirma que el navegador abra limpiamente la pantalla del formulario de postulación (trabaja-con-nosotros.html).
```

---

```text
TITULO: QA-20 - Edición de Plantillas de Correo y Vista Previa No-Reply desde Móvil
DESCRIPCION: Esta misión tiene como objetivo verificar que los administradores puedan revisar y modificar el texto de los correos automáticos del sistema (como los mensajes de bienvenida, notificaciones o recibos) directamente desde su teléfono móvil, y confirmar que la vista previa en vivo muestre el diseño oficial con la cabecera del logo y el aviso de no responder al correo.
PASOS:
2. Inicia sesión en el Panel de Administración desde el navegador de tu teléfono móvil.
3. Abre el menú lateral y toca la opción que dice "📧 Plantillas Email".
4. Revisa la lista de plantillas disponibles y usa los botones superiores de filtro (por ejemplo, presiona "Seguridad" o "Finanzas") para verificar que la lista se organice correctamente.
5. Toca el botón "✏️ Editar & Previsualizar" en la tarjeta del correo de verificación (código OTP).
6. Modifica brevemente el texto del asunto o del cuerpo del mensaje en la casilla de edición.
7. Cambia a la pestaña o sección de "Vista Previa en Vivo" y confirma que el correo se muestre envuelto en el diseño oficial con la cabecera oscura del logo WintonCoin y el mensaje al final que indica no responder al correo.
8. Presiona el botón azul "💾 Guardar Cambios" y confirma que aparezca el aviso verde indicando que la plantilla fue guardada con éxito.
```

---

```text
TITULO: QA-21 - Evaluación de Candidatos y Visualización de Hojas de Vida desde el Teléfono
DESCRIPCION: Esta prueba busca confirmar que los evaluadores de talento puedan revisar los perfiles de los profesionales postulados a la plataforma desde su teléfono inteligente. Se debe verificar que se puedan filtrar los candidatos por área de especialidad, abrir su ficha detallada con su enlace de hoja de vida (CV) y actualizar su estado de selección sin errores.
PASOS:
2. Ingresa al Panel de Administración desde el navegador de tu teléfono móvil.
3. Toca la opción "💼 Reclutamiento" o "🎯 Talento" en el menú de navegación.
4. Observa la lista de candidatos registrados y presiona los botones de filtro por especialidad para verificar que la tabla organice a los postulantes.
5. Toca el botón "👁️ Evaluar" o "Ver Detalle" en la tarjeta de cualquier candidato para abrir su expediente flotante.
6. Confirma que la ficha muestre claramente el nombre, correo, años de experiencia, carta de presentación y los botones directos para abrir su hoja de vida (CV) o perfil profesional.
7. Cambia el estado del candidato (por ejemplo, a "En Entrevista" o "Aprobado") usando el selector desplegable de estado.
8. Verifica que la pantalla confirme el cambio de estado y que la tarjeta del candidato actualice su distintivo de color.
```

---

```text
TITULO: QA-22 - Postulación y Filtro Administrativo de Especialidad Voluntario
DESCRIPCION: El objetivo de esta prueba es asegurar que cualquier persona pueda postularse como Voluntario en la plataforma de reclutamiento y que el administrador pueda encontrar y filtrar este tipo de postulaciones de forma sencilla desde su panel de control.
PASOS:
2. Abre el navegador de tu teléfono móvil e ingresa a la página de postulación (trabaja-con-nosotros.html).
3. Rellena tus datos personales de contacto, escribe tu carta de presentación y selecciona 'Voluntario' en el desplegable de Especialidad.
4. Adjunta un archivo PDF de prueba como hoja de vida (CV) y presiona el botón 'Enviar Postulación'.
5. Inicia sesión en el Panel de Administración (admin-panel.html) y dirígete a la sección de Reclutamiento.
6. Abre el selector de filtro por especialidad, selecciona la opción 'Voluntario' y verifica que en la tabla aparezca listado únicamente el candidato que registraste con sus datos correctos.
```

---

```text
TITULO: QA-23 - Vista Previa de Emails y Retorno Seguro al Panel sin Perder Sesión
DESCRIPCION: Esta misión tiene como objetivo comprobar que el editor de plantillas de correo a pantalla completa renderiza correctamente los correos de prueba en vivo sin mostrar códigos internos y que permite regresar al menú principal del panel de administración sin cerrar la sesión.
PASOS:
2. Inicia sesión en el Panel de Administración e ingresa al submódulo de Plantillas de Correo (admin-email-templates.html).
3. Presiona el botón de 'Editar' en la plantilla de Recibo de Transacción (transaction_receipt) o de Gobernanza (governance_notification).
4. Verifica que la ventana de edición se despliegue a pantalla completa con el código a la izquierda y que en la parte derecha se muestre la vista previa con datos ficticios reales (como nombres, montos y tablas) en lugar de códigos entre llaves.
5. Presiona el botón de cerrar o la tecla ESC para salir del editor de la plantilla.
6. Presiona el enlace que dice '← Volver al Panel Admin' en la esquina superior izquierda de la pantalla.
7. Confirma que eres redirigido inmediatamente al panel de control principal (admin-panel.html) y que puedes navegar por sus secciones sin que el sistema te solicite iniciar sesión nuevamente.
```

---

```text
TITULO: QA-24 - Registro SOS de Nuevo Damnificado y Activación por Código de Seguridad
DESCRIPCION: Esta prueba valida el registro completo de una persona afectada por la emergencia. Se debe comprobar que el botón de envío solo se active cuando todos los campos y casillas legales estén completos, que el usuario reciba un código de 6 dígitos por correo para crear su clave y que al validar su cuenta reciba su bono de bienvenida en su billetera.
PASOS:
2. Abre la página de ayuda humanitaria (sos-venezuela.html) desde el navegador de tu teléfono.
3. Rellena todos los campos obligatorios con datos nuevos y verifica que el botón rosado de 'Enviar Solicitud' permanezca deshabilitado hasta que marques ambas casillas de autorización legal al final.
4. Sube entre 5 y 15 fotos de prueba y presiona el botón 'Enviar Solicitud'.
5. Comprueba que el formulario desaparezca y se abra la tarjeta de verificación pidiéndote tu código de 6 dígitos y tu nueva contraseña.
6. Revisa tu bandeja de correo electrónico, copia el código de 6 dígitos recibido e ingrésalo junto a tu nueva contraseña de 8 o más caracteres.
7. Presiona el botón de confirmar y verifica que la pantalla te felicite mostrando tu número de expediente asignado y que al entrar a tu perfil tengas acreditados 200 BLUE en tu balance.
```

---

```text
TITULO: QA-25 - Reactivación de Expediente Abandonado y Tiempo de Espera en Reenvío
DESCRIPCION: Esta misión asegura que si una persona no pudo ingresar su código de seguridad a tiempo o cerró la pantalla, el sistema le permita retomar su trámite de forma automática sin perder su expediente y sin permitir abusos de reenvío de mensajes.
PASOS:
2. Ingresa a la página de ayuda humanitaria (sos-venezuela.html) y envía una solicitud con una cédula y correo nuevos.
3. Al llegar a la pantalla donde pide el código de 6 dígitos, cierra el navegador o recarga la página sin ingresar el código.
4. Vuelve a llenar el formulario ingresando exactamente la misma cédula que usaste en el paso 2.
5. Comprueba que el sistema detecte tu expediente previo, te muestre un aviso informándote que tu solicitud ya fue recibida y te lleve de inmediato a la pantalla del código de seguridad enviándote un nuevo código al correo.
6. En la pantalla del código, presiona el enlace que dice 'Reenviar código'.
7. Comprueba que el enlace cambie a un contador de tiempo de 60 segundos y no te permita presionar reenvíos repetidos hasta que finalice la cuenta regresiva.
```

---

```text
TITULO: QA-26 - Detección de Cédula Activa y Botón Inteligente de Acceso a Cuenta
DESCRIPCION: Esta prueba busca confirmar que la plataforma impida registros duplicados si una persona ya tiene una cuenta activa y verificada, mostrándole un aviso amigable y un botón que se adapta según si el usuario ya tiene su sesión abierta o no.
PASOS:
2. Abre la página de ayuda humanitaria (sos-venezuela.html) en una ventana de navegación privada o de incógnito (sin iniciar sesión).
3. Intenta enviar el formulario usando una cédula que ya esté registrada y activa en el sistema.
4. Verifica que aparezca un cuadro de aviso rojo explicando amigablemente que la cédula ya tiene una solicitud activa y mostrando un botón destacado que dice 'Iniciar Sesión'.
5. Ahora abre una ventana normal donde sí tengas tu sesión iniciada con tu cuenta e intenta enviar nuevamente el formulario con esa misma cédula.
6. Comprueba que el cuadro de aviso detecte que ya estás conectado y cambie el botón automáticamente por uno que dice 'Ir a mi cuenta' que te lleva directamente a tu perfil.
```

---

```text
TITULO: QA-27 - Detección Preventiva de Teléfono o Correo en Uso por Otra Cuenta
DESCRIPCION: Esta prueba asegura que el sistema maneje de forma clara y sin errores técnicos las situaciones donde un usuario intenta registrarse utilizando un número telefónico o correo electrónico que ya pertenece a otra persona en la plataforma.
PASOS:
2. Abre la página de ayuda humanitaria (sos-venezuela.html) desde tu teléfono.
3. Rellena el formulario con una cédula y nombre nuevos, pero coloca un número de teléfono que ya esté registrado previamente en otra cuenta del sistema.
4. Marca las casillas legales y presiona el botón 'Enviar Solicitud'.
5. Verifica que la aplicación no muestre códigos de error extraños de base de datos y en su lugar te muestre un mensaje claro indicando que el número de teléfono ya está registrado en otra cuenta.
6. Cambia el número de teléfono por uno nuevo y confirma que ahora la solicitud se procese normalmente hacia la pantalla de verificación.
```

---

```text
TITULO: QA-28 - Postulación y Verificación de Registro de Voluntarios SOS
DESCRIPCION: Esta misión asegura que los usuarios interesados en prestar ayuda como voluntarios puedan completar su postulación desde la página SOS Venezuela indicando sus áreas de experiencia y disponibilidad. Se debe verificar que reciban su código de 6 dígitos al correo, activen su cuenta con clave de acceso, reciban su expediente inteligente #VOL-VZLA-XXXX-XXXXX y su bono de bienvenida en la billetera, y que el administrador pueda gestionarlos desde la pestaña Voluntarios SOS en el panel de reclutamiento.
PASOS:
2. Abre tu navegador móvil e ingresa al portal SOS Venezuela (sos-venezuela.html) desplazándote hasta el formulario Registro de Voluntario.
3. Ingresa tu Nombre Completo, Cédula de Identidad V-, Fecha de Nacimiento (mayor de 18 años), Género, Correo Electrónico y Teléfono celular.
4. Selecciona tu ubicación (Estado, Municipio y Sector) y marca tus opciones en las áreas de voluntariado y disponibilidad de tiempo.
5. Acepta los términos de consentimiento de datos y la declaración jurada, y presiona Enviar Postulación de Voluntario.
6. Copia el código de 6 dígitos que te llegó al correo, escribe tu contraseña de acceso y presiona Activar mi Cuenta de Voluntario.
7. Confirma que la pantalla te muestre tu número de expediente asignado (ejemplo: #VOL-VZLA-4411-00001) y la acreditación de tu bono de bienvenida.
8. Inicia sesión en el Panel de Administración (admin-recruitment.html) y presiona la pestaña Voluntarios SOS para verificar que tu registro aparezca ordenado por puntaje de prioridad con la opción de aprobar o activar el expediente.
```

---

```text
TITULO: QA-29 - Redirección desde Trabaja con Nosotros a Registro de Voluntario SOS
DESCRIPCION: Esta prueba comprueba que si una persona intenta postularse como voluntario desde el formulario general de vacantes de empleo, el sistema le muestre un aviso informativo azul guiándolo hacia el registro especializado de voluntarios en la página SOS Venezuela.
PASOS:
2. Abre el navegador de tu teléfono móvil e ingresa a la página de ofertas de empleo (trabaja-con-nosotros.html).
3. Ubica el campo de selección desplegable titulado Especialidad o Rol al que te postulas.
4. Presiona el desplegable y elige la opción de Voluntario.
5. Verifica que justo debajo aparezca de forma automática un cuadro azul destacado sugiriéndote ir al sistema oficial de voluntarios SOS.
6. Toca el botón azul que dice Ir al Registro de Voluntario y confirma que te redirija a la sección de voluntariado en la página sos-venezuela.html#voluntariado.
```

---

```text
TITULO: QA-30 - Gestión Administrativa y Filtrado por Prioridad de Voluntarios SOS
DESCRIPCION: Esta misión asegura que los gestores y administradores de la plataforma puedan filtrar, ordenar por disponibilidad y activar o suspender los expedientes de voluntarios registrados desde la pestaña dedicada en el panel de reclutamiento.
PASOS:
2. Inicia sesión con tu cuenta de administrador e ingresa al panel de talentos (admin-recruitment.html).
3. En la parte superior de los controles, presiona el botón de la pestaña que dice Voluntarios SOS.
4. Confirma que la tabla organice la lista de voluntarios mostrando su número de expediente, edad, género, ubicación y su puntaje de prioridad de despliegue.
5. Usa el buscador o el filtro de estado para localizar a un voluntario recién registrado.
6. Presiona el botón verde de aprobación para activar su expediente y confirma que la pantalla actualice su estatus a ACTIVO.
```

---

```text
TITULO: QA-31 - Verificación del Perfil de Impulsor y Requisitos de Canje en Android
DESCRIPCION: El objetivo de esta prueba es comprobar que la pantalla de perfil de impulsor en la aplicación móvil muestre tus 8 métricas financieras, el avance en la escalera de rangos y el diálogo explicativo de seguridad con las condiciones para canjear tus recompensas.
PASOS:
2. Abre la aplicación de WintonCoin en tu teléfono móvil e inicia sesión con tu cuenta.
3. En la pantalla principal, presiona la tarjeta que dice Impulsores.
4. Confirma que veas tu nivel actual de impulsor junto con el aviso de equivalencia 1 BLUE IOU = 1 USD.
5. Toca el botón de información (icono de interrogación o candado) en la esquina superior y comprueba que se abra la ventana con los requisitos de seguridad anti-fraude.
6. Revisa las tarjetas de saldo y verifica que tu saldo habilitado y el saldo retenido por referidos sin verificación aparezcan claramente separados.
7. Desplázate hacia abajo y comprueba que la escalera de rangos señale tu nivel actual y te indique exactamente cuánto te falta para subir al siguiente nivel.
```

---

```text
TITULO: QA-32 - Invitación de Amigos y Monitoreo de Referidos con KYC en Android
DESCRIPCION: Esta misión asegura que puedas compartir tu código y enlace de invitación directamente desde la aplicación móvil hacia tus redes sociales y ver el listado actualizado de las personas que se hayan registrado con tu enlace, identificando quiénes ya verificaron su identidad.
PASOS:
2. Abre la aplicación móvil y presiona el botón de Mis Referidos en la pantalla de inicio o desde tu perfil de impulsor.
3. Presiona el botón Copiar Código y confirma que aparezca un mensaje indicando que el código fue copiado al portapapeles.
4. Presiona el botón Compartir y comprueba que se abra el menú de aplicaciones de tu teléfono para enviarlo por WhatsApp o redes sociales.
5. Revisa la lista de personas invitadas en la parte inferior y verifica que cada amigo tenga su etiqueta verde de KYC Aprobado o amarilla de KYC Pendiente según su estado real.
```

---

```text
TITULO: QA-33 - Auditoría de Estado de Cuenta Web3 y Consulta de Smart Contracts en Android
DESCRIPCION: Esta misión tiene como objetivo verificar que la pantalla de Estado de Cuenta Web3 en Android muestre con claridad tus saldos disponibles y en reserva, el desglose de tu límite crediticio y te permita consultar la información oficial de los contratos inteligentes en la blockchain.
PASOS:
2. Abre la aplicación de WintonCoin en tu teléfono móvil e inicia sesión.
3. En el menú principal, presiona la tarjeta que dice Estado de Cuenta Web3.
4. Confirma que la tarjeta azul muestre tu saldo disponible, el saldo en reserva y el cálculo estimado en dólares (1 BLUE = 1 USD).
5. Toca el botón Ver Smart Contract BLUE y verifica que se abra la ventana con la dirección pública del contrato y el total de monedas emitidas en la blockchain.
6. Cierra la ventana y toca el botón Ver Smart Contract RED para comprobar igualmente la información del contrato de obligaciones.
7. Revisa la tarjeta de Identidad Web3 y confirma que muestre tu estado de red conectada y tu dirección pública de billetera con el botón para copiarla.
```

---

```text
TITULO: QA-34 - Simulación de Aumento de Límite en la Bóveda de Garantías desde Android
DESCRIPCION: Esta prueba busca confirmar que puedas acceder al simulador de la Bóveda de Garantías en la aplicación móvil, seleccionar la moneda digital de respaldo y calcular en vivo cómo aumentará tu límite de crédito antes de realizar cualquier operación.
PASOS:
2. Abre la aplicación de WintonCoin e ingresa a la pantalla de Estado de Cuenta Web3.
3. Ubica la tarjeta roja de Tokens RED y presiona el botón destacado Aumentar Límite RED.
4. Comprueba que se despliegue el panel de la Bóveda de Garantías mostrando las opciones de monedas de respaldo (USDT, USDC y DAI).
5. Selecciona la opción USDT y escribe un monto de prueba (por ejemplo, 50) en la casilla de monto a depositar.
6. Verifica que la calculadora verde en pantalla actualice inmediatamente el cálculo de tu nuevo límite sumando tu respaldo a tu límite actual.
7. Revisa las 4 tarjetas de estadísticas de actividad blockchain y toca el icono de información en cualquiera de ellas para leer su explicación en lenguaje sencillo.
```

---

```text
TITULO: QA-35 - Monitoreo de Notificaciones y Filtrado por Categorías en Android
DESCRIPCION: Esta misión tiene como objetivo verificar que puedas ingresar al Centro de Notificaciones desde la pantalla principal, revisar tus alertas de recompensas y pagos recibidos, y aplicar los filtros por categoría para encontrar eventos específicos de forma rápida.
PASOS:
2. Abre la aplicación de WintonCoin en tu teléfono e inicia sesión con tu cuenta.
3. En la barra superior de la pantalla de inicio, toca el icono de la campana de notificaciones o presiona la tarjeta Centro de Notificaciones.
4. Verifica que aparezca la lista de tus notificaciones no leídas con sus respectivos iconos de colores según el tipo de mensaje (recompensas, pagos o avisos).
5. Toca los botones de filtro en la parte superior (por ejemplo, Recompensas o Pagos) y confirma que la lista muestre únicamente los mensajes correspondientes a esa categoría.
6. Toca el botón Todas para volver a ver el listado completo de alertas pendientes.
```

---

```text
TITULO: QA-36 - Descarte Individual y Limpieza Total de Notificaciones en Android
DESCRIPCION: Esta prueba asegura que puedas descartar notificaciones individuales con una animación fluida o utilizar el botón de limpieza masiva para marcar todas tus alertas pendientes como leídas y consultar el historial completo.
PASOS:
2. Ingresa al Centro de Notificaciones en la aplicación móvil de WintonCoin.
3. Elige una de las notificaciones pendientes y presiona el botón con forma de equis en la esquina derecha de la tarjeta.
4. Verifica que la notificación desaparezca de pantalla y el contador de alertas pendientes en la barra superior se actualice de inmediato.
5. Presiona el botón Limpiar todo en la esquina superior derecha y confirma que la bandeja se vacíe mostrando el mensaje de que no tienes notificaciones nuevas.
6. Toca la pestaña Historial Completo y comprueba que puedas revisar tus notificaciones anteriores con su fecha y hora de registro.
```

---

```text
TITULO: QA-37 - Postulación de Causa Humanitaria en WintonCoin Solidario desde Android
DESCRIPCION: Esta misión tiene como objetivo comprobar que cualquier persona pueda postular una causa humanitaria desde la aplicación móvil completando el formulario de verificación, adjuntando enlaces de evidencias y enviándola a revisión del equipo de auditoría.
PASOS:
2. Abre la aplicación de WintonCoin en tu teléfono móvil e inicia sesión con tu cuenta.
3. En la pantalla de inicio, presiona la tarjeta destacada que dice WintonCoin Solidario.
4. En la parte inferior de la pantalla, presiona el botón flotante rojo que dice Postular Causa.
5. Verifica que tu nombre de usuario aparezca automáticamente con el mensaje verde de usuario verificado en la base de datos.
6. Escribe el título de tu causa, la historia detallada explicando la situación y la meta requerida en tokens BLUE IOU.
7. Ingresa un enlace de evidencia de prueba en una nube autorizada (por ejemplo, Google Drive o Dropbox) y tus enlaces a redes sociales.
8. Marca la casilla de aceptación de Términos y Condiciones y presiona el botón Enviar para Auditoría.
9. Confirma que aparezca una ventana verde de confirmación indicando que tu postulación fue enviada con éxito.
```

---

```text
TITULO: QA-38 - Exploración de Causas, Donación de Tokens BLUE IOU y Muro de Donantes en Android
DESCRIPCION: Esta prueba asegura que puedas explorar las causas solidarias activas, revisar el progreso de recaudación, donar tus tokens BLUE IOU acumulados y verificar que tu aporte aparezca registrado de inmediato en el muro de donantes.
PASOS:
2. Ingresa a la sección de WintonCoin Solidario desde la pantalla principal de la app móvil.
3. En la pestaña de Causas en Recaudación, presiona cualquiera de las causas humanitarias activas para ver su detalle.
4. Confirma que veas el banner con el distintivo de modo de prueba, el creador de la causa, la historia completa y la barra de progreso de recaudación.
5. Ubica la tarjeta de Realizar Donación y verifica que tu saldo disponible de BLUE IOU se muestre correctamente.
6. Escribe un monto a donar (por ejemplo, 10), marca la casilla de aceptación de términos y presiona el botón Donar BLUE IOU.
7. En la ventana de confirmación, presiona Donar Ahora y verifica que aparezca el aviso de donación exitosa.
8. Revisa la pestaña de Muro de Donantes en la parte inferior y comprueba que tu donación aparezca listada con la etiqueta DONADO y su estado correspondiente.
```

---

```text
TITULO: QA-39 - Censo y Registro de Emergencia para Damnificados en SOS Venezuela desde Android
DESCRIPCION: Esta misión asegura que las personas afectadas por contingencias o desastres puedan registrar su expediente de emergencia desde la aplicación móvil, indicar el nivel de afectación y personas a cargo, verificar su código de 6 dígitos y obtener su número de expediente inteligente.
PASOS:
2. Abre la aplicación móvil de WintonCoin e ingresa a la sección SOS Venezuela desde la pantalla de inicio.
3. Presiona la tarjeta roja de emergencia que dice Soy Afectado / Censo SOS.
4. Completa tus datos personales verificando que la cédula comience con V- y el teléfono incluya el prefijo de Venezuela (+58).
5. Selecciona tu estado, municipio, sector y escribe tu dirección o punto de referencia.
6. Elige el nivel de afectación y ajusta los contadores de menores de edad o adultos mayores a tu cargo.
7. Escribe la descripción de la situación, marca las dos casillas de autorización y presiona el botón Registrar Emergencia Humanitaria.
8. En la ventana que aparece, escribe el código de 6 dígitos enviado a tu correo, define tu contraseña y presiona Activar Cuenta.
9. Confirma que veas tu número de expediente inteligente generado con el formato SOS-VZLA.
```

---

```text
TITULO: QA-40 - Registro y Postulación en Brigadas de Voluntarios SOS desde Android
DESCRIPCION: Esta prueba comprueba que cualquier persona interesada en brindar auxilio humanitario pueda postularse como voluntario en la aplicación móvil seleccionando su especialidad operativa, disponibilidad y completando la activación de su credencial.
PASOS:
2. Ingresa a la sección de SOS Venezuela en la pantalla principal de la aplicación móvil de WintonCoin.
3. Toca la tarjeta azul que dice Quiero ser Voluntario SOS.
4. Llena el formulario con tu nombre, cédula, fecha de nacimiento, correo y número telefónico.
5. Selecciona tu especialidad o rol operativo (por ejemplo, Primeros Auxilios o Logística), tu disponibilidad horaria y modalidad.
6. Describe brevemente tus habilidades o experiencia en el campo de texto.
7. Marca las casillas de consentimiento de datos y código de conducta y presiona el botón Postularme como Voluntario SOS.
8. Ingresa el código de 6 dígitos recibido por correo junto con tu contraseña para activar tu expediente.
9. Verifica que la pantalla te muestre tu número oficial de expediente voluntario con el formato VOL-VZLA.
```

---

```text
TITULO: QA-41 - Activación de Bloqueo Biométrico y Desbloqueo Seguro de la App en Android
DESCRIPCION: Esta misión tiene como objetivo comprobar que puedas activar el bloqueo por huella dactilar o rostro desde la configuración de seguridad y que al salir o volver a abrir la aplicación se muestre la pantalla de bloqueo solicitando tu confirmación biométrica.
PASOS:
2. Abre la aplicación de WintonCoin en tu teléfono móvil e inicia sesión con tu cuenta.
3. En la pantalla de inicio, ubica y presiona la tarjeta que dice Seguridad & Biometría.
4. En la sección de Controles de Protección, activa el interruptor que dice Bloqueo Biométrico de la App.
5. Verifica que aparezca un mensaje verde indicando que el bloqueo biométrico fue activado con éxito.
6. Sal de la aplicación o ciérrala desde la vista de aplicaciones recientes de tu teléfono y vuelve a abrirla.
7. Comprueba que aparezca la pantalla de bloqueo oscuro de WintonCoin con el icono de huella dactilar solicitando tu autenticación.
8. Coloca tu huella dactilar o usa tu rostro y confirma que la aplicación se desbloquee de inmediato llevándote a tu pantalla principal.
```

---

```text
TITULO: QA-42 - Configuración de Autorización Biométrica para Transacciones Financieras en Android
DESCRIPCION: Esta prueba asegura que puedas gestionar la exigencia de huella o rostro para la autorización de transferencias de fondos, donaciones solidarias y operaciones de billetera desde el panel de seguridad de la aplicación.
PASOS:
2. Ingresa a la sección de Seguridad & Biometría desde la pantalla principal de la aplicación móvil.
3. Revisa la tarjeta superior y comprueba que se muestre el estado de tu sensor biométrico en color verde.
4. En el interruptor que dice Autorizar Transacciones, desactívalo y actívalo nuevamente para comprobar la respuesta del sistema.
5. Verifica que cada cambio muestre el aviso de confirmación correspondiente en la parte superior.
6. Lee la sección inferior de Estándares de Ciberseguridad Bancaria y comprueba que se detalle el uso de cifrado seguro por hardware.
7. Presiona el botón de flecha en la esquina superior izquierda para regresar al inicio sin errores.
```

---

```text
TITULO: QA-43 - Exploración del Dashboard y Alternancia de Billetera en la Nueva SPA
DESCRIPCION: Esta misión asegura que puedas ingresar al nuevo panel principal de WintonCoin, consultar tu saldo acumulado de Impulsor en BLUE IOU y alternar instantáneamente hacia tu Billetera Web3 para verificar tu liquidez en tokens BLUE, tu compromiso en tokens RED y copiar tu dirección de billetera con un solo toque.
PASOS:
2. Abre la aplicación de WintonCoin o ingresa desde tu navegador a la pantalla principal del Dashboard.
3. Observa la pestaña de Impulsor seleccionada por defecto y comprueba que se muestre tu Saldo de Impulsor Acumulado en BLUE IOU dentro de la tarjeta morada.
4. Presiona la pestaña Billetera ubicada en el selector superior.
5. Verifica que la pantalla cambie de inmediato mostrando la casilla con tu dirección de billetera y el botón para copiarla.
6. Presiona el botón de copiar y comprueba que aparezca el aviso verde indicando que la dirección fue copiada.
7. Revisa las dos tarjetas inferiores y confirma que veas tu saldo de Liquidez BLUE en azul y tu saldo de Compromiso RED en rojo con su respectivo disponible.
```

---

```text
TITULO: QA-44 - Exploración del Marketplace, Filtros de Publicaciones y Modal de Publicación
DESCRIPCION: Esta prueba busca confirmar que puedas explorar todas las ofertas de servicios y productos disponibles en la plataforma, utilizar los botones de filtro rápido para ver categorías específicas, buscar por palabras clave y abrir la ventana para crear una nueva publicación de forma fluida.
PASOS:
2. Desplázate hacia abajo en el Dashboard hasta llegar a la sección de Publicaciones Activas.
3. Observa las tarjetas de servicios y productos publicadas en el catálogo.
4. Toca los diferentes botones de filtro (Servicios, Productos, Solidario) y comprueba que la lista se actualice al instante mostrando solo los elementos de esa categoría.
5. Escribe una palabra clave en la barra de búsqueda (por ejemplo, Asesoría o Auxilios) y confirma que los resultados se filtren en tiempo real mientras escribes.
6. Presiona el botón azul Crear Nueva Publicación.
7. Comprueba que se abra la ventana emergente con los campos de Título, Categoría, Precio en BLUE y Descripción.
8. Presiona la cruz en la esquina superior para cerrar la ventana sin errores.
```

---

```text
TITULO: QA-45 - Banner de Emergencia Venezuela y Menú de Perfil en Dashboard SPA
DESCRIPCION: Esta misión valida que el banner informativo de emergencia para Venezuela se muestre de manera clara y permita abrir la ventana de causas solidarias, y que el menú desplegable de tu usuario te permita navegar con facilidad hacia tu perfil y cerrar sesión de manera segura.
PASOS:
2. Ubica el banner rojo de Emergencia Venezuela en la parte superior de tu pantalla principal.
3. Presiona el botón blanco que dice Ver Causas y verifica que se abra la ventana explicativa del fondo solidario.
4. Presiona el botón dentro de la ventana para filtrar las causas humanitarias y confirma que el marketplace muestre la categoría solidaria.
5. En la barra superior, toca tu nombre de usuario o avatar circular para desplegar el menú de opciones.
6. Verifica que veas los accesos directos a Mi Perfil, Billetera Web3, Perfil Impulsor e Historial.
7. Toca fuera del menú para cerrarlo y comprueba que la pantalla responda con total fluidez.
```

