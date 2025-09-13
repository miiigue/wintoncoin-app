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

---

## 3. Funcionalidad: Verificación de Identidad por Niveles (KYC)

**Objetivo:** Implementar un sistema de verificación de identidad robusto y escalable para cumplir con estándares de seguridad, prevenir el fraude en el mercado P2P y generar confianza en la plataforma.

### Fase 1: Verificación de Datos Personales (KYC Nivel 1)

**Descripción:** Recopilar la información personal básica del usuario como primer paso de verificación. Esta fase se activará cuando un usuario intente realizar su primera operación P2P.

*   **Implementación:**
    *   **Base de Datos:** Añadir columnas a la tabla `users` para almacenar `given_name`, `family_name`, `date_of_birth`, `document_type`, `document_number` y un estado `is_verified`.
    *   **Frontend:** Crear un formulario de "Verificación de Perfil" donde los usuarios ingresen esta información.
    *   **Backend:** Crear un endpoint para recibir y almacenar de forma segura estos datos, y actualizar el estado del usuario a verificado (Nivel 1).
    *   **Lógica de Acceso:** Modificar los endpoints del P2P para requerir que un usuario tenga la verificación de Nivel 1 completada antes de poder operar, posiblemente con límites transaccionales.

### Fase 2: Verificación de Documentos y Prueba de Vida (KYC Nivel 2)

**Descripción:** Integrar un servicio de terceros especializado para una verificación de identidad completa, que valide que los datos del Nivel 1 son auténticos.

*   **Planificación:**
    *   **Investigación:** Evaluar e investigar proveedores de servicios de KYC líderes en la industria (ej: Stripe Identity, Veriff, Onfido, Jumio).
    *   **Integración:** Desarrollar la integración con el servicio seleccionado. El flujo implicará que el usuario suba una foto de su documento de identidad y complete una "prueba de vida" (selfie o video corto).
    *   **Beneficios:** Al completar el Nivel 2, los usuarios obtendrán el estatus de "Totalmente Verificado", lo que les permitirá acceder a límites transaccionales más altos en el P2P y les otorgará una insignia de confianza en su perfil.

---

## 4. Funcionalidad: Mejoras de Experiencia de Usuario (UX)

**Objetivo:** Implementar mejoras continuas en la aplicación para hacerla más intuitiva, robusta y fácil de usar, respondiendo a las necesidades y problemas encontrados por los usuarios.

### Fase 1: Flujo de Registro y Verificación Robusto

**Descripción:** Mejorar el proceso de registro para manejar casos donde el usuario no recibe el código de verificación inicial y se queda bloqueado.

*   **Botón de "Reenviar Código" (Frontend y Backend):**
    *   **Frontend:** En la pantalla de verificación de SMS, añadir un botón "Reenviar código de verificación". Este botón debería tener un temporizador (ej. 60 segundos) para prevenir el spam, solo activándose después de que haya pasado el tiempo.
    *   **Backend:** Crear un nuevo endpoint (ej. `POST /auth/resend-verification-code`) que reciba el email o teléfono del usuario.
    *   **Lógica:** El endpoint debe buscar al usuario no verificado, generar un **nuevo** código de verificación, actualizarlo en la base de datos (con una nueva fecha de expiración) y enviarlo nuevamente a través de Twilio.

*   **Redirección Automática a Verificación (Frontend y Backend):**
    *   **Backend:** En el endpoint que verifica el estado de autenticación de un usuario (ej. `/auth/status` o similar), además de devolver si está logueado, se debe incluir el estado de verificación (`is_verified`).
    *   **Frontend:** Al cargar la aplicación, si el backend informa que el usuario está autenticado pero no verificado (`isAuthenticated: true`, `is_verified: false`), la aplicación debe redirigir automáticamente al usuario a la pantalla/modal de verificación de SMS, impidiendo el acceso a otras partes de la aplicación.