package com.wintoncoin.app.data.model

import com.google.gson.annotations.SerializedName

/** * Represents the response received from the API after creating a publication.
 * The fields here should match the JSON response from your "/publish" endpoint.
 *
 * Example JSON:
 * {
 *   "id": "pub_12345",
 *   "title": "My First Post",
 *   "content": "Hello, world!",
 *   "created_at": "2025-12-25T10:30:00Z"
 * }
 */
data class PublicationResponse(
    @SerializedName("id")
    val id: String,

    @SerializedName("title")
    val title: String,

    @SerializedName("content")
    val content: String,

    @SerializedName("created_at")
    val createdAt: String
)