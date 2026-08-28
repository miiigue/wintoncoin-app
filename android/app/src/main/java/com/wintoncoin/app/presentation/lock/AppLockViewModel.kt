// ============================================================================
// WintonCoin Android — AppLockViewModel
// ============================================================================
// [PRESENTATION LAYER / VIEWMODEL] Maneja la lógica de desbloqueo de la app
// con soporte para Huella, Rostro y PIN / Patrón del teléfono.
// ============================================================================

package com.wintoncoin.app.presentation.lock

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.core.biometrics.BiometricAuthManager
import com.wintoncoin.app.core.biometrics.BiometricPromptResult
import com.wintoncoin.app.core.security.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AppLockViewModel @Inject constructor(
    private val biometricAuthManager: BiometricAuthManager,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _state = MutableStateFlow(AppLockState())
    val state: StateFlow<AppLockState> = _state.asStateFlow()

    init {
        val username = tokenManager.getUsername()
        val status = biometricAuthManager.checkBiometricAvailability()
        _state.update {
            it.copy(
                username = username,
                biometricStatus = status,
                isBiometricsSupported = status.isAnyUnlockAvailable
            )
        }
    }

    fun onEvent(event: AppLockEvent) {
        when (event) {
            is AppLockEvent.AuthenticateBiometrics -> {
                viewModelScope.launch {
                    val currentStatus = _state.value.biometricStatus
                    val title = if (currentStatus.isBiometricAvailable) {
                        "Desbloquear con Huella / Rostro"
                    } else {
                        "Desbloquear con PIN / Patrón"
                    }

                    _state.update { it.copy(isAuthenticating = true, errorMessage = null) }
                    biometricAuthManager.authenticate(
                        activity = event.activity,
                        title = title,
                        subtitle = "Verifica tu identidad para acceder a tu billetera",
                        allowDeviceCredential = true
                    ) { result ->
                        when (result) {
                            is BiometricPromptResult.Success -> {
                                tokenManager.setAppLocked(false)
                                _state.update {
                                    it.copy(isAuthenticating = false, isUnlocked = true)
                                }
                            }
                            is BiometricPromptResult.Error -> {
                                _state.update {
                                    it.copy(isAuthenticating = false, errorMessage = result.errString)
                                }
                            }
                            is BiometricPromptResult.Failed -> {
                                _state.update {
                                    it.copy(
                                        isAuthenticating = false,
                                        errorMessage = "Autenticación no reconocida. Intenta nuevamente con tu huella o PIN."
                                    )
                                }
                            }
                            is BiometricPromptResult.Cancelled -> {
                                _state.update { it.copy(isAuthenticating = false) }
                            }
                            is BiometricPromptResult.NotAvailable -> {
                                _state.update {
                                    it.copy(isAuthenticating = false, errorMessage = result.reason)
                                }
                            }
                        }
                    }
                }
            }
            is AppLockEvent.ClearError -> {
                _state.update { it.copy(errorMessage = null) }
            }
            is AppLockEvent.Logout -> {
                tokenManager.clearSession()
                _state.update { it.copy(isUnlocked = false) }
            }
        }
    }
}
