import com.wintoncoin.app.data.model.LoginRequest
import com.wintoncoin.app.data.model.LoginResponse
import com.wintoncoin.app.data.model.RegisterRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * This interface defines the API endpoints for the application using Retrofit.
 */
interface WintonApi {

    /**
     * Sends a POST request to the "login" endpoint.
     * @param request The user's login credentials.
     * @return A Response containing the login result, including a token and user data.
     */
    @POST("login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    /**
     * Sends a POST request to the "api/register-request" endpoint.
     * @param request The user's registration details.
     * @return A Response indicating success or failure, with no body content.
     */
    @POST("api/register-request")
    suspend fun register(@Body request: RegisterRequest): Response<Void>
}