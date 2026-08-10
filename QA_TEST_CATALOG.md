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

