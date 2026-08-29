// ============================================================================
// WintonCoin Android — GetApprovedCausesUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Obtiene el listado de causas solidarias aprobadas.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.HumanitarianCause
import com.wintoncoin.app.domain.repository.DonationRepository
import javax.inject.Inject

class GetApprovedCausesUseCase @Inject constructor(
    private val repository: DonationRepository
) {
    suspend operator fun invoke(): Result<List<HumanitarianCause>> {
        return repository.getApprovedCauses()
    }
}
