// ============================================================================
// WintonCoin Android — CauseDetailViewModel
// ============================================================================
// [PRESENTATION / VIEWMODEL] Gestiona el detalle de la causa, donaciones y actualizaciones.
// ============================================================================

package com.wintoncoin.app.presentation.solidario.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.domain.repository.WalletRepository
import com.wintoncoin.app.domain.usecase.CancelCauseUseCase
import com.wintoncoin.app.domain.usecase.DonateToCauseUseCase
import com.wintoncoin.app.domain.usecase.GetCauseDetailUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CauseDetailViewModel @Inject constructor(
    private val getCauseDetailUseCase: GetCauseDetailUseCase,
    private val donateToCauseUseCase: DonateToCauseUseCase,
    private val cancelCauseUseCase: CancelCauseUseCase,
    private val walletRepository: WalletRepository
) : ViewModel() {

    private val _state = MutableStateFlow(CauseDetailState())
    val state: StateFlow<CauseDetailState> = _state.asStateFlow()

    private var currentCauseId: Int = 0

    fun onEvent(event: CauseDetailEvent) {
        when (event) {
            is CauseDetailEvent.Load -> {
                currentCauseId = event.causeId
                loadData(currentCauseId)
            }
            is CauseDetailEvent.Refresh -> {
                if (currentCauseId > 0) loadData(currentCauseId)
            }
            is CauseDetailEvent.DonationAmountChanged -> _state.update { it.copy(donationAmountText = event.amount) }
            is CauseDetailEvent.AcceptedTermsChanged -> _state.update { it.copy(acceptedTerms = event.accepted) }
            is CauseDetailEvent.SelectTab -> _state.update { it.copy(selectedTab = event.tab) }
            is CauseDetailEvent.OpenDonationConfirmDialog -> {
                val amount = _state.value.donationAmountText.toDoubleOrNull()
                if (amount == null || amount <= 0.0) {
                    _state.update { it.copy(errorMessage = "Ingresa un monto válido mayor a 0 para donar.") }
                    return
                }
                if (!_state.value.acceptedTerms) {
                    _state.update { it.copy(errorMessage = "Debes aceptar los términos y condiciones de la campaña.") }
                    return
                }
                _state.update { it.copy(showDonationConfirmDialog = true) }
            }
            is CauseDetailEvent.DismissDonationConfirmDialog -> _state.update { it.copy(showDonationConfirmDialog = false) }
            is CauseDetailEvent.ExecuteDonation -> executeDonation()
            is CauseDetailEvent.CancelCause -> executeCancelCause()
            is CauseDetailEvent.DismissFeedback -> _state.update { it.copy(feedbackMessage = null) }
            is CauseDetailEvent.DismissError -> _state.update { it.copy(errorMessage = null) }
        }
    }

    private fun loadData(causeId: Int) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, errorMessage = null) }

            val detailDeferred = async { getCauseDetailUseCase(causeId) }
            val balanceDeferred = async { walletRepository.getMyBalance() }

            val detailResult = detailDeferred.await()
            val balanceResult = balanceDeferred.await()

            if (detailResult.isSuccess) {
                val resultData = detailResult.getOrThrow()
                val userBalance = if (balanceResult is com.wintoncoin.app.domain.model.Result.Success) {
                    balanceResult.data.blueAvailable
                } else 0.0

                _state.update {
                    it.copy(
                        isLoading = false,
                        cause = resultData.cause,
                        donationsSummary = resultData.donationsSummary,
                        updates = resultData.updates,
                        userAvailableBalance = userBalance,
                        errorMessage = null
                    )
                }
            } else {
                _state.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = detailResult.exceptionOrNull()?.message ?: "Error al cargar la causa."
                    )
                }
            }
        }
    }

    private fun executeDonation() {
        val currentState = _state.value
        val amount = currentState.donationAmountText.toDoubleOrNull() ?: return

        viewModelScope.launch {
            _state.update { it.copy(isDonating = true, showDonationConfirmDialog = false, errorMessage = null) }
            donateToCauseUseCase(
                causeId = currentCauseId,
                amount = amount,
                acceptedTerms = currentState.acceptedTerms,
                availableBalance = currentState.userAvailableBalance
            ).onSuccess { message ->
                _state.update {
                    it.copy(
                        isDonating = false,
                        donationAmountText = "",
                        feedbackMessage = message.ifEmpty { "¡Donación realizada con éxito!" }
                    )
                }
                loadData(currentCauseId)
            }.onFailure { error ->
                _state.update {
                    it.copy(
                        isDonating = false,
                        errorMessage = error.message ?: "Error al procesar la donación."
                    )
                }
            }
        }
    }

    private fun executeCancelCause() {
        viewModelScope.launch {
            _state.update { it.copy(isCancelling = true, errorMessage = null) }
            cancelCauseUseCase(currentCauseId)
                .onSuccess {
                    _state.update {
                        it.copy(
                            isCancelling = false,
                            feedbackMessage = "La causa ha sido culminada/cancelada exitosamente."
                        )
                    }
                    loadData(currentCauseId)
                }
                .onFailure { error ->
                    _state.update {
                        it.copy(
                            isCancelling = false,
                            errorMessage = error.message ?: "Error al cancelar la causa."
                        )
                    }
                }
        }
    }
}
