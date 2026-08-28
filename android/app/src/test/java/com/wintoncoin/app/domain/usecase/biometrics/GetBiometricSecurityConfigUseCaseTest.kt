// ============================================================================
// WintonCoin Android — GetBiometricSecurityConfigUseCaseTest
// ============================================================================
// Pruebas unitarias para GetBiometricSecurityConfigUseCase.
// ============================================================================

package com.wintoncoin.app.domain.usecase.biometrics

import com.wintoncoin.app.core.biometrics.BiometricAuthManager
import com.wintoncoin.app.core.biometrics.BiometricStatus
import com.wintoncoin.app.core.security.TokenManager
import io.mockk.every
import io.mockk.mockk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GetBiometricSecurityConfigUseCaseTest {

    private lateinit var biometricAuthManager: BiometricAuthManager
    private lateinit var tokenManager: TokenManager
    private lateinit var useCase: GetBiometricSecurityConfigUseCase

    @Before
    fun setUp() {
        biometricAuthManager = mockk()
        tokenManager = mockk()
        useCase = GetBiometricSecurityConfigUseCase(biometricAuthManager, tokenManager)
    }

    @Test
    fun `returns correct configuration when biometrics and PIN is available and enabled`() {
        every { biometricAuthManager.checkBiometricAvailability() } returns BiometricStatus.BIOMETRIC_AND_CREDENTIAL
        every { tokenManager.isBiometricsEnabled() } returns true
        every { tokenManager.isTransactionBiometricRequired() } returns true

        val result = useCase()

        assertTrue(result.isBiometricsSupported)
        assertEquals(BiometricStatus.BIOMETRIC_AND_CREDENTIAL, result.biometricStatus)
        assertTrue(result.isAppLockEnabled)
        assertTrue(result.isTransactionBiometricRequired)
    }

    @Test
    fun `returns isBiometricsSupported true when only device credential PIN is available without biometric sensor`() {
        every { biometricAuthManager.checkBiometricAvailability() } returns BiometricStatus.DEVICE_CREDENTIAL_ONLY
        every { tokenManager.isBiometricsEnabled() } returns true
        every { tokenManager.isTransactionBiometricRequired() } returns true

        val result = useCase()

        assertTrue(result.isBiometricsSupported)
        assertEquals(BiometricStatus.DEVICE_CREDENTIAL_ONLY, result.biometricStatus)
    }

    @Test
    fun `returns supported false when neither biometrics nor PIN is configured`() {
        every { biometricAuthManager.checkBiometricAvailability() } returns BiometricStatus.NO_HARDWARE
        every { tokenManager.isBiometricsEnabled() } returns false
        every { tokenManager.isTransactionBiometricRequired() } returns false

        val result = useCase()

        assertEquals(false, result.isBiometricsSupported)
        assertEquals(BiometricStatus.NO_HARDWARE, result.biometricStatus)
    }
}
