// ============================================================================
// WintonCoin Android — BoosterDtos.kt (Modelos de Transferencia de Datos)
// ============================================================================
// [DATA LAYER / DTO] Define los esquemas JSON de respuesta para el Programa
// de Impulsores (Booster Profile), Escalera de Niveles y Red de Referidos.
// Serialización eficiente en tiempo de compilación con KotlinX Serialization (KSP).
// ============================================================================

package com.wintoncoin.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class BoosterProfileDto(
    @SerialName("is_booster") val isBooster: Boolean = false,
    @SerialName("message") val message: String? = null,
    @SerialName("username") val username: String? = null,
    @SerialName("booster_level") val boosterLevel: Int = 0,
    @SerialName("total_booster_blue") val totalBoosterBlue: Double = 0.0,
    @SerialName("eligible_booster_blue") val eligibleBoosterBlue: Double = 0.0,
    @SerialName("pending_booster_blue") val pendingBoosterBlue: Double = 0.0,
    @SerialName("base_eligible_booster_blue") val baseEligibleBoosterBlue: Double = 0.0,
    @SerialName("current_level_info") val currentLevelInfo: BoosterLevelDto? = null,
    @SerialName("next_level_info") val nextLevelInfo: BoosterLevelDto? = null,
    @SerialName("booster_tasks_completed_count") val boosterTasksCompletedCount: Int = 0,
    @SerialName("transactions") val transactions: List<BoosterLedgerItemDto> = emptyList(),
    @SerialName("all_levels") val allLevels: List<BoosterLevelDto> = emptyList(),
    @SerialName("rank_position") val rankPosition: Int? = null,
    @SerialName("rank_total") val rankTotal: Int? = null,
    @SerialName("rank_percentile") val rankPercentile: String? = null,
    @SerialName("friends_rank_position") val friendsRankPosition: Int? = null,
    @SerialName("friends_rank_total") val friendsRankTotal: Int? = null,
    @SerialName("friends_rank_percentile") val friendsRankPercentile: String? = null,
    @SerialName("daily_today") val dailyToday: Double = 0.0,
    @SerialName("daily_yesterday") val dailyYesterday: Double = 0.0,
    @SerialName("daily_improved") val dailyImproved: Boolean = false
)

@Serializable
data class BoosterLevelDto(
    @SerialName("level") val level: Int = 0,
    @SerialName("name") val name: String = "",
    @SerialName("min_blue_required") val minBlueRequired: String = "0",
    @SerialName("description") val description: String = ""
)

@Serializable
data class BoosterLedgerItemDto(
    @SerialName("id") val id: Int = 0,
    @SerialName("amount") val amount: Double = 0.0,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("type") val type: String = "credit",
    @SerialName("description") val description: String = "",
    @SerialName("related_publication_id") val relatedPublicationId: Int? = null
)

@Serializable
data class ReferralInfoResponseDto(
    @SerialName("referral_code") val referralCode: String? = null,
    @SerialName("referred_users") val referredUsers: List<ReferredUserDto> = emptyList()
)

@Serializable
data class ReferredUserDto(
    @SerialName("referred_username") val referredUsername: String = "",
    @SerialName("kyc_verified") val kycVerified: Boolean = false,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("total_booster_blue") val totalBoosterBlue: Double = 0.0
)
