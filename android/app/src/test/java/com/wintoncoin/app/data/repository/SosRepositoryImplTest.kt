// ============================================================================
// WintonCoin Android — SosRepositoryImplTest
// ============================================================================
// Pruebas unitarias para SosRepositoryImpl.
// ============================================================================

package com.wintoncoin.app.data.repository

import com.wintoncoin.app.core.audit.AuditLogger
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.data.remote.api.SosApiService
import com.wintoncoin.app.data.remote.dto.RegisterVictimResponseDto
import com.wintoncoin.app.data.remote.dto.RegisterVolunteerResponseDto
import com.wintoncoin.app.data.remote.dto.SosCampaignSettingsDto
import com.wintoncoin.app.data.remote.dto.VerifySosOtpResponseDto
import com.wintoncoin.app.domain.model.AffectationLevel
import com.wintoncoin.app.domain.model.SosOtpVerificationInput
import com.wintoncoin.app.domain.model.VictimRegistrationInput
import com.wintoncoin.app.domain.model.VolunteerAvailability
import com.wintoncoin.app.domain.model.VolunteerModality
import com.wintoncoin.app.domain.model.VolunteerRegistrationInput
import com.wintoncoin.app.domain.model.VolunteerSpecialty
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

class SosRepositoryImplTest {

    private lateinit var apiService: SosApiService
    private lateinit var tokenManager: TokenManager
    private lateinit var auditLogger: AuditLogger
    private lateinit var repository: SosRepositoryImpl

    @Before
    fun setUp() {
        apiService = mockk()
        tokenManager = mockk(relaxed = true)
        auditLogger = mockk(relaxed = true)
        repository = SosRepositoryImpl(apiService, tokenManager, auditLogger)
    }

    @Test
    fun `registerVictim maps DTO and returns success`() = runTest {
        val input = VictimRegistrationInput(
            fullName = "Carlos Pérez",
            idDocument = "V-12345678",
            birthdate = "15/05/1985",
            email = "carlos@example.com",
            phone = "+58 412 1234567",
            country = "Venezuela",
            state = "Carabobo",
            municipality = "Valencia",
            sector = "El Trigal",
            address = "Calle 5",
            affectationLevel = AffectationLevel.TOTAL_LOSS,
            description = "Daños severos",
            dataConsent = true,
            swornDeclaration = true
        )

        val responseDto = RegisterVictimResponseDto(
            success = true,
            message = "Registro completado",
            dossierNumber = "SOS-VZLA-4331-00042",
            email = "carlos@example.com"
        )
        coEvery { apiService.registerVictim(any()) } returns Response.success(responseDto)

        val result = repository.registerVictim(input)

        assertTrue(result.isSuccess)
        assertEquals("SOS-VZLA-4331-00042", result.getOrNull()?.dossierNumber)
        coVerify { auditLogger.log(AuditLogger.Category.USER_ACTION, "SOS_VICTIM_REGISTERED", any()) }
    }

    @Test
    fun `verifyVictimOtp saves session on success`() = runTest {
        val input = SosOtpVerificationInput(
            email = "carlos@example.com",
            otpCode = "123456",
            password = "Password123!",
            confirmPassword = "Password123!"
        )

        val responseDto = VerifySosOtpResponseDto(
            success = true,
            token = "jwt.session.token",
            username = "carlos123",
            dossierNumber = "SOS-VZLA-4331-00042"
        )
        coEvery { apiService.verifyVictimOtp(any()) } returns Response.success(responseDto)

        val result = repository.verifyVictimOtp(input)

        assertTrue(result.isSuccess)
        assertEquals("carlos123", result.getOrNull()?.username)
        coVerify { tokenManager.saveAccessToken("jwt.session.token") }
        coVerify { tokenManager.saveUsername("carlos123") }
    }

    @Test
    fun `registerVolunteer returns success with volunteer dossier`() = runTest {
        val input = VolunteerRegistrationInput(
            fullName = "Elena Silva",
            idDocument = "V-20123456",
            birthdate = "22/11/1992",
            email = "elena@medicos.org",
            phone = "+58 414 9876543",
            state = "Miranda",
            municipality = "Chacao",
            sector = "Los Palos Grandes",
            specialty = VolunteerSpecialty.MEDICO_ENFERMERO,
            availability = VolunteerAvailability.FULL_TIME,
            modality = VolunteerModality.PRESENCIAL,
            dataConsent = true,
            legalDisclaimer = true
        )

        val responseDto = RegisterVolunteerResponseDto(
            success = true,
            message = "Postulación recibida",
            dossierNumber = "VOL-VZLA-3211-00015",
            email = "elena@medicos.org"
        )
        coEvery { apiService.registerVolunteer(any()) } returns Response.success(responseDto)

        val result = repository.registerVolunteer(input)

        assertTrue(result.isSuccess)
        assertEquals("VOL-VZLA-3211-00015", result.getOrNull()?.dossierNumber)
    }

    @Test
    fun `getCampaignSettings returns fallback on API failure`() = runTest {
        coEvery { apiService.getCampaignSettings() } returns Response.error(500, "Error".toResponseBody())

        val result = repository.getCampaignSettings()

        assertTrue(result.isSuccess)
        assertEquals("SOSVENEZUELA", result.getOrNull()?.shareCode)
    }
}
