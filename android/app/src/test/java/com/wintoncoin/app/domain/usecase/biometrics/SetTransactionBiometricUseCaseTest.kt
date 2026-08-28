// ============================================================================
// WintonCoin Android — SetTransactionBiometricUseCaseTest
// ============================================================================
// Pruebas unitarias para SetTransactionBiometricUseCase.
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

class SetTransactionBiometricUseCaseTest {

    private lateinit var biometricAuthManager: BiometricAuthManager
    private lateinit var tokenManager: TokenManager
    private lateinit var auditLogger: AuditLogger
    private lateinit var useCase: SetTransactionBiometricUseCase

    @Before
    fun setUp() {
        biometricAuthManager = mockk()
        tokenManager = mockk(relaxed = true)
        auditLogger = mockk(relaxed = true)
        useCase = SetTransactionBiometricUseCase(biometricAuthManager, tokenManager, auditLogger)
    }

    @Test
    fun `setting transaction biometrics required succeeds when biometrics is available`() {
        every { biometricAuthManager.checkBiometricAvailability() } returns BiometricStatus.BIOMETRIC_AND_CREDENTIAL

        val result = useCase(true)

        assertTrue(result.isSuccess)
        assertEquals(true, result.getOrNull())
        verify { tokenManager.setTransactionBiometricRequired(true) }
    }

    @Test
    fun `setting transaction biometrics required succeeds when only device PIN is available`() {
        every { biometricAuthManager.checkBiometricAvailability() } returns BiometricStatus.DEVICE_CREDENTIAL_ONLY

        val result = useCase(true)

        assertTrue(result.isSuccess)
        assertEquals(true, result.getOrNull())
        verify { tokenManager.setTransactionBiometricRequired(true) }
    }

    @Test
    fun `setting transaction biometrics required fails when no security is configured`() {
        every { biometricAuthManager.checkBiometricAvailability() } returns BiometricStatus.NO_HARDWARE

        val result = useCase(true)

        assertTrue(result.isFailure)
        verify(exactly = 0) { tokenManager.setTransactionBiometricRequired(true) }
    }
}
