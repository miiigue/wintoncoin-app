// ============================================================================
// WintonCoin Android — WalletEvent (Eventos de UI de Billetera)
// ============================================================================

package com.wintoncoin.app.presentation.wallet

sealed interface WalletEvent {
    data class TabSelected(val tab: WalletTab) : WalletEvent
    object Refresh : WalletEvent
    object DismissError : WalletEvent
}
