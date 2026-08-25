// ============================================================================
// WintonCoin Android — GetUnreadNotificationsUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Obtiene las notificaciones activas no leídas.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.NotificationItem
import com.wintoncoin.app.domain.repository.NotificationRepository
import javax.inject.Inject

class GetUnreadNotificationsUseCase @Inject constructor(
    private val repository: NotificationRepository
) {
    suspend operator fun invoke(): Result<List<NotificationItem>> {
        return repository.getUnreadNotifications()
    }
}
