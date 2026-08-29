// ============================================================================
// WintonCoin Android — GetMyCausesUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Obtiene las causas postuladas por el usuario.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.HumanitarianCause
import com.wintoncoin.app.domain.repository.DonationRepository
import javax.inject.Inject

class GetMyCausesUseCase @Inject constructor(
    private val repository: DonationRepository
) {
    suspend operator fun invoke(): Result<List<HumanitarianCause>> {
        return repository.getMyCauses()
    }
}
