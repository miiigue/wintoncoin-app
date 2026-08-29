// ============================================================================
// WintonCoin Android — ResendSosOtpUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Reenvía el código de verificación OTP.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.repository.SosRepository
import javax.inject.Inject

class ResendSosOtpUseCase @Inject constructor(
    private val repository: SosRepository
) {
    suspend operator fun invoke(email: String, isVolunteer: Boolean = false): Result<String> {
        if (email.isBlank() || !email.contains("@")) {
            return Result.failure(IllegalArgumentException("Correo electrónico inválido."))
        }

        return if (isVolunteer) {
            repository.resendVolunteerOtp(email)
        } else {
            repository.resendVictimOtp(email)
        }
    }
}
