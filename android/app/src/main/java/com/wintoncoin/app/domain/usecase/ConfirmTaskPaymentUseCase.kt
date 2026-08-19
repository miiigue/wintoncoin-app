// ============================================================================
// WintonCoin Android — ConfirmTaskPaymentUseCase (Caso de Uso: Liberar Fondos)
// ============================================================================
// [DOMAIN LAYER] Aprueba el pago de una tarea completada y libera los BLUEs.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.repository.MarketplaceRepository
import javax.inject.Inject

class ConfirmTaskPaymentUseCase @Inject constructor(
    private val repository: MarketplaceRepository
) {
    suspend operator fun invoke(id: String, workerUsername: String): Result<String> {
        if (id.isBlank() || workerUsername.isBlank()) {
            return Result.failure(IllegalArgumentException("Parámetros requeridos inválidos."))
        }
        return repository.confirmPayment(id = id, workerUsername = workerUsername)
    }
}
