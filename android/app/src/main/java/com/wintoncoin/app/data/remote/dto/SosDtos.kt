// ============================================================================
// WintonCoin Android — SosDtos
// ============================================================================
// [DATA LAYER / DTOs] Objetos de transferencia de datos serializables para
// el portal de contingencia humanitaria SOS Venezuela, censo de damnificados
// y registro de brigadas de voluntarios.
// ============================================================================

package com.wintoncoin.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * DTO para la solicitud de registro público de damnificado (víctima de desastre).
 */
@Serializable
data class RegisterVictimRequestDto(
    @SerialName("fullname")
    val fullName: String,

    @SerialName("id_document")
    val idDocument: String,

    @SerialName("birthdate")
    val birthdate: String,

    @SerialName("email")
    val email: String,

    @SerialName("phone")
    val phone: String,

    @SerialName("country")
    val country: String = "Venezuela",

    @SerialName("state")
    val state: String,

    @SerialName("municipality")
    val municipality: String,

    @SerialName("sector")
    val sector: String,

    @SerialName("address")
    val address: String,

    @SerialName("affectation_level")
    val affectationLevel: String,

    @SerialName("minors_count")
    val minorsCount: Int = 0,

    @SerialName("elderly_count")
    val elderlyCount: Int = 0,

    @SerialName("disabled_count")
    val disabledCount: Int = 0,

    @SerialName("age")
    val age: Int = 18,

    @SerialName("gender")
    val gender: String = "male",

    @SerialName("description")
    val description: String,

    @SerialName("google_photos_url")
    val googlePhotosUrl: String? = null,

    @SerialName("data_consent")
    val dataConsent: Boolean = true,

    @SerialName("sworn_declaration")
    val swornDeclaration: Boolean = true
)

/**
 * DTO para la respuesta del registro de damnificado.
 */
@Serializable
data class RegisterVictimResponseDto(
    @SerialName("success")
    val success: Boolean = false,

    @SerialName("message")
    val message: String = "",

    @SerialName("dossier_number")
    val dossierNumber: String? = null,

    @SerialName("email")
    val email: String? = null
)

/**
 * DTO para la solicitud de registro de voluntario SOS.
 */
@Serializable
data class RegisterVolunteerRequestDto(
    @SerialName("fullname")
    val fullName: String,

    @SerialName("id_document")
    val idDocument: String,

    @SerialName("birthdate")
    val birthdate: String,

    @SerialName("email")
    val email: String,

    @SerialName("phone")
    val phone: String,

    @SerialName("country")
    val country: String = "Venezuela",

    @SerialName("state")
    val state: String,

    @SerialName("municipality")
    val municipality: String,

    @SerialName("sector")
    val sector: String,

    @SerialName("specialty")
    val specialty: String,

    @SerialName("availability")
    val availability: String,

    @SerialName("modality")
    val modality: String,

    @SerialName("experience_description")
    val experienceDescription: String? = null,

    @SerialName("data_consent")
    val dataConsent: Boolean = true,

    @SerialName("legal_disclaimer")
    val legalDisclaimer: Boolean = true
)

/**
 * DTO para la respuesta del registro de voluntario.
 */
@Serializable
data class RegisterVolunteerResponseDto(
    @SerialName("success")
    val success: Boolean = false,

    @SerialName("message")
    val message: String = "",

    @SerialName("dossier_number")
    val dossierNumber: String? = null,

    @SerialName("email")
    val email: String? = null
)

/**
 * DTO para la verificación de OTP y activación de cuenta (Damnificado o Voluntario).
 */
@Serializable
data class VerifySosOtpRequestDto(
    @SerialName("email")
    val email: String,

    @SerialName("otp_code")
    val otpCode: String,

    @SerialName("password")
    val password: String,

    @SerialName("confirm_password")
    val confirmPassword: String
)

/**
 * DTO para la respuesta de activación exitosa de cuenta SOS.
 */
@Serializable
data class VerifySosOtpResponseDto(
    @SerialName("success")
    val success: Boolean = false,

    @SerialName("message")
    val message: String = "",

    @SerialName("token")
    val token: String? = null,

    @SerialName("username")
    val username: String? = null,

    @SerialName("dossier_number")
    val dossierNumber: String? = null
)

/**
 * DTO para el reenvío de código OTP SOS.
 */
@Serializable
data class ResendSosOtpRequestDto(
    @SerialName("email")
    val email: String
)

/**
 * DTO de respuesta genérica para reenvío de OTP SOS.
 */
@Serializable
data class ResendSosOtpResponseDto(
    @SerialName("success")
    val success: Boolean = false,

    @SerialName("message")
    val message: String = ""
)

/**
 * DTO para la configuración pública de campaña SOS y código de referido.
 */
@Serializable
data class SosCampaignSettingsDto(
    @SerialName("referral_custom_share_code")
    val referralCustomShareCode: String? = "SOSVENEZUELA",

    @SerialName("referral_bonus_blue")
    val referralBonusBlue: Double? = 200.0,

    @SerialName("campaign_active")
    val campaignActive: Boolean = true
)
