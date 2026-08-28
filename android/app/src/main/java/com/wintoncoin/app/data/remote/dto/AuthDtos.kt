// ============================================================================
// WintonCoin Android — DTOs de Autenticación & Registro (Data Transfer Objects)
// ============================================================================
// Representan la estructura exacta del JSON que envía/recibe el backend.
// Usan KotlinX Serialization para parsing type-safe sin reflexión.
//
// [SEGURIDAD] Los campos opcionales tienen valores por defecto para
// prevenir crashes si el backend cambia la estructura del JSON.
// ============================================================================

package com.wintoncoin.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ============================================================================
// REQUEST DTOs (lo que enviamos al backend)
// ============================================================================

/**
 * Cuerpo del request de login.
 * Backend espera: { "identifier": "...", "password": "..." }
 */
@Serializable
data class LoginRequest(
    @SerialName("identifier")
    val identifier: String,
    val password: String
)

/**
 * Cuerpo del request de registro.
 * Backend espera: { "username": "...", "email": "...", "phone": "...", "password": "...", "terms_accepted": true }
 */
@Serializable
data class RegisterRequest(
    val username: String,
    val email: String,
    val phone: String = "",
    val password: String,
    @SerialName("terms_accepted")
    val termsAccepted: Boolean = true
)

/**
 * Cuerpo del request para verificación de código OTP (email / SMS).
 * Backend espera: { "email": "...", "otp_code": "123456" }
 */
@Serializable
data class VerifyOtpRequest(
    val email: String,
    @SerialName("otp_code")
    val otpCode: String
)

/**
 * Cuerpo del request de recuperación de contraseña.
 * Backend espera: { "email": "..." }
 */
@Serializable
data class ForgotPasswordRequest(
    val email: String
)

// ============================================================================
// RESPONSE DTOs (lo que recibimos del backend)
// ============================================================================

/**
 * Respuesta exitosa del endpoint POST /api/auth/login.
 */
@Serializable
data class LoginResponse(
    val token: String,
    val username: String,
    @SerialName("is_verified")
    val isVerified: Boolean = false,
    @SerialName("kyc_verified")
    val kycVerified: Boolean = false,
    @SerialName("requires_terms_acceptance")
    val requiresTermsAcceptance: Boolean = false,
    @SerialName("pending_documents")
    val pendingDocuments: List<String> = emptyList()
)

/**
 * Respuesta del endpoint POST /api/auth/register.
 */
@Serializable
data class RegisterResponse(
    val success: Boolean = true,
    val message: String? = null,
    @SerialName("user_id")
    val userId: Int? = null,
    val email: String? = null,
    @SerialName("requires_otp")
    val requiresOtp: Boolean = true
)

/**
 * Respuesta del endpoint POST /api/register-verify (verificación de OTP).
 */
@Serializable
data class VerifyOtpResponse(
    val success: Boolean = true,
    val message: String? = null,
    val token: String? = null,
    val username: String? = null,
    @SerialName("is_verified")
    val isVerified: Boolean = true
)

/**
 * Respuesta del endpoint POST /api/auth/forgot-password.
 */
@Serializable
data class ForgotPasswordResponse(
    val success: Boolean = true,
    val message: String? = null
)

/**
 * Respuesta del endpoint POST /api/auth/refresh.
 */
@Serializable
data class RefreshResponse(
    val token: String,
    val username: String? = null,
    @SerialName("is_verified")
    val isVerified: Boolean = false,
    @SerialName("kyc_verified")
    val kycVerified: Boolean = false,
    @SerialName("requires_terms_acceptance")
    val requiresTermsAcceptance: Boolean = false,
    @SerialName("pending_documents")
    val pendingDocuments: List<String> = emptyList()
)

/**
 * Respuesta del endpoint GET /api/auth/status.
 */
@Serializable
data class AuthStatusResponse(
    val isAuthenticated: Boolean = false,
    @SerialName("is_verified")
    val isVerified: Boolean = false,
    val username: String? = null,
    @SerialName("requires_terms_acceptance")
    val requiresTermsAcceptance: Boolean = false,
    @SerialName("pending_documents")
    val pendingDocuments: List<String> = emptyList()
)

/**
 * Respuesta genérica de error del backend.
 */
@Serializable
data class ErrorResponse(
    val error: String? = null,
    val message: String? = null
)
