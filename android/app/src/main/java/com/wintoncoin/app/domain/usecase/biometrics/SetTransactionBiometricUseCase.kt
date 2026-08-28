// ============================================================================
// WintonCoin Android — SetTransactionBiometricUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Configura la exigencia de autenticación en transferencias.
// ============================================================================

package com.wintoncoin.app.domain.usecase.biometrics

import com.wintoncoin.app.core.audit.AuditLogger
import com.wintoncoin.app.core.biometrics.BiometricAuthManager
import com.wintoncoin.app.core.security.TokenManager
import javax.inject.Inject

class SetTransactionBiometricUseCase @Inject constructor(
    private val biometricAuthManager: BiometricAuthManager,
    private val tokenManager: TokenManager,
    private val auditLogger: AuditLogger
) {
    operator fun invoke(required: Boolean): Result<Boolean> {
        if (required) {
            val status = biometricAuthManager.checkBiometricAvailability()
            if (!status.isAnyUnlockAvailable) {
                return Result.failure(IllegalStateException(status.displayName))
            }
        }

        tokenManager.setTransactionBiometricRequired(required)
        auditLogger.log(
            AuditLogger.Category.SECURITY,
            "TRANSACTION_BIOMETRICS_TOGGLED",
            "required=$required"
        )
        return Result.success(required)
    }
}
