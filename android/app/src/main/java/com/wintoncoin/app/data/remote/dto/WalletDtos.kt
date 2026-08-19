// ============================================================================
// WintonCoin Android — WalletDtos (DTOs de Billetera y Balances Web3)
// ============================================================================
// Data Transfer Objects para consulta de balances BLUE/RED, métricas crediticias
// e historial contable del usuario.
// ============================================================================

package com.wintoncoin.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class WalletBalanceDto(
    @SerialName("blue_balance") val blueBalance: Double = 0.0,
    @SerialName("escrow_blue_balance") val escrowBlueBalance: Double = 0.0,
    @SerialName("red_balance") val redBalance: Double = 0.0,
    @SerialName("web3_wallet_address") val web3WalletAddress: String? = null,
    @SerialName("kyc_verified") val kycVerified: Boolean = false,
    @SerialName("credit_limit") val creditLimit: Double = 0.0,
    @SerialName("collateral_balance") val collateralBalance: Double = 0.0,
    @SerialName("debt_30_days") val debt30Days: Double = 0.0,
    @SerialName("debt_end_month") val debtEndMonth: Double = 0.0,
    @SerialName("next_due_at") val nextDueAt: String? = null,
    @SerialName("next_due_amount") val nextDueAmount: Double? = null,
    @SerialName("next_unlock_at") val nextUnlockAt: String? = null,
    @SerialName("next_unlock_amount") val nextUnlockAmount: Double? = null,
    @SerialName("penalized_debt") val penalizedDebt: String? = null
)

@Serializable
data class HistoryTaskItemDto(
    val id: Int,
    val title: String,
    val description: String? = null,
    @SerialName("blue_cost") val blueCost: Double = 0.0,
    val status: String = "open",
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("author_username") val authorUsername: String? = null,
    @SerialName("is_humanitarian") val isHumanitarian: Boolean = false
)

@Serializable
data class HistoryDonationItemDto(
    @SerialName("donation_id") val donationId: Int,
    val amount: Double = 0.0,
    @SerialName("donation_status") val donationStatus: String = "on_hold",
    @SerialName("donation_created_at") val donationCreatedAt: String? = null,
    @SerialName("cause_id") val causeId: Int? = null,
    @SerialName("cause_title") val causeTitle: String? = null,
    @SerialName("creator_username") val creatorUsername: String? = null
)

@Serializable
data class WalletHistoryResponseDto(
    val authored: List<HistoryTaskItemDto> = emptyList(),
    val completed: List<HistoryTaskItemDto> = emptyList(),
    val causes: List<HistoryTaskItemDto> = emptyList(),
    val donations: List<HistoryDonationItemDto> = emptyList()
)

@Serializable
data class CollateralSyncRequestDto(
    @SerialName("operation_type") val operationType: String,
    val amount: Double,
    @SerialName("token_symbol") val tokenSymbol: String = "USDT",
    @SerialName("token_contract_address") val tokenContractAddress: String,
    @SerialName("tx_hash") val txHash: String,
    @SerialName("balance_after") val balanceAfter: Double? = null
)

@Serializable
data class CollateralSyncResponseDto(
    val message: String,
    @SerialName("new_credit_limit") val newCreditLimit: Double = 0.0
)
