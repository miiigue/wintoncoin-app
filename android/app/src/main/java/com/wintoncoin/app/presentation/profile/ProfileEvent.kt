// ============================================================================
// WintonCoin Android — ProfileEvent (Eventos de UI de Perfil)
// ============================================================================
// Sealed interface para las acciones de la pantalla de Perfil.
// ============================================================================

package com.wintoncoin.app.presentation.profile

sealed interface ProfileEvent {
    data class LoadProfile(val targetUsername: String) : ProfileEvent
    object Refresh : ProfileEvent
    object DismissError : ProfileEvent
}
