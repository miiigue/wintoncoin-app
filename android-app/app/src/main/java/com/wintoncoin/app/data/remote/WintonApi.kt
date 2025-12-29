package com.wintoncoin.app.data.remote

import com.wintoncoin.app.data.model.LoginRequest
import com.wintoncoin.app.data.model.LoginResponse
import com.wintoncoin.app.data.model.RegisterRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface WintonApi {
    
    // Auth
    @POST("login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @POST("api/register-request")
    suspend fun register(@Body request: RegisterRequest): Response<Void>
    
    @GET("api/auth/status")
    suspend fun checkAuthStatus(): Response<Void>

    // User Data
    @GET("users/{username}/balance")
    suspend fun getUserBalance(@Path("username") username: String): Response<Any>

    // Publications
    @POST("publish")
    suspend fun createPublication(@Body request: PublicationRequest): Response<PublicationResponse>
}

