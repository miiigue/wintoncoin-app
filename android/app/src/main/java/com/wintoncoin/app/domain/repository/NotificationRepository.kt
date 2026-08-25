// ============================================================================
// WintonCoin Android — NotificationRepository
// ============================================================================
// [DOMAIN LAYER / REPOSITORY CONTRACT] Contrato de operaciones para notificaciones.
// ============================================================================

package com.wintoncoin.app.domain.repository

import com.wintoncoin.app.domain.model.NotificationItem

interface NotificationRepository {
    suspend fun getUnreadNotifications(): Result<List<NotificationItem>>
    suspend fun getNotificationsHistory(): Result<List<NotificationItem>>
    suspend fun markAllAsRead(): Result<Int>
    suspend fun dismissNotification(id: Int): Result<Unit>
}
