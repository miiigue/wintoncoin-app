// ============================================================================
// WintonCoin Android — ForgotPasswordUseCase (Caso de Uso de Recuperación)
// ============================================================================
// [DOMAIN LAYER] Ejecuta la solicitud de recuperación de contraseña por email.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.repository.AuthRepository
import javax.inject.Inject

class ForgotPasswordUseCase @Inject constructor(
    private val authRepository: AuthRepository
) {
    private val emailRegex = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,6}$".toRegex()

    suspend operator fun invoke(email: String): Result<String> {
        val cleanEmail = email.trim()
        if (cleanEmail.isEmpty() || !emailRegex.matches(cleanEmail)) {
            return Result.Error("Ingresa un correo electrónico válido.")
        }
        return authRepository.forgotPassword(cleanEmail)
    }
}
