// ============================================================================
// WintonCoin Android — OtpState (Estado de UI de Verificación OTP)
// ============================================================================
// Data class inmutable para la pantalla de ingreso del código OTP de 6 dígitos.
// ============================================================================

package com.wintoncoin.app.presentation.otp

data class OtpState(
    val email: String = "",
    val otpCode: String = "",
    val isLoading: Boolean = false,
    val isSuccess: Boolean = false,
    val otpError: String? = null,
    val errorMessage: String? = null,
    val resendCountdown: Int = 60,
    val canResend: Boolean = false
)
