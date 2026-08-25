// ============================================================================
// WintonCoin Android — GetAccountStatementUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Orquesta la consulta unificada de balances,
// estadísticas de actividad blockchain e historial de transacciones.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.AccountStatementSummary
import com.wintoncoin.app.domain.model.BlockchainActivityStats
import com.wintoncoin.app.domain.model.StatementTransaction
import com.wintoncoin.app.domain.repository.AccountStatementRepository
import javax.inject.Inject

data class AccountStatementFullData(
    val summary: AccountStatementSummary,
    val stats: BlockchainActivityStats,
    val transactions: List<StatementTransaction>
)

class GetAccountStatementUseCase @Inject constructor(
    private val repository: AccountStatementRepository
) {
    suspend operator fun invoke(): Result<AccountStatementFullData> {
        val summaryResult = repository.getAccountStatementSummary()
        if (summaryResult.isFailure) {
            return Result.failure(summaryResult.exceptionOrNull() ?: Exception("Error al cargar balances."))
        }

        val statsResult = repository.getBlockchainActivityStats()
        val stats = statsResult.getOrDefault(BlockchainActivityStats())

        val txsResult = repository.getStatementTransactions()
        val txs = txsResult.getOrDefault(emptyList())

        return Result.success(
            AccountStatementFullData(
                summary = summaryResult.getOrThrow(),
                stats = stats,
                transactions = txs
            )
        )
    }
}
