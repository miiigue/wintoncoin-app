// ============================================================================
// WintonCoin Android — GetApprovedCausesUseCaseTest
// ============================================================================
// Pruebas unitarias para GetApprovedCausesUseCase.
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

class GetApprovedCausesUseCaseTest {

    private class FakeRepo(private val shouldFail: Boolean = false) : DonationRepository {
        override suspend fun getApprovedCauses(): Result<List<HumanitarianCause>> {
            return if (shouldFail) {
                Result.failure(Exception("Error al cargar causas aprobadas."))
            } else {
                Result.success(
                    listOf(
                        HumanitarianCause(
                            id = 1,
                            title = "Apoyo para tratamiento médico",
                            story = "Historia de prueba solidaria",
                            goalAmount = 1000.0,
                            currentAmount = 450.0,
                            amountOnHold = 50.0,
                            status = CauseStatus.APPROVED,
                            foundationName = "Fundación Ayuda",
                            creatorUsername = "creador1",
                            beneficiaryUsername = "beneficiario1",
                            beneficiaryReferralCode = "REF123",
                            evidenceUrls = "https://drive.google.com/test",
                            adminNotes = null,
                            createdAt = "2026-08-24T12:00:00Z",
                            formattedCreatedAt = "24 de agosto de 2026"
                        )
                    )
                )
            }
        }

        override suspend fun getMyCauses(): Result<List<HumanitarianCause>> = Result.success(emptyList())
        override suspend fun getCauseDetail(id: Int): Result<Pair<HumanitarianCause, CauseDonationsSummary?>> = Result.failure(Exception())
        override suspend fun getCauseDonations(id: Int): Result<CauseDonationsSummary> = Result.failure(Exception())
        override suspend fun getCauseUpdates(id: Int): Result<List<CauseUpdate>> = Result.success(emptyList())
        override suspend fun submitCause(input: SubmitCauseInput): Result<Int> = Result.success(1)
        override suspend fun donateToCause(id: Int, amount: Double, acceptedTerms: Boolean): Result<String> = Result.success("OK")
        override suspend fun cancelCause(id: Int): Result<Unit> = Result.success(Unit)
    }

    @Test
    fun `invoke returns approved causes list successfully`() = runBlocking {
        val useCase = GetApprovedCausesUseCase(FakeRepo())
        val result = useCase()

        assertTrue(result.isSuccess)
        val list = result.getOrThrow()
        assertEquals(1, list.size)
        assertEquals("Apoyo para tratamiento médico", list[0].title)
        assertEquals(CauseStatus.APPROVED, list[0].status)
        assertEquals(500.0, list[0].totalEffectiveRaised, 0.001)
    }

    @Test
    fun `invoke propagates failure on repository error`() = runBlocking {
        val useCase = GetApprovedCausesUseCase(FakeRepo(shouldFail = true))
        val result = useCase()

        assertTrue(result.isFailure)
        assertEquals("Error al cargar causas aprobadas.", result.exceptionOrNull()?.message)
    }
}
