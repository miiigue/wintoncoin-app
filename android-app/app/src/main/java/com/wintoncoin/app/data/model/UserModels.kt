package com.wintoncoin.app.data.model

import com.google.gson.annotations.SerializedName

data class UserBalanceResponse(
    @SerializedName("liquid_blue_balance") val liquidBlueBalance: String, // String para manejar decimales con precisión
    @SerializedName("escrow_blue_balance") val escrowBlueBalance: String,
    @SerializedName("red_balance") val redBalance: String
)

