// ============================================================================
// WintonCoin Android — VerifySosOtpUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Valida el código OTP de 6 dígitos y define la
// contraseña para activar la cuenta de damnificado o voluntario SOS.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.SosAuthSession
import com.wintoncoin.app.domain.model.SosOtpVerificationInput
import com.wintoncoin.app.domain.repository.SosRepository
import javax.inject.Inject

class VerifySosOtpUseCase @Inject constructor(
    private val repository: SosRepository
) {
    suspend operator fun invoke(
        input: SosOtpVerificationInput,
        isVolunteer: Boolean = false
    ): Result<SosAuthSession> {
        if (input.email.isBlank()) {
            return Result.failure(IllegalArgumentException("El correo electrónico es obligatorio."))
        }
        if (input.otpCode.isBlank() || input.otpCode.trim().length != 6 || !input.otpCode.all { it.isDigit() }) {
            return Result.failure(IllegalArgumentException("El código de verificación debe tener exactamente 6 dígitos numéricos."))
        }
        if (input.password.length < 8) {
            return Result.failure(IllegalArgumentException("La contraseña debe tener al menos 8 caracteres."))
        }
        if (input.password != input.confirmPassword) {
            return Result.failure(IllegalArgumentException("Las contraseñas ingresadas no coinciden."))
        }

        return if (isVolunteer) {
            repository.verifyVolunteerOtp(input)
        } else {
            repository.verifyVictimOtp(input)
        }
    }
}
