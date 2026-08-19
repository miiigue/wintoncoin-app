// ============================================================================
// WintonCoin Android — AuthInterceptorTest (Prueba Unitaria de Interceptor)
// ============================================================================
// [UNIT TEST] Evalúa la inyección de token Bearer en rutas protegidas y la
// exclusión segura en rutas públicas de autenticación.
// ============================================================================

package com.wintoncoin.app.core.network

import com.wintoncoin.app.core.security.TokenManager
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import okhttp3.Interceptor
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class AuthInterceptorTest {

    private val tokenManager: TokenManager = mockk()
    private val chain: Interceptor.Chain = mockk()
    private lateinit var interceptor: AuthInterceptor

    @Before
    fun setUp() {
        interceptor = AuthInterceptor(tokenManager)
    }

    @Test
    fun `protected route injects Bearer token in header`() {
        every { tokenManager.getAccessToken() } returns "mock.jwt.token"

        val request = Request.Builder()
            .url("https://wintoncoin-backend-demo.onrender.com/users/miguel_123/profile")
            .build()

        val requestSlot = slot<Request>()
        val dummyResponse = Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(200)
            .message("OK")
            .body("{}".toResponseBody())
            .build()

        every { chain.request() } returns request
        every { chain.proceed(capture(requestSlot)) } returns dummyResponse

        val response = interceptor.intercept(chain)

        assertEquals(200, response.code)
        assertEquals("Bearer mock.jwt.token", requestSlot.captured.header("Authorization"))
    }

    @Test
    fun `excluded public login route does NOT inject Authorization header`() {
        every { tokenManager.getAccessToken() } returns "mock.jwt.token"

        val request = Request.Builder()
            .url("https://wintoncoin-backend-demo.onrender.com/api/auth/login")
            .build()

        val requestSlot = slot<Request>()
        val dummyResponse = Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(200)
            .message("OK")
            .body("{}".toResponseBody())
            .build()

        every { chain.request() } returns request
        every { chain.proceed(capture(requestSlot)) } returns dummyResponse

        val response = interceptor.intercept(chain)

        assertEquals(200, response.code)
        assertNull(requestSlot.captured.header("Authorization"))
    }

    @Test
    fun `protected route with null token sends request without Authorization header`() {
        every { tokenManager.getAccessToken() } returns null

        val request = Request.Builder()
            .url("https://wintoncoin-backend-demo.onrender.com/users/miguel_123/profile")
            .build()

        val requestSlot = slot<Request>()
        val dummyResponse = Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .body("{}".toResponseBody())
            .build()

        every { chain.request() } returns request
        every { chain.proceed(capture(requestSlot)) } returns dummyResponse

        val response = interceptor.intercept(chain)

        assertEquals(401, response.code)
        assertNull(requestSlot.captured.header("Authorization"))
    }
}
