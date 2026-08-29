// ============================================================================
// WintonCoin Android — DonationDtos
// ============================================================================
// [DATA LAYER / DTO] Data Transfer Objects para el módulo de WintonCoin Solidario
// y Donaciones Comunitarias (/api/humanitarian).
// ============================================================================

package com.wintoncoin.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class HumanitarianCauseDto(
    @SerialName("id") val id: Int,
    @SerialName("title") val title: String = "",
    @SerialName("story") val story: String = "",
    @SerialName("goal_amount") val goalAmount: Double = 0.0,
    @SerialName("current_amount") val currentAmount: Double = 0.0,
    @SerialName("amount_on_hold") val amountOnHold: Double = 0.0,
    @SerialName("status") val status: String = "pending",
    @SerialName("foundation_name") val foundationName: String? = null,
    @SerialName("creator_username") val creatorUsername: String? = null,
    @SerialName("beneficiary_username") val beneficiaryUsername: String? = null,
    @SerialName("beneficiary_referral_code") val beneficiaryReferralCode: String? = null,
    @SerialName("evidence_urls") val evidenceUrls: String? = null,
    @SerialName("admin_notes") val adminNotes: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
data class HumanitarianCausesResponseDto(
    @SerialName("success") val success: Boolean = true,
    @SerialName("causes") val causes: List<HumanitarianCauseDto> = emptyList()
)

typealias CausesResponseDto = HumanitarianCausesResponseDto

@Serializable
data class CauseDetailResponseDto(
    @SerialName("success") val success: Boolean = true,
    @SerialName("cause") val cause: HumanitarianCauseDto,
    @SerialName("donations") val donations: DonationsSummaryDto? = null
)

@Serializable
data class DonationItemDto(
    @SerialName("id") val id: Int,
    @SerialName("cause_id") val causeId: Int = 0,
    @SerialName("donor_username") val donorUsername: String? = null,
    @SerialName("amount") val amount: Double = 0.0,
    @SerialName("status") val status: String = "released", // 'released' | 'on_hold'
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class DonationsSummaryDto(
    @SerialName("total_raised") val totalRaised: Double = 0.0,
    @SerialName("total_on_hold") val totalOnHold: Double = 0.0,
    @SerialName("donations_count") val donationsCount: Int = 0,
    @SerialName("released_donations") val releasedDonations: List<DonationItemDto> = emptyList(),
    @SerialName("on_hold_donations") val onHoldDonations: List<DonationItemDto> = emptyList()
)

@Serializable
data class CauseDonationsResponseDto(
    @SerialName("success") val success: Boolean = true,
    @SerialName("total_raised") val totalRaised: Double = 0.0,
    @SerialName("total_on_hold") val totalOnHold: Double = 0.0,
    @SerialName("donations_count") val donationsCount: Int = 0,
    @SerialName("released_donations") val releasedDonations: List<DonationItemDto> = emptyList(),
    @SerialName("on_hold_donations") val onHoldDonations: List<DonationItemDto> = emptyList()
)

@Serializable
data class CauseUpdateDto(
    @SerialName("id") val id: Int,
    @SerialName("update_title") val updateTitle: String = "",
    @SerialName("update_text") val updateText: String = "",
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class CauseUpdatesResponseDto(
    @SerialName("success") val success: Boolean = true,
    @SerialName("updates") val updates: List<CauseUpdateDto> = emptyList()
)

@Serializable
data class SubmitCauseRequestDto(
    @SerialName("title") val title: String,
    @SerialName("story") val story: String,
    @SerialName("goal_amount") val goalAmount: Double,
    @SerialName("foundation_name") val foundationName: String? = null,
    @SerialName("beneficiary_referral_code") val beneficiaryReferralCode: String? = null,
    @SerialName("beneficiary_social_urls") val beneficiarySocialUrls: String? = null,
    @SerialName("evidence_urls") val evidenceUrls: String? = null,
    @SerialName("user_social_urls") val userSocialUrls: String? = null
)

@Serializable
data class SubmitCauseResponseDto(
    @SerialName("success") val success: Boolean = true,
    @SerialName("message") val message: String = "",
    @SerialName("cause_id") val causeId: Int? = null
)

@Serializable
data class DonateRequestDto(
    @SerialName("amount") val amount: Double,
    @SerialName("publication_id") val publicationId: Int? = null,
    @SerialName("accepted_terms") val acceptedTerms: Boolean = true
)

@Serializable
data class DonateResponseDto(
    @SerialName("success") val success: Boolean = true,
    @SerialName("message") val message: String = "",
    @SerialName("status") val status: String? = null, // 'released' | 'on_hold'
    @SerialName("donation_id") val donationId: Int? = null
)

@Serializable
data class GenericActionResponseDto(
    @SerialName("success") val success: Boolean = true,
    @SerialName("message") val message: String = ""
)
