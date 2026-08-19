// ============================================================================
// WintonCoin Android — Tests Unitarios de Casos de Uso del Marketplace
// ============================================================================
// [UNIT TEST] Pruebas unitarias para validar las reglas de negocio de los casos
// de uso de Marketplace, Detalle, Postulación, Culminación y Confirmación.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.MarketplaceCategory
import com.wintoncoin.app.domain.model.PublicationItem
import com.wintoncoin.app.domain.model.TaskAcceptanceStatus
import com.wintoncoin.app.domain.repository.MarketplaceRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class MarketplaceUseCasesTest {

    private val repository: MarketplaceRepository = mockk()

    private lateinit var getFeedUseCase: GetMarketplaceFeedUseCase
    private lateinit var getDetailsUseCase: GetPublicationDetailsUseCase
    private lateinit var applyUseCase: ApplyToPublicationUseCase
    private lateinit var completeUseCase: CompleteTaskUseCase
    private lateinit var confirmPaymentUseCase: ConfirmTaskPaymentUseCase

    @Before
    fun setup() {
        getFeedUseCase = GetMarketplaceFeedUseCase(repository)
        getDetailsUseCase = GetPublicationDetailsUseCase(repository)
        applyUseCase = ApplyToPublicationUseCase(repository)
        completeUseCase = CompleteTaskUseCase(repository)
        confirmPaymentUseCase = ConfirmTaskPaymentUseCase(repository)
    }

    @Test
    fun `GetMarketplaceFeedUseCase delegates to repository`() = runTest {
        // Arrange
        coEvery { repository.getMarketplaceFeed("test", MarketplaceCategory.TASK) } returns Result.success(emptyList())

        // Act
        val result = getFeedUseCase("test", MarketplaceCategory.TASK)

        // Assert
        assertTrue(result.isSuccess)
    }

    @Test
    fun `GetPublicationDetailsUseCase fails if id is blank`() = runTest {
        // Act
        val result = getDetailsUseCase("")

        // Assert
        assertTrue(result.isFailure)
    }

    @Test
    fun `ApplyToPublicationUseCase validates blank id`() = runTest {
        // Act
        val result = applyUseCase("   ")

        // Assert
        assertTrue(result.isFailure)
    }

    @Test
    fun `CompleteTaskUseCase executes successfully with valid id`() = runTest {
        // Arrange
        coEvery { repository.completeTask("10", listOf("url1")) } returns Result.success("OK")

        // Act
        val result = completeUseCase("10", listOf("url1"))

        // Assert
        assertTrue(result.isSuccess)
        assertEquals("OK", result.getOrNull())
    }

    @Test
    fun `ConfirmTaskPaymentUseCase fails when parameters are empty`() = runTest {
        // Act
        val result = confirmPaymentUseCase("10", "")

        // Assert
        assertTrue(result.isFailure)
    }
}
