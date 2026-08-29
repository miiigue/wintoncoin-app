// ============================================================================
// WintonCoin Android — VolunteerRegistrationEvent
// ============================================================================
// [PRESENTATION LAYER / MVI EVENT] Eventos del formulario de voluntarios SOS.
// ============================================================================

package com.wintoncoin.app.presentation.sos.volunteer

import com.wintoncoin.app.domain.model.VolunteerAvailability
import com.wintoncoin.app.domain.model.VolunteerModality
import com.wintoncoin.app.domain.model.VolunteerSpecialty

sealed interface VolunteerRegistrationEvent {
    data class FullNameChanged(val value: String) : VolunteerRegistrationEvent
    data class IdDocumentChanged(val value: String) : VolunteerRegistrationEvent
    data class BirthdateChanged(val value: String) : VolunteerRegistrationEvent
    data class EmailChanged(val value: String) : VolunteerRegistrationEvent
    data class PhoneChanged(val value: String) : VolunteerRegistrationEvent
    data class StateChanged(val value: String) : VolunteerRegistrationEvent
    data class MunicipalityChanged(val value: String) : VolunteerRegistrationEvent
    data class SectorChanged(val value: String) : VolunteerRegistrationEvent
    data class SpecialtyChanged(val value: VolunteerSpecialty) : VolunteerRegistrationEvent
    data class AvailabilityChanged(val value: VolunteerAvailability) : VolunteerRegistrationEvent
    data class ModalityChanged(val value: VolunteerModality) : VolunteerRegistrationEvent
    data class ExperienceDescriptionChanged(val value: String) : VolunteerRegistrationEvent
    data class DataConsentChanged(val value: Boolean) : VolunteerRegistrationEvent
    data class LegalDisclaimerChanged(val value: Boolean) : VolunteerRegistrationEvent

    // ── ACCIONES DE ENVÍO Y OTP ──────────────────────────────────────────────
    data object SubmitRegistration : VolunteerRegistrationEvent
    data class OtpCodeChanged(val value: String) : VolunteerRegistrationEvent
    data class PasswordChanged(val value: String) : VolunteerRegistrationEvent
    data class ConfirmPasswordChanged(val value: String) : VolunteerRegistrationEvent
    data object VerifyOtp : VolunteerRegistrationEvent
    data object ResendOtp : VolunteerRegistrationEvent
    data object DismissOtpDialog : VolunteerRegistrationEvent
    data object ClearError : VolunteerRegistrationEvent
}
