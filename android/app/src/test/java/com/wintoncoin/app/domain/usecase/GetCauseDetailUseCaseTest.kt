// ============================================================================
// WintonCoin Android — GetCauseDetailUseCaseTest
// ============================================================================
// Pruebas unitarias para GetCauseDetailUseCase.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.CauseDonationsSummary
import com.wintoncoin.app.domain.model.CauseStatus
import com.wintoncoin.app.domain.model.CauseUpdate
import com.wintoncoin.app.domain.model.DonationRecord
import com.wintoncoin.app.domain.model.DonationStatus
import com.wintoncoin.app.domain.model.HumanitarianCause
import com.wintoncoin.app.domain.model.SubmitCauseInput
import com.wintoncoin.app.domain.repository.DonationRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GetCauseDetailUseCaseTest {

    private val fakeCause = HumanitarianCause(
        id = 1,
        title = "Apoyo Médico",
        story = "Historia de prueba",
        goalAmount = 1000.0,
        currentAmount = 200.0,
        amountOnHold = 0.0,
        status = CauseStatus.APPROVED,
        foundationName = "Fundación",
        creatorUsername = "creador",
        beneficiaryUsername = "beneficiario",
        beneficiaryReferralCode = "REF",
        evidenceUrls = null,
        adminNotes = null,
        createdAt = "2026-08-24T12:00:00Z",
        formattedCreatedAt = "24 Ago"
    )

    private val fakeSummary = CauseDonationsSummary(
        totalRaised = 200.0,
        totalOnHold = 0.0,
        donationsCount = 1,
        releasedDonations = listOf(
            DonationRecord(1, 1, "donante1", 200.0, DonationStatus.RELEASED, "2026-08-24T12:00:00Z", "Hace 1 h")
        ),
        onHoldDonations = emptyList()
    )

    private val fakeUpdates = listOf(
        CauseUpdate(1, "Actualización 1", "Compradas las primeras medicinas", "2026-08-25T10:00:00Z", "Hoy")
    )

    private class FakeRepo(
        private val cause: HumanitarianCause,
        private val summary: CauseDonationsSummary,
        private val updates: List<CauseUpdate>,
        private val shouldFail: Boolean = false
    ) : DonationRepository {
        override suspend fun getApprovedCauses(): Result<List<HumanitarianCause>> = Result.success(emptyList())
        override suspend fun getMyCauses(): Result<List<HumanitarianCause>> = Result.success(emptyList())

        override suspend fun getCauseDetail(id: Int): Result<Pair<HumanitarianCause, CauseDonationsSummary?>> {
            return if (shouldFail) Result.failure(Exception("Error al cargar detalle.")) else Result.success(Pair(cause, summary))
        }

        override suspend fun getCauseDonations(id: Int): Result<CauseDonationsSummary> = Result.success(summary)
        override suspend fun getCauseUpdates(id: Int): Result<List<CauseUpdate>> = Result.success(updates)
        override suspend fun submitCause(input: SubmitCauseInput): Result<Int> = Result.success(1)
        override suspend fun donateToCause(id: Int, amount: Double, acceptedTerms: Boolean): Result<String> = Result.success("OK")
        override suspend fun cancelCause(id: Int): Result<Unit> = Result.success(Unit)
    }

    @Test
    fun `invoke with valid causeId returns complete cause detail result`() = runBlocking {
        val useCase = GetCauseDetailUseCase(FakeRepo(fakeCause, fakeSummary, fakeUpdates))
        val result = useCase(1)

        assertTrue(result.isSuccess)
        val data = result.getOrThrow()
        assertEquals(1, data.cause.id)
        assertNotNull(data.donationsSummary)
        assertEquals(1, data.donationsSummary?.donationsCount)
        assertEquals(1, data.updates.size)
        assertEquals("Actualización 1", data.updates[0].title)
    }

    @Test
    fun `invoke with invalid causeId fails validation`() = runBlocking {
        val useCase = GetCauseDetailUseCase(FakeRepo(fakeCause, fakeSummary, fakeUpdates))
        val result = useCase(0)

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    fun `invoke propagates failure on repository error`() = runBlocking {
        val useCase = GetCauseDetailUseCase(FakeRepo(fakeCause, fakeSummary, fakeUpdates, shouldFail = true))
        val result = useCase(1)

        assertTrue(result.isFailure)
        assertEquals("Error al cargar detalle.", result.exceptionOrNull()?.message)
    }
}
