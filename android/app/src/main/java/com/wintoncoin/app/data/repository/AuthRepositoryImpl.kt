// ============================================================================
// WintonCoin Android — AuthRepositoryImpl (Implementación del Repositorio)
// ============================================================================
// [DATA LAYER] Implementación concreta de AuthRepository.
// Conecta la capa de dominio con la capa de red (Retrofit) y
// el almacenamiento seguro (TokenManager).
// ============================================================================

package com.wintoncoin.app.data.repository

import android.util.Log
import com.wintoncoin.app.core.audit.AuditLogger
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.data.remote.api.AuthApiService
import com.wintoncoin.app.data.remote.dto.ErrorResponse
import com.wintoncoin.app.data.remote.dto.ForgotPasswordRequest
import com.wintoncoin.app.data.remote.dto.LoginRequest
import com.wintoncoin.app.data.remote.dto.RegisterRequest
import com.wintoncoin.app.data.remote.dto.RegisterResponse
import com.wintoncoin.app.data.remote.dto.VerifyOtpRequest
import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.UserSession
import com.wintoncoin.app.domain.repository.AuthRepository
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val authApiService: AuthApiService,
    private val tokenManager: TokenManager,
    private val auditLogger: AuditLogger,
    private val json: Json
) : AuthRepository {

    companion object {
        private const val TAG = "AuthRepository"
    }

    override suspend fun login(username: String, password: String): Result<UserSession> {
        return try {
            val response = authApiService.login(LoginRequest(identifier = username, password = password))

            if (response.isSuccessful) {
                val loginResponse = response.body()
                    ?: return Result.Error("Respuesta vacía del servidor", response.code())

                tokenManager.saveAccessToken(loginResponse.token)
                tokenManager.saveUsername(loginResponse.username)

                auditLogger.logAuthSuccess("LOGIN_SUCCESS", loginResponse.username)

                val session = UserSession(
                    isAuthenticated = true,
                    isVerified = loginResponse.isVerified,
                    username = loginResponse.username,
                    requiresTermsAcceptance = loginResponse.requiresTermsAcceptance,
                    pendingDocuments = loginResponse.pendingDocuments
                )

                Result.Success(session)
            } else {
                val errorMessage = parseErrorMessage(response.errorBody()?.string())
                auditLogger.logAuthFailure("LOGIN_FAILED", "code=${response.code()}, msg=$errorMessage")
                Result.Error(errorMessage, response.code())
            }
        } catch (e: Exception) {
            Log.e(TAG, "[NETWORK] Error de red al intentar login: ${e.message}")
            auditLogger.logAuthFailure("LOGIN_NETWORK_ERROR", "exception=${e.message}")
            Result.Error("No se pudo conectar al servidor. Verifica tu conexión a Internet.")
        }
    }

    override suspend fun register(
        username: String,
        email: String,
        phone: String,
        password: String
    ): Result<RegisterResponse> {
        return try {
            val request = RegisterRequest(
                username = username,
                email = email,
                phone = phone,
                password = password,
                termsAccepted = true
            )
            val response = authApiService.register(request)

            if (response.isSuccessful) {
                val registerResponse = response.body()
                    ?: return Result.Error("Respuesta vacía del servidor al registrar usuario")

                auditLogger.logAuthSuccess("REGISTER_SUCCESS", username)
                Result.Success(registerResponse)
            } else {
                val errorMessage = parseErrorMessage(response.errorBody()?.string())
                auditLogger.logAuthFailure("REGISTER_FAILED", "code=${response.code()}, msg=$errorMessage")
                Result.Error(errorMessage, response.code())
            }
        } catch (e: Exception) {
            Log.e(TAG, "[NETWORK] Error de red al intentar registro: ${e.message}")
            auditLogger.logAuthFailure("REGISTER_NETWORK_ERROR", "exception=${e.message}")
            Result.Error("No se pudo conectar al servidor. Verifica tu conexión a Internet.")
        }
    }

    override suspend fun verifyOtp(email: String, otpCode: String): Result<UserSession> {
        return try {
            val response = authApiService.verifyOtp(VerifyOtpRequest(email, otpCode))

            if (response.isSuccessful) {
                val verifyResponse = response.body()
                    ?: return Result.Error("Respuesta vacía del servidor al verificar OTP")

                verifyResponse.token?.let { tokenManager.saveAccessToken(it) }
                verifyResponse.username?.let { tokenManager.saveUsername(it) }

                auditLogger.logAuthSuccess("VERIFY_OTP_SUCCESS", verifyResponse.username ?: email)

                val session = UserSession(
                    isAuthenticated = true,
                    isVerified = true,
                    username = verifyResponse.username ?: email
                )

                Result.Success(session)
            } else {
                val errorMessage = parseErrorMessage(response.errorBody()?.string())
                auditLogger.logAuthFailure("VERIFY_OTP_FAILED", "code=${response.code()}, msg=$errorMessage")
                Result.Error(errorMessage, response.code())
            }
        } catch (e: Exception) {
            Log.e(TAG, "[NETWORK] Error de red al verificar OTP: ${e.message}")
            auditLogger.logAuthFailure("VERIFY_OTP_NETWORK_ERROR", "exception=${e.message}")
            Result.Error("No se pudo conectar al servidor. Verifica tu conexión a Internet.")
        }
    }

    override suspend fun forgotPassword(email: String): Result<String> {
        return try {
            val response = authApiService.forgotPassword(ForgotPasswordRequest(email))

            if (response.isSuccessful) {
                val forgotResponse = response.body()
                val message = forgotResponse?.message ?: "Se han enviado las instrucciones a tu correo electrónico."
                auditLogger.logAuthSuccess("FORGOT_PASSWORD_REQUEST", email)
                Result.Success(message)
            } else {
                val errorMessage = parseErrorMessage(response.errorBody()?.string())
                auditLogger.logAuthFailure("FORGOT_PASSWORD_FAILED", "code=${response.code()}, msg=$errorMessage")
                Result.Error(errorMessage, response.code())
            }
        } catch (e: Exception) {
            Log.e(TAG, "[NETWORK] Error de red al solicitar recuperación de clave: ${e.message}")
            Result.Error("No se pudo conectar al servidor. Verifica tu conexión a Internet.")
        }
    }

    override suspend fun refreshToken(): Result<String> {
        val currentToken = tokenManager.getAccessToken()
        if (currentToken != null && !tokenManager.isTokenExpired()) {
            return Result.Success(currentToken)
        }

        return try {
            val response = authApiService.refreshToken()

            if (response.isSuccessful) {
                val refreshResponse = response.body()
                    ?: return Result.Error("Respuesta vacía del servidor al refrescar")

                tokenManager.saveAccessToken(refreshResponse.token)
                refreshResponse.username?.let { tokenManager.saveUsername(it) }

                auditLogger.logAuthSuccess("TOKEN_REFRESH_SUCCESS", refreshResponse.username ?: "unknown")
                Result.Success(refreshResponse.token)
            } else if (response.code() == 401) {
                tokenManager.clearSession()
                auditLogger.logAuthFailure("TOKEN_REFRESH_INVALID_SESSION", "Server returned 401")
                Result.Error("Sesión expirada o inválida.", 401)
            } else {
                auditLogger.logAuthFailure("TOKEN_REFRESH_SERVER_ERROR", "code=${response.code()}")
                Result.Error("Error temporal del servidor.", response.code())
            }
        } catch (e: Exception) {
            Log.e(TAG, "[NETWORK] Error de red al refrescar token: ${e.message}")
            Result.Error("Error de conexión al refrescar sesión.")
        }
    }

    override suspend fun logout() {
        try {
            authApiService.logout()
        } catch (e: Exception) {
            Log.w(TAG, "[AUTH] Fallo al cerrar sesión en backend: ${e.message}")
        }

        val username = tokenManager.getUsername() ?: "unknown"
        tokenManager.clearSession()
        auditLogger.logAuthSuccess("LOGOUT", username)
    }

    override fun hasActiveSession(): Boolean {
        return tokenManager.hasSession()
    }

    override fun isTokenExpired(): Boolean {
        return tokenManager.isTokenExpired()
    }

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
