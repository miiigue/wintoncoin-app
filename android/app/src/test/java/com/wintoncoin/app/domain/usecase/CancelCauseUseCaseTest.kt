// ============================================================================
// WintonCoin Android — CancelCauseUseCaseTest
// ============================================================================
// Pruebas unitarias para CancelCauseUseCase.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.CauseDonationsSummary
import com.wintoncoin.app.domain.model.CauseUpdate
import com.wintoncoin.app.domain.model.HumanitarianCause
import com.wintoncoin.app.domain.model.SubmitCauseInput
import com.wintoncoin.app.domain.repository.DonationRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test

class CancelCauseUseCaseTest {

    private class FakeRepo : DonationRepository {
        override suspend fun getApprovedCauses(): Result<List<HumanitarianCause>> = Result.success(emptyList())
        override suspend fun getMyCauses(): Result<List<HumanitarianCause>> = Result.success(emptyList())
        override suspend fun getCauseDetail(id: Int): Result<Pair<HumanitarianCause, CauseDonationsSummary?>> = Result.failure(Exception())
        override suspend fun getCauseDonations(id: Int): Result<CauseDonationsSummary> = Result.failure(Exception())
        override suspend fun getCauseUpdates(id: Int): Result<List<CauseUpdate>> = Result.success(emptyList())
        override suspend fun submitCause(input: SubmitCauseInput): Result<Int> = Result.success(1)
        override suspend fun donateToCause(id: Int, amount: Double, acceptedTerms: Boolean): Result<String> = Result.success("OK")
        override suspend fun cancelCause(id: Int): Result<Unit> = Result.success(Unit)
    }

    @Test
    fun `cancel cause with valid id succeeds`() = runBlocking {
        val useCase = CancelCauseUseCase(FakeRepo())
        val result = useCase(1)
        assertTrue(result.isSuccess)
    }

    @Test
    fun `cancel cause with invalid id fails`() = runBlocking {
        val useCase = CancelCauseUseCase(FakeRepo())
        val result = useCase(-1)
        assertTrue(result.isFailure)
    }
}
