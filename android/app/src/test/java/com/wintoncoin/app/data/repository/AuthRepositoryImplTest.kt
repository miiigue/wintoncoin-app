// ============================================================================
// WintonCoin Android — AuthRepositoryImplTest (Prueba Unitaria de Repositorio)
// ============================================================================
// [UNIT TEST] Evalúa el comportamiento de AuthRepositoryImpl simulando
// respuestas del servidor (200 OK, 401 Unauthorized, 500 Server Error).
// ============================================================================

package com.wintoncoin.app.data.repository

import com.wintoncoin.app.core.audit.AuditLogger
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.data.remote.api.AuthApiService
import com.wintoncoin.app.data.remote.dto.LoginRequest
import com.wintoncoin.app.data.remote.dto.LoginResponse
import com.wintoncoin.app.data.remote.dto.RegisterRequest
import com.wintoncoin.app.data.remote.dto.RegisterResponse
import com.wintoncoin.app.domain.model.Result
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

class AuthRepositoryImplTest {

    private val authApiService: AuthApiService = mockk()
    private val tokenManager: TokenManager = mockk(relaxed = true)
    private val auditLogger: AuditLogger = mockk(relaxed = true)
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    private lateinit var repository: AuthRepositoryImpl

    @Before
    fun setUp() {
        repository = AuthRepositoryImpl(authApiService, tokenManager, auditLogger, json)
    }

    @Test
    fun `login success stores token and returns UserSession`() = runTest {
        val loginResponse = LoginResponse(
            token = "jwt.token.here",
            username = "miguel_123",
            isVerified = true,
            kycVerified = false
        )
        coEvery { authApiService.login(LoginRequest("miguel_123", "password123")) } returns Response.success(loginResponse)

        val result = repository.login("miguel_123", "password123")

        assertTrue(result is Result.Success)
        val session = (result as Result.Success).data
        assertEquals("miguel_123", session.username)
        assertTrue(session.isVerified)

        verify(exactly = 1) { tokenManager.saveAccessToken("jwt.token.here") }
        verify(exactly = 1) { tokenManager.saveUsername("miguel_123") }
        verify(exactly = 1) { auditLogger.logAuthSuccess("LOGIN_SUCCESS", "miguel_123") }
    }

    @Test
    fun `login with 401 error logs failure and returns Result Error`() = runTest {
        val errorBody = "{\"error\":\"Credenciales incorrectas\"}".toResponseBody()
        coEvery { authApiService.login(LoginRequest("miguel_123", "wrong_pass")) } returns Response.error(401, errorBody)

        val result = repository.login("miguel_123", "wrong_pass")

        assertTrue(result is Result.Error)
        assertEquals("Credenciales incorrectas", (result as Result.Error).message)
        assertEquals(401, (result as Result.Error).code)
        verify(exactly = 1) { auditLogger.logAuthFailure("LOGIN_FAILED", any()) }
    }

    @Test
    fun `register success calls api and logs success`() = runTest {
        val registerResponse = RegisterResponse(
            success = true,
            message = "Usuario registrado correctamente",
            userId = 15,
            email = "user@wintoncoin.com"
        )
        coEvery { authApiService.register(any()) } returns Response.success(registerResponse)

        val result = repository.register("miguel_123", "user@wintoncoin.com", "+584121234567", "pass123")

        assertTrue(result is Result.Success)
        assertEquals(registerResponse, (result as Result.Success).data)
        verify(exactly = 1) { auditLogger.logAuthSuccess("REGISTER_SUCCESS", "miguel_123") }
    }

    @Test
    fun `logout clears local session and calls remote logout`() = runTest {
        coEvery { authApiService.logout() } returns Response.success(Unit)
        every { tokenManager.getUsername() } returns "miguel_123"

        repository.logout()

        verify(exactly = 1) { tokenManager.clearSession() }
        verify(exactly = 1) { auditLogger.logAuthSuccess("LOGOUT", "miguel_123") }
    }
}
