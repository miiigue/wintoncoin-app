package com.wintoncoin.app.data.model

import com.google.gson.annotations.SerializedName

/**
 * Represents the successful response from the /login endpoint.
 */
data class LoginResponse(
    @SerializedName("token")
    val token: String,

    @SerializedName("user")
    val user: User
)

/**
 * Represents the user data nested within the login response.
 * This should match the 'user' object returned by your API.
 */
data class User(
    @SerializedName("id")
    val id: String,

    @SerializedName("username")
    val username: String,

    @SerializedName("email")
    val email: String
)