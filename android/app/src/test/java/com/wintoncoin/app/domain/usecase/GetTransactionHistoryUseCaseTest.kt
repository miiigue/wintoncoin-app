// ============================================================================
// WintonCoin Android — GetTransactionHistoryUseCaseTest (Prueba Unitaria)
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.TransactionItem
import com.wintoncoin.app.domain.model.TransactionType
import com.wintoncoin.app.domain.repository.WalletRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GetTransactionHistoryUseCaseTest {

    private val walletRepository: WalletRepository = mockk()
    private lateinit var useCase: GetTransactionHistoryUseCase

    @Before
    fun setUp() {
        useCase = GetTransactionHistoryUseCase(walletRepository)
    }

    @Test
    fun `successful call returns list of transaction movements`() = runTest {
        val expectedTransactions = listOf(
            TransactionItem("1", "Tarea completada", 15.0, TransactionType.EARNED, "2026-08-16", "confirmed_paid"),
            TransactionItem("2", "Publicación creada", 10.0, TransactionType.SPENT, "2026-08-15", "open")
        )
        coEvery { walletRepository.getMyHistory() } returns Result.Success(expectedTransactions)

        val result = useCase()

        assertTrue(result is Result.Success)
        assertEquals(2, (result as Result.Success).data.size)
        assertEquals(TransactionType.EARNED, result.data[0].type)
        coVerify(exactly = 1) { walletRepository.getMyHistory() }
    }
}
