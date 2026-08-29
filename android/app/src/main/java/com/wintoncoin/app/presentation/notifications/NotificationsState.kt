// ============================================================================
// WintonCoin Android — NotificationsState
// ============================================================================
// [PRESENTATION / STATE] Estado UI reactivo e inmutable para el Centro de Notificaciones.
// ============================================================================

package com.wintoncoin.app.presentation.notifications

import com.wintoncoin.app.domain.model.NotificationCategory
import com.wintoncoin.app.domain.model.NotificationItem

enum class NotificationTab {
    UNREAD,     // Pestaña: Nuevas / No leídas
    HISTORY     // Pestaña: Historial Completo
}

data class NotificationsState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val isClearingAll: Boolean = false,
    val dismissingIds: Set<Int> = emptySet(),
    val selectedTab: NotificationTab = NotificationTab.UNREAD,
    val selectedCategoryFilter: NotificationCategory? = null,
    val unreadNotifications: List<NotificationItem> = emptyList(),
    val historyNotifications: List<NotificationItem> = emptyList(),
    val errorMessage: String? = null,
    val feedbackMessage: String? = null
) {
    val unreadCount: Int get() = unreadNotifications.size

    val displayedNotifications: List<NotificationItem>
        get() {
            val list = if (selectedTab == NotificationTab.UNREAD) unreadNotifications else historyNotifications
            return if (selectedCategoryFilter != null) {
                list.filter { it.category == selectedCategoryFilter }
            } else {
                list
            }
        }
}
