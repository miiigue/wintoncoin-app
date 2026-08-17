// ============================================================================
// WintonCoin Android — FormatBalanceUseCase (Formateador Oficial de Balances)
// ============================================================================
// [DOMAIN LAYER] Réplica exacta de formatBalancePlain() de walletService.js de la PWA.
// Formatea los montos con localización española (puntos para miles, comas para decimales)
// y 4 decimales obligatorios.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale
import javax.inject.Inject

class FormatBalanceUseCase @Inject constructor() {

    private val formatter: DecimalFormat by lazy {
        val symbols = DecimalFormatSymbols(Locale("es", "ES")).apply {
            groupingSeparator = '.'
            decimalSeparator = ','
        }
        DecimalFormat("#,##0.0000", symbols)
    }

    operator fun invoke(amount: Double): String {
        return formatter.format(amount)
    }
}
