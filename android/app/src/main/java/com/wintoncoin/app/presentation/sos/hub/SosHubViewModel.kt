// ============================================================================
// WintonCoin Android — SosHubViewModel
// ============================================================================
// [PRESENTATION LAYER / MVI VIEWMODEL] Controlador de estado para el Hub SOS.
// ============================================================================

package com.wintoncoin.app.presentation.sos.hub

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.domain.usecase.GetSosCampaignConfigUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SosHubViewModel @Inject constructor(
    private val getSosCampaignConfigUseCase: GetSosCampaignConfigUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(SosHubState())
    val state: StateFlow<SosHubState> = _state.asStateFlow()

    init {
        onEvent(SosHubEvent.LoadCampaignInfo)
    }

    fun onEvent(event: SosHubEvent) {
        when (event) {
            is SosHubEvent.LoadCampaignInfo -> loadCampaignInfo()
            is SosHubEvent.CopyShareCode -> {
                _state.update { it.copy(codeCopiedFeedback = true) }
            }
            is SosHubEvent.ClearFeedback -> {
                _state.update { it.copy(codeCopiedFeedback = false, errorMessage = null) }
            }
        }
    }

    private fun loadCampaignInfo() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, errorMessage = null) }
            val result = getSosCampaignConfigUseCase()
            result.onSuccess { info ->
                _state.update { it.copy(isLoading = false, campaignInfo = info) }
            }.onFailure { error ->
                _state.update { it.copy(isLoading = false, errorMessage = error.message) }
            }
        }
    }
}
