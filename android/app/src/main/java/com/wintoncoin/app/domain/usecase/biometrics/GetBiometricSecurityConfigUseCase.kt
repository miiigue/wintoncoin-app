// ============================================================================
// WintonCoin Android — GetBiometricSecurityConfigUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Obtiene el estado actual de la seguridad del dispositivo.
// ============================================================================

package com.wintoncoin.app.domain.usecase.biometrics

import com.wintoncoin.app.core.biometrics.BiometricAuthManager
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.domain.model.BiometricSecurityConfig
import javax.inject.Inject

class GetBiometricSecurityConfigUseCase @Inject constructor(
    private val biometricAuthManager: BiometricAuthManager,
    private val tokenManager: TokenManager
) {
    operator fun invoke(): BiometricSecurityConfig {
        val status = biometricAuthManager.checkBiometricAvailability()
        return BiometricSecurityConfig(
            isBiometricsSupported = status.isAnyUnlockAvailable,
            biometricStatus = status,
            isAppLockEnabled = tokenManager.isBiometricsEnabled(),
            isTransactionBiometricRequired = tokenManager.isTransactionBiometricRequired()
        )
    }
}
