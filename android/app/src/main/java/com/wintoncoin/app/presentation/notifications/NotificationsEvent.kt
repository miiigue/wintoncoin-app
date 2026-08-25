// ============================================================================
// WintonCoin Android — NotificationsEvent
// ============================================================================
// [PRESENTATION / MVI EVENT] Eventos de intención del usuario en el Centro de Notificaciones.
// ============================================================================

package com.wintoncoin.app.presentation.notifications

import com.wintoncoin.app.domain.model.NotificationCategory

sealed interface NotificationsEvent {
    object Load : NotificationsEvent
    object Refresh : NotificationsEvent
    data class SelectTab(val tab: NotificationTab) : NotificationsEvent
    data class SelectCategoryFilter(val category: NotificationCategory?) : NotificationsEvent
    data class DismissNotification(val id: Int) : NotificationsEvent
    object MarkAllAsRead : NotificationsEvent
    object DismissError : NotificationsEvent
    object DismissFeedback : NotificationsEvent
}
