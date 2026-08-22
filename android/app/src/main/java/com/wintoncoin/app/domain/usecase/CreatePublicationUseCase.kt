// ============================================================================
// WintonCoin Android — CreatePublicationUseCase
// ============================================================================
// [DOMAIN LAYER / USE CASE] Valida las reglas de negocio estrictas para la
// creación de publicaciones (Tareas, Ventas y Donaciones Solidarias) antes de
// enviar el payload al repositorio.
// ============================================================================

package com.wintoncoin.app.domain.usecase

import com.wintoncoin.app.data.remote.dto.CreatePublicationRequest
import com.wintoncoin.app.domain.repository.MarketplaceRepository
import javax.inject.Inject

class CreatePublicationUseCase @Inject constructor(
    private val repository: MarketplaceRepository
) {
    suspend operator fun invoke(request: CreatePublicationRequest): Result<String> {
        if (request.title.trim().length < 3) {
            return Result.failure(IllegalArgumentException("El título debe tener al menos 3 caracteres."))
        }

        if (request.description.trim().length < 5) {
            return Result.failure(IllegalArgumentException("La descripción debe tener al menos 5 caracteres."))
        }

        if (request.authorUsername.isBlank()) {
            return Result.failure(IllegalArgumentException("No se ha identificado la sesión del autor."))
        }

        when (request.publicationType) {
            "request" -> {
                val cost = request.blueCost ?: 0.0
                if (cost <= 0.0) {
                    return Result.failure(IllegalArgumentException("La recompensa en BLUE debe ser mayor a 0."))
                }
            }
            "sell" -> {
                val sell = request.blueSell ?: 0.0
                if (sell <= 0.0) {
                    return Result.failure(IllegalArgumentException("El precio en BLUE debe ser mayor a 0."))
                }
            }
            "donation" -> {
                val goal = request.goalAmount ?: 0.0
                if (goal <= 0.0) {
                    return Result.failure(IllegalArgumentException("La meta de recaudación en BLUE debe ser mayor a 0."))
                }
                if (request.beneficiaryReferralCode.isNullOrBlank()) {
                    return Result.failure(IllegalArgumentException("Debes ingresar el código de referido del beneficiario."))
                }
            }
            else -> {
                return Result.failure(IllegalArgumentException("Tipo de publicación no válido."))
            }
        }

        if (request.allowRepeatParticipation) {
            val maxRepeat = request.maxRepeatPerUser ?: 1
            if (maxRepeat < 2) {
                return Result.failure(IllegalArgumentException("El máximo de repeticiones por usuario debe ser de al menos 2."))
            }
            val days = request.repeatCooldownDays ?: 0
            val hours = request.repeatCooldownHours ?: 0
            val minutes = request.repeatCooldownMinutes ?: 0
            val totalCooldownMinutes = (days * 24 * 60) + (hours * 60) + minutes
            if (totalCooldownMinutes < 1) {
                return Result.failure(IllegalArgumentException("El tiempo de espera entre repeticiones debe ser de al menos 1 minuto."))
            }
        }

        return repository.createPublication(request)
    }
}
