// ============================================================================
// WintonCoin Android — AppLockState
// ============================================================================
// [PRESENTATION LAYER / MVI STATE] Estado de la pantalla de bloqueo de la app.
// ============================================================================

package com.wintoncoin.app.presentation.lock

import com.wintoncoin.app.core.biometrics.BiometricStatus

data class AppLockState(
    val username: String? = null,
    val biometricStatus: BiometricStatus = BiometricStatus.UNKNOWN,
    val isBiometricsSupported: Boolean = true,
    val isAuthenticating: Boolean = false,
    val errorMessage: String? = null,
    val isUnlocked: Boolean = false
)
