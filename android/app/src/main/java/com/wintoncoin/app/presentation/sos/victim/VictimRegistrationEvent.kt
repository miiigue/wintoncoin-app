// ============================================================================
// WintonCoin Android — VictimRegistrationEvent
// ============================================================================
// [PRESENTATION LAYER / MVI EVENT] Eventos del formulario de damnificados.
// ============================================================================

package com.wintoncoin.app.presentation.sos.victim

import com.wintoncoin.app.domain.model.AffectationLevel

sealed interface VictimRegistrationEvent {
    data class FullNameChanged(val value: String) : VictimRegistrationEvent
    data class IdDocumentChanged(val value: String) : VictimRegistrationEvent
    data class BirthdateChanged(val value: String) : VictimRegistrationEvent
    data class EmailChanged(val value: String) : VictimRegistrationEvent
    data class PhoneChanged(val value: String) : VictimRegistrationEvent
    data class StateChanged(val value: String) : VictimRegistrationEvent
    data class MunicipalityChanged(val value: String) : VictimRegistrationEvent
    data class SectorChanged(val value: String) : VictimRegistrationEvent
    data class AddressChanged(val value: String) : VictimRegistrationEvent
    data class AffectationLevelChanged(val value: AffectationLevel) : VictimRegistrationEvent
    data class MinorsCountChanged(val value: Int) : VictimRegistrationEvent
    data class ElderlyCountChanged(val value: Int) : VictimRegistrationEvent
    data class DisabledCountChanged(val value: Int) : VictimRegistrationEvent
    data class AgeChanged(val value: Int) : VictimRegistrationEvent
    data class GenderChanged(val value: String) : VictimRegistrationEvent
    data class DescriptionChanged(val value: String) : VictimRegistrationEvent
    data class GooglePhotosUrlChanged(val value: String) : VictimRegistrationEvent
    data class DataConsentChanged(val value: Boolean) : VictimRegistrationEvent
    data class SwornDeclarationChanged(val value: Boolean) : VictimRegistrationEvent

    // ── ACCIONES DE ENVÍO Y OTP ──────────────────────────────────────────────
    data object SubmitRegistration : VictimRegistrationEvent
    data class OtpCodeChanged(val value: String) : VictimRegistrationEvent
    data class PasswordChanged(val value: String) : VictimRegistrationEvent
    data class ConfirmPasswordChanged(val value: String) : VictimRegistrationEvent
    data object VerifyOtp : VictimRegistrationEvent
    data object ResendOtp : VictimRegistrationEvent
    data object DismissOtpDialog : VictimRegistrationEvent
    data object ClearError : VictimRegistrationEvent
}
