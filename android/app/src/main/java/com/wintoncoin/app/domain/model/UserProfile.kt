// ============================================================================
// WintonCoin Android — UserProfile (Modelos de Dominio de Perfil)
// ============================================================================
// Representación pura e inmutable del perfil de usuario y reputación P2P.
// ============================================================================

package com.wintoncoin.app.domain.model

data class RatingBreakdown(
    val stars5: Int = 0,
    val stars4: Int = 0,
    val stars3: Int = 0,
    val stars2: Int = 0,
    val stars1: Int = 0
)

data class Rating(
    val id: Int,
    val raterUsername: String,
    val rating: Int,
    val comment: String? = null,
    val createdAt: String? = null
)

data class SosCase(
    val fullName: String? = null,
    val cedula: String? = null,
    val phone: String? = null,
    val status: String = "pending",
    val affectedFamilyCount: Int = 0,
    val description: String? = null,
    val photos: List<String> = emptyList(),
    val createdAt: String? = null
)

data class UserProfile(
    val username: String,
    val isVerified: Boolean = false,
    val kycVerified: Boolean = false,
    val walletAddress: String? = null,
    val averageRating: Double = 0.0,
    val totalRatings: Int = 0,
    val ratingBreakdown: RatingBreakdown? = null,
    val ratings: List<Rating> = emptyList(),
    val sosCase: SosCase? = null
)
