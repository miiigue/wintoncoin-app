// ============================================================================
// WintonCoin Android — ProfileViewModelTest (Prueba Unitaria de ViewModel)
// ============================================================================
// [UNIT TEST] Evalúa el flujo reactivo de ProfileViewModel.
// ============================================================================

package com.wintoncoin.app.presentation.profile

import androidx.lifecycle.SavedStateHandle
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.UserProfile
import com.wintoncoin.app.domain.usecase.GetProfileUseCase
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ProfileViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private val getProfileUseCase: GetProfileUseCase = mockk()
    private val tokenManager: TokenManager = mockk(relaxed = true)
    private lateinit var viewModel: ProfileViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        every { tokenManager.getUsername() } returns "miguel_123"
        val savedStateHandle = SavedStateHandle(mapOf("username" to "miguel_123"))

        val mockProfile = UserProfile(username = "miguel_123", isVerified = true, kycVerified = true)
        coEvery { getProfileUseCase("miguel_123", "miguel_123") } returns Result.Success(mockProfile)

        viewModel = ProfileViewModel(getProfileUseCase, tokenManager, savedStateHandle)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial load fetches profile and updates state successfully`() {
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertNotNull(state.profile)
        assertEquals("miguel_123", state.profile?.username)
        assertTrue(state.isMyProfile)
        assertNull(state.errorMessage)
    }

    @Test
    fun `LoadProfile event for different user updates state with target username`() {
        val targetProfile = UserProfile(username = "carlos_456", isVerified = true)
        coEvery { getProfileUseCase("carlos_456", "miguel_123") } returns Result.Success(targetProfile)

        viewModel.onEvent(ProfileEvent.LoadProfile("carlos_456"))
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertNotNull(state.profile)
        assertEquals("carlos_456", state.profile?.username)
        assertFalse(state.isMyProfile)
    }

    @Test
    fun `error during profile fetch sets errorMessage`() {
        coEvery { getProfileUseCase("unknown_user", "miguel_123") } returns Result.Error("Usuario no encontrado")

        viewModel.onEvent(ProfileEvent.LoadProfile("unknown_user"))
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertEquals("Usuario no encontrado", state.errorMessage)
    }
}
