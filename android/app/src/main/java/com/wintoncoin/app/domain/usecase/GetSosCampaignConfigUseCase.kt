// ============================================================================
// WintonCoin Android — GetSosCampaignConfigUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Obtiene la configuración de campaña humanitaria SOS.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.SosCampaignInfo
import com.wintoncoin.app.domain.repository.SosRepository
import javax.inject.Inject

class GetSosCampaignConfigUseCase @Inject constructor(
    private val repository: SosRepository
) {
    suspend operator fun invoke(): Result<SosCampaignInfo> {
        return repository.getCampaignSettings()
    }
}
