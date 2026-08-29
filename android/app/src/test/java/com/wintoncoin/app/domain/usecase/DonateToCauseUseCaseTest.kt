// ============================================================================
// WintonCoin Android — DonateToCauseUseCaseTest
// ============================================================================
// Pruebas unitarias para DonateToCauseUseCase.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.CauseDonationsSummary
import com.wintoncoin.app.domain.model.CauseUpdate
import com.wintoncoin.app.domain.model.HumanitarianCause
import com.wintoncoin.app.domain.model.SubmitCauseInput
import com.wintoncoin.app.domain.repository.DonationRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DonateToCauseUseCaseTest {

    private class FakeRepo : DonationRepository {
        override suspend fun getApprovedCauses(): Result<List<HumanitarianCause>> = Result.success(emptyList())
        override suspend fun getMyCauses(): Result<List<HumanitarianCause>> = Result.success(emptyList())
        override suspend fun getCauseDetail(id: Int): Result<Pair<HumanitarianCause, CauseDonationsSummary?>> = Result.failure(Exception())
        override suspend fun getCauseDonations(id: Int): Result<CauseDonationsSummary> = Result.failure(Exception())
        override suspend fun getCauseUpdates(id: Int): Result<List<CauseUpdate>> = Result.success(emptyList())
        override suspend fun submitCause(input: SubmitCauseInput): Result<Int> = Result.success(1)

        override suspend fun donateToCause(id: Int, amount: Double, acceptedTerms: Boolean): Result<String> {
            return Result.success("Donación procesada exitosamente.")
        }

        override suspend fun cancelCause(id: Int): Result<Unit> = Result.success(Unit)
    }

    @Test
    fun `valid donation parameters succeeds`() = runBlocking {
        val useCase = DonateToCauseUseCase(FakeRepo())
        val result = useCase(
            causeId = 1,
            amount = 100.0,
            acceptedTerms = true,
            availableBalance = 500.0
        )

        assertTrue(result.isSuccess)
        assertEquals("Donación procesada exitosamente.", result.getOrThrow())
    }

    @Test
    fun `donation without accepting terms fails`() = runBlocking {
        val useCase = DonateToCauseUseCase(FakeRepo())
        val result = useCase(
            causeId = 1,
            amount = 100.0,
            acceptedTerms = false,
            availableBalance = 500.0
        )

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("términos y condiciones") == true)
    }

    @Test
    fun `donation exceeding available balance fails`() = runBlocking {
        val useCase = DonateToCauseUseCase(FakeRepo())
        val result = useCase(
            causeId = 1,
            amount = 600.0,
            acceptedTerms = true,
            availableBalance = 500.0
        )

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("Saldo insuficiente") == true)
    }

    @Test
    fun `zero or negative amount fails`() = runBlocking {
        val useCase = DonateToCauseUseCase(FakeRepo())
        val zeroResult = useCase(causeId = 1, amount = 0.0, acceptedTerms = true)
        val negativeResult = useCase(causeId = 1, amount = -10.0, acceptedTerms = true)

        assertTrue(zeroResult.isFailure)
        assertTrue(negativeResult.isFailure)
    }
}
