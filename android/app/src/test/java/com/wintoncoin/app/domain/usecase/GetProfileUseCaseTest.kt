// ============================================================================
// WintonCoin Android — GetProfileUseCaseTest (Prueba Unitaria)
// ============================================================================
// [UNIT TEST] Evalúa la obtención del perfil y el aislamiento Zero-Trust del caso SOS.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.SosCase
import com.wintoncoin.app.domain.model.UserProfile
import com.wintoncoin.app.domain.repository.ProfileRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GetProfileUseCaseTest {

    private val profileRepository: ProfileRepository = mockk()
    private lateinit var useCase: GetProfileUseCase

    @Before
    fun setUp() {
        useCase = GetProfileUseCase(profileRepository)
    }

    @Test
    fun `empty username returns error immediately`() = runTest {
        val result = useCase("")

        assertTrue(result is Result.Error)
        assertEquals("Nombre de usuario inválido.", (result as Result.Error).message)
        coVerify(exactly = 0) { profileRepository.getProfile(any()) }
    }

    @Test
    fun `viewing my own profile loads sos case`() = runTest {
        val userProfile = UserProfile(username = "miguel_123", isVerified = true, kycVerified = true)
        val sosCase = SosCase(fullName = "Miguel", cedula = "V-12345678", status = "approved")

        coEvery { profileRepository.getProfile("miguel_123") } returns Result.Success(userProfile)
        coEvery { profileRepository.getMySosCase("miguel_123") } returns Result.Success(sosCase)

        val result = useCase("miguel_123", "miguel_123")

        assertTrue(result is Result.Success)
        val data = (result as Result.Success).data
        assertEquals("miguel_123", data.username)
        assertNotNull(data.sosCase)
        assertEquals("approved", data.sosCase?.status)

        coVerify(exactly = 1) { profileRepository.getProfile("miguel_123") }
        coVerify(exactly = 1) { profileRepository.getMySosCase("miguel_123") }
    }

    @Test
    fun `viewing another user profile does not query private sos case`() = runTest {
        val otherProfile = UserProfile(username = "carlos_456", isVerified = true)

        coEvery { profileRepository.getProfile("carlos_456") } returns Result.Success(otherProfile)

        val result = useCase("carlos_456", "miguel_123")

        assertTrue(result is Result.Success)
        val data = (result as Result.Success).data
        assertEquals("carlos_456", data.username)
        assertNull(data.sosCase)

        coVerify(exactly = 1) { profileRepository.getProfile("carlos_456") }
        coVerify(exactly = 0) { profileRepository.getMySosCase(any()) }
    }
}
