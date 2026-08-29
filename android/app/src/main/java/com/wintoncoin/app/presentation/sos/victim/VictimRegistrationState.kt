// ============================================================================
// WintonCoin Android — VictimRegistrationState
// ============================================================================
// [PRESENTATION LAYER / MVI STATE] Estado inmutable para el censo de damnificados.
// ============================================================================

package com.wintoncoin.app.presentation.sos.victim

import com.wintoncoin.app.domain.model.AffectationLevel

data class VictimRegistrationState(
    // ── CAMPOS DEL FORMULARIO DE CENSO ──────────────────────────────────────
    val fullName: String = "",
    val idDocument: String = "V-",
    val birthdate: String = "",
    val email: String = "",
    val phone: String = "+58 ",
    val country: String = "Venezuela",
    val state: String = "",
    val municipality: String = "",
    val sector: String = "",
    val address: String = "",
    val affectationLevel: AffectationLevel = AffectationLevel.FOOD_MEDICINE,
    val minorsCount: Int = 0,
    val elderlyCount: Int = 0,
    val disabledCount: Int = 0,
    val age: Int = 18,
    val gender: String = "male",
    val description: String = "",
    val googlePhotosUrl: String = "",
    val dataConsent: Boolean = false,
    val swornDeclaration: Boolean = false,

    // ── ESTADOS DE ENVÍO Y PROCESO ──────────────────────────────────────────
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
    val isFormComplete: Boolean = false,

    // ── ESTADOS DE VERIFICACIÓN OTP & ACTIVACIÓN DE CUENTA ───────────────────
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
