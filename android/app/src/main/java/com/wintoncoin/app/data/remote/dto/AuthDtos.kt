// ============================================================================
// WintonCoin Android — DTOs de Autenticación (Data Transfer Objects)
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
 * Backend espera: { "username": "...", "password": "..." }
 */
@Serializable
data class LoginRequest(
    // Nombre de usuario (3-30 caracteres, alfanumérico + underscore)
    val username: String,
    // Contraseña del usuario
    val password: String
)

// ============================================================================
// RESPONSE DTOs (lo que recibimos del backend)
// ============================================================================

/**
 * Respuesta exitosa del endpoint POST /api/auth/login.
 *
 * Backend retorna:
 * {
 *   "token": "eyJhbGci...",       // Access Token JWT
 *   "username": "miguel123",
 *   "is_verified": true,
 *   "kyc_verified": false,
 *   "requires_terms_acceptance": false,
 *   "pending_documents": []
 * }
 */
@Serializable
data class LoginResponse(
    // Access Token JWT (corta duración, ~15 minutos)
    val token: String,
    // Username del usuario autenticado
    val username: String,
    // Si el usuario ha verificado su email/teléfono
    @SerialName("is_verified")
    val isVerified: Boolean = false,
    // Si el usuario ha completado el KYC (Know Your Customer)
    @SerialName("kyc_verified")
    val kycVerified: Boolean = false,
    // Si el usuario necesita aceptar nuevos términos legales
    @SerialName("requires_terms_acceptance")
    val requiresTermsAcceptance: Boolean = false,
    // Lista de documentos legales pendientes de aceptar
    @SerialName("pending_documents")
    val pendingDocuments: List<String> = emptyList()
)

/**
 * Respuesta del endpoint POST /api/auth/refresh.
 * Mismo formato que LoginResponse porque devuelve un nuevo token.
 */
@Serializable
data class RefreshResponse(
    // Nuevo Access Token JWT
    val token: String,
    // Username (puede venir para re-sincronizar)
    val username: String? = null,
    // Estado de verificación actualizado
    @SerialName("is_verified")
    val isVerified: Boolean = false,
    // Estado de KYC actualizado
    @SerialName("kyc_verified")
    val kycVerified: Boolean = false,
    // Si necesita aceptar términos
    @SerialName("requires_terms_acceptance")
    val requiresTermsAcceptance: Boolean = false,
    // Documentos pendientes
    @SerialName("pending_documents")
    val pendingDocuments: List<String> = emptyList()
)

/**
 * Respuesta del endpoint GET /api/auth/status.
 * Informa el estado actual de la sesión del usuario.
 */
@Serializable
data class AuthStatusResponse(
    // Si el usuario está autenticado
    val isAuthenticated: Boolean = false,
    // Si el email/teléfono está verificado
    @SerialName("is_verified")
    val isVerified: Boolean = false,
    // Username del usuario
    val username: String? = null,
    // Si necesita aceptar términos
    @SerialName("requires_terms_acceptance")
    val requiresTermsAcceptance: Boolean = false,
    // Documentos pendientes
    @SerialName("pending_documents")
    val pendingDocuments: List<String> = emptyList()
)

/**
 * Respuesta genérica de error del backend.
 * Backend retorna: { "error": "Mensaje de error" }
 */
@Serializable
data class ErrorResponse(
    // Mensaje de error legible para el usuario
    val error: String? = null,
    // Mensaje alternativo (algunos endpoints usan "message" en vez de "error")
    val message: String? = null
)
