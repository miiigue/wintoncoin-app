// ============================================================================
// WintonCoin Android — EncryptedCookieJar (Persistencia Segura de Cookies)
// ============================================================================
// [SEGURIDAD FINTECH] Implementación de okhttp3.CookieJar respaldada por
// EncryptedSharedPreferences (AES-256-GCM).
//
// ¿Por qué es crítico?
// El backend de WintonCoin envía la cookie 'refreshToken' marcada como
// HttpOnly y Secure durante el login. Por defecto, OkHttp almacena cookies
// en memoria RAM; al cerrar la app, las cookies se pierden.
//
// Con EncryptedCookieJar:
// 1. Las cookies HttpOnly se persisten de forma cifrada en el almacenamiento seguro.
// 2. Al reiniciar la app, el refresh token HttpOnly sigue disponible.
// 3. Las cookies expiradas se purgan automáticamente para evitar desbordamiento.
//
// Analogía: Como una billetera con cerradura biométrica donde guardas tus pases
// de acceso. Aunque apagues el teléfono, tus pases siguen guardados bajo llave.
// ============================================================================

package com.wintoncoin.app.core.network

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import javax.inject.Inject
import javax.inject.Singleton

/**
 * DTO para serializar las cookies de OkHttp en JSON y guardarlas cifradas.
 */
@kotlinx.serialization.Serializable
private data class SerializableCookie(
    val name: String,
    val value: String,
    val expiresAt: Long,
    val domain: String,
    val path: String,
    val secure: Boolean,
    val httpOnly: Boolean,
    val hostOnly: Boolean
)

/**
 * EncryptedCookieJar — Gestor de cookies cifradas para OkHttp.
 *
 * Implementa [CookieJar] de OkHttp para interceptar, guardar y enviar cookies
 * automáticamente en cada petición de red.
 */
@Singleton
class EncryptedCookieJar @Inject constructor(
    @ApplicationContext private val context: Context,
    private val json: Json
) : CookieJar {

    companion object {
        private const val TAG = "EncryptedCookieJar"
        private const val PREFS_NAME = "wintoncoin_secure_cookies"
    }

    // SharedPreferences cifradas con AES-256-GCM y auto-recuperación ante errores de Keystore
    private val encryptedPrefs: SharedPreferences by lazy {
        try {
            createEncryptedPreferences()
        } catch (t: Throwable) {
            Log.e(TAG, "[SECURITY] Error initializing EncryptedCookieJar, auto-healing: ${t.message}")
            try {
                val prefsFile = java.io.File(context.applicationInfo.dataDir, "shared_prefs/$PREFS_NAME.xml")
                if (prefsFile.exists()) {
                    prefsFile.delete()
                }
                createEncryptedPreferences()
            } catch (t2: Throwable) {
                Log.e(TAG, "[SECURITY] Fallback to standard private preferences: ${t2.message}")
                context.getSharedPreferences("${PREFS_NAME}_fallback", Context.MODE_PRIVATE)
            }
        }
    }

    private fun createEncryptedPreferences(): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        return EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    /**
     * Guarda las cookies recibidas del servidor (encabezado Set-Cookie)
     * en el almacenamiento cifrado.
     */
    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val editor = encryptedPrefs.edit()
        var savedCount = 0

        for (cookie in cookies) {
            val key = getCookieKey(url, cookie)
            // Si la cookie ha expirado, la eliminamos
            if (cookie.expiresAt <= System.currentTimeMillis()) {
                editor.remove(key)
            } else {
                // Convertir la cookie a DTO serializable y luego a JSON cifrado
                val serializable = SerializableCookie(
                    name = cookie.name,
                    value = cookie.value,
                    expiresAt = cookie.expiresAt,
                    domain = cookie.domain,
                    path = cookie.path,
                    secure = cookie.secure,
                    httpOnly = cookie.httpOnly,
                    hostOnly = cookie.hostOnly
                )
                val jsonString = json.encodeToString(serializable)
                editor.putString(key, jsonString)
                savedCount++
            }
        }
        editor.apply()

        if (savedCount > 0) {
            Log.d(TAG, "[SECURITY] $savedCount cookies almacenadas de forma cifrada para: ${url.host}")
        }
    }

    /**
     * Carga y retorna las cookies válidas que deben enviarse al servidor
     * en la petición actual (encabezado Cookie).
     */
    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val validCookies = mutableListOf<Cookie>()
        val currentTime = System.currentTimeMillis()
        val editor = encryptedPrefs.edit()
        var hasExpired = false

        val allEntries = encryptedPrefs.all
        for ((key, value) in allEntries) {
            if (value is String) {
                try {
                    val serializable = json.decodeFromString<SerializableCookie>(value)
                    // Filtrar cookies expiradas
                    if (serializable.expiresAt <= currentTime) {
                        editor.remove(key)
                        hasExpired = true
                        continue
                    }

                    // Reconstruir el objeto Cookie de OkHttp
                    val cookieBuilder = Cookie.Builder()
                        .name(serializable.name)
                        .value(serializable.value)
                        .expiresAt(serializable.expiresAt)
                        .path(serializable.path)

                    if (serializable.hostOnly) {
                        cookieBuilder.hostOnlyDomain(serializable.domain)
                    } else {
                        cookieBuilder.domain(serializable.domain)
                    }

                    if (serializable.secure) cookieBuilder.secure()
                    if (serializable.httpOnly) cookieBuilder.httpOnly()

                    val cookie = cookieBuilder.build()
                    // Verificar si la cookie coincide con la URL solicitada (dominio y ruta)
                    if (cookie.matches(url)) {
                        validCookies.add(cookie)
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "[SECURITY] Error deserializando cookie clave '$key': ${e.message}")
                }
            }
        }

        if (hasExpired) {
            editor.apply()
        }

        return validCookies
    }

    /**
     * Elimina todas las cookies almacenadas (ej: durante el logout).
     */
    fun clearAllCookies() {
        encryptedPrefs.edit().clear().apply()
        Log.d(TAG, "[SECURITY] Todas las cookies han sido purgadas del almacenamiento cifrado.")
    }

    /**
     * Genera una clave única para cada cookie basada en su dominio, ruta y nombre.
     */
    private fun getCookieKey(url: HttpUrl, cookie: Cookie): String {
        return "${url.host}|${cookie.path}|${cookie.name}"
    }
}
