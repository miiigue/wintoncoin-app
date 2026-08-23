// ============================================================================
// WintonCoin Android — GetReferralInfoUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Obtiene la información de la red de referidos
// del usuario (código, enlace y lista de miembros invitados con su estado KYC).
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.ReferralNetworkData
import com.wintoncoin.app.domain.repository.BoosterRepository
import javax.inject.Inject

class GetReferralInfoUseCase @Inject constructor(
    private val repository: BoosterRepository
) {
    suspend operator fun invoke(username: String): Result<ReferralNetworkData> {
        if (username.isBlank()) {
            return Result.failure(IllegalArgumentException("El nombre de usuario no puede estar vacío."))
        }
        return repository.getReferralInfo(username.trim())
    }
}
