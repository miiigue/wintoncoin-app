// ============================================================================
// WintonCoin Android — ApplyToPublicationUseCase (Caso de Uso: Postulación)
// ============================================================================
// [DOMAIN LAYER] Ejecuta la postulación o donación a una publicación.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.repository.MarketplaceRepository
import javax.inject.Inject

class ApplyToPublicationUseCase @Inject constructor(
    private val repository: MarketplaceRepository
) {
    suspend operator fun invoke(id: String, donationAmount: Double? = null): Result<String> {
        if (id.isBlank()) return Result.failure(IllegalArgumentException("ID de publicación inválido."))
        return repository.acceptPublication(id = id, donationAmount = donationAmount)
    }
}
