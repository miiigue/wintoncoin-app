// ============================================================================
// WintonCoin Android — UploadMediaUseCaseTest (Pruebas Unitarias)
// ============================================================================
// [TEST / DOMAIN] Valida la orquestación de subida de imágenes a Cloudflare R2.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.repository.MarketplaceRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import okhttp3.MultipartBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class UploadMediaUseCaseTest {

    private lateinit var repository: MarketplaceRepository
    private lateinit var useCase: UploadMediaUseCase

    @Before
    fun setUp() {
        repository = mockk()
        useCase = UploadMediaUseCase(repository)
    }

    @Test
    fun `empty images list returns error without calling repository`() = runTest {
        val result = useCase(emptyList())
        assertTrue(result.isFailure)
        assertEquals("No se han proporcionado imágenes para subir.", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { repository.uploadImages(any()) }
    }

    @Test
    fun `valid images list calls repository and returns uploaded URLs`() = runTest {
        val part = mockk<MultipartBody.Part>()
        val mockUrls = listOf("https://pub-r2.dev/uploads/img1.webp")

        coEvery { repository.uploadImages(listOf(part)) } returns Result.success(mockUrls)

        val result = useCase(listOf(part))
        assertTrue(result.isSuccess)
        assertEquals(mockUrls, result.getOrNull())
        coVerify(exactly = 1) { repository.uploadImages(listOf(part)) }
    }
}
