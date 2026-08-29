// ============================================================================
// WintonCoin Android — CreatePublicationEvent
// ============================================================================
// [PRESENTATION LAYER / EVENT] Eventos de interacción del usuario para el
// formulario de publicación y subida multimedia.
// ============================================================================

package com.wintoncoin.app.presentation.marketplace.create

import android.content.Context
import android.net.Uri

sealed interface CreatePublicationEvent {
    data class TypeChanged(val type: String) : CreatePublicationEvent
    data class TitleChanged(val title: String) : CreatePublicationEvent
    data class DescriptionChanged(val description: String) : CreatePublicationEvent
    data object AddStep : CreatePublicationEvent
    data class UpdateStep(val index: Int, val text: String) : CreatePublicationEvent
    data class RemoveStep(val index: Int) : CreatePublicationEvent
    data class AmountChanged(val amount: String) : CreatePublicationEvent
    data class TargetUsernameChanged(val target: String) : CreatePublicationEvent
    data class BeneficiaryCodeChanged(val code: String) : CreatePublicationEvent
    data class AvailableSlotsChanged(val slots: String) : CreatePublicationEvent
    data class ToggleRequiresEvidence(val enabled: Boolean) : CreatePublicationEvent
    data class ToggleAutoApprove(val enabled: Boolean) : CreatePublicationEvent
    data class ToggleSetExpiration(val enabled: Boolean) : CreatePublicationEvent
    data class DurationDaysChanged(val days: String) : CreatePublicationEvent
    data class DurationHoursChanged(val hours: String) : CreatePublicationEvent
    data class DurationMinutesChanged(val minutes: String) : CreatePublicationEvent
    data class ToggleAllowRepeat(val enabled: Boolean) : CreatePublicationEvent
    data class MaxRepeatChanged(val max: String) : CreatePublicationEvent
    data class RepeatCooldownDaysChanged(val days: String) : CreatePublicationEvent
    data class RepeatCooldownHoursChanged(val hours: String) : CreatePublicationEvent
    data class RepeatCooldownMinutesChanged(val minutes: String) : CreatePublicationEvent
    data class ImagesSelected(val uris: List<Uri>, val context: Context) : CreatePublicationEvent
    data class RemoveImage(val index: Int) : CreatePublicationEvent
    data object Submit : CreatePublicationEvent
    data object ConfirmDonation : CreatePublicationEvent
    data object DismissDonationDialog : CreatePublicationEvent
    data object DismissError : CreatePublicationEvent
    data object DismissSuccess : CreatePublicationEvent
}
