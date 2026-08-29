// ============================================================================
// WintonCoin Android — CreatePublicationState
// ============================================================================
// [PRESENTATION LAYER / STATE] Estado inmutable de la pantalla de creación de
// publicaciones y ventas P2P, con cálculo reactivo de precios y preview multimedia.
// ============================================================================

package com.wintoncoin.app.presentation.marketplace.create

import android.net.Uri

data class CreatePublicationState(
    val publicationType: String = "request", // "request", "sell", "quick_sale", "donation"
    val title: String = "",
    val description: String = "",
    val steps: List<String> = emptyList(),
    val amountInput: String = "",
    val targetUsername: String = "",
    val beneficiaryReferralCode: String = "",
    val availableSlots: String = "1",
    val requiresEvidence: Boolean = false,
    val autoApprove: Boolean = false,
    val setExpiration: Boolean = false,
    val durationDays: String = "0",
    val durationHours: String = "0",
    val durationMinutes: String = "0",
    val allowRepeat: Boolean = false,
    val maxRepeatPerUser: String = "2",
    val repeatCooldownDays: String = "0",
    val repeatCooldownHours: String = "0",
    val repeatCooldownMinutes: String = "12",
    val localImageUris: List<Uri> = emptyList(),
    val uploadedImageUrls: List<String> = emptyList(),
    val maxImagesAllowed: Int = 1,
    val isUploadingImages: Boolean = false,
    val multiplier: Double = 1.0,
    val stageName: String = "Sin etapa activa",
    val isPreLaunch: Boolean = true,
    val costPreviewText: String = "",
    val isLoading: Boolean = false,
    val isSettingsLoading: Boolean = true,
    val errorMessage: String? = null,
    val successMessage: String? = null,
    val isSuccess: Boolean = false,
    val showDonationConfirmDialog: Boolean = false
)
