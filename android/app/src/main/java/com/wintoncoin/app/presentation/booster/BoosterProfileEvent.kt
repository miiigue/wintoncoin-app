// ============================================================================
// WintonCoin Android — BoosterProfileEvent (Eventos UI de Perfil de Impulsor)
// ============================================================================
// [PRESENTATION / EVENTS] Define las acciones que el usuario puede disparar
// en la pantalla del Programa de Impulsores (Booster Profile).
// ============================================================================

package com.wintoncoin.app.presentation.booster

sealed interface BoosterProfileEvent {
    data class LoadProfile(val targetUsername: String? = null) : BoosterProfileEvent
    object Refresh : BoosterProfileEvent
    object OpenUnlockConditionsDialog : BoosterProfileEvent
    object DismissUnlockConditionsDialog : BoosterProfileEvent
    object DismissError : BoosterProfileEvent
}
