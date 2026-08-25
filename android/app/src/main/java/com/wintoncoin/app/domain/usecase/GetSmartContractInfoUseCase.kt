// ============================================================================
// WintonCoin Android — GetSmartContractInfoUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Obtiene información verificable de Smart Contracts
// on-chain (dirección pública, suministro emitido total y enlace de auditoría).
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.domain.model.SmartContractInfo
import com.wintoncoin.app.domain.repository.AccountStatementRepository
import javax.inject.Inject

class GetSmartContractInfoUseCase @Inject constructor(
    private val repository: AccountStatementRepository
) {
    suspend operator fun invoke(tokenType: String): Result<SmartContractInfo> {
        val sanitized = tokenType.trim().uppercase()
        if (sanitized != "BLUE" && sanitized != "RED") {
            return Result.failure(IllegalArgumentException("Tipo de token inválido. Debe ser BLUE o RED."))
        }
        return repository.getSmartContractInfo(sanitized)
    }
}
