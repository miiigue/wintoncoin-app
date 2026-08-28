// ============================================================================
// WintonCoin Android — SecuritySettingsViewModelTest
// ============================================================================
// Pruebas unitarias para SecuritySettingsViewModel.
// ============================================================================

package com.wintoncoin.app.presentation.settings.security

import com.wintoncoin.app.core.biometrics.BiometricStatus
import com.wintoncoin.app.domain.model.BiometricSecurityConfig
import com.wintoncoin.app.domain.usecase.biometrics.GetBiometricSecurityConfigUseCase
import com.wintoncoin.app.domain.usecase.biometrics.SetBiometricAppLockUseCase
import com.wintoncoin.app.domain.usecase.biometrics.SetTransactionBiometricUseCase
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SecuritySettingsViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private lateinit var getBiometricSecurityConfigUseCase: GetBiometricSecurityConfigUseCase
    private lateinit var setBiometricAppLockUseCase: SetBiometricAppLockUseCase
    private lateinit var setTransactionBiometricUseCase: SetTransactionBiometricUseCase
    private lateinit var viewModel: SecuritySettingsViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        getBiometricSecurityConfigUseCase = mockk()
        setBiometricAppLockUseCase = mockk()
        setTransactionBiometricUseCase = mockk()

        val initialConfig = BiometricSecurityConfig(
            isBiometricsSupported = true,
            biometricStatus = BiometricStatus.BIOMETRIC_AND_CREDENTIAL,
            isAppLockEnabled = false,
            isTransactionBiometricRequired = true
        )
        every { getBiometricSecurityConfigUseCase() } returns initialConfig

        viewModel = SecuritySettingsViewModel(
            getBiometricSecurityConfigUseCase,
            setBiometricAppLockUseCase,
            setTransactionBiometricUseCase
        )
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state loads security config`() {
        assertTrue(viewModel.state.value.isBiometricsSupported)
        assertEquals(BiometricStatus.BIOMETRIC_AND_CREDENTIAL, viewModel.state.value.biometricStatus)
        assertEquals(false, viewModel.state.value.isAppLockEnabled)
        assertEquals(true, viewModel.state.value.isTransactionBiometricRequired)
    }

    @Test
    fun `ToggleAppLock updates state on success`() = runTest {
        every { setBiometricAppLockUseCase(true) } returns Result.success(true)

        viewModel.onEvent(SecuritySettingsEvent.ToggleAppLock(true))

        assertTrue(viewModel.state.value.isAppLockEnabled)
        assertTrue(viewModel.state.value.isSuccessFeedback)
        assertEquals("Bloqueo biométrico activado", viewModel.state.value.feedbackMessage)
    }

    @Test
    fun `ToggleTransactionBiometrics updates state on success`() = runTest {
        every { setTransactionBiometricUseCase(false) } returns Result.success(false)

        viewModel.onEvent(SecuritySettingsEvent.ToggleTransactionBiometrics(false))

        assertEquals(false, viewModel.state.value.isTransactionBiometricRequired)
        assertEquals("Confirmación en transferencias desactivada", viewModel.state.value.feedbackMessage)
    }

    @Test
    fun `ClearFeedback clears feedbackMessage`() = runTest {
        every { setBiometricAppLockUseCase(true) } returns Result.success(true)
        viewModel.onEvent(SecuritySettingsEvent.ToggleAppLock(true))

        viewModel.onEvent(SecuritySettingsEvent.ClearFeedback)

        assertNull(viewModel.state.value.feedbackMessage)
    }
}
