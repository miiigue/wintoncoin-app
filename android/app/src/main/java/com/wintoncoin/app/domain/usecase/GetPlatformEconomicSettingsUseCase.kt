// ============================================================================
// WintonCoin Android — GetPlatformEconomicSettingsUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Obtiene los parámetros de pre-lanzamiento, límites
// de fotos y permisos de publicación configurados en la plataforma.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.PlatformEconomicSettings
import com.wintoncoin.app.domain.repository.MarketplaceRepository
import javax.inject.Inject

class GetPlatformEconomicSettingsUseCase @Inject constructor(
    private val repository: MarketplaceRepository
) {
    suspend operator fun invoke(): Result<PlatformEconomicSettings> {
        return repository.getPlatformSettings()
    }
}
