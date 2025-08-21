# Hoja de Ruta del Proyecto WintonCoin

Este documento describe las principales funcionalidades planificadas para futuras versiones de la aplicación.

---

## 1. Funcionalidad: Sistema de Delegación e Intermediarios

**Objetivo:** Permitir que usuarios sin acceso a la tecnología (Delegados) puedan participar en la economía de la aplicación a través de usuarios con acceso (Intermediarios), fomentando la inclusión financiera.

### Fase 1: Implementación del Flujo de Delegación de Tareas

**Descripción:** Crear la mecánica central para que un intermediario pueda asignar la finalización de una tarea a un usuario delegado y que los fondos se distribuyan automáticamente.

*   **Cambios en el Frontend:**
    *   Añadir una opción "Completar y Delegar" en la vista de detalle de la publicación para el usuario que aceptó la tarea.
    *   Crear un modal o formulario donde el Intermediario pueda introducir el `nombre de usuario` del Delegado.
    *   Modificar la vista de notificaciones del Creador de la Tarea para que muestre que la tarea fue completada por un Delegado a través de un Intermediario.

*   **Cambios en el Backend:**
    *   Crear un nuevo endpoint (ej. `POST /publications/:id/delegate-complete`) para gestionar esta acción.
    *   Implementar la lógica de negocio para la distribución de fondos:
        *   Calcular la comisión del Intermediario (configurable, por ejemplo, 5%).
        *   Transferir la comisión a la cuenta del Intermediario.
        *   Transferir el resto de la recompensa a la cuenta del Delegado.
    *   Asegurar que las transacciones sean atómicas (o todo se completa o nada lo hace) para evitar inconsistencias de saldo.

*   **Cambios en la Base de Datos:**
    *   Evaluar si se necesitan nuevas columnas en la tabla `acceptances` o una nueva tabla para registrar estas delegaciones, guardando quién fue el intermediario y quién el delegado.

### Fase 2: Desarrollo del Ecosistema de Confianza y Liquidación

**Descripción:** Construir las herramientas necesarias para que el sistema de delegación sea seguro, transparente y funcional para el Delegado, permitiéndole liquidar sus fondos de forma segura.

*   **Gestión de Delegados (Frontend y Backend):**
    *   **Creación de Delegados:** Un Intermediario debe poder crear una cuenta para un Delegado. Durante este proceso, se debe generar un **PIN secreto de 4 dígitos** y una **frase de recuperación** que el Delegado debe guardar de forma segura.
    *   **Consulta de Saldos:** Implementar una pantalla donde cualquier Intermediario pueda buscar a un Delegado por su nombre de usuario y ver su saldo actual y su historial de transacciones (solo lectura). Esto fomenta la transparencia y el control social.
    *   **Liquidación de Fondos con PIN:**
        *   Crear una interfaz para "Liquidar Fondos de Delegado".
        *   El Intermediario inicia el proceso, pero el Delegado debe introducir personalmente su PIN secreto para autorizar la transferencia de sus BLUEs al Intermediario (a cambio de efectivo, por ejemplo).
        *   La introducción del PIN en la pantalla debe ser segura (ocultando los números).
    *   **Recuperación de PIN:** Diseñar un proceso seguro para la recuperación del PIN usando la frase secreta, minimizando la dependencia en un solo intermediario.

*   **Sistema de Reputación (Frontend y Backend):**
    *   Implementar un sistema de calificación donde los Delegados (asistidos por un intermediario) puedan calificar a los Intermediarios con los que han trabajado.
    *   Mostrar la calificación promedio de un Intermediario en su perfil público para generar confianza.

---

## 2. Funcionalidad: Mercado P2P de Tokens

**Objetivo:** Implementar un mercado Peer-to-Peer (P2P) seguro y confiable para que los usuarios puedan comprar y vender tokens BLUE entre ellos utilizando dinero fiduciario (ej. USD, EUR).

### Fase 1: Producto Mínimo Viable (MVP) - Flujo Transaccional con Escrow

**Descripción:** Construir el núcleo del sistema P2P, garantizando que las transacciones sean seguras desde el primer momento a través de un sistema de depósito en garantía (escrow) automatizado.

*   **Sistema de Escrow Automatizado (Backend):**
    *   Al iniciar una transacción, los tokens BLUE del vendedor se transferirán automáticamente de su saldo principal a su `escrow_blue_balance`.
    *   Los tokens permanecerán bloqueados hasta que el vendedor confirme la recepción del pago fiduciario.
    *   El sistema liberará los tokens al comprador o los devolverá al vendedor de forma atómica.

*   **Flujo de la Transacción (Backend y Frontend):**
    *   **Publicación de Órdenes:** Los usuarios podrán crear órdenes de venta o compra, especificando cantidad, precio, moneda fiduciaria y métodos de pago.
    *   **Aceptación de Órdenes:** Un usuario acepta una orden, lo que inicia el proceso de escrow.
    *   **Confirmación de Pago (Doble):**
        1.  El comprador realiza el pago por fuera de la plataforma y marca "He pagado".
        2.  El vendedor verifica su cuenta, y al recibir el dinero, marca "Liberar Tokens".
    *   **Finalización:** El sistema transfiere los tokens del escrow al comprador.

*   **Cambios en la Base de Datos:**
    *   Añadir una columna `payment_methods` (JSON) a la tabla `users`.
    *   Crear una nueva tabla `p2p_orders` para las ofertas publicadas.
    *   Crear una nueva tabla `p2p_trades` para registrar cada transacción individual, con su estado (`PENDING_PAYMENT`, `COMPLETED`, `DISPUTED`, etc.).

### Fase 2: Funcionalidades de Confianza y Soporte

**Descripción:** Añadir las capas necesarias para construir la confianza entre los usuarios y proporcionar herramientas para resolver conflictos.

*   **Sistema de Disputas (Frontend y Backend):**
    *   Implementar un botón de "Disputa" o "Apelación" en la vista de la transacción.
    *   Crear un panel de administración para que el equipo de soporte pueda revisar las pruebas presentadas por las partes (chats, capturas de pago) y tomar una decisión manual (liberar o devolver los tokens en escrow).

*   **Sistema de Reputación (Frontend y Backend):**
    *   Tras cada transacción exitosa, permitir que comprador y vendedor se califiquen mutuamente (ej. positivo/negativo) y dejen comentarios.
    *   Mostrar estadísticas de reputación en el perfil de cada usuario (ej. % de transacciones completadas, número de calificaciones positivas).