// ============================================================================
// WintonCoin Android — AccountStatementRepositoryImpl
// ============================================================================
// [DATA LAYER / REPOSITORY] Implementación concreta que consume AccountStatementApiService,
// realiza mapeos defensivos y calcula métricas financieras de actividad Web3.
// ============================================================================

package com.wintoncoin.app.data.repository

import com.wintoncoin.app.data.remote.api.AccountStatementApiService
import com.wintoncoin.app.data.remote.dto.CollateralSyncRequestDto
import com.wintoncoin.app.domain.model.AccountStatementSummary
import com.wintoncoin.app.domain.model.BlockchainActivityStats
import com.wintoncoin.app.domain.model.SmartContractInfo
import com.wintoncoin.app.domain.model.StatementTransaction
import com.wintoncoin.app.domain.repository.AccountStatementRepository
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.max

@Singleton
class AccountStatementRepositoryImpl @Inject constructor(
    private val apiService: AccountStatementApiService
) : AccountStatementRepository {

    override suspend fun getAccountStatementSummary(): Result<AccountStatementSummary> {
        return try {
            val response = apiService.getWalletBalance()
            if (response.isSuccessful && response.body() != null) {
                val dto = response.body()!!
                val creditLimit = dto.creditLimit
                val redDebt = dto.redBalance
                val collateral = dto.collateralBalance
                val availableCredit = max(0.0, creditLimit - redDebt)
                val organicScore = max(0.0, creditLimit - collateral)

                val summary = AccountStatementSummary(
                    blueAvailable = dto.blueBalance,
                    blueEscrow = dto.escrowBlueBalance,
                    blueNextUnlockAt = dto.nextUnlockAt,
                    blueNextUnlockAmount = dto.nextUnlockAmount,
                    redCreditLimit = creditLimit,
                    redCreditAvailable = availableCredit,
                    redDebtTotal = redDebt,
                    organicScore = organicScore,
                    collateralBalance = collateral,
                    web3WalletAddress = dto.web3WalletAddress ?: "",
                    kycVerified = dto.kycVerified,
                    networkStatus = "Conectado a Optimism Sepolia"
                )
                Result.success(summary)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al obtener balances de la cuenta."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getStatementTransactions(): Result<List<StatementTransaction>> {
        return try {
            val response = apiService.getTransactions()
            if (response.isSuccessful && response.body() != null) {
                val list = response.body()!!.map { item ->
                    StatementTransaction(
                        id = item.id,
                        createdAt = item.createdAt,
                        type = item.type,
                        description = item.description ?: item.type,
                        blueChange = item.blueChange,
                        redChange = item.redChange,
                        txHash = item.txHash
                    )
                }
                Result.success(list)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al obtener historial de transacciones."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getBlockchainActivityStats(): Result<BlockchainActivityStats> {
        return try {
            val response = apiService.getTransactions()
            if (response.isSuccessful && response.body() != null) {
                val txs = response.body()!!
                val total = txs.size
                val received = txs.count { it.type == "payment_received" || it.type == "booster_reward" || it.blueChange > 0.0 }
                val sent = txs.count { it.type == "payment_sent" || (it.blueChange < 0.0 && it.type != "burn") }
                val amortized = txs.count { it.type == "burn" || (it.type == "payment_sent" && it.redChange < 0.0) || it.redChange < 0.0 }

                val stats = BlockchainActivityStats(
                    totalInteractions = total,
                    paymentsReceived = received,
                    paymentsSent = sent,
                    commitmentsAmortized = amortized
                )
                Result.success(stats)
            } else {
                Result.failure(Exception("Error al calcular estadísticas de actividad."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getSmartContractInfo(tokenType: String): Result<SmartContractInfo> {
        return try {
            val response = apiService.getContractsInfo()
            if (response.isSuccessful && response.body() != null) {
                val contracts = response.body()!!
                val isBlue = tokenType.equals("blue", ignoreCase = true)
                val item = if (isBlue) contracts.blue else contracts.red
                val title = if (isBlue) "WintonCoin BLUE Token" else "WintonCoin RED (Compromiso) Token"
                val explorerUrl = if (item.address.startsWith("0x")) {
                    "https://sepolia-optimism.etherscan.io/address/${item.address}"
                } else ""

                val info = SmartContractInfo(
                    tokenType = if (isBlue) "BLUE" else "RED",
                    title = title,
                    address = item.address,
                    minted = item.minted,
                    explorerUrl = explorerUrl
                )
                Result.success(info)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al obtener información de Smart Contracts."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun syncCollateral(
        operationType: String,
        amount: Double,
        tokenSymbol: String,
        tokenContractAddress: String,
        txHash: String,
        balanceAfter: Double?
    ): Result<Double> {
        return try {
            val request = CollateralSyncRequestDto(
                operationType = operationType,
                amount = amount,
                tokenSymbol = tokenSymbol,
                tokenContractAddress = tokenContractAddress,
                txHash = txHash,
                balanceAfter = balanceAfter
            )
            val response = apiService.syncCollateral(request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.newCreditLimit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al sincronizar garantía con el servidor."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
