// ============================================================================
// WintonCoin Android — MarketplaceModels (Modelos de Dominio del Marketplace)
// ============================================================================
// [DOMAIN LAYER] Entidades inmutables y reglas de negocio puras para publicaciones,
// causas humanitarias, tipos de transacción y estados de participación.
// ============================================================================

package com.wintoncoin.app.domain.model

/**
 * Tipo de publicación clasificada según su propósito económico/social.
 */
enum class MarketplaceCategory {
    ALL,
    TASK,          // Tarea Comercial o de Impulsor (Booster)
    SELL,          // Oferta / Venta de producto o servicio
    DONATION,      // Causa Solidaria / Humanitaria
    PENDING        // Tareas con acción requerida por el usuario
}

/**
 * Estado del usuario respecto a una publicación/tarea.
 */
enum class TaskAcceptanceStatus {
    NONE,
    PENDING_APPROVAL,
    APPROVED,
    COMPLETED,
    CONFIRMED_PAID,
    REJECTED,
    UNKNOWN
}

/**
 * Modelo unificado de Publicación para la interfaz de usuario.
 */
data class PublicationItem(
    val id: String,
    val title: String,
    val description: String,
    val blueCost: Double,
    val baseBlueCost: Double,
    val multiplier: Double,
    val stageName: String,
    val isBoosterTx: Boolean,
    val isBoosterTask: Boolean,
    val isSellPost: Boolean,
    val isQuickSale: Boolean,
    val isHumanitarianCause: Boolean,
    val availableSlots: Int,
    val category: MarketplaceCategory,
    val createdAt: String,
    val expiresAt: String?,
    val goalAmount: Double,
    val currentAmount: Double,
    val amountOnHold: Double,
    val imageUrls: List<String>,
    val requiresEvidence: Boolean,
    val authorUsername: String,
    val authorRating: Double,
    val authorRatingsCount: Int,
    val userAcceptanceStatus: TaskAcceptanceStatus,
    val participants: List<ParticipantItem>,
    val beneficiaryUsername: String?,
    val foundationName: String?
)

/**
 * Modelo de Participante para la vista de detalle.
 */
data class ParticipantItem(
    val username: String,
    val status: TaskAcceptanceStatus,
    val acceptedAt: String,
    val blueCost: Double,
    val averageRating: Double,
    val ratingsCount: Int,
    val phoneNumber: String?
)

/**
 * Modelo de Dominio para el Multiplicador Activo de Etapa.
 */
data class BoosterMultiplierInfo(
    val multiplier: Double,
    val stageName: String
)

/**
 * Modelo de Dominio para la Configuración Económica de la Plataforma.
 */
data class PlatformEconomicSettings(
    val preLaunchModeEnabled: Boolean,
    val allowRequestPublications: Boolean,
    val allowSellPublications: Boolean,
    val allowDonationPublications: Boolean,
    val allowQuickSalePublications: Boolean,
    val maxImagesRequest: Int,
    val maxImagesSell: Int,
    val maxImagesDonation: Int,
    val platformUsername: String?
)

