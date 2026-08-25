// ============================================================================
// WintonCoin Android — AccountStatementModels (Modelos de Dominio Web3)
// ============================================================================
// [DOMAIN LAYER] Entidades inmutables y puras de lógica de negocio para
// Estado de Cuenta Web3, Auditoría de Smart Contracts y Bóveda de Garantías.
// ============================================================================

package com.wintoncoin.app.domain.model

import java.util.Locale

data class AccountStatementSummary(
    val blueAvailable: Double = 0.0,
    val blueEscrow: Double = 0.0,
    val blueNextUnlockAt: String? = null,
    val blueNextUnlockAmount: Double? = null,
    val redCreditLimit: Double = 0.0,
    val redCreditAvailable: Double = 0.0,
    val redDebtTotal: Double = 0.0,
    val organicScore: Double = 0.0,
    val collateralBalance: Double = 0.0,
    val web3WalletAddress: String = "",
    val kycVerified: Boolean = false,
    val networkStatus: String = "Conectado a Optimism Sepolia"
) {
    val fiatEstimatedUsd: Double
        get() = blueAvailable + blueEscrow

    val formattedBlueAvailable: String
        get() = String.format(Locale("es", "ES"), "%.4f BLUE", blueAvailable)

    val formattedBlueEscrow: String
        get() = String.format(Locale("es", "ES"), "%.4f BLUE", blueEscrow)

    val formattedFiatEstimatedUsd: String
        get() = String.format(Locale("es", "ES"), "≈ $%.2f USD", fiatEstimatedUsd)

    val formattedRedCreditLimit: String
        get() = String.format(Locale("es", "ES"), "%.4f RED", redCreditLimit)

    val formattedRedCreditAvailable: String
        get() = String.format(Locale("es", "ES"), "%.4f RED", redCreditAvailable)

    val formattedRedDebtTotal: String
        get() = String.format(Locale("es", "ES"), "%.4f RED", redDebtTotal)

    val formattedOrganicScore: String
        get() = String.format(Locale("es", "ES"), "%.4f RED", organicScore)

    val formattedCollateralBalance: String
        get() = String.format(Locale("es", "ES"), "+%.4f RED", collateralBalance)

    val hasValidWeb3Address: Boolean
        get() = web3WalletAddress.startsWith("0x") && web3WalletAddress.length == 42
}

data class BlockchainActivityStats(
    val totalInteractions: Int = 0,
    val paymentsReceived: Int = 0,
    val paymentsSent: Int = 0,
    val commitmentsAmortized: Int = 0
)

data class SmartContractInfo(
    val tokenType: String,
    val title: String,
    val address: String,
    val minted: String,
    val explorerUrl: String
)

data class StatementTransaction(
    val id: Int,
    val createdAt: String,
    val type: String,
    val description: String,
    val blueChange: Double,
    val redChange: Double,
    val txHash: String?
) {
    val formattedBlueChange: String?
        get() = if (blueChange != 0.0) {
            val sign = if (blueChange > 0) "+" else ""
            String.format(Locale("es", "ES"), "%s%.4f BLUE", sign, blueChange)
        } else null

    val formattedRedChange: String?
        get() = if (redChange != 0.0) {
            val sign = if (redChange > 0) "+" else ""
            String.format(Locale("es", "ES"), "%s%.4f RED", sign, redChange)
        } else null

    val explorerUrl: String?
        get() = txHash?.takeIf { it.isNotBlank() }?.let {
            "https://sepolia-optimism.etherscan.io/tx/$it"
        }
}

enum class VaultCollateralToken(val symbol: String, val decimals: Int, val description: String) {
    USDT("USDT", 6, "Tether USD"),
    USDC("USDC", 6, "USD Coin"),
    DAI("DAI", 18, "MakerDAO DAI")
}
