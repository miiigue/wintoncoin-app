// ============================================================================
// WintonCoin Android — MarketplaceRepository (Contrato de Repositorio)
// ============================================================================
// [DOMAIN LAYER] Define las operaciones abstractas para consultar el feed,
// detalle de publicaciones, y ejecutar acciones transaccionales en el marketplace.
// ============================================================================

package com.wintoncoin.app.domain.repository

import com.wintoncoin.app.domain.model.MarketplaceCategory
import com.wintoncoin.app.domain.model.PublicationItem

interface MarketplaceRepository {

    /**
     * Obtiene y combina las publicaciones activas y las causas humanitarias aprobadas,
     * aplicando filtros de seguridad visual y prioridades de negocio.
     */
    suspend fun getMarketplaceFeed(
        search: String? = null,
        category: MarketplaceCategory = MarketplaceCategory.ALL
    ): Result<List<PublicationItem>>

    /**
     * Obtiene la información detallada de una publicación individual por ID.
     */
    suspend fun getPublicationDetails(id: String): Result<PublicationItem>

    /**
     * Postularse a una tarea o realizar una donación a una causa.
     */
    suspend fun acceptPublication(id: String, donationAmount: Double? = null): Result<String>

    /**
     * Marcar una tarea como completada enviando evidencias.
     */
    suspend fun completeTask(id: String, evidenceUrls: List<String>): Result<String>

    /**
     * Confirmar el pago de un trabajador para una publicación.
     */
    suspend fun confirmPayment(id: String, workerUsername: String): Result<String>
}
