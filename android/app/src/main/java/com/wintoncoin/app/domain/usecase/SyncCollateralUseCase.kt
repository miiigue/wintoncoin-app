// ============================================================================
// WintonCoin Android — SyncCollateralUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Valida y sincroniza con el backend una operación de
// depósito o retiro en la Bóveda de Garantías (Collateral Vault).
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.repository.AccountStatementRepository
import javax.inject.Inject

class SyncCollateralUseCase @Inject constructor(
    private val repository: AccountStatementRepository
) {
    suspend operator fun invoke(
        operationType: String,
        amount: Double,
        tokenSymbol: String,
        tokenContractAddress: String,
        txHash: String,
        balanceAfter: Double?
    ): Result<Double> {
        if (amount <= 0.0) {
            return Result.failure(IllegalArgumentException("El monto debe ser mayor a 0."))
        }
        if (operationType != "deposit" && operationType != "withdraw") {
            return Result.failure(IllegalArgumentException("Tipo de operación inválida."))
        }
        if (tokenContractAddress.isBlank()) {
            return Result.failure(IllegalArgumentException("Dirección de contrato de token requerida."))
        }
        if (txHash.isBlank()) {
            return Result.failure(IllegalArgumentException("Hash de transacción requerido."))
        }

        return repository.syncCollateral(
            operationType = operationType,
            amount = amount,
            tokenSymbol = tokenSymbol,
            tokenContractAddress = tokenContractAddress,
            txHash = txHash,
            balanceAfter = balanceAfter
        )
    }
}
