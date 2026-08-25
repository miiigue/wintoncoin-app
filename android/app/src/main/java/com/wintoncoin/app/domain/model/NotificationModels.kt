// ============================================================================
// WintonCoin Android — NotificationModels
// ============================================================================
// [DOMAIN LAYER / MODEL] Entidades de dominio inmutables para el sistema de notificaciones.
// ============================================================================

package com.wintoncoin.app.domain.model

enum class NotificationCategory {
    REWARD_TASK,        // 💰 Ganancia de tokens BLUE / Recompensa de Impulsor
    APPROVAL,           // 🎉 Tarea o postulación aprobada
    TRANSFER,           // 💸 Transferencia enviada/recibida o pago
    REQUEST,            // 📩 Solicitud de participación en tarea
    SECURITY_WARNING,   // ⚠️ Alerta de compromiso, quema o seguridad
    GENERAL_INFO        // 🔔 Información general y bienvenida
}

enum class NotificationNavigationTarget {
    BOOSTER_PROFILE,    // Navegar al perfil de impulsor
    WALLET,             // Navegar a la billetera
    ACCOUNT_STATEMENT,  // Navegar al estado de cuenta
    PUBLICATIONS,       // Navegar al feed / tareas
    NONE                // Sin navegación
}

data class NotificationItem(
    val id: Int,
    val message: String,
    val isRead: Boolean,
    val createdAt: String,
    val category: NotificationCategory,
    val navigationTarget: NotificationNavigationTarget,
    val iconEmoji: String,
    val formattedDate: String
)
