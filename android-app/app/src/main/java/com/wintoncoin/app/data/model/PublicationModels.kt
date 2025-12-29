package com.wintoncoin.app.data.model

import com.google.gson.annotations.SerializedName

data class PublicationRequest(
    @SerializedName("type") val type: String, // 'request', 'sell', 'donation'
    @SerializedName("title") val title: String,
    @SerializedName("description") val description: String,
    @SerializedName("blue_cost") val blueCost: String?, // Para Solicitudes/Donaciones
    @SerializedName("blue_sell") val blueSell: String?, // Para Ventas
    @SerializedName("available_slots") val availableSlots: Int,
    @SerializedName("auto_approve") val autoApprove: Boolean,
    @SerializedName("expiration_time") val expirationTime: String? // ISO String o null
)

data class PublicationResponse(
    @SerializedName("id") val id: Int,
    @SerializedName("status") val status: String,
    @SerializedName("message") val message: String
)

