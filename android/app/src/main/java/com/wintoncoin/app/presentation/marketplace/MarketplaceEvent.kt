// ============================================================================
// WintonCoin Android — MarketplaceEvent (Eventos de UI del Marketplace)
// ============================================================================
// [PRESENTATION LAYER] Eventos o intenciones disparadas por la vista.
// ============================================================================

package com.wintoncoin.app.presentation.marketplace

import com.wintoncoin.app.domain.model.MarketplaceCategory

sealed class MarketplaceEvent {
    object LoadFeed : MarketplaceEvent()
    object Refresh : MarketplaceEvent()
    data class SelectCategory(val category: MarketplaceCategory) : MarketplaceEvent()
    data class UpdateSearchQuery(val query: String) : MarketplaceEvent()
    object ClearMessages : MarketplaceEvent()
}
