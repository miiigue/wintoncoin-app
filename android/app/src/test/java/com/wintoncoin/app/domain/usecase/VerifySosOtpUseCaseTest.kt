// ============================================================================
// WintonCoin Android — VerifySosOtpUseCaseTest
// ============================================================================
// Pruebas unitarias para VerifySosOtpUseCase.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.SosAuthSession
import com.wintoncoin.app.domain.model.SosOtpVerificationInput
import com.wintoncoin.app.domain.repository.SosRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class VerifySosOtpUseCaseTest {

    private lateinit var repository: SosRepository
    private lateinit var useCase: VerifySosOtpUseCase

    @Before
    fun setUp() {
        repository = mockk()
        useCase = VerifySosOtpUseCase(repository)
    }

    private fun createValidInput() = SosOtpVerificationInput(
        email = "carlos@example.com",
        otpCode = "123456",
        password = "Password123!",
        confirmPassword = "Password123!"
    )

    @Test
    fun `when victim otp is valid, returns success session`() = runTest {
        val input = createValidInput()
        val session = SosAuthSession(token = "jwt.test.token", username = "carlos123", dossierNumber = "SOS-VZLA-4331-00042")
        coEvery { repository.verifyVictimOtp(input) } returns Result.success(session)

        val result = useCase(input, isVolunteer = false)

        assertTrue(result.isSuccess)
        assertEquals("carlos123", result.getOrNull()?.username)
        assertEquals("SOS-VZLA-4331-00042", result.getOrNull()?.dossierNumber)
    }

    @Test
    fun `when volunteer otp is valid, calls verifyVolunteerOtp`() = runTest {
        val input = createValidInput()
        val session = SosAuthSession(token = "jwt.volunteer.token", username = "elena92", dossierNumber = "VOL-VZLA-3211-00015")
        coEvery { repository.verifyVolunteerOtp(input) } returns Result.success(session)

        val result = useCase(input, isVolunteer = true)

        assertTrue(result.isSuccess)
        assertEquals("elena92", result.getOrNull()?.username)
    }

    @Test
    fun `when otp code length is not 6, returns failure`() = runTest {
        val input = createValidInput().copy(otpCode = "123")
        val result = useCase(input)
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("6 dígitos") == true)
    }

    @Test
    fun `when password length is less than 8, returns failure`() = runTest {
        val input = createValidInput().copy(password = "short", confirmPassword = "short")
        val result = useCase(input)
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("8 caracteres") == true)
    }

    @Test
    fun `when passwords do not match, returns failure`() = runTest {
        val input = createValidInput().copy(confirmPassword = "DifferentPassword123!")
        val result = useCase(input)
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("coinciden") == true)
    }
}
