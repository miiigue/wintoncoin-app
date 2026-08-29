// ============================================================================
// WintonCoin Android — GetAccountStatementUseCaseTest
// ============================================================================
// Pruebas unitarias para el caso de uso GetAccountStatementUseCase.
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

class GetAccountStatementUseCaseTest {

    private val fakeSummary = AccountStatementSummary(
        blueAvailable = 1500.0,
        blueEscrow = 500.0,
        redCreditLimit = 100.0,
        redCreditAvailable = 70.0,
        redDebtTotal = 30.0,
        organicScore = 100.0,
        collateralBalance = 0.0,
        web3WalletAddress = "0x1234567890abcdef1234567890abcdef12345678",
        kycVerified = true
    )

    private val fakeStats = BlockchainActivityStats(
        totalInteractions = 10,
        paymentsReceived = 6,
        paymentsSent = 3,
        commitmentsAmortized = 1
    )

    private val fakeTransactions = listOf(
        StatementTransaction(
            id = 1,
            createdAt = "2026-08-24T10:00:00Z",
            type = "payment_received",
            description = "Pago por tarea",
            blueChange = 50.0,
            redChange = 0.0,
            txHash = "0xabc123"
        )
    )

    private class FakeSuccessRepo(
        private val summary: AccountStatementSummary,
        private val stats: BlockchainActivityStats,
        private val txs: List<StatementTransaction>
    ) : AccountStatementRepository {
        override suspend fun getAccountStatementSummary(): Result<AccountStatementSummary> = Result.success(summary)
        override suspend fun getStatementTransactions(): Result<List<StatementTransaction>> = Result.success(txs)
        override suspend fun getBlockchainActivityStats(): Result<BlockchainActivityStats> = Result.success(stats)
        override suspend fun getSmartContractInfo(tokenType: String): Result<SmartContractInfo> =
            Result.success(SmartContractInfo(tokenType, "Test Token", "0x...", "1000", ""))
        override suspend fun syncCollateral(
            operationType: String, amount: Double, tokenSymbol: String,
            tokenContractAddress: String, txHash: String, balanceAfter: Double?
        ): Result<Double> = Result.success(150.0)
    }

    private class FakeFailureRepo : AccountStatementRepository {
        override suspend fun getAccountStatementSummary(): Result<AccountStatementSummary> =
            Result.failure(Exception("Error de conexión"))
        override suspend fun getStatementTransactions(): Result<List<StatementTransaction>> =
            Result.failure(Exception("Error"))
        override suspend fun getBlockchainActivityStats(): Result<BlockchainActivityStats> =
            Result.failure(Exception("Error"))
        override suspend fun getSmartContractInfo(tokenType: String): Result<SmartContractInfo> =
            Result.failure(Exception("Error"))
        override suspend fun syncCollateral(
            operationType: String, amount: Double, tokenSymbol: String,
            tokenContractAddress: String, txHash: String, balanceAfter: Double?
        ): Result<Double> = Result.failure(Exception("Error"))
    }

    @Test
    fun `invoke returns aggregated account statement data successfully`() = runBlocking {
        val repo = FakeSuccessRepo(fakeSummary, fakeStats, fakeTransactions)
        val useCase = GetAccountStatementUseCase(repo)

        val result = useCase()

        assertTrue(result.isSuccess)
        val data = result.getOrThrow()
        assertEquals(1500.0, data.summary.blueAvailable, 0.0001)
        assertEquals(2000.0, data.summary.fiatEstimatedUsd, 0.0001)
        assertEquals(10, data.stats.totalInteractions)
        assertEquals(1, data.transactions.size)
        assertEquals("0xabc123", data.transactions[0].txHash)
    }

    @Test
    fun `invoke returns failure when summary fails`() = runBlocking {
        val repo = FakeFailureRepo()
        val useCase = GetAccountStatementUseCase(repo)

        val result = useCase()

        assertTrue(result.isFailure)
        assertEquals("Error de conexión", result.exceptionOrNull()?.message)
    }
}
