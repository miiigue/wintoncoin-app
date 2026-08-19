// ============================================================================
// WintonCoin Android — WalletRepositoryImplTest (Prueba Unitaria de Repositorio)
// ============================================================================

package com.wintoncoin.app.data.repository

import com.wintoncoin.app.data.remote.api.WalletApiService
import com.wintoncoin.app.data.remote.dto.HistoryTaskItemDto
import com.wintoncoin.app.data.remote.dto.WalletBalanceDto
import com.wintoncoin.app.data.remote.dto.WalletHistoryResponseDto
import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.TransactionType
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

class WalletRepositoryImplTest {

    private val walletApiService: WalletApiService = mockk()
    private lateinit var repository: WalletRepositoryImpl

    @Before
    fun setUp() {
        repository = WalletRepositoryImpl(walletApiService)
    }

    @Test
    fun `getMyBalance success calculates credit metrics correctly`() = runTest {
        val dto = WalletBalanceDto(
            blueBalance = 1000.0,
            escrowBlueBalance = 150.0,
            redBalance = 100.0,
            creditLimit = 400.0,
            collateralBalance = 50.0,
            web3WalletAddress = "0x1234567890abcdef1234567890abcdef12345678",
            kycVerified = true
        )
        coEvery { walletApiService.getMyBalance() } returns Response.success(dto)

        val result = repository.getMyBalance()

        assertTrue(result is Result.Success)
        val balance = (result as Result.Success).data
        assertEquals(1000.0, balance.blueAvailable, 0.01)
        assertEquals(150.0, balance.blueEscrow, 0.01)
        assertEquals(100.0, balance.redDebt, 0.01)
        assertEquals(400.0, balance.redLimit, 0.01)
        // redAvailable = max(0, creditLimit - redDebt) = 400 - 100 = 300
        assertEquals(300.0, balance.redAvailable, 0.01)
        assertEquals(50.0, balance.collateralBalance, 0.01)
        assertTrue(balance.kycVerified)
    }

    @Test
    fun `getMyHistory maps completed and authored tasks to unified transactions`() = runTest {
        val historyDto = WalletHistoryResponseDto(
            completed = listOf(HistoryTaskItemDto(id = 1, title = "Tarea Completada", blueCost = 20.0, createdAt = "2026-08-16T12:00:00Z")),
            authored = listOf(HistoryTaskItemDto(id = 2, title = "Tarea Creada", blueCost = 15.0, createdAt = "2026-08-15T12:00:00Z"))
        )
        coEvery { walletApiService.getMyHistory() } returns Response.success(historyDto)

        val result = repository.getMyHistory()

        assertTrue(result is Result.Success)
        val list = (result as Result.Success).data
        assertEquals(2, list.size)
        assertEquals(TransactionType.EARNED, list[0].type)
        assertEquals(TransactionType.SPENT, list[1].type)
    }
}
