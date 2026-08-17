// ============================================================================
// WintonCoin Android — WalletApiService (Interfaz Retrofit de Billetera)
// ============================================================================
// Endpoints de saldos, transacciones e historial contable del usuario.
// ============================================================================

package com.wintoncoin.app.data.remote.api

import com.wintoncoin.app.data.remote.dto.CollateralSyncRequestDto
import com.wintoncoin.app.data.remote.dto.CollateralSyncResponseDto
import com.wintoncoin.app.data.remote.dto.WalletBalanceDto
import com.wintoncoin.app.data.remote.dto.WalletHistoryResponseDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface WalletApiService {

    /**
     * Obtiene el balance consolidado del usuario autenticado.
     * Backend: GET /api/me/balance
     */
    @GET("api/me/balance")
    suspend fun getMyBalance(): Response<WalletBalanceDto>

    /**
     * Obtiene el historial completo de transacciones del usuario.
     * Backend: GET /api/me/history
     */
    @GET("api/me/history")
    suspend fun getMyHistory(): Response<WalletHistoryResponseDto>

    /**
     * Sincroniza depósitos o retiros de garantía en la Bóveda (Collateral Vault).
     * Backend: POST /api/me/collateral/sync
     */
    @POST("api/me/collateral/sync")
    suspend fun syncCollateral(
        @Body request: CollateralSyncRequestDto
    ): Response<CollateralSyncResponseDto>
}
