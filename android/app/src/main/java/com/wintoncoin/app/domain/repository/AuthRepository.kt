// ============================================================================
// WintonCoin Android — AuthRepository Interface (Contrato de Dominio)
// ============================================================================
// Define las operaciones de autenticación que la capa de presentación
// puede solicitar, sin conocer los detalles de implementación (Retrofit, etc.)
//
// Principio de Inversión de Dependencias (SOLID - D):
// Las capas superiores dependen de esta ABSTRACCIÓN, no de la implementación.
// ============================================================================

package com.wintoncoin.app.domain.repository

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.UserSession

/**
 * AuthRepository — Contrato de operaciones de autenticación.
 *
 * La capa de presentación (ViewModels) solo conoce esta interfaz.
 * La implementación concreta (AuthRepositoryImpl) es inyectada por Hilt.
 */
interface AuthRepository {

    /**
     * Inicia sesión con credenciales.
     * @param username Nombre de usuario
     * @param password Contraseña
     * @return Result con UserSession si éxito, o Error si falla
     */
    suspend fun login(username: String, password: String): Result<UserSession>

    /**
     * Refresca el Access Token silenciosamente.
     * @return Result con el nuevo token si éxito, o Error si falla
     */
    suspend fun refreshToken(): Result<String>

    /**
     * Cierra la sesión del usuario (destruye token local + cookie en servidor).
     */
    suspend fun logout()

    /**
     * Verifica si hay una sesión activa guardada localmente.
     * @return true si hay credenciales almacenadas
     */
    fun hasActiveSession(): Boolean

    /**
     * Verifica si el token actual ha expirado.
     * @return true si el token expiró o no existe
     */
    fun isTokenExpired(): Boolean
}
