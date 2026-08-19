// ============================================================================
// WintonCoin Android — GetWalletBalanceUseCase (Caso de Uso de Balances)
// ============================================================================
// [DOMAIN LAYER] Obtiene los saldos y calcula métricas crediticias del usuario.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.WalletBalance
import com.wintoncoin.app.domain.repository.WalletRepository
import javax.inject.Inject

class GetWalletBalanceUseCase @Inject constructor(
    private val walletRepository: WalletRepository
) {
    suspend operator fun invoke(): Result<WalletBalance> {
        return walletRepository.getMyBalance()
    }
}
