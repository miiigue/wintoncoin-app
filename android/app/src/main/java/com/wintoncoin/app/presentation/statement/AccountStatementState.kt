// ============================================================================
// WintonCoin Android — AccountStatementState (Estado Inmutable MVI)
// ============================================================================
// [PRESENTATION / STATE] Representa el estado reactivo completo de la pantalla
// de Estado de Cuenta Web3, Auditoría de Smart Contracts y Bóveda de Garantías.
// ============================================================================

package com.wintoncoin.app.presentation.statement

import com.wintoncoin.app.domain.model.AccountStatementSummary
import com.wintoncoin.app.domain.model.BlockchainActivityStats
import com.wintoncoin.app.domain.model.SmartContractInfo
import com.wintoncoin.app.domain.model.StatementTransaction
import com.wintoncoin.app.domain.model.VaultCollateralToken

data class AccountStatementState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val summary: AccountStatementSummary? = null,
    val stats: BlockchainActivityStats = BlockchainActivityStats(),
    val transactions: List<StatementTransaction> = emptyList(),
    val selectedSmartContract: SmartContractInfo? = null,
    val isLoadingSmartContract: Boolean = false,
    val showSmartContractDialog: Boolean = false,
    val activityInfoDialogMessage: String? = null,
    val showVaultPanel: Boolean = false,
    val vaultSelectedToken: VaultCollateralToken = VaultCollateralToken.USDT,
    val vaultDepositAmount: String = "",
    val vaultSimulatedLimit: Double? = null,
    val vaultStatusMessage: String? = null,
    val vaultStatusType: String? = null,
    val copyFeedback: String? = null,
    val errorMessage: String? = null
)
