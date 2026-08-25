// ============================================================================
// WintonCoin Android — MarkAllNotificationsAsReadUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Marca todas las notificaciones pendientes como leídas.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.repository.NotificationRepository
import javax.inject.Inject

class MarkAllNotificationsAsReadUseCase @Inject constructor(
    private val repository: NotificationRepository
) {
    suspend operator fun invoke(): Result<Int> {
        return repository.markAllAsRead()
    }
}
