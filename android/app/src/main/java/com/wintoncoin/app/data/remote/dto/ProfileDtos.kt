// ============================================================================
// WintonCoin Android — ProfileDtos (DTOs de Perfil y Estado de Cuenta)
// ============================================================================
// Data Transfer Objects para el perfil de usuario, reputación P2P,
// expediente SOS y estado de cuenta FinTech.
// ============================================================================

package com.wintoncoin.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class RatingBreakdownDto(
    @SerialName("stars_5") val stars5: Int = 0,
    @SerialName("stars_4") val stars4: Int = 0,
    @SerialName("stars_3") val stars3: Int = 0,
    @SerialName("stars_2") val stars2: Int = 0,
    @SerialName("stars_1") val stars1: Int = 0
)

@Serializable
data class ProfileUserDto(
    val id: Int? = null,
    val username: String,
    val email: String? = null,
    @SerialName("is_verified") val isVerified: Boolean = false,
    @SerialName("kyc_verified") val kycVerified: Boolean = false,
    @SerialName("wallet_address") val walletAddress: String? = null,
    @SerialName("average_rating") val averageRating: Double = 0.0,
    @SerialName("total_ratings") val totalRatings: Int = 0,
    @SerialName("rating_breakdown") val ratingBreakdown: RatingBreakdownDto? = null,
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class ProfileRatingDto(
    val id: Int,
    @SerialName("rater_username") val raterUsername: String,
    val rating: Int,
    val comment: String? = null,
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class ProfileResponseDto(
    val user: ProfileUserDto,
    val ratings: List<ProfileRatingDto> = emptyList()
)

@Serializable
data class SosCaseDetailDto(
    @SerialName("full_name") val fullName: String? = null,
    val cedula: String? = null,
    val phone: String? = null,
    val status: String = "pending",
    @SerialName("affected_family_count") val affectedFamilyCount: Int = 0,
    val description: String? = null,
    val photos: List<String> = emptyList(),
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class SosCaseResponseDto(
    val success: Boolean = true,
    @SerialName("has_case") val hasCase: Boolean = false,
    val case: SosCaseDetailDto? = null
)

@Serializable
data class AccountStatementDto(
    val username: String,
    @SerialName("is_verified") val isVerified: Boolean = false,
    @SerialName("kyc_verified") val kycVerified: Boolean = false,
    @SerialName("blue_balance") val blueBalance: Double = 0.0,
    @SerialName("red_balance") val redBalance: Double = 0.0,
    @SerialName("reputation_score") val reputationScore: Double = 5.0,
    @SerialName("account_tier") val accountTier: String = "Estándar",
    @SerialName("member_since") val memberSince: String? = null
)
