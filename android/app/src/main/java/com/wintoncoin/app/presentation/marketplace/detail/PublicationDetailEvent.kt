// ============================================================================
// WintonCoin Android — PublicationDetailEvent (Eventos del Detalle)
// ============================================================================
// [PRESENTATION LAYER] Intenciones disparadas desde la pantalla de detalle.
// ============================================================================

package com.wintoncoin.app.presentation.marketplace.detail

sealed class PublicationDetailEvent {
    data class LoadDetails(val id: String) : PublicationDetailEvent()
    data class UpdateDonationAmount(val amount: String) : PublicationDetailEvent()
    data class UpdateEvidenceInput(val text: String) : PublicationDetailEvent()
    object Apply : PublicationDetailEvent()
    object CompleteTask : PublicationDetailEvent()
    data class ConfirmPayment(val workerUsername: String) : PublicationDetailEvent()
    object ClearMessages : PublicationDetailEvent()
}
