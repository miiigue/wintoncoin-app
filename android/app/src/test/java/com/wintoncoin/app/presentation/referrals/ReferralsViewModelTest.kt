// ============================================================================
// WintonCoin Android — ReferralsViewModelTest (Pruebas Unitarias)
// ============================================================================
// [TEST / PRESENTATION] Valida la lógica reactiva del ViewModel de Referidos.
// ============================================================================

package com.wintoncoin.app.presentation.referrals

import com.wintoncoin.app.core.security.TokenManager
import com.wintoncoin.app.domain.model.ReferralNetworkData
import com.wintoncoin.app.domain.model.ReferredMember
import com.wintoncoin.app.domain.usecase.GetReferralInfoUseCase
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ReferralsViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var getReferralInfoUseCase: GetReferralInfoUseCase
    private lateinit var tokenManager: TokenManager
    private lateinit var viewModel: ReferralsViewModel

    private val mockData = ReferralNetworkData(
        referralCode = "MIGUE888",
        referralLink = "https://demo.wintoncoin.com/register.html?ref=MIGUE888",
        referredUsers = listOf(
            ReferredMember(username = "lucas", kycVerified = true, registrationDate = "2026-08-22", totalBoosterBlue = 1000.0)
        ),
        totalReferredCount = 1,
        kycVerifiedCount = 1,
        totalBoosterBlueGenerated = 1000.0
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)

        getReferralInfoUseCase = mockk()
        tokenManager = mockk()

        every { tokenManager.getUsername() } returns "migue"
        coEvery { getReferralInfoUseCase("migue") } returns Result.success(mockData)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial load fetches referral network info and updates state`() = runTest {
        viewModel = ReferralsViewModel(getReferralInfoUseCase, tokenManager)
        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertEquals("MIGUE888", state.referralData?.referralCode)
        assertEquals(1, state.referralData?.totalReferredCount)
        coVerify(exactly = 1) { getReferralInfoUseCase("migue") }
    }

    @Test
    fun `initial load without session sets error message`() = runTest {
        every { tokenManager.getUsername() } returns null

        viewModel = ReferralsViewModel(getReferralInfoUseCase, tokenManager)
        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertEquals("Sesión no encontrada. Inicia sesión nuevamente.", state.errorMessage)
        coVerify(exactly = 0) { getReferralInfoUseCase(any()) }
    }

    @Test
    fun `CopyText event triggers copyFeedback and dismiss clears it`() = runTest {
        viewModel = ReferralsViewModel(getReferralInfoUseCase, tokenManager)
        advanceUntilIdle()

        viewModel.onEvent(ReferralsEvent.CopyText("MIGUE888", "Código de referido"))
        assertEquals("¡Código de referido copiado al portapapeles!", viewModel.state.value.copyFeedback)

        viewModel.onEvent(ReferralsEvent.DismissCopyFeedback)
        assertNull(viewModel.state.value.copyFeedback)
    }

    @Test
    fun `Refresh updates referral network data`() = runTest {
        viewModel = ReferralsViewModel(getReferralInfoUseCase, tokenManager)
        advanceUntilIdle()

        viewModel.onEvent(ReferralsEvent.Refresh)
        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isRefreshing)
        assertEquals("MIGUE888", state.referralData?.referralCode)
        coVerify(atLeast = 2) { getReferralInfoUseCase("migue") }
    }
}
