// ============================================================================
// WintonCoin Android — GetCauseDetailUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Obtiene el detalle, donaciones y novedades de una causa.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.CauseDonationsSummary
import com.wintoncoin.app.domain.model.CauseUpdate
import com.wintoncoin.app.domain.model.HumanitarianCause
import com.wintoncoin.app.domain.repository.DonationRepository
import javax.inject.Inject

data class CauseDetailResult(
    val cause: HumanitarianCause,
    val donationsSummary: CauseDonationsSummary?,
    val updates: List<CauseUpdate>
)

class GetCauseDetailUseCase @Inject constructor(
    private val repository: DonationRepository
) {
    suspend operator fun invoke(causeId: Int): Result<CauseDetailResult> {
        if (causeId <= 0) {
            return Result.failure(IllegalArgumentException("ID de causa inválido."))
        }

        val detailResult = repository.getCauseDetail(causeId)
        if (detailResult.isFailure) {
            return Result.failure(detailResult.exceptionOrNull() ?: Exception("Error al cargar la causa."))
        }

        val (cause, donations) = detailResult.getOrThrow()
        val updatesResult = repository.getCauseUpdates(causeId)
        val updates = updatesResult.getOrDefault(emptyList())

        return Result.success(
            CauseDetailResult(
                cause = cause,
                donationsSummary = donations,
                updates = updates
            )
        )
    }
}
