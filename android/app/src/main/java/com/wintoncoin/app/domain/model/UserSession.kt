// ============================================================================
// WintonCoin Android — UserSession (Modelo de Dominio de Sesión)
// ============================================================================
// Representa el estado de la sesión del usuario autenticado.
// Equivalente exacto del objeto userSession en auth.js de la PWA.
// ============================================================================

package com.wintoncoin.app.domain.model

/**
 * UserSession — Estado de la sesión del usuario.
 *
 * Equivalente PWA (auth.js líneas 11-17):
 *   export const userSession = {
 *       isAuthenticated: false,
 *       is_verified: false,
 *       username: null,
 *       requires_terms_acceptance: false,
 *       pending_documents: []
 *   };
 */
data class UserSession(
    // Si el usuario está autenticado
    val isAuthenticated: Boolean = false,
    // Si el email/teléfono están verificados
    val isVerified: Boolean = false,
    // Nombre de usuario
    val username: String? = null,
    // Si necesita aceptar nuevos términos legales antes de operar
    val requiresTermsAcceptance: Boolean = false,
    // Lista de documentos legales pendientes de aceptar
    val pendingDocuments: List<String> = emptyList()
)
