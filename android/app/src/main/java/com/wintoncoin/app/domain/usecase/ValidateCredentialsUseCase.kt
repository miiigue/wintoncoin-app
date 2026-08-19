// ============================================================================
// WintonCoin Android — ValidateCredentialsUseCase (Validación de Formulario)
// ============================================================================
// [DOMAIN LAYER] Caso de uso para validar el formato de username y password
// antes de enviarlo al backend.
//
// Regla de negocio de WintonCoin:
// - Username: 3-30 caracteres, solo alfanuméricos y guiones bajos (a-zA-Z0-9_).
// - Password: No vacía, mínimo 6 caracteres.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import javax.inject.Inject

/**
 * Resultado de la validación de credenciales.
 */
data class ValidationResult(
    val isValid: Boolean,
    val usernameError: String? = null,
    val passwordError: String? = null
)

/**
 * ValidateCredentialsUseCase — Ejecuta las reglas de validación de campos.
 */
class ValidateCredentialsUseCase @Inject constructor() {

    companion object {
        // Regex oficial de username (3 a 30 caracteres, letras, números y underscores)
        private val USERNAME_REGEX = "^[a-zA-Z0-9_]{3,30}$".toRegex()
    }

    operator fun invoke(username: String, password: String): ValidationResult {
        var usernameError: String? = null
        var passwordError: String? = null

        val cleanUsername = username.trim()

        if (cleanUsername.isEmpty()) {
            usernameError = "Ingresa tu nombre de usuario"
        } else if (cleanUsername.length < 3) {
            usernameError = "El usuario debe tener al menos 3 caracteres"
        } else if (cleanUsername.length > 30) {
            usernameError = "El usuario no puede exceder 30 caracteres"
        } else if (!USERNAME_REGEX.matches(cleanUsername)) {
            usernameError = "Solo se permiten letras, números y guiones bajos (_)"
        }

        if (password.isEmpty()) {
            passwordError = "Ingresa tu contraseña"
        } else if (password.length < 6) {
            passwordError = "La contraseña debe tener al menos 6 caracteres"
        }

        return ValidationResult(
            isValid = usernameError == null && passwordError == null,
            usernameError = usernameError,
            passwordError = passwordError
        )
    }
}
