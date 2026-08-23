// ============================================================================
// WintonCoin Android — BoosterApiService (Interfaz Retrofit para Impulsores)
// ============================================================================
// [DATA LAYER / NETWORK] Define los contratos de endpoints para el Perfil
// de Impulsores (Booster), Sistema de Rangos y Red de Referidos.
// ============================================================================

package com.wintoncoin.app.data.remote.api

import com.wintoncoin.app.data.remote.dto.BoosterProfileDto
import com.wintoncoin.app.data.remote.dto.ReferralInfoResponseDto
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path

interface BoosterApiService {

    /**
     * Consulta el perfil de impulsor del usuario autenticado actual.
     */
    @GET("api/me/booster-profile")
    suspend fun getMyBoosterProfile(): Response<BoosterProfileDto>

    /**
     * Consulta el perfil de impulsor público de cualquier usuario por username.
     */
    @GET("api/users/{username}/booster-profile")
    suspend fun getUserBoosterProfile(
        @Path("username") username: String
    ): Response<BoosterProfileDto>

    /**
     * Consulta la información de referidos (código único y miembros referidos).
     */
    @GET("api/users/{username}/referral-info")
    suspend fun getReferralInfo(
        @Path("username") username: String
    ): Response<ReferralInfoResponseDto>
}
