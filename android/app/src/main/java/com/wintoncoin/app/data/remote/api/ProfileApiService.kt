// ============================================================================
// WintonCoin Android — ProfileApiService (Interfaz Retrofit de Perfil)
// ============================================================================
// Endpoints del backend para consulta de perfil público, expediente SOS y
// estado de cuenta del usuario.
// ============================================================================

package com.wintoncoin.app.data.remote.api

import com.wintoncoin.app.data.remote.dto.ProfileResponseDto
import com.wintoncoin.app.data.remote.dto.SosCaseResponseDto
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface ProfileApiService {

    /**
     * Obtiene el perfil público de un usuario y sus calificaciones.
     * Backend: GET /users/:username/profile
     */
    @GET("users/{username}/profile")
    suspend fun getUserProfile(
        @Path("username") username: String
    ): Response<ProfileResponseDto>

    /**
     * Obtiene el expediente de censo SOS Venezuela del usuario si existe.
     * Backend: GET /api/public/sos-venezuela/my-case?username=...
     */
    @GET("api/public/sos-venezuela/my-case")
    suspend fun getMySosCase(
        @Query("username") username: String
    ): Response<SosCaseResponseDto>
}
