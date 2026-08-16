// ============================================================================
// WintonCoin Android — VerifyOtpUseCase (Caso de Uso de Verificación OTP)
// ============================================================================
// [DOMAIN LAYER] Ejecuta la verificación del código OTP de 6 dígitos.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.UserSession
import com.wintoncoin.app.domain.repository.AuthRepository
import javax.inject.Inject

class VerifyOtpUseCase @Inject constructor(
    private val authRepository: AuthRepository
) {
    suspend operator fun invoke(email: String, otpCode: String): Result<UserSession> {
        val cleanOtp = otpCode.trim()
        if (cleanOtp.length != 6 || !cleanOtp.all { it.isDigit() }) {
            return Result.Error("El código OTP debe contener exactamente 6 dígitos numéricos.")
        }
        return authRepository.verifyOtp(email.trim(), cleanOtp)
    }
}
