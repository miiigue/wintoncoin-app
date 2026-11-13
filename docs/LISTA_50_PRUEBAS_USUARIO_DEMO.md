# Catálogo Maestro de 50 Pruebas Funcionales y de Experiencia de Usuario (WintonCoin Demo)

Este documento contiene la lista oficial y estructurada de 50 actividades de prueba que cualquier tester o usuario puede ejecutar desde su teléfono móvil o navegador web en el entorno **Demo** (`demo.wintoncoin.com`).

Ha sido redactado en un lenguaje **100% cotidiano, amigable y libre de tecnicismos complejos**, siguiendo el formato estricto solicitado:
- **Se debe probar:** [Acción que realiza el usuario]
- **El resultado debe ser:** [Lo que debe ocurrir en la pantalla]

---

## Módulo 1: Acceso, Registro y Seguridad de Cuenta (Identidad)

### Actividad 1:
- **Se debe probar:** Iniciar sesión con nombre de usuario y contraseña correctos.
- **El resultado debe ser:** El sistema muestra un mensaje verde y breve que dice "Sesión iniciada correctamente." y te dirige de inmediato al panel principal.

### Actividad 2:
- **Se debe probar:** Intentar iniciar sesión con una contraseña incorrecta.
- **El resultado debe ser:** Aparece un mensaje de error claro indicando que los datos no coinciden, sin borrar tu nombre de usuario ni recargar toda la pantalla.

### Actividad 3:
- **Se debe probar:** Registrar un nuevo usuario completando todos los campos requeridos con datos válidos.
- **El resultado debe ser:** La cuenta se crea exitosamente y la aplicación te muestra la pantalla de bienvenida o el paso para proteger tu billetera.

### Actividad 4:
- **Se debe probar:** Intentar registrar una cuenta usando un nombre de usuario que ya existe.
- **El resultado debe ser:** El sistema te avisa amablemente que ese nombre ya está ocupado y te sugiere elegir uno diferente.

### Actividad 5:
- **Se debe probar:** Cerrar sesión desde el menú de opciones del usuario.
- **El resultado debe ser:** La sesión se cierra al instante, la pantalla regresa a la portada y ya no es posible ver datos privados sin volver a ingresar.

### Actividad 6:
- **Se debe probar:** Presionar el botón de retroceso del teléfono inmediatamente después de haber cerrado sesión.
- **El resultado debe ser:** La aplicación no te permite volver al panel privado y te mantiene de forma segura en la pantalla de bienvenida o login.

### Actividad 7:
- **Se debe probar:** Ingresar a la sección de Perfil y actualizar tu información básica (nombre o descripción).
- **El resultado debe ser:** Los cambios se guardan correctamente y se muestra una confirmación breve indicando que el perfil ha sido actualizado.

### Actividad 8:
- **Se debe probar:** Visualizar la llave maestra de 12 palabras de respaldo en la sección de seguridad.
- **El resultado debe ser:** Las palabras se muestran ordenadas y numeradas del 1 al 12, con la advertencia clara de anotarlas en un lugar seguro y privado.

### Actividad 9:
- **Se debe probar:** Completar la verificación de 3 palabras aleatorias para confirmar el respaldo.
- **El resultado debe ser:** El sistema valida las palabras ingresadas, avanza la barra de progreso al siguiente paso y no muestra diálogos molestos de contraseñas.

### Actividad 10:
- **Se debe probar:** Registrar la biometría (huella dactilar o FaceID) desde un teléfono compatible.
- **El resultado debe ser:** El navegador solicita el permiso biométrico nativo y, al confirmarlo, la billetera queda vinculada a tu dispositivo con éxito.

---

## Módulo 2: Navegación, Catálogo de Servicios y Búsqueda Ágil

### Actividad 11:
- **Se debe probar:** Entrar a la pantalla de servicios o catálogo desde el menú principal.
- **El resultado debe ser:** La lista de publicaciones carga con fluidez mostrando títulos, imágenes o iconos, y detalles de manera ordenada.

### Actividad 12:
- **Se debe probar:** Escribir una palabra en la barra de búsqueda de servicios (ejemplo: soporte o diseño).
- **El resultado debe ser:** La búsqueda responde con una suave pausa de 250 milisegundos tras escribir, actualizando los resultados sin congelar la pantalla.

### Actividad 13:
- **Se debe probar:** Borrar rápidamente el texto de la barra de búsqueda tocando el botón de limpiar o borrando las letras.
- **El resultado debe ser:** El catálogo completo vuelve a desplegarse de manera inmediata sin demoras.

### Actividad 14:
- **Se debe probar:** Buscar una palabra que no coincida con ningún servicio existente (ejemplo: xyz999).
- **El resultado debe ser:** Aparece una tarjeta amigable explicando que no se encontraron resultados y sugiriendo revisar otras categorías o términos.

### Actividad 15:
- **Se debe probar:** Filtrar las publicaciones tocando una categoría específica (ejemplo: Tecnología o Educación).
- **El resultado debe ser:** La lista muestra únicamente los servicios que pertenecen a la categoría elegida de forma instantánea.

### Actividad 16:
- **Se debe probar:** Tocar una publicación del catálogo para ver su detalle completo.
- **El resultado debe ser:** Se abre la ficha del servicio mostrando la descripción completa, el creador, la fecha y los detalles sin errores visuales.

### Actividad 17:
- **Se debe probar:** Deslizar la pantalla hacia abajo para actualizar la lista de servicios (Pull to refresh).
- **El resultado debe ser:** Aparece un indicador de carga momentáneo y el contenido se refresca limpiamente sin duplicar tarjetas.

### Actividad 18:
- **Se debe probar:** Navegar por el menú lateral o inferior en un teléfono con pantalla pequeña.
- **El resultado debe ser:** Todos los botones son cómodos de presionar con el pulgar, el texto no se corta y el diseño se adapta de forma 100% responsiva.

### Actividad 19:
- **Se debe probar:** Probar el botón flotante de Volver Arriba tras deslizar varias pantallas hacia abajo.
- **El resultado debe ser:** Al tocarlo, la pantalla sube suavemente hasta el inicio del catálogo.

### Actividad 20:
- **Se debe probar:** Abrir la plataforma con el teléfono en modo horizontal (apaisado).
- **El resultado debe ser:** Las tarjetas y menús se reordenan armónicamente sin salirse de los bordes ni esconder elementos importantes.

---

## Módulo 3: Fase de Prelanzamiento, Mensajes y Restricciones Cordiales

### Actividad 21:
- **Se debe probar:** Presionar el botón de Publicar Servicio o Crear Publicación durante el prelanzamiento.
- **El resultado debe ser:** Se despliega una ventana amigable explicando que la plataforma está en fase de preparación y orientando sobre las opciones activas.

### Actividad 22:
- **Se debe probar:** Cerrar la ventana informativa de prelanzamiento.
- **El resultado debe ser:** La ventana se cierra suavemente y el usuario permanece en el catálogo sin pantallas bloqueadas ni bloqueos de botones.

### Actividad 23:
- **Se debe probar:** Intentar acceder directamente escribiendo la dirección web de creación de publicación en la barra del navegador.
- **El resultado debe ser:** El sistema redirige de forma segura al catálogo o panel con un mensaje informativo claro.

### Actividad 24:
- **Se debe probar:** Verificar la insignia o etiqueta de DEMO MODE en la parte superior de la página.
- **El resultado debe ser:** La etiqueta es visible para dar total tranquilidad de que se está operando en un ambiente de prueba y aprendizaje.

### Actividad 25:
- **Se debe probar:** Revisar la sección de preguntas frecuentes o ayuda sobre la fase de prelanzamiento.
- **El resultado debe ser:** Las explicaciones son sencillas, sin lenguaje bancario ni tecnicismos confusos, facilitando el entendimiento a cualquier persona.

### Actividad 26:
- **Se debe probar:** Intentar solicitar la contratación de un servicio durante el prelanzamiento.
- **El resultado debe ser:** El sistema notifica con cortesía que los acuerdos y pagos se activarán formalmente al culminar la etapa de prelanzamiento.

### Actividad 27:
- **Se debe probar:** Hacer clic repetido muy rápido en un botón informativo.
- **El resultado debe ser:** El sistema no se congela ni abre ventanas duplicadas; responde de manera fluida y protegida.

### Actividad 28:
- **Se debe probar:** Ingresar con una cuenta con perfil de usuario común y comprobar qué menús están disponibles.
- **El resultado debe ser:** Solo se visualizan las secciones públicas y personales de usuario, sin acceso a configuraciones de administración.

### Actividad 29:
- **Se debe probar:** Recargar la página web mientras se visualiza una ventana emergente o modal.
- **El resultado debe ser:** La pantalla vuelve a cargar en un estado limpio y estable, permitiendo al usuario continuar su navegación sin inconvenientes.

### Actividad 30:
- **Se debe probar:** Verificar que ningún término confuso o alarmante como "deuda" aparezca en las pantallas.
- **El resultado debe ser:** La aplicación utiliza siempre términos constructivos y claros como "Compromiso RED", respetando la filosofía del protocolo.

---

## Módulo 4: Billetera, Balances y Visualización Financiera

### Actividad 31:
- **Se debe probar:** Entrar a la pantalla de la Billetera desde el menú principal.
- **El resultado debe ser:** La pantalla carga de inmediato mostrando de forma protagónica el Saldo Total BLUE, los balances y tu dirección de cuenta.

### Actividad 32:
- **Se debe probar:** Verificar la visualización de la tarjeta de USDT en la billetera.
- **El resultado debe ser:** Se muestra claramente el saldo de USDT disponible con su icono distintivo y formato numérico fácil de leer.

### Actividad 33:
- **Se debe probar:** Verificar la visualización del saldo en tokens BLUE y el balance de Compromisos RED.
- **El resultado debe ser:** Ambos valores se muestran con claridad, permitiendo al usuario entender su balance disponible y sus compromisos asumidos.

### Actividad 34:
- **Se debe probar:** Tocar el botón de Copiar Dirección de billetera.
- **El resultado debe ser:** Aparece una confirmación rápida tipo toast indicando "¡Dirección copiada al portapapeles!" y el texto queda listo para pegar.

### Actividad 35:
- **Se debe probar:** Tocar el botón de Enviar USDT en la billetera.
- **El resultado debe ser:** Se abre la ventana para ingresar el destinatario y el monto, con validaciones claras y botón de cancelar accesible.

### Actividad 36:
- **Se debe probar:** Ingresar un monto superior al saldo disponible en la ventana de envío.
- **El resultado debe ser:** El campo marca en color suave que los fondos son insuficientes y el botón de confirmación permanece inactivo para evitar errores.

### Actividad 37:
- **Se debe probar:** Consultar el historial de movimientos o transacciones recientes en la billetera.
- **El resultado debe ser:** La lista detalla cada operación con su fecha, tipo de movimiento y monto de forma cronológica y comprensible.

### Actividad 38:
- **Se debe probar:** Ocultar los saldos en pantalla tocando el icono de ojo (Modo Privacidad).
- **El resultado debe ser:** Los números se reemplazan por asteriscos para que nadie a tu alrededor pueda ver tus saldos en lugares públicos.

### Actividad 39:
- **Se debe probar:** Volver a presionar el icono de ojo para mostrar los saldos.
- **El resultado debe ser:** Los montos numéricos vuelven a hacerse visibles con total exactitud.

### Actividad 40:
- **Se debe probar:** Revisar la pantalla de Billetera en un teléfono con conexión de datos móviles lenta.
- **El resultado debe ser:** Los elementos muestran indicadores de carga suaves sin saltos bruscos ni pantallas en negro mientras cargan los datos.

---

## Módulo 5: Recuperación, Concurrencia Multiusuario y Resiliencia Móvil

### Actividad 41:
- **Se debe probar:** Acceder a la pantalla de Recuperación desde el enlace en el menú lateral o inferior.
- **El resultado debe ser:** Se abre la pantalla oficial de recuperación explicando con un ejemplo cotidiano cuándo es necesario usar el reemplazo de dispositivo.

### Actividad 42:
- **Se debe probar:** Probar el formulario de reanudación con las 12 palabras de respaldo.
- **El resultado debe ser:** Los campos de entrada orientan con claridad qué casillas deben llenarse y no activan alertas confusas del gestor de contraseñas.

### Actividad 43:
- **Se debe probar:** Escribir una palabra con un espacio accidental al final en el formulario de recuperación.
- **El resultado debe ser:** El sistema limpia automáticamente los espacios en blanco sin marcar la palabra como inválida injustamente.

### Actividad 44:
- **Se debe probar:** Verificar la campana o centro de notificaciones en la barra superior.
- **El resultado debe ser:** Muestra las alertas y novedades recientes del usuario, con opción de marcarlas como leídas.

### Actividad 45:
- **Se debe probar:** Iniciar sesión con una segunda cuenta de prueba en una ventana de incógnito o en un segundo teléfono.
- **El resultado debe ser:** Ambas sesiones operan con total independencia; ninguna cuenta visualiza ni interfiere con los datos de la otra.

### Actividad 46:
- **Se debe probar:** Simular la pérdida temporal de conexión a internet (modo avión) y volver a conectarse.
- **El resultado debe ser:** La plataforma muestra un aviso amigable de que no hay internet y se recupera automáticamente apenas regresa la señal.

### Actividad 47:
- **Se debe probar:** Probar el cambio de idioma o formatos de fecha si están disponibles en la interfaz.
- **El resultado debe ser:** Las fechas y textos se presentan en un español amigable, natural y acorde al uso común de los usuarios.

### Actividad 48:
- **Se debe probar:** Revisar los términos de servicio y el aviso de privacidad desde el pie de página.
- **El resultado debe ser:** Los documentos abren correctamente en una vista legible con tipografía clara y adaptada a la pantalla del celular.

### Actividad 49:
- **Se debe probar:** Verificar la opción de soporte o contacto desde el panel del usuario.
- **El resultado debe ser:** El usuario encuentra un canal directo y comprensible para reportar dudas o enviar comentarios sobre su experiencia.

### Actividad 50:
- **Se debe probar:** Cerrar la aplicación, esperar varios minutos y volver a abrir la dirección web demo.wintoncoin.com.
- **El resultado debe ser:** La aplicación mantiene tu sesión de forma segura si no cerraste sesión, o te invita cordialmente a ingresar sin errores.

---

## Guía Rápida para el Usuario Tester

Cuando pruebes una actividad en tu teléfono móvil y notes que algo no funciona como dice "El resultado debe ser", simplemente anota:
1. **Número de la actividad** (ej. Actividad 12).
2. **Tu modelo de celular y navegador** (ej. Samsung Galaxy A52 / Chrome).
3. **Lo que viste en tu pantalla** (ej. "La búsqueda tardó más de 3 segundos" o "El botón no respondió al toque").

