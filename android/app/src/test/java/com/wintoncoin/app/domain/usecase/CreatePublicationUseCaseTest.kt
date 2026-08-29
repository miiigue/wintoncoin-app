// ============================================================================
// WintonCoin Android — CreatePublicationUseCaseTest (Pruebas Unitarias)
// ============================================================================
// [TEST / DOMAIN] Valida las reglas de negocio y restricciones contables para
// la creación de publicaciones en WintonCoin.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.data.remote.dto.CreatePublicationRequest
import com.wintoncoin.app.domain.repository.MarketplaceRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class CreatePublicationUseCaseTest {

    private lateinit var repository: MarketplaceRepository
    private lateinit var useCase: CreatePublicationUseCase

    @Before
    fun setUp() {
        repository = mockk()
        useCase = CreatePublicationUseCase(repository)
    }

    @Test
    fun `short title less than 3 chars returns error`() = runTest {
        val request = CreatePublicationRequest(
            title = "Hi",
            description = "Valid description here",
            authorUsername = "migue",
            publicationType = "request",
            blueCost = 10.0
        )

        val result = useCase(request)
        assertTrue(result.isFailure)
        assertEquals("El título debe tener al menos 3 caracteres.", result.exceptionOrNull()?.message)
    }

    @Test
    fun `short description less than 5 chars returns error`() = runTest {
        val request = CreatePublicationRequest(
            title = "Valid Title",
            description = "Hi",
            authorUsername = "migue",
            publicationType = "request",
            blueCost = 10.0
        )

        val result = useCase(request)
        assertTrue(result.isFailure)
        assertEquals("La descripción debe tener al menos 5 caracteres.", result.exceptionOrNull()?.message)
    }

    @Test
    fun `request with zero or negative blueCost returns error`() = runTest {
        val request = CreatePublicationRequest(
            title = "Valid Title",
            description = "Valid description here",
            authorUsername = "migue",
            publicationType = "request",
            blueCost = 0.0
        )

        val result = useCase(request)
        assertTrue(result.isFailure)
        assertEquals("La recompensa en BLUE debe ser mayor a 0.", result.exceptionOrNull()?.message)
    }

    @Test
    fun `donation without beneficiary referral code returns error`() = runTest {
        val request = CreatePublicationRequest(
            title = "Causa Solidaria",
            description = "Apoyo médico para cirugía",
            authorUsername = "migue",
            publicationType = "donation",
            goalAmount = 500.0,
            beneficiaryReferralCode = ""
        )

        val result = useCase(request)
        assertTrue(result.isFailure)
        assertEquals("Debes ingresar el código de referido del beneficiario.", result.exceptionOrNull()?.message)
    }

    @Test
    fun `repeat participation with zero cooldown returns error`() = runTest {
        val request = CreatePublicationRequest(
            title = "Tarea con repetición",
            description = "Completar encuesta diaria",
            authorUsername = "migue",
            publicationType = "request",
            blueCost = 5.0,
            allowRepeatParticipation = true,
            maxRepeatPerUser = 5,
            repeatCooldownDays = 0,
            repeatCooldownHours = 0,
            repeatCooldownMinutes = 0
        )

        val result = useCase(request)
        assertTrue(result.isFailure)
        assertEquals("El tiempo de espera entre repeticiones debe ser de al menos 1 minuto.", result.exceptionOrNull()?.message)
    }

    @Test
    fun `valid request calls repository and returns success`() = runTest {
        val request = CreatePublicationRequest(
            title = "Diseño de Logotipo",
            description = "Diseñar el logo para nueva startup",
            authorUsername = "migue",
            publicationType = "request",
            blueCost = 25.0
        )

        coEvery { repository.createPublication(request) } returns Result.success("Publicación creada con éxito.")

        val result = useCase(request)
        assertTrue(result.isSuccess)
        assertEquals("Publicación creada con éxito.", result.getOrNull())
        coVerify(exactly = 1) { repository.createPublication(request) }
    }
}
