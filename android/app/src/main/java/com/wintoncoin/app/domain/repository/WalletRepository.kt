// ============================================================================
// WintonCoin Android — WalletRepository (Contrato de Dominio de Billetera)
// ============================================================================

package com.wintoncoin.app.domain.repository

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.TransactionItem
import com.wintoncoin.app.domain.model.WalletBalance

interface WalletRepository {
    suspend fun getMyBalance(): Result<WalletBalance>
    suspend fun getMyHistory(): Result<List<TransactionItem>>
}
