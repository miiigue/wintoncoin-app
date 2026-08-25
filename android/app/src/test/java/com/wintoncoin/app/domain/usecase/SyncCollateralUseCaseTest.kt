// ============================================================================
// WintonCoin Android — SyncCollateralUseCaseTest
// ============================================================================
// Pruebas unitarias de validación y seguridad para SyncCollateralUseCase.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.AccountStatementSummary
import com.wintoncoin.app.domain.model.BlockchainActivityStats
import com.wintoncoin.app.domain.model.SmartContractInfo
import com.wintoncoin.app.domain.model.StatementTransaction
import com.wintoncoin.app.domain.repository.AccountStatementRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SyncCollateralUseCaseTest {

    private class FakeRepo(private val shouldFail: Boolean = false) : AccountStatementRepository {
        override suspend fun getAccountStatementSummary(): Result<AccountStatementSummary> =
            Result.success(AccountStatementSummary())
        override suspend fun getStatementTransactions(): Result<List<StatementTransaction>> =
            Result.success(emptyList())
        override suspend fun getBlockchainActivityStats(): Result<BlockchainActivityStats> =
            Result.success(BlockchainActivityStats())
        override suspend fun getSmartContractInfo(tokenType: String): Result<SmartContractInfo> =
            Result.success(SmartContractInfo(tokenType, "Token", "0x...", "1000", ""))
        override suspend fun syncCollateral(
            operationType: String, amount: Double, tokenSymbol: String,
            tokenContractAddress: String, txHash: String, balanceAfter: Double?
        ): Result<Double> {
            return if (shouldFail) {
                Result.failure(Exception("Error en el servidor al procesar garantía."))
            } else {
                Result.success(amount + 100.0)
            }
        }
    }

    @Test
    fun `deposit with valid inputs returns updated credit limit`() = runBlocking {
        val useCase = SyncCollateralUseCase(FakeRepo())
        val result = useCase(
            operationType = "deposit",
            amount = 50.0,
            tokenSymbol = "USDT",
            tokenContractAddress = "0xTokenAddress1234567890123456789012345678",
            txHash = "0xTxHash12345678901234567890123456789012345678",
            balanceAfter = 50.0
        )

        assertTrue(result.isSuccess)
        assertEquals(150.0, result.getOrThrow(), 0.0001)
    }

    @Test
    fun `withdraw with valid inputs returns updated credit limit`() = runBlocking {
        val useCase = SyncCollateralUseCase(FakeRepo())
        val result = useCase(
            operationType = "withdraw",
            amount = 20.0,
            tokenSymbol = "USDC",
            tokenContractAddress = "0xTokenAddress1234567890123456789012345678",
            txHash = "0xTxHash12345678901234567890123456789012345678",
            balanceAfter = 0.0
        )

        assertTrue(result.isSuccess)
        assertEquals(120.0, result.getOrThrow(), 0.0001)
    }

    @Test
    fun `operation with zero or negative amount fails validation`() = runBlocking {
        val useCase = SyncCollateralUseCase(FakeRepo())
        val zeroResult = useCase("deposit", 0.0, "USDT", "0x...", "0xhash", null)
        val negativeResult = useCase("deposit", -15.0, "USDT", "0x...", "0xhash", null)

        assertTrue(zeroResult.isFailure)
        assertTrue(zeroResult.exceptionOrNull() is IllegalArgumentException)
        assertTrue(negativeResult.isFailure)
        assertTrue(negativeResult.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    fun `operation with invalid operationType fails validation`() = runBlocking {
        val useCase = SyncCollateralUseCase(FakeRepo())
        val result = useCase("transfer", 50.0, "USDT", "0x...", "0xhash", null)

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    fun `operation with blank tokenContractAddress fails validation`() = runBlocking {
        val useCase = SyncCollateralUseCase(FakeRepo())
        val result = useCase("deposit", 50.0, "USDT", "   ", "0xhash", null)

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    fun `operation with blank txHash fails validation`() = runBlocking {
        val useCase = SyncCollateralUseCase(FakeRepo())
        val result = useCase("deposit", 50.0, "USDT", "0xTokenAddress", "", null)

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    fun `server error propagates failure result`() = runBlocking {
        val useCase = SyncCollateralUseCase(FakeRepo(shouldFail = true))
        val result = useCase("deposit", 50.0, "USDT", "0xTokenAddress", "0xTxHash", null)

        assertTrue(result.isFailure)
        assertEquals("Error en el servidor al procesar garantía.", result.exceptionOrNull()?.message)
    }
}
