// ============================================================================
// WintonCoin Android — SubmitCauseState
// ============================================================================
// [PRESENTATION / STATE] Estado del formulario para postulación de causa solidaria.
// ============================================================================

package com.wintoncoin.app.presentation.solidario.submit

data class SubmitCauseState(
    val isLoading: Boolean = false,
    val isSubmittedSuccess: Boolean = false,
    val createdCauseId: Int? = null,
    val title: String = "",
    val story: String = "",
    val goalAmountText: String = "",
    val foundationName: String = "",
    val beneficiaryReferralCode: String = "",
    val beneficiarySocialUrls: String = "",
    val evidenceUrls: String = "",
    val userSocialUrls: String = "",
    val acceptedTerms: Boolean = false,
    val errorMessage: String? = null
)
