// ============================================================================
// WintonCoin Android — AccountStatementApiService (API de Estado de Cuenta)
// ============================================================================
// [DATA LAYER / RETROFIT] Endpoints para consulta de Smart Contracts, Suministro
// y sincronización de Bóveda de Garantías.
// ============================================================================

package com.wintoncoin.app.data.remote.api

import com.wintoncoin.app.data.remote.dto.CollateralSyncRequestDto
import com.wintoncoin.app.data.remote.dto.CollateralSyncResponseDto
import com.wintoncoin.app.data.remote.dto.ContractsResponseDto
import com.wintoncoin.app.data.remote.dto.TransactionStatementItemDto
import com.wintoncoin.app.data.remote.dto.WalletBalanceDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface AccountStatementApiService {

    @GET("api/me/balance")
    suspend fun getWalletBalance(): Response<WalletBalanceDto>

    @GET("api/me/transactions")
    suspend fun getTransactions(): Response<List<TransactionStatementItemDto>>

    @GET("api/contracts/info")
    suspend fun getContractsInfo(): Response<ContractsResponseDto>

    @POST("api/me/collateral/sync")
    suspend fun syncCollateral(
        @Body request: CollateralSyncRequestDto
    ): Response<CollateralSyncResponseDto>
}
