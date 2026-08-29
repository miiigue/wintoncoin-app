// ============================================================================
// WintonCoin Android — NotificationRepositoryImpl
// ============================================================================
// [DATA LAYER / REPOSITORY IMPL] Implementación concreta que mapea DTOs de red
// a entidades de dominio con categorización inteligente y formato de fechas.
// ============================================================================

package com.wintoncoin.app.data.repository

import com.wintoncoin.app.data.remote.api.NotificationApiService
import com.wintoncoin.app.data.remote.dto.NotificationDto
import com.wintoncoin.app.domain.model.NotificationCategory
import com.wintoncoin.app.domain.model.NotificationItem
import com.wintoncoin.app.domain.model.NotificationNavigationTarget
import com.wintoncoin.app.domain.repository.NotificationRepository
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NotificationRepositoryImpl @Inject constructor(
    private val apiService: NotificationApiService
) : NotificationRepository {

    override suspend fun getUnreadNotifications(): Result<List<NotificationItem>> {
        return try {
            val response = apiService.getUnreadNotifications()
            if (response.isSuccessful && response.body() != null) {
                val items = response.body()!!.map { it.toDomain() }
                Result.success(items)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al obtener notificaciones no leídas."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getNotificationsHistory(): Result<List<NotificationItem>> {
        return try {
            val response = apiService.getNotificationsHistory()
            if (response.isSuccessful && response.body() != null) {
                val items = response.body()!!.map { it.toDomain() }
                Result.success(items)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al obtener historial de notificaciones."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun markAllAsRead(): Result<Int> {
        return try {
            val response = apiService.markAllAsRead()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.count)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al marcar notificaciones como leídas."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun dismissNotification(id: Int): Result<Unit> {
        return try {
            val response = apiService.dismissNotification(id)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al descartar notificación."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun NotificationDto.toDomain(): NotificationItem {
        val (category, target, emoji) = categorizeNotification(this.message)
        val formatted = formatNotificationDate(this.createdAt)

        return NotificationItem(
            id = this.id,
            message = this.message,
            isRead = this.isRead,
            createdAt = this.createdAt ?: "",
            category = category,
            navigationTarget = target,
            iconEmoji = emoji,
            formattedDate = formatted
        )
    }

    companion object {
        fun categorizeNotification(message: String): Triple<NotificationCategory, NotificationNavigationTarget, String> {
            val lower = message.lowercase()
            return when {
                lower.contains("acumulado") || lower.contains("ganado") || lower.contains("bono") ||
                lower.contains("perfil de impulsor") || lower.contains("blue iou") -> {
                    Triple(NotificationCategory.REWARD_TASK, NotificationNavigationTarget.BOOSTER_PROFILE, "💰")
                }
                lower.contains("aprobado") || lower.contains("aprobada") || lower.contains("has sido aprobado") ||
                lower.contains("🎉") || lower.contains("✅") -> {
                    Triple(NotificationCategory.APPROVAL, NotificationNavigationTarget.BOOSTER_PROFILE, "🎉")
                }
                lower.contains("transferido") || lower.contains("recibido") || lower.contains("transferencia") ||
                lower.contains("pago") || lower.contains("donación") -> {
                    Triple(NotificationCategory.TRANSFER, NotificationNavigationTarget.WALLET, "💸")
                }
                lower.contains("quiere participar") || lower.contains("solicitud") || lower.contains("postulación") ||
                lower.contains("📩") -> {
                    Triple(NotificationCategory.REQUEST, NotificationNavigationTarget.PUBLICATIONS, "📩")
                }
                lower.contains("quema") || lower.contains("compromiso") || lower.contains("vencido") ||
                lower.contains("deuda") || lower.contains("alerta") || lower.contains("⚠️") -> {
                    Triple(NotificationCategory.SECURITY_WARNING, NotificationNavigationTarget.ACCOUNT_STATEMENT, "⚠️")
                }
                else -> {
                    Triple(NotificationCategory.GENERAL_INFO, NotificationNavigationTarget.NONE, "🔔")
                }
            }
        }

        fun formatNotificationDate(isoString: String?): String {
            if (isoString.isNullOrBlank()) return "Reciente"
            return try {
                val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                val fallbackFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                val date = try {
                    inputFormat.parse(isoString)
                } catch (e: Exception) {
                    fallbackFormat.parse(isoString)
                } ?: return isoString

                val now = Date()
                val diffMillis = now.time - date.time
                val diffMinutes = diffMillis / (1000 * 60)
                val diffHours = diffMinutes / 60
                val diffDays = diffHours / 24

                when {
                    diffMinutes < 1 -> "Hace unos momentos"
                    diffMinutes < 60 -> "Hace $diffMinutes min"
                    diffHours < 24 -> "Hace $diffHours h"
                    diffDays < 7 -> "Hace $diffDays días"
                    else -> {
                        val outputFormat = SimpleDateFormat("dd MMM, HH:mm", Locale("es", "ES"))
                        outputFormat.format(date)
                    }
                }
            } catch (e: Exception) {
                isoString.take(16).replace("T", " ")
            }
        }
    }
}
