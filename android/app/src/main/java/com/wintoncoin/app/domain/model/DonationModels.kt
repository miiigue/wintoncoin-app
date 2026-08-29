// ============================================================================
// WintonCoin Android — DonationModels
// ============================================================================
// [DOMAIN LAYER / MODEL] Entidades de dominio inmutables para WintonCoin Solidario.
// ============================================================================

package com.wintoncoin.app.domain.model

enum class CauseStatus(val rawValue: String, val label: String) {
    PENDING("pending", "En Revisión"),
    APPROVED("approved", "En Recaudación"),
    COMPLETED("completed", "Completada"),
    REJECTED("rejected", "Rechazada");

    companion object {
        fun fromRaw(value: String): CauseStatus {
            return entries.find { it.rawValue.equals(value, ignoreCase = true) } ?: PENDING
        }
    }
}

enum class DonationStatus(val rawValue: String, val label: String) {
    RELEASED("released", "Liberado"),
    ON_HOLD("on_hold", "En Espera (KYC Pendiente)");

    companion object {
        fun fromRaw(value: String): DonationStatus {
            return entries.find { it.rawValue.equals(value, ignoreCase = true) } ?: RELEASED
        }
    }
}

data class HumanitarianCause(
    val id: Int,
    val title: String,
    val story: String,
    val goalAmount: Double,
    val currentAmount: Double,
    val amountOnHold: Double,
    val status: CauseStatus,
    val foundationName: String?,
    val creatorUsername: String?,
    val beneficiaryUsername: String?,
    val beneficiaryReferralCode: String?,
    val evidenceUrls: String?,
    val adminNotes: String?,
    val createdAt: String,
    val formattedCreatedAt: String
) {
    val totalEffectiveRaised: Double get() = currentAmount + amountOnHold
    val progressPercentage: Float
        get() {
            if (goalAmount <= 0.0) return 0f
            val pct = (totalEffectiveRaised / goalAmount).toFloat()
            return pct.coerceIn(0f, 1f)
        }
    val percentageString: String
        get() {
            if (goalAmount <= 0.0) return "0.0%"
            val pct = (totalEffectiveRaised / goalAmount) * 100.0
            return String.format(java.util.Locale.US, "%.1f%%", pct)
        }
    val remainingAmount: Double
        get() = (goalAmount - totalEffectiveRaised).coerceAtLeast(0.0)
    val isCompleted: Boolean
        get() = status == CauseStatus.COMPLETED || totalEffectiveRaised >= goalAmount
}

data class DonationRecord(
    val id: Int,
    val causeId: Int,
    val donorUsername: String,
    val amount: Double,
    val status: DonationStatus,
    val createdAt: String,
    val formattedCreatedAt: String
)

data class CauseDonationsSummary(
    val totalRaised: Double,
    val totalOnHold: Double,
    val donationsCount: Int,
    val releasedDonations: List<DonationRecord>,
    val onHoldDonations: List<DonationRecord>
) {
    val allDonations: List<DonationRecord>
        get() = (releasedDonations + onHoldDonations).sortedByDescending { it.id }
}

data class CauseUpdate(
    val id: Int,
    val title: String,
    val text: String,
    val createdAt: String,
    val formattedDate: String
)

data class SubmitCauseInput(
    val title: String,
    val story: String,
    val goalAmount: Double,
    val foundationName: String?,
    val beneficiaryReferralCode: String?,
    val beneficiarySocialUrls: String?,
    val evidenceUrls: String?,
    val userSocialUrls: String?
)
