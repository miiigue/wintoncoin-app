// ============================================================================
// WintonCoin Android — CompleteTaskUseCase (Caso de Uso: Culminar Tarea)
// ============================================================================
// [DOMAIN LAYER] Envía evidencias y marca la tarea como realizada.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.repository.MarketplaceRepository
import javax.inject.Inject

class CompleteTaskUseCase @Inject constructor(
    private val repository: MarketplaceRepository
) {
    suspend operator fun invoke(id: String, evidenceUrls: List<String> = emptyList()): Result<String> {
        if (id.isBlank()) return Result.failure(IllegalArgumentException("ID de publicación inválido."))
        return repository.completeTask(id = id, evidenceUrls = evidenceUrls)
    }
}
