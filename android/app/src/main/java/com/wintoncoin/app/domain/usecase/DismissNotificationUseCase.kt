// ============================================================================
// WintonCoin Android — DismissNotificationUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Descarta una notificación individual por su ID.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.repository.NotificationRepository
import javax.inject.Inject

class DismissNotificationUseCase @Inject constructor(
    private val repository: NotificationRepository
) {
    suspend operator fun invoke(id: Int): Result<Unit> {
        if (id <= 0) {
            return Result.failure(IllegalArgumentException("ID de notificación inválido."))
        }
        return repository.dismissNotification(id)
    }
}
