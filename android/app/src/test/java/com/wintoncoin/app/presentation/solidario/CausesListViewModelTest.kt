// ============================================================================
// WintonCoin Android — CausesListViewModelTest
// ============================================================================
// Pruebas unitarias para CausesListViewModel.
// ============================================================================

package com.wintoncoin.app.presentation.solidario

import com.wintoncoin.app.domain.model.CauseDonationsSummary
import com.wintoncoin.app.domain.model.CauseStatus
import com.wintoncoin.app.domain.model.CauseUpdate
import com.wintoncoin.app.domain.model.HumanitarianCause
import com.wintoncoin.app.domain.model.SubmitCauseInput
import com.wintoncoin.app.domain.repository.DonationRepository
import com.wintoncoin.app.domain.usecase.GetApprovedCausesUseCase
import com.wintoncoin.app.domain.usecase.GetMyCausesUseCase
import com.wintoncoin.app.presentation.solidario.list.CausesListEvent
import com.wintoncoin.app.presentation.solidario.list.CausesListViewModel
import com.wintoncoin.app.presentation.solidario.list.CausesTab
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
class CausesListViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private class FakeRepo : DonationRepository {
        override suspend fun getApprovedCauses(): Result<List<HumanitarianCause>> {
            return Result.success(
                listOf(
                    HumanitarianCause(
                        id = 1,
                        title = "Tratamiento Oncológico",
                        story = "Historia",
                        goalAmount = 2000.0,
                        currentAmount = 1000.0,
                        amountOnHold = 0.0,
                        status = CauseStatus.APPROVED,
                        foundationName = "Fundación Salud",
                        creatorUsername = "medico",
                        beneficiaryUsername = "paciente",
                        beneficiaryReferralCode = "REF1",
                        evidenceUrls = null,
                        adminNotes = null,
                        createdAt = "2026-08-24T12:00:00Z",
                        formattedCreatedAt = "24 Ago"
                    )
                )
            )
        }

        override suspend fun getMyCauses(): Result<List<HumanitarianCause>> {
            return Result.success(
                listOf(
                    HumanitarianCause(
                        id = 2,
                        title = "Mi Causa Personal",
                        story = "Historia",
                        goalAmount = 500.0,
                        currentAmount = 0.0,
                        amountOnHold = 0.0,
                        status = CauseStatus.PENDING,
                        foundationName = null,
                        creatorUsername = "yo",
                        beneficiaryUsername = null,
                        beneficiaryReferralCode = null,
                        evidenceUrls = null,
                        adminNotes = null,
                        createdAt = "2026-08-25T10:00:00Z",
                        formattedCreatedAt = "25 Ago"
                    )
                )
            )
        }

        override suspend fun getCauseDetail(id: Int): Result<Pair<HumanitarianCause, CauseDonationsSummary?>> = Result.failure(Exception())
        override suspend fun getCauseDonations(id: Int): Result<CauseDonationsSummary> = Result.failure(Exception())
        override suspend fun getCauseUpdates(id: Int): Result<List<CauseUpdate>> = Result.success(emptyList())
        override suspend fun submitCause(input: SubmitCauseInput): Result<Int> = Result.success(1)
        override suspend fun donateToCause(id: Int, amount: Double, acceptedTerms: Boolean): Result<String> = Result.success("OK")
        override suspend fun cancelCause(id: Int): Result<Unit> = Result.success(Unit)
    }

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial load loads approved and my causes concurrently`() = runTest(testDispatcher) {
        val repo = FakeRepo()
        val viewModel = CausesListViewModel(
            getApprovedCausesUseCase = GetApprovedCausesUseCase(repo),
            getMyCausesUseCase = GetMyCausesUseCase(repo)
        )

        advanceUntilIdle()

        val state = viewModel.state.value
        assertFalse(state.isLoading)
        assertEquals(1, state.approvedCauses.size)
        assertEquals(1, state.myCauses.size)
        assertEquals("Tratamiento Oncológico", state.approvedCauses[0].title)
    }

    @Test
    fun `search filter filters displayed causes by query`() = runTest(testDispatcher) {
        val repo = FakeRepo()
        val viewModel = CausesListViewModel(
            getApprovedCausesUseCase = GetApprovedCausesUseCase(repo),
            getMyCausesUseCase = GetMyCausesUseCase(repo)
        )

        advanceUntilIdle()

        viewModel.onEvent(CausesListEvent.SearchQueryChanged("Oncológico"))
        assertEquals(1, viewModel.state.value.displayedCauses.size)

        viewModel.onEvent(CausesListEvent.SearchQueryChanged("Inexistente"))
        assertEquals(0, viewModel.state.value.displayedCauses.size)
    }

    @Test
    fun `switching tab changes displayed list`() = runTest(testDispatcher) {
        val repo = FakeRepo()
        val viewModel = CausesListViewModel(
            getApprovedCausesUseCase = GetApprovedCausesUseCase(repo),
            getMyCausesUseCase = GetMyCausesUseCase(repo)
        )

        advanceUntilIdle()

        viewModel.onEvent(CausesListEvent.SelectTab(CausesTab.MY_CAUSES))
        assertEquals(1, viewModel.state.value.displayedCauses.size)
        assertEquals("Mi Causa Personal", viewModel.state.value.displayedCauses[0].title)
    }
}
