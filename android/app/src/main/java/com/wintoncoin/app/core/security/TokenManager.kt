// ============================================================================
// WintonCoin Android — TokenManager (Almacenamiento Seguro de Credenciales)
// ============================================================================
// [SEGURIDAD FINTECH] Gestiona el almacenamiento cifrado de tokens JWT
// usando EncryptedSharedPreferences con AES-256-GCM.
//
// Analogía: Es como una caja fuerte digital dentro del teléfono.
// Aunque alguien extraiga los archivos del dispositivo, no podrá leer
// los tokens porque están cifrados con la clave maestra del hardware.
//
// Equivalente PWA: localStorage.getItem('token') / localStorage.setItem('token')
// Pero MUCHO más seguro porque en la PWA localStorage es texto plano.
// ============================================================================

package com.wintoncoin.app.core.security

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * TokenManager — Almacenamiento cifrado de credenciales de sesión.
 *
 * Responsabilidades:
 * 1. Guardar/leer el Access Token JWT (corta duración, ~15min)
 * 2. Guardar/leer el username del usuario autenticado
 * 3. Limpiar todas las credenciales al cerrar sesión
 * 4. Verificar si el token ha expirado decodificando el payload JWT
 *
 * [ZERO-TRUST] Nunca se confía en el token sin verificar su expiración.
 * [SOC 2] Todas las operaciones de escritura/borrado generan log de auditoría.
 */
@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        // Tag para logging auditable
        private const val TAG = "TokenManager"

        // Nombre del archivo de preferencias cifradas
        private const val PREFS_NAME = "wintoncoin_secure_prefs"

        // Claves de almacenamiento (nombres descriptivos para auditoría)
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_USERNAME = "username"

        // Margen de seguridad: considerar expirado si le quedan menos de 30 segundos
        // (mismo valor que usa la PWA en auth.js línea 31)
        private const val EXPIRATION_MARGIN_MS = 30_000L
    }

    // ========================================================================
    // ENCRYPTED SHARED PREFERENCES
    // ========================================================================
    // Se inicializa de forma lazy (solo cuando se necesita por primera vez)
    // para no bloquear el inicio de la app.
    // ========================================================================
    private val encryptedPrefs: SharedPreferences by lazy {
        // MasterKey: Clave maestra derivada del hardware del dispositivo (TEE/Strongbox)
        // Cada dispositivo genera una clave única — si el archivo se copia a otro
        // dispositivo, no se podrá descifrar.
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM) // AES-256 en modo GCM
            .build()

        // EncryptedSharedPreferences: Envuelve SharedPreferences con cifrado
        // automático de claves (AES-256-SIV) y valores (AES-256-GCM)
        EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    // ========================================================================
    // ACCESS TOKEN
    // ========================================================================

    /**
     * Guarda el Access Token JWT en almacenamiento cifrado.
     * @param token Token JWT recibido del backend tras login o refresh.
     */
    fun saveAccessToken(token: String) {
        encryptedPrefs.edit().putString(KEY_ACCESS_TOKEN, token).apply()
        Log.d(TAG, "[AUDIT] Access token almacenado de forma segura.")
    }

    /**
     * Obtiene el Access Token JWT almacenado.
     * @return Token JWT o null si no hay sesión activa.
     */
    fun getAccessToken(): String? {
        return encryptedPrefs.getString(KEY_ACCESS_TOKEN, null)
    }

    // ========================================================================
    // USERNAME
    // ========================================================================

    /**
     * Guarda el username del usuario autenticado.
     * @param username Nombre de usuario (ej: "miguel123")
     */
    fun saveUsername(username: String) {
        encryptedPrefs.edit().putString(KEY_USERNAME, username).apply()
        Log.d(TAG, "[AUDIT] Username almacenado de forma segura.")
    }

    /**
     * Obtiene el username del usuario autenticado.
     * @return Username o null si no hay sesión.
     */
    fun getUsername(): String? {
        return encryptedPrefs.getString(KEY_USERNAME, null)
    }

    // ========================================================================
    // VERIFICACIÓN DE EXPIRACIÓN
    // ========================================================================

    /**
     * Verifica si el Access Token ha expirado o está por expirar.
     *
     * Decodifica el payload del JWT (parte 2 separada por '.') y extrae
     * el campo 'exp' (timestamp de expiración en segundos Unix).
     *
     * Equivalente exacto de isTokenExpired() en la PWA (auth.js línea 25-35).
     *
     * @return true si el token expiró, es inválido o le quedan menos de 30 seg.
     */
    fun isTokenExpired(): Boolean {
        val token = getAccessToken() ?: return true // Sin token = expirado

        return try {
            // El JWT tiene 3 partes separadas por '.': header.payload.signature
            val parts = token.split(".")
            if (parts.size != 3) return true // Token malformado

            // Decodificar el payload (Base64URL → JSON)
            val payload = String(
                android.util.Base64.decode(parts[1], android.util.Base64.URL_SAFE),
                Charsets.UTF_8
            )

            // Extraer el campo "exp" del JSON del payload
            // Usamos regex simple para evitar dependencia extra de JSON parsing aquí
            val expRegex = """"exp"\s*:\s*(\d+)""".toRegex()
            val match = expRegex.find(payload)
            val expSeconds = match?.groupValues?.get(1)?.toLongOrNull() ?: return true

            // Convertir a milisegundos y comparar con el tiempo actual + margen
            val expMillis = expSeconds * 1000
            val isExpired = expMillis < System.currentTimeMillis() + EXPIRATION_MARGIN_MS

            if (isExpired) {
                Log.d(TAG, "[SECURITY] Token expirado o por expirar (margen: ${EXPIRATION_MARGIN_MS}ms)")
            }

            isExpired
        } catch (e: Exception) {
            // Cualquier error al decodificar = token inválido = expirado
            Log.w(TAG, "[SECURITY] Error al verificar expiración del token: ${e.message}")
            true
        }
    }

    // ========================================================================
    // GESTIÓN DE SESIÓN
    // ========================================================================

    /**
     * Verifica si hay una sesión activa (usuario previamente logueado).
     * No verifica si el token sigue vigente, solo si existe.
     */
    fun hasSession(): Boolean {
        return getUsername() != null
    }

    /**
     * Limpia todas las credenciales almacenadas.
     * Se llama al cerrar sesión (logout) o cuando el servidor invalida la sesión (401).
     *
     * Equivalente PWA:
     *   localStorage.removeItem('token');
     *   localStorage.removeItem('username');
     */
    fun clearSession() {
        encryptedPrefs.edit().clear().apply()
        Log.d(TAG, "[AUDIT] Sesión destruida — todas las credenciales eliminadas del almacenamiento seguro.")
    }
}
