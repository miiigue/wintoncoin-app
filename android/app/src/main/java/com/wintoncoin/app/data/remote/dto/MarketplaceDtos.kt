// ============================================================================
// WintonCoin Android — Marketplace DTOs (Data Transfer Objects)
// ============================================================================
// [DATA LAYER / SERIALIZATION] Modelos de transferencia de red para el
// Marketplace de Tareas P2P, Causas Solidarias y Acciones Transaccionales.
// Cumple con el estándar Zero-Trust: todos los campos son null-safe con defaults.
// ============================================================================

package com.wintoncoin.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * DTO para la lista y detalle de Publicaciones del Marketplace.
 */
@Serializable
data class PublicationDto(
    @SerialName("id")
    val id: String? = null,

    @SerialName("title")
    val title: String = "",

    @SerialName("description")
    val description: String? = null,

    @SerialName("blue_cost")
    val blueCost: Double? = null,

    @SerialName("base_blue_cost")
    val baseBlueCost: Double? = null,

    @SerialName("current_multiplier")
    val currentMultiplier: Double? = null,

    @SerialName("current_stage_name")
    val currentStageName: String? = null,

    @SerialName("is_booster_tx")
    val isBoosterTx: Boolean? = null,

    @SerialName("is_booster_task")
    val isBoosterTask: Boolean? = null,

    @SerialName("is_sell_post")
    val isSellPost: Boolean? = null,

    @SerialName("is_quick_sale")
    val isQuickSale: Boolean? = null,

    @SerialName("available_slots")
    val availableSlots: Int? = null,

    @SerialName("category")
    val category: String? = null,

    @SerialName("created_at")
    val createdAt: String? = null,

    @SerialName("expires_at")
    val expiresAt: String? = null,

    @SerialName("goal_amount")
    val goalAmount: Double? = null,

    @SerialName("current_amount")
    val currentAmount: Double? = null,

    @SerialName("image_urls")
    val imageUrls: List<String>? = null,

    @SerialName("requires_evidence")
    val requiresEvidence: Boolean? = null,

    @SerialName("author_username")
    val authorUsername: String? = null,

    @SerialName("author_average_rating")
    val authorAverageRating: Double? = null,

    @SerialName("author_ratings_count")
    val authorRatingsCount: Int? = null,

    @SerialName("user_acceptance_status")
    val userAcceptanceStatus: String? = null,

    @SerialName("participants")
    val participants: List<ParticipantDto>? = null,

    @SerialName("beneficiary_username")
    val beneficiaryUsername: String? = null,

    @SerialName("target_username")
    val targetUsername: String? = null
)

/**
 * DTO para las Causas Humanitarias aprobadas (Winton Solidario).
 */
@Serializable
data class HumanitarianCauseDto(
    @SerialName("id")
    val id: Int,

    @SerialName("title")
    val title: String = "",

    @SerialName("story")
    val story: String? = null,

    @SerialName("goal_amount")
    val goalAmount: Double? = null,

    @SerialName("current_amount")
    val currentAmount: Double? = null,

    @SerialName("amount_on_hold")
    val amountOnHold: Double? = null,

    @SerialName("evidence_urls")
    val evidenceUrls: List<String>? = null,

    @SerialName("created_at")
    val createdAt: String? = null,

    @SerialName("foundation_name")
    val foundationName: String? = null,

    @SerialName("creator_username")
    val creatorUsername: String? = null,

    @SerialName("beneficiary_username")
    val beneficiaryUsername: String? = null,

    @SerialName("beneficiary_referral_code")
    val beneficiaryReferralCode: String? = null
)

/**
 * Respuesta envoltorio para el endpoint de causas aprobadas.
 */
@Serializable
data class HumanitarianCausesResponseDto(
    @SerialName("success")
    val success: Boolean = false,

    @SerialName("causes")
    val causes: List<HumanitarianCauseDto> = emptyList()
)

/**
 * DTO para la información de participantes en una tarea.
 */
@Serializable
data class ParticipantDto(
    @SerialName("username")
    val username: String = "",

    @SerialName("status")
    val status: String = "",

    @SerialName("accepted_at")
    val acceptedAt: String? = null,

    @SerialName("blue_cost")
    val blueCost: Double? = null,

    @SerialName("average_rating")
    val averageRating: Double? = null,

    @SerialName("ratings_count")
    val ratingsCount: Int? = null,

    @SerialName("phone_number")
    val phoneNumber: String? = null
)

/**
 * Payload para postularse o aceptar una publicación.
 */
@Serializable
data class AcceptPublicationRequest(
    @SerialName("acceptorUsername")
    val acceptorUsername: String,

    @SerialName("donationAmount")
    val donationAmount: Double? = null
)

/**
 * Payload para culminar una tarea y enviar evidencias.
 */
@Serializable
data class CompleteTaskRequest(
    @SerialName("completerUsername")
    val completerUsername: String,

    @SerialName("evidence_urls")
    val evidenceUrls: List<String>? = null
)

/**
 * Payload para confirmar el pago y liberación de fondos a un trabajador.
 */
@Serializable
data class ConfirmPaymentRequest(
    @SerialName("confirmerUsername")
    val confirmerUsername: String,

    @SerialName("workerUsername")
    val workerUsername: String
)

/**
 * Respuesta genérica a acciones de marketplace (postularse, completar, confirmar).
 */
@Serializable
data class MarketplaceActionResponseDto(
    @SerialName("message")
    val message: String? = null,

    @SerialName("success")
    val success: Boolean? = null
)
