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
