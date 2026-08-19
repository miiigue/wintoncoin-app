// ============================================================================
// WintonCoin Android — LoginViewModelTest (Prueba Unitaria de ViewModel)
// ============================================================================
// [UNIT TEST] Evalúa el comportamiento reactivo de LoginViewModel y
// la mutación inmutable de LoginState usando MockK y Kotlinx Coroutines Test.
// ============================================================================

package com.wintoncoin.app.presentation.login

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.UserSession
import com.wintoncoin.app.domain.usecase.LoginUseCase
import com.wintoncoin.app.domain.usecase.ValidateCredentialsUseCase
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
class LoginViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private val loginUseCase: LoginUseCase = mockk()
    private val validateCredentialsUseCase = ValidateCredentialsUseCase()
    private lateinit var viewModel: LoginViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        viewModel = LoginViewModel(loginUseCase, validateCredentialsUseCase)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state is empty and default`() {
        val state = viewModel.state.value

        assertEquals("", state.username)
        assertEquals("", state.password)
        assertFalse(state.isLoading)
        assertFalse(state.isSuccess)
        assertNull(state.usernameError)
        assertNull(state.passwordError)
        assertNull(state.errorMessage)
    }

    @Test
    fun `UsernameChanged updates username in state`() {
        viewModel.onEvent(LoginEvent.UsernameChanged("miguel_123"))

        assertEquals("miguel_123", viewModel.state.value.username)
        assertNull(viewModel.state.value.usernameError)
    }

    @Test
    fun `PasswordChanged updates password in state`() {
        viewModel.onEvent(LoginEvent.PasswordChanged("secret123"))

        assertEquals("secret123", viewModel.state.value.password)
        assertNull(viewModel.state.value.passwordError)
    }

    @Test
    fun `Submit with invalid fields sets error messages`() {
        viewModel.onEvent(LoginEvent.UsernameChanged("ab")) // Demasiado corto
        viewModel.onEvent(LoginEvent.PasswordChanged("123")) // Demasiado corta

        viewModel.onEvent(LoginEvent.Submit)

        val state = viewModel.state.value
        assertEquals("El usuario debe tener al menos 3 caracteres", state.usernameError)
        assertEquals("La contraseña debe tener al menos 6 caracteres", state.passwordError)
        assertFalse(state.isLoading)
    }

    @Test
    fun `Submit with valid credentials and successful login updates isSuccess to true`() {
        val userSession = UserSession(
            isAuthenticated = true,
            isVerified = true,
            username = "miguel_123"
        )

        coEvery { loginUseCase("miguel_123", "password123") } returns Result.Success(userSession)

        viewModel.onEvent(LoginEvent.UsernameChanged("miguel_123"))
        viewModel.onEvent(LoginEvent.PasswordChanged("password123"))
        viewModel.onEvent(LoginEvent.Submit)

        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertTrue(state.isSuccess)
        assertEquals(userSession, state.userSession)
        assertNull(state.errorMessage)
    }

    @Test
    fun `Submit with valid credentials and failed login sets errorMessage`() {
        coEvery { loginUseCase("miguel_123", "wrong_password") } returns Result.Error("Credenciales inválidas")

        viewModel.onEvent(LoginEvent.UsernameChanged("miguel_123"))
        viewModel.onEvent(LoginEvent.PasswordChanged("wrong_password"))
        viewModel.onEvent(LoginEvent.Submit)

        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertFalse(state.isSuccess)
        assertEquals("Credenciales inválidas", state.errorMessage)
    }

    @Test
    fun `DismissError clears error message from state`() {
        coEvery { loginUseCase("miguel_123", "wrong_pass") } returns Result.Error("Error de servidor")

        viewModel.onEvent(LoginEvent.UsernameChanged("miguel_123"))
        viewModel.onEvent(LoginEvent.PasswordChanged("wrong_pass"))
        viewModel.onEvent(LoginEvent.Submit)
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals("Error de servidor", viewModel.state.value.errorMessage)

        viewModel.onEvent(LoginEvent.DismissError)

        assertNull(viewModel.state.value.errorMessage)
    }
}
