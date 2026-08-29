// ============================================================================
// WintonCoin Android — SosHubViewModelTest
// ============================================================================
// Pruebas unitarias para SosHubViewModel.
// ============================================================================

package com.wintoncoin.app.presentation.sos

import com.wintoncoin.app.domain.model.SosCampaignInfo
import com.wintoncoin.app.domain.usecase.GetSosCampaignConfigUseCase
import com.wintoncoin.app.presentation.sos.hub.SosHubEvent
import com.wintoncoin.app.presentation.sos.hub.SosHubViewModel
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
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
class SosHubViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private lateinit var getSosCampaignConfigUseCase: GetSosCampaignConfigUseCase
    private lateinit var viewModel: SosHubViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        getSosCampaignConfigUseCase = mockk()
        coEvery { getSosCampaignConfigUseCase() } returns Result.success(
            SosCampaignInfo(shareCode = "SOSVENEZUELA", bonusBlue = 200.0, isCampaignActive = true)
        )
        viewModel = SosHubViewModel(getSosCampaignConfigUseCase)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state loads campaign info`() = runTest {
        assertEquals("SOSVENEZUELA", viewModel.state.value.campaignInfo.shareCode)
        assertEquals(200.0, viewModel.state.value.campaignInfo.bonusBlue, 0.0)
    }

    @Test
    fun `CopyShareCode event updates feedback state`() = runTest {
        viewModel.onEvent(SosHubEvent.CopyShareCode)
        assertTrue(viewModel.state.value.codeCopiedFeedback)

        viewModel.onEvent(SosHubEvent.ClearFeedback)
        assertFalse(viewModel.state.value.codeCopiedFeedback)
    }
}
