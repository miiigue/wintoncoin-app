// ============================================================================
// WintonCoin Android — AuthApiService (Interfaz Retrofit de Autenticación)
// ============================================================================
// Define los endpoints del backend relacionados con autenticación.
// Retrofit genera automáticamente la implementación HTTP.
//
// Equivalente a las llamadas fetch() en login.js y auth.js de la PWA.
// ============================================================================

package com.wintoncoin.app.data.remote.api

import com.wintoncoin.app.data.remote.dto.AuthStatusResponse
import com.wintoncoin.app.data.remote.dto.LoginRequest
import com.wintoncoin.app.data.remote.dto.LoginResponse
import com.wintoncoin.app.data.remote.dto.RefreshResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

/**
 * AuthApiService — Endpoints de autenticación del backend WintonCoin.
 *
 * Cada método corresponde a un endpoint exacto del backend Express.js.
 * Retrofit convierte automáticamente las data classes a/desde JSON.
 */
interface AuthApiService {

    /**
     * Inicia sesión con usuario y contraseña.
     *
     * Backend: POST /api/auth/login (authRoutes.js → authController.js)
     * PWA equivalente: login.js → fetch(`${API_URL}/api/auth/login`, ...)
     *
     * @param loginRequest Cuerpo con username y password
     * @return Response con token JWT y datos del usuario
     */
    @POST("api/auth/login")
    suspend fun login(@Body loginRequest: LoginRequest): Response<LoginResponse>

    /**
     * Refresca el Access Token usando el Refresh Token (cookie HttpOnly).
     *
     * Backend: POST /api/auth/refresh (authRoutes.js → authController.js)
     * PWA equivalente: auth.js → silentRefreshIfNeeded()
     *
     * NOTA: El refresh token viaja como cookie HttpOnly administrada por OkHttp.
     * No se envía en el body ni en headers manuales.
     *
     * @return Response con nuevo access token
     */
    @POST("api/auth/refresh")
    suspend fun refreshToken(): Response<RefreshResponse>

    /**
     * Cierra la sesión destruyendo la cookie de refresh en el servidor.
     *
     * Backend: POST /api/auth/logout (authRoutes.js → authController.js)
     * PWA equivalente: auth.js → logout()
     */
    @POST("api/auth/logout")
    suspend fun logout(): Response<Unit>

    /**
     * Consulta el estado actual de autenticación del usuario.
     *
     * Backend: GET /api/auth/status (authRoutes.js → authController.js)
     * PWA equivalente: auth.js → checkAuthStatus()
     *
     * @param token Bearer token para la autorización
     * @return Estado de la sesión (isAuthenticated, is_verified, etc.)
     */
    @GET("api/auth/status")
    suspend fun getAuthStatus(
        @Header("Authorization") token: String
    ): Response<AuthStatusResponse>
}
