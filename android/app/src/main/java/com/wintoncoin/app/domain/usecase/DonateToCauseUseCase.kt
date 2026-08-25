// ============================================================================
// WintonCoin Android — DonateToCauseUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Valida y procesa la donación en tokens BLUE IOU.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.repository.DonationRepository
import javax.inject.Inject

class DonateToCauseUseCase @Inject constructor(
    private val repository: DonationRepository
) {
    suspend operator fun invoke(
        causeId: Int,
        amount: Double,
        acceptedTerms: Boolean,
        availableBalance: Double? = null
    ): Result<String> {
        if (causeId <= 0) {
            return Result.failure(IllegalArgumentException("ID de causa inválido."))
        }
        if (amount <= 0.0) {
            return Result.failure(IllegalArgumentException("El monto a donar debe ser un valor positivo."))
        }
        if (!acceptedTerms) {
            return Result.failure(IllegalArgumentException("Debes aceptar los términos y condiciones de la campaña solidaria."))
        }
        if (availableBalance != null && amount > availableBalance) {
            return Result.failure(IllegalArgumentException("Saldo insuficiente. Tu disponible para donaciones es $availableBalance BLUE IOU."))
        }

        return repository.donateToCause(causeId, amount, acceptedTerms)
    }
}
