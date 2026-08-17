// ============================================================================
// WintonCoin Android — MarketplaceApiService (Interfaz Retrofit de Marketplace)
// ============================================================================
// [DATA LAYER / NETWORK] Contrato de endpoints para el feed del Marketplace,
// Causas Humanitarias y acciones de postulación / culminación / pago de tareas.
// ============================================================================

package com.wintoncoin.app.data.remote.api

import com.wintoncoin.app.data.remote.dto.AcceptPublicationRequest
import com.wintoncoin.app.data.remote.dto.CompleteTaskRequest
import com.wintoncoin.app.data.remote.dto.ConfirmPaymentRequest
import com.wintoncoin.app.data.remote.dto.HumanitarianCausesResponseDto
import com.wintoncoin.app.data.remote.dto.MarketplaceActionResponseDto
import com.wintoncoin.app.data.remote.dto.PublicationDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface MarketplaceApiService {

    /**
     * Obtiene el listado de publicaciones activas para el usuario autenticado.
     */
    @GET("publications/active")
    suspend fun getActivePublications(
        @Query("user") username: String,
        @Query("search") search: String? = null,
        @Query("filter") filter: String? = null
    ): Response<List<PublicationDto>>

    /**
     * Obtiene las causas humanitarias aprobadas (Winton Solidario).
     */
    @GET("api/humanitarian/causes/approved")
    suspend fun getApprovedCauses(): Response<HumanitarianCausesResponseDto>

    /**
     * Obtiene el detalle completo de una publicación específica.
     */
    @GET("api/publications/{id}")
    suspend fun getPublicationDetails(
        @Path("id") id: String,
        @Query("user") username: String? = null
    ): Response<PublicationDto>

    /**
     * Postularse / Aceptar una publicación o realizar donación.
     */
    @POST("publications/{id}/accept")
    suspend fun acceptPublication(
        @Path("id") id: String,
        @Body body: AcceptPublicationRequest
    ): Response<MarketplaceActionResponseDto>

    /**
     * Culminar una tarea entregando las respuestas o evidencias fotográficas.
     */
    @POST("publications/{id}/complete")
    suspend fun completeTask(
        @Path("id") id: String,
        @Body body: CompleteTaskRequest
    ): Response<MarketplaceActionResponseDto>

    /**
     * Confirmar el pago de una tarea completada y liberar fondos al trabajador.
     */
    @POST("publications/{id}/confirm-payment")
    suspend fun confirmPayment(
        @Path("id") id: String,
        @Body body: ConfirmPaymentRequest
    ): Response<MarketplaceActionResponseDto>
}
