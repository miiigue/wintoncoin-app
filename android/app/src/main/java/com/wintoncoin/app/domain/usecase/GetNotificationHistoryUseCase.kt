// ============================================================================
// WintonCoin Android — GetNotificationHistoryUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Obtiene el historial completo de notificaciones.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.NotificationItem
import com.wintoncoin.app.domain.repository.NotificationRepository
import javax.inject.Inject

class GetNotificationHistoryUseCase @Inject constructor(
    private val repository: NotificationRepository
) {
    suspend operator fun invoke(): Result<List<NotificationItem>> {
        return repository.getNotificationsHistory()
    }
}
