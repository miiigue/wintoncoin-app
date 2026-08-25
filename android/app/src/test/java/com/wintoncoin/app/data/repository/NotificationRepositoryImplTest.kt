// ============================================================================
// WintonCoin Android — NotificationRepositoryImplTest
// ============================================================================
// Pruebas unitarias completas para NotificationRepositoryImpl.
// ============================================================================

package com.wintoncoin.app.data.repository

import com.wintoncoin.app.data.remote.api.NotificationApiService
import com.wintoncoin.app.data.remote.dto.NotificationDismissResponseDto
import com.wintoncoin.app.data.remote.dto.NotificationDto
import com.wintoncoin.app.data.remote.dto.NotificationMarkReadResponseDto
import com.wintoncoin.app.domain.model.NotificationCategory
import com.wintoncoin.app.domain.model.NotificationNavigationTarget
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

class NotificationRepositoryImplTest {

    private class FakeApiService : NotificationApiService {
        var returnError = false
        var unreadList = listOf(
            NotificationDto(
                id = 1,
                recipientUsername = "testuser",
                message = "¡Has acumulado 100.0000 BLUE IOU en tu Perfil de Impulsor!",
                isRead = false,
                createdAt = "2026-08-24T12:00:00.000Z"
            ),
            NotificationDto(
                id = 2,
                recipientUsername = "testuser",
                message = "¡Has sido aprobado automáticamente para la tarea!",
                isRead = false,
                createdAt = "2026-08-24T13:00:00.000Z"
            )
        )
        var historyList = listOf(
            NotificationDto(
                id = 1,
                recipientUsername = "testuser",
                message = "¡Has acumulado 100.0000 BLUE IOU en tu Perfil de Impulsor!",
                isRead = false,
                createdAt = "2026-08-24T12:00:00.000Z"
            ),
            NotificationDto(
                id = 3,
                recipientUsername = "testuser",
                message = "Se realizó una quema automática de 10.0000 tokens para cubrir tu compromiso vencido.",
                isRead = true,
                createdAt = "2026-08-23T10:00:00.000Z"
            )
        )

        override suspend fun getUnreadNotifications(): Response<List<NotificationDto>> {
            return if (returnError) {
                Response.error(500, "Error 500".toResponseBody("text/plain".toMediaTypeOrNull()))
            } else {
                Response.success(unreadList)
            }
        }

        override suspend fun getNotificationsHistory(): Response<List<NotificationDto>> {
            return if (returnError) {
                Response.error(500, "Error 500".toResponseBody("text/plain".toMediaTypeOrNull()))
            } else {
                Response.success(historyList)
            }
        }

        override suspend fun markAllAsRead(): Response<NotificationMarkReadResponseDto> {
            return if (returnError) {
                Response.error(500, "Error 500".toResponseBody("text/plain".toMediaTypeOrNull()))
            } else {
                Response.success(NotificationMarkReadResponseDto(success = true, count = 2))
            }
        }

        override suspend fun dismissNotification(id: Int): Response<NotificationDismissResponseDto> {
            return if (returnError) {
                Response.error(500, "Error 500".toResponseBody("text/plain".toMediaTypeOrNull()))
            } else {
                Response.success(NotificationDismissResponseDto(message = "Notificación descartada."))
            }
        }
    }

    @Test
    fun `getUnreadNotifications maps DTO to domain model with smart categories`() = runBlocking {
        val apiService = FakeApiService()
        val repository = NotificationRepositoryImpl(apiService)

        val result = repository.getUnreadNotifications()

        assertTrue(result.isSuccess)
        val list = result.getOrThrow()
        assertEquals(2, list.size)

        // Item 1: Recompensa de Impulsor
        assertEquals(1, list[0].id)
        assertEquals(NotificationCategory.REWARD_TASK, list[0].category)
        assertEquals(NotificationNavigationTarget.BOOSTER_PROFILE, list[0].navigationTarget)
        assertEquals("💰", list[0].iconEmoji)
        assertFalse(list[0].isRead)

        // Item 2: Aprobación
        assertEquals(2, list[1].id)
        assertEquals(NotificationCategory.APPROVAL, list[1].category)
        assertEquals(NotificationNavigationTarget.BOOSTER_PROFILE, list[1].navigationTarget)
        assertEquals("🎉", list[1].iconEmoji)
    }

    @Test
    fun `getNotificationsHistory maps history with warning category`() = runBlocking {
        val apiService = FakeApiService()
        val repository = NotificationRepositoryImpl(apiService)

        val result = repository.getNotificationsHistory()

        assertTrue(result.isSuccess)
        val list = result.getOrThrow()
        assertEquals(2, list.size)

        // Item 3: Alerta de compromiso / quema
        assertEquals(3, list[1].id)
        assertEquals(NotificationCategory.SECURITY_WARNING, list[1].category)
        assertEquals(NotificationNavigationTarget.ACCOUNT_STATEMENT, list[1].navigationTarget)
        assertEquals("⚠️", list[1].iconEmoji)
        assertTrue(list[1].isRead)
    }

    @Test
    fun `markAllAsRead returns updated count on success`() = runBlocking {
        val apiService = FakeApiService()
        val repository = NotificationRepositoryImpl(apiService)

        val result = repository.markAllAsRead()

        assertTrue(result.isSuccess)
        assertEquals(2, result.getOrThrow())
    }

    @Test
    fun `dismissNotification returns success`() = runBlocking {
        val apiService = FakeApiService()
        val repository = NotificationRepositoryImpl(apiService)

        val result = repository.dismissNotification(1)

        assertTrue(result.isSuccess)
    }

    @Test
    fun `repository propagates API errors gracefully`() = runBlocking {
        val apiService = FakeApiService().apply { returnError = true }
        val repository = NotificationRepositoryImpl(apiService)

        assertFalse(repository.getUnreadNotifications().isSuccess)
        assertFalse(repository.getNotificationsHistory().isSuccess)
        assertFalse(repository.markAllAsRead().isSuccess)
        assertFalse(repository.dismissNotification(1).isSuccess)
    }

    @Test
    fun `categorizeNotification classifies various FinTech phrases correctly`() {
        val (transferCat, transferTarget, transferEmoji) = NotificationRepositoryImpl.categorizeNotification("Has recibido 25.0000 BLUE por transferencia.")
        assertEquals(NotificationCategory.TRANSFER, transferCat)
        assertEquals(NotificationNavigationTarget.WALLET, transferTarget)
        assertEquals("💸", transferEmoji)

        val (requestCat, requestTarget, requestEmoji) = NotificationRepositoryImpl.categorizeNotification("El usuario pepe quiere participar en tu tarea.")
        assertEquals(NotificationCategory.REQUEST, requestCat)
        assertEquals(NotificationNavigationTarget.PUBLICATIONS, requestTarget)
        assertEquals("📩", requestEmoji)

        val (generalCat, generalTarget, generalEmoji) = NotificationRepositoryImpl.categorizeNotification("¡Bienvenido a WintonCoin!")
        assertEquals(NotificationCategory.GENERAL_INFO, generalCat)
        assertEquals(NotificationNavigationTarget.NONE, generalTarget)
        assertEquals("🔔", generalEmoji)
    }
}
