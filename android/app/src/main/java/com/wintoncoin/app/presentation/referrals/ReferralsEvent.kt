// ============================================================================
// WintonCoin Android — ReferralsEvent (Eventos UI de Red de Referidos)
// ============================================================================
// [PRESENTATION / EVENTS] Define las acciones disponibles en la pantalla de
// Red de Referidos (carga, refresco, copia de código y enlace).
// ============================================================================

package com.wintoncoin.app.presentation.referrals

sealed interface ReferralsEvent {
    object Load : ReferralsEvent
    object Refresh : ReferralsEvent
    data class CopyText(val text: String, val label: String) : ReferralsEvent
    object DismissCopyFeedback : ReferralsEvent
    object DismissError : ReferralsEvent
}
