// ============================================================================
// WintonCoin Android — WalletModels (Modelos de Dominio de Billetera)
// ============================================================================
// Representación pura e inmutable de los balances BLUE/RED y transacciones.
// ============================================================================

package com.wintoncoin.app.domain.model

enum class TransactionType {
    EARNED,   // Tokens ganados por tareas completadas
    SPENT,    // Tokens pagados por publicar tareas
    ESCROW,   // Tokens retenidos en custodia
    DONATION  // Contribuciones a causas solidarias
}

data class TransactionItem(
    val id: String,
    val title: String,
    val amount: Double,
    val type: TransactionType,
    val date: String?,
    val status: String,
    val isHumanitarian: Boolean = false
)

data class WalletBalance(
    val blueAvailable: Double = 0.0,
    val blueEscrow: Double = 0.0,
    val redDebt: Double = 0.0,
    val redLimit: Double = 0.0,
    val redAvailable: Double = 0.0,
    val collateralBalance: Double = 0.0,
    val web3WalletAddress: String? = null,
    val kycVerified: Boolean = false,
    val nextDueAt: String? = null,
    val nextDueAmount: Double? = null,
    val nextUnlockAt: String? = null,
    val nextUnlockAmount: Double? = null
)
