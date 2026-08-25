// ============================================================================
// WintonCoin Android — VolunteerRegistrationState
// ============================================================================
// [PRESENTATION LAYER / MVI STATE] Estado inmutable para el registro de voluntarios.
// ============================================================================

package com.wintoncoin.app.presentation.sos.volunteer

import com.wintoncoin.app.domain.model.VolunteerAvailability
import com.wintoncoin.app.domain.model.VolunteerModality
import com.wintoncoin.app.domain.model.VolunteerSpecialty

data class VolunteerRegistrationState(
    // ── CAMPOS DEL FORMULARIO ───────────────────────────────────────────────
    val fullName: String = "",
    val idDocument: String = "V-",
    val birthdate: String = "",
    val email: String = "",
    val phone: String = "+58 ",
    val country: String = "Venezuela",
    val state: String = "",
    val municipality: String = "",
    val sector: String = "",
    val specialty: VolunteerSpecialty = VolunteerSpecialty.GENERAL,
    val availability: VolunteerAvailability = VolunteerAvailability.EMERGENCIES,
    val modality: VolunteerModality = VolunteerModality.PRESENCIAL,
    val experienceDescription: String = "",
    val dataConsent: Boolean = false,
    val legalDisclaimer: Boolean = false,

    // ── ESTADOS DE ENVÍO ────────────────────────────────────────────────────
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
    val isFormComplete: Boolean = false,

    // ── ESTADOS DE OTP & ACTIVACIÓN DE BRIGADA ──────────────────────────────
    val showOtpDialog: Boolean = false,
    val otpCode: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val isVerifyingOtp: Boolean = false,
    val isResendingOtp: Boolean = false,
    val resendCooldownSeconds: Int = 0,
    val otpFeedbackMessage: String? = null,
    val otpFeedbackSuccess: Boolean = false,
    val registeredDossierNumber: String? = null,
    val isActivationComplete: Boolean = false
)
