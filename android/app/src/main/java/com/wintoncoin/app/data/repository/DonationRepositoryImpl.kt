// ============================================================================
// WintonCoin Android — DonationRepositoryImpl
// ============================================================================
// [DATA LAYER / REPOSITORY IMPL] Implementación concreta para WintonCoin Solidario.
// ============================================================================

package com.wintoncoin.app.data.repository

import com.wintoncoin.app.data.remote.api.DonationApiService
import com.wintoncoin.app.data.remote.dto.CauseUpdateDto
import com.wintoncoin.app.data.remote.dto.DonateRequestDto
import com.wintoncoin.app.data.remote.dto.DonationItemDto
import com.wintoncoin.app.data.remote.dto.DonationsSummaryDto
import com.wintoncoin.app.data.remote.dto.HumanitarianCauseDto
import com.wintoncoin.app.data.remote.dto.SubmitCauseRequestDto
import com.wintoncoin.app.domain.model.CauseDonationsSummary
import com.wintoncoin.app.domain.model.CauseStatus
import com.wintoncoin.app.domain.model.CauseUpdate
import com.wintoncoin.app.domain.model.DonationRecord
import com.wintoncoin.app.domain.model.DonationStatus
import com.wintoncoin.app.domain.model.HumanitarianCause
import com.wintoncoin.app.domain.model.SubmitCauseInput
import com.wintoncoin.app.domain.repository.DonationRepository
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DonationRepositoryImpl @Inject constructor(
    private val apiService: DonationApiService
) : DonationRepository {

    override suspend fun getApprovedCauses(): Result<List<HumanitarianCause>> {
        return try {
            val response = apiService.getApprovedCauses()
            if (response.isSuccessful && response.body() != null) {
                val causes = response.body()!!.causes.map { it.toDomain() }
                Result.success(causes)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al obtener causas aprobadas."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getMyCauses(): Result<List<HumanitarianCause>> {
        return try {
            val response = apiService.getMyCauses()
            if (response.isSuccessful && response.body() != null) {
                val causes = response.body()!!.causes.map { it.toDomain() }
                Result.success(causes)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al obtener mis causas."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getCauseDetail(id: Int): Result<Pair<HumanitarianCause, CauseDonationsSummary?>> {
        return try {
            val response = apiService.getCauseDetail(id)
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                val cause = body.cause.toDomain()
                val donations = body.donations?.toDomain()
                Result.success(Pair(cause, donations))
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al obtener detalle de la causa."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getCauseDonations(id: Int): Result<CauseDonationsSummary> {
        return try {
            val response = apiService.getCauseDonations(id)
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                val summary = CauseDonationsSummary(
                    totalRaised = body.totalRaised,
                    totalOnHold = body.totalOnHold,
                    donationsCount = body.donationsCount,
                    releasedDonations = body.releasedDonations.map { it.toDomain() },
                    onHoldDonations = body.onHoldDonations.map { it.toDomain() }
                )
                Result.success(summary)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al obtener donaciones de la causa."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getCauseUpdates(id: Int): Result<List<CauseUpdate>> {
        return try {
            val response = apiService.getCauseUpdates(id)
            if (response.isSuccessful && response.body() != null) {
                val updates = response.body()!!.updates.map { it.toDomain() }
                Result.success(updates)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al obtener actualizaciones."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun submitCause(input: SubmitCauseInput): Result<Int> {
        return try {
            val request = SubmitCauseRequestDto(
                title = input.title,
                story = input.story,
                goalAmount = input.goalAmount,
                foundationName = input.foundationName,
                beneficiaryReferralCode = input.beneficiaryReferralCode,
                beneficiarySocialUrls = input.beneficiarySocialUrls,
                evidenceUrls = input.evidenceUrls,
                userSocialUrls = input.userSocialUrls
            )
            val response = apiService.submitCause(request)
            if (response.isSuccessful && response.body() != null) {
                val causeId = response.body()!!.causeId ?: 0
                Result.success(causeId)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al postular la causa solidaria."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun donateToCause(id: Int, amount: Double, acceptedTerms: Boolean): Result<String> {
        return try {
            val request = DonateRequestDto(
                amount = amount,
                acceptedTerms = acceptedTerms
            )
            val response = apiService.donateToCause(id, request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.message)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al procesar la donación."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun cancelCause(id: Int): Result<Unit> {
        return try {
            val response = apiService.cancelCause(id)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al cancelar la causa."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun HumanitarianCauseDto.toDomain(): HumanitarianCause {
        return HumanitarianCause(
            id = this.id,
            title = this.title,
            story = this.story,
            goalAmount = this.goalAmount,
            currentAmount = this.currentAmount,
            amountOnHold = this.amountOnHold,
            status = CauseStatus.fromRaw(this.status),
            foundationName = this.foundationName,
            creatorUsername = this.creatorUsername,
            beneficiaryUsername = this.beneficiaryUsername,
            beneficiaryReferralCode = this.beneficiaryReferralCode,
            evidenceUrls = this.evidenceUrls,
            adminNotes = this.adminNotes,
            createdAt = this.createdAt ?: "",
            formattedCreatedAt = formatDate(this.createdAt)
        )
    }

    private fun DonationItemDto.toDomain(): DonationRecord {
        return DonationRecord(
            id = this.id,
            causeId = this.causeId,
            donorUsername = this.donorUsername ?: "Anónimo",
            amount = this.amount,
            status = DonationStatus.fromRaw(this.status),
            createdAt = this.createdAt ?: "",
            formattedCreatedAt = formatDate(this.createdAt)
        )
    }

    private fun DonationsSummaryDto.toDomain(): CauseDonationsSummary {
        return CauseDonationsSummary(
            totalRaised = this.totalRaised,
            totalOnHold = this.totalOnHold,
            donationsCount = this.donationsCount,
            releasedDonations = this.releasedDonations.map { it.toDomain() },
            onHoldDonations = this.onHoldDonations.map { it.toDomain() }
        )
    }

    private fun CauseUpdateDto.toDomain(): CauseUpdate {
        return CauseUpdate(
            id = this.id,
            title = this.updateTitle,
            text = this.updateText,
            createdAt = this.createdAt ?: "",
            formattedDate = formatDate(this.createdAt)
        )
    }

    companion object {
        fun formatDate(isoString: String?): String {
            if (isoString.isNullOrBlank()) return "Reciente"
            return try {
                val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                val fallbackFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                val date = try {
                    inputFormat.parse(isoString)
                } catch (e: Exception) {
                    fallbackFormat.parse(isoString)
                } ?: return isoString

                val outputFormat = SimpleDateFormat("d 'de' MMMM 'de' yyyy, HH:mm 'hs'", Locale("es", "ES"))
                outputFormat.format(date)
            } catch (e: Exception) {
                isoString.take(16).replace("T", " ")
            }
        }
    }
}
