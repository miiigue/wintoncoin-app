# Matriz ejecutable — Bloque A no económico de WintonCoin Demo

Estado: **preparada, todavía no ejecutada**.  
Ambiente autorizado: `https://demo.wintoncoin.com`, exclusivamente Demo.  
Versión contrastada: rama `demo`, commit `19aafcf` (6 de noviembre de 2026).  
Alcance: interfaz pública, identidad, sesiones, navegación, permisos, mensajes de Prelanzamiento y consultas de solo lectura.  
Fuera de alcance: crear cuentas, aceptar nuevos documentos, cambiar contraseñas, publicar, contratar, pagar, transferir, emitir o quemar tokens, usar fondos, firmar, transmitir o simular transacciones blockchain y cualquier acción en producción.

## Preparación y cuentas

Usar las cuatro cuentas ficticias normales ya creadas como `QA-01`, `QA-02`, `QA-03` y `QA-04`, sin escribir usuarios, correos, teléfonos ni contraseñas en esta matriz o en las evidencias. Por decisión de Miguel se conservan sus contraseñas actuales; por ello este bloque **no valida robustez de credenciales**. Cada cuenta debe abrirse en un contexto aislado: navegador, perfil o ventana privada diferente.

Antes de comenzar, registrar sin datos personales: fecha/hora, navegador, versión, dispositivo, tamaño de pantalla, cuenta QA usada, URL, `19aafcf` como versión esperada y el estado observado de Prelanzamiento. Las capturas deben ocultar tokens de sesión, direcciones completas, correos, teléfonos, códigos, frases de respaldo y cualquier dato que no sea necesario para reproducir un defecto.

El Exchange depende del indexador. Mientras `/api/web3/exchange-queue` no sostenga `ready` y `usable=true`, los casos marcados **INDEXADOR** quedan aplazados; un `503`, `syncing`, `usable=false` es contención esperada y no autorización para forzar la operación.

**Estado del indexador al 6 de noviembre de 2026:** tres observaciones consecutivas de solo lectura respondieron HTTP 200, `status=ready` y `usable=true` para la época `V5_CODEX_163`, sin órdenes activas. Los casos de consulta marcados **INDEXADOR** pueden ejecutarse; las escrituras económicas continúan prohibidas por Prelanzamiento.

## Criterios globales de parada

Detener todo el bloque y avisar al coordinador si se observa cualquiera de estos hechos: desaparece la marca de Demo; Prelanzamiento aparece desactivado; la aplicación invita a confirmar un pago o una firma; aparece una billetera solicitando aprobar una transacción; cambia un saldo; se cruzan datos entre cuentas; un usuario normal ve funciones administrativas; se expone un secreto o dato personal; una pantalla informa que la blockchain está universalmente pausada cuando algún contrato figura sin pausa; o se accede por error a producción.

No contar estas cuentas como usuarios adquiridos, personas verificadas, actividad comercial ni métricas de crecimiento.

## Casos públicos — sin sesión

### A-PUB-01 — Portada Demo identificable

ROL/CUENTA: Visitante, sin sesión.  
PRECONDICIÓN: Navegador nuevo, sin datos del sitio.  
DEPENDENCIA: Ninguna.  
EVIDENCIA: Captura completa de la portada con URL y distintivo Demo visibles.  
SEVERIDAD SI FALLA: ALTA.  
CRITERIO DE PARADA: La URL o el contenido corresponde a producción, o no existe una identificación visible de Demo.

```text
TITULO: Confirmar que estás en la versión Demo
DESCRIPCION: Abre la portada de WintonCoin Demo y confirma que carga completa, que se identifica como entorno de prueba y que los accesos principales no llevan a una página en blanco.
PASOS:
2. Abre https://demo.wintoncoin.com en una ventana nueva.
3. Confirma que ves la marca DEMO MODE y que la dirección sigue perteneciendo a demo.wintoncoin.com.
4. Revisa que sean visibles los accesos para iniciar sesión y registrarse, sin presionarlos todavía.
5. Guarda una captura donde aparezcan la dirección y la marca de Demo.
```

### A-PUB-02 — Navegación a Login y regreso

ROL/CUENTA: Visitante, sin sesión.  
PRECONDICIÓN: A-PUB-01 aprobado.  
DEPENDENCIA: Ninguna.  
EVIDENCIA: Captura de Login y captura de regreso a portada.  
SEVERIDAD SI FALLA: MEDIA.  
CRITERIO DE PARADA: Pantalla en blanco, dominio distinto o bucle de redirección.

```text
TITULO: Abrir y cerrar el recorrido de inicio de sesión
DESCRIPCION: Comprueba que el acceso de inicio de sesión abre el formulario correcto y permite regresar a la portada sin perder la identificación de Demo.
PASOS:
2. Desde la portada toca Iniciar Sesión.
3. Confirma que aparecen los campos de usuario o correo y contraseña.
4. Toca el logotipo o el enlace para volver al inicio.
5. Confirma que vuelves a la portada Demo sin errores.
```

### A-PUB-03 — Validación de campos vacíos

ROL/CUENTA: Visitante, sin sesión.  
PRECONDICIÓN: Pantalla Login abierta.  
DEPENDENCIA: Ninguna.  
EVIDENCIA: Captura del aviso, sin datos escritos.  
SEVERIDAD SI FALLA: MEDIA.  
CRITERIO DE PARADA: Se inicia una sesión o se envían credenciales inexistentes.

```text
TITULO: Intentar entrar sin completar los campos
DESCRIPCION: Verifica que el formulario no continúe cuando falta el usuario o la contraseña y que la indicación sea comprensible.
PASOS:
2. Deja vacíos los campos de usuario y contraseña.
3. Presiona Ingresar una sola vez.
4. Confirma que permaneces en Login y que la pantalla solicita completar los datos.
5. Guarda una captura del resultado sin introducir información personal.
```

### A-PUB-04 — Credencial incorrecta controlada

ROL/CUENTA: QA-01, sin iniciar sesión.  
PRECONDICIÓN: Conocer el identificador QA por canal seguro; realizar un solo intento.  
DEPENDENCIA: Backend de autenticación disponible.  
EVIDENCIA: Captura del mensaje, ocultando el identificador.  
SEVERIDAD SI FALLA: ALTA.  
CRITERIO DE PARADA: El sistema concede acceso, revela si existe el correo/usuario o muestra datos internos.

```text
TITULO: Rechazar una contraseña incorrecta sin revelar datos
DESCRIPCION: Usa una cuenta ficticia conocida y una contraseña deliberadamente incorrecta para comprobar que no se concede acceso ni se revela información privada.
PASOS:
2. Escribe el identificador de QA-01 y una contraseña incorrecta distinta de la habitual.
3. Presiona Ingresar una sola vez.
4. Confirma que sigues fuera de la cuenta y que el aviso no revela datos internos ni personales.
5. Cierra el aviso y no repitas el intento.
```

### A-PUB-05 — Ruta protegida sin sesión

ROL/CUENTA: Visitante, sin sesión.  
PRECONDICIÓN: Borrar solo los datos de esta ventana o usar una ventana privada nueva.  
DEPENDENCIA: Ninguna.  
EVIDENCIA: Captura de la URL final y Login.  
SEVERIDAD SI FALLA: CRÍTICA.  
CRITERIO DE PARADA: Se muestran datos del Dashboard, Wallet o una cuenta anterior.

```text
TITULO: Bloquear el panel cuando no hay sesión
DESCRIPCION: Confirma que una persona sin sesión no puede abrir directamente el panel privado ni ver información de otra cuenta.
PASOS:
2. En una ventana privada nueva abre https://demo.wintoncoin.com/dashboard.
3. Espera a que termine la carga inicial.
4. Confirma que el sistema te lleva a Login y que no muestra datos privados durante la transición.
5. Guarda una captura de la pantalla final y de la dirección visible.
```

### A-PUB-06 — Registro visible sin crear cuenta

ROL/CUENTA: Visitante, sin sesión.  
PRECONDICIÓN: Ninguna.  
DEPENDENCIA: Ninguna.  
EVIDENCIA: Captura de la primera pantalla del registro y de sus enlaces legales.  
SEVERIDAD SI FALLA: MEDIA.  
CRITERIO DE PARADA: Se crea o envía una cuenta, se solicita un código o se autocompletan datos reales.

```text
TITULO: Revisar el inicio del registro sin enviar datos
DESCRIPCION: Abre el registro únicamente para confirmar que la pantalla es legible y que presenta sus enlaces legales; no completes ni envíes el formulario.
PASOS:
2. Abre https://demo.wintoncoin.com/register.
3. Revisa que la primera pantalla se adapte al tamaño del dispositivo y no tenga textos o botones cortados.
4. Localiza los enlaces de términos y privacidad sin aceptar ni enviar nada.
5. Cierra la página sin crear una cuenta.
```

### A-PUB-07 — Términos y privacidad accesibles

ROL/CUENTA: Visitante, sin sesión.  
PRECONDICIÓN: Portada o Registro abierto.  
DEPENDENCIA: Ninguna.  
EVIDENCIA: Captura de cada documento con título y URL, sin copiar contenido personal.  
SEVERIDAD SI FALLA: ALTA.  
CRITERIO DE PARADA: Documento inexistente, ilegible, dominio inesperado o aceptación automática.

```text
TITULO: Abrir términos y política de privacidad
DESCRIPCION: Comprueba que los documentos legales se pueden abrir antes de registrarse y que son legibles desde el dispositivo usado.
PASOS:
2. Abre el enlace de Términos y Condiciones desde la portada o el registro.
3. Confirma que el documento carga, tiene título visible y permite volver atrás.
4. Repite el recorrido con la Política de Privacidad.
5. Informa si algún enlace falla, está vacío o obliga a aceptar antes de leer.
```

### A-PUB-08 — Ruta inexistente controlada

ROL/CUENTA: Visitante, sin sesión.  
PRECONDICIÓN: Ninguna.  
DEPENDENCIA: Reescritura de rutas del hosting Demo.  
EVIDENCIA: Captura de la URL escrita y la pantalla final.  
SEVERIDAD SI FALLA: MEDIA.  
CRITERIO DE PARADA: Error del servidor con detalles internos, descarga inesperada o salida del dominio Demo.

```text
TITULO: Abrir una dirección inexistente sin provocar una pantalla rota
DESCRIPCION: Comprueba que una dirección equivocada se recupera de forma segura y no expone mensajes técnicos del servidor.
PASOS:
2. Abre https://demo.wintoncoin.com/ruta-qa-inexistente.
3. Espera a que termine cualquier redirección.
4. Confirma que terminas en la portada Demo o en una pantalla controlada, nunca en blanco ni con detalles internos.
5. Guarda la dirección final y una captura del resultado.
```

### A-PUB-09 — Afirmaciones legales y de marketing

ROL/CUENTA: Visitante y revisor de cumplimiento, sin sesión.  
PRECONDICIÓN: Portada Demo cargada.  
DEPENDENCIA: Ninguna.  
EVIDENCIA: Capturas con URL y texto completo de cada afirmación; no calificarlas como verdaderas.  
SEVERIDAD SI FALLA LA REVISIÓN: ALTA.  
CRITERIO DE PARADA: Publicar o reutilizar las afirmaciones como hechos acreditados sin evidencia documental y revisión jurídica/marketing.

```text
TITULO: Registrar promesas de seguridad y autenticidad para revisión
DESCRIPCION: Localiza las promesas visibles sobre auditoría, seguridad, ausencia de errores, atención real y bots. Esta tarea solo registra lo publicado; no confirma que las promesas sean verdaderas.
PASOS:
2. En la portada busca las secciones de Seguridad y del programa para creadores.
3. Captura completas las frases Smart Contracts Auditados, Seguridad de Grado Militar, Código inquebrantable y Cero errores humanos si aparecen.
4. Captura completas las frases 100% Atención Real y Cero Bots si aparecen.
5. Entrega las capturas al responsable de cumplimiento indicando fecha, URL y dispositivo, sin afirmar que exista una auditoría o garantía.
```

## Casos autenticados — cuentas normales QA

### A-AUTH-01 — Inicio de sesión válido

ROL/CUENTA: QA-01.  
PRECONDICIÓN: Credencial recibida por canal seguro; ventana exclusiva.  
DEPENDENCIA: Backend de autenticación disponible.  
EVIDENCIA: Captura del Dashboard con el identificador oculto; anotar si apareció el aviso neutral.  
SEVERIDAD SI FALLA: ALTA.  
CRITERIO DE PARADA: Redirección a producción, datos de otra cuenta o solicitud de firma/pago.

```text
TITULO: Entrar con una cuenta ficticia válida
DESCRIPCION: Inicia sesión con QA-01 y confirma que el sistema abre su panel sin cruzar datos ni solicitar operaciones económicas.
PASOS:
2. Abre Login en la ventana reservada para QA-01.
3. Escribe sus datos mediante el canal seguro y presiona Ingresar una sola vez.
4. Confirma que llegas al Dashboard y que aparece Sesión iniciada correctamente cuando corresponda.
5. Guarda una captura ocultando el nombre de cuenta y cualquier dato privado.
```

### A-AUTH-02 — Cuatro sesiones aisladas

ROL/CUENTA: QA-01, QA-02, QA-03 y QA-04.  
PRECONDICIÓN: A-AUTH-01 repetido en cuatro contextos independientes.  
DEPENDENCIA: Ninguna.  
EVIDENCIA: Hoja de control con contexto A/B/C/D y nombre oculto; no fotografiar credenciales.  
SEVERIDAD SI FALLA: CRÍTICA.  
CRITERIO DE PARADA: Cualquier contexto cambia de usuario, muestra datos de otro o comparte sesión.

```text
TITULO: Mantener separadas las cuatro cuentas de prueba
DESCRIPCION: Abre cada cuenta ficticia en un navegador, perfil o ventana privada diferente para comprobar que sus sesiones y datos no se mezclan.
PASOS:
2. Inicia QA-01, QA-02, QA-03 y QA-04 en cuatro contextos separados y etiquétalos A, B, C y D fuera de la aplicación.
3. Abre el menú de perfil en cada contexto y compara únicamente el nombre visible de esa misma cuenta.
4. Actualiza cada Dashboard una vez y confirma que ninguna ventana cambia de identidad.
5. Detén todas las pruebas si una ventana muestra el usuario o datos de otra.
```

### A-AUTH-02B — Ruta y versión efectiva después del Login

ROL/CUENTA: QA-01.  
PRECONDICIÓN: Inicio de sesión válido completado.  
DEPENDENCIA: Despliegue y reglas de redirección de Demo.  
EVIDENCIA: Captura de URL y pantalla inmediata al Login; anotar si es `/dashboard` o `/contract_interaction.html`.  
SEVERIDAD SI FALLA: ALTA.  
CRITERIO DE PARADA: Se mezclan controles de las interfaces legado y React, o el recorrido activo contradice el guardrail de Prelanzamiento.

```text
TITULO: Identificar qué panel abre realmente después de entrar
DESCRIPCION: Registra la dirección y la interfaz que Demo sirve después del Login para detectar si conviven recorridos diferentes con comportamientos incompatibles.
PASOS:
2. Inicia QA-01 desde login.html y espera a que termine toda redirección.
3. Anota si la dirección final es dashboard o contract_interaction.html.
4. Comprueba si el panel muestra una sola versión coherente de menús, catálogo y aviso de Prelanzamiento.
5. Registra FAIL si entra al recorrido legado cuando el Login React declara dashboard, o si ambas versiones aplican reglas diferentes.
```

### A-AUTH-03 — Banda de Prelanzamiento y explicación

ROL/CUENTA: Cualquiera de las cuatro cuentas QA.  
PRECONDICIÓN: Sesión activa en Dashboard.  
DEPENDENCIA: `/api/platform-settings`.  
EVIDENCIA: Captura de la banda y del texto informativo.  
SEVERIDAD SI FALLA: CRÍTICA.  
CRITERIO DE PARADA: Prelanzamiento ausente/desactivado o mensaje que invite a operar blockchain.

```text
TITULO: Confirmar que Prelanzamiento está visible y explicado
DESCRIPCION: Comprueba que el panel identifica la fase Beta de Prelanzamiento y que su explicación no promete fechas ni permite pagos.
PASOS:
2. Localiza la banda Pre-lanzamiento VERSION BETA en el Dashboard.
3. Toca la banda o su indicador de información.
4. Lee el mensaje y confirma que explica el estado sin pedir una firma, pago o conexión de billetera.
5. Guarda una captura del aviso y ciérralo.
```

### A-AUTH-04 — Creación bloqueada con mensaje correcto

ROL/CUENTA: Cualquiera de las cuatro cuentas QA normales.  
PRECONDICIÓN: Prelanzamiento activo y Dashboard cargado.  
DEPENDENCIA: `/api/platform-settings`.  
EVIDENCIA: Captura del modal `Prelanzamiento activo`.  
SEVERIDAD SI FALLA: CRÍTICA.  
CRITERIO DE PARADA: Se abre un formulario enviable, se crea una publicación o se solicita una operación económica.

```text
TITULO: Bloquear una publicación de usuario durante Prelanzamiento
DESCRIPCION: Presiona Crear Nueva Publicación como usuario normal y confirma que solo aparece una explicación, sin permitir crear o enviar contenido.
PASOS:
2. En el Dashboard presiona Crear Nueva Publicación una sola vez.
3. Confirma que aparece el título Prelanzamiento activo y que explica qué funciones sí pueden explorarse.
4. Presiona Entendido y confirma que vuelves al Dashboard sin abrir un formulario.
5. Repite con doble toque una sola vez y confirma que no se duplican ventanas.
```

### A-AUTH-05 — Venta rápida no disponible

ROL/CUENTA: Cualquiera de las cuatro cuentas QA normales.  
PRECONDICIÓN: Prelanzamiento activo.  
DEPENDENCIA: `/api/platform-settings`.  
EVIDENCIA: Captura del área de acciones rápidas.  
SEVERIDAD SI FALLA: CRÍTICA.  
CRITERIO DE PARADA: Aparece una acción utilizable de Venta Rápida o un flujo de cobro.

```text
TITULO: Ocultar Venta Rápida durante Prelanzamiento
DESCRIPCION: Revisa las acciones principales del Dashboard para comprobar que un usuario normal no recibe un acceso de Venta Rápida mientras la etapa está activa.
PASOS:
2. Ve al área donde aparece Crear Nueva Publicación.
3. Confirma que no existe un botón utilizable llamado Venta Rápida.
4. Actualiza la página una vez y vuelve a revisar la misma zona.
5. Informa de inmediato si aparece un flujo para cobrar o generar un pago.
```

### A-AUTH-05B — Prioridad de Prelanzamiento frente a KYC en catálogo vacío

ROL/CUENTA: Cualquiera de las cuatro cuentas QA normales.  
PRECONDICIÓN: Prelanzamiento activo y catálogo sin publicaciones visibles.  
DEPENDENCIA: Guardas de entrada de publicación y configuración de plataforma.  
EVIDENCIA: Captura del estado vacío y del primer modal que aparece al tocar cualquier invitación de creación.  
SEVERIDAD SI FALLA: ALTA.  
CRITERIO DE PARADA: El estado vacío invita a crear o el primer aviso es KYC/Verificación para publicar en lugar del bloqueo de Prelanzamiento.

```text
TITULO: Dar prioridad al aviso de Prelanzamiento antes de KYC
DESCRIPCION: Cuando no hay publicaciones, confirma que la pantalla no invite a crear y que ninguna verificación KYC o formulario se muestre antes del aviso que bloquea publicaciones durante Prelanzamiento.
PASOS:
2. Abre una categoría sin publicaciones y revisa el mensaje del estado vacío.
3. Registra FAIL si aparece Crear la Primera Publicación o cualquier invitación equivalente mientras Prelanzamiento está activo.
4. Si la invitación existe, presiónala una sola vez únicamente para identificar el primer aviso y no completes ningún dato.
5. Registra FAIL si aparece Verificación para publicar, KYC o un formulario antes de Prelanzamiento activo; cierra el aviso y termina la prueba.
```

### A-AUTH-06 — Búsqueda, mensaje sin coincidencias y limpieza

ROL/CUENTA: Cualquiera de las cuatro cuentas QA.  
PRECONDICIÓN: Dashboard cargado.  
DEPENDENCIA: Lista de publicaciones; funciona también si está vacía.  
EVIDENCIA: Captura antes, durante `xyz999` y después de limpiar.  
SEVERIDAD SI FALLA: MEDIA.  
CRITERIO DE PARADA: Congelamiento, pérdida de sesión o contenido de otra cuenta.

```text
TITULO: Buscar y limpiar publicaciones sin bloquear la pantalla
DESCRIPCION: Usa el buscador del Dashboard para comprobar el mensaje sin coincidencias y que limpiar restaura el estado anterior.
PASOS:
2. Escribe xyz999 en el campo Buscar.
3. Confirma que aparece No encontramos publicaciones que coincidan con tu búsqueda.
4. Presiona el botón para limpiar la búsqueda.
5. Confirma que el texto desaparece y vuelve el listado o el estado vacío anterior.
```

### A-AUTH-07 — Filtros y estado vacío

ROL/CUENTA: Cualquiera de las cuatro cuentas QA.  
PRECONDICIÓN: Dashboard cargado.  
DEPENDENCIA: Lista de publicaciones.  
EVIDENCIA: Captura de cada filtro con su contador o mensaje.  
SEVERIDAD SI FALLA: MEDIA.  
CRITERIO DE PARADA: Error de pantalla, contenido ajeno o acción económica.

```text
TITULO: Cambiar los filtros del catálogo
DESCRIPCION: Comprueba que los filtros visibles cambian la lista o muestran un estado vacío claro sin invitar a publicar durante Prelanzamiento.
PASOS:
2. Presiona en orden Todos, En proceso, Solicitud, Venta, Donación y Ocultas.
3. En cada filtro observa si cambia el contador o la lista sin recargar toda la página.
4. Cuando no haya contenido confirma que el mensaje explica el estado sin ofrecer crear una publicación.
5. Vuelve a Todos y confirma que el panel permanece estable.
```

### A-AUTH-08 — Ordenamiento local

ROL/CUENTA: Cualquiera de las cuatro cuentas QA.  
PRECONDICIÓN: Dashboard cargado; si hay menos de dos publicaciones registrar NO APLICA.  
DEPENDENCIA: Al menos dos publicaciones comparables.  
EVIDENCIA: Captura del primer y último estado con títulos visibles.  
SEVERIDAD SI FALLA: BAJA.  
CRITERIO DE PARADA: Pantalla en blanco, pérdida de elementos o datos privados.

```text
TITULO: Ordenar las publicaciones disponibles
DESCRIPCION: Si existen al menos dos publicaciones, cambia el orden para comprobar que la lista responde sin duplicar ni perder tarjetas.
PASOS:
2. Anota los dos primeros títulos visibles sin copiar datos personales.
3. Cambia entre Más reciente y Más antigua.
4. Si los importes son comparables cambia también entre Mayor recompensa y Menor recompensa.
5. Registra NO APLICA si no hay suficientes publicaciones para comparar.
```

### A-AUTH-09 — Detalle de una publicación existente

ROL/CUENTA: Cualquiera de las cuatro cuentas QA.  
PRECONDICIÓN: Debe existir una publicación oficial visible; de lo contrario registrar APLAZADA.  
DEPENDENCIA: Fixture de publicaciones oficiales.  
EVIDENCIA: Captura de tarjeta y detalle, sin presionar botones de participación o pago.  
SEVERIDAD SI FALLA: MEDIA.  
CRITERIO DE PARADA: La ficha invita a firmar, pagar, contratar o muestra datos privados no necesarios.

```text
TITULO: Abrir y cerrar una publicación oficial
DESCRIPCION: Abre una publicación existente únicamente para leer su ficha; no participes, no contrates y no confirmes ninguna acción.
PASOS:
2. Elige una tarjeta oficial visible en el Dashboard y anota su título.
3. Abre la tarjeta y confirma que la ficha corresponde al mismo título.
4. No presiones botones de participar, contratar, donar, pagar o conectar billetera.
5. Vuelve al Dashboard y confirma que la sesión sigue activa.
```

### A-AUTH-10 — Menú de perfil y cierre al tocar afuera

ROL/CUENTA: Cualquiera de las cuatro cuentas QA.  
PRECONDICIÓN: Dashboard cargado.  
DEPENDENCIA: Ninguna.  
EVIDENCIA: Capturas de menú abierto y cerrado.  
SEVERIDAD SI FALLA: MEDIA.  
CRITERIO DE PARADA: Se muestra otro usuario o una opción administrativa.

```text
TITULO: Abrir el menú personal sin mezclar cuentas
DESCRIPCION: Comprueba que el menú muestra la identidad de la sesión actual, enlaces personales y que se cierra al tocar fuera.
PASOS:
2. Presiona el nombre o icono de menú del usuario.
3. Confirma que aparecen Mi Perfil, Billetera Web3, Recuperación, Configuración y Cerrar Sesión.
4. Comprueba que no aparece una opción administrativa para esta cuenta normal.
5. Toca fuera del menú y confirma que se cierra.
```

### A-AUTH-11 — Notificaciones e historial de solo lectura

ROL/CUENTA: Cualquiera de las cuatro cuentas QA.  
PRECONDICIÓN: Dashboard cargado.  
DEPENDENCIA: `/api/me/notifications` y `/api/me/notifications/history`.  
EVIDENCIA: Captura del menú; ocultar textos que contengan datos personales o referencias completas.  
SEVERIDAD SI FALLA: ALTA si mezcla cuentas; MEDIA en otros fallos.  
CRITERIO DE PARADA: Aparece una notificación de otra cuenta, un secreto o se propone una transacción.

```text
TITULO: Consultar notificaciones sin modificarlas
DESCRIPCION: Abre la campana y el historial para comprobar que pertenecen a la cuenta actual. No uses Limpiar ni Descartar en este bloque.
PASOS:
2. Presiona la campana de Notificaciones.
3. Confirma que aparece una lista propia o el mensaje No tienes notificaciones pendientes.
4. Presiona Ver historial y revisa que la ventana cargue o indique que todavía no hay historial.
5. Cierra el historial sin limpiar ni descartar elementos.
```

### A-AUTH-12 — Usuario normal rechazado en ruta administrativa

ROL/CUENTA: QA-02, usuario normal.  
PRECONDICIÓN: Sesión normal activa.  
DEPENDENCIA: `/api/admin/profile`.  
EVIDENCIA: Captura del mensaje de acceso administrativo, ocultando la identidad.  
SEVERIDAD SI FALLA: CRÍTICA.  
CRITERIO DE PARADA: Se muestra el panel Web3, datos administrativos o controles.

```text
TITULO: Impedir que un usuario normal abra el panel administrativo
DESCRIPCION: Intenta abrir la ruta administrativa con una cuenta normal y confirma que el acceso se rechaza sin mostrar información interna.
PASOS:
2. Con QA-02 iniciada abre https://demo.wintoncoin.com/admin/web3.
3. Espera a que termine la verificación de sesión administrativa.
4. Confirma que ves Acceso administrativo y no el contenido del panel Web3.
5. Regresa al Dashboard y confirma que la sesión normal sigue siendo QA-02.
```

### A-AUTH-13 — Recarga conserva la sesión correcta

ROL/CUENTA: QA-03.  
PRECONDICIÓN: Sesión activa en Dashboard.  
DEPENDENCIA: Backend de sesión.  
EVIDENCIA: Capturas antes y después con identidad oculta.  
SEVERIDAD SI FALLA: ALTA.  
CRITERIO DE PARADA: Se abre otra cuenta o aparecen datos privados antes de pedir Login.

```text
TITULO: Recargar el Dashboard sin cambiar de identidad
DESCRIPCION: Actualiza la página una vez y confirma que la sesión se conserva correctamente o que Login se solicita sin mostrar datos ajenos.
PASOS:
2. Abre el menú y confirma que la sesión actual corresponde a QA-03.
3. Cierra el menú y actualiza la página una sola vez.
4. Si el Dashboard vuelve a abrir, confirma que sigue siendo QA-03.
5. Si la sesión expiró, confirma que Login aparece antes de cualquier dato privado.
```

### A-AUTH-14 — Cierre de sesión y botón Atrás

ROL/CUENTA: QA-04.  
PRECONDICIÓN: Sesión activa.  
DEPENDENCIA: Backend de sesión.  
EVIDENCIA: Captura del Login o portada final y del resultado tras Atrás.  
SEVERIDAD SI FALLA: CRÍTICA.  
CRITERIO DE PARADA: Se recupera acceso funcional a datos privados después de cerrar sesión.

```text
TITULO: Cerrar sesión sin recuperar datos con Atrás
DESCRIPCION: Cierra QA-04 desde el menú y usa Atrás para confirmar que el navegador no restaura una sesión privada utilizable.
PASOS:
2. Abre el menú personal y presiona Cerrar Sesión.
3. Confirma que sales del Dashboard y llegas a Login.
4. Presiona Atrás una vez y espera a que termine la carga.
5. Confirma que no puedes ver ni usar datos privados y que cualquier ruta protegida vuelve a Login.
```

### A-AUTH-15 — Adaptación móvil básica

ROL/CUENTA: Cualquiera de las cuatro cuentas QA.  
PRECONDICIÓN: Sesión activa en un teléfono o emulación de ancho móvil.  
DEPENDENCIA: Ninguna.  
EVIDENCIA: Capturas vertical y horizontal de Dashboard, sin datos personales.  
SEVERIDAD SI FALLA: MEDIA.  
CRITERIO DE PARADA: Un botón crítico queda inaccesible, se solapan datos o aparece una acción económica accidental.

```text
TITULO: Revisar el Dashboard en pantalla pequeña
DESCRIPCION: Comprueba que el panel, los filtros, el buscador, los menús y el aviso de Prelanzamiento pueden usarse sin textos cortados ni controles fuera de pantalla.
PASOS:
2. Abre el Dashboard con el teléfono en posición vertical.
3. Recorre la banda de Prelanzamiento, las acciones, los filtros, el buscador y los menús sin activar acciones económicas.
4. Gira el teléfono a posición horizontal y revisa las mismas zonas.
5. Captura cualquier solapamiento indicando dispositivo, navegador y orientación.
```

### A-AUTH-16 — Exchange de solo lectura, aplazado por indexador

ROL/CUENTA: Cualquiera de las cuatro cuentas QA.  
PRECONDICIÓN: El coordinador debe confirmar previamente tres observaciones separadas con `ready` y `usable=true`; de lo contrario registrar APLAZADA sin abrir el Exchange.  
DEPENDENCIA: **INDEXADOR**.  
EVIDENCIA: Registro de las tres observaciones y, si procede, captura de Exchange sin acciones.  
SEVERIDAD SI FALLA: ALTA.  
CRITERIO DE PARADA: `syncing`, `usable=false`, `503`, botón que permita ordenar/retirar, petición de firma o cambio de saldo.

```text
TITULO: Abrir el Exchange únicamente cuando el índice esté listo
DESCRIPCION: Esta prueba solo consulta la pantalla; no crea órdenes, no compra, no vende y no conecta una billetera. Debe aplazarse mientras la sincronización no esté estable.
PASOS:
2. Pide al coordinador la confirmación escrita de tres lecturas consecutivas ready y usable igual a true.
3. Si no existe esa confirmación registra APLAZADA y termina esta prueba.
4. Si existe, abre Exchange BLUE/USDT y revisa únicamente que la pantalla cargue datos sin errores.
5. Sal del Exchange sin presionar Comprar, Vender, Retirar, Aprobar, Confirmar o Conectar.
```

## Casos administrativos — solo lectura

Estos casos requieren una sesión administrativa previamente existente y autorizada. No se incluyen credenciales ni pasos para crearlas. Si no existe la sesión, registrar BLOQUEADA POR ACCESO y no usar cuentas normales para intentar elevar permisos.

### A-ADM-01 — Acceso administrativo por rol

ROL/CUENTA: Administrador o auditor autorizado.  
PRECONDICIÓN: Sesión administrativa válida ya abierta.  
DEPENDENCIA: `/api/admin/profile`.  
EVIDENCIA: Captura del encabezado del panel ocultando identidad y datos sensibles.  
SEVERIDAD SI FALLA: CRÍTICA.  
CRITERIO DE PARADA: Acceso con rol no autorizado, cambio de configuración o solicitud de firma.

```text
TITULO: Abrir el panel Web3 con un rol administrativo autorizado
DESCRIPCION: Confirma que el panel solo se muestra a una sesión administrativa o de auditoría válida; esta prueba no utiliza ninguno de sus controles de cambio.
PASOS:
2. Con la sesión administrativa autorizada abre https://demo.wintoncoin.com/admin/web3.
3. Confirma que finaliza el mensaje Verificando sesión administrativa y aparece el panel.
4. No presiones botones de pausa, reanudación, simulación, pago o configuración.
5. Guarda una captura del encabezado ocultando identidad, direcciones y valores sensibles.
```

### A-ADM-02 — Estado de los cuatro contratos mostrado con precisión

ROL/CUENTA: Administrador o auditor autorizado.  
PRECONDICIÓN: A-ADM-01 aprobado.  
DEPENDENCIA: RPC público y endpoint de estado administrativo.  
EVIDENCIA: Captura de los cuatro renglones Core, Exchange, Treasury y Vault.  
SEVERIDAD SI FALLA: CRÍTICA.  
CRITERIO DE PARADA: Falta un contrato, no se puede verificar, o la UI afirma contención total con algún `paused=false`.

```text
TITULO: Comparar el estado de pausa de los cuatro contratos
DESCRIPCION: Revisa los cuatro estados económicos sin cambiar nada y confirma que la pantalla distingue Pausado en blockchain, Sin pausa on-chain o No verificado.
PASOS:
2. Localiza el bloque de contención integral en el panel Web3.
3. Revisa por separado CoreProtocol, FifoExchange, ProtocolTreasury y CollateralVault.
4. Confirma que la conclusión general coincide con los cuatro renglones y no oculta un contrato sin pausa.
5. Detén las pruebas económicas si aparece Contención incompleta o cualquier estado no verificado.
```

### A-ADM-03 — Prelanzamiento activo sin cambiar el interruptor

ROL/CUENTA: Administrador autorizado.  
PRECONDICIÓN: Sesión administrativa en el panel general.  
DEPENDENCIA: Configuración de plataforma.  
EVIDENCIA: Captura del estado visible del ajuste, sin tocarlo.  
SEVERIDAD SI FALLA: CRÍTICA.  
CRITERIO DE PARADA: Prelanzamiento desactivado, estado ambiguo o intento de guardar cambios.

```text
TITULO: Verificar el estado administrativo de Prelanzamiento
DESCRIPCION: Consulta el ajuste Modo Pre-Lanzamiento únicamente para confirmar que está activo; no cambies interruptores ni guardes configuración.
PASOS:
2. Abre la sección de configuración del panel administrativo.
3. Localiza Modo Pre-Lanzamiento y confirma que aparece activo.
4. No presiones el interruptor ni ningún botón de guardar.
5. Compara este estado con la banda visible en una cuenta QA normal y registra cualquier diferencia.
```

### A-ADM-04 — Dossier limitado a una cuenta QA

ROL/CUENTA: Administrador o auditor autorizado.  
PRECONDICIÓN: Sesión administrativa y autorización para consultar exclusivamente las cuatro cuentas ficticias.  
DEPENDENCIA: Endpoint de dossier administrativo.  
EVIDENCIA: Lista de campos presentes, sin capturar valores de correo, teléfono, dirección, documentos o wallet completa.  
SEVERIDAD SI FALLA: CRÍTICA.  
CRITERIO DE PARADA: Se abre un usuario real, se cruzan expedientes o aparece información que no corresponde a la cuenta seleccionada.

```text
TITULO: Consultar únicamente el expediente de una cuenta ficticia
DESCRIPCION: Abre el detalle de una cuenta QA para comprobar que el panel presenta el expediente correcto, sin copiar ni divulgar sus datos.
PASOS:
2. Busca una de las cuatro cuentas QA por su identificador interno autorizado.
3. Abre su detalle y confirma únicamente que el nombre mostrado corresponde a la cuenta seleccionada.
4. No edites estados, saldos, KYC, roles, datos de contacto ni direcciones.
5. Cierra el detalle y registra solo si los campos cargaron o fallaron, nunca sus valores.
```

## Registro mínimo de resultados

Para cada caso registrar: ID; `PASS`, `FAIL`, `APLAZADA`, `BLOQUEADA` o `NO APLICA`; cuenta QA anonimizada; dispositivo/navegador; fecha y hora; resultado observado en una frase; nombre del archivo de evidencia; defecto relacionado; y persona/agente que lo ejecutó. Un `PASS` exige completar todos los pasos y conservar la evidencia indicada. Un caso aplazado no cuenta como aprobado.

Los defectos deben reportarse con: ID del caso; severidad; URL; versión `19aafcf`; pasos exactos; resultado esperado; resultado observado; evidencia sin secretos; frecuencia de reproducción; y si activa algún criterio global de parada.

## Mapa de evidencia de implementación

La existencia de los recorridos se contrastó, sin ejecutarlos, con:

- `frontend/src/App.jsx`: rutas SPA, alias y redirección de ruta desconocida.
- `frontend/src/pages/Login.jsx`: validación, autenticación, aviso neutral y limpieza defensiva.
- `frontend/src/pages/Dashboard.jsx`: protección de sesión, banda de Prelanzamiento, notificaciones y composición del catálogo.
- `frontend/src/components/dashboard/DashboardHeader.jsx`: menú, cierre de sesión, notificaciones e historial.
- `frontend/src/components/dashboard/QuickActions.jsx`: creación visible y Venta Rápida oculta en Prelanzamiento.
- `frontend/src/components/dashboard/PublicationTypeModal.jsx`: modal `Prelanzamiento activo` y bloqueo de tipos para usuarios normales.
- `frontend/src/components/dashboard/PublicationsFeed.jsx`: búsqueda con espera de 250 ms, limpieza, filtros, orden y mensajes vacíos.
- `frontend/src/components/AdminGate.jsx`: roles administrativos permitidos y denegación del resto.
- `frontend/src/pages/AdminWeb3Panel.jsx`: visualización independiente de pausa para Core, Exchange, Treasury y Vault y advertencia de contención incompleta.
- `frontend/src/pages/admin-panel.js`: visualización administrativa del ajuste `pre_launch_mode_enabled`.
- `frontend/src/components/landing/SecuritySection.jsx` y `FomoSection.jsx`: afirmaciones de marketing que requieren expediente de soporte y revisión de cumplimiento.
- `backend/src/services/economicWriteGate.js`: bloqueo backend por Prelanzamiento; no demuestra pausa on-chain.

Esta matriz no certifica seguridad, cumplimiento regulatorio, funcionamiento económico ni ausencia de errores. Su resultado solo autoriza decidir el siguiente bloque dentro de Demo.
