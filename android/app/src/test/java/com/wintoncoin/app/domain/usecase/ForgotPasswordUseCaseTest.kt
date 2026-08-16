// ============================================================================
// WintonCoin Android — ForgotPasswordUseCaseTest (Prueba Unitaria)
// ============================================================================
// [UNIT TEST] Evalúa la validación y ejecución de solicitud de recuperación de clave.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.repository.AuthRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ForgotPasswordUseCaseTest {

    private val authRepository: AuthRepository = mockk()
    private lateinit var useCase: ForgotPasswordUseCase

    @Before
    fun setUp() {
        useCase = ForgotPasswordUseCase(authRepository)
    }

    @Test
    fun `valid email calls repository and returns success`() = runTest {
        coEvery { authRepository.forgotPassword("user@wintoncoin.com") } returns Result.Success("Instrucciones enviadas")

        val result = useCase("user@wintoncoin.com")

        assertTrue(result is Result.Success)
        assertEquals("Instrucciones enviadas", (result as Result.Success).data)
        coVerify(exactly = 1) { authRepository.forgotPassword("user@wintoncoin.com") }
    }

    @Test
    fun `invalid email format returns error without calling repository`() = runTest {
        val result = useCase("invalid-email")

        assertTrue(result is Result.Error)
        assertEquals("Ingresa un correo electrónico válido.", (result as Result.Error).message)
        coVerify(exactly = 0) { authRepository.forgotPassword(any()) }
    }
}
