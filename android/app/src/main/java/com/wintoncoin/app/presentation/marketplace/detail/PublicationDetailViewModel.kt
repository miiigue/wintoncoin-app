// ============================================================================
// WintonCoin Android — PublicationDetailViewModel (ViewModel de Detalle de Tarea)
// ============================================================================
// [PRESENTATION LAYER / STATE MANAGEMENT] Gestiona la consulta de la publicación,
// postulación, envío de evidencias para completar tareas y confirmación de pagos.
// ============================================================================

package com.wintoncoin.app.presentation.marketplace.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.domain.usecase.ApplyToPublicationUseCase
import com.wintoncoin.app.domain.usecase.CompleteTaskUseCase
import com.wintoncoin.app.domain.usecase.ConfirmTaskPaymentUseCase
import com.wintoncoin.app.domain.usecase.GetPublicationDetailsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PublicationDetailViewModel @Inject constructor(
    private val getPublicationDetailsUseCase: GetPublicationDetailsUseCase,
    private val applyToPublicationUseCase: ApplyToPublicationUseCase,
    private val completeTaskUseCase: CompleteTaskUseCase,
    private val confirmTaskPaymentUseCase: ConfirmTaskPaymentUseCase,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _state = MutableStateFlow(
        PublicationDetailState(currentUsername = tokenManager.getUsername() ?: "")
    )
    val state: StateFlow<PublicationDetailState> = _state.asStateFlow()

    private var currentPublicationId: String = ""

    fun onEvent(event: PublicationDetailEvent) {
        when (event) {
            is PublicationDetailEvent.LoadDetails -> loadDetails(event.id)
            is PublicationDetailEvent.UpdateDonationAmount -> _state.update { it.copy(donationAmountInput = event.amount) }
            is PublicationDetailEvent.UpdateEvidenceInput -> _state.update { it.copy(evidenceInput = event.text) }
            is PublicationDetailEvent.Apply -> applyToPublication()
            is PublicationDetailEvent.CompleteTask -> completeTask()
            is PublicationDetailEvent.ConfirmPayment -> confirmPayment(event.workerUsername)
            is PublicationDetailEvent.ClearMessages -> _state.update { it.copy(errorMessage = null, successMessage = null) }
        }
    }

    private fun loadDetails(id: String) {
        currentPublicationId = id
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, errorMessage = null) }
            val result = getPublicationDetailsUseCase(id)
            result.fold(
                onSuccess = { pub ->
                    _state.update {
                        it.copy(
                            publication = pub,
                            isLoading = false,
                            errorMessage = null
                        )
                    }
                },
                onFailure = { error ->
                    _state.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.localizedMessage ?: "No se pudo cargar la información de la publicación."
                        )
                    }
                }
            )
        }
    }

    private fun applyToPublication() {
        if (currentPublicationId.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(isActionLoading = true, errorMessage = null) }
            val donationAmount = _state.value.donationAmountInput.toDoubleOrNull()
            val result = applyToPublicationUseCase(id = currentPublicationId, donationAmount = donationAmount)

            result.fold(
                onSuccess = { msg ->
                    _state.update {
                        it.copy(
                            isActionLoading = false,
                            successMessage = msg,
                            actionCompleted = true
                        )
                    }
                    loadDetails(currentPublicationId)
                },
                onFailure = { error ->
                    _state.update {
                        it.copy(
                            isActionLoading = false,
                            errorMessage = error.localizedMessage ?: "Error al postularse a la tarea."
                        )
                    }
                }
            )
        }
    }

    private fun completeTask() {
        if (currentPublicationId.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(isActionLoading = true, errorMessage = null) }
            val evidenceUrls = if (_state.value.evidenceInput.isNotBlank()) {
                listOf(_state.value.evidenceInput.trim())
            } else {
                emptyList()
            }

            val result = completeTaskUseCase(id = currentPublicationId, evidenceUrls = evidenceUrls)
            result.fold(
                onSuccess = { msg ->
                    _state.update {
                        it.copy(
                            isActionLoading = false,
                            successMessage = msg,
                            actionCompleted = true
                        )
                    }
                    loadDetails(currentPublicationId)
                },
                onFailure = { error ->
                    _state.update {
                        it.copy(
                            isActionLoading = false,
                            errorMessage = error.localizedMessage ?: "Error al culminar la tarea."
                        )
                    }
                }
            )
        }
    }

    private fun confirmPayment(workerUsername: String) {
        if (currentPublicationId.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(isActionLoading = true, errorMessage = null) }
            val result = confirmTaskPaymentUseCase(id = currentPublicationId, workerUsername = workerUsername)
            result.fold(
                onSuccess = { msg ->
                    _state.update {
                        it.copy(
                            isActionLoading = false,
                            successMessage = msg,
                            actionCompleted = true
                        )
                    }
                    loadDetails(currentPublicationId)
                },
                onFailure = { error ->
                    _state.update {
                        it.copy(
                            isActionLoading = false,
                            errorMessage = error.localizedMessage ?: "Error al confirmar el pago."
                        )
                    }
                }
            )
        }
    }
}
