import com.google.gson.annotations.SerializedName

/**
 * Represents the data sent to the API to create a new publication.
 * The fields here should match the expected JSON body of your "/publish" endpoint.
 *
 * Example JSON:
 * {
 *   "publication_title": "My First Post",
 *   "publication_content": "Hello, world!"
 * }
 */
data class PublicationRequest(
    // Use @SerializedName if the JSON key from the API is different from the variable name
    @SerializedName("publication_title")
    val title: String,

    @SerializedName("publication_content")
    val content: String

    // Add any other fields your API requires, like authorId, etc.
    // val authorId: String
)