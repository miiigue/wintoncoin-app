// ============================================================================
// WintonCoin Android — VictimRegistrationViewModel
// ============================================================================
// [PRESENTATION LAYER / MVI VIEWMODEL] Manejador de estado y flujo para el censo SOS.
// ============================================================================

package com.wintoncoin.app.presentation.sos.victim

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wintoncoin.app.domain.model.SosOtpVerificationInput
import com.wintoncoin.app.domain.model.VictimRegistrationInput
import com.wintoncoin.app.domain.usecase.RegisterVictimUseCase
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
class VictimRegistrationViewModel @Inject constructor(
    private val registerVictimUseCase: RegisterVictimUseCase,
    private val verifySosOtpUseCase: VerifySosOtpUseCase,
    private val resendSosOtpUseCase: ResendSosOtpUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(VictimRegistrationState())
    val state: StateFlow<VictimRegistrationState> = _state.asStateFlow()

    private var timerJob: Job? = null

    fun onEvent(event: VictimRegistrationEvent) {
        when (event) {
            is VictimRegistrationEvent.FullNameChanged -> {
                _state.update { it.copy(fullName = event.value) }
                checkFormCompleteness()
            }
            is VictimRegistrationEvent.IdDocumentChanged -> {
                var doc = event.value.trim().uppercase()
                if (!doc.startsWith("V-") && !doc.startsWith("E-") && !doc.startsWith("J-") && !doc.startsWith("P-")) {
                    doc = "V-$doc"
                }
                _state.update { it.copy(idDocument = doc) }
                checkFormCompleteness()
            }
            is VictimRegistrationEvent.BirthdateChanged -> {
                _state.update { it.copy(birthdate = event.value) }
                checkFormCompleteness()
            }
            is VictimRegistrationEvent.EmailChanged -> {
                _state.update { it.copy(email = event.value) }
                checkFormCompleteness()
            }
            is VictimRegistrationEvent.PhoneChanged -> {
                var phone = event.value
                if (!phone.startsWith("+58")) {
                    phone = "+58 $phone"
                }
                _state.update { it.copy(phone = phone) }
                checkFormCompleteness()
            }
            is VictimRegistrationEvent.StateChanged -> {
                _state.update { it.copy(state = event.value) }
                checkFormCompleteness()
            }
            is VictimRegistrationEvent.MunicipalityChanged -> {
                _state.update { it.copy(municipality = event.value) }
                checkFormCompleteness()
            }
            is VictimRegistrationEvent.SectorChanged -> {
                _state.update { it.copy(sector = event.value) }
                checkFormCompleteness()
            }
            is VictimRegistrationEvent.AddressChanged -> {
                _state.update { it.copy(address = event.value) }
                checkFormCompleteness()
            }
            is VictimRegistrationEvent.AffectationLevelChanged -> {
                _state.update { it.copy(affectationLevel = event.value) }
            }
            is VictimRegistrationEvent.MinorsCountChanged -> {
                _state.update { it.copy(minorsCount = event.value.coerceAtLeast(0)) }
            }
            is VictimRegistrationEvent.ElderlyCountChanged -> {
                _state.update { it.copy(elderlyCount = event.value.coerceAtLeast(0)) }
            }
            is VictimRegistrationEvent.DisabledCountChanged -> {
                _state.update { it.copy(disabledCount = event.value.coerceAtLeast(0)) }
            }
            is VictimRegistrationEvent.AgeChanged -> {
                _state.update { it.copy(age = event.value.coerceIn(1, 120)) }
            }
            is VictimRegistrationEvent.GenderChanged -> {
                _state.update { it.copy(gender = event.value) }
            }
            is VictimRegistrationEvent.DescriptionChanged -> {
                _state.update { it.copy(description = event.value) }
                checkFormCompleteness()
            }
            is VictimRegistrationEvent.GooglePhotosUrlChanged -> {
                _state.update { it.copy(googlePhotosUrl = event.value) }
            }
            is VictimRegistrationEvent.DataConsentChanged -> {
                _state.update { it.copy(dataConsent = event.value) }
                checkFormCompleteness()
            }
            is VictimRegistrationEvent.SwornDeclarationChanged -> {
                _state.update { it.copy(swornDeclaration = event.value) }
                checkFormCompleteness()
            }
            is VictimRegistrationEvent.SubmitRegistration -> submitRegistration()
            is VictimRegistrationEvent.OtpCodeChanged -> {
                _state.update { it.copy(otpCode = event.value.filter { char -> char.isDigit() }.take(6)) }
            }
            is VictimRegistrationEvent.PasswordChanged -> {
                _state.update { it.copy(password = event.value) }
            }
            is VictimRegistrationEvent.ConfirmPasswordChanged -> {
                _state.update { it.copy(confirmPassword = event.value) }
            }
            is VictimRegistrationEvent.VerifyOtp -> verifyOtp()
            is VictimRegistrationEvent.ResendOtp -> resendOtp()
            is VictimRegistrationEvent.DismissOtpDialog -> {
                _state.update { it.copy(showOtpDialog = false, otpFeedbackMessage = null) }
            }
            is VictimRegistrationEvent.ClearError -> {
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
                s.address.isNotBlank() &&
                s.description.isNotBlank() &&
                s.dataConsent &&
                s.swornDeclaration

        _state.update { it.copy(isFormComplete = isComplete) }
    }

    private fun submitRegistration() {
        val s = _state.value
        viewModelScope.launch {
            _state.update { it.copy(isSubmitting = true, errorMessage = null) }

            val input = VictimRegistrationInput(
                fullName = s.fullName,
                idDocument = s.idDocument,
                birthdate = s.birthdate,
                email = s.email,
                phone = s.phone,
                country = s.country,
                state = s.state,
                municipality = s.municipality,
                sector = s.sector,
                address = s.address,
                affectationLevel = s.affectationLevel,
                minorsCount = s.minorsCount,
                elderlyCount = s.elderlyCount,
                disabledCount = s.disabledCount,
                age = s.age,
                gender = s.gender,
                description = s.description,
                googlePhotosUrl = s.googlePhotosUrl.takeIf { it.isNotBlank() },
                dataConsent = s.dataConsent,
                swornDeclaration = s.swornDeclaration
            )

            val result = registerVictimUseCase(input)
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

            val result = verifySosOtpUseCase(input, isVolunteer = false)
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
            val result = resendSosOtpUseCase(s.email, isVolunteer = false)
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
