// ============================================================================
// WintonCoin Android — ForgotPasswordViewModelTest (Prueba Unitaria)
// ============================================================================
// [UNIT TEST] Evalúa el flujo reactivo de recuperación de clave.
// ============================================================================

package com.wintoncoin.app.presentation.forgot

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.usecase.ForgotPasswordUseCase
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
class ForgotPasswordViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private val forgotPasswordUseCase: ForgotPasswordUseCase = mockk()
    private lateinit var viewModel: ForgotPasswordViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        viewModel = ForgotPasswordViewModel(forgotPasswordUseCase)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state is empty`() {
        val state = viewModel.state.value
        assertEquals("", state.email)
        assertFalse(state.isLoading)
        assertFalse(state.isSuccess)
        assertNull(state.successMessage)
    }

    @Test
    fun `Submit with valid email triggers forgotPasswordUseCase and sets isSuccess`() {
        coEvery { forgotPasswordUseCase("user@wintoncoin.com") } returns Result.Success("Instrucciones enviadas.")

        viewModel.onEvent(ForgotPasswordEvent.EmailChanged("user@wintoncoin.com"))
        viewModel.onEvent(ForgotPasswordEvent.Submit)
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertTrue(state.isSuccess)
        assertEquals("Instrucciones enviadas.", state.successMessage)
        assertNull(state.errorMessage)
    }

    @Test
    fun `DismissSuccess clears isSuccess and successMessage`() {
        coEvery { forgotPasswordUseCase("user@wintoncoin.com") } returns Result.Success("Instrucciones enviadas.")

        viewModel.onEvent(ForgotPasswordEvent.EmailChanged("user@wintoncoin.com"))
        viewModel.onEvent(ForgotPasswordEvent.Submit)
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.onEvent(ForgotPasswordEvent.DismissSuccess)

        val state = viewModel.state.value
        assertFalse(state.isSuccess)
        assertNull(state.successMessage)
    }
}
