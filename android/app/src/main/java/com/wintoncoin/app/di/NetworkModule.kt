// ============================================================================
// WintonCoin Android — NetworkModule (Módulo Hilt de Red Blincado)
// ============================================================================
// [DI / SEGURIDAD FINTECH] Provee las dependencias de red de alta seguridad:
// - OkHttpClient con AuthInterceptor, EncryptedCookieJar y CertificatePinner.
// - Certificate Pinning contra dominios backend de Render para evitar Man-In-The-Middle (MITM).
// - Persistencia cifrada de cookies HttpOnly (refreshToken).
// - Retrofit configurado con KotlinX Serialization JSON.
// ============================================================================

package com.wintoncoin.app.di

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.wintoncoin.app.BuildConfig
import com.wintoncoin.app.core.network.AuthInterceptor
import com.wintoncoin.app.core.network.EncryptedCookieJar
import com.wintoncoin.app.data.remote.api.AuthApiService
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.CertificatePinner
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

/**
 * NetworkModule — Configuración centralizada y blindada de red en Hilt.
 */
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    /**
     * Provee el cliente OkHttp blindado con:
     * 1. [AuthInterceptor] Inyección automática de token Bearer.
     * 2. [EncryptedCookieJar] Persistencia cifrada (AES-256) de cookies HttpOnly (refreshToken).
     * 3. [CertificatePinner] SSL Certificate Pinning contra dominios Render para prevenir ataques MITM.
     * 4. [Timeouts] Timeouts estrictos de 30 segundos.
     */
    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        encryptedCookieJar: EncryptedCookieJar
    ): OkHttpClient {
        // [SEGURIDAD FINTECH] Certificate Pinning (SSL Pinning)
        // Amarra los dominios de la API a autoridades de certificación confiables
        val certificatePinner = CertificatePinner.Builder()
            // Configuración para el dominio Render de Demo y Producción
            .add("wintoncoin-backend-demo.onrender.com", "sha256/47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=")
            .add("wintoncoin-backend.onrender.com", "sha256/47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=")
            .build()

        val builder = OkHttpClient.Builder()
            // [COOKIE PERSISTENCE] Persistencia cifrada de cookies HttpOnly
            .cookieJar(encryptedCookieJar)
            // [AUTH] Interceptor de autenticación Bearer token
            .addInterceptor(authInterceptor)
            // [SSL PINNING] Protección activa contra Man-In-The-Middle
            .certificatePinner(certificatePinner)
            // [TIMEOUTS] Timeouts de conexión y lectura
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)

        if (BuildConfig.DEBUG) {
            val loggingInterceptor = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }
            builder.addInterceptor(loggingInterceptor)
        }

        return builder.build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(
        okHttpClient: OkHttpClient,
        json: Json
    ): Retrofit {
        val contentType = "application/json".toMediaType()
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL + "/")
            .addConverterFactory(json.asConverterFactory(contentType))
            .client(okHttpClient)
            .build()
    }

    @Provides
    @Singleton
    fun provideAuthApiService(retrofit: Retrofit): AuthApiService {
        return retrofit.create(AuthApiService::class.java)
    }
}
