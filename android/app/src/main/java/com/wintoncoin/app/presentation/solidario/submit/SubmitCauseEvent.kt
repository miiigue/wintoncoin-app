// ============================================================================
// WintonCoin Android — SubmitCauseEvent
// ============================================================================
// [PRESENTATION / MVI EVENT] Eventos de postulación de causa solidaria.
// ============================================================================

package com.wintoncoin.app.presentation.solidario.submit

sealed interface SubmitCauseEvent {
    data class TitleChanged(val value: String) : SubmitCauseEvent
    data class StoryChanged(val value: String) : SubmitCauseEvent
    data class GoalAmountChanged(val value: String) : SubmitCauseEvent
    data class FoundationNameChanged(val value: String) : SubmitCauseEvent
    data class BeneficiaryReferralCodeChanged(val value: String) : SubmitCauseEvent
    data class BeneficiarySocialUrlsChanged(val value: String) : SubmitCauseEvent
    data class EvidenceUrlsChanged(val value: String) : SubmitCauseEvent
    data class UserSocialUrlsChanged(val value: String) : SubmitCauseEvent
    data class AcceptedTermsChanged(val value: Boolean) : SubmitCauseEvent
    object Submit : SubmitCauseEvent
    object DismissError : SubmitCauseEvent
}
