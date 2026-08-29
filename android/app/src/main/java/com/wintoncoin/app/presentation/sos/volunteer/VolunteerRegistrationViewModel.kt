// ============================================================================
// WintonCoin Android — VolunteerRegistrationViewModel
// ============================================================================
// [PRESENTATION LAYER / MVI VIEWMODEL] Manejador de estado para el registro voluntario.
// ============================================================================

package com.wintoncoin.app.presentation.sos.volunteer

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.domain.model.SosOtpVerificationInput
import com.wintoncoin.app.domain.model.VolunteerRegistrationInput
import com.wintoncoin.app.domain.usecase.RegisterVolunteerUseCase
import com.wintoncoin.app.domain.usecase.ResendSosOtpUseCase
import com.wintoncoin.app.domain.usecase.VerifySosOtpUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class VolunteerRegistrationViewModel @Inject constructor(
    private val registerVolunteerUseCase: RegisterVolunteerUseCase,
    private val verifySosOtpUseCase: VerifySosOtpUseCase,
    private val resendSosOtpUseCase: ResendSosOtpUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(VolunteerRegistrationState())
    val state: StateFlow<VolunteerRegistrationState> = _state.asStateFlow()

    private var timerJob: Job? = null

    fun onEvent(event: VolunteerRegistrationEvent) {
        when (event) {
            is VolunteerRegistrationEvent.FullNameChanged -> {
                _state.update { it.copy(fullName = event.value) }
                checkFormCompleteness()
            }
            is VolunteerRegistrationEvent.IdDocumentChanged -> {
                var doc = event.value.trim().uppercase()
                if (!doc.startsWith("V-") && !doc.startsWith("E-") && !doc.startsWith("J-") && !doc.startsWith("P-")) {
                    doc = "V-$doc"
                }
                _state.update { it.copy(idDocument = doc) }
                checkFormCompleteness()
            }
            is VolunteerRegistrationEvent.BirthdateChanged -> {
                _state.update { it.copy(birthdate = event.value) }
                checkFormCompleteness()
            }
            is VolunteerRegistrationEvent.EmailChanged -> {
                _state.update { it.copy(email = event.value) }
                checkFormCompleteness()
            }
            is VolunteerRegistrationEvent.PhoneChanged -> {
                var phone = event.value
                if (!phone.startsWith("+58")) {
                    phone = "+58 $phone"
                }
                _state.update { it.copy(phone = phone) }
                checkFormCompleteness()
            }
            is VolunteerRegistrationEvent.StateChanged -> {
                _state.update { it.copy(state = event.value) }
                checkFormCompleteness()
            }
            is VolunteerRegistrationEvent.MunicipalityChanged -> {
                _state.update { it.copy(municipality = event.value) }
                checkFormCompleteness()
            }
            is VolunteerRegistrationEvent.SectorChanged -> {
                _state.update { it.copy(sector = event.value) }
                checkFormCompleteness()
            }
            is VolunteerRegistrationEvent.SpecialtyChanged -> {
                _state.update { it.copy(specialty = event.value) }
            }
            is VolunteerRegistrationEvent.AvailabilityChanged -> {
                _state.update { it.copy(availability = event.value) }
            }
            is VolunteerRegistrationEvent.ModalityChanged -> {
                _state.update { it.copy(modality = event.value) }
            }
            is VolunteerRegistrationEvent.ExperienceDescriptionChanged -> {
                _state.update { it.copy(experienceDescription = event.value) }
            }
            is VolunteerRegistrationEvent.DataConsentChanged -> {
                _state.update { it.copy(dataConsent = event.value) }
                checkFormCompleteness()
            }
            is VolunteerRegistrationEvent.LegalDisclaimerChanged -> {
                _state.update { it.copy(legalDisclaimer = event.value) }
                checkFormCompleteness()
            }
            is VolunteerRegistrationEvent.SubmitRegistration -> submitRegistration()
            is VolunteerRegistrationEvent.OtpCodeChanged -> {
                _state.update { it.copy(otpCode = event.value.filter { char -> char.isDigit() }.take(6)) }
            }
            is VolunteerRegistrationEvent.PasswordChanged -> {
                _state.update { it.copy(password = event.value) }
            }
            is VolunteerRegistrationEvent.ConfirmPasswordChanged -> {
                _state.update { it.copy(confirmPassword = event.value) }
            }
            is VolunteerRegistrationEvent.VerifyOtp -> verifyOtp()
            is VolunteerRegistrationEvent.ResendOtp -> resendOtp()
            is VolunteerRegistrationEvent.DismissOtpDialog -> {
                _state.update { it.copy(showOtpDialog = false, otpFeedbackMessage = null) }
            }
            is VolunteerRegistrationEvent.ClearError -> {
                _state.update { it.copy(errorMessage = null) }
            }
        }
    }

    private fun checkFormCompleteness() {
        val s = _state.value
        val isComplete = s.fullName.isNotBlank() &&
                s.idDocument.length > 2 && s.idDocument != "V-" &&
                s.birthdate.isNotBlank() &&
                s.email.contains("@") &&
                s.phone.length > 4 && s.phone.trim() != "+58" &&
                s.state.isNotBlank() &&
                s.municipality.isNotBlank() &&
                s.sector.isNotBlank() &&
                s.dataConsent &&
                s.legalDisclaimer

        _state.update { it.copy(isFormComplete = isComplete) }
    }

    private fun submitRegistration() {
        val s = _state.value
        viewModelScope.launch {
            _state.update { it.copy(isSubmitting = true, errorMessage = null) }

            val input = VolunteerRegistrationInput(
                fullName = s.fullName,
                idDocument = s.idDocument,
                birthdate = s.birthdate,
                email = s.email,
                phone = s.phone,
                country = s.country,
                state = s.state,
                municipality = s.municipality,
                sector = s.sector,
                specialty = s.specialty,
                availability = s.availability,
                modality = s.modality,
                experienceDescription = s.experienceDescription.takeIf { it.isNotBlank() },
                dataConsent = s.dataConsent,
                legalDisclaimer = s.legalDisclaimer
            )

            val result = registerVolunteerUseCase(input)
            result.onSuccess { regResult ->
                _state.update {
                    it.copy(
                        isSubmitting = false,
                        showOtpDialog = true,
                        registeredDossierNumber = regResult.dossierNumber,
                        otpFeedbackMessage = "Código de 6 dígitos enviado a ${s.email}. Revisa tu correo.",
                        otpFeedbackSuccess = true
                    )
                }
                startResendCooldown(60)
            }.onFailure { error ->
                _state.update { it.copy(isSubmitting = false, errorMessage = error.message) }
            }
        }
    }

    private fun verifyOtp() {
        val s = _state.value
        viewModelScope.launch {
            _state.update { it.copy(isVerifyingOtp = true, otpFeedbackMessage = null) }

            val input = SosOtpVerificationInput(
                email = s.email,
                otpCode = s.otpCode,
                password = s.password,
                confirmPassword = s.confirmPassword
            )

            val result = verifySosOtpUseCase(input, isVolunteer = true)
            result.onSuccess { session ->
                _state.update {
                    it.copy(
                        isVerifyingOtp = false,
                        isActivationComplete = true,
                        showOtpDialog = false,
                        registeredDossierNumber = session.dossierNumber
                    )
                }
            }.onFailure { error ->
                _state.update {
                    it.copy(
                        isVerifyingOtp = false,
                        otpFeedbackMessage = error.message ?: "Error de verificación",
                        otpFeedbackSuccess = false
                    )
                }
            }
        }
    }

    private fun resendOtp() {
        val s = _state.value
        if (s.resendCooldownSeconds > 0) return

        viewModelScope.launch {
            _state.update { it.copy(isResendingOtp = true) }
            val result = resendSosOtpUseCase(s.email, isVolunteer = true)
            result.onSuccess { msg ->
                _state.update {
                    it.copy(
                        isResendingOtp = false,
                        otpFeedbackMessage = msg,
                        otpFeedbackSuccess = true
                    )
                }
                startResendCooldown(60)
            }.onFailure { error ->
                _state.update {
                    it.copy(
                        isResendingOtp = false,
                        otpFeedbackMessage = error.message ?: "Error al reenviar código",
                        otpFeedbackSuccess = false
                    )
                }
            }
        }
    }

    private fun startResendCooldown(seconds: Int = 60) {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            _state.update { it.copy(resendCooldownSeconds = seconds) }
            for (i in seconds downTo 1) {
                _state.update { it.copy(resendCooldownSeconds = i) }
                delay(1000)
            }
            _state.update { it.copy(resendCooldownSeconds = 0) }
        }
    }

    override fun onCleared() {
        super.onCleared()
        timerJob?.cancel()
    }
}
