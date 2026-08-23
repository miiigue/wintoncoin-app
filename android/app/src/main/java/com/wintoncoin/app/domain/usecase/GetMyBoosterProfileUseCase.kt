// ============================================================================
// WintonCoin Android — GetMyBoosterProfileUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Obtiene el perfil enriquecido de impulsor del usuario
// autenticado actual, incluyendo saldos KYC, ladder de niveles y ledger.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.BoosterProfile
import com.wintoncoin.app.domain.repository.BoosterRepository
import javax.inject.Inject

class GetMyBoosterProfileUseCase @Inject constructor(
    private val repository: BoosterRepository
) {
    suspend operator fun invoke(): Result<BoosterProfile> {
        return repository.getMyBoosterProfile()
    }
}
