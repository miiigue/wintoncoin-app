// ============================================================================
// WintonCoin Android — WalletRepositoryImpl (Implementación de Repositorio)
// ============================================================================
// Implementa la obtención y cálculo de balances Web3 y movimientos contables.
// ============================================================================

package com.wintoncoin.app.data.repository

import android.util.Log
import com.wintoncoin.app.data.remote.api.WalletApiService
import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.TransactionItem
import com.wintoncoin.app.domain.model.TransactionType
import com.wintoncoin.app.domain.model.WalletBalance
import com.wintoncoin.app.domain.repository.WalletRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WalletRepositoryImpl @Inject constructor(
    private val walletApiService: WalletApiService
) : WalletRepository {

    companion object {
        private const val TAG = "WalletRepository"
    }

    override suspend fun getMyBalance(): Result<WalletBalance> {
        return try {
            val response = walletApiService.getMyBalance()
            if (response.isSuccessful) {
                val dto = response.body()
                    ?: return Result.Error("Respuesta vacía del servidor al consultar balances")

                // Cálculo exacto según walletService.js de la PWA
                val redAvailable = maxOf(0.0, dto.creditLimit - dto.redBalance)

                val balance = WalletBalance(
                    blueAvailable = dto.blueBalance,
                    blueEscrow = dto.escrowBlueBalance,
                    redDebt = dto.redBalance,
                    redLimit = dto.creditLimit,
                    redAvailable = redAvailable,
                    collateralBalance = dto.collateralBalance,
                    web3WalletAddress = dto.web3WalletAddress,
                    kycVerified = dto.kycVerified,
                    nextDueAt = dto.nextDueAt,
                    nextDueAmount = dto.nextDueAmount,
                    nextUnlockAt = dto.nextUnlockAt,
                    nextUnlockAmount = dto.nextUnlockAmount
                )

                Result.Success(balance)
            } else {
                Result.Error("Error al consultar saldo (código: ${response.code()})", response.code())
            }
        } catch (e: Exception) {
            Log.e(TAG, "[NETWORK] Error consultando balances: ${e.message}")
            Result.Error("No se pudo conectar con el servidor para obtener los saldos.")
        }
    }

    override suspend fun getMyHistory(): Result<List<TransactionItem>> {
        return try {
            val response = walletApiService.getMyHistory()
            if (response.isSuccessful) {
                val dto = response.body() ?: return Result.Success(emptyList())

                val items = mutableListOf<TransactionItem>()

                // 1. Tareas completadas (Ingresos de BLUE)
                dto.completed.forEach { task ->
                    items.add(
                        TransactionItem(
                            id = "comp_${task.id}",
                            title = task.title,
                            amount = task.blueCost,
                            type = TransactionType.EARNED,
                            date = task.createdAt,
                            status = task.status,
                            isHumanitarian = task.isHumanitarian
                        )
                    )
                }

                // 2. Tareas publicadas (Egresos / Gastos)
                dto.authored.forEach { task ->
                    items.add(
                        TransactionItem(
                            id = "auth_${task.id}",
                            title = task.title,
                            amount = task.blueCost,
                            type = TransactionType.SPENT,
                            date = task.createdAt,
                            status = task.status,
                            isHumanitarian = task.isHumanitarian
                        )
                    )
                }

                // 3. Donaciones solidarias
                dto.donations.forEach { don ->
                    items.add(
                        TransactionItem(
                            id = "don_${don.donationId}",
                            title = don.causeTitle ?: "Donación Solidaria",
                            amount = don.amount,
                            type = TransactionType.DONATION,
                            date = don.donationCreatedAt,
                            status = don.donationStatus,
                            isHumanitarian = true
                        )
                    )
                }

                // Ordenar por fecha descendente
                val sorted = items.sortedByDescending { it.date ?: "" }
                Result.Success(sorted)
            } else {
                Result.Error("Error al consultar historial (código: ${response.code()})", response.code())
            }
        } catch (e: Exception) {
            Log.e(TAG, "[NETWORK] Error consultando historial: ${e.message}")
            Result.Error("No se pudo cargar el historial de transacciones.")
        }
    }
}
