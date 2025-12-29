package com.wintoncoin.app.data.repository

import com.wintoncoin.app.data.model.PublicationRequest
import com.wintoncoin.app.data.model.PublicationResponse
import com.wintoncoin.app.data.remote.WintonApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PublicationRepository @Inject constructor(
    private val api: WintonApi
) {
    suspend fun createPublication(request: PublicationRequest): Result<PublicationResponse> {
        return try {
            val response = api.createPublication(request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Error al publicar: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

