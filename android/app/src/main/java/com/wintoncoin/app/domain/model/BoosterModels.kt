// ============================================================================
// WintonCoin Android — BoosterModels.kt (Modelos de Dominio de Impulsores)
// ============================================================================
// [DOMAIN LAYER / MODELS] Entidades inmutables de dominio que representan
// el Perfil de Impulsor, la Escalera de Niveles y la Red de Afiliados/Referidos.
// ============================================================================

package com.wintoncoin.app.domain.model

data class BoosterProfile(
    val isBooster: Boolean = false,
    val message: String? = null,
    val username: String = "",
    val boosterLevel: Int = 0,
    val totalBoosterBlue: Double = 0.0,
    val eligibleBoosterBlue: Double = 0.0,
    val pendingBoosterBlue: Double = 0.0,
    val baseEligibleBoosterBlue: Double = 0.0,
    val currentLevelInfo: BoosterLevelInfo? = null,
    val nextLevelInfo: BoosterLevelInfo? = null,
    val boosterTasksCompletedCount: Int = 0,
    val transactions: List<BoosterLedgerMovement> = emptyList(),
    val allLevels: List<BoosterLevelInfo> = emptyList(),
    val rankPosition: Int? = null,
    val rankTotal: Int? = null,
    val rankPercentile: String? = null,
    val friendsRankPosition: Int? = null,
    val friendsRankTotal: Int? = null,
    val friendsRankPercentile: String? = null,
    val dailyToday: Double = 0.0,
    val dailyYesterday: Double = 0.0,
    val dailyImproved: Boolean = false
) {
    /**
     * Calcula la cantidad de BLUE iou faltante para alcanzar el siguiente nivel.
     */
    val neededBlueForNextLevel: Double
        get() {
            val target = nextLevelInfo?.minBlueRequired ?: return 0.0
            return (target - totalBoosterBlue).coerceAtLeast(0.0)
        }

    /**
     * Calcula el porcentaje de avance (0.0f a 1.0f) hacia el siguiente nivel.
     */
    val levelProgressPercentage: Float
        get() {
            val currentReq = currentLevelInfo?.minBlueRequired ?: 0.0
            val nextReq = nextLevelInfo?.minBlueRequired ?: return 1.0f
            val span = nextReq - currentReq
            if (span <= 0.0) return 1.0f
            val progress = (totalBoosterBlue - currentReq) / span
            return progress.toFloat().coerceIn(0.0f, 1.0f)
        }
}

data class BoosterLevelInfo(
    val level: Int,
    val name: String,
    val minBlueRequired: Double,
    val description: String
)

data class BoosterLedgerMovement(
    val id: Int,
    val amount: Double,
    val createdAt: String,
    val type: String,
    val description: String,
    val relatedPublicationId: Int?
)

data class ReferralNetworkData(
    val referralCode: String,
    val referralLink: String,
    val referredUsers: List<ReferredMember>,
    val totalReferredCount: Int,
    val kycVerifiedCount: Int,
    val totalBoosterBlueGenerated: Double
)

data class ReferredMember(
    val username: String,
    val kycVerified: Boolean,
    val registrationDate: String,
    val totalBoosterBlue: Double
)
