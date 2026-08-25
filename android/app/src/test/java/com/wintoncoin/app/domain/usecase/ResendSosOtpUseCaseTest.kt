// ============================================================================
// WintonCoin Android — ResendSosOtpUseCaseTest
// ============================================================================
// Pruebas unitarias para ResendSosOtpUseCase.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.repository.SosRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ResendSosOtpUseCaseTest {

    private lateinit var repository: SosRepository
    private lateinit var useCase: ResendSosOtpUseCase

    @Before
    fun setUp() {
        repository = mockk()
        useCase = ResendSosOtpUseCase(repository)
    }

    @Test
    fun `when victim email is valid, returns success`() = runTest {
        val email = "carlos@example.com"
        coEvery { repository.resendVictimOtp(email) } returns Result.success("Código reenviado")

        val result = useCase(email, isVolunteer = false)

        assertTrue(result.isSuccess)
        assertEquals("Código reenviado", result.getOrNull())
    }

    @Test
    fun `when volunteer email is valid, calls resendVolunteerOtp`() = runTest {
        val email = "elena@medicos.org"
        coEvery { repository.resendVolunteerOtp(email) } returns Result.success("Código voluntario reenviado")

        val result = useCase(email, isVolunteer = true)

        assertTrue(result.isSuccess)
        assertEquals("Código voluntario reenviado", result.getOrNull())
    }

    @Test
    fun `when email is blank, returns failure`() = runTest {
        val result = useCase("", isVolunteer = false)
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("inválido") == true)
    }
}
