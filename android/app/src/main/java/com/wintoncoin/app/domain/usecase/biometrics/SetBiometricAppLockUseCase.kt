// ============================================================================
// WintonCoin Android — SetBiometricAppLockUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Activa o desactiva el bloqueo de la app.
// ============================================================================

package com.wintoncoin.app.domain.usecase.biometrics

import com.wintoncoin.app.core.audit.AuditLogger
import com.wintoncoin.app.core.biometrics.BiometricAuthManager
import com.wintoncoin.app.core.security.TokenManager
import javax.inject.Inject

class SetBiometricAppLockUseCase @Inject constructor(
    private val biometricAuthManager: BiometricAuthManager,
    private val tokenManager: TokenManager,
    private val auditLogger: AuditLogger
) {
    operator fun invoke(enabled: Boolean): Result<Boolean> {
        if (enabled) {
            val status = biometricAuthManager.checkBiometricAvailability()
            if (!status.isAnyUnlockAvailable) {
                return Result.failure(IllegalStateException(status.displayName))
            }
        }

        tokenManager.setBiometricsEnabled(enabled)
        auditLogger.log(
            AuditLogger.Category.SECURITY,
            "BIOMETRIC_APP_LOCK_TOGGLED",
            "enabled=$enabled"
        )
        return Result.success(enabled)
    }
}
