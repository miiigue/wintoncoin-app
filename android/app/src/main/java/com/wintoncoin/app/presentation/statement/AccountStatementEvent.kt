// ============================================================================
// WintonCoin Android — AccountStatementEvent (Eventos de Usuario MVI)
// ============================================================================
// [PRESENTATION / EVENT] Intenciones del usuario para consultar contratos,
// interactuar con la bóveda de garantías, copiar direcciones y ver detalles.
// ============================================================================

package com.wintoncoin.app.presentation.statement

import com.wintoncoin.app.domain.model.VaultCollateralToken

sealed interface AccountStatementEvent {
    data object Load : AccountStatementEvent
    data object Refresh : AccountStatementEvent
    data class OpenSmartContractDialog(val tokenType: String) : AccountStatementEvent
    data object DismissSmartContractDialog : AccountStatementEvent
    data class ShowActivityInfoDialog(val message: String) : AccountStatementEvent
    data object DismissActivityInfoDialog : AccountStatementEvent
    data object ToggleVaultPanel : AccountStatementEvent
    data class SelectVaultToken(val token: VaultCollateralToken) : AccountStatementEvent
    data class VaultAmountChanged(val amount: String) : AccountStatementEvent
    data class CopyText(val text: String, val label: String) : AccountStatementEvent
    data object DismissCopyFeedback : AccountStatementEvent
    data object DismissError : AccountStatementEvent
}
