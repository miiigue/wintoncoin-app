// ============================================================================
// WintonCoin Android — GetTransactionHistoryUseCase (Historial Contable)
// ============================================================================
// [DOMAIN LAYER] Obtiene la lista unificada y cronológica de transacciones.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.TransactionItem
import com.wintoncoin.app.domain.repository.WalletRepository
import javax.inject.Inject

class GetTransactionHistoryUseCase @Inject constructor(
    private val walletRepository: WalletRepository
) {
    suspend operator fun invoke(): Result<List<TransactionItem>> {
        return walletRepository.getMyHistory()
    }
}
