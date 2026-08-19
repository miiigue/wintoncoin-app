// ============================================================================
// WintonCoin Android — GetWalletBalanceUseCaseTest (Prueba Unitaria)
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.WalletBalance
import com.wintoncoin.app.domain.repository.WalletRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GetWalletBalanceUseCaseTest {

    private val walletRepository: WalletRepository = mockk()
    private lateinit var useCase: GetWalletBalanceUseCase

    @Before
    fun setUp() {
        useCase = GetWalletBalanceUseCase(walletRepository)
    }

    @Test
    fun `successful repository call returns WalletBalance with credit metrics`() = runTest {
        val expectedBalance = WalletBalance(
            blueAvailable = 1500.0,
            blueEscrow = 200.0,
            redDebt = 100.0,
            redLimit = 500.0,
            redAvailable = 400.0,
            collateralBalance = 50.0,
            kycVerified = true
        )
        coEvery { walletRepository.getMyBalance() } returns Result.Success(expectedBalance)

        val result = useCase()

        assertTrue(result is Result.Success)
        assertEquals(expectedBalance, (result as Result.Success).data)
        coVerify(exactly = 1) { walletRepository.getMyBalance() }
    }
}
