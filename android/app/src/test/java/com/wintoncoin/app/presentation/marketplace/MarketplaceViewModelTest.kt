// ============================================================================
// WintonCoin Android — Tests Unitarios de MarketplaceViewModel
// ============================================================================
// [UNIT TEST] Pruebas sobre la emisión de estados, filtrado por categorías y
// recarga de datos en el feed de Marketplace.
// ============================================================================

package com.wintoncoin.app.presentation.marketplace

import com.wintoncoin.app.domain.model.MarketplaceCategory
import com.wintoncoin.app.domain.model.PublicationItem
import com.wintoncoin.app.domain.model.TaskAcceptanceStatus
import com.wintoncoin.app.domain.usecase.GetMarketplaceFeedUseCase
import io.mockk.coEvery
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
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MarketplaceViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private val getFeedUseCase: GetMarketplaceFeedUseCase = mockk()
    private lateinit var viewModel: MarketplaceViewModel

    private val sampleItem = PublicationItem(
        id = "1",
        title = "Tarea de Test",
        description = "Descripción",
        blueCost = 100.0,
        baseBlueCost = 100.0,
        multiplier = 1.0,
        stageName = "Etapa Regular",
        isBoosterTx = false,
        isBoosterTask = false,
        isSellPost = false,
        isQuickSale = false,
        isHumanitarianCause = false,
        availableSlots = 1,
        category = MarketplaceCategory.TASK,
        createdAt = "2026-08-16T12:00:00Z",
        expiresAt = null,
        goalAmount = 0.0,
        currentAmount = 0.0,
        amountOnHold = 0.0,
        imageUrls = emptyList(),
        requiresEvidence = false,
        authorUsername = "alice",
        authorRating = 5.0,
        authorRatingsCount = 10,
        userAcceptanceStatus = TaskAcceptanceStatus.NONE,
        participants = emptyList(),
        beneficiaryUsername = null,
        foundationName = null
    )

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        coEvery { getFeedUseCase(any(), any()) } returns Result.success(listOf(sampleItem))
        viewModel = MarketplaceViewModel(getFeedUseCase)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial load fetches marketplace items into state`() = runTest {
        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertEquals(1, state.publications.size)
        assertEquals("Tarea de Test", state.publications[0].title)
    }

    @Test
    fun `SelectCategory updates state and triggers reload`() = runTest {
        advanceUntilIdle()

        viewModel.onEvent(MarketplaceEvent.SelectCategory(MarketplaceCategory.DONATION))
        advanceUntilIdle()

        assertEquals(MarketplaceCategory.DONATION, viewModel.state.value.selectedCategory)
    }

    @Test
    fun `UpdateSearchQuery updates state and triggers reload`() = runTest {
        advanceUntilIdle()

        viewModel.onEvent(MarketplaceEvent.UpdateSearchQuery("smart contract"))
        advanceUntilIdle()

        assertEquals("smart contract", viewModel.state.value.searchQuery)
    }
}
