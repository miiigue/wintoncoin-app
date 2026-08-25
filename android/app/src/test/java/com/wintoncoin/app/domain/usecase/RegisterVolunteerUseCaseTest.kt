// ============================================================================
// WintonCoin Android — RegisterVolunteerUseCaseTest
// ============================================================================
// Pruebas unitarias para RegisterVolunteerUseCase.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.SosRegistrationResult
import com.wintoncoin.app.domain.model.VolunteerAvailability
import com.wintoncoin.app.domain.model.VolunteerModality
import com.wintoncoin.app.domain.model.VolunteerRegistrationInput
import com.wintoncoin.app.domain.model.VolunteerSpecialty
import com.wintoncoin.app.domain.repository.SosRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class RegisterVolunteerUseCaseTest {

    private lateinit var repository: SosRepository
    private lateinit var useCase: RegisterVolunteerUseCase

    @Before
    fun setUp() {
        repository = mockk()
        useCase = RegisterVolunteerUseCase(repository)
    }

    private fun createValidInput() = VolunteerRegistrationInput(
        fullName = "Dra. Elena Silva",
        idDocument = "V-20123456",
        birthdate = "22/11/1992",
        email = "elena@medicos.org",
        phone = "+58 414 9876543",
        country = "Venezuela",
        state = "Miranda",
        municipality = "Chacao",
        sector = "Los Palos Grandes",
        specialty = VolunteerSpecialty.MEDICO_ENFERMERO,
        availability = VolunteerAvailability.FULL_TIME,
        modality = VolunteerModality.PRESENCIAL,
        experienceDescription = "Médico cirujano con experiencia en triaje de emergencias",
        dataConsent = true,
        legalDisclaimer = true
    )

    @Test
    fun `when input is valid, returns success with volunteer dossier`() = runTest {
        val input = createValidInput()
        val expected = SosRegistrationResult(
            dossierNumber = "VOL-VZLA-3211-00015",
            email = "elena@medicos.org",
            message = "Postulación recibida con éxito"
        )
        coEvery { repository.registerVolunteer(input) } returns Result.success(expected)

        val result = useCase(input)

        assertTrue(result.isSuccess)
        assertEquals("VOL-VZLA-3211-00015", result.getOrNull()?.dossierNumber)
    }

    @Test
    fun `when legal disclaimer is not accepted, returns failure`() = runTest {
        val input = createValidInput().copy(legalDisclaimer = false)
        val result = useCase(input)
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("código de conducta") == true)
    }

    @Test
    fun `when email format is invalid, returns failure`() = runTest {
        val input = createValidInput().copy(email = "correo_invalido")
        val result = useCase(input)
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("correo") == true)
    }
}
