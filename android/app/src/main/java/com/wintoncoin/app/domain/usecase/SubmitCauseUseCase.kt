// ============================================================================
// WintonCoin Android — SubmitCauseUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Valida y postula una causa solidaria para auditoría.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.SubmitCauseInput
import com.wintoncoin.app.domain.repository.DonationRepository
import javax.inject.Inject

class SubmitCauseUseCase @Inject constructor(
    private val repository: DonationRepository
) {
    suspend operator fun invoke(input: SubmitCauseInput): Result<Int> {
        if (input.title.isBlank()) {
            return Result.failure(IllegalArgumentException("El título de la causa es obligatorio."))
        }
        if (input.title.length < 5) {
            return Result.failure(IllegalArgumentException("El título debe tener al menos 5 caracteres."))
        }
        if (input.story.isBlank()) {
            return Result.failure(IllegalArgumentException("La historia de la causa es obligatoria."))
        }
        if (input.story.length < 20) {
            return Result.failure(IllegalArgumentException("La historia debe tener al menos 20 caracteres explicando tu situación."))
        }
        if (input.goalAmount <= 0.0) {
            return Result.failure(IllegalArgumentException("La meta de recaudación en BLUE IOU debe ser mayor a 0."))
        }

        // Validación preventiva de nubes autorizadas (si se envían evidencias)
        input.evidenceUrls?.let { urls ->
            if (urls.isNotBlank()) {
                val authorizedClouds = listOf(
                    "drive.google.com", "photos.google.com", "dropbox.com",
                    "onedrive.live.com", "1drv.ms", "icloud.com", "box.com", "mega.nz"
                )
                val hasValidCloud = authorizedClouds.any { cloud -> urls.contains(cloud, ignoreCase = true) }
                if (!hasValidCloud) {
                    return Result.failure(
                        IllegalArgumentException("Los enlaces de evidencias deben ser de nubes autorizadas: Google Drive, Dropbox, OneDrive, iCloud, Box o Mega.")
                    )
                }
            }
        }

        // Validación de redes sociales autorizadas (si se envían)
        input.userSocialUrls?.let { socials ->
            if (socials.isNotBlank()) {
                val authorizedSocials = listOf("instagram.com", "facebook.com", "tiktok.com", "twitter.com", "x.com")
                val hasValidSocial = authorizedSocials.any { s -> socials.contains(s, ignoreCase = true) }
                if (!hasValidSocial) {
                    return Result.failure(
                        IllegalArgumentException("Los enlaces a redes sociales deben ser de Instagram, Facebook, TikTok, Twitter o X.")
                    )
                }
            }
        }

        return repository.submitCause(input)
    }
}
