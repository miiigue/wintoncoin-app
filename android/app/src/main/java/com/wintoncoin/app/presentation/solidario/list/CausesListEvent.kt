// ============================================================================
// WintonCoin Android — CausesListEvent
// ============================================================================
// [PRESENTATION / MVI EVENT] Eventos de intención para el explorador de causas.
// ============================================================================

package com.wintoncoin.app.presentation.solidario.list

sealed interface CausesListEvent {
    object Load : CausesListEvent
    object Refresh : CausesListEvent
    data class SelectTab(val tab: CausesTab) : CausesListEvent
    data class SearchQueryChanged(val query: String) : CausesListEvent
    object DismissError : CausesListEvent
}
