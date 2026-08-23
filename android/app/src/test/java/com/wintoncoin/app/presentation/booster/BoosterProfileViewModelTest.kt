// ============================================================================
// WintonCoin Android — BoosterProfileViewModelTest (Pruebas Unitarias)
// ============================================================================
// [TEST / PRESENTATION] Valida la lógica reactiva del ViewModel de Impulsores.
// ============================================================================

package com.wintoncoin.app.presentation.booster

import androidx.lifecycle.SavedStateHandle
import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.domain.model.BoosterLevelInfo
import com.wintoncoin.app.domain.model.BoosterProfile
import com.wintoncoin.app.domain.usecase.GetMyBoosterProfileUseCase
import com.wintoncoin.app.domain.usecase.GetUserBoosterProfileUseCase
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class BoosterProfileViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var getMyBoosterProfileUseCase: GetMyBoosterProfileUseCase
    private lateinit var getUserBoosterProfileUseCase: GetUserBoosterProfileUseCase
    private lateinit var tokenManager: TokenManager
    private lateinit var savedStateHandle: SavedStateHandle
    private lateinit var viewModel: BoosterProfileViewModel

    private val mockProfile = BoosterProfile(
        isBooster = true,
        username = "migue",
        boosterLevel = 1,
        totalBoosterBlue = 5000.0,
        eligibleBoosterBlue = 4000.0,
        pendingBoosterBlue = 1000.0,
        currentLevelInfo = BoosterLevelInfo(level = 1, name = "START", minBlueRequired = 0.0, description = "Nivel 1")
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)

        getMyBoosterProfileUseCase = mockk()
        getUserBoosterProfileUseCase = mockk()
        tokenManager = mockk()
        savedStateHandle = SavedStateHandle()

        every { tokenManager.getUsername() } returns "migue"
        coEvery { getMyBoosterProfileUseCase() } returns Result.success(mockProfile)
        coEvery { getUserBoosterProfileUseCase("pedro") } returns Result.success(mockProfile.copy(username = "pedro"))
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial load fetches own booster profile and updates state`() = runTest {
        viewModel = BoosterProfileViewModel(getMyBoosterProfileUseCase, getUserBoosterProfileUseCase, tokenManager, savedStateHandle)
        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertTrue(state.isOwnProfile)
        assertEquals("migue", state.profile?.username)
        assertEquals(5000.0, state.profile?.totalBoosterBlue ?: 0.0, 0.001)
        coVerify(exactly = 1) { getMyBoosterProfileUseCase() }
    }

    @Test
    fun `initial load with foreign username fetches that user profile`() = runTest {
        savedStateHandle["username"] = "pedro"
        viewModel = BoosterProfileViewModel(getMyBoosterProfileUseCase, getUserBoosterProfileUseCase, tokenManager, savedStateHandle)
        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertFalse(state.isOwnProfile)
        assertEquals("pedro", state.profile?.username)
        coVerify(exactly = 1) { getUserBoosterProfileUseCase("pedro") }
    }

    @Test
    fun `Open and Dismiss UnlockConditionsDialog toggles state`() = runTest {
        viewModel = BoosterProfileViewModel(getMyBoosterProfileUseCase, getUserBoosterProfileUseCase, tokenManager, savedStateHandle)
        advanceUntilIdle()

        viewModel.onEvent(BoosterProfileEvent.OpenUnlockConditionsDialog)
        assertTrue(viewModel.state.value.showUnlockConditionsDialog)

        viewModel.onEvent(BoosterProfileEvent.DismissUnlockConditionsDialog)
        assertFalse(viewModel.state.value.showUnlockConditionsDialog)
    }

    @Test
    fun `error during load updates errorMessage in state`() = runTest {
        coEvery { getMyBoosterProfileUseCase() } returns Result.failure(Exception("Error de red"))

        viewModel = BoosterProfileViewModel(getMyBoosterProfileUseCase, getUserBoosterProfileUseCase, tokenManager, savedStateHandle)
        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertEquals("Error de red", state.errorMessage)
    }

    @Test
    fun `Refresh triggers update and updates isRefreshing`() = runTest {
        viewModel = BoosterProfileViewModel(getMyBoosterProfileUseCase, getUserBoosterProfileUseCase, tokenManager, savedStateHandle)
        advanceUntilIdle()

        viewModel.onEvent(BoosterProfileEvent.Refresh)
        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isRefreshing)
        assertEquals("migue", state.profile?.username)
        coVerify(atLeast = 2) { getMyBoosterProfileUseCase() }
    }
}
