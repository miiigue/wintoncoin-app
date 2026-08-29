// ============================================================================
// WintonCoin Android — SecuritySettingsState
// ============================================================================
// [PRESENTATION LAYER / MVI STATE] Estado de la pantalla de configuración de seguridad.
// ============================================================================

package com.wintoncoin.app.presentation.settings.security

import com.wintoncoin.app.core.biometrics.BiometricStatus

data class SecuritySettingsState(
    val isBiometricsSupported: Boolean = false,
    val biometricStatus: BiometricStatus = BiometricStatus.UNKNOWN,
    val isAppLockEnabled: Boolean = false,
    val isTransactionBiometricRequired: Boolean = true,
    val feedbackMessage: String? = null,
    val isSuccessFeedback: Boolean = true
)
