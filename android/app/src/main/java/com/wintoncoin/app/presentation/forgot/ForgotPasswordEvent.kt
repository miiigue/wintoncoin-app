// ============================================================================
// WintonCoin Android — ForgotPasswordEvent (Eventos de Recuperación)
// ============================================================================
// Sealed interface de acciones para la pantalla de recuperación de contraseña.
// ============================================================================

package com.wintoncoin.app.presentation.forgot

sealed interface ForgotPasswordEvent {
    data class EmailChanged(val email: String) : ForgotPasswordEvent
    object Submit : ForgotPasswordEvent
    object DismissError : ForgotPasswordEvent
    object DismissSuccess : ForgotPasswordEvent
}
