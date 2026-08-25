// ============================================================================
// WintonCoin Android — CauseDetailState
// ============================================================================
// [PRESENTATION / STATE] Estado UI para el detalle y motor de donación de causas.
// ============================================================================

package com.wintoncoin.app.presentation.solidario.detail

import com.wintoncoin.app.domain.model.CauseDonationsSummary
import com.wintoncoin.app.domain.model.CauseUpdate
import com.wintoncoin.app.domain.model.HumanitarianCause

enum class CauseDetailTab {
    DONATIONS,  // Muro de Donaciones
    UPDATES     // Novedades de la Causa
}

data class CauseDetailState(
    val isLoading: Boolean = false,
    val isDonating: Boolean = false,
    val isCancelling: Boolean = false,
    val cause: HumanitarianCause? = null,
    val donationsSummary: CauseDonationsSummary? = null,
    val updates: List<CauseUpdate> = emptyList(),
    val userAvailableBalance: Double = 0.0,
    val donationAmountText: String = "",
    val acceptedTerms: Boolean = false,
    val selectedTab: CauseDetailTab = CauseDetailTab.DONATIONS,
    val showDonationConfirmDialog: Boolean = false,
    val feedbackMessage: String? = null,
    val errorMessage: String? = null
)
