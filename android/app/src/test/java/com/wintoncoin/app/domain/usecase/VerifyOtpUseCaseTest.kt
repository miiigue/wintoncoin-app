// ============================================================================
// WintonCoin Android — VerifyOtpUseCaseTest (Prueba Unitaria de Caso de Uso OTP)
// ============================================================================
// [UNIT TEST] Evalúa la validación estricta del código OTP de 6 dígitos numéricos.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.UserSession
import com.wintoncoin.app.domain.repository.AuthRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class VerifyOtpUseCaseTest {

    private val authRepository: AuthRepository = mockk()
    private lateinit var useCase: VerifyOtpUseCase

    @Before
    fun setUp() {
        useCase = VerifyOtpUseCase(authRepository)
    }

    @Test
    fun `valid 6 digit otp calls repository and returns success`() = runTest {
        val userSession = UserSession(isAuthenticated = true, isVerified = true, username = "test_user")
        coEvery { authRepository.verifyOtp("test@wintoncoin.com", "123456") } returns Result.Success(userSession)

        val result = useCase("test@wintoncoin.com", "123456")

        assertTrue(result is Result.Success)
        assertEquals(userSession, (result as Result.Success).data)
        coVerify(exactly = 1) { authRepository.verifyOtp("test@wintoncoin.com", "123456") }
    }

    @Test
    fun `otp with less than 6 digits returns error without calling repository`() = runTest {
        val result = useCase("test@wintoncoin.com", "12345")

        assertTrue(result is Result.Error)
        assertEquals("El código OTP debe contener exactamente 6 dígitos numéricos.", (result as Result.Error).message)
        coVerify(exactly = 0) { authRepository.verifyOtp(any(), any()) }
    }

    @Test
    fun `otp with non-numeric characters returns error without calling repository`() = runTest {
        val result = useCase("test@wintoncoin.com", "12345a")

        assertTrue(result is Result.Error)
        assertEquals("El código OTP debe contener exactamente 6 dígitos numéricos.", (result as Result.Error).message)
        coVerify(exactly = 0) { authRepository.verifyOtp(any(), any()) }
    }
}
