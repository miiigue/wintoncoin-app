// ============================================================================
// WintonCoin Android — RegisterViewModelTest (Prueba Unitaria de ViewModel)
// ============================================================================
// [UNIT TEST] Evalúa las transiciones de estado de RegisterViewModel.
// ============================================================================

package com.wintoncoin.app.presentation.register

import com.wintoncoin.app.data.remote.dto.RegisterResponse
import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.usecase.RegisterUseCase
import com.wintoncoin.app.domain.usecase.ValidateRegisterUseCase
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
class RegisterViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private val registerUseCase: RegisterUseCase = mockk()
    private val validateRegisterUseCase = ValidateRegisterUseCase()
    private lateinit var viewModel: RegisterViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        viewModel = RegisterViewModel(registerUseCase, validateRegisterUseCase)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state is default`() {
        val state = viewModel.state.value
        assertEquals("", state.username)
        assertEquals("", state.email)
        assertFalse(state.isLoading)
        assertFalse(state.isSuccess)
    }

    @Test
    fun `Submit with valid inputs triggers registerUseCase and sets isSuccess`() {
        val expectedResponse = RegisterResponse(success = true, message = "Usuario registrado", userId = 10, email = "test@wintoncoin.com")
        coEvery { registerUseCase("miguel_123", "test@wintoncoin.com", "", "pass123") } returns Result.Success(expectedResponse)

        viewModel.onEvent(RegisterEvent.UsernameChanged("miguel_123"))
        viewModel.onEvent(RegisterEvent.EmailChanged("test@wintoncoin.com"))
        viewModel.onEvent(RegisterEvent.PasswordChanged("pass123"))
        viewModel.onEvent(RegisterEvent.ConfirmPasswordChanged("pass123"))
        viewModel.onEvent(RegisterEvent.TermsToggled(true))

        viewModel.onEvent(RegisterEvent.Submit)
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertTrue(state.isSuccess)
        assertEquals("test@wintoncoin.com", state.registeredEmail)
        assertNull(state.errorMessage)
    }
}
