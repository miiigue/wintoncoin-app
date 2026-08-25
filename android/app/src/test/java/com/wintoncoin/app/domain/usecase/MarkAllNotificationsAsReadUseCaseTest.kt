// ============================================================================
// WintonCoin Android — MarkAllNotificationsAsReadUseCaseTest
// ============================================================================
// Pruebas unitarias para MarkAllNotificationsAsReadUseCase.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.NotificationItem
import com.wintoncoin.app.domain.repository.NotificationRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MarkAllNotificationsAsReadUseCaseTest {

    private class FakeRepo(private val shouldFail: Boolean = false) : NotificationRepository {
        override suspend fun getUnreadNotifications(): Result<List<NotificationItem>> = Result.success(emptyList())
        override suspend fun getNotificationsHistory(): Result<List<NotificationItem>> = Result.success(emptyList())

        override suspend fun markAllAsRead(): Result<Int> {
            return if (shouldFail) {
                Result.failure(Exception("Error al marcar como leídas."))
            } else {
                Result.success(5)
            }
        }

        override suspend fun dismissNotification(id: Int): Result<Unit> = Result.success(Unit)
    }

    @Test
    fun `invoke returns count of updated notifications`() = runBlocking {
        val useCase = MarkAllNotificationsAsReadUseCase(FakeRepo())
        val result = useCase()

        assertTrue(result.isSuccess)
        assertEquals(5, result.getOrThrow())
    }

    @Test
    fun `invoke propagates failure on repository error`() = runBlocking {
        val useCase = MarkAllNotificationsAsReadUseCase(FakeRepo(shouldFail = true))
        val result = useCase()

        assertTrue(result.isFailure)
        assertEquals("Error al marcar como leídas.", result.exceptionOrNull()?.message)
    }
}
