// ============================================================================
// WintonCoin Android — AuthApiService (Interfaz Retrofit de Autenticación)
// ============================================================================
// Define los endpoints del backend relacionados con autenticación y registro.
// Retrofit genera automáticamente la implementación HTTP.
// ============================================================================

package com.wintoncoin.app.data.remote.api

import com.wintoncoin.app.data.remote.dto.AuthStatusResponse
import com.wintoncoin.app.data.remote.dto.ForgotPasswordRequest
import com.wintoncoin.app.data.remote.dto.ForgotPasswordResponse
import com.wintoncoin.app.data.remote.dto.LoginRequest
import com.wintoncoin.app.data.remote.dto.LoginResponse
import com.wintoncoin.app.data.remote.dto.RefreshResponse
import com.wintoncoin.app.data.remote.dto.RegisterRequest
import com.wintoncoin.app.data.remote.dto.RegisterResponse
import com.wintoncoin.app.data.remote.dto.VerifyOtpRequest
import com.wintoncoin.app.data.remote.dto.VerifyOtpResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

/**
 * AuthApiService — Endpoints de autenticación y registro del backend WintonCoin.
 */
interface AuthApiService {

    /**
     * Inicia sesión con usuario y contraseña.
     * Backend: POST /api/auth/login
     */
    @POST("api/auth/login")
    suspend fun login(@Body loginRequest: LoginRequest): Response<LoginResponse>

    /**
     * Registra un nuevo usuario en la plataforma.
     * Backend: POST /api/auth/register
     */
    @POST("api/auth/register")
    suspend fun register(@Body registerRequest: RegisterRequest): Response<RegisterResponse>

    /**
     * Verifica el código OTP enviado por email/SMS.
     * Backend: POST /api/register-verify
     */
    @POST("api/register-verify")
    suspend fun verifyOtp(@Body verifyOtpRequest: VerifyOtpRequest): Response<VerifyOtpResponse>

    /**
     * Solicita la recuperación de contraseña por email.
     * Backend: POST /api/auth/forgot-password
     */
    @POST("api/auth/forgot-password")
    suspend fun forgotPassword(@Body forgotPasswordRequest: ForgotPasswordRequest): Response<ForgotPasswordResponse>

    /**
     * Refresca el Access Token usando el Refresh Token (cookie HttpOnly).
     * Backend: POST /api/auth/refresh
     */
    @POST("api/auth/refresh")
    suspend fun refreshToken(): Response<RefreshResponse>

    /**
     * Cierra la sesión destruyendo la cookie de refresh en el servidor.
     * Backend: POST /api/auth/logout
     */
    @POST("api/auth/logout")
    suspend fun logout(): Response<Unit>

    /**
     * Consulta el estado actual de autenticación del usuario.
     * Backend: GET /api/auth/status
     */
    @GET("api/auth/status")
    suspend fun getAuthStatus(
        @Header("Authorization") token: String
    ): Response<AuthStatusResponse>
}
