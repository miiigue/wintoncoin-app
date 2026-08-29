// ============================================================================
// WintonCoin Android — GetUnreadNotificationsUseCaseTest
// ============================================================================
// Pruebas unitarias para GetUnreadNotificationsUseCase.
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

class GetUnreadNotificationsUseCaseTest {

    private class FakeRepo(private val shouldFail: Boolean = false) : NotificationRepository {
        override suspend fun getUnreadNotifications(): Result<List<NotificationItem>> {
            return if (shouldFail) {
                Result.failure(Exception("Error al cargar notificaciones no leídas."))
            } else {
                Result.success(
                    listOf(
                        NotificationItem(
                            id = 1,
                            message = "¡Has ganado 50.0000 BLUE IOU!",
                            isRead = false,
                            createdAt = "2026-08-24T12:00:00Z",
                            category = NotificationCategory.REWARD_TASK,
                            navigationTarget = NotificationNavigationTarget.BOOSTER_PROFILE,
                            iconEmoji = "💰",
                            formattedDate = "Hace 5 min"
                        )
                    )
                )
            }
        }

        override suspend fun getNotificationsHistory(): Result<List<NotificationItem>> = Result.success(emptyList())
        override suspend fun markAllAsRead(): Result<Int> = Result.success(1)
        override suspend fun dismissNotification(id: Int): Result<Unit> = Result.success(Unit)
    }

    @Test
    fun `invoke returns unread notifications list successfully`() = runBlocking {
        val useCase = GetUnreadNotificationsUseCase(FakeRepo())
        val result = useCase()

        assertTrue(result.isSuccess)
        val list = result.getOrThrow()
        assertEquals(1, list.size)
        assertEquals(1, list[0].id)
        assertEquals(NotificationCategory.REWARD_TASK, list[0].category)
    }

    @Test
    fun `invoke propagates failure on repository error`() = runBlocking {
        val useCase = GetUnreadNotificationsUseCase(FakeRepo(shouldFail = true))
        val result = useCase()

        assertTrue(result.isFailure)
        assertEquals("Error al cargar notificaciones no leídas.", result.exceptionOrNull()?.message)
    }
}
