// ============================================================================
// WintonCoin Android — ProfileRepositoryImpl (Implementación de Repositorio)
// ============================================================================
// Conecta la API de perfil de Retrofit con los modelos de dominio limpios.
// ============================================================================

package com.wintoncoin.app.data.repository

import android.util.Log
import com.wintoncoin.app.data.remote.api.ProfileApiService
import com.wintoncoin.app.domain.model.Rating
import com.wintoncoin.app.domain.model.RatingBreakdown
import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.SosCase
import com.wintoncoin.app.domain.model.UserProfile
import com.wintoncoin.app.domain.repository.ProfileRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProfileRepositoryImpl @Inject constructor(
    private val profileApiService: ProfileApiService
) : ProfileRepository {

    companion object {
        private const val TAG = "ProfileRepository"
    }

    override suspend fun getProfile(username: String): Result<UserProfile> {
        return try {
            val response = profileApiService.getUserProfile(username.trim())
            if (response.isSuccessful) {
                val profileDto = response.body()
                    ?: return Result.Error("Respuesta vacía del servidor al obtener perfil")

                val breakdown = profileDto.user.ratingBreakdown?.let {
                    RatingBreakdown(
                        stars5 = it.stars5,
                        stars4 = it.stars4,
                        stars3 = it.stars3,
                        stars2 = it.stars2,
                        stars1 = it.stars1
                    )
                }

                val ratings = profileDto.ratings.map {
                    Rating(
                        id = it.id,
                        raterUsername = it.raterUsername,
                        rating = it.rating,
                        comment = it.comment,
                        createdAt = it.createdAt
                    )
                }

                val profile = UserProfile(
                    username = profileDto.user.username,
                    isVerified = profileDto.user.isVerified,
                    kycVerified = profileDto.user.kycVerified,
                    walletAddress = profileDto.user.walletAddress,
                    averageRating = profileDto.user.averageRating,
                    totalRatings = profileDto.user.totalRatings,
                    ratingBreakdown = breakdown,
                    ratings = ratings
                )

                Result.Success(profile)
            } else {
                Result.Error("Error al consultar perfil (código: ${response.code()})", response.code())
            }
        } catch (e: Exception) {
            Log.e(TAG, "[NETWORK] Error consultando perfil: ${e.message}")
            Result.Error("No se pudo cargar el perfil. Verifica tu conexión.")
        }
    }

    override suspend fun getMySosCase(username: String): Result<SosCase?> {
        return try {
            val response = profileApiService.getMySosCase(username.trim())
            if (response.isSuccessful) {
                val sosDto = response.body()
                if (sosDto == null || !sosDto.hasCase || sosDto.case == null) {
                    return Result.Success(null)
                }

                val c = sosDto.case
                val sosCase = SosCase(
                    fullName = c.fullName,
                    cedula = c.cedula,
                    phone = c.phone,
                    status = c.status,
                    affectedFamilyCount = c.affectedFamilyCount,
                    description = c.description,
                    photos = c.photos,
                    createdAt = c.createdAt
                )

                Result.Success(sosCase)
            } else {
                Result.Success(null)
            }
        } catch (e: Exception) {
            Log.w(TAG, "[NETWORK] Error consultando caso SOS: ${e.message}")
            Result.Success(null)
        }
    }
}
