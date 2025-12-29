package com.wintoncoin.app.data.repository

import com.wintoncoin.app.data.local.SessionManager
import com.wintoncoin.app.data.model.LoginRequest
import com.wintoncoin.app.data.model.RegisterRequest
import com.wintoncoin.app.data.remote.WintonApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: WintonApi,
    private val sessionManager: SessionManager
) {
    suspend fun login(request: LoginRequest): Result<Unit> {
        return try {
            val response = api.login(request)
            if (response.isSuccessful && response.body() != null) {
                val loginResponse = response.body()!!
                sessionManager.saveToken(loginResponse.token)
                sessionManager.saveUsername(loginResponse.user.username)
                Result.success(Unit)
            } else {
                Result.failure(Exception("Error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun register(request: RegisterRequest): Result<Unit> {
        return try {
            val response = api.register(request)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun isLoggedIn(): Boolean {
        return !sessionManager.getToken().isNullOrEmpty()
    }
    
    fun logout() {
        sessionManager.clearSession()
    }
}

