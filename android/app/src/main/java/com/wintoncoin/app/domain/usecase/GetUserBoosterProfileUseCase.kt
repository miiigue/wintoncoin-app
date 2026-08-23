// ============================================================================
// WintonCoin Android — GetUserBoosterProfileUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Obtiene el perfil público de impulsor de cualquier
// usuario registrado por su nombre de usuario.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.BoosterProfile
import com.wintoncoin.app.domain.repository.BoosterRepository
import javax.inject.Inject

class GetUserBoosterProfileUseCase @Inject constructor(
    private val repository: BoosterRepository
) {
    suspend operator fun invoke(username: String): Result<BoosterProfile> {
        if (username.isBlank()) {
            return Result.failure(IllegalArgumentException("El nombre de usuario no puede estar vacío."))
        }
        return repository.getUserBoosterProfile(username.trim())
    }
}
