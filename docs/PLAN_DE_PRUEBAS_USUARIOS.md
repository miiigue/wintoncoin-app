# Catálogo Extendido de Pruebas Funcionales y de Experiencia de Usuario (WintonCoin Demo)

Este documento reúne la lista de verificación funcional, de seguridad y de experiencia de usuario (UX) para los usuarios y testers en el entorno **Demo** (https://demo.wintoncoin.com).

Está redactado en un lenguaje claro, directo y no técnico bajo la estructura solicitada:
- **Se debe probar:** [Acción o flujo a ejecutar por el usuario]
- **El resultado debe ser:** [Respuesta visual, mensaje o comportamiento esperado del sistema]

---

## Módulo 1: Acceso, Identidad, Sesión y Seguridad Personal (1 al 10)

1. **Se debe probar:** Iniciar sesión con un usuario y contraseña válidos desde un teléfono móvil.
   **El resultado debe ser:** La aplicación muestra un mensaje amigable que dice «Sesión iniciada correctamente.» y redirige de inmediato al panel principal sin demoras ni pantallas en blanco.

2. **Se debe probar:** Intentar iniciar sesión introduciendo una contraseña equivocada deliberadamente.
   **El resultado debe ser:** El sistema muestra una alerta clara indicando que las credenciales no coinciden, sin borrar el nombre de usuario y permitiendo corregir el dato fácilmente.

3. **Se debe probar:** Intentar acceder a la ruta protegida de la billetera o del panel sin haber iniciado sesión previamente.
   **El resultado debe ser:** El sistema bloquea el paso automáticamente y redirige a la pantalla de inicio de sesión con un mensaje explicativo cordial.

4. **Se debe probar:** Presionar el botón de «Cerrar Sesión» desde el menú lateral o el encabezado del panel.
   **El resultado debe ser:** La sesión se cierra de inmediato, se limpian los accesos de la memoria del navegador y el usuario queda en la página de bienvenida.

5. **Se debe probar:** Presionar el botón «Atrás» del navegador del teléfono móvil después de haber cerrado la sesión.
   **El resultado debe ser:** La aplicación no debe reabrir los datos privados ni permitir operaciones; debe mantenerse en la pantalla de acceso.

6. **Se debe probar:** Dejar la aplicación abierta e inactiva durante un período prolongado y luego intentar tocar una opción interna.
   **El resultado debe ser:** Si la sesión ha expirado por seguridad, el sistema solicita ingresar nuevamente sin perder la estabilidad visual ni generar errores técnicos.

7. **Se debe probar:** Abrir la pantalla de Perfil de Usuario y actualizar un dato permitido (como el nombre visible o biografía).
   **El resultado debe ser:** Los cambios se guardan con confirmación inmediata en pantalla y se reflejan al recargar la página.

8. **Se debe probar:** Inspeccionar la sección de Seguridad de la Cuenta en la Billetera.
   **El resultado debe ser:** Se visualizan con claridad los pasos de protección (respaldo de frase, registro de dispositivo biométrico) explicados con palabras sencillas y sin tecnicismos complejos.

9. **Se debe probar:** Consultar la frase de respaldo o verificar las palabras de seguridad en el flujo guiado.
   **El resultado debe ser:** La pantalla muestra casillas claramente numeradas (por ejemplo: palabra 1, 4, 9) y no confunde al gestor de contraseñas del teléfono móvil.

10. **Se debe probar:** Intentar registrar el dispositivo móvil actual utilizando huella digital o FaceID.
    **El resultado debe ser:** El teléfono abre directamente su ventana nativa de biometría y, al colocar la huella o rostro, la aplicación confirma que el dispositivo quedó registrado con éxito.

---

## Módulo 2: Exploración del Catálogo, Búsqueda y Navegación (11 al 20)

11. **Se debe probar:** Escribir en la barra de búsqueda de servicios letra por letra de manera rápida.
    **El resultado debe ser:** El teclado responde con fluidez sin congelarse, y el sistema espera una pequeña fracción de segundo (250 milisegundos) tras dejar de escribir para filtrar los resultados de forma suave.

12. **Se debe probar:** Escribir una palabra que no tenga ninguna coincidencia en el buscador (por ejemplo: «xyz999»).
    **El resultado debe ser:** La pantalla muestra una tarjeta visual amigable explicando que no se encontraron publicaciones y orientando a probar con otros términos o categorías.

13. **Se debe probar:** Borrar todo el contenido de la barra de búsqueda presionando el botón de limpiar o la tecla de borrar.
    **El resultado debe ser:** El catálogo completo de servicios y publicaciones vuelve a aparecer inmediatamente sin demoras.

14. **Se debe probar:** Cambiar entre las diferentes pestañas o filtros de categorías (Servicios, Solicitudes, Donaciones, Ventas Rápidas).
    **El resultado debe ser:** La lista se actualiza al instante mostrando exclusivamente las publicaciones de la categoría seleccionada, resaltando la pestaña activa.

15. **Se debe probar:** Deslizar rápidamente hacia abajo en la pantalla principal (scroll vertical infinito o paginación).
    **El resultado debe ser:** La navegación se mantiene fluida y los elementos cargan progresivamente sin saltos bruscos ni imágenes rotas.

16. **Se debe probar:** Tocar sobre una publicación específica del catálogo para ver su detalle completo.
    **El resultado debe ser:** Se abre una ficha limpia y ordenada donde se lee claramente el título, la descripción, el monto ofrecido o solicitado y el usuario que lo publicó.

17. **Se debe probar:** Presionar el botón de regresar o la flecha de volver desde el detalle de una publicación.
    **El resultado debe ser:** El usuario regresa exactamente al punto donde estaba en el catálogo, manteniendo la posición de la pantalla y los filtros previos.

18. **Se debe probar:** Acceder a la plataforma desde diferentes tamaños de pantalla (teléfono pequeño, teléfono grande, tableta y computador).
    **El resultado debe ser:** El diseño se adapta perfectamente a cada pantalla (diseño responsivo) sin textos cortados ni botones que queden fuera del alcance del dedo.

19. **Se debe probar:** Verificar que en la esquina o encabezado se muestre claramente el indicador de entorno de pruebas.
    **El resultado debe ser:** Aparece de forma discreta pero clara la etiqueta «MODO DEMO», recordando al usuario que opera en un ambiente seguro de pruebas.

20. **Se debe probar:** Intentar abrir una publicación compartida a través de un enlace directo.
    **El resultado debe ser:** La aplicación abre directamente la ficha correspondiente si la publicación existe, o muestra un aviso claro si ya no está disponible.

---

## Módulo 3: Creación de Publicaciones y Restricciones de Prelanzamiento (21 al 28)

21. **Se debe probar:** Tocar el botón de «Publicar Servicio» o «Crear Publicación» estando activo el modo Prelanzamiento.
    **El resultado debe ser:** Se despliega una ventana cordial y explicativa informando que la plataforma está en fase de preparación y prelanzamiento, detallando qué funciones sí están activas para explorar.

22. **Se debe probar:** Cerrar la ventana explicativa de prelanzamiento presionando la «X» o el botón «Entendido».
    **El resultado debe ser:** La ventana se cierra suavemente y el usuario permanece en el catálogo sin pantallas trabadas ni mensajes de error.

23. **Se debe probar:** Intentar enviar un formulario de publicación utilizando atajos de teclado o enter rápido.
    **El resultado debe ser:** El sistema no procesa envíos ocultos durante el prelanzamiento y mantiene la protección de solo lectura de forma consistente.

24. **Se debe probar:** Comprobar que en el estado vacío del catálogo no aparezca un botón que prometa crear publicaciones de inmediato si el prelanzamiento lo impide.
    **El resultado debe ser:** El estado vacío orienta amablemente a explorar categorías o consultar la ayuda, sin invitar a acciones que actualmente estén pausadas.

25. **Se debe probar:** Iniciar sesión con una cuenta autorizada de administración y revisar el estado del interruptor de prelanzamiento en la configuración.
    **El resultado debe ser:** El panel muestra con exactitud si el modo prelanzamiento se encuentra encendido o apagado.

26. **Se debe probar:** Verificar que la interfaz explique brevemente qué es el compromiso RED y qué son los tokens BLUE en los textos de ayuda.
    **El resultado debe ser:** Toda explicación utiliza la terminología oficial: «compromiso RED» (nunca la palabra deuda) y presenta la equivalencia de paridad de forma sencilla.

27. **Se debe probar:** Probar la legibilidad de las letras y colores en modo claro y oscuro o bajo la luz del sol en el celular.
    **El resultado debe ser:** Todos los textos tienen buen contraste, los botones son claramente distinguibles y los iconos se comprenden a primera vista.

28. **Se debe probar:** Presionar repetidas veces y muy rápido (doble o triple toque) el botón de cerrar de cualquier ventana emergente.
    **El resultado debe ser:** La ventana se cierra una sola vez de forma limpia sin generar parpadeos ni errores en el navegador.

---

## Módulo 4: Billetera, Balances y Visualización de Tokens (29 al 36)

29. **Se debe probar:** Abrir la sección de Billetera desde el menú inferior o lateral en el teléfono móvil.
    **El resultado debe ser:** La pantalla carga de inmediato mostrando el saldo disponible en tokens BLUE, el saldo en USDT y el estado de la billetera sin cerrarse.

30. **Se debe probar:** Tocar sobre el botón de «Ver detalles de saldo» o la tarjeta de tokens BLUE.
    **El resultado debe ser:** Se despliega un desglose comprensible que explica cuántos tokens están disponibles para usar y cuántos se encuentran en custodia temporal o parking.

31. **Se debe probar:** Verificar la tarjeta de Compromisos RED en la billetera.
    **El resultado debe ser:** Muestra con total transparencia si el usuario tiene algún compromiso RED pendiente y cómo se amortiza con tokens BLUE, utilizando siempre un tono financiero respetuoso.

32. **Se debe probar:** Tocar el botón de «Recargar saldo» o «Actualizar billetera».
    **El resultado debe ser:** La pantalla consulta los datos más recientes y muestra una animación breve de carga sin congelar la aplicación.

33. **Se debe probar:** Tocar el botón de copiar la dirección pública de la billetera (código que empieza por 0x).
    **El resultado debe ser:** El sistema copia la dirección al portapapeles del teléfono y muestra un aviso flotante breve que dice «Dirección copiada».

34. **Se debe probar:** Abrir la sección de historial de movimientos o transacciones recientes en la billetera.
    **El resultado debe ser:** Aparece la lista ordenada cronológicamente con fecha, concepto amigable, monto y estado de cada movimiento.

35. **Se debe probar:** Revisar un movimiento que haya sido cancelado o rechazado previamente en el historial.
    **El resultado debe ser:** Se identifica claramente con una etiqueta de color neutral (como gris o amarillo) y una breve nota que explica el motivo de manera cordial.

36. **Se debe probar:** Ocultar los saldos en pantalla tocando el icono de privacidad (icono de ojo).
    **El resultado debe ser:** Los números de saldo se reemplazan por asteriscos para mayor discreción al usar el teléfono en público, y al volver a tocar se muestran de nuevo.

---

## Módulo 5: Interacción Multiusuario y Solicitud de Servicios (37 al 44)

37. **Se debe probar:** Que el Usuario 1 abra la publicación de un servicio ofrecido por el Usuario 2 y presione «Solicitar Servicio».
    **El resultado debe ser:** Se abre un formulario claro donde se puede escribir un mensaje privado para el prestador y acordar los detalles.

38. **Se debe probar:** Que el Usuario 1 presione dos veces seguidas muy rápido (doble clic) el botón de enviar solicitud.
    **El resultado debe ser:** El sistema desactiva el botón tras el primer toque y registra exactamente una sola solicitud, evitando duplicados.

39. **Se debe probar:** Que el Usuario 2 ingrese a su cuenta y revise su bandeja de solicitudes entrantes.
    **El resultado debe ser:** Encuentra la solicitud enviada por el Usuario 1 con la fecha exacta, el mensaje y los botones claros para «Aceptar» o «Rechazar».

40. **Se debe probar:** Que el Usuario 2 presione «Rechazar» con un motivo breve.
    **El resultado debe ser:** La solicitud cambia a estado finalizado/rechazado y el Usuario 1 recibe la actualización correspondiente sin bloqueos.

41. **Se debe probar:** Que el Usuario 2 presione «Aceptar» en una solicitud de servicio.
    **El resultado debe ser:** El servicio pasa a estado «En curso» y ambos usuarios ven claramente los siguientes pasos a seguir para la entrega del trabajo.

42. **Se debe probar:** Que el Usuario 1 y el Usuario 2 mantengan sesiones abiertas en diferentes pestañas del navegador o diferentes teléfonos al mismo tiempo.
    **El resultado debe ser:** Cada usuario ve exclusivamente sus propios datos privados sin que se cruce la información entre sesiones.

43. **Se debe probar:** Intentar ver los datos privados de una solicitud ajena modificando directamente la dirección web en el navegador.
    **El resultado debe ser:** El sistema bloquea el acceso por seguridad y muestra un mensaje indicando que no se tienen permisos para consultar esa información.

44. **Se debe probar:** Que el prestador marque el servicio como «Trabajo Entregado».
    **El resultado debe ser:** La interfaz cambia a «Pendiente de Aprobación del Cliente» y notifica al solicitante para que revise el trabajo.

---

## Módulo 6: Protección Económica, Contención y Notificaciones (45 al 50)

45. **Se debe probar:** Intentar confirmar un pago de servicio con tokens mientras el modo Prelanzamiento está activo.
    **El resultado debe ser:** El sistema detiene la operación de forma segura antes de enviar cualquier dato a la blockchain y muestra un mensaje explicativo cordial: «La plataforma se encuentra en fase de prelanzamiento; las operaciones de pago están en pausa temporal».

46. **Se debe probar:** Comprobar los balances de la billetera tras haber intentado un pago bloqueado por prelanzamiento.
    **El resultado debe ser:** Los saldos permanecen exactamente iguales, sin cobro de comisiones ni movimientos no deseados.

47. **Se debe probar:** Revisar la campana o centro de notificaciones tras recibir una respuesta de otro usuario.
    **El resultado debe ser:** Se muestra un círculo con el número de avisos nuevos y, al abrirlo, se lee el resumen del mensaje de forma clara y directa.

48. **Se debe probar:** Tocar una notificación específica del listado.
    **El resultado debe ser:** Lleva directamente a la pantalla o solicitud relacionada y marca la notificación como leída.

49. **Se debe probar:** Desconectar la conexión a internet (modo avión o apagar wifi) mientras se navega en la aplicación.
    **El resultado debe ser:** La aplicación muestra un aviso discreto indicando que se ha perdido la conexión a internet y ofreciendo un botón para reintentar cuando regrese la señal.

50. **Se debe probar:** Reactivar el internet y presionar el botón de reintentar tras la pérdida de señal.
    **El resultado debe ser:** La aplicación recupera la conexión de inmediato y actualiza los datos en pantalla sin necesidad de cerrar el navegador.

---
*Documento dinámico para testers y usuarios del entorno Demo de WintonCoin.*