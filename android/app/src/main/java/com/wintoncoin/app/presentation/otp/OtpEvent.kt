// ============================================================================
// WintonCoin Android — OtpEvent (Eventos de UI de OTP)
// ============================================================================
// Sealed interface para las acciones de verificación de código OTP.
// ============================================================================

package com.wintoncoin.app.presentation.otp

sealed interface OtpEvent {
    data class OtpCodeChanged(val code: String) : OtpEvent
    object Submit : OtpEvent
    object ResendCode : OtpEvent
    object DismissError : OtpEvent
}
