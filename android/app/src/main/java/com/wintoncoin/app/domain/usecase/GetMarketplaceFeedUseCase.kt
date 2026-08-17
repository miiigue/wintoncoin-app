// ============================================================================
// WintonCoin Android — GetMarketplaceFeedUseCase (Caso de Uso: Feed de Marketplace)
// ============================================================================
// [DOMAIN LAYER] Obtiene el feed ordenado y filtrado de publicaciones y causas.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.MarketplaceCategory
import com.wintoncoin.app.domain.model.PublicationItem
import com.wintoncoin.app.domain.repository.MarketplaceRepository
import javax.inject.Inject

class GetMarketplaceFeedUseCase @Inject constructor(
    private val repository: MarketplaceRepository
) {
    suspend operator fun invoke(
        search: String? = null,
        category: MarketplaceCategory = MarketplaceCategory.ALL
    ): Result<List<PublicationItem>> {
        return repository.getMarketplaceFeed(search = search, category = category)
    }
}
