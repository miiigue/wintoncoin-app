// ============================================================================
// WintonCoin Android — SubmitCauseViewModelTest
// ============================================================================
// Pruebas unitarias para SubmitCauseViewModel.
// ============================================================================

package com.wintoncoin.app.presentation.solidario

import com.wintoncoin.app.domain.model.CauseDonationsSummary
import com.wintoncoin.app.domain.model.CauseUpdate
import com.wintoncoin.app.domain.model.HumanitarianCause
import com.wintoncoin.app.domain.model.SubmitCauseInput
import com.wintoncoin.app.domain.repository.DonationRepository
import com.wintoncoin.app.domain.usecase.SubmitCauseUseCase
import com.wintoncoin.app.presentation.solidario.submit.SubmitCauseEvent
import com.wintoncoin.app.presentation.solidario.submit.SubmitCauseViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SubmitCauseViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private class FakeRepo : DonationRepository {
        override suspend fun getApprovedCauses(): Result<List<HumanitarianCause>> = Result.success(emptyList())
        override suspend fun getMyCauses(): Result<List<HumanitarianCause>> = Result.success(emptyList())
        override suspend fun getCauseDetail(id: Int): Result<Pair<HumanitarianCause, CauseDonationsSummary?>> = Result.failure(Exception())
        override suspend fun getCauseDonations(id: Int): Result<CauseDonationsSummary> = Result.failure(Exception())
        override suspend fun getCauseUpdates(id: Int): Result<List<CauseUpdate>> = Result.success(emptyList())

        override suspend fun submitCause(input: SubmitCauseInput): Result<Int> = Result.success(88)
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
    fun `submitting without accepting terms sets error message`() = runTest(testDispatcher) {
        val viewModel = SubmitCauseViewModel(SubmitCauseUseCase(FakeRepo()))

        viewModel.onEvent(SubmitCauseEvent.TitleChanged("Causa Solidaria Válida"))
        viewModel.onEvent(SubmitCauseEvent.StoryChanged("Esta es una historia lo suficientemente larga para ser válida"))
        viewModel.onEvent(SubmitCauseEvent.GoalAmountChanged("1000"))
        viewModel.onEvent(SubmitCauseEvent.AcceptedTermsChanged(false))

        viewModel.onEvent(SubmitCauseEvent.Submit)
        advanceUntilIdle()

        val state = viewModel.state.value
        assertNotNull(state.errorMessage)
        assertTrue(state.errorMessage?.contains("Términos y Condiciones") == true)
    }

    @Test
    fun `submitting with valid data sets isSubmittedSuccess and createdCauseId`() = runTest(testDispatcher) {
        val viewModel = SubmitCauseViewModel(SubmitCauseUseCase(FakeRepo()))

        viewModel.onEvent(SubmitCauseEvent.TitleChanged("Causa Solidaria Válida"))
        viewModel.onEvent(SubmitCauseEvent.StoryChanged("Esta es una historia lo suficientemente larga para ser válida"))
        viewModel.onEvent(SubmitCauseEvent.GoalAmountChanged("1000"))
        viewModel.onEvent(SubmitCauseEvent.EvidenceUrlsChanged("https://drive.google.com/folder"))
        viewModel.onEvent(SubmitCauseEvent.AcceptedTermsChanged(true))

        viewModel.onEvent(SubmitCauseEvent.Submit)
        advanceUntilIdle()

        val state = viewModel.state.value
        assertTrue(state.isSubmittedSuccess)
        assertEquals(88, state.createdCauseId)
    }
}
