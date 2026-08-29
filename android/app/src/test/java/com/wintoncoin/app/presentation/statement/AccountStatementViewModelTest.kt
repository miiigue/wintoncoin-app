// ============================================================================
// WintonCoin Android — AccountStatementViewModelTest
// ============================================================================
// Pruebas unitarias para AccountStatementViewModel.
// ============================================================================

package com.wintoncoin.app.presentation.statement

import com.wintoncoin.app.domain.model.AccountStatementSummary
import com.wintoncoin.app.domain.model.BlockchainActivityStats
import com.wintoncoin.app.domain.model.SmartContractInfo
import com.wintoncoin.app.domain.model.StatementTransaction
import com.wintoncoin.app.domain.model.VaultCollateralToken
import com.wintoncoin.app.domain.repository.AccountStatementRepository
import com.wintoncoin.app.domain.usecase.AccountStatementFullData
import com.wintoncoin.app.domain.usecase.GetAccountStatementUseCase
import com.wintoncoin.app.domain.usecase.GetSmartContractInfoUseCase
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AccountStatementViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private val fakeSummary = AccountStatementSummary(
        blueAvailable = 100.0,
        blueEscrow = 20.0,
        redCreditLimit = 100.0,
        redCreditAvailable = 80.0,
        redDebtTotal = 20.0,
        organicScore = 100.0,
        collateralBalance = 0.0,
        web3WalletAddress = "0x1234567890abcdef1234567890abcdef12345678",
        kycVerified = true
    )

    private val fakeStats = BlockchainActivityStats(
        totalInteractions = 5,
        paymentsReceived = 3,
        paymentsSent = 2,
        commitmentsAmortized = 0
    )

    private val fakeTxs = listOf(
        StatementTransaction(
            id = 1,
            createdAt = "2026-08-24T12:00:00Z",
            type = "payment_received",
            description = "Pago de tarea",
            blueChange = 50.0,
            redChange = 0.0,
            txHash = "0xhash1"
        )
    )

    private class FakeRepo(
        private val summary: AccountStatementSummary,
        private val stats: BlockchainActivityStats,
        private val txs: List<StatementTransaction>
    ) : AccountStatementRepository {
        override suspend fun getAccountStatementSummary(): Result<AccountStatementSummary> = Result.success(summary)
        override suspend fun getStatementTransactions(): Result<List<StatementTransaction>> = Result.success(txs)
        override suspend fun getBlockchainActivityStats(): Result<BlockchainActivityStats> = Result.success(stats)
        override suspend fun getSmartContractInfo(tokenType: String): Result<SmartContractInfo> =
            Result.success(SmartContractInfo(tokenType, "WintonCoin $tokenType Token", "0xabc", "5000", ""))
        override suspend fun syncCollateral(
            operationType: String, amount: Double, tokenSymbol: String,
            tokenContractAddress: String, txHash: String, balanceAfter: Double?
        ): Result<Double> = Result.success(150.0)
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial load populates state with summary, stats and transactions`() = runTest {
        val repo = FakeRepo(fakeSummary, fakeStats, fakeTxs)
        val getStatementUseCase = GetAccountStatementUseCase(repo)
        val getContractUseCase = GetSmartContractInfoUseCase(repo)

        val viewModel = AccountStatementViewModel(getStatementUseCase, getContractUseCase)
        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertNotNull(state.summary)
        assertEquals(100.0, state.summary!!.blueAvailable, 0.0001)
        assertEquals(5, state.stats.totalInteractions)
        assertEquals(1, state.transactions.size)
        assertNull(state.errorMessage)
    }

    @Test
    fun `VaultAmountChanged recalculates simulated credit limit correctly`() = runTest {
        val repo = FakeRepo(fakeSummary, fakeStats, fakeTxs)
        val viewModel = AccountStatementViewModel(GetAccountStatementUseCase(repo), GetSmartContractInfoUseCase(repo))
        advanceUntilIdle()

        viewModel.onEvent(AccountStatementEvent.VaultAmountChanged("50.0"))

        val state = viewModel.state.value
        assertEquals("50.0", state.vaultDepositAmount)
        assertEquals(150.0, state.vaultSimulatedLimit!!, 0.0001)
    }

    @Test
    fun `OpenSmartContractDialog loads contract info and shows dialog`() = runTest {
        val repo = FakeRepo(fakeSummary, fakeStats, fakeTxs)
        val viewModel = AccountStatementViewModel(GetAccountStatementUseCase(repo), GetSmartContractInfoUseCase(repo))
        advanceUntilIdle()

        viewModel.onEvent(AccountStatementEvent.OpenSmartContractDialog("BLUE"))
        advanceUntilIdle()

        val state = viewModel.state.value
        assertTrue(state.showSmartContractDialog)
        assertNotNull(state.selectedSmartContract)
        assertEquals("BLUE", state.selectedSmartContract!!.tokenType)
    }

    @Test
    fun `ToggleVaultPanel flips panel visibility state`() = runTest {
        val repo = FakeRepo(fakeSummary, fakeStats, fakeTxs)
        val viewModel = AccountStatementViewModel(GetAccountStatementUseCase(repo), GetSmartContractInfoUseCase(repo))
        advanceUntilIdle()

        assertFalse(viewModel.state.value.showVaultPanel)
        viewModel.onEvent(AccountStatementEvent.ToggleVaultPanel)
        assertTrue(viewModel.state.value.showVaultPanel)
        viewModel.onEvent(AccountStatementEvent.ToggleVaultPanel)
        assertFalse(viewModel.state.value.showVaultPanel)
    }

    @Test
    fun `SelectVaultToken updates selected collateral token`() = runTest {
        val repo = FakeRepo(fakeSummary, fakeStats, fakeTxs)
        val viewModel = AccountStatementViewModel(GetAccountStatementUseCase(repo), GetSmartContractInfoUseCase(repo))
        advanceUntilIdle()

        viewModel.onEvent(AccountStatementEvent.SelectVaultToken(VaultCollateralToken.DAI))
        assertEquals(VaultCollateralToken.DAI, viewModel.state.value.vaultSelectedToken)
    }

    @Test
    fun `DismissSmartContractDialog resets selected contract and dialog visibility`() = runTest {
        val repo = FakeRepo(fakeSummary, fakeStats, fakeTxs)
        val viewModel = AccountStatementViewModel(GetAccountStatementUseCase(repo), GetSmartContractInfoUseCase(repo))
        advanceUntilIdle()

        viewModel.onEvent(AccountStatementEvent.OpenSmartContractDialog("RED"))
        advanceUntilIdle()
        assertTrue(viewModel.state.value.showSmartContractDialog)

        viewModel.onEvent(AccountStatementEvent.DismissSmartContractDialog)
        assertFalse(viewModel.state.value.showSmartContractDialog)
        assertNull(viewModel.state.value.selectedSmartContract)
    }

    @Test
    fun `ShowActivityInfoDialog and DismissActivityInfoDialog update message`() = runTest {
        val repo = FakeRepo(fakeSummary, fakeStats, fakeTxs)
        val viewModel = AccountStatementViewModel(GetAccountStatementUseCase(repo), GetSmartContractInfoUseCase(repo))
        advanceUntilIdle()

        viewModel.onEvent(AccountStatementEvent.ShowActivityInfoDialog("Explicación de interacciones"))
        assertEquals("Explicación de interacciones", viewModel.state.value.activityInfoDialogMessage)

        viewModel.onEvent(AccountStatementEvent.DismissActivityInfoDialog)
        assertNull(viewModel.state.value.activityInfoDialogMessage)
    }

    @Test
    fun `CopyText and DismissCopyFeedback update feedback message`() = runTest {
        val repo = FakeRepo(fakeSummary, fakeStats, fakeTxs)
        val viewModel = AccountStatementViewModel(GetAccountStatementUseCase(repo), GetSmartContractInfoUseCase(repo))
        advanceUntilIdle()

        viewModel.onEvent(AccountStatementEvent.CopyText("0x123", "Dirección pública"))
        assertEquals("¡Dirección pública copiado al portapapeles!", viewModel.state.value.copyFeedback)

        viewModel.onEvent(AccountStatementEvent.DismissCopyFeedback)
        assertNull(viewModel.state.value.copyFeedback)
    }

    @Test
    fun `DismissError clears errorMessage from state`() = runTest {
        val repo = FakeRepo(fakeSummary, fakeStats, fakeTxs)
        val viewModel = AccountStatementViewModel(GetAccountStatementUseCase(repo), GetSmartContractInfoUseCase(repo))
        advanceUntilIdle()

        viewModel.onEvent(AccountStatementEvent.DismissError)
        assertNull(viewModel.state.value.errorMessage)
    }

    @Test
    fun `Refresh updates state successfully`() = runTest {
        val repo = FakeRepo(fakeSummary, fakeStats, fakeTxs)
        val viewModel = AccountStatementViewModel(GetAccountStatementUseCase(repo), GetSmartContractInfoUseCase(repo))
        advanceUntilIdle()

        viewModel.onEvent(AccountStatementEvent.Refresh)
        advanceUntilIdle()

        assertFalse(viewModel.state.value.isRefreshing)
        assertNotNull(viewModel.state.value.summary)
    }
}
