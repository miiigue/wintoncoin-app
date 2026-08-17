// ============================================================================
// WintonCoin Android — WalletViewModelTest (Prueba Unitaria de ViewModel)
// ============================================================================

package com.wintoncoin.app.presentation.wallet

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.TransactionItem
import com.wintoncoin.app.domain.model.TransactionType
import com.wintoncoin.app.domain.model.WalletBalance
import com.wintoncoin.app.domain.usecase.GetTransactionHistoryUseCase
import com.wintoncoin.app.domain.usecase.GetWalletBalanceUseCase
import io.mockk.coEvery
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
class WalletViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private val getWalletBalanceUseCase: GetWalletBalanceUseCase = mockk()
    private val getTransactionHistoryUseCase: GetTransactionHistoryUseCase = mockk()
    private lateinit var viewModel: WalletViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)

        val balance = WalletBalance(blueAvailable = 500.0, redDebt = 50.0, redLimit = 200.0, redAvailable = 150.0)
        val history = listOf(
            TransactionItem("1", "Tarea", 25.0, TransactionType.EARNED, "2026-08-16", "confirmed_paid")
        )

        coEvery { getWalletBalanceUseCase() } returns Result.Success(balance)
        coEvery { getTransactionHistoryUseCase() } returns Result.Success(history)

        viewModel = WalletViewModel(getWalletBalanceUseCase, getTransactionHistoryUseCase)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial load fetches balance and transactions and updates state`() {
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertNotNull(state.balance)
        assertEquals(500.0, state.balance?.blueAvailable ?: 0.0, 0.01)
        assertEquals(1, state.transactions.size)
        assertNull(state.errorMessage)
    }

    @Test
    fun `TabSelected event updates selectedTab in state`() {
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.onEvent(WalletEvent.TabSelected(WalletTab.HISTORY))
        assertEquals(WalletTab.HISTORY, viewModel.state.value.selectedTab)

        viewModel.onEvent(WalletEvent.TabSelected(WalletTab.BALANCES))
        assertEquals(WalletTab.BALANCES, viewModel.state.value.selectedTab)
    }

    @Test
    fun `error during balance fetch sets errorMessage in state`() {
        coEvery { getWalletBalanceUseCase() } returns Result.Error("Error al conectar con servidor")

        viewModel.onEvent(WalletEvent.Refresh)
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertEquals("Error al conectar con servidor", state.errorMessage)
    }
}
