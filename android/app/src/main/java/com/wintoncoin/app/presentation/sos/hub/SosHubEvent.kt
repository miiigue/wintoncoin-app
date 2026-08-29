// ============================================================================
// WintonCoin Android — SosHubEvent
// ============================================================================
// [PRESENTATION LAYER / MVI EVENT] Eventos e intenciones del usuario en el Hub SOS.
// ============================================================================

package com.wintoncoin.app.presentation.sos.hub

sealed interface SosHubEvent {
    data object LoadCampaignInfo : SosHubEvent
    data object CopyShareCode : SosHubEvent
    data object ClearFeedback : SosHubEvent
}
