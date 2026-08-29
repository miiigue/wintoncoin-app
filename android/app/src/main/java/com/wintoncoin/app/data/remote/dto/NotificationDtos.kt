// ============================================================================
// WintonCoin Android — NotificationDtos
// ============================================================================
// [DATA LAYER / DTO] Data Transfer Objects serializables para el consumo de
// notificaciones in-app y alertas del sistema.
// ============================================================================

package com.wintoncoin.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class NotificationDto(
    @SerialName("id") val id: Int,
    @SerialName("recipient_username") val recipientUsername: String? = null,
    @SerialName("message") val message: String,
    @SerialName("is_read") val isRead: Boolean = false,
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class NotificationMarkReadResponseDto(
    @SerialName("success") val success: Boolean,
    @SerialName("count") val count: Int = 0
)

@Serializable
data class NotificationDismissResponseDto(
    @SerialName("message") val message: String
)
