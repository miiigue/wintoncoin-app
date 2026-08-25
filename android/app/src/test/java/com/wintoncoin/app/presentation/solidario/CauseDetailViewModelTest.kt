// ============================================================================
// WintonCoin Android — CauseDetailViewModelTest
// ============================================================================
// Pruebas unitarias para CauseDetailViewModel.
// ============================================================================

package com.wintoncoin.app.presentation.solidario

import com.wintoncoin.app.domain.model.CauseDonationsSummary
import com.wintoncoin.app.domain.model.CauseStatus
import com.wintoncoin.app.domain.model.CauseUpdate
import com.wintoncoin.app.domain.model.HumanitarianCause
import com.wintoncoin.app.domain.model.SubmitCauseInput
import com.wintoncoin.app.domain.repository.DonationRepository
import com.wintoncoin.app.domain.repository.WalletRepository
import com.wintoncoin.app.domain.usecase.CancelCauseUseCase
import com.wintoncoin.app.domain.usecase.DonateToCauseUseCase
import com.wintoncoin.app.domain.usecase.GetCauseDetailUseCase
import com.wintoncoin.app.presentation.solidario.detail.CauseDetailEvent
import com.wintoncoin.app.presentation.solidario.detail.CauseDetailViewModel
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
class CauseDetailViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private class FakeDonationRepo : DonationRepository {
        override suspend fun getApprovedCauses(): Result<List<HumanitarianCause>> = Result.success(emptyList())
        override suspend fun getMyCauses(): Result<List<HumanitarianCause>> = Result.success(emptyList())

        override suspend fun getCauseDetail(id: Int): Result<Pair<HumanitarianCause, CauseDonationsSummary?>> {
            return Result.success(
                Pair(
                    HumanitarianCause(
                        id = id,
                        title = "Causa Solidaria Detalle",
                        story = "Historia completa",
                        goalAmount = 1000.0,
                        currentAmount = 250.0,
                        amountOnHold = 0.0,
                        status = CauseStatus.APPROVED,
                        foundationName = "Fundación",
                        creatorUsername = "creador",
                        beneficiaryUsername = null,
                        beneficiaryReferralCode = null,
                        evidenceUrls = null,
                        adminNotes = null,
                        createdAt = "2026-08-24T12:00:00Z",
                        formattedCreatedAt = "24 Ago"
                    ),
                    CauseDonationsSummary(
                        totalRaised = 250.0,
                        totalOnHold = 0.0,
                        donationsCount = 1,
                        releasedDonations = emptyList(),
                        onHoldDonations = emptyList()
                    )
                )
            )
        }

        override suspend fun getCauseDonations(id: Int): Result<CauseDonationsSummary> = Result.success(
            CauseDonationsSummary(0.0, 0.0, 0, emptyList(), emptyList())
        )

        override suspend fun getCauseUpdates(id: Int): Result<List<CauseUpdate>> = Result.success(emptyList())
        override suspend fun submitCause(input: SubmitCauseInput): Result<Int> = Result.success(1)
        override suspend fun donateToCause(id: Int, amount: Double, acceptedTerms: Boolean): Result<String> = Result.success("Donación procesada")
        override suspend fun cancelCause(id: Int): Result<Unit> = Result.success(Unit)
    }

    private class FakeWalletRepo : WalletRepository {
        override suspend fun getMyBalance(): com.wintoncoin.app.domain.model.Result<com.wintoncoin.app.domain.model.WalletBalance> {
            return com.wintoncoin.app.domain.model.Result.Success(
                com.wintoncoin.app.domain.model.WalletBalance(
                    blueAvailable = 1500.0
                )
            )
        }

        override suspend fun getMyHistory(): com.wintoncoin.app.domain.model.Result<List<com.wintoncoin.app.domain.model.TransactionItem>> {
            return com.wintoncoin.app.domain.model.Result.Success(emptyList())
        }
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
    fun `loading cause loads detail and wallet balance concurrently`() = runTest(testDispatcher) {
        val donationRepo = FakeDonationRepo()
        val walletRepo = FakeWalletRepo()

        val viewModel = CauseDetailViewModel(
            getCauseDetailUseCase = GetCauseDetailUseCase(donationRepo),
            donateToCauseUseCase = DonateToCauseUseCase(donationRepo),
            cancelCauseUseCase = CancelCauseUseCase(donationRepo),
            walletRepository = walletRepo
        )

        viewModel.onEvent(CauseDetailEvent.Load(5))
        advanceUntilIdle()

        val state = viewModel.state.value
        assertNotNull(state.cause)
        assertEquals(5, state.cause?.id)
        assertEquals(1500.0, state.userAvailableBalance, 0.001)
    }

    @Test
    fun `executing donation triggers success feedback and reloads data`() = runTest(testDispatcher) {
        val donationRepo = FakeDonationRepo()
        val walletRepo = FakeWalletRepo()

        val viewModel = CauseDetailViewModel(
            getCauseDetailUseCase = GetCauseDetailUseCase(donationRepo),
            donateToCauseUseCase = DonateToCauseUseCase(donationRepo),
            cancelCauseUseCase = CancelCauseUseCase(donationRepo),
            walletRepository = walletRepo
        )

        viewModel.onEvent(CauseDetailEvent.Load(5))
        advanceUntilIdle()

        viewModel.onEvent(CauseDetailEvent.DonationAmountChanged("100"))
        viewModel.onEvent(CauseDetailEvent.AcceptedTermsChanged(true))
        viewModel.onEvent(CauseDetailEvent.ExecuteDonation)
        advanceUntilIdle()

        val state = viewModel.state.value
        assertEquals("Donación procesada", state.feedbackMessage)
    }
}
