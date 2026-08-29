// ============================================================================
// WintonCoin Android — CauseDetailEvent
// ============================================================================
// [PRESENTATION / MVI EVENT] Eventos para detalle de causa y donaciones.
// ============================================================================

package com.wintoncoin.app.presentation.solidario.detail

sealed interface CauseDetailEvent {
    data class Load(val causeId: Int) : CauseDetailEvent
    object Refresh : CauseDetailEvent
    data class DonationAmountChanged(val amount: String) : CauseDetailEvent
    data class AcceptedTermsChanged(val accepted: Boolean) : CauseDetailEvent
    data class SelectTab(val tab: CauseDetailTab) : CauseDetailEvent
    object OpenDonationConfirmDialog : CauseDetailEvent
    object DismissDonationConfirmDialog : CauseDetailEvent
    object ExecuteDonation : CauseDetailEvent
    object CancelCause : CauseDetailEvent
    object DismissFeedback : CauseDetailEvent
    object DismissError : CauseDetailEvent
}
