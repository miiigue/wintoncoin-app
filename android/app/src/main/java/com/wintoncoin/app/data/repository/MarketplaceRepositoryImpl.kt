// ============================================================================
// WintonCoin Android — MarketplaceRepositoryImpl (Implementación de Repositorio)
// ============================================================================
// [DATA LAYER / REPOSITORY] Orquesta la consulta unificada de publicaciones y
// causas solidarias, saneamiento de URLs multimedia para evitar crashes, y
// ejecución de transacciones de postulación, culminación y liberación de fondos.
// ============================================================================

package com.wintoncoin.app.data.repository

import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.data.remote.api.MarketplaceApiService
import com.wintoncoin.app.data.remote.dto.AcceptPublicationRequest
import com.wintoncoin.app.data.remote.dto.CompleteTaskRequest
import com.wintoncoin.app.data.remote.dto.ConfirmPaymentRequest
import com.wintoncoin.app.data.remote.dto.CreatePublicationRequest
import com.wintoncoin.app.data.remote.dto.CreateQuickSaleRequest
import com.wintoncoin.app.data.remote.dto.HumanitarianCauseDto
import com.wintoncoin.app.data.remote.dto.ParticipantDto
import com.wintoncoin.app.data.remote.dto.PublicationDto
import com.wintoncoin.app.domain.model.MarketplaceCategory
import com.wintoncoin.app.domain.model.ParticipantItem
import com.wintoncoin.app.domain.model.PublicationItem
import com.wintoncoin.app.domain.model.TaskAcceptanceStatus
import com.wintoncoin.app.domain.repository.MarketplaceRepository
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MarketplaceRepositoryImpl @Inject constructor(
    private val apiService: MarketplaceApiService,
    private val tokenManager: TokenManager
) : MarketplaceRepository {

    override suspend fun getMarketplaceFeed(
        search: String?,
        category: MarketplaceCategory
    ): Result<List<PublicationItem>> = coroutineScope {
        try {
            val username = tokenManager.getUsername() ?: ""

            // Consultar en paralelo las publicaciones activas y las causas solidarias
            val publicationsDeferred = async { apiService.getActivePublications(username = username, search = search) }
            val causesDeferred = async { apiService.getApprovedCauses() }

            val pubResponse = publicationsDeferred.await()
            val causesResponse = causesDeferred.await()

            val publications = if (pubResponse.isSuccessful) pubResponse.body() ?: emptyList() else emptyList()
            val causes = if (causesResponse.isSuccessful) causesResponse.body()?.causes ?: emptyList() else emptyList()

            // 1. Mapear causas humanitarias al modelo unificado
            val mappedCauses = causes.map { cause -> mapHumanitarianCauseToItem(cause) }

            // 2. Mapear publicaciones regulares
            val mappedPublications = publications.map { pub -> mapPublicationDtoToItem(pub) }

            // 3. Unir feeds
            val fullFeed = mappedCauses + mappedPublications

            // 4. Filtrar por categoría seleccionada
            val filteredFeed = when (category) {
                MarketplaceCategory.ALL -> fullFeed
                MarketplaceCategory.TASK -> fullFeed.filter { it.category == MarketplaceCategory.TASK }
                MarketplaceCategory.SELL -> fullFeed.filter { it.category == MarketplaceCategory.SELL }
                MarketplaceCategory.DONATION -> fullFeed.filter { it.category == MarketplaceCategory.DONATION }
                MarketplaceCategory.PENDING -> fullFeed.filter { isPendingForUser(it, username) }
            }

            // 5. Aplicar ordenamiento prioritario estricto (Causas primero -> Tareas de alta prioridad -> Resto)
            val sortedFeed = filteredFeed.sortedWith(
                compareBy<PublicationItem> { getPendingPriority(it, username) }
                    .thenByDescending { it.createdAt }
            )

            Result.success(sortedFeed)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getPublicationDetails(id: String): Result<PublicationItem> {
        return try {
            val username = tokenManager.getUsername()
            val response = apiService.getPublicationDetails(id = id, username = username)
            if (response.isSuccessful && response.body() != null) {
                Result.success(mapPublicationDtoToItem(response.body()!!))
            } else {
                Result.failure(Exception(response.message().ifBlank { "No se pudo cargar la publicación." }))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun acceptPublication(id: String, donationAmount: Double?): Result<String> {
        return try {
            val username = tokenManager.getUsername() ?: return Result.failure(Exception("Sesión no válida."))
            val request = AcceptPublicationRequest(
                acceptorUsername = username,
                donationAmount = donationAmount
            )
            val response = apiService.acceptPublication(id = id, body = request)
            if (response.isSuccessful) {
                Result.success(response.body()?.message ?: "Te has postulado exitosamente a la tarea.")
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                val msg = parseErrorMessage(errorBody).ifBlank { "Error al procesar la postulación." }
                Result.failure(Exception(msg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun completeTask(id: String, evidenceUrls: List<String>): Result<String> {
        return try {
            val username = tokenManager.getUsername() ?: return Result.failure(Exception("Sesión no válida."))
            val request = CompleteTaskRequest(
                completerUsername = username,
                evidenceUrls = evidenceUrls.ifEmpty { null }
            )
            val response = apiService.completeTask(id = id, body = request)
            if (response.isSuccessful) {
                Result.success(response.body()?.message ?: "Tarea marcada como culminada exitosamente.")
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                val msg = parseErrorMessage(errorBody).ifBlank { "Error al culminar la tarea." }
                Result.failure(Exception(msg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun confirmPayment(id: String, workerUsername: String): Result<String> {
        return try {
            val currentUsername = tokenManager.getUsername() ?: return Result.failure(Exception("Sesión no válida."))
            val request = ConfirmPaymentRequest(
                confirmerUsername = currentUsername,
                workerUsername = workerUsername
            )
            val response = apiService.confirmPayment(id = id, body = request)
            if (response.isSuccessful) {
                Result.success(response.body()?.message ?: "Pago confirmado y fondos liberados.")
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                val msg = parseErrorMessage(errorBody).ifBlank { "Error al confirmar el pago." }
                Result.failure(Exception(msg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun createPublication(request: CreatePublicationRequest): Result<String> {
        return try {
            val response = apiService.createPublication(request)
            if (response.isSuccessful) {
                Result.success(response.body()?.message ?: "Publicación creada con éxito.")
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                val msg = parseErrorMessage(errorBody).ifBlank { "Error al crear la publicación." }
                Result.failure(Exception(msg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun createQuickSale(request: CreateQuickSaleRequest): Result<String> {
        return try {
            val response = apiService.createQuickSale(request)
            if (response.isSuccessful) {
                Result.success(response.body()?.message ?: "Venta Rápida creada con éxito.")
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                val msg = parseErrorMessage(errorBody).ifBlank { "Error al crear la Venta Rápida." }
                Result.failure(Exception(msg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun uploadImages(images: List<okhttp3.MultipartBody.Part>): Result<List<String>> {
        return try {
            val response = apiService.uploadImages(images)
            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true && body.urls.isNotEmpty()) {
                    Result.success(body.urls)
                } else {
                    Result.failure(Exception(body?.message ?: "No se pudieron subir las imágenes."))
                }
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                val msg = parseErrorMessage(errorBody).ifBlank { "Error al subir las imágenes a Cloudflare R2." }
                Result.failure(Exception(msg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getBoosterMultiplier(): Result<com.wintoncoin.app.domain.model.BoosterMultiplierInfo> {
        return try {
            val response = apiService.getCurrentMultiplier()
            if (response.isSuccessful) {
                val body = response.body()
                val info = com.wintoncoin.app.domain.model.BoosterMultiplierInfo(
                    multiplier = body?.multiplier ?: 1.0,
                    stageName = body?.stageName ?: "Sin etapa activa"
                )
                Result.success(info)
            } else {
                Result.success(com.wintoncoin.app.domain.model.BoosterMultiplierInfo(1.0, "Sin etapa activa"))
            }
        } catch (e: Exception) {
            Result.success(com.wintoncoin.app.domain.model.BoosterMultiplierInfo(1.0, "Sin etapa activa"))
        }
    }

    override suspend fun getPlatformSettings(): Result<com.wintoncoin.app.domain.model.PlatformEconomicSettings> {
        return try {
            val response = apiService.getPlatformSettings()
            if (response.isSuccessful) {
                val body = response.body()
                val settings = com.wintoncoin.app.domain.model.PlatformEconomicSettings(
                    preLaunchModeEnabled = body?.preLaunchModeEnabled ?: true,
                    allowRequestPublications = body?.allowRequestPublications ?: true,
                    allowSellPublications = body?.allowSellPublications ?: true,
                    allowDonationPublications = body?.allowDonationPublications ?: true,
                    allowQuickSalePublications = body?.allowQuickSalePublications ?: true,
                    maxImagesRequest = body?.maxImagesRequest?.toIntOrNull() ?: 1,
                    maxImagesSell = body?.maxImagesSell?.toIntOrNull() ?: 1,
                    maxImagesDonation = body?.maxImagesDonation?.toIntOrNull() ?: 3,
                    platformUsername = body?.platformUsername
                )
                Result.success(settings)
            } else {
                Result.success(
                    com.wintoncoin.app.domain.model.PlatformEconomicSettings(
                        preLaunchModeEnabled = true,
                        allowRequestPublications = true,
                        allowSellPublications = true,
                        allowDonationPublications = true,
                        allowQuickSalePublications = true,
                        maxImagesRequest = 1,
                        maxImagesSell = 1,
                        maxImagesDonation = 3,
                        platformUsername = "wintoncoin"
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // --- Métodos Privados de Mapeo y Normalización ---

    private fun mapPublicationDtoToItem(dto: PublicationDto): PublicationItem {
        val rawCategory = (dto.category ?: "").lowercase(Locale.ROOT)
        val determinedCategory = when {
            dto.isSellPost == true || dto.isQuickSale == true || rawCategory == "sell" -> MarketplaceCategory.SELL
            dto.goalAmount != null && dto.goalAmount > 0 -> MarketplaceCategory.DONATION
            else -> MarketplaceCategory.TASK
        }

        return PublicationItem(
            id = dto.id ?: "",
            title = dto.title,
            description = dto.description ?: "",
            blueCost = dto.blueCost ?: 0.0,
            baseBlueCost = dto.baseBlueCost ?: 0.0,
            multiplier = dto.currentMultiplier ?: 1.0,
            stageName = dto.currentStageName ?: "Etapa Regular",
            isBoosterTx = dto.isBoosterTx ?: false,
            isBoosterTask = dto.isBoosterTask ?: false,
            isSellPost = dto.isSellPost ?: false,
            isQuickSale = dto.isQuickSale ?: false,
            isHumanitarianCause = false,
            availableSlots = dto.availableSlots ?: 1,
            category = determinedCategory,
            createdAt = dto.createdAt ?: "",
            expiresAt = dto.expiresAt,
            goalAmount = dto.goalAmount ?: 0.0,
            currentAmount = dto.currentAmount ?: 0.0,
            amountOnHold = 0.0,
            imageUrls = sanitizeImageUrls(dto.imageUrls ?: emptyList()),
            requiresEvidence = dto.requiresEvidence ?: false,
            authorUsername = dto.authorUsername ?: "",
            authorRating = dto.authorAverageRating ?: 0.0,
            authorRatingsCount = dto.authorRatingsCount ?: 0,
            userAcceptanceStatus = mapStatusStringToEnum(dto.userAcceptanceStatus),
            participants = dto.participants?.map { mapParticipantDtoToItem(it) } ?: emptyList(),
            beneficiaryUsername = dto.beneficiaryUsername,
            foundationName = null
        )
    }

    private fun mapHumanitarianCauseToItem(dto: HumanitarianCauseDto): PublicationItem {
        return PublicationItem(
            id = "cause-${dto.id}",
            title = dto.title,
            description = dto.story ?: "",
            blueCost = 0.0,
            baseBlueCost = 0.0,
            multiplier = 1.0,
            stageName = "Winton Solidario",
            isBoosterTx = false,
            isBoosterTask = false,
            isSellPost = false,
            isQuickSale = false,
            isHumanitarianCause = true,
            availableSlots = 1,
            category = MarketplaceCategory.DONATION,
            createdAt = dto.createdAt ?: "",
            expiresAt = null,
            goalAmount = dto.goalAmount ?: 0.0,
            currentAmount = dto.currentAmount ?: 0.0,
            amountOnHold = dto.amountOnHold ?: 0.0,
            imageUrls = sanitizeImageUrls(dto.evidenceUrls ?: emptyList()),
            requiresEvidence = false,
            authorUsername = dto.creatorUsername ?: "",
            authorRating = 5.0,
            authorRatingsCount = 1,
            userAcceptanceStatus = TaskAcceptanceStatus.NONE,
            participants = emptyList(),
            beneficiaryUsername = dto.beneficiaryUsername,
            foundationName = dto.foundationName
        )
    }

    private fun mapParticipantDtoToItem(dto: ParticipantDto): ParticipantItem {
        return ParticipantItem(
            username = dto.username,
            status = mapStatusStringToEnum(dto.status),
            acceptedAt = dto.acceptedAt ?: "",
            blueCost = dto.blueCost ?: 0.0,
            averageRating = dto.averageRating ?: 0.0,
            ratingsCount = dto.ratingsCount ?: 0,
            phoneNumber = dto.phoneNumber
        )
    }

    private fun mapStatusStringToEnum(statusStr: String?): TaskAcceptanceStatus {
        return when (statusStr?.lowercase(Locale.ROOT)) {
            "pending_approval" -> TaskAcceptanceStatus.PENDING_APPROVAL
            "approved" -> TaskAcceptanceStatus.APPROVED
            "completed" -> TaskAcceptanceStatus.COMPLETED
            "confirmed_paid" -> TaskAcceptanceStatus.CONFIRMED_PAID
            "rejected" -> TaskAcceptanceStatus.REJECTED
            null, "" -> TaskAcceptanceStatus.NONE
            else -> TaskAcceptanceStatus.UNKNOWN
        }
    }

    /**
     * [SEGURIDAD VISUAL] Filtra URLs para evitar cargar enlaces no compatibles
     * (Instagram, Drive) como imágenes directas.
     */
    private fun sanitizeImageUrls(urls: List<String>): List<String> {
        val validExtensionRegex = Regex(".*\\.(webp|png|jpg|jpeg|gif)(\\?.*)?$", RegexOption.IGNORE_CASE)
        return urls.filter { url ->
            val lower = url.lowercase(Locale.ROOT)
            lower.contains("/uploads/") || validExtensionRegex.matches(url)
        }
    }

    /**
     * Determina si una publicación requiere acción pendiente por parte del usuario autenticado.
     */
    private fun isPendingForUser(pub: PublicationItem, currentUsername: String): Boolean {
        if (pub.userAcceptanceStatus in listOf(
                TaskAcceptanceStatus.APPROVED,
                TaskAcceptanceStatus.PENDING_APPROVAL,
                TaskAcceptanceStatus.COMPLETED
            )
        ) {
            return true
        }

        if (pub.authorUsername == currentUsername && pub.participants.isNotEmpty()) {
            return pub.participants.any {
                it.status in listOf(
                    TaskAcceptanceStatus.PENDING_APPROVAL,
                    TaskAcceptanceStatus.COMPLETED
                )
            }
        }
        return false
    }

    /**
     * Asigna la prioridad de ordenamiento:
     * -1: Causa humanitaria
     *  0: Autor con participantes pendientes de aprobación
     *  1: Autor con participantes pendientes de pago
     *  2: Participante aprobado para realizar la tarea
     *  3: Participante esperando aprobación
     *  4: Participante con tarea completada esperando pago
     *  5: Sin acción pendiente
     */
    private fun getPendingPriority(pub: PublicationItem, currentUsername: String): Int {
        if (pub.isHumanitarianCause) return -1

        val isAuthor = pub.authorUsername == currentUsername
        if (isAuthor && pub.participants.isNotEmpty()) {
            if (pub.participants.any { it.status == TaskAcceptanceStatus.PENDING_APPROVAL }) return 0
            if (pub.participants.any { it.status == TaskAcceptanceStatus.COMPLETED }) return 1
        }

        return when (pub.userAcceptanceStatus) {
            TaskAcceptanceStatus.APPROVED -> 2
            TaskAcceptanceStatus.PENDING_APPROVAL -> 3
            TaskAcceptanceStatus.COMPLETED -> 4
            else -> 5
        }
    }

    private fun parseErrorMessage(errorBody: String): String {
        return try {
            val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }
            val obj = json.decodeFromString<com.wintoncoin.app.data.remote.dto.ErrorResponse>(errorBody)
            obj.message ?: ""
        } catch (_: Exception) {
            ""
        }
    }
}
