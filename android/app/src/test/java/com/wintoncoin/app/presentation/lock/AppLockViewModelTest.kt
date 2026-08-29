// ============================================================================
// WintonCoin Android — AppLockViewModelTest
// ============================================================================
// Pruebas unitarias para AppLockViewModel.
// ============================================================================

package com.wintoncoin.app.presentation.lock

import com.wintoncoin.app.core.biometrics.BiometricAuthManager
import com.wintoncoin.app.core.biometrics.BiometricPromptResult
import com.wintoncoin.app.core.biometrics.BiometricStatus
import com.wintoncoin.app.core.security.TokenManager
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AppLockViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private lateinit var biometricAuthManager: BiometricAuthManager
    private lateinit var tokenManager: TokenManager
    private lateinit var viewModel: AppLockViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        biometricAuthManager = mockk(relaxed = true)
        tokenManager = mockk(relaxed = true)

        every { tokenManager.getUsername() } returns "carlos123"
        every { biometricAuthManager.checkBiometricAvailability() } returns BiometricStatus.BIOMETRIC_AND_CREDENTIAL

        viewModel = AppLockViewModel(biometricAuthManager, tokenManager)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state loads username and biometrics support`() {
        assertEquals("carlos123", viewModel.state.value.username)
        assertTrue(viewModel.state.value.isBiometricsSupported)
        assertFalse(viewModel.state.value.isUnlocked)
    }

    @Test
    fun `Logout event clears session in tokenManager`() = runTest {
        viewModel.onEvent(AppLockEvent.Logout)
        verify { tokenManager.clearSession() }
    }

    @Test
    fun `ClearError event clears error message`() = runTest {
        viewModel.onEvent(AppLockEvent.ClearError)
        assertEquals(null, viewModel.state.value.errorMessage)
    }
}
