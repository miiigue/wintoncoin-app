// ============================================================================
// WintonCoin Android — ValidateRegisterUseCase (Validación de Registro)
// ============================================================================
// [DOMAIN LAYER] Caso de uso para validar el formulario de registro.
// Aplica las reglas de negocio FinTech previa comunicación con el backend.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import javax.inject.Inject

/**
 * Resultado de la validación del formulario de registro.
 */
data class RegisterValidationResult(
    val isValid: Boolean,
    val usernameError: String? = null,
    val emailError: String? = null,
    val phoneError: String? = null,
    val passwordError: String? = null,
    val confirmPasswordError: String? = null,
    val termsError: String? = null
)

/**
 * ValidateRegisterUseCase — Ejecuta las reglas de validación de registro.
 */
class ValidateRegisterUseCase @Inject constructor() {

    companion object {
        private val USERNAME_REGEX = "^[a-zA-Z0-9_]{3,30}$".toRegex()
        private val EMAIL_REGEX = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,6}$".toRegex()
        private val PHONE_REGEX = "^\\+?[0-9]{7,15}$".toRegex()
    }

    operator fun invoke(
        username: String,
        email: String,
        phone: String,
        password: String,
        confirmPassword: String,
        termsAccepted: Boolean
    ): RegisterValidationResult {
        var usernameError: String? = null
        var emailError: String? = null
        var phoneError: String? = null
        var passwordError: String? = null
        var confirmPasswordError: String? = null
        var termsError: String? = null

        val cleanUsername = username.trim()
        val cleanEmail = email.trim()
        val cleanPhone = phone.trim()

        // Validar Username
        if (cleanUsername.isEmpty()) {
            usernameError = "Ingresa un nombre de usuario"
        } else if (cleanUsername.length < 3) {
            usernameError = "El usuario debe tener al menos 3 caracteres"
        } else if (cleanUsername.length > 30) {
            usernameError = "El usuario no puede exceder 30 caracteres"
        } else if (!USERNAME_REGEX.matches(cleanUsername)) {
            usernameError = "Solo se permiten letras, números y guiones bajos (_)"
        }

        // Validar Email
        if (cleanEmail.isEmpty()) {
            emailError = "Ingresa tu correo electrónico"
        } else if (!EMAIL_REGEX.matches(cleanEmail)) {
            emailError = "Ingresa un correo electrónico válido"
        }

        // Validar Teléfono (opcional, pero si lo ingresa debe ser válido)
        if (cleanPhone.isNotEmpty() && !PHONE_REGEX.matches(cleanPhone)) {
            phoneError = "Ingresa un número telefónico válido (ej: +584121234567)"
        }

        // Validar Contraseña
        if (password.isEmpty()) {
            passwordError = "Ingresa una contraseña"
        } else if (password.length < 6) {
            passwordError = "La contraseña debe tener al menos 6 caracteres"
        }

        // Validar Confirmación de Contraseña
        if (confirmPassword.isEmpty()) {
            confirmPasswordError = "Confirma tu contraseña"
        } else if (password != confirmPassword) {
            confirmPasswordError = "Las contraseñas no coinciden"
        }

        // Validar Aceptación de Términos
        if (!termsAccepted) {
            termsError = "Debes aceptar los Términos y Condiciones para continuar"
        }

        val isValid = usernameError == null &&
                emailError == null &&
                phoneError == null &&
                passwordError == null &&
                confirmPasswordError == null &&
                termsError == null

        return RegisterValidationResult(
            isValid = isValid,
            usernameError = usernameError,
            emailError = emailError,
            phoneError = phoneError,
            passwordError = passwordError,
            confirmPasswordError = confirmPasswordError,
            termsError = termsError
        )
    }
}
