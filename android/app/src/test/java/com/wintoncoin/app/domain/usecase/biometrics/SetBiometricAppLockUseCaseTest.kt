// ============================================================================
// WintonCoin Android — SetBiometricAppLockUseCaseTest
// ============================================================================
// Pruebas unitarias para SetBiometricAppLockUseCase.
// ============================================================================

package com.wintoncoin.app.domain.usecase.biometrics

import com.wintoncoin.app.core.audit.AuditLogger
import com.wintoncoin.app.core.biometrics.BiometricAuthManager
import com.wintoncoin.app.core.biometrics.BiometricStatus
import com.wintoncoin.app.core.security.TokenManager
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class SetBiometricAppLockUseCaseTest {

    private lateinit var biometricAuthManager: BiometricAuthManager
    private lateinit var tokenManager: TokenManager
    private lateinit var auditLogger: AuditLogger
    private lateinit var useCase: SetBiometricAppLockUseCase

    @Before
    fun setUp() {
        biometricAuthManager = mockk()
        tokenManager = mockk(relaxed = true)
        auditLogger = mockk(relaxed = true)
        useCase = SetBiometricAppLockUseCase(biometricAuthManager, tokenManager, auditLogger)
    }

    @Test
    fun `enabling biometric app lock succeeds when biometrics is available`() {
        every { biometricAuthManager.checkBiometricAvailability() } returns BiometricStatus.BIOMETRIC_AND_CREDENTIAL

        val result = useCase(true)

        assertTrue(result.isSuccess)
        assertEquals(true, result.getOrNull())
        verify { tokenManager.setBiometricsEnabled(true) }
        verify { auditLogger.log(AuditLogger.Category.SECURITY, "BIOMETRIC_APP_LOCK_TOGGLED", "enabled=true") }
    }

    @Test
    fun `enabling app lock succeeds when only PIN or Pattern is available on device`() {
        every { biometricAuthManager.checkBiometricAvailability() } returns BiometricStatus.DEVICE_CREDENTIAL_ONLY

        val result = useCase(true)

        assertTrue(result.isSuccess)
        assertEquals(true, result.getOrNull())
        verify { tokenManager.setBiometricsEnabled(true) }
    }

    @Test
    fun `enabling biometric app lock fails when neither biometrics nor PIN is configured`() {
        every { biometricAuthManager.checkBiometricAvailability() } returns BiometricStatus.NONE_CONFIGURED

        val result = useCase(true)

        assertTrue(result.isFailure)
        verify(exactly = 0) { tokenManager.setBiometricsEnabled(true) }
    }

    @Test
    fun `disabling biometric app lock always succeeds`() {
        val result = useCase(false)

        assertTrue(result.isSuccess)
        assertEquals(false, result.getOrNull())
        verify { tokenManager.setBiometricsEnabled(false) }
    }
}
