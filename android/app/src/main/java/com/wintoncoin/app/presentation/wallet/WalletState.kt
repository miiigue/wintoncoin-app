// ============================================================================
// WintonCoin Android — WalletState (Estado de UI de Billetera)
// ============================================================================

package com.wintoncoin.app.presentation.wallet

import com.wintoncoin.app.domain.model.TransactionItem
import com.wintoncoin.app.domain.model.WalletBalance

enum class WalletTab {
    BALANCES,
    HISTORY
}

data class WalletState(
    val isLoading: Boolean = true,
    val selectedTab: WalletTab = WalletTab.BALANCES,
    val balance: WalletBalance? = null,
    val transactions: List<TransactionItem> = emptyList(),
    val errorMessage: String? = null
)
