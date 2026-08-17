// ============================================================================
// WintonCoin Android — GetPublicationDetailsUseCase (Caso de Uso: Detalle)
// ============================================================================
// [DOMAIN LAYER] Obtiene la información detallada de una publicación.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.PublicationItem
import com.wintoncoin.app.domain.repository.MarketplaceRepository
import javax.inject.Inject

class GetPublicationDetailsUseCase @Inject constructor(
    private val repository: MarketplaceRepository
) {
    suspend operator fun invoke(id: String): Result<PublicationItem> {
        if (id.isBlank()) return Result.failure(IllegalArgumentException("El identificador de publicación no puede estar vacío."))
        return repository.getPublicationDetails(id)
    }
}
