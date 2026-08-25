// ============================================================================
// WintonCoin Android — AccountStatementRepository (Interfaz de Dominio)
// ============================================================================
// [DOMAIN LAYER] Contrato abstracto para obtención de resumen de estado de cuenta,
// métricas de actividad blockchain, información de Smart Contracts y Bóveda.
// ============================================================================

package com.wintoncoin.app.domain.repository

import com.wintoncoin.app.domain.model.AccountStatementSummary
import com.wintoncoin.app.domain.model.BlockchainActivityStats
import com.wintoncoin.app.domain.model.SmartContractInfo
import com.wintoncoin.app.domain.model.StatementTransaction

interface AccountStatementRepository {

    suspend fun getAccountStatementSummary(): Result<AccountStatementSummary>

    suspend fun getStatementTransactions(): Result<List<StatementTransaction>>

    suspend fun getBlockchainActivityStats(): Result<BlockchainActivityStats>

    suspend fun getSmartContractInfo(tokenType: String): Result<SmartContractInfo>

    suspend fun syncCollateral(
        operationType: String,
        amount: Double,
        tokenSymbol: String,
        tokenContractAddress: String,
        txHash: String,
        balanceAfter: Double?
    ): Result<Double>
}
