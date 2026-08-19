// ============================================================================
// WintonCoin Android — Login State & Events
// ============================================================================
// Define el estado inmutable de la pantalla de Login y los eventos lanzados por el usuario.
// Arquitectura Unidirectional Data Flow (UDF).
// ============================================================================

package com.wintoncoin.app.presentation.login

import com.wintoncoin.app.domain.model.UserSession

/**
 * LoginState — Estado completo de la interfaz de Login.
 */
data class LoginState(
    val username: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val usernameError: String? = null,
    val passwordError: String? = null,
    val errorMessage: String? = null,
    val isSuccess: Boolean = false,
    val userSession: UserSession? = null
)

/**
 * LoginEvent — Acciones emitidas por el usuario en la UI.
 */
sealed class LoginEvent {
    data class UsernameChanged(val username: String) : LoginEvent()
    data class PasswordChanged(val password: String) : LoginEvent()
    object Submit : LoginEvent()
    object DismissError : LoginEvent()
}
