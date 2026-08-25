// ============================================================================
// WintonCoin Android — DonationRepository
// ============================================================================
// [DOMAIN LAYER / REPOSITORY CONTRACT] Contrato de operaciones para Winton Solidario.
// ============================================================================

package com.wintoncoin.app.domain.repository

import com.wintoncoin.app.domain.model.CauseDonationsSummary
import com.wintoncoin.app.domain.model.CauseUpdate
import com.wintoncoin.app.domain.model.HumanitarianCause
import com.wintoncoin.app.domain.model.SubmitCauseInput

interface DonationRepository {
    suspend fun getApprovedCauses(): Result<List<HumanitarianCause>>
    suspend fun getMyCauses(): Result<List<HumanitarianCause>>
    suspend fun getCauseDetail(id: Int): Result<Pair<HumanitarianCause, CauseDonationsSummary?>>
    suspend fun getCauseDonations(id: Int): Result<CauseDonationsSummary>
    suspend fun getCauseUpdates(id: Int): Result<List<CauseUpdate>>
    suspend fun submitCause(input: SubmitCauseInput): Result<Int>
    suspend fun donateToCause(id: Int, amount: Double, acceptedTerms: Boolean): Result<String>
    suspend fun cancelCause(id: Int): Result<Unit>
}
