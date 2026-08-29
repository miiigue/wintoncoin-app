// ============================================================================
// WintonCoin Android — SosHubState
// ============================================================================
// [PRESENTATION LAYER / MVI STATE] Estado inmutable del portal SOS Venezuela.
// ============================================================================

package com.wintoncoin.app.presentation.sos.hub

import com.wintoncoin.app.domain.model.SosCampaignInfo

data class SosHubState(
    val isLoading: Boolean = false,
    val campaignInfo: SosCampaignInfo = SosCampaignInfo(
        shareCode = "SOSVENEZUELA",
        bonusBlue = 200.0,
        isCampaignActive = true
    ),
    val errorMessage: String? = null,
    val codeCopiedFeedback: Boolean = false
)
