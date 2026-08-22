// ============================================================================
// WintonCoin Android — CreateQuickSaleUseCaseTest (Pruebas Unitarias)
// ============================================================================
// [TEST / DOMAIN] Valida las restricciones de negocio para Ventas Rápidas.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.data.remote.dto.CreateQuickSaleRequest
import com.wintoncoin.app.domain.repository.MarketplaceRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class CreateQuickSaleUseCaseTest {

    private lateinit var repository: MarketplaceRepository
    private lateinit var useCase: CreateQuickSaleUseCase

    @Before
    fun setUp() {
        repository = mockk()
        useCase = CreateQuickSaleUseCase(repository)
    }

    @Test
    fun `quick sale with zero or negative amount returns error`() = runTest {
        val request = CreateQuickSaleRequest(
            title = "Venta Rápida",
            amount = 0.0,
            authorUsername = "migue"
        )

        val result = useCase(request)
        assertTrue(result.isFailure)
        assertEquals("El monto de la venta rápida debe ser mayor a 0.", result.exceptionOrNull()?.message)
    }

    @Test
    fun `quick sale with same target user as author returns error`() = runTest {
        val request = CreateQuickSaleRequest(
            title = "Venta Rápida",
            amount = 50.0,
            authorUsername = "migue",
            targetUsername = "MIGUE"
        )

        val result = useCase(request)
        assertTrue(result.isFailure)
        assertEquals("No puedes crearte una venta rápida a ti mismo.", result.exceptionOrNull()?.message)
    }

    @Test
    fun `valid quick sale calls repository and returns success`() = runTest {
        val request = CreateQuickSaleRequest(
            title = "Venta Rápida USDT",
            amount = 100.0,
            authorUsername = "migue",
            targetUsername = "carlos"
        )

        coEvery { repository.createQuickSale(any()) } returns Result.success("Venta Rápida creada con éxito.")

        val result = useCase(request)
        assertTrue(result.isSuccess)
        assertEquals("Venta Rápida creada con éxito.", result.getOrNull())
        coVerify(exactly = 1) { repository.createQuickSale(any()) }
    }
}
