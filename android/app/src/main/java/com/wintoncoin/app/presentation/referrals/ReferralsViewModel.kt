// ============================================================================
// WintonCoin Android — ReferralsViewModel
// ============================================================================
// [PRESENTATION / VIEWMODEL] Controla el estado reactivo de la Red de Referidos,
// estadísticas de afiliados y gestión de copiado de código de invitación.
// ============================================================================

package com.wintoncoin.app.presentation.referrals

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.domain.usecase.GetReferralInfoUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ReferralsViewModel @Inject constructor(
    private val getReferralInfoUseCase: GetReferralInfoUseCase,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _state = MutableStateFlow(ReferralsState())
    val state: StateFlow<ReferralsState> = _state.asStateFlow()

    init {
        loadReferrals()
    }

    fun onEvent(event: ReferralsEvent) {
        when (event) {
            is ReferralsEvent.Load -> loadReferrals()
            is ReferralsEvent.Refresh -> refreshReferrals()
            is ReferralsEvent.CopyText -> {
                _state.update { it.copy(copyFeedback = "¡${event.label} copiado al portapapeles!") }
            }
            is ReferralsEvent.DismissCopyFeedback -> {
                _state.update { it.copy(copyFeedback = null) }
            }
            is ReferralsEvent.DismissError -> {
                _state.update { it.copy(errorMessage = null) }
            }
        }
    }

    private fun loadReferrals() {
        val username = tokenManager.getUsername() ?: ""
        if (username.isBlank()) {
            _state.update { it.copy(isLoading = false, errorMessage = "Sesión no encontrada. Inicia sesión nuevamente.") }
            return
        }

        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, errorMessage = null) }
            getReferralInfoUseCase(username)
                .onSuccess { data ->
                    _state.update { it.copy(isLoading = false, referralData = data) }
                }
                .onFailure { error ->
                    _state.update { it.copy(isLoading = false, errorMessage = error.message ?: "Error al cargar referidos.") }
                }
        }
    }

    private fun refreshReferrals() {
        val username = tokenManager.getUsername() ?: ""
        if (username.isBlank()) return

        viewModelScope.launch {
            _state.update { it.copy(isRefreshing = true, errorMessage = null) }
            getReferralInfoUseCase(username)
                .onSuccess { data ->
                    _state.update { it.copy(isRefreshing = false, referralData = data) }
                }
                .onFailure { error ->
                    _state.update { it.copy(isRefreshing = false, errorMessage = error.message ?: "Error al actualizar.") }
                }
        }
    }
}
