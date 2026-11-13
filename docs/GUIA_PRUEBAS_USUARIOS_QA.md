# Guía Maestra y Catálogo Continuo de Pruebas para Usuarios y Testers (Entorno Demo)

**Plataforma de pruebas:** [https://demo.wintoncoin.com](https://demo.wintoncoin.com)  
**Objetivo:** Guía práctica para que usuarios y testers evalúen la experiencia, fluidez, seguridad y claridad de la plataforma desde sus teléfonos móviles o computadoras sin tecnicismos complejos.

---

## Módulo 1: Acceso, Inicio de Sesión y Seguridad de Cuenta

1. **Se debe probar:** Ingresar a la plataforma con usuario y contraseña correctos.  
   **El resultado debe ser:** Mostrar el mensaje *"Sesión iniciada correctamente."* y entrar directo al panel principal sin pantallas en blanco.

2. **Se debe probar:** Intentar iniciar sesión escribiendo una contraseña equivocada a propósito.  
   **El resultado debe ser:** Mostrar un aviso en rojo claro indicando que los datos no coinciden, sin revelar detalles técnicos ni bloquear la pantalla.

3. **Se debe probar:** Intentar entrar dejando los campos de usuario y contraseña completamente vacíos.  
   **El resultado debe ser:** Marcar los campos en rojo pidiendo completarlos antes de enviar la solicitud.

4. **Se debe probar:** Iniciar sesión y presionar el botón de "Cerrar sesión" en el menú.  
   **El resultado debe ser:** Salir de la cuenta de inmediato, borrar los datos de la sesión y volver a la pantalla de bienvenida.

5. **Se debe probar:** Presionar el botón "Atrás" del navegador del teléfono después de haber cerrado sesión.  
   **El resultado debe ser:** Mantenerte fuera de la cuenta sin permitir volver a ver datos privados del usuario.

6. **Se debe probar:** Abrir la opción de "Ver mi Perfil" desde el menú superior.  
   **El resultado debe ser:** Cargar tu nombre de usuario, fecha de ingreso y estado de cuenta de forma ordenada y legible.

7. **Se debe probar:** Editar la información pública del perfil (como tu descripción o biografía) y guardar.  
   **El resultado debe ser:** Guardar los cambios al instante y mostrar un aviso de confirmación verde y amigable.

8. **Se debe probar:** Iniciar sesión con la misma cuenta en dos pestañas diferentes del teléfono.  
   **El resultado debe ser:** Permitir ver tu información en ambas pestañas sin cruzar datos con otros usuarios ni desconfigurar la vista.

---

## Módulo 2: Exploración, Búsqueda y Catálogo de Servicios

9. **Se debe probar:** Abrir la pantalla principal de publicaciones y catálogo de servicios.  
   **El resultado debe ser:** Ver la lista de servicios con sus tarjetas bien alineadas, fotos nítidas y textos sin cortes en la pantalla del celular.

10. **Se debe probar:** Escribir en la barra de búsqueda una palabra clave (ejemplo: "diseño" o "soporte").  
    **El resultado debe ser:** Esperar una fracción de segundo (*debounce*) y filtrar la lista suavemente sin que la pantalla se congele.

11. **Se debe probar:** Escribir en el buscador una palabra inventada que no exista (ejemplo: "xyz999").  
    **El resultado debe ser:** Mostrar una tarjeta limpia y cordial explicando que no hay resultados y sugiriendo revisar otras categorías.

12. **Se debe probar:** Tocar la cruz o botón de borrar en la barra de búsqueda.  
    **El resultado debe ser:** Limpiar el texto al instante y restaurar el catálogo completo de publicaciones de inmediato.

13. **Se debe probar:** Tocar los diferentes filtros de categoría (Servicios, Donaciones, Ventas Rápidas).  
    **El resultado debe ser:** Cambiar entre pestañas de manera fluida mostrando solo lo correspondiente a cada sección.

14. **Se debe probar:** Abrir la ficha de detalle de un servicio publicado tocando sobre su tarjeta.  
    **El resultado debe ser:** Desplegar la pantalla con la descripción completa, el precio en tokens BLUE y el nombre del prestador.

15. **Se debe probar:** Regresar desde la ficha del servicio a la lista principal tocando la flecha volver.  
    **El resultado debe ser:** Regresar a la misma posición del catálogo donde estabas, sin reiniciar la página.

16. **Se debe probar:** Deslizar rápidamente hacia abajo (scroll infinito) en la lista de publicaciones.  
    **El resultado debe ser:** Cargar más elementos fluidamente sin saltos bruscos ni trabar el navegador del teléfono.

17. **Se debe probar:** Cambiar el teléfono de posición vertical a horizontal mientras miras el catálogo.  
    **El resultado debe ser:** Adaptar las tarjetas al ancho de la pantalla sin deformar las imágenes ni desbordar los textos.

---

## Módulo 3: Fase de Prelanzamiento y Protección de Creación

18. **Se debe probar:** Presionar el botón "+ Publicar Servicio" o "+ Crear Publicación".  
    **El resultado debe ser:** Abrir una ventana explicativa amigable indicando que la plataforma está en prelanzamiento y no se pueden crear publicaciones por ahora.

19. **Se debe probar:** Leer el texto completo de la ventana de aviso de prelanzamiento.  
    **El resultado debe ser:** Comprobar que el mensaje sea cordial, sin palabras técnicas confusas, sin promesas falsas y explicando qué sí puedes explorar.

20. **Se debe probar:** Tocar el botón "Entendido" o la cruz para cerrar el aviso de prelanzamiento.  
    **El resultado debe ser:** Cerrar la ventana al instante y dejar la pantalla limpia sin errores ni pantallas bloqueadas.

21. **Se debe probar:** Intentar presionar repetidas veces y muy rápido el botón de publicar.  
    **El resultado debe ser:** Responder ordenadamente abriendo una sola ventana, sin duplicar avisos ni congelar el teléfono.

22. **Se debe probar:** Abrir la sección de preguntas frecuentes o ayuda durante el prelanzamiento.  
    **El resultado debe ser:** Mostrar respuestas claras y comprensibles sobre cómo funcionará la plataforma al abrirse.

23. **Se debe probar:** Comprobar que en la parte superior aparezca el distintivo que identifica que estamos en entorno Demo.  
    **El resultado debe ser:** Ver la etiqueta clara de modo de pruebas para que el usuario siempre tenga certeza de dónde está operando.

---

## Módulo 4: Billetera, Saldos y Visualización de Tokens

24. **Se debe probar:** Ingresar a la sección "Billetera" desde el menú principal.  
    **El resultado debe ser:** Mostrar la pantalla de billetera con el saldo total en tokens BLUE y saldo USDT de forma nítida.

25. **Se debe probar:** Tocar el botón de "Ocultar/Mostrar saldo" (el icono del ojo).  
    **El resultado debe ser:** Reemplazar los números por asteriscos para mayor privacidad en lugares públicos y volver a mostrarlos al tocarlo de nuevo.

26. **Se debe probar:** Revisar la sección de "Compromiso RED" en la billetera.  
    **El resultado debe ser:** Explicar con un texto claro y sin tecnicismos el concepto de compromiso RED y mostrar el balance correspondiente.

27. **Se debe probar:** Tocar el botón de "Copiar mi dirección de billetera".  
    **El resultado debe ser:** Copiar la dirección al portapapeles y mostrar un aviso breve diciendo *"Dirección copiada"*.

28. **Se debe probar:** Revisar el historial de movimientos o transacciones recientes dentro de la billetera.  
    **El resultado debe ser:** Mostrar la lista de movimientos pasados con su fecha, tipo de token y estado (completado o en espera).

29. **Se debe probar:** Presionar el botón "Recargar saldo" o "Actualizar balances".  
    **El resultado debe ser:** Actualizar los números en pantalla de forma suave mostrando una pequeña rueda de carga que desaparece rápido.

30. **Se debe probar:** Tocar el botón "Enviar USDT" para ver la ventana de transferencia.  
    **El resultado debe ser:** Abrir la ventana para ingresar destinatario y monto de forma limpia y comprensible.

31. **Se debe probar:** Tocar el botón de cancelar dentro de la ventana de envío de USDT.  
    **El resultado debe ser:** Cerrar la ventana de inmediato y volver a la billetera sin descontar ningún saldo.

32. **Se debe probar:** Abrir la sección de "Tokens en Parking" (fondos retenidos temporalmente por servicios en curso).  
    **El resultado debe ser:** Mostrar los tokens que están bajo custodia protegida con una explicación de por qué están en espera.

---

## Módulo 5: Respaldo, Clave Maestra y Seguridad de Dispositivo

33. **Se debe probar:** Entrar a la sección de "Seguridad y Recuperación" desde el menú.  
    **El resultado debe ser:** Mostrar los pasos de protección de tu cuenta (frase de 12 palabras y dispositivo registrado) de forma numerada e intuitiva.

34. **Se debe probar:** Leer las explicaciones y analogías de la llave de 12 palabras.  
    **El resultado debe ser:** Comprobar que explica la frase de respaldo comparándola con la llave de repuesto de una casa de manera muy fácil de entender.

35. **Se debe probar:** Tocar la opción de "Mostrar/Ocultar" las palabras escritas al verificar el respaldo.  
    **El resultado debe ser:** Alternar entre ver el texto claro o en puntos sin bloquear la escritura del teclado.

36. **Se debe probar:** Comprobar que el gestor de contraseñas de Google no salte encima tapando las casillas de las 12 palabras.  
    **El resultado debe ser:** Poder escribir tranquilamente en cada casilla sin que aparezca el molesto cartel de "¿Guardar contraseña?".

37. **Se debe probar:** Tocar el botón para "Registrar mi dispositivo" (acceso biométrico con huella o FaceID).  
    **El resultado debe ser:** Responder al instante al toque abriendo el lector de huella/rostro nativo de tu teléfono.

38. **Se debe probar:** Cancelar el lector de huella en el teléfono tocando afuera o cancelar.  
    **El resultado debe ser:** Regresar a la pantalla de seguridad con un mensaje amable que te permita volver a intentar cuando desees.

39. **Se debe probar:** Comprobar el indicador visual de progreso de los 4 pasos de seguridad.  
    **El resultado debe ser:** Marcar claramente en qué paso estás (1, 2, 3 o 4) con colores diferenciados.

---

## Módulo 6: Notificaciones, Mensajes y Navegación Móvil

40. **Se debe probar:** Tocar el icono de la campana de notificaciones en la parte superior.  
    **El resultado debe ser:** Abrir la bandeja de avisos mostrando los mensajes nuevos ordenados por fecha y hora.

41. **Se debe probar:** Marcar una notificación como leída.  
    **El resultado debe ser:** Cambiar el aspecto visual de la notificación (atenuar el color) y disminuir el contador de no leídas.

42. **Se debe probar:** Abrir el menú lateral desplegable en el teléfono (menú hamburguesa de tres rayas).  
    **El resultado debe ser:** Deslizarse con suavidad desde el costado cubriendo ordenadamente la pantalla sin trabarse.

43. **Se debe probar:** Tocar cualquier opción del menú lateral (por ejemplo: Inicio, Catálogo, Billetera).  
    **El resultado debe ser:** Llevarte a la sección elegida y cerrar automáticamente el menú lateral para dejar la pantalla libre.

44. **Se debe probar:** Tocar fuera del menú lateral en el área oscura de fondo.  
    **El resultado debe ser:** Cerrar el menú lateral de inmediato y regresar a lo que estabas viendo.

45. **Se debe probar:** Subir o bajar el tamaño del texto desde la configuración de accesibilidad de tu teléfono.  
    **El resultado debe ser:** Que los textos de la plataforma sigan siendo legibles y los botones no se corten ni se monten uno sobre otro.

---

## Módulo 7: Conexión, Fallas de Red y Comportamiento Inesperado

46. **Se debe probar:** Poner el teléfono en Modo Avión durante 3 segundos mientras navegas y volver a encender los datos.  
    **El resultado debe ser:** Mostrar un aviso discreto de *"Sin conexión, reconectando..."* y recuperar la información automáticamente al volver el internet.

47. **Se debe probar:** Presionar el botón de recargar la página (F5 o deslizar hacia abajo en el navegador) en cualquier pantalla.  
    **El resultado debe ser:** Volver a cargar la misma pantalla donde estabas sin perder la sesión iniciada ni mostrar errores.

48. **Se debe probar:** Abrir un enlace de la plataforma que esté mal escrito a propósito (ejemplo: `demo.wintoncoin.com/pagina-inexistente`).  
    **El resultado debe ser:** Mostrar una pantalla amigable de "Página no encontrada" con un botón verde que te devuelva al Inicio.

49. **Se debe probar:** Dejar la aplicación abierta sin tocar la pantalla durante 15 minutos y volver a tocar una opción.  
    **El resultado debe ser:** Responder con normalidad o solicitar renovar la sesión de forma segura sin congelar el navegador.

50. **Se debe probar:** Tocar el botón flotante "Volver Arriba" después de haber bajado mucho en una lista.  
    **El resultado debe ser:** Subir la pantalla suavemente hasta el inicio con un desplazamiento fluido y agradable.

