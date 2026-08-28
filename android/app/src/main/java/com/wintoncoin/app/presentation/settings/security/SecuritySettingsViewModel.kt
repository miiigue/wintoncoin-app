// ============================================================================
// WintonCoin Android — SecuritySettingsViewModel
// ============================================================================
// [PRESENTATION LAYER / VIEWMODEL] Maneja la configuración de seguridad biométrica.
// ============================================================================

package com.wintoncoin.app.presentation.settings.security

import androidx.lifecycle.ViewModel
import com.wintoncoin.app.domain.usecase.biometrics.GetBiometricSecurityConfigUseCase
import com.wintoncoin.app.domain.usecase.biometrics.SetBiometricAppLockUseCase
import com.wintoncoin.app.domain.usecase.biometrics.SetTransactionBiometricUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import javax.inject.Inject

@HiltViewModel
class SecuritySettingsViewModel @Inject constructor(
    private val getBiometricSecurityConfigUseCase: GetBiometricSecurityConfigUseCase,
    private val setBiometricAppLockUseCase: SetBiometricAppLockUseCase,
    private val setTransactionBiometricUseCase: SetTransactionBiometricUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(SecuritySettingsState())
    val state: StateFlow<SecuritySettingsState> = _state.asStateFlow()

    init {
        loadConfig()
    }

    fun onEvent(event: SecuritySettingsEvent) {
        when (event) {
            is SecuritySettingsEvent.ToggleAppLock -> {
                val result = setBiometricAppLockUseCase(event.enabled)
                result.onSuccess { enabled ->
                    _state.update {
                        it.copy(
                            isAppLockEnabled = enabled,
                            feedbackMessage = if (enabled) "Bloqueo biométrico activado" else "Bloqueo biométrico desactivado",
                            isSuccessFeedback = true
                        )
                    }
                }.onFailure { error ->
                    _state.update {
                        it.copy(
                            feedbackMessage = error.message ?: "No se pudo activar la biometría",
                            isSuccessFeedback = false
                        )
                    }
                }
            }
            is SecuritySettingsEvent.ToggleTransactionBiometrics -> {
                val result = setTransactionBiometricUseCase(event.required)
                result.onSuccess { required ->
                    _state.update {
                        it.copy(
                            isTransactionBiometricRequired = required,
                            feedbackMessage = if (required) "Confirmación en transferencias activada" else "Confirmación en transferencias desactivada",
                            isSuccessFeedback = true
                        )
                    }
                }.onFailure { error ->
                    _state.update {
                        it.copy(
                            feedbackMessage = error.message ?: "No se pudo cambiar la preferencia",
                            isSuccessFeedback = false
                        )
                    }
                }
            }
            is SecuritySettingsEvent.ClearFeedback -> {
                _state.update { it.copy(feedbackMessage = null) }
            }
            is SecuritySettingsEvent.RefreshStatus -> {
                loadConfig()
            }
        }
    }

    private fun loadConfig() {
        val config = getBiometricSecurityConfigUseCase()
        _state.update {
            it.copy(
                isBiometricsSupported = config.isBiometricsSupported,
                biometricStatus = config.biometricStatus,
                isAppLockEnabled = config.isAppLockEnabled,
                isTransactionBiometricRequired = config.isTransactionBiometricRequired
            )
        }
    }
}
