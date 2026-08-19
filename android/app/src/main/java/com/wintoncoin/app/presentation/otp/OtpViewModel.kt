// ============================================================================
// WintonCoin Android — OtpViewModel (ViewModel de Verificación OTP)
// ============================================================================
// [PRESENTATION LAYER] Administra la verificación del código OTP de 6 dígitos
// y la cuenta regresiva para el reenvío de código.
// ============================================================================

package com.wintoncoin.app.presentation.otp

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.usecase.VerifyOtpUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class OtpViewModel @Inject constructor(
    private val verifyOtpUseCase: VerifyOtpUseCase,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val email: String = savedStateHandle.get<String>("email") ?: ""

    private val _state = MutableStateFlow(OtpState(email = email))
    val state: StateFlow<OtpState> = _state.asStateFlow()

    init {
        startResendTimer()
    }

    fun onEvent(event: OtpEvent) {
        when (event) {
            is OtpEvent.OtpCodeChanged -> {
                if (event.code.length <= 6 && event.code.all { it.isDigit() }) {
                    _state.update { it.copy(otpCode = event.code, otpError = null) }
                }
            }
            is OtpEvent.Submit -> submitOtp()
            is OtpEvent.ResendCode -> resendOtp()
            is OtpEvent.DismissError -> {
                _state.update { it.copy(errorMessage = null) }
            }
        }
    }

    private fun submitOtp() {
        val currentCode = _state.value.otpCode
        if (currentCode.length != 6) {
            _state.update { it.copy(otpError = "El código OTP debe tener 6 dígitos") }
            return
        }

        _state.update { it.copy(isLoading = true, errorMessage = null) }

        viewModelScope.launch {
            val result = verifyOtpUseCase(email = email, otpCode = currentCode)
            when (result) {
                is Result.Success -> {
                    _state.update { it.copy(isLoading = false, isSuccess = true) }
                }
                is Result.Error -> {
                    _state.update { it.copy(isLoading = false, errorMessage = result.message) }
                }
            }
        }
    }

    private fun resendOtp() {
        if (!_state.value.canResend) return
        _state.update { it.copy(resendCountdown = 60, canResend = false) }
        startResendTimer()
    }

    private fun startResendTimer() {
        viewModelScope.launch {
            for (i in 60 downTo 1) {
                _state.update { it.copy(resendCountdown = i) }
                delay(1000)
            }
            _state.update { it.copy(canResend = true) }
        }
    }
}
