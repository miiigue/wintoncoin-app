// ============================================================================
// WintonCoin Android — BoosterProfileViewModel
// ============================================================================
// [PRESENTATION / VIEWMODEL] Gestiona el estado reactivo del Programa de
// Impulsores (Booster Profile), Escalera de Rangos, métricas diarias y Ledger.
// ============================================================================

package com.wintoncoin.app.presentation.booster

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.domain.usecase.GetMyBoosterProfileUseCase
import com.wintoncoin.app.domain.usecase.GetUserBoosterProfileUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class BoosterProfileViewModel @Inject constructor(
    private val getMyBoosterProfileUseCase: GetMyBoosterProfileUseCase,
    private val getUserBoosterProfileUseCase: GetUserBoosterProfileUseCase,
    private val tokenManager: TokenManager,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val _state = MutableStateFlow(BoosterProfileState())
    val state: StateFlow<BoosterProfileState> = _state.asStateFlow()

    private var currentTargetUsername: String? = savedStateHandle.get<String>("username")

    init {
        loadProfile(currentTargetUsername)
    }

    fun onEvent(event: BoosterProfileEvent) {
        when (event) {
            is BoosterProfileEvent.LoadProfile -> {
                currentTargetUsername = event.targetUsername
                loadProfile(currentTargetUsername)
            }
            is BoosterProfileEvent.Refresh -> {
                refreshProfile()
            }
            is BoosterProfileEvent.OpenUnlockConditionsDialog -> {
                _state.update { it.copy(showUnlockConditionsDialog = true) }
            }
            is BoosterProfileEvent.DismissUnlockConditionsDialog -> {
                _state.update { it.copy(showUnlockConditionsDialog = false) }
            }
            is BoosterProfileEvent.DismissError -> {
                _state.update { it.copy(errorMessage = null) }
            }
        }
    }

    private fun loadProfile(targetUsername: String?) {
        val loggedUsername = tokenManager.getUsername() ?: ""
        val isSelf = targetUsername.isNullOrBlank() || targetUsername.equals(loggedUsername, ignoreCase = true)

        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, errorMessage = null, isOwnProfile = isSelf) }

            val result = if (isSelf) {
                getMyBoosterProfileUseCase()
            } else {
                getUserBoosterProfileUseCase(targetUsername!!)
            }

            result.onSuccess { boosterProfile ->
                _state.update {
                    it.copy(
                        isLoading = false,
                        profile = boosterProfile
                    )
                }
            }.onFailure { error ->
                _state.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "Error al cargar el perfil de impulsor."
                    )
                }
            }
        }
    }

    private fun refreshProfile() {
        val loggedUsername = tokenManager.getUsername() ?: ""
        val isSelf = currentTargetUsername.isNullOrBlank() || currentTargetUsername.equals(loggedUsername, ignoreCase = true)

        viewModelScope.launch {
            _state.update { it.copy(isRefreshing = true, errorMessage = null) }

            val result = if (isSelf) {
                getMyBoosterProfileUseCase()
            } else {
                getUserBoosterProfileUseCase(currentTargetUsername!!)
            }

            result.onSuccess { boosterProfile ->
                _state.update {
                    it.copy(
                        isRefreshing = false,
                        profile = boosterProfile
                    )
                }
            }.onFailure { error ->
                _state.update {
                    it.copy(
                        isRefreshing = false,
                        errorMessage = error.message ?: "Error al actualizar."
                    )
                }
            }
        }
    }
}
