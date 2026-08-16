// ============================================================================
// WintonCoin Android — ForgotPasswordViewModel (ViewModel de Recuperación)
// ============================================================================
// [PRESENTATION LAYER] Administra la solicitud de restablecimiento de contraseña.
// ============================================================================

package com.wintoncoin.app.presentation.forgot

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.usecase.ForgotPasswordUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ForgotPasswordViewModel @Inject constructor(
    private val forgotPasswordUseCase: ForgotPasswordUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(ForgotPasswordState())
    val state: StateFlow<ForgotPasswordState> = _state.asStateFlow()

    fun onEvent(event: ForgotPasswordEvent) {
        when (event) {
            is ForgotPasswordEvent.EmailChanged -> {
                _state.update { it.copy(email = event.email, emailError = null) }
            }
            is ForgotPasswordEvent.Submit -> submitRequest()
            is ForgotPasswordEvent.DismissError -> {
                _state.update { it.copy(errorMessage = null) }
            }
            is ForgotPasswordEvent.DismissSuccess -> {
                _state.update { it.copy(isSuccess = false, successMessage = null) }
            }
        }
    }

    private fun submitRequest() {
        val currentEmail = _state.value.email
        _state.update { it.copy(isLoading = true, errorMessage = null, successMessage = null) }

        viewModelScope.launch {
            val result = forgotPasswordUseCase(currentEmail)
            when (result) {
                is Result.Success -> {
                    _state.update {
                        it.copy(
                            isLoading = false,
                            isSuccess = true,
                            successMessage = result.data
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
