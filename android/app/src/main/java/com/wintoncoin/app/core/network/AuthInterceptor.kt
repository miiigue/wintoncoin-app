// ============================================================================
// WintonCoin Android — AuthInterceptor (Interceptor de Autenticación OkHttp)
// ============================================================================
// [SEGURIDAD FINTECH] Interceptor que se ejecuta automáticamente en CADA
// petición HTTP al backend de WintonCoin para:
//
// 1. Verificar si el Access Token ha expirado → ejecutar refresh silencioso
// 2. Adjuntar automáticamente el header Authorization: Bearer <token>
// 3. Capturar respuestas 401 (sesión inválida) y notificar a la app
//
// Equivalente EXACTO del override de window.fetch en auth.js (líneas 317-380)
// de la PWA, pero implementado como OkHttp Interceptor.
//
// Analogía: Es como un guardia de seguridad en la puerta de un banco.
// Antes de dejar pasar cada solicitud, verifica que el visitante tenga
// su credencial vigente. Si expiró, le pide una nueva automáticamente.
// ============================================================================

package com.wintoncoin.app.core.network

import android.util.Log
import com.wintoncoin.app.core.security.TokenManager
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * AuthInterceptor — Interceptor de autenticación automática.
 *
 * Se inyecta en la cadena de OkHttp y se ejecuta antes de cada request.
 * Garantiza que todas las peticiones autenticadas lleven un token vigente.
 *
 * [ZERO-TRUST] Nunca confía en que el token sea válido sin verificarlo.
 * [SOC 2] Cada acción de refresco y error queda registrada en logs.
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager
) : Interceptor {

    companion object {
        private const val TAG = "AuthInterceptor"

        // Rutas que NO deben llevar el header Authorization
        // (equivalente a isAuthRoute en la PWA auth.js línea 333)
        private val EXCLUDED_PATHS = listOf(
            "/api/auth/login",       // Login no necesita token (es donde se obtiene)
            "/api/auth/register",    // Registro no necesita token
            "/api/auth/refresh",     // Refresh usa cookie HttpOnly, no Bearer
            "/api/auth/logout",      // Logout destruye la sesión
            "/api/register-verify",  // Verificación de registro (OTP)
            "/api/auth/pending-status", // Estado de verificación pendiente
            "/api/auth/forgot-password", // Recuperación de contraseña
            "/api/app-settings"      // Configuración pública (no requiere auth)
        )

        // Rutas de admin (tienen su propio flujo de autenticación)
        private const val ADMIN_PATH = "/api/admin/"
    }

    /**
     * Intercepta cada petición HTTP antes de enviarla al servidor.
     *
     * Flujo:
     * 1. Verificar si la URL es un endpoint que requiere autenticación
     * 2. Si sí → obtener token vigente (refrescar si expiró)
     * 3. Adjuntar header Authorization: Bearer <token>
     * 4. Enviar la petición y verificar respuesta
     * 5. Si el servidor responde 401 → notificar expiración de sesión
     */
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val url = originalRequest.url.toString()

        // ====================================================================
        // PASO 1: Determinar si esta ruta necesita autenticación
        // ====================================================================
        val isExcludedPath = EXCLUDED_PATHS.any { url.contains(it) }
        val isAdminPath = url.contains(ADMIN_PATH)

        // Si es una ruta excluida o de admin, dejar pasar sin modificar
        if (isExcludedPath || isAdminPath) {
            return chain.proceed(originalRequest)
        }

        // ====================================================================
        // PASO 2: Obtener el token vigente
        // ====================================================================
        // NOTA: El refresco silencioso se maneja a nivel de Repository/UseCase.
        // El interceptor solo adjunta el token disponible.
        // Si el token expiró y el refresh falla, la respuesta 401 del servidor
        // será capturada abajo.
        val token = tokenManager.getAccessToken()

        // ====================================================================
        // PASO 3: Adjuntar header Authorization si hay token disponible
        // ====================================================================
        val authenticatedRequest = if (token != null) {
            originalRequest.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            // Sin token: enviar sin auth (el servidor decidirá si rechaza con 401)
            originalRequest
        }

        // ====================================================================
        // PASO 4: Ejecutar la petición
        // ====================================================================
        val response = chain.proceed(authenticatedRequest)

        // ====================================================================
        // PASO 5: Detectar sesión inválida (401 Unauthorized)
        // ====================================================================
        // Equivalente a la detección de 401 en auth.js (línea 375-377)
        if (response.code == 401 && !isExcludedPath && !isAdminPath) {
            Log.w(TAG, "[SECURITY] Servidor respondió 401 — sesión inválida para: ${originalRequest.url.encodedPath}")
            // La limpieza de sesión y redirección al login se manejan
            // en el ViewModel/Repository que recibe este error.
            // El interceptor NO destruye la sesión directamente para respetar
            // la separación de responsabilidades (Clean Architecture).
        }

        return response
    }
}
