// ============================================================================
// WintonCoin Android — DonationApiService
// ============================================================================
// [DATA LAYER / RETROFIT] Endpoints para WintonCoin Solidario y Causas Comunitarias.
// ============================================================================

package com.wintoncoin.app.data.remote.api

import com.wintoncoin.app.data.remote.dto.CauseDetailResponseDto
import com.wintoncoin.app.data.remote.dto.CauseDonationsResponseDto
import com.wintoncoin.app.data.remote.dto.CauseUpdatesResponseDto
import com.wintoncoin.app.data.remote.dto.CausesResponseDto
import com.wintoncoin.app.data.remote.dto.DonateRequestDto
import com.wintoncoin.app.data.remote.dto.DonateResponseDto
import com.wintoncoin.app.data.remote.dto.GenericActionResponseDto
import com.wintoncoin.app.data.remote.dto.SubmitCauseRequestDto
import com.wintoncoin.app.data.remote.dto.SubmitCauseResponseDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface DonationApiService {

    /**
     * Obtiene la lista de causas humanitarias aprobadas (activas para donación).
     */
    @GET("/api/humanitarian/causes/approved")
    suspend fun getApprovedCauses(): Response<CausesResponseDto>

    /**
     * Obtiene las causas creadas / postuladas por el usuario autenticado.
     */
    @GET("/api/humanitarian/causes/my")
    suspend fun getMyCauses(): Response<CausesResponseDto>

    /**
     * Obtiene el detalle completo de una causa por su ID.
     */
    @GET("/api/humanitarian/causes/{id}")
    suspend fun getCauseDetail(@Path("id") id: Int): Response<CauseDetailResponseDto>

    /**
     * Obtiene el historial de donaciones agrupado de una causa específica.
     */
    @GET("/api/humanitarian/causes/{id}/donations")
    suspend fun getCauseDonations(@Path("id") id: Int): Response<CauseDonationsResponseDto>

    /**
     * Obtiene las actualizaciones / novedades publicadas en una causa.
     */
    @GET("/api/humanitarian/causes/{id}/updates")
    suspend fun getCauseUpdates(@Path("id") id: Int): Response<CauseUpdatesResponseDto>

    /**
     * Postula una nueva causa solidaria para auditoría del equipo de WintonCoin.
     */
    @POST("/api/humanitarian/causes")
    suspend fun submitCause(@Body request: SubmitCauseRequestDto): Response<SubmitCauseResponseDto>

    /**
     * Realiza una donación de tokens BLUE IOU hacia una causa solidaria.
     */
    @POST("/api/humanitarian/causes/{id}/donate")
    suspend fun donateToCause(
        @Path("id") id: Int,
        @Body request: DonateRequestDto
    ): Response<DonateResponseDto>

    /**
     * Cancela o culmina una causa propia en estado pendiente o aprobado.
     */
    @POST("/api/humanitarian/causes/{id}/cancel")
    suspend fun cancelCause(@Path("id") id: Int): Response<GenericActionResponseDto>
}
