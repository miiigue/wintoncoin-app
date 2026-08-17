// ============================================================================
// WintonCoin Android — PublicationDetailState (Estado del Detalle)
// ============================================================================
// [PRESENTATION LAYER] Estado inmutable para la pantalla de detalle y acción.
// ============================================================================

package com.wintoncoin.app.presentation.marketplace.detail

import com.wintoncoin.app.domain.model.PublicationItem

data class PublicationDetailState(
    val publication: PublicationItem? = null,
    val isLoading: Boolean = false,
    val isActionLoading: Boolean = false,
    val currentUsername: String = "",
    val donationAmountInput: String = "",
    val evidenceInput: String = "",
    val errorMessage: String? = null,
    val successMessage: String? = null,
    val actionCompleted: Boolean = false
)
