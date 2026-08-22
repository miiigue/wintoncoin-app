// ============================================================================
// WintonCoin Android — GetBoosterMultiplierUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Obtiene el multiplicador vigente de etapa y el
// nombre de la fase activa para el cálculo en tiempo real de BLUE IOU.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.BoosterMultiplierInfo
import com.wintoncoin.app.domain.repository.MarketplaceRepository
import javax.inject.Inject

class GetBoosterMultiplierUseCase @Inject constructor(
    private val repository: MarketplaceRepository
) {
    suspend operator fun invoke(): Result<BoosterMultiplierInfo> {
        return repository.getBoosterMultiplier()
    }
}
