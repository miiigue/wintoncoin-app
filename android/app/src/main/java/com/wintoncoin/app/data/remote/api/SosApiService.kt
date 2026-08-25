// ============================================================================
// WintonCoin Android — SosApiService
// ============================================================================
// [DATA LAYER / RETROFIT API] Definición de endpoints HTTP para el portal
// SOS Venezuela, registro de damnificados, registro de voluntarios y activación OTP.
// ============================================================================

package com.wintoncoin.app.data.remote.api

import com.wintoncoin.app.data.remote.dto.RegisterVictimRequestDto
import com.wintoncoin.app.data.remote.dto.RegisterVictimResponseDto
import com.wintoncoin.app.data.remote.dto.RegisterVolunteerRequestDto
import com.wintoncoin.app.data.remote.dto.RegisterVolunteerResponseDto
import com.wintoncoin.app.data.remote.dto.ResendSosOtpRequestDto
import com.wintoncoin.app.data.remote.dto.ResendSosOtpResponseDto
import com.wintoncoin.app.data.remote.dto.SosCampaignSettingsDto
import com.wintoncoin.app.data.remote.dto.VerifySosOtpRequestDto
import com.wintoncoin.app.data.remote.dto.VerifySosOtpResponseDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * Servicio Retrofit para las operaciones de SOS Venezuela y Brigadas de Voluntarios.
 */
interface SosApiService {

    // ── DAMNIFICADOS (AFECTADOS / CENSO DE EMERGENCIA) ───────────────────────

    @POST("api/public/sos-venezuela/register")
    suspend fun registerVictim(
        @Body request: RegisterVictimRequestDto
    ): Response<RegisterVictimResponseDto>

    @POST("api/public/sos-venezuela/verify-otp")
    suspend fun verifyVictimOtp(
        @Body request: VerifySosOtpRequestDto
    ): Response<VerifySosOtpResponseDto>

    @POST("api/public/sos-venezuela/resend-otp")
    suspend fun resendVictimOtp(
        @Body request: ResendSosOtpRequestDto
    ): Response<ResendSosOtpResponseDto>

    // ── VOLUNTARIOS SOS (BRIGADAS DE AUXILIO) ────────────────────────────────

    @POST("api/volunteers/register")
    suspend fun registerVolunteer(
        @Body request: RegisterVolunteerRequestDto
    ): Response<RegisterVolunteerResponseDto>

    @POST("api/volunteers/verify-otp")
    suspend fun verifyVolunteerOtp(
        @Body request: VerifySosOtpRequestDto
    ): Response<VerifySosOtpResponseDto>

    @POST("api/volunteers/resend-otp")
    suspend fun resendVolunteerOtp(
        @Body request: ResendSosOtpRequestDto
    ): Response<ResendSosOtpResponseDto>

    // ── CONFIGURACIÓN DE CAMPAÑA Y CÓDIGO DINÁMICO ──────────────────────────

    @GET("api/referral-settings")
    suspend fun getCampaignSettings(): Response<SosCampaignSettingsDto>
}
