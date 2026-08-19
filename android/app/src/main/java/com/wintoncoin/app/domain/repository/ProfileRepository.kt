// ============================================================================
// WintonCoin Android — ProfileRepository (Contrato de Dominio)
// ============================================================================
// Define las operaciones para consultar el perfil de usuario y expediente SOS.
// ============================================================================

package com.wintoncoin.app.domain.repository

import com.wintoncoin.app.domain.model.Result
import com.wintoncoin.app.domain.model.SosCase
import com.wintoncoin.app.domain.model.UserProfile

interface ProfileRepository {
    suspend fun getProfile(username: String): Result<UserProfile>
    suspend fun getMySosCase(username: String): Result<SosCase?>
}
