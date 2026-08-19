// ============================================================================
// WintonCoin Android — ForgotPasswordState (Estado de Recuperación)
// ============================================================================
// Data class inmutable para la pantalla de recuperación de contraseña.
// ============================================================================

package com.wintoncoin.app.presentation.forgot

data class ForgotPasswordState(
    val email: String = "",
    val isLoading: Boolean = false,
    val isSuccess: Boolean = false,
    val successMessage: String? = null,
    val emailError: String? = null,
    val errorMessage: String? = null
)
