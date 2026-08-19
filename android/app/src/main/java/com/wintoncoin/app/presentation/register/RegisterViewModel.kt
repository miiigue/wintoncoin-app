// ============================================================================
// WintonCoin Android — RegisterViewModel (ViewModel de Registro)
// ============================================================================
// [PRESENTATION LAYER] Administra el estado reactivo de la pantalla de Registro.
// ============================================================================

package com.wintoncoin.app.presentation.register

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.usecase.RegisterUseCase
import com.wintoncoin.app.domain.usecase.ValidateRegisterUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class RegisterViewModel @Inject constructor(
    private val registerUseCase: RegisterUseCase,
    private val validateRegisterUseCase: ValidateRegisterUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(RegisterState())
    val state: StateFlow<RegisterState> = _state.asStateFlow()

    fun onEvent(event: RegisterEvent) {
        when (event) {
            is RegisterEvent.UsernameChanged -> {
                _state.update { it.copy(username = event.username, usernameError = null) }
            }
            is RegisterEvent.EmailChanged -> {
                _state.update { it.copy(email = event.email, emailError = null) }
            }
            is RegisterEvent.PhoneChanged -> {
                _state.update { it.copy(phone = event.phone, phoneError = null) }
            }
            is RegisterEvent.PasswordChanged -> {
                _state.update { it.copy(password = event.password, passwordError = null) }
            }
            is RegisterEvent.ConfirmPasswordChanged -> {
                _state.update { it.copy(confirmPassword = event.confirmPassword, confirmPasswordError = null) }
            }
            is RegisterEvent.TermsToggled -> {
                _state.update { it.copy(termsAccepted = event.accepted, termsError = null) }
            }
            is RegisterEvent.Submit -> submitRegister()
            is RegisterEvent.DismissError -> {
                _state.update { it.copy(errorMessage = null) }
            }
        }
    }

    private fun submitRegister() {
        val currentState = _state.value
        val validationResult = validateRegisterUseCase(
            username = currentState.username,
            email = currentState.email,
            phone = currentState.phone,
            password = currentState.password,
            confirmPassword = currentState.confirmPassword,
            termsAccepted = currentState.termsAccepted
        )

        if (!validationResult.isValid) {
            _state.update {
                it.copy(
                    usernameError = validationResult.usernameError,
                    emailError = validationResult.emailError,
                    phoneError = validationResult.phoneError,
                    passwordError = validationResult.passwordError,
                    confirmPasswordError = validationResult.confirmPasswordError,
                    termsError = validationResult.termsError
                )
            }
            return
        }

        _state.update { it.copy(isLoading = true, errorMessage = null) }

        viewModelScope.launch {
            val result = registerUseCase(
                username = currentState.username,
                email = currentState.email,
                phone = currentState.phone,
                password = currentState.password
            )

            when (result) {
                is Result.Success -> {
                    _state.update {
                        it.copy(
                            isLoading = false,
                            isSuccess = true,
                            registeredEmail = currentState.email.trim()
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
