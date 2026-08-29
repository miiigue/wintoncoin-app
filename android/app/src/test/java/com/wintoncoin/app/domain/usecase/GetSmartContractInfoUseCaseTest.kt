// ============================================================================
// WintonCoin Android — GetSmartContractInfoUseCaseTest
// ============================================================================
// Pruebas unitarias para GetSmartContractInfoUseCase.
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

class GetSmartContractInfoUseCaseTest {

    private class FakeRepo : AccountStatementRepository {
        override suspend fun getAccountStatementSummary(): Result<AccountStatementSummary> =
            Result.success(AccountStatementSummary())
        override suspend fun getStatementTransactions(): Result<List<StatementTransaction>> =
            Result.success(emptyList())
        override suspend fun getBlockchainActivityStats(): Result<BlockchainActivityStats> =
            Result.success(BlockchainActivityStats())
        override suspend fun getSmartContractInfo(tokenType: String): Result<SmartContractInfo> =
            Result.success(
                SmartContractInfo(
                    tokenType = tokenType,
                    title = "WintonCoin $tokenType Token",
                    address = "0x1234567890abcdef1234567890abcdef12345678",
                    minted = "10.000.000,0000 $tokenType",
                    explorerUrl = "https://sepolia-optimism.etherscan.io/address/0x1234567890abcdef1234567890abcdef12345678"
                )
            )
        override suspend fun syncCollateral(
            operationType: String, amount: Double, tokenSymbol: String,
            tokenContractAddress: String, txHash: String, balanceAfter: Double?
        ): Result<Double> = Result.success(100.0)
    }

    @Test
    fun `invoke with valid BLUE returns contract info`() = runBlocking {
        val useCase = GetSmartContractInfoUseCase(FakeRepo())
        val result = useCase("blue")

        assertTrue(result.isSuccess)
        val info = result.getOrThrow()
        assertEquals("BLUE", info.tokenType)
        assertEquals("WintonCoin BLUE Token", info.title)
        assertTrue(info.address.startsWith("0x"))
    }

    @Test
    fun `invoke with valid RED returns contract info`() = runBlocking {
        val useCase = GetSmartContractInfoUseCase(FakeRepo())
        val result = useCase("RED")

        assertTrue(result.isSuccess)
        val info = result.getOrThrow()
        assertEquals("RED", info.tokenType)
        assertEquals("WintonCoin RED Token", info.title)
    }

    @Test
    fun `invoke with invalid token type returns error`() = runBlocking {
        val useCase = GetSmartContractInfoUseCase(FakeRepo())
        val result = useCase("INVALID_TOKEN")

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
    }
}
