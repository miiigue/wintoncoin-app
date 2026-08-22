// ============================================================================
// WintonCoin Android — CreateQuickSaleUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Valida las reglas de negocio para la creación de
// Ventas Rápidas directas P2P.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.data.remote.dto.CreateQuickSaleRequest
import com.wintoncoin.app.domain.repository.MarketplaceRepository
import javax.inject.Inject

class CreateQuickSaleUseCase @Inject constructor(
    private val repository: MarketplaceRepository
) {
    suspend operator fun invoke(request: CreateQuickSaleRequest): Result<String> {
        if (request.amount <= 0.0) {
            return Result.failure(IllegalArgumentException("El monto de la venta rápida debe ser mayor a 0."))
        }

        if (request.authorUsername.isBlank()) {
            return Result.failure(IllegalArgumentException("No se ha identificado la sesión del autor."))
        }

        if (!request.targetUsername.isNullOrBlank() &&
            request.targetUsername.equals(request.authorUsername, ignoreCase = true)
        ) {
            return Result.failure(IllegalArgumentException("No puedes crearte una venta rápida a ti mismo."))
        }

        val safeTitle = if (request.title.isBlank()) "Venta Rápida" else request.title.trim()
        val finalRequest = request.copy(title = safeTitle)

        return repository.createQuickSale(finalRequest)
    }
}
