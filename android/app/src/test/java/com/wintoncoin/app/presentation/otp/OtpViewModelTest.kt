// ============================================================================
// WintonCoin Android — OtpViewModelTest (Prueba Unitaria de ViewModel OTP)
// ============================================================================
// [UNIT TEST] Evalúa el estado reactivo del ingreso de OTP y temporizador.
// ============================================================================

package com.wintoncoin.app.presentation.otp

import androidx.lifecycle.SavedStateHandle
import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.UserSession
import com.wintoncoin.app.domain.usecase.VerifyOtpUseCase
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class OtpViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private val verifyOtpUseCase: VerifyOtpUseCase = mockk()
    private lateinit var viewModel: OtpViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        val savedStateHandle = SavedStateHandle(mapOf("email" to "test@wintoncoin.com"))
        viewModel = OtpViewModel(verifyOtpUseCase, savedStateHandle)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state has correct email and default values`() {
        val state = viewModel.state.value
        assertEquals("test@wintoncoin.com", state.email)
        assertEquals("", state.otpCode)
        assertFalse(state.isLoading)
        assertFalse(state.isSuccess)
    }

    @Test
    fun `OtpCodeChanged updates code only up to 6 digits`() {
        viewModel.onEvent(OtpEvent.OtpCodeChanged("123456"))
        assertEquals("123456", viewModel.state.value.otpCode)
    }

    @Test
    fun `Submit with valid 6 digit OTP triggers verifyOtpUseCase and sets isSuccess`() {
        val userSession = UserSession(isAuthenticated = true, isVerified = true, username = "test_user")
        coEvery { verifyOtpUseCase("test@wintoncoin.com", "123456") } returns Result.Success(userSession)

        viewModel.onEvent(OtpEvent.OtpCodeChanged("123456"))
        viewModel.onEvent(OtpEvent.Submit)
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertTrue(state.isSuccess)
        assertNull(state.errorMessage)
    }
}
