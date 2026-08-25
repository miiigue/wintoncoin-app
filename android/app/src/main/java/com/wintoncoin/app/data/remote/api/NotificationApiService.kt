// ============================================================================
// WintonCoin Android — NotificationApiService
// ============================================================================
// [DATA LAYER / RETROFIT] Endpoints seguros para el módulo de notificaciones.
// ============================================================================

package com.wintoncoin.app.data.remote.api

import com.wintoncoin.app.data.remote.dto.NotificationDismissResponseDto
import com.wintoncoin.app.data.remote.dto.NotificationDto
import com.wintoncoin.app.data.remote.dto.NotificationMarkReadResponseDto
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface NotificationApiService {

    /**
     * Obtiene la lista de notificaciones no leídas del usuario autenticado.
     */
    @GET("/api/me/notifications")
    suspend fun getUnreadNotifications(): Response<List<NotificationDto>>

    /**
     * Obtiene el historial completo de notificaciones (hasta 50).
     */
    @GET("/api/me/notifications/history")
    suspend fun getNotificationsHistory(): Response<List<NotificationDto>>

    /**
     * Marca todas las notificaciones pendientes como leídas.
     */
    @POST("/api/me/notifications/mark-read")
    suspend fun markAllAsRead(): Response<NotificationMarkReadResponseDto>

    /**
     * Descarta / marca como leída una notificación individual por su ID.
     */
    @POST("/api/me/notifications/{id}/dismiss")
    suspend fun dismissNotification(@Path("id") id: Int): Response<NotificationDismissResponseDto>
}
