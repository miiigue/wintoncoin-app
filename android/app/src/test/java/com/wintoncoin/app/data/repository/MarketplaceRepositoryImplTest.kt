// ============================================================================
// WintonCoin Android — Tests Unitarios de MarketplaceRepositoryImpl
// ============================================================================
// [UNIT TEST] Pruebas de integración para la combinación de feeds (Marketplace + Solidario),
// saneamiento de URLs multimedia y ejecución de transacciones P2P.
// ============================================================================

package com.wintoncoin.app.data.repository

import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.data.remote.api.MarketplaceApiService
import com.wintoncoin.app.data.remote.dto.AcceptPublicationRequest
import com.wintoncoin.app.data.remote.dto.CompleteTaskRequest
import com.wintoncoin.app.data.remote.dto.ConfirmPaymentRequest
import com.wintoncoin.app.data.remote.dto.HumanitarianCauseDto
import com.wintoncoin.app.data.remote.dto.HumanitarianCausesResponseDto
import com.wintoncoin.app.data.remote.dto.MarketplaceActionResponseDto
import com.wintoncoin.app.data.remote.dto.PublicationDto
import com.wintoncoin.app.domain.model.MarketplaceCategory
import com.wintoncoin.app.domain.model.TaskAcceptanceStatus
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

class MarketplaceRepositoryImplTest {

    private val apiService: MarketplaceApiService = mockk()
    private val tokenManager: TokenManager = mockk()
    private lateinit var repository: MarketplaceRepositoryImpl

    @Before
    fun setup() {
        every { tokenManager.getUsername() } returns "testuser"
        repository = MarketplaceRepositoryImpl(apiService, tokenManager)
    }

    @Test
    fun `getMarketplaceFeed combines publications and approved causes with correct priorities`() = runTest {
        // Arrange
        val pubDto = PublicationDto(
            id = "101",
            title = "Revisar smart contract",
            description = "Auditoría básica",
            blueCost = 50.0,
            category = "task",
            authorUsername = "alice",
            imageUrls = listOf("https://r2.cloudflare.com/uploads/photo.jpg", "https://instagram.com/bad.html"),
            userAcceptanceStatus = "approved"
        )
        val causeDto = HumanitarianCauseDto(
            id = 1,
            title = "Ayuda Comunitaria",
            story = "Donaciones para comedor",
            goalAmount = 500.0,
            currentAmount = 100.0,
            evidenceUrls = "https://r2.cloudflare.com/uploads/evidence.png"
        )

        coEvery { apiService.getActivePublications("testuser", any(), any()) } returns Response.success(listOf(pubDto))
        coEvery { apiService.getApprovedCauses() } returns Response.success(
            HumanitarianCausesResponseDto(success = true, causes = listOf(causeDto))
        )

        // Act
        val result = repository.getMarketplaceFeed()

        // Assert
        assertTrue(result.isSuccess)
        val items = result.getOrNull()!!
        assertEquals(2, items.size)

        // La causa solidaria debe tener prioridad -1 (estar al principio de la lista)
        assertEquals("cause-1", items[0].id)
        assertTrue(items[0].isHumanitarianCause)
        assertEquals(MarketplaceCategory.DONATION, items[0].category)
        assertEquals(1, items[0].imageUrls.size)

        // La publicación regular debe haber saneado la URL rota de instagram
        assertEquals("101", items[1].id)
        assertEquals(1, items[1].imageUrls.size)
        assertEquals("https://r2.cloudflare.com/uploads/photo.jpg", items[1].imageUrls[0])
        assertEquals(TaskAcceptanceStatus.APPROVED, items[1].userAcceptanceStatus)
    }

    @Test
    fun `acceptPublication sends correct payload and returns success message`() = runTest {
        // Arrange
        coEvery {
            apiService.acceptPublication("101", AcceptPublicationRequest("testuser", 25.0))
        } returns Response.success(MarketplaceActionResponseDto(message = "Postulación exitosa", success = true))

        // Act
        val result = repository.acceptPublication("101", 25.0)

        // Assert
        assertTrue(result.isSuccess)
        assertEquals("Postulación exitosa", result.getOrNull())
        coVerify { apiService.acceptPublication("101", AcceptPublicationRequest("testuser", 25.0)) }
    }

    @Test
    fun `completeTask sends evidence URLs and returns success`() = runTest {
        // Arrange
        val evidences = listOf("https://r2.cloudflare.com/uploads/proof.png")
        coEvery {
            apiService.completeTask("101", CompleteTaskRequest("testuser", evidences))
        } returns Response.success(MarketplaceActionResponseDto(message = "Tarea completada", success = true))

        // Act
        val result = repository.completeTask("101", evidences)

        // Assert
        assertTrue(result.isSuccess)
        assertEquals("Tarea completada", result.getOrNull())
    }

    @Test
    fun `confirmPayment releases funds to worker`() = runTest {
        // Arrange
        coEvery {
            apiService.confirmPayment("101", ConfirmPaymentRequest("testuser", "bob"))
        } returns Response.success(MarketplaceActionResponseDto(message = "Fondos liberados", success = true))

        // Act
        val result = repository.confirmPayment("101", "bob")

        // Assert
        assertTrue(result.isSuccess)
        assertEquals("Fondos liberados", result.getOrNull())
    }
}
