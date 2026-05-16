> **⚠️ INSTRUCCIÓN IMPORTANTE PARA EL TESTER:**
> **NO EDITES ESTE ARCHIVO ORIGINAL.** Debes hacer una copia de este documento y guardarlo.
> **El nombre del archivo nuevo debe tener el siguiente formato:**
> `[TU_NOMBRE_O_INICIALES]_QA_[FECHA_DD-MM-YYYY].md`
> *(Ejemplo: JUAN_PEREZ_QA_16-05-2026.md)*

# 🧪 Plan de Pruebas de Calidad (QA) - WintonCoin Web3

**Fecha de Pruebas:** _____ / _____ / 2026  
**Probador (Tester):** _____________________________  
**Entorno:** DEMO (Aplicación Móvil / Web)  

## 📸 Evidencia Multimedia (OBLIGATORIO)
*Por motivos de auditoría y cumplimiento legal, todas las pruebas deben estar respaldadas por evidencia visual para garantizar la trazabilidad.*
- **🔗 Link de Video (Google Drive, Loom, etc.):** _________________________________
- **🖼️ Link de Capturas de Pantalla (Fotos):** ___________________________________

---

Este documento contiene 20 pruebas diseñadas para validar las nuevas medidas de seguridad financiera de WintonCoin. Están explicadas paso a paso para que cualquier persona pueda realizarlas y anotar el resultado.

---

### Sección 1: Interfaz y Nombres (Pruebas Visuales)
*Revisaremos que ya no queden rastros de la versión "vieja" (IOU/real).*

- [ ] **Prueba 1: Menú Lateral.** 
  - **Acción:** Abre el menú principal de la aplicación.
  - **Esperado:** Debe decir "Billetera Web3" en lugar de "Estado de Cuenta".
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

- [ ] **Prueba 2: Tooltips y Textos.** 
  - **Acción:** Entra a la Billetera Web3 y presiona los íconos de información (signos de interrogación) al lado de tus saldos.
  - **Esperado:** Los textos deben decir simplemente "BLUE" (sin mencionar "BLUE real" ni "IOU"). Tampoco debe existir el "Cronograma de vencimientos".
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

---

### Sección 2: Freno de Solvencia (Bloqueo por falta de fondos)
*Revisaremos que el sistema no te deje crear tareas si no tienes el crédito o los fondos suficientes.*

- [ ] **Prueba 3: Solicitud inalcanzable.** 
  - **Acción:** Ve a crear una "Solicitud de Tarea". Pon una recompensa absurdamente alta (ej. 100,000 BLUE) y 100 cupos. Intenta publicarla.
  - **Esperado:** El sistema debe lanzar un error rojo indicando "Fondos Insuficientes" o "Límite Excedido" y la tarea NO debe crearse.
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

- [ ] **Prueba 4: Costo negativo.** 
  - **Acción:** Intenta crear una tarea o producto poniendo una recompensa o precio negativo (ej. -50).
  - **Esperado:** El sistema debe rechazarlo inmediatamente indicando que debe ser un valor positivo.
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

- [ ] **Prueba 5: Solvencia Exacta.** 
  - **Acción:** Revisa tu límite disponible en el perfil. Intenta crear una tarea cuyo costo total (multiplicado por la cantidad de cupos) sea exactamente el límite que tienes libre (o un poquito menos).
  - **Esperado:** La tarea debe publicarse exitosamente sin arrojar error.
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

---

### Sección 3: Retención de Fondos (Escrow)
*Cuando creas una tarea, el sistema debe "retener" esa porción de tu crédito para que no la gastes dos veces.*

- [ ] **Prueba 6: Reducción del límite al publicar.** 
  - **Acción:** Anota cuánto límite de crédito disponible tienes. Crea una tarea que ofrezca pagar 10 BLUE con 1 cupo.
  - **Esperado:** Si intentas crear una SEGUNDA tarea gigante justo después, el sistema debe decirte en el error que ya tienes "X fondos bloqueados en otras publicaciones". Tu crédito real debe haberse reducido temporalmente.
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

- [ ] **Prueba 7: Pago de la tarea.** 
  - **Acción:** Pídele a otro usuario de prueba que acepte esa tarea de 10 BLUE que creaste, y luego tú desde tu panel presiona "Pagar/Confirmar Tarea".
  - **Esperado:** El pago debe ejecutarse con éxito y el trabajador debe recibir los fondos.
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

- [ ] **Prueba 8: Liberación del Escrow por Pago.** 
  - **Acción:** Justo después de pagar la tarea de la Prueba 7, revisa si tu crédito disponible volvió a la normalidad (ya que el pago se hizo, la retención temporal desaparece y se convierte en deuda fija).
  - **Esperado:** Ya no deberías tener retenciones (escrow) sobre esa tarea. Puedes intentar hacer otra tarea para confirmarlo.
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

---

### Sección 4: Limpieza Automática de Retenciones (Cron Job)
*Si te arrepientes de una tarea, la retención de tus fondos debe devolverse automáticamente.*

- [ ] **Prueba 9: Borrar una tarea sin hacer.** 
  - **Acción:** Crea una tarea solicitando algo por 20 BLUE. Ve a tu panel de publicaciones y presiona "Eliminar Tarea".
  - **Esperado:** La tarea desaparece.
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

- [ ] **Prueba 10: Devolución del crédito (Cron de 15 minutos).** 
  - **Acción:** Espera unos 15 minutos después de la Prueba 9 (o avísale al desarrollador para forzar el cron). Intenta crear una tarea nueva.
  - **Esperado:** Tu crédito de los 20 BLUE bloqueados debe haber sido restaurado totalmente. Ya no tienes retenciones por la tarea borrada.
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

- [ ] **Prueba 11: Tarea Expirada.** 
  - **Acción:** Crea una tarea que caduque en 5 minutos.
  - **Esperado:** Pasado ese tiempo más los 15 min del sistema de limpieza, tu saldo retenido vuelve a la normalidad automáticamente.
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

---

### Sección 5: Compras Rápidas y Donaciones
*Las ventas no retienen el saldo del que publica, sino del que compra.*

- [ ] **Prueba 12: Publicar una venta (Marketplace).** 
  - **Acción:** Publica un producto para la venta (tipo 'sell') por un costo gigante (1,000,000 BLUE).
  - **Esperado:** El sistema DEBE dejarte hacerlo sin marcar "fondos insuficientes", porque tú eres el que va a recibir el dinero, no el que lo va a pagar.
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

- [ ] **Prueba 13: Comprador sin fondos.** 
  - **Acción:** Intenta que otro usuario sin saldo y sin crédito intente "Comprar/Pagar" tu producto millonario.
  - **Esperado:** El sistema debe frenar al comprador diciendo que no tiene fondos disponibles.
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

- [ ] **Prueba 14: Donación a campaña.** 
  - **Acción:** Busca una publicación tipo Campaña de Recaudación (Donación) y transfiere 5 BLUE.
  - **Esperado:** El progreso de la barra de recaudación debe subir y el autor debe recibir notificación.
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

---

### Sección 6: Normas de Tutores y Menores (Seguridad Legal)
*Reglas bancarias para cuentas supervisadas.*

- [ ] **Prueba 15: Menor publica tarea.** 
  - **Acción:** Entra con una cuenta de un usuario menor de edad (perfil verde). Intenta crear una Solicitud de Tarea.
  - **Esperado:** El límite de crédito que evalúa el sistema debe ser el del TUTOR asociado, no el del menor. (La deuda es para el padre).
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

- [ ] **Prueba 16: Tutor intentando auto-pagarse.** 
  - **Acción:** Como menor de edad, publica una tarea. Luego entra a la cuenta del padre/tutor y trata de "Participar" en esa tarea.
  - **Esperado:** El sistema debe arrojar un error de "Conflicto de intereses", no permitiendo al tutor hacer la tarea de su hijo.
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

---

### Sección 7: Red de Seguridad (Sistema Outbox)
*Para probar que el sistema no se rompa si hay una falla de conexión en el pago.*

- [ ] **Prueba 17: Verificación en Notificaciones.** 
  - **Acción:** Paga una tarea normalmente. Revisa tu panel de notificaciones (la campanita).
  - **Esperado:** Debes recibir la notificación que dice "Has pagado X BLUE..." o "Has acumulado X BLUE...". (Si ves una alerta de "Tu pago está siendo verificado por seguridad", significa que la base de datos tuvo un retraso, lo cual también es normal y prueba que la red de seguridad funciona).
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

- [ ] **Prueba 18: Auditoría (Panel de Administrador).** 
  - **Acción:** Si tienes cuenta de administrador, entra a las estadísticas/transacciones recientes.
  - **Esperado:** Todo pago, creación o donación debe aparecer registrado correctamente con la fecha y usuarios involucrados.
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

---

### Sección 8: Casos de Estrés y Doble Click
*Buscamos romper la plataforma por velocidad.*

- [ ] **Prueba 19: Doble Click al Pagar.** 
  - **Acción:** Ve a pagar una tarea ya completada. Presiona el botón de "Confirmar Pago" MUCHAS VECES muy rápido antes de que cargue.
  - **Esperado:** El pago debe procesarse solo UNA VEZ y el saldo solo debe descontarse UNA VEZ.
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

- [ ] **Prueba 20: Completar Tarea Pausada.** 
  - **Acción:** Crea una tarea, que alguien la acepte. Antes de que la terminen, PAUSA la publicación. Que el trabajador intente enviarla como terminada.
  - **Esperado:** El sistema debe comportarse correctamente (idealmente frenar la acción o notificar que está pausada).
  - **Resultado (OK / Falló):** ___________ | **Comentarios:** ____________________

---
**Firma del Tester:** ________________________ **Aprobado Final:** [  ] SÍ  [  ] NO
