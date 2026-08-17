// ============================================================================
// WintonCoin Android — GetProfileUseCase (Caso de Uso de Perfil)
// ============================================================================
// [DOMAIN LAYER] Obtiene el perfil del usuario y su expediente SOS si aplica.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.UserProfile
import com.wintoncoin.app.domain.repository.ProfileRepository
import javax.inject.Inject

class GetProfileUseCase @Inject constructor(
    private val profileRepository: ProfileRepository
) {
    suspend operator fun invoke(
        username: String,
        sessionUsername: String? = null
    ): Result<UserProfile> {
        val cleanUsername = username.trim()
        if (cleanUsername.isEmpty()) {
            return Result.Error("Nombre de usuario inválido.")
        }

        val profileResult = profileRepository.getProfile(cleanUsername)
        if (profileResult is Result.Success) {
            val profile = profileResult.data
            // Si el usuario autenticado está viendo su propio perfil, cargar caso SOS
            val sosCase = if (sessionUsername != null && sessionUsername.equals(cleanUsername, ignoreCase = true)) {
                val sosResult = profileRepository.getMySosCase(cleanUsername)
                if (sosResult is Result.Success) sosResult.data else null
            } else {
                null
            }

            return Result.Success(profile.copy(sosCase = sosCase))
        }

        return profileResult
    }
}
