// ============================================================================
// WintonCoin Android — SubmitCauseViewModel
// ============================================================================
// [PRESENTATION / VIEWMODEL] Gestiona el formulario y validaciones de postulación.
// ============================================================================

package com.wintoncoin.app.presentation.solidario.submit

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.domain.model.SubmitCauseInput
import com.wintoncoin.app.domain.usecase.SubmitCauseUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SubmitCauseViewModel @Inject constructor(
    private val submitCauseUseCase: SubmitCauseUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(SubmitCauseState())
    val state: StateFlow<SubmitCauseState> = _state.asStateFlow()

    fun onEvent(event: SubmitCauseEvent) {
        when (event) {
            is SubmitCauseEvent.TitleChanged -> _state.update { it.copy(title = event.value) }
            is SubmitCauseEvent.StoryChanged -> _state.update { it.copy(story = event.value) }
            is SubmitCauseEvent.GoalAmountChanged -> _state.update { it.copy(goalAmountText = event.value) }
            is SubmitCauseEvent.FoundationNameChanged -> _state.update { it.copy(foundationName = event.value) }
            is SubmitCauseEvent.BeneficiaryReferralCodeChanged -> _state.update { it.copy(beneficiaryReferralCode = event.value) }
            is SubmitCauseEvent.BeneficiarySocialUrlsChanged -> _state.update { it.copy(beneficiarySocialUrls = event.value) }
            is SubmitCauseEvent.EvidenceUrlsChanged -> _state.update { it.copy(evidenceUrls = event.value) }
            is SubmitCauseEvent.UserSocialUrlsChanged -> _state.update { it.copy(userSocialUrls = event.value) }
            is SubmitCauseEvent.AcceptedTermsChanged -> _state.update { it.copy(acceptedTerms = event.value) }
            is SubmitCauseEvent.Submit -> submitCause()
            is SubmitCauseEvent.DismissError -> _state.update { it.copy(errorMessage = null) }
        }
    }

    private fun submitCause() {
        val currentState = _state.value

        if (!currentState.acceptedTerms) {
            _state.update { it.copy(errorMessage = "Debes aceptar los Términos y Condiciones para enviar la postulación.") }
            return
        }

        val parsedGoal = currentState.goalAmountText.toDoubleOrNull()
        if (parsedGoal == null || parsedGoal <= 0.0) {
            _state.update { it.copy(errorMessage = "Ingresa una meta de recaudación en BLUE IOU válida mayor a 0.") }
            return
        }

        val input = SubmitCauseInput(
            title = currentState.title.trim(),
            story = currentState.story.trim(),
            goalAmount = parsedGoal,
            foundationName = currentState.foundationName.trim().ifEmpty { null },
            beneficiaryReferralCode = currentState.beneficiaryReferralCode.trim().ifEmpty { null },
            beneficiarySocialUrls = currentState.beneficiarySocialUrls.trim().ifEmpty { null },
            evidenceUrls = currentState.evidenceUrls.trim().ifEmpty { null },
            userSocialUrls = currentState.userSocialUrls.trim().ifEmpty { null }
        )

        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, errorMessage = null) }
            submitCauseUseCase(input)
                .onSuccess { causeId ->
                    _state.update {
                        it.copy(
                            isLoading = false,
                            isSubmittedSuccess = true,
                            createdCauseId = causeId
                        )
                    }
                }
                .onFailure { error ->
                    _state.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.message ?: "Error al postular la causa solidaria."
                        )
                    }
                }
        }
    }
}
