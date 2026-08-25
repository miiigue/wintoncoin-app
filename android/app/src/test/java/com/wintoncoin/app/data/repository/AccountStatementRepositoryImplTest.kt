// ============================================================================
// WintonCoin Android — AccountStatementRepositoryImplTest
// ============================================================================
// Pruebas unitarias completas para AccountStatementRepositoryImpl.
// ============================================================================

package com.wintoncoin.app.data.repository

import com.wintoncoin.app.data.remote.api.AccountStatementApiService
import com.wintoncoin.app.data.remote.dto.CollateralSyncRequestDto
import com.wintoncoin.app.data.remote.dto.CollateralSyncResponseDto
import com.wintoncoin.app.data.remote.dto.ContractItemDto
import com.wintoncoin.app.data.remote.dto.ContractsResponseDto
import com.wintoncoin.app.data.remote.dto.TransactionStatementItemDto
import com.wintoncoin.app.data.remote.dto.WalletBalanceDto
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

class AccountStatementRepositoryImplTest {

    private class FakeApiService : AccountStatementApiService {
        var returnError = false
        var balanceDto = WalletBalanceDto(
            blueBalance = 2500.0,
            escrowBlueBalance = 300.0,
            redBalance = 40.0,
            web3WalletAddress = "0x1234567890123456789012345678901234567890",
            kycVerified = true,
            creditLimit = 200.0,
            collateralBalance = 50.0,
            nextUnlockAt = "2026-09-01T00:00:00Z",
            nextUnlockAmount = 300.0
        )
        var transactionsList = listOf(
            TransactionStatementItemDto(
                id = 101,
                createdAt = "2026-08-24T12:00:00Z",
                type = "payment_received",
                description = "Pago por tarea",
                blueChange = 100.0,
                redChange = 0.0,
                txHash = "0xhash1"
            ),
            TransactionStatementItemDto(
                id = 102,
                createdAt = "2026-08-24T13:00:00Z",
                type = "payment_sent",
                description = "Envío de propina",
                blueChange = -20.0,
                redChange = 0.0,
                txHash = "0xhash2"
            ),
            TransactionStatementItemDto(
                id = 103,
                createdAt = "2026-08-24T14:00:00Z",
                type = "burn",
                description = "Amortización de compromiso",
                blueChange = 0.0,
                redChange = -15.0,
                txHash = "0xhash3"
            )
        )
        var contractsDto = ContractsResponseDto(
            blue = ContractItemDto(address = "0xBlueAddress", minted = "10.000.000,0000 BLUE"),
            red = ContractItemDto(address = "0xRedAddress", minted = "5.000.000,0000 RED")
        )
        var syncResponse = CollateralSyncResponseDto(message = "OK", newCreditLimit = 250.0)

        override suspend fun getWalletBalance(): Response<WalletBalanceDto> {
            return if (returnError) {
                Response.error(500, "Error 500".toResponseBody("text/plain".toMediaTypeOrNull()))
            } else {
                Response.success(balanceDto)
            }
        }

        override suspend fun getTransactions(): Response<List<TransactionStatementItemDto>> {
            return if (returnError) {
                Response.error(500, "Error 500".toResponseBody("text/plain".toMediaTypeOrNull()))
            } else {
                Response.success(transactionsList)
            }
        }

        override suspend fun getContractsInfo(): Response<ContractsResponseDto> {
            return if (returnError) {
                Response.error(500, "Error 500".toResponseBody("text/plain".toMediaTypeOrNull()))
            } else {
                Response.success(contractsDto)
            }
        }

        override suspend fun syncCollateral(request: CollateralSyncRequestDto): Response<CollateralSyncResponseDto> {
            return if (returnError) {
                Response.error(500, "Error 500".toResponseBody("text/plain".toMediaTypeOrNull()))
            } else {
                Response.success(syncResponse)
            }
        }
    }

    @Test
    fun `getAccountStatementSummary calculates metrics and formatting correctly`() = runBlocking {
        val apiService = FakeApiService()
        val repository = AccountStatementRepositoryImpl(apiService)

        val result = repository.getAccountStatementSummary()

        assertTrue(result.isSuccess)
        val summary = result.getOrThrow()
        assertEquals(2500.0, summary.blueAvailable, 0.0001)
        assertEquals(300.0, summary.blueEscrow, 0.0001)
        assertEquals(2800.0, summary.fiatEstimatedUsd, 0.0001)
        assertEquals(200.0, summary.redCreditLimit, 0.0001)
        assertEquals(160.0, summary.redCreditAvailable, 0.0001) // 200 - 40
        assertEquals(150.0, summary.organicScore, 0.0001) // 200 - 50
        assertEquals(50.0, summary.collateralBalance, 0.0001)
        assertTrue(summary.hasValidWeb3Address)
        assertTrue(summary.kycVerified)
    }

    @Test
    fun `getBlockchainActivityStats correctly categorizes transaction types`() = runBlocking {
        val apiService = FakeApiService()
        val repository = AccountStatementRepositoryImpl(apiService)

        val result = repository.getBlockchainActivityStats()

        assertTrue(result.isSuccess)
        val stats = result.getOrThrow()
        assertEquals(3, stats.totalInteractions)
        assertEquals(1, stats.paymentsReceived)
        assertEquals(1, stats.paymentsSent)
        assertEquals(1, stats.commitmentsAmortized)
    }

    @Test
    fun `getSmartContractInfo for BLUE and RED builds valid model`() = runBlocking {
        val apiService = FakeApiService()
        val repository = AccountStatementRepositoryImpl(apiService)

        val blueResult = repository.getSmartContractInfo("BLUE")
        assertTrue(blueResult.isSuccess)
        val blue = blueResult.getOrThrow()
        assertEquals("BLUE", blue.tokenType)
        assertEquals("0xBlueAddress", blue.address)
        assertEquals("10.000.000,0000 BLUE", blue.minted)
        assertEquals("https://sepolia-optimism.etherscan.io/address/0xBlueAddress", blue.explorerUrl)

        val redResult = repository.getSmartContractInfo("RED")
        assertTrue(redResult.isSuccess)
        val red = redResult.getOrThrow()
        assertEquals("RED", red.tokenType)
        assertEquals("0xRedAddress", red.address)
        assertEquals("https://sepolia-optimism.etherscan.io/address/0xRedAddress", red.explorerUrl)
    }

    @Test
    fun `syncCollateral returns new credit limit on API success`() = runBlocking {
        val apiService = FakeApiService()
        val repository = AccountStatementRepositoryImpl(apiService)

        val result = repository.syncCollateral("deposit", 50.0, "USDT", "0xToken", "0xHash", 50.0)

        assertTrue(result.isSuccess)
        assertEquals(250.0, result.getOrThrow(), 0.0001)
    }

    @Test
    fun `repository handles API failures gracefully`() = runBlocking {
        val apiService = FakeApiService().apply { returnError = true }
        val repository = AccountStatementRepositoryImpl(apiService)

        val summaryResult = repository.getAccountStatementSummary()
        val txsResult = repository.getStatementTransactions()
        val statsResult = repository.getBlockchainActivityStats()
        val contractResult = repository.getSmartContractInfo("BLUE")
        val syncResult = repository.syncCollateral("deposit", 50.0, "USDT", "0xToken", "0xHash", null)

        assertFalse(summaryResult.isSuccess)
        assertFalse(txsResult.isSuccess)
        assertFalse(statsResult.isSuccess)
        assertFalse(contractResult.isSuccess)
        assertFalse(syncResult.isSuccess)
    }
}
