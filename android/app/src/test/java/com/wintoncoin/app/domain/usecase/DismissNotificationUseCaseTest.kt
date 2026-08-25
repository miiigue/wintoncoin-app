// ============================================================================
// WintonCoin Android — DismissNotificationUseCaseTest
// ============================================================================
// Pruebas unitarias para DismissNotificationUseCase.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.NotificationItem
import com.wintoncoin.app.domain.repository.NotificationRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DismissNotificationUseCaseTest {

    private class FakeRepo(private val shouldFail: Boolean = false) : NotificationRepository {
        override suspend fun getUnreadNotifications(): Result<List<NotificationItem>> = Result.success(emptyList())
        override suspend fun getNotificationsHistory(): Result<List<NotificationItem>> = Result.success(emptyList())
        override suspend fun markAllAsRead(): Result<Int> = Result.success(0)

        override suspend fun dismissNotification(id: Int): Result<Unit> {
            return if (shouldFail) {
                Result.failure(Exception("Error al descartar notificación en servidor."))
            } else {
                Result.success(Unit)
            }
        }
    }

    @Test
    fun `dismiss with valid id returns success`() = runBlocking {
        val useCase = DismissNotificationUseCase(FakeRepo())
        val result = useCase(42)

        assertTrue(result.isSuccess)
    }

    @Test
    fun `dismiss with zero or negative id fails validation`() = runBlocking {
        val useCase = DismissNotificationUseCase(FakeRepo())
        val zeroResult = useCase(0)
        val negativeResult = useCase(-5)

        assertTrue(zeroResult.isFailure)
        assertTrue(zeroResult.exceptionOrNull() is IllegalArgumentException)
        assertTrue(negativeResult.isFailure)
        assertTrue(negativeResult.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    fun `dismiss propagates failure on repository error`() = runBlocking {
        val useCase = DismissNotificationUseCase(FakeRepo(shouldFail = true))
        val result = useCase(42)

        assertTrue(result.isFailure)
        assertEquals("Error al descartar notificación en servidor.", result.exceptionOrNull()?.message)
    }
}
