// ============================================================================
// WintonCoin Android — LoginViewModel (Gestor de Estado de Login)
// ============================================================================
// [PRESENTATION LAYER] ViewModel con inyección Hilt que maneja el estado de la UI de login.
// Soporta validaciones reactivas, invocación del LoginUseCase y manejo de errores.
// ============================================================================

package com.wintoncoin.app.presentation.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.usecase.LoginUseCase
import com.wintoncoin.app.domain.usecase.ValidateCredentialsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * LoginViewModel — ViewModel desacoplado de la UI.
 */
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val loginUseCase: LoginUseCase,
    private val validateCredentialsUseCase: ValidateCredentialsUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(LoginState())
    val state: StateFlow<LoginState> = _state.asStateFlow()

    fun onEvent(event: LoginEvent) {
        when (event) {
            is LoginEvent.UsernameChanged -> {
                _state.update {
                    it.copy(
                        username = event.username,
                        usernameError = null,
                        errorMessage = null
                    )
                }
            }
            is LoginEvent.PasswordChanged -> {
                _state.update {
                    it.copy(
                        password = event.password,
                        passwordError = null,
                        errorMessage = null
                    )
                }
            }
            is LoginEvent.DismissError -> {
                _state.update { it.copy(errorMessage = null) }
            }
            is LoginEvent.Submit -> {
                submitLogin()
            }
        }
    }

    private fun submitLogin() {
        val currentState = _state.value
        val validation = validateCredentialsUseCase(currentState.username, currentState.password)

        if (!validation.isValid) {
            _state.update {
                it.copy(
                    usernameError = validation.usernameError,
                    passwordError = validation.passwordError
                )
            }
            return
        }

        _state.update { it.copy(isLoading = true, errorMessage = null) }

        viewModelScope.launch {
            when (val result = loginUseCase(currentState.username, currentState.password)) {
                is Result.Success -> {
                    _state.update {
                        it.copy(
                            isLoading = false,
                            isSuccess = true,
                            userSession = result.data
                        )
                    }
                }
                is Result.Error -> {
                    _state.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = result.message
                        )
                    }
                }
            }
        }
    }
}
