// ============================================================================
// WintonCoin Android — RegisterEvent (Eventos de UI de Registro)
// ============================================================================
// Sealed interface que representa todas las acciones que el usuario puede realizar
// en la pantalla de Registro.
// ============================================================================

package com.wintoncoin.app.presentation.register

sealed interface RegisterEvent {
    data class UsernameChanged(val username: String) : RegisterEvent
    data class EmailChanged(val email: String) : RegisterEvent
    data class PhoneChanged(val phone: String) : RegisterEvent
    data class PasswordChanged(val password: String) : RegisterEvent
    data class ConfirmPasswordChanged(val confirmPassword: String) : RegisterEvent
    data class TermsToggled(val accepted: Boolean) : RegisterEvent
    object Submit : RegisterEvent
    object DismissError : RegisterEvent
}
