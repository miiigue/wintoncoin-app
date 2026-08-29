// ============================================================================
// WintonCoin Android — BiometricSecurityConfig
// ============================================================================
// [DOMAIN LAYER / MODEL] Configuración de seguridad biométrica del usuario.
// ============================================================================

package com.wintoncoin.app.domain.model

import com.wintoncoin.app.core.biometrics.BiometricStatus

data class BiometricSecurityConfig(
    val isBiometricsSupported: Boolean,
    val biometricStatus: BiometricStatus,
    val isAppLockEnabled: Boolean,
    val isTransactionBiometricRequired: Boolean
)
