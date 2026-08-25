// ============================================================================
// WintonCoin Android — GetMyCausesUseCaseTest
// ============================================================================
// Pruebas unitarias para GetMyCausesUseCase.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.CauseDonationsSummary
import com.wintoncoin.app.domain.model.CauseStatus
import com.wintoncoin.app.domain.model.CauseUpdate
import com.wintoncoin.app.domain.model.HumanitarianCause
import com.wintoncoin.app.domain.model.SubmitCauseInput
import com.wintoncoin.app.domain.repository.DonationRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GetMyCausesUseCaseTest {

    private class FakeRepo(private val shouldFail: Boolean = false) : DonationRepository {
        override suspend fun getApprovedCauses(): Result<List<HumanitarianCause>> = Result.success(emptyList())

        override suspend fun getMyCauses(): Result<List<HumanitarianCause>> {
            return if (shouldFail) {
                Result.failure(Exception("Error al cargar mis causas."))
            } else {
                Result.success(
                    listOf(
                        HumanitarianCause(
                            id = 2,
                            title = "Mi Causa en Revisión",
                            story = "Historia de mi postulación",
                            goalAmount = 500.0,
                            currentAmount = 0.0,
                            amountOnHold = 0.0,
                            status = CauseStatus.PENDING,
                            foundationName = null,
                            creatorUsername = "miusuario",
                            beneficiaryUsername = null,
                            beneficiaryReferralCode = null,
                            evidenceUrls = null,
                            adminNotes = "En proceso de auditoría",
                            createdAt = "2026-08-25T10:00:00Z",
                            formattedCreatedAt = "25 de agosto de 2026"
                        )
                    )
                )
            }
        }

        override suspend fun getCauseDetail(id: Int): Result<Pair<HumanitarianCause, CauseDonationsSummary?>> = Result.failure(Exception())
        override suspend fun getCauseDonations(id: Int): Result<CauseDonationsSummary> = Result.failure(Exception())
        override suspend fun getCauseUpdates(id: Int): Result<List<CauseUpdate>> = Result.success(emptyList())
        override suspend fun submitCause(input: SubmitCauseInput): Result<Int> = Result.success(2)
        override suspend fun donateToCause(id: Int, amount: Double, acceptedTerms: Boolean): Result<String> = Result.success("OK")
        override suspend fun cancelCause(id: Int): Result<Unit> = Result.success(Unit)
    }

    @Test
    fun `invoke returns user my causes successfully`() = runBlocking {
        val useCase = GetMyCausesUseCase(FakeRepo())
        val result = useCase()

        assertTrue(result.isSuccess)
        val list = result.getOrThrow()
        assertEquals(1, list.size)
        assertEquals("Mi Causa en Revisión", list[0].title)
        assertEquals(CauseStatus.PENDING, list[0].status)
    }

    @Test
    fun `invoke propagates failure on repository error`() = runBlocking {
        val useCase = GetMyCausesUseCase(FakeRepo(shouldFail = true))
        val result = useCase()

        assertTrue(result.isFailure)
        assertEquals("Error al cargar mis causas.", result.exceptionOrNull()?.message)
    }
}
