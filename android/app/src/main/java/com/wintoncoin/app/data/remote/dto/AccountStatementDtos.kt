// ============================================================================
// WintonCoin Android — AccountStatementDtos (DTOs de Estado de Cuenta Web3)
// ============================================================================
// Data Transfer Objects para consulta de Smart Contracts, Suministro On-Chain
// y Sincronización de Bóveda de Garantías (Collateral Vault).
// ============================================================================

package com.wintoncoin.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ContractItemDto(
    val address: String = "",
    val minted: String = ""
)

@Serializable
data class ContractsResponseDto(
    val blue: ContractItemDto = ContractItemDto(),
    val red: ContractItemDto = ContractItemDto()
)

@Serializable
data class TransactionStatementItemDto(
    val id: Int = 0,
    @SerialName("created_at") val createdAt: String = "",
    val type: String = "",
    val description: String? = null,
    @SerialName("blue_change") val blueChange: Double = 0.0,
    @SerialName("red_change") val redChange: Double = 0.0,
    @SerialName("tx_hash") val txHash: String? = null
)
