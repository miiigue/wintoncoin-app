// ============================================================================
// WintonCoin Android — DonationRepositoryImplTest
// ============================================================================
// Pruebas unitarias para DonationRepositoryImpl y sus mappers.
// ============================================================================

package com.wintoncoin.app.data.repository

import com.wintoncoin.app.data.remote.api.DonationApiService
import com.wintoncoin.app.data.remote.dto.CauseDetailResponseDto
import com.wintoncoin.app.data.remote.dto.CauseDonationsResponseDto
import com.wintoncoin.app.data.remote.dto.CauseUpdateDto
import com.wintoncoin.app.data.remote.dto.CauseUpdatesResponseDto
import com.wintoncoin.app.data.remote.dto.CausesResponseDto
import com.wintoncoin.app.data.remote.dto.DonateRequestDto
import com.wintoncoin.app.data.remote.dto.DonateResponseDto
import com.wintoncoin.app.data.remote.dto.GenericActionResponseDto
import com.wintoncoin.app.data.remote.dto.HumanitarianCauseDto
import com.wintoncoin.app.data.remote.dto.SubmitCauseRequestDto
import com.wintoncoin.app.data.remote.dto.SubmitCauseResponseDto
import com.wintoncoin.app.domain.model.CauseStatus
import com.wintoncoin.app.domain.model.SubmitCauseInput
import kotlinx.coroutines.runBlocking
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

class DonationRepositoryImplTest {

    private class FakeApiService(
        private val shouldFail: Boolean = false
    ) : DonationApiService {
        override suspend fun getApprovedCauses(): Response<CausesResponseDto> {
            return if (shouldFail) {
                Response.error(500, "Error de servidor".toResponseBody())
            } else {
                Response.success(
                    CausesResponseDto(
                        success = true,
                        causes = listOf(
                            HumanitarianCauseDto(
                                id = 1,
                                title = "Causa Aprobada",
                                story = "Historia",
                                goalAmount = 1000.0,
                                currentAmount = 500.0,
                                amountOnHold = 100.0,
                                status = "approved"
                            )
                        )
                    )
                )
            }
        }

        override suspend fun getMyCauses(): Response<CausesResponseDto> {
            return Response.success(CausesResponseDto(success = true, causes = emptyList()))
        }

        override suspend fun getCauseDetail(id: Int): Response<CauseDetailResponseDto> {
            return Response.success(
                CauseDetailResponseDto(
                    success = true,
                    cause = HumanitarianCauseDto(id = id, title = "Detalle Causa", story = "Historia", goalAmount = 500.0, status = "approved")
                )
            )
        }

        override suspend fun getCauseDonations(id: Int): Response<CauseDonationsResponseDto> {
            return Response.success(CauseDonationsResponseDto(success = true))
        }

        override suspend fun getCauseUpdates(id: Int): Response<CauseUpdatesResponseDto> {
            return Response.success(
                CauseUpdatesResponseDto(
                    success = true,
                    updates = listOf(CauseUpdateDto(id = 1, updateTitle = "Novedad 1", updateText = "Texto"))
                )
            )
        }

        override suspend fun submitCause(request: SubmitCauseRequestDto): Response<SubmitCauseResponseDto> {
            return Response.success(SubmitCauseResponseDto(success = true, causeId = 42))
        }

        override suspend fun donateToCause(id: Int, request: DonateRequestDto): Response<DonateResponseDto> {
            return Response.success(DonateResponseDto(success = true, message = "Donación exitosa"))
        }

        override suspend fun cancelCause(id: Int): Response<GenericActionResponseDto> {
            return Response.success(GenericActionResponseDto(success = true, message = "Cancelada"))
        }
    }

    @Test
    fun `getApprovedCauses maps DTO to domain model correctly`() = runBlocking {
        val repo = DonationRepositoryImpl(FakeApiService())
        val result = repo.getApprovedCauses()

        assertTrue(result.isSuccess)
        val causes = result.getOrThrow()
        assertEquals(1, causes.size)
        assertEquals("Causa Aprobada", causes[0].title)
        assertEquals(CauseStatus.APPROVED, causes[0].status)
        assertEquals(600.0, causes[0].totalEffectiveRaised, 0.001)
    }

    @Test
    fun `submitCause returns created cause id`() = runBlocking {
        val repo = DonationRepositoryImpl(FakeApiService())
        val result = repo.submitCause(
            SubmitCauseInput(
                title = "Nueva Causa",
                story = "Historia",
                goalAmount = 100.0,
                foundationName = null,
                beneficiaryReferralCode = null,
                beneficiarySocialUrls = null,
                evidenceUrls = null,
                userSocialUrls = null
            )
        )

        assertTrue(result.isSuccess)
        assertEquals(42, result.getOrThrow())
    }

    @Test
    fun `donateToCause returns success message`() = runBlocking {
        val repo = DonationRepositoryImpl(FakeApiService())
        val result = repo.donateToCause(1, 50.0, true)

        assertTrue(result.isSuccess)
        assertEquals("Donación exitosa", result.getOrThrow())
    }
}
