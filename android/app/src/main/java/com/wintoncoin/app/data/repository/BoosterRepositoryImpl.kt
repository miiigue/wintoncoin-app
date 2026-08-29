// ============================================================================
// WintonCoin Android — BoosterRepositoryImpl (Implementación de Repositorio)
// ============================================================================
// [DATA LAYER / REPOSITORY] Orquesta las consultas a BoosterApiService, realiza
// el mapeo defensivo de DTOs a entidades de dominio y calcula métricas de red.
// ============================================================================

package com.wintoncoin.app.data.repository

import com.wintoncoin.app.data.remote.api.BoosterApiService
import com.wintoncoin.app.data.remote.dto.BoosterLevelDto
import com.wintoncoin.app.data.remote.dto.BoosterProfileDto
import com.wintoncoin.app.data.remote.dto.ReferralInfoResponseDto
import com.wintoncoin.app.domain.model.BoosterLedgerMovement
import com.wintoncoin.app.domain.model.BoosterLevelInfo
import com.wintoncoin.app.domain.model.BoosterProfile
import com.wintoncoin.app.domain.model.ReferralNetworkData
import com.wintoncoin.app.domain.model.ReferredMember
import com.wintoncoin.app.domain.repository.BoosterRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BoosterRepositoryImpl @Inject constructor(
    private val apiService: BoosterApiService
) : BoosterRepository {

    override suspend fun getMyBoosterProfile(): Result<BoosterProfile> {
        return try {
            val response = apiService.getMyBoosterProfile()
            if (response.isSuccessful && response.body() != null) {
                Result.success(mapProfileDtoToDomain(response.body()!!))
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al cargar tu perfil de impulsor."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getUserBoosterProfile(username: String): Result<BoosterProfile> {
        return try {
            val response = apiService.getUserBoosterProfile(username)
            if (response.isSuccessful && response.body() != null) {
                Result.success(mapProfileDtoToDomain(response.body()!!))
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al cargar el perfil de impulsor de $username."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getReferralInfo(username: String): Result<ReferralNetworkData> {
        return try {
            val response = apiService.getReferralInfo(username)
            if (response.isSuccessful && response.body() != null) {
                Result.success(mapReferralDtoToDomain(response.body()!!))
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Error al cargar la información de referidos."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun mapProfileDtoToDomain(dto: BoosterProfileDto): BoosterProfile {
        val allLevelsDomain = dto.allLevels.map { mapLevelDtoToDomain(it) }
        val currentLevelDomain = dto.currentLevelInfo?.let { mapLevelDtoToDomain(it) }
            ?: allLevelsDomain.find { it.level == dto.boosterLevel }
        val nextLevelDomain = dto.nextLevelInfo?.let { mapLevelDtoToDomain(it) }
            ?: allLevelsDomain.find { it.level == dto.boosterLevel + 1 }

        val transactionsDomain = dto.transactions.map { item ->
            BoosterLedgerMovement(
                id = item.id,
                amount = item.amount,
                createdAt = item.createdAt,
                type = item.type,
                description = item.description,
                relatedPublicationId = item.relatedPublicationId
            )
        }

        return BoosterProfile(
            isBooster = dto.isBooster,
            message = dto.message,
            username = dto.username ?: "",
            boosterLevel = dto.boosterLevel,
            totalBoosterBlue = dto.totalBoosterBlue,
            eligibleBoosterBlue = dto.eligibleBoosterBlue,
            pendingBoosterBlue = dto.pendingBoosterBlue,
            baseEligibleBoosterBlue = dto.baseEligibleBoosterBlue,
            currentLevelInfo = currentLevelDomain,
            nextLevelInfo = nextLevelDomain,
            boosterTasksCompletedCount = dto.boosterTasksCompletedCount,
            transactions = transactionsDomain,
            allLevels = allLevelsDomain,
            rankPosition = dto.rankPosition,
            rankTotal = dto.rankTotal,
            rankPercentile = dto.rankPercentile,
            friendsRankPosition = dto.friendsRankPosition,
            friendsRankTotal = dto.friendsRankTotal,
            friendsRankPercentile = dto.friendsRankPercentile,
            dailyToday = dto.dailyToday,
            dailyYesterday = dto.dailyYesterday,
            dailyImproved = dto.dailyImproved
        )
    }

    private fun mapLevelDtoToDomain(dto: BoosterLevelDto): BoosterLevelInfo {
        val minBlue = dto.minBlueRequired.replace(',', '.').toDoubleOrNull() ?: 0.0
        return BoosterLevelInfo(
            level = dto.level,
            name = dto.name,
            minBlueRequired = minBlue,
            description = dto.description
        )
    }

    private fun mapReferralDtoToDomain(dto: ReferralInfoResponseDto): ReferralNetworkData {
        val code = dto.referralCode ?: ""
        val link = if (code.isNotBlank()) "https://demo.wintoncoin.com/register.html?ref=$code" else ""

        val members = dto.referredUsers.map { u ->
            ReferredMember(
                username = u.referredUsername,
                kycVerified = u.kycVerified,
                registrationDate = u.createdAt,
                totalBoosterBlue = u.totalBoosterBlue
            )
        }

        val totalCount = members.size
        val kycCount = members.count { it.kycVerified }
        val totalEarned = members.sumOf { it.totalBoosterBlue }

        return ReferralNetworkData(
            referralCode = code,
            referralLink = link,
            referredUsers = members,
            totalReferredCount = totalCount,
            kycVerifiedCount = kycCount,
            totalBoosterBlueGenerated = totalEarned
        )
    }
}
