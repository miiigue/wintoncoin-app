package com.wintoncoin.app.data.repository

import com.wintoncoin.app.data.model.UserBalanceResponse
import com.wintoncoin.app.data.remote.WintonApi
import com.wintoncoin.app.data.local.SessionManager
import com.google.gson.Gson
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UserRepository @Inject constructor(
    private val api: WintonApi,
    private val sessionManager: SessionManager
) {
    suspend fun getBalance(): Result<UserBalanceResponse> {
        val username = sessionManager.getUsername() ?: return Result.failure(Exception("No username found"))
        return try {
            val response = api.getUserBalance(username)
            if (response.isSuccessful && response.body() != null) {
                val gson = Gson()
                val json = gson.toJson(response.body())
                val balance = gson.fromJson(json, UserBalanceResponse::class.java)
                Result.success(balance)
            } else {
                Result.failure(Exception("Error fetching balance: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

