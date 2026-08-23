// ============================================================================
// WintonCoin Android — ReferralsState (Estado UI de Red de Referidos)
// ============================================================================
// [PRESENTATION / STATE] Modela el estado inmutable para la pantalla de
// Red de Referidos, código de invitación y miembros afiliados.
// ============================================================================

package com.wintoncoin.app.presentation.referrals

import com.wintoncoin.app.domain.model.ReferralNetworkData

data class ReferralsState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val errorMessage: String? = null,
    val copyFeedback: String? = null,
    val referralData: ReferralNetworkData? = null
)
