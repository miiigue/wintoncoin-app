// ============================================================================
// WintonCoin Android — RegisterVictimUseCaseTest
// ============================================================================
// Pruebas unitarias para RegisterVictimUseCase.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.AffectationLevel
import com.wintoncoin.app.domain.model.SosRegistrationResult
import com.wintoncoin.app.domain.model.VictimRegistrationInput
import com.wintoncoin.app.domain.repository.SosRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class RegisterVictimUseCaseTest {

    private lateinit var repository: SosRepository
    private lateinit var useCase: RegisterVictimUseCase

    @Before
    fun setUp() {
        repository = mockk()
        useCase = RegisterVictimUseCase(repository)
    }

    private fun createValidInput() = VictimRegistrationInput(
        fullName = "Carlos Pérez",
        idDocument = "V-12345678",
        birthdate = "15/05/1985",
        email = "carlos@example.com",
        phone = "+58 412 1234567",
        country = "Venezuela",
        state = "Carabobo",
        municipality = "Valencia",
        sector = "El Trigal",
        address = "Calle 5, Casa #12",
        affectationLevel = AffectationLevel.TOTAL_LOSS,
        minorsCount = 2,
        elderlyCount = 1,
        disabledCount = 0,
        age = 38,
        gender = "male",
        description = "Pérdida total del techo y enseres por sismo",
        googlePhotosUrl = "https://photos.google.com/share/test",
        dataConsent = true,
        swornDeclaration = true
    )

    @Test
    fun `when input is valid, returns success with dossier number`() = runTest {
        val input = createValidInput()
        val expected = SosRegistrationResult(
            dossierNumber = "SOS-VZLA-4331-00042",
            email = "carlos@example.com",
            message = "Registro recibido con éxito"
        )
        coEvery { repository.registerVictim(input) } returns Result.success(expected)

        val result = useCase(input)

        assertTrue(result.isSuccess)
        assertEquals("SOS-VZLA-4331-00042", result.getOrNull()?.dossierNumber)
    }

    @Test
    fun `when full name is blank, returns failure`() = runTest {
        val input = createValidInput().copy(fullName = "")
        val result = useCase(input)
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("nombre completo") == true)
    }

    @Test
    fun `when id document is invalid, returns failure`() = runTest {
        val input = createValidInput().copy(idDocument = "V-")
        val result = useCase(input)
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("Cédula") == true)
    }

    @Test
    fun `when data consent is not accepted, returns failure`() = runTest {
        val input = createValidInput().copy(dataConsent = false)
        val result = useCase(input)
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("tratamiento de datos") == true)
    }

    @Test
    fun `when sworn declaration is not accepted, returns failure`() = runTest {
        val input = createValidInput().copy(swornDeclaration = false)
        val result = useCase(input)
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("juramento") == true)
    }
}
