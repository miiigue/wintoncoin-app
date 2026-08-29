// ============================================================================
// WintonCoin Android — SubmitCauseUseCaseTest
// ============================================================================
// Pruebas unitarias para SubmitCauseUseCase.
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

class SubmitCauseUseCaseTest {

    private class FakeRepo : DonationRepository {
        override suspend fun getApprovedCauses(): Result<List<HumanitarianCause>> = Result.success(emptyList())
        override suspend fun getMyCauses(): Result<List<HumanitarianCause>> = Result.success(emptyList())
        override suspend fun getCauseDetail(id: Int): Result<Pair<HumanitarianCause, CauseDonationsSummary?>> = Result.failure(Exception())
        override suspend fun getCauseDonations(id: Int): Result<CauseDonationsSummary> = Result.failure(Exception())
        override suspend fun getCauseUpdates(id: Int): Result<List<CauseUpdate>> = Result.success(emptyList())

        override suspend fun submitCause(input: SubmitCauseInput): Result<Int> = Result.success(10)
        override suspend fun donateToCause(id: Int, amount: Double, acceptedTerms: Boolean): Result<String> = Result.success("OK")
        override suspend fun cancelCause(id: Int): Result<Unit> = Result.success(Unit)
    }

    @Test
    fun `valid input submits successfully and returns cause ID`() = runBlocking {
        val useCase = SubmitCauseUseCase(FakeRepo())
        val input = SubmitCauseInput(
            title = "Apoyo para cirugia urgente",
            story = "Esta es la historia detallada explicando la urgencia medica y la meta",
            goalAmount = 1500.0,
            foundationName = "Fundación Esperanza",
            beneficiaryReferralCode = "ORG99",
            beneficiarySocialUrls = "https://instagram.com/esperanza",
            evidenceUrls = "https://drive.google.com/folder1",
            userSocialUrls = "https://instagram.com/miguel"
        )
        val result = useCase(input)

        assertTrue(result.isSuccess)
        assertEquals(10, result.getOrThrow())
    }

    @Test
    fun `short title fails validation`() = runBlocking {
        val useCase = SubmitCauseUseCase(FakeRepo())
        val input = SubmitCauseInput(
            title = "Ayud",
            story = "Esta es la historia detallada explicando la urgencia medica y la meta",
            goalAmount = 1500.0,
            foundationName = null,
            beneficiaryReferralCode = null,
            beneficiarySocialUrls = null,
            evidenceUrls = null,
            userSocialUrls = null
        )
        val result = useCase(input)

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    fun `unauthorized cloud URL fails validation`() = runBlocking {
        val useCase = SubmitCauseUseCase(FakeRepo())
        val input = SubmitCauseInput(
            title = "Apoyo para cirugia urgente",
            story = "Esta es la historia detallada explicando la urgencia medica y la meta",
            goalAmount = 1500.0,
            foundationName = null,
            beneficiaryReferralCode = null,
            beneficiarySocialUrls = null,
            evidenceUrls = "https://unauthorized-storage-link.com/file",
            userSocialUrls = null
        )
        val result = useCase(input)

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("nubes autorizadas") == true)
    }

    @Test
    fun `negative goal amount fails validation`() = runBlocking {
        val useCase = SubmitCauseUseCase(FakeRepo())
        val input = SubmitCauseInput(
            title = "Apoyo para cirugia urgente",
            story = "Esta es la historia detallada explicando la urgencia medica y la meta",
            goalAmount = -50.0,
            foundationName = null,
            beneficiaryReferralCode = null,
            beneficiarySocialUrls = null,
            evidenceUrls = null,
            userSocialUrls = null
        )
        val result = useCase(input)

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("mayor a 0") == true)
    }
}
