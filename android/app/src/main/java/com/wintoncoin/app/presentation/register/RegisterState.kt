// ============================================================================
// WintonCoin Android — RegisterState (Estado de UI del Registro)
// ============================================================================
// Data class inmutable que representa el estado de la pantalla de Registro.
// ============================================================================

package com.wintoncoin.app.presentation.register

data class RegisterState(
    val username: String = "",
    val email: String = "",
    val phone: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val termsAccepted: Boolean = false,
    val isLoading: Boolean = false,
    val isSuccess: Boolean = false,
    val registeredEmail: String? = null,
    val usernameError: String? = null,
    val emailError: String? = null,
    val phoneError: String? = null,
    val passwordError: String? = null,
    val confirmPasswordError: String? = null,
    val termsError: String? = null,
    val errorMessage: String? = null
)
