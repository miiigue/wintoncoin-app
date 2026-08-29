// ============================================================================
// WintonCoin Android — Publish DTOs (Data Transfer Objects para Creación)
// ============================================================================
// [DATA LAYER / SERIALIZATION] Modelos de transferencia de datos para la
// creación de publicaciones (Tareas, Ventas P2P, Causas y Ventas Rápidas),
// subida de imágenes a Cloudflare R2 y consulta de configuración de prelanzamiento.
// ============================================================================

package com.wintoncoin.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Payload para crear una publicación regular (Tarea, Venta o Causa Solidaria).
 */
@Serializable
data class CreatePublicationRequest(
    @SerialName("title")
    val title: String,

    @SerialName("description")
    val description: String,

    @SerialName("authorUsername")
    val authorUsername: String,

    @SerialName("publicationType")
    val publicationType: String, // "request", "sell", "donation"

    @SerialName("blueCost")
    val blueCost: Double? = null,

    @SerialName("blueSell")
    val blueSell: Double? = null,

    @SerialName("goalAmount")
    val goalAmount: Double? = null,

    @SerialName("availableSlots")
    val availableSlots: Int = 1,

    @SerialName("autoApprove")
    val autoApprove: Boolean = false,

    @SerialName("requires_evidence")
    val requiresEvidence: Boolean = false,

    @SerialName("image_urls")
    val imageUrls: List<String> = emptyList(),

    @SerialName("duration_days")
    val durationDays: Int? = null,

    @SerialName("duration_hours")
    val durationHours: Int? = null,

    @SerialName("duration_minutes")
    val durationMinutes: Int? = null,

    @SerialName("allowRepeatParticipation")
    val allowRepeatParticipation: Boolean = false,

    @SerialName("maxRepeatPerUser")
    val maxRepeatPerUser: Int? = null,

    @SerialName("repeatCooldownDays")
    val repeatCooldownDays: Int? = null,

    @SerialName("repeatCooldownHours")
    val repeatCooldownHours: Int? = null,

    @SerialName("repeatCooldownMinutes")
    val repeatCooldownMinutes: Int? = null,

    @SerialName("beneficiaryReferralCode")
    val beneficiaryReferralCode: String? = null
)

/**
 * Payload para crear una Venta Rápida.
 */
@Serializable
data class CreateQuickSaleRequest(
    @SerialName("title")
    val title: String,

    @SerialName("amount")
    val amount: Double,

    @SerialName("authorUsername")
    val authorUsername: String,

    @SerialName("targetUsername")
    val targetUsername: String? = null
)

/**
 * Respuesta del servidor tras subir imágenes a Cloudflare R2.
 */
@Serializable
data class MediaUploadResponseDto(
    @SerialName("success")
    val success: Boolean = false,

    @SerialName("urls")
    val urls: List<String> = emptyList(),

    @SerialName("message")
    val message: String? = null
)

/**
 * DTO para el multiplicador vigente de etapa (Booster Multiplier).
 */
@Serializable
data class BoosterMultiplierDto(
    @SerialName("multiplier")
    val multiplier: Double = 1.0,

    @SerialName("stageName")
    val stageName: String = "Sin etapa activa"
)

/**
 * DTO para la configuración pública de la plataforma (Pre-lanzamiento, límites).
 */
@Serializable
data class PlatformSettingsDto(
    @SerialName("pre_launch_mode_enabled")
    val preLaunchModeEnabled: Boolean = true,

    @SerialName("allow_request_publications")
    val allowRequestPublications: Boolean = true,

    @SerialName("allow_sell_publications")
    val allowSellPublications: Boolean = true,

    @SerialName("allow_donation_publications")
    val allowDonationPublications: Boolean = true,

    @SerialName("allow_quick_sale_publications")
    val allowQuickSalePublications: Boolean = true,

    @SerialName("max_images_request")
    val maxImagesRequest: String? = "1",

    @SerialName("max_images_sell")
    val maxImagesSell: String? = "1",

    @SerialName("max_images_donation")
    val maxImagesDonation: String? = "3",

    @SerialName("platform_username")
    val platformUsername: String? = null
)
