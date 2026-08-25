// ============================================================================
// WintonCoin Android — GetNotificationHistoryUseCaseTest
// ============================================================================
// Pruebas unitarias para GetNotificationHistoryUseCase.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.NotificationCategory
import com.wintoncoin.app.domain.model.NotificationItem
import com.wintoncoin.app.domain.model.NotificationNavigationTarget
import com.wintoncoin.app.domain.repository.NotificationRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GetNotificationHistoryUseCaseTest {

    private class FakeRepo(private val shouldFail: Boolean = false) : NotificationRepository {
        override suspend fun getUnreadNotifications(): Result<List<NotificationItem>> = Result.success(emptyList())

        override suspend fun getNotificationsHistory(): Result<List<NotificationItem>> {
            return if (shouldFail) {
                Result.failure(Exception("Error al cargar historial de notificaciones."))
            } else {
                Result.success(
                    listOf(
                        NotificationItem(
                            id = 10,
                            message = "¡Has sido aprobado automáticamente para la tarea!",
                            isRead = true,
                            createdAt = "2026-08-24T10:00:00Z",
                            category = NotificationCategory.APPROVAL,
                            navigationTarget = NotificationNavigationTarget.BOOSTER_PROFILE,
                            iconEmoji = "🎉",
                            formattedDate = "Hace 2 h"
                        )
                    )
                )
            }
        }

        override suspend fun markAllAsRead(): Result<Int> = Result.success(0)
        override suspend fun dismissNotification(id: Int): Result<Unit> = Result.success(Unit)
    }

    @Test
    fun `invoke returns notification history list successfully`() = runBlocking {
        val useCase = GetNotificationHistoryUseCase(FakeRepo())
        val result = useCase()

        assertTrue(result.isSuccess)
        val list = result.getOrThrow()
        assertEquals(1, list.size)
        assertEquals(10, list[0].id)
        assertEquals(NotificationCategory.APPROVAL, list[0].category)
        assertTrue(list[0].isRead)
    }

    @Test
    fun `invoke propagates failure on repository error`() = runBlocking {
        val useCase = GetNotificationHistoryUseCase(FakeRepo(shouldFail = true))
        val result = useCase()

        assertTrue(result.isFailure)
        assertEquals("Error al cargar historial de notificaciones.", result.exceptionOrNull()?.message)
    }
}
