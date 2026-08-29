// ============================================================================
// WintonCoin Android — CancelCauseUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Cancela o culmina una causa solidaria propia.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.repository.DonationRepository
import javax.inject.Inject

class CancelCauseUseCase @Inject constructor(
    private val repository: DonationRepository
) {
    suspend operator fun invoke(causeId: Int): Result<Unit> {
        if (causeId <= 0) {
            return Result.failure(IllegalArgumentException("ID de causa inválido."))
        }
        return repository.cancelCause(causeId)
    }
}
