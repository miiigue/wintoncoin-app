// ============================================================================
// WintonCoin Android — UploadMediaUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Orquesta la subida de imágenes a Cloudflare R2 vía
// Retrofit Multipart y devuelve las URLs públicas generadas.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.repository.MarketplaceRepository
import okhttp3.MultipartBody
import javax.inject.Inject

class UploadMediaUseCase @Inject constructor(
    private val repository: MarketplaceRepository
) {
    suspend operator fun invoke(images: List<MultipartBody.Part>): Result<List<String>> {
        if (images.isEmpty()) {
            return Result.failure(IllegalArgumentException("No se han proporcionado imágenes para subir."))
        }
        return repository.uploadImages(images)
    }
}
