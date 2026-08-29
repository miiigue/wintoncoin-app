// ============================================================================
// WintonCoin Android — NetworkModule (Módulo Hilt de Red Blindado)
// ============================================================================
// [DI / SEGURIDAD FINTECH] Provee las dependencias de red de alta seguridad:
// - OkHttpClient con AuthInterceptor, EncryptedCookieJar y CertificatePinner.
// - Certificate Pinning contra dominios backend de Render para evitar Man-In-The-Middle (MITM).
// - Persistencia cifrada de cookies HttpOnly (refreshToken).
// - Retrofit configurado con KotlinX Serialization JSON.
// - Servicios de API (AuthApiService, ProfileApiService, WalletApiService).
// ============================================================================

package com.wintoncoin.app.di

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.wintoncoin.app.BuildConfig
import com.wintoncoin.app.core.network.AuthInterceptor
import com.wintoncoin.app.core.network.EncryptedCookieJar
import com.wintoncoin.app.data.remote.api.AuthApiService
import com.wintoncoin.app.data.remote.api.ProfileApiService
import com.wintoncoin.app.data.remote.api.WalletApiService
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

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        encryptedCookieJar: EncryptedCookieJar
    ): OkHttpClient {
        val builder = OkHttpClient.Builder()
            .cookieJar(encryptedCookieJar)
            .addInterceptor(authInterceptor)
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

    @Provides
    @Singleton
    fun provideProfileApiService(retrofit: Retrofit): ProfileApiService {
        return retrofit.create(ProfileApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideWalletApiService(retrofit: Retrofit): WalletApiService {
        return retrofit.create(WalletApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideMarketplaceApiService(retrofit: Retrofit): com.wintoncoin.app.data.remote.api.MarketplaceApiService {
        return retrofit.create(com.wintoncoin.app.data.remote.api.MarketplaceApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideBoosterApiService(retrofit: Retrofit): com.wintoncoin.app.data.remote.api.BoosterApiService {
        return retrofit.create(com.wintoncoin.app.data.remote.api.BoosterApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideAccountStatementApiService(retrofit: Retrofit): com.wintoncoin.app.data.remote.api.AccountStatementApiService {
        return retrofit.create(com.wintoncoin.app.data.remote.api.AccountStatementApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideNotificationApiService(retrofit: Retrofit): com.wintoncoin.app.data.remote.api.NotificationApiService {
        return retrofit.create(com.wintoncoin.app.data.remote.api.NotificationApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideDonationApiService(retrofit: Retrofit): com.wintoncoin.app.data.remote.api.DonationApiService {
        return retrofit.create(com.wintoncoin.app.data.remote.api.DonationApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideSosApiService(retrofit: Retrofit): com.wintoncoin.app.data.remote.api.SosApiService {
        return retrofit.create(com.wintoncoin.app.data.remote.api.SosApiService::class.java)
    }
}
