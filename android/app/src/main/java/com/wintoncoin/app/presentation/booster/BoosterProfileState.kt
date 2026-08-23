// ============================================================================
// WintonCoin Android — BoosterProfileState (Estado UI de Perfil de Impulsor)
// ============================================================================
// [PRESENTATION / STATE] Modela el estado inmutable para la pantalla del
// Programa de Impulsores (Booster Profile), Escalera de Rangos y Ledger.
// ============================================================================

package com.wintoncoin.app.presentation.booster

import com.wintoncoin.app.domain.model.BoosterProfile

data class BoosterProfileState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val errorMessage: String? = null,
    val profile: BoosterProfile? = null,
    val showUnlockConditionsDialog: Boolean = false,
    val isOwnProfile: Boolean = true
)
