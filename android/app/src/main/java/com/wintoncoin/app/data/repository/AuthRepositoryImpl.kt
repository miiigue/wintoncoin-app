// ============================================================================
// WintonCoin Android — AuthRepositoryImpl (Implementación del Repositorio)
// ============================================================================
// [DATA LAYER] Implementación concreta de AuthRepository.
// Conecta la capa de dominio con la capa de red (Retrofit) y
// el almacenamiento seguro (TokenManager).
//
// Equivalente a las funciones de login.js y auth.js de la PWA,
// pero centralizadas en un único punto de acceso a datos.
// ============================================================================

package com.wintoncoin.app.data.repository

import android.util.Log
import com.wintoncoin.app.core.audit.AuditLogger
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.data.remote.api.AuthApiService
import com.wintoncoin.app.data.remote.dto.ErrorResponse
import com.wintoncoin.app.data.remote.dto.LoginRequest
import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.UserSession
import com.wintoncoin.app.domain.repository.AuthRepository
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/**
 * AuthRepositoryImpl — Implementación concreta de las operaciones de autenticación.
 *
 * Responsabilidades:
 * 1. Ejecutar llamadas HTTP al backend via Retrofit (AuthApiService)
 * 2. Almacenar/leer credenciales via TokenManager (EncryptedSharedPreferences)
 * 3. Mapear respuestas del servidor a modelos de dominio (UserSession)
 * 4. Manejar errores de red de forma resiliente
 * 5. Generar logs de auditoría para cada operación
 */
@Singleton
class AuthRepositoryImpl @Inject constructor(
    // Servicio Retrofit para llamadas HTTP al backend
    private val authApiService: AuthApiService,
    // Almacenamiento cifrado de tokens
    private val tokenManager: TokenManager,
    // Logger de auditoría (SOC 2 compliance)
    private val auditLogger: AuditLogger,
    // JSON parser para deserializar errores
    private val json: Json
) : AuthRepository {

    companion object {
        private const val TAG = "AuthRepository"
    }

    /**
     * Inicia sesión con credenciales del usuario.
     *
     * Flujo (equivalente a login.js de la PWA):
     * 1. Enviar username + password al backend
     * 2. Si éxito → guardar token y username en almacenamiento cifrado
     * 3. Si error → retornar mensaje de error legible
     *
     * @param username Nombre de usuario (validado previamente en el ViewModel)
     * @param password Contraseña del usuario
     * @return Result<UserSession> con los datos de la sesión o el error
     */
    override suspend fun login(username: String, password: String): Result<UserSession> {
        return try {
            // Ejecutar la petición HTTP POST /api/auth/login
            val response = authApiService.login(LoginRequest(username, password))

            if (response.isSuccessful) {
                // ============================================================
                // LOGIN EXITOSO
                // ============================================================
                val loginResponse = response.body()
                    ?: return Result.Error("Respuesta vacía del servidor", response.code())

                // [SEGURIDAD] Almacenar credenciales en EncryptedSharedPreferences
                tokenManager.saveAccessToken(loginResponse.token)
                tokenManager.saveUsername(loginResponse.username)

                // [AUDITORÍA] Registrar login exitoso
                auditLogger.logAuthSuccess("LOGIN_SUCCESS", loginResponse.username)

                // Mapear la respuesta del backend al modelo de dominio
                val session = UserSession(
                    isAuthenticated = true,
                    isVerified = loginResponse.isVerified,
                    username = loginResponse.username,
                    requiresTermsAcceptance = loginResponse.requiresTermsAcceptance,
                    pendingDocuments = loginResponse.pendingDocuments
                )

                Result.Success(session)
            } else {
                // ============================================================
                // LOGIN FALLIDO (4xx, 5xx)
                // ============================================================
                val errorMessage = parseErrorMessage(response.errorBody()?.string())
                auditLogger.logAuthFailure("LOGIN_FAILED", "code=${response.code()}, msg=$errorMessage")
                Result.Error(errorMessage, response.code())
            }
        } catch (e: Exception) {
            // ================================================================
            // ERROR DE RED (sin conexión, timeout, DNS, etc.)
            // ================================================================
            Log.e(TAG, "[NETWORK] Error de red al intentar login: ${e.message}")
            auditLogger.logAuthFailure("LOGIN_NETWORK_ERROR", "exception=${e.message}")
            Result.Error("No se pudo conectar al servidor. Verifica tu conexión a Internet.")
        }
    }

    /**
     * Refresca el Access Token usando el Refresh Token (cookie HttpOnly).
     *
     * Equivalente exacto de silentRefreshIfNeeded() en auth.js de la PWA.
     *
     * Flujo:
     * 1. Verificar si el token actual ha expirado
     * 2. Si no ha expirado → retornar el token actual (no hacer llamada de red)
     * 3. Si expiró → llamar al backend POST /api/auth/refresh
     * 4. Si éxito → guardar nuevo token
     * 5. Si 401 → sesión inválida (destruir credenciales)
     * 6. Si 5xx → error temporal (NO destruir credenciales)
     */
    override suspend fun refreshToken(): Result<String> {
        // Si el token aún es válido, retornarlo sin hacer llamada de red
        val currentToken = tokenManager.getAccessToken()
        if (currentToken != null && !tokenManager.isTokenExpired()) {
            return Result.Success(currentToken)
        }

        return try {
            val response = authApiService.refreshToken()

            if (response.isSuccessful) {
                val refreshResponse = response.body()
                    ?: return Result.Error("Respuesta vacía del servidor al refrescar")

                // Guardar el nuevo token
                tokenManager.saveAccessToken(refreshResponse.token)
                refreshResponse.username?.let { tokenManager.saveUsername(it) }

                auditLogger.logAuthSuccess("TOKEN_REFRESH_SUCCESS", refreshResponse.username ?: "unknown")
                Result.Success(refreshResponse.token)
            } else if (response.code() == 401) {
                // [SEGURIDAD FINTECH] 401 = sesión explícitamente inválida
                // Destruir credenciales locales (equivalente a auth.js línea 113-125)
                tokenManager.clearSession()
                auditLogger.logAuthFailure("TOKEN_REFRESH_INVALID_SESSION", "Server returned 401")
                Result.Error("Sesión expirada o inválida.", 401)
            } else {
                // 5xx = error temporal del servidor
                // [RESILIENCIA] NO destruir credenciales (equivalente a auth.js línea 84-86)
                auditLogger.logAuthFailure("TOKEN_REFRESH_SERVER_ERROR", "code=${response.code()}")
                Result.Error("Error temporal del servidor.", response.code())
            }
        } catch (e: Exception) {
            // Error de red (sin conexión, timeout)
            // [RESILIENCIA] NO destruir credenciales
            Log.e(TAG, "[NETWORK] Error de red al refrescar token: ${e.message}")
            Result.Error("Error de conexión al refrescar sesión.")
        }
    }

    /**
     * Cierra la sesión del usuario.
     *
     * Equivalente a logout() en auth.js de la PWA (líneas 191-210):
     * 1. Notificar al servidor para destruir la cookie HttpOnly
     * 2. Limpiar storage local
     */
    override suspend fun logout() {
        try {
            // Notificar al backend (fire-and-forget, como en la PWA)
            authApiService.logout()
        } catch (e: Exception) {
            // Si falla la llamada al servidor, igualmente limpiamos local
            Log.w(TAG, "[AUTH] Fallo al cerrar sesión en backend: ${e.message}")
        }

        // Siempre limpiar credenciales locales
        val username = tokenManager.getUsername() ?: "unknown"
        tokenManager.clearSession()
        auditLogger.logAuthSuccess("LOGOUT", username)
    }

    /**
     * Verifica si hay una sesión guardada localmente.
     */
    override fun hasActiveSession(): Boolean {
        return tokenManager.hasSession()
    }

    /**
     * Verifica si el token actual ha expirado.
     */
    override fun isTokenExpired(): Boolean {
        return tokenManager.isTokenExpired()
    }

    // ========================================================================
    // HELPERS PRIVADOS
    // ========================================================================

    /**
     * Parsea el mensaje de error del cuerpo de la respuesta HTTP.
     * El backend puede enviar { "error": "..." } o { "message": "..." }
     */
    private fun parseErrorMessage(errorBody: String?): String {
        if (errorBody.isNullOrBlank()) {
            return "Error desconocido del servidor."
        }
        return try {
            val errorResponse = json.decodeFromString<ErrorResponse>(errorBody)
            errorResponse.error ?: errorResponse.message ?: "Error del servidor."
        } catch (e: Exception) {
            "Error del servidor."
        }
    }
}
