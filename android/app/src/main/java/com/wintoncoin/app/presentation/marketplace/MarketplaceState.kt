// ============================================================================
// WintonCoin Android — MarketplaceState (Estado de UI del Marketplace)
// ============================================================================
// [PRESENTATION LAYER] Estado inmutable y reactivo para la pantalla de Marketplace.
// ============================================================================

package com.wintoncoin.app.presentation.marketplace

import com.wintoncoin.app.domain.model.MarketplaceCategory
import com.wintoncoin.app.domain.model.PublicationItem

data class MarketplaceState(
    val publications: List<PublicationItem> = emptyList(),
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val selectedCategory: MarketplaceCategory = MarketplaceCategory.ALL,
    val searchQuery: String = "",
    val errorMessage: String? = null,
    val successMessage: String? = null
)
