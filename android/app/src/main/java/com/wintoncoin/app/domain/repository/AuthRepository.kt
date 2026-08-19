// ============================================================================
// WintonCoin Android — AuthRepository Interface (Contrato de Dominio)
// ============================================================================
// Define las operaciones de autenticación y registro que la capa de presentación
// puede solicitar.
// ============================================================================

package com.wintoncoin.app.domain.repository

import com.wintoncoin.app.data.remote.dto.RegisterResponse
import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.UserSession

/**
 * AuthRepository — Contrato de operaciones de autenticación y registro.
 */
interface AuthRepository {

    /**
     * Inicia sesión con credenciales.
     */
    suspend fun login(username: String, password: String): Result<UserSession>

    /**
     * Registra un nuevo usuario.
     */
    suspend fun register(
        username: String,
        email: String,
        phone: String,
        password: String
    ): Result<RegisterResponse>

    /**
     * Verifica el código OTP enviado al usuario.
     */
    suspend fun verifyOtp(email: String, otpCode: String): Result<UserSession>

    /**
     * Solicita recuperar la contraseña por correo.
     */
    suspend fun forgotPassword(email: String): Result<String>

    /**
     * Refresca el Access Token silenciosamente.
     */
    suspend fun refreshToken(): Result<String>

    /**
     * Cierra la sesión del usuario.
     */
    suspend fun logout()

    /**
     * Verifica si hay una sesión activa guardada localmente.
     */
    fun hasActiveSession(): Boolean

    /**
     * Verifica si el token actual ha expirado.
     */
    fun isTokenExpired(): Boolean
}
