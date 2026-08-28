// ============================================================================
// WintonCoin Android — BiometricPromptResult
// ============================================================================
// [CORE / SECURITY] Resultados de una solicitud de autenticación biométrica.
// ============================================================================

package com.wintoncoin.app.core.biometrics

sealed interface BiometricPromptResult {
    data object Success : BiometricPromptResult
    data class Error(val errorCode: Int, val errString: String) : BiometricPromptResult
    data object Failed : BiometricPromptResult
    data object Cancelled : BiometricPromptResult
    data class NotAvailable(val reason: String) : BiometricPromptResult
}
